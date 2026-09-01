import type { DocumentRecord } from "../../src/domain/document.js";

let counter = 0;

export function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  counter += 1;
  return {
    id: `doc-${counter}`,
    status: "received",
    channel: "whatsapp",
    sourceFilename: "arquivo.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
    contentHash: `hash-${counter}`,
    receivedAt: "2026-09-01T09:00:00.000Z",
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
    ...overrides,
  };
}
