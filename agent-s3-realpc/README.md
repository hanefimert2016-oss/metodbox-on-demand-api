# Agent S3 + MethodBox GPT+ — gerçek PC kurulumu (deneysel)

Bu entegrasyon, Agent S3 bilgisayar kullanım sistemini kullanıcının **gerçek Arch Linux oturumuna** bağlamayı hedefler. Xvfb ya da geçici Github Actions masaüstü **yerine**, oturum açılmış yerel PC üzerinde çalışır. MethodBox mevcut OpenAI uyumlu gateway'ini kullanır:

- `https://metodbox-direct-api.hanefimert2016.workers.dev/v1`
- Ana model `gpt-5.1`
- **Deneysel grounding:** aynı `gpt-5.1` (koordinat tahmini UI-TARS gibi özel grounding modeliyle doğrulanmalı)
- Daha sonra yerel UI-Venus/UI-TARS ve Blender/Minecraft entegrasyonu planlanabilir.

## Ön kurulum (Arch Linux)

```bash
sudo pacman -S --needed python uv tesseract tesseract-data-eng wmctrl xdotool scrot zenity ydotool
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python gui-agents Pillow
```

Cloudflare Worker'ın `API_KEY` gizli değerini makinenizde (GitHub'a ya da sohbet mesajına değil) `OPENAI_API_KEY` ortam değişkenine koyun. Portal yönetici şifresi bu API anahtarının yerine geçmez.

X11 fiziksel masaüstü için (Wayland altında **doğrudan** çalışmaz):

```bash
agent_s --provider openai --model gpt-5.1 \
  --model_url https://metodbox-direct-api.hanefimert2016.workers.dev/v1 \
  --ground_provider openai --ground_model gpt-5.1 \
  --ground_url https://metodbox-direct-api.hanefimert2016.workers.dev/v1 \
  --grounding_width 1920 --grounding_height 1080 \
  --task 'Blender penceresini bul; dosya silme'
```

*Not:* `agent_s` Python sanal ortamında kurulur; `./.venv/bin/agent_s` kullanılabilir. Asıl GUI kodunun terminalden tetiklenmesi önce kullanıcının kendi ekranında denenmelidir.

## Wayland gerçek ekran

Resmî Agent S3 `pyautogui` kullanır. Wayland'de ekran görüntüsü için `grim` (wlroots), `spectacle` (KDE) veya `gnome-screenshot` ve fare/klavye için `ydotool` ile kullanıcı iznine bağlı özel bir köprü gerekir. Bu desteğin **ilk deneysel uygulaması ve test scriptleri**, aynı sohbet içinde `metodbox_s3_realpc_v1.zip` olarak hazırlanmıştır. İlk aşamada gerçek ekran ekran-görüntüsü ve API bağlantısı doğrulanmalı; sonra fare tıklatma denenmelidir.

**Güvenlik:** Gerçek masaüstü görüntüsü MethodBox GPT+ sağlayıcısına iletilir. Agent S3 ürettiği Python eylem kodunu kullanıcı haklarıyla yürütür; `--enable_local_env` açılmasa da risksiz değildir. Ana bilgisayarda ilk test yalnızca geçici dosyalarla ve yedek aldıktan sonra yapılmalıdır. API anahtarlarını asla bu public repoya kaydetmeyin.

## Aşama sırası

1. MethodBox API anahtarını doğrula (`/v1/chat/completions`)
2. Fiziksel masaüstü ekran görüntüsü ve fare/klavye izinlerini doğrula
3. Agent S3 + MethodBox ile geri alınabilir Blender görevi
4. Ayrı UI-TARS grounding modeli, sonra UI-Venus local inference
5. Crazy Craft Forge üzerinden oyun eylemleri
