# ADR 0008 — LGPD: criptografia em repouso e retenção/expurgo, registrados como risco

Status: registrado como risco conhecido (parcialmente implementado)

## Contexto

Fato do ambiente (d): o conteúdo dos documentos é dado pessoal, parte dele sensível (ex.: dados de
identidade). Isso é uma restrição legal (LGPD), não só técnica.

## Decisão

Nesta fatia, o tratamento é parcial e explícito sobre o que falta:

**Feito:**
- Toda rota exige API key (ADR 0006) — não há acesso anônimo.
- Campos extraídos (nome, filiação, endereço etc.) nunca são escritos em log — só o `id` do
  documento e o status circulam em mensagens de log.
- `.gitignore` cobre `data/` (onde ficam os documentos reais processados) — nenhum dado de teste
  real do escritório entra no histórico do git, e nenhum dado de execução local é versionado.
- Documentos de teste (`fixtures/`) são sintéticos, gerados para este projeto — não há dado real
  de cliente em lugar nenhum do repositório (exigência explícita do edital).

**Não feito, registrado como risco:**
- Criptografia em repouso dos bytes originais e do `documents.json` — hoje ambos ficam em texto
  claro em disco. Em produção, isso seria criptografia a nível de disco/volume ou, se o banco for
  Postgres (ADR 0002), colunas sensíveis com `pgcrypto` ou equivalente.
- Retenção e expurgo automático — não há job que apague documentos após um prazo. Isso é uma
  decisão de negócio (quanto tempo o escritório precisa guardar) tanto quanto técnica, e não foi
  possível validar isso com o solicitante dentro do prazo desta entrega.
- Trilha de auditoria de quem acessou qual documento — hoje o `reviewedBy` registra quem corrigiu,
  mas não quem só *consultou* um documento sensível.

## Alternativas consideradas

- **Criptografar mesmo assim, no tempo disponível**: descartado — criptografia malfeita sob pressa
  (chave fixa no código, por exemplo) é pior do que documentar a lacuna claramente, porque passa
  falsa sensação de segurança.

## Consequências

Esta é, das lacunas registradas, a que eu mais destacaria para quem for avaliar: é a única onde a
ausência não é "menos funcionalidade", é exposição real de dado sensível se este código fosse
usado como está em produção. Ver carta de fechamento.
