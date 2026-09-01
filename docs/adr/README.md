# Índice das ADRs

Uma decisão por arquivo: contexto, decisão, alternativas descartadas e por quê, consequências.
Numeração é ordem de escrita, não prioridade.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-processamento-assincrono-e-retry.md) | Processamento assíncrono, fora do request HTTP, com retry limitado, timeout de classificador e recuperação de crash | aceito |
| [0002](0002-persistencia-em-arquivo-json.md) | Persistência em arquivo JSON local, atrás de uma porta de repositório | aceito — **candidato a decisão que eu menos defenderia** |
| [0003](0003-deduplicacao-por-hash-de-conteudo.md) | Deduplicação por SHA-256 do conteúdo do arquivo | aceito |
| [0004](0004-limiar-de-confianca-e-stub-deterministico.md) | Limiar de confiança fixo e dublê determinístico por hash | aceito |
| [0005](0005-concorrencia-otimista-na-revisao.md) | Concorrência otimista (campo `version`) na correção humana | aceito |
| [0006](0006-api-key-como-placeholder-de-autenticacao.md) | API key estática como placeholder de autenticação serviço-a-serviço | aceito, deliberadamente incompleto |
| [0007](0007-normalizacao-de-imagem-adiada.md) | Normalização de foto torta / orientação EXIF | registrado como risco, não implementado |
| [0008](0008-lgpd-criptografia-e-retencao-adiadas.md) | LGPD: criptografia em repouso e retenção/expurgo | registrado como risco, parcialmente implementado |
| [0009](0009-arquitetura-em-portas-e-adaptadores.md) | Domínio isolado atrás de portas, HTTP fino, sem framework opinativo | aceito |
| [0010](0010-escolha-de-linguagem-e-runtime.md) | Node.js + TypeScript como linguagem e runtime | aceito |

Contexto de como e quando cada uma foi escrita (incluindo as correções feitas numa releitura
completa após o código pronto): `docs/spec.md` (nota no topo) e `ia/README.md`.
