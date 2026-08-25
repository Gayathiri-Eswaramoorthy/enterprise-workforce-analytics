"""add_overtime_frequency

Revision ID: a8a79b45dbd9
Revises: e09a9f3748cc
Create Date: 2026-08-25 18:42:14.192558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8a79b45dbd9'
down_revision: Union[str, Sequence[str], None] = 'e09a9f3748cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum type first
    overtime_enum = sa.Enum('NONE', 'OCCASIONAL', 'FREQUENT', name='overtime_frequency')
    overtime_enum.create(op.get_bind(), checkfirst=True)
    
    # Add column
    op.add_column('employees', sa.Column('overtime_frequency', overtime_enum, server_default='NONE', nullable=False, comment="Employee's overtime frequency (e.g. NONE, OCCASIONAL, FREQUENT)"))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop column
    op.drop_column('employees', 'overtime_frequency')
    
    # Drop enum type
    overtime_enum = sa.Enum('NONE', 'OCCASIONAL', 'FREQUENT', name='overtime_frequency')
    overtime_enum.drop(op.get_bind(), checkfirst=True)
