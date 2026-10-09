# Metodbox Dot — Kendi Hafif AI Asistanımız

### Son güvenilirlik geliştirmeleri (8 Ekim 2026)

- **Eşzamanlı agent oluşturma:** GitHub SHA sürüm kontrolüyle her güncelleme son şifreli agent listesinden tekrar hesaplanır; `a1` çakışması veya diğer agentın kaybolması önlenir.
- **Eşzamanlı sohbet yanıtları:** Model aynı sohbet için iki ayrı istek alırsa mesajlar dosyanın en güncel sürümüne atomik eklenir. Gerçek Worker + GPT+ üzerinden iki eşzamanlı yanıt ve toplam altı mesaj testi başarılı.
- **Daha iyi mobil bekleme:** `◈ Ekip` panelindeki *PC'ler hazır olana kadar bekle* işaretliyken önce seçilen agent PC'leri sorgulanır ve gerektiğinde başlatılır. 3 dakikalık sınırlı beklemeden sonra paralel model görevleri başlar; kullanıcı beklemeyi iptal edebilir. İşaret kaldırılırsa yalnızca model görevi anında çalıştırılır (PC hazır olmayabilir).
- **PC heartbeat:** Yeni runner 3 dakikada bir çalıştığını bildirir; 10 dakika güncelleme yapmayan PC bağlantısı *stale* görünür ve yeniden başlatılabilir. Önceden açılmış eski runner'lar, kendi süreleri dolmadan yanlışlıkla stale olarak işaretlenmez.
- **Şifreli checkpoint:** PC açıkken her 15 dakikada bir ve kapanırken yedekleme denenir. Eski yedek okunamazsa sessizce üzerine yazılmaz; hata gösterilir. Son verilerin saklanması, GitHub özel depo kotasına ve başarılı checkpoint'e bağlıdır.

Bu sürüm **kalıcı açık sunucu değildir**: Cloudflare Worker sohbeti açar, GitHub Actions PC sadece belirli saatler çalışır. Otomatik görev bekleme, mobil sekme kapatılırsa devam etmez. Bağımsız, yeniden başlatılabilir arka plan görev kuyruğu ayrıca geliştirilmelidir.

Doğrulama: [İki gerçek GPT+ yanıtı ve şifreli geçmişin canlı testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37818302431) · [agent çakışması, PC eskimesi ve mobil UI testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37818520475).

## Dot Desktop v0.6 — gerçek XFCE masaüstü

Dot Studio'nun PC panelindeki Linux artık **Openbox değil; tam XFCE oturumu**dur.
GitHub üzerinde geçici PC'ler için KDE Plasma yerine XFCE seçildi: daha az
RAM/CPU ile gerçek pencereler, uygulama menüsü, görev çubuğu, dosya yöneticisi
ve grafik terminal sunuyor.

- **XFCE 4 / X11**: `xfce4-session`, `xfwm4`, `xfdesktop`, `xfce4-panel`.
- **Uygulamalar**: Thunar, XFCE Terminal, Chromium; isteğe bağlı Whisker menüsü.
- **Görünüm**: Arc-Dark, Papirus-Dark simgeler, Noto yazı tipi ve Metodbox
  markalı masaüstü arka planı.
- **Gerçek GUI I/O**: Aynı Xvfb ekranından `/desktop/screenshot` alınır,
  `/desktop/click`, `/desktop/type`, `/desktop/key` ve `/desktop/scroll`
  ile fare/klavye kontrolü korunur. Ek VNC/RDP portu açılmaz.
- **Kalıcı ayarlar**: XFCE konfigürasyonu agent'a özel `/profiles/xfce-config`
  dizinindedir. Önceki şifreli snapshot başarıyla kaydedilip geri yüklendiği
  sürece kişisel ayarlar korunabilir. GHCR imajı
  `ghcr.io/hanefimert2016-oss/metodbox-dot-desktop:xfce-v2` etiketiyle
  ortak şekilde önceden hazırlanır, böylece her PC için XFCE baştan kurulmaz.

