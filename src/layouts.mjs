// layouts.mjs — one renderer per layout. Each takes (slide, spec, theme) where
// `slide` is a fresh PptxGenJS slide and `spec` is the slide's spec object.
//
// Slide canvas is 10 x 5.625 in (LAYOUT_16x9). Margin ~0.5in.
// Rules: never reuse an options object across addText (the lib mutates it) —
// build a fresh one each call. Use real bullets (bullet:true), never unicode.
// Use charSpacing, not letterSpacing. No decorative lines under titles.

import fs from 'node:fs';
import { sanitizeHex } from './theme.mjs';
import { renderIcon } from './icons.mjs';

const PAGE_W = 10;
const PAGE_H = 5.625;
const M = 0.5; // margin
const CONTENT_W = PAGE_W - 2 * M;

// ---- helpers ---------------------------------------------------------------

function require_(spec, field, layout) {
  const v = spec[field];
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    throw new Error(`Layout "${layout}" requires field "${field}".`);
  }
  return v;
}

// Resolve per-slide bg override (sanitized) or fall back to theme.bg.
function slideBg(spec, theme) {
  return spec.bg ? sanitizeHex(spec.bg, 'slide.bg') : theme.bg;
}

function paintBg(slide, color) {
  slide.background = { color };
}

// Optional title at the top of a content slide. Returns the y where body starts.
// NEVER draws a decorative line under the title.
function contentTitle(slide, spec, theme) {
  if (!spec.title) return 1.0;
  slide.addText(String(spec.title), {
    x: M, y: M, w: CONTENT_W, h: 0.8,
    fontFace: theme.fontHead, fontSize: 32, bold: true,
    color: theme.fg, align: 'left', valign: 'top',
  });
  return 1.5;
}

// ---- visual motif ----------------------------------------------------------
// theme.motif: "corner" | "dotgrid" | "none" (default). A subtle, uniform accent
// in a slide corner. Applied by every layout via applyMotif(). Never a line
// under a title.

function applyMotif(slide, theme) {
  const motif = theme.motif || 'none';
  if (motif === 'none') return;

  if (motif === 'corner') {
    // Three small stepped accent rectangles tucked in the top-right corner.
    const sizes = [
      { w: 0.5, h: 0.12, dx: 0.0 },
      { w: 0.32, h: 0.12, dx: 0.62 },
      { w: 0.16, h: 0.12, dx: 1.06 },
    ];
    const baseX = PAGE_W - M - 0.5;
    const y = 0.32;
    sizes.forEach((s, i) => {
      slide.addShape('rect', {
        x: baseX - s.dx, y, w: s.w, h: s.h,
        fill: { color: theme.accent, transparency: i === 0 ? 0 : 40 },
        line: { type: 'none' },
      });
    });
    return;
  }

  if (motif === 'dotgrid') {
    // A small 3x3 grid of accent dots in the bottom-right corner.
    const r = 0.05;
    const gap = 0.22;
    const cols = 3;
    const rows = 3;
    const startX = PAGE_W - M - (cols - 1) * gap - r * 2;
    const startY = PAGE_H - M - (rows - 1) * gap - r * 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        slide.addShape('ellipse', {
          x: startX + col * gap, y: startY + row * gap, w: r * 2, h: r * 2,
          fill: { color: theme.accent, transparency: 35 },
          line: { type: 'none' },
        });
      }
    }
  }
}

// ---- title -----------------------------------------------------------------

function title(slide, spec, theme) {
  const t = require_(spec, 'title', 'title');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  let y = 1.9;
  if (spec.eyebrow) {
    slide.addText(String(spec.eyebrow).toUpperCase(), {
      x: M, y: 1.45, w: CONTENT_W, h: 0.4,
      fontFace: theme.fontBody, fontSize: 14, bold: true,
      color: theme.accent, charSpacing: 3, align: 'left',
    });
  } else {
    y = 1.7;
  }

  slide.addText(String(t), {
    x: M, y, w: CONTENT_W, h: 1.4,
    fontFace: theme.fontHead, fontSize: 44, bold: true,
    color: theme.fg, align: 'left', valign: 'top', lineSpacingMultiple: 1.0,
  });

  if (spec.subtitle) {
    slide.addText(String(spec.subtitle), {
      x: M, y: y + 1.45, w: CONTENT_W, h: 0.9,
      fontFace: theme.fontBody, fontSize: 18,
      color: theme.muted, align: 'left', valign: 'top',
    });
  }
}

// ---- section ---------------------------------------------------------------

