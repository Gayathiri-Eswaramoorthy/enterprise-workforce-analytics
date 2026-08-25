"""
JobRole repository for roles and required skills mapping.
"""

from collections.abc import Sequence
from uuid import UUID

from app.models import JobRole, RoleSkill
from app.repositories.base_repository import BaseRepository
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload


class JobRoleRepository(BaseRepository[JobRole]):
    def __init__(self):
        super().__init__(JobRole)

    def get_by_id_with_skills(self, db: Session, job_role_id: UUID) -> JobRole | None:
        stmt = (
            select(JobRole)
            .where(JobRole.id == job_role_id)
            .options(
                selectinload(JobRole.department),
                selectinload(JobRole.role_skills).selectinload(RoleSkill.skill),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_by_department(
        self, db: Session, department_id: UUID | None = None, active_only: bool = False
    ) -> Sequence[JobRole]:
        stmt = select(JobRole).options(
            selectinload(JobRole.department),
            selectinload(JobRole.role_skills).selectinload(RoleSkill.skill),
        )
        if department_id:
            stmt = stmt.where(JobRole.department_id == department_id)
        if active_only:
            stmt = stmt.where(JobRole.is_active == True)
        return db.execute(stmt).scalars().all()

    def set_role_skills(
        self, db: Session, job_role_id: UUID, skill_requirements: list[dict]
    ) -> list[RoleSkill]:
        # Remove existing requirements
        db.execute(delete(RoleSkill).where(RoleSkill.job_role_id == job_role_id))
        db.flush()

        role_skills = []
        for req in skill_requirements:
            rs = RoleSkill(
                job_role_id=job_role_id,
                skill_id=req["skill_id"],
                required_proficiency=req["required_proficiency"],
                mandatory=req.get("mandatory", True),
            )
            db.add(rs)
            role_skills.append(rs)

        db.commit()
        return role_skills
