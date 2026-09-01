/**
 * Gera carta.html (com as fontes Roboto embutidas) e renderiza carta.pdf.
 *
 * Uso:  node build.mjs
 *
 * Por que existe: o edital pede a carta em Roboto 11 / entrelinha 1,15 / 6pt entre parágrafos /
 * justificado. A primeira versão carregava a Roboto por <link> do Google Fonts e o PDF saiu
 * inteiro em Arial, sem erro nenhum — falha silenciosa, só descoberta inspecionando as fontes
 * realmente embutidas no PDF. Embutir a fonte em base64 a partir de arquivos locais
 * (fonts/, versionados) torna o resultado reproduzível e independente de rede.
 *
 * A renderização usa o Chrome DevTools Protocol em vez de `--print-to-pdf` porque só o CDP
 * permite desligar cabeçalho/rodapé (Page.printToPDF displayHeaderFooter: false) — sem isso o PDF
 * sai com "file:///C:/..." e data/hora carimbados em toda página.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// Porta aleatória: uma porta fixa colide com qualquer navegador headless que tenha sobrado de uma
// execução anterior, e o script fica pendurado esperando um DevTools que não é o dele.
const PORT = 9400 + Math.floor(Math.random() * 500);

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

function findBrowser() {
  const found = BROWSERS.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`Nenhum navegador encontrado. Procurei em:\n${BROWSERS.join("\n")}`);
  }
  return found;
}

/** Passo 1: injeta as fontes locais no template, gerando carta.html. */
function buildHtml() {
  const template = readFileSync(join(HERE, "carta.template.html"), "utf8");
  const latin = readFileSync(join(HERE, "fonts/roboto-latin.woff2")).toString("base64");
  const latinExt = readFileSync(join(HERE, "fonts/roboto-latin-ext.woff2")).toString("base64");

  // Roboto v51 é variable font: o mesmo arquivo serve 400 e 700 pelo eixo de peso.
  const fontCss = `<style>
  /* Roboto embutida — ver fonts/ORIGEM.md. Gerado por build.mjs, não editar à mão. */
  @font-face {
    font-family: 'Roboto';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${latinExt}) format('woff2');
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: 'Roboto';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${latin}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  </style>`;

  if (!template.includes("<!--FONTES-->")) {
    throw new Error("carta.template.html não tem o marcador <!--FONTES-->");
  }
  const html = template.replace("<!--FONTES-->", fontCss);
  const outPath = join(HERE, "carta.html");
  writeFileSync(outPath, html, "utf8");
  console.log(`carta.html gerado (${Math.round(html.length / 1024)} KB, fontes embutidas)`);
  return outPath;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* ainda subindo */
    }
    await sleep(250);
  }
  throw new Error("DevTools não respondeu a tempo");
}

/** Passo 2: renderiza carta.html em carta.pdf. */
async function renderPdf(htmlPath) {
  const browser = findBrowser();
  const profileDir = join(process.env.TEMP ?? "/tmp", `carta-pdf-profile-${Date.now()}`);

  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitForDevtools();

    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    const tabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(fileUrl)}`, {
      method: "PUT",
    });
    const tab = await tabRes.json();

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send("Page.enable");
    await new Promise((resolve) => {
      const handler = (ev) => {
        const msg = JSON.parse(ev.data.toString());
        if (msg.method === "Page.loadEventFired") {
          ws.removeEventListener("message", handler);
          resolve();
        }
      };
      ws.addEventListener("message", handler);
    });
    await sleep(400); // margem para as fontes terminarem de aplicar

    const printed = await send("Page.printToPDF", {
      printBackground: true,
      displayHeaderFooter: false, // sem isso o PDF sai com file:/// e data/hora em toda página
      preferCSSPageSize: true,
    });

    if (!printed.result?.data) {
      throw new Error(`Falha ao imprimir: ${JSON.stringify(printed)}`);
    }

    const pdf = Buffer.from(printed.result.data, "base64");
    const pdfPath = join(HERE, "carta.pdf");
    writeFileSync(pdfPath, pdf);
    console.log(`carta.pdf gerado (${Math.round(pdf.length / 1024)} KB)`);

    // Verificação: o PDF tem que estar em Roboto, não no fallback — este check existe porque a
    // primeira versão saiu inteira em Arial silenciosamente.
    //
    // Olha /FontName E /BaseFont: a primeira versão deste check só olhava /BaseFont e por isso
    // reportou "só Arial" num PDF que JÁ tinha Roboto — as entradas da Roboto apareciam como
    // /FontName. Um check errado que reprova algo correto é tão ruim quanto não ter check.
    const raw = pdf.toString("latin1");
    const names = new Set(
      [...raw.matchAll(/\/(?:BaseFont|FontName)\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9\-]+)/g)].map((m) => m[1]),
    );
    console.log(`fontes embutidas: ${[...names].join(", ") || "(nenhuma)"}`);

    const temRoboto = [...names].some((f) => /^Roboto/i.test(f));
    const fallbacks = [...names].filter((f) => !/^Roboto/i.test(f));
    if (!temRoboto) {
      throw new Error(`ESPERAVA Roboto no PDF, encontrei: ${[...names].join(", ") || "(nenhuma)"}`);
    }
    if (fallbacks.length > 0) {
      // Não é erro fatal: significa que algum glifo do texto está fora dos subsets latin/latin-ext
      // embutidos e caiu num fallback do sistema. Mas é para aparecer, não para passar batido.
      console.warn(
        `AVISO: ${fallbacks.join(", ")} também aparece(m) — algum caractere está fora dos subsets ` +
          `Roboto embutidos. Ver fonts/ORIGEM.md.`,
      );
    } else {
      console.log("OK — Roboto confirmada, sem nenhum fallback.");
    }

    ws.close();
  } finally {
    child.kill();
  }
}

const htmlPath = buildHtml();
await renderPdf(htmlPath);
