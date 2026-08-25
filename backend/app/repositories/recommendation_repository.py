"""
Recommendation repository for action items and lifecycle transitions.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from app.database import PriorityLevel, RecommendationStatus, RecommendationType
from app.models import Employee, Recommendation
from app.repositories.base_repository import BaseRepository
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload


class RecommendationRepository(BaseRepository[Recommendation]):
    def __init__(self):
        super().__init__(Recommendation)

    def get_by_id_with_relations(self, db: Session, rec_id: UUID) -> Recommendation | None:
        stmt = (
            select(Recommendation)
            .where(Recommendation.id == rec_id)
            .options(
                selectinload(Recommendation.employee).selectinload(Employee.department),
                selectinload(Recommendation.employee).selectinload(Employee.job_role),
                selectinload(Recommendation.prediction_history),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_recommendations(
        self,
        db: Session,
        employee_id: UUID | None = None,
        rec_type: RecommendationType | None = None,
        status: RecommendationStatus | None = None,
        priority: PriorityLevel | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[Recommendation], int]:
        stmt = select(Recommendation).options(
            selectinload(Recommendation.employee).selectinload(Employee.department),
            selectinload(Recommendation.employee).selectinload(Employee.job_role),
            selectinload(Recommendation.prediction_history),
        )
        if employee_id:
            stmt = stmt.where(Recommendation.employee_id == employee_id)
        if rec_type:
            stmt = stmt.where(Recommendation.recommendation_type == rec_type)
        if status:
            stmt = stmt.where(Recommendation.status == status)
        if priority:
            stmt = stmt.where(Recommendation.priority == priority)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        stmt = stmt.order_by(desc(Recommendation.generated_at)).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total

    def update_status(
        self, db: Session, rec: Recommendation, new_status: RecommendationStatus
    ) -> Recommendation:
        rec.status = new_status
        if new_status in (RecommendationStatus.COMPLETED, RecommendationStatus.REJECTED):
            rec.resolved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(rec)
        return rec
