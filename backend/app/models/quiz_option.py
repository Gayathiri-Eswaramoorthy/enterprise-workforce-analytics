"""
QuizOption database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.quiz_question import QuizQuestion


class QuizOption(BaseModel):
    """
    QuizOption model representing choices for a multiple-choice quiz question.
    """

    __tablename__ = "quiz_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the parent QuizQuestion",
    )
    option_text: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Answer option text",
    )
    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this option is the correct answer (never sent to client pre-submission)",
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Display order of this option among choices",
    )

    # Relationships
    question: Mapped["QuizQuestion"] = relationship(
        "QuizQuestion",
        back_populates="options",
    )
