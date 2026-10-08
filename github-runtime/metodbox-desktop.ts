// Metodbox native Openbox desktop adapter for OpenBot's authenticated HTTP server.
// No extra network listener. Shared DISPLAY with the headed Playwright browser.
// All inputs are passed as argv, never interpolated into shell commands.
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

let started = false;
const WIDTH = 1280, HEIGHT = 800;

async function command(argv: string[], timeout = 8000) {
  const proc = Bun.spawn(argv, { env: process.env, stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeout);
  try {
    const [code, out, err] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    if (code !== 0) throw Error((err || out || argv[0] + " failed").slice(0, 400));
    return out.slice(0, 2000);
  } finally {
    clearTimeout(timer);
  }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function startMetodboxDesktop(display: string | undefined) {
  if (!display || started) return;
  started = true;
  process.env.DISPLAY = display;
  // The processes inherit Bun's Xvfb DISPLAY, so the screenshot is the whole
  // Linux desktop, not an artificial preview of the browser's DOM.
  for (const args of [
    ["openbox", "--sm-disable"],
    ["tint2", "-c", "/etc/xdg/tint2/tint2rc"],
    ["xterm", "-geometry", "110x27+56+70", "-title", "Metodbox Terminal", "-e", "bash"],
  ]) {
    try {
      Bun.spawn(args, { env: process.env, stdout: "ignore", stderr: "ignore" }).unref();
    } catch (error) {
      console.warn("Metodbox desktop optional process failed:", args[0], String(error));
    }
  }
  console.info("Metodbox desktop booted on", display);
}

export async function handleMetodboxDesktop(request: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/desktop/")) return null;
  if (!started || !process.env.DISPLAY) return json({ error: "Headed desktop is unavailable" }, 503);
  const route = pathname.slice("/desktop/".length);

  try {
    if (route === "info" && request.method === "GET") {
      return json({ mode: "openbox", display: process.env.DISPLAY, width: WIDTH, height: HEIGHT, ready: true });
    }
    if (route === "screenshot" && request.method === "GET") {
      const filename = "/tmp/metodbox-shot-" + randomUUID() + ".png";
      try {
        await command(["scrot", "-z", filename], 12000);
        const bytes = await readFile(filename);
        if (bytes.byteLength > 2_000_000) throw Error("Desktop screenshot exceeds 2 MB");
        return json({ base64: bytes.toString("base64"), width: WIDTH, height: HEIGHT,
          capturedAt: new Date().toISOString(), surface: "desktop" });
      } finally {
        await unlink(filename).catch(() => {});
      }
    }
    if (request.method !== "POST") return json({ error: "Unsupported desktop action" }, 405);
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: "Desktop action is too large" }, 413);
    const body = JSON.parse(raw || "{}");
    if (route === "click" || route === "move") {
      const x = Number(body.x), y = Number(body.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT)
        return json({ error: "Desktop coordinates out of range" }, 400);
      await command(["xdotool", "mousemove", "--sync", String(x), String(y)]);
      if (route === "click") {
        const button = Number(body.button || 1);
        if (![1, 2, 3].includes(button)) return json({ error: "Invalid button" }, 400);
        await command(["xdotool", "click", String(button)]);
      }
      return json({ ok: true, action: route, x, y });
    }
    if (route === "type") {
      if (typeof body.text !== "string" || body.text.length > 4000)
        return json({ error: "Text must be at most 4000 characters" }, 400);
      // No command shell: the user's text is one literal argv parameter.
      await command(["xdotool", "type", "--clearmodifiers", "--delay", "2", "--", body.text], 20000);
      return json({ ok: true, action: "type", characters: body.text.length });
    }
    if (route === "key") {
      if (typeof body.key !== "string" ||
          !/^[A-Za-z0-9_+-]{1,64}$/.test(body.key))
        return json({ error: "Invalid key shortcut" }, 400);
      await command(["xdotool", "key", "--clearmodifiers", body.key]);
      return json({ ok: true, action: "key", key: body.key });
    }
    if (route === "scroll") {
      const direction = body.direction === "up" ? "up" : "down";
      const amount = Number(body.steps || 3);
      if (!Number.isInteger(amount) || amount < 1 || amount > 12)
        return json({ error: "Invalid scroll amount" }, 400);
      await command(["xdotool", "click", "--repeat", String(amount), direction === "up" ? "4" : "5"]);
      return json({ ok: true, action: "scroll", direction, steps: amount });
    }
    return json({ error: "Unknown desktop action" }, 404);
  } catch (error) {
    return json({ error: String(error instanceof Error ? error.message : error).slice(0, 300) }, 502);
  }
}
