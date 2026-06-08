# deckwright

A Claude Code workspace for building polished, native `.pptx` — locally, by the model's hand, not a service.

We do not reinvent the generator. The official `pptx` skill is the build toolchain (the *how*). We add the two things it lacks: a **design language** (the *what it looks like*) and a **look at the real output** (the *verify*).

## Principles
- **Stand on the official skill.** Build via `document-skills:pptx`. Our value is design + verification — never a second generator.
- **The loop is the soul.** Render the *actual* exported `.pptx` to images (`scripts/render-pptx.ps1` — PowerPoint COM, no LibreOffice needed), look with fresh eyes, fix, re-verify. Never call it done without one fix-and-verify pass.
- **Design is derived, not templated.** Pick a theme (`.claude/skills/slide-designer/reference/themes/`) or derive a palette (`design-system.md`); run the WCAG contrast check. Never a line under a title.
- **Thin tools, thinking model.** Deterministic tools stay small; reasoning, design, and orchestration live in Claude.
- **Brand-neutral & open.** No third-party trademarks, names, or signature colors anywhere in the repo. Open fonts only. Themes are template-portable — no logo or footer baked in.
- **English everywhere; scripts lowercase-named.**

## How we work
- Main thread **analyzes and decides**; **sub-agents drive subtasks** (opus for judgment, sonnet for mechanical work) — choose per need.
- Commit by feature/phase; keep the repo clean. Scratch lives in `out/` and `.qa/` (git-ignored).
- Prefer the official/example skills over rebuilding; research before you build.

## Map
- `.claude/skills/slide-designer/` — the design + QA layer (themes index + `themes/`, `design-system.md`).
- `.claude/skills/theme-extractor/` — learn a design language from real decks → a reusable theme.
- `scripts/check-deps.ps1` · `scripts/render-pptx.ps1` — bootstrap check; real-file QA renderer.
- `src/` — optional deterministic spec→pptx engine (not the default; see `src/README.md`).
- `ROADMAP.md` — plan, phases, decisions. `RESEARCH.md` / `COMPETITORS.md` — why this path.
