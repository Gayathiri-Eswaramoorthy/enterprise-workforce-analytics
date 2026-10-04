"""
RevokedToken database model.
"""

import uuid
from datetime import datetime

from app.database import BaseModel
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class RevokedToken(BaseModel):
    """
    Denylist of JWT IDs (jti) that must no longer be accepted, populated on logout
    and on refresh-token rotation. Rows can be purged once expires_at has passed,
    since the token would be rejected for expiry anyway.
    """

    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique JWT ID of the revoked token",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the user the token was issued to",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
        comment="Original expiry of the token; row is safe to delete after this",
    )
