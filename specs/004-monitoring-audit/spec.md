# Feature Specification: Monitorização e Auditoria (Módulo 4)

**Feature Branch**: `004-monitoring-audit`  
**Created**: 2026-04-08  
**Status**: Ready for Dev  
**Input**: User description: "Monitorização e Auditoria (Módulo 4): camada de governança que consolida custos operacionais, monitora atividade da equipe e gerencia saúde do servidor on-premise em Docker com políticas de retenção configuráveis."

## Clarifications

### Session 2026-04-08

- Q: O custo exibido no dashboard deve ser validado contra uma fatura externa ou por estimativa interna de tokens? → A: Validar usando uma estimativa interna de tokens derivada das regras de preço do provedor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retenção de Dados de Auditoria e Logs (Priority: P1)

Como Dono, quero definir o prazo de validade dos logs e arquivos temporários para garantir que o servidor não fique sem espaço em disco.

**Why this priority**: A retenção automática é a base da governança e evita falhas operacionais por falta de espaço, tornando o sistema sustentável a longo prazo.

**Independent Test**: Ajustar o prazo de retenção nas configurações de sistema e verificar que uma tarefa de limpeza agendada remove arquivos antigos sem afetar o serviço de chat.

**Acceptance Scenarios**:

1. **Given** o Dono acessa as Configurações de Sistema, **When** seleciona um período de retenção e salva, **Then** o sistema agenda uma tarefa no TaskIQ para remover logs e arquivos temporários que excedam o prazo diariamente.
2. **Given** o uso de disco atinge 90% da capacidade, **When** o sistema monitora o contêiner, **Then** o Dashboard exibe um alerta visual claro para o Dono.

---

### User Story 2 - Análise de Custos Granular por Agente (Priority: P2)

Como Dono, quero visualizar um resumo de gastos e detalhar custos de um agente específico para entender onde o orçamento de IA está sendo alocado.

**Why this priority**: O controle financeiro permite decisões mais informadas sobre uso de agentes e ajuda a evitar despesas desnecessárias.

**Independent Test**: Abrir o Dashboard Financeiro, selecionar um agente e verificar se o detalhamento mostra gastos por habilidade e volume de tokens consumidos.

**Acceptance Scenarios**:

1. **Given** o Dono abre o Dashboard Financeiro, **When** clica em um agente na lista de resumo de gastos, **Then** o sistema exibe o detalhamento de custos por habilidade (RAG, Stress Test, Chat) e o volume de tokens usados.
2. **Given** não há dados financeiros para um agente, **When** o Dono visualiza o relatório, **Then** o sistema mostra um estado vazio claro explicando que não há registros disponíveis.

---

### User Story 3 - Auditoria de Ações da Equipe (Priority: P3)

Como Dono, quero ver uma lista cronológica de quem alterou as configurações do sistema para auditar ações de Admins e Usuários.

**Why this priority**: A trilha de auditoria garante responsabilidade e permite investigar alterações críticas no sistema.

**Independent Test**: Acessar a tela de Logs de Auditoria, aplicar filtros de data ou usuário e confirmar que as entradas retornadas incluem usuário, ação e horário.

**Acceptance Scenarios**:

1. **Given** o Dono acessa a tela de Logs de Auditoria, **When** filtra por data ou usuário, **Then** o sistema lista Nome do Usuário, Ação Realizada e Horário Exato.
2. **Given** um usuário foi excluído, **When** a ação dele aparece no log, **Then** o nome é preservado com a marcação "(Removido)" até o fim do prazo de retenção.

---

### Edge Cases

