const DEFAULT_REPO = "hanefimert2016-oss/metodbox-on-demand-api";
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

async function matchingSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const left = new Uint8Array(x), right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function portalLoginKey(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  // Avoid storing raw IPs in KV.
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))
    .then(bytes => "portal_login_fail:" + b64url(new Uint8Array(bytes)).slice(0, 32));
}

const APPS = {
  openbot: {
    id: "openbot",
    name: "OpenBot",
    description: "AI coworker workspace with a real browser, files and tools.",
    repo: "https://github.com/CopilotKit/OpenBot",
  },
  opendots: {
    id: "opendots",
    name: "OpenDots",
    description: "Persistent AI coworkers, Spaces, pages and conversations.",
    repo: "https://github.com/CopilotKit/OpenDots",
  },
};

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title, body, extra = "", status = 200) {
  return new Response(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#09090b">
  <title>${html(title)}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#09090b;color:#fafafa;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    a{color:inherit}.shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:min(980px,100%);background:#111113;border:1px solid #27272a;border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}
    .pad{padding:28px}.muted{color:#a1a1aa}.title{font-size:30px;line-height:1.1;margin:0 0 8px}.top{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:1px solid #27272a;padding:20px 28px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:22px}.app{padding:22px;border:1px solid #27272a;border-radius:18px;background:#18181b}.app h2{margin:0 0 8px}.app p{min-height:48px}
    .btn{appearance:none;border:0;border-radius:12px;padding:12px 16px;font-weight:700;cursor:pointer;background:#fafafa;color:#09090b}.btn.secondary{background:#27272a;color:#fafafa}.btn.danger{background:#3f1d22;color:#fecaca}
    .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.field{width:100%;padding:13px 14px;border-radius:12px;border:1px solid #3f3f46;background:#09090b;color:#fafafa;outline:none;margin-top:7px}.label{display:block;margin:14px 0 0;font-size:14px;color:#d4d4d8}
    .login{width:min(420px,100%)}.status{margin-top:16px;padding:13px 14px;border:1px solid #27272a;border-radius:12px;background:#0d0d0f;white-space:pre-wrap}.error{color:#fca5a5}.ok{color:#86efac}
    .viewer{width:100%;height:calc(100vh - 86px);border:0;background:#fff}.viewer-wrap{position:fixed;inset:0;background:#09090b}.viewer-bar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #27272a}
    .spinner{width:18px;height:18px;border:2px solid #3f3f46;border-top-color:#fafafa;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:700px){.grid{grid-template-columns:1fr}.pad{padding:20px}.top{padding:16px 20px}.title{font-size:26px}}
  </style>
  ${extra}
</head>
<body>${body}</body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    },
  });
}

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function b64urlText(text) {
  return b64url(new TextEncoder().encode(text));
}

function decodeB64urlText(value) {
  let x = value.replaceAll("-", "+").replaceAll("_", "/");
  while (x.length % 4) x += "=";
  const raw = atob(x);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text))));
}

async function createSession(env, username) {
  const secret = env.PORTAL_SESSION_SECRET || env.PORTAL_PASSWORD || env.API_KEY;
  const payload = b64urlText(JSON.stringify({
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  }));
  return payload + "." + await hmac(secret, payload);
}

export async function verifySession(request, env) {
  const secret = env.PORTAL_SESSION_SECRET || env.PORTAL_PASSWORD || env.API_KEY;
  if (!secret) return false;
  const token = parseCookies(request).mb_portal;
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".", 2);
  const expected = await hmac(secret, payload);
  if (sig !== expected) return false;
  try {
    const data = JSON.parse(decodeB64urlText(payload));
    return data.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
}

function loginPage(message = "", status = 200) {
  return page("Metodbox Apps", `
  <div class="shell">
    <div class="card login">
      <div class="pad">
        <p class="muted" style="margin-top:0">Metodbox Cloud Apps</p>
        <h1 class="title">Giriş yap</h1>
        <p class="muted">OpenBot ve OpenDots çalışma alanına erişmek için kullanıcı adı ve şifreni gir.</p>
        ${message ? `<div class="status error">${html(message)}</div>` : ""}
        <form method="post" action="/apps/login">
          <label class="label">Kullanıcı adı<input class="field" name="username" autocomplete="username" required></label>
          <label class="label">Şifre<input class="field" type="password" name="password" autocomplete="current-password" required></label>
          <button class="btn" style="width:100%;margin-top:18px" type="submit">Giriş yap</button>
        </form>
      </div>
    </div>
  </div>`, "", status);
}

