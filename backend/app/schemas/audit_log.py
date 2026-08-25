"""
Audit log schemas for system action tracking and compliance.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditLogBase(BaseModel):
    user_id: UUID | None = None
    entity_name: str = Field(..., max_length=100)
    entity_id: UUID
    action: str = Field(..., max_length=100)
    description: str
    ip_address: str | None = Field(default=None, max_length=45)


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogResponse(AuditLogBase):
    id: UUID
    created_at_audit: datetime
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogFilter(BaseModel):
    entity_name: str | None = None
    action: str | None = None
    user_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    page: int = 1
    page_size: int = 50
