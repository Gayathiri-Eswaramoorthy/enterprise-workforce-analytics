"""
Job role management endpoints router.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.job_role import (
    JobRoleCreate,
    JobRoleResponse,
    JobRoleUpdate,
    RoleSkillRequirement,
)
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.job_role_service import JobRoleService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
job_role_service = JobRoleService()
audit_service = AuditService()


@router.get(
    "",
    response_model=list[JobRoleResponse],
    status_code=status.HTTP_200_OK,
    summary="List Job Roles",
    description="Retrieve all job roles, optionally filtered by department.",
)
def list_job_roles(
    department_id: UUID | None = Query(None, description="Filter by department"),
    active_only: bool = Query(False, description="Filter active roles only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[JobRoleResponse]:
    return job_role_service.list_job_roles(
        db=db, department_id=department_id, active_only=active_only
    )


@router.post(
    "",
    response_model=JobRoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Job Role",
    description="Create a new job role with optional required skills. Restricted to HR roles.",
)
def create_job_role(
    request_data: JobRoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> JobRoleResponse:
    role = job_role_service.create_job_role(db=db, role_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="JobRole",
        entity_id=role.id,
        action="CREATE",
        description=f"Created job role '{role.title}' in department {role.department_id}",
        user=current_user,
        request=request,
    )
    return role


@router.get(
    "/{job_role_id}",
    response_model=JobRoleResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Job Role",
    description="Retrieve job role details including required skills.",
)
def get_job_role(
    job_role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> JobRoleResponse:
    return job_role_service.get_job_role_response(db=db, job_role_id=job_role_id)


@router.put(
    "/{job_role_id}",
    response_model=JobRoleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Job Role",
    description="Update job role attributes. Restricted to HR roles.",
)
def update_job_role(
    job_role_id: UUID,
    request_data: JobRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> JobRoleResponse:
    role = job_role_service.update_job_role(db=db, job_role_id=job_role_id, role_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="JobRole",
        entity_id=job_role_id,
        action="UPDATE",
        description=f"Updated job role '{role.title}'",
        user=current_user,
        request=request,
    )
    return role


@router.put(
    "/{job_role_id}/skills",
    response_model=JobRoleResponse,
    status_code=status.HTTP_200_OK,
    summary="Set Job Role Required Skills",
    description="Overwrite the required skill proficiencies for a job role. Restricted to HR roles.",
)
def set_role_skills(
    job_role_id: UUID,
    requirements: list[RoleSkillRequirement],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> JobRoleResponse:
    role = job_role_service.set_role_skills(
        db=db, job_role_id=job_role_id, requirements=requirements
    )
    audit_service.log_action(
        db=db,
        entity_name="JobRole",
        entity_id=job_role_id,
        action="UPDATE_ROLE_SKILLS",
        description=f"Updated required skills for job role '{role.title}' ({len(requirements)} skills)",
        user=current_user,
        request=request,
    )
    return role