function dashboardPage() {
  const cards = Object.values(APPS).map((app) => `
    <article class="app">
      <p class="muted" style="margin:0 0 7px">CopilotKit</p>
      <h2>${html(app.name)}</h2>
      <p class="muted">${html(app.description)}</p>
      <div class="row">
        <button class="btn" onclick="startApp('${app.id}')">Başlat</button>
        <a class="btn secondary" href="${app.repo}" target="_blank" rel="noreferrer">GitHub</a>
      </div>
      <div id="status-${app.id}" class="status muted">Durum kontrol ediliyor…</div>
    </article>
  `).join("");

  return page("Metodbox Apps", `
    <div class="shell">
      <main class="card">
        <header class="top">
          <div><strong>Metodbox Apps</strong><div class="muted" style="font-size:13px">Aynı GPT+ API altyapısı</div></div>
          <form method="post" action="/apps/logout"><button class="btn secondary" type="submit">Çıkış</button></form>
        </header>
        <section class="pad">
          <h1 class="title">Bir çalışma alanı seç</h1>
          <p class="muted">Seçtiğin uygulama GitHub Actions üzerinde geçici olarak başlar ve hazır olduğunda ekranı burada açılır.</p>
          <div class="grid">${cards}</div>
        </section>
      </main>
    </div>
    <script>
      async function status(app) {
        try {
          const r = await fetch('/apps/api/status?app=' + encodeURIComponent(app), {cache:'no-store'});
          const j = await r.json();
          const el = document.getElementById('status-' + app);
          if (!el) return;
          if (!r.ok) { el.textContent = j.error || 'Durum alınamadı'; el.className='status error'; return; }
          el.textContent = j.status === 'ready' ? 'Hazır — açmak için Başlat düğmesine dokun.' :
            j.status === 'starting' || j.status === 'requested' ? 'Başlatılıyor…' :
            j.status === 'error' ? 'Hata: ' + (j.message || 'bilinmeyen hata') :
            'Kapalı';
          el.className='status ' + (j.status==='ready' ? 'ok' : (j.status==='error' ? 'error' : 'muted'));
        } catch(e) {}
      }
      async function startApp(app) {
        const el = document.getElementById('status-' + app);
        el.textContent='Başlatma isteği gönderiliyor…'; el.className='status muted';
        const r = await fetch('/apps/api/start', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({app})
        });
        const j = await r.json();
        if (!r.ok) {
          el.textContent='Hata: ' + (j.error || 'Başlatılamadı');
          el.className='status error';
          return;
        }
        location.href='/apps/run/' + app;
      }
      ['openbot','opendots'].forEach(status);
      setInterval(()=>['openbot','opendots'].forEach(status),5000);
    </script>
  `);
}

