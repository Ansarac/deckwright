---
name: theme-extractor
description: Learn a design language from existing decks (or any visual reference) and distill it into a reusable, brand-neutral, template-portable theme — validated by generating a new deck and looking at it. Use when the user wants to replicate a look they like, turn reference slides into a theme, or extract "their" style into something reusable.
license: Apache-2.0
---

# theme-extractor

Turn a reference you admire — a person's real decks, a screenshot, a site — into a **named theme** that the `slide-designer` skill can reuse. The output is a theme entry in `slide-designer/reference/themes.md`, proven by building a fresh deck in it and comparing.

## The one principle
**Separate the portable *design language* from the *brand/template chrome*, and keep only the design language.**
- Design language (KEEP): type hierarchy, color *roles*, layout patterns, spacing, highlight technique, diagram style.
- Brand/template chrome (DROP / neutralize): logos, footer branding, proprietary fonts, trademarked or signature colors.
- A theme must be **brand-neutral and template-portable**: no logos, no footer branding, **open fonts only** (e.g. Poppins/OFL, Roboto Mono/Apache), and any brand-signature color swapped for a near generic equivalent. The repo must not carry a third party's trademarks or signature colors.

## Workflow

1. **Gather references.** Which decks/images/pages embody the look. Note any fonts the author supplies.

2. **Render references to images** (so you analyze what's actually on screen, not the XML).
   - Use `scripts/render-pptx.ps1 "<deck.pptx>" .qa/src-<name>`.
   - **Skip template chrome**: the first 1–2 and last 1–2 slides (title / section / thank-you) are usually template — don't learn from them. Learn from the *content* slides.
   - **Large decks** (often mostly embedded video) — read **on demand**, don't render the whole thing:
     - `unzip -l "<deck.pptx>"` to see what's big (video lives in `ppt/media/`).
     - `unzip -p "<deck.pptx>" ppt/theme/theme1.xml` → color scheme (`<a:clrScheme>`) + font scheme (`majorFont`/`minorFont`).
     - `unzip -l "<deck.pptx>" | grep slides/slide` → slide count; render only a representative range (a slide-range option for render-pptx.ps1 is a worthwhile enhancement).
   - Fonts embedded in a pptx (`ppt/fonts/*.fntdata`) make renders faithful without installing anything; otherwise install the supplied open fonts (per-user) for fidelity.

3. **Analyze & separate.** From the content slides, extract — and label each as KEEP or DROP:
   - **Color**: pull exact hexes; assign *roles* (bg, fg, muted, primary, secondary, support, accent). Identify the brand-signature color (DROP → swap for a near generic one).
   - **Typography**: heading/body/mono families, weights, sizes, hierarchy; how code is shown. Map to open fonts.
   - **Layout**: title placement, section headers, columns, tables, callouts, margins/whitespace, the highlight technique (recolor vs bold), whether rules sit under titles/sections.
   - **Diagrams**: mermaid/excalidraw palette, semantic colors (success/failure/highlight), hand-drawn vs precise. *Diagrams are often the heart of a technical design language — capture their palette/style even if generation is deferred.*
   - **Chrome to drop**: logo, footer text, brand fonts, signature color.

4. **Distill into a theme.** Add a new file `slide-designer/reference/themes/<name>.md` (the full spec: token table for bg/fg/muted/primary/secondary/support/accent, all hex without `#`; font pairing in open fonts; layout signatures; diagram palette) and a one-row entry in the `themes.md` index. State that it's brand-neutral and template-portable.

5. **Validate (the proof).** Build a NEW short deck in the theme on different content (via the official `pptx` toolchain, applying the theme), then `render-pptx.ps1` it and **look**:
   - Compare side-by-side with the reference content slides.
   - **Keep what reproduced well; drop the reference's weak slides** (real decks have bad slides too — don't copy them).
   - Iterate the theme until the new deck reads as the same design language, then it's final.

## See also
- `slide-designer` — uses the themes you produce.
- `slide-designer/reference/themes.md` (index) + `themes/` (one file per theme) — where themes live; `design-system.md` — the derive-from-scratch method (use when there's no reference to extract).
- `scripts/render-pptx.ps1` — renders the real file for both reference analysis and validation.
