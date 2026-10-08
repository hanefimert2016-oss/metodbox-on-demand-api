# Metodbox On-Demand API

## Android / Termux kurulum (PC gerekmez)

Telefonunda **Termux** aç. Yeni şifreli veri deposunun PRIVATE olduğundan emin ol.

```bash
pkg update -y
pkg install -y curl gh openssl-tool
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

## Dot PC, mesajlaşma ve telefondan sesli görüşme (8 Ekim 2026)

- Dot PC hatası (exit 7): Docker `--cap-drop ALL` altında host'a bağlı
  `/workspace` ve `/profiles` dizinleri `EACCES` veriyordu.
  Başlatmadan önce yalnızca bu iki klasörün sahipliği container UID 0'a,
  durdurma sonrası host runner'a devredilir. **Docker güvenlik bayrakları kaldırılmadı.**
- Sohbet cevapları: gerçek Worker GPT+ API'si ve ThreadHub create/read/delete
  ile araçlı SSE iletişimi canlı GitHub Actions testlerinden geçirildi.
  OpenDots, GitHub geçmişini okumada geçici hata olduğunda canlı chat
  bağlantısını bloke etmemeye ve kaydetme başarısızlığını kullanıcıya
  ayrı bildirmeye güncellendi.
- Sesli görüşme: Orijinal OpenDots WebRTC arama butonu mevcuttur; yeni
  oturumlarda ayrı `VOICE_API_KEY` Actions Secret'ı varsa etkinleşir.
  Ses OpenAI'ın Realtime API'sine gönderilir, GPT+ model API'si ses
  sağlayıcısı değildir. **OpenAI Realtime API'nin ayrı erişim/ücretlendirmesi olabilir.**
  Bu özellik normal GSM/telefon numarası araması değildir.

### Termux'tan isteğe bağlı sesli görüşmeyi etkinleştirme

Önce kendi OpenAI API projen için Realtime erişimi olan API anahtarını
[OpenAI API Keys](https://platform.openai.com/api-keys) sayfasında oluştur.

```bash
curl -fsSL https://raw.githubusercontent.com/hanefimert2016-oss/metodbox-on-demand-api/main/github-runtime/configure-voice-termux.sh -o ~/configure-voice.sh
bash ~/configure-voice.sh
```

Anahtar GitHub Actions Secrets'a gizli biçimde kaydedilir; repo veya chat'te
paylaşılmaz. OpenDots'u durdurup yeni bir oturum başlattıktan sonra Dot chat
ekranındaki telefon simgesi etkinleşir. Tarayıcıdan mikrofon izni vermelisin.

Model gateway ve PC teşhislerini manuel tekrar çalıştırmak için:
[Diagnose Metodbox Model and Agent PC](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/diagnose-metodbox-runtime.yml).

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
