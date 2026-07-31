"""
TrainingCourse database model.
"""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel, DifficultyLevel, TrainingMode

if TYPE_CHECKING:
    from app.models.training_enrollment import TrainingEnrollment
    from app.models.training_skill import TrainingSkill


class TrainingCourse(BaseModel):
    """
    TrainingCourse model representing available corporate training courses.
    """

    __tablename__ = "training_courses"

    course_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique identifier code for the course (e.g. TR-SEC-01)",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Course name or title",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description of the course contents and objectives",
    )
    provider: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Company or platform offering the training (e.g. Udemy, Pluralsight, Internal)",
    )
    duration_hours: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Course duration in hours",
    )
    difficulty_level: Mapped[DifficultyLevel] = mapped_column(
        SAEnum(DifficultyLevel, name="difficulty_level"),
        nullable=False,
        comment="Intended skill difficulty level (e.g. BEGINNER, ADVANCED)",
    )
    training_mode: Mapped[TrainingMode] = mapped_column(
        SAEnum(TrainingMode, name="training_mode"),
        nullable=False,
        comment="Training delivery mode (e.g. ONLINE, OFFLINE, HYBRID)",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates whether the course is open for new enrollments",
    )

    # Relationships
    enrollments: Mapped[list["TrainingEnrollment"]] = relationship(
        "TrainingEnrollment",
        back_populates="training_course",
        passive_deletes=True,
    )
    training_skills: Mapped[list["TrainingSkill"]] = relationship(
        "TrainingSkill",
        back_populates="training_course",
        passive_deletes=True,
    )
