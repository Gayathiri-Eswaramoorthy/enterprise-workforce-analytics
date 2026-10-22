"""
QuizQuestion database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.course_quiz import CourseQuiz
    from app.models.quiz_option import QuizOption


class QuizQuestion(BaseModel):
    """
    QuizQuestion model representing multiple-choice questions within a course quiz.
    """

    __tablename__ = "quiz_questions"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_quizzes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the parent CourseQuiz",
    )
    question_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Question prompt or text",
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Display order of the question within the quiz",
    )
    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Educational feedback and explanation revealed after submission",
    )

    # Relationships
    quiz: Mapped["CourseQuiz"] = relationship(
        "CourseQuiz",
        back_populates="questions",
    )
    options: Mapped[list["QuizOption"]] = relationship(
        "QuizOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuizOption.order_index",
    )
