#!/usr/bin/env node
// generate.mjs — CLI entry + dispatch.
// Usage: node src/generate.mjs <spec.json> <out.pptx>
//
// Thin & deterministic: reads a deck spec JSON, validates minimally, dispatches
// each slide to its layout renderer, writes a native editable .pptx.

import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import { resolveTheme } from './theme.mjs';
import { LAYOUTS } from './layouts.mjs';

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// Minimal required-field checks per layout. Renderers also guard, but checking
// up front yields clean Error: messages before we touch the lib.
function validateSlide(s, i) {
  const n = i + 1;
  const need = (field) => {
    const v = s[field];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      fail(`Slide ${n} (layout "${s.layout}") is missing required field "${field}".`);
    }
  };
  const needArrayRange = (field, min, max) => {
    const v = s[field];
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      fail(`Slide ${n} (layout "${s.layout}") requires "${field}" to be an array of ${min} to ${max} items.`);
    }
    return v;
  };
  const needItemFields = (field, arr, fields) => {
    arr.forEach((item, k) => {
      if (!item || typeof item !== 'object') {
        fail(`Slide ${n} (layout "${s.layout}") "${field}[${k}]" must be an object.`);
      }
      fields.forEach((f) => {
        const v = item[f];
        if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
          fail(`Slide ${n} (layout "${s.layout}") "${field}[${k}]" is missing required field "${f}".`);
        }
      });
    });
  };

  switch (s.layout) {
    case 'title':
    case 'section':
      need('title');
      break;
    case 'bullets':
      need('title');
      if (!Array.isArray(s.bullets) || s.bullets.length === 0) {
        fail(`Slide ${n} (layout "bullets") requires a non-empty "bullets" array.`);
      }
      break;
    case 'twoColumn':
      need('title'); need('left'); need('right');
      break;
    case 'bigNumber':
      need('stat'); need('caption');
      break;
    case 'quote':
      need('quote');
      break;
    case 'imageText':
      need('title'); need('body');
      break;
    case 'statGrid':
      needItemFields('stats', needArrayRange('stats', 2, 4), ['value', 'label']);
      break;
    case 'iconList':
      needItemFields('items', needArrayRange('items', 2, 5), ['icon', 'heading']);
      break;
    case 'process':
      needItemFields('steps', needArrayRange('steps', 3, 5), ['label']);
      break;
    case 'cards':
      needItemFields('cards', needArrayRange('cards', 2, 3), ['heading', 'body']);
      break;
    default:
      break;
  }
}

async function main() {
  const [, , specPath, outPath] = process.argv;
  if (!specPath || !outPath) {
    fail('Usage: node src/generate.mjs <spec.json> <out.pptx>');
  }

  if (!fs.existsSync(specPath)) fail(`Spec file not found: ${specPath}`);

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (e) {
    fail(`Could not parse spec JSON: ${e.message}`);
  }

  if (!spec || typeof spec !== 'object') fail('Spec must be a JSON object.');
  if (!Array.isArray(spec.slides) || spec.slides.length === 0) {
    fail('Spec must contain a non-empty "slides" array.');
  }

  // Validate layouts up front so we fail loudly before touching the lib.
  spec.slides.forEach((s, i) => {
    if (!s || typeof s !== 'object') fail(`Slide ${i + 1} is not an object.`);
    if (!s.layout) fail(`Slide ${i + 1} is missing required "layout" field.`);
    if (!LAYOUTS[s.layout]) {
      fail(
        `Slide ${i + 1} has unknown layout "${s.layout}". ` +
          `Valid layouts: ${Object.keys(LAYOUTS).join(', ')}.`
      );
    }
    validateSlide(s, i);
  });

  let theme;
  try {
    theme = resolveTheme(spec.theme); // sanitizes hex, throws on bad input
  } catch (e) {
    fail(e.message);
  }

  const pptx = new pptxgen();
  const meta = spec.meta || {};
  pptx.layout = meta.layout === '16x9' || !meta.layout ? 'LAYOUT_16x9' : 'LAYOUT_16x9';
  if (meta.title) pptx.title = String(meta.title);
  if (meta.author) pptx.author = String(meta.author);

  // Render sequentially. Some layouts (e.g. iconList) are async (icon raster).
  for (let i = 0; i < spec.slides.length; i++) {
    const s = spec.slides[i];
    const slide = pptx.addSlide();
    try {
      await LAYOUTS[s.layout](slide, s, theme);
    } catch (e) {
      fail(`Slide ${i + 1} (layout "${s.layout}"): ${e.message}`);
    }
  }

  // Ensure output directory exists.
  const outDir = path.dirname(path.resolve(outPath));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  try {
    const name = await pptx.writeFile({ fileName: outPath });
    console.log(`Wrote ${name} (${spec.slides.length} slides).`);
  } catch (e) {
    fail(`Failed to write pptx: ${e.message}`);
  }
}

main();
