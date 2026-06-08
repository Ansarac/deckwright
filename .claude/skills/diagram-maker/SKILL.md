---
name: diagram-maker
description: Generate themed, offline diagrams (Mermaid now; hand-drawn Excalidraw later) as SVG/PNG assets to embed in a deck, matching the deck's design language. Use when a slide needs a flowchart, sequence diagram, state machine, or architecture/topology sketch — especially for code/protocol/technical decks.
license: Apache-2.0
---

# diagram-maker

Diagrams are the heart of a technical design language. This skill turns a diagram idea into a **themed image asset** — rendered **locally and offline** (the source is private) — that drops into a deck and looks like it belongs there. It is the diagram counterpart to `slide-designer`: same palettes, same "look at the real output" discipline.

You author and theme; a thin renderer does the mechanics. The value is **which diagram, written well, in the deck's palette, framed correctly, and verified by eye** — not the renderer.

**A diagram is evidence for a claim — never a slide on its own.** Always pair it with the **2–3 distilled points it supports** (short steel-blue sub-labels + a line each), and ideally a one-line takeaway. A bare full-slide diagram leaves no impression; the claim beside it does. The helper `scripts/lib/diagram-slide.mjs` lays this out for you.

## Scope
- **Mermaid (built, now):** precise diagrams — `flowchart`, `sequenceDiagram`, `stateDiagram-v2`. Rendered by `scripts/render-mermaid.mjs` (Playwright + local `mermaid.min.js`, fully offline).
- **Excalidraw / hand-drawn (built):** sketchy concept / architecture / topology diagrams via a browser-free **roughjs** generator — `scripts/render-excalidraw.mjs`. Rounded-rect cards + arrowed connectors; **lightest** hand-drawn lines, mono labels. Use when mermaid's auto-layout feels too rigid/mechanical for a presentation. See "Excalidraw" below.
- **Out of scope:** PlantUML (users draw UML separately, per project decision).

## How it fits
- Use the **deck's theme** for diagram colors. Each theme in `slide-designer/reference/themes/` may carry a `*.mermaid.json` beside it (e.g. `dev-doc-light.mermaid.json`) — the palette translated to Mermaid `themeVariables`. The deck's semantic diagram colors (success / failure / highlight) live in the theme's "Diagram palette" table.
- Respect the theme's **embedding rule**. For Dev-Doc Light: diagrams are **framed, not full-bleed**; flat (no shadows); mono labels; an oversized diagram gets a "view full diagram" pill rather than shrinking to illegibility.
- Standalone but composable: `slide-designer` builds the deck and calls here when a slide needs a diagram.

## Workflow

1. **Pick the diagram type** from the content. Precise structure → **Mermaid** (flow of control → `flowchart`; interaction over time → `sequenceDiagram`; modes/transitions → `stateDiagram-v2`). Loose concept / architecture / topology sketch where a warmer, hand-drawn feel reads better → **Excalidraw (roughjs)** (its own mini-workflow below). The Mermaid steps 2–5 follow.

2. **Author the `.mmd`** under `examples/diagrams/` (or `out/` for scratch). Keep it **palette-free** — the theme JSON injects all base colors and the mono font. The **only** colors in the `.mmd` are semantic `classDef`s pulled from the theme's diagram palette:
   ```
   classDef success   fill:#EBFBEE,stroke:#2F9E44,color:#141414;
   classDef failure   fill:#FFC9C9,stroke:#E03131,color:#141414;
   classDef highlight fill:#FFEC99,stroke:#F08C00,color:#141414;
   ```
   Hex only (Mermaid rejects named colors). Keep labels short; they are monospace.

3. **Render — offline — with the deck's theme JSON:**
   ```
   node scripts/render-mermaid.mjs \
     --in examples/diagrams/<name>.mmd \
     --theme .claude/skills/slide-designer/reference/themes/dev-doc-light.mermaid.json \
     --out out/<name>.svg --out out/<name>.png
   ```
   Defaults: `--scale 2` (crisp PNG), `--bg transparent` (so the deck frames it). PNG is produced by **screenshotting the rendered SVG in Chromium**, so HTML labels and the per-user-installed deck font render faithfully (a resvg rasterizer would not).

4. **Compose: diagram + distilled points.** Use **`scripts/lib/diagram-slide.mjs`** → `addDiagramWithPoints(pptx, slide, { imgPath, heading, points, takeaway })`. It reads the image aspect and picks the layout: **portrait/square → text left | diagram right**; **wide (aspect > ~1.8) → text (heading + points row) on top / diagram below**. `points` are `{ label, text }` (steel sub-label + a line). Text is top-anchored; the diagram is framed via `addFramedDiagram` (flat rounded white panel + ~1px purple border, snug). For just the framed image without text, call `addFramedDiagram(pptx, slide, imgPath, {x,y,w,h})` directly. Oversized diagram → "view full diagram" pill, don't shrink to unreadable.

