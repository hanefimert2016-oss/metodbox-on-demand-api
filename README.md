# Metodbox Dot — Kendi Hafif AI Asistanımız

### Son güvenilirlik geliştirmeleri (8 Ekim 2026)

- **Eşzamanlı agent oluşturma:** GitHub SHA sürüm kontrolüyle her güncelleme son şifreli agent listesinden tekrar hesaplanır; `a1` çakışması veya diğer agentın kaybolması önlenir.
- **Eşzamanlı sohbet yanıtları:** Model aynı sohbet için iki ayrı istek alırsa mesajlar dosyanın en güncel sürümüne atomik eklenir. Gerçek Worker + GPT+ üzerinden iki eşzamanlı yanıt ve toplam altı mesaj testi başarılı.
- **Daha iyi mobil bekleme:** `◈ Ekip` panelindeki *PC'ler hazır olana kadar bekle* işaretliyken önce seçilen agent PC'leri sorgulanır ve gerektiğinde başlatılır. 3 dakikalık sınırlı beklemeden sonra paralel model görevleri başlar; kullanıcı beklemeyi iptal edebilir. İşaret kaldırılırsa yalnızca model görevi anında çalıştırılır (PC hazır olmayabilir).
- **PC heartbeat:** Yeni runner 3 dakikada bir çalıştığını bildirir; 10 dakika güncelleme yapmayan PC bağlantısı *stale* görünür ve yeniden başlatılabilir. Önceden açılmış eski runner'lar, kendi süreleri dolmadan yanlışlıkla stale olarak işaretlenmez.
- **Şifreli checkpoint:** PC açıkken her 15 dakikada bir ve kapanırken yedekleme denenir. Eski yedek okunamazsa sessizce üzerine yazılmaz; hata gösterilir. Son verilerin saklanması, GitHub özel depo kotasına ve başarılı checkpoint'e bağlıdır.

Bu sürüm **kalıcı açık sunucu değildir**: Cloudflare Worker sohbeti açar, GitHub Actions PC sadece belirli saatler çalışır. Otomatik görev bekleme, mobil sekme kapatılırsa devam etmez. Bağımsız, yeniden başlatılabilir arka plan görev kuyruğu ayrıca geliştirilmelidir.

Doğrulama: [İki gerçek GPT+ yanıtı ve şifreli geçmişin canlı testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37818302431) · [agent çakışması, PC eskimesi ve mobil UI testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37818520475).

## Çoklu agent ve ayrı kalıcı PC sistemi

**Mobil giriş:** <https://metodbox-direct-api.hanefimert2016.workers.dev/dot>. Giriş
yapmadıysan aynı sayfada admin formu çıkar; girişten sonra doğrudan Dot açılır.
Alan adının kök adresi de normal telefon tarayıcılarında /dot'a yönlenir.

- **Her yeni sohbetin ana bilgisayarı:** `ch-<conversation-uuid>`. Yeni
  sohbet oluşturulduğunda PC başlatma isteği Github Actions'a otomatik gönderilir;
  sohbet için bilgisayarın açılmasını beklemek gerekmez.
- **Alt agentlar:** `ch-<conversation-uuid>-a1` ... `-a6`. Her biri kendi
  izole Docker bilgisayarını, Chromium oturumunu, `/workspace` dosyalarını,
  terminalini ve tarayıcısını taşır. Bir chat'in PC ID'sini başka chat'ten
  kullanmaya izin verilmez.
- **Ana agent yönetimi:** Sohbette ana Dot araçlarla aynı turda 1-3 yeni alt
  agent oluşturabilir ve görevlerini GPT+ modeline **eşzamanlı** gönderebilir.
  Manuel **◈ Ekip** panelinden agent oluşturma, paralel çalıştırma,
  rapor görüntüleme, PC başlat/durdur, tarayıcıda site açma,
  web araması, ekran görüntüsü ve terminal kontrolü yapılır.
- **Ekip sayfası:** `/dot/team?chatId=<sohbet-id>`, yalnızca oturum açmış
  hesap ve o sohbete ait agent/PC yetkisiyle çalışır.
