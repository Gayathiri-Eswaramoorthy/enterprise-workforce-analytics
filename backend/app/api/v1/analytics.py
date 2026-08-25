"""
Skill gap intelligence and workforce analytics endpoints router.
"""

from uuid import UUID

from app.database import get_db
from app.models import User
from app.schemas.analytics import (
    DepartmentSkillGapSummary,
    EmployeeSkillGapReport,
    TopSkillGapItem,
)
from app.security import get_current_active_user
from app.services.skill_gap_service import SkillGapService
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

router = APIRouter()
skill_gap_service = SkillGapService()


@router.get(
    "/skill-gaps/employee/{employee_id}",
    response_model=EmployeeSkillGapReport,
    status_code=status.HTTP_200_OK,
    summary="Get Employee Skill Gap Report",
    description="Calculate actual employee skills against job role requirements with gap severity ratings.",
)
def get_employee_skill_gaps(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmployeeSkillGapReport:
    return skill_gap_service.calculate_employee_skill_gaps(db=db, employee_id=employee_id)


@router.get(
    "/skill-gaps/top",
    response_model=list[TopSkillGapItem],
    status_code=status.HTTP_200_OK,
    summary="Get Top Organization Skill Gaps",
    description="Aggregate critical and high-priority skill gaps across the active workforce.",
)
def get_top_skill_gaps(
    limit: int = Query(10, ge=1, le=50, description="Number of top skills to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[TopSkillGapItem]:
    return skill_gap_service.get_organization_top_skill_gaps(db=db, limit=limit)


@router.get(
    "/skill-gaps/department/{department_id}",
    response_model=DepartmentSkillGapSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Department Skill Gap Summary",
    description="Summarize total and critical skill gaps within a specific department.",
)
def get_department_skill_gaps(
    department_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DepartmentSkillGapSummary:
    return skill_gap_service.get_department_skill_gap_summary(db=db, department_id=department_id)
