"""
Lightweight in-memory rate limiting for sensitive, unauthenticated endpoints.

This is a single-process sliding-window limiter keyed by client IP - adequate
for a single-instance deployment/prototype. A multi-instance production
deployment should replace the in-memory store with a shared one (e.g. Redis).
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

_WINDOW_SECONDS = 60
_MAX_ATTEMPTS = 10

_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def reset_login_rate_limiter() -> None:
    """
    Forget all recorded attempts (used by the test suite between tests).
    """
    with _lock:
        _attempts.clear()


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def login_rate_limiter(request: Request) -> None:
    """
    FastAPI dependency: raises 429 if the client IP has exceeded
    `_MAX_ATTEMPTS` requests within the trailing `_WINDOW_SECONDS`.
    """
    key = _client_key(request)
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    with _lock:
        recent = [t for t in _attempts[key] if t > cutoff]
        if len(recent) >= _MAX_ATTEMPTS:
            _attempts[key] = recent
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again shortly.",
            )
        recent.append(now)
        _attempts[key] = recent
