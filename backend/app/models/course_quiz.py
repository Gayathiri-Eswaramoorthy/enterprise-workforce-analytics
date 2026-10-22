"""
CourseQuiz database model.
"""

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.quiz_attempt import QuizAttempt
    from app.models.quiz_question import QuizQuestion
    from app.models.training_course import TrainingCourse


class CourseQuiz(BaseModel):
    """
    CourseQuiz model representing knowledge assessment attached to a training course.
    """

    __tablename__ = "course_quizzes"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_courses.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
        comment="FK reference to the parent TrainingCourse (1-to-1)",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Quiz title",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Description or instructions for taking the quiz",
    )
    passing_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        default=Decimal("70.00"),
        nullable=False,
        comment="Minimum percentage score required to pass the quiz",
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
        comment="Maximum number of quiz attempts allowed per enrollment",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether the quiz is active and accessible",
    )

    # Relationships
    training_course: Mapped["TrainingCourse"] = relationship(
        "TrainingCourse",
        back_populates="quiz",
    )
    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt",
        back_populates="quiz",
        cascade="all, delete-orphan",
    )
