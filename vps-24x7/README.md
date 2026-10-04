# 24/7 VPS kurulumu

Bu klasör, Metodbox GPT+ köprüsünü ücretsiz/uygun bir Linux VM üzerinde sürekli servis olarak çalıştırmak için hazırlanmıştır.

## Önerilen VM

En rahat ücretsiz seçenek OCI Always Free Ampere A1'dir. Bu proje GPU kullanmaz; GPT modelinin kendisi Metodbox tarafında çalışır. Sunucunun işi yalnızca:

- FastAPI/OpenAI-compatible endpoint
- başlangıçta kısa süreli headless Chromium oturum bootstrap'i
- GPT+ HTTP isteklerini proxy etmek

## Donanım

- Minimum: 1 vCPU, 1 GB RAM + 1-2 GB swap
- Önerilen: 1-2 vCPU, 2 GB+ RAM
- GPU: gerekmez
- Disk: uygulama için yaklaşık 1-2 GB ek alan; işletim sistemiyle 10 GB+ rahat
- Mimari: x86_64 veya arm64

## HTTPS

Ücretsiz bir DuckDNS alt alan adı kullanılabilir, örneğin:

```text
mert-metodbox.duckdns.org
```

DuckDNS kaydını VM'nin public IPv4 adresine yönlendir. OCI Security List/NSG içinde inbound TCP 80 ve 443'ü aç.

## Kurulum

VM içinde:

```bash
git clone https://github.com/hanefimert2016-oss/metodbox-on-demand-api.git
cd metodbox-on-demand-api/vps-24x7
chmod +x install-oracle.sh update.sh
sudo ./install-oracle.sh mert-metodbox.duckdns.org
```

Script API_KEY ve METODBOX_TOKEN değerlerini gizli olarak sorar; repoya yazmaz.

Bittiğinde:

```text
https://mert-metodbox.duckdns.org/v1
```

telefon, Cline veya başka OpenAI-compatible istemcilerden kullanılabilir.

## Güncelleme

```bash
cd ~/metodbox-on-demand-api
git pull
cd vps-24x7
sudo ./update.sh
```

## Servis

```bash
sudo systemctl status metodbox-api
sudo journalctl -u metodbox-api -f
```

METODBOX_TOKEN'in kendisi süresi dolarsa yeni token ile `/etc/metodbox-api/metodbox_token` dosyasını güncelleyip servisi yeniden başlatmak gerekir.
