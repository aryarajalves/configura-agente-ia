# 🤖 AI Agent Orchestrator & Automation Hub

Uma plataforma robusta para criação, gestão e análise de agentes de IA focados em automação comercial e suporte inteligente. Este projeto foi desenhado para atuar como o **cérebro central**, integrando-se perfeitamente com ecossistemas de automação como **n8n** e sistemas de atendimento como **Chatwoot**.

---

## 🚀 Visão do Projeto

Diferente de simples chatbots, este orquestrador foca em **agentes funcionais** que possuem base de conhecimento própria, ferramentas de API e monitoramento financeiro detalhado por sessão.

### 🛠️ Funcionalidades Atuais
- **Gestão de Agentes:** Configuração de prompts, modelos (GPT-4o, etc.) e parâmetros.
- **Base de Conhecimento (RAG):** Upload e gerenciamento de documentos para consulta da IA em tempo real.
- **Análise Inteligente de Conversas:** Extração automática de perguntas dos usuários para identificar lacunas no conhecimento do agente.
- **Dashboard Financeiro:** Controle em tempo real de custos (R$), uso de tokens e contagem de **conversas únicas per dia**.
- **Playground (Chat):** Ambiente de teste para validar o comportamento dos agentes antes da produção.

---

## 🗺️ Roadmap de Evolução (Próximos Passos)

Estamos evoluindo para tornar o agente ainda mais versátil e proativo:

### 2. ✅ 🧠 Memória Estruturada de Longo Prazo [CONCLUÍDO]
O Agente passará a "conhecer" o usuário de verdade. Em vez de apenas ler o histórico, ele extrairá fatos estruturados:
- **Exemplo:** Guardar automaticamente o nome, preferências, localização ou histórico de compras do cliente em uma tabela persistente.
- **Impacto:** Respostas muito mais personalizadas e contextuais em interações futuras, independente do tempo entre as sessões.

### 4. 🛡️ Guardrails Avançados e Blindagem de Output
Evolução da camada de validação para garantir conformidade 100% determinística.
- **Hard Filter para Tópicos:** Bloqueio obrigatório via Regex para palavras-chave de tópicos proibidos (além do prompt).
- **Double-Check de Segurança (Validator IA):** Uso de um modelo ultra-rápido (GPT-4o-mini) para auditar cada resposta antes da entrega, garantindo que políticas de descontos e conduta foram seguidas.
- **Censura Dinâmica de Valores:** Sistema que identifica e bloqueia menções a valores monetários acima do teto configurado.

### 8. 📧 Analista Executivo (Relatórios Agendados)
Envio proativo de relatórios de desempenho e insights via e-mail ou WhatsApp.
- **Diferencial:** Resumos periódicos (diários/semanais) sobre gastos, tópicos mais quentes e frustrações dos usuários detectadas pela IA.

### 9. 🚦 Roteamento de Modelos (Cost Router)
Lógica inteligente para decidir qual modelo usar com base na complexidade do prompt.
- **Economia:** Perguntas simples vão para o GPT-mini, tarefas complexas para o GPT-4o, otimizando o custo operacional de forma automática.

### 10. 🧩 Widget de Chat Embutível (Whitelabel)
Criação de um script JS leve para embutir o agente em sites externos de clientes.
- **Comercial:** Transforma a plataforma em um fornecedor de chat para terceiros.

### 11. 🔄 Ciclo de Feedback e Auto-Correção (RLHF)
Sistema de "joinha" nas respostas que permite correções diretas.
- **Aprendizado:** Quando uma resposta é corrigida, ela alimenta automaticamente a Base de Conhecimento, garantindo que o agente aprenda com falhas de forma contínua.

### 12. ✅ Orquestração de Enxame (Swarm Handoff) [CONCLUÍDO]
Permitir que agentes transitem o usuário entre diferentes "especialistas" automaticamente.
- **Implementação:** Ferramenta nativa `transferir_atendimento` em `agent.py`.

### 13. 🕵️ Audit Log e Rastreabilidade de Ferramentas
Log detalhado de todas as chamadas de funções e APIs externas feitas pelos agentes.
- **Segurança:** Visualização técnica exata do que a IA enviou para as ferramentas e o que recebeu em troca, facilitando o debug.

### 14. 🚩 Detector de Churn e Sentimento Crítico
Monitoramento passivo de "perigo" nas interações.
- **Funcionalidade:** Se o sistema detecta agressividade, ironia ou menção a cancelamento/PROCON, dispara um alerta vermelho instantâneo via WhatsApp ou Slack para intervenção humana imediata.

### 15. 🏭 Pipeline de Fine-Tuning Automático
Criação de modelos proprietários treinados com o estilo e conhecimento específico da empresa.
- **Aprendizado:** Usa as correções feitas no ciclo de feedback (RLHF) para treinar um modelo (ex: GPT-4o-mini Fine-tuned) que já responde nativamente de acordo com os padrões desejados, reduzindo o tamanho dos prompts.

### 16. ✅ Transferência de Contexto entre Agentes [CONCLUÍDO]
Garantir que, em um "Handoff", o novo agente receba um resumo estruturado da conversa anterior.
- **Implementação:** Resumo automático em 4 pontos injetado via `System Message` no novo agente.

### 17. 🛡️ Proteção Anti-Loop de Robôs (Bot-to-Bot Defense)
Mecanismo de segurança para evitar desperdício de tokens em conversas infinitas entre IAs.
- **Funcionalidade:** Detecção semântica de redundância e limite de iterações por sessão. Se o sistema detectar um loop ou excesso de mensagens, pausa o atendimento automaticamente e solicita verificação humana.
### 18. 🚀 Escalabilidade e Performance (Alta Disponibilidade)
Preparar a infraestrutura para suportar centenas de usuários simultâneos sem degradação de performance.
- **Chamadas de Ferramentas Assíncronas:** Migrar os webhooks de `requests` (síncrono) para `httpx` ou `aiohttp` (assíncrono) em `agent.py`, evitando bloqueios no loop de eventos.
- **Configuração de Produção Hub:** Substituir o servidor de desenvolvimento atual por uma stack robusta usando **Gunicorn + Uvicorn Workers** no Docker.
- **Otimização de Pool de Conexões:** Ajustar os limites de conexão do banco de dados e do cliente de API para gerenciar picos de tráfego de forma eficiente.

---

## 🎨 Identidade Visual
O design segue uma estética **Premium Glassmorphism**, com temas escuros, gradientes vibrantes e foco em uma experiência de usuário (UX) fluida e moderna.
