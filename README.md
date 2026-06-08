# deckwright

Design and generate polished, native, editable `.pptx` decks locally with **Claude Code** — where the design is **derived for each request** (not a fixed template) and quality is guaranteed by a **visual QA loop**: render the *real* exported file, look at every slide, fix, and re-verify.

> This is a Claude Code **demo workspace ("harness engineering")**. It does **not** reinvent a PPTX generator. The build toolchain (the *how*) is Anthropic's official `pptx` skill; this repo adds value **on top** with a design-language layer and a last-mile QA patch. Deterministic tools stay thin; reasoning, design decisions, orchestration, and the visual self-check belong to Claude.
>
> The **middle path**: don't rebuild what the official skill already does well, don't blindly accept its defaults either — sit in between and contribute the design layer + the verification on the real file. (A 2026-06-08 bake-off confirmed the official skill's output is excellent — see [COMPETITORS.md](./COMPETITORS.md) and [RESEARCH.md](./RESEARCH.md).)
>
> Plan and history: [ROADMAP.md](./ROADMAP.md).

## How it works

```
Your request (topic / audience / tone)
        │
        ▼
slide-designer skill (.claude/skills/slide-designer)   ← the WHAT + VERIFY
   1. Design decision: pick a named theme or DERIVE a palette
      from domain + tone; run the WCAG contrast self-check.
        │
        ▼
   2. Build via the official `pptx` skill          ← the HOW (PptxGenJS toolchain)
      apply the chosen palette / typography / motif → out/<name>.pptx
        │
        ▼
   3. Render the REAL file: scripts/render-pptx.ps1 ← the last-mile QA patch
      one PNG per slide via PowerPoint COM (no LibreOffice needed)
        │
        ▼
   4. Inspect with fresh eyes → fix → re-verify (at least one full clean pass)
        │
        ▼
Final .pptx (out/)
```

The differentiator: **we verify the actual exported `.pptx`** (not an HTML proxy), Claude-Code native and lightweight, with design driven by the request rather than a template.

## Quick start

```powershell
# 1. Check dependencies (lists what's missing + copy-paste winget commands;
#    pure PowerShell, no Node/Python required — they're what it checks for).
powershell -ExecutionPolicy Bypass -File scripts/check-deps.ps1

# 2. Install npm deps (optional engine, icon pipeline, and diagram tools),
#    then the Chromium browser Playwright uses for OFFLINE diagram rendering.
npm install
npx playwright install chromium
```

3. **Official skills.** The required `document-skills` bundle (the `pptx` build toolchain) is already **declared in `.claude/settings.json`** — on first open Claude Code registers the marketplace and enables it once you accept the workspace-trust prompt, no manual step. Manual fallback, or to add the optional complementary bundle:

```
/plugin install document-skills@anthropic-agent-skills    # pptx/docx/xlsx/pdf — the build toolchain (auto-enabled via settings.json)
/plugin install example-skills@anthropic-agent-skills     # optional complementary design skills (see below)
```

4. In **Claude Code**, just state the deck request, e.g.:

> "Make an 8-slide deck on edge-AI predictive maintenance for factory ops leads; professional, grounded tone."

`.claude/skills/slide-designer` loads automatically. Claude decides the design, builds via the official `pptx` skill, renders the real file for QA, and fixes until clean.

## Dependencies

| Dependency | Purpose | Required? | Install |
|---|---|---|---|
| Git | Version control | Required | [git-scm.com](https://git-scm.com/download/win) · `winget install Git.Git` |
| Node.js (≥18, LTS) | Optional engine + icon pipeline (PptxGenJS) | Required | [nodejs.org](https://nodejs.org/) · `winget install OpenJS.NodeJS.LTS` |
| npm | Installs npm deps (ships with Node) | Required (with Node) | — |
| **Render backend (one of two)** | QA: render real pptx → PNG | **Required (pick one)** | see below |
| Python (≥3.9) | Optional enhancement (read existing pptx) | Optional | [python.org](https://www.python.org/downloads/) · `winget install Python.Python.3.12` |

**Render backend — pick one** (either one satisfies the loop):

- **(A) Microsoft PowerPoint / MS Office** — already installed for most Windows users; exports PNG directly via COM. **Preferred on Windows**, no extra components.
- **(B) LibreOffice + Poppler** — cross-platform fallback: `winget install TheDocumentFoundation.LibreOffice` + `winget install oschwartz10612.Poppler`

> `scripts/render-pptx.ps1` deliberately works **without LibreOffice**. The official skill's own QA needs LibreOffice; most Windows machines have Office but not LibreOffice, so the PowerPoint-COM path is the **last mile** — and it is pixel-faithful to what the user will open.

npm deps (installed by `npm install`): `pptxgenjs` (engine), `lucide-static` + `sharp` (icon pipeline), and `playwright` + `mermaid` + `roughjs` (the **diagram-maker** tools — offline Mermaid & hand-drawn diagrams). Playwright needs a one-time `npx playwright install chromium`. For pixel-faithful output, install the open fonts **Poppins** (OFL) + **Roboto Mono** (Apache-2.0). `check-deps.ps1` verifies all of the above — plus that the official `pptx` plugin and this repo's own skills are present.

> The dependency checker is pure PowerShell and does **not** depend on Node/Python (they are what it checks — a bootstrap checker must have zero dependencies). A cross-platform `check-deps.sh` (mac/linux) is planned for Phase 3.

## Relationship to the official skills

The official `pptx` skill is the **build toolchain** — this repo uses its from-scratch PptxGenJS path to actually write the file. `slide-designer` co-loads and agrees with it (hex without `#`, never a line under a title, one dominant color) and adds the design decisions + the visual QA loop. They are **complementary, not competing**.

The `example-skills` bundle ships several skills that **complement** slide design:

| Skill | How it helps slides |
|---|---|
| `theme-factory` | Most relevant: ready color/font themes for artifacts (slides included) — a palette source that complements our "derive a palette" method |
| `canvas-design` | Generate cover / background / hero PNGs for the `imageText` layout |
| `brand-guidelines` | When you must **lock to a brand** (e.g. Anthropic's); an alternative to deriving a palette |
| `frontend-design` / `algorithmic-art` | Indirect: visual-taste reference / decorative background assets |

> `example-skills` is per-bundle: installing it brings in all example skills at once. Skill prompts are tiny and only load their full content when triggered, so the overhead is low. The official `document-skills` are **proprietary** (installable and usable, not for copying/redistribution) — this repo does **not** copy them; it **declares** the dependency in `.claude/settings.json` (marketplace + `enabledPlugins`), so it auto-enables on workspace-trust. The plugin files cache in `~/.claude/plugins`, never in this repo.

## Optional deterministic engine

`src/` contains a thin deterministic generator: **deck-spec JSON → native `.pptx`** via PptxGenJS. It is **NOT the default path** and is **not wired into the skill flow**. Keep it for repeatable / batch / data-driven generation. See [`src/README.md`](./src/README.md) for the spec format and the 11 layouts.

```powershell
# Optional, manual: spec → pptx, then QA the real file
node src/generate.mjs examples/sample-spec.json out/sample.pptx
powershell -ExecutionPolicy Bypass -File scripts/render-pptx.ps1 out/sample.pptx .qa
```

## Repository structure

```
deckwright/
├── README.md · ROADMAP.md · RESEARCH.md · COMPETITORS.md
├── package.json                      # pptxgenjs, sharp, lucide-static, playwright, mermaid, roughjs
├── .claude/skills/
│   ├── slide-designer/               # design language + visual QA loop
│   │   ├── SKILL.md
│   │   └── reference/
│   │       ├── themes.md             # named-theme index
│   │       ├── design-system.md      # derive-a-palette + WCAG self-check
│   │       └── themes/               # one file per theme (+ diagram mappings)
│   │           ├── dev-doc-light.md  + .mermaid.json + .excalidraw.json
│   │           └── indigo-midnight · teal-trust · warm-editorial · charcoal-minimal
│   ├── theme-extractor/              # distill a reusable theme from real decks
│   └── diagram-maker/                # offline mermaid + excalidraw, themed & framed
├── scripts/
│   ├── check-deps.ps1 · render-pptx.ps1
│   ├── render-mermaid.mjs            # offline Mermaid (Playwright + local mermaid.min.js)
│   ├── render-excalidraw.mjs         # offline hand-drawn (roughjs)
│   └── lib/                          # render-svg · embed-diagram · diagram-slide
├── examples/
│   ├── diagrams/                     # .mmd + .excalidraw.json sources
│   └── demo/                         # one-command end-to-end demo deck
├── src/                             # OPTIONAL deterministic engine (not the default) — see src/README.md
└── out/ · .qa/                       # generated pptx + diagram assets + QA renders (git-ignored)
```

## Status

✅ Phase 0 (foundation) · ✅ Phase 1 (closed loop) · ✅ Phase 2 (design depth) · **Pivot 2026-06-08 → middle path** (adopt official `pptx` for build; `slide-designer` = design + QA).
✅ **Diagram branch (2026-06-08):** offline **Mermaid** + **Excalidraw/roughjs** renderers, the **`diagram-maker`** skill (diagrams paired with distilled points), **Dev-Doc Light** evolved into a unified minimalist theme, and a complete one-command demo (`examples/demo`).
🔜 Phase 3: mac/linux `check-deps.sh`, a real-topic run (incl. Chinese-font test), optional-engine polish, diagram polish (auto-layout, more shapes). See [ROADMAP.md](./ROADMAP.md).

## License

Repo code: **[Apache-2.0](./LICENSE)**. The official Anthropic `pptx`/`docx`/`xlsx`/`pdf` skills are **proprietary** — this project uses them as a dependency and does **not** copy their code.
