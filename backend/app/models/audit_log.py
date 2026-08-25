"""
AuditLog database model.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from app.database import BaseModel
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(BaseModel):
    """
    AuditLog model representing immutable logs of system operations and user actions.
    """

    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
        comment="FK reference to the User performing the action (nullable for system events)",
    )
    entity_name: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
        comment="Name of the affected entity/table (e.g. Employee, User)",
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        comment="Primary key ID of the affected entity record",
    )
    action: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
        comment="The action performed (e.g. CREATE, UPDATE, DELETE, LOGIN)",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Human-readable description of the log entry",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="IP address from which the action was initiated (supports IPv4 and IPv6)",
    )
    created_at_audit: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
        comment="Timestamp when the action occurred",
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="audit_logs",
    )
