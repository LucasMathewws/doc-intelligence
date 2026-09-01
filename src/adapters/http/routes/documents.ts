import { Router, type NextFunction, type Request, type Response, type RequestHandler } from "express";
import multer, { MulterError } from "multer";
import type { DocumentRepositoryPort } from "../../../domain/ports.js";
import type { Channel, DocumentStatus, DocType } from "../../../domain/document.js";
import { ALL_DOC_TYPES } from "../../../domain/document-types.js";
import { ingestDocument } from "../../../domain/services/ingest-document.js";
import { reviewDocument } from "../../../domain/services/review-document.js";
import { toDto } from "../dto.js";

const VALID_CHANNELS: readonly Channel[] = ["whatsapp", "email", "balcao", "outro"];
const VALID_STATUSES: readonly DocumentStatus[] = [
  "received",
  "processing",
  "ready",
  "needs_review",
  "failed",
  "reviewed",
];

function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (VALID_CHANNELS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is DocumentStatus {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);
}

function isDocType(value: unknown): value is DocType {
  return typeof value === "string" && (ALL_DOC_TYPES as readonly string[]).includes(value);
}

/**
 * `fields` vem do corpo JSON de um cliente — o tipo `Record<string,string>` só vale se for
 * checado aqui, na fronteira. Sem isto, `{"nome": 123}` ou um array entrariam no domínio e
 * quebrariam a promessa do tipo lá dentro, longe da origem do problema.
 */
function isFields(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

/**
 * Traduz falhas do multer (arquivo grande demais, campo inesperado) em 400, e não no 500 genérico
 * que sairia se o MulterError caísse no error handler como erro desconhecido.
 *
 * Isto é erro do cliente, não do servidor: o fato do ambiente (b) diz que não há validação
 * nenhuma do lado de quem envia, então receber upload fora do limite é rotina, não incidente —
 * e um 500 aqui acordaria o plantão por algo que o cliente precisa corrigir sozinho.
 */
function uploadOrBadRequest(upload: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        const code = err.code === "LIMIT_FILE_SIZE" ? "file_too_large" : "invalid_upload";
        res.status(400).json({ error: { code, message: err.message } });
        return;
      }
      next(err);
    });
  };
}

export function documentsRouter(repo: DocumentRepositoryPort, maxUploadBytes: number): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes } });

  router.post("/", uploadOrBadRequest(upload.single("file")), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { code: "missing_file", message: "campo 'file' é obrigatório" } });
        return;
      }
      const channel = isChannel(req.body.channel) ? req.body.channel : "outro";
      const sourceFilename = typeof req.body.sourceFilename === "string" ? req.body.sourceFilename : req.file.originalname;

      const { doc, duplicate } = await ingestDocument(repo, {
        bytes: req.file.buffer,
        sourceFilename,
        channel,
      });

      res.status(duplicate ? 200 : 201).json(toDto(doc, { duplicate }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const status = isStatus(req.query.status) ? req.query.status : undefined;
      const docType = isDocType(req.query.docType) ? req.query.docType : undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

      const result = await repo.list({ status, docType, page, pageSize });
      res.status(200).json({ ...result, items: result.items.map((d) => toDto(d)) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const doc = await repo.findById(req.params.id!);
      if (!doc) {
        res.status(404).json({ error: { code: "not_found", message: "documento não encontrado" } });
        return;
      }
      res.status(200).json(toDto(doc));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/file", async (req, res, next) => {
    try {
      const doc = await repo.findById(req.params.id!);
      if (!doc) {
        res.status(404).json({ error: { code: "not_found", message: "documento não encontrado" } });
        return;
      }
      const blob = await repo.readBlob(doc.contentHash);
      if (!blob) {
        res.status(404).json({ error: { code: "blob_not_found", message: "arquivo original não encontrado" } });
        return;
      }
      res.status(200).setHeader("Content-Type", doc.contentType).send(blob);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id/review", async (req, res, next) => {
    try {
      const { version, reviewer, fields, docType } = req.body ?? {};
      if (!Number.isInteger(version) || typeof reviewer !== "string" || reviewer.trim() === "") {
        res.status(400).json({
          error: { code: "invalid_body", message: "'version' (inteiro) e 'reviewer' (string) são obrigatórios" },
        });
        return;
      }
      if (fields !== undefined && !isFields(fields)) {
        res.status(400).json({
          error: { code: "invalid_body", message: "'fields' deve ser um objeto de string para string" },
        });
        return;
      }
      if (docType !== undefined && !isDocType(docType)) {
        res.status(400).json({
          error: { code: "invalid_body", message: `'docType' deve ser um de: ${ALL_DOC_TYPES.join(", ")}` },
        });
        return;
      }

      const updated = await reviewDocument(repo, {
        id: req.params.id!,
        expectedVersion: version,
        reviewer,
        fields,
        docType,
      });

      res.status(200).json(toDto(updated));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
