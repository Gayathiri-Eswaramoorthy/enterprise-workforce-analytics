"""
Department service for organizational structure management.
"""

from uuid import UUID

from app.models import Department
from app.repositories.department_repository import DepartmentRepository
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class DepartmentService:
    def __init__(self):
        self.repository = DepartmentRepository()

    def get_department(self, db: Session, department_id: UUID) -> Department:
        dept = self.repository.get_by_id(db, department_id)
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )
        return dept

    def list_departments(self, db: Session, active_only: bool = False) -> list[DepartmentResponse]:
        results = self.repository.get_all_with_counts(db, active_only=active_only)
        responses = []
        for dept, emp_count, role_count in results:
            resp = DepartmentResponse.model_validate(dept)
            resp.employee_count = emp_count
            resp.job_roles_count = role_count
            responses.append(resp)
        return responses

    def create_department(self, db: Session, dept_in: DepartmentCreate) -> DepartmentResponse:
        if self.repository.get_by_code(db, dept_in.department_code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A department with this code already exists",
            )
        if self.repository.get_by_name(db, dept_in.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A department with this name already exists",
            )

        dept_data = dept_in.model_dump()
        dept_data["department_code"] = dept_data["department_code"].upper()
        dept = Department(**dept_data)
        dept = self.repository.create(db, dept)
        return DepartmentResponse.model_validate(dept)

    def update_department(
        self, db: Session, department_id: UUID, dept_in: DepartmentUpdate
    ) -> DepartmentResponse:
        dept = self.get_department(db, department_id)
        update_data = dept_in.model_dump(exclude_unset=True)

        if update_data.get("department_code"):
            update_data["department_code"] = update_data["department_code"].upper()
            existing = self.repository.get_by_code(db, update_data["department_code"])
            if existing and existing.id != department_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A department with this code already exists",
                )

        if update_data.get("name"):
            existing = self.repository.get_by_name(db, update_data["name"])
            if existing and existing.id != department_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A department with this name already exists",
                )

        dept = self.repository.update(db, dept, update_data)
        return DepartmentResponse.model_validate(dept)
