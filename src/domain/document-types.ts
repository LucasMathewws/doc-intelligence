import type { DocType } from "./document.js";

export interface DocumentTypeDefinition {
  type: DocType;
  fields: readonly string[];
  promptVersion: string;
}

// Tabela de configuração, não código espalhado — ver docs/spec.md §3.3 e ADR 0001.
// Adicionar um tipo novo (carteira de trabalho, laudo, procuração...) é adicionar uma entrada aqui.
export const DOCUMENT_TYPES: Record<DocType, DocumentTypeDefinition> = {
  identidade: {
    type: "identidade",
    fields: ["nome", "filiacao", "dataNascimento", "numero", "orgaoEmissor"],
    promptVersion: "identidade.v1",
  },
  comprovante_residencia: {
    type: "comprovante_residencia",
    fields: ["nomeTitular", "endereco", "dataEmissao"],
    promptVersion: "comprovante_residencia.v1",
  },
  contracheque: {
    type: "contracheque",
    fields: ["nomeFuncionario", "cargo", "competencia", "valorLiquido"],
    promptVersion: "contracheque.v1",
  },
  outro: {
    type: "outro",
    fields: [],
    promptVersion: "generico.v1",
  },
};

export const ALL_DOC_TYPES: readonly DocType[] = Object.keys(DOCUMENT_TYPES) as DocType[];
