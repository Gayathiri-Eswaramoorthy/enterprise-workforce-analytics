"""
Employee document database model.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel, DocumentType

if TYPE_CHECKING:
    from app.models.user import User


class EmployeeDocument(BaseModel):
    """
    EmployeeDocument model representing uploaded documents and certificates of an employee.
    """

    __tablename__ = "employee_documents"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee who owns this document",
    )
    document_type: Mapped[DocumentType] = mapped_column(
        SAEnum(DocumentType, name="document_type"),
        nullable=False,
        comment="Type of document (e.g. RESUME, OFFER_LETTER)",
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Name of the file as uploaded",
    )
    file_path: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment="Storage path or URL of the document file",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type of the file (e.g. application/pdf, image/jpeg)",
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="FK reference to the User who uploaded the file",
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the file was uploaded",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "file_path",
            name="uq_employee_documents_employee_filepath",
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(  # noqa: F821
        "Employee",
        back_populates="documents",
    )
    uploaded_by: Mapped["User"] = relationship(
        "User",
        back_populates="uploaded_documents",
    )
