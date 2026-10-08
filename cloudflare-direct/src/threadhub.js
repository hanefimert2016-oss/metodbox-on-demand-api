const DEFAULT_REPO = "hanefimert2016-oss/metodbox-on-demand-api";
const DATA_BRANCH = "agent-data";
const THREAD_ROOT = "agent-storage/threads";
const THREAD_INDEX = THREAD_ROOT + "/index.enc.json";
const MAX_THREAD_BYTES = 4 * 1024 * 1024;
const MAX_MESSAGES = 2000;
const PC_PREFIX = "agent_pc:";
const PC_STOP_PREFIX = "agent_pc_stop:";

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const raw = atob(String(value || "").replace(/\s+/g, ""));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function textToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64ToText(value) {
  return new TextDecoder().decode(base64ToBytes(value));
}

function safeId(value, label = "id") {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) {
    throw new Error("Geçersiz " + label);
  }
  return id;
}

function serviceToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return (request.headers.get("X-API-Key") || "").trim();
}

function serviceAuthorized(request, env) {
  const expected = String(env.API_KEY || "");
  const supplied = serviceToken(request);
  return !!expected && supplied === expected;
}

function githubConfig(env) {
  const token = String(env.GITHUB_TRIGGER_TOKEN || "").trim();
  if (!token) throw new Error("GITHUB_TRIGGER_TOKEN Worker secret eksik");
  return {
    token,
    repo: String(env.GITHUB_STORAGE_REPO || env.GITHUB_LAUNCH_REPO || DEFAULT_REPO),
    branch: String(env.GITHUB_STORAGE_BRANCH || DATA_BRANCH),
  };
}

function githubHeaders(env) {
  const { token } = githubConfig(env);
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "metodbox-threadhub",
    "Content-Type": "application/json",
  };
}

function storageSecret(env) {
  const secret =
    env.STORAGE_ENCRYPTION_KEY ||
    env.PORTAL_SESSION_SECRET ||
    env.PORTAL_PASSWORD ||
    env.API_KEY;
  if (!secret) throw new Error("Storage encryption secret eksik");
  return String(secret);
}

async function storageKey(env) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(storageSecret(env))
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptObject(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await storageKey(env);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  );
  return JSON.stringify({
    v: 1,
    alg: "AES-256-GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted),
  });
}

async function decryptObject(env, encoded) {
  const wrapper = JSON.parse(encoded);
  if (wrapper?.v !== 1 || wrapper?.alg !== "AES-256-GCM") {
    throw new Error("Desteklenmeyen storage formatı");
  }
  const key = await storageKey(env);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(wrapper.iv) },
    key,
    base64ToBytes(wrapper.data)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

async function githubRead(env, path) {
  const { repo, branch } = githubConfig(env);
  const response = await fetch(
    "https://api.github.com/repos/" +
      repo +
      "/contents/" +
      path.split("/").map(encodeURIComponent).join("/") +
      "?ref=" +
      encodeURIComponent(branch),
    { headers: githubHeaders(env) }
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      "GitHub storage read HTTP " + response.status + ": " + text.slice(0, 300)
    );
  }
  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  return {
    sha: payload.sha,
    text: base64ToText(payload.content || ""),
  };
}

