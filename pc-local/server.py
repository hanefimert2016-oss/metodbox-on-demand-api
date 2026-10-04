#!/usr/bin/env python3
import asyncio
import os
import time
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from playwright.async_api import async_playwright

BASE = "https://gptplus.metodbox.ai"
DEFAULT_MODEL = "gpt-5.1"
MODELS = {"gpt-5.1", "gpt-oss:120b"}

HOME = Path.home()
API_KEY_FILE = Path(os.environ.get(
    "METODBOX_API_KEY_FILE",
    HOME / ".config" / "metodbox-proxy" / "api_key",
))
TOKEN_FILE = Path(os.environ.get(
    "METODBOX_TOKEN_FILE",
    HOME / ".config" / "metodbox-proxy" / "metodbox_token",
))

app = FastAPI(title="Metodbox PC API", version="1.0.0")
_auth_header = None
_auth_lock = asyncio.Lock()


def _read_secret(path: Path, name: str) -> str:
    try:
        value = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise RuntimeError(f"{name} bulunamadı: {path}") from exc
    if not value:
        raise RuntimeError(f"{name} boş: {path}")
    return value


def _api_key() -> str:
    return os.environ.get("API_KEY", "").strip() or _read_secret(API_KEY_FILE, "API_KEY")


def _metodbox_token() -> str:
    return os.environ.get("METODBOX_TOKEN", "").strip() or _read_secret(TOKEN_FILE, "METODBOX_TOKEN")


def _require_api_key(authorization: str | None, x_api_key: str | None):
    supplied = ""
    if authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied and x_api_key:
        supplied = x_api_key.strip()

    if supplied != _api_key():
        raise HTTPException(status_code=401, detail="Geçersiz API key")


def _normalize_model(value) -> str:
    raw = str(value or DEFAULT_MODEL).strip()
    aliases = {
        "gpt-5.1": "gpt-5.1",
        "gpt5.1": "gpt-5.1",
        "gpt-oss:120b": "gpt-oss:120b",
        "gpt-oss-120b": "gpt-oss:120b",
    }
    model = aliases.get(raw.lower(), aliases.get(raw))
    if model not in MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen model: {raw}. Desteklenenler: {', '.join(sorted(MODELS))}",
        )
    return model


async def _bootstrap_auth(force: bool = False) -> str:
    global _auth_header

    if _auth_header and not force:
        return _auth_header

    async with _auth_lock:
        if _auth_header and not force:
            return _auth_header

        token = _metodbox_token()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()

        print("[pc-api] GPT+ oturumu açılıyor...", flush=True)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(viewport={"width": 1440, "height": 1000})
            page = await context.new_page()

            loop = asyncio.get_running_loop()
            future = loop.create_future()

            async def on_response(response):
                if "/api/models" not in response.url or response.status != 200:
                    return
                try:
                    auth = response.request.headers.get("authorization")
                    if auth and not future.done():
                        future.set_result(auth)
                except Exception:
                    pass

            page.on("response", on_response)

            await page.goto(
                f"{BASE}/?token={quote(token, safe='')}",
                wait_until="domcontentloaded",
                timeout=90000,
            )

            try:
                _auth_header = await asyncio.wait_for(future, timeout=90)
            except asyncio.TimeoutError as exc:
                raise RuntimeError(
                    "GPT+ authorization yakalanamadı. Metodbox token süresi dolmuş olabilir."
                ) from exc
            finally:
                await context.close()
                await browser.close()

        print("[pc-api] GPT+ oturumu hazır.", flush=True)
        return _auth_header


def _provider_payload(body: dict, model: str) -> dict:
    allowed = {
        "messages",
        "temperature",
        "top_p",
        "max_tokens",
        "max_completion_tokens",
        "stop",
        "tools",
        "tool_choice",
        "parallel_tool_calls",
        "response_format",
        "seed",
        "frequency_penalty",
        "presence_penalty",
        "reasoning_effort",
        "user",
    }
    payload = {k: body[k] for k in allowed if k in body}
    payload["model"] = model
    payload["stream"] = bool(body.get("stream"))
    return payload


async def _call_gptplus(payload: dict) -> httpx.Response:
    auth = await _bootstrap_auth()

    async def send(header: str):
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=30.0),
            follow_redirects=True,
        ) as client:
            return await client.post(
                f"{BASE}/api/chat/completions",
                headers={
                    "Authorization": header,
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                },
                json=payload,
            )

    response = await send(auth)

    if response.status_code in (401, 403):
        auth = await _bootstrap_auth(force=True)
        response = await send(auth)

    if response.status_code >= 400:
        raise RuntimeError(
            f"GPT+ API HTTP {response.status_code}: {response.text[:1500]}"
        )

    return response


@app.on_event("startup")
async def startup():
    _api_key()
    _metodbox_token()
    await _bootstrap_auth()


@app.get("/")
@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "metodbox-pc-api",
        "models": sorted(MODELS),
    }


@app.get("/v1/models")
@app.get("/models")
async def models():
    return {
        "object": "list",
        "data": [
            {"id": model, "object": "model", "created": 0, "owned_by": "metodbox"}
            for model in sorted(MODELS)
        ],
    }


@app.post("/v1/chat/completions")
@app.post("/chat/completions")
async def chat_completions(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(authorization, x_api_key)

    body = await request.json()
    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="messages boş olamaz")

    model = _normalize_model(body.get("model"))
    payload = _provider_payload(body, model)

    try:
        response = await _call_gptplus(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    content_type = response.headers.get("content-type", "")

    if "text/event-stream" in content_type:
        return Response(
            content=response.content,
            status_code=200,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    try:
        data = response.json()
    except Exception:
        data = {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": response.text},
                "finish_reason": "stop",
            }],
        }

    if isinstance(data, dict):
        data["model"] = model
    return JSONResponse(data)
