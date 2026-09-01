# ADR 0010 — Node.js + TypeScript como linguagem e runtime

Status: aceito

## Contexto

O edital pede explicitamente para a escolha de linguagem/framework/banco/infraestrutura ser
justificada — "a escolha é conteúdo da avaliação". Esta ADR estava faltando: as outras nove
falam de decisões *dentro* da stack (persistência, framework HTTP, arquitetura), mas nenhuma
registrava por que a stack em si é Node.js + TypeScript. Lacuna encontrada na releitura completa
pedida pelo usuário — a justificativa sempre existiu (foi decidida no início da sessão, junto da
escolha de trilha), só nunca tinha sido escrita no repositório.

## Decisão

Node.js 22 + TypeScript, Express puro, sem framework de aplicação por cima (ver ADR 0009).

## Alternativas consideradas

- **Python (FastAPI)**: ecossistema forte para I/O assíncrono e processamento de arquivo/imagem,
  e é uma escolha natural para integração com LLMs. Descartado porque o critério real de escolha
  aqui não foi "qual stack é tecnicamente superior para o problema" — as duas resolvem — foi qual
  stack eu consigo defender decisão por decisão, sob um prazo que acabou sendo de horas (ver
  `ia/prompts.md`), sem escorregar em detalhe de sintaxe ou de biblioteca no meio do caminho.
  Node/TypeScript é onde tenho essa confiança maior.
- **Java/Kotlin, Go, C#/.NET**: todas adequadas ao problema (filas, processamento assíncrono,
  tipagem forte) e cotadas como opção na pergunta de esclarecimento inicial ao usuário. Descartadas
  pela mesma razão acima, e por terem setup/build mais pesado para uma fatia pensada para rodar em
  minutos a partir de `npm install`.
- **JavaScript puro, sem TypeScript**: mais rápido para escrever num primeiro momento, mas a
  arquitetura em portas (ADR 0009) depende de interfaces (`DocumentRepositoryPort`,
  `LlmClassifierPort`) sendo um contrato verificável, não uma convenção de nome de método. Sem
  tipos, "trocar a persistência sem tocar no domínio" vira uma promessa não verificada — o
  `tsc --noEmit` do CI (aqui, `npm run typecheck`) é o que garante isso de verdade.

## Consequências

- A escolha reflete quem estava escrevendo o código sob pressão de tempo, não uma comparação
  técnica neutra entre stacks — isso está registrado aqui de propósito, porque é exatamente o tipo
  de raciocínio que a carta de fechamento (pergunta 3) e este documento tentam não esconder.
- Ver `docs/adr/0002-persistencia-em-arquivo-json.md` e
  `docs/adr/0007-normalizacao-de-imagem-adiada.md` para onde essa escolha (evitar dependências com
  binding nativo) já apareceu concretamente nesta entrega.