- **Disco Próximo ao Limite**: Se o uso de disco do contêiner ultrapassar 90%, o Dashboard deve mostrar um alerta visual para o Dono e manter o serviço de chat operacional.
- **Erro na Limpeza (TaskIQ)**: Se a tarefa de retenção falhar, o sistema deve registrar o erro e tentar novamente no próximo ciclo; após 3 falhas seguidas, deve notificar o Dono.
- **Ação por Usuário Deletado**: Logs de auditoria de usuários removidos devem ser preservados até o fim do prazo de retenção e exibir o nome com a marcação "(Removido)".
- **Filtro Sem Resultados**: Se um filtro de auditoria não encontrar entradas, o sistema deve mostrar uma mensagem de estado vazio com orientação para ajustar os critérios.
- **Dados de Custo Incompletos**: Se registros financeiros estiverem ausentes ou incompletos, o dashboard deve exibir valores parciais com aviso sobre dados faltantes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema deve registrar toda alteração em agentes, habilidades e usuários com o ID do autor e o timestamp da ação.
- **FR-002**: O sistema deve oferecer uma configuração de política de retenção de dados para logs de auditoria e arquivos temporários, incluindo prazo de retenção e limites de alerta, armazenando essas preferências em `SystemSettings`.
- **FR-003**: O dashboard financeiro deve exibir um resumo de gastos e permitir detalhar custos de um agente por habilidade e volume de tokens consumidos.
- **FR-004**: O sistema deve permitir a exportação dos registros financeiros em formato CSV para contabilidade externa.
- **FR-005**: Deve existir uma tarefa automática diária via TaskIQ que execute a limpeza de logs e registros que excederem o prazo de retenção.
- **FR-006**: O monitoramento deve incluir uso de disco e memória do contêiner Docker onde o serviço está hospedado, com alertas visuais quando atingir limites definidos.
- **FR-009**: O sistema deve rastrear falhas consecutivas da tarefa de retenção e notificar o Dono após 3 falhas seguidas.
- **FR-007**: O sistema deve preservar logs de auditoria de usuários excluídos até o fim do prazo de retenção, marcando-os como "(Removido)".
- **FR-008**: O sistema deve permitir filtrar logs de auditoria por data, usuário e tipo de ação, e exibir resultados cronologicamente.

### Key Entities *(include if feature involves data)*

- **AuditLog**: Registro de eventos de auditoria contendo ID, User_ID, Action_Description, Target_Entity, Timestamp, e status de retenção.
- **FinancialRecord**: Registro financeiro contendo ID, Agent_ID, Skill_ID, Token_Count, Estimated_Cost, Type (Chat/Fine-Tuning/Ingestion), e Timestamp.
- **SystemSettings**: Configurações do sistema contendo Retention_Period_Days, Storage_Threshold_Alert, Last_Cleanup_Timestamp e outras políticas de governança.
- **RetentionTask / CleanupJob**: Agendamento diário de execução periódica para limpeza de registros e arquivos que excederam o prazo de retenção; em implementação, este trabalho é rastreado como `cleanup_job`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O custo exibido no dashboard deve estar dentro de 1% da estimativa interna de custo derivada da contagem de tokens e das regras de preço do provedor de LLM para o mesmo período de relatório.
- **SC-002**: A tarefa de retenção de dados deve ser executada dentro da janela diária agendada e não causar aumento superior a 10% no tempo de resposta médio do chat durante sua execução.
- **SC-003**: 100% das ações críticas de exclusão ou edição devem ser rastreáveis até um usuário específico no registro de auditoria.
- **SC-004**: O Dono deve receber um alerta visual quando o uso de disco do contêiner atingir 90% de capacidade.
- **SC-005**: A tela de auditoria deve retornar resultados cronológicos corretos e permitir filtrar por data ou usuário com latência inferior a 1 segundo em consultas que retornem até 100 registros.

## Assumptions

- O sistema já possui autenticação e registro de identidade de usuário que pode ser aproveitado para auditoria.
- Métricas de uso de disco e memória do contêiner Docker estão acessíveis ao serviço e podem ser coletadas no ambiente on-premise.
- O custo financeiro pode ser estimado a partir de contagem de tokens e categorias de serviço, com base nas regras de cobrança existentes.
- A limpeza de retenção é executada como uma tarefa agendada em segundo plano e não como parte de solicitações de usuário em tempo real.
- O recurso de exportação CSV deve ser compatível com formatos padrão de contabilidade sem exigir formatação proprietária.
