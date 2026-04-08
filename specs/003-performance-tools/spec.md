# Feature Specification: Performance & Aprimoramento (Módulo 3)

**Feature Branch**: `003-performance-tools`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Performance & Aprimoramento (Módulo 3)"

## Clarifications

### Session 2026-04-08

- Q: Should access to the Inbox de Dúvidas be limited to specific operational roles or available to all authenticated users? → A: Admin and limited support users can access the Inbox, but not general end users.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stress Test Simulation (Priority: P1)

Como Admin, quero configurar uma simulação de conversa entre IAs usando personas específicas e histórico de erros, para que eu possa identificar fragilidades no agente sem expor clientes reais a falhas.

**Why this priority**: Esta funcionalidade oferece diagnóstico proativo e reduz risco operacional, sendo o principal motor de melhoria de qualidade do agente.

**Independent Test**: A funcionalidade é testável ao executar uma simulação de stress test e verificar o lançamento de uma tarefa assíncrona, progresso visível e relatório resultante.

**Acceptance Scenarios**:

1. **Given** que o Admin está na tela de Fine-Tuning, **When** seleciona uma persona e importa logs de conversas com baixo score, **Then** o sistema inicia um processo em background e exibe o progresso em tempo real.
2. **Given** que a simulação foi iniciada, **When** a tarefa do TaskIQ avança, **Then** a interface deve atualizar o status e a porcentagem de progresso com latência inferior a 3 segundos.

---

### User Story 2 - Curadoria no Inbox de Dúvidas (Priority: P1)

Como Admin ou usuário de curadoria, quero revisar falhas agrupadas por impacto, para que eu possa corrigir as lacunas de conhecimento mais críticas rapidamente.

**Why this priority**: A curadoria humana com foco em falhas reais é essencial para transformar dados de erro em correções efetivas e melhorar a confiança no agente.

**Independent Test**: A funcionalidade é testável ao acessar o Inbox, verificar o agrupamento por similaridade e editar/aprovar sugestões antes de salvar.

**Acceptance Scenarios**:

1. **Given** que falhas foram identificadas por stress test ou chats reais, **When** o usuário abre o Inbox, **Then** o sistema mostra erros similares agrupados no topo e sugere uma resposta ideal.
2. **Given** uma sugestão de resposta ideal, **When** o usuário aceita ou edita essa resposta, **Then** ele pode salvar a versão final na base de conhecimento.

---

### User Story 3 - Governaça de Falhas e Correções (Priority: P2)

Como Admin, quero descartar ou bloquear temas incoerentes antes que entrem no RAG, para que a base de conhecimento permaneça confiável e o agente não aprenda respostas erradas.

**Why this priority**: Esse controle protege a qualidade do RAG e previne que conteúdo inadequado ou incoerente seja propagado pelo agente.

**Independent Test**: A funcionalidade é testável ao simular uma sugestão incoerente no Inbox e verificar se as ações de descartar ou bloquear tema impedem a persistência no RAG.

**Acceptance Scenarios**:

1. **Given** uma sugestão de IA incoerente, **When** o usuário seleciona "Descartar" ou "Bloquear Tema", **Then** a falha não é salva como correção e o conteúdo é impedido de alimentar o RAG.
2. **Given** um conflito de versão durante a atualização do RAG, **When** o usuário salva uma correção, **Then** o sistema mantém o agente online e versiona a base sem downtime.

---

### Edge Cases

- **Simulação Travada**: Se um Stress Test exceder o tempo esperado, o TaskIQ deve marcar o status como "Erro", permitir um retry e gerar um log técnico para o dono do processo.
- **Sugestão de IA Incoerente**: Se uma sugestão automática for absurda, o usuário deve poder descartar ou bloquear o tema, evitando que ele alimente o RAG.
- **Conflito de Versão no RAG**: Ao salvar uma correção do Inbox, o sistema deve versionar a base para que o agente continue online durante a atualização.
- **Falha de Agrupamento**: Se dúvidas semelhantes não puderem ser agrupadas automaticamente, o sistema deve apresentar as entradas individualmente e permitir curadoria manual.
- **Tarefa de Background Perdida**: Se o progresso do TaskIQ não puder ser recuperado, o sistema deve sinalizar erro e oferecer uma reexecução do teste.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema deve permitir a configuração de personas para o Stress Test, incluindo parâmetros de comportamento e perfil de interação.
- **FR-002**: O TaskIQ deve persistir o progresso de cada tarefa de stress test e ingestão para visualização no Dashboard de Processos.
- **FR-003**: O sistema deve agrupar itens no Inbox de Dúvidas por similaridade de erro e impacto de repetição.
- **FR-004**: O usuário deve poder editar manualmente qualquer resposta sugerida antes de salvar a versão final na base de conhecimento.
- **FR-005**: O sistema deve gerar relatórios de Stress Test em formato Markdown legível.
- **FR-006**: O Inbox deve oferecer ações de "Aceitar", "Descartar" e "Bloquear Tema" para sugestões de IA incoerentes.
- **FR-007**: O sistema deve criar um card correspondente no Inbox para cada erro detectado no Stress Test.
- **FR-008**: O processo de atualização da base de conhecimento deve suportar versionamento para evitar downtime do agente.
- **FR-009**: O acesso ao Inbox de Dúvidas deve ser restrito a Admins e usuários de curadoria autorizados.

### Key Entities *(include if feature involves data)*

- **StressTest_Session**: Representa uma execução de teste com atributos como ID, Persona_Config, Status, Progress_Percentage e Relatorio_MD_Link.
- **Inbox_Item**: Representa uma falha ou dúvida detectada, com Pergunta_Original, Falha_Detectada, Sugestao_IA, Resposta_Final_Usuario, Frequencia_Erro e Status.
- **Background_Task**: Representa uma tarefa do TaskIQ com ID, Tipo (Ingestão/StressTest), Log_Tecnico, Timestamp_Inicio e Timestamp_Fim.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O status de qualquer Stress Test é atualizado na interface em menos de 3 segundos após a mudança de estado.
- **SC-002**: Um Admin pode resolver um grupo de 10 falhas semelhantes em no máximo 2 cliques, aprovando e aplicando a correção.
- **SC-003**: 100% dos erros encontrados em Stress Tests geram um card correspondente no Inbox de Dúvidas.
- **SC-004**: Sugestões de IA no Inbox podem ser aceitas ou editadas antes de serem salvas na base de conhecimento.
- **SC-005**: O sistema detecta e marca automaticamente tarefas travadas ou com timeout como erro, com opção de retry.

## Assumptions

- A funcionalidade será utilizada por Admins e usuários de curadoria familiarizados com ferramentas internas de monitoramento.
- O módulo de Stress Test é focado em simulações internas e não deve substituir testes com clientes reais.
- O sistema atual já possui autenticação e acesso controlado para o painel de curadoria e dashboards de processos.
- O acesso ao Inbox de Dúvidas é limitado a Admins e usuários de curadoria autorizados.
- Versionamento de base de conhecimento é implementado como parte da governança do RAG, evitando downtime durante atualizações.
