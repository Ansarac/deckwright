# diagram-maker demo

A complete, brand-neutral demo that exercises the whole pipeline: the evolved
**Dev-Doc Light** theme + both diagram tools, embedded into a real `.pptx`.

```sh
node examples/demo/build-demo.mjs      # renders 2 diagrams + builds out/demo-deck.pptx
powershell -ExecutionPolicy Bypass -File scripts/render-pptx.ps1 out/demo-deck.pptx .qa
```

Then look at `.qa/demo-deck-*.png`. Five slides: title, an overview (top-anchored,
steel-blue accent), a framed **Mermaid** flow (`examples/diagrams/auth-flow.mmd`),
a framed **Excalidraw/roughjs** architecture with nested containers
(`examples/diagrams/service-arch.excalidraw.json`), and a zebra table.

Requires the one-time setup: `npm install` then `npx playwright install chromium`,
and the open fonts (Poppins, Roboto Mono) installed for faithful rendering.
Outputs land in `out/` and `.qa/` (git-ignored).
