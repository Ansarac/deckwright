# Themes — index

Reusable, fully-specified design themes — the "what it looks like" presets this skill adds on top of the official build toolchain. **Pick the one that fits the request from the table below, then open its file in `themes/` for the full spec** (tokens, fonts, layout signatures). If none fits, **derive** a palette instead (see `design-system.md`).

How to apply a theme: when building the deck (via the official `pptx` skill's PptxGenJS path, or the optional `src/` engine), use the theme's colors, font pairing, and motif from its file. All colors are **6-digit hex without `#`**. Always re-run the WCAG contrast self-check after adapting any color.

**Shared rules (every theme):** one dominant color (60–70%), accent used sparingly, **never a line under a title**.

## Choose a theme

| theme | mood | best for | file |
|---|---|---|---|
| **Indigo Midnight** | dark · premium | product launches, technical talks, strategy | [`themes/indigo-midnight.md`](themes/indigo-midnight.md) |
| **Teal Trust** | dark · calm | reliability/SRE, cost/FinOps, infrastructure | [`themes/teal-trust.md`](themes/teal-trust.md) |
| **Warm Editorial** | light · humanist | narrative decks, brand/editorial, leadership comms | [`themes/warm-editorial.md`](themes/warm-editorial.md) |
| **Charcoal Minimal** | dark · understated | data/financial reviews, understated technical | [`themes/charcoal-minimal.md`](themes/charcoal-minimal.md) |
| **Dev-Doc Light** | light · minimalist developer-doc | code/table/diagram-heavy technical docs, minimalist technical/academic reviews | [`themes/dev-doc-light.md`](themes/dev-doc-light.md) |

These are starting points, not a fixed set — the goal is a design that fits *this* request. Add a new theme by dropping a file in `themes/` and a row here; trim one by removing both. When the topic or tone calls for it, derive a fresh palette with the method in `design-system.md`.

**Diagrams:** a theme may carry diagram mappings beside its `.md` for the `diagram-maker` skill — `themes/<name>.mermaid.json` (palette → Mermaid `themeVariables`) and `themes/<name>.excalidraw.json` (palette → roughjs hand-drawn: card fills, ink, font, roughness). E.g. `dev-doc-light.mermaid.json` + `dev-doc-light.excalidraw.json`. When adding a diagram-heavy theme, add these mappings too.
