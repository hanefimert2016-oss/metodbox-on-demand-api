# Metodbox On-Demand API

Bu sürümde API **GitHub Actions runner üzerinde** çalışır. PC'de veya Cloudflare'da sürekli açık servis yoktur.

## Çalışma şekli

```text
Manuel "Run workflow"
veya ChatGPT'ye "API'yi başlat" de
        ↓
GitHub Actions Ubuntu runner açılır
        ↓
FastAPI + GPT+ bridge başlar
        ↓
geçici HTTPS tunnel URL oluşur
        ↓
Cline bu URL + API_KEY ile kullanır
        ↓
workflow durunca runner ve API kapanır
```

Dışarıdan GitHub-hosted runner'a doğrudan inbound port açılamadığı için, yalnız workflow çalışırken kısa ömürlü HTTPS tüneli kullanılır. Tünel `localhost.run` üzerinden kurulur; ücretsiz geçici URL her başlatmada değişebilir.

## Secrets

GitHub Actions Secrets içinde yalnızca:

```text
API_KEY
METODBOX_TOKEN
```

gerekir.

## Manuel başlatma

GitHub → Actions → **Manual API Server** → **Run workflow**

`lifetime_minutes` varsayılan 120 dakikadır. En fazla 350 dakika tutulur.

Workflow başladıktan sonra **Open temporary HTTPS tunnel** adımında ve workflow summary'de:

```text
https://....localhost.run/v1
```

şeklinde Base URL görünür.

Cline ayarları:

```text
Base URL: https://....localhost.run/v1
API Key: mevcut API_KEY
Model: gpt-5.1 veya gpt-oss:120b
```

## ChatGPT ile başlat / durdur

Bu repo ayrıca issue tabanlı kontrol destekler.

ChatGPT'ye:

```text
API'yi başlat
```

dediğinde `[START API]` başlıklı bir GitHub issue oluşturulabilir. Workflow otomatik başlar ve hazır olduğunda geçici Base URL'yi issue'ya yorum olarak yazar.

Sunucuyu durdurmak için aynı issue kapatılır. Workflow bunu algılar ve runner kapanır.

## Güvenlik

Public tunnel yalnız workflow açıkken vardır. Chat istekleri `Authorization: Bearer <API_KEY>` ile korunur. `METODBOX_TOKEN` yalnız GitHub Actions Secret olarak runner'a verilir.
