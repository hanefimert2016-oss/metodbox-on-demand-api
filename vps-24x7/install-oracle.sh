#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Bunu sudo ile çalıştır: sudo ./install-oracle.sh" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/metodbox-api"
CFG_DIR="/etc/metodbox-api"
STATE_DIR="/var/lib/metodbox-api"

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  read -r -p "HTTPS domain (ör. mertapi.duckdns.org): " DOMAIN
fi
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"

if [[ -z "$DOMAIN" ]]; then
  echo "Domain boş olamaz." >&2
  exit 1
fi

read -r -s -p "API_KEY: " API_KEY
echo
read -r -s -p "METODBOX_TOKEN: " METODBOX_TOKEN
echo

if [[ -z "$API_KEY" || -z "$METODBOX_TOKEN" ]]; then
  echo "API_KEY ve METODBOX_TOKEN boş olamaz." >&2
  exit 1
fi

echo "[1/8] Paketler kuruluyor..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y   ca-certificates curl gnupg debian-keyring debian-archive-keyring   apt-transport-https python3 python3-venv python3-pip rsync

if ! command -v caddy >/dev/null 2>&1; then
  echo "[2/8] Caddy kuruluyor..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key'     | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt'     > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
else
  echo "[2/8] Caddy zaten kurulu."
fi

if ! id -u metodbox-api >/dev/null 2>&1; then
  useradd --system --home "$STATE_DIR" --create-home     --shell /usr/sbin/nologin metodbox-api
fi

echo "[3/8] Uygulama dosyaları hazırlanıyor..."
mkdir -p "$APP_DIR" "$CFG_DIR" "$STATE_DIR"
rsync -a --delete "$ROOT_DIR/pc-local/" "$APP_DIR/"
rm -rf "$APP_DIR/.venv"
chown -R metodbox-api:metodbox-api "$APP_DIR" "$STATE_DIR"

echo "[4/8] Python ortamı ve Playwright kuruluyor..."
sudo -u metodbox-api python3 -m venv "$APP_DIR/.venv"
sudo -u metodbox-api "$APP_DIR/.venv/bin/python" -m pip install --upgrade pip
sudo -u metodbox-api "$APP_DIR/.venv/bin/python" -m pip install -r "$APP_DIR/requirements.txt"

export PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/pw-browsers"
"$APP_DIR/.venv/bin/python" -m playwright install-deps chromium
sudo -u metodbox-api env PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH"   "$APP_DIR/.venv/bin/python" -m playwright install chromium
chown -R metodbox-api:metodbox-api "$APP_DIR/pw-browsers"

echo "[5/8] Secret dosyaları yazılıyor..."
printf '%s' "$API_KEY" > "$CFG_DIR/api_key"
printf '%s' "$METODBOX_TOKEN" > "$CFG_DIR/metodbox_token"
unset API_KEY METODBOX_TOKEN
chown root:metodbox-api "$CFG_DIR/api_key" "$CFG_DIR/metodbox_token"
chmod 640 "$CFG_DIR/api_key" "$CFG_DIR/metodbox_token"

echo "[6/8] systemd servisi kuruluyor..."
cat > /etc/systemd/system/metodbox-api.service <<EOF
[Unit]
Description=Metodbox GPT+ OpenAI-compatible API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=metodbox-api
Group=metodbox-api
WorkingDirectory=$APP_DIR
Environment=HOME=$STATE_DIR
Environment=PLAYWRIGHT_BROWSERS_PATH=$APP_DIR/pw-browsers
Environment=METODBOX_API_KEY_FILE=$CFG_DIR/api_key
Environment=METODBOX_TOKEN_FILE=$CFG_DIR/metodbox_token
ExecStart=$APP_DIR/.venv/bin/uvicorn server:app --app-dir $APP_DIR --host 127.0.0.1 --port 8787
Restart=always
RestartSec=5
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8787
}
EOF

echo "[7/8] Düşük RAM için swap kontrolü..."
MEM_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
if [[ "$MEM_KB" -lt 1800000 ]] && ! swapon --show | grep -q .; then
  echo "RAM 2 GB altında; 2 GB swap oluşturuluyor."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "[8/8] Servisler başlatılıyor..."
systemctl daemon-reload
systemctl enable --now metodbox-api
systemctl enable --now caddy
systemctl restart caddy

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

echo
echo "Kurulum tamamlandı."
echo "Base URL: https://$DOMAIN/v1"
echo "Models:   gpt-5.1, gpt-oss:120b"
echo
echo "ÖNEMLİ: OCI Security List / NSG içinde TCP 80 ve 443 inbound izinli olmalı."
echo "Kontrol:"
echo "  systemctl status metodbox-api --no-pager"
echo "  systemctl status caddy --no-pager"
echo "  curl https://$DOMAIN/v1/models"
