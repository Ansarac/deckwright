// diagram-slide.mjs -- compose a diagram WITH its distilled key points.
//
// The Dev-Doc rule: a diagram is evidence for a claim, so it never fills a slide
// alone -- it is paired with the 2-3 points it supports (and optionally a
// one-line takeaway). Layout adapts to the diagram's aspect ratio:
//   - portrait / square (aspect <= wideThreshold): TEXT left | DIAGRAM right
//   - wide (aspect >  wideThreshold):              TEXT (heading + points) on top / DIAGRAM below
// Text is top-anchored (minimalist rhythm). The framed diagram uses
// addFramedDiagram (flat rounded panel + thin purple border).
//
// addDiagramWithPoints(pptx, slide, {
//   imgPath, heading, points, takeaway, region, colors, wideThreshold
// })
//   points : array of { label, text } (label -> steel sub-heading) or strings
//   region : { x, y, w, h } body area below the page title (default below title)

import sharp from 'sharp';
import { addFramedDiagram } from './embed-diagram.mjs';

const DEF = {
  fg: '141414', steel: '3A75A0', teal: '367883', muted: '6B6B6B',
  title: 'Poppins', body: 'Poppins',
};

const pointRuns = (pt, C, breakAfterLabel) =>
  typeof pt === 'string'
    ? [{ text: pt, options: {} }]
    : [{ text: pt.label, options: { bold: true, color: C.steel, breakLine: !!breakAfterLabel } },
       { text: (breakAfterLabel ? '' : '  ') + pt.text, options: {} }];

export async function addDiagramWithPoints(pptx, slide, opts) {
  const {
    imgPath, heading, points = [], takeaway,
    region = { x: 0.8, y: 1.5, w: 11.7, h: 5.4 },
    colors = {}, wideThreshold = 1.8,
  } = opts;
  const C = { ...DEF, ...colors };

  const meta = await sharp(imgPath).metadata();
  const aspect = meta.width / meta.height;

  if (aspect <= wideThreshold) {
    // ---- side-by-side: text left | diagram right --------------------------
    const textW = 4.4, gap = 0.35;
    const diag = { x: region.x + textW + gap, y: region.y, w: region.w - textW - gap, h: region.h };

    let y = region.y + 0.1;
    if (heading) {
      slide.addText(heading, { x: region.x, y, w: textW, h: 0.5, fontFace: C.title, fontSize: 18, bold: true, color: C.steel });
      y += 0.7;
    }
    for (const pt of points) {
      slide.addText(pointRuns(pt, C, false), {
        x: region.x, y, w: textW, h: 0.9, fontFace: C.body, fontSize: 14, color: C.fg,
        lineSpacingMultiple: 1.3, valign: 'top', bullet: { code: '2022', indent: 14 },
      });
      y += 1.0;
    }
    if (takeaway) {
      slide.addText(takeaway, { x: region.x, y: region.y + region.h - 0.7, w: textW, h: 0.6, fontFace: C.body, fontSize: 14, italic: true, color: C.teal });
    }
    await addFramedDiagram(pptx, slide, imgPath, diag);
  } else {
    // ---- stacked: text (heading + points row) on top / diagram below ------
    const gap = 0.35;
    let y = region.y;
    if (heading) {
      slide.addText(heading, { x: region.x, y, w: region.w, h: 0.45, fontFace: C.title, fontSize: 18, bold: true, color: C.steel });
      y += 0.6;
    }
    const pointsRowH = 1.1, n = Math.max(points.length, 1), colGap = 0.4;
    const colW = (region.w - (n - 1) * colGap) / n;
    points.forEach((pt, i) => {
      slide.addText(pointRuns(pt, C, true), {
        x: region.x + i * (colW + colGap), y, w: colW, h: pointsRowH,
        fontFace: C.body, fontSize: 13, color: C.fg, lineSpacingMultiple: 1.2, valign: 'top',
      });
    });
    y += pointsRowH + gap;
    await addFramedDiagram(pptx, slide, imgPath, { x: region.x, y, w: region.w, h: region.y + region.h - y });
  }
}
