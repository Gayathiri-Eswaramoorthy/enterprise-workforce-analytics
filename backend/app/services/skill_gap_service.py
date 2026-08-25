"""
SkillGapService: Core intelligent engine analyzing employee proficiencies vs job role requirements.
"""

from collections import defaultdict
from uuid import UUID

from app.models import Employee, JobRole, RoleSkill
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.job_role_repository import JobRoleRepository
from app.schemas.analytics import (
    DepartmentSkillGapSummary,
    EmployeeSkillGapReport,
    SkillGapItem,
    TopSkillGapItem,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


class SkillGapService:
    def __init__(self):
        self.employee_repo = EmployeeRepository()
        self.dept_repo = DepartmentRepository()
        self.role_repo = JobRoleRepository()

    def calculate_employee_skill_gaps(
        self, db: Session, employee_id: UUID
    ) -> EmployeeSkillGapReport:
        """
        Dynamically calculate skill gaps for an employee against their job role requirements.

        Gap Formula:
            gap = max(0, required_proficiency - current_proficiency)
            If employee does not possess skill: current_proficiency = 0, gap = required_proficiency

        Severity Formula:
            - CRITICAL: mandatory == True and gap >= 2
            - HIGH: gap >= 2 (non-mandatory) or (mandatory == True and gap == 1)
            - MEDIUM: mandatory == False and gap == 1
            - NONE: gap == 0
        """
        emp = self.employee_repo.get_by_id_with_relations(db, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        if not emp.job_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee has no assigned Job Role",
            )

        # Map current skills
        employee_skills_map = {es.skill_id: es for es in emp.employee_skills}

        # Role required skills
        role_skills = emp.job_role.role_skills

        gap_items: list[SkillGapItem] = []
        skills_with_gap = 0
        critical_gaps_count = 0
        total_required_prof = 0
        total_actual_prof = 0

        for rs in role_skills:
            skill = rs.skill
            if not skill:
                continue

            es = employee_skills_map.get(rs.skill_id)
            current_prof = es.proficiency_level if es else 0
            req_prof = rs.required_proficiency
            gap = max(0, req_prof - current_prof)

            # Determine severity
            if gap == 0:
                severity = "NONE"
            elif rs.mandatory and gap >= 2:
                severity = "CRITICAL"
                critical_gaps_count += 1
            elif gap >= 2 or (rs.mandatory and gap == 1):
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            if gap > 0:
                skills_with_gap += 1

            total_required_prof += req_prof
            total_actual_prof += min(current_prof, req_prof)

            gap_items.append(
                SkillGapItem(
                    skill_id=skill.id,
                    skill_code=skill.skill_code,
                    skill_name=skill.name,
                    skill_category=skill.skill_category,
                    current_proficiency=current_prof,
                    required_proficiency=req_prof,
                    gap=gap,
                    severity=severity,
                    is_mandatory=rs.mandatory,
                    years_of_experience=es.years_of_experience if es else None,
                    has_certification=es.certification_status if es else False,
                )
            )

        # Sort: CRITICAL first, then HIGH, then MEDIUM, then NONE
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "NONE": 3}
        gap_items.sort(key=lambda item: (severity_order.get(item.severity, 4), -item.gap))

        match_pct = (
            round((total_actual_prof / total_required_prof) * 100, 1)
            if total_required_prof > 0
            else 100.0
        )

        return EmployeeSkillGapReport(
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}",
            employee_code=emp.employee_code,
            job_role_id=emp.job_role.id,
            job_role_title=emp.job_role.title,
            department_id=emp.department.id,
            department_name=emp.department.name,
            total_required_skills=len(role_skills),
            skills_with_gap=skills_with_gap,
            critical_gaps_count=critical_gaps_count,
            overall_skill_match_percentage=match_pct,
            gaps=gap_items,
        )

    def get_organization_top_skill_gaps(
        self, db: Session, limit: int = 10
    ) -> list[TopSkillGapItem]:
        """
        Aggregate top skill gaps across all active employees in the organization.
        """
        # Fetch all active employees with roles and skills
        stmt = (
            select(Employee)
            .where(Employee.is_deleted == False)
            .options(
                selectinload(Employee.job_role)
                .selectinload(JobRole.role_skills)
                .selectinload(RoleSkill.skill),
                selectinload(Employee.employee_skills),
            )
        )
        employees = db.execute(stmt).scalars().all()

        skill_gap_stats = defaultdict(lambda: {"gaps": [], "critical": 0, "skill": None})

        for emp in employees:
            if not emp.job_role:
                continue
            emp_skills_map = {es.skill_id: es.proficiency_level for es in emp.employee_skills}
            for rs in emp.job_role.role_skills:
                skill = rs.skill
                if not skill:
                    continue
                current = emp_skills_map.get(rs.skill_id, 0)
                gap = max(0, rs.required_proficiency - current)
                if gap > 0:
                    stats = skill_gap_stats[skill.id]
                    stats["skill"] = skill
                    stats["gaps"].append(gap)
                    if rs.mandatory and gap >= 2:
                        stats["critical"] += 1

        results = []
        for sid, data in skill_gap_stats.items():
            skill = data["skill"]
            gaps = data["gaps"]
            if not gaps:
                continue
            results.append(
                TopSkillGapItem(
                    skill_id=sid,
                    skill_code=skill.skill_code,
                    skill_name=skill.name,
                    skill_category=skill.skill_category,
                    affected_employees_count=len(gaps),
                    avg_proficiency_gap=round(sum(gaps) / len(gaps), 2),
                    mandatory_gaps_count=data["critical"],
                )
            )

        results.sort(
            key=lambda x: (
                x.mandatory_gaps_count,
                x.affected_employees_count,
                x.avg_proficiency_gap,
            ),
            reverse=True,
        )
        return results[:limit]

    def get_department_skill_gap_summary(
        self, db: Session, department_id: UUID
    ) -> DepartmentSkillGapSummary:
        dept = self.dept_repo.get_by_id(db, department_id)
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        stmt = (
            select(Employee)
            .where(
                Employee.department_id == department_id,
                Employee.is_deleted == False,
            )
            .options(
                selectinload(Employee.job_role)
                .selectinload(JobRole.role_skills)
                .selectinload(RoleSkill.skill),
                selectinload(Employee.employee_skills),
            )
        )
        employees = db.execute(stmt).scalars().all()

        total_gaps = 0
        critical_gaps = 0
        skill_counts = defaultdict(int)

        for emp in employees:
            if not emp.job_role:
                continue
            emp_skills = {es.skill_id: es.proficiency_level for es in emp.employee_skills}
            for rs in emp.job_role.role_skills:
                curr = emp_skills.get(rs.skill_id, 0)
                gap = max(0, rs.required_proficiency - curr)
                if gap > 0:
                    total_gaps += 1
                    skill_counts[rs.skill.name] += 1
                    if rs.mandatory and gap >= 2:
                        critical_gaps += 1

        top_skills = [
            {"skill_name": name, "gap_count": cnt}
            for name, cnt in sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        return DepartmentSkillGapSummary(
            department_id=dept.id,
            department_name=dept.name,
            total_employees=len(employees),
            total_skill_gaps=total_gaps,
            critical_gaps=critical_gaps,
            top_gap_skills=top_skills,
        )
