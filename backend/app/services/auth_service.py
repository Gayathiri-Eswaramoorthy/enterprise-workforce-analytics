"""
Authentication service layer managing user validation, token issuance, and token refresh.
"""

from datetime import datetime, timezone

from app.models import User
from app.schemas.auth import AuthScheme, CurrentUserResponse, TokenResponse
from app.schemas.token import TokenType
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session


def invalid_credentials_exception() -> HTTPException:
    """
    HTTP 401 Exception for incorrect credentials (login failures).
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )


def invalid_token_exception() -> HTTPException:
    """
    HTTP 401 Exception for invalid or expired tokens (refresh/validation failures).
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


class AuthService:
    """
    Service class handling business logic for authentication.
    """

    def authenticate_user(self, email: str, password: str, db: Session) -> TokenResponse:
        """
        Authenticate a user with email and password, update last login, and return tokens.

        Args:
            email: User's email.
            password: User's plain password.
            db: Database session.

        Returns:
            TokenResponse containing access and refresh tokens.

        Raises:
            HTTPException: 401 Unauthorized for incorrect credentials.
            HTTPException: 403 Forbidden if user is inactive.
        """
        # Normalize email
        normalized_email = email.strip().lower()

        # Query user
        stmt = select(User).where(User.email == normalized_email)
        user = db.execute(stmt).scalar_one_or_none()

        if not user:
            raise invalid_credentials_exception()

        # Verify password
        if not verify_password(password, user.password_hash):
            raise invalid_credentials_exception()

        # Verify active status
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account",
            )

        # Update last login timestamp in transaction
        try:
            user.last_login = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()
            raise

        # Generate tokens
        access_token = create_access_token(subject=user.id, email=user.email, role=user.role.value)
        refresh_token = create_refresh_token(
            subject=user.id, email=user.email, role=user.role.value
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=AuthScheme.BEARER,
        )

    def refresh_access_token(self, refresh_token: str, db: Session) -> TokenResponse:
        """
        Validate a refresh token and issue a new access token.

        Args:
            refresh_token: The refresh token string.
            db: Database session.

        Returns:
            TokenResponse with new access token and existing refresh token.

        Raises:
            HTTPException: 401 Unauthorized if token is invalid or expired.
            HTTPException: 403 Forbidden if user is inactive.
        """
        try:
            payload = decode_token(refresh_token)
            # Strict token type validation
            if payload.token_type != TokenType.REFRESH:
                raise invalid_token_exception()
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except JWTError:
            raise invalid_token_exception()

        # Load user
        stmt = select(User).where(User.id == payload.sub)
        user = db.execute(stmt).scalar_one_or_none()

        if not user:
            raise invalid_token_exception()

        # Verify active status
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account",
            )

        # Issue new access token
        new_access_token = create_access_token(
            subject=user.id, email=user.email, role=user.role.value
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,
            token_type=AuthScheme.BEARER,
        )

    def get_current_user_profile(self, user: User) -> CurrentUserResponse:
        """
        Map user model to CurrentUserResponse schema using Pydantic model validation.

        Args:
            user: The authenticated User model.

        Returns:
            CurrentUserResponse schema.
        """
        return CurrentUserResponse.model_validate(user)
