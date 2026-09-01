# DOC Intelligence — Especificação (Trilha A · Backend)

> Escrito antes de programar. Passou por uma releitura completa depois da implementação (pedida
> pelo usuário, comparando este documento com o código de verdade, não com a memória do que eu
> achava que tinha escrito) — achou referências de ADR trocadas, uma alegação de arquitetura que
> não existia no código, uma máquina de estados incompleta (faltava o caminho de retry e o de
> recuperação de crash) e um contrato de erro incompleto no `PATCH /review`. Nada disso era
> "implementação divergiu de uma decisão de design que eu defenderia" — era erro de redação ou
> lacuna de revisão, então corrigi o texto direto em vez de manter o erro com uma nota ao lado. O
> texto original de cada correção e o porquê estão no histórico do git (`git log -p -- docs/`) e
> narrados em `ia/README.md`; nenhum é apagado, só não fica misturado ao texto corrente. Duas
> correções também mudaram *código* (não só a spec), as duas dentro do fato do ambiente (a):
> recuperação de documentos travados em `processing` após um crash, e um timeout na chamada ao
> classificador (o fato diz "de vez em quando... simplesmente não responde" — nada limitava isso
> antes). As duas estavam descritas como risco conhecido, não implementado, na primeira versão;
> implementadas de verdade nesta releitura (ver
> `docs/adr/0001-processamento-assincrono-e-retry.md`).
>
> Contexto de prazo: quando esta sessão começou, restavam ~4h até o prazo (ver `ia/prompts.md`) —
> bem menos do que eu tinha assumido de início. Não sei quando o documento foi originalmente
> recebido nem por que restava tão pouco tempo; só sei que restava. Isso define o tamanho do
> escopo abaixo — a decisão consciente foi cobrir os 7 fatos do ambiente com profundidade honesta,
> em vez de tentar as 5 funcionalidades-alvo por igual.

## 1. Objetivo

Substituir a triagem manual de documentos recebidos pelo atendimento (WhatsApp, e-mail, balcão)
por um serviço — **DOC Intelligence** — que recebe um documento, descobre o tipo, extrai campos,
propõe um nome padronizado, e expõe o resultado para consulta por outros sistemas internos.
Quando a confiança da extração é baixa, o documento não é dado como pronto: vai para conferência
humana.

## 2. Escopo desta entrega

Esta é a Trilha A: o contrato da API, o processamento e a persistência. Não há interface gráfica —
consumo é por HTTP, de outro sistema interno.

**Fatia vertical implementada** (end-to-end, rodando):

1. Receber um documento (imagem ou PDF) por HTTP.
2. Processar de forma assíncrona: um "dublê" (stub) faz o papel do modelo multimodal — sempre
   classifica o mesmo tipo de documento e devolve os mesmos campos para o mesmo arquivo, mas a
   confiança e a simulação de falha variam de forma determinística com o hash do conteúdo (ver
   ADR 0004), para que a demonstração exercite os dois caminhos (pronto / precisa revisão) sem
   precisar de flags manuais.
3. Gravar o resultado e permitir consultá-lo por id, e listar os já processados com filtro por
   status.
4. Quando a confiança fica abaixo do limiar configurado, o documento fica em `needs_review` e só
   sai desse estado por correção humana explícita — com proteção contra duas pessoas corrigindo o
   mesmo documento ao mesmo tempo (concorrência otimista).
5. Expor tudo atrás de uma verificação simples de API key, como placeholder de "isto é para
   consumo interno, não para navegador anônimo".

**Não incluído nesta fatia** (decisão consciente, não esquecimento — detalhado nos ADRs e na
carta de fechamento):

- Chamada real a um modelo multimodal de terceiro — é um dublê. Trocar por uma chamada real é
  implementar `LlmClassifierPort` de novo; o resto do sistema não muda (ADR 0004, ADR 0009).
- Normalização de foto torta/rotação EXIF antes de mandar pro classificador — registrado como
  risco conhecido (ADR 0007), não implementado.
