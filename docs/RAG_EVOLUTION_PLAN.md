# 🧠 Plano de Evolução do RAG (Retrieval-Augmented Generation)

Este documento detalha o roteiro tecnológico para elevar a maturidade da Base de Conhecimento do sistema, saindo de um RAG básico para uma arquitetura de alta performance e precisão.

---

## 🚀 Tópicos de Melhoria

### 1. Hybrid Search (Busca Híbrida) (OK)
Combina a **Busca Semântica** (Embedding/Vetores) com a **Busca por Texto** (BM25/Keyword Search).
- **Resolveria:** Falhas ao buscar termos técnicos exatos, códigos de produtos ou nomes próprios que o modelo de embedding às vezes "generaliza" demais.
- **Implementação:** Utilizar o recurso de *Full Text Search* do PostgreSQL em conjunto com o PGVector.

### 2. Reranking (Re-ranqueamento) (OK)
Adiciona uma "segunda camada" de filtragem após a busca inicial.
- **Resolveria:** Quando a busca vetorial traz 10 resultados, mas os mais relevantes não estão no topo. Um modelo menor (Cross-Encoder) reavalia os top-N resultados para garantir precisão máxima.
- **Implementação:** Integração com Cohere Rerank ou modelos locais via HuggingFace.

### 3. Parent Document Retrieval (Contexto Expandido)
Separa o documento em pedaços pequenos para a busca, mas entrega pedaços maiores para a IA.
- **Resolveria:** O problema de "fatias" de texto que perdem o sentido por estarem incompletas (falta de contexto em volta da resposta).
- **Implementação:** Armazenar IDs de relação entre *Child Chunks* e *Parent Documents*.

### 4. Query Transformation (Multi-Query) (OK)
A IA expande a pergunta simples do usuário em múltiplas variações.
- **Resolveria:** Perguntas ambíguas ou muito curtas que não ativam bem os vetores no banco de dados.
- **Implementação:** Um passo de pré-processamento onde o GPT gera 3 formas de perguntar a mesma coisa.

### 5. Agentic RAG (RAG Autocrítico) (OK)
O agente avalia se o que ele recuperou do banco é realmente útil antes de responder.
- **Resolveria:** "Alucinações" onde o agente tenta responder mesmo quando não encontrou a informação correta na base de conhecimento.
- **Implementação:** Loop de feedback onde o agente pode decidir fazer uma nova busca se a primeira falhar.

### 6. HyDE (Hypothetical Document Embeddings)
A IA gera uma resposta hipotética para buscar a resposta real.
- **Resolveria:** Casos onde a pergunta do usuário não se parece nada com os documentos da base (ex: o usuário pergunta "como faz login?" e a base tem um manual técnico).
- **Implementação:** Geração de resposta sintética antes do passo de embedding.

---

## 🏆 Priorização para Implementação Imediata

Abaixo estão os tópicos elencados por ordem de importância e facilidade de impacto para o estágio atual do projeto:

### 🥇 Prioridade 1: Parent Document Retrieval
**Por que agora?** É a melhoria com maior ROI (Retorno sobre Investimento). Garante que o agente não receba apenas "frases soltas", mas sim o contexto completo do parágrafo ou seção, eliminando respostas incompletas.

### 🥈 Prioridade 2: Hybrid Search (Busca Híbrida)
**Por que agora?** Essencial se o seu negócio lida com termos específicos, siglas ou nomes de marcas. É o que separa um chatbot que "acha o que parece" de um sistema que "acha o que é".

### 🥉 Prioridade 3: Agentic RAG (Verificação de Relevância)
**Por que agora?** Melhora a confiança no sistema. Em vez do agente responder "Eu acho que...", ele passa a dizer "Não encontrei essa informação específica nos manuais internos, mas posso tentar ajudar de outra forma". Isso profissionaliza o atendimento.

---
*Este documento serve como guia para as próximas sprints de desenvolvimento da inteligência dos agentes.*
