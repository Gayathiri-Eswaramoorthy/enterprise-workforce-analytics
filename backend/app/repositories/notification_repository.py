"""
Notification repository for user alerts and inbox.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from app.models import Notification
from app.repositories.base_repository import BaseRepository
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self):
        super().__init__(Notification)

    def list_user_notifications(
        self,
        db: Session,
        user_id: UUID,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> Sequence[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)
        stmt = stmt.order_by(desc(Notification.created_at_notification)).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()

    def get_unread_count(self, db: Session, user_id: UUID) -> int:
        stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        return db.execute(stmt).scalar() or 0

    def mark_as_read(
        self, db: Session, notification_id: UUID, user_id: UUID
    ) -> Notification | None:
        notification = db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        ).scalar_one_or_none()
        if notification:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(notification)
        return notification

    def mark_all_as_read(self, db: Session, user_id: UUID) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount
