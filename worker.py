#!/usr/bin/env python3
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from playwright.async_api import async_playwright

BASE = "https://gptplus.metodbox.ai"
MODEL = "gpt-5.1"
QUESTION = os.environ.get("QUESTION", "").strip()
REQUEST_ID = os.environ.get("REQUEST_ID", "").strip()
TOKEN = os.environ.get("METODBOX_TOKEN", "").strip()
OUT = Path("api-response/response.json")


def now():
    return datetime.now(timezone.utc).isoformat()


def save(payload):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def find_chat_input(page):
    selectors = [
        "textarea#chat-input",
        "textarea[placeholder]",
        "textarea",
        '[contenteditable="true"]',
    ]
    for selector in selectors:
        locator = page.locator(selector).first
        try:
            await locator.wait_for(state="visible", timeout=8000)
            return locator
        except Exception:
            pass
    raise RuntimeError("GPT+ chat input bulunamadı")


async def wait_for_answer(page, before_count, timeout_s=180):
    messages = page.locator('[id^="message-"]')
    deadline = time.time() + timeout_s
    last = ""
    stable = 0

    while time.time() < deadline:
        count = await messages.count()

        if count > before_count:
            try:
                text = (await messages.nth(count - 1).inner_text()).strip()
            except Exception:
                text = ""

            if text:
                if text == last:
                    stable += 1
                else:
                    last = text
                    stable = 0

                if stable >= 3:
                    return last

        await asyncio.sleep(1.5)

    if last:
        return last

    raise RuntimeError("GPT+ response timed out")


async def run():
    started = now()

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

    if not QUESTION:
        save({
            "status": "error",
            "request_id": REQUEST_ID,
            "model": MODEL,
            "answer": "",
            "error": "QUESTION is empty",
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
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )

            context = await browser.new_context(
                viewport={"width": 1440, "height": 1000}
            )
            page = await context.new_page()

            await page.goto(
                f"{BASE}/?token={quote(token, safe='')}",
                wait_until="domcontentloaded",
                timeout=90000,
            )

            chat = await find_chat_input(page)
            messages = page.locator('[id^="message-"]')
            before = await messages.count()

            # Exactly one user message is sent to GPT+ in this workflow run.
            await chat.fill(QUESTION)
            await chat.press("Enter")

            answer = await wait_for_answer(page, before)

            await context.close()
            await browser.close()

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
