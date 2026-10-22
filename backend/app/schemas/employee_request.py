"""
Pydantic schemas for employee career discussion and learning interest requests.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EmployeeRequestCreate(BaseModel):
    request_type: str = Field(..., min_length=2, max_length=50)
    topic: str = Field(..., min_length=2, max_length=255)
    notes: str | None = None


class EmployeeRequestUpdate(BaseModel):
    status: str | None = Field(default=None, max_length=50)
    response_notes: str | None = None


class EmployeeRequestResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    job_title: str | None = None
    request_type: str
    topic: str
    notes: str | None = None
    status: str
    reviewed_by_id: UUID | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    response_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
