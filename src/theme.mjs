// theme.mjs — theme defaults + hex/color helpers.
// All colors are 6-char hex WITHOUT '#'. PptxGenJS corrupts files if '#' or
// 8-char hex is passed, so we sanitize loudly here.

export const DEFAULT_THEME = {
  bg: '0E1116',
  fg: 'FFFFFF',
  muted: 'A0A6B0',
  primary: '5B8DEF',
  secondary: '1F2A44',
  accent: 'F2C14E',
  fontHead: 'Georgia',
  fontBody: 'Calibri',
};

const HEX6 = /^[0-9a-fA-F]{6}$/;

/**
 * Normalize a color value to bare 6-char hex (no '#').
 * Strips a single leading '#'. Rejects empty, 3-char shorthand, 8-char (alpha),
 * and anything non-hex — bad input fails loudly instead of silently corrupting
 * the .pptx. Use the `transparency` option for alpha, never 8-char hex.
 */
export function sanitizeHex(value, where = 'color') {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${where}: expected a hex string, got ${typeof value}`);
  }
  let v = value.trim();
  if (v.startsWith('#')) v = v.slice(1);
  if (v.length === 8) {
    throw new Error(
      `Invalid ${where} "${value}": 8-char hex (with alpha) is not allowed. ` +
        `Use a 6-char hex and the transparency/opacity option for alpha.`
    );
  }
  if (!HEX6.test(v)) {
    throw new Error(`Invalid ${where} "${value}": must be 6-char hex without '#' (e.g. "5B8DEF").`);
  }
  return v.toUpperCase();
}

/**
 * Merge a user-supplied theme over the defaults and sanitize every color.
 * Fonts pass through as-is (with defaults).
 */
export function resolveTheme(theme = {}) {
  const merged = { ...DEFAULT_THEME, ...theme };
  const colorKeys = ['bg', 'fg', 'muted', 'primary', 'secondary', 'accent'];
  const out = { ...merged };
  for (const key of colorKeys) {
    out[key] = sanitizeHex(merged[key], `theme.${key}`);
  }
  out.fontHead = merged.fontHead || DEFAULT_THEME.fontHead;
  out.fontBody = merged.fontBody || DEFAULT_THEME.fontBody;
  return out;
}
