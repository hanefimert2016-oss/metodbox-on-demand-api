const OWNER = "hanefimert2016-oss";
const REPO = "metodbox-on-demand-api";
const WORKFLOW = "on-demand-api.yml";
const DEFAULT_MODEL = "gpt-5.1";
const MODELS = ["gpt-5.1", "gpt-oss:120b"];
const API_VERSION = "2026-03-10";
const POLL_MS = 2000;
const START_TIMEOUT_MS = 90_000;
const RUN_TIMEOUT_MS = 12 * 60_000;

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(),
        });
      }

      const url = new URL(request.url);

      if (
        request.method === "GET" &&
        (url.pathname === "/health" || url.pathname === "/" || url.pathname === "/v1")
      ) {
        return json({
          ok: true,
          service: "metodbox-on-demand-api",
          model: DEFAULT_MODEL,
          models: MODELS,
          openai_compatible: true,
        });
      }

      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (
        request.method === "GET" &&
        (path === "/models" || path === "/v1/models")
      ) {
        // Model discovery is intentionally public; no secret is exposed here.
        // Some OpenAI-compatible clients probe /models even when the configured
        // base URL already ends with /v1.
        return json({
          object: "list",
          data: MODELS.map((id) => ({
            id,
            object: "model",
            created: 0,
            owned_by: id === "gpt-oss:120b" ? "ollama" : "openai",
            permission: [],
            root: id,
            parent: null,
          })),
        });
      }

      if (
        request.method !== "POST" ||
        (path !== "/chat/completions" && path !== "/v1/chat/completions")
      ) {
        return json({ error: { message: "Not found" } }, 404);
      }

      requireApiKey(request, env);

      const body = await request.json();
      const question = extractUserMessage(body);
      if (!question) {
        return json({ error: { message: "messages içinde kullanıcı mesajı bulunamadı" } }, 400);
      }

      const requestedModel = normalizeModel(body.model);
      if (!requestedModel) {
        return json({
          error: {
            message: `Desteklenmeyen model: ${String(body.model || "")}. Desteklenenler: ${MODELS.join(", ")}`
          }
        }, 400);
      }

      const requestId = crypto.randomUUID();
      const ts = Math.floor(Date.now() / 1000).toString();
      const sig = await hmacSha256Hex(
        env.API_KEY,
        `${ts}\n${requestId}\n${requestedModel}\n${question}`
      );

      const installationToken = await getInstallationToken(env);

      await githubFetch(
        `/repos/${OWNER}/${REPO}/dispatches`,
        installationToken,
        {
          method: "POST",
          body: JSON.stringify({
            event_type: "metodbox_question",
            client_payload: {
              question,
              model: requestedModel,
              request_id: requestId,
              ts,
              sig,
            },
          }),
        }
      );

      const run = await waitForRun(installationToken, requestId);
      const finished = await waitForCompletion(installationToken, run.id);

      if (finished.conclusion !== "success") {
        throw new Error(
          `GitHub Actions tamamlandı fakat sonuç: ${finished.conclusion || "unknown"}`
        );
      }

      const answer = await readResultArtifact(
        installationToken,
        finished.id,
        requestId
      );

      const created = Math.floor(Date.now() / 1000);

      if (body.stream === true) {
        const chunk = {
          id: `chatcmpl-${requestId}`,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [{
            index: 0,
            delta: { role: "assistant", content: answer },
            finish_reason: null,
          }],
        };
        const finalChunk = {
          id: `chatcmpl-${requestId}`,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: "stop",
          }],
        };

        return new Response(
          `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finalChunk)}\n\ndata: [DONE]\n\n`,
          {
            headers: {
              ...corsHeaders(),
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache",
            },
          }
        );
      }

      return json({
        id: `chatcmpl-${requestId}`,
        object: "chat.completion",
        created,
        model: requestedModel,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: answer,
          },
          finish_reason: "stop",
        }],
        usage: null,
      });
    } catch (error) {
      const status = error?.status || 500;
      return json({
        error: {
          message: String(error?.message || error),
          type: "metodbox_gateway_error",
        },
      }, status);
    }
  },
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type, x-api-key",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function requireApiKey(request, env) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const xApiKey = (request.headers.get("x-api-key") || "").trim();
  const supplied = bearer || xApiKey;

  if (!env.API_KEY || !supplied || !timingSafeEqual(supplied, env.API_KEY)) {
    const err = new Error("Geçersiz API key");
    err.status = 401;
    throw err;
  }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function normalizeModel(value) {
  const raw = String(value || DEFAULT_MODEL).trim();
  const aliases = {
    "gpt-5.1": "gpt-5.1",
    "gpt5.1": "gpt-5.1",
    "gpt-oss:120b": "gpt-oss:120b",
    "gpt-oss-120b": "gpt-oss:120b",
    "gpt-oss-120B": "gpt-oss:120b",
  };
  const normalized = aliases[raw] || aliases[raw.toLowerCase()];
  return MODELS.includes(normalized) ? normalized : null;
}

function extractUserMessage(body) {
  if (!body || !Array.isArray(body.messages)) return "";
  for (let i = body.messages.length - 1; i >= 0; i--) {
    const m = body.messages[i];
    if (m?.role !== "user") continue;

    if (typeof m.content === "string") {
      return m.content.trim();
    }

    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((p) => p && p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getInstallationToken(env) {
  if (!env.GH_APP_ID || !env.GH_INSTALLATION_ID || !env.GH_PRIVATE_KEY) {
    throw new Error("GitHub App Worker secretları eksik");
  }

  const jwt = await makeGitHubAppJwt(env.GH_APP_ID, env.GH_PRIVATE_KEY);
  const response = await fetch(
    `https://api.github.com/app/installations/${env.GH_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "x-github-api-version": API_VERSION,
        "user-agent": "metodbox-on-demand-worker",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub installation token alınamadı: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.token;
}

async function makeGitHubAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  });
  const unsigned = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function githubFetch(path, token, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": API_VERSION,
      "user-agent": "metodbox-on-demand-worker",
      ...(init.headers || {}),
    },
  });

  if (!response.ok && response.status !== 204) {
    const err = new Error(
      `GitHub API ${response.status}: ${await response.text()}`
    );
    err.status = 502;
    throw err;
  }
  return response;
}

async function waitForRun(token, requestId) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  const title = `API Request ${requestId}`;

  while (Date.now() < deadline) {
    const response = await githubFetch(
      `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?event=repository_dispatch&per_page=30`,
      token
    );
    const data = await response.json();
    const run = (data.workflow_runs || []).find(
      (r) => r.display_title === title
    );
    if (run) return run;
    await sleep(POLL_MS);
  }

  throw new Error("GitHub Actions run başlatıldı fakat run bulunamadı");
}

async function waitForCompletion(token, runId) {
  const deadline = Date.now() + RUN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await githubFetch(
      `/repos/${OWNER}/${REPO}/actions/runs/${runId}`,
      token
    );
    const run = await response.json();
    if (run.status === "completed") return run;
    await sleep(POLL_MS);
  }

  throw new Error("GitHub Actions cevap süresi aşıldı");
}

async function readResultArtifact(token, runId, requestId) {
  const listResponse = await githubFetch(
    `/repos/${OWNER}/${REPO}/actions/runs/${runId}/artifacts`,
    token
  );
  const list = await listResponse.json();
  const name = `api-response-${requestId}`;
  const artifact = (list.artifacts || []).find((a) => a.name === name);

  if (!artifact) {
    throw new Error("Cevap artifactı bulunamadı");
  }

  const zipResponse = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifact.id}/zip`,
    {
      redirect: "follow",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": API_VERSION,
        "user-agent": "metodbox-on-demand-worker",
      },
    }
  );

  if (!zipResponse.ok) {
    throw new Error(`Artifact indirilemedi: ${zipResponse.status}`);
  }

  const zip = await zipResponse.arrayBuffer();
  const responseJson = await extractResponseJsonFromZip(zip);
  const payload = JSON.parse(responseJson);

  if (payload.status !== "ok") {
    throw new Error(payload.error || "GPT+ worker hatası");
  }
  return String(payload.answer || "");
}

async function extractResponseJsonFromZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Artifact ZIP EOCD bulunamadı");

  const centralOffset = view.getUint32(eocd + 16, true);
  let p = centralOffset;

  while (p + 46 <= bytes.length && view.getUint32(p, true) === 0x02014b50) {
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const fileNameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);

    const fileName = new TextDecoder().decode(
      bytes.slice(p + 46, p + 46 + fileNameLength)
    );

    if (fileName.endsWith("response.json")) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error("Artifact ZIP local header geçersiz");
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      let raw;
      if (method === 0) {
        raw = compressed;
      } else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([compressed]).stream().pipeThrough(ds);
        raw = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(`Desteklenmeyen ZIP sıkıştırma yöntemi: ${method}`);
      }

      return new TextDecoder().decode(raw);
    }

    p += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("Artifact içinde response.json bulunamadı");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
