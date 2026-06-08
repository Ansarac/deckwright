# deckwright — Roadmap

> Design and generate native `.pptx` **locally** with Claude Code, where the design is **derived per request** (not a locked template) and quality is enforced by a **render → inspect → fix** visual loop. No web rendering — the deliverable is a `.pptx` the user double-clicks open.

Last updated: 2026-06-08

---

## 1. Vision

Anyone, on their own machine, describes a need in Claude Code ("make a deck on X for audience Y") and gets a PowerPoint that is **designed for that request and polished through self-review**. The design is not a template fill-in: Claude decides palette, layout, and rhythm from the topic / audience / tone.

> **Positioning: this is not a standalone product — it's a Claude Code demo workspace, an example of "harness engineering."** Deterministic tools stay **thin** (render a real pptx to images; an optional spec→pptx engine). Reasoning, design exploration, sub-task orchestration, and the visual QA loop all belong to Claude (the harness). The repo shows how skills + thin tools + sub-agents + a render-and-verify loop compose inside Claude Code — not how to polish a standalone CLI/library.

### The middle path (differentiation)

We do **not** reinvent a PPTX generator. Two value-adds sit on top of the official `pptx` skill:

1. **Design layer** — `slide-designer` supplies the *what it looks like*: a named theme or a palette derived from domain + tone, typography, layout sequence, a restrained motif, and a quantified **WCAG contrast self-check**.
2. **QA last-mile patch** — `scripts/render-pptx.ps1` renders the **actual exported `.pptx`** to per-slide PNGs (not an HTML proxy), so Claude inspects and fixes the real file the user will open.

The official skill's own QA needs LibreOffice; most Windows users have Office but not LibreOffice, so our PowerPoint-COM renderer is the genuine last mile — and it's pixel-faithful. (Earlier framing vs. competitors is in [COMPETITORS.md](./COMPETITORS.md); market research in [RESEARCH.md](./RESEARCH.md).)

## 2. Principles

1. **Self-contained, dependencies declared (not vendored)** — all of *our* code, config, skills, and scripts live in this repo; external dependencies (npm packages, the official `pptx` skill plugin) are **declared and one-command-installed**, not copied in — the official skill's license forbids copying. `git clone`, run the dep checker, install what's missing, and it works.
2. **Request-driven design, not templates** — the skill gives Claude a method and a rubric to explore a bespoke design per request.
3. **The closed loop is the soul** — after building, render to images, inspect with fresh eyes, fix, re-verify. Not done until one clean fix-verify pass exists.
4. **Native, editable pptx** — real OOXML via PptxGenJS; text/shapes editable. Never image-wrapped fake pptx.
5. **Newcomer-friendly** — the checker shows exactly what's missing with copy-paste install commands.
6. **Don't touch proprietary code** — the official document-skills are proprietary; use them as a dependency, never copy them.

## 3. Toolchain & dependencies

> Checker: `scripts/check-deps.ps1` (pure PowerShell, **zero-dependency** — Node is itself a check target). It verifies everything above — tools, npm packages, Chromium, the official `pptx` plugin, this repo's skills, and the fonts — using only file / registry / JSON existence checks (never runs Node/npm).

| Dependency | Purpose | Required? | install |
|---|---|---|---|
| **Git** | Clone / version control | Required | `winget install Git.Git` |
| **Node.js (≥18, LTS)** | Engine, icon pipeline, diagram tools | **Required** | `winget install OpenJS.NodeJS.LTS` |
| npm packages | `pptxgenjs · sharp · lucide-static · playwright · mermaid · roughjs` | **Required** | `npm install` |
| Playwright Chromium | Offline diagram rendering (Mermaid / Excalidraw) | **Required** | `npx playwright install chromium` |
| **Render backend (one of two)** | QA loop: pptx → images | **Required (pick one)** | see below |
| Official `pptx` skill (plugin) | Build toolchain — installed, **not** vendored (license) | **Required** | `/plugin install document-skills@anthropic-agent-skills` |
| Fonts: Poppins + Roboto Mono | Pixel-faithful Dev-Doc rendering | Recommended | open fonts (OFL / Apache-2.0), per-user |
| Python (≥3.9) | Optional: read/analyze existing pptx | Optional | `winget install Python.Python.3.12` |

