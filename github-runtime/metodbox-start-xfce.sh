#!/usr/bin/env bash
# Metodbox XFCE startup INSIDE the Xvfb display's private D-Bus session.
set -Eeuo pipefail
export XDG_CURRENT_DESKTOP=XFCE
export DESKTOP_SESSION=xfce
export XDG_SESSION_DESKTOP=xfce
export XDG_SESSION_TYPE=x11
export GTK_THEME=Arc-Dark
export NO_AT_BRIDGE=1
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/profiles/xfce-config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/metodbox-xfce-cache}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/metodbox-xfce-runtime}"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Avoid restoring stale X11 process/session ids if the PC was checkpointed.
rm -rf "$XDG_CACHE_HOME/sessions"
mkdir -p "$XDG_CACHE_HOME/sessions"

# The real session manager launches xfwm4, xfdesktop and xfce4-panel.
xfce4-session >/tmp/metodbox-xfce-session.log 2>&1 &
SESSION_PID=$!

# Configure desktop inside the SAME D-Bus session; theme failure isn't fatal.
(
  for i in $(seq 1 60); do
    if pgrep -x xfce4-panel >/dev/null 2>&1; then break; fi
    sleep 0.3
  done
  xfconf-query -c xsettings -p /Net/ThemeName -n -t string -s Arc-Dark >/dev/null 2>&1 || true
  xfconf-query -c xsettings -p /Net/IconThemeName -n -t string -s Papirus-Dark >/dev/null 2>&1 || true
  xfconf-query -c xsettings -p /Gtk/FontName -n -t string -s 'Noto Sans 10' >/dev/null 2>&1 || true
  xfconf-query -c xfwm4 -p /general/theme -n -t string -s Arc-Dark >/dev/null 2>&1 || true
  xfconf-query -c xfwm4 -p /general/title_font -n -t string -s 'Noto Sans Bold 10' >/dev/null 2>&1 || true
  wallpaper=/usr/share/backgrounds/metodbox-dot.png
  if [[ -s "$wallpaper" ]]; then
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/last-image \
      -n -t string -s "$wallpaper" >/dev/null 2>&1 || true
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/image-style \
      -n -t int -s 5 >/dev/null 2>&1 || true
  fi
  xfce4-terminal --disable-server --title='Metodbox Terminal' \
    --geometry=96x26+80+98 --working-directory=/workspace >/tmp/metodbox-terminal.log 2>&1 || true
) >/tmp/metodbox-xfce-theme.log 2>&1 &

wait "$SESSION_PID"
