import type { DocumentRecord, DocumentStatus } from "../document.js";
import type { DocumentRepositoryPort, LlmClassifierPort } from "../ports.js";
import { extensionFor } from "../content-sniff.js";
import { suggestFilename } from "../suggest-filename.js";

export interface ProcessDocumentDeps {
  repo: DocumentRepositoryPort;
  classifier: LlmClassifierPort;
  confidenceThreshold: number;
  maxAttempts: number;
}

/**
 * Roda um ciclo de processamento para UM documento em "received". Chamado pelo worker loop
 * (src/worker.ts), fora do ciclo de request HTTP — fato do ambiente (a).
 */
export async function processDocument(deps: ProcessDocumentDeps, doc: DocumentRecord): Promise<void> {
  const blob = await deps.repo.readBlob(doc.contentHash);
  if (!blob) {
    // Não deveria acontecer (o blob é gravado antes do registro "received" existir), mas um
    // documento sem bytes não pode ficar girando em retry infinito — falha direto.
    await deps.repo.updateWithVersion(doc.id, doc.version, (d) => ({
      ...d,
      status: "failed",
      lastError: "blob ausente no armazenamento",
    }));
    return;
  }

  const processing = await deps.repo.updateWithVersion(doc.id, doc.version, (d) => ({
    ...d,
    status: "processing",
  }));

  try {
    const result = await deps.classifier.classify({
      bytes: blob,
      contentType: processing.contentType,
      contentHash: processing.contentHash,
      attempt: processing.attempts,
    });

    const extension = extensionFor(processing.contentType);
    const suggestedFilename = suggestFilename(result.docType, result.fields, processing.receivedAt, extension);
    const nextStatus: DocumentStatus =
      result.confidence >= deps.confidenceThreshold ? "ready" : "needs_review";

    await deps.repo.updateWithVersion(processing.id, processing.version, (d) => ({
      ...d,
      status: nextStatus,
      docType: result.docType,
      fields: result.fields,
      confidence: result.confidence,
      suggestedFilename,
      promptVersion: result.promptVersion,
      modelVersion: result.modelVersion,
      attempts: d.attempts + 1,
      lastError: null,
    }));
  } catch (err) {
    const attempts = processing.attempts + 1;
    const message = err instanceof Error ? err.message : String(err);
    // Fato do ambiente (a): o classificador falha de vez em quando. Volta pra "received" (o
    // worker tenta de novo) até esgotar as tentativas, então vira "failed" — fila viva de novo
    // depois de intervenção manual, fora do escopo desta fatia (ADR 0001).
    const status: DocumentStatus = attempts >= deps.maxAttempts ? "failed" : "received";

    await deps.repo.updateWithVersion(processing.id, processing.version, (d) => ({
      ...d,
      status,
      attempts,
      lastError: message,
    }));
  }
}
