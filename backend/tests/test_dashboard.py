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


def test_individual_notification_read_persistence(
    client: TestClient, admin_headers: dict, db_session
):
    """Test marking a single notification as read persists and updates unread count."""
    from app.database import NotificationType
    from app.models import Notification, User
    from sqlalchemy import select

    admin_user = db_session.scalars(select(User).where(User.username == "admin")).first()
    assert admin_user is not None

    # Insert two test notifications for admin
    n1 = Notification(
        user_id=admin_user.id,
        title="Test Notification 1",
        message="Message 1 for testing read action",
        notification_type=NotificationType.ALERT,
        is_read=False,
    )
    n2 = Notification(
        user_id=admin_user.id,
        title="Test Notification 2",
        message="Message 2 for testing read action",
        notification_type=NotificationType.SYSTEM,
        is_read=False,
    )
    db_session.add_all([n1, n2])
    db_session.commit()
    db_session.refresh(n1)
    db_session.refresh(n2)

    # Check unread count before
    count_before = client.get("/api/v1/notifications/unread-count", headers=admin_headers).json()["unread_count"]
    assert count_before >= 2

    # Mark only n1 as read
    patch_resp = client.patch(f"/api/v1/notifications/{n1.id}/read", headers=admin_headers)
    assert patch_resp.status_code == 200
    patched_data = patch_resp.json()
    assert patched_data["id"] == str(n1.id)
    assert patched_data["is_read"] is True

    # Check unread count after: must have decremented by 1
    count_after = client.get("/api/v1/notifications/unread-count", headers=admin_headers).json()["unread_count"]
    assert count_after == count_before - 1

    # Verify n2 is still unread in DB
    db_session.refresh(n2)
    assert n2.is_read is False

    # Cleanup test notifications
    db_session.delete(n1)
    db_session.delete(n2)
    db_session.commit()


def test_audit_logs_admin_access(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_audit_logs_employee_forbidden(client: TestClient, employee_headers: dict):
    response = client.get("/api/v1/audit-logs", headers=employee_headers)
    assert response.status_code == 403
