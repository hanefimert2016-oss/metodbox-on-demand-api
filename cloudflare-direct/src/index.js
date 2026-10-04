import puppeteer from "@cloudflare/puppeteer";

const GPTPLUS = "https://gptplus.metodbox.ai";
const DEFAULT_MODEL = "gpt-5.1";
const MODELS = ["gpt-5.1", "gpt-oss:120b"];
const AUTH_KEY = "gptplus_auth_v1";
const AUTH_LOCK_KEY = "gptplus_auth_refresh_lock_v1";
const AUTH_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUTH_LOCK_TTL_SECONDS = 65;

let refreshPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBrowserRateLimit(error) {
  return (
    error?.status === 429 ||
    String(error?.message || error).includes("429") ||
    String(error?.message || error).toLowerCase().includes("rate limit exceeded")
  );
}

function isDailyBrowserLimit(error) {
  return String(error?.message || error)
    .toLowerCase()
    .includes("browser time limit exceeded");
}

function retryAfterMs(error, fallbackMs = 21_000) {
  try {
    const raw = error?.headers?.get?.("Retry-After");
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(Math.max(seconds * 1000 + 500, 1000), 30_000);
    }
  } catch (_) {}
  return fallbackMs;
}

async function launchBrowserWithBackoff(env) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await puppeteer.launch(env.BROWSER);
    } catch (error) {
      lastError = error;

      if (!isBrowserRateLimit(error)) throw error;

      if (isDailyBrowserLimit(error)) {
        throw new Error(
          "Cloudflare Browser Run ücretsiz günlük 10 dakika kotası doldu. Kota 00:00 UTC'de sıfırlanır."
        );
      }

      if (attempt === 2) break;

      const waitMs = retryAfterMs(error, 21_000 + attempt * 2_000);
      console.log(
        `[browser] 429 rate limit; ${Math.ceil(waitMs / 1000)} saniye bekleniyor`,
        { attempt: attempt + 1 }
      );
      await sleep(waitMs);
    }
  }

  throw new Error(
    `Cloudflare Browser Run yeni browser açma limiti devam ediyor: ${lastError?.message || lastError}`
  );
}

async function waitForCachedAuth(env, maxWaitMs = 55_000) {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const auth = await env.AUTH_KV.get(AUTH_KEY);
    if (auth) return auth;
    await sleep(1000);
  }

  return null;
}

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

function sanitizeToolFields(body) {
  const out = { ...body };
  const hasTools = Array.isArray(out.tools) && out.tools.length > 0;

  if (!hasTools) {
    delete out.tools;
    delete out.tool_choice;
    delete out.parallel_tool_calls;
  }

  return out;
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

  const browser = await launchBrowserWithBackoff(env);
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
      let ownsLock = false;

      try {
        // Best-effort cross-isolate single-flight. Cline/LiteLLM can fire several
        // requests at once; without this they all try to launch Chromium and the
        // Workers Free "1 new browser every 20 seconds" limit returns 429.
        const existingLock = await env.AUTH_KV.get(AUTH_LOCK_KEY);

        if (existingLock) {
          const cachedAfterWait = await waitForCachedAuth(env);
          if (cachedAfterWait && !force) return cachedAfterWait;

          // Even on force refresh, another isolate may have just replaced the
          // authorization while we were waiting. Reuse the fresh value.
          const maybeFresh = await env.AUTH_KV.get(AUTH_KEY);
          if (maybeFresh) return maybeFresh;
        }

        await env.AUTH_KV.put(AUTH_LOCK_KEY, String(Date.now()), {
          expirationTtl: AUTH_LOCK_TTL_SECONDS,
        });
        ownsLock = true;

        // Do not delete the old authorization before a new one is available.
        // If Browser Run is temporarily rate-limited, keeping the old value is
        // safer and avoids forcing every concurrent request into bootstrap.
        const fresh = await bootstrapAuth(env);
        return fresh;
      } finally {
        if (ownsLock) {
          await env.AUTH_KV.delete(AUTH_LOCK_KEY).catch(() => {});
        }
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


function responseContentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : JSON.stringify(content);

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function responsesInputToMessages(body) {
  const messages = [];

  if (typeof body.instructions === "string" && body.instructions.trim()) {
    messages.push({ role: "system", content: body.instructions });
  }

  const input = body.input;

  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
    return messages;
  }

  if (!Array.isArray(input)) return messages;

  for (const item of input) {
    if (typeof item === "string") {
      messages.push({ role: "user", content: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;

    if (item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id || item.id || "",
        content:
          typeof item.output === "string"
            ? item.output
            : JSON.stringify(item.output ?? ""),
      });
      continue;
    }

    if (item.type === "function_call") {
      const callId = item.call_id || item.id || `call_${crypto.randomUUID()}`;
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: callId,
            type: "function",
            function: {
              name: item.name || "",
              arguments:
                typeof item.arguments === "string"
                  ? item.arguments
                  : JSON.stringify(item.arguments ?? {}),
            },
          },
        ],
      });
      continue;
    }

    const role = item.role || (item.type === "message" ? "user" : null);
    if (!role) continue;

    messages.push({
      role,
      content: responseContentToText(item.content),
    });
  }

  return messages;
}

