# DOC Intelligence — fatia vertical (Trilha A · Backend)

Serviço de classificação e extração de documentos para o escritório Lamarck Advogados. Recebe um
documento (PDF/JPEG/PNG), processa de forma assíncrona (o modelo multimodal é um dublê — ver
`docs/adr/0004-limiar-de-confianca-e-stub-deterministico.md`), grava o resultado, e manda pra
revisão humana quando a confiança é baixa.

Este é um recorte deliberadamente estreito de um sistema maior. **Leia antes de julgar o
tamanho**: `docs/spec.md` (o que foi decidido e por quê) e a carta de fechamento (o que ficou de
fora e o que quebra primeiro com 10x volume).

> Contexto: esta entrega foi feita sob um prazo real de ~4h, não os 3 dias corridos previstos no
> edital — ver `ia/README.md`. Isso define o tamanho do que está aqui.

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
npm test            # node:test, ~20 casos, roda em <1s
```

**O que escolhi testar, e por quê**: não busquei cobertura alta — busquei os pontos onde um erro
silencioso seria caro ou embaraçoso. Quatro áreas, cada uma ligada a um fato do ambiente do
edital ou a um alvo de comportamento:

1. **Deduplicação por hash** (`ingest-document.test.ts`) — fato (c): mesmo documento chega mais de
   uma vez. Se isso quebrar, cada reenvio vira uma chamada paga em dobro ao classificador.
2. **Limiar de confiança e retry** (`process-document.test.ts`) — alvo #4: é o coração do produto
   ("não deixar o documento entrar como pronto"). Testei os dois lados do limiar e o caminho de
   falha→retry→failed (fato a), não só o caminho feliz.
3. **Concorrência otimista na revisão** (`review-document.test.ts`) — fato (g): duas pessoas na
   fila ao mesmo tempo. É o teste que mais me preocupava escrever errado (fácil simular "não deu
   conflito" por engano), por isso ele verifica explicitamente que a correção da primeira pessoa
   **sobrevive intacta** depois do conflito da segunda, não só que a segunda recebeu erro.
4. **Detecção de tipo por conteúdo** (`content-sniff.test.ts`) — fato (b): remetente não valida
   nada, nome de arquivo não é confiável.
5. **Serialização de escrita no repositório em arquivo** (`json-file-document-repository.test.ts`)
   — o teste de concorrência em `review-document.test.ts` prova a regra de negócio (versão errada
   é rejeitada) usando o fake em memória; este aqui prova que o adaptador real (arquivo JSON,
   fila de escrita interna) não perde uma mutação quando duas chamadas a `updateWithVersion`
   acontecem sem await entre elas — é a peça de concorrência que eu mais desconfiava de mim mesmo
   escrevendo à mão, então ganhou teste dedicado no adaptador, não só no domínio.

Não testei: a camada HTTP diretamente (rotas/middleware) — testei os casos de uso de domínio
puros, com um repositório em memória (`test/fakes/`) no lugar do adaptador de arquivo. A cobertura
HTTP ficou para verificação manual (ver sessão de smoke test nos prompts, `ia/prompts.md`) — é
código fino o suficiente (parse de request → chama caso de uso → serializa resposta) que o risco
de bug ali é menor do que nas quatro áreas acima.

## Estrutura

```
docs/spec.md          especificação — escrita antes do código
docs/adr/              decisões de arquitetura, uma por arquivo, com alternativas descartadas
src/domain/            entidades, portas (interfaces) e casos de uso — sem depender de Express/FS
src/adapters/          implementações concretas: HTTP, repositório em arquivo, LLM dublê
src/worker.ts          loop de processamento assíncrono
test/                  testes de domínio (node:test) + fakes
fixtures/              documentos fictícios para teste manual (nenhum dado real)
ia/                    registro de uso de IA (obrigatório pelo edital)
carta-de-fechamento/   carta de fechamento (fonte .md e PDF final)
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
