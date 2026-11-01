"""
Service for managing employee career discussion and learning interest requests.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.database import NotificationType
from app.models import Employee, EmployeeRequest, Notification, User
from app.schemas.employee_request import (
    EmployeeRequestCreate,
    EmployeeRequestResponse,
    EmployeeRequestUpdate,
)
from app.security import HR_ROLES
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload


class EmployeeRequestService:
    def create_request(
        self, db: Session, employee_id: UUID, request_in: EmployeeRequestCreate
    ) -> EmployeeRequestResponse:
        emp = db.get(Employee, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        req = EmployeeRequest(
            employee_id=employee_id,
            request_type=request_in.request_type,
            topic=request_in.topic,
            notes=request_in.notes,
            status="PENDING",
        )
        db.add(req)
        db.flush()

        # Notify HR roles about the employee's request
        hr_users = db.scalars(
            select(User).where(User.is_active == True, User.role.in_(HR_ROLES))  # noqa: E712
        ).all()
        for hr_u in hr_users:
            notif = Notification(
                user_id=hr_u.id,
                title=f"💬 New Employee Request: {emp.first_name} {emp.last_name}",
                message=(
                    f"Employee {emp.first_name} {emp.last_name} ({emp.employee_code}) submitted a "
                    f"request for {req.request_type.replace('_', ' ').title()}: '{req.topic}'."
                ),
                notification_type=NotificationType.SYSTEM,
            )
            db.add(notif)

        db.commit()
        db.refresh(req)
        return self._format_response(db, req)

    def list_requests(
        self,
        db: Session,
        employee_id: UUID | None = None,
        status_filter: str | None = None,
    ) -> list[EmployeeRequestResponse]:
        stmt = (
            select(EmployeeRequest)
            .options(
                selectinload(EmployeeRequest.employee).selectinload(Employee.department),
                selectinload(EmployeeRequest.employee).selectinload(Employee.job_role),
                selectinload(EmployeeRequest.reviewed_by),
            )
            .order_by(desc(EmployeeRequest.created_at))
        )
        if employee_id:
            stmt = stmt.where(EmployeeRequest.employee_id == employee_id)
        if status_filter:
            stmt = stmt.where(EmployeeRequest.status == status_filter)

        items = db.scalars(stmt).all()
        return [self._format_response(db, item) for item in items]

    def update_request(
        self,
        db: Session,
        request_id: UUID,
        hr_user: User,
        update_in: EmployeeRequestUpdate,
    ) -> EmployeeRequestResponse:
        req = db.get(EmployeeRequest, request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found",
            )

        if update_in.status is not None:
            req.status = update_in.status
        if update_in.response_notes is not None:
            req.response_notes = update_in.response_notes

        req.reviewed_by_id = hr_user.id
        req.reviewed_at = datetime.now(timezone.utc)

        # Notify employee if user account is linked
        if req.employee and req.employee.user_id:
            notif = Notification(
                user_id=req.employee.user_id,
                title="💬 HR Discussion Update",
                message=(
                    f"HR has reviewed your request regarding '{req.topic}'. "
                    f"Status: {req.status}."
                    + (f" Notes: {req.response_notes}" if req.response_notes else "")
                ),
                notification_type=NotificationType.SYSTEM,
            )
            db.add(notif)

        db.commit()
        db.refresh(req)
        return self._format_response(db, req)

    def _format_response(self, db: Session, req: EmployeeRequest) -> EmployeeRequestResponse:
        resp = EmployeeRequestResponse.model_validate(req)
        emp = req.employee or db.get(Employee, req.employee_id)
        if emp:
            resp.employee_name = f"{emp.first_name} {emp.last_name}"
            resp.employee_code = emp.employee_code
            if emp.department:
                resp.department_name = emp.department.name
            if emp.job_role:
                resp.job_title = emp.job_role.title
        if req.reviewed_by:
            resp.reviewed_by_name = req.reviewed_by.display_name or req.reviewed_by.username
        return resp
