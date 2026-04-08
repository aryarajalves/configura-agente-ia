import pytest
from sqlalchemy import select, text
from models import SessionSummary, AgentConfigModel

@pytest.mark.asyncio
async def test_session_summary_columns_exist(db_session):
    """Verifica se as colunas is_test_session e test_report existem na tabela session_summaries."""
    # Consulta direta ao schema do banco
    # Nota: No PostgreSQL via asyncpg, table_name deve ser exato
    result = await db_session.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'session_summaries' AND (column_name = 'is_test_session' OR column_name = 'test_report')"
    ))
    columns = [row[0] for row in result.fetchall()]
    
    assert 'is_test_session' in columns, f"Coluna is_test_session não encontrada. Colunas achadas: {columns}"
    assert 'test_report' in columns, f"Coluna test_report não encontrada. Colunas achadas: {columns}"

@pytest.mark.asyncio
async def test_session_summary_save_and_load(db_session):
    """Verifica se conseguimos salvar e carregar dados nas novas colunas."""
    # Criar um agente primeiro
    agent = AgentConfigModel(name="Test Schema Agent")
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)

    test_session_id = f"schema_test_{agent.id}"
    test_report_data = {"score": 85, "details": "Tudo ok"}
    
    summary = SessionSummary(
        session_id=test_session_id,
        agent_id=agent.id,
        summary_text="Resumo de teste",
        is_test_session=True,
        test_report=test_report_data
    )
    db_session.add(summary)
    await db_session.commit()

    # Buscar do banco
    stmt = select(SessionSummary).where(SessionSummary.session_id == test_session_id)
    result = await db_session.execute(stmt)
    retrieved = result.scalar_one()

    assert retrieved.is_test_session is True
    assert retrieved.test_report == test_report_data
