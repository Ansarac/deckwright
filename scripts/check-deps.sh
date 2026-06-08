#!/usr/bin/env bash
# deckwright dependency checker (macOS / Linux).
#
# POSIX-shell mirror of scripts/check-deps.ps1. Zero-dependency by design: it
# uses only the shell + coreutils and NEVER runs node/npm (those are exactly
# what it checks for). All extra checks are file-existence / fc-list only.
#
# Render backend on macOS/Linux is LibreOffice + Poppler (no PowerPoint COM).
#
# Usage:  bash scripts/check-deps.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"

if [ -t 1 ]; then
  G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; N=$'\033[0m'
else
  G=''; R=''; Y=''; N=''
fi

missing_required=0
fixes=""

ok_row()   { printf "  ${G}[OK]${N}      %-30s %s\n" "$1" "$2"; }
miss_row() { printf "  ${R}[MISSING]${N} %-30s %s\n" "$1" "$2"; missing_required=1; }
opt_row()  { if [ "$2" = "1" ]; then printf "  ${G}[OK]${N}      %-30s %s\n" "$1" "$3"
             else printf "  ${Y}[OPT]${N}     %-30s %s\n" "$1" "$3"; fi; }
add_fix()  { fixes="${fixes}"$'\n'"$1"; }

echo
echo "==== deckwright dependency check (macOS / Linux) ===="
echo

# ---- Git -------------------------------------------------------------------
if command -v git >/dev/null 2>&1; then ok_row "Git" "$(git --version)"
else miss_row "Git" "not found"; add_fix $'# Git\n  brew install git        # or: sudo apt install git'; fi

# ---- Node.js (>=18) --------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  nv="$(node --version)"; maj="$(printf '%s' "$nv" | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "${maj:-0}" -ge 18 ] 2>/dev/null; then ok_row "Node.js (>=18)" "$nv"
  else miss_row "Node.js (>=18)" "$nv (requires >= 18)"; add_fix $'# Node.js\n  brew install node       # or use nvm / NodeSource'; fi
else miss_row "Node.js (>=18)" "not found"; add_fix $'# Node.js\n  brew install node       # or use nvm / NodeSource'; fi

# ---- npm -------------------------------------------------------------------
if command -v npm >/dev/null 2>&1; then ok_row "npm" "$(npm --version)"
else miss_row "npm" "not found"; fi

# ---- Render backend: LibreOffice + Poppler ---------------------------------
soffice=""
for c in soffice libreoffice; do command -v "$c" >/dev/null 2>&1 && { soffice="$c"; break; }; done
[ -z "$soffice" ] && [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ] && soffice="/Applications/LibreOffice.app/Contents/MacOS/soffice"
pdftoppm=""; command -v pdftoppm >/dev/null 2>&1 && pdftoppm="yes"
if [ -n "$soffice" ] && [ -n "$pdftoppm" ]; then ok_row "Render backend (LO+Poppler)" "$soffice + pdftoppm"
else
  miss_row "Render backend (LO+Poppler)" "need LibreOffice + Poppler"
  add_fix $'# Render backend (LibreOffice + Poppler)\n  brew install --cask libreoffice && brew install poppler\n  # or: sudo apt install libreoffice poppler-utils'
fi

# ---- npm packages ----------------------------------------------------------
pkgs="pptxgenjs sharp lucide-static playwright mermaid roughjs"
miss=""
for p in $pkgs; do [ -d "$REPO/node_modules/$p" ] || miss="$miss $p"; done
if [ -d "$REPO/node_modules" ] && [ -z "$miss" ]; then ok_row "npm packages" "all present"
else miss_row "npm packages" "${miss:- node_modules not found}"; add_fix $'# npm packages\n  npm install'; fi

# ---- Playwright Chromium ---------------------------------------------------
pwc=""
for d in "$HOME/.cache/ms-playwright" "$HOME/Library/Caches/ms-playwright"; do [ -d "$d" ] && pwc="$d"; done
chromium=0
[ -n "$pwc" ] && ls -d "$pwc"/chromium* >/dev/null 2>&1 && chromium=1
if [ "$chromium" = 1 ]; then ok_row "Playwright Chromium" "installed"
else miss_row "Playwright Chromium" "not found"; add_fix $'# Playwright Chromium\n  npx playwright install chromium'; fi

# ---- Official pptx skill (plugin; declared, not vendored) ------------------
plug="$HOME/.claude/plugins/cache/anthropic-agent-skills/document-skills"
pj="$HOME/.claude/plugins/installed_plugins.json"
pptx=0
[ -d "$plug" ] && pptx=1
[ "$pptx" = 0 ] && [ -f "$pj" ] && grep -q "anthropic-agent-skills" "$pj" 2>/dev/null && pptx=1
if [ "$pptx" = 1 ]; then ok_row "Official pptx skill (plugin)" "document-skills installed"
else miss_row "Official pptx skill (plugin)" "not found"; add_fix $'# Official pptx skill\n  In Claude Code: /plugin install document-skills@anthropic-agent-skills'; fi

# ---- Workspace skills (shipped in this repo) -------------------------------
missk=""
for s in slide-designer theme-extractor diagram-maker; do
  [ -f "$REPO/.claude/skills/$s/SKILL.md" ] || missk="$missk $s"
done
if [ -z "$missk" ]; then ok_row "Workspace skills" "all present (slide-designer, theme-extractor, diagram-maker)"
else miss_row "Workspace skills" "missing:$missk"; add_fix $'# Workspace skills -- repo incomplete; re-clone'; fi

# ---- Fonts (optional) ------------------------------------------------------
pop=0; rob=0
if command -v fc-list >/dev/null 2>&1; then
  fc-list 2>/dev/null | grep -qi "poppins"     && pop=1
  fc-list 2>/dev/null | grep -qi "roboto mono" && rob=1
fi
fonts_ok=0; [ "$pop" = 1 ] && [ "$rob" = 1 ] && fonts_ok=1
opt_row "Fonts (Poppins+Roboto Mono)" "$fonts_ok" "Poppins: $([ $pop = 1 ] && echo yes || echo no); Roboto Mono: $([ $rob = 1 ] && echo yes || echo no)  (OFL/Apache-2.0, optional)"

# ---- Python (optional) -----------------------------------------------------
if command -v python3 >/dev/null 2>&1; then opt_row "Python (>=3.9, optional)" 1 "$(python3 --version 2>&1)"
else opt_row "Python (>=3.9, optional)" 0 "not found (optional)"; fi

# ---- Summary ---------------------------------------------------------------
echo
if [ "$missing_required" = 1 ]; then
  printf "${R}Missing required dependencies -- install guidance:${N}\n"
  printf '%s\n' "$fixes"
  echo
  echo "  After installing, reopen the shell and run this script again."
  exit 1
else
  printf "${G}All required dependencies are ready.${N}\n"
  exit 0
fi
