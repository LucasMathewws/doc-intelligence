import { config } from "./config.js";
import { createServer } from "./adapters/http/server.js";
import { JsonFileDocumentRepository } from "./adapters/repository/json-file-document-repository.js";
import { StubLlmClassifier } from "./adapters/llm/stub-llm-classifier.js";
import { startWorker } from "./worker.js";

async function main(): Promise<void> {
  const repo = new JsonFileDocumentRepository(config.dataDir);
  await repo.init();

  const recovered = await repo.requeueStaleProcessing();
  if (recovered > 0) {
    console.log(`[doc-intelligence] ${recovered} documento(s) recuperado(s) de "processing" travado (crash anterior)`);
  }

  const classifier = new StubLlmClassifier({ delayMs: config.llmStubDelayMs });

  const stopWorker = startWorker({
    repo,
    classifier,
    confidenceThreshold: config.confidenceThreshold,
    maxAttempts: config.maxAttempts,
    maxConcurrent: config.maxConcurrentLlmCalls,
    intervalMs: config.workerIntervalMs,
    classifierTimeoutMs: config.classifierTimeoutMs,
  });

  const app = createServer({ repo, apiKey: config.apiKey, maxUploadBytes: config.maxUploadBytes });
  const server = app.listen(config.port, () => {
    console.log(`[doc-intelligence] ouvindo em http://localhost:${config.port}`);
    console.log(`[doc-intelligence] API key de desenvolvimento: ${config.apiKey}`);
  });

  const shutdown = (): void => {
    console.log("[doc-intelligence] encerrando...");
    stopWorker();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("falha ao iniciar:", err);
  process.exit(1);
});
