#!/bin/bash
# Canonical Chapar frontend deploy.
#
# Written because deploys were ad-hoc: each one hand-edited film-preview.html, and the CSS
# hash was silently left pointing at a days-old file while the JS moved on. version.json was
# never updated at all, so the console banner reported a nine-day-old build during a live
# incident. This does the whole thing in one place, updates BOTH hashes, ships version.json,
# and verifies the result before declaring success.
#
# Usage: ./deploy.sh          (build + deploy)
#        ./deploy.sh --no-build   (deploy whatever is already in dist/)
set -euo pipefail

REPO=/root/figma-chapar
WWW=/var/www/html
PAGE="$WWW/film-preview.html"
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$REPO"

if [ "${1:-}" != "--no-build" ]; then
  echo "=== build ==="
  npm run build 2>&1 | tail -5
fi

JS=$(basename "$(ls -t dist/assets/index-*.js  | head -1)")
CSS=$(basename "$(ls -t dist/assets/index-*.css | head -1)")
[ -n "$JS" ] && [ -n "$CSS" ] || { echo "FATAL: could not resolve built asset names"; exit 1; }

# version.json is emitted by the vite versionStamp() plugin and must agree with the bundle we
# are about to ship. If it does not, the build output is inconsistent — stop rather than
# deploy a page that lies about which code is running.
VJS=$(node -e "process.stdout.write(require('$REPO/dist/version.json').bundle||'')")
if [ "$VJS" != "$JS" ]; then
  echo "FATAL: version.json says '$VJS' but built bundle is '$JS' — aborting"; exit 1
fi

echo "=== deploying $JS + $CSS ==="
cp "$PAGE" "$PAGE.bak.deploy-$STAMP"
cp "$WWW/version.json" "$WWW/version.json.bak.$STAMP" 2>/dev/null || true

cp dist/assets/"$JS"  "$WWW/assets/"
cp dist/assets/"$CSS" "$WWW/assets/"
cp dist/version.json  "$WWW/version.json"

# Repoint BOTH hashes. The CSS line is the one that used to be forgotten.
sed -i -E "s|assets/index-[A-Za-z0-9_-]+\.js|assets/$JS|g;  s|assets/index-[A-Za-z0-9_-]+\.css|assets/$CSS|g" "$PAGE"

echo "=== verify ==="
grep -o 'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)' "$PAGE" | sed 's/^/  page → /'
for f in "assets/$JS" "assets/$CSS" "version.json"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://chaparcargo.com/$f")
  echo "  $f: HTTP $code"
  [ "$code" = "200" ] || { echo "FATAL: $f not served"; exit 1; }
done
# byte-identical check: the file we built is the file being served
a=$(md5sum "dist/assets/$JS" | cut -d' ' -f1); b=$(md5sum "$WWW/assets/$JS" | cut -d' ' -f1)
[ "$a" = "$b" ] || { echo "FATAL: deployed bundle differs from build"; exit 1; }
echo "  md5 match: $a"
echo "=== deployed: $(node -e "const v=require('$WWW/version.json');process.stdout.write(v.version+' @ '+v.builtAt)") ==="
