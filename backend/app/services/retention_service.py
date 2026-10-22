"""
Retention service for managing employee intervention lifecycles and retention outcome follow-ups.
"""

from uuid import UUID

from app.database import InterventionStatus, RecommendationStatus, RetentionOutcome
from app.models import Employee, Recommendation, RetentionIntervention, User
from app.schemas.retention import (
    RetentionInterventionCreate,
    RetentionInterventionResponse,
    RetentionInterventionUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


class RetentionService:
    def create_intervention(
        self, db: Session, intervention_in: RetentionInterventionCreate, hr_user_id: UUID
    ) -> RetentionInterventionResponse:
        """
        Record a retention or development intervention linked to an employee and recommendation.
        """
        employee = db.get(Employee, intervention_in.employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        if intervention_in.recommendation_id:
            rec = db.get(Recommendation, intervention_in.recommendation_id)
            if not rec:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recommendation not found",
                )
            # Update recommendation status to ACCEPTED if it was PENDING
            if rec.status == RecommendationStatus.PENDING:
                rec.status = RecommendationStatus.ACCEPTED

        intervention = RetentionIntervention(
            recommendation_id=intervention_in.recommendation_id,
            employee_id=intervention_in.employee_id,
            hr_user_id=hr_user_id,
            concern_summary=intervention_in.concern_summary,
            intervention_type=intervention_in.intervention_type,
            status=intervention_in.status,
            offered_date=intervention_in.offered_date,
            follow_up_date=intervention_in.follow_up_date,
            notes=intervention_in.notes,
            retention_outcome=RetentionOutcome.PENDING,
            intervention_effectiveness=intervention_in.intervention_effectiveness,
        )
        db.add(intervention)
        db.commit()
        db.refresh(intervention)
        return self._format_response(db, intervention)

    def list_interventions(
        self,
        db: Session,
        employee_id: UUID | None = None,
        recommendation_id: UUID | None = None,
        status_filter: InterventionStatus | None = None,
        outcome_filter: RetentionOutcome | None = None,
    ) -> list[RetentionInterventionResponse]:
        stmt = (
            select(RetentionIntervention)
            .options(
                selectinload(RetentionIntervention.employee).selectinload(Employee.department),
                selectinload(RetentionIntervention.employee).selectinload(Employee.job_role),
                selectinload(RetentionIntervention.hr_user),
            )
            .order_by(RetentionIntervention.offered_date.desc(), RetentionIntervention.created_at.desc())
        )

        if employee_id:
            stmt = stmt.where(RetentionIntervention.employee_id == employee_id)
        if recommendation_id:
            stmt = stmt.where(RetentionIntervention.recommendation_id == recommendation_id)
        if status_filter:
            stmt = stmt.where(RetentionIntervention.status == status_filter)
        if outcome_filter:
            stmt = stmt.where(RetentionIntervention.retention_outcome == outcome_filter)

        interventions = db.scalars(stmt).all()
        return [self._format_response(db, i) for i in interventions]

    def update_intervention(
        self,
        db: Session,
        intervention_id: UUID,
        update_in: RetentionInterventionUpdate,
    ) -> RetentionInterventionResponse:
        intervention = db.get(RetentionIntervention, intervention_id)
        if not intervention:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retention intervention not found",
            )

        update_data = update_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(intervention, k, v)

        # If completed and attached to a recommendation, mark recommendation completed
        if intervention.status == InterventionStatus.COMPLETED and intervention.recommendation_id:
            rec = db.get(Recommendation, intervention.recommendation_id)
            if rec:
                rec.status = RecommendationStatus.COMPLETED

        db.commit()
        db.refresh(intervention)
        return self._format_response(db, intervention)

    def _format_response(
        self, db: Session, intervention: RetentionIntervention
    ) -> RetentionInterventionResponse:
        resp = RetentionInterventionResponse.model_validate(intervention)
        emp = intervention.employee
        if emp:
            resp.employee_name = f"{emp.first_name} {emp.last_name}"
            resp.employee_code = emp.employee_code
            if emp.department:
                resp.department_name = emp.department.name
            if emp.job_role:
                resp.job_title = emp.job_role.title
        if intervention.hr_user:
            resp.hr_user_name = (
                intervention.hr_user.display_name or intervention.hr_user.username
            )
        return resp
