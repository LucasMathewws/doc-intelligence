# ADR 0003 — Deduplicação por SHA-256 do conteúdo do arquivo

Status: aceito

## Contexto

Fato do ambiente (c): o mesmo documento costuma chegar mais de uma vez — cliente reenvia por
insegurança, atendimento reenvia por precaução. Sem tratar isso, cada reenvio vira uma chamada
paga ao classificador e um registro duplicado na fila de revisão.

## Decisão

No `POST /documents`, calcula-se SHA-256 dos bytes recebidos antes de qualquer outra coisa. Se já
existe um documento com esse hash, **não** cria um registro novo: devolve o documento existente
(`200 OK`, com `duplicate: true` na resposta). Só cria (`201 Created`, `duplicate: false`) quando o
hash é inédito. O hash já É a chave de deduplicação — não há necessidade de um campo
`duplicateOf` apontando um documento para si mesmo (primeira versão da spec tinha esse campo;
corrigido antes de implementar, ver `docs/spec.md`).

## Alternativas consideradas

- **Deduplicar por nome de arquivo**: descartado direto — fato (b) diz que o nome vem do cliente,
  sem validação, e nomes como "WhatsApp Image 2026-08-11 at 09.12.33.jpeg" nem são estáveis entre
  reenvios do mesmo aparelho.
- **Hash perceptual / similaridade de imagem** (pegaria duas fotos diferentes do mesmo papel
  físico, não só o mesmo arquivo de bytes): é o tratamento mais completo do fato (c), mas exige um
  modelo/algoritmo de similaridade visual — escopo maior do que cabia no prazo. Registrado como
  risco conhecido, não implementado: hoje, duas fotos diferentes do mesmo RG são tratadas como
  documentos diferentes e geram duas chamadas ao classificador.
- **Deduplicar depois da classificação** (comparando campos extraídos): mais caro (paga a chamada
  ao LLM antes de descobrir que era redundante) e mais frágil (depende do classificador extrair os
  mesmos campos duas vezes de forma idêntica).

## Consequências / riscos conhecidos

- Reenvio do mesmo arquivo binário: resolvido, não gera custo nem duplicata.
- Foto nova do mesmo papel físico (ângulo/luz diferente): **não** resolvido — vira documento
  novo, com custo de classificação novo. Fica registrado como risco conhecido, não como
  funcionalidade esquecida.
