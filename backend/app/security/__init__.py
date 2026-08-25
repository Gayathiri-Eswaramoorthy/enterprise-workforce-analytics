"""
Security and authentication module.
"""

from app.security.dependencies import (
    get_current_active_user,
    get_current_user,
    require_roles,
)
from app.security.hashing import hash_password, verify_password
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)

__all__ = [
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "get_current_active_user",
    "get_current_user",
    "hash_password",
    "require_roles",
    "verify_password",
]
