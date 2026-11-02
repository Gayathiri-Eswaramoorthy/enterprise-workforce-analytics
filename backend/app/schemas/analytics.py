"""
Skill gap and analytics schemas for intelligent evaluation.
"""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SkillGapItem(BaseModel):
    skill_id: UUID
    skill_code: str
    skill_name: str
    skill_category: str
    current_proficiency: int
    required_proficiency: int
    gap: int
    severity: str  # NONE, MEDIUM, HIGH, CRITICAL
    is_mandatory: bool
    years_of_experience: Decimal | None = None
    has_certification: bool = False


class EmployeeSkillGapReport(BaseModel):
    employee_id: UUID
    employee_name: str
    employee_code: str
    job_role_id: UUID
    job_role_title: str
    department_id: UUID
    department_name: str
    total_required_skills: int
    skills_with_gap: int
    critical_gaps_count: int
    overall_skill_match_percentage: float
    gaps: list[SkillGapItem] = []


class DepartmentSkillGapSummary(BaseModel):
    department_id: UUID
    department_name: str
    total_employees: int
    total_skill_gaps: int
    critical_gaps: int
    top_gap_skills: list[dict] = []


class TopSkillGapItem(BaseModel):
    skill_id: UUID
    skill_code: str
    skill_name: str
    skill_category: str
    affected_employees_count: int
    avg_proficiency_gap: float
    mandatory_gaps_count: int


class EmployeeSkillGapMember(BaseModel):
    employee_id: UUID
    employee_name: str
    employee_code: str
    department_name: str
    job_role_title: str
    current_proficiency: int
    required_proficiency: int
    gap: int
    mandatory: bool


class AttritionGuidanceSubject(BaseModel):
    case_ref: str = Field(min_length=1, max_length=32)
    department: str = Field(default="Unknown", max_length=100)
    role: str = Field(default="Unknown", max_length=150)
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    probability: float = Field(ge=0, le=100)
    drivers: list[str] = Field(default_factory=list, max_length=8)


class AttritionGuidanceRequest(BaseModel):
    employees: list[AttritionGuidanceSubject] = Field(min_length=1, max_length=8)


class AttritionGuidanceResponse(BaseModel):
    guidance: str
    model: str


class DashboardMetrics(BaseModel):
    total_employees: int
    active_employees: int
    high_risk_employees_count: int
    average_performance_score: float | None = None
    total_skill_gaps_count: int
    critical_skill_gaps_count: int
    pending_recommendations_count: int
    training_completion_rate: float
    total_training_courses: int
    active_enrollments: int

    # Charts data
    department_distribution: list[dict]
    risk_distribution: dict[str, int]
    performance_trends: list[dict]
    top_skill_gaps: list[TopSkillGapItem]
    recent_high_risk_alerts: list[dict] = []
    top_recommendations: list[dict] = []


class AuditActionCount(BaseModel):
    action: str
    count: int


class RecentAuditActivity(BaseModel):
    id: UUID
    user_email: str | None = None
    action: str
    entity_name: str
    description: str
    ip_address: str | None = None
    created_at: str


class SystemOverviewMetrics(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    users_by_role: dict[str, int]
    total_employees: int
    active_employees: int
    total_departments: int
    total_job_roles: int
    total_audit_logs: int
    recent_audit_logs: list[RecentAuditActivity] = []
    audit_action_counts: list[AuditActionCount] = []
    active_model_version: str | None = None
    system_status: str = "HEALTHY"
