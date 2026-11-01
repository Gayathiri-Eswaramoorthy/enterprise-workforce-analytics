"""
Dashboard analytics endpoints router.
"""

from app.database import get_db
from app.models import User
from app.schemas.analytics import DashboardMetrics, SystemOverviewMetrics
from app.security import require_admin, require_hr
from app.services.dashboard_service import DashboardService
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

router = APIRouter()
dashboard_service = DashboardService()


@router.get(
    "/summary",
    response_model=DashboardMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get Dashboard Metrics",
    description=(
        "Retrieve live organizational KPIs, risk distributions, performance trends, and top skill gaps. "
        "Restricted to HR roles."
    ),
)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> DashboardMetrics:
    return dashboard_service.get_dashboard_metrics(db=db)


@router.get(
    "/admin-overview",
    response_model=SystemOverviewMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get Admin System Overview",
    description=(
        "Retrieve live system administration metrics, user role distributions, audit activity, "
        "and platform governance indicators. Restricted to HR Administrators."
    ),
)
def get_admin_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> SystemOverviewMetrics:
    return dashboard_service.get_admin_overview(db=db)
