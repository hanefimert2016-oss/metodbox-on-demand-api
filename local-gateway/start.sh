#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"

if [[ ! -f "$HOME/.config/metodbox-proxy/api_key" ]]; then
  echo "API key bulunamadı: ~/.config/metodbox-proxy/api_key" >&2
  exit 1
fi

CFG="$HOME/.config/metodbox-on-demand-api"
for f in github_app_id github_installation_id github_app_private_key.pem; do
  if [[ ! -s "$CFG/$f" ]]; then
    echo "Eksik ayar: $CFG/$f" >&2
    echo "Önce: ./configure.sh" >&2
    exit 1
  fi
done

if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --quiet --upgrade pip
"$VENV/bin/python" -m pip install --quiet -r "$HERE/requirements.txt"

HOST="${METODBOX_LISTEN_HOST:-127.0.0.1}"
PORT="${METODBOX_LISTEN_PORT:-8787}"

echo
echo "Metodbox Local API açılıyor:"
echo "  http://$HOST:$PORT/v1"
echo
echo "Kapatmak için Ctrl+C"
echo

exec "$VENV/bin/uvicorn" server:app   --app-dir "$HERE"   --host "$HOST"   --port "$PORT"
