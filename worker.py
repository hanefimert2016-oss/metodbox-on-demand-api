#!/usr/bin/env python3
import asyncio
import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx
from playwright.async_api import async_playwright

BASE = "https://gptplus.metodbox.ai"
MODEL = os.environ.get("MODEL", "gpt-5.1").strip() or "gpt-5.1"
SUPPORTED_MODELS = {"gpt-5.1", "gpt-oss:120b"}
REQUEST_ID = os.environ.get("REQUEST_ID", "").strip()
TOKEN = os.environ.get("METODBOX_TOKEN", "").strip()
MESSAGES_B64 = os.environ.get("MESSAGES_B64", "").strip()
QUESTION = os.environ.get("QUESTION", "").strip()
OUT = Path("api-response/response.json")


def now():
    return datetime.now(timezone.utc).isoformat()


def save(payload):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_messages():
    if MESSAGES_B64:
        try:
            raw = base64.b64decode(MESSAGES_B64).decode("utf-8")
            messages = json.loads(raw)
            if not isinstance(messages, list) or not messages:
                raise ValueError("messages must be a non-empty list")
            return messages
        except Exception as exc:
            raise RuntimeError(f"Invalid MESSAGES_B64 payload: {exc}") from exc

    if QUESTION:
        return [{"role": "user", "content": QUESTION}]

    raise RuntimeError("No conversation payload was supplied")


def extract_completion_text(data):
    if not isinstance(data, dict):
        raise RuntimeError("GPT+ returned a non-object response")

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0] or {}
        message = choice.get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content

        # Some providers may return content as typed parts.
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    text = part.get("text") or part.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            joined = "".join(parts).strip()
            if joined:
                return joined

    # Useful fallback for provider-specific wrappers.
    for key in ("response", "message", "content", "text"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value

    raise RuntimeError(
        "GPT+ completion response did not contain assistant text"
    )


async def capture_authorization(page, bootstrap_token):
    loop = asyncio.get_running_loop()
    auth_future = loop.create_future()

    async def on_response(response):
        if "/api/models" not in response.url or response.status != 200:
            return
        try:
            headers = response.request.headers
            auth = headers.get("authorization")
            if auth and not auth_future.done():
                auth_future.set_result(auth)
        except Exception:
            pass

    page.on("response", on_response)

    print("[worker] bootstrapping GPT+ session", flush=True)
    await page.goto(
        f"{BASE}/?token={quote(bootstrap_token, safe='')}",
        wait_until="domcontentloaded",
        timeout=90000,
    )

    try:
        auth = await asyncio.wait_for(auth_future, timeout=90)
        print("[worker] GPT+ session authorization captured", flush=True)
        return auth
    except asyncio.TimeoutError as exc:
        raise RuntimeError("GPT+ session authorization capture timed out") from exc


async def call_gptplus(auth_header, messages):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
    }

    print(f"[worker] calling GPT+ API model={MODEL}", flush=True)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(180.0, connect=30.0),
        follow_redirects=True,
    ) as client:
        response = await client.post(
            f"{BASE}/api/chat/completions",
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        body = response.text[:1000]
        raise RuntimeError(
            f"GPT+ API HTTP {response.status_code}: {body}"
        )

    content_type = response.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        answer_parts = []
        for line in response.text.splitlines():
            line = line.strip()
            if not line.startswith("data:"):
                continue
            value = line[5:].strip()
            if not value or value == "[DONE]":
                continue
            try:
                chunk = json.loads(value)
            except Exception:
                continue
            choices = chunk.get("choices") or []
            if not choices:
                continue
            delta = (choices[0] or {}).get("delta") or {}
            piece = delta.get("content")
            if isinstance(piece, str):
                answer_parts.append(piece)

        answer = "".join(answer_parts).strip()
        if not answer:
            raise RuntimeError("GPT+ SSE response contained no assistant text")
        return answer

    try:
        data = response.json()
    except Exception as exc:
        raise RuntimeError(
            f"GPT+ returned invalid JSON: {response.text[:1000]}"
        ) from exc

    return extract_completion_text(data)


async def run():
    started = now()

    if MODEL not in SUPPORTED_MODELS:
        save({
            "status": "error",
            "request_id": REQUEST_ID,
            "model": MODEL,
            "answer": "",
            "error": f"Unsupported model: {MODEL}",
            "started_at": started,
            "finished_at": now(),
        })
        return 2

    if not REQUEST_ID:
        save({
            "status": "error",
            "request_id": "",
            "model": MODEL,
            "answer": "",
            "error": "REQUEST_ID is empty",
            "started_at": started,
            "finished_at": now(),
        })
        return 2

    if not TOKEN:
        save({
            "status": "error",
            "request_id": REQUEST_ID,
            "model": MODEL,
            "answer": "",
            "error": "GitHub Actions secret METODBOX_TOKEN is not configured",
            "started_at": started,
            "finished_at": now(),
        })
        return 2

    token = TOKEN[7:].strip() if TOKEN.lower().startswith("bearer ") else TOKEN

    try:
        messages = load_messages()

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                viewport={"width": 1440, "height": 1000}
            )
            page = await context.new_page()

            auth_header = await capture_authorization(page, token)

            await context.close()
            await browser.close()

        answer = await call_gptplus(auth_header, messages)
        print("[worker] GPT+ completion received", flush=True)

        save({
            "status": "ok",
            "request_id": REQUEST_ID,
            "model": MODEL,
            "answer": answer,
            "error": None,
            "started_at": started,
            "finished_at": now(),
        })
        return 0

    except Exception as exc:
        print(f"[worker] error: {exc}", flush=True)
        save({
            "status": "error",
            "request_id": REQUEST_ID,
            "model": MODEL,
            "answer": "",
            "error": str(exc),
            "started_at": started,
            "finished_at": now(),
        })
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
