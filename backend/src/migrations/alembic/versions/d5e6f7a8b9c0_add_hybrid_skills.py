"""add hybrid skills

Revision ID: d5e6f7a8b9c0
Revises: ccf39c73e9d2
Create Date: 2026-04-08 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import pgvector.sqlalchemy

# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = 'ccf39c73e9d2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    skill_type_enum = postgresql.ENUM('documental', 'hibrida', name='skilltype')
    skill_type_enum.create(op.get_bind(), checkfirst=True)
    
    skill_status_enum = postgresql.ENUM('draft', 'active', 'archived', name='skillstatus')
    skill_status_enum.create(op.get_bind(), checkfirst=True)
    
    skill_version_status_enum = postgresql.ENUM('processing', 'active', 'attention', 'error', name='skillversionstatus')
    skill_version_status_enum.create(op.get_bind(), checkfirst=True)
    
    source_type_enum = postgresql.ENUM('pdf', 'txt', 'excel', 'csv', 'audio', 'video', name='sourcetype')
    source_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'skills',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('type', skill_type_enum, nullable=False),
        sa.Column('status', skill_status_enum, nullable=False),
        sa.Column('active_version_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'skill_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('skill_id', sa.UUID(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('status', skill_version_status_enum, nullable=False),
        sa.Column('source_count', sa.Integer(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('activated_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'skill_sources',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('skill_version_id', sa.UUID(), nullable=False),
        sa.Column('source_type', source_type_enum, nullable=False),
        sa.Column('source_uri', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('checksum', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['skill_version_id'], ['skill_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'vector_chunks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('skill_version_id', sa.UUID(), nullable=False),
        sa.Column('skill_source_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', pgvector.sqlalchemy.Vector(dim=1536), nullable=True),
        sa.Column('product_id', sa.String(), nullable=True),
        sa.Column('chunk_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['skill_source_id'], ['skill_sources.id'], ),
        sa.ForeignKeyConstraint(['skill_version_id'], ['skill_versions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('skill_version_id', 'product_id', 'chunk_hash', name='uq_vector_chunk_hash')
    )

    op.create_foreign_key('fk_skills_active_version_id', 'skills', 'skill_versions', ['active_version_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_skills_active_version_id', 'skills', type_='foreignkey')
    op.drop_table('vector_chunks')
    op.drop_table('skill_sources')
    op.drop_table('skill_versions')
    op.drop_table('skills')
    
    op.execute('DROP TYPE IF EXISTS sourcetype')
    op.execute('DROP TYPE IF EXISTS skillversionstatus')
    op.execute('DROP TYPE IF EXISTS skillstatus')
    op.execute('DROP TYPE IF EXISTS skilltype')
