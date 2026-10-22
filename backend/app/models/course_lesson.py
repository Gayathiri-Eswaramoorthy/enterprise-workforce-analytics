"""
CourseLesson database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.lesson_completion import LessonCompletion
    from app.models.training_course import TrainingCourse


class CourseLesson(BaseModel):
    """
    CourseLesson model representing structured educational lessons within a training course.
    """

    __tablename__ = "course_lessons"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the parent TrainingCourse",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Lesson title",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Markdown or rich text learning content for the lesson",
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Sequential display order within the course",
    )
    is_required: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether completing this lesson is required to complete the course",
    )
    estimated_minutes: Mapped[int] = mapped_column(
        Integer,
        default=15,
        nullable=False,
        comment="Estimated time to complete in minutes",
    )
    external_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional external resource or reference URL",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Short summary or overview of the external resource",
    )
    provider: Mapped[str] = mapped_column(
        String(100),
        default="External",
        nullable=False,
        server_default="External",
        comment="Resource provider (e.g. YouTube, Udemy, Coursera, Official Docs)",
    )
    skill_covered: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        comment="Primary skill covered by this resource",
    )
    resource_type: Mapped[str] = mapped_column(
        String(50),
        default="VIDEO",
        nullable=False,
        server_default="VIDEO",
        comment="Resource type: VIDEO, COURSE, ARTICLE, or DOCUMENTATION",
    )
    access_type: Mapped[str] = mapped_column(
        String(50),
        default="FREE",
        nullable=False,
        server_default="FREE",
        comment="Access model: FREE, PAID, or ACCOUNT_REQUIRED",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
        comment="Whether the learning resource is actively available",
    )

    # Relationships
    training_course: Mapped["TrainingCourse"] = relationship(
        "TrainingCourse",
        back_populates="lessons",
    )
    completions: Mapped[list["LessonCompletion"]] = relationship(
        "LessonCompletion",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )
