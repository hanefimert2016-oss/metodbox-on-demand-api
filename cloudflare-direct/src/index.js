import puppeteer from "@cloudflare/puppeteer";

const GPTPLUS = "https://gptplus.metodbox.ai";
const DEFAULT_MODEL = "gpt-5.1";
const MODELS = ["gpt-5.1", "gpt-oss:120b"];
const AUTH_KEY = "gptplus_auth_v1";
const AUTH_TTL_SECONDS = 6 * 60 * 60;

let refreshPromise = null;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function normalizeModel(value) {
  const raw = String(value || DEFAULT_MODEL).trim();
  const aliases = {
    "gpt-5.1": "gpt-5.1",
    "gpt5.1": "gpt-5.1",
    "gpt-oss:120b": "gpt-oss:120b",
    "gpt-oss-120b": "gpt-oss:120b",
  };
  const model = aliases[raw.toLowerCase()] || aliases[raw];
  return MODELS.includes(model) ? model : null;
}

function validApiKey(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const xKey = (request.headers.get("X-API-Key") || "").trim();
  const supplied = bearer || xKey;
  return Boolean(env.API_KEY && supplied && supplied === env.API_KEY);
}

async function bootstrapAuth(env) {
  if (!env.METODBOX_TOKEN) {
    throw new Error("METODBOX_TOKEN Worker secret eksik");
  }

  const token = env.METODBOX_TOKEN.toLowerCase().startsWith("bearer ")
    ? env.METODBOX_TOKEN.slice(7).trim()
    : env.METODBOX_TOKEN.trim();

  const browser = await puppeteer.launch(env.BROWSER);
  let timer;

  try {
    const page = await browser.newPage();

    const authPromise = new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("GPT+ authorization 50 saniyede yakalanamadı")),
        50_000
      );

      page.on("response", (response) => {
        try {
          if (
            response.status() === 200 &&
            response.url().includes("/api/models")
          ) {
            const headers = response.request().headers();
            const auth = headers["authorization"];
            if (auth) {
              clearTimeout(timer);
              resolve(auth);
            }
          }
        } catch (_) {}
      });
    });

    await page.goto(
      `${GPTPLUS}/?token=${encodeURIComponent(token)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 50_000,
      }
    );

    const auth = await authPromise;

    await env.AUTH_KV.put(AUTH_KEY, auth, {
      expirationTtl: AUTH_TTL_SECONDS,
    });

    return auth;
  } finally {
    if (timer) clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}

async function getAuth(env, force = false) {
  if (!force) {
    const cached = await env.AUTH_KV.get(AUTH_KEY);
    if (cached) return cached;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        if (force) await env.AUTH_KV.delete(AUTH_KEY);
        return await bootstrapAuth(env);
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return await refreshPromise;
}

async function callGptPlus(env, body, forceRefresh = false) {
  const auth = await getAuth(env, forceRefresh);

  const upstream = await fetch(`${GPTPLUS}/api/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if ((upstream.status === 401 || upstream.status === 403) && !forceRefresh) {
    return await callGptPlus(env, body, true);
  }

  return upstream;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/v1")
    ) {
      return json({
        ok: true,
        service: "metodbox-direct-worker",
        models: MODELS,
        mode: "cloudflare-browser-run",
      });
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/models" || url.pathname === "/v1/models")
    ) {
      return json({
        object: "list",
        data: MODELS.map((id) => ({
          id,
          object: "model",
          created: 0,
          owned_by: "metodbox",
          permission: [],
          root: id,
          parent: null,
        })),
      });
    }

    if (
      request.method === "POST" &&
      (url.pathname === "/chat/completions" ||
        url.pathname === "/v1/chat/completions")
    ) {
      if (!validApiKey(request, env)) {
        return json(
          {
            error: {
              message: "Geçersiz API key",
              type: "authentication_error",
            },
          },
          401
        );
      }

      let body;
      try {
        body = await request.json();
      } catch (_) {
        return json(
          { error: { message: "Geçersiz JSON", type: "invalid_request_error" } },
          400
        );
      }

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return json(
          {
            error: {
              message: "messages boş olamaz",
              type: "invalid_request_error",
            },
          },
          400
        );
      }

      const model = normalizeModel(body.model);
      if (!model) {
        return json(
          {
            error: {
              message: `Desteklenmeyen model: ${String(body.model || "")}`,
              type: "invalid_request_error",
            },
          },
          400
        );
      }

      body.model = model;

      try {
        const upstream = await callGptPlus(env, body);

        if (!upstream.ok) {
          const text = await upstream.text();
          return json(
            {
              error: {
                message: `GPT+ API HTTP ${upstream.status}: ${text.slice(0, 1200)}`,
                type: "metodbox_gateway_error",
              },
            },
            502
          );
        }

        const headers = new Headers(upstream.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type, X-API-Key"
        );
        headers.set("Cache-Control", "no-store");

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      } catch (error) {
        return json(
          {
            error: {
              message: error?.message || String(error),
              type: "metodbox_gateway_error",
            },
          },
          502
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/internal/refresh-auth") {
      if (!validApiKey(request, env)) {
        return json({ error: { message: "Geçersiz API key" } }, 401);
      }

      try {
        await getAuth(env, true);
        return json({ ok: true, refreshed: true });
      } catch (error) {
        return json(
          {
            error: {
              message: error?.message || String(error),
              type: "metodbox_gateway_error",
            },
          },
          502
        );
      }
    }

    return json({ error: { message: "Not found" } }, 404);
  },
};
