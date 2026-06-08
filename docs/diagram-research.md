# Diagram Generation & Rendering — Best-Practice Research

Research date: 2026-06-08. Scope: how to generate and render diagrams (Mermaid + Excalidraw-style hand-drawn) to embed in `.pptx` decks, under hard constraints:

- **Local & offline only.** Diagram source is private/internal — no public services (kroki.io, mermaid.ink, excalidraw.com export endpoints). Self-hosted/local only.
- **Lightweight & self-contained.** Node is already a dependency. Windows-first, cross-platform aware.
- **Output: SVG/PNG** embeddable in `.pptx`, and **themeable** (inject a palette to match the deck theme).

### Relevant existing project context
`package.json` already depends on `sharp` (^0.34.5) and `pptxgenjs` (^4.0.0). `sharp` already gives us a **local SVG → PNG rasterizer** with no browser, which simplifies every pipeline below: we only need a tool to produce *SVG*, then `sharp` handles PNG for `.pptx` embedding if vector embedding is undesirable. No browser engine is currently a dependency.

---

## Area 1 — Mermaid (primary: flowcharts, sequence, stateDiagram-v2)

Mermaid's renderer is a browser library: it parses the text and uses the DOM/SVG to lay out and produce an `<svg>`. There is **no pure-Node renderer** — every option below needs a headless browser (Chromium) somewhere, OR a JSDOM shim (fragile, not officially supported). The real choice is *which* browser driver.

### Options compared

| Tool / approach | How it works | Offline? | Footprint | Maturity / License | Windows |
|---|---|---|---|---|---|
| **mermaid-cli (`mmdc`)** | Official CLI. Loads mermaid in a Puppeteer-controlled Chromium, outputs SVG/PNG/PDF. | Yes, once Chromium present. Inline-CSS/themeCSS keep it self-contained. | Puppeteer + bundled Chromium (~170–280 MB). Can reuse an existing Chromium via `executablePath`. | Official `@mermaid-js/mermaid-cli`, very active, MIT. | Works; install/Chromium-path caveats. |
| **Playwright driving mermaid** (small script: load local `mermaid.min.js` in a page, `mermaid.render()`, read SVG) | You control a Playwright Chromium page, inject mermaid via `page.addScriptTag({path})`, call `mermaid.render()` in `page.evaluate`, return the SVG string. | Yes, fully — all assets local. | Playwright + `chromium` (~281 MB) or `--only-shell` (smaller headless shell). `PLAYWRIGHT_BROWSERS_PATH` for shared/pinned location. | No maintained "playwright-mermaid" tool exists — this is a **~40-line script you own**. mermaid itself MIT. Playwright Apache-2.0. | Excellent — first-class Windows support, cache at `%USERPROFILE%\AppData\Local\ms-playwright`. |
| **Self-hosted Kroki (Docker)** | Run Kroki containers locally; POST diagram text, get SVG/PNG. | Yes (local container) — but requires Docker. | Heavy: Docker + multiple service images. | Mature, MIT/Apache. | Docker Desktop on Windows = friction; against "lightweight" value. |

### Was there a clean Playwright-based local mermaid render path?

Searched for a maintained Playwright-based mermaid renderer. **None found** as an established package — the de-facto standard CLI is Puppeteer-based `mermaid-cli`. So "Playwright-first" means **a small self-owned script**, not adopting a tool. That script is genuinely small: load a local HTML shell, `page.addScriptTag({ path: 'node_modules/mermaid/dist/mermaid.min.js' })`, then in `page.evaluate` call `mermaid.initialize(config)` + `await mermaid.render('id', def)` and return `svg`. Write to file; rasterize with `sharp` if PNG needed.

Playwright facts confirming offline viability (playwright.dev/docs/browsers):
- Install only chromium: `npx playwright install chromium` (~**281M**); or `--only-shell` for a smaller headless-only shell.
- `PLAYWRIGHT_BROWSERS_PATH` overrides the download/search location (pin to a repo-local dir for reproducibility / air-gap staging).
- Air-gap: pre-stage via `PLAYWRIGHT_DOWNLOAD_HOST` / internal artifact host. Windows cache: `%USERPROFILE%\AppData\Local\ms-playwright`.

### Theming Mermaid — inject a custom palette

Use the **`base` theme** — per mermaid docs (mermaid.js.org/config/theming.html) it is *"the only theme that can be modified... Use this theme as the base for customizations."* Then override `themeVariables`.

Directive form (per-diagram, travels with the `.mmd`):
```
%%{init: {'theme':'base','themeVariables':{
  'primaryColor':'#1f4e79',
  'primaryTextColor':'#ffffff',
  'primaryBorderColor':'#13324d',
  'lineColor':'#5b9bd5',
  'secondaryColor':'#e8eef5',
  'tertiaryColor':'#f4f7fb',
  'fontFamily':'Segoe UI, Arial, sans-serif',
  'fontSize':'16px'
}}}%%
```
Or via a config file passed to `mmdc --configFile` / `mermaid.initialize()` in the Playwright script.

