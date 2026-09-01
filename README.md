# DOC Intelligence — fatia vertical (Trilha A · Backend)

Serviço de classificação e extração de documentos para o escritório Lamarck Advogados. Recebe um
documento (PDF/JPEG/PNG), processa de forma assíncrona (o modelo multimodal é um dublê — ver
`docs/adr/0004-limiar-de-confianca-e-stub-deterministico.md`), grava o resultado, e manda pra
revisão humana quando a confiança é baixa.

Este é um recorte deliberadamente estreito de um sistema maior. **Leia antes de julgar o
tamanho**: `docs/spec.md` (o que foi decidido e por quê) e a carta de fechamento (o que ficou de
fora e o que quebra primeiro com 10x volume).

> Contexto: quando esta sessão começou, restavam ~4h até o prazo, bem menos do que eu tinha
> assumido de início — ver `ia/README.md`. Isso define o tamanho do que está aqui.

## Como rodar

Pré-requisitos: Node.js 20+ (testado em 22.19).

```bash
npm install
npm start          # sobe o servidor + worker em http://localhost:3000
```

Não precisa de `.env` — todos os valores em `.env.example` já são o default no código
(`src/config.ts`). Copie para `.env` só se quiser mudar algo.

Todas as rotas em `/v1/*` exigem `Authorization: Bearer <API_KEY>`. Em dev, a chave default é
`dev-local-key` (aparece no log ao subir o servidor).

```bash
# enviar um documento fictício
curl -H "Authorization: Bearer dev-local-key" \
     -F "file=@fixtures/rg-ficticio.pdf" -F "channel=whatsapp" \
     http://localhost:3000/v1/documents

# consultar (troque :id pelo id devolvido acima — o processamento e assincrono,
# espere ~1-2s antes de consultar)
curl -H "Authorization: Bearer dev-local-key" http://localhost:3000/v1/documents/:id

# listar
curl -H "Authorization: Bearer dev-local-key" "http://localhost:3000/v1/documents?status=needs_review"
```

Contrato completo (todas as rotas, formatos de erro, máquina de estados): `docs/spec.md` §5.

## Testes

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test, 28 casos, roda em <1s
```

**O que escolhi testar, e por quê**: não busquei cobertura alta — busquei os pontos onde um erro
silencioso seria caro ou embaraçoso. Cinco áreas, cada uma ligada a um fato do ambiente do
edital ou a um alvo de comportamento:

1. **Deduplicação por hash** (`ingest-document.test.ts`) — fato (c): mesmo documento chega mais de
   uma vez. Se isso quebrar, cada reenvio vira uma chamada paga em dobro ao classificador.
2. **Limiar de confiança, retry, timeout e cobrança única** (`process-document.test.ts`) — alvo
   #4: é o coração do produto ("não deixar o documento entrar como pronto"). Testei os dois lados
   do limiar, o caminho falha→retry→failed, o caso mais literal do fato (a) (um classificador que
   nunca responde), e que o mesmo documento processado em paralelo chama o classificador **uma
   vez só** — esse último porque o fato (a) diz que a chamada é cobrada por documento, e a
   proteção existia por acidente (efeito colateral da checagem de versão da ADR 0005) sem nenhum
   teste apontando para ela.
3. **Concorrência otimista na revisão** (`review-document.test.ts`) — fato (g): duas pessoas na
   fila ao mesmo tempo. É o teste que mais me preocupava escrever errado (fácil simular "não deu
   conflito" por engano), por isso ele verifica explicitamente que a correção da primeira pessoa
   **sobrevive intacta** depois do conflito da segunda, não só que a segunda recebeu erro.
4. **Detecção de tipo por conteúdo** (`content-sniff.test.ts`) — fato (b): remetente não valida
   nada, nome de arquivo não é confiável.
5. **O adaptador de arquivo real** (`json-file-document-repository.test.ts`) — três coisas que só
   aparecem fora do fake em memória: (a) serialização de escrita — duas chamadas a
   `updateWithVersion` sem await entre elas não podem perder uma mutação; (b) recuperação de
   documentos travados em `processing` após um crash simulado (restart com duas instâncias do
   repositório apontando pro mesmo diretório) — achado numa releitura, não estava coberto antes;
   (c) tolerância a BOM no `documents.json` — achado testando (b) manualmente, quando escrever o
   arquivo de fixture com PowerShell quebrou o `JSON.parse`. As três são a peça de maior risco do
   próprio adaptador, não do domínio, por isso ganharam teste dedicado em vez de só confiar no fake.

Não testei: a camada HTTP diretamente (rotas/middleware) — testei os casos de uso de domínio
puros, com um repositório em memória (`test/fakes/`) no lugar do adaptador de arquivo. A cobertura
HTTP ficou para verificação manual (ver sessão de smoke test em `ia/prompts.md`) — é código fino o
suficiente (parse de request → chama caso de uso → serializa resposta) que o risco de bug ali é
menor do que nas cinco áreas acima.

## Estrutura

```
docs/spec.md            especificação viva (corrigida) — escrita antes do código
docs/spec-original.md   a mesma spec congelada no 1º commit, com os erros da época
docs/divergencias.md    onde a implementação divergiu da spec original, item por item
docs/adr/               decisões de arquitetura, uma por arquivo, com alternativas descartadas
docs/openapi.yaml       contrato formal (espelha docs/spec.md §5)
src/domain/             entidades, portas (interfaces) e casos de uso — sem depender de Express/FS
src/adapters/           implementações concretas: HTTP, repositório em arquivo, LLM dublê
src/adapters/llm/prompts/  prompts do PRODUTO (não os desta sessão — ver ia/), versionados por tipo
src/worker.ts           loop de processamento assíncrono
test/                   testes de domínio (node:test) + fakes
fixtures/               documentos fictícios para teste manual (nenhum dado real)
ia/                     registro de uso de IA (obrigatório pelo edital)
carta-de-fechamento/    carta de fechamento (fonte .md e PDF final)
```

## O que não está aqui (de propósito)

Resumo — detalhes e justificativa em `docs/spec.md` §2 e nos ADRs:

- Chamada real a um modelo multimodal (é um dublê determinístico).
- Interface gráfica.
- Autenticação real (API key estática como placeholder — ADR 0006).
- Normalização de foto torta/EXIF (ADR 0007), criptografia em repouso e retenção de dados (ADR
  0008) — registrados como risco conhecido, não implementados.
- Fila durável (Redis/SQS) e Postgres — ADR 0001/0002. A arquitetura em portas existe para essa
  troca ser isolada quando o volume pedir.
