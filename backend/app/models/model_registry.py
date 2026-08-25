"""
ModelRegistry database model.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.prediction_history import PredictionHistory


class ModelRegistry(BaseModel):
    """
    ModelRegistry model representing registered machine learning models and their metrics.
    """

    __tablename__ = "model_registry"

    model_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Descriptive name of the ML model",
    )
    model_version: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Semantic version of the model (e.g. v1.0.0)",
    )
    algorithm: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
        comment="The algorithm used to train the model (e.g., Random Forest)",
    )
    training_dataset: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Reference or name of the dataset used for training",
    )
    accuracy: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Model evaluation accuracy score percentage",
    )
    precision_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Model evaluation precision score percentage",
    )
    recall_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Model evaluation recall score percentage",
    )
    f1_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Model evaluation F1 score percentage",
    )
    model_file_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="File path or URI where the serialized model binary is stored",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
        comment="Indicates whether this model version is active for inference",
    )
    deployed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when this model version was set active/deployed",
    )

    # Relationships
    predictions: Mapped[list["PredictionHistory"]] = relationship(
        "PredictionHistory",
        back_populates="model",
        passive_deletes=True,
    )
