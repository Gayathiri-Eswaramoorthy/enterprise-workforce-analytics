"""
Token schemas and payload definitions.
"""

from enum import Enum
from uuid import UUID

from app.database import UserRole
from pydantic import BaseModel


class TokenType(str, Enum):
    """
    Enum representing different kinds of JSON Web Tokens.
    """

    ACCESS = "access"
    REFRESH = "refresh"


class TokenPayload(BaseModel):
    """
    Pydantic schema representing the decoded JWT payload.
    """

    sub: UUID
    email: str
    role: UserRole
    token_type: TokenType
    exp: int
    iat: int
    aud: str | None = None
    iss: str | None = None