- **Agent sayısı:** sohbet başına en fazla 6 alt agent ve aynı görev turunda
  en fazla 3 model isteği. GitHub Actions runner eşzamanlılık/ücretsiz dakika
  limitleri ayrıca uygulanır.
- **Terminal güvenliği:** Doğrudan terminal komutu, portal şifresi en az 12
  karakterse ve arayüzde kullanıcı onayıyla çalışır. *Otonom* alt agent
  komutları ayrıca her sohbet için varsayılan kapalı **terminal izni**
  etkinleştirilirse kullanılabilir.
- **Sohbet ve agent görevleri:** AES-256-GCM şifreli thread ve
  `agent-storage/rosters/<sohbet-id>.enc.json` dosyaları hâlâ PRIVATE
  `hanefimert2016-oss/Metodbox-secret-system` `agent-data` dalında tutulur.
- **PC checkpoint:** Her PC'nin `agent-storage/pcs/<agent-id>/state.tar.gz.enc`
  dosyası kendi ayrılmış şifreli yedeğidir. PC kapanırken ve 15 dakikada
  bir yedekleme denenir. Yedek okunamazsa önceki yedek silinmez.
  GitHub'da tek dosya için uygulanan 80 MiB koruma sınırı nedeniyle
  büyük tarayıcı profilleri saklanamayabilir: bu durumda yalnız workspace
  yedeklenir; workspace de sınırı aşarsa uyarı çıkar ve eski yedek korunur.
  **Kesintisiz kalıcı VM veya kayıpsız yedek garantisi değildir.**
- **Aynı model, farklı PC:** Bütün agentlar mevcut Metodbox GPT+ model
  gateway'ini kullanır; *aynı bilgisayar veya terminal oturumunu paylaşmazlar*.

### Doğrulama bağlantıları

- [Canlı iki sohbet / iki alt agent / paralel model yanıtı / PC izolasyonu](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-live-dot-multiagent.yml)
- [Mock paralellik, mobil JS ve PC güvenliği testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-private-thread-storage.yml)
- [Gerçek PC tarayıcısı ve ekran görüntüsü](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-native-dot-pc.yml)

İpucu: **Dot açılmazsa** dış Chrome tarayıcısında yukarıdaki /dot adresini
açıp admin girişi yap, eski OpenDots bağlantısını kullanma. Mikrofon erişimi
için HTTPS tarayıcı izni gereklidir.



**Aktif sistem:** <https://metodbox-direct-api.hanefimert2016.workers.dev/dot>

