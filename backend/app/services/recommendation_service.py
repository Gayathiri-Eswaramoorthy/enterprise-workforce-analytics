"""
RecommendationEngine: Matches skill gaps and risk factors to actionable training & retention actions.
"""

from uuid import UUID

from app.database import PriorityLevel, RecommendationStatus, RecommendationType
from app.models import (
    Recommendation,
)
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.recommendation_repository import RecommendationRepository
from app.repositories.training_repository import TrainingRepository
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationStatusUpdate,
)
from app.services.skill_gap_service import SkillGapService
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class RecommendationService:
    def __init__(self):
        self.repository = RecommendationRepository()
        self.employee_repo = EmployeeRepository()
        self.training_repo = TrainingRepository()
        self.pred_repo = PredictionRepository()
        self.skill_gap_service = SkillGapService()

    def list_recommendations(
        self,
        db: Session,
        employee_id: UUID | None = None,
        rec_type: RecommendationType | None = None,
        status: RecommendationStatus | None = None,
        priority: PriorityLevel | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[RecommendationResponse], int]:
        skip = (page - 1) * page_size
        items, total = self.repository.list_recommendations(
            db,
            employee_id=employee_id,
            rec_type=rec_type,
            status=status,
            priority=priority,
            skip=skip,
            limit=page_size,
        )
        return [self._format_response(r) for r in items], total

    def update_recommendation_status(
        self,
        db: Session,
        rec_id: UUID,
        status_in: RecommendationStatusUpdate,
    ) -> RecommendationResponse:
        rec = self.repository.get_by_id_with_relations(db, rec_id)
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation not found",
            )
        rec = self.repository.update_status(db, rec, status_in.status)
        return self._format_response(rec)

    def generate_recommendations_for_employee(
        self, db: Session, employee_id: UUID
    ) -> list[RecommendationResponse]:
        """
        Derive intelligent, grounded recommendations from skill gaps and performance/attrition risk.
        """
        emp = self.employee_repo.get_by_id_with_relations(db, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        gap_report = self.skill_gap_service.calculate_employee_skill_gaps(db, employee_id)
        existing_recs = self.repository.list_recommendations(
            db, employee_id=employee_id, status=RecommendationStatus.PENDING, limit=100
        )[0]
        existing_titles = {r.title for r in existing_recs}

        new_recs: list[Recommendation] = []

        # 1. Training recommendations for skill gaps
        for gap in gap_report.gaps:
            if gap.gap <= 0:
                continue

            # Find matching active courses that target this skill
            matching_courses = self.training_repo.find_courses_for_skills(db, [gap.skill_id])
            for course in matching_courses:
                title = f"Enroll in {course.title} for {gap.skill_name}"
                if title not in existing_titles:
                    priority = (
                        PriorityLevel.CRITICAL
                        if gap.severity == "CRITICAL"
                        else PriorityLevel.HIGH if gap.severity == "HIGH" else PriorityLevel.MEDIUM
                    )
                    desc = (
                        f"Employee has a {gap.severity} skill gap in '{gap.skill_name}' "
                        f"(Current: {gap.current_proficiency}/5, Required: {gap.required_proficiency}/5). "
                        f"Recommended course: {course.title} ({course.duration_hours} hrs, {course.difficulty_level.value} level)."
                    )
                    rec = Recommendation(
                        employee_id=employee_id,
                        recommendation_type=RecommendationType.TRAINING,
                        title=title,
                        description=desc,
                        priority=priority,
                        status=RecommendationStatus.PENDING,
                    )
                    db.add(rec)
                    new_recs.append(rec)
                    existing_titles.add(title)

        # 2. Check latest risk prediction for retention recommendation
        latest_pred = self.pred_repo.get_latest_employee_prediction(db, employee_id)
        if latest_pred and latest_pred.risk_level.value in ("HIGH", "CRITICAL"):
            title = f"High Risk Retention Action Plan for {emp.first_name} {emp.last_name}"
            if title not in existing_titles:
                desc = (
                    f"Employee identified with {latest_pred.risk_level.value} workforce attrition risk "
                    f"(Score: {latest_pred.prediction_score}%). Primary reasons: {latest_pred.prediction_reason or 'Workforce dynamics'}. "
                    f"Initiate manager check-in, workload balancing, and career roadmap alignment."
                )
                rec = Recommendation(
                    employee_id=employee_id,
                    prediction_history_id=latest_pred.id,
                    recommendation_type=RecommendationType.RETENTION,
                    title=title,
                    description=desc,
                    priority=(
                        PriorityLevel.CRITICAL
                        if latest_pred.risk_level.value == "CRITICAL"
                        else PriorityLevel.HIGH
                    ),
                    status=RecommendationStatus.PENDING,
                )
                db.add(rec)
                new_recs.append(rec)
                existing_titles.add(title)

        if new_recs:
            db.commit()
            for r in new_recs:
                db.refresh(r)

        # Return all pending recommendations
        all_recs = self.repository.list_recommendations(db, employee_id=employee_id, limit=50)[0]
        return [self._format_response(r) for r in all_recs]

    def _format_response(self, rec: Recommendation) -> RecommendationResponse:
        resp = RecommendationResponse.model_validate(rec)
        if rec.employee:
            resp.employee_name = f"{rec.employee.first_name} {rec.employee.last_name}"
            resp.employee_code = rec.employee.employee_code
            if rec.employee.department:
                resp.department_name = rec.employee.department.name
            if rec.employee.job_role:
                resp.job_role_title = rec.employee.job_role.title
        return resp
