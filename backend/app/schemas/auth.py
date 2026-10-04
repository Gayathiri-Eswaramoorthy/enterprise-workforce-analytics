"""
Authentication schemas for request and response validation.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from app.database import UserRole
from pydantic import BaseModel, ConfigDict, Field


class AuthScheme(str, Enum):
    """
    Enum representing HTTP Authentication Schemes.
    """

    BEARER = "bearer"


class LoginRequest(BaseModel):
    """
    Schema for user login request validation.
    """

    email: str
    password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    """
    Schema for JWT token response.
    """

    access_token: str
    refresh_token: str
    token_type: AuthScheme = AuthScheme.BEARER


class RefreshTokenRequest(BaseModel):
    """
    Schema for refreshing access tokens.
    """

    refresh_token: str


class LogoutRequest(BaseModel):
    """
    Schema for logout; the refresh token is revoked alongside the access token.
    """

    refresh_token: str | None = None


class CurrentUserResponse(BaseModel):
    """
    Schema for representing safe user information.
    """

    id: UUID
    username: str
    email: str
    display_name: str | None = None
    role: UserRole
    is_active: bool
    last_login: datetime | None = None
    employee_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)