### Render backend — either one suffices

- **(A) Microsoft PowerPoint (MS Office)** — exports pptx → PNG directly via COM. **Preferred on Windows**: most users already have Office, no extra components. Detected via the registry ProgID `PowerPoint.Application` (without launching it).
- **(B) LibreOffice + Poppler** — `soffice` → pdf, `pdftoppm` → png. **Cross-platform** fallback (mac/linux/Office-less Windows).
  - `winget install TheDocumentFoundation.LibreOffice`
  - `winget install oschwartz10612.Poppler`

> Design: the render step is backend-abstracted — prefer installed PowerPoint (COM), else fall back to LibreOffice+Poppler.

**npm deps** (`package.json`, installed by `npm install`, locked by `package-lock.json`): `pptxgenjs` (engine), `lucide-static` + `sharp` (icon pipeline).

### This machine's status (verified 2026-06-08)

- ✅ Node v24.8.0 · npm 11.7.0 · Git 2.49.0 · Python 3.9.13
- ✅ Render backend: Microsoft PowerPoint (Office16) → loop usable
- ✅ npm packages · Playwright Chromium · official `pptx` plugin · workspace skills · fonts (Poppins + Roboto Mono)
- → **All 10 `check-deps.ps1` checks green** (exit 0); zero install needed here

> ⚠️ LibreOffice does **not** add itself to PATH by default; the checker also probes `C:\Program Files\LibreOffice\program\soffice.exe`. PowerPoint is detected by registry ProgID without launching.

## 4. Architecture — the middle path

```
Request (topic / audience / tone)
   │
   ▼
[slide-designer skill]  ── the WHAT + VERIFY
   • Design decision: named theme OR derived palette (domain+tone)
   • WCAG contrast self-check; layout sequence + motif
   │
   ▼
[Official `pptx` skill]  ── the HOW (PptxGenJS build toolchain)
   • Build out/<name>.pptx applying the chosen design
   │
   ▼
[scripts/render-pptx.ps1]  ── the QA last-mile patch
   • Real exported .pptx → one PNG per slide
   • PowerPoint COM (no LibreOffice) → fallback LibreOffice+Poppler
   │
   ▼
[Self-review]  Claude inspects each PNG: overflow / overlap / contrast /
   whitespace / alignment / AI-tells → fix → re-verify (≥1 clean pass)
   │
   ▼
Final .pptx (out/)

[src/ optional engine]  ── deck-spec JSON → .pptx (NOT the default; not wired into the skill)
```

## 5. Repository structure

```
deckwright/
├── README.md · ROADMAP.md · RESEARCH.md · COMPETITORS.md · .gitignore
├── package.json                 # pptxgenjs · sharp · lucide-static · playwright · mermaid · roughjs
├── .claude/skills/
│   ├── slide-designer/          # design language + visual QA loop (Apache-2.0)
│   │   ├── SKILL.md
│   │   └── reference/
│   │       ├── themes.md            # named-theme index
│   │       ├── design-system.md     # derive-a-palette + WCAG self-check
│   │       └── themes/              # one .md per theme (+ .mermaid.json / .excalidraw.json mappings)
│   ├── theme-extractor/         # distill a reusable theme from real decks
│   └── diagram-maker/           # offline mermaid + excalidraw, themed, framed, paired with points
├── scripts/
│   ├── check-deps.ps1 · render-pptx.ps1
│   ├── render-mermaid.mjs       # offline Mermaid (Playwright + local mermaid.min.js)
│   ├── render-excalidraw.mjs    # offline hand-drawn (roughjs)
│   └── lib/                     # render-svg · embed-diagram · diagram-slide
├── src/                         # OPTIONAL deterministic engine (not the default) + README
├── examples/
│   ├── diagrams/                # .mmd + .excalidraw.json sources
│   └── demo/                    # one-command end-to-end demo deck
└── out/ · .qa/                  # generated pptx + diagram assets + QA renders (git-ignored)
```

## 6. Phases