- Autenticação real (OAuth2/mTLS entre serviços) — API key estática como placeholder (ADR 0006).
- Retenção/expurgo automático de dados pessoais e criptografia em repouso — descritos como
  decisão de arquitetura necessária, não implementados (ADR 0008).
- Interface gráfica de qualquer tipo.
- Alta cobertura de testes — só os testes que provam as decisões de maior risco (ver README).

## 3. Modelo de domínio

### 3.1 Documento

```
Document {
  id                 string (uuid)
  status             "received" | "processing" | "ready" | "needs_review" | "failed" | "reviewed"
  channel            "whatsapp" | "email" | "balcao" | "outro"
  sourceFilename     string   // nome enviado pelo cliente — nunca confiável, só exibição
  contentType        string   // detectado por magic bytes, não pelo header/extensão do cliente
  sizeBytes          number
  contentHash        string   // sha256 do conteúdo — chave de deduplicação
  receivedAt         string (ISO 8601)
  docType            "identidade" | "comprovante_residencia" | "contracheque" | "outro" | null
  fields             Record<string,string> | null   // campos extraídos, por tipo de documento
  confidence         number (0..1) | null
  suggestedFilename  string | null
  promptVersion      string | null   // ex.: "identidade.v1"
  modelVersion       string | null   // ex.: "stub-v1" — rastreável quando o fornecedor trocar
  attempts           number          // tentativas de processamento
  lastError          string | null
  reviewedBy         string | null
  reviewedAt         string (ISO 8601) | null
  version            number          // concorrência otimista (incrementa a cada escrita)
}
```

### 3.2 Máquina de estados

```
received --(worker pega o job)--> processing
processing --(confiança >= limiar)--> ready
processing --(confiança < limiar)--> needs_review
processing --(falha do classificador, ainda tem tentativa)--> received   [retry — fato a]
processing --(falha do classificador, esgotou tentativas)--> failed
processing --(processo caiu no meio — boot seguinte)--> received   [recuperação — ADR 0001]
needs_review --(PATCH /review com sucesso)--> reviewed
```

`failed` é terminal para o worker automático — sai daí por reprocessamento manual (fora do escopo
desta fatia; ver ADR 0001). `processing` **não é terminal nem em crash**: todo boot roda
`requeueStaleProcessing()` antes de o worker começar, recuperando qualquer documento preso em
`processing` de uma queda anterior — ver ADR 0001.

### 3.3 Tipos de documento cobertos pelo dublê

| Tipo | Campos extraídos |
|---|---|
| `identidade` | nome, filiacao, dataNascimento, numero, orgaoEmissor |
| `comprovante_residencia` | nomeTitular, endereco, dataEmissao |
| `contracheque` | nomeFuncionario, cargo, competencia, valorLiquido |
| `outro` | catch-all, sem campos estruturados garantidos |

Os demais tipos citados no edital (carteira de trabalho, laudo, procuração, contrato) entram como
`outro` nesta fatia — o registro de tipo/schema é uma tabela de configuração, não código
espalhado, então adicionar um tipo novo é adicionar uma entrada, não reescrever o pipeline.

## 4. Arquitetura

Estilo portas-e-adaptadores (hexagonal simplificado). O domínio não conhece Express, não conhece
sistema de arquivos, não conhece o formato de resposta do fornecedor de LLM — ele só conhece as
interfaces (`ports/`) que declara precisar.

```
                         ┌────────────────────────┐
  HTTP (Express) ───────▶│   casos de uso          │◀──────── worker loop (setInterval)
  POST /documents        │   (src/domain/services) │          processDocument()
  GET  /documents[/:id]  │                         │
  PATCH /:id/review      └───────────┬─────────────┘
                                      │  depende de (portas/interfaces)
                     ┌────────────────┼─────────────────┐
                     ▼                ▼                 ▼
          DocumentRepositoryPort  LlmClassifierPort  (config/relógio)
                     │                │
                     ▼                ▼
     JsonFileDocumentRepository   StubLlmClassifier
     (adapters/repository)        (adapters/llm)
```

