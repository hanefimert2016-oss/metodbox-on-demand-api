#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "sudo ./update.sh ile çalıştır." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/metodbox-api"

systemctl stop metodbox-api
rsync -a --delete "$ROOT_DIR/pc-local/" "$APP_DIR/" --exclude .venv
chown -R metodbox-api:metodbox-api "$APP_DIR"

sudo -u metodbox-api "$APP_DIR/.venv/bin/python" -m pip install -r "$APP_DIR/requirements.txt"
systemctl start metodbox-api

echo "Güncellendi."
systemctl status metodbox-api --no-pager
