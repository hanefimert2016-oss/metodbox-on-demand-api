import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePortalRequest } from "../../cloudflare-direct/src/portal.js";

function makeEnv() {
  const store = new Map();
  return {
    PORTAL_USERNAME: "admin",
    PORTAL_PASSWORD: "2026",
    PORTAL_SESSION_SECRET: "test-only-session-hmac-key-must-be-random-in-prod",
    AUTH_KV: {
      get: async k => store.get(k) ?? null,
      put: async (k, v) => { store.set(k, v); },
      delete: async k => { store.delete(k); },
    }
  };
}
function req(method, path, opts = {}) {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      "Origin": "https://worker.example",
      "CF-Connecting-IP": opts.ip || "192.0.2.123",
      ...(opts.headers || {}),
      ...(opts.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(opts.body ? { body: new URLSearchParams(opts.body).toString() } : {}),
  });
}
test("admin credential creates secure session; no ngrok is involved", async () => {
  const env = makeEnv();
  const path = "/apps/login";
  const response = await handlePortalRequest(req("POST", path, {
    body: { username: "admin", password: "2026" }
  }), env, new URL("https://worker.example" + path));
  assert.equal(response.status, 303);
  const cookie = response.headers.get("Set-Cookie");
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  const followup = await handlePortalRequest(req("GET", "/apps", {
    headers: { Cookie: cookie.split(";")[0] }
  }), env, new URL("https://worker.example/apps"));
  assert.equal(followup.status, 200);
  assert.ok((await followup.text()).includes("OpenDots"));
});
test("wrong password is denied and 5 failures lock the login", async () => {
  const env = makeEnv();
  const path = "/apps/login";
  for (let i = 0; i < 5; i++) {
    const response = await handlePortalRequest(req("POST", path, {
      body: { username: "admin", password: "wrong" }
    }), env, new URL("https://worker.example" + path));
    assert.equal(response.status, 401);
  }
  const locked = await handlePortalRequest(req("POST", path, {
    body: { username: "admin", password: "2026" }
  }), env, new URL("https://worker.example" + path));
  assert.equal(locked.status, 429);
});
test("cross-origin POST attempt is rejected", async () => {
  const env = makeEnv();
  const path = "/apps/login";
  const response = await handlePortalRequest(req("POST", path, {
    body: { username: "admin", password: "2026" },
    headers: { Origin: "https://bad.example" }
  }), env, new URL("https://worker.example" + path));
  assert.equal(response.status, 403);
});
