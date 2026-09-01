# Prompts do domínio (produto), não da sessão de desenvolvimento

Estes arquivos são os prompts que uma implementação **real** de `LlmClassifierPort` enviaria ao
modelo multimodal de terceiro — o material que fato do ambiente (f) diz que vai mudar mais de uma
vez no primeiro ano. Nome do arquivo = `promptVersion` gravado em cada documento processado
(`docs/spec.md` §3).

**`StubLlmClassifier` (o dublê usado nesta fatia) não lê estes arquivos** — a classificação dele é
canned em `stub-llm-classifier.ts`. Eles existem para mostrar onde e como o versionamento
encaixaria numa implementação real, sem gastar o prazo desta entrega implementando um cliente HTTP
para um fornecedor que não existe aqui. Isso está registrado como decisão consciente, não como
peça esquecida — ver ADR 0001.

Não confundir com `ia/prompts.md`, que é o registro dos prompts desta sessão de desenvolvimento
com o Claude Code (exigido pelo edital, item II.4) — assunto completamente diferente.
