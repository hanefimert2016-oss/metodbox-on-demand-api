#!/usr/bin/env bash
set -euo pipefail

REPO="${METODBOX_API_REPO:-hanefimert2016-oss/metodbox-on-demand-api}"
WORKFLOW="on-demand-api.yml"
BRANCH="main"

for cmd in gh jq python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Hata: $cmd kurulu değil." >&2
    exit 1
  fi
done

QUESTION="${*:-}"
if [[ -z "$QUESTION" ]]; then
  read -r -p "Soru: " QUESTION
fi

REQUEST_ID="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"

echo "İstek: $REQUEST_ID" >&2

jq -n   --arg ref "$BRANCH"   --arg question "$QUESTION"   --arg request_id "$REQUEST_ID"   '{ref:$ref, inputs:{question:$question, request_id:$request_id}}' | gh api     --method POST     -H "Accept: application/vnd.github+json"     -H "X-GitHub-Api-Version: 2022-11-28"     "/repos/$REPO/actions/workflows/$WORKFLOW/dispatches"     --input -     >/dev/null

RUN_ID=""
for _ in $(seq 1 120); do
  RUN_ID="$(
    gh api       -H "Accept: application/vnd.github+json"       "/repos/$REPO/actions/workflows/$WORKFLOW/runs?branch=$BRANCH&event=workflow_dispatch&per_page=50"       --jq ".workflow_runs[] | select(.display_title == \"API Request $REQUEST_ID\") | .id"       | head -n1
  )"

  [[ -n "$RUN_ID" ]] && break
  sleep 2
done

if [[ -z "$RUN_ID" ]]; then
  echo "Hata: workflow run bulunamadı." >&2
  exit 1
fi

echo "Runner: $RUN_ID" >&2

COMPLETED=0
for _ in $(seq 1 180); do
  STATUS="$(gh api "/repos/$REPO/actions/runs/$RUN_ID" --jq .status)"
  if [[ "$STATUS" == "completed" ]]; then
    COMPLETED=1
    break
  fi
  sleep 3
done

if [[ "$COMPLETED" != "1" ]]; then
  echo "Hata: workflow zaman aşımına uğradı." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for _ in $(seq 1 30); do
  if gh run download "$RUN_ID"       --repo "$REPO"       --name "api-response-$REQUEST_ID"       --dir "$TMP/response"       >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ ! -f "$TMP/response/response.json" ]]; then
  echo "Hata: cevap artifactı indirilemedi." >&2
  exit 1
fi

STATUS="$(jq -r '.status' "$TMP/response/response.json")"

if [[ "$STATUS" != "ok" ]]; then
  jq -r '.error // "Bilinmeyen API hatası"' "$TMP/response/response.json" >&2
  exit 1
fi

jq -r '.answer' "$TMP/response/response.json"
