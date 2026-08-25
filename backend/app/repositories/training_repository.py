"""
TrainingCourse and TrainingEnrollment repository.
"""

from collections.abc import Sequence
from uuid import UUID

from app.database import DifficultyLevel, EnrollmentStatus, TrainingMode
from app.models import TrainingCourse, TrainingEnrollment, TrainingSkill
from app.repositories.base_repository import BaseRepository
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session, selectinload


class TrainingRepository(BaseRepository[TrainingCourse]):
    def __init__(self):
        super().__init__(TrainingCourse)

    def get_by_id_with_skills(self, db: Session, course_id: UUID) -> TrainingCourse | None:
        stmt = (
            select(TrainingCourse)
            .where(TrainingCourse.id == course_id)
            .options(
                selectinload(TrainingCourse.training_skills).selectinload(TrainingSkill.skill),
                selectinload(TrainingCourse.enrollments),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, db: Session, code: str) -> TrainingCourse | None:
        stmt = select(TrainingCourse).where(TrainingCourse.course_code == code.upper())
        return db.execute(stmt).scalar_one_or_none()

    def list_courses(
        self,
        db: Session,
        difficulty: DifficultyLevel | None = None,
        mode: TrainingMode | None = None,
        search: str | None = None,
        active_only: bool = False,
    ) -> Sequence[TrainingCourse]:
        stmt = select(TrainingCourse).options(
            selectinload(TrainingCourse.training_skills).selectinload(TrainingSkill.skill),
            selectinload(TrainingCourse.enrollments),
        )
        if active_only:
            stmt = stmt.where(TrainingCourse.is_active == True)
        if difficulty:
            stmt = stmt.where(TrainingCourse.difficulty_level == difficulty)
        if mode:
            stmt = stmt.where(TrainingCourse.training_mode == mode)
        if search:
            pat = f"%{search.strip()}%"
            stmt = stmt.where(
                (TrainingCourse.title.ilike(pat)) | (TrainingCourse.course_code.ilike(pat))
            )

        stmt = stmt.order_by(TrainingCourse.title.asc())
        return db.execute(stmt).scalars().all()

    def set_course_skills(
        self, db: Session, course_id: UUID, skill_ids: list[UUID]
    ) -> list[TrainingSkill]:
        db.execute(delete(TrainingSkill).where(TrainingSkill.training_course_id == course_id))
        db.flush()

        training_skills = []
        for sid in skill_ids:
            ts = TrainingSkill(training_course_id=course_id, skill_id=sid)
            db.add(ts)
            training_skills.append(ts)

        db.commit()
        return training_skills

    # Enrollments
    def get_enrollment(
        self, db: Session, employee_id: UUID, course_id: UUID
    ) -> TrainingEnrollment | None:
        stmt = select(TrainingEnrollment).where(
            TrainingEnrollment.employee_id == employee_id,
            TrainingEnrollment.training_course_id == course_id,
        )
        return db.execute(stmt).scalar_one_or_none()

    def get_enrollment_by_id(self, db: Session, enrollment_id: UUID) -> TrainingEnrollment | None:
        stmt = (
            select(TrainingEnrollment)
            .where(TrainingEnrollment.id == enrollment_id)
            .options(
                selectinload(TrainingEnrollment.employee),
                selectinload(TrainingEnrollment.training_course),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_enrollments(
        self,
        db: Session,
        employee_id: UUID | None = None,
        course_id: UUID | None = None,
        status: EnrollmentStatus | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[Sequence[TrainingEnrollment], int]:
        stmt = select(TrainingEnrollment).options(
            selectinload(TrainingEnrollment.employee),
            selectinload(TrainingEnrollment.training_course),
        )
        if employee_id:
            stmt = stmt.where(TrainingEnrollment.employee_id == employee_id)
        if course_id:
            stmt = stmt.where(TrainingEnrollment.training_course_id == course_id)
        if status:
            stmt = stmt.where(TrainingEnrollment.enrollment_status == status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        stmt = stmt.order_by(desc(TrainingEnrollment.enrollment_date)).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return items, total

    def find_courses_for_skills(
        self, db: Session, skill_ids: list[UUID]
    ) -> Sequence[TrainingCourse]:
        if not skill_ids:
            return []
        stmt = (
            select(TrainingCourse)
            .join(TrainingSkill, TrainingSkill.training_course_id == TrainingCourse.id)
            .where(
                TrainingSkill.skill_id.in_(skill_ids),
                TrainingCourse.is_active == True,
            )
            .distinct()
            .options(selectinload(TrainingCourse.training_skills).selectinload(TrainingSkill.skill))
        )
        return db.execute(stmt).scalars().all()
