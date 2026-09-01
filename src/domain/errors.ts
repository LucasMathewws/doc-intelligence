import type { DocumentRecord } from "./document.js";

export class VersionConflictError extends Error {
  constructor(public readonly current: DocumentRecord) {
    super(`conflito de versão: documento ${current.id} está na versão ${current.version}`);
    this.name = "VersionConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super("tipo de arquivo não reconhecido (esperado PDF, JPEG ou PNG pelo conteúdo do arquivo)");
    this.name = "UnsupportedFileTypeError";
  }
}

export class InvalidReviewStateError extends Error {
  constructor(status: string) {
    super(`documento não está em needs_review (status atual: ${status})`);
    this.name = "InvalidReviewStateError";
  }
}
