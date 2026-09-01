import type { DocumentRecord } from "../../src/domain/document.js";
import type { DocumentRepositoryPort, ListFilter, ListResult } from "../../src/domain/ports.js";
import { NotFoundError, VersionConflictError } from "../../src/domain/errors.js";

/**
 * Segunda implementação de DocumentRepositoryPort, só para testes — prova que a porta é mesmo
 * trocável (ADR 0002/0009) e deixa os testes de domínio rápidos, sem tocar disco.
 */
export class InMemoryDocumentRepository implements DocumentRepositoryPort {
  private docs: DocumentRecord[] = [];
  private blobs = new Map<string, Buffer>();

  async save(doc: DocumentRecord): Promise<void> {
    this.docs.push(doc);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    return this.docs.find((d) => d.id === id) ?? null;
  }

  async findByHash(hash: string): Promise<DocumentRecord | null> {
    return this.docs.find((d) => d.contentHash === hash) ?? null;
  }

  async list(filter: ListFilter): Promise<ListResult> {
    const filtered = this.docs
      .filter((d) => (filter.status ? d.status === filter.status : true))
      .filter((d) => (filter.docType ? d.docType === filter.docType : true));
    const start = (filter.page - 1) * filter.pageSize;
    const items = filtered.slice(start, start + filter.pageSize);
    return { items, page: filter.page, pageSize: filter.pageSize, total: filtered.length };
  }

  async listReceived(limit: number): Promise<DocumentRecord[]> {
    return this.docs.filter((d) => d.status === "received").slice(0, limit);
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    mutateFn: (doc: DocumentRecord) => DocumentRecord,
  ): Promise<DocumentRecord> {
    const idx = this.docs.findIndex((d) => d.id === id);
    if (idx === -1) throw new NotFoundError(`documento ${id} não encontrado`);
    const current = this.docs[idx]!;
    if (current.version !== expectedVersion) throw new VersionConflictError(current);
    const updated: DocumentRecord = { ...mutateFn(current), version: current.version + 1 };
    this.docs[idx] = updated;
    return updated;
  }

  async requeueStaleProcessing(): Promise<number> {
    let count = 0;
    this.docs = this.docs.map((d) => {
      if (d.status !== "processing") return d;
      count++;
      return { ...d, status: "received" as const, version: d.version + 1 };
    });
    return count;
  }

  async saveBlob(hash: string, bytes: Buffer): Promise<void> {
    this.blobs.set(hash, bytes);
  }

  async readBlob(hash: string): Promise<Buffer | null> {
    return this.blobs.get(hash) ?? null;
  }
}
