import { Router } from "express";
import multer from "multer";
import type { DocumentRepositoryPort } from "../../../domain/ports.js";
import type { Channel, DocumentStatus, DocType } from "../../../domain/document.js";
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

export function documentsRouter(repo: DocumentRepositoryPort, maxUploadBytes: number): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes } });

  router.post("/", upload.single("file"), async (req, res, next) => {
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
      const docType = typeof req.query.docType === "string" ? (req.query.docType as DocType) : undefined;
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
      if (typeof version !== "number" || typeof reviewer !== "string" || reviewer.trim() === "") {
        res.status(400).json({
          error: { code: "invalid_body", message: "'version' (number) e 'reviewer' (string) são obrigatórios" },
        });
        return;
      }

      const updated = await reviewDocument(repo, {
        id: req.params.id!,
        expectedVersion: version,
        reviewer,
        fields: typeof fields === "object" && fields !== null ? fields : undefined,
        docType: typeof docType === "string" ? (docType as DocType) : undefined,
      });

      res.status(200).json(toDto(updated));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
