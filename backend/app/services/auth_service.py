"""
Authentication service layer managing user validation, token issuance, and token refresh.
"""

import math
from datetime import datetime, timedelta, timezone

from app.config.settings import settings
from app.models import User
from app.schemas.auth import AuthScheme, CurrentUserResponse, TokenResponse
from app.schemas.token import TokenType
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_linked_employee_id,
    hash_password,
    purge_expired_revocations,
    revoke_token,
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


# Precomputed dummy hash so a lookup miss still pays the bcrypt cost of a real
# verification, keeping login response time constant regardless of whether the
# email exists (prevents timing-based user enumeration).
_DUMMY_PASSWORD_HASH = hash_password("dummy-password-for-constant-time-comparison")


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
            HTTPException: 423 Locked if the account is locked after repeated failures.
        """
        # Normalize email
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc)

        # Query user
        stmt = select(User).where(User.email == normalized_email)
        user = db.execute(stmt).scalar_one_or_none()

        if user and user.locked_until and user.locked_until > now:
            raise self._account_locked_exception(user.locked_until, now)

        # Always run a bcrypt verification, even on a lookup miss, so response
        # time doesn't leak whether the email is registered.
        password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
        password_valid = verify_password(password, password_hash)

        if not user or not password_valid:
            if user:
                self._record_failed_login(user, now, db)
            raise invalid_credentials_exception()

        # Verify active status
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account",
            )

        # Reset lockout counters and update last login timestamp in transaction
        try:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_login = now
            db.commit()
        except Exception:
            db.rollback()
            raise

        return self._issue_tokens(user)

    def _record_failed_login(self, user: User, now: datetime, db: Session) -> None:
        """
        Count a failed password attempt and lock the account once the limit is reached.
        """
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
        db.commit()

    @staticmethod
    def _account_locked_exception(locked_until: datetime, now: datetime) -> HTTPException:
        minutes_left = max(1, math.ceil((locked_until - now).total_seconds() / 60))
        return HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                "Account temporarily locked after too many failed sign-in attempts. "
                f"Try again in {minutes_left} minute{'s' if minutes_left != 1 else ''}."
            ),
        )

    @staticmethod
    def _issue_tokens(user: User) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(
                subject=user.id, email=user.email, role=user.role.value
            ),
            refresh_token=create_refresh_token(
                subject=user.id, email=user.email, role=user.role.value
            ),
            token_type=AuthScheme.BEARER,
        )

    def refresh_access_token(self, refresh_token: str, db: Session) -> TokenResponse:
        """
        Validate a refresh token and rotate it: the presented refresh token is revoked
        and a new access/refresh token pair is issued. Each refresh token is therefore
        single-use, so a stolen token that has already been used is worthless.

        Args:
            refresh_token: The refresh token string.
            db: Database session.

        Returns:
            TokenResponse with a new access token and a new refresh token.

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

        # Rotate: atomically revoke the presented token. If it was already revoked
        # (logged out, or already exchanged once) it must not be accepted again.
        try:
            newly_revoked = revoke_token(db, payload)
            db.commit()
        except Exception:
            db.rollback()
            raise
        if not newly_revoked:
            raise invalid_token_exception()

        return self._issue_tokens(user)

    def logout(self, access_token: str, refresh_token: str | None, user: User, db: Session) -> None:
        """
        Revoke the caller's current access token and, if supplied, their refresh token.

        An invalid, expired, or foreign refresh token is ignored rather than rejected so
        that logout always succeeds from the client's point of view.
        """
        try:
            revoke_token(db, decode_token(access_token))
            if refresh_token:
                try:
                    refresh_payload = decode_token(refresh_token)
                except JWTError:
                    refresh_payload = None
                if (
                    refresh_payload
                    and refresh_payload.token_type == TokenType.REFRESH
                    and refresh_payload.sub == user.id
                ):
                    revoke_token(db, refresh_payload)
            purge_expired_revocations(db)
            db.commit()
        except Exception:
            db.rollback()
            raise

    def get_current_user_profile(self, user: User, db: Session) -> CurrentUserResponse:
        """
        Map user model to CurrentUserResponse schema using Pydantic model validation.

        Args:
            user: The authenticated User model.
            db: Database session.

        Returns:
            CurrentUserResponse schema, including the linked employee record ID if any.
        """
        profile = CurrentUserResponse.model_validate(user)
        profile.employee_id = get_linked_employee_id(db, user)
        return profile
