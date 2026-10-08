#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
CONTROL = Path(__file__).resolve().parent
OVERLAY = CONTROL / "opendots-overlay"

def replace(path: str, old: str, new: str):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"patch marker missing in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

def copy(src: str, dst: str):
    target = ROOT / dst
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CONTROL / src, target)

copy("opendots-threadhub.ts", "src/server/threadhub.ts")
copy("opendots-overlay/platform.ts", "src/server/platform.ts")
copy("opendots-overlay/platform-config.ts", "src/server/platform-config.ts")
copy("opendots-overlay/ThreadList.tsx", "src/client/ThreadList.tsx")

# Server configuration: wire our encrypted GitHub ThreadHub.
replace(
    "src/server/index.ts",
    """  intelligenceWsUrl: intelligenceWsUrlFromEnv(process.env),
  apiKey: process.env.OPENAI_API_KEY,""",
    """  intelligenceWsUrl: intelligenceWsUrlFromEnv(process.env),
  threadHubUrl: process.env.THREADHUB_URL,
  threadHubToken: process.env.THREADHUB_TOKEN,
  apiKey: process.env.OPENAI_API_KEY,""",
)

# The agent no longer requires CopilotKit Intelligence to converse. Learning
# stays available only when a real Intelligence key is deliberately configured.
replace(
    "src/server/dot-agent.ts",
    """        if (
          !this.config.intelligenceKey ||
          !this.config.apiKey ||
          !this.config.model
        ) {""",
    """        if (!this.config.apiKey || !this.config.model) {""",
)
replace(
    "src/server/dot-agent.ts",
    """          throw new Error('Intelligence and model configuration are required.');""",
    """          throw new Error('Model configuration is required.');""",
)
replace(
    "src/server/dot-agent.ts",
    """          learnedSkills:
            dot.skillDeliveryEnabled && conversation.learningContainerId
              ? {""",
    """          learnedSkills:
            this.config.intelligenceKey &&
            dot.skillDeliveryEnabled &&
            conversation.learningContainerId
              ? {""",
)

# Expose explicit message persistence routes. The browser SDK remains the
# realtime transport, while ThreadHub becomes the durable history store.
replace(
    "src/server/workspace-routes.ts",
    """  app.get('/conversations/:id/capture', (c) =>
    c.json(platform.workspace.capture(c.req.param('id'))),
  );""",
    """  app.get('/conversations/:id/messages', async (c) => {
    try {
      return c.json(await platform.threadMessages(c.req.param('id')));
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Conversation history unavailable.' },
        503,
      );
    }
  });
  app.put('/conversations/:id/messages', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body !== 'object' ||
      !Array.isArray((body as { messages?: unknown }).messages) ||
      (body as { messages: unknown[] }).messages.length > 2000
    )
      return c.json({ error: 'A bounded messages array is required.' }, 400);
    try {
      const saved = await platform.saveThreadMessages(
        c.req.param('id'),
        (body as { messages: Record<string, unknown>[] }).messages,
      );
      return c.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Conversation could not be saved.' },
        503,
      );
    }
  });
  app.get('/conversations/:id/capture', (c) =>
    c.json(platform.workspace.capture(c.req.param('id'))),
  );""",
)

# Dedicated PCs are reached through an authenticated Cloudflare Quick Tunnel.
# The Worker is the lifecycle supervisor; the per-Dot HMAC token still protects
# the computer itself.
replace(
    "src/server/computer-service.ts",
    """    const local =
      url.hostname === '127.0.0.1' &&
      !!state.port &&
      url.port === String(state.port) &&
      new URL(this.config.computerSupervisorUrl!).hostname === '127.0.0.1';
    if (
      url.protocol !== 'http:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (!network && !local)
    )""",
    """    const local =
      url.hostname === '127.0.0.1' &&
      !!state.port &&
      url.port === String(state.port) &&
      new URL(this.config.computerSupervisorUrl!).hostname === '127.0.0.1';
    const githubTunnel =
      url.protocol === 'https:' &&
      url.hostname.endsWith('.trycloudflare.com') &&
      !url.port;
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (!network && !local && !githubTunnel)
    )""",
)
replace(
    "src/server/computer-service.ts",
    """      this.endpoint(id, await this.supervisor(`/computers/${id}/ensure`, {}));""",
    """      // GitHub-hosted computers start asynchronously. The lifecycle request
      // succeeds immediately; status polling will expose the authenticated
      // tunnel once the runner is ready.
      await this.supervisor(`/computers/${id}/ensure`, {});""",
)

# The ephemeral public tunnel remains locked with OpenDots' owner token.
# The portal places that token in the iframe URL once; the client moves it to
# sessionStorage immediately and removes it from the address bar.
replace(
    "src/client/api.ts",
    """let token = sessionStorage.getItem('opendots-token') ?? '';""",
    """let token = sessionStorage.getItem('opendots-token') ?? '';

const bootstrapToken = new URLSearchParams(location.search).get('access_token');
if (bootstrapToken) {
  token = bootstrapToken;
  sessionStorage.setItem('opendots-token', bootstrapToken);
  const clean = new URL(location.href);
  clean.searchParams.delete('access_token');
  history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
}""",
)

# Restore ThreadHub history into the client agent before connecting.
replace(
    "src/client/Chat.tsx",
    """  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void copilotkit
      .connectAgent({ agent })
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Conversation could not connect.',
          );
      });
    return () => {
      active = false;
    };
  }, [agent, copilotkit, isReady]);""",
    """  useEffect(() => {
    if (!isReady) return;
    let active = true;
    void (async () => {
      const persisted = await api<{ messages: Record<string, unknown>[] }>(
        `/conversations/${thread.id}/messages`,
      );
      if (!active) return;

      // A fresh useAgent has no durable history without Intelligence. Hydrate
      // it from our ThreadHub before the runtime is connected.
      if (agent.messages.length === 0) {
        for (const message of persisted.messages)
          agent.addMessage(
            message as unknown as Parameters<typeof agent.addMessage>[0],
          );
      }

      await copilotkit.connectAgent({ agent });
      if (active) setLoaded(true);
    })().catch((e) => {
      if (active)
        setError(
          e instanceof Error ? e.message : 'Conversation could not connect.',
        );
    });
    return () => {
      active = false;
    };
  }, [agent, copilotkit, isReady, thread.id]);""",
)

# Persist the full client-visible AG-UI message history after each successful
# turn. Tool calls/results stay attached to the messages, so a restored thread
# can continue a multi-step task rather than only showing transcript text.
replace(
    "src/client/Chat.tsx",
    """      const result = await copilotkit.runAgent({ agent });
      if (!result.newMessages.some((message) => message.role === 'assistant'))
        throw new Error(
          'The current turn returned no response. Check the runtime connection and retry.',
        );
      onSaved();""",
    """      const result = await copilotkit.runAgent({ agent });
      if (!result.newMessages.some((message) => message.role === 'assistant'))
        throw new Error(
          'The current turn returned no response. Check the runtime connection and retry.',
        );

      const merged = [...agent.messages];
      for (const message of result.newMessages)
        if (!merged.some((current) => current.id === message.id))
          merged.push(message);

      await api(`/conversations/${thread.id}/messages`, 'PUT', {
        messages: merged,
      });
      onSaved();""",
)

print("OpenDots patched for Metodbox ThreadHub + GitHub Agent PCs")
