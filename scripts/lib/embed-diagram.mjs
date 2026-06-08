// embed-diagram.mjs -- frame a rendered diagram image into a slide.
//
// Places a diagram PNG into a slide region per the Dev-Doc Light "framed, not
// full-bleed" rule: a flat rounded white panel + ~1px purple border, with the
// image fit (contain) inside a small padding. The frame is sized snugly to the
// fitted image (no empty panel) and centered within the given region. Reads the
// image aspect via sharp so callers pass only a target region.
//
// addFramedDiagram(pptx, slide, imgAbsPath, region, opts) -> the frame rect
//   pptx        : the PptxGenJS instance (for ShapeType)
//   slide       : the slide to add to
//   imgAbsPath  : absolute path to the diagram PNG
//   region      : { x, y, w, h } in inches -- where the framed diagram may go
//   opts        : { border='7C6A93', pad=0.12, radius=0.06, bg='FFFFFF',
//                   align='center'|'top' }  (vertical placement within region)

import sharp from 'sharp';

export async function addFramedDiagram(pptx, slide, imgAbsPath, region, opts = {}) {
  const { x, y, w, h } = region;
  const { border = '7C6A93', pad = 0.12, radius = 0.06, bg = 'FFFFFF', align = 'center' } = opts;

  const meta = await sharp(imgAbsPath).metadata();
  const aspect = meta.width / meta.height;

  const availW = w - 2 * pad, availH = h - 2 * pad;
  let iw = availW, ih = iw / aspect;
  if (ih > availH) { ih = availH; iw = ih * aspect; }

  const fw = iw + 2 * pad, fh = ih + 2 * pad;
  const fx = x + (w - fw) / 2;
  const fy = align === 'top' ? y : y + (h - fh) / 2;

  slide.addShape(pptx.ShapeType.roundRect, {
    x: fx, y: fy, w: fw, h: fh, rectRadius: radius,
    fill: { color: bg }, line: { color: border, width: 1 },
  });
  slide.addImage({
    path: imgAbsPath, x: fx + pad, y: fy + pad, w: iw, h: ih,
    sizing: { type: 'contain', w: iw, h: ih },
  });
  return { x: fx, y: fy, w: fw, h: fh };
}