async function githubWrite(env, path, text, sha, message) {
  const { repo, branch } = githubConfig(env);
  const body = {
    message: message || "threadhub: update encrypted data",
    content: textToBase64(text),
    branch,
  };
  if (sha) body.sha = sha;

  const response = await fetch(
    "https://api.github.com/repos/" +
      repo +
      "/contents/" +
      path.split("/").map(encodeURIComponent).join("/"),
    {
      method: "PUT",
      headers: githubHeaders(env),
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      "GitHub storage write HTTP " +
        response.status +
        ": " +
        detail.slice(0, 300)
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function githubDelete(env, path, sha, message) {
  const { repo, branch } = githubConfig(env);
  const response = await fetch(
    "https://api.github.com/repos/" +
      repo +
      "/contents/" +
      path.split("/").map(encodeURIComponent).join("/"),
    {
      method: "DELETE",
      headers: githubHeaders(env),
      body: JSON.stringify({
        message: message || "threadhub: delete encrypted data",
        sha,
        branch,
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      "GitHub storage delete HTTP " +
        response.status +
        ": " +
        detail.slice(0, 300)
    );
  }
}

async function readEncrypted(env, path, fallback = null) {
  const file = await githubRead(env, path);
  if (!file) return { value: fallback, sha: null };
  return { value: await decryptObject(env, file.text), sha: file.sha };
}

async function writeEncrypted(env, path, value, sha, message) {
  const encoded = await encryptObject(env, value);
  return githubWrite(env, path, encoded, sha, message);
}

function threadPath(id) {
  return THREAD_ROOT + "/" + safeId(id, "thread id") + ".enc.json";
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const trimmed = messages.slice(-MAX_MESSAGES).map((m) => {
    if (!m || typeof m !== "object") return null;
    const copy = structuredClone(m);
    if (!copy.id) copy.id = crypto.randomUUID();
    return copy;
  }).filter(Boolean);
  const encoded = JSON.stringify(trimmed);
  if (new TextEncoder().encode(encoded).byteLength > MAX_THREAD_BYTES) {
    throw new Error("Thread geçmişi 4 MB sınırını aşıyor");
  }
  return trimmed;
}

async function readIndex(env) {
  const { value, sha } = await readEncrypted(env, THREAD_INDEX, { threads: [] });
  const threads = Array.isArray(value?.threads) ? value.threads : [];
  return { value: { threads }, sha };
}

async function updateIndex(env, updater) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readIndex(env);
    const next = updater(structuredClone(current.value));
    try {
      return await writeEncrypted(
        env,
        THREAD_INDEX,
        next,
        current.sha,
        "threadhub: update thread index"
      );
    } catch (error) {
      last = error;
      if (error?.status !== 409 && error?.status !== 422) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 + attempt * 250));
    }
  }
  throw last || new Error("Thread index güncellenemedi");
}

export async function createThread(env, input = {}) {
  const id = safeId(input.id || crypto.randomUUID(), "thread id");
  const agentId = safeId(input.agentId || "default", "agent id");
  const now = Date.now();
  const thread = {
    id,
    agentId,
    title: String(input.title || "Yeni konuşma").slice(0, 160),
    createdAt: now,
    updatedAt: now,
    messages: normalizeMessages(input.messages || []),
  };

  const existing = await githubRead(env, threadPath(id));
  if (existing) {
    return await getThread(env, id);
  }

  await writeEncrypted(
    env,
    threadPath(id),
    thread,
    null,
    "threadhub: create " + id
  );
  await updateIndex(env, (index) => {
    index.threads = index.threads.filter((t) => t.id !== id);
    index.threads.unshift({
      id,
      agentId,
      title: thread.title,
      createdAt: now,
      updatedAt: now,
      messageCount: thread.messages.length,
    });
    return index;
  });
  return thread;
}

export async function getThread(env, id) {
  const threadId = safeId(id, "thread id");
  const { value } = await readEncrypted(env, threadPath(threadId), null);
  if (!value) return null;
  value.messages = normalizeMessages(value.messages || []);
  return value;
}

export async function putThread(env, id, input = {}) {
  const threadId = safeId(id, "thread id");
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readEncrypted(env, threadPath(threadId), null);
    if (!current.value) {
      return createThread(env, {
        id: threadId,
        agentId: input.agentId || "default",
        title: input.title || "Yeni konuşma",
        messages: input.messages || [],
      });
    }

    const next = {
      ...current.value,
      id: threadId,
      agentId: input.agentId
        ? safeId(input.agentId, "agent id")
        : current.value.agentId,
      title:
        input.title !== undefined
          ? String(input.title || "Yeni konuşma").slice(0, 160)
          : current.value.title,
      updatedAt: Date.now(),
      messages:
        input.messages !== undefined
          ? normalizeMessages(input.messages)
          : normalizeMessages(current.value.messages || []),
    };

    try {
      await writeEncrypted(
        env,
        threadPath(threadId),
        next,
        current.sha,
        "threadhub: update " + threadId
      );
      await updateIndex(env, (index) => {
        const summary = {
          id: threadId,
          agentId: next.agentId,
          title: next.title,
          createdAt: next.createdAt || next.updatedAt,
          updatedAt: next.updatedAt,
          messageCount: next.messages.length,
        };
        index.threads = index.threads.filter((t) => t.id !== threadId);
        index.threads.unshift(summary);
        return index;
      });
      return next;
    } catch (error) {
      last = error;
      if (error?.status !== 409 && error?.status !== 422) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 + attempt * 250));
    }
  }
  throw last || new Error("Thread güncellenemedi");
}

export async function appendThreadMessage(env, id, message) {
  const current = await getThread(env, id);
  if (!current) throw new Error("Thread bulunamadı");
  return putThread(env, id, {
    agentId: current.agentId,
    title: current.title,
    messages: [...current.messages, message],
  });
}

export async function listThreads(env, agentId) {
  const { value } = await readIndex(env);
  const id = agentId ? safeId(agentId, "agent id") : null;
  return value.threads
    .filter((thread) => !id || thread.agentId === id)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export async function deleteThread(env, id) {
  const threadId = safeId(id, "thread id");
  const file = await githubRead(env, threadPath(threadId));
  if (!file) return false;
  await githubDelete(env, threadPath(threadId), file.sha, "threadhub: delete " + threadId);
  await updateIndex(env, (index) => {
    index.threads = index.threads.filter((t) => t.id !== threadId);
    return index;
  });
  return true;
}

async function triggerDispatch(env, eventType, payload) {
  const { repo, token } = githubConfig(env);
  const response = await fetch(
    "https://api.github.com/repos/" + repo + "/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "metodbox-agent-pc",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: payload,
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      "GitHub dispatch HTTP " + response.status + ": " + detail.slice(0, 300)
    );
  }
}

