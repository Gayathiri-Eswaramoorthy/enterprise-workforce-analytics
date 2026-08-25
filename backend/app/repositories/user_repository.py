"""
User repository for system accounts and admin lookups.
"""

from collections.abc import Sequence

from app.models import User
from app.repositories.base_repository import BaseRepository
from sqlalchemy import func, select
from sqlalchemy.orm import Session


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    def get_by_email(self, db: Session, email: str) -> User | None:
        stmt = select(User).where(User.email == email.strip().lower())
        return db.execute(stmt).scalar_one_or_none()

    def get_by_username(self, db: Session, username: str) -> User | None:
        stmt = select(User).where(User.username == username.strip())
        return db.execute(stmt).scalar_one_or_none()

    def list_users(self, db: Session, skip: int = 0, limit: int = 50) -> tuple[Sequence[User], int]:
        count_stmt = select(func.count()).select_from(User)
        total = db.execute(count_stmt).scalar() or 0

        stmt = select(User).order_by(User.username.asc()).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total
