# Metodbox On-Demand API

## Android / Termux kurulum (PC gerekmez)

Telefonunda **Termux** aç. Yeni şifreli veri deposunun PRIVATE olduğundan emin ol.

```bash
pkg update -y
pkg install -y curl gh openssl
curl -fsSL https://raw.githubusercontent.com/hanefimert2016-oss/metodbox-on-demand-api/main/github-runtime/setup-termux.sh -o ~/metodbox-termux.sh
bash ~/metodbox-termux.sh
```

Telefon kurulum aracı GitHub hesabını tarayıcı üzerinden doğrular,
**iki repo için tek bir fine-grained GitHub tokenı** ister, admin portal
şifresini gizli olarak alır ve gerekli Actions Secrets değerlerini kaydeder.
Mevcut Cloudflare kimlik bilgilerini yeniden oluşturmaz. İşlem sonunda
**Configure Private Thread Storage** workflow'unun adresini açar; dağıtım
oradan başlatılır. ngrok kurulumu gerekmez. Ayrıntılar:
[AGENT_THREADS_INTEGRATION.md](AGENT_THREADS_INTEGRATION.md).

## Aktif sistem — Cloudflare Worker (ngrok GEREKMİYOR)

- **Ana kod deposu:** [metodbox-on-demand-api](https://github.com/hanefimert2016-oss/metodbox-on-demand-api) (değişmedi)
- **Şifreli veri deposu:** [Metodbox-secret-system](https://github.com/hanefimert2016-oss/Metodbox-secret-system), `agent-data` dalı
- **Önemli:** Veri deposu başlangıçta public oluşturuldu; **önce PRIVATE yap**, yoksa servis veri saklamayı reddeder.
- **Giriş adresi:** https://metodbox-direct-api.hanefimert2016.workers.dev/apps
- **Kullanıcı adı:** `admin`; ilk şifreyi yerel kurulumda `2026` olarak gir
- **API base URL:** https://metodbox-direct-api.hanefimert2016.workers.dev/v1
- **Yeni gereken GitHub token:** Bir adet; iki depoya Contents Read/Write izni verilir
- **Kurulum:** [tek-token ve Cloudflare rehberi](AGENT_THREADS_INTEGRATION.md)

OpenDots ThreadHub ve bağımsız agent bilgisayarları mevcut Cloudflare Worker ile çalışacak.
Her agent PC kendi geçici GitHub Actions runner'ında başlar ve şifreli checkpoint dosyalarını
`Metodbox-secret-system` deposuna kaydeder. Worker sürekli bir endpoint sunabilir; GitHub runner
sürekli açık PC değildir. GitHub ve Cloudflare kotaları geçerlidir.

## Eski yöntem: ngrok üzerinden geçici API (isteğe bağlı, artık gerekli değil)

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


## OpenDots ThreadHub + her agent'a ayrı GitHub PC

Thread verilerini ve agent PC checkpoint dosyalarını özel `ai-application-suite-1` deposunun
`agent-data` dalında saklayan entegrasyon ana repoya eklendi. Mevcut Metodbox API,
ngrok workflow ve Cloudflare Worker yolları korunmuştur.

**[Tam kurulum ve API rehberi](AGENT_THREADS_INTEGRATION.md)**

PC kurulum komutu: `github-runtime/setup-private-storage.sh` (iki farklı scoped GitHub PAT ister).
Ardından **Actions → Configure Private Thread Storage** workflow'unu çalıştır.
Agent işlerini **Actions → Agent PC**, OpenDots'u **Actions → Launch Copilot App** üzerinden başlat.

**Dikkat:** GitHub-hosted bilgisayarlar geçicidir; API ve PC'ler anahtarlar
kurulup workflow'lar çalıştırılana kadar aktif değildir.
