"""Merge heads

Revision ID: ed7504b29003
Revises: d949837b2e0c, e4f5a6b7c8d9
Create Date: 2026-04-09 12:16:46.621340

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed7504b29003'
down_revision: Union[str, Sequence[str], None] = ('d949837b2e0c', 'e4f5a6b7c8d9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
