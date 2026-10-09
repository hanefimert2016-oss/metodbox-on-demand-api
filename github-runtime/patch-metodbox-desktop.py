#!/usr/bin/env python3
"""Integrate the real XFCE4 desktop into the pinned OpenBot computer image.

Never patch the user's private storage. Fail if upstream build anchors change.
"""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: patch-metodbox-desktop.py <cloned-openbot-directory>")

root = Path(sys.argv[1])
main = root / "agent-computer/src/index.ts"
docker = root / "agent-computer/Dockerfile"
here = Path(__file__).parent
source = here / "metodbox-desktop.ts"
startup = here / "metodbox-start-xfce.sh"
wallpaper = here / "metodbox-wallpaper.svg"
for required in (main, docker, source, startup, wallpaper):
    if not required.is_file():
        raise SystemExit(f"Required desktop integration file missing: {required}")

text = main.read_text()
if "handleMetodboxDesktop" not in text:
    imports = 'import { startVirtualDisplay } from "./virtual-display";'
    ready = 'if (VIRTUAL_DISPLAY) process.env.DISPLAY = VIRTUAL_DISPLAY.name;'
    marker = "    // The admin network policy, pushed by the server on every change; applied without a restart."
    if imports not in text or ready not in text or marker not in text:
        raise SystemExit("Pinned OpenBot runtime changed; refusing unsafe desktop patch")
    text = text.replace(
        imports,
        imports + '\nimport { startMetodboxDesktop, handleMetodboxDesktop } from "./metodbox-desktop";',
        1,
    )
    text = text.replace(
        ready,
        ready + '\nawait startMetodboxDesktop(VIRTUAL_DISPLAY?.name);',
        1,
    )
    text = text.replace(
        marker,
        '''    // Outer Cloudflare Worker authorizes the chat/agent; the pinned
    // OpenBot HTTP server verifies the per-PC token for desktop actions.
    const desktop = await handleMetodboxDesktop(request, url.pathname);
    if (desktop) return desktop;
''' + marker,
        1,
    )
main.write_text(text)
(root / "agent-computer/src/metodbox-desktop.ts").write_bytes(source.read_bytes())
(root / "agent-computer/metodbox-start-xfce.sh").write_bytes(startup.read_bytes())
(root / "agent-computer/metodbox-wallpaper.svg").write_bytes(wallpaper.read_bytes())

image = docker.read_text()
if "METODBOX_XFCE_V2" not in image:
    mark = "WORKDIR /app"
    if mark not in image:
        raise SystemExit("Pinned OpenBot Dockerfile changed; refusing unsafe patch")
    overlay = '''
# METODBOX_XFCE_V2: XFCE window manager, panels, file manager and terminal.
# D-Bus lives inside the existing authenticated Xvfb computer container.
# No VNC/RDP ports are added, and the AI's access control remains unchanged.
RUN apt-get update && apt-get install -y --no-install-recommends \\
    xfce4-session xfwm4 xfdesktop4 xfce4-panel xfce4-settings xfconf \\
    xfce4-terminal thunar xfce4-whiskermenu-plugin xfce4-notifyd \\
    dbus-bin dbus-x11 xdotool scrot procps \\
    arc-theme papirus-icon-theme fonts-noto-core fonts-noto-color-emoji \\
    librsvg2-bin \\
  && mkdir -p /usr/share/backgrounds \\
  && rm -rf /var/lib/apt/lists/*
COPY agent-computer/metodbox-start-xfce.sh /usr/local/bin/metodbox-start-xfce
COPY agent-computer/metodbox-wallpaper.svg /tmp/metodbox-wallpaper.svg
RUN chmod 755 /usr/local/bin/metodbox-start-xfce \\
  && rsvg-convert -w 1280 -h 800 /tmp/metodbox-wallpaper.svg \\
       -o /usr/share/backgrounds/metodbox-dot.png \\
  && rm /tmp/metodbox-wallpaper.svg

'''
    image = image.replace(mark, overlay + mark, 1)
    docker.write_text(image)
print("Metodbox XFCE desktop injected: xfwm4, xfdesktop, panel, Thunar, terminal, dark theme")
