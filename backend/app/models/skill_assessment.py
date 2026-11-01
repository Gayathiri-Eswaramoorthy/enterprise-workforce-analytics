"""
SkillAssessment database model.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from app.database import AssessmentType, BaseModel
from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.skill import Skill
    from app.models.training_course import TrainingCourse
    from app.models.user import User


class SkillAssessment(BaseModel):
    """
    SkillAssessment model recording pre-training (baseline) and post-training assessments.
    """

    __tablename__ = "skill_assessments"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee assessed",
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Skill assessed",
    )
    training_course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_courses.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="Optional FK reference to the related TrainingCourse",
    )
    assessment_type: Mapped[AssessmentType] = mapped_column(
        SAEnum(AssessmentType, name="assessment_type"),
        index=True,
        nullable=False,
        comment="BASELINE or POST_TRAINING",
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        comment="Evaluation score achieved (0.00 to 100.00)",
    )
    assessed_proficiency: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Evaluated skill proficiency level (1 to 5) if formal reassessment occurred",
    )
    assessment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date of the assessment",
    )
    evaluator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="Optional FK reference to the HR evaluator or administrator",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Assessment notes, qualitative feedback, or evaluator observations",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "assessed_proficiency IS NULL OR (assessed_proficiency >= 1 AND assessed_proficiency <= 5)",
            name="chk_skill_assessments_proficiency_range",
        ),
        CheckConstraint(
            "score >= 0 AND score <= 100",
            name="chk_skill_assessments_score_range",
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="skill_assessments",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="skill_assessments",
    )
    training_course: Mapped["TrainingCourse | None"] = relationship(
        "TrainingCourse",
        back_populates="skill_assessments",
    )
    evaluator: Mapped["User | None"] = relationship(
        "User",
        back_populates="evaluated_assessments",
    )
