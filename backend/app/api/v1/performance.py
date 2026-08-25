"""
Performance review endpoints router.
"""

from uuid import UUID

from app.database import ReviewCycle, UserRole, get_db
from app.models import User
from app.schemas.performance import (
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    PerformanceTrendSummary,
)
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.performance_service import PerformanceService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
performance_service = PerformanceService()
audit_service = AuditService()


@router.get(
    "",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Performance Reviews",
    description="Retrieve performance reviews with filtering and pagination.",
)
def list_reviews(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    reviewer_id: UUID | None = Query(None, description="Filter by reviewer"),
    review_cycle: ReviewCycle | None = Query(None, description="Filter by review cycle"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    items, total = performance_service.list_reviews(
        db=db,
        employee_id=employee_id,
        reviewer_id=reviewer_id,
        review_cycle=review_cycle,
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
    "",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Performance Review",
    description="Submit a new performance evaluation for an employee.",
)
def create_review(
    request_data: PerformanceReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> PerformanceReviewResponse:
    review = performance_service.create_review(
        db=db, review_in=request_data, current_user=current_user
    )
    audit_service.log_action(
        db=db,
        entity_name="PerformanceReview",
        entity_id=review.id,
        action="CREATE",
        description=f"Submitted {review.review_cycle.value} review for employee {review.employee_id} (Rating: {review.overall_rating}/5)",
        user=current_user,
        request=request,
    )
    return review


@router.get(
    "/employee/{employee_id}/summary",
    response_model=PerformanceTrendSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Employee Performance Summary",
    description="Calculate historical performance metrics and trends for an employee.",
)
def get_employee_performance_summary(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PerformanceTrendSummary:
    return performance_service.get_employee_performance_summary(db=db, employee_id=employee_id)
