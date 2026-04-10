"""rename_skills_to_knowledge_bases

Revision ID: 008_rename_skills_to_knowledge_bases
Revises: 
Create Date: 2026-04-10

Renames:
  skills            -> knowledge_bases
  skill_versions    -> knowledge_base_versions
  skill_sources     -> knowledge_base_sources
  
And updates all FK columns and constraint names accordingly.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_rename_skills_to_knowledge_bases'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Rename all Skill* tables and columns to KnowledgeBase* equivalents."""

    # ── 1. Drop FK constraints that reference old table names ──────────────────
    # skills.active_version_id FK → skill_versions.id
    op.drop_constraint('skills_active_version_id_fkey', 'skills', type_='foreignkey')

    # skill_versions.skill_id FK → skills.id
    op.drop_constraint('skill_versions_skill_id_fkey', 'skill_versions', type_='foreignkey')

    # skill_sources.skill_version_id FK → skill_versions.id
    op.drop_constraint('skill_sources_skill_version_id_fkey', 'skill_sources', type_='foreignkey')

    # vector_chunks FKs
    try:
        op.drop_constraint('vector_chunks_skill_version_id_fkey', 'vector_chunks', type_='foreignkey')
        op.drop_constraint('vector_chunks_skill_source_id_fkey', 'vector_chunks', type_='foreignkey')
    except Exception:
        pass  # Might already be gone or named differently

    # ── 2. Rename tables ────────────────────────────────────────────────────────
    op.rename_table('skills', 'knowledge_bases')
    op.rename_table('skill_versions', 'knowledge_base_versions')
    op.rename_table('skill_sources', 'knowledge_base_sources')

    # ── 3. Rename FK columns inside renamed tables ─────────────────────────────
    # knowledge_base_versions: skill_id → knowledge_base_id
    op.alter_column('knowledge_base_versions', 'skill_id',
                    new_column_name='knowledge_base_id',
                    existing_type=sa.UUID())

    # knowledge_base_sources: skill_version_id → knowledge_base_version_id
    op.alter_column('knowledge_base_sources', 'skill_version_id',
                    new_column_name='knowledge_base_version_id',
                    existing_type=sa.UUID())

    # vector_chunks: skill_version_id → knowledge_base_version_id
    try:
        op.alter_column('vector_chunks', 'skill_version_id',
                        new_column_name='knowledge_base_version_id',
                        existing_type=sa.UUID())
        op.alter_column('vector_chunks', 'skill_source_id',
                        new_column_name='knowledge_base_source_id',
                        existing_type=sa.UUID())
    except Exception:
        pass

    # ── 4. Recreate FK constraints with new names ──────────────────────────────
    # knowledge_bases.active_version_id → knowledge_base_versions.id
    op.create_foreign_key(
        'knowledge_bases_active_version_id_fkey',
        'knowledge_bases', 'knowledge_base_versions',
        ['active_version_id'], ['id']
    )

    # knowledge_base_versions.knowledge_base_id → knowledge_bases.id
    op.create_foreign_key(
        'knowledge_base_versions_knowledge_base_id_fkey',
        'knowledge_base_versions', 'knowledge_bases',
        ['knowledge_base_id'], ['id']
    )

    # knowledge_base_sources.knowledge_base_version_id → knowledge_base_versions.id
    op.create_foreign_key(
        'knowledge_base_sources_knowledge_base_version_id_fkey',
        'knowledge_base_sources', 'knowledge_base_versions',
        ['knowledge_base_version_id'], ['id']
    )

    # vector_chunks FKs
    try:
        op.create_foreign_key(
            'vector_chunks_knowledge_base_version_id_fkey',
            'vector_chunks', 'knowledge_base_versions',
            ['knowledge_base_version_id'], ['id']
        )
        op.create_foreign_key(
            'vector_chunks_knowledge_base_source_id_fkey',
            'vector_chunks', 'knowledge_base_sources',
            ['knowledge_base_source_id'], ['id']
        )
    except Exception:
        pass

    # ── 5. Rename unique constraint on vector_chunks ───────────────────────────
    try:
        op.drop_constraint('uq_vector_chunk_hash', 'vector_chunks', type_='unique')
        op.create_unique_constraint(
            'uq_vector_chunk_hash',
            'vector_chunks',
            ['knowledge_base_version_id', 'product_id', 'chunk_hash']
        )
    except Exception:
        pass

    # ── 6. Rename Enum types (PostgreSQL) ─────────────────────────────────────
    # These are the SQLAlchemy-generated enum type names
    try:
        op.execute("ALTER TYPE skilltype RENAME TO knowledgebasetype")
    except Exception:
        pass
    try:
        op.execute("ALTER TYPE skillstatus RENAME TO knowledgebasestatus")
    except Exception:
        pass
    try:
        op.execute("ALTER TYPE skillversionstatus RENAME TO knowledgebaseversionstatus")
    except Exception:
        pass


def downgrade() -> None:
    """Revert: knowledge_base* → skill* names."""

    # Drop new FK constraints
    op.drop_constraint('knowledge_bases_active_version_id_fkey', 'knowledge_bases', type_='foreignkey')
    op.drop_constraint('knowledge_base_versions_knowledge_base_id_fkey', 'knowledge_base_versions', type_='foreignkey')
    op.drop_constraint('knowledge_base_sources_knowledge_base_version_id_fkey', 'knowledge_base_sources', type_='foreignkey')

    try:
        op.drop_constraint('vector_chunks_knowledge_base_version_id_fkey', 'vector_chunks', type_='foreignkey')
        op.drop_constraint('vector_chunks_knowledge_base_source_id_fkey', 'vector_chunks', type_='foreignkey')
    except Exception:
        pass

    # Rename columns back
    op.alter_column('knowledge_base_versions', 'knowledge_base_id', new_column_name='skill_id', existing_type=sa.UUID())
    op.alter_column('knowledge_base_sources', 'knowledge_base_version_id', new_column_name='skill_version_id', existing_type=sa.UUID())
    try:
        op.alter_column('vector_chunks', 'knowledge_base_version_id', new_column_name='skill_version_id', existing_type=sa.UUID())
        op.alter_column('vector_chunks', 'knowledge_base_source_id', new_column_name='skill_source_id', existing_type=sa.UUID())
    except Exception:
        pass

    # Rename tables back
    op.rename_table('knowledge_bases', 'skills')
    op.rename_table('knowledge_base_versions', 'skill_versions')
    op.rename_table('knowledge_base_sources', 'skill_sources')

    # Recreate original FK constraints
    op.create_foreign_key('skills_active_version_id_fkey', 'skills', 'skill_versions', ['active_version_id'], ['id'])
    op.create_foreign_key('skill_versions_skill_id_fkey', 'skill_versions', 'skills', ['skill_id'], ['id'])
    op.create_foreign_key('skill_sources_skill_version_id_fkey', 'skill_sources', 'skill_versions', ['skill_version_id'], ['id'])

    # Rename enum types back
    try:
        op.execute("ALTER TYPE knowledgebasetype RENAME TO skilltype")
        op.execute("ALTER TYPE knowledgebasestatus RENAME TO skillstatus")
        op.execute("ALTER TYPE knowledgebaseversionstatus RENAME TO skillversionstatus")
    except Exception:
        pass
