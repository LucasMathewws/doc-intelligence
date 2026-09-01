import { promises as fs } from "node:fs";
import path from "node:path";
import type { DocumentRecord } from "../../domain/document.js";
import type { DocumentRepositoryPort, ListFilter, ListResult } from "../../domain/ports.js";
import { NotFoundError, VersionConflictError } from "../../domain/errors.js";

/**
 * Implementação de referência de DocumentRepositoryPort para a fatia vertical: um arquivo JSON
 * (todo o conteúdo em memória, reescrito inteiro a cada mutação) + blobs em disco por hash.
 * Não escala além de poucos milhares de documentos — ver ADR 0002 e a carta de fechamento.
 */
export class JsonFileDocumentRepository implements DocumentRepositoryPort {
  private readonly filePath: string;
  private readonly blobsDir: string;
  // Serializa todas as mutações numa fila única. Node é single-threaded, mas um read-modify-write
  // com await no meio (ler arquivo, escrever arquivo) é uma seção crítica entre requests HTTP
  // concorrentes e o worker loop — sem isso, duas escritas simultâneas podem se pisar.
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "documents.json");
    this.blobsDir = path.join(dataDir, "blobs");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.blobsDir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]", "utf-8");
    }
  }

  private async readAll(): Promise<DocumentRecord[]> {
    const raw = await fs.readFile(this.filePath, "utf-8");
    // Node não remove um BOM (﻿) automaticamente ao ler como utf-8, e ferramentas comuns no
    // Windows (ex.: PowerShell `Set-Content -Encoding utf8`) escrevem um por padrão — se alguém
    // editar este arquivo manualmente com uma dessas ferramentas, JSON.parse quebraria sem isso.
    const withoutBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(withoutBom) as DocumentRecord[];
  }

  private async writeAll(docs: DocumentRecord[]): Promise<void> {
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(docs, null, 2), "utf-8");
    await fs.rename(tmp, this.filePath);
  }

  private mutate<T>(fn: (docs: DocumentRecord[]) => { docs: DocumentRecord[]; result: T }): Promise<T> {
    const run = async (): Promise<T> => {
      const docs = await this.readAll();
      const { docs: next, result } = fn(docs);
      await this.writeAll(next);
      return result;
    };
    const next = this.writeQueue.then(run, run);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async save(doc: DocumentRecord): Promise<void> {
    await this.mutate((docs) => ({ docs: [...docs, doc], result: undefined }));
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const docs = await this.readAll();
    return docs.find((d) => d.id === id) ?? null;
  }

  async findByHash(hash: string): Promise<DocumentRecord | null> {
    const docs = await this.readAll();
    return docs.find((d) => d.contentHash === hash) ?? null;
  }

  async list(filter: ListFilter): Promise<ListResult> {
    const docs = await this.readAll();
    const filtered = docs
      .filter((d) => (filter.status ? d.status === filter.status : true))
      .filter((d) => (filter.docType ? d.docType === filter.docType : true))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    const start = (filter.page - 1) * filter.pageSize;
    const items = filtered.slice(start, start + filter.pageSize);
    return { items, page: filter.page, pageSize: filter.pageSize, total: filtered.length };
  }

  async listReceived(limit: number): Promise<DocumentRecord[]> {
    const docs = await this.readAll();
    return docs.filter((d) => d.status === "received").slice(0, limit);
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    mutateFn: (doc: DocumentRecord) => DocumentRecord,
  ): Promise<DocumentRecord> {
    return this.mutate((docs) => {
      const idx = docs.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new NotFoundError(`documento ${id} não encontrado`);
      }
      const current = docs[idx]!;
      if (current.version !== expectedVersion) {
        throw new VersionConflictError(current);
      }
      const updated: DocumentRecord = { ...mutateFn(current), version: current.version + 1 };
      const next = [...docs];
      next[idx] = updated;
      return { docs: next, result: updated };
    });
  }

  async requeueStaleProcessing(): Promise<number> {
    return this.mutate((docs) => {
      let count = 0;
      const next = docs.map((d) => {
        if (d.status !== "processing") return d;
        count++;
        return { ...d, status: "received" as const, version: d.version + 1 };
      });
      return { docs: next, result: count };
    });
  }

  async saveBlob(hash: string, bytes: Buffer): Promise<void> {
    await fs.writeFile(path.join(this.blobsDir, hash), bytes);
  }

  async readBlob(hash: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.blobsDir, hash));
    } catch {
      return null;
    }
  }
}
