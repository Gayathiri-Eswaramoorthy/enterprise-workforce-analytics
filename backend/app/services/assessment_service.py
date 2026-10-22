"""
Assessment service handling baseline and post-training skill evaluations,
reassessment comparisons, and gap tracking against role benchmarks.
"""

from decimal import Decimal
from uuid import UUID

from app.database import AssessmentType
from app.models import (
    Employee,
    EmployeeSkill,
    RoleSkill,
    Skill,
    SkillAssessment,
    TrainingCourse,
)
from app.schemas.assessment import (
    SkillAssessmentComparison,
    SkillAssessmentCreate,
    SkillAssessmentResponse,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


class AssessmentService:
    def create_assessment(
        self, db: Session, assessment_in: SkillAssessmentCreate, evaluator_id: UUID | None
    ) -> SkillAssessmentResponse:
        """
        Record a baseline or post-training skill assessment.
        If assessed_proficiency is provided by an authorized evaluator,
        update the employee's formal skill proficiency.
        """
        employee = db.get(Employee, assessment_in.employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        skill = db.get(Skill, assessment_in.skill_id)
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill not found",
            )

        if assessment_in.training_course_id:
            course = db.get(TrainingCourse, assessment_in.training_course_id)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Training course not found",
                )

        assessment = SkillAssessment(
            employee_id=assessment_in.employee_id,
            skill_id=assessment_in.skill_id,
            training_course_id=assessment_in.training_course_id,
            assessment_type=assessment_in.assessment_type,
            score=assessment_in.score,
            assessed_proficiency=assessment_in.assessed_proficiency,
            assessment_date=assessment_in.assessment_date,
            evaluator_id=evaluator_id,
            notes=assessment_in.notes,
        )
        db.add(assessment)

        # If a proficiency level is explicitly assessed, update EmployeeSkill
        if assessment_in.assessed_proficiency is not None:
            stmt_emp_skill = select(EmployeeSkill).where(
                EmployeeSkill.employee_id == assessment_in.employee_id,
                EmployeeSkill.skill_id == assessment_in.skill_id,
            )
            emp_skill = db.scalar(stmt_emp_skill)
            if emp_skill:
                emp_skill.proficiency_level = assessment_in.assessed_proficiency
                emp_skill.last_assessed_date = assessment_in.assessment_date
            else:
                emp_skill = EmployeeSkill(
                    employee_id=assessment_in.employee_id,
                    skill_id=assessment_in.skill_id,
                    proficiency_level=assessment_in.assessed_proficiency,
                    years_of_experience=Decimal("1.0"),
                    certification_status=False,
                    last_assessed_date=assessment_in.assessment_date,
                )
                db.add(emp_skill)

        db.commit()
        db.refresh(assessment)
        return self._format_response(db, assessment)

    def list_assessments(
        self,
        db: Session,
        employee_id: UUID | None = None,
        skill_id: UUID | None = None,
        course_id: UUID | None = None,
    ) -> list[SkillAssessmentResponse]:
        stmt = (
            select(SkillAssessment)
            .options(
                selectinload(SkillAssessment.employee),
                selectinload(SkillAssessment.skill),
                selectinload(SkillAssessment.training_course),
                selectinload(SkillAssessment.evaluator),
            )
            .order_by(SkillAssessment.assessment_date.desc(), SkillAssessment.created_at.desc())
        )

        if employee_id:
            stmt = stmt.where(SkillAssessment.employee_id == employee_id)
        if skill_id:
            stmt = stmt.where(SkillAssessment.skill_id == skill_id)
        if course_id:
            stmt = stmt.where(SkillAssessment.training_course_id == course_id)

        assessments = db.scalars(stmt).all()
        return [self._format_response(db, a) for a in assessments]

    def get_employee_assessment_comparison(
        self, db: Session, employee_id: UUID
    ) -> list[SkillAssessmentComparison]:
        """
        Compare baseline vs post-training assessment scores and calculate skill gap changes.
        """
        employee = db.get(Employee, employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        # Get role requirements
        role_skills_map: dict[UUID, int] = {}
        if employee.job_role_id:
            stmt_role = select(RoleSkill).where(RoleSkill.job_role_id == employee.job_role_id)
            for rs in db.scalars(stmt_role).all():
                role_skills_map[rs.skill_id] = rs.required_proficiency

        # Get employee's current skill proficiencies
        emp_skills_map: dict[UUID, int] = {}
        stmt_emp_skills = select(EmployeeSkill).where(EmployeeSkill.employee_id == employee_id)
        for es in db.scalars(stmt_emp_skills).all():
            emp_skills_map[es.skill_id] = es.proficiency_level

        # Load all assessments for this employee
        stmt_assess = (
            select(SkillAssessment)
            .options(
                selectinload(SkillAssessment.skill),
                selectinload(SkillAssessment.training_course),
            )
            .where(SkillAssessment.employee_id == employee_id)
            .order_by(SkillAssessment.assessment_date.asc())
        )
        assessments = db.scalars(stmt_assess).all()

        # Group by skill_id
        skill_groups: dict[UUID, list[SkillAssessment]] = {}
        for a in assessments:
            if a.skill_id not in skill_groups:
                skill_groups[a.skill_id] = []
            skill_groups[a.skill_id].append(a)

        comparisons: list[SkillAssessmentComparison] = []

        for s_id, a_list in skill_groups.items():
            first_a = a_list[0]
            skill = first_a.skill
            if not skill:
                continue

            baselines = [a for a in a_list if a.assessment_type == AssessmentType.BASELINE]
            posts = [a for a in a_list if a.assessment_type == AssessmentType.POST_TRAINING]

            baseline = baselines[0] if baselines else None
            post = posts[-1] if posts else None

            baseline_score = baseline.score if baseline else None
            baseline_date = baseline.assessment_date if baseline else None

            post_score = post.score if post else None
            post_date = post.assessment_date if post else None

            score_delta = None
            if post_score is not None and baseline_score is not None:
                score_delta = Decimal(round(float(post_score) - float(baseline_score), 2))

            reassessed_prof = post.assessed_proficiency if post else None
            current_prof = emp_skills_map.get(s_id)
            required_prof = role_skills_map.get(s_id)

            remaining_gap = None
            if required_prof is not None and current_prof is not None:
                remaining_gap = max(0, required_prof - current_prof)
            elif required_prof is not None:
                remaining_gap = required_prof

            is_improved = score_delta is not None and score_delta > Decimal("0.00")

            related_course = post.training_course if post and post.training_course else (baseline.training_course if baseline else None)

            comparisons.append(
                SkillAssessmentComparison(
                    skill_id=s_id,
                    skill_name=skill.name,
                    skill_category=skill.skill_category,
                    course_id=related_course.id if related_course else None,
                    course_title=related_course.title if related_course else None,
                    baseline_score=baseline_score,
                    baseline_date=baseline_date,
                    post_score=post_score,
                    post_date=post_date,
                    score_delta=score_delta,
                    current_proficiency=current_prof,
                    reassessed_proficiency=reassessed_prof,
                    required_proficiency=required_prof,
                    remaining_skill_gap=remaining_gap,
                    is_improved=is_improved,
                )
            )

        return comparisons

    def _format_response(self, db: Session, assessment: SkillAssessment) -> SkillAssessmentResponse:
        resp = SkillAssessmentResponse.model_validate(assessment)
        if assessment.employee:
            resp.employee_name = f"{assessment.employee.first_name} {assessment.employee.last_name}"
        if assessment.skill:
            resp.skill_name = assessment.skill.name
            resp.skill_category = assessment.skill.skill_category
        if assessment.training_course:
            resp.course_title = assessment.training_course.title
        if assessment.evaluator:
            resp.evaluator_name = assessment.evaluator.display_name or assessment.evaluator.username
        return resp
