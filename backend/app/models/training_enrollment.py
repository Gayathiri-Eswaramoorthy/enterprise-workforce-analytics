"""
TrainingEnrollment database model.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel, EnrollmentStatus

if TYPE_CHECKING:
    from app.models.training_course import TrainingCourse


class TrainingEnrollment(BaseModel):
    """
    TrainingEnrollment model representing employee participation and grades in training courses.
    """

    __tablename__ = "training_enrollments"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee enrolled",
    )
    training_course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_courses.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the TrainingCourse enrolled in",
    )
    enrollment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date when the employee enrolled in the course",
    )
    completion_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date when the employee completed the course",
    )
    enrollment_status: Mapped[EnrollmentStatus] = mapped_column(
        SAEnum(EnrollmentStatus, name="enrollment_status"),
        index=True,
        nullable=False,
        comment="Current status of the course enrollment (e.g. ENROLLED, COMPLETED)",
    )
    completion_score: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=True,
        comment="Optional exam or completion score percentage",
    )
    certificate_issued: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="Indicates whether a completion certificate was issued",
    )
    feedback_rating: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Optional course satisfaction rating left by the employee (1 to 5)",
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "training_course_id",
            name="uq_training_enrollments_employee_course",
        ),
        CheckConstraint(
            "feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)",
            name="chk_training_enrollments_feedback_range",
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="training_enrollments",
    )
    training_course: Mapped["TrainingCourse"] = relationship(
        "TrainingCourse",
        back_populates="enrollments",
    )
