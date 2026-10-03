# Metodbox On-Demand API

GitHub Actions üzerinde yalnızca gerçek bir istek geldiğinde geçici runner açan GPT+ köprüsü.

## Actions Secrets

Bu repo iki secret kullanır:

```text
METODBOX_TOKEN
API_KEY
```

Mevcut yerel değerleri GitHub Actions Secrets'a koy:

```bash
gh secret set METODBOX_TOKEN \
  --repo hanefimert2016-oss/metodbox-on-demand-api \
  < ~/.config/metodbox-proxy/metodbox_token

gh secret set API_KEY \
  --repo hanefimert2016-oss/metodbox-on-demand-api \
  < ~/.config/metodbox-proxy/api_key
```

Değerleri görmek zorunda değilsin ve chat'e göndermemelisin.

## GitHub tarafındaki API sözleşmesi

`repository_dispatch` payload'ı artık özel API anahtarı ile HMAC-SHA256 imzalanır.

İmza girdisi tam olarak:

```text
<unix_timestamp>\n<request_id>\n<question>
```

İmza:

```text
HMAC-SHA256(API_KEY, yukarıdaki metin)
```

Dispatch payload:

```json
{
  "event_type": "metodbox_question",
  "client_payload": {
    "question": "Sadece MERHABA yaz",
    "request_id": "benzersiz-id",
    "ts": "unix-timestamp",
    "sig": "hmac-sha256-hex"
  }
}
```

Workflow, GPT+'ı açmadan önce `sig` değerini `secrets.API_KEY` ile doğrular.
Beş dakikadan eski istekler replay koruması için reddedilir.

## Akış

```text
API istemcisi
  |
  | Authorization: Bearer <API_KEY>
  v
HTTPS ingress
  |
  | GitHub kimlik bilgisi ingress içinde gizli
  | HMAC imzalı repository_dispatch
  v
GitHub Actions
  |
  | secrets.API_KEY ile imza doğrulama
  | secrets.METODBOX_TOKEN ile GPT+ oturumu
  v
GPT+ / gpt-5.1
  |
  v
response.json artifact
  |
  v
runner kapanır
```

## Neden yine bir ingress gerekiyor?

GitHub'ın `/repos/.../dispatches` REST endpoint'i kendi GitHub kimlik doğrulamasını zorunlu tutar.
Bu yüzden `API_KEY` doğrudan GitHub'ın Authorization header'ının yerine geçemez.

Bu repo artık kendi API anahtarımızı doğrulayacak şekilde hazırdır, fakat son kullanıcıya yalnızca:

```text
URL + API_KEY
```

göstermek için önünde küçük ve sürekli erişilebilir bir HTTPS ingress bulunmalıdır. Ingress GitHub tokenını
kullanıcıdan gizler, gelen `API_KEY` değerini doğrular ve GitHub'a imzalı dispatch gönderir.

## Yerel imzalı dispatch testi

`ask.sh` mevcut `~/.config/metodbox-proxy/api_key` dosyasını kullanarak aynı HMAC imzasını üretir.
Bu yalnızca GitHub tarafındaki imza doğrulamasını test etmek içindir; GitHub endpoint'ine çağrı yaptığı
için yerel `gh` oturumu gerektirir.

```bash
./ask.sh "Sadece MERHABA yaz"
```

## Güvenlik

- `METODBOX_TOKEN` ve `API_KEY` repoya commit edilmez.
- Ham API key repository_dispatch payload'ına yazılmaz.
- Workflow yalnızca HMAC imzasını görür.
- İstekler 5 dakikalık zaman penceresi ile doğrulanır.


## Cline/OpenAI uyumlu HTTPS giriş

Repo artık `cloudflare-worker/` altında Cline'ın doğrudan kullanabileceği OpenAI uyumlu giriş kodunu da içerir.

Hedef:

```text
Cline
  -> POST /v1/chat/completions + API_KEY
  -> Cloudflare Worker
  -> GitHub App installation token
  -> GitHub Actions
  -> GPT+
  -> OpenAI-compatible response
```

Cline tarafında GitHub tokenı veya GitHub oturumu yoktur. GitHub kimliği yalnızca Worker'ın GitHub App secretlarında tutulur.
