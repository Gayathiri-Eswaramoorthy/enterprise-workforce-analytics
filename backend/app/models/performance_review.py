"""
PerformanceReview database model.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel, ReviewCycle

if TYPE_CHECKING:
    from app.models.user import User


class PerformanceReview(BaseModel):
    """
    PerformanceReview model representing periodic employee evaluation and rating history.
    """

    __tablename__ = "performance_reviews"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee being reviewed",
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the User performing the review",
    )
    review_cycle: Mapped[ReviewCycle] = mapped_column(
        SAEnum(ReviewCycle, name="review_cycle"),
        nullable=False,
        comment="Review cycle period type (e.g. MONTHLY, QUARTERLY, ANNUAL)",
    )
    review_period: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Specific cycle string (e.g. Q1 2026, Mid-Year 2026)",
    )
    review_date: Mapped[date] = mapped_column(
        Date,
        index=True,
        nullable=False,
        comment="The date when the review was conducted",
    )
    performance_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Calculated overall score percentage or numeric evaluation score",
    )
    overall_rating: Mapped[int] = mapped_column(
        index=True,
        nullable=False,
        comment="Overall rating score (1 to 5)",
    )
    strengths: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Written notes on employee strengths",
    )
    improvement_areas: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Written notes on areas requiring development",
    )
    manager_comments: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional comments or summary from the reviewer",
    )

    # Constraints and Indexes
    __table_args__ = (
        CheckConstraint(
            "overall_rating >= 1 AND overall_rating <= 5",
            name="chk_performance_reviews_rating_range",
        ),
        Index(
            "ix_performance_reviews_employee_date",
            "employee_id",
            "review_date",
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="performance_reviews",
    )
    reviewer: Mapped["User"] = relationship(
        "User",
        back_populates="performance_reviews_given",
    )
