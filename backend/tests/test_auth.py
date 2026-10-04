"""
Tests for Authentication & Security Endpoints.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from app.config.settings import settings
from app.database import UserRole
from app.models import User
from app.security import hash_password
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _login(client: TestClient, email: str, password: str = "demo1234"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


@pytest.fixture
def throwaway_user(db_session: Session):
    """A fresh account, so lockout tests never lock the shared demo accounts."""
    suffix = uuid.uuid4().hex[:8]
    user = User(
        username=f"lockout-{suffix}",
        email=f"lockout-{suffix}@workforce.local",
        password_hash=hash_password("demo1234"),
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    yield user
    db_session.delete(user)
    db_session.commit()


def test_login_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@workforce.local", "password": "demo1234"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@workforce.local", "password": "WrongPassword123!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_get_current_user_profile(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/auth/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@workforce.local"
    assert data["role"] == "HR_ADMIN"


def test_token_refresh(client: TestClient):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@workforce.local", "password": "demo1234"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()


def test_unauthorized_access(client: TestClient):
    response = client.get("/api/v1/employees")
    assert response.status_code == 401


def test_refresh_rotates_token_and_rejects_reuse(client: TestClient):
    tokens = _login(client, "admin@workforce.local").json()

    first = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200
    assert first.json()["refresh_token"] != tokens["refresh_token"]

    # The original refresh token was consumed by the rotation above
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401

    # The rotated token still works
    second = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first.json()["refresh_token"]}
    )
    assert second.status_code == 200


def test_logout_revokes_access_and_refresh_tokens(client: TestClient):
    tokens = _login(client, "user@workforce.local").json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    logout = client.post(
        "/api/v1/auth/logout", headers=headers, json={"refresh_token": tokens["refresh_token"]}
    )
    assert logout.status_code == 204

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401


def test_logout_requires_authentication(client: TestClient):
    assert client.post("/api/v1/auth/logout").status_code == 401


def test_account_locks_after_repeated_failed_logins(
    client: TestClient, db_session: Session, throwaway_user: User
):
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        assert _login(client, throwaway_user.email, "WrongPassword123!").status_code == 401

    # Even the correct password is refused while locked
    locked = _login(client, throwaway_user.email)
    assert locked.status_code == 423
    assert "locked" in locked.json()["detail"].lower()

    # Once the lock expires, the correct password works and the counters reset
    db_session.refresh(throwaway_user)
    throwaway_user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    assert _login(client, throwaway_user.email).status_code == 200
    db_session.refresh(throwaway_user)
    assert throwaway_user.failed_login_attempts == 0
    assert throwaway_user.locked_until is None


def test_successful_login_resets_failed_attempt_counter(
    client: TestClient, db_session: Session, throwaway_user: User
):
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS - 1):
        _login(client, throwaway_user.email, "WrongPassword123!")
    assert _login(client, throwaway_user.email).status_code == 200

    # A single further failure must not lock the account
    assert _login(client, throwaway_user.email, "WrongPassword123!").status_code == 401
    assert _login(client, throwaway_user.email).status_code == 200


def test_me_exposes_linked_employee_for_employee_account(
    client: TestClient, employee_headers: dict, admin_headers: dict
):
    me = client.get("/api/v1/auth/me", headers=employee_headers).json()
    assert me["employee_id"] is not None

    # HR demo accounts are not employees in the roster
    assert client.get("/api/v1/auth/me", headers=admin_headers).json()["employee_id"] is None
