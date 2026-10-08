#!/data/data/com.termux/files/usr/bin/bash
# Metodbox Android / Termux one-token setup (no root, PC or ngrok).
# All secrets are entered locally and sent to GitHub Actions via stdin.
set -euo pipefail
umask 077

MAIN="hanefimert2016-oss/metodbox-on-demand-api"
STORAGE="hanefimert2016-oss/Metodbox-secret-system"
WORKFLOW_URL="https://github.com/$MAIN/actions/workflows/configure-private-storage.yml"

if ! command -v pkg >/dev/null 2>&1; then
  echo "Bu kurulum Android Termux içindir. Termux'u açıp tekrar çalıştır." >&2
  exit 1
fi

echo "== Metodbox mobil kurulum (Termux) =="
echo "Ana repo: $MAIN"
echo "Veri deposu: $STORAGE"
echo "Yeni GitHub token sayısı: 1"
echo "ngrok kullanılmayacak."
echo

for cmd in gh openssl curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Eksik Termux paketleri kuruluyor..."
    pkg update -y
    pkg install -y gh openssl curl
    break
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo
  echo "GitHub hesabını telefonunun tarayıcısında doğrula."
  echo "gh sana giriş kodunu gösterebilir: github.com/login/device"
  if command -v termux-open-url >/dev/null 2>&1; then
    BROWSER=termux-open-url gh auth login --hostname github.com --git-protocol https --web
  else
    gh auth login --hostname github.com --git-protocol https --web
  fi
fi

gh repo view "$MAIN" --json nameWithOwner --jq .nameWithOwner >/dev/null
private="$(gh repo view "$STORAGE" --json isPrivate --jq .isPrivate)"
if [[ "$private" != "true" ]]; then
  echo
  echo "HATA: $STORAGE henüz PUBLIC."
  echo "Önce GitHub → Metodbox-secret-system → Settings → General"
  echo "→ Danger Zone → Change repository visibility → Private."
  echo "Adres: https://github.com/$STORAGE/settings"
  if command -v termux-open-url >/dev/null 2>&1; then
    termux-open-url "https://github.com/$STORAGE/settings" || true
  fi
  echo "Veri güvenliği için token ve kurulum işlemi başlatılmadı."
  exit 1
fi

gh api "repos/$STORAGE/branches/agent-data" --jq .name >/dev/null

echo
echo "1 tane Fine-grained Personal Access Token oluştur:"
echo "https://github.com/settings/personal-access-tokens/new"
echo "Only select repositories: İKİ depoyu da seç:"
echo " - metodbox-on-demand-api"
echo " - Metodbox-secret-system"
echo "Repository permissions → Contents: Read and write"
echo "Metadata: Read (otomatik)."
echo "Tokenı asla sohbete gönderme."
if command -v termux-open-url >/dev/null 2>&1; then
  read -r -p "Token oluşturma sayfasını tarayıcıda aç? [E/h]: " open_token
  if [[ ! "$open_token" =~ ^[Hh]$ ]]; then
    termux-open-url "https://github.com/settings/personal-access-tokens/new" || true
  fi
fi

echo
read -r -s -p "Tek GitHub tokenını yapıştır (gizli giriş): " pat
printf '\n'
if [[ -z "$pat" ]]; then
  echo "GitHub tokenı boş olamaz." >&2
  exit 1
fi

for repo in "$MAIN" "$STORAGE"; do
  if ! GH_TOKEN="$pat" gh api "repos/$repo" --jq .full_name >/dev/null 2>&1; then
    echo "Tokenın $repo erişimi yok. İki repoyu seçerek tekrar oluştur." >&2
    exit 1
  fi
done

printf '%s' "$pat" | gh secret set AGENT_STORAGE_TOKEN --repo "$MAIN" --app actions
unset pat
echo "✔ Tek PAT, ana repoya AGENT_STORAGE_TOKEN olarak eklendi."

echo
echo "Portal kullanıcı adı: admin"
echo "İlk giriş için istediğin '2026' şifresini yaz."
echo "Not: 2026 zayıf bir şifredir; testten sonra güçlü şifreye geç."
read -r -s -p "Portal şifresi (gizli giriş): " portal_pass
printf '\n'
if [[ -z "$portal_pass" ]]; then
  echo "Şifre boş olamaz." >&2
  exit 1
fi
printf '%s' "$portal_pass" | gh secret set PORTAL_PASSWORD --repo "$MAIN" --app actions
unset portal_pass
echo "✔ Portal şifresi GitHub Actions secret olarak kaydedildi."

secret_exists() {
  gh secret list --repo "$MAIN" --app actions --json name --jq '.[].name' |
    grep -Fxq "$1"
}

for key in PORTAL_SESSION_SECRET STORAGE_ENCRYPTION_KEY; do
  if secret_exists "$key"; then
    echo "✔ Var olan $key korundu."
  else
    openssl rand -hex 32 | tr -d '\n' | gh secret set "$key" --repo "$MAIN" --app actions
    echo "✔ Güçlü rastgele $key oluşturuldu."
  fi
done

echo
missing=0
for key in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID API_KEY; do
  if ! secret_exists "$key"; then
    echo "⚠ Ana repoda önceden gerekli $key secretı bulunamadı."
    missing=1
  fi
done

echo
echo "GitHub depoları değiştirilmedi; ana repo hâlâ $MAIN."
echo "Veri hedefi: $STORAGE / agent-data."
echo "Yeni ngrok tokenına ihtiyaç yok."
echo
if [[ "$missing" == "1" ]]; then
  echo "Eksik mevcut Cloudflare/API secretlarını tamamladıktan sonra dağıtımı başlat."
else
  echo "Hazır! Şimdi şu workflow'u çalıştır:"
fi
echo "$WORKFLOW_URL"
echo "GitHub → Actions → Configure Private Thread Storage → Run workflow"
if command -v termux-open-url >/dev/null 2>&1; then
  read -r -p "Workflow sayfasını tarayıcıda aç? [E/h]: " open_workflow
  if [[ ! "$open_workflow" =~ ^[Hh]$ ]]; then
    termux-open-url "$WORKFLOW_URL" || true
  fi
fi
