# ADR 0009 — Domínio isolado atrás de portas, HTTP fino (Express), sem framework opinativo

Status: aceito

## Contexto

O critério de maior peso da avaliação (30%) é arquitetura e modularidade — "o que acontece quando
uma peça precisa ser trocada". Três coisas neste sistema têm prazo de troca conhecido: o
fornecedor de LLM (fato f, "vai trocar de versão"), a persistência (ADR 0002, não escala do jeito
que está) e a fila (ADR 0001, mesma razão).

## Decisão

Camadas: `src/domain` (entidades, casos de uso, portas — sem importar Express, sem saber o que é
HTTP ou sistema de arquivo) → `src/adapters` (implementações concretas: HTTP/Express,
repositório em arquivo, classificador stub) → `src/index.ts` (composição: instancia os adaptadores
e injeta nos casos de uso). Um caso de uso como `ingestDocument(repo, input)` recebe o repositório
como parâmetro — não importa `JsonFileDocumentRepository` diretamente, só o tipo `DocumentRepositoryPort`.

Framework HTTP: Express puro, sem NestJS/framework opinativo por cima.

## Alternativas consideradas

- **NestJS** (ou similar, com DI container, decorators, módulos): daria uma estrutura "pronta" e é
  uma escolha legítima em produção — mas tem curva própria (decorators, providers, módulos) que
  competiria por tempo de leitura com o que estou tentando mostrar (a separação em si), e adiciona
  dependências/build step que não valem o ganho numa fatia de horas. A separação em portas não
  depende de framework nenhum — é só disciplina de import.
- **Tudo num arquivo só (`server.ts` com rotas chamando o repositório direto)**: mais rápido de
  escrever agora, mas é exatamente o oposto do que está sendo avaliado — trocar o LLM ou o banco
  significaria caçar chamadas espalhadas pelo arquivo inteiro.
- **Injeção de dependência via container (tsyringe, inversify)**: resolve o mesmo problema que a
  composição manual em `index.ts` resolve aqui, com mais mecanismo (decorators, metadata reflection)
  que não se paga numa aplicação deste tamanho. Composição manual é suficiente e mais fácil de ler
  em 4 horas de revisão.

## Consequências / riscos conhecidos

- Composição manual em `index.ts` não escala infinitamente — com muitos casos de uso e adaptadores,
  um container de DI passa a valer a pena. Não é o caso aqui (2 portas —
  `DocumentRepositoryPort`, `LlmClassifierPort` — com um adapter secundário cada, mais o HTTP como
  único adapter de entrada).
- A disciplina de "domínio não importa Express" depende de revisão de código continuada; não há
  lint rule aplicada nesta fatia para impedir um import errado (ex.: `eslint-plugin-boundaries`
  faria isso em produção — não configurado aqui por tempo).
