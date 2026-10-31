import json
from pathlib import Path
import trimesh
from forge3d_world.world import build_world
from forge3d_world.validation import validate_world
def test_generate_and_reimport(tmp_path):
    file=tmp_path/"aegis.glb"
    built=build_world(file)
    assert file.read_bytes()[:4]==b"glTF"
    assert built["triangles"]>10000
    scene=trimesh.load(file,force="scene")
    assert len(scene.geometry)>50
    assert validate_world(file)["passed"]
    assert Path(tmp_path/"aegis_collision.glb").is_file()
    meta=json.loads(file.with_suffix(".json").read_text())
    assert len(meta["gameplay"]["markers"])>=4
    nav=json.loads((tmp_path/"navigation.json").read_text())
    assert nav["navmesh"] is False
