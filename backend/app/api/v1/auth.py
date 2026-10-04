"""
Authentication endpoints router.
"""

from app.database import get_db
from app.models import User
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.security import (
    get_current_active_user,
    get_current_user,
    login_rate_limiter,
    oauth2_scheme,
)
from app.services.auth_service import AuthService
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

router = APIRouter()
auth_service = AuthService()


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description=(
        "Authenticate user with email and password, update last login, and return tokens. "
        "Accounts are temporarily locked after repeated failed attempts."
    ),
    dependencies=[Depends(login_rate_limiter)],
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    """
    POST login endpoint.
    """
    return auth_service.authenticate_user(
        email=request.email,
        password=request.password,
        db=db,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Token",
    description=(
        "Exchange a valid refresh token for a new access/refresh token pair. "
        "The presented refresh token is revoked (single use)."
    ),
)
def refresh(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    """
    POST refresh token endpoint.
    """
    return auth_service.refresh_access_token(
        refresh_token=request.refresh_token,
        db=db,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout",
    description="Revoke the current access token and the supplied refresh token.",
)
def logout(
    request: LogoutRequest | None = None,
    token: str = Depends(oauth2_scheme),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> Response:
    """
    POST logout endpoint.
    """
    auth_service.logout(
        access_token=token,
        refresh_token=request.refresh_token if request else None,
        user=current_user,
        db=db,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User",
    description="Retrieve profile information of the currently authenticated active user.",
)
def get_me(
    db: Session = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_active_user),  # noqa: B008
) -> CurrentUserResponse:
    """
    GET me profile endpoint.
    """
    return auth_service.get_current_user_profile(user=current_user, db=db)
