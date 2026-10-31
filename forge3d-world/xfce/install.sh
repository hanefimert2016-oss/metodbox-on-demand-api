#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python generate.py
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/forge3d-world.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Forge3D World Studio
Exec=$ROOT/xfce/launch.sh
Terminal=false
Icon=applications-graphics
Categories=Graphics;
EOF
chmod +x xfce/launch.sh
echo "Forge3D installer completed. Existing Dot/XFCE session untouched."
