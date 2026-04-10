# Feature Specification: Correção de Erros de Implementação e Regressões de UI

**Feature Branch**: `008-fix-implementation-regressions`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Correção de erros feitos na implementação do pelo spec-kit. 1° no frontend 'sidebar' tem um 'nav-item' com nome 'Skills (Bases)' mas ele deve chamar 'Bases de Conhecimento' e href='/knowledge-bases'. Reverter mudanças de 'knowledge-bases' para 'Skills'. 2° Erro 'Field required' ao criar Agente (404/422 errors). 3° Network 404/422 errors em várias rotas. 4° Erro 'kbList.filter is not a function' em Habilidades. 5° Sidebar: 'Fine-Tuning' deve ser teste de agentes (href='/fine-tuning') e não 'Teste de Estresse'. 6° Remover 'Inbox (Falhas)' da sidebar, manter apenas em knowledge-bases. 7° Financeiro erro 404 e 'forEach' of undefined. 8° Gestão de Usuários erro 404 e 'users.filter' is not a function. 9° Sistema deslogando sozinho. 13° RabbitMQ docker image baseada no backend."

## Clarifications

### Session 2026-04-10

- Q: Estratégia de Persistência de Sessão? → A: Sem limite (persistente) via Cookies; uma vez conectado, permanece conectado.
- Q: Escopo da Reversão no Banco de Dados? → A: Renomeação física de Tabelas/Colunas via Migrations (reverter "Skills" para "knowledge-bases").
- Q: Estratégia para Rotas 404 (Not Found)? → A: Restaurar/Criar as rotas no Backend para compatibilidade com o Frontend.
- Q: Organização dos Botões de Teste e Fine-Tuning? → A: Substituir o rótulo "Teste de Estresse" por "Fine-Tuning" no menu lateral, mantendo as funcionalidades de teste e apontando para `/fine-tuning`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correção da Terminologia e Navegação de Conhecimento (Priority: P1)

Como usuário administrador, desejo que a terminologia do sistema seja consistente e reflita "Bases de Conhecimento" em vez de "Skills", garantindo que a navegação me leve aos locais corretos.

**Why this priority**: A consistência da marca e a navegação correta são fundamentais para a usabilidade básica do sistema.

**Independent Test**: Pode ser testado verificando se o item no menu lateral exibe o nome correto e se o clique redireciona para a página de Bases de Conhecimento.

**Acceptance Scenarios**:

1. **Given** que estou na página inicial, **When** olho para o menu lateral, **Then** devo ver "Bases de Conhecimento" em vez de "Skills (Bases)".
2. **Given** que visualizo o item "Bases de Conhecimento", **When** clico nele, **Then** o sistema deve me redirecionar para `/knowledge-bases`.
3. **Given** que estou na página de Bases de Conhecimento, **When** procuro o Inbox de Dúvidas, **Then** ele deve estar visível apenas nesta página e não no menu lateral.

---

### User Story 2 - Estabilidade na Criação de Agentes e Habilidades (Priority: P1)

Como criador de agentes, desejo poder configurar e salvar novos agentes sem erros de "campo obrigatório" ou falhas de script, mesmo quando certas listas (como bases de conhecimento) estão vazias ou inacessíveis.

**Why this priority**: A funcionalidade de criação de agentes é o núcleo do produto (Core Feature). Sem ela, o sistema não cumpre seu propósito.

**Independent Test**: Tentar criar um novo agente e acessar a aba de habilidades deve funcionar sem quebrar a interface ou disparar alertas de erro fatal.

**Acceptance Scenarios**:

1. **Given** que acesso a página de "Novo Agente", **When** tento salvar sem preencher campos obrigatórios, **Then** o sistema deve validar amigavelmente em vez de falhar silenciosamente no console.
2. **Given** que clico na aba "⚡ Habilidades", **When** o sistema carrega os dados, **Then** ele deve tratar listas vazias de conhecimento sem causar erros de execução (TypeError).

---

### User Story 3 - Integridade dos Módulos Financeiro e de Usuários (Priority: P2)

