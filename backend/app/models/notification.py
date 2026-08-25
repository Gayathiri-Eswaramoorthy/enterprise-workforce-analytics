"""
Notification database model.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from app.database import BaseModel, NotificationType
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.user import User


class Notification(BaseModel):
    """
    Notification model representing alerts, reminders, and system notifications for users.
    """

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the User receiving the notification",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Short header title of the notification",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full text message of the notification",
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type"),
        index=True,
        nullable=False,
        comment="Type of notification (e.g. SYSTEM, ALERT, AI_RECOMMENDATION)",
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        index=True,
        nullable=False,
        comment="Indicates whether the notification has been read",
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the notification was marked read",
    )
    created_at_notification: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the notification was created",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notifications",
    )
