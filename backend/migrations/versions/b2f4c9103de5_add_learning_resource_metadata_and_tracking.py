"""add_learning_resource_metadata_and_tracking

Revision ID: b2f4c9103de5
Revises: 9c7d41f5e2a1
Create Date: 2026-10-18 22:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2f4c9103de5'
down_revision: Union[str, Sequence[str], None] = '9c7d41f5e2a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add resource fields to course_lessons and tracking fields to lesson_completions."""
    # course_lessons additions
    op.add_column(
        'course_lessons',
        sa.Column('description', sa.Text(), nullable=True, comment='Short summary or overview of the external resource')
    )
    op.add_column(
        'course_lessons',
        sa.Column('provider', sa.String(length=100), server_default='External', nullable=False, comment='Resource provider')
    )
    op.add_column(
        'course_lessons',
        sa.Column('skill_covered', sa.String(length=150), nullable=True, comment='Primary skill covered')
    )
    op.add_column(
        'course_lessons',
        sa.Column('resource_type', sa.String(length=50), server_default='VIDEO', nullable=False, comment='Resource type: VIDEO, COURSE, ARTICLE, or DOCUMENTATION')
    )
    op.add_column(
        'course_lessons',
        sa.Column('access_type', sa.String(length=50), server_default='FREE', nullable=False, comment='Access model: FREE, PAID, or ACCOUNT_REQUIRED')
    )
    op.add_column(
        'course_lessons',
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False, comment='Whether resource is active')
    )

    # lesson_completions additions & modifications
    op.alter_column(
        'lesson_completions',
        'completed_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.add_column(
        'lesson_completions',
        sa.Column('resource_opened', sa.Boolean(), server_default='false', nullable=False, comment='Whether external resource was opened')
    )
    op.add_column(
        'lesson_completions',
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when external resource was opened')
    )
    op.add_column(
        'lesson_completions',
        sa.Column('is_completed', sa.Boolean(), server_default='true', nullable=False, comment='Whether employee marked lesson complete')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('lesson_completions', 'is_completed')
    op.drop_column('lesson_completions', 'opened_at')
    op.drop_column('lesson_completions', 'resource_opened')
    op.alter_column(
        'lesson_completions',
        'completed_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )

    op.drop_column('course_lessons', 'is_active')
    op.drop_column('course_lessons', 'access_type')
    op.drop_column('course_lessons', 'resource_type')
    op.drop_column('course_lessons', 'skill_covered')
    op.drop_column('course_lessons', 'provider')
    op.drop_column('course_lessons', 'description')
