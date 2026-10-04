#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [[ ! -s "$HOME/.config/metodbox-proxy/api_key" ]]; then
  echo "Eksik: ~/.config/metodbox-proxy/api_key" >&2
  exit 1
fi

if [[ ! -s "$HOME/.config/metodbox-proxy/metodbox_token" ]]; then
  echo "Eksik: ~/.config/metodbox-proxy/metodbox_token" >&2
  exit 1
fi

npm install

if [[ ! -f wrangler.toml ]]; then
  echo "Cloudflare KV namespace aranıyor..."

  # Önce mevcut AUTH_KV namespace'i yeniden kullan. Böylece script yarıda
  # kesildikten sonra tekrar çalıştırıldığında ikinci bir namespace oluşturmaz.
  LIST_OUT="$(npx wrangler kv namespace list 2>/dev/null || true)"
  KV_ID="$(
    printf '%s\n' "$LIST_OUT" | python3 -c '
import json, sys
text = sys.stdin.read().strip()
try:
    data = json.loads(text)
except Exception:
    data = []
for item in data:
    if item.get("title") == "AUTH_KV":
        print(item.get("id", ""))
        break
'
  )"

  if [[ -n "$KV_ID" ]]; then
    echo "Mevcut AUTH_KV bulundu: $KV_ID"
  else
    echo "AUTH_KV bulunamadı; oluşturuluyor..."
    OUT="$(npx wrangler kv namespace create AUTH_KV 2>&1 | tee /dev/stderr)"

    # Wrangler v4 JSON snippet çıktısını ve eski TOML snippet çıktısını destekle.
    KV_ID="$(
      printf '%s\n' "$OUT" | python3 -c '
import re, sys
text = sys.stdin.read()
patterns = [
    r"\"id\"\s*:\s*\"([0-9a-fA-F]+)\"",
    r"id\s*=\s*\"([0-9a-fA-F]+)\"",
]
for p in patterns:
    m = re.search(p, text)
    if m:
        print(m.group(1))
        break
'
    )"
  fi

  if [[ -z "$KV_ID" ]]; then
    echo
    echo "KV ID otomatik alınamadı."
    echo "Kontrol için:"
    echo "  npx wrangler kv namespace list"
    exit 1
  fi

  sed "s/REPLACE_WITH_KV_NAMESPACE_ID/$KV_ID/" \
    wrangler.template.toml > wrangler.toml
fi

echo "API_KEY secret yükleniyor..."
npx wrangler secret put API_KEY < "$HOME/.config/metodbox-proxy/api_key"

echo "METODBOX_TOKEN secret yükleniyor..."
npx wrangler secret put METODBOX_TOKEN < "$HOME/.config/metodbox-proxy/metodbox_token"

echo "Deploy ediliyor..."
npx wrangler deploy

echo
echo "Bitti."
echo "Worker URL yukarıda göründü."
echo "Cline Base URL: https://<worker-adresi>/v1"
