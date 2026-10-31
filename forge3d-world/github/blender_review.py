import json,sys
from pathlib import Path
import bpy
from mathutils import Vector
def main():
    args=sys.argv[sys.argv.index("--")+1:]
    source=Path(args[0]).resolve();folder=Path(args[1]).resolve();folder.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if len(objects)<30:raise RuntimeError("Expected at least 30 imported mesh groups")
    camData=bpy.data.cameras.new("AEGIS_Inspection_Camera")
    cam=bpy.data.objects.new("AEGIS_Inspection_Camera",camData)
    bpy.context.scene.collection.objects.link(cam)
    cam.location=(135,-140,142)
    cam.rotation_euler=(Vector((0,0,2))-cam.location).to_track_quat("-Z","Y").to_euler()
    camData.type="ORTHO";camData.ortho_scale=173
    scene=bpy.context.scene;scene.camera=cam
    scene.render.engine="BLENDER_WORKBENCH"
    scene.display.shading.light="STUDIO"
    scene.display.shading.color_type="MATERIAL"
    scene.render.resolution_x=1200;scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(folder/"AEGIS_Blender_Review.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/"AEGIS_Outpost.blend"))
    bpy.ops.render.render(write_still=True)
    report={"version":bpy.app.version_string,"meshes":len(objects),"materials":len(bpy.data.materials),"render":scene.render.filepath}
    (folder/"blender_report.json").write_text(json.dumps(report,indent=2))
    print("FORGE3D_REPORT",json.dumps(report))
main()
