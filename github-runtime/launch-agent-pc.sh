#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="${1:-}"
KV_ID="3e17fc451bea47958bc5d9456964d95b"
STATE_KEY="agent_pc:${AGENT_ID}"
STOP_KEY="agent_pc_stop:${AGENT_ID}"
UPSTREAM_COMMIT="aff4981e0734f15ff2fc68c86a32f765e0cae2b2"
CONTAINER=""
TUNNEL_PID=""
WORKROOT="/tmp/metodbox-agent-${AGENT_ID}"
WORKSPACE="$WORKROOT/workspace"
PROFILES="$WORKROOT/profiles"
DATA_DIR="/tmp/agent-data"
ARCHIVE_PATH="$DATA_DIR/agent-storage/pcs/${AGENT_ID}/state.tar.gz.enc"
source "$(dirname "${BASH_SOURCE[0]}")/storage-git.sh"
RESTORE_FAILED=0
CHECKPOINT_INTERVAL=900  # 15-minute encrypted snapshots while the VM is running

if [[ ! "$AGENT_ID" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$ ]]; then
  echo "Invalid agent id: $AGENT_ID" >&2
  exit 2
fi

if [[ -z "${METODBOX_API_KEY:-}" || -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Required GitHub Actions secrets are missing." >&2
  exit 3
fi

json_state() {
  local status="$1"
  local message="$2"
  local url="${3:-}"
  python3 - "$AGENT_ID" "$status" "$message" "$url" <<'PY'
import json, sys, time
agent, status, message, url = sys.argv[1:5]
obj = {
    "agentId": agent,
    "status": status,
    "message": message,
    "heartbeat": True,
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

kv_get() {
  local key="$1"
  npx wrangler kv key get --namespace-id="$KV_ID" "$key" --text --remote 2>/dev/null || true
}

set_state() {
  kv_put "$STATE_KEY" "$(json_state "$1" "$2" "${3:-}")"
}

derive_computer_token() {
  python3 - "$AGENT_ID" "$METODBOX_API_KEY" <<'PY'
import hashlib, hmac, sys
agent, secret = sys.argv[1:3]
print(hmac.new(secret.encode(), f"opendots-computer:{agent}".encode(), hashlib.sha256).hexdigest())
PY
}

prepare_data_branch() {
  storage_clone "$DATA_DIR"
  mkdir -p "$(dirname "$ARCHIVE_PATH")"
}

restore_state() {
  mkdir -p "$WORKSPACE" "$PROFILES"
  if [[ ! -f "$ARCHIVE_PATH" ]]; then
    return 0
  fi

  echo "Restoring encrypted agent state from GitHub..."
  if openssl enc -d -aes-256-cbc -pbkdf2       -pass env:METODBOX_API_KEY       -in "$ARCHIVE_PATH"       2>/tmp/state-decrypt.err | tar -xzf - -C "$WORKROOT"; then
    echo "Agent state restored."
  else
    echo "::error::Existing encrypted snapshot could not be decrypted. Refusing clean boot or overwrite to protect stored files." >&2
    cat /tmp/state-decrypt.err >&2 || true
    RESTORE_FAILED=1
    return 1
  fi
}

persist_state() {
  if [[ "$RESTORE_FAILED" == "1" || ! -d "$DATA_DIR/.git" || ! -d "$WORKSPACE" ]]; then
    echo "::warning::No safe PC snapshot source; previous stored data remains unchanged." >&2
    return 1
  fi
  mkdir -p "$(dirname "$ARCHIVE_PATH")"
  local tmp="/tmp/agent-state-${AGENT_ID}.tar.gz.enc" bytes=0
  rm -f "$tmp"
  # Root-owned bind mounts are readable through sudo even while the container
  # is running. Never chmod 777 or change ownership of a live browser profile.
  if ! sudo tar -C "$WORKROOT" -czf - workspace profiles 2>/dev/null | \
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:METODBOX_API_KEY -out "$tmp"; then
    echo "::warning::Full snapshot interrupted; retrying workspace only." >&2
    rm -f "$tmp"
  fi
  [[ -f "$tmp" ]] && bytes="$(stat -c %s "$tmp" 2>/dev/null || echo 0)"
  if (( bytes > 83886080 || bytes < 128 )); then
    echo "Browser profile snapshot unavailable or over 80 MiB; trying workspace-only backup."
    rm -f "$tmp"
    if ! sudo tar -C "$WORKROOT" -czf - workspace 2>/dev/null | \
      openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:METODBOX_API_KEY -out "$tmp"; then
      rm -f "$tmp"; echo "::warning::Workspace snapshot failed; old backup retained." >&2
      return 1
    fi
  fi
  bytes="$(stat -c %s "$tmp" 2>/dev/null || echo 0)"
  if (( bytes > 83886080 || bytes < 128 )); then
    echo "::warning::Encrypted archive invalid/over 80 MiB; keeping previous good backup." >&2
    rm -f "$tmp"
    return 1
  fi
  # tar -tzf needs the encryption key; validate before replacing prior backup.
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass env:METODBOX_API_KEY -in "$tmp" | tar -tzf - >/dev/null 2>&1; then
    echo "::warning::Snapshot integrity/extraction check failed; old backup retained." >&2
    rm -f "$tmp"; return 1
  fi
  mv "$tmp" "$ARCHIVE_PATH"
  git -C "$DATA_DIR" add "agent-storage/pcs/${AGENT_ID}/state.tar.gz.enc" || return 1
  if git -C "$DATA_DIR" diff --cached --quiet; then return 0; fi
  git -C "$DATA_DIR" config user.name "Metodbox Agent Storage"
  git -C "$DATA_DIR" config user.email "actions@users.noreply.github.com"
  git -C "$DATA_DIR" commit -m "storage: checkpoint ${AGENT_ID}" >/dev/null || return 1
  if storage_push "$DATA_DIR"; then
    echo "Encrypted PC checkpoint persisted privately (${bytes} bytes)."
    return 0
  fi
  echo "::warning::Could not push snapshot to private storage. Snapshot is not durable yet." >&2
  return 1
}

cleanup() {
  local code=$?
  trap - EXIT
  set +e
  if [[ $code -ne 0 && -n "$CONTAINER" ]]; then
    echo '::error::Agent PC container exited prematurely. Capturing diagnostics:' >&2
    docker inspect --format '{{.State.Status}} {{.State.ExitCode}} {{.State.Error}}' "$CONTAINER" >&2 || true
    docker logs --tail 120 "$CONTAINER" >&2 || true
  fi
  [[ -n "$CONTAINER" ]] && docker stop -t 20 "$CONTAINER" >/dev/null 2>&1 || true
  [[ -n "$CONTAINER" ]] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  # Host runner must regain access to browser profiles for encrypted backup.
  if [[ -d "$WORKSPACE" && -d "$PROFILES" ]]; then
    sudo chown -R "$(id -u):$(id -g)" "$WORKSPACE" "$PROFILES" || true
  fi
  local saved=0
  if persist_state; then saved=1; fi
  if [[ $code -eq 0 && $saved -eq 1 ]]; then
    set_state "stopped" "PC kapandı. Dosyalar özel GitHub deposuna şifreli kaydedildi."
  elif [[ $code -eq 0 ]]; then
    set_state "error" "PC kapandı ancak son yedek yüklenemedi; önceki yedek korundu. Actions kayıtlarını kontrol et."
    code=12
  else
    set_state "error" "Ajan bilgisayarı beklenmedik şekilde kapandı. GitHub Actions logunu kontrol et."
  fi
  exit "$code"
}
trap cleanup EXIT

set_state "starting" "Şifreli GitHub depolaması hazırlanıyor."
prepare_data_branch
restore_state

# The prebuilt image is shared between all chat/agent PCs. Pulling a pinned
# version avoids a full Playwright/Chromium installation + Docker rebuild.
# The image is created separately by build-dot-desktop-image.yml.
IMAGE="ghcr.io/hanefimert2016-oss/metodbox-dot-desktop:xfce-v2"
set_state "starting" "Hazır XFCE masaüstü indiriliyor (ilk imaj çekilişi)."
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  printf '%s' "$GITHUB_TOKEN" | docker login ghcr.io -u "${GITHUB_ACTOR:-hanefimert2016-oss}" --password-stdin >/dev/null 2>&1 || true
fi
if docker pull "$IMAGE"; then
  echo "::notice::Cached desktop image ready, skipping OpenBot clone and Docker build."
else
  echo "::warning::Cached image is not yet available. Using one-off fallback build."
  set_state "starting" "İlk kurulum: hazır imaj bulunamadı, masaüstü bir kez derleniyor."
  rm -rf /tmp/openbot-agent-source
  git clone --filter=blob:none --no-checkout https://github.com/CopilotKit/OpenBot.git /tmp/openbot-agent-source
  git -C /tmp/openbot-agent-source checkout "$UPSTREAM_COMMIT"
  python3 "$PWD/github-runtime/patch-metodbox-desktop.py" /tmp/openbot-agent-source
  docker build -f /tmp/openbot-agent-source/agent-computer/Dockerfile \
    -t "metodbox-agent-computer:$UPSTREAM_COMMIT" /tmp/openbot-agent-source
  IMAGE="metodbox-agent-computer:$UPSTREAM_COMMIT"
fi

COMPUTER_TOKEN="$(derive_computer_token)"
CONTAINER="metodbox-agentpc-${AGENT_ID}"

set_state "starting" "XFCE masaüstü, Chromium, terminal ve çalışma alanı açılıyor."
# --cap-drop ALL removes root's DAC_OVERRIDE. Give the container's uid=0
# ownership of ONLY the two dedicated bind-mount roots before starting it.
# Never globally chmod 777: browser profiles may hold login credentials.
sudo chown -R 0:0 "$WORKSPACE" "$PROFILES"
sudo chmod u+rwx "$WORKSPACE" "$PROFILES"
docker run -d   --name "$CONTAINER"   --cap-drop ALL   --security-opt no-new-privileges:true   --pids-limit 512   --shm-size 1g   --memory 6g   -p 127.0.0.1:4100:4100   -e COMPUTER_TOKEN="$COMPUTER_TOKEN"   -e COMPUTER_BROWSER_MODE=headed   -e COMPUTER_BOT_ID="$AGENT_ID"   -e EGRESS_POLICY_REQUIRED=0   -e WORKSPACE_DIR=/workspace   -e PROFILES_DIR=/profiles   -v "$WORKSPACE:/workspace"   -v "$PROFILES:/profiles"   "$IMAGE" >/dev/null

for _ in $(seq 1 120); do
  if curl -fsS --max-time 3 http://127.0.0.1:4100/health >/dev/null 2>&1; then
    break
  fi
  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    docker inspect --format '{{.State.Status}} {{.State.ExitCode}} {{.State.Error}}' "$CONTAINER" >&2 || true
    docker logs --tail 120 "$CONTAINER" >&2 || true
    exit 7
  fi
  sleep 1
done

if ! curl -fsS --max-time 3 http://127.0.0.1:4100/health >/dev/null; then
  docker logs "$CONTAINER" >&2 || true
  exit 8
fi

curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
chmod +x /tmp/cloudflared
/tmp/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4100 >/tmp/cloudflared-agent.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-agent.log | tail -n1 || true)"
  [[ -n "$TUNNEL_URL" ]] && break
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  cat /tmp/cloudflared-agent.log >&2 || true
  exit 9
fi

set_state "running" "Ajan bilgisayarı hazır." "$TUNNEL_URL"
echo "Agent $AGENT_ID computer ready at $TUNNEL_URL"

# Standard GitHub-hosted jobs have a six-hour maximum. Leave time for encrypted
# persistence and cleanup.
END=$(( $(date +%s) + 19800 ))
NEXT_CHECKPOINT=$(( $(date +%s) + CHECKPOINT_INTERVAL ))
NEXT_HEARTBEAT=$(( $(date +%s) + 180 ))
while [[ $(date +%s) -lt $END ]]; do
  if (( $(date +%s) >= NEXT_HEARTBEAT )); then
    # Heartbeats prevent stale status after unexpected GitHub job termination.
    set_state "running" "PC açık: tarayıcı, terminal ve çalışma alanı erişilebilir." "$TUNNEL_URL" || true
    NEXT_HEARTBEAT=$(( $(date +%s) + 180 ))
  fi
  if (( $(date +%s) >= NEXT_CHECKPOINT )); then
    if persist_state; then
      echo "::notice::Live workspace checkpoint saved."
    else
      echo "::warning::Live backup failed; will retry at next checkpoint."
    fi
    NEXT_CHECKPOINT=$(( $(date +%s) + CHECKPOINT_INTERVAL ))
  fi
  if [[ "$(kv_get "$STOP_KEY")" == *"1"* ]]; then
    set_state "stopping" "Kullanıcı ajan bilgisayarını durdurdu." "$TUNNEL_URL"
    exit 0
  fi
  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    docker logs "$CONTAINER" >&2 || true
    exit 10
  fi
  sleep 8
done

set_state "stopping" "GitHub runner süresi doldu; ajan durumu kaydediliyor." "$TUNNEL_URL"
exit 0
