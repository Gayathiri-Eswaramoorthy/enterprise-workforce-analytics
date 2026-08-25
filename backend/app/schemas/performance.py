"""
Performance review schemas for request and response validation.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.database import ReviewCycle
from pydantic import BaseModel, ConfigDict, Field


class PerformanceReviewBase(BaseModel):
    employee_id: UUID
    reviewer_id: UUID
    review_cycle: ReviewCycle
    review_period: str = Field(..., min_length=2, max_length=100)
    review_date: date = Field(default_factory=date.today)
    performance_score: Decimal = Field(..., ge=0, le=100)
    overall_rating: int = Field(..., ge=1, le=5)
    strengths: str | None = None
    improvement_areas: str | None = None
    manager_comments: str | None = None


class PerformanceReviewCreate(PerformanceReviewBase):
    pass


class PerformanceReviewUpdate(BaseModel):
    review_cycle: ReviewCycle | None = None
    review_period: str | None = Field(default=None, min_length=2, max_length=100)
    review_date: date | None = None
    performance_score: Decimal | None = Field(default=None, ge=0, le=100)
    overall_rating: int | None = Field(default=None, ge=1, le=5)
    strengths: str | None = None
    improvement_areas: str | None = None
    manager_comments: str | None = None


class PerformanceReviewResponse(PerformanceReviewBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    employee_name: str | None = None
    employee_code: str | None = None
    reviewer_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PerformanceTrendSummary(BaseModel):
    employee_id: UUID
    total_reviews: int
    latest_rating: int | None = None
    latest_score: float | None = None
    average_rating: float | None = None
    average_score: float | None = None
    rating_change: float | None = None
    trend: str  # IMPROVING, STABLE, DECLINING
    recent_reviews: list[PerformanceReviewResponse] = []