function section(slide, spec, theme) {
  const t = require_(spec, 'title', 'section');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  // Dominant primary block down the left side.
  const blockW = 3.4;
  slide.addShape('rect', {
    x: 0, y: 0, w: blockW, h: PAGE_H,
    fill: { color: theme.primary },
    line: { type: 'none' },
  });

  if (spec.number) {
    slide.addText(String(spec.number), {
      x: 0, y: 1.7, w: blockW, h: 2.2,
      fontFace: theme.fontHead, fontSize: 120, bold: true,
      color: theme.bg, align: 'center', valign: 'middle',
    });
  }

  slide.addText(String(t), {
    x: blockW + 0.6, y: M, w: PAGE_W - blockW - 0.6 - M, h: PAGE_H - 2 * M,
    fontFace: theme.fontHead, fontSize: 40, bold: true,
    color: theme.fg, align: 'left', valign: 'middle', lineSpacingMultiple: 1.05,
  });
}

// ---- bullets ---------------------------------------------------------------

function bullets(slide, spec, theme) {
  const t = require_(spec, 'title', 'bullets');
  const items = require_(spec, 'bullets', 'bullets');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Layout "bullets" requires a non-empty "bullets" array.');
  }
  const columns = spec.columns === 2 ? 2 : 1;
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  slide.addText(String(t), {
    x: M, y: M, w: CONTENT_W, h: 0.8,
    fontFace: theme.fontHead, fontSize: 32, bold: true,
    color: theme.fg, align: 'left', valign: 'top',
  });

  const bodyY = 1.45;
  const bodyH = PAGE_H - bodyY - M;
  const mkRuns = (arr) =>
    arr.map((b) => ({
      text: String(b),
      options: { bullet: { indent: 18 }, color: theme.fg, breakLine: true },
    }));

  const baseOpts = {
    fontFace: theme.fontBody, fontSize: 16, color: theme.fg,
    align: 'left', valign: 'top', paraSpaceAfter: 8, lineSpacingMultiple: 1.05,
  };

  if (columns === 2) {
    const mid = Math.ceil(items.length / 2);
    const colW = (CONTENT_W - 0.5) / 2;
    slide.addText(mkRuns(items.slice(0, mid)), {
      ...baseOpts, x: M, y: bodyY, w: colW, h: bodyH,
    });
    slide.addText(mkRuns(items.slice(mid)), {
      ...baseOpts, x: M + colW + 0.5, y: bodyY, w: colW, h: bodyH,
    });
  } else {
    slide.addText(mkRuns(items), {
      ...baseOpts, x: M, y: bodyY, w: CONTENT_W, h: bodyH,
    });
  }
}

// ---- twoColumn -------------------------------------------------------------

function columnContent(slide, col, x, y, w, h, theme) {
  let cursorY = y;
  if (col && col.heading) {
    slide.addText(String(col.heading), {
      x, y: cursorY, w, h: 0.5,
      fontFace: theme.fontBody, fontSize: 18, bold: true,
      color: theme.accent, align: 'left', valign: 'top',
    });
    cursorY += 0.6;
  }
  if (col && Array.isArray(col.bullets) && col.bullets.length > 0) {
    const runs = col.bullets.map((b) => ({
      text: String(b),
      options: { bullet: { indent: 16 }, color: theme.fg, breakLine: true },
    }));
    slide.addText(runs, {
      x, y: cursorY, w, h: h - (cursorY - y),
      fontFace: theme.fontBody, fontSize: 15, color: theme.fg,
      align: 'left', valign: 'top', paraSpaceAfter: 6, lineSpacingMultiple: 1.05,
    });
  } else if (col && col.body) {
    slide.addText(String(col.body), {
      x, y: cursorY, w, h: h - (cursorY - y),
      fontFace: theme.fontBody, fontSize: 15, color: theme.fg,
      align: 'left', valign: 'top', lineSpacingMultiple: 1.15,
    });
  }
}

function twoColumn(slide, spec, theme) {
  const t = require_(spec, 'title', 'twoColumn');
  const left = require_(spec, 'left', 'twoColumn');
  const right = require_(spec, 'right', 'twoColumn');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  slide.addText(String(t), {
    x: M, y: M, w: CONTENT_W, h: 0.8,
    fontFace: theme.fontHead, fontSize: 32, bold: true,
    color: theme.fg, align: 'left', valign: 'top',
  });

  const bodyY = 1.45;
  const bodyH = PAGE_H - bodyY - M;
  const gap = 0.6;
  const colW = (CONTENT_W - gap) / 2;

  columnContent(slide, left, M, bodyY, colW, bodyH, theme);
  columnContent(slide, right, M + colW + gap, bodyY, colW, bodyH, theme);
}

