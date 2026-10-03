# Metodbox On-Demand API

GitHub Actions üzerinde çalışan, yalnızca gerçek bir soru geldiğinde geçici runner açan GPT+ köprüsü.

## Mimari

```text
İstemci mesajı
  |
  | POST GitHub repository_dispatch
  v
GitHub
  |
  | mesajı görünce workflow otomatik başlar
  v
GitHub Actions Ubuntu runner
  |
  v
Metodbox GPT+ / gpt-5.1
  |
  v
response.json artifact
  |
  v
Runner kapanır
```

Repo klonlamak gerekmez. Boşta çalışan sunucu, daemon, health-check veya scheduler yoktur.

## Bir kere yapılacak kurulum

Metodbox tokenı yalnızca Actions Secret olarak tutulur:

```bash
gh secret set METODBOX_TOKEN \
  --repo hanefimert2016-oss/metodbox-on-demand-api \
  < ~/.config/metodbox-proxy/metodbox_token
```

## Mesaj gönderme — repo klonlamadan

GitHub'ın sabit REST endpoint'i API girişidir:

```text
POST https://api.github.com/repos/hanefimert2016-oss/metodbox-on-demand-api/dispatches
```

Örnek:

```bash
RID="$(python3 -c 'import uuid; print(uuid.uuid4())')"

curl -sS -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/hanefimert2016-oss/metodbox-on-demand-api/dispatches \
  -d "$(jq -nc \
    --arg q 'Sadece MERHABA yaz' \
    --arg id "$RID" \
    '{event_type:"metodbox_question",client_payload:{question:$q,request_id:$id}}')"
```

Bu HTTP isteği geldiği anda GitHub `repository_dispatch` olayını üretir ve
`.github/workflows/on-demand-api.yml` otomatik başlar.

## Cevap

Workflow adı:

```text
API Request <request_id>
```

Cevap artifact adı:

```text
api-response-<request_id>
```

İçinde:

```text
response.json
```

bulunur.

GitHub dispatch isteği senkron olarak model cevabını döndürmez. `204 No Content`
döndürür; model cevabı workflow tamamlandıktan sonra Actions artifact API'sinden alınır.

## Önemli sınır

GitHub Actions, boşta kapalıyken sonradan aynı TCP bağlantısına cevap verebilen bir
HTTP application server değildir. Bu nedenle saf GitHub-only tasarım asenkrondur:

```text
POST mesaj -> runner açılır -> result artifact -> GET sonuç
```

OpenAI uyumlu tek çağrıda `POST /v1/chat/completions -> cevap` davranışı istenirse,
isteği karşılamak için sürekli erişilebilir bir ingress/proxy gerekir.

## Kota davranışı

- Boştayken GPT+ isteği yok.
- Model listesi polling'i yok.
- Schedule yok.
- Her workflow GPT+'a yalnızca bir kullanıcı mesajı gönderir.
- Aynı anda yalnızca bir model isteği çalışır.
