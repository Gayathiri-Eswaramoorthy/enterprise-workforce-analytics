"""
JobRole service for role hierarchies and skill requirement definitions.
"""

from uuid import UUID

from app.models import JobRole
from app.repositories.department_repository import DepartmentRepository
from app.repositories.job_role_repository import JobRoleRepository
from app.repositories.skill_repository import SkillRepository
from app.schemas.job_role import (
    JobRoleCreate,
    JobRoleResponse,
    JobRoleUpdate,
    RoleSkillRequirement,
    RoleSkillResponse,
)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class JobRoleService:
    def __init__(self):
        self.repository = JobRoleRepository()
        self.dept_repo = DepartmentRepository()
        self.skill_repo = SkillRepository()

    def get_job_role(self, db: Session, job_role_id: UUID) -> JobRole:
        role = self.repository.get_by_id_with_skills(db, job_role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job role not found",
            )
        return role

    def get_job_role_response(self, db: Session, job_role_id: UUID) -> JobRoleResponse:
        role = self.get_job_role(db, job_role_id)
        resp = JobRoleResponse.model_validate(role)
        if role.department:
            resp.department_name = role.department.name
            resp.department_code = role.department.department_code
        role_skills_resp = []
        for rs in role.role_skills:
            rs_resp = RoleSkillResponse.model_validate(rs)
            if rs.skill:
                rs_resp.skill_name = rs.skill.name
                rs_resp.skill_code = rs.skill.skill_code
                rs_resp.skill_category = rs.skill.skill_category
            role_skills_resp.append(rs_resp)
        resp.role_skills = role_skills_resp
        return resp

    def list_job_roles(
        self, db: Session, department_id: UUID | None = None, active_only: bool = False
    ) -> list[JobRoleResponse]:
        roles = self.repository.list_by_department(
            db, department_id=department_id, active_only=active_only
        )
        responses = []
        for role in roles:
            resp = JobRoleResponse.model_validate(role)
            if role.department:
                resp.department_name = role.department.name
                resp.department_code = role.department.department_code
            role_skills_resp = []
            for rs in role.role_skills:
                rs_resp = RoleSkillResponse.model_validate(rs)
                if rs.skill:
                    rs_resp.skill_name = rs.skill.name
                    rs_resp.skill_code = rs.skill.skill_code
                    rs_resp.skill_category = rs.skill.skill_category
                role_skills_resp.append(rs_resp)
            resp.role_skills = role_skills_resp
            responses.append(resp)
        return responses

    def create_job_role(self, db: Session, role_in: JobRoleCreate) -> JobRoleResponse:
        # Validate department
        if not self.dept_repo.get_by_id(db, role_in.department_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced Department does not exist",
            )

        role_data = role_in.model_dump(exclude={"required_skills"})
        role = JobRole(**role_data)
        role = self.repository.create(db, role)

        # Assign required skills
        if role_in.required_skills:
            skills_payload = [req.model_dump() for req in role_in.required_skills]
            self.repository.set_role_skills(db, role.id, skills_payload)

        return self.get_job_role_response(db, role.id)

    def update_job_role(
        self, db: Session, job_role_id: UUID, role_in: JobRoleUpdate
    ) -> JobRoleResponse:
        role = self.get_job_role(db, job_role_id)
        update_data = role_in.model_dump(exclude_unset=True)

        if update_data.get("department_id"):
            if not self.dept_repo.get_by_id(db, update_data["department_id"]):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Referenced Department does not exist",
                )

        role = self.repository.update(db, role, update_data)
        return self.get_job_role_response(db, role.id)

    def set_role_skills(
        self,
        db: Session,
        job_role_id: UUID,
        requirements: list[RoleSkillRequirement],
    ) -> JobRoleResponse:
        role = self.get_job_role(db, job_role_id)
        # Validate all skill IDs
        for req in requirements:
            if not self.skill_repo.get_by_id(db, req.skill_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Skill with ID {req.skill_id} not found",
                )

        skills_payload = [req.model_dump() for req in requirements]
        self.repository.set_role_skills(db, role.id, skills_payload)
        return self.get_job_role_response(db, role.id)