// ---- bigNumber -------------------------------------------------------------

function bigNumber(slide, spec, theme) {
  const stat = require_(spec, 'stat', 'bigNumber');
  const caption = require_(spec, 'caption', 'bigNumber');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  let y = 1.0;
  if (spec.title) {
    slide.addText(String(spec.title), {
      x: M, y: M, w: CONTENT_W, h: 0.6,
      fontFace: theme.fontHead, fontSize: 24, bold: true,
      color: theme.muted, align: 'center', valign: 'top',
    });
    y = 1.35;
  }

  slide.addText(String(stat), {
    x: M, y, w: CONTENT_W, h: 2.6,
    fontFace: theme.fontHead, fontSize: 130, bold: true,
    color: theme.primary, align: 'center', valign: 'middle',
  });

  slide.addText(String(caption), {
    x: M + 1, y: y + 2.7, w: CONTENT_W - 2, h: 1.0,
    fontFace: theme.fontBody, fontSize: 18,
    color: theme.fg, align: 'center', valign: 'top', lineSpacingMultiple: 1.1,
  });
}

// ---- quote -----------------------------------------------------------------

function quote(slide, spec, theme) {
  const q = require_(spec, 'quote', 'quote');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  // Big decorative quote mark in accent.
  slide.addText('“', {
    x: M, y: 0.4, w: 2, h: 1.6,
    fontFace: theme.fontHead, fontSize: 120, bold: true,
    color: theme.accent, align: 'left', valign: 'top',
  });

  slide.addText(String(q), {
    x: M + 0.2, y: 1.7, w: CONTENT_W - 0.4, h: 2.6,
    fontFace: theme.fontHead, fontSize: 30, italic: true,
    color: theme.fg, align: 'left', valign: 'middle', lineSpacingMultiple: 1.15,
  });

  if (spec.attribution) {
    slide.addText(`— ${spec.attribution}`, {
      x: M + 0.2, y: 4.5, w: CONTENT_W - 0.4, h: 0.5,
      fontFace: theme.fontBody, fontSize: 16, bold: true,
      color: theme.muted, align: 'left', valign: 'top',
    });
  }
}

// ---- imageText -------------------------------------------------------------

function imageText(slide, spec, theme) {
  const t = require_(spec, 'title', 'imageText');
  const body = require_(spec, 'body', 'imageText');
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);

  const imgX = M;
  const imgY = M;
  const imgW = 4.3;
  const imgH = PAGE_H - 2 * M;

  const path = spec.image;
  const exists = path && fs.existsSync(path);
  if (exists) {
    slide.addImage({ path, x: imgX, y: imgY, w: imgW, h: imgH, sizing: { type: 'cover', w: imgW, h: imgH } });
  } else {
    // Tasteful placeholder rectangle — never crash on a missing image.
    slide.addShape('rect', {
      x: imgX, y: imgY, w: imgW, h: imgH,
      fill: { color: theme.secondary },
      line: { color: theme.muted, width: 1 },
    });
    slide.addText('IMAGE', {
      x: imgX, y: imgY, w: imgW, h: imgH,
      fontFace: theme.fontBody, fontSize: 16, bold: true,
      color: theme.muted, align: 'center', valign: 'middle', charSpacing: 4,
    });
  }

  const txtX = imgX + imgW + 0.6;
  const txtW = PAGE_W - txtX - M;

  slide.addText(String(t), {
    x: txtX, y: M + 0.3, w: txtW, h: 1.0,
    fontFace: theme.fontHead, fontSize: 28, bold: true,
    color: theme.fg, align: 'left', valign: 'top', lineSpacingMultiple: 1.05,
  });

  slide.addText(String(body), {
    x: txtX, y: M + 1.5, w: txtW, h: PAGE_H - (M + 1.5) - M,
    fontFace: theme.fontBody, fontSize: 16,
    color: theme.muted, align: 'left', valign: 'top', lineSpacingMultiple: 1.2,
  });
}

// ---- statGrid --------------------------------------------------------------
// fields: title?, stats: [{ value, label, caption? }] (2-4)

