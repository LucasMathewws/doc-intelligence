# ADR 0006 — API key estática como placeholder de autenticação serviço-a-serviço

Status: aceito · deliberadamente incompleto (ver riscos)

## Contexto

Alvo #5 do edital: o serviço é consumido por outros sistemas internos, não por um navegador
anônimo na internet aberta. O edital explicitamente diz que autenticação real não é exigida nesta
entrega.

## Decisão

Middleware que exige header `Authorization: Bearer <valor>` igual a uma `API_KEY` fixa vinda de
variável de ambiente, em todas as rotas. Sem isso: `401`.

## Alternativas consideradas

- **Nenhuma verificação** (confiar só em estar numa rede interna): descartado — mesmo sendo uma
  fatia de demonstração, deixar zero barreira ensina o hábito errado, e o custo de um middleware de
  10 linhas é desprezível.
- **OAuth2 client-credentials entre serviços / mTLS**: é o desenho correto de produção para
  "consumido por outros sistemas internos" — cada sistema cliente com identidade própria,
  credencial rotacionável, escopo. Não implementado porque exige um provedor de identidade
  (Keycloak, Auth0, ou similar) — infraestrutura que o edital explicitamente dispensa
  ("não precisa... autenticação real") e que não muda a arquitetura do domínio.
- **API key por cliente** (não uma única global): meio termo razoável — daria pelo menos
  rastreabilidade de qual sistema chamou o quê. Não implementado por tempo; registrado aqui como o
  próximo passo natural antes de produção, não como esquecimento.

## Consequências / riscos conhecidos

- Uma única chave, sem expiração, sem escopo, sem rastreabilidade de qual sistema fez qual
  chamada. Isto é um placeholder, não uma solução de segurança — está documentado para não passar
  a impressão contrária.
- Não protege contra replay nem vazamento da chave em log — em produção, a chave nunca deveria
  viajar em query string nem ser logada (e não é, no código: só é lida do header).
