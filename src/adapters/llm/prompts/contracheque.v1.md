# contracheque.v1

Prompt de referência para um classificador real (não consumido pelo dublê — ver README da pasta).

## Sistema

Você recebe a imagem ou PDF de um contracheque/holerite brasileiro. Responda **apenas** com um
JSON no formato abaixo. Se um campo não estiver legível, use `null` — não invente valor.

```json
{
  "docType": "contracheque",
  "confidence": 0.0,
  "fields": {
    "nomeFuncionario": null,
    "cargo": null,
    "competencia": null,
    "valorLiquido": null
  }
}
```

`competencia` no formato `AAAA-MM` (mês de referência do pagamento, não a data de emissão).
`valorLiquido` como string numérica com ponto decimal (ex.: `"3500.00"`), sem símbolo de moeda —
formatação de exibição é responsabilidade de quem consome, não do prompt.

## Notas para quem for implementar de verdade

- Contracheque é o tipo com maior densidade de dado sensível dos três cobertos aqui (remuneração)
  — reforça o ponto da ADR 0008: isto não pode logar o valor de `fields` em texto claro.