function responsesToolsToChatTools(tools) {
  if (!Array.isArray(tools)) return undefined;

  const mapped = tools
    .map((tool) => {
      if (!tool || typeof tool !== "object") return null;

      if (tool.type === "function" && tool.function) {
        return tool;
      }

      if (tool.type === "function" && tool.name) {
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: tool.parameters || { type: "object", properties: {} },
            ...(tool.strict !== undefined ? { strict: tool.strict } : {}),
          },
        };
      }

      return null;
    })
    .filter(Boolean);

  return mapped.length ? mapped : undefined;
}

function responsesToolChoiceToChat(choice) {
  if (choice == null) return undefined;
  if (typeof choice === "string") return choice;

  if (
    typeof choice === "object" &&
    choice.type === "function" &&
    typeof choice.name === "string"
  ) {
    return {
      type: "function",
      function: { name: choice.name },
    };
  }

  return choice;
}

function chatCompletionToResponse(chat, requestBody, model) {
  const choice = chat?.choices?.[0] || {};
  const message = choice.message || {};
  const output = [];

  const text = responseContentToText(message.content);
  if (text) {
    output.push({
      id: `msg_${crypto.randomUUID()}`,
      type: "message",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text,
          annotations: [],
        },
      ],
    });
  }

  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (call?.type !== "function") continue;
      output.push({
        id: `fc_${crypto.randomUUID()}`,
        type: "function_call",
        status: "completed",
        call_id: call.id || `call_${crypto.randomUUID()}`,
        name: call.function?.name || "",
        arguments:
          typeof call.function?.arguments === "string"
            ? call.function.arguments
            : JSON.stringify(call.function?.arguments ?? {}),
      });
    }
  }

  const usage = chat?.usage
    ? {
        input_tokens:
          chat.usage.prompt_tokens ?? chat.usage.input_tokens ?? 0,
        output_tokens:
          chat.usage.completion_tokens ?? chat.usage.output_tokens ?? 0,
        total_tokens: chat.usage.total_tokens ?? 0,
      }
    : null;

  return {
    id: `resp_${crypto.randomUUID()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: requestBody.instructions ?? null,
    max_output_tokens:
      requestBody.max_output_tokens ?? requestBody.max_completion_tokens ?? null,
    model,
    output,
    parallel_tool_calls: requestBody.parallel_tool_calls ?? true,
    previous_response_id: requestBody.previous_response_id ?? null,
    reasoning: requestBody.reasoning ?? null,
    store: requestBody.store ?? false,
    temperature: requestBody.temperature ?? null,
    text: requestBody.text ?? { format: { type: "text" } },
    tool_choice: requestBody.tool_choice ?? "auto",
    tools: requestBody.tools ?? [],
    top_p: requestBody.top_p ?? null,
    truncation: requestBody.truncation ?? "disabled",
    usage,
  };
}

function responsesSse(responseObject) {
  const enc = new TextEncoder();

  const inProgress = {
    ...responseObject,
    status: "in_progress",
    output: [],
  };

  const events = [
    {
      type: "response.created",
      response: inProgress,
    },
  ];

  for (let outputIndex = 0; outputIndex < responseObject.output.length; outputIndex++) {
    const item = responseObject.output[outputIndex];

    events.push({
      type: "response.output_item.added",
      output_index: outputIndex,
      item:
        item.type === "message"
          ? { ...item, status: "in_progress", content: [] }
          : { ...item, status: "in_progress" },
    });

    if (item.type === "message") {
      const content = item.content?.[0];
      if (content?.type === "output_text") {
        events.push({
          type: "response.content_part.added",
          item_id: item.id,
          output_index: outputIndex,
          content_index: 0,
          part: { type: "output_text", text: "", annotations: [] },
        });
        events.push({
          type: "response.output_text.delta",
          item_id: item.id,
          output_index: outputIndex,
          content_index: 0,
          delta: content.text,
        });
        events.push({
          type: "response.output_text.done",
          item_id: item.id,
          output_index: outputIndex,
          content_index: 0,
          text: content.text,
        });
        events.push({
          type: "response.content_part.done",
          item_id: item.id,
          output_index: outputIndex,
          content_index: 0,
          part: content,
        });
      }
    }

    events.push({
      type: "response.output_item.done",
      output_index: outputIndex,
      item,
    });
  }

  events.push({
    type: "response.completed",
    response: responseObject,
  });

  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");

  return new Response(enc.encode(body), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      ...corsHeaders(),
    },
  });
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
      (url.pathname === "/models" ||
        url.pathname === "/v1/models" ||
        url.pathname.endsWith("/models"))
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
        url.pathname === "/v1/chat/completions" ||
        url.pathname.endsWith("/chat/completions"))
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
      body = sanitizeToolFields(body);

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


    if (
      request.method === "POST" &&
      (url.pathname === "/responses" ||
        url.pathname === "/v1/responses" ||
        url.pathname.endsWith("/responses"))
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

      const messages = responsesInputToMessages(body);
      if (!messages.length) {
        return json(
          {
            error: {
              message: "Responses API input boş veya desteklenmeyen biçimde",
              type: "invalid_request_error",
            },
          },
          400
        );
      }

      const chatBody = {
        model,
        messages,
        stream: false,
      };

      const tools = responsesToolsToChatTools(body.tools);
      if (tools && tools.length > 0) {
        chatBody.tools = tools;

        const toolChoice = responsesToolChoiceToChat(body.tool_choice);
        if (toolChoice !== undefined) chatBody.tool_choice = toolChoice;

        if (body.parallel_tool_calls !== undefined) {
          chatBody.parallel_tool_calls = body.parallel_tool_calls;
        }
      }

      for (const key of [
        "temperature",
        "top_p",
        "seed",
        "frequency_penalty",
        "presence_penalty",
      ]) {
        if (body[key] !== undefined) chatBody[key] = body[key];
      }

      if (body.max_output_tokens !== undefined) {
        chatBody.max_tokens = body.max_output_tokens;
      }

      try {
        const upstream = await callGptPlus(env, chatBody);

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

        const contentType = upstream.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await upstream.text();
          return json(
            {
              error: {
                message: `GPT+ Responses bridge JSON bekliyordu, gelen Content-Type: ${contentType}; body: ${text.slice(0, 800)}`,
                type: "metodbox_gateway_error",
              },
            },
            502
          );
        }

        const chat = await upstream.json();
        const responseObject = chatCompletionToResponse(chat, body, model);

        if (body.stream === true) {
          return responsesSse(responseObject);
        }

        return json(responseObject);
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

    return json(
      {
        error: {
          message: `Not found: ${request.method} ${url.pathname}`,
          type: "not_found_error",
        },
      },
      404
    );
  },
};
