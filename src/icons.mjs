// icons.mjs — recolor a Lucide line icon and rasterize it to a cached PNG.
//
// Source: `lucide-static` ships canonical SVGs in node_modules/lucide-static/icons
// (kebab-case names, e.g. "trending-up.svg"). Each SVG strokes with
// `stroke="currentColor"`, so recoloring = swapping currentColor for a bare hex.
// We rasterize with `sharp` and cache the result so repeat renders are free.
//
// Contract used by layouts:  import { renderIcon } from './icons.mjs'
//   const png = await renderIcon('zap', 'F2C14E', 256) // -> absolute PNG path

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { sanitizeHex } from './theme.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Locate lucide-static's raw icon dir robustly (works regardless of cwd).
const LUCIDE_ICON_DIR = path.join(
  path.dirname(require.resolve('lucide-static/package.json')),
  'icons'
);

// Cache dir lives under out/ (already gitignored).
const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(REPO_ROOT, 'out', '.icons');

/**
 * Normalize an icon name to lucide's kebab-case file convention.
 * Accepts "TrendingUp", "trendingUp", "trending_up", "trending up" → "trending-up".
 */
function normalizeName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Icon name must be a non-empty string.');
  }
  return name
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function iconPathFor(name) {
  return path.join(LUCIDE_ICON_DIR, `${name}.svg`);
}

function notFound(name) {
  return new Error(
    `Lucide icon "${name}" not found. Names are kebab-case from the Lucide set ` +
      `(e.g. "trending-up", "shield-check", "zap"). Browse them at ` +
      `https://lucide.dev/icons or list node_modules/lucide-static/icons/*.svg.`
  );
}

/**
 * Recolor a Lucide SVG to a bare hex stroke color.
 * Replaces every `currentColor` (stroke and any fill that uses it). Leaves
 * `fill="none"` alone so the icons stay line-style, not filled blobs.
 */
function recolorSvg(svg, hex) {
  return svg.replace(/currentColor/g, `#${hex}`);
}

/**
 * Render a Lucide icon recolored to `hexNoHash`, rasterized to a square PNG.
 * Returns an absolute path to the cached PNG. Idempotent: re-renders are skipped
 * when the cache file already exists.
 *
 * @param {string} name      Lucide icon name (kebab/camel/snake accepted).
 * @param {string} hexNoHash 6-char hex WITHOUT '#'. Used as the stroke color.
 * @param {number} [sizePx]  Output square size in px (default 256).
 * @returns {Promise<string>} Absolute path to the PNG.
 */
export async function renderIcon(name, hexNoHash, sizePx = 256) {
  const kebab = normalizeName(name);
  const hex = sanitizeHex(hexNoHash, 'icon color');
  const size = Math.max(1, Math.round(Number(sizePx) || 256));

  const svgPath = iconPathFor(kebab);
  if (!fs.existsSync(svgPath)) throw notFound(kebab);

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const outPath = path.join(CACHE_DIR, `${kebab}-${hex}-${size}.png`);
  if (fs.existsSync(outPath)) return outPath;

  const rawSvg = fs.readFileSync(svgPath, 'utf8');
  const colored = recolorSvg(rawSvg, hex);

  await sharp(Buffer.from(colored), { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);

  return outPath;
}

// ---- tiny CLI for manual testing -------------------------------------------
// Usage: node src/icons.mjs <name> <hexNoHash> <out.png>
async function cli() {
  const [, , name, hex, out] = process.argv;
  if (!name || !hex || !out) {
    console.error('Usage: node src/icons.mjs <name> <hexNoHash> <out.png>');
    process.exit(1);
  }
  try {
    const cached = await renderIcon(name, hex);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.copyFileSync(cached, out);
    console.log(`Wrote ${path.resolve(out)} (cached at ${cached}).`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) {
  cli();
}
