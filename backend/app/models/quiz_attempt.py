"""
QuizAttempt database model.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.course_quiz import CourseQuiz
    from app.models.employee import Employee
    from app.models.training_enrollment import TrainingEnrollment


class QuizAttempt(BaseModel):
    """
    QuizAttempt model recording employee submission, server-computed score, and pass/fail status.
    """

    __tablename__ = "quiz_attempts"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_quizzes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the CourseQuiz",
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_enrollments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the TrainingEnrollment",
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee",
    )
    attempt_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sequential attempt count for this enrollment",
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Score percentage earned (0.00 to 100.00)",
    )
    passed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="Whether the score met or exceeded the quiz passing_score",
    )
    answers_payload: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Detailed breakdown of question responses, correctness, and explanations",
    )
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the quiz was submitted and scored",
    )

    # Relationships
    quiz: Mapped["CourseQuiz"] = relationship(
        "CourseQuiz",
        back_populates="attempts",
    )
    enrollment: Mapped["TrainingEnrollment"] = relationship(
        "TrainingEnrollment",
        back_populates="quiz_attempts",
    )
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="quiz_attempts",
    )
