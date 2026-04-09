# Feature Specification: Ingestão de Dados & Gestão de Nuvem (Backblaze)

**Feature Branch**: `005-cloud-ingestion-worker`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Ingestão de Dados & Gestão de Nuvem (Backblaze): Gerência a entrada de novos conhecimentos tratando o upload para Backblaze B2 como tarefa de background via TaskIQ"

## Clarifications

### Session 2026-04-09
- Q: Limite de Tamanho de Arquivo → A: 2GB
- Q: Mecanismo de Atualização da UI → A: WebSockets
- Q: Tratamento de Arquivos Duplicados/Concorrentes → A: Bloqueio por Hash
- Q: Concorrência de Processamento → A: Uploads paralelos, mas processamento de IA limitado a 1 worker.
- Q: Proteção e Acesso aos Dados no B2 → A: Totalmente Privado (API Key)
        
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingestão "Zero Wait" (Priority: P1)

Como Admin, quero selecionar um arquivo pesado e confirmar a adição à base, para que eu possa continuar trabalhando em outras configurações sem esperar a barra de upload carregar.

**Why this priority**: Esta é a funcionalidade principal do módulo, garantindo que a interface do usuário não fique bloqueada durante operações de longa duração, o que é crítico para uma boa UX.

**Independent Test**: Selecionar um arquivo grande (>100MB) e verificar se o modal fecha instantaneamente após o clique em "Adicionar", com a tarefa aparecendo no gerenciador de background.

**Acceptance Scenarios**:

1. **Given** O Admin está no modal de ingestão de dados, **When** O Admin seleciona um arquivo de 500MB e clica em "Adicionar Conteúdo", **Then** O modal fecha em < 1s, exibe notificação "Tarefa iniciada" e cria um card no Gerenciador de Background com status `Iniciando Upload`.

---

### User Story 2 - Monitoramento do Ciclo de Vida no Log (Priority: P2)

Como Admin, quero ver no log detalhado se o problema de um erro foi no upload para a nuvem ou no processamento da IA.

**Why this priority**: Essencial para depuração e transparência do sistema, permitindo que o administrador entenda em qual fase o processo se encontra ou falhou.

**Independent Test**: Abrir os detalhes de uma tarefa em execução no Gerenciador de Background e verificar a progressão dos logs conforme as etapas são concluídas.

**Acceptance Scenarios**:

1. **Given** Um card de processo na tela de background, **When** O Admin clica em "Detalhes", **Then** O log exibe a trilha: `[HH:MM] Iniciando transferência para Backblaze`, `[HH:MM] Upload concluído (ID: XXX)`, `[HH:MM] Iniciando Transcrição/Vetorização`, `[HH:MM] Processo concluído e arquivo removido da nuvem`.

---

### Edge Cases

- **Queda de Internet durante o envio ao B2**: O sistema (TaskIQ) deve tentar retomar o upload ou marcar o status como `Erro no Upload` se falhar permanentemente.
- **Arquivo Duplicado**: Se o hash do arquivo selecionado já estiver em processamento ou presente na base RAG, o sistema deve impedir a nova ingestão e informar o usuário sobre a duplicata.
- **Timeout de Processamento**: Para arquivos muito grandes, o sistema deve manter o status `Processando` e não deletar o arquivo do B2 até a conclusão total.
- **Falha na conexão inicial**: Se o TaskIQ não puder iniciar a tarefa, o usuário deve ser notificado imediatamente na interface.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O upload do arquivo para o Backblaze B2 deve ser executado por um worker de background, liberando o thread principal da API imediatamente. O processamento pesado (vetorização/IA) deve ser enfileirado e limitado a 1 execução simultânea para preservar recursos do sistema.
- **FR-002**: O sistema deve persistir o status da tarefa no banco de dados, incluindo estados como `Iniciando Upload`, `Upload em Progresso`, `Processando` e `Concluído`.
- **FR-003**: O arquivo persistido no Backblaze B2 só deve ser removido após a confirmação de que o processo de ingestão (vetorização/RAG) foi finalizado com sucesso.
- **FR-004**: O sistema deve registrar logs detalhados de cada etapa, incluindo identificadores de transação do Backblaze e links temporários para auditoria técnica antes da deleção.
- **FR-005**: O sistema deve permitir a visualização em tempo real do progresso das tarefas de ingestão através de um dashboard de background, utilizando WebSockets para notificações de mudança de estado.
- **FR-006**: O sistema deve suportar a ingestão de arquivos individuais com tamanho de até 2GB.
- **FR-007**: O sistema deve calcular o hash (SHA256) do arquivo e verificar a existência de processos idênticos antes de iniciar o upload para o Backblaze B2.
- **FR-008**: Os arquivos armazenados no Backblaze B2 devem ser mantidos em um bucket privado, com acesso restrito via credenciais de API, sem exposição de links públicos.

### Key Entities *(include if feature involves data)*

- **IngestionTask**: Representa o ciclo de vida da ingestão de um arquivo. Atributos: ID, Nome do Arquivo, Hash (SHA256), Status, ID de Armazenamento Remoto, Logs da Tarefa, Timestamps.
- **CloudStorageReference**: Referência ao arquivo armazenado temporariamente no Backblaze B2 para processamento posterior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O tempo de resposta da UI entre o clique em "Adicionar" e a liberação da interface deve ser inferior a 1 segundo, independente do tamanho do arquivo.
- **SC-002**: 100% das tarefas de ingestão devem ter uma trilha de auditoria completa nos logs, permitindo identificar o sucesso/falha de cada sub-etapa (upload, processamento, deleção).
- **SC-003**: O sistema deve suportar a retomada automática de uploads interrompidos por falhas transitórias de rede no lado do servidor.
- **SC-004**: O sistema deve ser capaz de processar arquivos de até 2GB dentro do limite de tempo (timeout) configurado para os workers do TaskIQ.

## Assumptions

- O ambiente TaskIQ já está configurado e operacional para tarefas de background.
- As credenciais e buckets do Backblaze B2 estão configurados e acessíveis pelo servidor.
- O sistema de banco de dados (PostgreSQL/pgvector) está pronto para receber as atualizações da base RAG.
- O processamento de IA (transcrição/vetorização) é um serviço separado invocado pelo worker.
