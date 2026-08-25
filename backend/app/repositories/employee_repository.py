"""
Employee repository providing specialized queries for filtering, pagination, and relations.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from app.database import EmploymentStatus, WorkMode
from app.models import (
    Employee,
    EmployeeSkill,
    JobRole,
    RoleSkill,
)
from app.repositories.base_repository import BaseRepository
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload


class EmployeeRepository(BaseRepository[Employee]):
    def __init__(self):
        super().__init__(Employee)

    def get_by_id_with_relations(self, db: Session, employee_id: UUID) -> Employee | None:
        stmt = (
            select(Employee)
            .where(Employee.id == employee_id, Employee.is_deleted == False)
            .options(
                selectinload(Employee.department),
                selectinload(Employee.job_role)
                .selectinload(JobRole.role_skills)
                .selectinload(RoleSkill.skill),
                selectinload(Employee.manager),
                selectinload(Employee.subordinates),
                selectinload(Employee.employee_skills).selectinload(EmployeeSkill.skill),
                selectinload(Employee.performance_reviews),
                selectinload(Employee.training_enrollments),
                selectinload(Employee.prediction_history),
                selectinload(Employee.recommendations),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, db: Session, employee_code: str) -> Employee | None:
        stmt = select(Employee).where(
            Employee.employee_code == employee_code,
            Employee.is_deleted == False,
        )
        return db.execute(stmt).scalar_one_or_none()

    def get_by_email(self, db: Session, email: str) -> Employee | None:
        stmt = select(Employee).where(
            Employee.official_email == email.strip().lower(),
            Employee.is_deleted == False,
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_employees(
        self,
        db: Session,
        search: str | None = None,
        department_id: UUID | None = None,
        job_role_id: UUID | None = None,
        employment_status: EmploymentStatus | None = None,
        work_mode: WorkMode | None = None,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_desc: bool = True,
    ) -> tuple[Sequence[Employee], int]:
        stmt = select(Employee).options(
            selectinload(Employee.department),
            selectinload(Employee.job_role),
            selectinload(Employee.manager),
            selectinload(Employee.prediction_history),
        )

        if not include_deleted:
            stmt = stmt.where(Employee.is_deleted == False)

        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Employee.first_name.ilike(search_pattern),
                    Employee.last_name.ilike(search_pattern),
                    Employee.employee_code.ilike(search_pattern),
                    Employee.official_email.ilike(search_pattern),
                )
            )

        if department_id:
            stmt = stmt.where(Employee.department_id == department_id)
        if job_role_id:
            stmt = stmt.where(Employee.job_role_id == job_role_id)
        if employment_status:
            stmt = stmt.where(Employee.employment_status == employment_status)
        if work_mode:
            stmt = stmt.where(Employee.work_mode == work_mode)

        # Count total matching query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        # Sorting
        sort_col = getattr(Employee, sort_by, Employee.created_at)
        if sort_desc:
            stmt = stmt.order_by(sort_col.desc())
        else:
            stmt = stmt.order_by(sort_col.asc())

        stmt = stmt.offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total

    def soft_delete(self, db: Session, employee: Employee) -> Employee:
        employee.is_deleted = True
        employee.deleted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(employee)
        return employee
