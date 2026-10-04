#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"
STAMP="$VENV/.ready-v1"

for file in \
  "$HOME/.config/metodbox-proxy/api_key" \
  "$HOME/.config/metodbox-proxy/metodbox_token"
do
  if [[ ! -s "$file" ]]; then
    echo "Eksik dosya: $file" >&2
    exit 1
  fi
done

if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi

if [[ ! -f "$STAMP" ]]; then
  "$VENV/bin/python" -m pip install --upgrade pip
  "$VENV/bin/python" -m pip install -r "$HERE/requirements.txt"
  "$VENV/bin/python" -m playwright install chromium
  touch "$STAMP"
fi

echo
echo "Metodbox PC API"
echo "Base URL: http://127.0.0.1:8787/v1"
echo "Models:   gpt-5.1, gpt-oss:120b"
echo "Kapat:    Ctrl+C"
echo

exec "$VENV/bin/python" -m uvicorn server:app \
  --app-dir "$HERE" \
  --host 127.0.0.1 \
  --port 8787
