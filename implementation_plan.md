# Plano de Implementação - Importação Estruturada e Rótulos Personalizados

Integrar um novo formato JSON para colagem de texto e permitir a personalização dos rótulos "Pergunta" e "Resposta" na base de conhecimento, garantindo que a IA compreenda a semântica desses campos durante o processo de RAG.

## Revisão do Usuário Necessária

> [!IMPORTANT]
> O sistema detectará automaticamente se o texto colado é um JSON estruturado. Além disso, os rótulos personalizados definidos para a Base de Conhecimento (ex: "Metadados" e "Conteúdo") serão enviados para a IA em todos os processos de filtragem, re-rank e geração para melhorar a precisão.

## Mudanças Propostas

### Backend

#### [MODIFY] [models.py](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/backend/models.py)
- Adicionar `question_label` (default: "Pergunta") e `answer_label` (default: "Resposta") ao modelo [KnowledgeBaseModel](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos%20Serios/Cria%20Agente%20de%20IA%20Para%20Automacao/backend/models.py#55-70).

#### [MODIFY] [router_import.py](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/backend/router_import.py)
- Modificar [preview_text_import](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos%20Serios/Cria%20Agente%20de%20IA%20Para%20Automacao/backend/router_import.py#336-408) para detectar o JSON do usuário:
    - Se o JSON contiver `context` com `metadata` e `context`, mapear automaticamente.
    - Usar os rótulos personalizados da KB ao gerar a prévia.

#### [MODIFY] [rag_service.py](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/backend/rag_service.py)
- Atualizar funções [rerank_results](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos%20Serios/Cria%20Agente%20de%20IA%20Para%20Automacao/backend/rag_service.py#115-184) e [evaluate_rag_relevance](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos%20Serios/Cria%20Agente%20de%20IA%20Para%20Automacao/backend/rag_service.py#185-257) para usar os rótulos personalizados da KB (recuperados via DB) em vez dos termos estáticos "Pergunta" e "Resposta".

#### [MODIFY] [test_router_import.py](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/backend/tests/test_router_import.py)
- Adicionar testes para o novo formato JSON e para a persistência dos rótulos.

### Frontend

#### [MODIFY] [KnowledgeBaseManager.jsx](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/frontend/src/components/KnowledgeBaseManager.jsx)
- Adicionar campos de configuração na interface para definir `question_label` e `answer_label`.
- Atualizar o formulário "Novo Conhecimento" para exibir os rótulos personalizados.

#### [MODIFY] [KnowledgeBaseImporter.jsx](file:///c:/Users/aryar/.gemini/antigravity/scratch/Projetos Serios/Cria Agente de IA Para Automacao/frontend/src/components/KnowledgeBaseImporter.jsx)
- Adaptar o importador para usar os rótulos personalizados na visualização e mapeamento.
- Detectar o formato JSON estruturado e informar o usuário.

---

## Plano de Verificação

### Testes Automatizados
- Executar testes de backend:
  ```bash
  pytest backend/tests/test_router_import.py
  ```

### Verificação Manual
1. Alterar os rótulos de uma KB para "Dúvida" e "Explicação".
2. Abrir o formulário de "Novo Conhecimento" e verificar se os nomes mudaram.
3. Colar o JSON estruturado e verificar se a prévia respeita os novos nomes.
4. Testar o simulador de RAG e verificar (via log ou debug) se a IA está recebendo os rótulos corretos.
