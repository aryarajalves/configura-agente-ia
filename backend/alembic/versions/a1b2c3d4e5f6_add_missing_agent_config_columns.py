"""Add missing columns to agent_config table

Revision ID: a1b2c3d4e5f6
Revises: 979d47d52c16
Create Date: 2026-03-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '979d47d52c16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add columns that exist in the model but are missing from the DB."""
    # Using IF NOT EXISTS to be safe in case some columns already exist
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS inbox_capture_enabled BOOLEAN DEFAULT TRUE")
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS handoff_enabled BOOLEAN DEFAULT FALSE")
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS model_settings TEXT DEFAULT '{}'")
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_simple_fallback_model VARCHAR")
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_complex_fallback_model VARCHAR")
    op.execute("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP")


def downgrade() -> None:
    """Remove the added columns."""
    op.drop_column('agent_config', 'updated_at')
    op.drop_column('agent_config', 'router_complex_fallback_model')
    op.drop_column('agent_config', 'router_simple_fallback_model')
    op.drop_column('agent_config', 'model_settings')
    op.drop_column('agent_config', 'handoff_enabled')
    op.drop_column('agent_config', 'inbox_capture_enabled')
