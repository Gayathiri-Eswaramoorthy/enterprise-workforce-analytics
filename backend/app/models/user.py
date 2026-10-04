"""
User database model.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from app.database import BaseModel, UserRole
from sqlalchemy import DateTime, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.department import Department
    from app.models.employee import Employee
    from app.models.employee_document import EmployeeDocument
    from app.models.notification import Notification
    from app.models.performance_review import PerformanceReview


class User(BaseModel):
    """
    User model representing registered system users and their roles.
    """

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique username for the user",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique email address for the user",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hashed password for authentication",
    )
    display_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Optional user-facing display name",
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"),
        nullable=False,
        comment="Role determining permissions within the application",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Indicates if the user account is active",
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of the user's last successful login",
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
        comment="Consecutive failed login attempts since the last successful login",
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Login is refused until this timestamp after too many failed attempts",
    )

    # Relationships
    employee_profile: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        back_populates="user",
        uselist=False,
    )
    managed_departments: Mapped[list["Department"]] = relationship(
        "Department",
        back_populates="hr_manager",
        passive_deletes=True,
    )
    uploaded_documents: Mapped[list["EmployeeDocument"]] = relationship(
        "EmployeeDocument",
        back_populates="uploaded_by",
        passive_deletes=True,
    )
    performance_reviews_given: Mapped[list["PerformanceReview"]] = relationship(
        "PerformanceReview",
        back_populates="reviewer",
        passive_deletes=True,
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        passive_deletes=True,
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        passive_deletes=True,
    )
