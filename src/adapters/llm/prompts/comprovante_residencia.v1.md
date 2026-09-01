# comprovante_residencia.v1

Prompt de referência para um classificador real (não consumido pelo dublê — ver README da pasta).

## Sistema

Você recebe a imagem ou PDF de um comprovante de residência (conta de água, luz, telefone,
internet ou similar), possivelmente fotografado com celular. Responda **apenas** com um JSON no
formato abaixo. Se um campo não estiver legível, use `null` — não invente valor.

```json
{
  "docType": "comprovante_residencia",
  "confidence": 0.0,
  "fields": {
    "nomeTitular": null,
    "endereco": null,
    "dataEmissao": null
  }
}
```

## Notas para quem for implementar de verdade

- `endereco` deveria vir em formato livre nesta versão (v1); uma v2 razoável separaria em
  logradouro/número/bairro/cidade/UF/CEP — mudança de contrato, por isso vira `comprovante_residencia.v2`,
  não uma edição silenciosa deste arquivo (fato do ambiente f).
- Comprovantes têm validade (normalmente until 90 dias) — se o modelo conseguir ler a data de
  emissão, checar a validade é regra de negócio de quem chama o classificador, não do prompt.
