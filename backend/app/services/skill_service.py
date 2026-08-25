"""
Skill service for skill catalog and employee skill mastery.
"""

from uuid import UUID

from app.models import Skill
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.skill_repository import SkillRepository
from app.schemas.skill import (
    EmployeeSkillCreate,
    EmployeeSkillResponse,
    EmployeeSkillUpdate,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class SkillService:
    def __init__(self):
        self.repository = SkillRepository()
        self.employee_repo = EmployeeRepository()

    def get_skill(self, db: Session, skill_id: UUID) -> Skill:
        skill = self.repository.get_by_id(db, skill_id)
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill not found",
            )
        return skill

    def list_skills(
        self,
        db: Session,
        category: str | None = None,
        search: str | None = None,
        active_only: bool = False,
    ) -> list[SkillResponse]:
        skills = self.repository.list_skills(
            db, category=category, search=search, active_only=active_only
        )
        return [SkillResponse.model_validate(s) for s in skills]

    def create_skill(self, db: Session, skill_in: SkillCreate) -> SkillResponse:
        if self.repository.get_by_code(db, skill_in.skill_code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A skill with this code already exists",
            )
        if self.repository.get_by_name(db, skill_in.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A skill with this name already exists",
            )

        skill_data = skill_in.model_dump()
        skill_data["skill_code"] = skill_data["skill_code"].upper()
        skill = Skill(**skill_data)
        skill = self.repository.create(db, skill)
        return SkillResponse.model_validate(skill)

    def update_skill(self, db: Session, skill_id: UUID, skill_in: SkillUpdate) -> SkillResponse:
        skill = self.get_skill(db, skill_id)
        update_data = skill_in.model_dump(exclude_unset=True)

        if update_data.get("skill_code"):
            update_data["skill_code"] = update_data["skill_code"].upper()
            existing = self.repository.get_by_code(db, update_data["skill_code"])
            if existing and existing.id != skill_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A skill with this code already exists",
                )

        if update_data.get("name"):
            existing = self.repository.get_by_name(db, update_data["name"])
            if existing and existing.id != skill_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A skill with this name already exists",
                )

        skill = self.repository.update(db, skill, update_data)
        return SkillResponse.model_validate(skill)

    # Employee Skills
    def assign_employee_skill(
        self, db: Session, employee_id: UUID, skill_in: EmployeeSkillCreate
    ) -> EmployeeSkillResponse:
        if not self.employee_repo.get_by_id(db, employee_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        self.get_skill(db, skill_in.skill_id)

        emp_skill = self.repository.assign_employee_skill(db, employee_id, skill_in.model_dump())
        return EmployeeSkillResponse.model_validate(emp_skill)

    def list_employee_skills(self, db: Session, employee_id: UUID) -> list[EmployeeSkillResponse]:
        skills = self.repository.list_employee_skills(db, employee_id)
        return [EmployeeSkillResponse.model_validate(s) for s in skills]

    def update_employee_skill(
        self,
        db: Session,
        employee_id: UUID,
        skill_id: UUID,
        skill_in: EmployeeSkillUpdate,
    ) -> EmployeeSkillResponse:
        emp_skill = self.repository.get_employee_skill(db, employee_id, skill_id)
        if not emp_skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee does not possess this skill record",
            )

        update_data = skill_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(emp_skill, k, v)
        db.commit()
        db.refresh(emp_skill)
        return EmployeeSkillResponse.model_validate(emp_skill)

    def remove_employee_skill(self, db: Session, employee_id: UUID, skill_id: UUID) -> bool:
        return self.repository.remove_employee_skill(db, employee_id, skill_id)