**O que acontece quando uma peça precisa ser trocada** (é literalmente o critério de maior peso
da avaliação, então isso é intencional):

- **Trocar o modelo/fornecedor de LLM** (fato do ambiente **f**): implementa-se uma nova classe
  `LlmClassifierPort` (ex.: `OpenAiVisionClassifier`), troca-se uma linha de composição em
  `src/index.ts`. Nenhuma rota, caso de uso ou teste de domínio muda.
- **Trocar a persistência** (JSON local → Postgres, por volume — ver `ADR 0002` e a carta de
  fechamento sobre o que quebra com 10x volume): implementa-se `DocumentRepositoryPort` de novo.
  As queries de domínio (`findByHash`, `list`, `updateWithVersion`) já são a interface que o
  Postgres precisaria satisfazer.
- **Trocar a fila** (in-process → SQS/BullMQ, mesma razão de volume): **não há uma
  `JobQueuePort` formal nesta fatia** — seria abstração sem segunda implementação, o que a ADR
  0009 argumenta contra. O que existe, e que já entrega o mesmo efeito, é `processDocument`
  (`src/domain/services/process-document.ts`) não importar nada de `src/worker.ts` nem saber que
  existe um loop por trás — ele recebe um documento e as portas de que precisa, ponto. Trocar a
  fila é reescrever só `src/worker.ts` para consumir de SQS/BullMQ e chamar a mesma função por
  mensagem — nenhuma rota ou caso de uso muda, mesmo sem uma interface nomeada para isso.

## 5. Contrato da API

