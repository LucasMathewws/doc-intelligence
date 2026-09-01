import type { ClassificationResult, ClassifyInput, LlmClassifierPort } from "../../domain/ports.js";
import type { DocType } from "../../domain/document.js";
import { ALL_DOC_TYPES, DOCUMENT_TYPES } from "../../domain/document-types.js";

const MODEL_VERSION = "stub-v1";

// Campos canônicos que o dublê devolve por tipo — "sempre a mesma resposta" para um dado tipo,
// como o edital sugere. Dados fictícios, não correspondem a nenhuma pessoa real.
const CANNED_FIELDS: Record<DocType, Record<string, string>> = {
  identidade: {
    nome: "Maria Ficticia da Silva",
    filiacao: "Jose Ficticio da Silva e Ana Ficticia Souza",
    dataNascimento: "1990-04-12",
    numero: "12.345.678-9",
    orgaoEmissor: "SSP/RN",
  },
  comprovante_residencia: {
    nomeTitular: "Maria Ficticia da Silva",
    endereco: "Rua Exemplo, 123, Centro, Mossoro/RN",
    dataEmissao: "2026-08-15",
  },
  contracheque: {
    nomeFuncionario: "Maria Ficticia da Silva",
    cargo: "Analista",
    competencia: "2026-08",
    valorLiquido: "3500.00",
  },
  outro: {},
};

export interface StubLlmClassifierOptions {
  delayMs: number;
}

/**
 * O "dublê" citado no edital: nunca chama um modelo de verdade. Classificação e campos são fixos
 * por tipo; confiança e simulação de falha transitória são derivadas do hash do conteúdo, então o
 * MESMO arquivo sempre produz o MESMO resultado (determinístico), mas arquivos diferentes
 * exercitam caminhos diferentes (ready / needs_review / retry) sem precisar de flag manual.
 * Ver ADR 0004. Troca por um classificador real = nova classe implementando LlmClassifierPort.
 */
export class StubLlmClassifier implements LlmClassifierPort {
  constructor(private readonly opts: StubLlmClassifierOptions) {}

  async classify(input: ClassifyInput): Promise<ClassificationResult> {
    await delay(this.opts.delayMs);

    const hashBytes = Buffer.from(input.contentHash, "hex");
    const failByte = hashBytes[0] ?? 0;
    const typeByte = hashBytes[1] ?? 0;
    const confidenceByte = hashBytes[2] ?? 0;

    const failuresBeforeSuccess = failByte % 3; // 0, 1 ou 2 falhas simuladas antes de suceder
    if (input.attempt < failuresBeforeSuccess) {
      throw new Error("falha simulada do fornecedor (timeout/5xx) — dublê ADR 0001/0004");
    }

    const docType = ALL_DOC_TYPES[typeByte % ALL_DOC_TYPES.length]!;
    const confidence = Math.round((confidenceByte / 255) * 100) / 100;

    return {
      docType,
      fields: CANNED_FIELDS[docType],
      confidence,
      promptVersion: DOCUMENT_TYPES[docType].promptVersion,
      modelVersion: MODEL_VERSION,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
