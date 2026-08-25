"""
Tests for ML Prediction and Model Registry.
"""

from app.models import Employee
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_predict_single_employee(client: TestClient, admin_headers: dict, db_session: Session):
    emp = db_session.query(Employee).first()
    assert emp is not None

    response = client.post(
        f"/api/v1/predictions/predict/{emp.id}",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "prediction_score" in data
    assert "risk_level" in data
    assert "prediction_result" in data
    assert "contributing_factors" in data


def test_prediction_history(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/predictions/history", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_model_registry_list(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/predictions/models", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
