export type DocumentStatus =
  | "received"
  | "processing"
  | "ready"
  | "needs_review"
  | "failed"
  | "reviewed";

export type Channel = "whatsapp" | "email" | "balcao" | "outro";

export type DocType = "identidade" | "comprovante_residencia" | "contracheque" | "outro";

export interface DocumentRecord {
  id: string;
  status: DocumentStatus;
  channel: Channel;
  sourceFilename: string;
  contentType: string;
  sizeBytes: number;
  contentHash: string;
  receivedAt: string;
  docType: DocType | null;
  fields: Record<string, string> | null;
  confidence: number | null;
  suggestedFilename: string | null;
  promptVersion: string | null;
  modelVersion: string | null;
  attempts: number;
  lastError: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
}
