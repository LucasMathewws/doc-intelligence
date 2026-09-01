# ADR 0002 — Persistência em arquivo JSON local, atrás de uma porta de repositório

Status: aceito · **candidato a ser a decisão que eu menos defenderia** (ver carta de fechamento)

## Contexto

Track A pede para desenhar a persistência, não necessariamente rodar Postgres. O prazo real desta
entrega é de horas, num ambiente Windows onde eu não confio de antemão em toolchain de compilação
nativa disponível.

## Decisão

`JsonFileDocumentRepository` implementa `DocumentRepositoryPort` (`save`, `findById`,
`findByHash`, `list(filtro)`, `updateWithVersion`) lendo/escrevendo um único arquivo
`data/documents.json` (todo o conteúdo em memória, reescrito inteiro a cada mutação). Os bytes
originais dos arquivos enviados vão para `data/blobs/<hash>`, fora do JSON.

## Alternativas consideradas

- **`better-sqlite3`**: SQLite embutido é o formato certo para uma fatia vertical (arquivo único,
  real, sem servidor). Descartado por risco: tem binding nativo, e compilação nativa no Windows
  sob um prazo de horas é um risco que eu não queria correr — se `npm install` travar em
  `node-gyp`, perco tempo que não tenho para recuperar.
- **`node:sqlite` (built-in do Node 22)**: nesta versão do Node (22.19) ainda é experimental atrás
  de flag. Evitado para não obrigar quem for rodar o projeto a descobrir uma flag experimental no
  README.
- **Postgres real (via Docker)**: é a escolha de produção de fato — ver `docs/spec.md` §7 e a
  carta de fechamento sobre o que quebra com 10x volume. Descartado para esta fatia porque exige
  Docker rodando e não muda o que está sendo avaliado (a fronteira do repositório é a mesma).
- **Em memória, sem persistir em disco**: descartado — o alvo #3 do edital ("consultar o resultado
  ... e listar os já processados") pressupõe que sobrevive a um restart do processo; em memória
  pura não prova isso.

## Consequências / riscos conhecidos

- Reescrever o arquivo inteiro a cada mutação não escala além de poucos milhares de documentos —
  isto é exatamente o tipo de coisa que quebra primeiro com 10x volume (ver carta de fechamento).
- Sem índice: `findByHash` e `list` são varredura linear em memória. Aceitável no volume desta
  demonstração (dezenas de documentos), não em produção.
- Zero controle de acesso por linha/coluna — qualquer processo com acesso ao disco lê tudo em
  texto claro. Ver ADR 0008 sobre LGPD.
- A troca para Postgres é isolada: nova classe implementando `DocumentRepositoryPort`, sem tocar
  em rotas ou casos de uso — essa é a aposta arquitetural que justifica não ter feito Postgres
  agora.
