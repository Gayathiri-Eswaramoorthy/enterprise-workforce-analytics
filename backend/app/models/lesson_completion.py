"""
LessonCompletion database model.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.course_lesson import CourseLesson
    from app.models.employee import Employee
    from app.models.training_enrollment import TrainingEnrollment


class LessonCompletion(BaseModel):
    """
    LessonCompletion model tracking which lessons an enrolled employee has completed.
    """

    __tablename__ = "lesson_completions"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_enrollments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the employee's course enrollment",
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_lessons.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the completed CourseLesson",
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the lesson was marked complete",
    )
    resource_opened: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="Whether the external resource was opened by the employee",
    )
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the external resource was first opened",
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        comment="Whether the employee explicitly marked the lesson complete",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "enrollment_id",
            "lesson_id",
            name="uq_lesson_completions_enrollment_lesson",
        ),
    )

    # Relationships
    enrollment: Mapped["TrainingEnrollment"] = relationship(
        "TrainingEnrollment",
        back_populates="lesson_completions",
    )
    lesson: Mapped["CourseLesson"] = relationship(
        "CourseLesson",
        back_populates="completions",
    )
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="lesson_completions",
    )
