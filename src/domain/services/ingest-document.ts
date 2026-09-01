import { createHash, randomUUID } from "node:crypto";
import type { Channel, DocumentRecord } from "../document.js";
import type { DocumentRepositoryPort } from "../ports.js";
import { UnsupportedFileTypeError } from "../errors.js";
import { sniffContentType } from "../content-sniff.js";

export interface IngestInput {
  bytes: Buffer;
  sourceFilename: string;
  channel: Channel;
}

export interface IngestResult {
  doc: DocumentRecord;
  duplicate: boolean;
}

export async function ingestDocument(
  repo: DocumentRepositoryPort,
  input: IngestInput,
): Promise<IngestResult> {
  const contentType = sniffContentType(input.bytes);
  if (!contentType) {
    throw new UnsupportedFileTypeError();
  }

  const contentHash = createHash("sha256").update(input.bytes).digest("hex");

  // Fato do ambiente (c): o mesmo documento costuma chegar mais de uma vez. Não cria registro
  // novo — devolve o existente (ADR 0003).
  const existing = await repo.findByHash(contentHash);
  if (existing) {
    return { doc: existing, duplicate: true };
  }

  const doc: DocumentRecord = {
    id: randomUUID(),
    status: "received",
    channel: input.channel,
    sourceFilename: input.sourceFilename,
    contentType,
    sizeBytes: input.bytes.length,
    contentHash,
    receivedAt: new Date().toISOString(),
    docType: null,
    fields: null,
    confidence: null,
    suggestedFilename: null,
    promptVersion: null,
    modelVersion: null,
    attempts: 0,
    lastError: null,
    reviewedBy: null,
    reviewedAt: null,
    version: 0,
  };

  await repo.saveBlob(contentHash, input.bytes);
  await repo.save(doc);
  return { doc, duplicate: false };
}
