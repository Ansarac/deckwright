// render-mermaid.mjs -- thin, offline Mermaid renderer for deckwright.
//
// Loads the LOCAL mermaid.min.js inside a Playwright-controlled Chromium page,
// injects a deck theme (base + themeVariables), calls mermaid.render(), and
// writes SVG and/or PNG. Nothing leaves the machine -- the diagram source is
// private. This is a ~self-owned wrapper (see docs/diagram-research.md), not a
// dependency on mermaid-cli.
//
// PNG is produced by SCREENSHOTTING the rendered <svg> in Chromium (not by
// rasterizing the SVG string with sharp): Chromium renders mermaid's
// foreignObject HTML labels and sees the per-user-installed deck fonts, so the
// PNG matches what a browser/PowerPoint would show. resvg-based rasterizers do
// neither faithfully.
//
// Usage:
//   node scripts/render-mermaid.mjs --in <file.mmd> --out <file.svg|.png> \
//        [--theme scripts/themes/dev-doc-light.mermaid.json] \
//        [--scale 2] [--bg transparent|#FFFFFF] [--pad 16]
//
// --out may be given more than once (e.g. emit both .svg and .png in one run).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { writeSvgOutputs, assertSvgOrPng } from './lib/render-svg.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---- tiny arg parser -------------------------------------------------------
function parseArgs(argv) {
  const args = { in: null, out: [], theme: null, scale: 2, bg: 'transparent', pad: 16 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--in': args.in = next(); break;
      case '--out': args.out.push(next()); break;
      case '--theme': args.theme = next(); break;
      case '--scale': args.scale = Number(next()); break;
      case '--bg': args.bg = next(); break;
      case '--pad': args.pad = Number(next()); break;
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  if (!args.in) throw new Error('Missing --in <file.mmd>');
  if (args.out.length === 0) throw new Error('Missing --out <file.svg|.png>');
  return args;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// ---- locate the LOCAL mermaid bundle (offline; never a CDN) -----------------
function findMermaidBundle() {
  const candidates = [
    resolve(repoRoot, 'node_modules/mermaid/dist/mermaid.min.js'),
    resolve(repoRoot, 'node_modules/mermaid/dist/mermaid.js'),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  fail('Local mermaid bundle not found. Run: npm install -D mermaid');
}

const args = parseArgs(process.argv.slice(2));

const defPath = resolve(repoRoot, args.in);
if (!existsSync(defPath)) fail(`Input not found: ${args.in}`);
const definition = await readFile(defPath, 'utf8');

let themeConfig = { theme: 'default' };
if (args.theme) {
  const tPath = resolve(repoRoot, args.theme);
  if (!existsSync(tPath)) fail(`Theme not found: ${args.theme}`);
  const raw = JSON.parse(await readFile(tPath, 'utf8'));
  // strip our documentation key before handing to mermaid
  delete raw._comment;
  themeConfig = raw;
}

const mermaidBundle = findMermaidBundle();
const fontFamily =
  themeConfig.fontFamily ||
  themeConfig.themeVariables?.fontFamily ||
  'Roboto Mono, Consolas, monospace';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ deviceScaleFactor: args.scale });
  const page = await context.newPage();

  // Minimal local shell. Background is transparent here; we only paint a solid
  // background later if --bg is a color, so the asset drops cleanly into a deck.
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent;font-family:${fontFamily};}
     #wrap{display:inline-block;padding:${args.pad}px;` +
      (args.bg !== 'transparent' ? `background:${args.bg};` : '') +
      `}</style></head><body><div id="wrap"></div></body></html>`,
    { waitUntil: 'load' }
  );

  await page.addScriptTag({ path: mermaidBundle });

  // Ensure the deck font is actually ready before layout/measure.
  await page.evaluate(async (ff) => {
    try { await document.fonts.load(`16px ${ff.split(',')[0].replace(/['"]/g, '')}`); } catch {}
    try { await document.fonts.ready; } catch {}
  }, fontFamily);

  const svg = await page.evaluate(
    async ({ def, cfg }) => {
      // eslint-disable-next-line no-undef
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: cfg.theme || 'base',
        themeVariables: cfg.themeVariables || {},
        fontFamily: cfg.fontFamily || cfg.themeVariables?.fontFamily,
      });
      // eslint-disable-next-line no-undef
      const { svg } = await window.mermaid.render('diagram', def);
      document.getElementById('wrap').innerHTML = svg;
      return svg;
    },
    { def: definition, cfg: themeConfig }
  );

  const outAbs = args.out.map((o) => resolve(repoRoot, o));
  assertSvgOrPng(outAbs);
  // Reuse this browser (it's already open from the mermaid render) for raster.
  const written = await writeSvgOutputs(svg, outAbs, { scale: args.scale, pad: args.pad, bg: args.bg, browser });

  console.log(`Rendered ${args.in}  (theme: ${args.theme ?? 'default'}, scale: ${args.scale})`);
  for (const p of written) console.log(`  ${p}`);
} finally {
  await browser.close();
}