**themeVariables that matter** (and their cascade — set the roots, the rest derive automatically by hue/lightness rules):
- **`primaryColor`** — root node fill; drives `primaryBorderColor`, `secondaryColor`, `tertiaryColor`, `mainBkg`, and many pie/fill colors.
- **`primaryTextColor`** — drives `textColor`, `nodeTextColor`, `labelColor`.
- **`lineColor`** — edges (derived from `background` if unset).
- **`secondaryColor` / `tertiaryColor`** — alternate node fills, clusters/subgraphs.
- **`background`** — contrast reference; drives `lineColor`.
- **`mainBkg`** — flowchart shape fills.
- **`fontFamily`, `fontSize`** — match deck typography.
- Caveats from docs: **hex only** (`#ff0000`, not `red`); set `darkMode: true` to change how derived colors are computed for dark backgrounds.

Strategy: set the **roots** (`primaryColor`, `primaryTextColor`, `lineColor`, `background`, `fontFamily`) from the deck palette and let mermaid derive the rest — fewest knobs, consistent results. Override individually only where the cascade is wrong.

For deeper control, `themeCSS` (in the configFile) or `--cssFile` injects raw CSS — the docs recommend `themeCSS` in the configFile over inline `--cssFile` for reliability.

### mermaid-cli specifics (if adopted)
- I/O: *"takes a mermaid definition file as input and generates an SVG/PNG/PDF file as output."* `mmdc -i input.mmd -o output.svg`.
- Theme/bg: `mmdc -i in.mmd -o out.png -t dark -b transparent`.
- **Offline Chromium** (docs/already-installed-chromium.md): create `puppeteerConfigFile.json`:
  ```json
  { "executablePath": "C:\\path\\to\\chrome.exe" }
  ```
  then `mmdc --puppeteerConfigFile puppeteerConfigFile.json`. Or env: `PUPPETEER_EXECUTABLE_PATH`, and `PUPPETEER_SKIP_DOWNLOAD=1` at install to skip the bundled Chromium. Caveat: Puppeteer is *"only guaranteed to work with the bundled Chromium."*
- Node API exists (`import { run } from "@mermaid-js/mermaid-cli"`) but *"not covered by semver."*

### RECOMMENDATION — Mermaid: build a thin Playwright-first renderer; keep mmdc as fallback

