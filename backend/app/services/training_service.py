"""
Training service for course catalog management and employee enrollment tracking.
"""

from uuid import UUID

from app.database import DifficultyLevel, EnrollmentStatus, TrainingMode
from app.models import TrainingCourse, TrainingEnrollment
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.skill_repository import SkillRepository
from app.repositories.training_repository import TrainingRepository
from app.schemas.skill import SkillResponse
from app.schemas.training import (
    TrainingCourseCreate,
    TrainingCourseResponse,
    TrainingCourseUpdate,
    TrainingEnrollmentCreate,
    TrainingEnrollmentResponse,
    TrainingEnrollmentUpdate,
    TrainingSkillResponse,
)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class TrainingService:
    def __init__(self):
        self.repository = TrainingRepository()
        self.employee_repo = EmployeeRepository()
        self.skill_repo = SkillRepository()

    def get_course(self, db: Session, course_id: UUID) -> TrainingCourse:
        course = self.repository.get_by_id_with_skills(db, course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training course not found",
            )
        return course

    def get_course_response(self, db: Session, course_id: UUID) -> TrainingCourseResponse:
        course = self.get_course(db, course_id)
        resp = TrainingCourseResponse.model_validate(course)

        skills_resp = []
        for ts in course.training_skills:
            ts_resp = TrainingSkillResponse.model_validate(ts)
            if ts.skill:
                ts_resp.skill = SkillResponse.model_validate(ts.skill)
            skills_resp.append(ts_resp)
        resp.training_skills = skills_resp

        # Counts
        resp.enrolled_count = len(course.enrollments)
        resp.completed_count = sum(
            1 for e in course.enrollments if e.enrollment_status == EnrollmentStatus.COMPLETED
        )
        return resp

    def list_courses(
        self,
        db: Session,
        difficulty: DifficultyLevel | None = None,
        mode: TrainingMode | None = None,
        search: str | None = None,
        active_only: bool = False,
    ) -> list[TrainingCourseResponse]:
        courses = self.repository.list_courses(
            db, difficulty=difficulty, mode=mode, search=search, active_only=active_only
        )
        responses = []
        for c in courses:
            resp = TrainingCourseResponse.model_validate(c)
            skills_resp = []
            for ts in c.training_skills:
                ts_resp = TrainingSkillResponse.model_validate(ts)
                if ts.skill:
                    ts_resp.skill = SkillResponse.model_validate(ts.skill)
                skills_resp.append(ts_resp)
            resp.training_skills = skills_resp
            resp.enrolled_count = len(c.enrollments)
            resp.completed_count = sum(
                1 for e in c.enrollments if e.enrollment_status == EnrollmentStatus.COMPLETED
            )
            responses.append(resp)
        return responses

    def create_course(self, db: Session, course_in: TrainingCourseCreate) -> TrainingCourseResponse:
        if self.repository.get_by_code(db, course_in.course_code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A training course with this course code already exists",
            )

        course_data = course_in.model_dump(exclude={"target_skill_ids"})
        course_data["course_code"] = course_data["course_code"].upper()
        course = TrainingCourse(**course_data)
        course = self.repository.create(db, course)

        if course_in.target_skill_ids:
            self.repository.set_course_skills(db, course.id, course_in.target_skill_ids)

        return self.get_course_response(db, course.id)

    def update_course(
        self, db: Session, course_id: UUID, course_in: TrainingCourseUpdate
    ) -> TrainingCourseResponse:
        course = self.get_course(db, course_id)
        update_data = course_in.model_dump(exclude_unset=True)

        target_skills = update_data.pop("target_skill_ids", None)

        if update_data.get("course_code"):
            update_data["course_code"] = update_data["course_code"].upper()
            existing = self.repository.get_by_code(db, update_data["course_code"])
            if existing and existing.id != course_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A training course with this course code already exists",
                )

        course = self.repository.update(db, course, update_data)

        if target_skills is not None:
            self.repository.set_course_skills(db, course.id, target_skills)

        return self.get_course_response(db, course.id)

    # Enrollments
    def enroll_employee(
        self, db: Session, enroll_in: TrainingEnrollmentCreate
    ) -> TrainingEnrollmentResponse:
        if not self.employee_repo.get_by_id(db, enroll_in.employee_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        self.get_course(db, enroll_in.training_course_id)

        existing = self.repository.get_enrollment(
            db, enroll_in.employee_id, enroll_in.training_course_id
        )
        if existing and existing.enrollment_status == EnrollmentStatus.DROPPED:
            # Re-enrolling in a previously dropped course reactivates the same record
            existing.enrollment_status = enroll_in.enrollment_status
            existing.enrollment_date = enroll_in.enrollment_date
            existing.completion_date = None
            db.commit()
            db.refresh(existing)
            return self._format_enrollment_response(db, existing)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee is already enrolled in this course",
            )

        enrollment = TrainingEnrollment(**enroll_in.model_dump())
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        return self._format_enrollment_response(db, enrollment)

    def get_enrollment_employee_id(self, db: Session, enrollment_id: UUID) -> UUID:
        enrollment = self.repository.get_enrollment_by_id(db, enrollment_id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training enrollment not found",
            )
        return enrollment.employee_id

    def update_enrollment(
        self, db: Session, enrollment_id: UUID, enroll_in: TrainingEnrollmentUpdate
    ) -> TrainingEnrollmentResponse:
        enrollment = self.repository.get_enrollment_by_id(db, enrollment_id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training enrollment not found",
            )

        update_data = enroll_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(enrollment, k, v)
        db.commit()
        db.refresh(enrollment)
        return self._format_enrollment_response(db, enrollment)

    def list_enrollments(
        self,
        db: Session,
        employee_id: UUID | None = None,
        course_id: UUID | None = None,
        status: EnrollmentStatus | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[TrainingEnrollmentResponse], int]:
        skip = (page - 1) * page_size
        enrollments, total = self.repository.list_enrollments(
            db,
            employee_id=employee_id,
            course_id=course_id,
            status=status,
            skip=skip,
            limit=page_size,
        )
        return [self._format_enrollment_response(db, e) for e in enrollments], total

    def _format_enrollment_response(
        self, db: Session, enrollment: TrainingEnrollment
    ) -> TrainingEnrollmentResponse:
        resp = TrainingEnrollmentResponse.model_validate(enrollment)
        if enrollment.employee:
            resp.employee_name = f"{enrollment.employee.first_name} {enrollment.employee.last_name}"
            resp.employee_code = enrollment.employee.employee_code
        if enrollment.training_course:
            resp.course = TrainingCourseResponse.model_validate(enrollment.training_course)
        return resp