function statGrid(slide, spec, theme) {
  const stats = require_(spec, 'stats', 'statGrid');
  if (!Array.isArray(stats) || stats.length < 2 || stats.length > 4) {
    throw new Error('Layout "statGrid" requires a "stats" array of 2 to 4 items.');
  }
  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);
  const bodyY = contentTitle(slide, spec, theme);

  const n = stats.length;
  const gap = 0.4;
  const cellW = (CONTENT_W - gap * (n - 1)) / n;
  const zoneH = PAGE_H - bodyY - M;
  // Vertically center the value+label block in the remaining zone.
  const blockH = 2.4;
  const top = bodyY + Math.max(0, (zoneH - blockH) / 2);

  stats.forEach((st, i) => {
    const x = M + i * (cellW + gap);
    const numColor = i % 2 === 0 ? theme.primary : theme.accent;

    slide.addText(String(st.value ?? ''), {
      x, y: top, w: cellW, h: 1.3,
      fontFace: theme.fontHead, fontSize: 54, bold: true,
      color: numColor, align: 'center', valign: 'middle',
      wrap: false, // keep the value on one line; never split "61%" into "61"/"%"
    });

    slide.addText(String(st.label ?? ''), {
      x, y: top + 1.3, w: cellW, h: 0.6,
      fontFace: theme.fontBody, fontSize: 15, bold: true,
      color: theme.fg, align: 'center', valign: 'top', lineSpacingMultiple: 1.05,
    });

    if (st.caption) {
      slide.addText(String(st.caption), {
        x, y: top + 1.9, w: cellW, h: 0.6,
        fontFace: theme.fontBody, fontSize: 11,
        color: theme.muted, align: 'center', valign: 'top', lineSpacingMultiple: 1.05,
      });
    }
  });
}

// ---- iconList --------------------------------------------------------------
// fields: title?, items: [{ icon, heading, body? }] (2-5)

async function iconList(slide, spec, theme) {
  const items = require_(spec, 'items', 'iconList');
  if (!Array.isArray(items) || items.length < 2 || items.length > 5) {
    throw new Error('Layout "iconList" requires an "items" array of 2 to 5 items.');
  }
  items.forEach((it, i) => {
    if (!it || !it.icon) throw new Error(`iconList item ${i + 1} is missing "icon".`);
    if (!it.heading) throw new Error(`iconList item ${i + 1} is missing "heading".`);
  });

  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);
  const bodyY = contentTitle(slide, spec, theme);

  const n = items.length;
  const zoneH = PAGE_H - bodyY - M;
  const rowH = zoneH / n;
  const circleD = Math.min(0.9, rowH - 0.15);
  const iconD = circleD * 0.55;
  const textX = M + circleD + 0.35;
  const textW = PAGE_W - textX - M;

  for (let i = 0; i < n; i++) {
    const it = items[i];
    const rowY = bodyY + i * rowH;
    const circleColor = i % 2 === 0 ? theme.primary : theme.accent;
    const cy = rowY + (rowH - circleD) / 2;

    // Filled colored circle.
    slide.addShape('ellipse', {
      x: M, y: cy, w: circleD, h: circleD,
      fill: { color: circleColor },
      line: { type: 'none' },
    });

    // Icon recolored to the slide bg so it reads on the filled circle.
    const iconPng = await renderIcon(it.icon, theme.bg, 256);
    slide.addImage({
      path: iconPng,
      x: M + (circleD - iconD) / 2,
      y: cy + (circleD - iconD) / 2,
      w: iconD, h: iconD,
    });

    const hasBody = !!it.body;
    const headH = hasBody ? 0.42 : rowH;
    slide.addText(String(it.heading), {
      x: textX, y: rowY + (hasBody ? (rowH - 0.42 - 0.5) / 2 : 0),
      w: textW, h: headH,
      fontFace: theme.fontHead, fontSize: 18, bold: true,
      color: theme.fg, align: 'left', valign: hasBody ? 'bottom' : 'middle',
    });
    if (hasBody) {
      slide.addText(String(it.body), {
        x: textX, y: rowY + (rowH - 0.42 - 0.5) / 2 + 0.42, w: textW, h: 0.5,
        fontFace: theme.fontBody, fontSize: 13,
        color: theme.muted, align: 'left', valign: 'top', lineSpacingMultiple: 1.05,
      });
    }
  }
}

// ---- process ---------------------------------------------------------------
// fields: title?, steps: [{ label, detail? }] (3-5)

