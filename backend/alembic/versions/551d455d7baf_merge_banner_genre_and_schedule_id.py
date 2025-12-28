"""merge_banner_genre_and_schedule_id

Revision ID: 551d455d7baf
Revises: a1a1c05dbc2d, edb2071fb96b
Create Date: 2025-12-28 23:46:26.050418

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '551d455d7baf'
down_revision: Union[str, Sequence[str], None] = ('a1a1c05dbc2d', 'edb2071fb96b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