5. **Verify by eye — the loop.** Look at `out/<name>.png`. Then, once embedded, render the real slide (`scripts/render-pptx.ps1`) and look again: labels legible? on-palette? not full-bleed? edges clear? Fix the theme JSON or the `.mmd` and re-render. Don't call it done without one fix-and-verify pass.

## Theming (Mermaid)
Use the **`base`** theme — the only one Mermaid lets you customize — then override `themeVariables`. Set the **roots** from the deck palette and let Mermaid derive the rest:
- `primaryColor` (node fill), `primaryBorderColor`, `primaryTextColor`
- `lineColor` (edges), `background`, `textColor`
- `secondaryColor` / `tertiaryColor` (alternate fills, clusters)
- `fontFamily`, `fontSize` (match deck typography — mono for Dev-Doc)

Per-node meaning (success/failure/highlight) is **not** a theme variable — it's `classDef` in the `.mmd` (step 2). Override individual variables only where the cascade is wrong. Full rationale and the variable cascade: `docs/diagram-research.md` (Area 1).

## Excalidraw / hand-drawn (roughjs)
For sketches mermaid lays out too rigidly. **Browser-free generation** (`rough.generator()` → SVG paths; no `@excalidraw/excalidraw`, no DOM), rasterized via the same Chromium screenshot for faithful mono text.

1. **Author a scene** `examples/diagrams/<name>.excalidraw.json` — our own small format (NOT the `.excalidraw` schema). Hand-placed layout:
   ```json
   {
     "cards":      [ { "id": "a", "x": 40, "y": 60, "label": "Client", "fill": "steel" } ],
     "containers": [ { "id": "svc", "label": "Services", "children": ["a", "b"], "dashed": true } ],
     "arrows":     [ { "from": "a", "to": "b", "dashed": true, "label": "check" } ]
   }
   ```
   `fill`: `steel` | `teal` | `purple` | `#RRGGBB` | `none`. **Containers** auto-size to their `children` (cards OR other containers — **nesting** works), are drawn behind, labelled top-left, solid or `dashed`. Labels are **mono** → card width is auto-measured by char count (no DOM). Canvas auto-sizes to content.
2. **Render** with the theme's excalidraw palette:
   ```
   node scripts/render-excalidraw.mjs \
     --in examples/diagrams/<name>.excalidraw.json \
     --theme .claude/skills/slide-designer/reference/themes/dev-doc-light.excalidraw.json \
     --out out/<name>.svg --out out/<name>.png
   ```
3. **Compose + verify** exactly as Mermaid — `addDiagramWithPoints` (diagram + distilled points), then look at the PNG and the real slide.

**Style is deliberately restrained:** lightest roughness, **mono labels** — for clarity and **coherence with the deck's fonts** (a handwritten font would clash with slide typography). This is a soft default, swappable: to get the true excalidraw handwritten look, set `fontFamily` in `dev-doc-light.excalidraw.json` to an open handwritten font (**Excalifont / Virgil**, OFL) — but a non-mono font breaks the char-count width measure, so add `opentype.js` or a Chromium text-measure first. Scope today: cards + **nested containers/groups** + arrowed connectors (concept/architecture/topology/layered); not full Excalidraw fidelity. Background: `docs/diagram-research.md` Area 2.

## Tools
- **Mermaid** — `scripts/render-mermaid.mjs`: `--in <file.mmd>` · `--out <file.svg|.png>` (repeatable) · `--theme <*.mermaid.json>` · `--scale <n>` (2) · `--bg <transparent|#RRGGBB>` · `--pad <px>` (16).
- **Excalidraw** — `scripts/render-excalidraw.mjs`: `--in <scene.json>` · `--out <file.svg|.png>` (repeatable) · `--theme <*.excalidraw.json>` · `--scale <n>` (2).
- Both are fully offline (load local libs in an in-process headless Chromium — no MCP, no CLI subprocess, no network). Install once: `npm install -D playwright mermaid roughjs && npx playwright install chromium`.
- **Compose into a slide** — `scripts/lib/diagram-slide.mjs` → `addDiagramWithPoints(pptx, slide, {imgPath, heading, points, takeaway})` (diagram + distilled points, aspect-adaptive). Lower level: `scripts/lib/embed-diagram.mjs` → `addFramedDiagram(...)` (framed image only). Worked example: `examples/demo/build-demo.mjs`.

## See also
- `slide-designer` — builds the deck; the design language and per-theme palettes (`*.mermaid.json`, `*.excalidraw.json`) live there.
- `slide-designer/reference/themes/dev-doc-light.md` — the theme + its "Diagram palette" table; `dev-doc-light.mermaid.json` / `dev-doc-light.excalidraw.json` — the two diagram mappings.
- `docs/diagram-research.md` — the best-practice research this skill is built on (Mermaid theming; Excalidraw/roughjs).
- `examples/diagrams/auth-flow.mmd` (Mermaid) · `examples/diagrams/auth-arch.excalidraw.json` (hand-drawn) — worked Dev-Doc Light examples.
