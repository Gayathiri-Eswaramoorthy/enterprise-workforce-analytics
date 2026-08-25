"""
Tests for Skill Gap Intelligence Engine.
"""

from app.models import Employee
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_employee_skill_gap_calculation(
    client: TestClient, admin_headers: dict, db_session: Session
):
    emp = db_session.query(Employee).filter(Employee.employee_code == "EMP-ENG-005").first()
    assert emp is not None

    response = client.get(
        f"/api/v1/analytics/skill-gaps/employee/{emp.id}",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["employee_code"] == "EMP-ENG-005"
    assert "gaps" in data
    assert len(data["gaps"]) > 0
    assert "overall_skill_match_percentage" in data


def test_organization_top_skill_gaps(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/analytics/skill-gaps/top", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        assert "skill_name" in data[0]
        assert "affected_employees_count" in data[0]
