import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create the SQLAlchemy Engine
# pool_pre_ping checks database connection validity on each checkout
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True, pool_recycle=3600
)

# Session factory for handling requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base model
Base = declarative_base()


def get_db():
    """
    FastAPI dependency injection to yield database session per request
    and close it after completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_db_connection() -> bool:
    """
    Verifies connection to PostgreSQL database. Logs warning on failure
    instead of crashing the application to ensure local development flexibility.
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
