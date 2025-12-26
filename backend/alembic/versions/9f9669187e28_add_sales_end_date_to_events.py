"""add_sales_end_date_to_events

Revision ID: 9f9669187e28
Revises: 8f070a0898d0
Create Date: 2025-12-27 01:28:30.779341

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f9669187e28'
down_revision: Union[str, Sequence[str], None] = '8f070a0898d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('sales_end_date', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('events', 'sales_end_date')
