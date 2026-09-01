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

<!-- Novas entradas são adicionadas abaixo, em ordem, conforme a sessão continua. -->
