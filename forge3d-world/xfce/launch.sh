#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f outputs/AEGIS_Outpost.glb ]]; then
  if [[ -x .venv/bin/python ]]; then .venv/bin/python generate.py; else python3 generate.py; fi
fi
if ! curl -fsS --max-time 2 http://127.0.0.1:8765/viewer/ >/dev/null 2>&1; then
  python3 -m http.server 8765 --bind 127.0.0.1 >/tmp/forge3d-http.log 2>&1 &
  sleep 1
fi
if command -v chromium >/dev/null; then chromium --new-window http://127.0.0.1:8765/viewer/ >/tmp/forge3d-browser.log 2>&1 &
else xdg-open http://127.0.0.1:8765/viewer/ & fi
