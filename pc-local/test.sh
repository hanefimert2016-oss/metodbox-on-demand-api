#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-gpt-5.1}"
KEY="$(cat "$HOME/.config/metodbox-proxy/api_key")"

curl -sS \
  http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Sadece MERHABA yaz\"}
    ]
  }"

echo
