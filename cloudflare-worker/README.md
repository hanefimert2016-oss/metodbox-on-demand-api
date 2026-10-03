# HTTPS ingress

Bu Worker, Cline/OpenAI uyumlu istemci ile GitHub Actions arasındaki tek sürekli erişilebilir HTTP girişidir.

## Son kullanıcı

Cline'a yalnızca şunlar verilir:

- Base URL: Worker URL + `/v1`
- API key: bizim `API_KEY`

Cline'ın GitHub hesabına giriş yapması veya GitHub tokenı taşıması gerekmez.

## Worker secrets

Worker tarafında:

- `API_KEY`: istemcinin kullandığı bizim API anahtarımız
- `GH_APP_ID`: GitHub App ID
- `GH_INSTALLATION_ID`: App installation ID
- `GH_PRIVATE_KEY`: GitHub App private key PEM

GitHub Actions tarafında:

- `METODBOX_TOKEN`
- `API_KEY`

## GitHub App izinleri

App yalnızca `hanefimert2016-oss/metodbox-on-demand-api` reposuna kurulmalı.

Repository permissions:

- Contents: Read and write
- Actions: Read-only

Worker her istek için GitHub App JWT üretir, kısa ömürlü installation token alır, repository_dispatch gönderir, Actions sonucunu bekler ve artifact cevabını OpenAI biçiminde geri döndürür.
