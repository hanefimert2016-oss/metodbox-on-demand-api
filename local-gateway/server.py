#!/usr/bin/env python3
import base64
import hashlib
import hmac
import io
import json
import os
import time
import uuid
import zipfile
from pathlib import Path

import httpx
import jwt
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

OWNER = "hanefimert2016-oss"
REPO = "metodbox-on-demand-api"
WORKFLOW = "on-demand-api.yml"
API_VERSION = "2022-11-28"
DEFAULT_MODEL = "gpt-5.1"
MODELS = {"gpt-5.1", "gpt-oss:120b"}
POLL_SECONDS = 2
RUN_TIMEOUT_SECONDS = 12 * 60

HOME = Path.home()
CFG = HOME / ".config" / "metodbox-on-demand-api"
API_KEY_FILE = Path(os.environ.get("METODBOX_API_KEY_FILE", HOME / ".config" / "metodbox-proxy" / "api_key"))
APP_ID_FILE = Path(os.environ.get("GH_APP_ID_FILE", CFG / "github_app_id"))
INSTALL_ID_FILE = Path(os.environ.get("GH_INSTALLATION_ID_FILE", CFG / "github_installation_id"))
PRIVATE_KEY_FILE = Path(os.environ.get("GH_PRIVATE_KEY_FILE", CFG / "github_app_private_key.pem"))

app = FastAPI(title="Metodbox Local Gateway", version="1.0.0")


def read_text(path: Path, name: str) -> str:
    try:
        value = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise RuntimeError(f"{name} bulunamadı: {path}") from exc
    if not value:
        raise RuntimeError(f"{name} boş: {path}")
    return value


def api_key() -> str:
    return read_text(API_KEY_FILE, "API_KEY")


def require_api_key(authorization: str | None, x_api_key: str | None):
    supplied = ""
    if authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied and x_api_key:
        supplied = x_api_key.strip()
    expected = api_key()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Geçersiz API key")


def normalize_model(value) -> str:
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


def app_jwt() -> str:
    app_id = read_text(APP_ID_FILE, "GitHub App ID")
    private_key = read_text(PRIVATE_KEY_FILE, "GitHub App private key")
    now = int(time.time())
    return jwt.encode(
        {
            "iat": now - 60,
            "exp": now + 9 * 60,
            "iss": app_id,
        },
        private_key,
        algorithm="RS256",
    )


async def installation_token(client: httpx.AsyncClient) -> str:
    install_id = read_text(INSTALL_ID_FILE, "GitHub Installation ID")
    token = app_jwt()
    r = await client.post(
        f"https://api.github.com/app/installations/{install_id}/access_tokens",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "metodbox-local-gateway",
        },
    )
    if r.status_code >= 400:
        raise RuntimeError(f"GitHub installation token alınamadı: {r.status_code} {r.text[:500]}")
    return r.json()["token"]


def gh_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "metodbox-local-gateway",
    }


def sign_request(ts: str, request_id: str, model: str, messages_b64: str) -> str:
    msg = f"{ts}\n{request_id}\n{model}\n{messages_b64}".encode("utf-8")
    return hmac.new(api_key().encode("utf-8"), msg, hashlib.sha256).hexdigest()


