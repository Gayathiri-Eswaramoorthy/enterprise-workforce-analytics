"""
PredictionHistory database model.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from app.database import BaseModel, PredictionType, RiskLevel
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.model_registry import ModelRegistry
    from app.models.recommendation import Recommendation


class PredictionHistory(BaseModel):
    """
    PredictionHistory model representing an immutable log of ML inference predictions.
    """

    __tablename__ = "prediction_history"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee for whom prediction is generated",
    )
    model_registry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("model_registry.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Model version used for inference",
    )
    prediction_type: Mapped[PredictionType] = mapped_column(
        SAEnum(PredictionType, name="prediction_type"),
        index=True,
        nullable=False,
        comment="Type of prediction cycle (e.g. ATTRITION, PERFORMANCE)",
    )
    prediction_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Numerical prediction score or probability percentage",
    )
    confidence_score: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=True,
        comment="Optional model confidence score for the prediction",
    )
    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel, name="risk_level"),
        index=True,
        nullable=False,
        comment="Categorical risk level (e.g., LOW, CRITICAL)",
    )
    prediction_result: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Summary result string of the prediction (e.g., Retained, At-Risk)",
    )
    prediction_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation or primary drivers for the prediction",
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
        comment="Timestamp when the prediction was generated",
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="prediction_history",
    )
    model: Mapped["ModelRegistry"] = relationship(
        "ModelRegistry",
        back_populates="predictions",
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(
        "Recommendation",
        back_populates="prediction_history",
        passive_deletes=True,
    )
