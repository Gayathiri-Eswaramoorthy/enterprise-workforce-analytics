"""
PredictionHistory and ModelRegistry repository.
"""

from collections.abc import Sequence
from uuid import UUID

from app.database import PredictionType, RiskLevel
from app.models import ModelRegistry, PredictionHistory
from app.repositories.base_repository import BaseRepository
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session, selectinload


class PredictionRepository(BaseRepository[PredictionHistory]):
    def __init__(self):
        super().__init__(PredictionHistory)

    # ModelRegistry operations
    def get_active_model(self, db: Session) -> ModelRegistry | None:
        stmt = (
            select(ModelRegistry)
            .where(ModelRegistry.is_active == True)
            .order_by(desc(ModelRegistry.deployed_at), desc(ModelRegistry.created_at))
        )
        return db.execute(stmt).scalars().first()

    def get_model_by_version(self, db: Session, version: str) -> ModelRegistry | None:
        stmt = select(ModelRegistry).where(ModelRegistry.model_version == version)
        return db.execute(stmt).scalar_one_or_none()

    def list_models(self, db: Session) -> Sequence[ModelRegistry]:
        stmt = select(ModelRegistry).order_by(desc(ModelRegistry.created_at))
        return db.execute(stmt).scalars().all()

    def set_active_model(self, db: Session, model_id: UUID) -> ModelRegistry | None:
        db.execute(update(ModelRegistry).values(is_active=False))
        target = db.execute(
            select(ModelRegistry).where(ModelRegistry.id == model_id)
        ).scalar_one_or_none()
        if target:
            target.is_active = True
            db.commit()
            db.refresh(target)
        return target

    # Prediction History
    def list_history(
        self,
        db: Session,
        employee_id: UUID | None = None,
        risk_level: RiskLevel | None = None,
        prediction_type: PredictionType | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[PredictionHistory], int]:
        stmt = select(PredictionHistory).options(
            selectinload(PredictionHistory.employee),
            selectinload(PredictionHistory.model),
        )
        if employee_id:
            stmt = stmt.where(PredictionHistory.employee_id == employee_id)
        if risk_level:
            stmt = stmt.where(PredictionHistory.risk_level == risk_level)
        if prediction_type:
            stmt = stmt.where(PredictionHistory.prediction_type == prediction_type)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        stmt = stmt.order_by(desc(PredictionHistory.generated_at)).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total

    def monthly_risk_trend(self, db: Session, months: int = 6) -> list[dict]:
        """Employees per risk level for each month, using each person's last reading that month."""
        month = func.date_trunc("month", PredictionHistory.generated_at)
        latest = (
            select(month.label("month"), PredictionHistory.risk_level.label("risk_level"))
            .where(PredictionHistory.prediction_type == PredictionType.ATTRITION)
            .distinct(PredictionHistory.employee_id, month)
            .order_by(PredictionHistory.employee_id, month, desc(PredictionHistory.generated_at))
            .subquery()
        )
        stmt = select(latest.c.month, latest.c.risk_level, func.count()).group_by(
            latest.c.month, latest.c.risk_level
        )
        by_month: dict = {}
        for m, level, count in db.execute(stmt).all():
            row = by_month.setdefault(
                m, {"month": m.strftime("%Y-%m"), "low": 0, "medium": 0, "high": 0, "critical": 0}
            )
            row[level.value.lower()] = count
        return [by_month[m] for m in sorted(by_month)][-months:]

    def get_latest_employee_prediction(
        self, db: Session, employee_id: UUID
    ) -> PredictionHistory | None:
        stmt = (
            select(PredictionHistory)
            .where(PredictionHistory.employee_id == employee_id)
            .order_by(desc(PredictionHistory.generated_at))
            .options(
                selectinload(PredictionHistory.model),
                selectinload(PredictionHistory.employee),
            )
        )
        return db.execute(stmt).scalars().first()
