function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num("PORT", 3000),
  apiKey: process.env.API_KEY ?? "dev-local-key",
  dataDir: process.env.DATA_DIR ?? "./data",
  confidenceThreshold: num("CONFIDENCE_THRESHOLD", 0.8),
  maxConcurrentLlmCalls: num("MAX_CONCURRENT_LLM_CALLS", 5),
  workerIntervalMs: num("WORKER_INTERVAL_MS", 500),
  maxAttempts: num("MAX_ATTEMPTS", 3),
  llmStubDelayMs: num("LLM_STUB_DELAY_MS", 800),
  maxUploadBytes: num("MAX_UPLOAD_BYTES", 15 * 1024 * 1024),
  // Fato do ambiente (a): a chamada ao classificador "de vez em quando... simplesmente não
  // responde" — sem um teto, isso trava um slot de concorrência do worker para sempre. Acima do
  // teto documentado de 40s para dar folga a uma chamada real lenta, mas legítima.
  classifierTimeoutMs: num("LLM_CALL_TIMEOUT_MS", 45_000),
};
