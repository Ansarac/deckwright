# Market Research Report: Generating PPT Slides Locally with Claude Code

> Goal: Build a git repo that uses **officially published Skills** + **off-the-shelf CLI tools / MCP servers** (CLI preferred) to generate `.pptx` locally with Claude Code, reproducing the slide design quality seen on Claude's official site. No web rendering.
>
> Research date: 2026-06-07

---

## 0. One-Sentence Conclusion

**90% of this has already been done officially; there's no need to reinvent the wheel.** Anthropic has **published** the `pptx` skill that powers the "create files" feature on claude.ai at `github.com/anthropics/skills`, and it can be **installed and used directly** through Claude Code's plugin marketplace. Under the hood it uses **PptxGenJS (a Node library)** to generate native `.pptx` from scratch, and it ships with a set of design rules plus a closed-loop visual QA process.

The repo you want to build is essentially a **thin wrapper**: install the official skill + runtime dependencies, then (optionally) layer on your own brand theme.

---

## 1. Officially Published Skills

### Repository: `github.com/anthropics/skills`
- Contains 17 skills under two license categories:
  - **example category** (algorithmic-art, mcp-builder, brand-guidelines, theme-factory, canvas-design, frontend-design, etc.) = **Apache 2.0**, free to use/adapt.
  - **document category** (`pptx` / `docx` / `xlsx` / `pdf`) = **proprietary / source-available**. © 2025 Anthropic. **Explicitly prohibited**: copying, adapting, redistributing, decompiling. → You may only "read for reference" or "install and use through official channels"; you **cannot fork them into your own repo**.
- Anthropic's own words: these four document skills are what "power Claude's document capabilities under the hood" (i.e., the same ones behind the claude.ai create-files feature).

### How the `pptx` skill works (this is our blueprint)
- **Generate from scratch → PptxGenJS (JavaScript/Node library)**. Coordinates in inches; `pres.layout='LAYOUT_16x9'`; **colors are 6-digit hex without `#`** (a `#` prefix or 8-digit hex will corrupt the file).
- **Template-based / editing → operate directly on OOXML XML**: unpack (unzip + prettify XML) → edit `slideN.xml` → clean → pack.
- **Reading**: `markitdown` extracts text; `thumbnail.py` generates a thumbnail grid for choosing layouts.
- **Closed-loop visual QA (signature feature)**: render to images (LibreOffice `soffice` → `pdftoppm`) → use a "fresh perspective" sub-agent to find overlap/overflow/contrast issues → fix → re-check. "It doesn't count as done until at least one fix-and-verify round is complete."
- Dependencies: `markitdown[pptx]`, `Pillow`, `pptxgenjs` (npm), LibreOffice, Poppler.

### Installation (Claude Code)
```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills   # pptx/docx/xlsx/pdf
/plugin install example-skills@anthropic-agent-skills     # art/brand/theme, etc.
```

---

## 2. Official Plugins / Marketplace

- **The plugin system is mature and real.** A plugin = a distributable package containing skills/agents/hooks/MCP/LSP, etc., with the manifest in `.claude-plugin/plugin.json`.
- **`claude-plugins-official`**: officially curated by Anthropic, **automatically available in every installation**, browseable at `claude.com/plugins` (around 140+ partner plugins).
- **`claude-community`**: `anthropics/claude-plugins-community`, must be added manually, passes automated validation + security review.
- ⚠️ **There is no dedicated PowerPoint/.pptx plugin in the official marketplace.** The closest official PPT capability is the **Agent Skill** described above (not a plugin).

### Off-the-shelf community PPT plugins (already passed official validation; reference / direct use)
- **`genpptx`** (yn01/claude-plugins): generates **native .pptx** + HTML, AI narrative structure (problem → solution → impact), 10 layouts, can extract themes from existing pptx, no API key required. ← **best fit for your needs**
- **`hackflow-ppt`**: hackathon pitch decks, 6 visual styles.
- **`arcdeck`**: academic PDF → narrative PPT (13 agents).

---

## 3. Official / Off-the-Shelf MCP Servers

- Official reference MCPs (`modelcontextprotocol/servers`): Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, Time — **none of them do PPT/document generation** (only Filesystem can help write files to disk).
- The most well-known community server, **Office-PowerPoint-MCP-Server** (GongRzhe, based on python-pptx, ~32 tools, 1.8k★) — ⚠️ **archived (read-only) since 2026-03**, not recommended as a long-term dependency.
- Conclusion: **there is no reliable off-the-shelf MCP option**, so your "CLI-first" judgment is correct.

---

## 4. CLI / Libraries: A Panorama Comparison for Generating `.pptx`

Key distinction: **native editable .pptx** (true OOXML, text selectable and editable) vs. **image-wrapped .pptx** (one bitmap per page, good-looking but not editable).

| Tool | Language/Driver | Native editable .pptx? | Agent CLI fit | Notes |
|---|---|---|---|---|
| **PptxGenJS** | Node | ✅ Yes | ⭐ Excellent | The official pptx skill uses it; zero dependencies; ~17M downloads/month; LLMs are familiar with it |
| **python-pptx** | Python | ✅ Yes | Good (requires writing your own scripts) | MIT, mature; no rendering capability |
| **pptx-automizer** | Node | ✅ Yes (template merging) | Good | Suited for brand templates, often paired with PptxGenJS |
| **Pandoc** | CLI | ✅ Yes (markdown→pptx) | ⭐ Excellent | `--reference-doc` specifies a template; weaker style control than libraries |
| **Spire / Aspose** | .NET, etc. | ✅ Yes (high fidelity) | Good | Commercial; free versions have limits/watermarks |
| **Marp (marp-cli)** | CLI/MD | ❌ Image version by default | Good CLI but pptx not editable | `--pptx-editable` is experimental and unstable |
| **Slidev** | CLI/MD+Vue | ❌ Image version | Good for HTML/PDF | pptx text not selectable |
| **reveal.js** | HTML | ❌ No pptx | Web/PDF only | — |

