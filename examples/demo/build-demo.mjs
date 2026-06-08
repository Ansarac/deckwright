// examples/demo/build-demo.mjs -- the complete diagram-maker demo, one command:
//   node examples/demo/build-demo.mjs
// then render & view:
//   powershell -ExecutionPolicy Bypass -File scripts/render-pptx.ps1 out/demo-deck.pptx .qa
//
// It (1) renders a Mermaid flow and an Excalidraw architecture as themed PNGs,
// then (2) builds a 5-slide deck in the evolved Dev-Doc Light theme, embedding
// both diagrams via scripts/lib/embed-diagram.mjs. Generic, brand-neutral.
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';
import { addDiagramWithPoints } from '../../scripts/lib/diagram-slide.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TH = '.claude/skills/slide-designer/reference/themes';
const run = (script, args) => execFileSync('node', [script, ...args], { cwd: root, stdio: 'inherit' });

// --- 1. render the two diagrams (themed, offline) ---------------------------
run('scripts/render-mermaid.mjs', ['--in', 'examples/diagrams/auth-flow.mmd',
  '--theme', `${TH}/dev-doc-light.mermaid.json`, '--out', 'out/auth-flow.png']);
run('scripts/render-excalidraw.mjs', ['--in', 'examples/diagrams/service-arch.excalidraw.json',
  '--theme', `${TH}/dev-doc-light.excalidraw.json`, '--out', 'out/service-arch.png']);

// --- 2. build the deck in the evolved Dev-Doc Light theme -------------------
const C = {
  bg: 'FFFFFF', fg: '141414', muted: '6B6B6B',
  steel: '3A75A0', teal: '367883', purple: '7C6A93',
};
const TITLE = 'Poppins', BODY = 'Poppins', MONO = 'Roboto Mono';
const W = 13.333, LX = 0.8, LW = 11.7;

const p = new pptxgen();
p.defineLayout({ name: 'W', width: W, height: 7.5 });
p.layout = 'W';
const pageTitle = (s, t) => s.addText(t, { x: 0.6, y: 0.5, w: W - 1.2, h: 0.8, align: 'center', fontFace: TITLE, fontSize: 28, color: C.fg });
const sectionHeader = (s, t, y) => s.addText(t, { x: LX, y, w: LW, h: 0.45, fontFace: TITLE, fontSize: 18, color: C.steel, bold: true });
const caption = (s, t, y) => s.addText(t, { x: LX, y, w: LW, h: 0.3, align: 'center', fontFace: MONO, fontSize: 10, color: C.muted });

// 1. Title (centered; no rule under it)
{
  const s = p.addSlide(); s.background = { color: C.bg };
  s.addText('Request Service', { x: 0.6, y: 2.7, w: W - 1.2, h: 1.0, align: 'center', fontFace: TITLE, fontSize: 46, color: C.fg });
  s.addText('A minimalist technical design overview', { x: 0.6, y: 3.7, w: W - 1.2, h: 0.6, align: 'center', fontFace: BODY, fontSize: 20, color: C.steel });
  caption(s, 'Dev-Doc Light  ·  diagram-maker demo', 6.6);
}
// 2. Overview (top-anchored bullets, recolored keywords)
{
  const s = p.addSlide(); s.background = { color: C.bg };
  pageTitle(s, 'Design at a glance');
  sectionHeader(s, 'Principles', 1.7);
  const bullets = [
    [{ text: 'One cool accent owns the deck — ' }, { text: 'steel-blue', options: { color: C.steel } }, { text: ' for headings and inline keywords.' }],
    [{ text: 'A single geometric sans for prose; ' }, { text: 'monospace', options: { fontFace: MONO, color: C.steel } }, { text: ' only for code and identifiers.' }],
    [{ text: 'Content is ' }, { text: 'top-anchored', options: { color: C.teal } }, { text: '; whitespace pools at the bottom. Diagrams are framed, never full-bleed.' }],
  ];
  let y = 2.3;
  for (const runs of bullets) { s.addText(runs, { x: LX, y, w: LW, h: 0.5, fontFace: BODY, fontSize: 15, color: C.fg, lineSpacingMultiple: 1.4, bullet: { code: '2022', indent: 14 } }); y += 0.85; }
}
// 3. Mermaid flow + distilled points (portrait -> text left | diagram right)
{
  const s = p.addSlide(); s.background = { color: C.bg };
  pageTitle(s, 'Request authorization flow');
  await addDiagramWithPoints(p, s, {
    imgPath: resolve(root, 'out/auth-flow.png'),
    heading: 'Fail closed, never stuck',
    points: [
      { label: 'Two gates', text: 'token validity, then scope — each rejects on its own.' },
      { label: 'No dead ends', text: 'every rejection logs, backs off, and re-enters.' },
      { label: 'Stateless', text: 'each request re-derives its own decision.' },
    ],
    takeaway: 'Safety is structural, not bolted on.',
  });
}
// 4. Excalidraw architecture + distilled points (wide -> diagram top / points below)
{
  const s = p.addSlide(); s.background = { color: C.bg };
  pageTitle(s, 'Service architecture');
  await addDiagramWithPoints(p, s, {
    imgPath: resolve(root, 'out/service-arch.png'),
    heading: 'One host, many benches',
    points: [
      { label: 'Isolation', text: 'each developer gets a sandboxed container.' },
      { label: 'Shared host', text: 'services bind to physical I/O once.' },
      { label: 'Direct path', text: 'containers map straight to boards.' },
    ],
  });
}
// 5. Zebra table
{
  const s = p.addSlide(); s.background = { color: C.bg };
  pageTitle(s, 'Pipeline stages');
  const z = 'E1EDF5';
  const head = (t) => ({ text: t, options: { color: C.steel, bold: true } });
  const rows = [
    [head('Stage'), head('Input'), head('Output')],
    [{ text: 'Authenticate' }, { text: 'token' }, { text: 'session' }],
    [{ text: 'Authorize' }, { text: 'session + scope' }, { text: 'decision' }],
    [{ text: 'Serve' }, { text: 'request' }, { text: 'response' }],
  ].map((r, i) => r.map((c) => ({ ...c, options: { ...(c.options || {}), fill: { color: i === 0 ? C.bg : (i % 2 ? z : C.bg) }, fontFace: BODY, fontSize: 15, color: c.options?.color || C.fg, valign: 'middle', border: { type: 'none' } } })));
  s.addTable(rows, { x: LX, y: 2.0, w: 9.0, colW: [3.0, 3.0, 3.0], rowH: 0.55, fontFace: BODY });
}

await p.writeFile({ fileName: resolve(root, 'out/demo-deck.pptx') });
console.log('wrote out/demo-deck.pptx');
