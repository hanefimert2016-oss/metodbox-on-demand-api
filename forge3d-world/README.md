# Forge3D World Studio v0.2 — AEGIS Outpost

Deterministic hard-surface sci-fi game map, designed for a real GLB asset handoff and XFCE virtual-desktop inspection.

**Actual generated artifacts:** `outputs/AEGIS_Outpost.glb` (visual), `outputs/AEGIS_Outpost_collision.glb` (static collider suggestions), `outputs/AEGIS_Outpost.json` (gameplay markers/manifest), `outputs/navigation.json` (sample waypoint graph), `outputs/quality_report.json`, and `outputs/preview/AEGIS_Outpost_Preview.png` (CPU geometry-only preview).

**Development level:** procedural playable-geometry blockout with PBR material factors, not production-ready AAA environment art. No textures or UV2 lightmap data; separate collision GLB is not automatically connected to the engine. The navigation JSON is NOT a baked navigation mesh. Does not include a player controller.

## Generate and verify locally

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python generate.py --output outputs/AEGIS_Outpost.glb
PYTHONPATH=. .venv/bin/python -m pytest -q
```

## XFCE: real desktop viewer (non-destructive)

Run in an XFCE session such as the Metodbox Dot PC, with a writable directory:

```bash
bash xfce/install.sh
bash xfce/launch.sh
```

The installer writes only `~/.local/share/applications/forge3d-world.desktop` and the project-local `.venv` and `outputs/`, leaving the existing PC scripts untouched. It starts a local-only `127.0.0.1:8765` HTTP server and opens the Chromium-based 3D viewer. Viewer loads Three.js modules from jsDelivr, so internet access is required for the JS library on the first load. The GLB itself loads from localhost. Install Blender separately for native editing.

If the Docker image has no Python venv or pip support, use the GitHub Actions artifact downloaded into the project workspace, then run `xfce/launch.sh` directly. GitHub Actions artifacts are ephemeral; do not rely on them as permanent storage.

## GitHub XFCE Actions

The `github/forge3d-world-xfce.yml` file is meant to be placed at `.github/workflows/forge3d-world-xfce.yml` in the **real** Metodbox repo (`hanefimert2016-oss/metodbox-on-demand-api`) alongside source under `forge3d-world/`. The workflow builds the assets on a fresh GitHub runner, tests them, starts an isolated XFCE + Xvfb session, imports the GLB into Blender, saves an editable `.blend`, captures a scene render and a real desktop screenshot, and uploads the results as workflow artifacts. It does **not** alter or launch users' existing Dot-agent PC instances.

The existing private `Metodbox-secret-system` repo is encrypted storage and must **not** be used as public build source or have its checkpoints modified.

## Usage in Godot 4 / Unity / Unreal

- Import visual GLB at world origin with scale 1 metre.
- Import `*_collision.glb` as static-only collision reference. Replace/optimize colliders for your engine; do not use dynamic rigid-body triangle mesh colliders.
- Use `AEGIS_Outpost.json` for player spawns, objectives, extraction and building markers.
- Use `navigation.json` only as an example graph, then bake a real navmesh in your engine.
- Add engine-specific lights, postprocessing, reflection probes and any gameplay scripts.
- Set textures/UV2/lightmap baking before calling the art final.

## Constraints

No shared tokens are committed; the workflow uses `contents: read`. GPU hardware is **not** guaranteed on standard GitHub-hosted runners, so Blender Workbench rendering is intentionally CPU-friendly. The map was verified through trimesh geometry QA locally; XFCE/Blender renderer verification requires running the workflow.