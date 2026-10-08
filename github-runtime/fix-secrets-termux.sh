#!/data/data/com.termux/files/usr/bin/bash
# Recover only the two missing one-time secrets. Idempotent; never print secret values.
set -euo pipefail
umask 077
REPO="hanefimert2016-oss/metodbox-on-demand-api"

if ! command -v gh >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  echo "Termux'ta önce pkg install gh openssl çalıştır." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub'a gir: gh auth login --hostname github.com --git-protocol https --web" >&2
  exit 1
fi

echo "Repo: $REPO"
existing="$(gh secret list --repo "$REPO" --app actions --json name --jq '.[].name')"
for key in PORTAL_SESSION_SECRET STORAGE_ENCRYPTION_KEY; do
  if printf '%s\n' "$existing" | grep -Fxq "$key"; then
    echo "✔ $key zaten var; değiştirilmedi."
  else
    # Generate strong random values locally. gh sends stdin only to GitHub's
    # encrypted Actions Secrets API; the value never appears in logs/history.
    openssl rand -hex 32 | tr -d '\n' | gh secret set "$key" --repo "$REPO" --app actions
    echo "✔ $key oluşturuldu."
  fi
done

echo
echo "GitHub Secret isimleri kontrol ediliyor (değerler gösterilmez):"
for key in PORTAL_SESSION_SECRET STORAGE_ENCRYPTION_KEY; do
  if gh secret list --repo "$REPO" --app actions --json name --jq '.[].name' | grep -Fxq "$key"; then
    echo "✔ $key doğrulandı"
  else
    echo "HATA: $key yüklenemedi" >&2
    exit 1
  fi
done

echo
echo "Yeniden çalıştır:"
echo "https://github.com/$REPO/actions/workflows/configure-private-storage.yml"
