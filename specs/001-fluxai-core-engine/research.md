# Research: Motor FluxAI Core Engine

## Decision: Roteamento Híbrido (Simple vs Complex)

**Rationale**: Para equilibrar custo e inteligência, utilizaremos um padrão de **Classifier-Router** no LangGraph.
- **Decision**: Um nó inicial chamado `Router` executará uma lógica híbrida: primeiro checa limiares configurados (regex/palavras-chave definidos pelo Admin no FR-002a) e, se inconclusivo, utiliza o Cérebro Rápido em um "Evaluation Call" de baixo custo para classificar a tarefa como `SIMPLE` ou `COMPLEX`.
- **Alternatives considered**: 
    - *Full LLM routing*: Rejeitado por adicionar latência excessiva em perguntas óbvias.
    - *Static thresholds only*: Rejeitado por não ser flexível o suficiente para nuances de linguagem.

## Decision: Auditoria de Configurações (Audit Log)

**Rationale**: A Constituição (III e VI) exige auditoria completa e financeira.
- **Decision**: Implementaremos o Audit Log via **Application Logic (Service Layer)** no `backend/services/security_service.py` usando transações SQLAlchemy coordenadas. Isso garante que o log contenha o contexto do usuário e do Admin de forma rica (JSON payload com before/after values). Para imutabilidade, a tabela `audit_logs` terá permissões de banco de dados restritas (apenas INSERT).
- **Alternatives considered**:
    - *DB Triggers*: Rejeitado por ser mais difícil de manter as regras de negócio e capturar o ID do Admin em contextos assíncronos complexos sem bibliotecas pesadas de context propagation.

## Decision: Gestão de Estado e Sessão

**Rationale**: A Constituição (IV) exige resiliência e a US05 exige vigilância contra loops (statefulness).
- **Decision**: Utilizaremos o **LangGraph `PostgresSaver`** como checkpointer oficial. Isso permite que a sessão sobreviva a reinicializações e seja compartilhada entre múltiplos workers TaskIQ. A detecção de loops será feita injetando o histórico da sessão no nó classificador do LangGraph.
- **Alternatives considered**:
    - *Redis*: Rejeitado para evitar adicionar uma dependência extra de infra (RabbitMQ já está na stack para filas, PostgreSQL para dados). O Postgres com `pgvector` já é a peça central da infraestrutura.

## Decision: Vigilância de Sessão (Loop Detection)

**Rationale**: US05 exige evitar redundância.
- **Decision**: Implementaremos um `State` no LangGraph que mantém os hashes das últimas 5 mensagens/respostas. Um nó de controle verificará a contagem de hashes idênticos. Se chegar a 3, o grafo desvia para um nó de `LoopMitigation`.
