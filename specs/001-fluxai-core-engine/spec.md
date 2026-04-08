# Feature Specification: Motor FluxAI (Módulo 1)

**Feature Branch**: `001-fluxai-core-engine`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Motor FluxAI (Módulo 1) - Arquitetura Dois Cérebros com LangGraph, segurança multicamadas e governança de agentes"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configuração de Modelos Híbridos (Priority: P1)

Um Admin precisa configurar, para cada agente, dois modelos de linguagem que funcionam em parceria: um modelo ágil (Cérebro Rápido) para tarefas simples e de baixo custo, e um modelo mais poderoso (Cérebro Analítico) para tarefas que exigem raciocínio aprofundado. O sistema decide automaticamente qual model utilizar em cada interação, sem intervenção manual do Admin.

**Why this priority**: Esta é a funcionalidade central do Motor FluxAI. Sem ela, não é possível entregar otimização de custo/performance, que é o principal valor de negócio desta feature.

**Independent Test**: Pode ser testado criando um agente, configurando os dois modelos e verificando que respostas simples usam o modelo rápido enquanto perguntas complexas ativam o modelo analítico, entregando valor de custo reduzido e qualidade mantida.

**Acceptance Scenarios**:

1. **Dado** que o Admin está na tela de edição de um Agente, **quando** seleciona um modelo para "Cérebro Rápido" e outro para "Cérebro Analítico" e salva, **então** o sistema persiste ambas as configurações e exibe confirmação de sucesso.
2. **Dado** que um agente está configurado com dois modelos, **quando** o usuário final envia uma mensagem simples, **então** o orquestrador de inteligência roteia automaticamente para o Cérebro Rápido sem intervenção do Admin.
3. **Dado** que um agente está configurado com dois modelos, **quando** o usuário final envia uma mensagem que requer análise complexa, **então** o orquestrador roteia para o Cérebro Analítico e entrega uma resposta de maior qualidade.
4. **Dado** que a configuração de modelos é salva, **quando** o Admin retorna à tela de edição, **então** as seleções de Cérebro Rápido e Cérebro Analítico são exibidas conforme persistidas.

---

### User Story 2 - Gestão de Permissões e Bloqueio de Edição (Priority: P2)

Um SUPERADMIN que criou um agente precisa ter controle exclusivo sobre suas configurações, podendo bloquear que outros Admins do sistema alterem a automação que ele construiu. O SUPERADMIN mantém sempre acesso completo, independentemente do status de bloqueio.

**Why this priority**: Garante a integridade das configurações de agentes em ambientes multiusuário, evitando que trabalho crítico seja alterado acidentalmente ou intencionalmente por outros Admins.

**Independent Test**: Pode ser testado criando um agente com SUPERADMIN A, ativando o bloqueio de edição, e tentando editar o agente com Admin B — o sistema deve impedir a edição de Admin B mas permitir que SUPERADMIN A edite normalmente.

**Acceptance Scenarios**:

1. **Dado** que o SUPERADMIN criador está visualizando seu agente, **quando** ativa o toggle "Bloquear Edição Global", **então** o sistema registra o bloqueio e exibe o estado atualizado do toggle.
2. **Dado** que um agente tem edição global bloqueada, **quando** um Admin diferente do SUPERADMIN acessa a tela do agente, **então** todos os campos aparecem somente-leitura e os botões de salvar/editar estão desabilitados.
3. **Dado** que um agente tem edição global bloqueada, **quando** o SUPERADMIN acessa a tela do agente, **então** o SUPERADMIN mantém acesso total para editar, salvar e excluir o agente.
4. **Dado** que um agente tem edição global bloqueada, **quando** o SUPERADMIN desativa o toggle "Bloquear Edição Global", **então** o agente volta a ser editável por todos os Admins.

---

### User Story 3 - Governança e Guardlines de Segurança (Priority: P2)

Um Admin precisa definir regras de conteúdo para seu agente — incluindo tópicos proibidos e nomes de concorrentes — de modo que o agente nunca produza respostas fora do escopo comercial ou ético aprovado. O sistema deve bloquear automaticamente respostas violadoras e registrar as ocorrências sem alertar o usuário final sobre o mecanismo de controle.

**Why this priority**: Fundamental para conformidade comercial e ética. Sem Guardlines, o agente pode expor a empresa a riscos reputacionais e legais ao mencionar concorrentes ou tratar temas proibidos.

**Independent Test**: Pode ser testado configurando uma blacklist de concorrentes em um agente e verificando que um usuário que pergunte sobre um concorrente recebe a mensagem padrão bloqueadora, enquanto o log de auditoria registra a violação silenciosamente.

