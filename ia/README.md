# Registro de uso de IA

Requisito obrigatório do edital (item II.4). Esta entrega foi conduzida por pair programming com
o Claude Code (Sonnet 5) durante toda a sessão — arquitetura, especificação, código, testes e esta
mesma documentação.

## Ferramentas e configuração

- **Agente**: Claude Code, sessão única, do início (leitura do edital) até o fim (carta de
  fechamento).
- **Instrução do agente**: `CLAUDE.md` na raiz do repositório — convenções de camadas, comandos e
  as regras não-negociáveis (sem dado real, concorrência otimista obrigatória em mutação, etc.).
- **Skills, subagentes, hooks, MCP servers**: nenhum configurado especificamente para este
  projeto. Foram usadas apenas as ferramentas padrão do Claude Code (edição de arquivo, bash/
  PowerShell, git). Não criei um subagente dedicado porque o trabalho era sequencial e
  interdependente (a spec informa o código, o código informa os testes) — delegar pedaços a
  agentes paralelos teria custado mais tempo em re-sincronizar contexto do que economizado,
  especialmente sob o prazo real desta entrega (ver abaixo).
- **Prompts**: `ia/prompts.md`, na íntegra, na ordem em que aconteceram, incluindo o ponto em que
  o prazo real (horas, não dias) mudou o plano inteiro.

## Onde o agente errou, como percebi, e o que fiz

O erro mais significativo não estava no código — estava na documentação sobre o código. Ao
escrever `docs/spec.md` §4, descrevi a troca de fila (in-process → SQS/BullMQ) como algo isolado
atrás de uma interface `JobQueuePort`, citando-a como se já existisse. Ela nunca foi criada — não
há esse arquivo, essa interface, nada. Isso só apareceu porque fiz uma releitura deliberada da
spec inteira depois do código pronto (não fazia parte do plano original, foi uma escolha de usar
tempo de sobra) e passei um `grep` por todas as citações de ADR pra conferir se cada uma apontava
pro assunto certo. Achei essa reivindicação falsa e mais três citações de ADR com o número
trocado (ex.: um trecho sobre o dublê determinístico citava a ADR de persistência em vez da ADR
do próprio dublê). Corrigi as quatro, e na do `JobQueuePort` não criei a interface só para a spec
ficar "verdadeira" — descrevi o que realmente sustenta a alegação (`processDocument` não importa
nada de `worker.ts`, então a troca é isolada mesmo sem interface nomeada), porque criar uma
interface com um único caller só para bater com o texto seria exatamente o tipo de abstração
prematura que a ADR 0009 argumenta contra. Um segundo erro, menor e mais mecânico: em
`test/process-document.test.ts`, assumi por engano que o campo `nome` seria usado no nome de
arquivo sugerido para `identidade`; a suíte falhou, comparei a asserção com `KEY_FIELD_BY_TYPE`
em `suggest-filename.ts`, vi que o campo-chave real é `numero`, e corrigi o teste — não o código,
que já estava certo.

## O ponto de virada da sessão

A primeira pergunta de esclarecimento já incluiu, como uma das opções, "recebi hoje, restam ~3
dias corridos" — por precaução, não por suposição: não havia como saber sem perguntar. A resposta
do usuário revelou que o prazo real era às 13h do mesmo dia — poucas horas, não dias (não se sabe
aqui quando o documento foi originalmente recebido nem por quê restava tão pouco; só que restava).
O agente conferiu o horário real do sistema antes de confiar nisso (`date` retornou UTC-3, batendo
com o horário local esperado) e replanejou o escopo inteiro na hora: de "vários dias com
deliberação linha a linha" para um plano compacto priorizado pelos critérios de nota do próprio
edital (arquitetura e rastreabilidade de decisões pesam mais que amplitude de funcionalidade). Ver
`ia/prompts.md` para a virada completa e a carta de fechamento para quanto tempo o trabalho
efetivamente levou.
