"""
Department repository for organization queries.
"""

from collections.abc import Sequence

from app.models import Department, Employee, JobRole
from app.repositories.base_repository import BaseRepository
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self):
        super().__init__(Department)

    def get_by_code(self, db: Session, code: str) -> Department | None:
        stmt = select(Department).where(Department.department_code == code.upper())
        return db.execute(stmt).scalar_one_or_none()

    def get_by_name(self, db: Session, name: str) -> Department | None:
        stmt = select(Department).where(Department.name.ilike(name))
        return db.execute(stmt).scalar_one_or_none()

    def get_all_with_counts(
        self, db: Session, active_only: bool = False
    ) -> Sequence[tuple[Department, int, int]]:
        stmt = select(Department).options(selectinload(Department.hr_manager))
        if active_only:
            stmt = stmt.where(Department.is_active == True)

        departments = db.execute(stmt).scalars().all()
        results = []
        for dept in departments:
            emp_count = (
                db.execute(
                    select(func.count(Employee.id)).where(
                        Employee.department_id == dept.id,
                        Employee.is_deleted == False,
                    )
                ).scalar()
                or 0
            )
            role_count = (
                db.execute(
                    select(func.count(JobRole.id)).where(
                        JobRole.department_id == dept.id,
                        JobRole.is_active == True,
                    )
                ).scalar()
                or 0
            )
            results.append((dept, emp_count, role_count))
        return results
