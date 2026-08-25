"""
Tests for Recommendations Engine.
"""

from app.models import Employee
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_generate_and_list_recommendations(
    client: TestClient, admin_headers: dict, db_session: Session
):
    emp = db_session.query(Employee).filter(Employee.is_deleted == False).first()
    assert emp is not None

    # Generate recommendations for employee
    gen_resp = client.post(
        f"/api/v1/recommendations/generate/{emp.id}",
        headers=admin_headers,
    )
    assert gen_resp.status_code == 200
    recs = gen_resp.json()
    assert isinstance(recs, list)

    # List all recommendations
    list_resp = client.get("/api/v1/recommendations", headers=admin_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert "items" in data
    assert "total" in data


def test_update_recommendation_status(client: TestClient, admin_headers: dict, db_session: Session):
    emp = db_session.query(Employee).first()
    client.post(f"/api/v1/recommendations/generate/{emp.id}", headers=admin_headers)

    list_resp = client.get("/api/v1/recommendations", headers=admin_headers)
    items = list_resp.json()["items"]
    if items:
        rec_id = items[0]["id"]
        patch_resp = client.patch(
            f"/api/v1/recommendations/{rec_id}/status",
            json={"status": "ACCEPTED"},
            headers=admin_headers,
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["status"] == "ACCEPTED"
