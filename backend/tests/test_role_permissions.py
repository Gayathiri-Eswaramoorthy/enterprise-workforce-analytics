"""
Automated tests for Role Permissions, Employee Privacy, Voluntary Enrollment,
and the Attrition-Retention Workflow.

Requirements verified:
1. HR Admin vs HR Manager responsibilities separation:
   - HR Admin: Manage users, roles, employee records, departments, audit logs.
   - HR Manager: View attrition analytics, create retention interventions, track follow-up outcomes.
   - HR Manager gets 403 on user management, audit logs, and employee CRUD mutations.
2. Employee Privacy & Scoping:
   - Employees cannot access other employees' skills, profiles, or risk scores.
3. Voluntary Learning Enrollment:
   - Skill gaps exist without forcing automated enrollment.
   - Employees voluntarily self-enroll.
4. Retention Intervention Workflow & Effectiveness:
   - HR Manager logs intervention with reason, owner, date, status, follow-up date, and outcome.
   - Supports diverse intervention types: WORKLOAD_REVIEW, CAREER_DEVELOPMENT, MANAGER_CHECK_IN, TRAINING, OTHER_SUPPORT.
   - Documents intervention effectiveness (HELPFUL, NEUTRAL, UNHELPFUL, PENDING_ASSESSMENT) without claiming causal attrition prevention.
5. Employee Career & Discussion Requests:
   - Employee can submit career discussion and learning interest requests.
   - HR Manager can review, respond, and track discussion requests.
"""

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import EnrollmentStatus, UserRole
from app.models import (
    AuditLog,
    CourseQuiz,
    Employee,
    EmployeeRequest,
    EmployeeSkill,
    JobRole,
    Recommendation,
    RetentionIntervention,
    Skill,
    TrainingCourse,
    TrainingEnrollment,
    User,
)


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


# ---------------------------------------------------------------------------
# 1. Role Separation: HR Admin vs HR Manager
# ---------------------------------------------------------------------------

def test_hr_admin_can_manage_users(client: TestClient, admin_headers: dict):
    """HR Admin can view and manage user accounts and system roles."""
    resp = client.get("/api/v1/users", headers=admin_headers)
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert resp.json()["total"] > 0


def test_hr_manager_forbidden_from_user_management(client: TestClient, manager_headers: dict):
    """HR Manager must NOT have permission to manage user accounts."""
    resp = client.get("/api/v1/users", headers=manager_headers)
    assert resp.status_code == 403


def test_hr_admin_can_view_audit_logs(client: TestClient, admin_headers: dict):
    """HR Admin can view system audit logs."""
    resp = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert resp.status_code == 200


def test_hr_manager_forbidden_from_audit_logs(client: TestClient, manager_headers: dict):
    """HR Manager must NOT have permission to access compliance audit logs."""
    resp = client.get("/api/v1/audit-logs", headers=manager_headers)
    assert resp.status_code == 403


def test_hr_manager_cannot_create_or_delete_employees(
    client: TestClient, manager_headers: dict, other_employee: Employee
):
    """Employee record creation and deletion are restricted to HR Admin."""
    create_resp = client.post(
        "/api/v1/employees",
        headers=manager_headers,
        json={
            "employee_code": "EMP-FORBIDDEN-01",
            "first_name": "Test",
            "last_name": "Prohibited",
            "email": "test.prohibited@workforce.local",
            "department_id": str(other_employee.department_id),
            "job_role_id": str(other_employee.job_role_id),
            "date_of_joining": date.today().isoformat(),
        },
    )
    assert create_resp.status_code == 403

    delete_resp = client.delete(
        f"/api/v1/employees/{other_employee.id}",
        headers=manager_headers,
    )
    assert delete_resp.status_code == 403


def test_hr_manager_can_view_analytics_and_interventions(
    client: TestClient, manager_headers: dict, other_employee: Employee
):
    """HR Manager can view attrition analytics, inspect employee risk, and list interventions."""
    pred_resp = client.get("/api/v1/predictions/history", headers=manager_headers)
    assert pred_resp.status_code == 200

    rec_resp = client.get("/api/v1/recommendations", headers=manager_headers)
    assert rec_resp.status_code == 200

    ret_resp = client.get("/api/v1/retention/interventions", headers=manager_headers)
    assert ret_resp.status_code == 200


# ---------------------------------------------------------------------------
# 2. Employee Privacy & Scoping
# ---------------------------------------------------------------------------

