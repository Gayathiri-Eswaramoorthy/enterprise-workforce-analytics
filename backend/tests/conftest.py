"""
Pytest configuration and test client fixtures.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.main import app
from app.models import User
from app.security import create_access_token


@pytest.fixture(scope="session")
def db_session():
    """Provides a database session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_headers(db_session: Session):
    """Generates authorization headers for admin user."""
    admin = db_session.query(User).filter(User.username == "admin").first()
    if not admin:
        pytest.skip("Admin user not found. Run seed script first.")
    token = create_access_token(subject=admin.id, email=admin.email, role=admin.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def manager_headers(db_session: Session):
    """Generates authorization headers for manager user."""
    manager = db_session.query(User).filter(User.username == "hrmanager").first()
    if not manager:
        pytest.skip("Manager user not found. Run seed script first.")
    token = create_access_token(subject=manager.id, email=manager.email, role=manager.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def employee_headers(db_session: Session):
    """Generates authorization headers for employee user."""
    emp_user = db_session.query(User).filter(User.username == "employee").first()
    if not emp_user:
        pytest.skip("Employee user not found. Run seed script first.")
    token = create_access_token(subject=emp_user.id, email=emp_user.email, role=emp_user.role.value)
    return {"Authorization": f"Bearer {token}"}
