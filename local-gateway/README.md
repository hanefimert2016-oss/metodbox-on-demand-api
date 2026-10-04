# Local Gateway

Cloudflare kullanılmaz. API yalnızca sen `start.sh` çalıştırdığında açılır.

## İlk kurulum

```bash
cd local-gateway
chmod +x configure.sh start.sh
./configure.sh
```

İstenen üç bilgi:
- GitHub App ID
- GitHub Installation ID
- GitHub App private key .pem dosyasının yolu

Bunlar `~/.config/metodbox-on-demand-api/` altında chmod 600 ile tutulur.

## API'yi aç

```bash
./start.sh
```

Varsayılan adres:

```text
http://127.0.0.1:8787/v1
```

Cline:
- Base URL: `http://127.0.0.1:8787/v1`
- API Key: `~/.config/metodbox-proxy/api_key` dosyasındaki değer
- Model: `gpt-5.1` veya `gpt-oss:120b`

Sunucuyu kapatınca API de kapanır.
