"""
EmployeeSkill database model.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel

if TYPE_CHECKING:
    from app.models.skill import Skill


class EmployeeSkill(BaseModel):
    """
    EmployeeSkill association model mapping employees to their professional skills.
    """

    __tablename__ = "employee_skills"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee",
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Skill",
    )
    proficiency_level: Mapped[int] = mapped_column(
        Integer,
        index=True,
        nullable=False,
        comment="Employee proficiency level in the skill (1 to 5)",
    )
    years_of_experience: Mapped[Decimal] = mapped_column(
        Numeric(precision=4, scale=1),
        nullable=False,
        comment="Number of years of experience with the skill",
    )
    certification_status: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="Indicates whether the employee holds a certification for the skill",
    )
    last_assessed_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date when the employee's skill proficiency was last assessed",
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "skill_id",
            name="uq_employee_skills_employee_skill",
        ),
        CheckConstraint(
            "proficiency_level >= 1 AND proficiency_level <= 5",
            name="chk_employee_skills_proficiency_range",
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="employee_skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="employee_skills",
    )