**Önemli:** Daha ağır XFCE imajının ilk defa indirilmesi zaman alabilir;
GitHub runner sırası ortadan kalkmaz. Halihazırda çalışan Openbox bilgisayarları
yeniden başlatılana kadar eski masaüstünü göstermeye devam eder.
Kısa portal şifresinin uzaktan fare/klavye komutlarını engelleyen güvenlik
kuralı aynen geçerlidir.

[Hazır XFCE imajının GitHub build'i](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/build-dot-desktop-image.yml) ·
[Gerçek XFCE oturum, ekran ve kontrol testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-openbox-desktop.yml).

## Dot Studio v0.5 — gerçek streaming ve daha hızlı PC açılışı

**Doğrudan aç:** https://metodbox-direct-api.hanefimert2016.workers.dev/dot

- **Arayüz sıfırdan yenilendi:** Minimal koyu renkli Dot Studio, daha sade
  sohbet alanı, ajan listesi, mobil yan panel, Linux masaüstü ve
  yanıtı durdurma düğmesi.
- **Gerçek model streaming:** `POST /dot/api/message/stream` konuşma ve araç
  adımlarını SSE ile iletir. `event: token` her gerçek GPT+ akış parçasını
  taşır, `event: status` bilgisayar aracı durumunu, `event: done`
  tamamlanan yanıtın özel depoya yazılma sonucunu bildirir.
  Akış `TextDecoder` ve `ReadableStream` ile telefonda kademeli çizilir.
  Geriye dönük eski `POST /dot/api/message` JSON yolu saklıdır.
- **Canlı akış doğrulaması:** Gerçek model yanıtı **98 token olayı** halinde
  geldi; ilk metin parçası **3,64 saniye** sonra iletildi ve tam yanıt
  şifreli konuşma geçmişine kaydedildi. Bu sayı test koşullarına özeldir.
- **PC imajını her seferinde tekrar derlemiyor:** GitHub Actions
  `build-dot-desktop-image.yml` yalnızca masaüstü kaynakları değiştiğinde
  `ghcr.io/hanefimert2016-oss/metodbox-dot-desktop:openbox-v1` imajını
  oluşturup GHCR'a yayımlar. `launch-agent-pc.sh` imajı çekip çalıştırır.
  İmaj erişilemezse güvenli eski kaynak derlemesi yedek olarak kalır.
  İlk örnek testte imaj indirmeden PC hazır olana kadar yaklaşık **29 saniye**
  ölçüldü. GitHub runner kuyruğu bu ölçüme dahil değildir.
- **Sohbet, PC başlatmayı beklemiyor:** Yeni sohbet çağrısı Cloudflare
  Worker'ın `waitUntil` mekanizmasıyla GitHub dispatch'i arka plana alır.
  Her sohbet kendine özel bilgisayar kimliğini korur; masaüstü ekranı
  ancak runner hazır olduğunda çalışır.
- **Korunan mevcut sistem:** Her sohbet/alt agent PC'si ayrıdır; terminal ve
  fare/klavye AI yetkileri güçlü portal şifresi ve kullanıcı onayı ister.
  PC çalışma klasörleri ve Chromium profilleri, başarılı kontrol noktalarında
  eski özel `Metodbox-secret-system` deposuna şifreli yedeklenir.

**Gerçek testler:** [SSE test kaydı](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37882350657),
[GHCR hazır PC test kaydı](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/runs/37882364903),
[Streaming araç akışı ve arka plan PC testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-private-thread-storage.yml),
[GitHub PC imajı yayını](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/build-dot-desktop-image.yml).

Not: GitHub Actions gerçek zamanlı sürekli PC servisi değildir. Runner için
başlangıç ve kuyruk gecikmeleri, çalışma süresi ve kota sınırları devam eder.
Streaming yanıtı durdurulduğunda tamamlanmamış cevap geçmişe yazılmayabilir.

## Dot Studio — gerçek Linux masaüstü (v0.4)

**Bağlantı:** [Metodbox Dot Studio](https://metodbox-direct-api.hanefimert2016.workers.dev/dot)

Eski OpenDots/CopilotKit arayüzünü yeniden kullanmıyoruz. Sıfırdan yazılan
Dot Studio sayfasında telefon ve bilgisayar için uyarlanabilir sohbet arayüzü,
**◈ Agentlar** paneli ve **▣ Masaüstü** paneli var. UI Cloudflare Worker'dan
anında açılır; PC açılışı için beklemek yalnızca masaüstü gerektiğinde gerekir.

**Masaüstü altyapısı:**
- Her sohbetin ana PC'si ve her alt agent'ın kendi ayrı Docker/GitHub Actions
  çalışma ortamı var. `github-runtime/patch-metodbox-desktop.py` mevcut
  sabitlenmiş OpenBot bilgisayarını geçici build klasöründe geliştirir.
- Hafif gerçek **Openbox + tint2 + xterm** masaüstü, 1280×800 sanal X11
  ekranında çalışır. Chromium `COMPUTER_BROWSER_MODE=headed` ile
  **aynı Xvfb ekranına** açılır. RAM tüketimi ağır bir masaüstünden düşüktür.
  MicroDesk henüz kurulmadı.
- PC'nin HMAC tokenıyla kimliği doğrulanmış `/desktop/info`,
  `/desktop/screenshot`, `/desktop/click`, `/desktop/type`,
  `/desktop/key`, `/desktop/scroll` uç noktaları vardır.
  İnternet üzerinde yeni açık VNC/RDP portu oluşturulmaz.
- Dot Studio masaüstü panelinde canlı ekranı görebilir, ekrana dokunarak
  tıklayabilir, Türkçe metin yazmayı deneyebilir, kısayol gönderebilir,
  Chromium'da web sitesi açabilir ve onayla terminal çalıştırabilirsin.
  Ekran görüntüsü düzenli sorgulanır; ağ/sunum maliyetini sınırlamak için
  gerçek zamanlı 60 FPS video aktarımı değildir.
- Model araçları: `dot_browser_snapshot`, `dot_browser_click`,
  `dot_browser_type`, `dot_browser_key` ile UI öğesi temelli
  Computer Use; `dot_desktop_see`, `dot_desktop_click`,
  `dot_desktop_type`, `dot_desktop_key` ile görüntü temelli kullanım.
  Gerçek GPT+ model gateway'inde geçerli PNG görsel girdisi doğrulandı.
  Ekran görüntüleri izin verilirse model sağlayıcısına gönderilir.

**Güvenlik:** Masaüstü kontrolü ve AI'nın ekranı görüp tıklaması
varsayılan **kapalıdır**. Her sohbette ayrı `AI'ın masaüstünde
fare/klavye kullanmasına izin ver` seçeneği vardır. Ayrıca portal giriş
şifresi en az **12 karakter** olmalıdır. Mevcut `2026` şifresiyle bu
yetki açılamaz. Bu, hem kullanıcının hesap güvenliği hem de masaüstündeki
kişisel dosyalar için bilinçli bir sınırlamadır.

**Durum ve yedekler:** Her PC'nin kişisel `/workspace` ve Chromium profili
özel şifreli GitHub deposuna kapanışta, ayrıca her 15 dakikada bir
yedeklenmeye çalışılır. Klasörler aynı sohbet/agent ID'siyle yeniden
başlatılabilir. Yedekleme başarılı olmalı; 80 MiB arşiv güvenlik sınırı
ve GitHub PC çalışma süresi halen geçerlidir.

**Testler:** [gerçek ana ve alt agent Openbox ekranı](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-native-dot-pc.yml),
[yerel PC üzerinde fare/klavye testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-openbox-desktop.yml),
[canlı GPT+ görsel girdi testi](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-dot-desktop-vision.yml)
ve [Dot güvenlik testleri](https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/test-private-thread-storage.yml).

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
