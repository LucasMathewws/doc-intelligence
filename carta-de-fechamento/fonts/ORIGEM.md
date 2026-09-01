# Fontes Roboto

Arquivos: `roboto-latin.woff2` e `roboto-latin-ext.woff2` — subsets latin e latin-ext da Roboto
(variable font, eixo de peso 400–700), baixados de `fonts.gstatic.com` via a API do Google Fonts
(`https://fonts.googleapis.com/css2?family=Roboto:wght@400;700`), versão v51.

**Licença**: Roboto é distribuída sob a Apache License 2.0, que permite redistribuição — por isso
os arquivos estão versionados aqui em vez de baixados no momento do build.

**Por que estão no repositório**: o edital pede a carta de fechamento em Roboto 11, entrelinha
1,15, espaçamento de 6pt entre parágrafos e texto justificado. A primeira versão do `carta.html`
carregava a Roboto por `<link>` do Google Fonts — e isso **falhou silenciosamente** na renderização
headless: o PDF saiu inteiro em Arial (fallback), sem nenhum erro visível. Só apareceu quando fui
conferir as fontes realmente embutidas no PDF (`/BaseFont` dizia `ArialMT`).

Embutir a fonte como data URI a partir destes arquivos locais elimina a dependência de rede no
momento do build e torna o resultado reproduzível — ver `build.mjs`.
