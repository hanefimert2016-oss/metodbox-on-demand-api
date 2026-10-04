# Metodbox On-Demand API

API **GitHub Actions runner üzerinde** çalışır. PC'de veya Cloudflare'da sürekli açık servis yoktur.

## Sabit URL

Workflow artık geçici `localhost.run` adresi yerine ngrok'un hesaba atanmış sabit development domainini kullanır.

Örnek:

```text
https://ornek-adres.ngrok.app/v1
```

Bu adres Cline'a bir kez girilir. Workflow kapalıyken URL offline olur; API tekrar başlatıldığında **aynı URL** yeniden çalışır.

ngrok'un resmi dokümantasyonuna göre ücretsiz hesaplara atanmış development domain tekrar kullanılabilir ve agent endpoint'i yalnız agent çalışırken aktiftir.

## Gerekli GitHub Actions Secrets

```text
API_KEY
METODBOX_TOKEN
NGROK_AUTHTOKEN
NGROK_DOMAIN
```

`NGROK_DOMAIN` şu biçimlerden biri olabilir:

```text
ornek-adres.ngrok.app
```

veya:

```text
https://ornek-adres.ngrok.app
```

## Bir kere ngrok kurulumu

1. ngrok hesabı oluştur.
2. Dashboard → Domains bölümünde hesabına atanmış development/static domaini al.
3. Dashboard'dan authtoken al.
4. Bunları GitHub Actions Secrets olarak kaydet:
   - `NGROK_AUTHTOKEN`
   - `NGROK_DOMAIN`

## Manuel başlatma

GitHub → Actions → **Manual API Server** → **Run workflow**

Varsayılan açık kalma süresi 120 dakika, üst sınır 350 dakikadır.

Cline ayarları her başlatmada aynıdır:

```text
Base URL: https://<NGROK_DOMAIN>/v1
API Key: mevcut API_KEY
Model: gpt-5.1 veya gpt-oss:120b
```

## ChatGPT ile başlat / durdur

ChatGPT'ye `API'yi başlat` dediğinde `[START API]` kontrol issue'su oluşturulabilir ve workflow başlar. Hazır olduğunda issue'ya aynı sabit Base URL yazılır.

`API'yi kapat` dediğinde issue kapatılır ve GitHub runner kapanır.

Workflow kapalı olduğunda sabit URL cevap vermez; sonraki başlatmada aynı hostname tekrar kullanılır.
