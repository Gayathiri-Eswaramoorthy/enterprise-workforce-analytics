"""
RoleSkill database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.skill import Skill


class RoleSkill(BaseModel):
    """
    RoleSkill association model mapping job roles to their required skills.
    """

    __tablename__ = "role_skills"

    job_role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_roles.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the JobRole",
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Skill",
    )
    required_proficiency: Mapped[int] = mapped_column(
        Integer,
        index=True,
        nullable=False,
        comment="Required proficiency level for the job role (1 to 5)",
    )
    mandatory: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates if the skill is mandatory for the job role",
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "job_role_id",
            "skill_id",
            name="uq_role_skills_job_role_skill",
        ),
        CheckConstraint(
            "required_proficiency >= 1 AND required_proficiency <= 5",
            name="chk_role_skills_proficiency_range",
        ),
    )

    # Relationships
    job_role: Mapped["JobRole"] = relationship(  # noqa: F821
        "JobRole",
        back_populates="role_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="role_skills",
    )
