"""
Employee schemas for request, response, search, and pagination.
"""

from datetime import date, datetime
from uuid import UUID

from app.database import EmploymentStatus, EmploymentType, Gender, WorkMode
from app.schemas.department import DepartmentResponse
from app.schemas.job_role import JobRoleResponse
from app.schemas.skill import EmployeeSkillResponse
from pydantic import BaseModel, ConfigDict, Field


class EmployeeBase(BaseModel):
    employee_code: str = Field(..., min_length=2, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: date
    gender: Gender
    phone_number: str = Field(..., min_length=5, max_length=20)
    alternate_phone: str | None = None
    personal_email: str | None = None
    official_email: str
    department_id: UUID
    job_role_id: UUID
    manager_id: UUID | None = None
    date_of_joining: date
    employment_status: EmploymentStatus = EmploymentStatus.ACTIVE
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    work_mode: WorkMode = WorkMode.OFFICE
    work_location: str = Field(..., min_length=2, max_length=255)
    profile_photo_url: str | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    date_of_birth: date | None = None
    gender: Gender | None = None
    phone_number: str | None = None
    alternate_phone: str | None = None
    personal_email: str | None = None
    official_email: str | None = None
    department_id: UUID | None = None
    job_role_id: UUID | None = None
    manager_id: UUID | None = None
    date_of_joining: date | None = None
    employment_status: EmploymentStatus | None = None
    employment_type: EmploymentType | None = None
    work_mode: WorkMode | None = None
    work_location: str | None = None
    profile_photo_url: str | None = None


class EmployeeListItem(BaseModel):
    id: UUID
    employee_code: str
    first_name: str
    last_name: str
    full_name: str = ""
    official_email: str
    phone_number: str
    department_id: UUID
    department_name: str | None = None
    job_role_id: UUID
    job_role_title: str | None = None
    employment_status: EmploymentStatus
    employment_type: EmploymentType
    work_mode: WorkMode
    work_location: str
    date_of_joining: date
    profile_photo_url: str | None = None
    manager_id: UUID | None = None
    manager_name: str | None = None
    latest_risk_level: str | None = None
    latest_risk_score: float | None = None
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class EmployeePaginatedResponse(BaseModel):
    items: list[EmployeeListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ManagerBrief(BaseModel):
    id: UUID
    employee_code: str
    first_name: str
    last_name: str
    official_email: str

    model_config = ConfigDict(from_attributes=True)


class EmployeeDetailResponse(EmployeeBase):
    id: UUID
    full_name: str = ""
    is_deleted: bool = False
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    department: DepartmentResponse | None = None
    job_role: JobRoleResponse | None = None
    manager: ManagerBrief | None = None
    subordinates: list[ManagerBrief] = []
    employee_skills: list[EmployeeSkillResponse] = []

    model_config = ConfigDict(from_attributes=True)
