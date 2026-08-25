"""
AuditLog repository for compliance and activity tracking.
"""

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from app.models import AuditLog
from app.repositories.base_repository import BaseRepository
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

    def list_logs(
        self,
        db: Session,
        entity_name: str | None = None,
        action: str | None = None,
        user_id: UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[AuditLog], int]:
        stmt = select(AuditLog).options(selectinload(AuditLog.user))
        if entity_name:
            stmt = stmt.where(AuditLog.entity_name == entity_name)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if user_id:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if start_date:
            stmt = stmt.where(AuditLog.created_at_audit >= start_date)
        if end_date:
            stmt = stmt.where(AuditLog.created_at_audit <= end_date)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        stmt = stmt.order_by(desc(AuditLog.created_at_audit)).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total
