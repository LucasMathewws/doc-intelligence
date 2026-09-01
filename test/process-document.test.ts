import { test } from "node:test";
import assert from "node:assert/strict";
import { processDocument } from "../src/domain/services/process-document.js";
import type { ClassificationResult, ClassifyInput, LlmClassifierPort } from "../src/domain/ports.js";
import { InMemoryDocumentRepository } from "./fakes/in-memory-document-repository.js";
import { makeDocument } from "./fakes/document-factory.js";

class FakeClassifier implements LlmClassifierPort {
  calls: ClassifyInput[] = [];
  constructor(private readonly results: Array<ClassificationResult | Error>) {}

  async classify(input: ClassifyInput): Promise<ClassificationResult> {
    const index = Math.min(this.calls.length, this.results.length - 1);
    this.calls.push(input);
    const next = this.results[index]!;
    if (next instanceof Error) throw next;
    return next;
  }
}

const CANNED: ClassificationResult = {
  docType: "identidade",
  fields: { nome: "Teste" },
  confidence: 0.9,
  promptVersion: "identidade.v1",
  modelVersion: "stub-v1",
};

// Alvo #4 do edital: quando a confianca e baixa, o documento NAO pode entrar como pronto. Este e
// o comportamento central da fatia — merece teste direto do limiar, nos dois lados.

test("confianca >= limiar -> status ready", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received" });
  await repo.save(doc);
  await repo.saveBlob(doc.contentHash, Buffer.from("bytes"));

  const classifier = new FakeClassifier([{ ...CANNED, confidence: 0.95 }]);
  await processDocument({ repo, classifier, confidenceThreshold: 0.8, maxAttempts: 3, classifierTimeoutMs: 5000 }, doc);

  const updated = await repo.findById(doc.id);
  assert.equal(updated?.status, "ready");
  // CANNED so tem o campo "nome", mas o campo-chave de "identidade" no nome do arquivo e "numero"
  // (ver KEY_FIELD_BY_TYPE em suggest-filename.ts) — sem ele, cai no fallback "documento".
  assert.equal(updated?.suggestedFilename, "20260901_identidade_documento.pdf");
});

test("confianca < limiar -> status needs_review, nunca 'ready'", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received" });
  await repo.save(doc);
  await repo.saveBlob(doc.contentHash, Buffer.from("bytes"));

  const classifier = new FakeClassifier([{ ...CANNED, confidence: 0.5 }]);
  await processDocument({ repo, classifier, confidenceThreshold: 0.8, maxAttempts: 3, classifierTimeoutMs: 5000 }, doc);

  const updated = await repo.findById(doc.id);
  assert.equal(updated?.status, "needs_review");
});

test("falha do classificador: reprocessa ate esgotar tentativas, so entao marca failed", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received", attempts: 0 });
  await repo.save(doc);
  await repo.saveBlob(doc.contentHash, Buffer.from("bytes"));

  const classifier = new FakeClassifier([new Error("timeout simulado do fornecedor")]);
  const deps = { repo, classifier, confidenceThreshold: 0.8, maxAttempts: 2, classifierTimeoutMs: 5000 };

  await processDocument(deps, doc);
  let current = await repo.findById(doc.id);
  assert.equal(current?.status, "received", "ainda tem tentativa sobrando — volta pra fila");
  assert.equal(current?.attempts, 1);

  await processDocument(deps, current!);
  current = await repo.findById(doc.id);
  assert.equal(current?.status, "failed", "esgotou as tentativas");
  assert.equal(current?.attempts, 2);
});

test("documento sem blob correspondente falha direto, sem chamar o classificador", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received", contentHash: "hash-sem-blob-correspondente" });
  await repo.save(doc); // blob nunca foi salvo — inconsistencia defensiva

  const classifier = new FakeClassifier([CANNED]);
  await processDocument({ repo, classifier, confidenceThreshold: 0.8, maxAttempts: 3, classifierTimeoutMs: 5000 }, doc);

  const updated = await repo.findById(doc.id);
  assert.equal(updated?.status, "failed");
  assert.equal(classifier.calls.length, 0, "nao deveria pagar uma chamada ao classificador sem ter o arquivo");
});

// Fato do ambiente (a): a chamada ao classificador "e cobrada por documento". O worker pode
// listar o MESMO documento em dois ticks seguidos, antes de o primeiro conseguir marca-lo como
// "processing" — e nesse caso ele NAO pode ser classificado (nem cobrado) duas vezes.
//
// Hoje quem garante isso e o updateWithVersion da ADR 0005, que rejeita o segundo antes de
// chegar ao classificador. Essa protecao era acidental: existia como efeito colateral da
// concorrencia otimista, sem nenhum teste apontando para ela. Este teste torna o invariante
// explicito, para que ninguem "simplifique" essa checagem no futuro sem perceber que ela tambem
// protege o orcamento de chamadas ao fornecedor.
test("mesmo documento processado em paralelo: classificador e chamado UMA vez so", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received", version: 0 });
  await repo.save(doc);
  await repo.saveBlob(doc.contentHash, Buffer.from("bytes"));

  let chamadas = 0;
  const contador: LlmClassifierPort = {
    async classify() {
      chamadas++;
      await new Promise((r) => setTimeout(r, 30));
      return CANNED;
    },
  };
  const deps = { repo, classifier: contador, confidenceThreshold: 0.8, maxAttempts: 3, classifierTimeoutMs: 5000 };

  const resultados = await Promise.allSettled([processDocument(deps, doc), processDocument(deps, doc)]);

  assert.equal(chamadas, 1, "documento nao pode ser classificado (e cobrado) duas vezes");
  assert.equal(resultados.filter((r) => r.status === "rejected").length, 1, "o perdedor da corrida deve falhar");
  const final = await repo.findById(doc.id);
  assert.equal(final?.status, "ready");
  assert.equal(final?.attempts, 1, "uma unica tentativa deve ter sido contabilizada");
});

// Fato do ambiente (a), literalmente: o classificador "de vez em quando... simplesmente nao
// responde". Sem teto de tempo, isso travaria um slot de concorrencia do worker para sempre —
// achado nesta revisao, nao fazia parte do plano original.
test("classificador que nunca responde: trata como falha apos o timeout, nao trava para sempre", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "received" });
  await repo.save(doc);
  await repo.saveBlob(doc.contentHash, Buffer.from("bytes"));

  const hangingClassifier: LlmClassifierPort = {
    classify: () => new Promise(() => {}), // nunca resolve nem rejeita — simula "nao responde"
  };

  await processDocument(
    { repo, classifier: hangingClassifier, confidenceThreshold: 0.8, maxAttempts: 3, classifierTimeoutMs: 50 },
    doc,
  );

  const updated = await repo.findById(doc.id);
  assert.equal(updated?.status, "received", "trata como falha comum — ainda tem tentativa, volta pra fila");
  assert.match(updated?.lastError ?? "", /não respondeu/);
});
