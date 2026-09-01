# Log de prompts (verbatim, em ordem)

Este arquivo registra o que o usuário escreveu/decidiu na sessão com o agente (Claude Code),
na ordem em que aconteceu, sem reescrever depois para ficar bonito. Onde a interação não foi
texto livre (ex.: resposta a uma pergunta estruturada do agente), isso está marcado.

Contexto: sessão rodou em 2026-09-01, com prazo de entrega às 13h do mesmo dia (ver `ia/README.md`
e a carta de fechamento para como isso mudou a condução do trabalho).

---

## 1. Mensagem inicial do usuário

Anexo: `Processo Seletivo.pdf` (o edital recebido do escritório — não reproduzido aqui porque já é
a fonte primária referenciada em `docs/spec.md`; o conteúdo do PDF não é um prompt escrito pelo
usuário, é o documento que ele pediu para eu ler).

Texto do usuário:

> leia pra mim esse arquivo e compreenda o seu conteúdo. Entenda-o e me ajude a passar nessa
> seleção. quero que desenvolva junto comigo o que é necessário. O arquivo pode estar um pouco
> estranho porque tive que converter em pdf mas os enunciados estão todos aí

---

## 2. Perguntas de esclarecimento do agente e respostas do usuário

O agente abriu com um resumo do edital e usou uma pergunta estruturada (múltipla escolha,
4 perguntas) para não travar em decisões que só o usuário poderia tomar. Respostas do usuário,
verbatim:

- **Qual trilha você quer seguir?** → "Trilha A — Backend"
- **Quanto tempo temos até o prazo (3 dias corridos a partir do recebimento do edital)?** →
  "o prazo é até 13 horas de hoje, dia 01 do 09 "
- **Qual stack você tem mais confiança para usar e defender nas decisões de arquitetura?** →
  "Node.js / TypeScript"
- **Como você quer conduzir o trabalho comigo pelos próximos dias?** → "Pair programming
  (recomendado)"

Essa resposta do prazo foi o ponto de virada da sessão: o plano original (3 dias, deliberação
linha a linha) foi descartado na hora — restavam ~4h. O agente checou o horário real do sistema
(`date`) antes de confiar no número, e replanejou o escopo inteiro em cima disso.

---

## 3. Segunda pergunta de esclarecimento (assinatura da carta e repositório remoto)

Antes de fechar a carta e criar o repositório remoto, o agente fez outra pergunta estruturada
(2 perguntas). Respostas do usuário, verbatim:

- **Qual nome/assinatura devo usar no fechamento da carta?** → "Lucas Mathews"
- **Como vamos lidar com o repositório remoto (GitHub) para o envio?** → "quero que você crie e
  dê o push"

---

## Nota: trecho sem prompt novo do usuário (execução autônoma)

Entre a entrada 3 e a entrada 4 abaixo, não houve nenhum prompt novo do usuário — o agente
trabalhou de forma contínua: escreveu `docs/spec.md` e as 9 ADRs, implementou a fatia vertical
completa (domínio, adapters, HTTP, worker), escreveu e rodou os 24 testes, escreveu
README/CLAUDE.md/registro de uso de IA, formalizou o contrato em `docs/openapi.yaml`, fez uma
releitura deliberada da spec e das ADRs e corrigiu erros reais encontrados nelas (ver
`ia/README.md`), e conduziu a criação do repositório no GitHub e o push — incluindo contornar uma
falha real do `gh` CLI causada por uma interação entre o sandbox deste ambiente e o acesso ao
cofre de credenciais do Windows. Essa sequência está refletida no histórico de commits
(`git log`), não neste arquivo, porque não envolveu prompt novo — só execução. Notificações
automáticas de tarefas em segundo plano (sucesso/falha de login no GitHub) chegaram ao agente
nesse intervalo; não são prompts do usuário — são eventos de sistema — e por isso não estão
listadas aqui como se o usuário tivesse dito algo.

---

## 4. Evento espúrio: sentinela de wakeup — NÃO é um prompt do usuário

Depois do agente entregar o resumo final (repositório publicado, carta enviada), chegou uma
mensagem contendo só o texto `<<autonomous-loop-dynamic>>`. **Isso não foi o usuário digitando
nada.** Foi um lembrete (`ScheduleWakeup`) que o próprio agente tinha agendado por engano mais
cedo na sessão — usando uma ferramenta destinada a um modo `/loop` que o usuário nunca ativou —
disparando sozinho, sem propósito real. O agente reconheceu isso, cancelou o lembrete
(`ScheduleWakeup` com `stop: true`) e avisou o usuário que não era uma mensagem real dele, sem
tratar aquilo como confirmação ou como um novo pedido de trabalho. Registrado aqui por
transparência, já que tecnicamente "chegou" como uma entrada na conversa — mas não é um prompt do
usuário e não deve ser lido como se fosse.

---

## 5. Pedido de revisão completa

Contexto: o usuário abriu `carta-de-fechamento/carta.md` no editor (evento do IDE, não um
prompt — registrado aqui só porque veio junto da mensagem seguinte).

Texto do usuário:

> faça um revisão completa, analise novamente, compare com o que está sendo pedido no pdf e
> corrija o que for necessário

---

## 6. Troca de modelo e segundo pedido de revisão

O usuário rodou o comando `/model opus` (comando local da CLI, não um prompt: trocou o modelo do
agente de Sonnet 5 para Opus 5 no meio da sessão). Em seguida, o prompt:

> revise mais uma vez, analise, compare o que foi pedido e me fale se ainda falta fazer mais
> alguma coisa

Esta segunda revisão achou o erro mais constrangedor da entrega: **a carta de fechamento em PDF
estava inteira em Arial**, não em Roboto — a única exigência de formatação explícita do edital. O
`<link>` do Google Fonts não carregava na renderização headless e o fallback entrou sem erro
nenhum. A revisão anterior tinha *lido* o CSS (`font-family: 'Roboto'`) e concluído que estava
certo, sem nunca conferir o resultado. Achado ao inspecionar as fontes realmente embutidas no
PDF. Também nesta rodada: a spec passou a ser entregue "como estava" mais um registro de
divergências, como o edital pede literalmente (ver `docs/spec-original.md` e
`docs/divergencias.md`).

---

<!-- Novas entradas são adicionadas abaixo, em ordem, conforme a sessão continua. -->