**Primary: a small Playwright-based render script we own** (`.mmd` + theme JSON → SVG, then `sharp` → PNG).
Rationale aligned to the constraints and the user's Playwright-first ask:
1. **Offline & private** — all assets (mermaid.min.js, fonts) are local; nothing leaves the machine.
2. **One browser engine for the whole project.** Playwright is the cleanest cross-platform headless-Chromium manager (explicit Windows support, `PLAYWRIGHT_BROWSERS_PATH`, `--only-shell`, predictable install). If we add any other browser-driven step (e.g. headless Excalidraw export, or the deck's own render-QA loop), they share **one** Playwright install rather than also dragging in Puppeteer's separate Chromium.
3. **Control & maintenance** — `mermaid.render()` API is stable; the wrapper is ~40 lines, no dependency on `mermaid-cli`'s un-semver'd Node API or its Puppeteer/Chromium-path quirks.
4. **Theming** is identical regardless of driver (`base` + `themeVariables`), so theming work is not coupled to the driver choice.

**Fallback / sanity check: `@mermaid-js/mermaid-cli` (`mmdc`).** If the in-house script proves flaky for an edge diagram type, `mmdc` is the official, battle-tested escape hatch — point it at the same Chromium via `executablePath` to avoid a second browser download.

Avoid self-hosted Kroki: Docker dependency violates the "lightweight" value, with no theming upside.

Concrete recommended local pipeline (Node/Windows, Playwright-first):
1. `node_modules/mermaid/dist/mermaid.min.js` (local) + a static HTML shell string.
2. Playwright `chromium.launch()` → `page.setContent(shell)` → `page.addScriptTag({ path: mermaidMinJsPath })`.
3. `page.evaluate`: `mermaid.initialize({ startOnLoad:false, theme:'base', themeVariables, fontFamily })`; `const { svg } = await mermaid.render('g', def); return svg;`
4. Write `out.svg`. For PNG-in-pptx: `sharp(Buffer.from(svg)).png().toFile('out.png')` (already a dependency) — or embed SVG directly if the pptx path supports it.
5. Theme JSON is derived from the active deck palette so diagrams match the slide theme.

---

## Area 2 — Excalidraw (hand-drawn look) — deep dive

Goal: the sketchy/hand-drawn aesthetic, generated programmatically, rendered offline to SVG/PNG.

### The scene JSON format (authoring in code)
Per docs.excalidraw.com/docs/codebase/json-schema, an `.excalidraw` file is plaintext JSON:
- Top level: `type:"excalidraw"`, `version:2`, `source`, `elements:[...]`, `appState:{...}` (e.g. `viewBackgroundColor`, `gridSize`), `files:{...}` (image data by id).
- Elements have `id, type` (e.g. `"rectangle"`), `x, y, width, height`, plus styling props (`strokeColor, backgroundColor, fillStyle, strokeWidth, roughness, seed, points`, etc. — schema page documents only a partial element, the rest are in the type defs). Generating this JSON by hand is feasible but laborious and you still need a renderer to get pixels.

### `@excalidraw/excalidraw` exportToSvg / exportToBlob — browser/DOM-bound
Per docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export:
- `exportToSvg({elements, appState, files})` → promise resolving to SVG; `exportToBlob` wraps `exportToCanvas` and uses `canvas.toBlob`; `exportToCanvas` uses an HTML `<canvas>` + `getContext("2d")`.
- The docs do **not** claim headless support, and the mechanics are DOM/canvas-based. In practice these require `window`/`document`/`canvas` — i.e. a **browser or a DOM shim**. The package is React/browser-oriented (examples all use `<Excalidraw ref>`). License **MIT**.
- => To use the official exporter offline you must run it **inside a headless browser (Playwright/Puppeteer)**, loading the excalidraw bundle in a page. JSDOM is unreliable for canvas/measuring. This is heavier than the mermaid path because excalidraw is a large app bundle, not a single render call.

### roughjs — the key lightweight path (NO browser)
Per the Rough.js README (rough-stuff/rough, MIT) and the **RoughGenerator** wiki:
- Rough.js is the hand-drawn primitive lib Excalidraw is built on. *"small (<9 kB)... sketchy, hand-drawn style"*; supports lines, curves, arcs, polygons, circles, ellipses, **and SVG paths**.
- **`rough.generator()` runs with NO drawing context** — the wiki: generators are useful *"when creating shapes without an actual drawing context; for example, on the server or in a web worker."* Instantiate `rough.generator(config, size)`.
- Shape methods (`rectangle`, and same API as RoughCanvas: line/circle/ellipse/polygon/path) return a serializable **drawable**.
- **`generator.toPaths(drawable)`** → array of **PathInfo** objects, each with `d` (an SVG path `d` string), plus `stroke, strokeWidth, fill, pattern`. *"The paths must be rendered in the same order as they are returned."*
- => **roughjs can emit hand-drawn SVG path data directly in Node with zero browser.** We assemble `<path d=... stroke=... fill=...>` into an `<svg>` ourselves, then `sharp` → PNG. This is the **lightest possible** route to the aesthetic. Cost: roughjs gives only primitives — *layout, text, arrows, and connectors are on us* (text especially: no measurement without a DOM, so we'd ship a font and use known metrics or a small text-measuring lib).

### `@excalidraw/mermaid-to-excalidraw` — official converter
Per github.com/excalidraw/mermaid-to-excalidraw (MIT, ~829★, last release v1.1.0 2024-07): `parseMermaidToExcalidraw(definition, config)` → `{elements, files}` (excalidraw elements). Lets us go **mermaid → excalidraw-style elements**. But mermaid still parses via DOM, and the output then needs an excalidraw renderer (`exportToSvg`) to become an image — so this is **browser-bound on both ends**. It maps the same diagram types (flowchart/sequence/class) into the hand-drawn element model.

### Other CLI / offline exporters
- **`excalidraw_export`** (Timmmm, MIT): Node CLI, `.excalidraw` → **SVG** (PDF via `rsvg-convert`). Uses `node-canvas` (prebuilt binaries or compile). `--embed-fonts` to avoid the network font fetch (excalidraw references fonts by remote CSS URL by default — relevant offline gotcha). **Low maturity** (16 commits, no releases, ~20★), Windows support not stated, `node-canvas` native build can be painful on Windows.
- **Issue #1261 "excalidraw CLI"** — a long-standing *feature request*, not a shipped tool; confirms there is no first-party offline CLI.
- No reliable, maintained "text-to-excalidraw" offline renderer found.

### Options compared

| Tool / approach | How it works | Offline? | Footprint | Maturity / License | Windows |
|---|---|---|---|---|---|
| **roughjs in Node** (`rough.generator` → `toPaths` → assemble SVG) | Pure-Node hand-drawn SVG paths; we own layout/text/arrows. | **Yes, fully, no browser.** | Tiny (<9 kB lib) + our generator code; PNG via existing `sharp`. | roughjs mature, MIT. Our generator = build. | Excellent (pure JS). |
| **@excalidraw/excalidraw exportToSvg** in headless Playwright | Load excalidraw bundle in a page, build scene JSON, call exportToSvg. | Yes (fonts must be local — embed). | Large app bundle + Playwright Chromium. | Official, MIT; but heavy/awkward headless. | Via Playwright, OK. |
| **@excalidraw/mermaid-to-excalidraw** + exportToSvg | mermaid → excalidraw elements → render in headless browser. | Yes (with local fonts). | Heaviest (mermaid + excalidraw + Chromium). | Converter MIT, v1.1.0, moderate. | Via Playwright, OK. |
| **excalidraw_export** CLI | `.excalidraw` → SVG via node-canvas. | Yes (`--embed-fonts`). | node-canvas native build. | Low (no releases, ~20★), MIT. | Risky (native build). |

### RECOMMENDATION — Excalidraw: BUILD a small roughjs-based generator

For the hand-drawn aesthetic under "lightweight + offline + Windows," **build a thin roughjs-based SVG generator** rather than adopt an excalidraw renderer:
- Only path that is **truly browser-free** — fits the project value and pairs naturally with the existing `sharp` for PNG.
- We control theming end-to-end: stroke/fill come straight from the deck palette; `roughness`, `bowing`, `fillStyle` ('hachure'/'solid'/'zigzag') and `seed` tune the sketchiness.
- Scope it to the shapes a deck actually needs: rounded rect "cards", connectors/arrows, simple flow/box-and-arrow layouts — not full excalidraw fidelity.

**Do NOT adopt** the full `@excalidraw/excalidraw` exportToSvg or `mermaid-to-excalidraw` as the default: both drag a large app bundle + headless browser and remote-font handling for a *cosmetic* style we can approximate with roughjs at a fraction of the weight. Reconsider only if we need high-fidelity excalidraw parity (containers, bound text, complex arrow routing) — in that case run `exportToSvg` inside the **same Playwright** instance used for mermaid (with **embedded local fonts**), and optionally feed it via `mermaid-to-excalidraw` to reuse mermaid authoring.

### Open questions for Excalidraw / roughjs build
1. **Text & measurement.** roughjs draws shapes, not text. How do we size/wrap labels without a DOM? Options: ship a known font + compute metrics (e.g. `opentype.js`), or do text in `sharp`/SVG `<text>` with a bundled webfont. Needs a spike.
2. **Layout engine.** Who computes node positions/arrow routing? Author scenes by hand (JSON-ish), or borrow a layout (dagre/elk) for flowcharts then hand-draw with roughjs?
3. **Aesthetic parity.** Is roughjs + a hand-style font "good enough" vs real excalidraw, or will stakeholders notice? Quick visual A/B before committing.
4. **Font embedding for SVG→PPTX.** Ensure fonts are embedded/outlined so PNGs (via sharp) and any embedded SVG render identically on machines without the font installed.
5. **Reuse mermaid authoring?** Worth evaluating `mermaid-to-excalidraw` purely as an *element/layout source* (run once in Playwright) that we then re-style with roughjs — bridges Area 1 and Area 2 — vs a standalone roughjs layout.

---

## Cross-cutting recommendation
- **One headless browser for the project: Playwright (chromium).** Drives mermaid now; available for high-fidelity excalidraw later. Avoids a second Chromium from Puppeteer/`mermaid-cli`.
- **Mermaid = adopt-ish (thin Playwright wrapper), `mmdc` as fallback.**
- **Excalidraw look = build (roughjs, browser-free).**
- **Rasterize with the existing `sharp`**; theme both pipelines from the single deck palette (mermaid `themeVariables` roots; roughjs stroke/fill).

## Sources
- mermaid-cli: https://github.com/mermaid-js/mermaid-cli
- mermaid-cli already-installed-chromium: https://github.com/mermaid-js/mermaid-cli/blob/master/docs/already-installed-chromium.md
- Mermaid theming / themeVariables: https://mermaid.js.org/config/theming.html
- Playwright browsers (install/offline/footprint): https://playwright.dev/docs/browsers
- Rough.js: https://github.com/rough-stuff/rough
- RoughGenerator (server-side, toPaths/PathInfo): https://github.com/rough-stuff/rough/wiki/RoughGenerator
- Excalidraw JSON schema: https://docs.excalidraw.com/docs/codebase/json-schema
- Excalidraw export utils (exportToSvg/Blob/Canvas): https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export
- @excalidraw/mermaid-to-excalidraw: https://github.com/excalidraw/mermaid-to-excalidraw
- excalidraw_export CLI: https://github.com/Timmmm/excalidraw_export
- Excalidraw CLI feature request (#1261): https://github.com/excalidraw/excalidraw/issues/1261
