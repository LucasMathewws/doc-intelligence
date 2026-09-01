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

Os erros mais sérios só apareceram numa segunda passada, pedida explicitamente pelo usuário ("faça
uma revisão completa... compare com o que está sendo pedido no pdf"), e os dois são sobre o mesmo
fato do ambiente (a) lido com mais cuidado do que da primeira vez. Primeiro: a ADR 0001 descrevia
o worker como recuperável num restart, mas só pela metade — documentos `received` sobrevivem
porque já estão persistidos; documentos `processing` no momento de um crash **não tinham nenhum
caminho de volta**, ficavam órfãos para sempre, e a ADR nem mencionava esse caso. Segundo, e mais
direto ainda: o fato (a) diz, com todas as letras, que o classificador "de vez em quando...
simplesmente não responde" — e nada no código impunha um teto de tempo pra essa chamada. Um
classificador real travado ocuparia um slot de concorrência do worker para sempre; o suficiente
disso acontecendo e o worker inteiro para, sem erro nenhum aparecendo em lugar nenhum. Os dois
eram bugs de verdade, não só lacuna de texto, e corrigi os dois no código: `requeueStaleProcessing()`
na porta do repositório (chamado uma vez no boot) e um `withTimeout()` em volta da chamada ao
classificador. Testei o primeiro manualmente, injetando um documento `processing` direto no
arquivo e subindo o servidor — o que revelou um TERCEIRO bug nesse processo: escrevi o arquivo de
teste com `Set-Content -Encoding utf8` do PowerShell (que grava BOM por padrão) e o `JSON.parse`
do repositório quebrava com isso. Testei o segundo com um classificador fake que nunca resolve a
promise. Os três ganharam teste automatizado (`json-file-document-repository.test.ts`,
`process-document.test.ts`).

Um segundo erro, de documentação: `docs/spec.md` §4 descrevia a troca de fila (in-process →
SQS/BullMQ) como algo isolado atrás de uma interface `JobQueuePort` — que nunca foi criada. Achei
isso e mais três citações de ADR com o número trocado passando um `grep` por todas as referências
cruzadas da spec depois do código pronto. Corrigi o texto direto (sem criar a interface só para a
spec "bater" — isso seria abstração sem segundo uso, que a própria ADR 0009 argumenta contra).
Um terceiro, menor: um teste (`process-document.test.ts`) tinha uma asserção errada sobre qual
campo vira o nome do arquivo sugerido; a suíte falhou, o código estava certo, corrigi o teste.

Em nenhum desses casos assumi que o texto/teste original estava certo e o código errado, ou
vice-versa — cada correção começou comparando os dois antes de decidir qual lado mudar.

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