**Acceptance Scenarios**:

1. **Dado** que o Admin está no menu "Segurança" do agente, **quando** insere um ou mais termos na "Blacklist de Concorrentes", **então** o sistema persiste os termos e os exibe na lista.
2. **Dado** que uma resposta gerada pelo agente contém um termo da blacklist, **quando** o sistema executa a validação pós-geração, **então** a resposta é bloqueada e substituída pela mensagem padrão "Desculpe, não posso ajudar com esse assunto específico".
3. **Dado** que uma resposta é bloqueada por violação de Guardline, **quando** o evento ocorre, **então** o sistema registra no log de auditoria silencioso o ID do agente, o tipo de violação e o timestamp, sem nenhuma indicação visível ao usuário final sobre o bloqueio.
4. **Dado** que o Admin ativa o "Double Check por IA", **quando** uma resposta é gerada, **então** ela passa por uma camada adicional de análise antes de ser entregue ao usuário, e respostas que falham nessa análise são bloqueadas da mesma forma.

---

### User Story 4 - Fallback Automático em Falha de Modelo (Priority: P3)

Quando o modelo principal (Simples ou Analítico) falha por timeout ou erro de serviço externo, o sistema deve acionar automaticamente o modelo de fallback configurado, garantindo continuidade do atendimento sem que o usuário final perceba a falha.

**Why this priority**: É um requisito de resiliência que impede interrupções no atendimento, mas pode ser implementado em uma segunda iteração após os fluxos principais estarem funcionando.

**Independent Test**: Pode ser testado simulando uma falha/timeout do modelo principal e verificando que o fallback responde corretamente ao usuário dentro do SLA de tempo aceitável.

**Acceptance Scenarios**:

1. **Dado** que o modelo principal de um agente está inacessível (timeout ou erro), **quando** o orquestrador tenta processar uma mensagem, **então** o sistema automaticamente utiliza o modelo de fallback configurado para gerar a resposta.
2. **Dado** que o modelo principal está inacessível, **quando** o modelo de fallback também falha, **então** o sistema retorna ao usuário uma mensagem de indisponibilidade amigável e registra o evento no log de auditoria.

---

### User Story 5 - Vigilância de Sessão Contra Loops (Priority: P3)

O sistema deve detectar automaticamente quando um usuário está em um loop de mensagens repetitivas ou quando respostas idênticas estão sendo geradas, e tomar a ação corretiva adequada para preservar a coerência da conversa.

**Why this priority**: Melhora a qualidade da experiência do usuário e evita consumo desnecessário de processamento em conversas circulares.

**Independent Test**: Pode ser testado simulando um usuário enviando a mesma mensagem três vezes consecutivas e verificando que o sistema detecta o padrão e age de forma diferenciada na terceira ocorrência.

**Acceptance Scenarios**:

1. **Dado** que um usuário envia a mesma mensagem (ou semanticamente equivalente) repetidamente dentro da mesma sessão, **quando** o sistema detecta o padrão de loop após N repetições configuráveis, **então** o agente altera a estratégia de resposta ou informa o usuário que o tema já foi abordado.
2. **Dado** que o orquestrador geraria a mesma resposta já enviada anteriormente na sessão, **quando** detecta a redundância, **então** varia a resposta ou sinalizações adequadas para manter a coerência da conversa.

---

### Edge Cases

