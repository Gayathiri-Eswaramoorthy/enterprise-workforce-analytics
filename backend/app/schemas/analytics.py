"""
Skill gap and analytics schemas for intelligent evaluation.
"""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


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
