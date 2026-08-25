"""
Job role schemas for request and response validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoleSkillRequirement(BaseModel):
    skill_id: UUID
    required_proficiency: int = Field(..., ge=1, le=5)
    mandatory: bool = True


class RoleSkillResponse(BaseModel):
    id: UUID
    job_role_id: UUID
    skill_id: UUID
    required_proficiency: int
    mandatory: bool
    skill_name: str | None = None
    skill_code: str | None = None
    skill_category: str | None = None

    model_config = ConfigDict(from_attributes=True)


class JobRoleBase(BaseModel):
    department_id: UUID
    title: str = Field(..., min_length=2, max_length=100)
    grade_level: int = Field(..., ge=1, le=20)
    description: str | None = None
    is_active: bool = True


class JobRoleCreate(JobRoleBase):
    required_skills: list[RoleSkillRequirement] = []


class JobRoleUpdate(BaseModel):
    department_id: UUID | None = None
    title: str | None = Field(default=None, min_length=2, max_length=100)
    grade_level: int | None = Field(default=None, ge=1, le=20)
    description: str | None = None
    is_active: bool | None = None


class JobRoleResponse(JobRoleBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    department_name: str | None = None
    department_code: str | None = None
    employee_count: int | None = None
    role_skills: list[RoleSkillResponse] = []

    model_config = ConfigDict(from_attributes=True)