Como gestor, desejo acessar os módulos Financeiro e Gestão de Usuários e visualizar relatórios e listas de usuários sem erros de rota 404 ou falhas de renderização.

**Why this priority**: Permite o gerenciamento da plataforma e controle financeiro, essencial para a operação do negócio.

**Independent Test**: Acessar `/financeiro` e `/users` e verificar se os dados são exibidos ou se uma mensagem de "nenhum dado encontrado" aparece, em vez de um erro de componente.

**Acceptance Scenarios**:

1. **Given** que acesso a página Financeiro, **When** o sistema busca o relatório, **Then** ele deve carregar as informações ou informar que não há transações no período, sem falhar.
2. **Given** que acesso a Gestão de Usuários, **When** a lista de usuários é buscada, **Then** o sistema deve renderizar a tabela corretamente mesmo se a resposta do servidor for inesperada.

---

### User Story 4 - Persistência de Sessão e Acesso (Priority: P2)

Como usuário logado, desejo permanecer autenticado durante minha sessão de trabalho sem ser desconectado inesperadamente após alguns minutos.

**Why this priority**: Melhora significativamente a experiência do usuário e evita retrabalho e frustração.

**Independent Test**: Permanecer logado por um período superior a 15 minutos realizando atividades intermitentes.

**Acceptance Scenarios**:

1. **Given** que estou logado, **When** navego entre diferentes páginas por vários minutos, **Then** minha sessão deve permanecer ativa.

---

### Edge Cases

- O que acontece quando o servidor backend está offline? O sistema deve exibir estados de "Erro de Conexão" elegantes.
- Como o sistema lida com respostas do API que retornam objetos em vez de arrays em campos esperados (ex: `kbList`, `users`)? Deve haver fallback para arrays vazios.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE renomear fisicamente no banco de dados todas as tabelas e colunas que foram alteradas para "Skills" de volta para "knowledge-bases" via migrations.
- **FR-002**: O sistema DEVE garantir que a rota `/knowledge-bases` seja o destino correto para o item de menu correspondente.
- **FR-003**: O sistema DEVE restaurar ou criar no backend todas as rotas de API que estão retornando 404 (notadamente ferramentas, modelos, usuários e financeiro).
- **FR-004**: O sistema DEVE validar e garantir que todos os campos obrigatórios na criação de agentes estejam presentes no payload antes do envio.
- **FR-005**: O sistema DEVE renomear o item de menu "Teste de Estresse" para "Fine-Tuning" na sidebar, apontando para `/fine-tuning` e garantindo que as funcionalidades de teste de agentes estejam operacionais.
- **FR-006**: O sistema DEVE remover redundâncias de UI (Inbox movido apenas para bases de conhecimento).
- **FR-007**: O sistema DEVE garantir que a infraestrutura local (Docker) utilize imagens base consistentes para o RabbitMQ.
- **FR-008**: O sistema DEVE implementar persistência de login via Cookies sem expiração definida (sessão contínua).

### Key Entities *(include if feature involves data)*

- **Agente**: Entidade central que requer configuração de modelos e habilidades.
- **Base de Conhecimento**: Fonte de dados para o RAG do agente.
- **Sessão de Usuário**: Estado de autenticação que precisa de estabilidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O menu lateral exibe "Bases de Conhecimento" e redireciona com 100% de sucesso para `/knowledge-bases`.
- **SC-002**: Zero erros de "TypeError (filter/forEach is not a function)" reportados no console do navegador durante a navegação normal.
- **SC-003**: 100% das rotas de API reportadas (404/422) devem estar acessíveis ou devidamente tratadas pelo frontend/backend.
- **SC-004**: O sistema mantém o usuário conectado permanentemente via Cookies após o primeiro login bem-sucedido.

## Assumptions

- Presume-se que a reversão para "knowledge-bases" requer atualizações tanto no esquema do banco de dados quanto na camada de acesso a dados (ORM/API).
- Presume-se que o usuário possui permissões de superadmin para validar todas as áreas (Financeiro, Usuários, Agentes).
- Presume-se que o ambiente Docker está configurado corretamente para permitir a atualização da imagem do RabbitMQ e backend.
