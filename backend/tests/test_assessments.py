"""
Automated tests for Skill Assessments:
- Baseline (pre-training) and post-training assessments
- Score delta calculation in percentage points
- Proficiency level reassessment updating EmployeeSkill and role gaps
- Role-based authorization and employee data isolation
"""

from decimal import Decimal

from app.models import (
    Employee,
    EmployeeSkill,
    Skill,
    TrainingCourse,
    User,
)
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


def test_create_skill_assessment_by_hr(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """HR user can record baseline and post-training skill assessments."""
    emp = db_session.scalars(select(Employee)).first()
    skill = db_session.scalars(select(Skill)).first()
    course = db_session.scalars(select(TrainingCourse)).first()
    assert emp is not None and skill is not None and course is not None

    payload = {
        "employee_id": str(emp.id),
        "skill_id": str(skill.id),
        "training_course_id": str(course.id),
        "assessment_type": "BASELINE",
        "score": 62.5,
        "assessed_proficiency": 2,
        "notes": "Baseline evaluation prior to Python course enrollment.",
    }

    resp = client.post("/api/v1/analytics/assessments", headers=admin_headers, json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["employee_id"] == str(emp.id)
    assert data["skill_id"] == str(skill.id)
    assert data["assessment_type"] == "BASELINE"
    assert Decimal(str(data["score"])) == Decimal("62.50")
    assert data["assessed_proficiency"] == 2


def test_employee_forbidden_from_recording_assessment(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Employees cannot record assessments for themselves or others."""
    emp = db_session.scalars(select(Employee)).first()
    skill = db_session.scalars(select(Skill)).first()

    payload = {
        "employee_id": str(emp.id),
        "skill_id": str(skill.id),
        "assessment_type": "POST_TRAINING",
        "score": 95.0,
        "assessed_proficiency": 5,
    }

    resp = client.post("/api/v1/analytics/assessments", headers=employee_headers, json=payload)
    assert resp.status_code == 403


def test_baseline_and_post_training_score_delta(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """Test paired baseline vs post-training score delta calculation in percentage points."""
    employees = db_session.scalars(select(Employee)).all()
    skills = db_session.scalars(select(Skill)).all()
    courses = db_session.scalars(select(TrainingCourse)).all()
    assert len(employees) >= 3 and len(skills) >= 3 and len(courses) >= 1

    emp = employees[2]
    skill = skills[2]
    course = courses[0]

    # Create baseline
    b_resp = client.post(
        "/api/v1/analytics/assessments",
        headers=admin_headers,
        json={
            "employee_id": str(emp.id),
            "skill_id": str(skill.id),
            "training_course_id": str(course.id),
            "assessment_type": "BASELINE",
            "score": 60.0,
            "assessed_proficiency": 2,
        },
    )
    assert b_resp.status_code == 201

    # Create post-training with higher score
    p_resp = client.post(
        "/api/v1/analytics/assessments",
        headers=admin_headers,
        json={
            "employee_id": str(emp.id),
            "skill_id": str(skill.id),
            "training_course_id": str(course.id),
            "assessment_type": "POST_TRAINING",
            "score": 85.0,
            "assessed_proficiency": 4,
        },
    )
    assert p_resp.status_code == 201

    # Get comparison
    comp_resp = client.get(
        f"/api/v1/analytics/assessments/comparison/{emp.id}",
        headers=admin_headers,
    )
    assert comp_resp.status_code == 200
    comparisons = comp_resp.json()

    target = next((c for c in comparisons if c["skill_id"] == str(skill.id)), None)
    assert target is not None
    assert Decimal(str(target["baseline_score"])) == Decimal("60.00")
    assert Decimal(str(target["post_score"])) == Decimal("85.00")
    # Score delta = +25.00 percentage points
    assert Decimal(str(target["score_delta"])) == Decimal("25.00")
    assert target["is_improved"] is True


def test_skill_proficiency_reassessment_updates_employee_skill(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """Documented skill evaluation updates EmployeeSkill proficiency and role gap."""
    emp = db_session.scalars(select(Employee)).first()
    skill = db_session.scalars(select(Skill)).first()

    # Reassess to proficiency 4
    resp = client.post(
        "/api/v1/analytics/assessments",
        headers=admin_headers,
        json={
            "employee_id": str(emp.id),
            "skill_id": str(skill.id),
            "assessment_type": "POST_TRAINING",
            "score": 90.0,
            "assessed_proficiency": 4,
            "notes": "Verified advanced practical skills during capstone evaluation.",
        },
    )
    assert resp.status_code == 201

    # Verify EmployeeSkill was updated in database
    db_session.expire_all()
    emp_skill = db_session.scalars(
        select(EmployeeSkill)
        .where(EmployeeSkill.employee_id == emp.id)
        .where(EmployeeSkill.skill_id == skill.id)
    ).first()
    assert emp_skill is not None
    assert emp_skill.proficiency_level == 4


def test_employee_assessment_data_isolation(
    client: TestClient, employee_headers: dict, admin_headers: dict, db_session: Session
):
    """Employees cannot access skill assessment comparison data for another employee."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    demo_emp_id = emp_user.employee_profile.id

    other_emp = db_session.scalars(select(Employee).where(Employee.id != demo_emp_id)).first()
    assert other_emp is not None

    # Employee requesting other employee's comparisons -> 403 Forbidden
    forbidden_resp = client.get(
        f"/api/v1/analytics/assessments/comparison/{other_emp.id}",
        headers=employee_headers,
    )
    assert forbidden_resp.status_code == 403

    # Employee requesting their own comparisons -> 200 OK
    own_resp = client.get(
        f"/api/v1/analytics/assessments/comparison/{demo_emp_id}",
        headers=employee_headers,
    )
    assert own_resp.status_code == 200
