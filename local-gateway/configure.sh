#!/usr/bin/env bash
set -euo pipefail

CFG="$HOME/.config/metodbox-on-demand-api"
mkdir -p "$CFG"
chmod 700 "$CFG"

read -r -p "GitHub App ID: " APP_ID
read -r -p "GitHub Installation ID: " INSTALL_ID
read -r -p "GitHub App private key .pem yolu: " KEY_PATH

KEY_PATH="${KEY_PATH/#\~/$HOME}"

if [[ ! -s "$KEY_PATH" ]]; then
  echo "Private key bulunamadı: $KEY_PATH" >&2
  exit 1
fi

printf '%s\n' "$APP_ID" > "$CFG/github_app_id"
printf '%s\n' "$INSTALL_ID" > "$CFG/github_installation_id"
cp "$KEY_PATH" "$CFG/github_app_private_key.pem"

chmod 600   "$CFG/github_app_id"   "$CFG/github_installation_id"   "$CFG/github_app_private_key.pem"

echo
echo "Ayarlar kaydedildi:"
echo "  $CFG"
echo "Secret değerleri ekrana yazdırılmadı."
