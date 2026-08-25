"""
Job role database model.
"""

import uuid
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.role_skill import RoleSkill


class JobRole(BaseModel):
    """
    JobRole model representing job classifications/roles and their associated grades.
    """

    __tablename__ = "job_roles"

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Department this job role belongs to",
    )
    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Title of the job role (e.g. Software Engineer, Tech Lead)",
    )
    grade_level: Mapped[int] = mapped_column(
        nullable=False,
        comment="Pay or seniority grade level (e.g. 1 to 10)",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed job description and responsibilities",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates if the job role is active",
    )

    # Table constraints and indexes
    __table_args__ = (
        UniqueConstraint(
            "department_id",
            "title",
            name="uq_job_roles_department_title",
        ),
        Index(
            "ix_job_roles_department_grade",
            "department_id",
            "grade_level",
        ),
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department",
        back_populates="job_roles",
    )
    employees: Mapped[list["Employee"]] = relationship(  # noqa: F821
        "Employee",
        back_populates="job_role",
    )
    role_skills: Mapped[list["RoleSkill"]] = relationship(
        "RoleSkill",
        back_populates="job_role",
        passive_deletes=True,
    )
