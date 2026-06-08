---
name: slide-designer
description: The design-language and visual-QA layer for building a polished, native .pptx in THIS workspace. It supplies the look (derived palette or a named theme, typography, layout, motif) and a render-the-real-file QA loop, on top of the official pptx skill's build toolchain. Use when the user wants to create or design a slide deck / presentation / .pptx here.
license: Apache-2.0
---

# slide-designer

You are the design brain. A good deck is two things: **how it is built** and **what it looks like**. The official `pptx` skill already provides the *how* (a PptxGenJS / OOXML toolchain maintained by Anthropic). This skill provides the **what** — a deliberate design derived for *this* request — and the **verify**: render the real file and fix what's wrong.

Core principle, the one that separates good output from "AI slides": **look at the actual rendered output and iterate.** Do not declare success until you have rendered the real `.pptx` to images and completed at least one fix-and-verify cycle.

## How this fits with the official `pptx` skill
- **Official `pptx` = HOW.** Use its from-scratch PptxGenJS path to actually build the file (icons via react-icons, hex without `#`, `bullet:true`, etc.). Follow its mechanics; this skill does not restate them.
- **slide-designer = WHAT + VERIFY.** It owns the design decisions (palette, typography, layout sequence, motif — see below) and the QA loop (`scripts/render-pptx.ps1`).
- The two **co-load and agree**: hex without `#`, never a line under a title, one dominant color. No contradiction.
- **Optional:** a small deterministic engine lives in `src/` (deck-spec JSON → `.pptx`) for repeatable/batch generation. It is **not** the default path and is not required — see `src/README.md`.

## Workflow

1. **Understand the request** — topic & key message, audience, tone, brand constraints (only if given), length (6–12 if unspecified).

2. **Decide the design** (the value this skill adds). Either **derive** a palette from the subject's domain and tone, or **pick a named theme** from `reference/themes.md`. Then:
   - Run the **WCAG contrast self-check** so every text/background pair is legible.
   - Plan a *varied* layout sequence and one restrained, repeated motif.
   - See `reference/design-system.md` for the full method.
   - **State the design decisions in one short paragraph** (dominant color + why, palette hexes, fonts, sandwich plan, motif, layout arc) before building.

3. **Build the deck** using the **official `pptx` skill's from-scratch PptxGenJS toolchain**, applying the chosen theme/decisions. Write the file to `out/<name>.pptx`.

4. **Render the real file for QA:**
   ```
   powershell -ExecutionPolicy Bypass -File scripts/render-pptx.ps1 out/<name>.pptx .qa
   ```
   This renders the actual exported `.pptx` to one PNG per slide via **PowerPoint COM if present, else LibreOffice+Poppler**. It deliberately works **without LibreOffice** — the official skill's own QA needs LibreOffice, so on a typical Windows machine (Office installed, no LibreOffice) this is the last-mile renderer, and it is pixel-faithful to what the user will open.

5. **Inspect with fresh eyes** — read every PNG, assume there are problems; for multi-slide decks dispatch subagents to inspect in parallel. Then **fix and re-verify** until a full pass is clean.

## Visual QA checklist (what to look for in the rendered images)
- **Overflow** — text off the slide or out of its box; clipped descenders; a value wrapping unexpectedly.
- **Overlap** — colliding elements; text over busy areas.
- **Contrast** — every text/background pair clearly legible (watch muted-on-dark).
- **Alignment** — consistent margins/edges; nothing off-canvas.
- **Hierarchy** — the most important thing per slide is the most prominent.
- **Whitespace & rhythm** — not cramped, not empty; consistent slide to slide.
- **Consistency** — same fonts/colors/margins; the motif holds.
- **Placeholders** — no leftover `lorem`, `TODO`, `xxx`, empty boxes.

> **Environment artifacts:** if a footer/watermark appears in the *render* that is NOT in your content — e.g. a corporate sensitivity-label stamp like "Internal"/"Confidential" — it was injected by the host (Office policy / Microsoft Information Protection) at render time, not by the build. Confirm via `unzip -p out.pptx 'ppt/slides/*' | grep -i internal` (absent). Do NOT try to "fix" it; the delivered file is clean. Note it for the user if relevant.

## Anti-"AI-slides" rules (consistent with the official skill's "Avoid" list)
- **NEVER put a decorative accent line/underline under a title** — the clearest tell of AI-generated slides.
- Don't default to blue. Don't center body text. Don't reuse one layout back-to-back. Don't make text-only slides. Don't cram every slide full.

## Tools
- **Render for QA:** `scripts/render-pptx.ps1 <pptx> <outDir>` → per-slide PNGs (the last-mile renderer).
- **Check dependencies:** `scripts/check-deps.ps1` reports what's missing with install commands.
- **Optional deterministic engine:** `src/` — see `src/README.md`. Not the default build path.

The design quality comes from *your* decisions and *your* visual self-check — not from any one engine.
