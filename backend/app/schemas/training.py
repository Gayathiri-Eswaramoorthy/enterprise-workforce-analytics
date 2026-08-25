"""
Training course and enrollment schemas for request and response validation.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.database import DifficultyLevel, EnrollmentStatus, TrainingMode
from app.schemas.skill import SkillResponse
from pydantic import BaseModel, ConfigDict, Field


class TrainingSkillCreate(BaseModel):
    skill_id: UUID


class TrainingSkillResponse(BaseModel):
    id: UUID
    training_course_id: UUID
    skill_id: UUID
    skill: SkillResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class TrainingCourseBase(BaseModel):
    course_code: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    provider: str = Field(..., min_length=2, max_length=255)
    duration_hours: Decimal = Field(..., ge=0.5, le=1000)
    difficulty_level: DifficultyLevel = DifficultyLevel.BEGINNER
    training_mode: TrainingMode = TrainingMode.ONLINE
    is_active: bool = True


class TrainingCourseCreate(TrainingCourseBase):
    target_skill_ids: list[UUID] = []


class TrainingCourseUpdate(BaseModel):
    course_code: str | None = Field(default=None, min_length=2, max_length=50)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    provider: str | None = None
    duration_hours: Decimal | None = Field(default=None, ge=0.5, le=1000)
    difficulty_level: DifficultyLevel | None = None
    training_mode: TrainingMode | None = None
    is_active: bool | None = None
    target_skill_ids: list[UUID] | None = None


class TrainingCourseResponse(TrainingCourseBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    enrolled_count: int | None = None
    completed_count: int | None = None
    training_skills: list[TrainingSkillResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TrainingEnrollmentCreate(BaseModel):
    employee_id: UUID
    training_course_id: UUID
    enrollment_date: date = Field(default_factory=date.today)
    enrollment_status: EnrollmentStatus = EnrollmentStatus.ENROLLED


class TrainingEnrollmentUpdate(BaseModel):
    enrollment_status: EnrollmentStatus | None = None
    completion_date: date | None = None
    completion_score: Decimal | None = Field(default=None, ge=0, le=100)
    certificate_issued: bool | None = None
    feedback_rating: int | None = Field(default=None, ge=1, le=5)


class TrainingEnrollmentResponse(BaseModel):
    id: UUID
    employee_id: UUID
    training_course_id: UUID
    enrollment_date: date
    completion_date: date | None = None
    enrollment_status: EnrollmentStatus
    completion_score: Decimal | None = None
    certificate_issued: bool
    feedback_rating: int | None = None
    created_at: datetime
    updated_at: datetime

    employee_name: str | None = None
    employee_code: str | None = None
    course: TrainingCourseResponse | None = None

    model_config = ConfigDict(from_attributes=True)
