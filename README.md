# Metodbox On-Demand API

GitHub Actions üzerinde çalışan, yalnızca gerçek bir soru geldiğinde geçici runner açan GPT+ köprüsü.

## Mimari

```text
İstemci
  |
  | GitHub REST API / workflow_dispatch
  v
GitHub Actions
  |
  | geçici Ubuntu runner
  v
Metodbox GPT+ / gpt-5.1
  |
  v
response.json artifact
  |
  v
İstemci sonucu indirir
  |
  v
Runner kapanır
```

Boşta çalışan sunucu, health-check, scheduler veya sürekli açık runner yoktur.

## Bir kere yapılacak kurulum

Metodbox tokenını bu repoya Actions secret olarak ekle:

```bash
gh secret set METODBOX_TOKEN \
  --repo hanefimert2016-oss/metodbox-on-demand-api \
  < ~/.config/metodbox-proxy/metodbox_token
```

Gerekli istemci araçları (Arch Linux):

```bash
sudo pacman -S github-cli jq
gh auth login
```

## Soru sorma

Repoyu klonla:

```bash
git clone https://github.com/hanefimert2016-oss/metodbox-on-demand-api.git
cd metodbox-on-demand-api
chmod +x ask.sh
```

Sonra:

```bash
./ask.sh "Sadece MERHABA yaz"
```

Her çağrı yeni bir `request_id` üretir, tek bir GitHub Actions workflow'u açar ve GPT+'a yalnızca bir kullanıcı sorusu gönderir.

## HTTP tetikleme

GitHub'ın kendi REST endpoint'i kullanılır:

```text
POST https://api.github.com/repos/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/on-demand-api.yml/dispatches
```

Örnek gövde:

```json
{
  "ref": "main",
  "inputs": {
    "question": "Merhaba, nasılsın?",
    "request_id": "benzersiz-id"
  }
}
```

Bu çağrı `204 No Content` döndürür. Cevap, workflow tamamlanınca
`api-response-<request_id>` adlı Actions artifact'ında `response.json` olarak bulunur.

## Kota davranışı

- Boştayken GPT+ isteği yok.
- Model listesi polling'i yok.
- Schedule yok.
- Her workflow, GPT+'a yalnızca bir kullanıcı mesajı gönderir.
- Aynı anda yalnızca bir model isteği çalışır; diğerleri GitHub kuyruğunda bekler.

## Güvenlik

`METODBOX_TOKEN` yalnızca GitHub Actions Secret olarak tutulmalıdır. Tokenı repoya commit etme.
İstemci tarafında GitHub kimlik doğrulaması için `gh auth login` kullanılır.
