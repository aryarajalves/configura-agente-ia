# Diretrizes de Interface: Gerenciamente - Midia Iskcon

Este documento serve como guia mestre para o desenvolvimento da interface do projeto, garantindo que qualquer IA ou desenvolvedor siga os padrões estéticos e interativos desejados.

## 1. Estética Visual: "Premium Dark Mode"

A interface deve seguir rigorosamente o padrão visual de **painéis modernos e premium**, conforme as referências fornecidas (especialmente a segunda imagem).

### Características Principais:
- **Esquema de Cores:** Fundo em tons de azul escuro profundo ou preto acetinado. Uso de gradientes sutis em roxo e azul neon para elementos de destaque (botões, ícones ativos).
- **Tipografia:** Moderna, limpa e altamente legível (ex: Inter, Outfit ou Roboto).
- **Componentes:**
    - Cards com bordas levemente arredondadas e fundos semi-transparentes (glassmorphism sutil).
    - Menus laterais organizados com ícones minimalistas.
    - Espaçamento generoso para evitar poluição visual.

## 2. Comportamento Interativo (Micro-interações)

A interatividade é a chave para a sensação "premium" da plataforma. Devemos implementar o seguinte comportamento em **todos** os elementos interativos (botões, dropdowns, cards clicáveis, itens de lista):

### Efeito de Hover (Ao passar o mouse):
1. **Destaque Visual:** Deve aparecer uma linha (borda) nítida ao redor do elemento.
2. **Escalonamento:** O elemento deve aumentar ligeiramente de tamanho (ex: `scale(1.03)`) de forma suave.
3. **Transição:** A mudança deve ser animada (transição de aproximadamente 0.2s a 0.3s) para não parecer brusca.

```css
/* Exemplo de lógica CSS para interações */
.interactive-element {
  transition: transform 0.2s ease, border 0.2s ease;
  border: 2px solid transparent;
}

.interactive-element:hover {
  transform: scale(1.03);
  border: 2px solid #6366f1; /* Exemplo de cor neon */
  cursor: pointer;
}
```

## 3. Padrões de Design por Seção

- **Dashboard Principal:** Cards de resumo com ícones coloridos e métricas claras, como visto na referência.
- **Galeria de Mídias:** Grid de imagens/vídeos com metadados rápidos visíveis ao hover.
- **Modais e Diálogos:** Devem centralizar na tela, escurecer o fundo (backdrop blur) e ter botões de ação clara (ex: "Cancelar" vs "Sim, Sair"), seguindo o estilo da segunda imagem de referência.

### 3.1. Regras de Não Sobreposição e Hierarquia
É terminantemente proibido que elementos interativos (botões, ícones, textos) fiquem sobrepondo outros elementos de forma que prejudique a visibilidade ou a estética, especialmente durante animações de escala.

- **Zoom no Hover:** Quando um card ou imagem aumenta de tamanho (`scale`), os elementos internos ou sobrepostos (como botões de ação) devem ser calculados para não "vazar" ou cobrir informações vitais de outros cards.
- **Z-Index:** Deve haver uma gestão rigorosa de camadas. O elemento em foco deve estar sempre à frente, mas sem atropelar o layout vizinho.
- **Espaçamento:** Se um elemento cresce, ele deve preferencialmente ter espaço livre ao redor ou o overlay deve ser contido dentro dos limites do card pai com `overflow: hidden`.
- **Bloqueio de Scroll:** Sempre que um modal, popup ou lightbox estiver aberto, o scroll da interface de fundo (body/main) deve ser obrigatoriamente desativado (`overflow: hidden`) para evitar navegação indesejada enquanto o usuário interage com o elemento em destaque.

## 4. Ordem para a IA/Desenvolvedor

> [!IMPORTANT]
> **Sempre que for criar novos painéis ou componentes, eles devem ser esteticamente equivalentes à segunda imagem de referência fornecida.** Não aceite designs básicos ou genéricos. A interface deve parecer "viva" e responder a cada interação do usuário.
