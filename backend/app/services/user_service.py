"""
User service for account management and admin operations.
"""

from uuid import UUID

from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.security import hash_password
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class UserService:
    def __init__(self):
        self.repository = UserRepository()

    def get_user(self, db: Session, user_id: UUID) -> User:
        user = self.repository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user

    def list_users(
        self, db: Session, page: int = 1, page_size: int = 50
    ) -> tuple[list[UserResponse], int]:
        skip = (page - 1) * page_size
        users, total = self.repository.list_users(db, skip=skip, limit=page_size)
        return [UserResponse.model_validate(u) for u in users], total

    def create_user(self, db: Session, user_in: UserCreate) -> UserResponse:
        # Check uniqueness
        if self.repository.get_by_email(db, user_in.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )
        if self.repository.get_by_username(db, user_in.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username already exists",
            )

        user_data = user_in.model_dump(exclude={"password"})
        user_data["password_hash"] = hash_password(user_in.password)

        user = User(**user_data)
        user = self.repository.create(db, user)
        return UserResponse.model_validate(user)

    def update_user(self, db: Session, user_id: UUID, user_in: UserUpdate) -> UserResponse:
        user = self.get_user(db, user_id)
        update_data = user_in.model_dump(exclude_unset=True)

        if update_data.get("email"):
            existing = self.repository.get_by_email(db, update_data["email"])
            if existing and existing.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this email already exists",
                )

        if update_data.get("username"):
            existing = self.repository.get_by_username(db, update_data["username"])
            if existing and existing.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this username already exists",
                )

        if update_data.get("password"):
            update_data["password_hash"] = hash_password(update_data.pop("password"))
        elif "password" in update_data:
            update_data.pop("password")

        user = self.repository.update(db, user, update_data)
        return UserResponse.model_validate(user)
