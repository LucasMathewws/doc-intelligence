# ADR 0007 — Normalização de foto torta / orientação EXIF: risco registrado, não implementado

Status: registrado como risco conhecido (não implementado)

## Contexto

Fato do ambiente (b), parte final: os documentos incluem "fotografias tortas" desses mesmos
papéis, tiradas direto da câmera do celular do atendimento. Um modelo multimodal tolera alguma
rotação/perspectiva, mas não é ilimitado, e orientação EXIF errada pode fazer uma imagem chegar
literalmente de cabeça para baixo no classificador.

## Decisão

**Não implementar nesta fatia.** O arquivo é aceito e armazenado como veio (após validar
magic bytes), sem correção de orientação/perspectiva antes de chamar o classificador.

## Alternativas consideradas

- **Corrigir orientação por tag EXIF** (rotacionar a imagem conforme o metadado `Orientation`):
  tratamento de baixo custo relativo, mas normalmente depende de uma biblioteca de imagem (ex.:
  `sharp`, que tem binding nativo — o mesmo risco de compilação no Windows descrito na ADR 0002).
  Sob o prazo desta entrega, o risco de travar o `npm install` pesou mais que o ganho.
- **Deskew/correção de perspectiva via visão computacional**: resolve o caso geral (foto torta,
  não só orientação EXIF), mas é escopo de projeto à parte, não uma função de 20 minutos.
- **Confiar que o próprio modelo multimodal lida com isso**: é parcialmente verdade na prática
  (modelos multimodais modernos toleram bastante rotação/inclinação), o que reduz a urgência real
  do problema — mas não é garantia, e não é uma decisão de arquitetura, é uma torcida.

## Consequências / riscos conhecidos

- Fotos malformadas o suficiente (invertidas, muito inclinadas) tendem a produzir extrações
  ruins, e como a "confiança" nesta fatia vem do dublê (ADR 0004), esse efeito **não aparece na
  demonstração** — numa integração real, o efeito esperado é mais documentos caindo em
  `needs_review`, não um erro visível.
- Se isso se confirmar caro em produção, o lugar certo para entrar é um passo de pré-processamento
  entre o upload e a chamada ao `LlmClassifierPort` — a arquitetura em portas já tem onde encaixar
  isso sem redesenhar o pipeline.