- **Falha no modelo principal**: Se o modelo "Rápido" ou "Analítico" não responder em **8 segundos** (timeout) ou retornar erro de serviço, o sistema aciona imediatamente o modelo de fallback definido. Se o fallback também falhar, retorna mensagem amigável de indisponibilidade e registra no log.
- **Conflito de edição simultânea**: Se dois Admins tentarem editar um agente desbloqueado ao mesmo tempo, o sistema aplica "Last Write Wins" (a última gravação persiste) e informa ao usuário cujas alterações foram sobrescritas.
- **Violação de Guardline**: Quando a resposta é bloqueada pelo Double Check ou Guardline, o sistema retorna obrigatoriamente a mensagem padrão "Desculpe, não posso ajudar com esse assunto específico" — nunca uma mensagem vazia ou erro técnico.
- **Configuração incompleta de modelos**: Se o Admin salvar um agente sem configurar ambos os modelos, o sistema deve alertar sobre a configuração incompleta e impedir a ativação do agente.
- **Blacklist vazia**: Se as Guardlines estiverem ativas mas a blacklist estiver vazia, o sistema funciona normalmente sem bloquear respostas — a Guardline só é acionada quando há termos cadastrados.
- **Admin sem agentes próprios**: Um Admin sem agentes criados não tem acesso ao toggle de bloqueio (que não se aplica ao seu contexto).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que o Admin configure um par de modelos de linguagem (Rápido e Analítico) para cada agente individualmente.
- **FR-002**: O orquestrador de inteligência DEVE decidir qual modelo (Rápido ou Analítico) processar cada mensagem com base em um mecanismo híbrido: a lógica nativa do orquestrador avalia a complexidade de cada tarefa, e o Admin pode configurar parâmetros de limiar adicionais (ex.: palavras-chave de escalada, tamanho mínimo de mensagem) que sobrepõem ou complementam a decisão automática.
- **FR-002a**: O Admin DEVE poder configurar, por agente, pelo menos um parâmetro de limiar de roteamento (ex.: tamanho de mensagem, lista de palavras-chave que forçam o uso do Cérebro Analítico); parâmetros não configurados assumem os valores padrão do orquestrador.
- **FR-003**: O sistema DEVE persistir todas as configurações de agente (modelos, regras de segurança, permissões) de forma durável, sobrevivendo a reinicializações do serviço.
- **FR-004**: O SUPERADMIN de um agente DEVE poder ativar ou desativar o bloqueio de edição global para seu agente a qualquer momento.
- **FR-005**: O sistema DEVE impedir que Admins não-donos editem ou salvem alterações em agentes com bloqueio de edição ativo.
- **FR-006**: O SUPERADMIN de um agente com bloqueio ativo DEVE manter acesso completo de leitura, edição e exclusão.
- **FR-007**: O sistema DEVE permitir que o Admin configure uma lista de termos e concorrentes proibidos (Blacklist) para cada agente.
- **FR-008**: O sistema DEVE validar cada resposta gerada contra as regras de Guardline antes de entregá-la ao usuário final (processamento pós-geração).
- **FR-009**: Quando uma resposta violar as Guardlines, o sistema DEVE substitui-la pela mensagem padrão "Desculpe, não posso ajudar com esse assunto específico".
- **FR-010**: O sistema DEVE registrar silenciosamente no log de auditoria toda violação de Guardline, incluindo: ID do agente, ID do usuário (se disponível), tipo de violação e timestamp.
- **FR-011**: O sistema DEVE oferecer uma camada opcional de "Double Check por IA" que analisa a resposta gerada antes da entrega ao usuário.
- **FR-012**: O sistema DEVE detectar padrões de loop de mensagens dentro de uma sessão ativa e alterar a estratégia de resposta quando detectados.
- **FR-013**: O sistema DEVE tentar automaticamente o modelo de fallback configurado quando o modelo principal não responder em até **8 segundos** (timeout) ou retornar um erro de serviço — o fallback é acionado imediatamente após ese limite, sem aguardo adicional.
- **FR-014**: O log de auditoria DEVE ser silencioso (invisível ao usuário final) e acessível somente por SUPERADMINS da plataforma. Admins sem papel SUPERADMIN não têm acesso ao log de nenhum agente alheio.
- **FR-015**: O sistema DEVE permitir que o Admin alterne o estado do Agente entre **Ativo**, **Inativo** e **Rascunho (Draft)**.
- **FR-016**: O orquestrador DEVE processar mensagens apenas para agentes no estado **Ativo**; mensagens direcionadas a agentes em Rascunho ou Inativos devem retornar uma mensagem de indisponibilidade configurada.

### Key Entities

