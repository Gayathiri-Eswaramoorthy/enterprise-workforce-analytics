"""
Skill database model.
"""

from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.employee_skill import EmployeeSkill
    from app.models.role_skill import RoleSkill


class Skill(BaseModel):
    """
    Skill model representing specific professional skills (e.g. Python, Communication).
    """

    __tablename__ = "skills"

    skill_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique identifier code for the skill (e.g., SK-PY-01)",
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        comment="Unique descriptive name of the skill",
    )
    skill_category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Category of the skill (e.g., Technical, Soft, Domain)",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description of what the skill encompasses",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Sort order for displaying skills on front-end interfaces",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates whether the skill is active",
    )

    # Relationships
    employee_skills: Mapped[list["EmployeeSkill"]] = relationship(
        "EmployeeSkill",
        back_populates="skill",
        passive_deletes=True,
    )
    role_skills: Mapped[list["RoleSkill"]] = relationship(
        "RoleSkill",
        back_populates="skill",
        passive_deletes=True,
    )
    training_skills: Mapped[list["TrainingSkill"]] = relationship(  # noqa: F821
        "TrainingSkill",
        back_populates="skill",
        passive_deletes=True,
    )
