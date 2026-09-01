# Onde a implementação divergiu da especificação

O edital pede: *"Se a implementação divergiu da especificação, entregue a especificação como
estava e diga onde divergiu."*

- **A especificação como estava**: [`spec-original.md`](spec-original.md) — congelada no primeiro
  commit (`9490893`), com os erros que tinha na época, sem nenhuma correção.
- **A especificação viva**: [`spec.md`](spec.md) — corrigida, é a que descreve o sistema atual.
- **Onde divergiu**: esta tabela.

Cada linha diz o que a spec original prometia, o que o código faz, e em que categoria isso cai.
Uso três categorias, porque misturá-las esconderia o que interessa:

- **Divergência real** — a spec descrevia um comportamento e o código faz outro.
- **Erro de redação** — a spec estava simplesmente errada sobre o próprio projeto (referência
  cruzada trocada, alegação sobre código que não existia). Não é divergência: nunca houve duas
  intenções, houve uma frase errada.
- **Escopo ampliado** — o código faz mais do que a spec previa, porque uma releitura posterior
  achou um buraco.

---

## 1. `duplicateOf` — divergência real

| | |
|---|---|
| **Spec original dizia** | O `Document` teria um campo `duplicateOf: string?`, e a resposta `200 OK` de um reenvio traria esse campo "apontando pra ele mesmo". |
| **Código faz** | Não existe campo `duplicateOf`. A resposta traz `duplicate: true` (booleano), e o registro é o original, sem auto-referência. |
| **Por quê** | Um campo que aponta um documento para si mesmo não carrega informação nenhuma — o hash do conteúdo já É a chave de deduplicação. Um booleano diz ao cliente exatamente o que ele precisa saber (este registro não é novo) sem inventar uma referência circular. |
| **Quando** | Percebido ainda na fase de especificação, antes de escrever o endpoint (commit `28a24dc`). A `spec.md` viva foi corrigida; a original preserva o texto errado. |

## 2. Recuperação de documentos travados em `processing` — escopo ampliado

| | |
|---|---|
| **Spec original dizia** | A máquina de estados tinha `processing --(falha após N tentativas)--> failed` e mais nada saindo de `processing`. A ADR 0001 falava só que documentos `received` não se perdiam num restart. |
| **Código faz** | Todo boot roda `requeueStaleProcessing()` antes do worker começar: qualquer documento preso em `processing` (processo caiu no meio de uma chamada ao classificador) volta para `received`. |
| **Por quê** | A spec original não estava "errada", estava **incompleta de um jeito perigoso**: documentos em `processing` no momento de um crash não tinham nenhum caminho de volta e ficavam órfãos para sempre, silenciosamente. Isso é um bug, não uma decisão — foi corrigido no código, não só no texto. |
| **Quando** | Numa releitura completa após a primeira entrega (commit `d540c95`). Ver ADR 0001. |

## 3. Timeout na chamada ao classificador — escopo ampliado

| | |
|---|---|
| **Spec original dizia** | Nada. O fato do ambiente (a) diz que o modelo "de vez em quando... simplesmente não responde", e a spec tratava só dos casos de erro e de lentidão. |
| **Código faz** | `withTimeout()` envolve a chamada ao classificador (`LLM_CALL_TIMEOUT_MS`, default 45s); "não respondeu" entra no mesmo caminho de retry de uma falha comum. |
| **Por quê** | Sem teto de tempo, um classificador travado ocupa um slot de `MAX_CONCURRENT_LLM_CALLS` para sempre; o suficiente disso e o worker inteiro para de progredir sem emitir erro nenhum. Era o fato (a) lido pela metade. |
| **Quando** | Mesma releitura (commit `972d424`). Ver ADR 0001. |

## 4. `JobQueuePort` — erro de redação

