#!/usr/bin/env bash
# Assemble the Cloudflare bundle for sterlingai.net from the GitHub Pages site in this repo.
# Output: cloudflare/dist = every site file on the branch (index.html, terminal.html, treasury/,
# discord/, favicon.svg, og-image.png, and whatever is added later), minus repo plumbing. The source
# stays exactly as GitHub Pages serves it; only absolute self-references to the parked
# sterlingai.xyz are rewritten to sterlingai.net.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"; OUT="$HERE/dist"
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a --exclude '.git' --exclude '.github' --exclude '.gitignore' --exclude '.playwright-mcp' \
  --exclude 'cloudflare' --exclude 'CNAME' --exclude '*.md' --exclude '.DS_Store' "$ROOT/" "$OUT/"
find "$OUT" -name '*.html' -exec perl -pi -e 's#https://sterlingai\.xyz#https://sterlingai.net#g' {} +
grep -rq 'sterlingai\.xyz' "$OUT" && { echo "ERROR: sterlingai.xyz still referenced"; exit 1; }
for f in index.html treasury/index.html favicon.svg; do [ -f "$OUT/$f" ] || { echo "ERROR: $f missing from bundle"; exit 1; }; done
echo "Built $OUT:"; (cd "$OUT" && find . -type f | sort | while read -r f; do printf '  %8s  %s\n' "$(wc -c < "$f" | tr -d ' ')" "$f"; done)
