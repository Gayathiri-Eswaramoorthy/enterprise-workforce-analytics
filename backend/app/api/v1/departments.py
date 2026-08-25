"""
Department management endpoints router.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.department_service import DepartmentService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
department_service = DepartmentService()
audit_service = AuditService()


@router.get(
    "",
    response_model=list[DepartmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List Departments",
    description="Retrieve all departments along with employee and role headcounts.",
)
def list_departments(
    active_only: bool = Query(False, description="Filter active departments only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[DepartmentResponse]:
    return department_service.list_departments(db=db, active_only=active_only)


@router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Department",
    description="Create a new organizational department. Restricted to HR Administrators.",
)
def create_department(
    request_data: DepartmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> DepartmentResponse:
    dept = department_service.create_department(db=db, dept_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="Department",
        entity_id=dept.id,
        action="CREATE",
        description=f"Created department '{dept.name}' ({dept.department_code})",
        user=current_user,
        request=request,
    )
    return dept


@router.get(
    "/{department_id}",
    response_model=DepartmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Department",
    description="Retrieve department details by ID.",
)
def get_department(
    department_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DepartmentResponse:
    dept = department_service.get_department(db=db, department_id=department_id)
    return DepartmentResponse.model_validate(dept)


@router.put(
    "/{department_id}",
    response_model=DepartmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Department",
    description="Update department details. Restricted to HR Administrators.",
)
def update_department(
    department_id: UUID,
    request_data: DepartmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> DepartmentResponse:
    dept = department_service.update_department(
        db=db, department_id=department_id, dept_in=request_data
    )
    audit_service.log_action(
        db=db,
        entity_name="Department",
        entity_id=department_id,
        action="UPDATE",
        description=f"Updated department '{dept.name}' ({dept.department_code})",
        user=current_user,
        request=request,
    )
    return dept
