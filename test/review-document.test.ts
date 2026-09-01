import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewDocument } from "../src/domain/services/review-document.js";
import { VersionConflictError, InvalidReviewStateError } from "../src/domain/errors.js";
import { InMemoryDocumentRepository } from "./fakes/in-memory-document-repository.js";
import { makeDocument } from "./fakes/document-factory.js";

// Fato do ambiente (g): duas pessoas do atendimento podem abrir a fila de conferencia ao mesmo
// tempo. O mecanismo de concorrencia otimista (ADR 0005) e a peca de maior risco desta fatia —
// se falhar, uma correcao humana pode sumir silenciosamente. Por isso ganhou teste dedicado.

test("corrige um documento em needs_review e transiciona para reviewed", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "needs_review", version: 3, fields: { nome: "Errado" } });
  await repo.save(doc);

  const updated = await reviewDocument(repo, {
    id: doc.id,
    expectedVersion: 3,
    reviewer: "ana.atendimento",
    fields: { nome: "Corrigido" },
  });

  assert.equal(updated.status, "reviewed");
  assert.equal(updated.fields?.nome, "Corrigido");
  assert.equal(updated.reviewedBy, "ana.atendimento");
  assert.equal(updated.version, 4);
});

test("duas revisoes concorrentes: a segunda com a versao antiga recebe 409 (VersionConflictError), nao sobrescreve a primeira", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "needs_review", version: 1 });
  await repo.save(doc);

  // pessoa 1 salva primeiro, com sucesso
  const afterFirstReview = await reviewDocument(repo, {
    id: doc.id,
    expectedVersion: 1,
    reviewer: "ana.atendimento",
    fields: { nome: "Correcao da Ana" },
  });
  assert.equal(afterFirstReview.status, "reviewed");

  // pessoa 2 tinha aberto a fila antes, ainda usa a versao 1 (desatualizada)
  await assert.rejects(
    () =>
      reviewDocument(repo, {
        id: doc.id,
        expectedVersion: 1,
        reviewer: "beatriz.atendimento",
        fields: { nome: "Correcao da Beatriz" },
      }),
    VersionConflictError,
  );

  // a correcao da Ana continua intacta — nao foi sobrescrita silenciosamente
  const final = await repo.findById(doc.id);
  assert.equal(final?.fields?.nome, "Correcao da Ana");
});

test("nao permite revisar um documento que nao esta em needs_review", async () => {
  const repo = new InMemoryDocumentRepository();
  const doc = makeDocument({ status: "ready", version: 0 });
  await repo.save(doc);

  await assert.rejects(
    () => reviewDocument(repo, { id: doc.id, expectedVersion: 0, reviewer: "ana.atendimento" }),
    InvalidReviewStateError,
  );

  // e a versao nao deve ter incrementado, ja que a mutacao foi abortada
  const untouched = await repo.findById(doc.id);
  assert.equal(untouched?.version, 0);
});
