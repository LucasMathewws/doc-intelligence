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
falha, incrementa `attempts` e tenta de novo (até 3 tentativas) antes de marcar `failed`.

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

- Jobs em memória (documentos `received` ainda não pegos pelo worker) não sobrevivem a um restart
  do processo — ficam presos em `received` até o próximo boot varrer o repositório de novo (o
  worker relê `received` do repositório a cada ciclo, não só de uma fila em memória — por isso
  isso se auto-corrige no restart, mas gera atraso).
- Não há dead-letter queue nem alerta automático quando um documento cai em `failed`. Em produção,
  isso precisaria de observabilidade (ver `docs/spec.md` §7).
