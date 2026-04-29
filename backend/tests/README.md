# Testes Unitários e de Integração — AI Agent API

Esta pasta contém a suíte de testes para validar as principais funções do projeto.

## Como Executar

### 1. Pré-requisitos
Certifique-se de que as dependências de teste estão instaladas:
```bash
pip install pytest pytest-asyncio httpx
```

### 2. Configuração do Banco de Dados
Os testes utilizam o banco de dados configurado no seu `.env`. 
**Atenção:** Os testes podem realizar operações de escrita. Recomenda-se usar um banco de dados de teste separado se possível, alterando a `DATABASE_URL` no ambiente antes de rodar.

### 3. Executando todos os testes
Na raiz do projeto, execute:
```bash
pytest
```

Para ver o output detalhado:
```bash
pytest -v
```

## Estrutura dos Testes

- `conftest.py`: Configurações globais, fixtures de banco de dados e cliente de teste.
- `test_users.py`: Validação de login e gerenciamento de usuários.
- `test_agents.py`: Criação, listagem e atualização de agentes.
- `test_messages.py`: Execução de mensagens e interações com a IA.
- `test_finetuning.py`: Pipeline de feedback e jobs de fine-tuning.
- `test_finance.py`: Relatórios financeiros e métricas do dashboard.
- `test_tools.py`: Gerenciamento de ferramentas e webhooks.
- `test_knowledge.py`: Criação de bases de conhecimento e itens de RAG.
- `test_extra_functions.py`: Variáveis globais, Prompt Lab e Análise de Sessões.

## Observações
- Testes que envolvem chamadas à OpenAI (como `test_messages.py`) podem falhar se a `OPENAI_API_KEY` não for válida ou se houver problemas de conexão.
- Alguns testes dependem da criação prévia de registros, mas as fixtures tentam manter a independência entre os testes sempre que possível.