function runnerPage(app) {
  return page(app.name + " · Metodbox Apps", `
    <div class="viewer-wrap">
      <div class="viewer-bar">
        <div class="row"><a class="btn secondary" href="/apps">← Geri</a><strong>${html(app.name)}</strong></div>
        <div class="row"><span id="state" class="muted">Başlatılıyor…</span><span id="spin" class="spinner"></span><a class="btn secondary" id="external" href="#" target="_blank" rel="noopener noreferrer" style="display:none">Yeni sekmede aç</a><button class="btn danger" onclick="stopApp()">Durdur</button></div>
      </div>
      <div id="waiting" class="shell" style="min-height:calc(100vh - 64px)">
        <div style="text-align:center;max-width:540px">
          <h2>${html(app.name)} hazırlanıyor</h2>
          <p class="muted" id="detail">GitHub runner ve Cloudflare bağlantısı hazırlanıyor.</p>
          <p class="muted" id="help">İlk kurulumda indirme ve derleme sürebilir. Bu sayfa işlemi otomatik takip eder.</p>
          <p><a class="btn secondary" href="https://github.com/hanefimert2016-oss/metodbox-on-demand-api/actions/workflows/launch-copilot-app.yml" target="_blank" rel="noopener noreferrer">GitHub Actions durumunu gör ↗</a></p>
        </div>
      </div>
    </div>
    <script>
      const app=${JSON.stringify(app.id)};
      const started=Date.now();
      async function poll(){
        const state=document.getElementById('state');
        const detail=document.getElementById('detail');
        const help=document.getElementById('help');
        try {
          const r=await fetch('/apps/api/status?app='+encodeURIComponent(app),{cache:'no-store'});
          const j=await r.json();
          if(!r.ok){state.textContent='Hata'; detail.textContent=j.error||'Durum alınamadı'; setTimeout(poll,5000);return;}
          state.textContent=j.status||'unknown';
          if(j.status==='ready' && j.url){
            const external=document.getElementById('external');
            const dest=new URL(j.url);
            if(dest.protocol!=='https:' || !dest.hostname.endsWith('.trycloudflare.com')) {
              state.textContent='Bağlantı hatası';
              detail.textContent='Beklenmeyen çalışma adresi; GitHub Actions kayıtlarını kontrol et.';
              document.getElementById('spin').style.display='none';
              return;
            }
            external.href=dest.href;
            external.style.display='inline-block';
            document.getElementById('spin').style.display='none';
            state.textContent='Hazır';
            detail.textContent='OpenDots doğrudan tarayıcıda açılıyor. Açılmazsa Yeni sekmede aç bağlantısını kullan.';
            help.textContent='Güvenlik nedeniyle OpenDots iframe içinde çalışmaz; doğrudan açılması gerekir.';
            // The upstream app forbids iframe embedding (X-Frame-Options/CSP).
            // Same-tab navigation works on mobile and preserves token-based app login.
            window.location.replace(dest.href);
            return;
          }
          if(j.status==='error' || j.status==='stopped'){
            document.getElementById('spin').style.display='none';
            detail.textContent=j.message||'Uygulama durdu. Ana sayfadan tekrar başlatabilirsiniz.';
            help.textContent='Ayrıntılar için GitHub Actions bağlantısını aç.';
            return;
          }
          detail.textContent=j.message||'GitHub Actions üzerinde hazırlanıyor…';
          if(Date.now()-started>4*60*1000){
            help.textContent='Başlatma uzun sürüyor. Hata mı, devam eden derleme mi olduğunu GitHub Actions sayfasından görebilirsin.';
          }
          setTimeout(poll,3000);
        } catch(e) {
          state.textContent='Yeniden bağlanıyor';
          detail.textContent='Durum alınamadı. İnternet bağlantısı kontrol edilip yeniden denenecek.';
          setTimeout(poll,5000);
        }
      }
      async function stopApp(){
        await fetch('/apps/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app})});
        location.href='/apps';
      }
      poll();
    </script>
  `);
}

async function triggerLaunch(env, app) {
  const token = env.GITHUB_TRIGGER_TOKEN;
  if (!token) throw new Error("GITHUB_TRIGGER_TOKEN Worker secret eksik");
  const repo = env.GITHUB_LAUNCH_REPO || DEFAULT_REPO;
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "metodbox-app-launcher",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "launch_copilot_app",
      client_payload: { app },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub launch HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
}

function requireApp(id) {
  return APPS[String(id || "").toLowerCase()] || null;
}

