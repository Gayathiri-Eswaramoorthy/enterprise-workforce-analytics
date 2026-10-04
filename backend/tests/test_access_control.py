"""
Tests for role-based data scoping: employees can only reach their own records, and
organization-wide HR data (risk scores, rosters, recommendations) stays HR-only.
"""

import pytest
from app.database import EnrollmentStatus, NotificationType
from app.models import Employee, Notification, TrainingCourse, TrainingEnrollment, User
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture(scope="module")
def own_employee(db_session: Session) -> Employee:
    demo_user = db_session.query(User).filter(User.username == "demo").one()
    return db_session.query(Employee).filter(Employee.user_id == demo_user.id).one()


@pytest.fixture(scope="module")
def other_employee(db_session: Session, own_employee: Employee) -> Employee:
    return (
        db_session.query(Employee)
        .filter(Employee.id != own_employee.id, Employee.is_deleted == False)  # noqa: E712
        .first()
    )


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/dashboard/summary",
        "/api/v1/employees",
        "/api/v1/predictions/history",
        "/api/v1/predictions/models",
        "/api/v1/recommendations",
        "/api/v1/analytics/skill-gaps/top",
    ],
)
def test_employee_cannot_read_org_wide_hr_data(
    client: TestClient, employee_headers: dict, path: str
):
    assert client.get(path, headers=employee_headers).status_code == 403


def test_employee_cannot_trigger_hr_actions(
    client: TestClient, employee_headers: dict, own_employee: Employee
):
    assert (
        client.post("/api/v1/predictions/predict-all", headers=employee_headers).status_code == 403
    )
    assert (
        client.post("/api/v1/recommendations/generate-all", headers=employee_headers).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/predictions/predict/{own_employee.id}", headers=employee_headers
        ).status_code
        == 403
    )


def test_employee_can_read_own_profile(
    client: TestClient, employee_headers: dict, own_employee: Employee
):
    me = client.get("/api/v1/employees/me", headers=employee_headers)
    assert me.status_code == 200
    assert me.json()["id"] == str(own_employee.id)

    for path in [
        f"/api/v1/employees/{own_employee.id}",
        f"/api/v1/analytics/skill-gaps/employee/{own_employee.id}",
        f"/api/v1/performance/employee/{own_employee.id}/summary",
    ]:
        assert client.get(path, headers=employee_headers).status_code == 200, path


def test_employee_cannot_read_other_employee(
    client: TestClient, employee_headers: dict, other_employee: Employee
):
    for path in [
        f"/api/v1/employees/{other_employee.id}",
        f"/api/v1/analytics/skill-gaps/employee/{other_employee.id}",
        f"/api/v1/performance/employee/{other_employee.id}/summary",
    ]:
        assert client.get(path, headers=employee_headers).status_code == 403, path

    params = {"employee_id": str(other_employee.id)}
    for path in ["/api/v1/performance", "/api/v1/training/enrollments"]:
        assert client.get(path, headers=employee_headers, params=params).status_code == 403


def test_employee_list_endpoints_are_scoped_to_self(
    client: TestClient, employee_headers: dict, own_employee: Employee
):
    for path in ["/api/v1/performance", "/api/v1/training/enrollments"]:
        resp = client.get(path, headers=employee_headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert items, f"expected seeded rows for {path}"
        assert {i["employee_id"] for i in items} == {str(own_employee.id)}


def test_hr_can_still_read_any_employee(
    client: TestClient, manager_headers: dict, other_employee: Employee
):
    assert (
        client.get(f"/api/v1/employees/{other_employee.id}", headers=manager_headers).status_code
        == 200
    )
    assert client.get("/api/v1/employees/me", headers=manager_headers).status_code == 404


def test_employee_self_service_enrollment(
    client: TestClient,
    employee_headers: dict,
    db_session: Session,
    own_employee: Employee,
    other_employee: Employee,
):
    enrolled_ids = {
        e.training_course_id
        for e in db_session.query(TrainingEnrollment).filter(
            TrainingEnrollment.employee_id == own_employee.id
        )
    }
    course = db_session.query(TrainingCourse).filter(TrainingCourse.id.notin_(enrolled_ids)).first()

    # Cannot enroll a colleague
    other = client.post(
        "/api/v1/training/enrollments",
        headers=employee_headers,
        json={"employee_id": str(other_employee.id), "training_course_id": str(course.id)},
    )
    assert other.status_code == 403

    # Can enroll self; status is forced to ENROLLED even if something else is requested
    resp = client.post(
        "/api/v1/training/enrollments",
        headers=employee_headers,
        json={
            "employee_id": str(own_employee.id),
            "training_course_id": str(course.id),
            "enrollment_status": "COMPLETED",
        },
    )
    assert resp.status_code == 201
    enrollment = resp.json()
    assert enrollment["enrollment_status"] == "ENROLLED"
    url = f"/api/v1/training/enrollments/{enrollment['id']}"

    try:
        # Starting and rating a course is allowed
        started = client.put(
            url,
            headers=employee_headers,
            json={"enrollment_status": "IN_PROGRESS", "feedback_rating": 4},
        )
        assert started.status_code == 200
        assert started.json()["enrollment_status"] == "IN_PROGRESS"

        # Self-certifying completion or scores is not
        for body in [
            {"enrollment_status": "COMPLETED"},
            {"completion_score": 100},
            {"certificate_issued": True},
        ]:
            assert client.put(url, headers=employee_headers, json=body).status_code == 403, body

        # Dropping, then re-enrolling, reactivates the same enrollment
        dropped = client.put(url, headers=employee_headers, json={"enrollment_status": "DROPPED"})
        assert dropped.json()["enrollment_status"] == "DROPPED"
        again = client.post(
            "/api/v1/training/enrollments",
            headers=employee_headers,
            json={"employee_id": str(own_employee.id), "training_course_id": str(course.id)},
        )
        assert again.status_code == 201
        assert again.json()["id"] == enrollment["id"]
        assert again.json()["enrollment_status"] == EnrollmentStatus.ENROLLED.value
    finally:
        db_session.query(TrainingEnrollment).filter(
            TrainingEnrollment.id == enrollment["id"]
        ).delete()
        db_session.commit()


def test_employee_cannot_update_colleague_enrollment(
    client: TestClient, employee_headers: dict, db_session: Session, own_employee: Employee
):
    enrollment = (
        db_session.query(TrainingEnrollment)
        .filter(TrainingEnrollment.employee_id != own_employee.id)
        .first()
    )
    resp = client.put(
        f"/api/v1/training/enrollments/{enrollment.id}",
        headers=employee_headers,
        json={"enrollment_status": "DROPPED"},
    )
    assert resp.status_code == 403


def test_risk_alerts_only_reach_hr(db_session: Session):
    """Seeding runs predictions; HIGH/CRITICAL alerts must not go to EMPLOYEE accounts."""
    demo_user = db_session.query(User).filter(User.username == "demo").one()
    admin_user = db_session.query(User).filter(User.username == "admin").one()

    def alert_count(user: User) -> int:
        return (
            db_session.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.notification_type == NotificationType.ALERT,
            )
            .count()
        )

    assert alert_count(admin_user) > 0
    assert alert_count(demo_user) == 0
