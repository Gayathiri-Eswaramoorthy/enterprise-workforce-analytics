"""
Pytest configuration and test client fixtures.

Tests run against a dedicated `workforce_analytics_test` database (never the
seeded dev database) so that running the suite can't soft-delete employees,
inject stray records, or otherwise pollute demo data. The test DB is created,
migrated, and seeded once per test session using the same seed data the dev
setup uses, so existing tests can keep asserting against the documented demo
accounts (admin@workforce.local, etc.) unchanged.
"""

import os
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)


def _test_database_url() -> str:
    override = os.environ.get("TEST_DATABASE_URL")
    if override:
        return override
    base_url = os.environ.get(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/workforce_analytics"
    )
    parts = urlsplit(base_url)
    return urlunsplit((parts.scheme, parts.netloc, "/workforce_analytics_test", "", ""))


# Must happen before any `app.*` import below: app.config.settings reads
# DATABASE_URL at import time and is memoized for the rest of the process.
_TEST_DB_URL = _test_database_url()
os.environ["DATABASE_URL"] = _TEST_DB_URL


def _ensure_test_database_ready() -> None:
    import psycopg
    from psycopg import sql

    parts = urlsplit(_TEST_DB_URL)
    test_db_name = parts.path.lstrip("/")
    maintenance_url = urlunsplit((parts.scheme, parts.netloc, "/postgres", "", ""))

    with psycopg.connect(maintenance_url.replace("postgresql+psycopg", "postgresql")) as conn:
        conn.autocommit = True
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (test_db_name,)
        ).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(test_db_name)))

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": _TEST_DB_URL},
        check=True,
    )


_ensure_test_database_ready()

from app.database import SessionLocal
from app.database.seed import seed_database
from app.main import app
from app.models import User
from app.security import create_access_token
from app.security.rate_limit import reset_login_rate_limiter

seed_database()


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    """Keep the per-IP login limiter from leaking attempts between tests."""
    reset_login_rate_limiter()
    yield


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
    manager = db_session.query(User).filter(User.username == "user").first()
    if not manager:
        pytest.skip("Manager user not found. Run seed script first.")
    token = create_access_token(subject=manager.id, email=manager.email, role=manager.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def employee_headers(db_session: Session):
    """Generates authorization headers for employee user."""
    emp_user = db_session.query(User).filter(User.username == "demo").first()
    if not emp_user:
        pytest.skip("Employee user not found. Run seed script first.")
    token = create_access_token(subject=emp_user.id, email=emp_user.email, role=emp_user.role.value)
    return {"Authorization": f"Bearer {token}"}
