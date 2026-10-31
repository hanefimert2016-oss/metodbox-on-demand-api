import numpy as np
import trimesh
def validate_world(path,triangle_budget=180000):
    sc=trimesh.load(path,force="scene",process=False)
    issues=[];tris=0;names=[];materials=set()
    for node in sc.graph.nodes_geometry:
        mat,geo=sc.graph[node];mesh=sc.geometry[geo];names.append(node)
        tris+=len(mesh.faces)
        if len(mesh.faces)==0 or not np.isfinite(mesh.vertices).all() or not np.isfinite(mat).all():issues.append(node+": invalid mesh")
        if not mesh.is_winding_consistent:issues.append(node+": normals")
        if np.any(mesh.area_faces<1e-9):issues.append(node+": degenerate triangles")
        material=getattr(mesh.visual,"material",None)
        if material is None:issues.append(node+": material missing")
        else:materials.add(material.name)
    if tris>triangle_budget:issues.append("triangle budget exceeded")
    if len(names)!=len(set(names)):issues.append("duplicate node names")
    bounds=sc.bounds
    if not 115<bounds[1][0]-bounds[0][0]<140:issues.append("width wrong")
    if not 115<bounds[1][1]-bounds[0][1]<140:issues.append("depth wrong")
    return {"passed":not issues,"triangles":tris,"meshes":len(names),"materials":sorted(materials),"bounds":bounds.tolist(),"issues":issues}
