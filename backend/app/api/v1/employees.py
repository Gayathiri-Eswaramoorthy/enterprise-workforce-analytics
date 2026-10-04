"""
Employee management endpoints router.
"""

from uuid import UUID

from app.database import EmploymentStatus, UserRole, WorkMode, get_db
from app.models import User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeePaginatedResponse,
    EmployeeUpdate,
)
from app.schemas.skill import (
    EmployeeSkillCreate,
    EmployeeSkillResponse,
    EmployeeSkillUpdate,
)
from app.security import (
    ensure_employee_access,
    get_current_active_user,
    get_linked_employee_id,
    require_hr,
    require_roles,
)
from app.services.audit_service import AuditService
from app.services.employee_service import EmployeeService
from app.services.skill_service import SkillService
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
employee_service = EmployeeService()
skill_service = SkillService()
audit_service = AuditService()


@router.get(
    "",
    response_model=EmployeePaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Employees",
    description=(
        "List employees with search, department/role filtering, pagination, and sorting. "
        "Restricted to HR roles."
    ),
)
def list_employees(
    search: str | None = Query(None, description="Search by name, employee code, or email"),
    department_id: UUID | None = Query(None, description="Filter by department"),
    job_role_id: UUID | None = Query(None, description="Filter by job role"),
    employment_status: EmploymentStatus | None = Query(None, description="Filter by status"),
    work_mode: WorkMode | None = Query(None, description="Filter by work mode"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_desc: bool = Query(True, description="Sort descending"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> EmployeePaginatedResponse:
    return employee_service.list_employees(
        db=db,
        search=search,
        department_id=department_id,
        job_role_id=job_role_id,
        employment_status=employment_status,
        work_mode=work_mode,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )


@router.post(
    "",
    response_model=EmployeeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Employee",
    description="Register a new employee. Restricted to HR Administrators and HR Managers.",
)
def create_employee(
    request_data: EmployeeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> EmployeeDetailResponse:
    emp = employee_service.create_employee(db=db, emp_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="Employee",
        entity_id=emp.id,
        action="CREATE",
        description=f"Created employee {emp.first_name} {emp.last_name} ({emp.employee_code})",
        user=current_user,
        request=request,
    )
    return emp


@router.get(
    "/me",
    response_model=EmployeeDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Employee Profile",
    description="Retrieve the employee profile linked to the authenticated user account.",
)
def get_my_employee_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmployeeDetailResponse:
    employee_id = get_linked_employee_id(db, current_user)
    if employee_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile is linked to this account",
        )
    return employee_service.get_employee_detail(db=db, employee_id=employee_id)


@router.get(
    "/{employee_id}",
    response_model=EmployeeDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Employee Detail",
    description=(
        "Retrieve comprehensive employee profile, relations, and assigned skills. "
        "Employees may only request their own profile."
    ),
)
def get_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmployeeDetailResponse:
    ensure_employee_access(db, current_user, employee_id)
    return employee_service.get_employee_detail(db=db, employee_id=employee_id)


@router.put(
    "/{employee_id}",
    response_model=EmployeeDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Employee",
    description="Update employee record. Restricted to HR roles.",
)
def update_employee(
    employee_id: UUID,
    request_data: EmployeeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> EmployeeDetailResponse:
    emp = employee_service.update_employee(db=db, employee_id=employee_id, emp_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="Employee",
        entity_id=employee_id,
        action="UPDATE",
        description=f"Updated employee {emp.first_name} {emp.last_name} ({emp.employee_code})",
        user=current_user,
        request=request,
    )
    return emp


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft Delete Employee",
    description="Soft-delete an employee from active rosters. Restricted to HR Administrators.",
)
def delete_employee(
    employee_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
):
    employee_service.delete_employee(db=db, employee_id=employee_id)
    audit_service.log_action(
        db=db,
        entity_name="Employee",
        entity_id=employee_id,
        action="DELETE",
        description=f"Soft-deleted employee with ID {employee_id}",
        user=current_user,
        request=request,
    )


# Employee Skills Sub-endpoints
@router.get(
    "/{employee_id}/skills",
    response_model=list[EmployeeSkillResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Employee Skills",
    description="List all skills assigned to an employee with proficiency ratings.",
)
def get_employee_skills(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[EmployeeSkillResponse]:
    return skill_service.list_employee_skills(db=db, employee_id=employee_id)


@router.post(
    "/{employee_id}/skills",
    response_model=EmployeeSkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign Skill to Employee",
    description="Assign a skill proficiency record to an employee.",
)
def assign_employee_skill(
    employee_id: UUID,
    request_data: EmployeeSkillCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> EmployeeSkillResponse:
    emp_skill = skill_service.assign_employee_skill(
        db=db, employee_id=employee_id, skill_in=request_data
    )
    audit_service.log_action(
        db=db,
        entity_name="EmployeeSkill",
        entity_id=emp_skill.id,
        action="ASSIGN_SKILL",
        description=f"Assigned skill {emp_skill.skill_id} (Level {emp_skill.proficiency_level}) to employee {employee_id}",
        user=current_user,
        request=request,
    )
    return emp_skill


@router.put(
    "/{employee_id}/skills/{skill_id}",
    response_model=EmployeeSkillResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Employee Skill",
    description="Update an employee's proficiency level or certification for a skill.",
)
def update_employee_skill(
    employee_id: UUID,
    skill_id: UUID,
    request_data: EmployeeSkillUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> EmployeeSkillResponse:
    emp_skill = skill_service.update_employee_skill(
        db=db, employee_id=employee_id, skill_id=skill_id, skill_in=request_data
    )
    audit_service.log_action(
        db=db,
        entity_name="EmployeeSkill",
        entity_id=emp_skill.id,
        action="UPDATE_SKILL",
        description=f"Updated skill {skill_id} for employee {employee_id}",
        user=current_user,
        request=request,
    )
    return emp_skill


@router.delete(
    "/{employee_id}/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Employee Skill",
    description="Remove an assigned skill from an employee.",
)
def remove_employee_skill(
    employee_id: UUID,
    skill_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
):
    skill_service.remove_employee_skill(db=db, employee_id=employee_id, skill_id=skill_id)
    audit_service.log_action(
        db=db,
        entity_name="EmployeeSkill",
        entity_id=employee_id,
        action="REMOVE_SKILL",
        description=f"Removed skill {skill_id} from employee {employee_id}",
        user=current_user,
        request=request,
    )
