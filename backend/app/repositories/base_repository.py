"""
Base generic repository utilizing SQLAlchemy 2.x patterns.
"""

from collections.abc import Sequence
from typing import Any, Generic, TypeVar
from uuid import UUID

from app.database import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

ModelType = TypeVar("ModelType", bound=BaseModel)


class BaseRepository(Generic[ModelType]):
    """
    Generic Base Repository providing standard CRUD database operations.
    """

    def __init__(self, model: type[ModelType]):
        self.model = model

    def get_by_id(self, db: Session, id: UUID) -> ModelType | None:
        return db.execute(select(self.model).where(self.model.id == id)).scalar_one_or_none()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> Sequence[ModelType]:
        stmt = select(self.model).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()

    def count(self, db: Session) -> int:
        stmt = select(func.count()).select_from(self.model)
        return db.execute(stmt).scalar() or 0

    def create(self, db: Session, obj_in: dict[str, Any] | ModelType) -> ModelType:
        if isinstance(obj_in, dict):
            db_obj = self.model(**obj_in)
        else:
            db_obj = obj_in
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: ModelType,
        obj_in: dict[str, Any],
    ) -> ModelType:
        for field, value in obj_in.items():
            if hasattr(db_obj, field) and value is not None:
                setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: UUID) -> bool:
        stmt = delete(self.model).where(self.model.id == id)
        result = db.execute(stmt)
        db.commit()
        return result.rowcount > 0
