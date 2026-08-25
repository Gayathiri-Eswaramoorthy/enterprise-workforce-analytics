"""
Skill and EmployeeSkill repository for skill tracking.
"""

from collections.abc import Sequence
from uuid import UUID

from app.models import EmployeeSkill, Skill
from app.repositories.base_repository import BaseRepository
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload


class SkillRepository(BaseRepository[Skill]):
    def __init__(self):
        super().__init__(Skill)

    def get_by_code(self, db: Session, code: str) -> Skill | None:
        stmt = select(Skill).where(Skill.skill_code == code.upper())
        return db.execute(stmt).scalar_one_or_none()

    def get_by_name(self, db: Session, name: str) -> Skill | None:
        stmt = select(Skill).where(Skill.name.ilike(name))
        return db.execute(stmt).scalar_one_or_none()

    def list_skills(
        self,
        db: Session,
        category: str | None = None,
        search: str | None = None,
        active_only: bool = False,
    ) -> Sequence[Skill]:
        stmt = select(Skill)
        if active_only:
            stmt = stmt.where(Skill.is_active == True)
        if category:
            stmt = stmt.where(Skill.skill_category.ilike(category))
        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.where((Skill.name.ilike(pattern)) | (Skill.skill_code.ilike(pattern)))

        stmt = stmt.order_by(Skill.display_order.asc(), Skill.name.asc())
        return db.execute(stmt).scalars().all()

    # Employee Skill associations
    def get_employee_skill(
        self, db: Session, employee_id: UUID, skill_id: UUID
    ) -> EmployeeSkill | None:
        stmt = select(EmployeeSkill).where(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == skill_id,
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_employee_skills(self, db: Session, employee_id: UUID) -> Sequence[EmployeeSkill]:
        stmt = (
            select(EmployeeSkill)
            .where(EmployeeSkill.employee_id == employee_id)
            .options(selectinload(EmployeeSkill.skill))
        )
        return db.execute(stmt).scalars().all()

    def assign_employee_skill(
        self, db: Session, employee_id: UUID, skill_data: dict
    ) -> EmployeeSkill:
        emp_skill = self.get_employee_skill(db, employee_id, skill_data["skill_id"])
        if emp_skill:
            for k, v in skill_data.items():
                setattr(emp_skill, k, v)
        else:
            emp_skill = EmployeeSkill(employee_id=employee_id, **skill_data)
            db.add(emp_skill)
        db.commit()
        db.refresh(emp_skill)
        return emp_skill

    def remove_employee_skill(self, db: Session, employee_id: UUID, skill_id: UUID) -> bool:
        stmt = delete(EmployeeSkill).where(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == skill_id,
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount > 0
