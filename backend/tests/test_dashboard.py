"""
Tests for Notifications, Audit Logs, and Dashboard Metrics.
"""

from fastapi.testclient import TestClient


def test_dashboard_metrics(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_employees" in data
    assert "active_employees" in data
    assert "high_risk_employees_count" in data
    assert "department_distribution" in data
    assert "risk_distribution" in data
    assert "performance_trends" in data
    assert "top_skill_gaps" in data


def test_notifications_lifecycle(client: TestClient, admin_headers: dict):
    # Unread count
    count_resp = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert count_resp.status_code == 200
    assert "unread_count" in count_resp.json()

    # List notifications
    list_resp = client.get("/api/v1/notifications", headers=admin_headers)
    assert list_resp.status_code == 200
    assert isinstance(list_resp.json(), list)

    # Mark all read
    read_all_resp = client.post("/api/v1/notifications/mark-all-read", headers=admin_headers)
    assert read_all_resp.status_code == 200


def test_audit_logs_admin_access(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_audit_logs_employee_forbidden(client: TestClient, employee_headers: dict):
    response = client.get("/api/v1/audit-logs", headers=employee_headers)
    assert response.status_code == 403
