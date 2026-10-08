#!/usr/bin/env bash
# Metodbox one-PAT bootstrap on Arch Linux.
# The existing Cloudflare API credentials and Metodbox model key are reused.
set -euo pipefail
umask 077
MAIN="hanefimert2016-oss/metodbox-on-demand-api"
STORAGE="hanefimert2016-oss/Metodbox-secret-system"

if ! command -v gh >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  sudo pacman -S --needed github-cli openssl
fi
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web

if [[ "$(gh repo view "$STORAGE" --json isPrivate --jq .isPrivate)" != "true" ]]; then
  echo "ERROR: $STORAGE is currently PUBLIC." >&2
  echo "GitHub > Repository Settings > General > Danger Zone > Change visibility > Private" >&2
  echo "Refusing to set up storage until it is private." >&2
  exit 1
fi
gh api "repos/$STORAGE/branches/agent-data" --jq .name >/dev/null

cat <<EOF
Create ONE fine-grained Personal Access Token:
  https://github.com/settings/personal-access-tokens/new
Repository access: Only select repositories; select BOTH:
  $MAIN
  $STORAGE
Permissions: Repository contents -> Read and write (metadata read is automatic).
Use this one token for BOTH storage and repository_dispatch.
Never send the token in chat.
EOF
read -r -s -p "Paste the single GitHub PAT here (hidden): " PAT
printf '\n'
if [[ -z "$PAT" ]]; then echo "Token missing" >&2; exit 1; fi
for repo in "$MAIN" "$STORAGE"; do
  GH_TOKEN="$PAT" gh api "repos/$repo" --jq .full_name >/dev/null || {
    echo "PAT cannot access $repo; select BOTH repositories." >&2; exit 1;
  }
done
printf '%s' "$PAT" | gh secret set AGENT_STORAGE_TOKEN --repo "$MAIN" --app actions
unset PAT
echo "Saved the ONE token as AGENT_STORAGE_TOKEN."

echo "Portal username: admin."
echo "Enter your requested portal password (2026)."
read -r -s -p "Portal password (hidden): " PORTAL_PASS
printf '\n'
if [[ -z "$PORTAL_PASS" ]]; then echo "Password missing" >&2; exit 1; fi
printf '%s' "$PORTAL_PASS" | gh secret set PORTAL_PASSWORD --repo "$MAIN" --app actions
unset PORTAL_PASS

secret_exists() {
  gh secret list --repo "$MAIN" --app actions --json name --jq '.[].name' | grep -qx "$1"
}
for key in PORTAL_SESSION_SECRET STORAGE_ENCRYPTION_KEY; do
  if secret_exists "$key"; then
    echo "Existing $key preserved to avoid invalidating stored data."
  else
    openssl rand -hex 32 | tr -d '\n' | gh secret set "$key" --repo "$MAIN" --app actions
    echo "Created cryptographically random $key."
  fi
done

for key in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID API_KEY; do
  if ! secret_exists "$key"; then
    echo "WARNING: Existing required secret $key is missing from $MAIN." >&2
  fi
done

echo "Finished locally. Run ONE workflow to configure Cloudflare:"
echo "https://github.com/$MAIN/actions/workflows/configure-private-storage.yml"
echo "No ngrok account or token is needed."
