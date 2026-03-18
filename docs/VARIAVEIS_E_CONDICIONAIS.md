# Variáveis Dinâmicas e Blocos Condicionais no Prompt do Agente

## Visão Geral

O sistema suporta dois mecanismos de personalização do prompt em tempo real:

1. **Substituição de variáveis** — injeta valores dinâmicos no prompt
2. **Blocos condicionais** — exibe ou oculta partes do prompt baseado em condições

Ambos funcionam com qualquer variável que você enviar pelo `context_variables` no body da requisição ao endpoint `/execute` (via n8n, webhook, ou qualquer integração).

---

## 1. Substituição de Variáveis `{variavel}`

### Como funciona

Coloque `{nome_da_variavel}` em qualquer parte do prompt. O sistema substitui automaticamente pelo valor enviado.

### Sintaxe no prompt

```
Você está atendendo {nome_do_cliente}, cliente desde {data_cadastro}.
O plano atual do cliente é {plano_atual}.
```

### n8n envia (body do /execute)

```json
{
  "agent_id": 1,
  "session_id": "whatsapp_123",
  "message": "mensagem do usuário",
  "context_variables": {
    "nome_do_cliente": "João Silva",
    "data_cadastro": "março de 2023",
    "plano_atual": "Premium"
  }
}
```

### Resultado que o agente recebe

```
Você está atendendo João Silva, cliente desde março de 2023.
O plano atual do cliente é Premium.
```

### Regras

- O nome da variável é **case-sensitive**: `{Nome}` ≠ `{nome}`
- Se a variável não for enviada, o placeholder `{variavel}` permanece no texto
- Qualquer valor é aceito: texto, número, data, URL, etc.

---

## 2. Blocos Condicionais `[IF:variavel]...[/IF]`

### Como funciona

Partes do prompt só aparecem para o agente quando uma variável tiver um valor verdadeiro. Caso contrário, o bloco inteiro é removido do prompt antes de enviá-lo ao modelo de IA.

### Sintaxe no prompt

**Bloco positivo** — aparece quando a variável for verdadeira:
```
[IF:nome_da_variavel]
Conteúdo que aparece apenas quando a variável for verdadeira.
[/IF]
```

**Bloco negativo** — aparece quando a variável for falsa ou ausente:
```
[IF:nome_da_variavel:false]
Conteúdo que aparece quando a variável NÃO for verdadeira.
[/IF]
```

### Valores considerados "verdadeiros"

| Valor enviado | Resultado |
|---------------|-----------|
| `"true"` | ✅ Verdadeiro |
| `"1"` | ✅ Verdadeiro |
| `"sim"` | ✅ Verdadeiro |
| `"yes"` | ✅ Verdadeiro |
| `"false"` | ❌ Falso |
| `"0"` | ❌ Falso |
| `"não"` | ❌ Falso |
| *(ausente)* | ❌ Falso |

A comparação é case-insensitive (`"TRUE"` = `"true"`).

---

## 3. Exemplos Práticos

### Exemplo 1 — Preço de lançamento

**Prompt do agente:**
```
Você é um assistente de vendas da Mentoria Master X.

[IF:preco_disponivel]
O preço da mentoria é R$ 2.000 à vista ou 12x de R$ 180.
O link de compra é: https://checkout.exemplo.com/mentoria
[/IF]

[IF:preco_disponivel:false]
O preço ainda não foi divulgado. Diga que o lançamento será em breve
e que o cliente pode se cadastrar na lista de espera.
[/IF]

Responda sempre de forma amigável e profissional.
```

**n8n — antes do lançamento:**
```json
{
  "context_variables": {
    "preco_disponivel": "false"
  }
}
```

**n8n — após o lançamento:**
```json
{
  "context_variables": {
    "preco_disponivel": "true"
  }
}
```

---

### Exemplo 2 — Atendimento personalizado por plano

**Prompt do agente:**
```
Você é o suporte da Plataforma X atendendo {nome_do_cliente}.

[IF:plano_premium]
Este cliente tem plano Premium. Ele tem acesso a suporte prioritário
e pode solicitar sessões 1:1. Trate-o com máxima atenção.
[/IF]

[IF:plano_premium:false]
Este cliente tem plano básico. Ofereça o upgrade para Premium
quando surgir uma oportunidade natural na conversa.
[/IF]
```

**n8n envia:**
```json
{
  "context_variables": {
    "nome_do_cliente": "Maria Souza",
    "plano_premium": "true"
  }
}
```

---

### Exemplo 3 — Combinando variáveis e condicionais

**Prompt do agente:**
```
Você atende {nome_do_cliente} do time de {empresa}.

[IF:em_periodo_trial]
Este cliente está em período de teste (trial) que vence em {dias_restantes} dias.
Seu objetivo é ajudá-lo a ter sucesso e considerar a assinatura paga.
[/IF]

[IF:contrato_ativo]
Este cliente tem contrato ativo até {data_vencimento}.
Priorize resolver o problema dele rapidamente.
[/IF]
```

**n8n envia:**
```json
{
  "context_variables": {
    "nome_do_cliente": "Carlos Lima",
    "empresa": "TechCorp",
    "em_periodo_trial": "true",
    "dias_restantes": "7",
    "contrato_ativo": "false"
  }
}
```

---

## 4. Dicas e Boas Práticas

### Use nomes descritivos para as variáveis
```
✅ preco_disponivel
✅ cliente_premium
✅ em_periodo_black_friday
❌ x
❌ flag1
```

### Combine os dois mecanismos
Blocos condicionais e substituição de variáveis funcionam juntos:
```
[IF:oferta_ativa]
Temos uma oferta especial de {desconto_percentual}% válida até {data_fim_oferta}.
[/IF]
```

### O bloco `:false` é opcional
Use-o apenas quando precisar de uma mensagem alternativa. Não é obrigatório ter os dois blocos.

### A IA não "vê" os blocos removidos
O bloco inteiro é removido do prompt **antes** de chegar ao modelo de IA. Não há risco da IA mencionar informações que não deveria.

---

## 5. Referência Rápida

| Recurso | Sintaxe | Descrição |
|---------|---------|-----------|
| Variável | `{minha_var}` | Substitui pelo valor enviado |
| Bloco positivo | `[IF:minha_var]...[/IF]` | Aparece se `minha_var` for verdadeiro |
| Bloco negativo | `[IF:minha_var:false]...[/IF]` | Aparece se `minha_var` for falso/ausente |

**Endpoint:** `POST /execute`

**Campo no body:** `context_variables: { "chave": "valor" }`
