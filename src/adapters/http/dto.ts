import type { DocumentRecord } from "../../domain/document.js";

export type DocumentDto = DocumentRecord & { duplicate?: boolean };

export function toDto(doc: DocumentRecord, extra?: { duplicate?: boolean }): DocumentDto {
  return { ...doc, ...extra };
}
