# Dev-Doc Light  *(light · developer documentation · minimalist technical/academic)*

A calm, white "developer-documentation-as-slides" look, distilled from real engineering decks: a single geometric sans, generous whitespace, **one cool steel-blue accent** for section headings, monospace reserved for code, and warm orange demoted to a rare diagram spark. The aesthetic is **minimalist and academic** — typographic restraint, content anchored toward the top of the slide, precise themed diagrams instead of decoration. **Brand-neutral and template-portable** — it specifies only typography, color roles, layout, and diagram style (no logo, no footer branding, open fonts only), so it drops onto any template.

| role | hex | role | hex |
|---|---|---|---|
| bg | `FFFFFF` | primary — steel-blue (heading accent) | `3A75A0` |
| fg | `141414` | secondary — teal | `367883` |
| muted | `6B6B6B` | support — purple | `7C6A93` |
| steel-display (large headings only) | `4E90BE` | accent — warm orange (rare spark) | `F08C00` |

- **One cool accent owns the deck.** Steel-blue (`3A75A0`) is the signature: it carries section headings and inline keyword recoloring. Teal and purple are secondary supports (use one consistently per deck, or alternate by section — don't scatter all three on one slide). The dominant surface is white (~60–70%); colored ink is sparing.
- Fonts (open, embeddable): **Poppins** (OFL) for **all running text** — page title in Poppins (Regular/Medium), section headers in Poppins-Medium/SemiBold colored steel-blue, body Poppins Regular/Light at ~1.4–1.6 line spacing. **Roboto Mono** (Apache 2.0) for code, identifiers, paths, links, and diagram labels only. *(Both are installed on this workstation; if a host lacks them, embed via the build step or fall back to Segoe UI / Consolas.)* The deck's running text is a single clean sans — keep mono out of prose; recolor or use it only for true code tokens.
- **Highlight by recoloring** keywords steel-blue (or teal), *not* by bolding. One or two recolored tokens per line, never a rainbow.
- Tables: colored header text (steel-blue/teal), zebra striping in tints `E1EDF5` (steel) / `E3EEF0` (teal), airy rows; no heavy gridlines.
- Code, three treatments: (1) inline recolored mono; (2) thin purple-bordered single-line box; (3) full listing — light white panel + ~1px purple (`7C6A93`) border + mono filename caption + syntax colors (comments green `2F9E44`, strings/paths blue `1971C2`); use a **dark navy panel** (`0E2230`) with line numbers only for real source code.

## Layout — minimalist rhythm (the signature)
- **Top-anchored, never centered.** Content begins high on the slide and whitespace pools at the **bottom** — a deliberate "engineer's notebook" feel. Start the first content block in roughly the top third (well below the title), keep blocks left-aligned, and let the lower quarter–third of the slide breathe empty. Do **not** vertically center a sparse slide, and do **not** stretch content to fill the bottom. A diagram or table may anchor the lower band, but prose slides should leave the bottom open.
- **Page title:** centered, in fg ink (or near-black), **NO rule under it** (the #1 AI-slides tell). Generous space between the title and the first content block.
- **Section header:** left-aligned, Poppins-Medium/SemiBold, colored steel-blue. A thin full-width rule *beneath* a section header is the **one allowed rule** in this theme — but the reference decks often omit even that, relying on color + weight + whitespace alone. Prefer the ruleless treatment for the most minimal look; the rule is optional, never under the page title.
- **Rhythm:** consistent left margin and generous inter-block spacing; one idea per block. Signature **two-column compare** layouts (text|diagram, text|code, table+arrow+table). Diagrams are **framed, not full-bleed**; oversized ones get a "view full diagram" pill. Flat — no shadows; rounded rectangles; whitespace does the structuring, not borders or lines.
- **A diagram is evidence for a claim — never alone on a slide.** Pair every diagram with the 2–3 distilled points it supports (steel sub-label + a line) and, ideally, a one-line takeaway. Portrait/square diagram → points left, diagram right; wide diagram → points (heading + a row) on top, diagram beneath. The `diagram-maker` skill's `addDiagramWithPoints` lays this out.
- Footer/logo are **template-specific, not part of this theme** — leave them to whatever template hosts the deck.
- Best for: developer docs, protocol/state-machine walk-throughs, code- and table-heavy technical decks, minimalist technical/academic reviews.

## Diagram palette (for mermaid / excalidraw assets)
Semantic, brand-neutral. Use a monospace font for diagram labels.
| meaning | fill | stroke |
|---|---|---|
| ink / default | — | `1E1E1E` |
| success | `EBFBEE` | `2F9E44` |
| failure | `FFC9C9` | `E03131` |
| highlight | `FFF3BF` | `F08C00` |
| info / nodes | tints of `3A75A0` (steel) / `367883` (teal) / `7C6A93` (purple) | `1971C2` |

Use **excalidraw** (hand-drawn) for conceptual/topology sketches; **mermaid** for precise flowcharts, sequence diagrams, and state machines (PlantUML is out of scope — draw UML separately). **These diagrams are the heart of a technical design language.** Generate them with the **`diagram-maker`** skill: author a palette-free `.mmd` (semantic `classDef`s from the table above), then render it offline with this theme's Mermaid mapping — **`dev-doc-light.mermaid.json`** (beside this file) — via `scripts/render-mermaid.mjs`. Embed **framed, not full-bleed** (see motif). Both are built: **mermaid** (`dev-doc-light.mermaid.json`) for precise diagrams, **excalidraw / roughjs** (`dev-doc-light.excalidraw.json`) for restrained hand-drawn sketches — mono labels, lightest line treatment.

Shared rules apply (see `../themes.md`): one dominant color 60–70%, accent sparing, never a line under a title; colors are 6-digit hex without `#`; re-run the WCAG contrast self-check after any change.

## WCAG self-check (white `FFFFFF` background)
| pair | ratio | needs | verdict |
|---|---|---|---|
| fg `141414` | 18.42 | ≥7 body | pass |
| muted `6B6B6B` | 5.33 | ≥4.5 | pass |
| steel-blue `3A75A0` (section headers, ≥18pt; inline keyword) | 4.96 | ≥4.5 small / ≥3 large | pass |
| steel-display `4E90BE` (large headers only, ≥24pt) | 3.47 | ≥3 large | pass — large only |
| teal `367883` (headers / keyword) | 5.03 | ≥4.5 | pass |
| purple `7C6A93` (support / borders) | 4.84 | ≥4.5 | pass |
| comment-green `2F9E44` (code) | 3.45 | ≥3 large | pass — code accents only |
| string/path-blue `1971C2` (code) | 5.02 | ≥4.5 | pass |
| orange `F08C00` (diagram spark, non-text) | — | n/a | decorative; never body text |
| fg on steel tint `E1EDF5` / teal tint `E3EEF0` (table zebra) | 15.5 / 15.5 | ≥7 | pass |

`steel-display` and the code-green are **large/decorative only** — do not set body or caption text in them. Orange is a diagram fill/stroke spark, never running text.
