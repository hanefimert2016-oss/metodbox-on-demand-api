#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from forge3d_world.world import build_world
from forge3d_world.validation import validate_world

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",default="outputs/AEGIS_Outpost.glb")
    p.add_argument("--seed",type=int,default=4026)
    a=p.parse_args()
    result=build_world(a.output,seed=a.seed)
    q=validate_world(a.output)
    Path(a.output).parent.joinpath("quality_report.json").write_text(json.dumps(q,indent=2))
    print(json.dumps({"build":result,"quality":{"passed":q["passed"],"triangles":q["triangles"],"issues":q["issues"]}},indent=2))
    return 0 if q["passed"] else 1
if __name__=="__main__":raise SystemExit(main())
