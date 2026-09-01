import type { NextFunction, Request, Response } from "express";
import {
  InvalidReviewStateError,
  NotFoundError,
  UnsupportedFileTypeError,
  VersionConflictError,
} from "../../../domain/errors.js";
import { toDto } from "../dto.js";

// req e next não são usados, mas o Express só reconhece isto como error handler por ter 4 args.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof UnsupportedFileTypeError) {
    res.status(400).json({ error: { code: "unsupported_file_type", message: err.message } });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { code: "not_found", message: err.message } });
    return;
  }
  if (err instanceof VersionConflictError) {
    res.status(409).json({
      error: { code: "version_conflict", message: err.message },
      current: toDto(err.current),
    });
    return;
  }
  if (err instanceof InvalidReviewStateError) {
    res.status(409).json({ error: { code: "invalid_review_state", message: err.message } });
    return;
  }

  console.error("[http] erro não tratado:", err);
  res.status(500).json({ error: { code: "internal_error", message: "erro interno" } });
}
