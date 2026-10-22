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
from app.schemas.employee_request import (
    EmployeeRequestCreate,
    EmployeeRequestResponse,
    EmployeeRequestUpdate,
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
    require_admin,
    require_hr,
    require_roles,
)
from app.services.audit_service import AuditService
from app.services.employee_request_service import EmployeeRequestService
from app.services.employee_service import EmployeeService
from app.services.skill_service import SkillService
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
employee_service = EmployeeService()
skill_service = SkillService()
audit_service = AuditService()
request_service = EmployeeRequestService()


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
    page_size: int = Query(20, ge=1, le=250, description="Items per page"),
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
    description="Register a new employee. Restricted to HR Administrators.",
)
def create_employee(
    request_data: EmployeeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
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


# Employee Discussion & Learning Interest Requests
@router.post(
    "/me/discussion-request",
    response_model=EmployeeRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Career Discussion or Learning Interest Request",
    description="Allow an authenticated employee to express a learning interest or request a career discussion with HR.",
)
def submit_discussion_request(
    request_in: EmployeeRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmployeeRequestResponse:
    emp_id = get_linked_employee_id(db, current_user)
    if not emp_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile linked to this account",
        )
    result = request_service.create_request(db=db, employee_id=emp_id, request_in=request_in)
    audit_service.log_action(
        db=db,
        entity_name="EmployeeRequest",
        entity_id=result.id,
        action="SUBMIT_REQUEST",
        description=f"Submitted {result.request_type} request regarding '{result.topic}'",
        user=current_user,
        request=request,
    )
    return result


@router.get(
    "/me/discussion-requests",
    response_model=list[EmployeeRequestResponse],
    status_code=status.HTTP_200_OK,
    summary="List My Discussion Requests",
    description="Retrieve historical discussion requests submitted by the current authenticated employee.",
)
def list_my_discussion_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[EmployeeRequestResponse]:
    emp_id = get_linked_employee_id(db, current_user)
    if not emp_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile linked to this account",
        )
    return request_service.list_requests(db=db, employee_id=emp_id)


@router.get(
    "/discussion-requests",
    response_model=list[EmployeeRequestResponse],
    status_code=status.HTTP_200_OK,
    summary="List All Employee Discussion Requests",
    description="Retrieve all employee discussion requests and learning interests. Restricted to HR roles.",
)
def list_all_discussion_requests(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status (PENDING, REVIEWED, RESOLVED)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> list[EmployeeRequestResponse]:
    return request_service.list_requests(db=db, employee_id=employee_id, status_filter=status_filter)


@router.patch(
    "/discussion-requests/{request_id}",
    response_model=EmployeeRequestResponse,
    status_code=status.HTTP_200_OK,
    summary="Review Employee Discussion Request",
    description="Update employee discussion request status and provide follow-up notes. Restricted to HR roles.",
)
def review_discussion_request(
    request_id: UUID,
    update_in: EmployeeRequestUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> EmployeeRequestResponse:
    result = request_service.update_request(
        db=db, request_id=request_id, hr_user=current_user, update_in=update_in
    )
    audit_service.log_action(
        db=db,
        entity_name="EmployeeRequest",
        entity_id=request_id,
        action="REVIEW_REQUEST",
        description=f"Reviewed employee request {request_id} (Status: {result.status})",
        user=current_user,
        request=request,
    )
    return result


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
    description="Update employee record. Restricted to HR Administrators.",
)
def update_employee(
    employee_id: UUID,
    request_data: EmployeeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
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
    ensure_employee_access(db, current_user, employee_id)
    return skill_service.list_employee_skills(db=db, employee_id=employee_id)


@router.post(
    "/{employee_id}/skills",
    response_model=EmployeeSkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign Skill to Employee",
    description="Assign a skill proficiency record to an employee. Restricted to HR Administrators.",
)
def assign_employee_skill(
    employee_id: UUID,
    request_data: EmployeeSkillCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
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
    description="Update an employee's proficiency level or certification for a skill. Restricted to HR Administrators.",
)
def update_employee_skill(
    employee_id: UUID,
    skill_id: UUID,
    request_data: EmployeeSkillUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
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
    description="Remove an assigned skill from an employee. Restricted to HR Administrators.",
)
def remove_employee_skill(
    employee_id: UUID,
    skill_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
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
