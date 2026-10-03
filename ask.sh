#!/usr/bin/env bash
set -euo pipefail

REPO="${METODBOX_API_REPO:-hanefimert2016-oss/metodbox-on-demand-api}"
API_KEY_FILE="${METODBOX_API_KEY_FILE:-$HOME/.config/metodbox-proxy/api_key}"

for cmd in gh python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Hata: $cmd kurulu değil." >&2
    exit 1
  fi
done

if [[ ! -s "$API_KEY_FILE" ]]; then
  echo "Hata: API key dosyası bulunamadı: $API_KEY_FILE" >&2
  exit 1
fi

QUESTION="${*:-}"
if [[ -z "$QUESTION" ]]; then
  read -r -p "Soru: " QUESTION
fi

REQUEST_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"
REQUEST_TS="$(date +%s)"
API_KEY="$(cat "$API_KEY_FILE")"

REQUEST_SIG="$(
  API_KEY="$API_KEY"   QUESTION="$QUESTION"   REQUEST_ID="$REQUEST_ID"   REQUEST_TS="$REQUEST_TS"   python3 - <<'PY'
import hashlib, hmac, os
msg = f"{os.environ['REQUEST_TS']}\n{os.environ['REQUEST_ID']}\n{os.environ['QUESTION']}".encode()
print(hmac.new(os.environ["API_KEY"].encode(), msg, hashlib.sha256).hexdigest())
PY
)"

unset API_KEY

echo "İstek: $REQUEST_ID" >&2

python3 - <<'PY' > /tmp/metodbox-dispatch.json
import json, os
print(json.dumps({
  "event_type": "metodbox_question",
  "client_payload": {
    "question": os.environ["QUESTION"],
    "request_id": os.environ["REQUEST_ID"],
    "ts": os.environ["REQUEST_TS"],
    "sig": os.environ["REQUEST_SIG"],
  }
}))
PY

gh api   --method POST   -H "Accept: application/vnd.github+json"   -H "X-GitHub-Api-Version: 2022-11-28"   "/repos/$REPO/dispatches"   --input /tmp/metodbox-dispatch.json   >/dev/null

rm -f /tmp/metodbox-dispatch.json

echo "GitHub Actions isteği kabul edildi." >&2
