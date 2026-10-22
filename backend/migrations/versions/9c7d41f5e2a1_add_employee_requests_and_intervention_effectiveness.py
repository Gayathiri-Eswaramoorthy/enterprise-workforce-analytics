"""add_employee_requests_and_intervention_effectiveness

Revision ID: 9c7d41f5e2a1
Revises: 8fbca280306f
Create Date: 2026-10-18 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9c7d41f5e2a1'
down_revision: Union[str, Sequence[str], None] = '8fbca280306f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'retention_interventions',
        sa.Column(
            'intervention_effectiveness',
            sa.String(length=50),
            nullable=True,
            comment='Observational assessment of whether intervention helped (HELPFUL, NEUTRAL, UNHELPFUL, PENDING_ASSESSMENT)'
        )
    )

    op.create_table(
        'employee_requests',
        sa.Column('id', sa.UUID(), nullable=False, comment='Unique identifier for the record'),
        sa.Column('employee_id', sa.UUID(), nullable=False, comment='FK reference to the requesting Employee'),
        sa.Column('request_type', sa.String(length=50), nullable=False, comment='Type of request: LEARNING_INTEREST, CAREER_DISCUSSION, WORKLOAD_FEEDBACK, OTHER'),
        sa.Column('topic', sa.String(length=255), nullable=False, comment='Primary subject or skill interest of the request'),
        sa.Column('notes', sa.Text(), nullable=True, comment='Context, specific questions, or details provided by employee'),
        sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False, comment='Lifecycle status: PENDING, REVIEWED, RESOLVED'),
        sa.Column('reviewed_by_id', sa.UUID(), nullable=True, comment='HR user who reviewed or handled this request'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when HR marked this request as reviewed'),
        sa.Column('response_notes', sa.Text(), nullable=True, comment='HR feedback or follow-up notes shared with employee'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when the record was created'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Timestamp when the record was last updated'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_requests_employee_id'), 'employee_requests', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_requests_status'), 'employee_requests', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_employee_requests_status'), table_name='employee_requests')
    op.drop_index(op.f('ix_employee_requests_employee_id'), table_name='employee_requests')
    op.drop_table('employee_requests')
    op.drop_column('retention_interventions', 'intervention_effectiveness')
