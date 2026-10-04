"""
Authentication and security dependencies for FastAPI endpoints.
"""

from uuid import UUID

from app.config.settings import settings
from app.database import UserRole, get_db
from app.models import Employee, User
from app.schemas.token import TokenType
from app.security.jwt import decode_token
from app.security.revocation import is_token_revoked
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

# Define oauth2_scheme for extracting Bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def credentials_exception() -> HTTPException:
    """
    Generate a standard HTTP 401 Unauthorized exception for credentials failure.

    Returns:
        HTTPException with status code 401.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)  # noqa: B008
) -> User:
    """
    Retrieve the current authenticated user from the database.

    Args:
        db: Database session.
        token: Bearer token extracted from the request.

    Returns:
        The authenticated User model instance.

    Raises:
        HTTPException: 401 Unauthorized if the token is invalid, expired,
                       not an access token, or if the user does not exist.
    """
    try:
        payload = decode_token(token)
        if payload.token_type != TokenType.ACCESS:
            # Refresh tokens must never authenticate API requests
            raise credentials_exception()
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise credentials_exception()

    # Reject tokens revoked by logout
    if is_token_revoked(db, payload.jti):
        raise credentials_exception()

    # Query the user from the database
    stmt = select(User).where(User.id == payload.sub)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise credentials_exception()

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """
    Ensure the current authenticated user is active.

    Args:
        current_user: The authenticated User retrieved from get_current_user.

    Returns:
        The active User model instance.

    Raises:
        HTTPException: 403 Forbidden if the user is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


def require_roles(allowed_roles: list):
    """
    Dependency factory to restrict endpoint access by UserRole.

    Args:
        allowed_roles: List of UserRole values permitted to access the endpoint.
    """

    def role_checker(
        current_user: User = Depends(get_current_active_user),  # noqa: B008
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have sufficient permissions to perform this action",
            )
        return current_user

    return role_checker


HR_ROLES = [UserRole.HR_ADMIN, UserRole.HR_MANAGER]

# Shorthand for endpoints exposing organization-wide HR data
require_hr = require_roles(HR_ROLES)


def get_linked_employee_id(db: Session, user: User) -> UUID | None:
    """
    Return the ID of the (non-deleted) employee record linked to a user account, if any.
    """
    stmt = select(Employee.id).where(
        Employee.user_id == user.id, Employee.is_deleted == False
    )  # noqa: E712
    return db.execute(stmt).scalar_one_or_none()


def ensure_employee_access(db: Session, user: User, employee_id: UUID) -> None:
    """
    Allow HR roles to access any employee; restrict everyone else to their own record.

    Raises:
        HTTPException: 403 Forbidden if a non-HR user requests another employee's data.
    """
    if user.role in HR_ROLES:
        return
    if get_linked_employee_id(db, user) != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own employee records",
        )


def scope_employee_filter(
    db: Session, user: User, requested_employee_id: UUID | None
) -> UUID | None:
    """
    Resolve the employee filter for list endpoints holding per-employee data.

    HR roles get whatever they asked for (None = everyone). Other users are pinned to
    their own employee record, so they can never list another employee's rows.

    Raises:
        HTTPException: 403 Forbidden if a non-HR user has no linked employee record,
                       or asks for a different employee.
    """
    if user.role in HR_ROLES:
        return requested_employee_id
    own_id = get_linked_employee_id(db, user)
    if own_id is None or (requested_employee_id is not None and requested_employee_id != own_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own employee records",
        )
    return own_id
