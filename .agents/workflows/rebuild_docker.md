---
description: Reconstrói e reinicia os containers Docker localmente
---

# Instrução Base
Toda vez que você criar uma funcionalidade nova, editar arquivos, ou atualizar algo no projeto, você **DEVE** executar as etapas abaixo obrigatoriamente para recriar as imagens e rodar os novos containers, refletindo as modificações que acabou de fazer.

### Passo 1: Reiniciar os Containers
Execute o comando via terminal na raiz do projeto de forma assíncrona.

// turbo-all
```bash
docker-compose -f docker/docker-compose-local.yml up -d --build
```

### Passo 2: Confirmação
Aguarde a execução terminar para se certificar de que o painel e a API e afins subiram nos containers corretamente e que não há erros de construção no Dockerfile.