function process(slide, spec, theme) {
  const steps = require_(spec, 'steps', 'process');
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 5) {
    throw new Error('Layout "process" requires a "steps" array of 3 to 5 items.');
  }
  steps.forEach((s, i) => {
    if (!s || !s.label) throw new Error(`process step ${i + 1} is missing "label".`);
  });

  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);
  const bodyY = contentTitle(slide, spec, theme);

  const n = steps.length;
  const gap = 0.3;
  const cellW = (CONTENT_W - gap * (n - 1)) / n;
  const chipD = 0.7;
  const zoneH = PAGE_H - bodyY - M;
  const chipY = bodyY + Math.max(0.1, (zoneH - 2.0) / 2);

  for (let i = 0; i < n; i++) {
    const x = M + i * (cellW + gap);
    const chipColor = i % 2 === 0 ? theme.primary : theme.accent;
    const chipX = x + (cellW - chipD) / 2;

    // Connector to the next step (subtle line between chips, NOT under a title).
    if (i < n - 1) {
      const lineY = chipY + chipD / 2;
      slide.addShape('line', {
        x: chipX + chipD, y: lineY,
        w: cellW + gap - chipD, h: 0,
        line: { color: theme.muted, width: 1, dashType: 'dash' },
      });
    }

    // Numbered chip.
    slide.addShape('ellipse', {
      x: chipX, y: chipY, w: chipD, h: chipD,
      fill: { color: chipColor },
      line: { type: 'none' },
    });
    slide.addText(String(i + 1), {
      x: chipX, y: chipY, w: chipD, h: chipD,
      fontFace: theme.fontHead, fontSize: 26, bold: true,
      color: theme.bg, align: 'center', valign: 'middle',
    });

    // Label beneath the chip.
    slide.addText(String(steps[i].label), {
      x, y: chipY + chipD + 0.15, w: cellW, h: 0.6,
      fontFace: theme.fontBody, fontSize: 14, bold: true,
      color: theme.fg, align: 'center', valign: 'top', lineSpacingMultiple: 1.0,
    });

    if (steps[i].detail) {
      slide.addText(String(steps[i].detail), {
        x, y: chipY + chipD + 0.7, w: cellW, h: 0.8,
        fontFace: theme.fontBody, fontSize: 11,
        color: theme.muted, align: 'center', valign: 'top', lineSpacingMultiple: 1.05,
      });
    }
  }
}

// ---- cards -----------------------------------------------------------------
// fields: title?, cards: [{ heading, body }] (2-3)

function cards(slide, spec, theme) {
  const cardList = require_(spec, 'cards', 'cards');
  if (!Array.isArray(cardList) || cardList.length < 2 || cardList.length > 3) {
    throw new Error('Layout "cards" requires a "cards" array of 2 to 3 items.');
  }
  cardList.forEach((c, i) => {
    if (!c || !c.heading) throw new Error(`cards item ${i + 1} is missing "heading".`);
    if (!c.body) throw new Error(`cards item ${i + 1} is missing "body".`);
  });

  paintBg(slide, slideBg(spec, theme));
  applyMotif(slide, theme);
  const bodyY = contentTitle(slide, spec, theme);

  const n = cardList.length;
  const gap = 0.4;
  const cardW = (CONTENT_W - gap * (n - 1)) / n;
  const cardY = bodyY;
  const cardH = PAGE_H - bodyY - M;
  const pad = 0.3;

  for (let i = 0; i < n; i++) {
    const x = M + i * (cardW + gap);

    slide.addShape('roundRect', {
      x, y: cardY, w: cardW, h: cardH,
      rectRadius: 0.12,
      fill: { color: theme.secondary },
      line: { type: 'none' },
    });

    // Accent tab at the top of each card.
    slide.addShape('rect', {
      x: x + pad, y: cardY + pad, w: 0.5, h: 0.08,
      fill: { color: i % 2 === 0 ? theme.primary : theme.accent },
      line: { type: 'none' },
    });

    slide.addText(String(cardList[i].heading), {
      x: x + pad, y: cardY + pad + 0.25, w: cardW - 2 * pad, h: 0.7,
      fontFace: theme.fontHead, fontSize: 19, bold: true,
      color: theme.fg, align: 'left', valign: 'top', lineSpacingMultiple: 1.05,
    });

    slide.addText(String(cardList[i].body), {
      x: x + pad, y: cardY + pad + 1.05, w: cardW - 2 * pad, h: cardH - pad - 1.05 - pad,
      fontFace: theme.fontBody, fontSize: 13,
      color: theme.muted, align: 'left', valign: 'top', lineSpacingMultiple: 1.2,
    });
  }
}

// ---- registry --------------------------------------------------------------

export const LAYOUTS = {
  title,
  section,
  bullets,
  twoColumn,
  bigNumber,
  quote,
  imageText,
  statGrid,
  iconList,
  process,
  cards,
};
