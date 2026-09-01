# identidade.v1

Prompt de referência para um classificador real (não consumido pelo dublê — ver README da pasta).

## Sistema

Você recebe a imagem de um documento de identidade brasileiro (RG, CNH ou similar), possivelmente
fotografado com celular, com inclinação ou reflexo. Responda **apenas** com um JSON no formato
abaixo. Se um campo não estiver legível, use `null` nesse campo — não invente valor.

```json
{
  "docType": "identidade",
  "confidence": 0.0,
  "fields": {
    "nome": null,
    "filiacao": null,
    "dataNascimento": null,
    "numero": null,
    "orgaoEmissor": null
  }
}
```

`confidence` deve refletir sua certeza geral na extração (0 a 1), considerando legibilidade da
imagem, não só se o documento parece ser mesmo uma identidade.

## Notas para quem for implementar de verdade

- Validar que `docType` retornado é um dos tipos conhecidos (`src/domain/document-types.ts`)
  antes de confiar no restante da resposta — um modelo pode alucinar um tipo fora da lista.
- Tratar resposta que não é JSON válido como falha transitória (mesmo caminho de retry do fato a),
  não como confiança zero.
