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
  echo "Cloudflare KV namespace oluşturuluyor..."
  OUT="$(npx wrangler kv namespace create AUTH_KV 2>&1 | tee /dev/stderr)"
  KV_ID="$(printf '%s\n' "$OUT" | sed -n 's/.*id = "\([^"]*\)".*/\1/p' | tail -n1)"

  if [[ -z "$KV_ID" ]]; then
    echo
    echo "KV ID otomatik alınamadı."
    echo "Şunu çalıştırıp çıkan id'yi wrangler.template.toml içine koy:"
    echo "  npx wrangler kv namespace create AUTH_KV"
    exit 1
  fi

  sed "s/REPLACE_WITH_KV_NAMESPACE_ID/$KV_ID/"     wrangler.template.toml > wrangler.toml
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