async def wait_for_run(client: httpx.AsyncClient, token: str, request_id: str) -> dict:
    deadline = time.time() + 90
    title = f"API Request {request_id}"
    while time.time() < deadline:
        r = await client.get(
            f"https://api.github.com/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/runs",
            params={"event": "repository_dispatch", "per_page": 30},
            headers=gh_headers(token),
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Run list alınamadı: {r.status_code} {r.text[:500]}")
        for run in r.json().get("workflow_runs", []):
            if run.get("display_title") == title:
                return run
        await _sleep(POLL_SECONDS)
    raise RuntimeError("GitHub Actions run bulunamadı")


async def wait_for_completion(client: httpx.AsyncClient, token: str, run_id: int) -> dict:
    deadline = time.time() + RUN_TIMEOUT_SECONDS
    while time.time() < deadline:
        r = await client.get(
            f"https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run_id}",
            headers=gh_headers(token),
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Run durumu alınamadı: {r.status_code} {r.text[:500]}")
        run = r.json()
        if run.get("status") == "completed":
            return run
        await _sleep(POLL_SECONDS)
    raise RuntimeError("GitHub Actions cevap süresi aşıldı")


async def read_artifact(client: httpx.AsyncClient, token: str, run_id: int, request_id: str) -> dict:
    r = await client.get(
        f"https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run_id}/artifacts",
        headers=gh_headers(token),
    )
    if r.status_code >= 400:
        raise RuntimeError(f"Artifact listesi alınamadı: {r.status_code} {r.text[:500]}")

    name = f"api-response-{request_id}"
    artifact = next((a for a in r.json().get("artifacts", []) if a.get("name") == name), None)
    if not artifact:
        raise RuntimeError("Cevap artifactı bulunamadı")

    z = await client.get(
        f"https://api.github.com/repos/{OWNER}/{REPO}/actions/artifacts/{artifact['id']}/zip",
        headers=gh_headers(token),
        follow_redirects=True,
    )
    if z.status_code >= 400:
        raise RuntimeError(f"Artifact indirilemedi: {z.status_code} {z.text[:500]}")

    with zipfile.ZipFile(io.BytesIO(z.content)) as archive:
        with archive.open("response.json") as f:
            return json.loads(f.read().decode("utf-8"))


async def _sleep(seconds: float):
    import asyncio
    await asyncio.sleep(seconds)


@app.get("/")
async def root():
    return {"ok": True, "service": "metodbox-local-gateway", "models": sorted(MODELS)}


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
    require_api_key(authorization, x_api_key)
    body = await request.json()

    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="messages boş olamaz")

    model = normalize_model(body.get("model"))
    messages_json = json.dumps(messages, ensure_ascii=False, separators=(",", ":"))
    messages_b64 = base64.b64encode(messages_json.encode("utf-8")).decode("ascii")

    if len(messages_b64) > 56000:
        raise HTTPException(status_code=413, detail="Context GitHub dispatch için çok büyük")

    request_id = str(uuid.uuid4())
    ts = str(int(time.time()))
    sig = sign_request(ts, request_id, model, messages_b64)

    timeout = httpx.Timeout(30.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        gh_token = await installation_token(client)

        dispatch = await client.post(
            f"https://api.github.com/repos/{OWNER}/{REPO}/dispatches",
            headers=gh_headers(gh_token),
            json={
                "event_type": "metodbox_question",
                "client_payload": {
                    "messages_b64": messages_b64,
                    "model": model,
                    "request_id": request_id,
                    "ts": ts,
                    "sig": sig,
                },
            },
        )
        if dispatch.status_code not in (200, 204):
            raise HTTPException(
                status_code=502,
                detail=f"GitHub dispatch başarısız: {dispatch.status_code} {dispatch.text[:500]}",
            )

        run = await wait_for_run(client, gh_token, request_id)
        finished = await wait_for_completion(client, gh_token, run["id"])

        try:
            result = await read_artifact(client, gh_token, finished["id"], request_id)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"GitHub Actions {finished.get('conclusion')}: {exc}",
            ) from exc

    if result.get("status") != "ok":
        raise HTTPException(status_code=502, detail=result.get("error") or "GPT+ worker hatası")

    answer = str(result.get("answer") or "")
    created = int(time.time())

    if body.get("stream") is True:
        async def generate():
            first = {
                "id": f"chatcmpl-{request_id}",
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {"role": "assistant", "content": answer}, "finish_reason": None}],
            }
            last = {
                "id": f"chatcmpl-{request_id}",
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(first, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps(last, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    return JSONResponse({
        "id": f"chatcmpl-{request_id}",
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": answer},
            "finish_reason": "stop",
        }],
        "usage": None,
    })
