"""
Database session management, engine initialization, and dependencies.
"""

import logging
from collections.abc import Generator

from app.config.settings import settings
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)

# Create the SQLAlchemy engine using the normalized psycopg v3 connection URI
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Scoped session factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency injection to yield a database session per request
    and ensure clean closure post-execution.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_db_connection() -> bool:
    """
    Verifies connection to PostgreSQL database.
    Logs warning on failure to maintain local dev flexibility.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("PostgreSQL database connection check: SUCCESSFUL")
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(
            f"PostgreSQL database connection check: FAILED. "
            f"Please check your credentials in .env. Details: {e}"
        )
        return False
