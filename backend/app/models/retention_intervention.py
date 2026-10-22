"""
RetentionIntervention database model.
"""

import uuid
from datetime import date
from typing import TYPE_CHECKING

from app.database import BaseModel, InterventionStatus, RetentionOutcome
from sqlalchemy import Date, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.recommendation import Recommendation
    from app.models.user import User


class RetentionIntervention(BaseModel):
    """
    RetentionIntervention model tracking proactive HR retention actions and long-term outcomes.
    """

    __tablename__ = "retention_interventions"

    recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendations.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="Optional FK reference to the triggering Recommendation",
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the Employee receiving intervention",
    )
    hr_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
        comment="FK reference to the responsible HR User",
    )
    concern_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Identified risk factor or concern (e.g. high attrition risk, burnout, skill deficit)",
    )
    intervention_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Proposed intervention type (e.g. WORKLOAD_REVIEW, CAREER_DEVELOPMENT, MENTORING, TRAINING, COMPENSATION_REVIEW)",
    )
    status: Mapped[InterventionStatus] = mapped_column(
        SAEnum(InterventionStatus, name="intervention_status"),
        index=True,
        nullable=False,
        default=InterventionStatus.OFFERED,
        comment="Intervention lifecycle: OFFERED, ACCEPTED, DECLINED, COMPLETED",
    )
    offered_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date when the intervention was discussed or offered to the employee",
    )
    completed_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date when the intervention action items were completed",
    )
    follow_up_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Scheduled 3-month or 6-month check-in follow-up date",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed HR notes, meeting summaries, or action steps",
    )
    retention_outcome: Mapped[RetentionOutcome] = mapped_column(
        SAEnum(RetentionOutcome, name="retention_outcome"),
        index=True,
        nullable=False,
        default=RetentionOutcome.PENDING,
        comment="Documented retention status at follow-up (EMPLOYED, DEPARTED, PENDING)",
    )
    outcome_recorded_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date when the retention outcome was formally verified and recorded",
    )
    outcome_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Observations or factual context regarding employee retention status",
    )
    intervention_effectiveness: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Observational assessment of whether intervention helped (HELPFUL, NEUTRAL, UNHELPFUL, PENDING_ASSESSMENT)",
    )

    # Relationships
    recommendation: Mapped["Recommendation | None"] = relationship(
        "Recommendation",
        back_populates="retention_interventions",
    )
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="retention_interventions",
    )
    hr_user: Mapped["User"] = relationship(
        "User",
        back_populates="managed_interventions",
    )
