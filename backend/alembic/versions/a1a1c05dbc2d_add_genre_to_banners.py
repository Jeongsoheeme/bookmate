"""add_genre_to_banners

Revision ID: a1a1c05dbc2d
Revises: db884318d4dc
Create Date: 2025-12-28 23:43:58.809103

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1a1c05dbc2d'
down_revision: Union[str, Sequence[str], None] = 'db884318d4dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # EventGenre enum 타입 생성 (이미 존재할 수 있으므로 IF NOT EXISTS 사용)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE eventgenre AS ENUM ('뮤지컬', '연극', '콘서트');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # banners 테이블에 genre 컬럼 추가
    op.add_column('banners', sa.Column('genre', postgresql.ENUM('뮤지컬', '연극', '콘서트', name='eventgenre'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('banners', 'genre')
