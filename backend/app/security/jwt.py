"""
JWT creation, validation, and decoding utilities.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config.settings import settings
from app.schemas.token import TokenPayload, TokenType
from jose import JWTError, jwt
from pydantic import ValidationError


def _create_token(
    subject: str | uuid.UUID,
    email: str,
    role: str,
    token_type: TokenType,
    expires_delta: timedelta,
    audience: str | None = None,
    issuer: str | None = None,
) -> str:
    """
    Internal helper to create a JWT token.

    Args:
        subject: The subject of the token (User UUID).
        email: User email address.
        role: User role name.
        token_type: Type of the token (ACCESS or REFRESH).
        expires_delta: The expiration duration.
        audience: Optional audience claim.
        issuer: Optional issuer claim.

    Returns:
        The encoded JWT token string.
    """
    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload: dict[str, Any] = {
        "sub": str(subject),
        "email": email,
        "role": role,
        "token_type": token_type.value,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        # Unique token ID so individual tokens can be revoked (logout, refresh rotation)
        "jti": uuid.uuid4().hex,
    }

    if audience:
        payload["aud"] = audience
    if issuer:
        payload["iss"] = issuer

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(
    subject: str | uuid.UUID,
    email: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Generate a JWT access token.

    Args:
        subject: The subject of the token (User UUID).
        email: User email address.
        role: User role name.
        expires_delta: Optional custom expiration duration.

    Returns:
        The encoded JWT access token string.
    """
    delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(
        subject=subject,
        email=email,
        role=role,
        token_type=TokenType.ACCESS,
        expires_delta=delta,
    )


def create_refresh_token(
    subject: str | uuid.UUID,
    email: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Generate a JWT refresh token.

    Args:
        subject: The subject of the token (User UUID).
        email: User email address.
        role: User role name.
        expires_delta: Optional custom expiration duration.

    Returns:
        The encoded JWT refresh token string.
    """
    delta = expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return _create_token(
        subject=subject,
        email=email,
        role=role,
        token_type=TokenType.REFRESH,
        expires_delta=delta,
    )


def decode_token(
    token: str,
    audience: str | None = None,
    issuer: str | None = None,
) -> TokenPayload:
    """
    Decode and validate a JWT token, returning the validated TokenPayload model.

    Args:
        token: The JWT string to decode and validate.
        audience: Optional audience claim to validate.
        issuer: Optional issuer claim to validate.

    Returns:
        A validated TokenPayload instance.

    Raises:
        JWTError: If token signature is invalid, expired, or payload claims are malformed.
    """
    try:
        # Note: python-jose verifies exp and iat claims automatically.
        # It also verifies aud and iss if we pass them to jwt.decode.
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience=audience,
            issuer=issuer,
        )
        return TokenPayload(**payload)
    except ValidationError as e:
        # Wrap Pydantic validation errors in JWTError to ensure clean interface
        raise JWTError(f"Token claims validation failed: {e}") from e
