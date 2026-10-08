#!/usr/bin/env bash
# Run LOCALLY on Arch Linux, not in GitHub Actions. Never paste keys into chat.
set -euo pipefail
umask 077
MAIN="hanefimert2016-oss/metodbox-on-demand-api"
PRIVATE="hanefimert2016-oss/ai-application-suite-1"

if ! command -v gh >/dev/null || ! command -v openssl >/dev/null; then
  if command -v pacman >/dev/null; then
    sudo pacman -S --needed github-cli openssl
  else
    echo "Install GitHub CLI (gh) and openssl first." >&2
    exit 1
  fi
fi

gh auth status >/dev/null 2>&1 || gh auth login --web --hostname github.com --git-protocol https
if [[ "$(gh repo view "$MAIN" --json nameWithOwner --jq .nameWithOwner)" != "$MAIN" ]]; then
  echo "Main repo not found or account access missing." >&2; exit 1
fi
if [[ "$(gh repo view "$PRIVATE" --json isPrivate --jq .isPrivate)" != true ]]; then
  echo "ERROR: Data repository is not private." >&2; exit 1
fi
gh api "repos/$PRIVATE/branches/agent-data" --jq .name >/dev/null

echo "Private data repo: $PRIVATE (branch: agent-data)"
echo "Public code + GitHub Actions: $MAIN"
echo ""
echo "Create a fine-grained PAT for only the PRIVATE repository:"
echo "https://github.com/settings/personal-access-tokens/new"
echo "Permissions: Contents Read and write; Metadata Read."
read -r -s -p "PRIVATE storage PAT (hidden): " PRIVATE_PAT
printf '\n'
[[ -n "$PRIVATE_PAT" ]] || { echo "Storage PAT missing" >&2; exit 1; }
printf '%s' "$PRIVATE_PAT" | gh secret set AGENT_STORAGE_TOKEN -R "$MAIN"
unset PRIVATE_PAT

echo ""
echo "Create a DIFFERENT fine-grained PAT for only the PUBLIC control repository:"
echo "https://github.com/settings/personal-access-tokens/new"
echo "Permissions: Contents Read and write (required for repository_dispatch)."
read -r -s -p "PUBLIC dispatch PAT (hidden): " DISPATCH_PAT
printf '\n'
[[ -n "$DISPATCH_PAT" ]] || { echo "Dispatch PAT missing" >&2; exit 1; }
printf '%s' "$DISPATCH_PAT" | gh secret set AGENT_DISPATCH_TOKEN -R "$MAIN"
unset DISPATCH_PAT

echo "Stored tokens as GitHub Actions secrets; never in source files."
echo "You also need existing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and API_KEY secrets on $MAIN."
echo ""
echo "Finish setup from Actions > Configure Private Thread Storage > Run workflow:"
echo "https://github.com/$MAIN/actions/workflows/configure-private-storage.yml"
echo "Existing Manual API Server, OpenDots and Agent PC workflows were not started."
