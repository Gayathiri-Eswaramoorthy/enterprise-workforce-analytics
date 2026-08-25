"""
Application schemas package.
"""

from app.schemas.analytics import (
    DashboardMetrics,
    DepartmentSkillGapSummary,
    EmployeeSkillGapReport,
    SkillGapItem,
    TopSkillGapItem,
)
from app.schemas.audit_log import (
    AuditLogCreate,
    AuditLogFilter,
    AuditLogResponse,
)
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeeListItem,
    EmployeePaginatedResponse,
    EmployeeUpdate,
)
from app.schemas.job_role import (
    JobRoleCreate,
    JobRoleResponse,
    JobRoleUpdate,
    RoleSkillRequirement,
    RoleSkillResponse,
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    UnreadCountResponse,
)
from app.schemas.performance import (
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    PerformanceReviewUpdate,
    PerformanceTrendSummary,
)
from app.schemas.prediction import (
    BatchPredictionRequest,
    ModelRegistryCreate,
    ModelRegistryResponse,
    PredictionHistoryResponse,
    PredictionRequest,
    PredictionResult,
)
from app.schemas.recommendation import (
    GenerateRecommendationRequest,
    RecommendationCreate,
    RecommendationResponse,
    RecommendationStatusUpdate,
)
from app.schemas.skill import (
    EmployeeSkillCreate,
    EmployeeSkillResponse,
    EmployeeSkillUpdate,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
)
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
)

__all__ = [
    "AuditLogCreate",
    "AuditLogFilter",
    "AuditLogResponse",
    "BatchPredictionRequest",
    "CurrentUserResponse",
    "DashboardMetrics",
    "DepartmentCreate",
    "DepartmentResponse",
    "DepartmentSkillGapSummary",
    "DepartmentUpdate",
    "EmployeeCreate",
    "EmployeeDetailResponse",
    "EmployeeListItem",
    "EmployeePaginatedResponse",
    "EmployeeSkillCreate",
    "EmployeeSkillGapReport",
    "EmployeeSkillResponse",
    "EmployeeSkillUpdate",
    "EmployeeUpdate",
    "GenerateRecommendationRequest",
    "JobRoleCreate",
    "JobRoleResponse",
    "JobRoleUpdate",
    "LoginRequest",
    "ModelRegistryCreate",
    "ModelRegistryResponse",
    "NotificationCreate",
    "NotificationResponse",
    "PerformanceReviewCreate",
    "PerformanceReviewResponse",
    "PerformanceReviewUpdate",
    "PerformanceTrendSummary",
    "PredictionHistoryResponse",
    "PredictionRequest",
    "PredictionResult",
    "RecommendationCreate",
    "RecommendationResponse",
    "RecommendationStatusUpdate",
    "RefreshTokenRequest",
    "RoleSkillRequirement",
    "RoleSkillResponse",
    "SkillCreate",
    "SkillGapItem",
    "SkillResponse",
    "SkillUpdate",
    "TokenResponse",
    "TopSkillGapItem",
    "UnreadCountResponse",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
]
