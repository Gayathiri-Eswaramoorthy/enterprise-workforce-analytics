"""
Employee database model.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from app.database import BaseModel, EmploymentStatus, EmploymentType, Gender, WorkMode
from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.employee_document import EmployeeDocument
    from app.models.employee_skill import EmployeeSkill
    from app.models.job_role import JobRole
    from app.models.performance_review import PerformanceReview
    from app.models.prediction_history import PredictionHistory
    from app.models.recommendation import Recommendation
    from app.models.training_enrollment import TrainingEnrollment


class Employee(BaseModel):
    """
    Employee model representing individual organization employees.
    """

    __tablename__ = "employees"

    # Basic Information
    employee_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique employee code assigned by the organization",
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Employee's first name",
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Employee's last name",
    )
    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Employee's date of birth",
    )
    gender: Mapped[Gender] = mapped_column(
        SAEnum(Gender, name="gender"),
        nullable=False,
        comment="Employee's gender identity",
    )
    phone_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Primary contact phone number",
    )
    alternate_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Optional secondary phone number",
    )
    personal_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Employee's personal email address",
    )
    official_email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment="Employee's company-issued email address",
    )

    # Organization
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the employee's department",
    )
    job_role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_roles.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the employee's job role",
    )
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
        comment="FK reference to the employee's manager (self-reference)",
    )
    date_of_joining: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date when the employee joined the company",
    )

    # Employment
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        SAEnum(EmploymentStatus, name="employment_status"),
        index=True,
        nullable=False,
        comment="Current employment status of the employee",
    )
    employment_type: Mapped[EmploymentType] = mapped_column(
        SAEnum(EmploymentType, name="employment_type"),
        nullable=False,
        comment="Contract type (e.g. FULL_TIME, CONTRACT)",
    )
    work_mode: Mapped[WorkMode] = mapped_column(
        SAEnum(WorkMode, name="work_mode"),
        nullable=False,
        comment="Work setting (e.g. OFFICE, REMOTE)",
    )
    work_location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Specific geographic office or location",
    )

    # Profile
    profile_photo_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="URL link to the employee's profile picture",
    )

    # Soft Delete
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="Soft delete flag",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the record was soft-deleted",
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department",
        back_populates="employees",
    )
    job_role: Mapped["JobRole"] = relationship(
        "JobRole",
        back_populates="employees",
    )
    manager: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        remote_side="Employee.id",
        back_populates="subordinates",
    )
    subordinates: Mapped[list["Employee"]] = relationship(
        "Employee",
        back_populates="manager",
        passive_deletes=True,
    )
    documents: Mapped[list["EmployeeDocument"]] = relationship(
        "EmployeeDocument",
        back_populates="employee",
        passive_deletes=True,
    )
    employee_skills: Mapped[list["EmployeeSkill"]] = relationship(
        "EmployeeSkill",
        back_populates="employee",
        passive_deletes=True,
    )
    performance_reviews: Mapped[list["PerformanceReview"]] = relationship(
        "PerformanceReview",
        back_populates="employee",
        passive_deletes=True,
    )
    training_enrollments: Mapped[list["TrainingEnrollment"]] = relationship(
        "TrainingEnrollment",
        back_populates="employee",
        passive_deletes=True,
    )
    prediction_history: Mapped[list["PredictionHistory"]] = relationship(
        "PredictionHistory",
        back_populates="employee",
        passive_deletes=True,
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(
        "Recommendation",
        back_populates="employee",
        passive_deletes=True,
    )