Kod ve API hâlâ **[metodbox-on-demand-api](https://github.com/hanefimert2016-oss/metodbox-on-demand-api)** ana reposunda. Şifreli sohbet geçmişi ve PC yedekleri yalnızca **özel [Metodbox-secret-system](https://github.com/hanefimert2016-oss/Metodbox-secret-system)** deposunun `agent-data` dalında saklanır. Yeni bir repo açılmadı veya mevcut repoların rolü değiştirilmedi.

## Artık OpenDots/CopilotKit gerekmiyor

Yeni `/dot` arayüzü **Cloudflare Worker'da doğrudan sunuluyor**. React, OpenDots, CopilotKit Intelligence, Node uygulama sunucusu, ngrok veya sohbet için GitHub Actions sanal bilgisayarı gerektirmiyor. Eski `Launch Copilot App` workflow'u devre dışıdır; eski OpenDots/OpenBot uygulama runner'larına dur komutu gönderilmiştir.

- **Metin sohbeti:** Mevcut Metodbox GPT+ `gpt-5.1` API'si Worker içinde çağrılır. Tarayıcıya API token verilmez.
- **Geçmiş:** ThreadHub konuşma ve mesajları özel GitHub deposuna AES-GCM şifreli kaydeder.
- **Telefon görüşmesi görünümü:** Mikrofon girişi telefondaki Web Speech Recognition API üzerinden Türkçe metne çevrilir. Yanıtlar Microsoft Edge Read Aloud'un (resmî olmayan) Türkçe neural sesleriyle MP3'e dönüştürülür; servis erişilemezse telefonun `speechSynthesis` sesi kullanılır. Ses modeli cihazda veya Cloudflare'da yerel olarak yüklenmez.
- **Ses seçenekleri:** `tr-TR-EmelNeural`, `tr-TR-AhmetNeural` ve doğrudan cihaz TTS. Browser mikrofon desteği ve telefon ses motoruna göre davranış değişebilir.
- **Dot PC:** `PC Başlat` düğmesi GitHub Actions'ta ayrı izole agent bilgisayarı açar. `PC Durdur` geçici bilgisayarı kapatır; workspace/profiller özel depoya şifreli kaydedilir. Tarayıcı gezinmesi ve ekran görüntüsü native arayüze entegredir.
- **Terminal güvenliği:** Eski kısa giriş şifresiyle terminal komutları API üzerinden reddedilir. Uzaktan terminal için portal giriş şifresi en az 12 karakter olmalıdır; komutlar tarayıcıda ayrıca onaylanır.

### Android kullanımı

1. <https://metodbox-direct-api.hanefimert2016.workers.dev/apps> adresinden oturum aç. Kullanıcı adı `admin`; şifre kurulumda belirlediğin portal şifresidir.
2. **Dot'u Aç** düğmesine dokun veya doğrudan `/dot` adresine git.
3. Metin yaz veya **☎ Ara** ile telefon tarayıcısından sesli sohbeti başlat. Mikrofon izni ver; tercihen Android Chrome kullan.
4. Sanal bilgisayar gerekiyorsa sağ üstte **PC** düğmesini aç. PC'yi başlatmadan sohbet ve sesli görüşme de çalışır.

**Ses görüşmesi bir telefon numarasını aramaz; internet üzerinden uygulama içi konuşmadır.** Ses tanıma tarayıcının sağlayıcısına, Edge neural seslendirmesi Microsoft'un servisine veri gönderebilir. Edge TTS resmî bir API değildir; sınırlanabilir veya değişebilir. Native tarayıcı sesi yedektir.

### Güvenlik: `2026` gibi kısa bir şifreyi değiştir

Telefonun Termux uygulamasında `gh` ve `openssl-tool` yüklüyken:

```bash
read -rs -p "Yeni ve güçlü portal şifresi (12+ karakter): " NEW_PASS
printf '\n'
printf '%s' "$NEW_PASS" | gh secret set PORTAL_PASSWORD --repo hanefimert2016-oss/metodbox-on-demand-api --app actions
unset NEW_PASS
openssl rand -hex 32 | gh secret set PORTAL_SESSION_SECRET --repo hanefimert2016-oss/metodbox-on-demand-api --app actions
```

Sonrasında [Configure Private Thread Storage](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/configure-private-storage.yml) workflow'unu yeniden çalıştır. Bu işlem portal giriş şifresini ve oturum imzalama anahtarını Cloudflare'a dağıtır. **`STORAGE_ENCRYPTION_KEY` değerini değiştirme; aksi halde şifrelenmiş konuşmalar okunamayabilir.** Tokenı veya şifreni ChatGPT sohbetine yazma.

## GitHub Actions / Testler

- [Canlı Dot giriş, model yanıtı, AES-GCM geçmiş ve Edge ses testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-native-dot-live.yml)
- [Dot PC: gerçek GitHub VM, tarayıcı, ekran görüntüsü ve durdurma testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-native-dot-pc.yml)
- [Birim ve entegrasyon testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-private-thread-storage.yml)
- [Worker dağıtımı](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/deploy-cloudflare-worker.yml)

API ve workerın eski kullanım ayrıntıları için [AGENT_THREADS_INTEGRATION.md](AGENT_THREADS_INTEGRATION.md) ve GitHub workflow geçmişi durmaktadır. GitHub-hosted bilgisayarlar kalıcı değildir, tipik üst sınır 6 saattir ve Actions kullanım kotasını tüketir. Worker sohbeti PC workflow'una bağlı değildir.
