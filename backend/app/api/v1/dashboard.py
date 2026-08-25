"""
Dashboard analytics endpoints router.
"""

from app.database import get_db
from app.models import User
from app.schemas.analytics import DashboardMetrics
from app.security import get_current_active_user
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
    description="Retrieve live organizational KPIs, risk distributions, performance trends, and top skill gaps.",
)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardMetrics:
    return dashboard_service.get_dashboard_metrics(db=db)