async function readPcState(env, agentId) {
  const id = safeId(agentId, "agent id");
  const raw = await env.AUTH_KV.get(PC_PREFIX + id);
  if (!raw) {
    return {
      botId: id,
      container: "opendots-computer-" + id,
      status: "stopped",
    };
  }
  try {
    const state = JSON.parse(raw);
    return {
      botId: id,
      container: "opendots-computer-" + id,
      status: state.status || "unknown",
      ...(state.url ? { url: state.url } : {}),
      ...(state.message ? { message: state.message } : {}),
      ...(state.updated_at ? { updated_at: state.updated_at } : {}),
    };
  } catch (_) {
    return {
      botId: id,
      container: "opendots-computer-" + id,
      status: "unknown",
    };
  }
}

async function listPcStates(env) {
  const listed = await env.AUTH_KV.list({ prefix: PC_PREFIX, limit: 1000 });
  const results = [];
  for (const key of listed.keys || []) {
    const id = key.name.slice(PC_PREFIX.length);
    results.push(await readPcState(env, id));
  }
  return results;
}

async function ensurePc(env, agentId) {
  const id = safeId(agentId, "agent id");
  const state = await readPcState(env, id);
  if (state.status === "running" && state.url) return state;
  if (["requested", "starting"].includes(state.status)) return state;

  await env.AUTH_KV.delete(PC_STOP_PREFIX + id);
  await env.AUTH_KV.put(
    PC_PREFIX + id,
    JSON.stringify({
      agentId: id,
      status: "requested",
      message: "GitHub üzerinde ajan bilgisayarı isteniyor.",
      updated_at: Date.now(),
    }),
    { expirationTtl: 6 * 60 * 60 }
  );
  await triggerDispatch(env, "launch_agent_pc", { agent_id: id });
  return readPcState(env, id);
}

async function stopPc(env, agentId) {
  const id = safeId(agentId, "agent id");
  await env.AUTH_KV.put(PC_STOP_PREFIX + id, "1", { expirationTtl: 15 * 60 });
  const current = await readPcState(env, id);
  await env.AUTH_KV.put(
    PC_PREFIX + id,
    JSON.stringify({
      agentId: id,
      status: "stopping",
      message: "Durdurma isteği gönderildi.",
      url: current.url,
      updated_at: Date.now(),
    }),
    { expirationTtl: 60 * 60 }
  );
  return readPcState(env, id);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleThreadHubRequest(request, env, url) {
  if (
    !url.pathname.startsWith("/api/threadhub") &&
    !url.pathname.startsWith("/api/pc")
  ) {
    return null;
  }

  if (!serviceAuthorized(request, env)) {
    return json({ error: "Geçersiz API key" }, 401);
  }

  try {
    if (url.pathname === "/api/threadhub/health" && request.method === "GET") {
      const cfg = githubConfig(env);
      return json({
        ok: true,
        service: "threadhub",
        storage: "github-encrypted",
        repo: cfg.repo,
        branch: cfg.branch,
      });
    }

    if (url.pathname === "/api/threadhub/threads" && request.method === "GET") {
      return json({
        object: "list",
        data: await listThreads(env, url.searchParams.get("agent_id")),
      });
    }

    if (url.pathname === "/api/threadhub/threads" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      return json(await createThread(env, body), 201);
    }

    const threadMatch = url.pathname.match(
      /^\/api\/threadhub\/threads\/([A-Za-z0-9._-]+)(?:\/messages)?$/
    );
    if (threadMatch) {
      const id = threadMatch[1];
      const isMessages = url.pathname.endsWith("/messages");

      if (request.method === "GET" && !isMessages) {
        const thread = await getThread(env, id);
        return thread ? json(thread) : json({ error: "Thread bulunamadı" }, 404);
      }

      if (request.method === "PUT" && !isMessages) {
        const body = await request.json().catch(() => ({}));
        return json(await putThread(env, id, body));
      }

      if (request.method === "POST" && isMessages) {
        const body = await request.json().catch(() => ({}));
        if (!body.message || typeof body.message !== "object") {
          return json({ error: "message gerekli" }, 400);
        }
        return json(await appendThreadMessage(env, id, body.message));
      }

      if (request.method === "DELETE" && !isMessages) {
        return json({ ok: await deleteThread(env, id) });
      }
    }

    if (url.pathname === "/api/pc/computers" && request.method === "GET") {
      return json({ computers: await listPcStates(env) });
    }

    const pcMatch = url.pathname.match(
      /^\/api\/pc\/computers\/([A-Za-z0-9._-]+)\/(ensure|stop)$/
    );
    if (pcMatch && request.method === "POST") {
      const [, id, verb] = pcMatch;
      return json(verb === "ensure" ? await ensurePc(env, id) : await stopPc(env, id));
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json(
      {
        error: error?.message || String(error),
        type: "threadhub_error",
      },
      503
    );
  }
}
