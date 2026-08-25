"""
Skill schemas for request and response validation.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SkillBase(BaseModel):
    skill_code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    skill_category: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    display_order: int = 0
    is_active: bool = True


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    skill_code: str | None = Field(default=None, min_length=2, max_length=50)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    skill_category: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


class SkillResponse(SkillBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeSkillCreate(BaseModel):
    skill_id: UUID
    proficiency_level: int = Field(..., ge=1, le=5)
    years_of_experience: Decimal = Field(..., ge=0, le=50)
    certification_status: bool = False
    last_assessed_date: date = Field(default_factory=date.today)


class EmployeeSkillUpdate(BaseModel):
    proficiency_level: int | None = Field(default=None, ge=1, le=5)
    years_of_experience: Decimal | None = Field(default=None, ge=0, le=50)
    certification_status: bool | None = None
    last_assessed_date: date | None = None


class EmployeeSkillResponse(BaseModel):
    id: UUID
    employee_id: UUID
    skill_id: UUID
    proficiency_level: int
    years_of_experience: Decimal
    certification_status: bool
    last_assessed_date: date
    skill: SkillResponse | None = None

    model_config = ConfigDict(from_attributes=True)
