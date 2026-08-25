"""
Employee service for CRUD, search, filtering, and relationship aggregation.
"""

from uuid import UUID

from app.database import EmploymentStatus, WorkMode
from app.models import Employee
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.job_role_repository import JobRoleRepository
from app.repositories.prediction_repository import PredictionRepository
from app.schemas.department import DepartmentResponse
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeeListItem,
    EmployeePaginatedResponse,
    EmployeeUpdate,
    ManagerBrief,
)
from app.schemas.job_role import JobRoleResponse, RoleSkillResponse
from app.schemas.skill import EmployeeSkillResponse, SkillResponse
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class EmployeeService:
    def __init__(self):
        self.repository = EmployeeRepository()
        self.dept_repo = DepartmentRepository()
        self.role_repo = JobRoleRepository()
        self.pred_repo = PredictionRepository()

    def get_employee(self, db: Session, employee_id: UUID) -> Employee:
        emp = self.repository.get_by_id_with_relations(db, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        return emp

    def get_employee_detail(self, db: Session, employee_id: UUID) -> EmployeeDetailResponse:
        emp = self.get_employee(db, employee_id)
        resp = EmployeeDetailResponse.model_validate(emp)
        resp.full_name = f"{emp.first_name} {emp.last_name}"

        if emp.department:
            resp.department = DepartmentResponse.model_validate(emp.department)

        if emp.job_role:
            role_resp = JobRoleResponse.model_validate(emp.job_role)
            if emp.job_role.department:
                role_resp.department_name = emp.job_role.department.name
                role_resp.department_code = emp.job_role.department.department_code
            role_skills = []
            for rs in emp.job_role.role_skills:
                rs_resp = RoleSkillResponse.model_validate(rs)
                if rs.skill:
                    rs_resp.skill_name = rs.skill.name
                    rs_resp.skill_code = rs.skill.skill_code
                    rs_resp.skill_category = rs.skill.skill_category
                role_skills.append(rs_resp)
            role_resp.role_skills = role_skills
            resp.job_role = role_resp

        if emp.manager:
            resp.manager = ManagerBrief.model_validate(emp.manager)

        resp.subordinates = [
            ManagerBrief.model_validate(sub) for sub in emp.subordinates if not sub.is_deleted
        ]

        emp_skills = []
        for es in emp.employee_skills:
            es_resp = EmployeeSkillResponse.model_validate(es)
            if es.skill:
                es_resp.skill = SkillResponse.model_validate(es.skill)
            emp_skills.append(es_resp)
        resp.employee_skills = emp_skills

        return resp

    def list_employees(
        self,
        db: Session,
        search: str | None = None,
        department_id: UUID | None = None,
        job_role_id: UUID | None = None,
        employment_status: EmploymentStatus | None = None,
        work_mode: WorkMode | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_desc: bool = True,
    ) -> EmployeePaginatedResponse:
        skip = (page - 1) * page_size
        items, total = self.repository.list_employees(
            db,
            search=search,
            department_id=department_id,
            job_role_id=job_role_id,
            employment_status=employment_status,
            work_mode=work_mode,
            skip=skip,
            limit=page_size,
            sort_by=sort_by,
            sort_desc=sort_desc,
        )

        list_items = []
        for emp in items:
            item = EmployeeListItem.model_validate(emp)
            item.full_name = f"{emp.first_name} {emp.last_name}"
            if emp.department:
                item.department_name = emp.department.name
            if emp.job_role:
                item.job_role_title = emp.job_role.title
            if emp.manager:
                item.manager_name = f"{emp.manager.first_name} {emp.manager.last_name}"

            # Latest risk if present
            if emp.prediction_history:
                latest_pred = max(emp.prediction_history, key=lambda p: p.generated_at)
                item.latest_risk_level = latest_pred.risk_level.value
                item.latest_risk_score = float(latest_pred.prediction_score)

            list_items.append(item)

        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

        return EmployeePaginatedResponse(
            items=list_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def create_employee(self, db: Session, emp_in: EmployeeCreate) -> EmployeeDetailResponse:
        # Check uniqueness
        if self.repository.get_by_code(db, emp_in.employee_code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee with this employee code already exists",
            )
        if self.repository.get_by_email(db, emp_in.official_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee with this official email already exists",
            )

        # Validate relations
        if not self.dept_repo.get_by_id(db, emp_in.department_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )
        if not self.role_repo.get_by_id(db, emp_in.job_role_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job role not found",
            )
        if emp_in.manager_id and not self.repository.get_by_id(db, emp_in.manager_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Manager employee not found",
            )

        emp_data = emp_in.model_dump()
        emp_data["employee_code"] = emp_data["employee_code"].upper()
        emp_data["official_email"] = emp_data["official_email"].lower()
        if emp_data.get("personal_email"):
            emp_data["personal_email"] = emp_data["personal_email"].lower()

        emp = Employee(**emp_data)
        emp = self.repository.create(db, emp)
        return self.get_employee_detail(db, emp.id)

    def update_employee(
        self, db: Session, employee_id: UUID, emp_in: EmployeeUpdate
    ) -> EmployeeDetailResponse:
        emp = self.get_employee(db, employee_id)
        update_data = emp_in.model_dump(exclude_unset=True)

        if update_data.get("official_email"):
            existing = self.repository.get_by_email(db, update_data["official_email"])
            if existing and existing.id != employee_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Employee with this official email already exists",
                )

        if update_data.get("department_id"):
            if not self.dept_repo.get_by_id(db, update_data["department_id"]):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Department not found",
                )

        if update_data.get("job_role_id"):
            if not self.role_repo.get_by_id(db, update_data["job_role_id"]):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Job role not found",
                )

        if update_data.get("manager_id"):
            if update_data["manager_id"] == employee_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An employee cannot be their own manager",
                )
            if not self.repository.get_by_id(db, update_data["manager_id"]):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Manager employee not found",
                )

        emp = self.repository.update(db, emp, update_data)
        return self.get_employee_detail(db, emp.id)

    def delete_employee(self, db: Session, employee_id: UUID) -> bool:
        emp = self.get_employee(db, employee_id)
        self.repository.soft_delete(db, emp)
        return True
