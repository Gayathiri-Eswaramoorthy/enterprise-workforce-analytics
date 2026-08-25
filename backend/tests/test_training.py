"""
Tests for Training Courses and Enrollments.
"""

from fastapi.testclient import TestClient


def test_list_training_courses(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/training/courses", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    assert "course_code" in data[0]
    assert "duration_hours" in data[0]


def test_list_training_enrollments(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/training/enrollments", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_create_course(client: TestClient, admin_headers: dict):
    import uuid

    code = f"TR-TEST-{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "course_code": code,
        "title": "Automated Testing for Systems",
        "description": "Integration and unit testing best practices.",
        "provider": "Internal Academy",
        "duration_hours": 12.0,
        "difficulty_level": "BEGINNER",
        "training_mode": "ONLINE",
        "is_active": True,
        "target_skill_ids": [],
    }
    response = client.post("/api/v1/training/courses", json=payload, headers=admin_headers)
    assert response.status_code == 201
    assert response.json()["course_code"] == code
