"""
EmployeeRequest database model for employee-initiated career discussions and learning interests.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from app.database import BaseModel
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.user import User


class EmployeeRequest(BaseModel):
    """
    Employee-initiated career development discussions, learning topic interests, or support requests.
    """

    __tablename__ = "employee_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="FK reference to the requesting Employee",
    )
    request_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of request: LEARNING_INTEREST, CAREER_DISCUSSION, WORKLOAD_FEEDBACK, OTHER",
    )
    topic: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Primary subject or skill interest of the request",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Context, specific questions, or details provided by employee",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING",
        index=True,
        comment="Lifecycle status: PENDING, REVIEWED, RESOLVED",
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="HR user who reviewed or handled this request",
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when HR marked this request as reviewed",
    )
    response_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="HR feedback or follow-up notes shared with employee",
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="discussion_requests",
    )
    reviewed_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reviewed_by_id],
    )
