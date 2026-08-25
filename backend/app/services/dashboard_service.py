"""
DashboardService: Aggregates real PostgreSQL organizational data for executive HR analytics.
"""

from collections import Counter

from app.database import EmploymentStatus, EnrollmentStatus, RecommendationStatus, RiskLevel
from app.models import (
    Department,
    Employee,
    PerformanceReview,
    PredictionHistory,
    Recommendation,
    TrainingCourse,
    TrainingEnrollment,
)
from app.schemas.analytics import DashboardMetrics
from app.services.skill_gap_service import SkillGapService
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload


class DashboardService:
    def __init__(self):
        self.skill_gap_service = SkillGapService()

    def get_dashboard_metrics(self, db: Session) -> DashboardMetrics:
        # Total and active employees
        total_employees = db.execute(select(func.count(Employee.id))).scalar() or 0
        active_employees = (
            db.execute(
                select(func.count(Employee.id)).where(
                    Employee.employment_status == EmploymentStatus.ACTIVE,
                    Employee.is_deleted == False,  # noqa: E712
                )
            ).scalar()
            or 0
        )

        # High / Critical risk count based on latest predictions
        # Subquery to get latest prediction per employee
        latest_preds_sub = select(
            PredictionHistory.employee_id,
            PredictionHistory.risk_level,
            PredictionHistory.prediction_score,
            PredictionHistory.prediction_result,
            PredictionHistory.generated_at,
            func.row_number()
            .over(
                partition_by=PredictionHistory.employee_id,
                order_by=PredictionHistory.generated_at.desc(),
            )
            .label("rn"),
        ).subquery()

        latest_preds = db.execute(select(latest_preds_sub).where(latest_preds_sub.c.rn == 1)).all()

        high_risk_count = sum(
            1 for p in latest_preds if p.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)
        )

        # Risk distribution counts
        risk_counter = Counter(p.risk_level.value for p in latest_preds)
        risk_distribution = {
            "low": risk_counter.get("LOW", 0),
            "medium": risk_counter.get("MEDIUM", 0),
            "high": risk_counter.get("HIGH", 0),
            "critical": risk_counter.get("CRITICAL", 0),
        }

        # Pending recommendations count
        pending_recs = (
            db.execute(
                select(func.count(Recommendation.id)).where(
                    Recommendation.status == RecommendationStatus.PENDING
                )
            ).scalar()
            or 0
        )

        # Training courses & enrollments metrics
        total_courses = (
            db.execute(
                select(func.count(TrainingCourse.id)).where(
                    TrainingCourse.is_active == True
                )  # noqa: E712
            ).scalar()
            or 0
        )
        total_enrollments = db.execute(select(func.count(TrainingEnrollment.id))).scalar() or 0
        completed_enrollments = (
            db.execute(
                select(func.count(TrainingEnrollment.id)).where(
                    TrainingEnrollment.enrollment_status == EnrollmentStatus.COMPLETED
                )
            ).scalar()
            or 0
        )
        active_enrollments = (
            db.execute(
                select(func.count(TrainingEnrollment.id)).where(
                    TrainingEnrollment.enrollment_status.in_(
                        [
                            EnrollmentStatus.ENROLLED,
                            EnrollmentStatus.IN_PROGRESS,
                        ]
                    )
                )
            ).scalar()
            or 0
        )
        training_completion_rate = (
            round((completed_enrollments / total_enrollments) * 100.0, 1)
            if total_enrollments > 0
            else 0.0
        )

        # Department distribution
        dept_rows = db.execute(
            select(
                Department.id,
                Department.name,
                Department.department_code,
                func.count(Employee.id).label("headcount"),
            )
            .outerjoin(
                Employee,
                (Employee.department_id == Department.id)
                & (Employee.is_deleted == False),  # noqa: E712
            )
            .group_by(Department.id, Department.name, Department.department_code)
            .order_by(func.count(Employee.id).desc())
        ).all()

        department_distribution = [
            {
                "department_id": str(r.id),
                "name": r.name,
                "code": r.department_code,
                "headcount": r.headcount,
            }
            for r in dept_rows
        ]

        # Skill gap intelligence
        top_skill_gaps = self.skill_gap_service.get_organization_top_skill_gaps(db, limit=6)
        total_skill_gaps_count = sum(g.affected_employees_count for g in top_skill_gaps)
        critical_skill_gaps_count = sum(g.mandatory_gaps_count for g in top_skill_gaps)

        # Performance trend aggregation by review period
        trends_stmt = (
            select(
                PerformanceReview.review_period,
                func.avg(PerformanceReview.performance_score).label("average_score"),
                func.count(PerformanceReview.id).label("review_count"),
                func.min(PerformanceReview.review_date).label("min_date"),
            )
            .group_by(PerformanceReview.review_period)
            .order_by("min_date")
        )
        trends_rows = db.execute(trends_stmt).all()
        performance_trends = [
            {
                "period": row.review_period,
                "average_score": float(row.average_score) if row.average_score is not None else 0.0,
                "review_count": row.review_count,
            }
            for row in trends_rows
        ]

        # Recent high risk alerts
        recent_alerts_stmt = (
            select(PredictionHistory)
            .where(PredictionHistory.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]))
            .order_by(PredictionHistory.generated_at.desc())
            .limit(5)
            .options(
                selectinload(PredictionHistory.employee).selectinload(Employee.department),
                selectinload(PredictionHistory.employee).selectinload(Employee.job_role),
            )
        )
        recent_alert_rows = db.execute(recent_alerts_stmt).scalars().all()
        recent_high_risk_alerts = [
            {
                "id": str(a.id),
                "employee_id": str(a.employee_id),
                "employee_name": (
                    f"{a.employee.first_name} {a.employee.last_name}" if a.employee else "Unknown"
                ),
                "employee_code": a.employee.employee_code if a.employee else "",
                "department": (
                    a.employee.department.name if a.employee and a.employee.department else ""
                ),
                "role": a.employee.job_role.title if a.employee and a.employee.job_role else "",
                "risk_level": a.risk_level.value,
                "score": float(a.prediction_score),
                "reason": a.prediction_reason,
                "generated_at": a.generated_at.isoformat(),
            }
            for a in recent_alert_rows
        ]

        # Top pending recommendations
        recs_stmt = (
            select(Recommendation)
            .where(Recommendation.status == RecommendationStatus.PENDING)
            .order_by(Recommendation.generated_at.desc())
            .limit(5)
            .options(
                selectinload(Recommendation.employee).selectinload(Employee.department),
            )
        )
        recent_recs = db.execute(recs_stmt).scalars().all()
        top_recommendations = [
            {
                "id": str(r.id),
                "employee_id": str(r.employee_id),
                "employee_name": (
                    f"{r.employee.first_name} {r.employee.last_name}" if r.employee else ""
                ),
                "department": (
                    r.employee.department.name if r.employee and r.employee.department else ""
                ),
                "type": r.recommendation_type.value,
                "title": r.title,
                "description": r.description,
                "priority": r.priority.value,
                "generated_at": r.generated_at.isoformat(),
            }
            for r in recent_recs
        ]

        # Average performance score across all reviews
        avg_perf_score = db.execute(select(func.avg(PerformanceReview.performance_score))).scalar()
        average_performance_score = float(avg_perf_score) if avg_perf_score is not None else 0.0

        return DashboardMetrics(
            total_employees=total_employees,
            active_employees=active_employees,
            high_risk_employees_count=high_risk_count,
            average_performance_score=average_performance_score,
            total_skill_gaps_count=total_skill_gaps_count,
            critical_skill_gaps_count=critical_skill_gaps_count,
            pending_recommendations_count=pending_recs,
            training_completion_rate=training_completion_rate,
            total_training_courses=total_courses,
            active_enrollments=active_enrollments,
            department_distribution=department_distribution,
            risk_distribution=risk_distribution,
            performance_trends=performance_trends,
            top_skill_gaps=top_skill_gaps,
            recent_high_risk_alerts=recent_high_risk_alerts,
            top_recommendations=top_recommendations,
        )
