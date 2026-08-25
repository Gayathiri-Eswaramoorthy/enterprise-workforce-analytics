"""
Tests for Employee CRUD, filtering, and skill assignments.
"""

from app.models import Department, JobRole
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_list_employees(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/employees", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 5


def test_create_and_get_employee(client: TestClient, admin_headers: dict, db_session: Session):
    import uuid

    dept = db_session.query(Department).first()
    role = db_session.query(JobRole).first()

    unique_code = f"TEST-EMP-{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "employee_code": unique_code,
        "first_name": "Test",
        "last_name": "User",
        "date_of_birth": "1992-05-10",
        "gender": "OTHER",
        "phone_number": "+1-555-9999",
        "official_email": f"{unique_code.lower()}@workforce.local",
        "department_id": str(dept.id),
        "job_role_id": str(role.id),
        "date_of_joining": "2024-01-01",
        "employment_status": "ACTIVE",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "work_location": "Remote HQ",
    }

    # Create
    create_resp = client.post("/api/v1/employees", json=payload, headers=admin_headers)
    assert create_resp.status_code == 201
    created_emp = create_resp.json()
    emp_id = created_emp["id"]
    assert created_emp["employee_code"] == unique_code

    # Get
    get_resp = client.get(f"/api/v1/employees/{emp_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["full_name"] == "Test User"

    # Soft Delete
    del_resp = client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)
    assert del_resp.status_code == 204


def test_employee_creation_duplicate_code(
    client: TestClient, admin_headers: dict, db_session: Session
):
    dept = db_session.query(Department).first()
    role = db_session.query(JobRole).first()

    payload = {
        "employee_code": "EMP-ENG-001",  # Existing code from seed
        "first_name": "Duplicate",
        "last_name": "Employee",
        "date_of_birth": "1990-01-01",
        "gender": "MALE",
        "phone_number": "+1-555-0000",
        "official_email": "duplicate.code@workforce.local",
        "department_id": str(dept.id),
        "job_role_id": str(role.id),
        "date_of_joining": "2024-01-01",
        "employment_status": "ACTIVE",
        "employment_type": "FULL_TIME",
        "work_mode": "OFFICE",
        "work_location": "San Francisco, CA",
    }
    resp = client.post("/api/v1/employees", json=payload, headers=admin_headers)
    assert resp.status_code == 409
