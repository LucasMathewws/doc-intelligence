import type { DocumentRepositoryPort, LlmClassifierPort } from "./domain/ports.js";
import { processDocument } from "./domain/services/process-document.js";

export interface WorkerOptions {
  repo: DocumentRepositoryPort;
  classifier: LlmClassifierPort;
  confidenceThreshold: number;
  maxAttempts: number;
  maxConcurrent: number;
  intervalMs: number;
  classifierTimeoutMs: number;
}

/**
 * Loop in-process que dá vida ao processamento assíncrono (ADR 0001). Não é uma fila durável:
 * documentos "received" ainda não pegos somem da memória do worker (não do repositório) num
 * restart, e voltam a ser varridos no próximo tick — ver riscos na ADR 0001.
 *
 * Limita quantas classificações ficam em voo ao mesmo tempo (fato do ambiente e: pico de 800
 * documentos/dia concentrado em 2h não pode virar 800 chamadas simultâneas ao fornecedor).
 */
export function startWorker(opts: WorkerOptions): () => void {
  let stopped = false;
  let inFlight = 0;

  async function tick(): Promise<void> {
    if (stopped) return;

    const capacity = opts.maxConcurrent - inFlight;
    if (capacity > 0) {
      const batch = await opts.repo.listReceived(capacity);
      for (const doc of batch) {
        inFlight++;
        processDocument(
          {
            repo: opts.repo,
            classifier: opts.classifier,
            confidenceThreshold: opts.confidenceThreshold,
            maxAttempts: opts.maxAttempts,
            classifierTimeoutMs: opts.classifierTimeoutMs,
          },
          doc,
        )
          .catch((err) => {
            // Um documento com erro não pode derrubar o worker inteiro — próximo tick tenta de
            // novo (ou outro documento segue normalmente).
            console.error(`[worker] erro processando documento ${doc.id}:`, err instanceof Error ? err.message : err);
          })
          .finally(() => {
            inFlight--;
          });
      }
    }

    if (!stopped) {
      setTimeout(tick, opts.intervalMs);
    }
  }

  void tick();
  return () => {
    stopped = true;
  };
}
