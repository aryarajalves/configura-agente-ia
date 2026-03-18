# 🧠 Plano de Implementação: Análise de Lacunas de Conhecimento (Knowledge Gap)

## 💡 Conceito: "O Funil de Descoberta de Conhecimento"
Em vez de tentar adivinhar o que cadastrar na Base de Conhecimento, usamos as dúvidas reais dos usuários como guia. O objetivo é transformar cada pergunta não respondida em um novo aprendizado para o agente.

---

## 🏗️ Arquitetura da Solução

### 1. O Comparador Semântico (Backend)
Resolve o problema de variações de linguagem ("Quanto custa?" vs "Tabela de Preços").
*   **Mecanismo:** Usa o mesmo banco vetorial (ChromaDB) do agente.
*   **Lógica de Cobertura:**
    1.  Recebe uma pergunta extraída.
    2.  Realiza busca vetorial por similaridade.
    3.  **🔴 Sem Resposta:** Score de similaridade baixo. O sistema não encontrou nada relevante.
    4.  **🟢 Já Coberta:** Score de similaridade alto. A resposta já existe na base.

### 2. A "Caixa de Entrada" de Dúvidas (Frontend)
Uma interface dedicada à curadoria de conhecimento.
*   **Lista de Dúvidas:** Exibe todas as perguntas capturadas.
*   **Status Inteligente:**
    *   � **Sem Resposta:** Prioridade Alta. Nenhuma resposta encontrada.
    *   🟡 **Dúvida:** Encontrado algo vagamente similar. Requer revisão humana.
    *   🟢 **Respondida:** O conteúdo já existe (mostra qual item da base responde).

### 3. O Fluxo de "Promoção" (Ação)
Facilita o cadastro rápido.
*   Para itens marcados como 🔴 (Sem Resposta).
*   Botão **"Transformar em Conhecimento"**.
*   Abre um modal com a **Pergunta** já preenchida.
*   O usuário apenas digita a **Resposta** e salva.
*   **Resultado:** O agente aprende instantaneamente e não errará mais.

---

## 🗺️ Plano de Ação

### Fase 1: Validação Rápida (Foco Imediato)
1.  **Botão "Verificar Cobertura":** Adicionar ao modal de "Perguntas Extraídas".
2.  **Endpoint de Análise:** Criar rota no backend que recebe a lista e retorna o status (🔴/🟢) baseado na similaridade vetorial.
3.  **Cadastro Rápido:** Botão `[+]` ao lado das perguntas novas para abrir o modal de criação pré-preenchido.

### Fase 2: Histórico e Inteligência (Futuro)
1.  **Persistência:** Salvar as perguntas no banco de dados.
2.  **Relatórios:** "Quais as dúvidas mais comuns deste mês?"
3.  **Sugestão Automática:** Usar LLM para sugerir uma resposta baseada no contexto da conversa.

---

## � Lista de Tarefas (Técnicas)

### Backend (Python/FastAPI)
- [ ] Criar endpoint `POST /knowledge-bases/{kb_id}/coverage`.
- [ ] Implementar lógica de comparação vetorial (usando `embedding_function`).
- [ ] Definir *thresholds* para classificação (ex: < 0.75 = 🔴, > 0.85 = 🟢).

### Frontend (React)
- [ ] Adicionar botão de verificação no `AnalysisModal`.
- [ ] Implementar indicadores visuais de status (badges coloridos).
- [ ] Criar fluxo de abrir o modal de "Novo Item" com dados pré-preenchidos.
