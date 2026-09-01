import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestFilename } from "../src/domain/suggest-filename.js";

test("monta nome padronizado com data, tipo e campo-chave do tipo de documento", () => {
  const name = suggestFilename(
    "identidade",
    { nome: "Maria Ficticia", numero: "12.345.678-9" },
    "2026-09-01T12:00:00.000Z",
    "pdf",
  );
  assert.equal(name, "20260901_identidade_12-345-678-9.pdf");
});

test("remove acentos e caracteres nao alfanumericos do campo-chave", () => {
  const name = suggestFilename(
    "comprovante_residencia",
    { nomeTitular: "João D'Ávila São Paulo" },
    "2026-01-05T00:00:00.000Z",
    "jpg",
  );
  assert.equal(name, "20260105_comprovante_residencia_joao-d-avila-sao-paulo.jpg");
});

test("cai para 'documento' quando o campo-chave nao veio nos campos extraidos", () => {
  const name = suggestFilename("contracheque", {}, "2026-03-10T00:00:00.000Z", "pdf");
  assert.equal(name, "20260310_contracheque_documento.pdf");
});

test("tipo 'outro' nao tem campo-chave definido — sempre cai para 'documento'", () => {
  const name = suggestFilename("outro", { qualquerCoisa: "valor" }, "2026-03-10T00:00:00.000Z", "png");
  assert.equal(name, "20260310_outro_documento.png");
});
