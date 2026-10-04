#!/usr/bin/env python3
import hashlib
import hmac
import os
import sys
import time

EVENT_NAME = os.environ.get("GITHUB_EVENT_NAME", "")
if EVENT_NAME != "repository_dispatch":
    print("Manual workflow_dispatch: signature verification skipped.")
    raise SystemExit(0)

api_key = os.environ.get("API_KEY", "")
messages_b64 = os.environ.get("MESSAGES_B64", "")
request_id = os.environ.get("REQUEST_ID", "")
model = os.environ.get("MODEL", "gpt-5.1")
timestamp = os.environ.get("REQUEST_TS", "")
signature = os.environ.get("REQUEST_SIG", "").lower().strip()

if not api_key:
    print("API_KEY Actions secret is not configured.", file=sys.stderr)
    raise SystemExit(2)

if not messages_b64 or not request_id or not timestamp or not signature:
    print("Signed dispatch payload is incomplete.", file=sys.stderr)
    raise SystemExit(3)

try:
    ts = int(timestamp)
except ValueError:
    print("Invalid request timestamp.", file=sys.stderr)
    raise SystemExit(4)

# Reject old/replayed requests. Five minutes is enough for normal ingress -> GitHub dispatch latency.
if abs(int(time.time()) - ts) > 300:
    print("Request timestamp is outside the 5 minute window.", file=sys.stderr)
    raise SystemExit(5)

message = f"{timestamp}\n{request_id}\n{model}\n{messages_b64}".encode("utf-8")
expected = hmac.new(api_key.encode("utf-8"), message, hashlib.sha256).hexdigest()

if not hmac.compare_digest(expected, signature):
    print("Invalid API request signature.", file=sys.stderr)
    raise SystemExit(6)

print("API request signature verified.")
