"""merge multiple heads

Revision ID: 1290d71ec728
Revises: 008_skills_to_kbs, 2a8385e1b721
Create Date: 2026-04-13 15:19:25.696469

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1290d71ec728'
down_revision: Union[str, Sequence[str], None] = ('008_skills_to_kbs', '2a8385e1b721')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
