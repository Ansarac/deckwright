# Competitive Scan

> Purpose: Before building our own, confirm whether GitHub already has a complete equivalent. Conclusion: it's **not "nothing at all"** — there are strong adjacent projects, and one of them (PPTAgent V2) comes close to a complete equivalent in capability. But none of them aligns with the full set of our principles ("self-contained + Claude-Code native + lightweight + validates the actual exported pptx").
>
> Research date: 2026-06-07 (WebSearch was restricted; verified via GitHub repo search + directly cloning source code, which is more reliable than READMEs)

## Scoring Dimensions
(a) native **editable** pptx, produced locally · (b) local / Claude-Code driven · (c) **requirement-driven / autonomously explored design** (a design brain, not a fixed template/brand) · (d) **closed-loop visual workflow of render → look at pixels → fix → re-check** · (e) maturity

## Key Conclusions
1. **The closed-loop visual self-check is not unique, but extremely rare.** Scanning roughly 40 repos, only a few truly "render to image, feed it back to a multimodal model, and iterate"; in the Claude ecosystem, tfriedel (= a repackage of the official pptx skill, 724★) and Gabberflast (526★) both have it, while everyone else's "reflection/validation" is text/structure-level, and the MCPs are all passive tool layers.
2. **A complete capability equivalent exists: PPTAgent V2 / DeepPresenter** (icip-cas, 4.6k★, MIT, Python, active through 2026-06). Local + requirement-driven design + an **image-level closed-loop visual self-check** + also using **PptxGenJS** — all three pillars present.
3. **But no single project simultaneously satisfies "requirement-driven design brain + visual closed loop + validates the real pptx + self-contained Claude-Code native lightweight."** The ones with a visual closed loop all come with rigid templates; the only one leaning toward requirement-driven design (Akxan) gave up editable pptx and has no closed loop.

## Claude Ecosystem Comparison Table
| Project | ★ | Native editable | Visual closed loop (look at pixels) | Requirement-driven design brain |
|---|---|---|---|---|
| **Our concept** | — | ✅ PptxGenJS | ✅ render → self-check → fix → re-check | ✅ design brain |
| Gabberflast/academic-pptx-skill | 526 | ✅ | ✅ soffice+poppler, fix-and-verify | ❌ locked to academic template |
| tfriedel/claude-office-skills (≈official) | 724 | ✅ | ✅ soffice → thumbnail grid → iterate | ❌ HTML/template |
| RehgLab/ArcDeck | 0 | ✅ | ❌ only reviews the JSON plan, doesn't look at pixels | ❌ paper → deck, theme selection |
| yn01/genpptx | 0 | ✅ | ❌ can only manually open an HTML preview | ❌ themes |
| tristan/pptx-from-layouts | 69 | ✅ | ❌ heuristic validate.py | ❌ template masters |
| likaku/Mck-ppt-design | 170 | ✅ | ❌ programmatic validation gate | ❌ 70 fixed layouts |
| Akxan/ppt-agent-skill | 74 | ❌ PNG/HTML | ❌ | ⚠️ content-driven layout (closest in philosophy) |
| qwwzdyj/hackflow-ppt | 2 | ❌ image-wrapped | ❌ | ❌ preset styles |

## Broader AI-PPT Field
- **PPTAgent V2 / DeepPresenter** (icip-cas, 4.6k★, MIT): complete equivalent capability. ⚠️ But the pipeline is **HTML-first** — it designs in HTML, does visual review on the **HTML render image**, then converts HTML → pptx. That is, **what it validates is an HTML proxy, not the actually exported .pptx** (conversion introduces drift that its closed loop can't catch). The stack is heavy (MinerU + a fine-tuned 9B model + Playwright + sandbox), Python, research-grade, **conflicting with the "self-contained / Claude-Code native / Windows out-of-the-box / lightweight" philosophy**.
- presenton (8.0k★, self-hostable, editable pptx export), ALLWEONE (2.8k★, pptx export "partially complete"), etc.: strong generation, but **none have a visual closed loop**, and they're web-first.
- Auto-Slides (510★): has a feedback loop, but outputs LaTeX Beamer → PDF, and validation is text-level, not image.
- MCP layer (Office-PowerPoint-MCP-Server 1.8k★ archived, etc.): all passive tools, no self-check loop.
- SaaS (Gamma/Tome/Beautiful.ai, etc.): closed-source cloud, unsuited to local-file scenarios, excluded.

## Build vs Adopt Judgment
- **Adopting wholesale is not viable**: no single project matches our full set of principles.
- **PPTAgent V2, though capability-equivalent, is not suitable to adopt/fork**: a heavy Python research stack + a bundled fine-tuned model + HTML-first directly violates our core principles of "self-contained, Claude-Code native, lightweight, Windows out-of-the-box."
- **The render/QA pipeline does not need to be built from scratch**: tfriedel (≈official) and Gabberflast have already proven the "soffice → image → look → iterate" pattern works, and Gabberflast's stack (PptxGenJS + LibreOffice + Poppler) matches ours. **Borrow the pattern, write a lightweight implementation of our own** (the official proprietary code cannot be copied).

## Our Differentiation That Still Holds (If We Build)
1. **Claude-Code native + lightweight**: no standalone fine-tuned model / heavy infrastructure; use Claude's own multimodal reasoning directly; install Node and it's ready. The capability-equivalent PPTAgent is precisely not a Claude Code skill.
2. **Validate the "actually exported .pptx" rather than an HTML proxy**: render the **actually generated pptx** with PowerPoint COM / LibreOffice and then self-check, plugging PPTAgent's fidelity gap. ← The strongest "build" argument.
3. **A requirement-driven design brain**: the projects with a visual closed loop all come with rigid templates; this gap is unoccupied.

> ⚠️ Honest correction: the claim "we have a visual closed loop and others don't" is **no longer accurate**. The accurate differentiation is: **Claude-Code native + lightweight + validates the real OOXML (not an HTML stand-in) + a requirement-driven design brain**.

## Sources
- https://github.com/icip-cas/PPTAgent (+ arXiv 2602.22839 DeepPresenter)
- https://github.com/tfriedel/claude-office-skills · https://github.com/Gabberflast/academic-pptx-skill
- https://github.com/yn01/claude-plugins · https://github.com/RehgLab/ArcDeck-Claude-Plugin · https://github.com/qwwzdyj/hackflow-ppt-skill
- https://github.com/tristan-mcinnis/pptx-from-layouts-skill · https://github.com/likaku/Mck-ppt-design-skill · https://github.com/Akxan/ppt-agent-skill
- https://github.com/presenton/presenton · https://github.com/allweonedev/presentation-ai · https://github.com/Westlake-AGI-Lab/Auto-Slides · https://github.com/GongRzhe/Office-PowerPoint-MCP-Server
