"""
Notification service for system alerts, risk notifications, and recommendation prompts.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from app.database import NotificationType
from app.models import Notification
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import NotificationResponse
from sqlalchemy.orm import Session


class NotificationService:
    def __init__(self):
        self.repository = NotificationRepository()

    def create_notification(
        self,
        db: Session,
        user_id: UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.ALERT,
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            created_at_notification=datetime.now(timezone.utc),
        )
        return self.repository.create(db, notif)

    def list_notifications(
        self,
        db: Session,
        user_id: UUID,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 50,
    ) -> Sequence[NotificationResponse]:
        skip = (page - 1) * page_size
        items = self.repository.list_user_notifications(
            db, user_id=user_id, unread_only=unread_only, skip=skip, limit=page_size
        )
        return [NotificationResponse.model_validate(item) for item in items]

    def get_unread_count(self, db: Session, user_id: UUID) -> int:
        return self.repository.get_unread_count(db, user_id=user_id)

    def mark_notification_read(
        self, db: Session, notification_id: UUID, user_id: UUID
    ) -> NotificationResponse | None:
        notif = self.repository.mark_as_read(db, notification_id, user_id)
        if notif:
            return NotificationResponse.model_validate(notif)
        return None

    def mark_all_read(self, db: Session, user_id: UUID) -> int:
        return self.repository.mark_all_as_read(db, user_id)
