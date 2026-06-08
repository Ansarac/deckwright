// render-svg.mjs -- shared SVG -> file(s) writer for the diagram renderers.
//
// Rasterizes an SVG string to PNG by screenshotting it in a headless Chromium
// (Playwright), so HTML labels and the per-user-installed deck fonts render
// faithfully (a resvg rasterizer would not). Writes .svg outputs directly.
// Used by render-mermaid.mjs and render-excalidraw.mjs so the browser/raster
// path lives in one place.
//
// writeSvgOutputs(svg, outAbsPaths, { scale, pad, bg, browser })
//   outAbsPaths : absolute paths ending in .svg and/or .png (repeatable)
//   scale       : deviceScaleFactor for PNG crispness (default 2)
//   pad         : px padding around the diagram in the PNG (only used when bg is
//                 a solid color; transparent output is screenshotted tight)
//   bg          : 'transparent' (default) or '#RRGGBB'
//   browser     : an already-open Playwright Browser to reuse (optional; if
//                 omitted, one is launched and closed here)

import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { chromium } from 'playwright';

export async function writeSvgOutputs(svg, outAbsPaths, { scale = 2, pad = 0, bg = 'transparent', browser = null } = {}) {
  const written = [];
  for (const p of outAbsPaths) {
    if (extname(p).toLowerCase() === '.svg') { await writeFile(p, svg, 'utf8'); written.push(p); }
  }
  const pngs = outAbsPaths.filter((p) => extname(p).toLowerCase() === '.png');
  if (pngs.length) {
    const ownBrowser = !browser;
    const b = browser || await chromium.launch({ headless: true });
    try {
      for (const p of pngs) {
        const page = await (await b.newContext({ deviceScaleFactor: scale })).newPage();
        const wrap = `<div id="wrap" style="display:inline-block;padding:${pad}px;` +
          (bg !== 'transparent' ? `background:${bg};` : '') + `">${svg}</div>`;
        await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${wrap}</body>`, { waitUntil: 'load' });
        await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
        const target = bg === 'transparent' ? '#wrap svg' : '#wrap';
        await page.locator(target).screenshot({ path: p, omitBackground: bg === 'transparent' });
        written.push(p);
      }
    } finally { if (ownBrowser) await b.close(); }
  }
  return written;
}

// Unsupported-extension guard for callers that want to validate up front.
export function assertSvgOrPng(outAbsPaths) {
  for (const p of outAbsPaths) {
    const e = extname(p).toLowerCase();
    if (e !== '.svg' && e !== '.png') throw new Error(`Unsupported output extension: ${e} (use .svg or .png)`);
  }
}
