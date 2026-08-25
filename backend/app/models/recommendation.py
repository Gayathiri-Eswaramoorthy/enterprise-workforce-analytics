"""
Recommendation database model.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from app.database import (
    BaseModel,
    PriorityLevel,
    RecommendationStatus,
    RecommendationType,
)
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.prediction_history import PredictionHistory


class Recommendation(BaseModel):
    """
    Recommendation model representing AI-driven training, retention, or career action items.
    """

    __tablename__ = "recommendations"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee who receives this recommendation",
    )
    prediction_history_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prediction_history.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
        comment="Optional FK reference to the specific Attrition/Performance prediction that triggered this",
    )
    recommendation_type: Mapped[RecommendationType] = mapped_column(
        SAEnum(RecommendationType, name="recommendation_type"),
        index=True,
        nullable=False,
        comment="Focus type of recommendation (e.g. TRAINING, RETENTION, PROMOTION)",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Short summary of the recommendation",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Detailed action item and description",
    )
    priority: Mapped[PriorityLevel] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"),
        index=True,
        nullable=False,
        comment="Severity or urgency priority of the recommendation",
    )
    status: Mapped[RecommendationStatus] = mapped_column(
        SAEnum(RecommendationStatus, name="recommendation_status"),
        index=True,
        nullable=False,
        comment="Lifecycle status of recommendation (e.g., PENDING, ACCEPTED, COMPLETED)",
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when recommendation was generated",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when recommendation was resolved/completed",
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="recommendations",
    )
    prediction_history: Mapped[Optional["PredictionHistory"]] = relationship(
        "PredictionHistory",
        back_populates="recommendations",
    )
