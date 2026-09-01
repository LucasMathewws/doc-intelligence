import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestDocument } from "../src/domain/services/ingest-document.js";
import { UnsupportedFileTypeError } from "../src/domain/errors.js";
import { InMemoryDocumentRepository } from "./fakes/in-memory-document-repository.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\nconteudo ficticio de teste");
const OTHER_PDF_BYTES = Buffer.from("%PDF-1.4\noutro conteudo, arquivo diferente");

// Fato do ambiente (c): o mesmo documento costuma chegar mais de uma vez (cliente reenvia por
// inseguranca, atendimento reenvia por precaucao). Este e o mecanismo que evita chamada paga em
// dobro ao classificador e registro duplicado na fila de revisao — por isso é o primeiro candidato
// a teste automatizado nesta fatia.

test("primeiro envio de um arquivo cria um documento novo (201-like)", async () => {
  const repo = new InMemoryDocumentRepository();
  const { doc, duplicate } = await ingestDocument(repo, {
    bytes: PDF_BYTES,
    sourceFilename: "scan0001.pdf",
    channel: "whatsapp",
  });

  assert.equal(duplicate, false);
  assert.equal(doc.status, "received");
  assert.equal(doc.contentType, "application/pdf");
  assert.ok(await repo.readBlob(doc.contentHash));
});

test("reenvio do MESMO arquivo nao cria registro novo — devolve o existente com duplicate:true", async () => {
  const repo = new InMemoryDocumentRepository();
  const first = await ingestDocument(repo, {
    bytes: PDF_BYTES,
    sourceFilename: "WhatsApp Image 2026-08-11 at 09.12.33.jpeg", // nome mentiroso de propósito — fato (b)
    channel: "whatsapp",
  });
  const second = await ingestDocument(repo, {
    bytes: PDF_BYTES,
    sourceFilename: "scan0001.pdf", // nome diferente, MESMO conteudo
    channel: "email",
  });

  assert.equal(second.duplicate, true);
  assert.equal(second.doc.id, first.doc.id);

  const { total } = await repo.list({ page: 1, pageSize: 10 });
  assert.equal(total, 1, "so deve existir um registro para o mesmo conteudo");
});

test("arquivos com conteudo diferente geram documentos diferentes, mesmo mesmo canal", async () => {
  const repo = new InMemoryDocumentRepository();
  await ingestDocument(repo, { bytes: PDF_BYTES, sourceFilename: "a.pdf", channel: "whatsapp" });
  await ingestDocument(repo, { bytes: OTHER_PDF_BYTES, sourceFilename: "b.pdf", channel: "whatsapp" });

  const { total } = await repo.list({ page: 1, pageSize: 10 });
  assert.equal(total, 2);
});

test("rejeita arquivo cujo conteudo nao bate com nenhum tipo suportado", async () => {
  const repo = new InMemoryDocumentRepository();
  await assert.rejects(
    () => ingestDocument(repo, { bytes: Buffer.from("nao sou um documento"), sourceFilename: "x.pdf", channel: "outro" }),
    UnsupportedFileTypeError,
  );
});
