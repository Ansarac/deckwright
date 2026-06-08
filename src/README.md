# Optional deterministic engine (`src/`)

> **Status: optional asset — NOT the default path.** The `slide-designer` skill builds decks by default via the official `pptx` skill's toolchain (free-form PptxGenJS) and verifies them with `scripts/render-pptx.ps1`. This engine is **not wired into the skill flow**. Keep it for when you want **deterministic, repeatable, scriptable** generation from a JSON spec — e.g. batch generation, regression-stable output, or driving slides from data.

A thin, deterministic generator: it consumes a **deck-spec JSON** and emits a native, editable `.pptx` via PptxGenJS. The design decisions still come from you (or the skill); this engine just renders a spec faithfully.

## Usage
```
node src/generate.mjs <spec.json> <out.pptx>
# then QA the real file:
powershell -ExecutionPolicy Bypass -File scripts/render-pptx.ps1 <out.pptx> .qa
```
Dependencies (in `package.json`, installed by `npm install`): `pptxgenjs` (engine), `lucide-static` + `sharp` (icon pipeline for the `iconList` layout).

Files: `generate.mjs` (CLI + dispatch + validation), `layouts.mjs` (11 layout renderers + motif), `theme.mjs` (defaults + hex sanitizer), `icons.mjs` (lucide SVG → recolored PNG). Example specs in `../examples/`.

## Deck-spec format

```json
{
  "meta":  { "title": "Deck title", "layout": "16x9", "author": "optional" },
  "theme": {
    "bg": "0E1116", "fg": "FFFFFF", "muted": "A0A6B0",
    "primary": "5B8DEF", "secondary": "1F2A44", "accent": "F2C14E",
    "fontHead": "Georgia", "fontBody": "Calibri",
    "motif": "none"
  },
  "slides": [ { "layout": "title", "title": "..." } ]
}
```

Rules:
- Colors are 6-digit hex **without `#`** (a `#` or 8-digit hex corrupts the file; the engine sanitizes/rejects bad values). For translucency use an opacity option, not alpha hex.
- Fonts: Office-safe only so the file renders anywhere (Georgia, Cambria, Palatino, Garamond, Calibri, Arial, Arial Black, Trebuchet MS, Impact, Consolas).
- `meta.layout`: `"16x9"` (default) or `"wide"`.
- `theme.motif`: `"corner"` | `"dotgrid"` | `"none"` (default `none`) — a subtle accent applied uniformly; never a line under a title.
- Each slide may set `"bg": "RRGGBB"` to override `theme.bg` (for a dark title/section/closing on a lighter deck).
- The `theme` is chosen per deck — pick a theme from the skill's `reference/themes.md` or derive one (`reference/design-system.md`).

### Layouts and fields

| layout | required | optional |
|---|---|---|
| `title` | `title` | `eyebrow`, `subtitle` |
| `section` | `title` | `number` (e.g. `"01"`) |
| `bullets` | `title`, `bullets` (string[]) | `columns` (1 or 2, default 1) |
| `twoColumn` | `title`, `left`, `right` | — |
| `bigNumber` | `stat` (e.g. `"73%"`), `caption` | `title` |
| `statGrid` | `stats` (2–4 items) | `title` |
| `iconList` | `items` (2–5 items) | `title` |
| `process` | `steps` (3–5 items) | `title` |
| `cards` | `cards` (2–3 items) | `title` |
| `quote` | `quote` | `attribution` |
| `imageText` | `title`, `body` | `image` (local path; placeholder if absent) |

Object shapes for multi-item layouts:
- `twoColumn` `left`/`right`: `{ "heading": "optional", "body": "text" }` or `{ "heading": "optional", "bullets": ["...", "..."] }`.
- `statGrid` `stats[]`: `{ "value": "73%", "label": "short label", "caption": "optional" }`.
- `iconList` `items[]`: `{ "icon": "<lucide name>", "heading": "...", "body": "optional" }` (icon recolored, inside a filled circle).
- `process` `steps[]`: `{ "label": "step name", "detail": "optional" }` (auto-numbered).
- `cards` `cards[]`: `{ "heading": "...", "body": "..." }`.

See `../examples/sample-spec.json` and `../examples/phase2-spec.json` for complete examples.