### Phase 0 — Foundation ✅ COMPLETE
- [x] Market research (RESEARCH.md) + competitive scan (COMPETITORS.md)
- [x] Toolchain confirmed + winget commands verified
- [x] git init + .gitignore + ROADMAP + README
- [x] `scripts/check-deps.ps1` (render backend one-of-two; all green on this machine)
- [x] `package.json` (pptxgenjs)
- [x] First commit

### Phase 1 — Closed loop (MVP) ✅ COMPLETE
- [x] Engine: 7 layout functions (title/section/bullets/twoColumn/bigNumber/quote/imageText), `src/generate.mjs`
- [x] `scripts/render-pptx.ps1` renders the **real exported pptx** to per-slide PNG (PowerPoint COM first, LibreOffice+Poppler fallback)
- [x] `slide-designer` SKILL.md v1: design rubric + request→decision framework + visual QA checklist + anti-AI-feel rules
- [x] End-to-end loop on an 8-slide sample: explore → build → render → per-slide self-review. Good quality (serif/sans pairing, clear hierarchy, layout variety, "no line under a title" honored).

> **A real finding from the loop**: self-review caught a very-low-contrast "Internal" footer on every slide. Tracing it confirmed it is **not in the generated pptx** (the file is clean) — it is the company Office **sensitivity label** injected by PowerPoint COM at export time. Conclusion: not a defect, no fix needed; but rendering with PowerPoint COM in an enterprise environment can stamp a classification watermark the file itself does not contain. Written into the SKILL so the design brain doesn't misjudge it.

### Phase 2 — Design depth ✅ COMPLETE
- [x] Derive-a-palette strategy: `design-system.md` — dominant color from domain/tone + 6-role palette + dark/light sandwich + **WCAG contrast self-check**
- [x] Layout variety + visual motif: added statGrid / iconList / process / cards; configurable `theme.motif` (corner/dotgrid/none)
- [x] Anti-AI-feel rules codified (never a line under a title, etc.) in design-system.md
- [x] Icons: `src/icons.mjs` (lucide-static SVG → recolor → PNG via sharp), iconList uses icon circles
- [x] Loop verification: phase2 sample rendered + reviewed per slide; fixed statGrid `61%` wrap defect (`wrap:false`), re-verified

### Pivot (2026-06-08) — the middle path

A bake-off pitted the **official `pptx` skill** against our deterministic engine. Finding: the **official skill's output is excellent — on par with our engine.** Rebuilding a generator adds little. So the project repositions:

- **Adopt the official `pptx` skill as the build toolchain (the HOW).**
- **`slide-designer` becomes the design-language layer (the WHAT) + the visual QA loop (VERIFY)** on top of it.
- **`scripts/render-pptx.ps1` is the QA last-mile patch** — renders the real exported pptx via PowerPoint COM (no LibreOffice), the one piece the official skill's LibreOffice-based QA can't cover for typical Windows users.
- **`src/` stays as an OPTIONAL, non-default engine** for repeatable/batch generation (see `src/README.md`).

Our value is the **design layer + QA patch validating the real file**, not a "better generator."

