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
  return page("Metodbox Dot", `
    <div class="shell">
      <main class="card">
        <header class="top">
          <div><strong>✦ Metodbox Dot</strong><div class="muted" style="font-size:13px">Kendi hafif asistanın · CopilotKit/OpenDots gerekmez</div></div>
          <form method="post" action="/apps/logout"><button class="btn secondary" type="submit">Çıkış</button></form>
        </header>
        <section class="pad">
          <h1 class="title">Yeni Dot'un hazır</h1>
          <p class="muted">Sohbet ve sesli görüşme Cloudflare üzerinde anında açılır.
            Bilgisayar yalnızca ihtiyaç olduğunda GitHub'da başlatılır.
            Şifreli konuşmalar Metodbox-secret-system deposunda kalır.</p>
          <div class="grid" style="grid-template-columns:1fr">
            <article class="app">
              <h2>✦ Metodbox Dot</h2>
              <p class="muted">Hafif sohbet, telefon görüşmesi arayüzü, özel PC ve geçmiş.</p>
              <a class="btn" style="display:inline-block;text-decoration:none" href="/dot">Dot'u Aç →</a>
            </article>
          </div>
        </section>
      </main>
    </div>`);
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
    const returnTo = String(form.get("return_to") || "") === "/dot" ? "/dot" : "/apps";
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
        Location: returnTo,
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
    return Response.redirect(url.origin + "/dot", 302);
  }

  if (url.pathname === "/apps/api/status" && request.method === "GET") {
    return Response.json({status:"retired",url:"/dot"});
  }

  if (url.pathname === "/apps/api/start" && request.method === "POST") {
    return Response.json({ error: "Eski uygulama kapatıldı. /dot adresini kullan." }, { status: 410 });
  }

  if (url.pathname === "/apps/api/retire" && request.method === "POST") {
    await Promise.all(["openbot","opendots"].map(async app => {
      await env.AUTH_KV.put("copilot_stop:"+app, "1", { expirationTtl: 3600 });
    }));
    return Response.json({ ok:true, message: "Eski OpenBot/OpenDots oturumlarına dur komutu gönderildi." });
  }

  if (url.pathname === "/apps/api/stop" && request.method === "POST") {
    let payload = {};
    try { payload = await request.json(); } catch (_) {}
    const app = String(payload.app || "");
    if (!["openbot","opendots"].includes(app)) return Response.json({ error: "Geçersiz uygulama" }, { status: 400 });
    await env.AUTH_KV.put(`copilot_stop:${app}`, "1", { expirationTtl: 10 * 60 });
    await env.AUTH_KV.put(
      `copilot_runtime:${app}`,
      JSON.stringify({ app: app.id, status: "stopping", message: "Durdurma isteği gönderildi.", updated_at: Date.now() }),
      { expirationTtl: 60 * 60 }
    );
    return Response.json({ ok: true });
  }

  return new Response("Not found", { status: 404 });
}