| | |
|---|---|
| **Spec original dizia** | Que trocar a fila era "implementar `JobQueuePort`", como se essa interface existisse. |
| **Código faz** | Não existe `JobQueuePort` e nunca existiu. O que sustenta a troca é `processDocument` não importar nada de `worker.ts`. |
| **Por quê** | Frase escrita descrevendo um design que eu não implementei. Ao achar, **não criei a interface só para o texto ficar verdadeiro** — uma interface com um único caller seria abstração prematura, exatamente o que a ADR 0009 argumenta contra. Corrigi o texto para descrever o que de fato sustenta a alegação. |
| **Quando** | Releitura de referências cruzadas (commit `48c203e`). |

## 5. Referências de ADR trocadas — erro de redação

| | |
|---|---|
| **Spec original dizia** | Três citações apontavam para a ADR errada (ex.: um trecho sobre o dublê determinístico citava a ADR de persistência em vez da ADR do próprio dublê). |
| **Código faz** | (não aplicável — erro puramente textual) |
| **Quando** | Commits `48c203e` e `7498386`. |

## 6. `GET /health` sem API key — erro de redação

| | |
|---|---|
| **Spec original dizia** | "Todas as rotas exigem header `Authorization: Bearer <API_KEY>`". |
| **Código faz** | Rotas de negócio (`/v1/*`) exigem; `GET /health` não — é para infraestrutura verificar se o processo está de pé. |
| **Por quê** | O código sempre foi assim (`server.ts` registra `/health` fora do middleware, desde o primeiro commit da implementação, com comentário explicando). A spec é que dizia "todas" sem a ressalva, e nem documentava a rota. |
| **Quando** | Commits `7498386` e `2362b73`. |

## 7. Upload acima do limite devolvia `500` — divergência real (era bug)

| | |
|---|---|
| **Spec original dizia** | `400` para "arquivo ausente, tipo não reconhecido pelos magic bytes, ou acima do limite de tamanho". |
| **Código fazia** | `400` nos dois primeiros casos, mas **`500 internal_error`** no terceiro: o `MulterError` de `LIMIT_FILE_SIZE` não era tratado e caía no ramo genérico do error handler. |
| **Por quê importava** | Erro do cliente reportado como erro do servidor. Pelo fato do ambiente (b) — quem envia não valida nada — arquivo fora do limite é rotina diária, não incidente: em produção isso acordaria o plantão e ainda deixaria o cliente sem mensagem acionável. |
| **Como apareceu** | Testando a rota de verdade com `MAX_UPLOAD_BYTES=200` em vez de reler o código. As duas revisões anteriores leram esse trecho e não viram. |
| **Estado** | Corrigido: `uploadOrBadRequest()` traduz `MulterError` em `400` (`file_too_large` / `invalid_upload`). A spec viva agora lista os três códigos separadamente. |

## 8. Contrato de erro do `PATCH /review` incompleto — erro de redação

| | |
|---|---|
| **Spec original dizia** | Só o `409` de conflito de versão. |
| **Código faz** | Também `400` (`invalid_body`) e um segundo `409` (`invalid_review_state`, quando o documento existe e a versão bate mas o status não é `needs_review`) — este último **sem** o campo `current` no corpo, ao contrário do conflito de versão. |
| **Por quê** | O código sempre teve os dois casos (`errors.ts` + `error-handler.ts` desde o primeiro commit da implementação); a spec só descrevia um. |
| **Quando** | Commit `0827006`. |

---

## Sobre o marcador `**DIVERGÊNCIA**` prometido e não usado

A spec original abre dizendo que divergências estariam marcadas com `**DIVERGÊNCIA**` no ponto
exato em que acontecessem. Esse marcador **nunca foi usado** — não porque não houvesse
divergências (há, e estão acima), mas porque na hora de corrigir eu editei o texto em vez de
anotá-lo, que é justamente o oposto do que o edital pede. Este documento e o `spec-original.md`
existem para consertar isso: a promessa original era rastreabilidade, e ela agora está cumprida
por arquivo preservado + tabela, em vez de por marcador inline.
