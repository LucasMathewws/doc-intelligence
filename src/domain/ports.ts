import type { DocumentRecord, DocumentStatus, DocType } from "./document.js";

export interface ListFilter {
  status?: DocumentStatus;
  docType?: DocType;
  page: number;
  pageSize: number;
}

export interface ListResult {
  items: DocumentRecord[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Fronteira de persistência. Trocar JSON local por Postgres (ADR 0002) significa implementar
 * esta interface de novo — nenhum caso de uso ou rota HTTP muda.
 */
export interface DocumentRepositoryPort {
  save(doc: DocumentRecord): Promise<void>;
  findById(id: string): Promise<DocumentRecord | null>;
  findByHash(hash: string): Promise<DocumentRecord | null>;
  list(filter: ListFilter): Promise<ListResult>;
  listReceived(limit: number): Promise<DocumentRecord[]>;
  /** Lança VersionConflictError se `expectedVersion` não bater com o atual (ADR 0005). */
  updateWithVersion(
    id: string,
    expectedVersion: number,
    mutate: (doc: DocumentRecord) => DocumentRecord,
  ): Promise<DocumentRecord>;
  saveBlob(hash: string, bytes: Buffer): Promise<void>;
  readBlob(hash: string): Promise<Buffer | null>;
  /**
   * Recuperação de crash (ADR 0001): documentos presos em "processing" (o processo caiu no meio
   * de uma chamada ao classificador) não têm mais nenhum caminho automático de volta a "received"
   * — chamado uma vez no boot, antes do worker começar. Devolve quantos documentos foram
   * recuperados. Não mexe em `attempts`: é falha de infraestrutura, não do documento.
   */
  requeueStaleProcessing(): Promise<number>;
}

export interface ClassificationResult {
  docType: DocType;
  fields: Record<string, string>;
  confidence: number;
  promptVersion: string;
  modelVersion: string;
}

export interface ClassifyInput {
  bytes: Buffer;
  contentType: string;
  contentHash: string;
  /** Índice da tentativa atual (0 na primeira chamada) — o dublê usa isso pra simular falha transitória. */
  attempt: number;
}

/**
 * Fronteira com o modelo multimodal de terceiro. Trocar de fornecedor/versão (fato do ambiente f)
 * significa implementar esta interface de novo — o resto do pipeline não sabe a diferença.
 */
export interface LlmClassifierPort {
  classify(input: ClassifyInput): Promise<ClassificationResult>;
}
