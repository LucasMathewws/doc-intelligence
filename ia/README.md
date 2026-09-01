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

O exemplo mais concreto: ao escrever `test/process-document.test.ts`, assumi que o campo `nome`
seria usado no nome de arquivo sugerido para um documento do tipo `identidade` e escrevi a
asserção do teste em cima dessa suposição. Rodei a suíte (`npm test`) e ela falhou — não assumi
que o teste estava certo e fui direto mexer no código; comparei a asserção com
`KEY_FIELD_BY_TYPE` em `src/domain/suggest-filename.ts` e vi que o campo-chave real para
`identidade` é `numero`, não `nome`, e o objeto de teste (`CANNED`) só tinha `nome`. O código
estava correto (caiu no fallback `"documento"` como deveria); o erro era a expectativa do teste.
Corrigi a asserção, não o código, e documentei o motivo no próprio teste para a próxima pessoa não
repetir a mesma suposição. Um segundo ponto de fricção, menor: tentei inicialmente remover
acentos em `suggestFilename` com uma regex baseada em marcas diacríticas Unicode digitadas
literalmente; o resultado era difícil de verificar visualmente e as tentativas de correção via
edição de diff não pegavam a diferença de forma confiável. Em vez de insistir, troquei por um mapa
explícito de substituição de caracteres acentuados — mais verboso, mas verificável a olho e sem
depender de eu ter digitado o intervalo Unicode certo.

## O ponto de virada da sessão

A pergunta inicial de esclarecimento assumiu prazo de 3 dias corridos (o que o edital prevê). A
resposta do usuário revelou que o prazo real era às 13h do mesmo dia — poucas horas, não dias. O
agente conferiu o horário real do sistema antes de confiar nisso (`date` retornou UTC-3, batendo
com o horário local esperado) e replanejou o escopo inteiro na hora: de "3 dias com deliberação
linha a linha" para um plano compacto priorizado pelos critérios de nota do próprio edital
(arquitetura e rastreabilidade de decisões pesam mais que amplitude de funcionalidade). Ver
`ia/prompts.md` para a virada completa e a carta de fechamento para quanto tempo o trabalho
efetivamente levou.
