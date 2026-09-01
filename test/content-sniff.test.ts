import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffContentType } from "../src/domain/content-sniff.js";

// Fato do ambiente (b): quem envia nao valida nada do lado dele — o tipo tem que vir do
// conteudo, nunca do nome/extensao/Content-Type declarado pelo cliente.

test("reconhece PDF pelos magic bytes, independente do nome do arquivo", () => {
  const bytes = Buffer.from("%PDF-1.4\n...resto do arquivo");
  assert.equal(sniffContentType(bytes), "application/pdf");
});

test("reconhece JPEG pelos magic bytes", () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(sniffContentType(bytes), "image/jpeg");
});

test("reconhece PNG pelos magic bytes", () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal(sniffContentType(bytes), "image/png");
});

test("rejeita conteudo que so TEM extensao/nome de PDF mas nao e um PDF de verdade", () => {
  // Simula exatamente o caso do fato (b): arquivo chamado "scan0001.pdf" que na verdade e outra coisa.
  const bytes = Buffer.from("isto e so um texto qualquer, nao um documento");
  assert.equal(sniffContentType(bytes), null);
});

test("rejeita buffer vazio ou curto demais para ter uma assinatura valida", () => {
  assert.equal(sniffContentType(Buffer.from([])), null);
  assert.equal(sniffContentType(Buffer.from([0xff])), null);
});
