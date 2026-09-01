import type { DocType } from "./document.js";

// Qual campo identifica melhor o documento no nome do arquivo, por tipo. Fallback: "documento".
const KEY_FIELD_BY_TYPE: Partial<Record<DocType, string>> = {
  identidade: "numero",
  comprovante_residencia: "nomeTitular",
  contracheque: "nomeFuncionario",
};

const ACCENTS: Record<string, string> = {
  a: "áàâãä",
  e: "éèêë",
  i: "íìîï",
  o: "óòôõö",
  u: "úùûü",
  c: "ç",
  n: "ñ",
};

function stripAccents(value: string): string {
  let result = value.toLowerCase();
  for (const [plain, accented] of Object.entries(ACCENTS)) {
    for (const ch of accented) {
      result = result.split(ch).join(plain);
    }
  }
  return result;
}

function slugify(value: string): string {
  const plain = stripAccents(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return plain || "documento";
}

/**
 * Nome padronizado proposto para o arquivo — alvo #2 do edital. Função pura: mesma entrada,
 * mesma saída, testável sem depender do classificador ou de I/O.
 */
export function suggestFilename(
  docType: DocType,
  fields: Record<string, string>,
  receivedAtIso: string,
  extension: string,
): string {
  const date = receivedAtIso.slice(0, 10).replace(/-/g, "");
  const keyField = KEY_FIELD_BY_TYPE[docType];
  const keyValue = keyField ? fields[keyField] : undefined;
  const slug = slugify(keyValue ?? "documento");
  return `${date}_${docType}_${slug}.${extension}`;
}
