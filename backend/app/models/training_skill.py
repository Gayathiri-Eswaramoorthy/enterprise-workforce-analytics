"""
TrainingSkill database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.skill import Skill
    from app.models.training_course import TrainingCourse


class TrainingSkill(BaseModel):
    """
    TrainingSkill association model linking training courses to targeted skills.
    """

    __tablename__ = "training_skills"

    training_course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_courses.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the TrainingCourse",
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Skill",
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "training_course_id",
            "skill_id",
            name="uq_training_skills_course_skill",
        ),
    )

    # Relationships
    training_course: Mapped["TrainingCourse"] = relationship(
        "TrainingCourse",
        back_populates="training_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="training_skills",
    )
