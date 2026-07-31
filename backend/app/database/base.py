"""
Declarative base for SQLAlchemy models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.x Declarative Base class.
    All database models should inherit from this base class (via BaseModel).
    """
