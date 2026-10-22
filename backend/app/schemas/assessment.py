"""
Skill assessment schemas for baseline/post-training evaluations and skill gap re-measurement.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.database import AssessmentType
from pydantic import BaseModel, ConfigDict, Field


class SkillAssessmentCreate(BaseModel):
    employee_id: UUID
    skill_id: UUID
    training_course_id: UUID | None = None
    assessment_type: AssessmentType
    score: Decimal = Field(..., ge=0, le=100)
    assessed_proficiency: int | None = Field(default=None, ge=1, le=5)
    assessment_date: date = Field(default_factory=date.today)
    notes: str | None = None


class SkillAssessmentResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str | None = None
    skill_id: UUID
    skill_name: str | None = None
    skill_category: str | None = None
    training_course_id: UUID | None = None
    course_title: str | None = None
    assessment_type: AssessmentType
    score: Decimal
    assessed_proficiency: int | None = None
    assessment_date: date
    evaluator_id: UUID | None = None
    evaluator_name: str | None = None
    notes: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SkillAssessmentComparison(BaseModel):
    skill_id: UUID
    skill_name: str
    skill_category: str
    course_id: UUID | None = None
    course_title: str | None = None
    baseline_score: Decimal | None = None
    baseline_date: date | None = None
    post_score: Decimal | None = None
    post_date: date | None = None
    score_delta: Decimal | None = None
    current_proficiency: int | None = None
    reassessed_proficiency: int | None = None
    required_proficiency: int | None = None
    remaining_skill_gap: int | None = None
    is_improved: bool = False
