#!/usr/bin/env bash
# Régénère l'aperçu social og-image.png (1200x630) à partir du calendrier actuel.
# Sert le dépôt en local (file:// ne peut pas charger le JSON) et capture un rendu
# propre via le mode ?og=1 (sans horloge ni poussière).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "[gen-og] Google Chrome introuvable — régénération ignorée (définissez \$CHROME)." >&2
  exit 0
fi

PORT="${OG_PORT:-8799}"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/og-srv.log 2>&1 &
SRV=$!
cleanup(){ kill "$SRV" 2>/dev/null || true; }
trap cleanup EXIT

# attendre que le serveur réponde
for _ in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$PORT/index.html" >/dev/null 2>&1 && break
  sleep 0.3
done

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1200,630 --virtual-time-budget=6000 \
  --screenshot=/tmp/og_raw.png "http://127.0.0.1:$PORT/index.html?og=1" >/dev/null 2>&1

if python3 - <<'PY' 2>/dev/null
from PIL import Image
Image.open("/tmp/og_raw.png").convert("RGB").resize((1200,630), Image.LANCZOS).save("og-image.png", optimize=True)
PY
then
  echo "[gen-og] og-image.png régénéré (1200x630)."
else
  cp /tmp/og_raw.png og-image.png
  echo "[gen-og] PIL absent — og-image.png = capture brute (2400x1260)."
fi
