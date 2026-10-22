"""
Automated tests for Retention Interventions and Longitudinal Follow-up Tracking:
- HR intervention creation linked to attrition-risk recommendations
- Milestone follow-up date scheduling (3 and 6 months)
- Documented employment retention outcomes (EMPLOYED / DEPARTED / PENDING)
- Role-based authorization and audit logging
"""

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import InterventionStatus, RetentionOutcome
from app.models import AuditLog, Employee, Recommendation, RetentionIntervention, User


def test_create_retention_intervention_by_hr(client: TestClient, admin_headers: dict, db_session: Session):
    """HR user can log a structured retention intervention with scheduled follow-up."""
    emp = db_session.scalars(select(Employee)).first()
    rec = db_session.scalars(
        select(Recommendation).where(Recommendation.employee_id == emp.id)
    ).first()
    assert emp is not None

    follow_up = (date.today() + timedelta(days=90)).isoformat()
    payload = {
        "employee_id": str(emp.id),
        "recommendation_id": str(rec.id) if rec else None,
        "concern_summary": "High risk of departure due to workload imbalance and compensation compression.",
        "intervention_type": "WORKLOAD_REVIEW",
        "status": "OFFERED",
        "follow_up_date": follow_up,
        "notes": "Scheduled 1-on-1 meeting with team lead and department head.",
    }

    resp = client.post("/api/v1/retention/interventions", headers=admin_headers, json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["employee_id"] == str(emp.id)
    assert data["concern_summary"] == payload["concern_summary"]
    assert data["intervention_type"] == "WORKLOAD_REVIEW"
    assert data["status"] == "OFFERED"
    assert data["retention_outcome"] == "PENDING"
    assert data["follow_up_date"] == follow_up


def test_employee_forbidden_from_retention_endpoints(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Regular employees cannot access or modify retention intervention records."""
    emp = db_session.scalars(select(Employee)).first()

    # Create forbidden
    create_resp = client.post(
        "/api/v1/retention/interventions",
        headers=employee_headers,
        json={
            "employee_id": str(emp.id),
            "concern_summary": "Test concern summary text",
            "intervention_type": "MENTORING",
        },
    )
    assert create_resp.status_code == 403

    # List forbidden
    list_resp = client.get("/api/v1/retention/interventions", headers=employee_headers)
    assert list_resp.status_code == 403


def test_list_and_filter_retention_interventions(client: TestClient, admin_headers: dict):
    """Interventions can be listed and filtered by status or outcome."""
    resp = client.get("/api/v1/retention/interventions", headers=admin_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)

    # Filter by status
    offered_resp = client.get("/api/v1/retention/interventions?status=OFFERED", headers=admin_headers)
    assert offered_resp.status_code == 200
    for item in offered_resp.json():
        assert item["status"] == "OFFERED"


def test_update_retention_intervention_and_document_outcome(
    client: TestClient, admin_headers: dict, db_session: Session
):
    """HR user can update intervention lifecycle and document factual employment retention outcome."""
    intervention = db_session.scalars(select(RetentionIntervention)).first()
    assert intervention is not None

    update_payload = {
        "status": "COMPLETED",
        "retention_outcome": "EMPLOYED",
        "outcome_notes": "Employee accepted role restructuring and remains happily employed at 3-month review.",
        "completed_date": date.today().isoformat(),
    }

    resp = client.put(
        f"/api/v1/retention/interventions/{intervention.id}",
        headers=admin_headers,
        json=update_payload,
    )
    assert resp.status_code == 200
    updated = resp.json()

    assert updated["status"] == "COMPLETED"
    assert updated["retention_outcome"] == "EMPLOYED"
    assert updated["outcome_notes"] == update_payload["outcome_notes"]
    assert updated["completed_date"] == update_payload["completed_date"]

    # Verify audit log entry
    audit_entry = db_session.scalars(
        select(AuditLog)
        .where(AuditLog.entity_id == intervention.id)
        .order_by(AuditLog.created_at.desc())
    ).first()
    assert audit_entry is not None
    assert audit_entry.action == "UPDATE_INTERVENTION"
