# ADR 0005 — Concorrência otimista (campo `version`) na correção humana

Status: aceito

## Contexto

Fato do ambiente (g): duas pessoas do atendimento podem abrir a fila de conferência ao mesmo
tempo. Se ambas puxarem o mesmo documento `needs_review` e corrigirem, a segunda escrita não pode
apagar silenciosamente a primeira.

## Decisão

Todo documento tem um campo `version` (inteiro, incrementa a cada escrita). `PATCH
/documents/:id/review` exige `version` no corpo da requisição, igual ao `version` atual do
documento — senão devolve `409 Conflict` com o estado atual, e não aplica a mudança.

## Alternativas consideradas

- **Lock pessimista** (endpoint `POST /:id/claim` que trava o documento para um revisor,
  com expiração): reflete melhor a experiência de UI ("este documento já está sendo revisado por
  fulano"), mas exige lidar com expiração de lock (o que acontece se o revisor fecha a aba?) e é
  mais estado para gerenciar. Descartado para esta fatia pelo custo de implementação frente ao
  ganho — o problema real que o fato (g) descreve é **não perder uma correção**, não impedir
  trabalho simultâneo; concorrência otimista resolve isso com bem menos mecanismo.
- **Last-write-wins (sem controle nenhum)**: é o que já existe implicitamente hoje na planilha
  manual, e é exatamente o tipo de bug silencioso que o fato (g) está avisando para não repetir.
  Descartado.
- **Lock distribuído (Redis)**: infraestrutura desnecessária para o problema — só duas pessoas
  concorrentes, não um cluster de workers.

## Consequências / riscos conhecidos

- O revisor que perde a corrida recebe um 409 e precisa re-submeter em cima do estado novo — isso
  é uma decisão de UX que caberia à Trilha B (o mock de contrato já devolve o estado atual no 409
  exatamente para isso: a UI pode mostrar "algo mudou, revise de novo" sem outra chamada).
- Não há sinalização de "fulano está vendo este documento agora" — só se descobre o conflito na
  hora de salvar, não antes. Aceitável para dois usuários concorrentes (fato g diz "duas pessoas",
  não uma sala inteira).
