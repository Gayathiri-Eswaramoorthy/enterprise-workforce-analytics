"""
Tests for ML Prediction and Model Registry.
"""

import pytest
from app.database import NotificationType, RiskLevel
from app.models import Employee, Notification, PredictionHistory
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ml.predict import load_model_artifact


def test_predict_single_employee(client: TestClient, admin_headers: dict, db_session: Session):
    emp = db_session.query(Employee).filter(Employee.is_deleted == False).first()
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


def test_active_model_matches_trained_artifact(client: TestClient, admin_headers: dict):
    """The registry must report the real artifact's metrics, not placeholder values."""
    _, metadata = load_model_artifact()
    if metadata is None:
        pytest.skip("No trained model artifact present")

    models = client.get("/api/v1/predictions/models", headers=admin_headers).json()
    active = [m for m in models if m["is_active"]]
    assert len(active) == 1
    active = active[0]
    assert active["model_version"] == metadata["version"]
    assert active["algorithm"] == metadata["algorithm"]
    expected_accuracy = round(metadata["final_test_metrics"]["accuracy"] * 100, 2)
    assert float(active["accuracy"]) == pytest.approx(expected_accuracy)


def test_prediction_reports_model_identity_and_confidence(
    client: TestClient, admin_headers: dict, db_session: Session
):
    emp = db_session.query(Employee).filter(Employee.is_deleted == False).first()
    data = client.post(f"/api/v1/predictions/predict/{emp.id}", headers=admin_headers).json()

    _, metadata = load_model_artifact()
    if metadata:
        assert data["model_version"] == metadata["version"]
        assert data["algorithm"] == metadata["algorithm"]
    # Confidence is the probability of the predicted class, so never below a coin flip
    assert 0.5 <= data["confidence_score"] <= 1.0


def test_repeat_prediction_does_not_re_alert(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """Re-scoring an employee already flagged HIGH/CRITICAL must not spam HR inboxes."""
    flagged = (
        db_session.query(PredictionHistory)
        .filter(PredictionHistory.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]))
        .first()
    )
    if flagged is None:
        pytest.skip("No high-risk employee in seed data")

    def alerts() -> int:
        db_session.expire_all()
        return (
            db_session.query(Notification)
            .filter(Notification.notification_type == NotificationType.ALERT)
            .count()
        )

    before = alerts()
    resp = client.post(f"/api/v1/predictions/predict/{flagged.employee_id}", headers=admin_headers)
    assert resp.json()["risk_level"] in ("HIGH", "CRITICAL")
    assert alerts() == before
