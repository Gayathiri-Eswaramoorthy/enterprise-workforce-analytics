"""
Security and authentication module.
"""

from app.security.dependencies import (
    HR_ROLES,
    ensure_employee_access,
    get_current_active_user,
    get_current_user,
    get_linked_employee_id,
    oauth2_scheme,
    require_hr,
    require_roles,
    scope_employee_filter,
)
from app.security.hashing import hash_password, verify_password
from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.security.rate_limit import login_rate_limiter
from app.security.revocation import (
    is_token_revoked,
    purge_expired_revocations,
    revoke_token,
)

__all__ = [
    "HR_ROLES",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "ensure_employee_access",
    "get_current_active_user",
    "get_current_user",
    "get_linked_employee_id",
    "hash_password",
    "is_token_revoked",
    "login_rate_limiter",
    "oauth2_scheme",
    "purge_expired_revocations",
    "require_hr",
    "require_roles",
    "revoke_token",
    "scope_employee_filter",
    "verify_password",
]
