import express, { type Express } from "express";
import type { DocumentRepositoryPort } from "../../domain/ports.js";
import { apiKeyMiddleware } from "./middleware/api-key.js";
import { errorHandler } from "./middleware/error-handler.js";
import { documentsRouter } from "./routes/documents.js";

export interface ServerDeps {
  repo: DocumentRepositoryPort;
  apiKey: string;
  maxUploadBytes: number;
}

export function createServer(deps: ServerDeps): Express {
  const app = express();
  app.use(express.json());

  // Sem API key de propósito — health check é usado por infraestrutura, não é o contrato de negócio.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/documents", apiKeyMiddleware(deps.apiKey), documentsRouter(deps.repo, deps.maxUploadBytes));

  app.use(errorHandler);
  return app;
}