**Conclusion**: For native .pptx, choose **PptxGenJS / python-pptx / Pandoc**. Marp/Slidev/reveal.js are HTML/PDF tools whose pptx output is image-wrapped — **don't choose them**.

---

## 5. The Truth About "Claude's Official Site Design Look" ⚠️

**Important clarification**: the deck you download from claude.ai does **not** use the official site's "cream-white background + rust-orange" brand style. It uses a set of **general design rules (rubric)** built into the pptx skill. This rubric is the engine that produces the "premium feel":

### 10 built-in color schemes (exact hex)
| Theme | Primary | Secondary | Accent |
|---|---|---|---|
| Midnight Executive | `1E2761` | `CADCFC` | `FFFFFF` |
| Forest & Moss | `2C5F2D` | `97BC62` | `F5F5F5` |
| Coral Energy | `F96167` | `F9E795` | `2F3C7E` |
| Warm Terracotta | `B85042` | `E7E8D1` | `A7BEAE` |
| Ocean Gradient | `065A82` | `1C7293` | `21295C` |
| Charcoal Minimal | `36454F` | `F2F2F2` | `212121` |
| Teal Trust | `028090` | `00A896` | `02C39A` |
| Berry & Cream | `6D2E46` | `A26769` | `ECE2D0` |
| Sage Calm | `84B59F` | `69A297` | `50808E` |
| Cherry Bold | `990011` | `FCF6F5` | `2F3C7E` |

### Font pairings (heading/body, all system/Office-safe fonts)
Georgia/Calibri · Arial Black/Arial · Calibri/Calibri Light · Cambria/Calibri · Trebuchet MS/Calibri · Impact/Arial · Palatino/Garamond · Consolas/Calibri

### Font sizes & spacing
Title 36–44pt bold · section header 20–24pt bold · body 14–16pt · caption 10–12pt gray · margins ≥0.5" · block spacing 0.3–0.5"

### Design principles (the key to the "signature look")
- One primary color taking up 60–70% + 1–2 secondary colors + 1 accent color
- Dark/light "sandwich" (dark title page + dark closing page, light content in between)
- One recurring visual motif throughout; a visual element on every page; vary the layouts (two-column / icon rows / grids / half-bleed images); big-number callouts; icons in colored circles; italic emphasis sentences
- **Don'ts**: don't default to blue, don't center body text, don't repeat the same layout, don't make text-only pages
- 🚫 **"Never add a decorative horizontal line under the title"** — this is the telltale giveaway of AI-generated PPTs

> If you **really do** want to reproduce the claude.ai official site's cream-white + rust-orange brand style (rather than this rubric), you'll need to configure a separate palette of your own (warm cream background + rust-orange accent). The official brand's exact fonts/hex could not be confirmed from a first-party source this time (the brand page returned 404 / was anti-scraped); you'll need to look up the official brand guidelines separately in a browser.

---

## 6. Recommended Approach

### Path A (least effort, recommended to try first): use the official skill directly
```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```
Install the runtime dependencies (Node + pptxgenjs, Python + markitdown/Pillow, LibreOffice, Poppler) and let Claude Code call the official pptx skill directly. **Almost zero development effort** — verify the reproduction quality first.

### Path B (what your repo should actually do): thin wrapper + your own brand layer
Your git repo =
1. **Environment/dependency manifest** (one-click install of Node/Python/LibreOffice/Poppler + npm i pptxgenjs);
2. **A skill of your own** (Apache-2.0, written from scratch, not touching proprietary code): encapsulating your **brand theme** (color scheme/fonts/layout rules — you can implement an equivalent of your own by referencing the rubric in Section 5), telling Claude "what counts as good-looking";
3. **A thin CLI wrapper**: write a few layout-generation functions based on **PptxGenJS** (title page / bullet page / image-text page / big-number page / quote page) + a QA script that renders to images;
4. (Optional) reference the approach of the community **genpptx**.

### Things not to do
- ❌ Don't fork/copy the official pptx/docx/xlsx/pdf skill code (proprietary license).
- ❌ Don't choose Marp/Slidev/reveal.js for pptx (image version, not editable).
- ❌ Don't depend on the archived Office-PowerPoint-MCP-Server.

---

## 7. Key Sources
- Official Skills repository: https://github.com/anthropics/skills (pptx SKILL.md / editing.md / pptxgenjs.md)
- Create files announcement: https://claude.com/blog/create-files
- Skills introduction: https://claude.com/blog/skills
- Plugin documentation: https://code.claude.com/docs/en/plugins ; official marketplace https://claude.com/plugins
- Official/community marketplaces: https://github.com/anthropics/claude-plugins-official ; https://github.com/anthropics/claude-plugins-community
- Libraries: https://github.com/gitbrent/PptxGenJS ; https://github.com/scanny/python-pptx ; https://pandoc.org/MANUAL.html
- Community plugins: genpptx (yn01/claude-plugins), hackflow-ppt, arcdeck
- Community MCP (archived): https://github.com/GongRzhe/Office-PowerPoint-MCP-Server
