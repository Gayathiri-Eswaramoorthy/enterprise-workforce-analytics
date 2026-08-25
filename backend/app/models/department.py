"""
Department database model.
"""

import uuid
from typing import TYPE_CHECKING, Optional

from app.database import BaseModel
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.job_role import JobRole
    from app.models.user import User


class Department(BaseModel):
    """
    Department model representing corporate divisions/departments.
    """

    __tablename__ = "departments"

    department_code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique shorthand identifier for the department (e.g. ENG, HR)",
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique full name of the department",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description of department's purpose",
    )
    hr_manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        comment="FK reference to the User serving as HR Manager",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates if the department is active",
    )

    # Relationships
    hr_manager: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="managed_departments",
    )
    job_roles: Mapped[list["JobRole"]] = relationship(
        "JobRole",
        back_populates="department",
        passive_deletes=True,
    )
    employees: Mapped[list["Employee"]] = relationship(  # noqa: F821
        "Employee",
        back_populates="department",
    )
