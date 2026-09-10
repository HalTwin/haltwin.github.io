#!/usr/bin/env bash
# Assemble the Cloudflare bundle for sterlingai.net from the GitHub Pages site in this repo.
# Output: cloudflare/dist (7 static files). The site source stays exactly as GitHub Pages serves it;
# only absolute self-references are rewritten from the parked sterlingai.xyz to sterlingai.net.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"; OUT="$HERE/dist"
rm -rf "$OUT"; mkdir -p "$OUT/discord"
for f in index.html terminal.html favicon.svg og-image.png discord/index.html; do
  [ -f "$ROOT/$f" ] || { echo "ERROR: $f missing"; exit 1; }; cp "$ROOT/$f" "$OUT/$f"
done
find "$OUT" -name '*.html' -exec perl -pi -e 's#https://sterlingai\.xyz#https://sterlingai.net#g' {} +
grep -rq 'sterlingai\.xyz' "$OUT" && { echo "ERROR: sterlingai.xyz still referenced"; exit 1; }
echo "Built $OUT:"; (cd "$OUT" && find . -type f | sort | while read -r f; do printf '  %8s  %s\n' "$(wc -c < "$f" | tr -d ' ')" "$f"; done)