Todas as rotas de negócio (`/v1/*`) exigem header `Authorization: Bearer <API_KEY>` (placeholder
de autenticação serviço-a-serviço — ADR 0006); `GET /health`, descrito no fim desta seção, é a
única exceção. Respostas de erro seguem `{ "error": { "code", "message" } }`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/v1/documents` | Recebe um documento novo |
| GET | `/v1/documents` | Lista documentos (`?status=&docType=&page=&pageSize=`) |
| GET | `/v1/documents/:id` | Consulta um documento |
| GET | `/v1/documents/:id/file` | Baixa o arquivo original (bytes + content-type) |
| PATCH | `/v1/documents/:id/review` | Aplica correção humana |

### POST /v1/documents

`multipart/form-data`: campo `file` (obrigatório, PDF/JPEG/PNG, até 15MB), campo `channel`
(opcional, default `outro`), campo `sourceFilename` (opcional — se omitido, usa o nome do
multipart, mas nunca é usado para decidir tipo/conteúdo).

Validação: content-type é detectado pelos primeiros bytes do arquivo (magic bytes), não pela
extensão nem pelo `Content-Type` declarado pelo cliente (fato do ambiente **b**: quem envia não
valida nada do lado dele).

- `201 Created` — documento novo, corpo = `Document & { duplicate: false }` (status `received`).
- `200 OK` — hash já existe; corpo = `Document` existente `& { duplicate: true }`, para o cliente
  saber que não é um registro novo sem precisar comparar timestamps (fato **c**). Não criamos um
  registro novo self-referenciando o original — o hash já É a chave de deduplicação.
- `400` — arquivo ausente, tipo não reconhecido pelos magic bytes, ou acima do limite de tamanho.

### GET /v1/documents/:id

`200 OK` com o `Document` completo, ou `404`.

### GET /v1/documents

`200 OK` com `{ items: Document[], page, pageSize, total }`.

### GET /v1/documents/:id/file

Stream dos bytes originais com o `Content-Type` detectado. `404` se não existir.

### PATCH /v1/documents/:id/review

Corpo: `{ version: number, reviewer: string, fields?: Record<string,string>, docType?: string }`.

- `400` — `version` ausente/não-numérico ou `reviewer` ausente/vazio (`code: "invalid_body"`).
- `404` — id não existe.
- `409` (`code: "version_conflict"`) — `version` não bate com o `version` atual do documento
  (concorrência otimista — fato **g**). Corpo inclui `current` = `Document` atual, para o cliente
  reconciliar.
- `409` (`code: "invalid_review_state"`) — documento existe e a versão bate, mas `status` não é
  `needs_review` (ex.: já foi revisado, ou ainda está `processing`). Corpo **não** inclui
  `current` neste caso — é um erro de estado, não de concorrência.
- `200 OK` — sucesso: status vira `reviewed`, `version` incrementa, `reviewedBy`/`reviewedAt`
  preenchidos.

### GET /health

Fora do prefixo `/v1` e **não exige API key** — é para infraestrutura (load balancer,
orquestrador) verificar se o processo está de pé, não é contrato de negócio. `200 OK`,
`{ "status": "ok" }`. Ver ADR 0006.

## 6. Fatos do ambiente → decisão

| Fato | Tratamento nesta entrega |
|---|---|
| (a) LLM 5–40s, falha às vezes, ou não responde | Processamento assíncrono (worker separado do request HTTP); chamada ao classificador com timeout (`LLM_CALL_TIMEOUT_MS`, trata "não respondeu" como falha comum); retry com no máximo 3 tentativas antes de `failed`; stub simula atraso e falha determinística. ADR 0001. |
| (b) Remetente não valida nada, nome de arquivo não confiável | Tipo detectado por magic bytes; nome do cliente guardado só como metadado de exibição, nunca usado em lógica. |
| (c) Mesmo documento chega mais de uma vez | Dedup por SHA-256 do conteúdo em `POST /documents` — reenvio idêntico não cria registro novo. Registrado como limitação: foto **diferente** do mesmo papel físico tem hash diferente e não é pega por isso (ADR 0003). |
| (d) Dado pessoal sensível | API key obrigatória (fato e); campos extraídos nunca vão para log; `.gitignore` cobre `data/` e fixtures reais nunca entram no repo. Criptografia em repouso e retenção/expurgo — **não implementado**, registrado como risco (ADR 0008). |
| (e) 150/dia, pico 800 em 2h | Worker com limite de chamadas concorrentes ao classificador (`MAX_CONCURRENT_LLM_CALLS`), pra não estourar rate limit/custo do fornecedor nem o burst horário. Fila in-process, mas nada se perde num restart: documentos `received` já estão persistidos, e `requeueStaleProcessing()` recupera os que travaram em `processing` no boot seguinte (ADR 0001). O que **não** está resolvido é a vazão: no pico a 10x, a capacidade do worker fica bem abaixo do necessário — ver carta de fechamento, pergunta 2. |
| (f) Modelo/prompt vão mudar | `promptVersion`/`modelVersion` gravados por documento processado. Prompts do domínio (não os prompts desta sessão) vivem como arquivos versionados fora do código (`src/adapters/llm/prompts/*.md`), não como string solta. |
| (g) Duas pessoas na fila de revisão ao mesmo tempo | Concorrência otimista em `PATCH /review` via campo `version`; segunda escrita concorrente recebe `409`, não sobrescreve silenciosamente. ADR 0005. |

## 7. Requisitos não-funcionais e riscos conscientemente adiados

- **LGPD / dado sensível**: o desenho certo é criptografia em repouso (nível de disco ou coluna),
  controle de acesso por operação (não só um API key global) e expurgo automático após prazo de
  retenção. Nada disso está implementado nesta fatia — ver ADR 0008 e a carta de fechamento.
- **Observabilidade**: não há métricas/tracing nesta fatia. Em produção, o primeiro sinal a
  monitorar seria fila crescendo mais rápido que o worker drena (indicador direto do fato **e**).
- **Foto torta / qualidade de imagem** (parte do fato **b**): normalização de orientação EXIF ou
  "deskew" antes de mandar pro classificador não foi implementada — ver ADR 0007.
