# Design system — how to design a deck from the request

This is the method behind step 2 of the SKILL. The goal is a deck designed **for this request** — not a template. You make the decisions; the engine just renders them.

> This reference focuses on what's **incremental** to the official `pptx` skill: deriving a palette from meaning, a **quantified contrast self-check**, and mapping content to *this engine's* layout catalog. Generic heuristics it shares with the official skill (type scale, font pairing, margins, the anti-AI "Avoid" list) are stated briefly and are **consistent** with it — not contradictory.

## A. Color strategy (derive, don't default)

### 1. Pick the dominant color from meaning
Start from the subject's domain and the desired tone, not from habit:
- **Domain association** — finance/trust → deep greens or navies; energy/industrial → ambers, steel, signal-orange; healthcare → teals/greens; climate/nature → forest/moss; security → charcoal + a single hot accent; creative/consumer → a confident saturated hue.
- **Tone** — authoritative → deep, desaturated, high-contrast; energetic → warmer, more saturated; calm → muted, low-chroma; premium → near-black backgrounds + one refined accent.
- **Avoid the reflexes**: don't default to corporate blue; don't pick a rainbow. One color should *own* the deck.

### 2. Build the palette (roles, not just colors)
Decide six roles (the engine's theme keys), all 6-char hex **without `#`**:
- `bg` — the dominant surface (carries ~60–70% of the deck).
- `fg` — primary text on `bg` (high contrast).
- `muted` — secondary text/captions (lower contrast but still legible — see check below).
- `primary` — the signature color (section panels, big numbers, icon fills).
- `secondary` — a supporting tone (card fills, panels) close to `bg`.
- `accent` — used *sparingly* for one thing per slide (eyebrow, a key number, the quote mark).

### 3. The dark/light "sandwich"
Plan background rhythm across the deck, not per slide in isolation:
- **Fully dark** — premium, focused; `bg` near-black, light `fg`.
- **Sandwich** — dark title + dark section dividers + dark closing, lighter content slides in between (use per-slide `bg` overrides). Creates rhythm and signals structure.
Pick one and apply it consistently.

### 4. Contrast self-check (do this before generating)
For every text-on-background pair, estimate WCAG contrast and fix failures:
- Compute relative luminance of each color; ratio = (L_light + 0.05) / (L_dark + 0.05).
- **fg on bg ≥ 7:1** (body must be comfortably readable), **muted on bg ≥ 4.5:1**, large display text (≥ 36pt) **≥ 3:1** minimum but prefer higher.
- Colored text/number on its background (e.g. `primary` number on `bg`) **≥ 3:1**; if a `primary` is too dark on a dark `bg`, lighten it for that use or place it on a light panel.
- Text sitting on a `primary`/`secondary` panel must pass against *that* panel, not `bg`.
When in doubt, raise contrast. Low-contrast text is the most common rendered-deck defect — and the visual QA loop must catch any that slip through.

## B. Typography
- Pair for contrast: **serif head + sans body** (e.g. Cambria/Calibri, Georgia/Calibri, Palatino/Garamond) or **heavy sans + regular sans** (Arial Black/Arial, Trebuchet MS/Calibri).
- Office-safe fonts only (Georgia, Cambria, Palatino, Garamond, Calibri, Arial, Arial Black, Trebuchet MS, Impact, Consolas) so the `.pptx` renders identically on any machine.
- Sizes: titles 36–44, section numbers large, body 14–18, captions 10–12. Keep the scale consistent across slides.

## C. Layout strategy

### The catalog — pick by what the content IS
| Use when the slide is… | layout |
|---|---|
| The opener | `title` |
| A chapter break / "what's next" | `section` |
| A short list of points | `bullets` (1–2 columns) |
| A vs. / before–after contrast | `twoColumn` |
| One number that matters | `bigNumber` |
| Several metrics together | `statGrid` |
| Capabilities/features with icons | `iconList` |
| A sequence / how-it-works | `process` |
| 2–3 parallel options/pillars | `cards` |
| A human voice / testimonial | `quote` |
| A concept needing a visual + prose | `imageText` |

### Sequence & rhythm
- **Never use the same layout twice in a row**; vary the visual shape slide to slide.
- Open dark (`title`), break with `section` dividers, alternate text-light and visual-heavy slides, land big claims on `bigNumber`/`statGrid`, end on a `quote` or a dark closing.
- Every slide carries a visual element — a panel, a number, an icon, a motif. No naked text slides.
- Prefer fewer words, larger: turn paragraphs into a `statGrid` or `iconList` where possible.

## D. Visual motif
- Optionally set `theme.motif` (`corner` | `dotgrid` | `none`) — a single restrained accent applied **uniformly** across slides for cohesion.
- Keep it subtle (it should never compete with content) and consistent.
- 🚫 A motif is NOT a line under the title. Never put a decorative underline/accent line beneath a title — the #1 tell of AI-generated slides.

## E. Anti-"AI-slides" rules
Same "Avoid" list as the official `pptx` skill (see SKILL.md) — applied at design time. The two that this engine relies on you to honor: **one dominant color (60–70%), accent used sparingly**, and **never a line under a title**.

When the design decisions are made and pass the contrast check, build the deck (via the official `pptx` skill's toolchain, applying your palette/typography/motif), then **render the real file and look** — the loop is where good becomes finished. (For deterministic spec-driven generation instead, see `../../../src/README.md`.)