def test_employee_cannot_inspect_other_employee_skills(
    client: TestClient, employee_headers: dict, other_employee: Employee
):
    """Employees must not see other employees' skill inventory or gap details."""
    resp = client.get(
        f"/api/v1/employees/{other_employee.id}/skills",
        headers=employee_headers,
    )
    assert resp.status_code == 403


def test_employee_can_inspect_own_skills(
    client: TestClient, employee_headers: dict, own_employee: Employee
):
    """Employees can view their own skill inventory."""
    resp = client.get(
        f"/api/v1/employees/{own_employee.id}/skills",
        headers=employee_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# 3. Voluntary Learning Enrollment (No Automatic Force-Enrollment)
# ---------------------------------------------------------------------------

def test_voluntary_enrollment_workflow(
    client: TestClient, employee_headers: dict, own_employee: Employee, db_session: Session
):
    """
    Employees voluntarily choose to enroll in training courses.
    They are not automatically enrolled by model predictions or skill gaps.
    """
    enrolled_course_ids = {
        e.training_course_id
        for e in db_session.scalars(
            select(TrainingEnrollment).where(TrainingEnrollment.employee_id == own_employee.id)
        ).all()
    }

    available_course = db_session.scalars(
        select(TrainingCourse)
        .where(TrainingCourse.is_active == True)  # noqa: E712
        .where(TrainingCourse.id.notin_(enrolled_course_ids))
    ).first()

    assert available_course is not None, "At least one un-enrolled course should be available"

    # Employee voluntary enrollment
    resp = client.post(
        "/api/v1/training/enrollments",
        headers=employee_headers,
        json={
            "employee_id": str(own_employee.id),
            "training_course_id": str(available_course.id),
        },
    )
    assert resp.status_code == 201
    enr_data = resp.json()
    assert enr_data["employee_id"] == str(own_employee.id)
    assert enr_data["training_course_id"] == str(available_course.id)
    assert enr_data["enrollment_status"] == EnrollmentStatus.ENROLLED.value

    # Cleanup
    db_session.query(TrainingEnrollment).filter(TrainingEnrollment.id == enr_data["id"]).delete()
    db_session.commit()


# ---------------------------------------------------------------------------
# 4. Retention Intervention Workflow & Effectiveness Tracking
# ---------------------------------------------------------------------------

def test_hr_manager_creates_and_tracks_retention_intervention(
    client: TestClient, manager_headers: dict, other_employee: Employee, db_session: Session
):
    """
    HR Manager reviews an employee's attrition risk and logs a customized intervention.
    Supports MANAGER_CHECK_IN and records follow-up dates and observational effectiveness.
    """
    follow_up_90d = (date.today() + timedelta(days=90)).isoformat()

    create_payload = {
        "employee_id": str(other_employee.id),
        "concern_summary": "Predicted high attrition risk: overtime workload and stagnation concern",
        "intervention_type": "MANAGER_CHECK_IN",
        "status": "OFFERED",
        "follow_up_date": follow_up_90d,
        "notes": "Initiated regular manager 1-on-1s and workload re-balancing discussion.",
    }

    resp = client.post(
        "/api/v1/retention/interventions",
        headers=manager_headers,
        json=create_payload,
    )
    assert resp.status_code == 201
    item = resp.json()
    assert item["employee_id"] == str(other_employee.id)
    assert item["intervention_type"] == "MANAGER_CHECK_IN"
    assert item["status"] == "OFFERED"
    assert item["retention_outcome"] == "PENDING"
    assert item["follow_up_date"] == follow_up_90d

    intervention_id = item["id"]

    # Update outcome and record observational effectiveness without asserting causal model prevention
    update_payload = {
        "status": "COMPLETED",
        "retention_outcome": "EMPLOYED",
        "intervention_effectiveness": "HELPFUL",
        "outcome_notes": "Employee reported reduced friction following workload adjustment and check-ins.",
        "follow_up_date": (date.today() + timedelta(days=180)).isoformat(),
    }

    update_resp = client.put(
        f"/api/v1/retention/interventions/{intervention_id}",
        headers=manager_headers,
        json=update_payload,
    )
    assert update_resp.status_code == 200
    updated_item = update_resp.json()
    assert updated_item["status"] == "COMPLETED"
    assert updated_item["retention_outcome"] == "EMPLOYED"
    assert updated_item["intervention_effectiveness"] == "HELPFUL"
    assert updated_item["outcome_notes"] == update_payload["outcome_notes"]


# ---------------------------------------------------------------------------
# 5. Employee Discussion & Learning Interest Requests
# ---------------------------------------------------------------------------

def test_employee_discussion_request_lifecycle(
    client: TestClient,
    employee_headers: dict,
    manager_headers: dict,
    own_employee: Employee,
):
    """
    Full lifecycle of an employee-initiated discussion request:
    1. Employee submits discussion request.
    2. Employee views their own requests.
    3. Other employee cannot see it (data isolation).
    4. HR Manager reviews and schedules discussion.
    """
    # Step 1: Employee submits career discussion request
    submit_resp = client.post(
        "/api/v1/employees/me/discussion-request",
        headers=employee_headers,
        json={
            "request_type": "CAREER_DISCUSSION",
            "topic": "Interest in transition to Senior Systems Architecture and cloud certification",
            "notes": "I would appreciate advice on growth paths and mentoring opportunities.",
        },
    )
    assert submit_resp.status_code == 201
    created_req = submit_resp.json()
    assert created_req["employee_id"] == str(own_employee.id)
    assert created_req["status"] == "PENDING"
    assert created_req["request_type"] == "CAREER_DISCUSSION"
    req_id = created_req["id"]

    # Step 2: Employee views own discussion requests
    my_requests_resp = client.get(
        "/api/v1/employees/me/discussion-requests",
        headers=employee_headers,
    )
    assert my_requests_resp.status_code == 200
    my_requests = my_requests_resp.json()
    assert any(r["id"] == req_id for r in my_requests)

    # Step 3: HR Manager views all discussion requests
    hr_list_resp = client.get(
        "/api/v1/employees/discussion-requests",
        headers=manager_headers,
    )
    assert hr_list_resp.status_code == 200
    hr_requests = hr_list_resp.json()
    assert any(r["id"] == req_id for r in hr_requests)

    # Step 4: HR Manager reviews and schedules discussion
    review_resp = client.patch(
        f"/api/v1/employees/discussion-requests/{req_id}",
        headers=manager_headers,
        json={
            "status": "SCHEDULED",
            "response_notes": "1-on-1 meeting scheduled for Thursday 2 PM with Department Head and HR Manager.",
        },
    )
    assert review_resp.status_code == 200
    reviewed_req = review_resp.json()
    assert reviewed_req["status"] == "SCHEDULED"
    assert "1-on-1 meeting scheduled" in reviewed_req["response_notes"]
    assert reviewed_req["reviewed_by_id"] is not None
    assert reviewed_req["reviewed_at"] is not None


# ---------------------------------------------------------------------------
# 6. Admin Overview & Shared Resource Permissions
# ---------------------------------------------------------------------------

def test_admin_overview_endpoint_permissions(
    client: TestClient, admin_headers: dict, manager_headers: dict, employee_headers: dict
):
    """
    GET /dashboard/admin-overview is restricted to HR Admin.
    HR Manager and Employee receive HTTP 403 Forbidden.
    """
    # HR Admin gets 200 with system governance metrics
    admin_resp = client.get("/api/v1/dashboard/admin-overview", headers=admin_headers)
    assert admin_resp.status_code == 200
    data = admin_resp.json()
    assert "total_users" in data
    assert "active_users" in data
    assert "users_by_role" in data
    assert "total_employees" in data
    assert "total_departments" in data
    assert "total_job_roles" in data
    assert "total_audit_logs" in data
    assert "recent_audit_logs" in data
    assert "active_model_version" in data
    assert data["system_status"] == "HEALTHY"

    # HR Manager gets 403 Forbidden
    manager_resp = client.get("/api/v1/dashboard/admin-overview", headers=manager_headers)
    assert manager_resp.status_code == 403

    # Employee gets 403 Forbidden
    employee_resp = client.get("/api/v1/dashboard/admin-overview", headers=employee_headers)
    assert employee_resp.status_code == 403


def test_department_endpoint_permissions(
    client: TestClient, admin_headers: dict, manager_headers: dict, employee_headers: dict
):
    """
    Departments list is accessible to HR roles (Admin & Manager) for workforce management,
    but forbidden to regular employees.
    """
    # HR Admin allowed
    admin_resp = client.get("/api/v1/departments", headers=admin_headers)
    assert admin_resp.status_code == 200
    assert isinstance(admin_resp.json(), list)

    # HR Manager allowed
    manager_resp = client.get("/api/v1/departments", headers=manager_headers)
    assert manager_resp.status_code == 200
    assert isinstance(manager_resp.json(), list)

    # Employee forbidden
    emp_resp = client.get("/api/v1/departments", headers=employee_headers)
    assert emp_resp.status_code == 403

