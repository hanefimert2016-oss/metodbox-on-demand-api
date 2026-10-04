# Cloudflare Direct — önerilen ücretsiz hızlı sürüm

Bu sürüm GitHub Actions runner, VPS, Render veya yerel PC kullanmaz.

Akış:

```text
Telefon / Cline
      ↓
Cloudflare Worker (sabit workers.dev URL)
      ↓
AUTH_KV'de geçerli GPT+ Authorization var mı?
   ├─ evet → direkt GPT+ /api/chat/completions
   └─ hayır → Cloudflare Browser Run birkaç saniyelik browser açar
               ↓
             token bootstrap
               ↓
             Authorization KV'ye yazılır
               ↓
             direkt GPT+ API
```

Browser her istek için açılmaz. Authorization 6 saat KV'de tutulur ve 401/403 gelirse otomatik yenilenir.

## Kurulum

Mevcut Cloudflare hesabında:

```bash
cd cloudflare-direct
bash setup.sh
```

Script:

- npm paketlerini kurar
- ücretsiz Workers KV namespace oluşturur
- mevcut `~/.config/metodbox-proxy/api_key` değerini Worker secret yapar
- mevcut `~/.config/metodbox-proxy/metodbox_token` değerini Worker secret yapar
- deploy eder

Secret değerlerini ekrana yazdırmaz.

## Cline

Deploy sonunda workers.dev adresini kullan:

```text
Base URL: https://metodbox-direct-api.<subdomain>.workers.dev/v1
API Key: mevcut API_KEY
Model: gpt-5.1
```

veya:

```text
gpt-oss:120b
```

## Test

```bash
curl https://<worker>/v1/models
```

İlk gerçek chat isteğinde GPT+ authorization cache boşsa browser bootstrap nedeniyle birkaç saniye ekstra sürebilir. Sonraki istekler doğrudan GPT+ API'ye gider.
