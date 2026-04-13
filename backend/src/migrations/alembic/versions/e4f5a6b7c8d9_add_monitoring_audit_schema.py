"""Add monitoring and audit schema additions (Module 4)

Revision ID: e4f5a6b7c8d9
Revises: d5e6f7a8b9c0
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'e4f5a6b7c8d9'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Extend audit_logs ---
    op.add_column('audit_logs', sa.Column('target_entity_type', sa.String(), nullable=True))
    op.add_column('audit_logs', sa.Column('target_entity_id', UUID(as_uuid=True), nullable=True))
    op.add_column('audit_logs', sa.Column('deleted_user_display', sa.String(), nullable=True))
    # Make agent_id nullable (audit entries may reference non-agent entities)
    op.alter_column('audit_logs', 'agent_id', existing_type=UUID(as_uuid=True), nullable=True)

    # --- Create financial_records ---
    op.create_table(
        'financial_records',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('agent_id', UUID(as_uuid=True), sa.ForeignKey('agents.id'), nullable=False, index=True),
        sa.Column('skill_id', UUID(as_uuid=True), sa.ForeignKey('skills.id'), nullable=True, index=True),
        sa.Column('token_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('estimated_cost', sa.Numeric(precision=12, scale=6), nullable=False, server_default='0'),
        sa.Column('type', sa.Enum('chat', 'fine_tuning', 'ingestion', name='financialrecordtype'), nullable=False),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # --- Create system_settings ---
    op.create_table(
        'system_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('retention_period_days', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('storage_threshold_alert', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('last_cleanup_timestamp', sa.DateTime(), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # --- Create cleanup_jobs ---
    op.create_table(
        'cleanup_jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('task_name', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'running', 'success', 'failed', name='cleanupjobstatus'), nullable=False),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.Column('failure_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # --- Create container_health_metrics ---
    op.create_table(
        'container_health_metrics',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('disk_usage_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('memory_usage_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now(), index=True),
        sa.Column('container_id', sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('container_health_metrics')
    op.drop_table('cleanup_jobs')
    op.drop_table('system_settings')
    op.drop_table('financial_records')

    op.drop_column('audit_logs', 'deleted_user_display')
    op.drop_column('audit_logs', 'target_entity_id')
    op.drop_column('audit_logs', 'target_entity_type')
    op.alter_column('audit_logs', 'agent_id', existing_type=UUID(as_uuid=True), nullable=False)

    # Clean up enums
    sa.Enum(name='financialrecordtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='cleanupjobstatus').drop(op.get_bind(), checkfirst=True)
