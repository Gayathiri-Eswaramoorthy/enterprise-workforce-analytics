"""
User account management endpoints router.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.security import require_roles
from app.services.audit_service import AuditService
from app.services.user_service import UserService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
user_service = UserService()
audit_service = AuditService()


@router.get(
    "",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Users",
    description="Retrieve all user accounts. Restricted to HR Administrators.",
)
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> dict:
    items, total = user_service.list_users(db=db, page=page, page_size=page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create User",
    description="Create a new user account. Restricted to HR Administrators.",
)
def create_user(
    request_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> UserResponse:
    user = user_service.create_user(db=db, user_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="User",
        entity_id=user.id,
        action="CREATE",
        description=f"Created user account '{user.username}' ({user.email}) with role {user.role.value}",
        user=current_user,
        request=request,
    )
    return user


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User",
    description="Retrieve user account details. Restricted to HR Administrators.",
)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> UserResponse:
    user = user_service.get_user(db=db, user_id=user_id)
    return UserResponse.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update User",
    description="Update user account attributes or password. Restricted to HR Administrators.",
)
def update_user(
    user_id: UUID,
    request_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN])),
) -> UserResponse:
    user = user_service.update_user(db=db, user_id=user_id, user_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="User",
        entity_id=user_id,
        action="UPDATE",
        description=f"Updated user account '{user.username}'",
        user=current_user,
        request=request,
    )
    return user
