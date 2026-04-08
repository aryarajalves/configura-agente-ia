"""Merge multiple heads

Revision ID: 1be628bae2cc
Revises: a1b2c3d4e5f6, d5e6f7a8b9c0
Create Date: 2026-04-08 15:29:23.395049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1be628bae2cc'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'd5e6f7a8b9c0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
