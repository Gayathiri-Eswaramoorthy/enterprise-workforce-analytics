"""
API Router configuration uniting sub-routers.
"""

from app.api.v1.analytics import router as analytics_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.departments import router as departments_router
from app.api.v1.employees import router as employees_router
from app.api.v1.health import router as health_router
from app.api.v1.job_roles import router as job_roles_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.performance import router as performance_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.skills import router as skills_router
from app.api.v1.training import router as training_router
from app.api.v1.users import router as users_router
from fastapi import APIRouter

api_router = APIRouter()

# Register sub-routers
api_router.include_router(health_router, prefix="", tags=["Health"])
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(employees_router, prefix="/employees", tags=["Employees"])
api_router.include_router(departments_router, prefix="/departments", tags=["Departments"])
api_router.include_router(job_roles_router, prefix="/job-roles", tags=["Job Roles"])
api_router.include_router(skills_router, prefix="/skills", tags=["Skills"])
api_router.include_router(performance_router, prefix="/performance", tags=["Performance"])
api_router.include_router(training_router, prefix="/training", tags=["Training"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics & Skill Gaps"])
api_router.include_router(predictions_router, prefix="/predictions", tags=["ML Predictions"])
api_router.include_router(
    recommendations_router, prefix="/recommendations", tags=["Recommendations"]
)
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(audit_logs_router, prefix="/audit-logs", tags=["Audit Logs"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
