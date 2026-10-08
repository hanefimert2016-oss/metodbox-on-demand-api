#!/usr/bin/env bash
set -euo pipefail

APP="${1:-}"
KV_ID="3e17fc451bea47958bc5d9456964d95b"
WORKER_BASE="https://metodbox-direct-api.hanefimert2016.workers.dev"
RUNTIME_KEY="copilot_runtime:${APP}"
STOP_KEY="copilot_stop:${APP}"
APP_PID=""
TUNNEL_PID=""

if [[ "$APP" != "openbot" && "$APP" != "opendots" ]]; then
  echo "Unsupported app: $APP" >&2
  exit 2
fi

json_status() {
  local status="$1"
  local message="$2"
  local url="${3:-}"
  python3 - "$APP" "$status" "$message" "$url" <<'PY'
import json, sys, time
app, status, message, url = sys.argv[1:5]
obj = {
    "app": app,
    "status": status,
    "message": message,
    "updated_at": int(time.time() * 1000),
}
if url:
    obj["url"] = url
print(json.dumps(obj, ensure_ascii=False))
PY
}

kv_put() {
  local key="$1"
  local value="$2"
  npx wrangler kv key put --namespace-id="$KV_ID" "$key" "$value" --remote >/dev/null
}

set_status() {
  kv_put "$RUNTIME_KEY" "$(json_status "$1" "$2" "${3:-}")"
}

cleanup() {
  local code=$?
  set +e

  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$APP" == "openbot" ]]; then
    docker rm -f metodbox-openbot >/dev/null 2>&1 || true
  fi
  if [[ -n "$TUNNEL_PID" ]]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi

  if [[ $code -ne 0 ]]; then
    tail -n 60 /tmp/app.log 2>/dev/null || true
    set_status "error" "Runtime başlatılamadı. GitHub Actions logunu kontrol et."
  fi
}
trap cleanup EXIT

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deploy/KV secrets are missing" >&2
  exit 3
fi

if [[ -z "${METODBOX_API_KEY:-}" ]]; then
  echo "GitHub secret API_KEY is missing" >&2
  set_status "error" "GitHub secret API_KEY eksik."
  exit 4
fi

if [[ -z "${CPK_INTELLIGENCE_API_KEY:-}" ]]; then
  echo "GitHub secret CPK_INTELLIGENCE_API_KEY is missing" >&2
  set_status "error" "CPK_INTELLIGENCE_API_KEY eksik. OpenBot/OpenDots sohbetleri CopilotKit Intelligence proje anahtarı gerektiriyor."
  exit 5
fi

set_status "starting" "GitHub runner hazırlanıyor."
npx wrangler kv key delete --namespace-id="$KV_ID" "$STOP_KEY" --remote >/dev/null 2>&1 || true

if [[ "$APP" == "openbot" ]]; then
  PORT=3001
else
  PORT=4310
fi

echo "Installing cloudflared..."
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
chmod +x /tmp/cloudflared

echo "Starting quick tunnel for localhost:$PORT..."
/tmp/cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >/tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | tail -n1 || true)"
  [[ -n "$TUNNEL_URL" ]] && break
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  cat /tmp/cloudflared.log >&2 || true
  set_status "error" "Cloudflare Quick Tunnel URL alınamadı."
  exit 6
fi

set_status "starting" "$APP indiriliyor ve başlatılıyor." "$TUNNEL_URL"

if [[ "$APP" == "opendots" ]]; then
  echo "Launching OpenDots..."
  git clone --depth=1 https://github.com/CopilotKit/OpenDots.git /tmp/opendots
  cd /tmp/opendots
  npm ci --no-audit --no-fund

  OWNER_TOKEN="$(openssl rand -hex 24)"
  BROWSER_SECRET="$(openssl rand -hex 24)"

  cat > .env <<EOF
HOST=127.0.0.1
PORT=4310
DATABASE_PATH=data/opendots.sqlite
OWNER_ID=metodbox-owner
OWNER_TOKEN=$OWNER_TOKEN
BROWSER_SECRET=$BROWSER_SECRET
APP_ORIGIN=$TUNNEL_URL
CPK_INTELLIGENCE_API_KEY=$CPK_INTELLIGENCE_API_KEY
INTELLIGENCE_API_KEY=$CPK_INTELLIGENCE_API_KEY
OPENAI_API_KEY=$METODBOX_API_KEY
OPENAI_BASE_URL=$WORKER_BASE/v1
OPENAI_MODEL=gpt-5.1
EOF

  npm run build
  npm start >/tmp/app.log 2>&1 &
  APP_PID=$!

  READY_URL="http://127.0.0.1:4310/"
else
  echo "Launching OpenBot container..."
  KEY_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"

  cat > /tmp/openbot.env <<EOF
EMBEDDED_POSTGRES=on
KEY_ENCRYPTION_KEY=$KEY_ENCRYPTION_KEY
INTELLIGENCE_API_URL=https://api.intelligence.copilotkit.ai
INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.copilotkit.ai
INTELLIGENCE_API_KEY=$CPK_INTELLIGENCE_API_KEY
OPENAI_API_KEY=$METODBOX_API_KEY
OPENAI_BASE_URL=$WORKER_BASE/v1
BOT_PROVIDER=openai
BOT_MODEL=gpt-5.1
AGENT_BOT_MODEL=gpt-5.1
OPENBOT_SINGLE_USER=true
EOF

  docker pull ghcr.io/copilotkit/openbot:latest
  docker run --rm --name metodbox-openbot     -p 127.0.0.1:3001:3001     --env-file /tmp/openbot.env     ghcr.io/copilotkit/openbot:latest >/tmp/app.log 2>&1 &
  APP_PID=$!

  READY_URL="http://127.0.0.1:3001/health"
fi

echo "Waiting for runtime..."
ready=0
for _ in $(seq 1 180); do
  if curl -fsS --max-time 4 "$READY_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 2
done

if [[ "$ready" != "1" ]]; then
  tail -n 100 /tmp/app.log >&2 || true
  set_status "error" "$APP başlatıldı fakat health check geçmedi."
  exit 7
fi

set_status "ready" "$APP hazır. Bu oturum GitHub runner açık kaldığı sürece çalışır." "$TUNNEL_URL"
echo "$APP ready at $TUNNEL_URL"

# GitHub-hosted job hard limit is 6h. Leave margin for cleanup.
END=$(( $(date +%s) + 19800 ))
while [[ $(date +%s) -lt $END ]]; do
  STOP="$(npx wrangler kv key get --namespace-id="$KV_ID" "$STOP_KEY" --text --remote 2>/dev/null || true)"
  if printf '%s' "$STOP" | grep -q '1'; then
    set_status "stopping" "Kullanıcı durdurdu."
    exit 0
  fi

  if ! kill -0 "$APP_PID" 2>/dev/null; then
    tail -n 100 /tmp/app.log >&2 || true
    set_status "error" "$APP işlemi beklenmedik şekilde kapandı."
    exit 8
  fi

  sleep 8
done

set_status "stopped" "Maksimum GitHub runner süresi doldu. Tekrar Başlat'a basabilirsin."
exit 0