export async function handlePortalRequest(request, env, url) {
  if (!url.pathname.startsWith("/apps")) return null;

  if (url.pathname === "/apps/login" && request.method === "POST") {
    // Same-origin forms only. Rate-limit even invalid usernames.
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) {
      return new Response("Origin denied", { status: 403 });
    }
    if (!env.PORTAL_PASSWORD || !env.PORTAL_SESSION_SECRET) {
      return new Response("Portal password/session secrets are not configured", { status: 503 });
    }
    const key = await portalLoginKey(request);
    const failures = Number(await env.AUTH_KV.get(key) || 0);
    if (failures >= MAX_LOGIN_FAILURES) {
      return loginPage("Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.", 429);
    }
    const form = await request.formData();
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const expectedUser = env.PORTAL_USERNAME || "admin";
    const validUser = await matchingSecret(username, expectedUser);
    const validPassword = await matchingSecret(password, env.PORTAL_PASSWORD);
    if (!validUser || !validPassword) {
      await env.AUTH_KV.put(key, String(failures + 1), { expirationTtl: LOGIN_LOCK_SECONDS });
      return loginPage("Kullanıcı adı veya şifre yanlış.", 401);
    }
    await env.AUTH_KV.delete(key);
    const token = await createSession(env, username);
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/apps",
        "Set-Cookie": `mb_portal=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (url.pathname === "/apps/logout" && request.method === "POST") {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/apps",
        "Set-Cookie": "mb_portal=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      },
    });
  }

  if (request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) {
      return new Response("Origin denied", { status: 403 });
    }
  }

  if (!(await verifySession(request, env))) {
    if (url.pathname.startsWith("/apps/api/")) {
      return new Response(JSON.stringify({ error: "Oturum gerekli" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return loginPage();
  }

  if ((url.pathname === "/apps" || url.pathname === "/apps/") && request.method === "GET") {
    return dashboardPage();
  }

  if (url.pathname.startsWith("/apps/run/") && request.method === "GET") {
    const app = requireApp(url.pathname.split("/").pop());
    if (!app) return new Response("Not found", { status: 404 });
    return runnerPage(app);
  }

  if (url.pathname === "/apps/api/status" && request.method === "GET") {
    const app = requireApp(url.searchParams.get("app"));
    if (!app) return Response.json({ error: "Geçersiz uygulama" }, { status: 400 });
    const raw = await env.AUTH_KV.get(`copilot_runtime:${app.id}`);
    if (!raw) return Response.json({ app: app.id, status: "stopped" });
    try {
      return Response.json(JSON.parse(raw));
    } catch (_) {
      return Response.json({ app: app.id, status: "unknown" });
    }
  }

  if (url.pathname === "/apps/api/start" && request.method === "POST") {
    let payload = {};
    try { payload = await request.json(); } catch (_) {}
    const app = requireApp(payload.app);
    if (!app) return Response.json({ error: "Geçersiz uygulama" }, { status: 400 });

    // Multiple taps on mobile must not dispatch more GitHub jobs. Each new
    // dispatch cancels an existing same-app workflow because of concurrency.
    const existingRaw = await env.AUTH_KV.get(`copilot_runtime:${app.id}`);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (["requested", "starting", "ready"].includes(existing.status)) {
          return Response.json({
            ok: true,
            app: app.id,
            status: existing.status,
            already_running: true,
          });
        }
      } catch (_) {}
    }

    await env.AUTH_KV.delete(`copilot_stop:${app.id}`);
    await env.AUTH_KV.put(
      `copilot_runtime:${app.id}`,
      JSON.stringify({ app: app.id, status: "requested", message: "Başlatma isteği GitHub'a gönderiliyor.", updated_at: Date.now() }),
      { expirationTtl: 6 * 60 * 60 }
    );

    try {
      await triggerLaunch(env, app.id);
      return Response.json({ ok: true, app: app.id, status: "requested" });
    } catch (error) {
      const message = error?.message || String(error);
      await env.AUTH_KV.put(
        `copilot_runtime:${app.id}`,
        JSON.stringify({ app: app.id, status: "error", message, updated_at: Date.now() }),
        { expirationTtl: 60 * 60 }
      );
      return Response.json({ error: message }, { status: 503 });
    }
  }

  if (url.pathname === "/apps/api/stop" && request.method === "POST") {
    let payload = {};
    try { payload = await request.json(); } catch (_) {}
    const app = requireApp(payload.app);
    if (!app) return Response.json({ error: "Geçersiz uygulama" }, { status: 400 });
    await env.AUTH_KV.put(`copilot_stop:${app.id}`, "1", { expirationTtl: 10 * 60 });
    await env.AUTH_KV.put(
      `copilot_runtime:${app.id}`,
      JSON.stringify({ app: app.id, status: "stopping", message: "Durdurma isteği gönderildi.", updated_at: Date.now() }),
      { expirationTtl: 60 * 60 }
    );
    return Response.json({ ok: true });
  }

  return new Response("Not found", { status: 404 });
}
