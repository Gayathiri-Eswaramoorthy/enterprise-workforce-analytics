"""
Retention intervention and follow-up tracking API endpoints.
"""

from uuid import UUID

from app.database import InterventionStatus, RetentionOutcome, get_db
from app.models import User
from app.schemas.retention import (
    RetentionInterventionCreate,
    RetentionInterventionResponse,
    RetentionInterventionUpdate,
)
from app.security import require_hr
from app.services.audit_service import AuditService
from app.services.retention_service import RetentionService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
retention_service = RetentionService()
audit_service = AuditService()


@router.post(
    "/interventions",
    response_model=RetentionInterventionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Retention Intervention",
    description="Proactively log an HR intervention (workload review, mentoring, career development, training) for an employee.",
)
def create_intervention(
    intervention_in: RetentionInterventionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> RetentionInterventionResponse:
    intervention = retention_service.create_intervention(
        db=db, intervention_in=intervention_in, hr_user_id=current_user.id
    )
    audit_service.log_action(
        db=db,
        entity_name="RetentionIntervention",
        entity_id=intervention.id,
        action="CREATE_INTERVENTION",
        description=(
            f"Created {intervention.intervention_type} intervention for employee "
            f"{intervention.employee_id} (Status: {intervention.status.value})"
        ),
        user=current_user,
        request=request,
    )
    return intervention


@router.get(
    "/interventions",
    response_model=list[RetentionInterventionResponse],
    status_code=status.HTTP_200_OK,
    summary="List Retention Interventions",
    description="Query logged retention interventions with filters for employee, recommendation, status, or retention outcome.",
)
def list_interventions(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    recommendation_id: UUID | None = Query(None, description="Filter by recommendation"),
    status_filter: InterventionStatus | None = Query(
        None, alias="status", description="Filter by intervention status"
    ),
    outcome_filter: RetentionOutcome | None = Query(
        None, alias="outcome", description="Filter by retention outcome"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> list[RetentionInterventionResponse]:
    return retention_service.list_interventions(
        db=db,
        employee_id=employee_id,
        recommendation_id=recommendation_id,
        status_filter=status_filter,
        outcome_filter=outcome_filter,
    )


@router.put(
    "/interventions/{intervention_id}",
    response_model=RetentionInterventionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Retention Intervention",
    description="Update intervention lifecycle status (ACCEPTED, DECLINED, COMPLETED) or document factual retention follow-up outcome.",
)
def update_intervention(
    intervention_id: UUID,
    update_in: RetentionInterventionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> RetentionInterventionResponse:
    updated = retention_service.update_intervention(
        db=db, intervention_id=intervention_id, update_in=update_in
    )
    audit_service.log_action(
        db=db,
        entity_name="RetentionIntervention",
        entity_id=intervention_id,
        action="UPDATE_INTERVENTION",
        description=(
            f"Updated intervention {intervention_id} status to {updated.status.value}, "
            f"outcome: {updated.retention_outcome.value}"
        ),
        user=current_user,
        request=request,
    )
    return updated


@router.get(
    "/interventions/recommendation/{recommendation_id}",
    response_model=list[RetentionInterventionResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Interventions for Recommendation",
    description="Retrieve all intervention actions linked to a specific recommendation.",
)
def get_interventions_for_recommendation(
    recommendation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> list[RetentionInterventionResponse]:
    return retention_service.list_interventions(db=db, recommendation_id=recommendation_id)
