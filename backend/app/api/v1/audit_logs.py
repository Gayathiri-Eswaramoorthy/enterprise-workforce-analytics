"""
Audit log endpoints router.
"""

from datetime import datetime
from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.security import require_roles
from app.services.audit_service import AuditService
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

router = APIRouter()
audit_service = AuditService()


@router.get(
    "",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Audit Logs",
    description="Inspect audit logs for system operations. Restricted to HR Administrators.",
)
def list_audit_logs(
    entity_name: str | None = Query(None, description="Filter by entity name"),
    action: str | None = Query(None, description="Filter by action"),
    user_id: UUID | None = Query(None, description="Filter by user ID"),
    start_date: datetime | None = Query(None, description="Filter start timestamp"),
    end_date: datetime | None = Query(None, description="Filter end timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> dict:
    items, total = audit_service.list_audit_logs(
        db=db,
        entity_name=entity_name,
        action=action,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
