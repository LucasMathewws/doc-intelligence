# ADR 0001 — Processamento assíncrono, fora do ciclo de request HTTP, com retry limitado

Status: aceito

## Contexto

Fato do ambiente (a): a chamada ao modelo multimodal leva entre 5 e 40 segundos, é cobrada por
documento, e às vezes falha ou não responde. Um cliente HTTP (o atendimento, do celular) não pode
ficar preso numa requisição de até 40s, e uma falha do fornecedor não pode virar erro definitivo
do documento.

## Decisão

`POST /documents` grava o documento com status `received` e retorna imediatamente (201/200). Um
worker separado (loop com `setInterval`, fora do request/response HTTP) consome documentos
`received`, chama o classificador (porta `LlmClassifierPort`) e atualiza o status. Em caso de
falha, incrementa `attempts` e tenta de novo (até 3 tentativas) antes de marcar `failed`. A chamada
ao classificador é envolvida por um timeout (`LLM_CALL_TIMEOUT_MS`, default 45s — acima do teto
documentado de 40s) que trata "não respondeu" como falha comum, entrando no mesmo caminho de
retry.

O worker limita quantas chamadas ao classificador ficam em voo ao mesmo tempo
(`MAX_CONCURRENT_LLM_CALLS`, default 5) — resposta direta ao fato (e): no pico (800/dia
concentrados em 2h) o gargalo é o fornecedor cobrando por chamada e com rate limit próprio, não a
nossa CPU.

## Alternativas consideradas

- **Processar de forma síncrona dentro do POST**: descartado — o cliente ficaria esperando até
  40s, e qualquer timeout de proxy/gateway intermediário quebraria a requisição mesmo com o
  processamento tendo funcionado do lado do servidor.
- **Fila durável externa (SQS, BullMQ+Redis)**: é o caminho certo para produção (sobrevive a
  restart, escala pra múltiplos processos), mas depende de infraestrutura extra. Sob o prazo desta
  entrega (~4h), o risco de setup (Redis rodando, credenciais) não valia o ganho para provar a
  arquitetura. Não criei uma interface `JobQueuePort` formal para isso — seria abstração sem
  segunda implementação (ADR 0009 argumenta contra isso). O ponto de troca real é mais simples:
  `processDocument` (o caso de uso) não importa nada de `worker.ts` nem sabe que existe um loop —
  troca-se só `worker.ts` por um consumer de fila real, chamando a mesma função por mensagem. Ver
  `docs/spec.md` §4.
- **Retry infinito**: descartado — sem limite, um documento problemático nunca sai do sistema e
  consome orçamento de chamadas ao fornecedor indefinidamente.

## Consequências / riscos conhecidos

- Documentos `received` ainda não pegos pelo worker não perdem nada num restart — já estão
  persistidos, e o worker relê `received` do repositório a cada ciclo (não de uma fila só em
  memória). Só atrasa até o próximo boot varrer de novo.
- **Corrigido na releitura da spec, não só documentado**: documentos que estavam em `processing`
  no momento de um crash (o processo caiu no meio da chamada ao classificador) não tinham nenhum
  caminho automático de volta — `processing` não era varrido por nada, então ficavam órfãos para
  sempre. Isso não tinha sido percebido na primeira versão desta ADR, que só falava do caso
  `received` (mais simples) e ficava calada sobre `processing` (mais perigoso, porque é silencioso
  — o documento simplesmente nunca mais aparece em lugar nenhum da fila de trabalho). Resolvido
  com `DocumentRepositoryPort.requeueStaleProcessing()`, chamado uma vez no boot antes do worker
  começar: qualquer documento em `processing` volta para `received`. Custo: o documento perde o
  progresso da tentativa em andamento e paga uma chamada nova ao classificador — aceitável, dado
  que a alternativa é perda silenciosa e permanente.
- **Também corrigido nesta releitura**: o fato (a) diz, com todas as letras, que o classificador
  "de vez em quando... simplesmente não responde" — e nada na primeira versão do código limitava
  quanto tempo `processDocument` esperava por essa chamada. Um classificador real que trava
  (não erro, não timeout de rede — só nunca resolve a promise) ocuparia um slot de
  `MAX_CONCURRENT_LLM_CALLS` para sempre; o suficiente desses acontecendo e o worker inteiro para
  de progredir, silenciosamente. `withTimeout()` em `process-document.ts` resolve isso tratando "não
  respondeu em N ms" como uma falha comum, reentrando no retry existente. Alternativa considerada:
  estender `LlmClassifierPort.classify()` para aceitar um `AbortSignal` e cancelar de verdade a
  chamada subjacente — mais correto (não desperdiça a chamada de rede em andamento), mas muda a
  porta pública e toda implementação futura precisaria suportar cancelamento de verdade. Descartado
  por ora: a promise "vencida" pode continuar rodando em segundo plano (vazamento, não corrupção —
  o resultado dela, se chegar, é descartado porque o documento já mudou de versão), mas o worker
  não trava, que é o risco que importa aqui. Registrado como próximo passo se isso se confirmar
  caro em produção.
- Não há dead-letter queue nem alerta automático quando um documento cai em `failed` (esgotou as
  tentativas por erro do classificador, não por crash — esse caso *é* intencionalmente terminal).
  Em produção, isso precisaria de observabilidade (ver `docs/spec.md` §7).
