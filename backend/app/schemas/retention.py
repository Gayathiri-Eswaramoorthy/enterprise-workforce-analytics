"""
Retention intervention and follow-up schemas.
"""

from datetime import date, datetime
from uuid import UUID

from app.database import InterventionStatus, RetentionOutcome
from pydantic import BaseModel, ConfigDict, Field


class RetentionInterventionCreate(BaseModel):
    employee_id: UUID
    recommendation_id: UUID | None = None
    concern_summary: str = Field(..., min_length=5)
    intervention_type: str = Field(..., min_length=2, max_length=100)
    status: InterventionStatus = InterventionStatus.OFFERED
    offered_date: date = Field(default_factory=date.today)
    follow_up_date: date | None = None
    notes: str | None = None
    intervention_effectiveness: str | None = None


class RetentionInterventionUpdate(BaseModel):
    status: InterventionStatus | None = None
    completed_date: date | None = None
    follow_up_date: date | None = None
    notes: str | None = None
    retention_outcome: RetentionOutcome | None = None
    outcome_recorded_date: date | None = None
    outcome_notes: str | None = None
    intervention_effectiveness: str | None = None


class RetentionInterventionResponse(BaseModel):
    id: UUID
    recommendation_id: UUID | None = None
    employee_id: UUID
    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    job_title: str | None = None
    hr_user_id: UUID
    hr_user_name: str | None = None
    concern_summary: str
    intervention_type: str
    status: InterventionStatus
    offered_date: date
    completed_date: date | None = None
    follow_up_date: date | None = None
    notes: str | None = None
    retention_outcome: RetentionOutcome
    outcome_recorded_date: date | None = None
    outcome_notes: str | None = None
    intervention_effectiveness: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
