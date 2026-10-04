#!/usr/bin/env python3
import asyncio
import json
import os
import time
from urllib.parse import quote

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from playwright.async_api import async_playwright

BASE = "https://gptplus.metodbox.ai"
API_KEY = os.environ.get("API_KEY", "").strip()
METODBOX_TOKEN = os.environ.get("METODBOX_TOKEN", "").strip()
DEFAULT_MODEL = "gpt-5.1"
MODELS = {"gpt-5.1", "gpt-oss:120b"}

app = FastAPI(title="Metodbox GitHub Runtime API", version="1.0.0")
_auth_header = None
_auth_lock = asyncio.Lock()


def _require_api_key(authorization: str | None, x_api_key: str | None):
    supplied = ""
    if authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied and x_api_key:
        supplied = x_api_key.strip()
    if not API_KEY or supplied != API_KEY:
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


async def _bootstrap_auth(force=False):
    global _auth_header

    if _auth_header and not force:
        return _auth_header

    async with _auth_lock:
        if _auth_header and not force:
            return _auth_header

        if not METODBOX_TOKEN:
            raise RuntimeError("METODBOX_TOKEN Actions secret eksik")

        bootstrap = (
            METODBOX_TOKEN[7:].strip()
            if METODBOX_TOKEN.lower().startswith("bearer ")
            else METODBOX_TOKEN
        )

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                viewport={"width": 1440, "height": 1000}
            )
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

            print("[runtime] bootstrapping GPT+ session", flush=True)
            await page.goto(
                f"{BASE}/?token={quote(bootstrap, safe='')}",
                wait_until="domcontentloaded",
                timeout=90000,
            )

            try:
                _auth_header = await asyncio.wait_for(future, timeout=90)
            except asyncio.TimeoutError as exc:
                raise RuntimeError("GPT+ authorization capture timed out") from exc
            finally:
                await context.close()
                await browser.close()

        print("[runtime] GPT+ session ready", flush=True)
        return _auth_header


def _provider_payload(body: dict, model: str, stream: bool) -> dict:
    allowed = {
        "messages",
        "temperature",
        "top_p",
        "max_tokens",
        "stop",
        "tools",
        "tool_choice",
        "parallel_tool_calls",
        "response_format",
        "seed",
        "frequency_penalty",
        "presence_penalty",
        "reasoning_effort",
    }
    payload = {k: body[k] for k in allowed if k in body}
    payload["model"] = model
    payload["stream"] = stream
    return payload


async def _post_completion(payload: dict):
    auth = await _bootstrap_auth()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(300.0, connect=30.0),
        follow_redirects=True,
    ) as client:
        response = await client.post(
            f"{BASE}/api/chat/completions",
            headers={
                "Authorization": auth,
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            json=payload,
        )

    if response.status_code == 401:
        auth = await _bootstrap_auth(force=True)
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=30.0),
            follow_redirects=True,
        ) as client:
            response = await client.post(
                f"{BASE}/api/chat/completions",
                headers={
                    "Authorization": auth,
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                },
                json=payload,
            )

    if response.status_code >= 400:
        raise RuntimeError(
            f"GPT+ API HTTP {response.status_code}: {response.text[:1200]}"
        )

    return response


@app.on_event("startup")
async def startup():
    if not API_KEY:
        raise RuntimeError("API_KEY Actions secret eksik")
    # Warm up once so the public URL is useful immediately.
    await _bootstrap_auth()


@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "metodbox-github-runtime",
        "models": sorted(MODELS),
    }


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/v1/models")
@app.get("/models")
async def models():
    return {
        "object": "list",
        "data": [
            {
                "id": model,
                "object": "model",
                "owned_by": "openai" if model == "gpt-5.1" else "ollama",
            }
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
    stream = bool(body.get("stream"))
    payload = _provider_payload(body, model, stream)

    try:
        response = await _post_completion(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    content_type = response.headers.get("content-type", "")

    if stream and "text/event-stream" in content_type:
        async def generate():
            yield response.content

        return StreamingResponse(generate(), media_type="text/event-stream")

    if "application/json" in content_type:
        data = response.json()
        if isinstance(data, dict):
            data["model"] = model
        return JSONResponse(data)

    return JSONResponse(
        {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.text,
                    },
                    "finish_reason": "stop",
                }
            ],
        }
    )
