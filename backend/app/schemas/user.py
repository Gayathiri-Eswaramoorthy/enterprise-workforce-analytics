"""
User schemas for administration and profile management.
"""

from datetime import datetime
from uuid import UUID

from app.database import UserRole
from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    display_name: str | None = Field(default=None, max_length=100)
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: str | None = None
    display_name: str | None = Field(default=None, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class UserResponse(UserBase):
    id: UUID
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
