# Feature Specification: Painel de Controle de Processos (Background)

**Feature Branch**: `006-background-process-monitor`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Painel de Controle de Processos (Background)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitoramento em Tempo Real: Visualização de Progresso Ponderado (Priority: P1)

**Description**: O usuário ou sistema enxerga a barra de progresso sendo atualizada em tempo real considerando o peso de cada etapa.

**Why this priority**: It is the core functional display mapping backend state to UX for long processes.

**Independent Test**: Can be independently tested by firing a mock task that increments progress on predefined weights.

**Acceptance Scenarios**:

1. **Given** Que o sistema disparou um processo composto por 3 etapas (Upload 30%, Processamento IA 60%, Persistência 10%).
2. **When** O "Upload" atingir 50% de sua conclusão individual.
3. **Then** A barra de progresso global deve exibir 15% (30% x 0.5) e o texto abaixo deve indicar "Etapa: Upload de Arquivo".

---

### User Story 2 - Notificação de Conclusão (Priority: P1)

**Description**: Obter feedback assíncrono de término do processo, independentemente da página atual.

**Why this priority**: Non-blocking UX requires the user to continue working while background tasks run. 

**Independent Test**: Can be tested by navigating to another route while a mock process hits its terminal/completed state via WebSocket.

**Acceptance Scenarios**:

1. **Given** Que o usuário está navegando em outra página do sistema.
2. **When** Um processo em background for finalizado com sucesso.
3. **Then** O sistema deve exibir um Snackbar (Toast) informativo e atualizar o contador de notificações (Badge) no menu superior.

---

### User Story 3 - Acesso a Logs Hierárquicos (Priority: P2)

**Description**: Permitir que usuários ou administradores analisem logs detalhados quando um processo falha.

**Why this priority**: Essential for diagnosis in complex multi-step pipelines (like AI integration).

**Independent Test**: Can be tested by forcing an error in a task step and checking if the expansion section of the UI handles the metadata payload correctly.

**Acceptance Scenarios**:

1. **Given** Que um processo de LangGraph falhou na etapa "Análise de Sentimento".
2. **When** O usuário clicar em "Expandir Logs".
3. **Then** O sistema deve apresentar as etapas agrupadas, permitindo expandir especificamente a etapa de falha para visualizar o output técnico do TaskIQ.

---

### User Story 4 - Retry Inteligente (Checkpointing) (Priority: P2)

**Description**: Evitar o retrabalho quando um pipeline falha no meio do processo, reiniciando apenas da falha.

**Why this priority**: Cost optimization by not re-running expensive steps (e.g. LLM invocations).

**Independent Test**: Can be tested by pausing/failing a mock pipeline, then triggering the resume endpoint with the failed execution ID.

**Acceptance Scenarios**:

1. **Given** Um processo interrompido por erro na Etapa 3.
2. **When** O usuário clicar no botão "Tentar Novamente".
3. **Then** O sistema deve invocar a task enviando o último estado válido, reiniciando o processamento a partir da etapa de falha, sem repetir as etapas 1 e 2.

---

### User Story 5 - Limpeza de Histórico Selecionada (Priority: P3)

**Description**: Permitir a exclusão em massa ou manual de processos finalizados.

**Why this priority**: Ensures system database doesn't become overly burdened, and users have agency over historical data.

**Independent Test**: Can be tested by selecting rows in the datagrid and triggering batch delete.

**Acceptance Scenarios**:

1. **Given** Uma lista de 10 processos finalizados.
2. **When** O Dono / Admin selecionar 3 itens e clicar em "Limpar Histórico".
3. **Then** O sistema deve remover os registros do banco de dados e atualizar a interface imediatamente.

### Edge Cases

- **Queda de Conexão (Client)**: Ao reconectar, o frontend deve buscar o último estado persistido no banco e retomar a animação do progresso.
- **Timeout de Etapa IA**: Se o LangGraph não responder em X segundos, o status muda para "Erro" e o log deve capturar o erro de timeout.
- **Cancelamento Manual**: Se o usuário cancelar, a task no TaskIQ deve ser abortada (SIGTERM) e o status marcado como "Cancelado".
- **Limpeza de Processo Ativo**: O sistema deve impedir a exclusão de processos com status "Processando".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 - Persistência de Estado**: O sistema deve armazenar o status, progresso e logs de cada tarefa no banco de dados para consulta assíncrona.
- **FR-002 - Comunicação Real-time**: A interface deve utilizar WebSockets ou Long Polling para atualizar a barra de progresso sem necessidade de refresh.
- **FR-003 - Configuração de Retenção**: O sistema deve executar um worker diário para deletar registros que ultrapassarem o limite de dias definido nas configurações globais.
- **FR-004 - Controle de Acesso**: O sistema deve validar se o `user_id` da requisição de deleção é o proprietário do processo ou possui a flag `is_admin`.
- **FR-005 - Integração LangGraph/TaskIQ**: O backend deve mapear os states do LangGraph para as etapas da barra de progresso definida na spec.

### Key Entities

- **Process**: `id`, `user_id`, `name`, `type` (Upload/AI/DB), `status`, `total_progress`, `current_step_name`.
- **Step**: `id`, `process_id`, `name`, `weight` (%), `order`, `status`.
- **LogEntry**: `id`, `step_id`, `level` (INFO/ERROR), `message`, `metadata` (JSON técnico), `timestamp`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário deve ser capaz de identificar a etapa exata de erro em menos de 3 cliques.
- **SC-002**: A barra de progresso deve refletir o estado do backend com latência inferior a 1 segundo.
- **SC-003**: 100% dos processos que falham por erro de infraestrutura devem ser passíveis de "Retry" a partir do último checkpoint.

## Assumptions

- We assume TaskIQ is handling the underlying task execution queue.
- WebSocket streaming logic assumes a robust reconaissance channel via standard HTTP fallback (e.g. standard polling behavior or auto-reconnect logic in frontend) is handled natively by the chosen real-time library.
