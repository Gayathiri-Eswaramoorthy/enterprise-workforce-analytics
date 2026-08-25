"""
PerformanceReview repository for evaluation history.
"""

from collections.abc import Sequence
from uuid import UUID

from app.database import ReviewCycle
from app.models import PerformanceReview
from app.repositories.base_repository import BaseRepository
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload


class PerformanceRepository(BaseRepository[PerformanceReview]):
    def __init__(self):
        super().__init__(PerformanceReview)

    def get_by_id_with_relations(self, db: Session, review_id: UUID) -> PerformanceReview | None:
        stmt = (
            select(PerformanceReview)
            .where(PerformanceReview.id == review_id)
            .options(
                selectinload(PerformanceReview.employee),
                selectinload(PerformanceReview.reviewer),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_reviews(
        self,
        db: Session,
        employee_id: UUID | None = None,
        reviewer_id: UUID | None = None,
        review_cycle: ReviewCycle | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[PerformanceReview], int]:
        stmt = select(PerformanceReview).options(
            selectinload(PerformanceReview.employee),
            selectinload(PerformanceReview.reviewer),
        )
        if employee_id:
            stmt = stmt.where(PerformanceReview.employee_id == employee_id)
        if reviewer_id:
            stmt = stmt.where(PerformanceReview.reviewer_id == reviewer_id)
        if review_cycle:
            stmt = stmt.where(PerformanceReview.review_cycle == review_cycle)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        stmt = stmt.order_by(desc(PerformanceReview.review_date)).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total

    def get_employee_reviews(self, db: Session, employee_id: UUID) -> Sequence[PerformanceReview]:
        stmt = (
            select(PerformanceReview)
            .where(PerformanceReview.employee_id == employee_id)
            .order_by(desc(PerformanceReview.review_date))
            .options(selectinload(PerformanceReview.reviewer))
        )
        return db.execute(stmt).scalars().all()