- **Agent**: Representa uma automação de conversação configurável. Atributos-chave: identificador único, nome, modelo do Cérebro Rápido, modelo do Cérebro Analítico, identificador do SUPERADMIN criador, status de bloqueio de edição global, **status operacional (Ativo, Inativo, Rascunho)**, configurações de regras de segurança (em formato estruturado), modelo de fallback, **deleted_at** (para soft delete).
- **Agent Rules Config**: Conjunto de regras de governança associadas a um agente. Inclui: lista de termos da blacklist, lista de concorrentes proibidos, status do Double Check por IA, mensagem de bloqueio padrão (customizável ou padrão do sistema).
- **Audit Log**: Registro imutável de eventos relevantes do agente. Atributos: identificador único, identificador do agente, identificador do usuário (quando aplicável), tipo de ação/evento, tipo de violação (quando aplicável), timestamp do evento.
- **Session**: Representa uma conversa ativa entre um usuário final e um agente. Mantém histórico de mensagens e respostas da sessão corrente, utilizado para detecção de loops e redundâncias.
- **Admin**: Usuário com privilégios de configuração de agentes. Pode ser SUPERADMIN de agentes específicos, com permissões expandidas sobre esses agentes (incluindo acesso ao log de auditoria dos seus próprios agentes). No contexto da Constituição FluxAI, o papel de **Owner** é mapeado para o **SUPERADMIN**.
- **SUPERADMIN**: Papel administrativo de nível superior com acesso irrestrito de visualização a todos os agentes e a todos os logs de auditoria da plataforma. O SUPERADMIN é o proprietário (Dono) dos agentes que cria e possui supervisão global.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das respostas de agentes com Guardlines ativas que contenham termos proibidos são bloqueadas e substituídas pela mensagem padrão antes de chegar ao usuário final.
- **SC-002**: A decisão de roteamento entre modelo Rápido e Analítico ocorre de forma transparente, sem nenhuma ação adicional do Admin ou usuário final após a configuração inicial.
- **SC-003**: Em caso de falha do modelo principal, o sistema aciona o fallback e entrega uma resposta ao usuário em até **20 segundos** (2x o tempo normal de 10 segundos), sem exibir mensagem de erro técnico ao usuário.
- **SC-008**: Em condições normais de operação (sem falha), o agente entrega a resposta ao usuário em até **10 segundos** — independentemente de qual modelo (Rápido ou Analítico) foi acionado.
- **SC-004**: 100% das violações de Guardline são registradas no log de auditoria com todas as informações obrigatórias (agente, tipo, timestamp).
- **SC-005**: Um Admin não-SUPERADMIN é incapaz de salvar qualquer alteração em um agente com bloqueio ativo — 0% de escapes de permissão.
- **SC-006**: A configuração completa de um novo agente (modelos + Guardlines + permissões) é completada pelo Admin em menos de 5 minutos.
- **SC-007**: O sistema detecta e age sobre padrões de loop de mensagens em até 3 repetições consecutivas equivalentes dentro de uma mesma sessão.

---

## Assumptions

- Os modelos de linguagem disponíveis para seleção (Cérebro Rápido e Analítico) são gerenciados por um catálogo de modelos já existente na plataforma — esta feature não cria esse catálogo.
- O sistema de autenticação e o gerenciamento de perfis de SUPERADMIN já estão implementados e disponíveis para esta feature consumir.
- A "mensagem padrão" de bloqueio de Guardline ("Desculpe, não posso ajudar com esse assunto específico") é a padrão do sistema, mas pode ser customizada pelo Admin por agente em uma iteração futura (v1 usa somente o padrão do sistema).
- O conflito de edição simultânea é resolvido via "Last Write Wins" — não será implementado um mecanismo de lock em tempo real (ex: "outro Admin está editando agora") na v1.
- O "Double Check por IA" na camada de pós-processamento usa o mesmo modelo Analítico já configurado para o agente, sem necessidade de configurar um modelo separado.
- A "Vigilância de Sessão" opera apenas dentro da sessão corrente (estado em memória) — não persiste histórico de loops entre sessões distintas.
- O log de auditoria é somente-escrita/append-only — não haverá funcionalidade de edição ou deleção de registros de log na v1.
- Mobile e acessos via API (não-interface) estão fora do escopo desta especificação de feature — o foco é na interface administrativa web.

---

## Clarifications

### Session 2026-04-08

- Q: Qual é o mecanismo que define quando o Cérebro Analítico deve ser acionado em vez do Rápido? → A: Híbrido — o Admin configura parâmetros de limiar (ex.: palavras-chave de escalada, tamanho mínimo) E o orquestrador de inteligência aplica sua própria lógica nativa de avaliação de complexidade; ambos cooperam na decisão de roteamento.
- Q: Qual é o tempo máximo de resposta esperado em condições normais? → A: 10 segundos (SLA normal); em cenário de fallback, o teto é 20 segundos (2x o SLA normal).
- Q: Quem pode visualizar o log de auditoria de um agente específico? → A: SUPERADMIN tem acesso global a todos os logs da plataforma e visualiza os logs dos agentes que criou; Admins subordinados não têm acesso a logs alheios.
- Q: Qual é o tempo máximo de espera pelo modelo principal antes de acionar o fallback? → A: 8 segundos — após esse timeout o fallback é acionado imediatamente, permitindo que a resposta total ainda seja entregue dentro do teto de 20 segundos.
- Q: Quais são os estados operacionais possíveis para um Agente além do bloqueio de edição? → A: Ativo / Inativo / Rascunho (Draft); apenas agentes no estado Ativo processam mensagens do usuário final. O estado **Rascunho** permite interações de teste via interface administrativa, enquanto **Inativo** bloqueia o processamento por completo em todos os canais.
