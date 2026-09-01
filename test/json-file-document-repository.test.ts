import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonFileDocumentRepository } from "../src/adapters/repository/json-file-document-repository.js";
import { VersionConflictError } from "../src/domain/errors.js";
import { makeDocument } from "./fakes/document-factory.js";

async function withTempRepo(fn: (repo: JsonFileDocumentRepository) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "doc-intel-test-"));
  const repo = new JsonFileDocumentRepository(dir);
  await repo.init();
  try {
    await fn(repo);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Esta e a peca de maior risco do proprio adaptador (nao do dominio): mutacoes concorrentes no
// MESMO arquivo JSON precisam ser serializadas, senao dois requests HTTP simultaneos (ou o worker
// + um request) podem ler o mesmo estado antigo e um pisar no outro — o problema que o fato do
// ambiente (g) descreve, mas na camada de armazenamento, nao so na regra de negocio.

test("persiste e le de volta um documento do zero (round-trip em disco)", async () => {
  await withTempRepo(async (repo) => {
    const doc = makeDocument({ id: "doc-round-trip" });
    await repo.save(doc);

    const reloaded = await repo.findById("doc-round-trip");
    assert.deepEqual(reloaded, doc);
  });
});

test("saveBlob/readBlob preservam os bytes originais", async () => {
  await withTempRepo(async (repo) => {
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x01, 0x02, 0x03]);
    await repo.saveBlob("hash-abc", bytes);
    const back = await repo.readBlob("hash-abc");
    assert.ok(back);
    assert.ok(bytes.equals(back!));
  });
});

test("duas updateWithVersion concorrentes na mesma versao: so uma vence, a outra recebe VersionConflictError", async () => {
  await withTempRepo(async (repo) => {
    const doc = makeDocument({ id: "doc-race", version: 0, attempts: 0 });
    await repo.save(doc);

    // Disparadas SEM await entre elas de proposito — testa o enfileiramento interno de escritas,
    // nao um cenario onde uma ja terminou antes da outra comecar.
    const results = await Promise.allSettled([
      repo.updateWithVersion("doc-race", 0, (d) => ({ ...d, attempts: d.attempts + 1 })),
      repo.updateWithVersion("doc-race", 0, (d) => ({ ...d, attempts: d.attempts + 100 })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exatamente uma das duas mutacoes concorrentes deve vencer");
    assert.equal(rejected.length, 1);
    assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof VersionConflictError);

    const final = await repo.findById("doc-race");
    assert.equal(final?.version, 1, "so um incremento de versao deve ter acontecido, nao dois");
  });
});

test("list respeita filtro de status e paginacao", async () => {
  await withTempRepo(async (repo) => {
    await repo.save(makeDocument({ id: "a", status: "ready", receivedAt: "2026-09-01T09:00:00.000Z" }));
    await repo.save(makeDocument({ id: "b", status: "needs_review", receivedAt: "2026-09-01T10:00:00.000Z" }));
    await repo.save(makeDocument({ id: "c", status: "needs_review", receivedAt: "2026-09-01T11:00:00.000Z" }));

    const result = await repo.list({ status: "needs_review", page: 1, pageSize: 1 });
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, "c", "mais recente primeiro");
  });
});
