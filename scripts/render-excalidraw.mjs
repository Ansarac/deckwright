// render-excalidraw.mjs -- offline hand-drawn (roughjs) diagram renderer.
//
// Generation is BROWSER-FREE: rough.generator() + toPaths() emit hand-drawn SVG
// path strings (containers + cards + connectors) directly in Node. Rasterization
// to PNG reuses Chromium (Playwright) for faithful Roboto Mono labels -- same
// rationale as render-mermaid.mjs (a resvg rasterizer wouldn't have the font).
//
// Scope (docs/diagram-research.md Area 2): rounded-rect "cards", "containers"
// that auto-size to their children (supports NESTING), and arrowed connectors --
// for concept / architecture / topology / layered sketches. Not full Excalidraw
// fidelity. Mono labels -> width measured by char count, so no DOM / opentype.js.
//
// Scene format (our own small JSON, NOT the .excalidraw schema):
//   {
//     "cards":      [ { "id":"a", "x":40, "y":60, "label":"Client", "fill":"teal" } ],
//     "containers": [ { "id":"host", "label":"Host", "children":["a","b"],
//                       "dashed":false, "fill":"none" } ],   // children: card OR container ids
//     "arrows":     [ { "from":"a", "to":"b", "dashed":true, "label":"yes" } ],
//     "canvas":     { "pad":16 }                              // optional; auto-sizes
//   }
//   fill: "steel" | "teal" | "purple" | "#RRGGBB" | "none".
//
// Usage:
//   node scripts/render-excalidraw.mjs --in <scene.json> \
//     --theme .claude/skills/slide-designer/reference/themes/dev-doc-light.excalidraw.json \
//     --out out/<name>.svg --out out/<name>.png [--scale 2]

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rough from 'roughjs';
import { writeSvgOutputs, assertSvgOrPng } from './lib/render-svg.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const a = { in: null, out: [], theme: null, scale: 2 };
  for (let i = 0; i < argv.length; i++) {
    const n = () => argv[++i];
    switch (argv[i]) {
      case '--in': a.in = n(); break;
      case '--out': a.out.push(n()); break;
      case '--theme': a.theme = n(); break;
      case '--scale': a.scale = Number(n()); break;
      default: throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!a.in) throw new Error('Missing --in <scene.json>');
  if (!a.out.length) throw new Error('Missing --out <file.svg|.png>');
  return a;
}
const fail = (m) => { console.error(`Error: ${m}`); process.exit(1); };

const args = parseArgs(process.argv.slice(2));

const scenePath = resolve(repoRoot, args.in);
if (!existsSync(scenePath)) fail(`Scene not found: ${args.in}`);
const scene = JSON.parse(await readFile(scenePath, 'utf8'));

const T = {
  ink: '#1E1E1E',
  fills: { steel: '#E1EDF5', teal: '#E3EEF0', purple: '#EFEAF2' },
  fontFamily: 'Roboto Mono, Consolas, monospace',
  fontSize: 18, roughness: 0.5, bowing: 0.6, strokeWidth: 1.2,
};
if (args.theme) {
  const tp = resolve(repoRoot, args.theme);
  if (!existsSync(tp)) fail(`Theme not found: ${args.theme}`);
  const raw = JSON.parse(await readFile(tp, 'utf8'));
  delete raw._comment;
  Object.assign(T, raw, { fills: { ...T.fills, ...(raw.fills || {}) } });
}

const FS = T.fontSize, CW = FS * 0.6, PADX = 18, H = FS + 26, PAD = scene.canvas?.pad ?? 16;
const CPAD = 22;                                  // container inner padding
const resolveFill = (f) => !f || f === 'none' ? null
  : (f.startsWith('#') ? f : (T.fills[f] || null));

