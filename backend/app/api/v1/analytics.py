"""
Skill gap intelligence and workforce analytics endpoints router.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.analytics import (
    DepartmentSkillGapSummary,
    EmployeeSkillGapReport,
    TopSkillGapItem,
)
from app.schemas.assessment import (
    SkillAssessmentComparison,
    SkillAssessmentCreate,
    SkillAssessmentResponse,
)
from app.security import (
    ensure_employee_access,
    get_current_active_user,
    require_hr,
)
from app.services.assessment_service import AssessmentService
from app.services.audit_service import AuditService
from app.services.skill_gap_service import SkillGapService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
skill_gap_service = SkillGapService()
assessment_service = AssessmentService()
audit_service = AuditService()


@router.get(
    "/skill-gaps/employee/{employee_id}",
    response_model=EmployeeSkillGapReport,
    status_code=status.HTTP_200_OK,
    summary="Get Employee Skill Gap Report",
    description=(
        "Calculate actual employee skills against job role requirements with gap severity ratings. "
        "Employees may only request their own report."
    ),
)
def get_employee_skill_gaps(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmployeeSkillGapReport:
    ensure_employee_access(db, current_user, employee_id)
    return skill_gap_service.calculate_employee_skill_gaps(db=db, employee_id=employee_id)


@router.get(
    "/skill-gaps/top",
    response_model=list[TopSkillGapItem],
    status_code=status.HTTP_200_OK,
    summary="Get Top Organization Skill Gaps",
    description="Aggregate critical and high-priority skill gaps across the active workforce. Restricted to HR roles.",
)
def get_top_skill_gaps(
    limit: int = Query(10, ge=1, le=50, description="Number of top skills to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> list[TopSkillGapItem]:
    return skill_gap_service.get_organization_top_skill_gaps(db=db, limit=limit)


@router.get(
    "/skill-gaps/department/{department_id}",
    response_model=DepartmentSkillGapSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Department Skill Gap Summary",
    description="Summarize total and critical skill gaps within a specific department. Restricted to HR roles.",
)
def get_department_skill_gaps(
    department_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> DepartmentSkillGapSummary:
    return skill_gap_service.get_department_skill_gap_summary(db=db, department_id=department_id)


@router.post(
    "/assessments",
    response_model=SkillAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Skill Assessment",
    description="Record a baseline or post-training skill evaluation. Restricted to HR roles.",
)
def create_skill_assessment(
    assessment_in: SkillAssessmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> SkillAssessmentResponse:
    assessment = assessment_service.create_assessment(
        db=db, assessment_in=assessment_in, evaluator_id=current_user.id
    )
    audit_service.log_action(
        db=db,
        entity_name="SkillAssessment",
        entity_id=assessment.id,
        action="RECORD_ASSESSMENT",
        description=(
            f"Recorded {assessment.assessment_type.value} assessment for employee {assessment.employee_id} "
            f"on skill {assessment.skill_id} (Score: {assessment.score}%)"
        ),
        user=current_user,
        request=request,
    )
    return assessment


@router.get(
    "/assessments",
    response_model=list[SkillAssessmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List Skill Assessments",
    description="Query skill assessments with filters for employee, skill, or course.",
)
def list_skill_assessments(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    skill_id: UUID | None = Query(None, description="Filter by skill"),
    course_id: UUID | None = Query(None, description="Filter by training course"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillAssessmentResponse]:
    if employee_id:
        ensure_employee_access(db, current_user, employee_id)
    elif current_user.role not in [UserRole.HR_ADMIN, UserRole.HR_MANAGER]:
        from app.security import get_linked_employee_id

        employee_id = get_linked_employee_id(db, current_user)
    return assessment_service.list_assessments(
        db=db, employee_id=employee_id, skill_id=skill_id, course_id=course_id
    )


@router.get(
    "/assessments/comparison/{employee_id}",
    response_model=list[SkillAssessmentComparison],
    status_code=status.HTTP_200_OK,
    summary="Get Assessment Comparison and Skill Gap Recalculation",
    description="Retrieve baseline vs post-training score differences and remaining role skill gaps.",
)
def get_assessment_comparison(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillAssessmentComparison]:
    ensure_employee_access(db, current_user, employee_id)
    return assessment_service.get_employee_assessment_comparison(db=db, employee_id=employee_id)
