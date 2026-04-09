"""Add IngestionTask

Revision ID: 2a8385e1b721
Revises: ed7504b29003
Create Date: 2026-04-09 12:16:47.252221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a8385e1b721'
down_revision: Union[str, Sequence[str], None] = 'ed7504b29003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'ingestion_tasks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.Enum('INITIATED', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', name='ingestionstatus'), nullable=False),
        sa.Column('remote_id', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('current_step', sa.String(), nullable=True),
        sa.Column('logs', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('ingestion_tasks')