const gen = rough.generator();
const containerPaths = [], cardPaths = [], arrowPaths = [], texts = [];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const emit = (bucket, drawable, dash) => {
  for (const pi of gen.toPaths(drawable)) {
    bucket.push(
      `<path d="${pi.d}" fill="${pi.fill || 'none'}" stroke="${pi.stroke || 'none'}"` +
      ` stroke-width="${pi.strokeWidth || 0}"` +
      (dash ? ` stroke-dasharray="7 6"` : '') +
      ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
};
const roundRectD = (x, y, w, h, r) =>
  `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r}` +
  ` a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r}` +
  ` v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} z`;
const label = (x, y, s, size = FS) =>
  `<text x="${x}" y="${y}" font-family="${T.fontFamily}" font-size="${size}"` +
  ` text-anchor="middle" dominant-baseline="central" fill="${T.ink}">${esc(s)}</text>`;

// ---- cards (boxes) ---------------------------------------------------------
const boxes = {};
for (const c of scene.cards || []) {
  const w = Math.round(String(c.label).length * CW + PADX * 2);
  boxes[c.id] = { x: c.x, y: c.y, w, h: H, cx: c.x + w / 2, cy: c.y + H / 2, label: c.label, fill: c.fill, kind: 'card' };
}

// ---- containers (auto-size to children; supports nesting) ------------------
const cdefs = {};
for (const g of scene.containers || []) cdefs[g.id] = g;
const computing = new Set();
function boxOf(id) {
  if (boxes[id]) return boxes[id];
  const g = cdefs[id];
  if (!g) fail(`Unknown id referenced: ${id}`);
  if (computing.has(id)) fail(`Container cycle at: ${id}`);
  computing.add(id);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ch of g.children) {
    const b = boxOf(ch);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  const labelSpace = g.label ? FS + 6 : 0;
  const x = minX - CPAD, y = minY - CPAD - labelSpace;
  const w = (maxX + CPAD) - x, h = (maxY + CPAD) - y;
  computing.delete(id);
  boxes[id] = { x, y, w, h, cx: x + w / 2, cy: y + h / 2, label: g.label, dashed: g.dashed, fill: g.fill ?? 'none', kind: 'container' };
  return boxes[id];
}
for (const id in cdefs) boxOf(id);

// draw containers outermost-first (largest area to the back)
const containerIds = Object.keys(cdefs).sort((a, b) => (boxes[b].w * boxes[b].h) - (boxes[a].w * boxes[a].h));
for (const id of containerIds) {
  const b = boxes[id];
  emit(containerPaths, gen.path(roundRectD(b.x, b.y, b.w, b.h, 12), {
    fill: resolveFill(b.fill) || undefined, fillStyle: 'solid',
    stroke: T.ink, strokeWidth: T.strokeWidth, roughness: T.roughness, bowing: T.bowing, seed: 7,
  }), b.dashed);
  if (b.label) texts.push(
    `<text x="${b.x + CPAD - 4}" y="${b.y + (FS + 6) / 2 + 4}" font-family="${T.fontFamily}" font-size="${FS}"` +
    ` text-anchor="start" dominant-baseline="central" fill="${T.ink}">${esc(b.label)}</text>`
  );
}

// ---- cards (drawn above containers) ----------------------------------------
for (const c of scene.cards || []) {
  const b = boxes[c.id];
  emit(cardPaths, gen.path(roundRectD(b.x, b.y, b.w, b.h, 10), {
    fill: resolveFill(c.fill) || T.fills.steel, fillStyle: 'solid',
    stroke: T.ink, strokeWidth: T.strokeWidth, roughness: T.roughness, bowing: T.bowing, seed: 7,
  }));
  texts.push(label(b.cx, b.cy, c.label));
}

// ---- arrows (may connect cards or containers) ------------------------------
for (const e of scene.arrows || []) {
  const a = boxes[e.from], b = boxes[e.to];
  if (!a || !b) fail(`Arrow refers to unknown id: ${e.from} -> ${e.to}`);
  let x1, y1, x2, y2;
  if (Math.abs(b.cx - a.cx) >= Math.abs(b.cy - a.cy)) {
    const right = b.cx > a.cx;
    x1 = right ? a.x + a.w : a.x; y1 = a.cy; x2 = right ? b.x : b.x + b.w; y2 = b.cy;
  } else {
    const down = b.cy > a.cy;
    x1 = a.cx; y1 = down ? a.y + a.h : a.y; x2 = b.cx; y2 = down ? b.y : b.y + b.h;
  }
  emit(arrowPaths, gen.line(x1, y1, x2, y2, { stroke: T.ink, strokeWidth: T.strokeWidth, roughness: T.roughness, bowing: T.bowing, seed: 7 }), e.dashed);
  const ang = Math.atan2(y2 - y1, x2 - x1), L = 12, s = 0.5;
  const head = { stroke: T.ink, strokeWidth: T.strokeWidth, roughness: 0.4, seed: 7 };
  emit(arrowPaths, gen.line(x2, y2, x2 - L * Math.cos(ang - s), y2 - L * Math.sin(ang - s), head));
  emit(arrowPaths, gen.line(x2, y2, x2 - L * Math.cos(ang + s), y2 - L * Math.sin(ang + s), head));
  if (e.label) texts.push(
    `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" font-family="${T.fontFamily}" font-size="${FS - 4}"` +
    ` text-anchor="middle" dominant-baseline="central" fill="${T.ink}"` +
    ` paint-order="stroke" stroke="#FFFFFF" stroke-width="3">${esc(e.label)}</text>`
  );
}

// ---- assemble (auto-size canvas to all content, incl. containers) ----------
let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
for (const id in boxes) {
  const b = boxes[id];
  minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
  maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
}
const offX = PAD - minX, offY = PAD - minY;
const W = (maxX - minX) + PAD * 2, HT = (maxY - minY) + PAD * 2;
const body = [...containerPaths, ...cardPaths, ...arrowPaths, ...texts].join('');
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HT}" viewBox="0 0 ${W} ${HT}">` +
  `<g transform="translate(${offX},${offY})">` + body + `</g></svg>`;

const outAbs = args.out.map((o) => resolve(repoRoot, o));
assertSvgOrPng(outAbs);
const written = await writeSvgOutputs(svg, outAbs, { scale: args.scale, bg: 'transparent' });

console.log(`Rendered ${args.in}  (theme: ${args.theme ?? 'default'}, scale: ${args.scale})`);
for (const p of written) console.log(`  ${p}`);
