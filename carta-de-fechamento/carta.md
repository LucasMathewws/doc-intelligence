Mossoró, 1 de setembro de 2026.

Ao Sr. Kalyl Lamarck Silvério Pereira,

Esta carta acompanha a entrega do desafio técnico para a vaga de Desenvolvedor — DOC
Intelligence, Trilha A (Backend). Responde às quatro perguntas pedidas no edital.

**1. O que ficou de fora, e por quê**

Duas categorias. A primeira é escopo explicitamente fora do alvo desta fatia: não há chamada real
a um modelo multimodal (é um dublê determinístico — ADR 0004), não há interface gráfica, e apenas
três tipos de documento têm schema de campos completo (identidade, comprovante de residência,
contracheque); os demais citados no edital caem num tipo genérico "outro". A segunda categoria é
risco conscientemente registrado e não implementado: normalização de foto torta/orientação EXIF
(ADR 0007), criptografia em repouso e retenção/expurgo de dado sensível (ADR 0008), autenticação
real serviço-a-serviço no lugar de uma API key estática (ADR 0006), e fila durável (Redis/SQS) no
lugar do loop in-process atual (ADR 0001). Nenhuma dessas é uma omissão silenciosa — cada uma tem
uma ADR explicando a troca considerada e por que fiquei com a alternativa mais simples. A razão de
fundo, para todas: quando comecei a trabalhar nisso, restavam poucas horas até o prazo, não os
dias que eu tinha assumido de início (ver pergunta 4) — a escolha consciente foi tratar os 7 fatos
do ambiente com profundidade honesta, em vez de perseguir as 5 funcionalidades-alvo por igual.

**2. O que quebra primeiro se o volume for multiplicado por dez**

Nos números: o pico atual (800 documentos em 2h) já é ~6,7 documentos/minuto; a dez vezes, ~67/minuto.
O worker desta fatia (concorrência limitada a 5 chamadas simultâneas, cada uma levando até 40s no
cenário real) sustenta uma fração pequena disso — na configuração atual, algo entre 7 e 15
documentos/minuto no melhor caso. O pico de 2h deixaria de caber em 2h; viraria uma fila que só
esvazia depois do expediente. Mas o gargalo mais imediato não é nem esse: é a persistência em
arquivo JSON (ADR 0002), que reescreve o arquivo inteiro a cada mutação e serializa toda escrita
num único processo — a 10x volume, cada transição de estado de cada documento (recebido →
processando → pronto/revisão, mais a correção humana) compete pelo mesmo arquivo cada vez maior.
Isso quebra antes mesmo do worker saturar, e quebra de um jeito silencioso (tudo continua
"funcionando", só cada vez mais devagar) — o tipo de falha mais perigoso de não perceber a tempo.
Correção nessa ordem: Postgres (dedup e status indexados) antes de qualquer fila durável.

**3. Qual das minhas decisões eu menos defenderia hoje**

Persistência em arquivo JSON local (ADR 0002) — e eu já sinalizei isso na própria ADR, não é uma
dúvida que surgiu só agora escrevendo esta carta. Descartei `better-sqlite3` pelo risco de
compilação nativa no Windows sob prazo curto, o que é uma preocupação real. Mas eu já tinha
confirmado Node 22.19 disponível, que tem `node:sqlite` embutido — eu poderia ter gasto cinco
minutos testando se funcionava (mesmo atrás de flag experimental) antes de descartar SQLite de
vez. Não gastei; fui direto para a opção que eu tinha certeza que funcionaria. Foi uma escolha
conservadora que, olhando para trás, provavelmente custou mais em qualidade de arquitetura do que
economizou em risco — a pergunta 2 desta carta é exatamente sobre a peça que essa decisão deixou
frágil.

**4. Quanto tempo isso tudo levou**

Perguntei quanto tempo restava logo no início, sem assumir nada — e foi bom ter perguntado: o
prazo real era às 13h de hoje, 1º de setembro. A sessão inteira, do primeiro contato com o PDF do
edital até esta carta, coube em uma única manhã, entre 8h52 e aproximadamente
10h05, cerca de 1h13 corridas, sem pausa. Isso está registrado em detalhe em
`ia/prompts.md` porque muda a leitura de tudo o que vem antes nesta carta: o padrão de decisão
não foi "o que é tecnicamente melhor", foi "o que é honesto e defensável dentro do tempo que
realmente existia" — inclusive esta resposta.

Atenciosamente,

Lucas Mathews
