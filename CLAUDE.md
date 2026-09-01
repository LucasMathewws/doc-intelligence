# CLAUDE.md

Instruções para qualquer agente (Claude Code ou outro) trabalhando neste repositório.

## O que é este projeto

DOC Intelligence — fatia vertical (Trilha A/Backend) de um serviço de classificação e extração de
documentos para um escritório de advocacia. Contexto completo: `docs/spec.md`. Decisões e
alternativas descartadas: `docs/adr/`. Este é material de um processo seletivo — não é um produto
em produção.

## Convenções deste repositório

- **Camadas**: `src/domain/` não importa Express, `multer`, `node:fs` nem qualquer adaptador —
  só conhece as interfaces em `src/domain/ports.ts`. `src/adapters/` implementa essas portas.
  `src/index.ts` é o único lugar que compõe adaptador concreto + caso de uso. Ver ADR 0009 antes
  de quebrar essa fronteira.
- **Erros de domínio** (`src/domain/errors.ts`) são tipados e tratados centralmente em
  `src/adapters/http/middleware/error-handler.ts` — não formate resposta HTTP dentro de um caso de
  uso.
- **Concorrência otimista**: qualquer mutação de `DocumentRecord` passa por
  `repo.updateWithVersion(id, expectedVersion, mutateFn)`. Nunca leia-modifique-grave um documento
  fora desse caminho (é exatamente o bug que o fato do ambiente "g" pede pra evitar).
- Sem dependências com binding nativo (ex.: `better-sqlite3`, `sharp`) — decisão explícita por
  risco de compilação no Windows sob prazo curto (ADR 0002, ADR 0007). Se isso mudar, documente por
  quê antes de adicionar uma.

## Comandos

```bash
npm install
npm start            # servidor + worker
npm run dev           # com watch
npm test              # node:test — deve continuar em verde
npm run typecheck      # tsc --noEmit — deve continuar limpo
```

## Regras não-negociáveis

- **Verifique o resultado, não a intenção declarada.** Esta regra existe porque foi violada nesta
  sessão, três vezes, e as três custaram caro (ver `ia/README.md`): o CSS dizia `font-family:
  'Roboto'` e o PDF saiu em Arial; a ADR dizia que o worker se recuperava de um crash e ele não se
  recuperava; a spec citava uma `JobQueuePort` que não existia. Ler o que está escrito no arquivo
  não é verificação. Antes de declarar algo pronto: rode, inspecione a saída, e prefira mover a
  checagem para dentro do build (como `carta-de-fechamento/build.mjs` faz com a fonte) a confiar
  em alguém lembrar de olhar.
- **Nenhum dado real de cliente, pessoa física ou do escritório** em código, fixture, teste ou
  commit. Todo dado de exemplo é fictício (ver `fixtures/` e `src/adapters/llm/stub-llm-classifier.ts`).
- Antes de mudar uma decisão registrada em `docs/adr/`, escreva uma ADR nova (não edite a antiga
  em silêncio) ou marque a antiga como superada.
- Se a implementação divergir de `docs/spec.md`, atualize a spec ou anote a divergência — não
  deixe os dois documentos discordando sem explicação.

## Uso de IA neste repositório

O registro de uso de IA é obrigatório para este projeto (não é opcional/interno) — ver `ia/`.
Qualquer prompt novo dado ao agente deve ser acrescentado, verbatim e em ordem, a `ia/prompts.md`
**antes** de agir sobre ele, não reescrito depois para ficar bonito.
