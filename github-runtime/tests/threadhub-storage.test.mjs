import assert from "node:assert/strict";
import { test } from "node:test";
import { handleThreadHubRequest } from "../../cloudflare-direct/src/threadhub.js";

const PRIVATE = "hanefimert2016-oss/ai-application-suite-1";
const PUBLIC = "hanefimert2016-oss/metodbox-on-demand-api";
const environment = () => {
  const kv = new Map();
  return {
    API_KEY: "api-key",
    GITHUB_STORAGE_TOKEN: "private-storage-token",
    GITHUB_STORAGE_REPO: PRIVATE,
    GITHUB_STORAGE_BRANCH: "agent-data",
    GITHUB_LAUNCH_REPO: PUBLIC,
    GITHUB_TRIGGER_TOKEN: "public-dispatch-token",
    STORAGE_ENCRYPTION_KEY: "test-only-aes-key-do-not-use",
    AUTH_KV: {
      get: async key => kv.get(key) ?? null,
      put: async (key, value) => { kv.set(key, value); },
      delete: async key => { kv.delete(key); },
      list: async () => ({ keys: [] }),
    },
  };
};

function request(method, pathname, payload) {
  return new Request("https://worker.example" + pathname, {
    method,
    headers: { Authorization: "Bearer api-key", "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}

test("private repo handles encrypted thread writes, not public repo", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (init.method === "PUT") {
      return new Response(JSON.stringify({ content: { sha: "saved" } }), { status: 201 });
    }
    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  };
  try {
    const env = environment();
    const resp = await handleThreadHubRequest(request("POST", "/api/threadhub/threads", {
      agentId: "coder", title: "Private test"
    }), env, new URL("https://worker.example/api/threadhub/threads"));
    assert.equal(resp.status, 201);
    const output = await resp.json();
    assert.equal(output.agentId, "coder");
    assert.ok(requests.some(x => x.init.method === "PUT"));
    assert.ok(requests.every(x => x.url.includes("/repos/" + PRIVATE + "/")));
    assert.ok(requests.every(x => x.init.headers.Authorization === "Bearer private-storage-token"));
  } finally {
    globalThis.fetch = original;
  }
});

test("agent start dispatches to public control repo (never private data repo)", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };
  try {
    const env = environment();
    const endpoint = "/api/pc/computers/coder/ensure";
    const resp = await handleThreadHubRequest(request("POST", endpoint),
      env, new URL("https://worker.example" + endpoint));
    assert.equal(resp.status, 200);
    assert.equal((await resp.json()).status, "requested");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.github.com/repos/" + PUBLIC + "/dispatches");
    assert.equal(calls[0].init.headers.Authorization, "Bearer public-dispatch-token");
    assert.equal(JSON.parse(calls[0].init.body).event_type, "launch_agent_pc");
  } finally {
    globalThis.fetch = original;
  }
});

test("API key is mandatory", async () => {
  const env = environment();
  const p = "/api/threadhub/health";
  const response = await handleThreadHubRequest(
    new Request("https://worker.example" + p), env, new URL("https://worker.example" + p)
  );
  assert.equal(response.status, 401);
});
