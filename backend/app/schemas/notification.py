"""
Notification schemas for user alerts and inbox.
"""

from datetime import datetime
from uuid import UUID

from app.database import NotificationType
from pydantic import BaseModel, ConfigDict, Field


class NotificationBase(BaseModel):
    user_id: UUID
    title: str = Field(..., max_length=255)
    message: str
    notification_type: NotificationType = NotificationType.ALERT


class NotificationCreate(NotificationBase):
    pass


class NotificationResponse(NotificationBase):
    id: UUID
    is_read: bool
    read_at: datetime | None = None
    created_at_notification: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread_count: int
