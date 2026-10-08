#!/data/data/com.termux/files/usr/bin/bash
# Configures optional OpenAI Realtime voice for phone-browser WebRTC calls.
# Does not modify the Metodbox model API, GitHub PAT, or thread encryption key.
set -euo pipefail
umask 077
REPO="hanefimert2016-oss/metodbox-on-demand-api"

command -v gh >/dev/null 2>&1 || { echo "Termux: pkg install gh" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Önce: gh auth login --web" >&2; exit 1; }

echo "OpenDots tarayıcı içi sesli görüşme: OpenAI Realtime / WebRTC"
echo "Bu anahtar, GitHub PAT veya Metodbox GPT+ model tokenı DEĞİLDİR."
echo "Ayrı bir OpenAI API hesabı ve ücretli Realtime erişimi gerekebilir."
echo "Anahtar ve görüşme sesleri OpenAI'a gönderilir; tokenı sohbette paylaşma."
echo
read -rs -p "OpenAI Realtime VOICE_API_KEY (gizli): " voice_key
printf '\n'
if [[ -z "$voice_key" ]]; then echo "Anahtar boş; değişiklik yapılmadı." >&2; exit 1; fi
printf '%s' "$voice_key" | gh secret set VOICE_API_KEY --repo "$REPO" --app actions
unset voice_key
echo "✔ VOICE_API_KEY Actions Secrets içine kaydedildi."
echo "Sesli görüşme yeni başlatılan OpenDots oturumunda etkinleşir."
echo "https://github.com/$REPO/actions/workflows/launch-copilot-app.yml"