### Phase 3 — Backlog
- [ ] More named themes in `reference/themes.md` (the planned "real-deck-derived" theme was instead folded into the **evolved Dev-Doc Light** — we improved our own theme rather than extract a host-template brand)
- [x] `check-deps.sh` (mac/linux) — POSIX mirror of the `.ps1` (LibreOffice+Poppler backend), same extended checks: npm packages, Chromium, official `pptx` plugin, workspace skills, fonts. (2026-06-08)
- [ ] Run on a real topic end-to-end, including a **Chinese-font test**
- [ ] Optional-engine polish (errors, logging, QA report artifacts)
- [x] **Diagram tooling — Mermaid (done, 2026-06-08).** Thin offline renderer `scripts/render-mermaid.mjs` (Playwright + local `mermaid.min.js`, in-process — no MCP/CLI), themed by per-theme `*.mermaid.json` (`base` + `themeVariables`), wrapped by the new `diagram-maker` skill. Verified end-to-end: `examples/diagrams/auth-flow.mmd` → framed Dev-Doc Light slide. (PlantUML dropped — users draw UML separately.)
- [x] **Diagram tooling — Excalidraw / hand-drawn (v1, 2026-06-08).** Browser-free **roughjs** generator `scripts/render-excalidraw.mjs` — JSON scene format (cards + arrowed connectors), lightest hand-drawn lines, **mono labels measured by char count (DOM-free)**, themed by `dev-doc-light.excalidraw.json`, wrapped in `diagram-maker`. Verified: `examples/diagrams/auth-arch.excalidraw.json`. Deferred: auto-layout (dagre/elk), more shapes/containers, handwritten-font option.
- [x] **Evolve Dev-Doc Light into the unified minimalist theme (2026-06-08).** Steel-blue lead accent, Poppins prose / mono code, top-anchored whitespace, WCAG-checked; diagram mappings synced. Brand-neutral (no host-template brand). Verified by a 3-slide sample render.
- [x] **Complete diagram-maker demo (2026-06-08).** `examples/demo/build-demo.mjs` (one command) renders a themed Mermaid flow + an Excalidraw nested-container architecture and embeds both into a 5-slide Dev-Doc Light deck; verified end-to-end via `render-pptx.ps1`.
- [x] **Diagram + distilled points composition (2026-06-08).** `scripts/lib/diagram-slide.mjs` → `addDiagramWithPoints`: a diagram is evidence for a claim, so it is always paired with 2–3 distilled points (+ optional takeaway), aspect-adaptive (portrait/square → text|diagram; wide → diagram/points-below). Codified in the `diagram-maker` skill + Dev-Doc Light theme; demo slides 3–4 updated.
- [x] **Diagram tooling — Excalidraw v2: containers / groups / nesting (2026-06-08).** Scene format + renderer now support `containers` that auto-size to their children (cards or nested containers), labelled top-left, solid/dashed, drawn behind; arrows may cross container boundaries. Verified: `examples/diagrams/service-arch.excalidraw.json` (outer "Platform" + inner dashed "Services").
- [x] **Automate embedding a diagram into a slide (2026-06-08).** `scripts/lib/embed-diagram.mjs` → `addFramedDiagram(pptx, slide, img, region)`: reads aspect, fits, draws the flat rounded panel + ~1px purple border snug around the image, centered in the region. Per the Dev-Doc framed rule.
- [x] **Shared `svg→png` Chromium helper (2026-06-08).** `scripts/lib/render-svg.mjs` → `writeSvgOutputs(svg, outs, {scale,pad,bg,browser})`; both `render-mermaid.mjs` and `render-excalidraw.mjs` now use it (mermaid passes its open browser to avoid a second launch). Verified no regression.
- **Out of scope:** ingesting diagram **screenshots** / Obsidian-Canvas-style freeform sketches — the customer supplies these as ready assets; we don't try to reproduce them. (User, 2026-06-08)

## 7. Decisions log

