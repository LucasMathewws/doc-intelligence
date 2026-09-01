# ADR 0004 — Limiar de confiança fixo e dublê determinístico por hash

Status: aceito

## Contexto

Alvo #4 do edital: quando a máquina não tem confiança no que produziu, o documento não entra como
pronto — vai para conferência humana. O edital sugere explicitamente que o modelo de IA "pode ser
um dublê que devolve sempre a mesma resposta".

## Decisão

`StubLlmClassifier` classifica de forma fixa (tipo e campos vêm de uma tabela determinística por
tipo de documento — ver `docs/spec.md` §3.3), mas a **confiança** é derivada do próprio hash do
conteúdo (um byte do SHA-256 mapeado para 0..1). Documento com `confidence >= CONFIDENCE_THRESHOLD`
(default 0.8, configurável por env) sai como `ready`; abaixo disso, `needs_review`. O mesmo
mecanismo de hash decide, para poucas tentativas iniciais, se a chamada "falha" (simula fato *a*)
antes de suceder.

Isso significa: o **mesmo arquivo** sempre produz o mesmo resultado (honra literalmente a sugestão
do edital — "sempre a mesma resposta" para uma dada entrada), mas arquivos de fixture diferentes
naturalmente exercitam os dois caminhos (`ready` e `needs_review`) sem precisar de flag manual ou
modo de demonstração especial.

## Alternativas consideradas

- **Confiança sempre fixa (ex.: sempre 0.95)**: mais simples, mas nunca exercitaria o caminho de
  `needs_review` sem um parâmetro extra — e o alvo #4 é justamente o comportamento que eu mais
  queria provar que funciona de ponta a ponta.
- **Confiança aleatória (`Math.random()`)**: descartado — quebra reprodutibilidade. Um teste
  automatizado ou uma demonstração manual dariam resultado diferente a cada execução para o mesmo
  arquivo, o que dificulta tanto testar quanto confiar no que se está vendo.
- **Flag de ambiente por chamada (`FORCE_LOW_CONFIDENCE=true`)**: funcionaria, mas exige lembrar de
  ligar/desligar; a derivação por hash dá o mesmo controle (fixtures diferentes = caminhos
  diferentes) sem estado externo.
- **Limiar de confiança configurável por tipo de documento**: mais realista (um RG bem enquadrado
  tem uma barra de confiança diferente de um contracheque fotografado torto), mas é complexidade
  que a fatia vertical não precisava para provar o mecanismo. Fica registrado como extensão natural
  — a tabela de tipos em `docs/spec.md` §3.3 já é o lugar onde isso entraria.

## Consequências / riscos conhecidos

- A "confiança" do dublê não tem relação nenhuma com confiança real de um modelo de visão — é
  puramente um mecanismo de demonstração. Isso está explícito aqui para não passar a impressão de
  que o número significa algo além disso.
