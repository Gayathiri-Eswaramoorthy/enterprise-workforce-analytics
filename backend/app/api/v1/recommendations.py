"""
Recommendation management endpoints router.
"""

from uuid import UUID

from app.database import (
    PriorityLevel,
    RecommendationStatus,
    RecommendationType,
    UserRole,
    get_db,
)
from app.models import User
from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendationStatusUpdate,
)
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.recommendation_service import RecommendationService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
recommendation_service = RecommendationService()
audit_service = AuditService()


@router.get(
    "",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Recommendations",
    description="Query actionable training, retention, and development recommendations.",
)
def list_recommendations(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    recommendation_type: RecommendationType | None = Query(
        None, alias="type", description="Filter by type"
    ),
    status_filter: RecommendationStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    priority: PriorityLevel | None = Query(None, description="Filter by priority"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    items, total = recommendation_service.list_recommendations(
        db=db,
        employee_id=employee_id,
        rec_type=recommendation_type,
        status=status_filter,
        priority=priority,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "/generate/{employee_id}",
    response_model=list[RecommendationResponse],
    status_code=status.HTTP_200_OK,
    summary="Generate Recommendations for Employee",
    description="Analyze employee skill gaps and risk factors to generate targeted training and retention recommendations.",
)
def generate_recommendations(
    employee_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> list[RecommendationResponse]:
    recs = recommendation_service.generate_recommendations_for_employee(
        db=db, employee_id=employee_id
    )
    audit_service.log_action(
        db=db,
        entity_name="Recommendation",
        entity_id=employee_id,
        action="GENERATE_RECOMMENDATIONS",
        description=f"Generated {len(recs)} recommendations for employee {employee_id}",
        user=current_user,
        request=request,
    )
    return recs


@router.patch(
    "/{recommendation_id}/status",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Recommendation Status",
    description="Transition recommendation lifecycle status (PENDING, ACCEPTED, REJECTED, COMPLETED).",
)
def update_status(
    recommendation_id: UUID,
    status_in: RecommendationStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> RecommendationResponse:
    rec = recommendation_service.update_recommendation_status(
        db=db, rec_id=recommendation_id, status_in=status_in
    )
    audit_service.log_action(
        db=db,
        entity_name="Recommendation",
        entity_id=recommendation_id,
        action="UPDATE_STATUS",
        description=f"Updated recommendation {recommendation_id} status to {status_in.status.value}",
        user=current_user,
        request=request,
    )
    return rec
