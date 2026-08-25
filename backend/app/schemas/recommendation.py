"""
Recommendation schemas for action items and lifecycle transitions.
"""

from datetime import datetime
from uuid import UUID

from app.database import PriorityLevel, RecommendationStatus, RecommendationType
from pydantic import BaseModel, ConfigDict, Field


class RecommendationBase(BaseModel):
    employee_id: UUID
    prediction_history_id: UUID | None = None
    recommendation_type: RecommendationType
    title: str = Field(..., max_length=255)
    description: str
    priority: PriorityLevel = PriorityLevel.MEDIUM
    status: RecommendationStatus = RecommendationStatus.PENDING


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationStatusUpdate(BaseModel):
    status: RecommendationStatus


class RecommendationResponse(RecommendationBase):
    id: UUID
    generated_at: datetime
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    job_role_title: str | None = None

    model_config = ConfigDict(from_attributes=True)


class GenerateRecommendationRequest(BaseModel):
    employee_id: UUID
