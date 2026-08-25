"""
Department schemas for request and response validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DepartmentBase(BaseModel):
    department_code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    hr_manager_user_id: UUID | None = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    department_code: str | None = Field(default=None, min_length=2, max_length=20)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    hr_manager_user_id: UUID | None = None
    is_active: bool | None = None


class DepartmentResponse(DepartmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    employee_count: int | None = None
    job_roles_count: int | None = None

    model_config = ConfigDict(from_attributes=True)
