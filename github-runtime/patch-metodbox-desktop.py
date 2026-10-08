#!/usr/bin/env python3
"""Overlay a small Openbox desktop onto the pinned OpenBot computer runtime.

Fail closed if upstream source changed; don't silently ship an unpatched PC.
This modifies only an ephemeral clone during GitHub Actions build.
"""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: patch-metodbox-desktop.py <cloned-openbot-directory>")
root = Path(sys.argv[1])
main = root / "agent-computer/src/index.ts"
docker = root / "agent-computer/Dockerfile"
source = Path(__file__).with_name("metodbox-desktop.ts")
if not main.is_file() or not docker.is_file() or not source.is_file():
    raise SystemExit("OpenBot source or Metodbox desktop overlay missing")

text = main.read_text()
if "handleMetodboxDesktop" not in text:
    imports = 'import { startVirtualDisplay } from "./virtual-display";'
    ready = 'if (VIRTUAL_DISPLAY) process.env.DISPLAY = VIRTUAL_DISPLAY.name;'
    marker = "    // The admin network policy, pushed by the server on every change; applied without a restart."
    if imports not in text or ready not in text or marker not in text:
        raise SystemExit("Pinned OpenBot API has changed. Desktop patch not applied.")
    text = text.replace(imports, imports +
        '\nimport { startMetodboxDesktop, handleMetodboxDesktop } from "./metodbox-desktop";', 1)
    text = text.replace(ready, ready + '\nawait startMetodboxDesktop(VIRTUAL_DISPLAY?.name);', 1)
    text = text.replace(marker, '''    // The outer Worker authenticates the chat/agent; this server verifies
    // the per-PC token before the desktop helper is ever called.
    const desktop = await handleMetodboxDesktop(request, url.pathname);
    if (desktop) return desktop;
''' + marker, 1)
main.write_text(text)

target = root / "agent-computer/src/metodbox-desktop.ts"
target.write_bytes(source.read_bytes())

image = docker.read_text()
install = '''\n# Simple real Linux desktop on the same Xvfb screen as headed Chromium.
# No VNC server, forwarded display port, or extra unauthenticated HTTP port.
RUN apt-get update && apt-get install -y --no-install-recommends \\
    openbox tint2 xterm xdotool scrot fonts-dejavu-core \\
  && rm -rf /var/lib/apt/lists/*
'''
if "fonts-dejavu-core" not in image:
    mark = 'WORKDIR /app'
    if mark not in image:
        raise SystemExit("Pinned OpenBot Dockerfile changed")
    image = image.replace(mark, install + "\n" + mark, 1)
    docker.write_text(image)
print("Metodbox desktop overlay installed: Openbox + 1280x800 Xvfb + xdotool + scrot")
