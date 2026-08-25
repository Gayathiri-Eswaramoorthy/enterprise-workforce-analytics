"""
Audit logging service for enterprise compliance and history tracking.
"""

from datetime import datetime
from uuid import UUID

from app.models import AuditLog, User
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit_log import AuditLogResponse
from fastapi import Request
from sqlalchemy.orm import Session


class AuditService:
    def __init__(self):
        self.repository = AuditRepository()

    def log_action(
        self,
        db: Session,
        entity_name: str,
        entity_id: UUID,
        action: str,
        description: str,
        user: User | None = None,
        request: Request | None = None,
    ) -> AuditLog:
        ip_address = None
        if request and request.client:
            ip_address = request.client.host

        log = AuditLog(
            user_id=user.id if user else None,
            entity_name=entity_name,
            entity_id=entity_id,
            action=action,
            description=description,
            ip_address=ip_address,
        )
        return self.repository.create(db, log)

    def list_audit_logs(
        self,
        db: Session,
        entity_name: str | None = None,
        action: str | None = None,
        user_id: UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[AuditLogResponse], int]:
        skip = (page - 1) * page_size
        logs, total = self.repository.list_logs(
            db=db,
            entity_name=entity_name,
            action=action,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=page_size,
        )

        responses = []
        for log in logs:
            resp = AuditLogResponse.model_validate(log)
            if log.user:
                resp.user_name = log.user.display_name or log.user.username
                resp.user_email = log.user.email
            responses.append(resp)

        return responses, total
