import type { DocumentRecord, DocType } from "../document.js";
import type { DocumentRepositoryPort } from "../ports.js";
import { InvalidReviewStateError } from "../errors.js";

export interface ReviewInput {
  id: string;
  expectedVersion: number;
  reviewer: string;
  fields?: Record<string, string>;
  docType?: DocType;
}

/**
 * Correção humana de um documento em needs_review — alvo #4 do edital. A checagem de versão
 * (ADR 0005) acontece dentro de repo.updateWithVersion; aqui só garante que a transição de
 * status faz sentido (não se corrige um documento que não está esperando revisão).
 */
export async function reviewDocument(
  repo: DocumentRepositoryPort,
  input: ReviewInput,
): Promise<DocumentRecord> {
  return repo.updateWithVersion(input.id, input.expectedVersion, (doc) => {
    if (doc.status !== "needs_review") {
      throw new InvalidReviewStateError(doc.status);
    }
    return {
      ...doc,
      status: "reviewed",
      fields: input.fields ?? doc.fields,
      docType: input.docType ?? doc.docType,
      reviewedBy: input.reviewer,
      reviewedAt: new Date().toISOString(),
    };
  });
}
