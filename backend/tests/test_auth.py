"""
Tests for Authentication & Security Endpoints.
"""

from fastapi.testclient import TestClient


def test_login_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@workforce.local", "password": "Password123!"},
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
        json={"email": "admin@workforce.local", "password": "Password123!"},
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
