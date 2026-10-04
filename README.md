# Metodbox On-Demand API

Cloudflare kaldırıldı. Yeni mimari manuel açılan **local gateway + GitHub Actions** yapısıdır.

```text
Cline
  -> http://127.0.0.1:8787/v1
  -> local gateway (yalnız sen açınca çalışır)
  -> GitHub App installation token
  -> GitHub Actions
  -> GPT+ (gpt-5.1 / gpt-oss:120b)
  -> response.json artifact
  -> local gateway
  -> Cline
```

## 1. GitHub Actions secrets

Repoda şu secretlar bulunmalı:

```text
API_KEY
METODBOX_TOKEN
```

## 2. Local gateway'i bir kere yapılandır

Repoda:

```bash
cd local-gateway
chmod +x configure.sh start.sh
./configure.sh
```

Burada GitHub App ID, Installation ID ve GitHub App private key PEM dosyasının yolu sorulur.
Değerler `~/.config/metodbox-on-demand-api/` altında tutulur.

## 3. API'yi istediğin zaman aç

```bash
./start.sh
```

API:

```text
http://127.0.0.1:8787/v1
```

Cline ayarları:

```text
Base URL: http://127.0.0.1:8787/v1
API Key: ~/.config/metodbox-proxy/api_key içindeki değer
Model: gpt-5.1 veya gpt-oss:120b
```

`Ctrl+C` yaptığında local API kapanır. Boşta Cloudflare Worker, VPS veya sürekli açık servis yoktur.

## Model listesi

```bash
curl http://127.0.0.1:8787/v1/models
```

## Test

```bash
KEY="$(cat ~/.config/metodbox-proxy/api_key)"

curl -sS http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"gpt-oss:120b",
    "messages":[{"role":"user","content":"Sadece MERHABA yaz"}]
  }'
```