- **Generation engine = PptxGenJS** (not python-pptx): same as the official pptx skill, Node ecosystem, LLM-familiar, no extra runtime; Python only as optional enhancement. (2026-06-07)
- **Checker uses native shell (.ps1, later .sh), not Node/Python**: a dependency checker must be **zero-dependency** — Node/Python have a chicken-and-egg problem (the script can't run if the runtime it's checking is missing). The logic is thin; a `.ps1` (+ future `.sh`) is cheapest and most robust. (User, 2026-06-07)
- **Render backend one-of-two: MS PowerPoint (COM) preferred, LibreOffice+Poppler cross-platform fallback** — most Windows users already have Office. (User, 2026-06-07)
- **Design brain holds "principles + framework," not a fixed brand** — request-driven exploration. (User, 2026-06-07)
- **Don't fork the official document skills** — proprietary; use as a dependency, don't copy. (2026-06-07)
- **MVP builds from scratch in pure Node first; reading existing pptx (Python+markitdown) deferred.** (User, 2026-06-07)
- **Windows focus now, keep the architecture cross-platform-friendly; mac/linux `check-deps.sh` in Phase 3.** (User, 2026-06-07)
- **Pivot to the middle path: adopt the official `pptx` skill for generation** after the bake-off showed its output on par with our engine. (2026-06-08)
- **`slide-designer` repositioned to the design + QA layer** on top of the official build toolchain. (2026-06-08)
- **`src/` engine kept as an optional, non-default asset** for repeatable/batch generation, not wired into the skill. (2026-06-08)
- **All source / scripts / docs in English; scripts lowercase-named** (`check-deps.ps1`, `render-pptx.ps1`). (2026-06-08)
- **Open-source & brand-neutral**: the repo carries no third-party trademarks, names, or signature colors; themes use open fonts only and swap any brand-signature color for a generic near-equivalent. Themes are template-portable (no logo/footer branding baked in). (User, 2026-06-08)
- **Added `theme-extractor` methodology skill** — distill a reusable, brand-neutral theme from existing decks/references, validated by generate-and-look. Captures the "learn a person's design language → reusable theme" workflow. (User, 2026-06-08)
- **Diagrams (mermaid/excalidraw) are the heart of a technical design language** — a dedicated branch to build together; text styling alone is not enough. (User, 2026-06-08)
- **Mermaid rendering = thin self-owned Playwright script, not a CLI/MCP.** `render-mermaid.mjs` calls the npm `playwright` library in-process (load local `mermaid.min.js`, `mermaid.render`, screenshot the SVG in Chromium so HTML labels + the per-user font render faithfully). Rejected: deprecated `playwright-cli`, immature `@playwright/cli`, Playwright MCP server, and the Python `webapp-testing` skill (wrong purpose). Theming via `base` + `themeVariables` roots from the deck palette; semantic per-node colors via `classDef`. (User, 2026-06-08)
- **Diagram generation is its own `diagram-maker` skill** (not folded into `slide-designer`) — separable capability, keeps `slide-designer` focused, matches the repo's focused-skill pattern. Per-theme diagram mappings (`*.mermaid.json`, `*.excalidraw.json`) live beside their source theme in `slide-designer/reference/themes/`. (User, 2026-06-08)
- **Excalidraw look = roughjs, browser-free** (not the heavy `@excalidraw/excalidraw` exporter). Default style is deliberately restrained: **mono labels + lightest roughness**, for legibility and coherence with the deck's fonts; handwritten font (Excalifont/Virgil) is an offered swap, not the default. Mono labels also make width measurement trivial (char count), avoiding a DOM/opentype.js dependency. (User, 2026-06-08)
- **A diagram is evidence for a claim — never alone on a slide.** Always paired with 2–3 distilled points (+ optional takeaway) via `addDiagramWithPoints`; aspect-adaptive (portrait/square → text|diagram; wide → text-on-top/diagram-below, per the user's preference). Matches the reference decks' claim+evidence rhythm. (User, 2026-06-08)
- **Do NOT vendor the official skills into the repo.** Anthropic's `pptx` skill LICENSE explicitly forbids extracting/copying/derivative-works/redistribution; this repo is open-source. "Self-containment" = **declare + one-command install** (like npm deps, not vendored `node_modules`), with `check-deps.ps1` verifying the plugin is installed. (User, 2026-06-08)
- **`check-deps.ps1` expanded to the full dependency set** — npm packages, Playwright Chromium, the official `pptx` plugin, this repo's own skills, and the fonts — still pure PowerShell (file/registry/JSON existence only; never runs Node/npm), preserving the zero-dependency bootstrap property. (User, 2026-06-08)
- **Keep mermaid + excalidraw in one `diagram-maker` skill** (not split) for now — one cohesive "render a themed diagram asset" capability (shared decision tree, framing, point-pairing, verify); the code is already decoupled (separate renderers + shared `scripts/lib`). Revisit splitting later if a standalone use emerges. (User, 2026-06-08)
- **Reproducible plugin dependency = declare in committed `.claude/settings.json`** (`enabledPlugins` + `extraKnownMarketplaces`) — NOT a manual `/plugin install` step and NOT vendoring. Researched via Claude Code docs: plugin files always cache in `~/.claude/plugins` regardless of scope; a project-scoped declaration auto-registers the marketplace and enables the plugin once the user accepts workspace-trust. This is the standard way to make a repo depend on the official `pptx` skill reproducibly without copying it. **Implemented:** `.claude/settings.json` declares `document-skills@anthropic-agent-skills` (committed); README updated to match. (User, 2026-06-08)
