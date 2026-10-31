"""AEGIS Outpost: deterministic procedural, textured-by-material real game level.

Coordinates in metres, Z up internally; glTF viewers handle GLB transform.
Static meshes are batched by (district, material), preserving reasonable draw calls.
Game collisions and gameplay markers are shipped separately for reliable import.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh

SEED = 4026
WORLD_SIZE = 124.0
MATS = {
    # colour in linear-ish glTF factors, metallic, roughness, emissive
    'basalt': ([0.105, .14, .18, 1], .18, .88, None),
    'terrain': ([.16, .205, .22, 1], .05, .94, None),
    'road': ([.075, .098, .126, 1], .12, .86, None),
    'pad': ([.16, .20, .24, 1], .50, .52, None),
    'wall': ([.245, .305, .35, 1], .64, .39, None),
    'roof': ([.09, .13, .18, 1], .80, .28, None),
    'dark': ([.025, .045, .067, 1], .42, .49, None),
    'edge': ([.39, .47, .50, 1], .77, .33, None),
    'copper': ([.72, .30, .105, 1], .72, .37, None),
    'safety': ([.94, .56, .09, 1], .18, .52, None),
    'cyan': ([.028, .53, .88, 1], .13, .21, [.02, .48, .80]),
    'blue': ([.03, .18, .45, 1], .24, .27, [.02, .12, .46]),
    'hot': ([.96, .19, .12, 1], .14, .29, [.75, .065, .025]),
    'white': ([.63, .91, .93, 1], .14, .22, [.45, .7, .75]),
    'glass': ([.07, .22, .30, 1], .39, .11, None),
    'stone': ([.22, .26, .28, 1], .0, .92, None),
}


def material(key):
    rgba, metal, rough, emissive = MATS[key]
    args=dict(name=f'AEGIS_{key}', baseColorFactor=rgba, metallicFactor=metal,
              roughnessFactor=rough, doubleSided=False)
    if emissive:args['emissiveFactor']=emissive
    return trimesh.visual.material.PBRMaterial(**args)


@dataclass
class Placement:
    position: tuple
    radius: float = 1.0


class Builder:
    def __init__(self, seed=SEED):
        self.rng = np.random.default_rng(seed)
        self.groups: dict[tuple[str,str], list[trimesh.Trimesh]] = {}
        self.collision=[]
        self.landmarks=[]
        self.traversal=[]

    def add(self, geom, position, mat, district='general', rotation=0, collider=False):
        obj=geom.copy()
        if rotation:
            t=trimesh.transformations.rotation_matrix(math.radians(rotation), [0,0,1]);obj.apply_transform(t)
        obj.apply_translation(position)
        self.groups.setdefault((district,mat),[]).append(obj)
        if collider:
            self.collision.append(obj.copy())
        return obj

    def box(self, pos, dims, mat, district='general', rot=0, collider=False):
        return self.add(trimesh.creation.box(extents=dims),pos,mat,district,rot,collider)

    def cyl(self, pos, radius, height, mat, district='general', sides=24, collider=False):
        return self.add(trimesh.creation.cylinder(radius=radius,height=height,sections=sides),pos,mat,district,collider=collider)

    def cone(self,pos,radius,height,mat,district='general',sides=6):
        return self.add(trimesh.creation.cone(radius=radius,height=height,sections=sides),pos,mat,district)

    def beam(self, a, b, thickness, mat, district='general', collider=False):
        a=np.array(a,dtype=float);b=np.array(b,dtype=float)
        delta=b-a; length=np.linalg.norm(delta)
        box=trimesh.creation.box(extents=(thickness,thickness,length))
        # align local z with the vector (safe even for verticals)
        mat3=trimesh.geometry.align_vectors([0,0,1],delta/length)
        box.apply_transform(mat3);box.apply_translation((a+b)/2)
        return self.add(box,(0,0,0),mat,district,collider=collider)

    def ring(self, x, y, z, radius, width, mat, district='reactor', segments=36):
        # ring built from carefully aligned chords, avoiding large opaque discs
        for i in range(segments):
            t=(i+.5)*2*math.pi/segments
            length=2*(radius)*math.sin(math.pi/segments)+width*.7
            self.box((x+radius*math.cos(t),y+radius*math.sin(t),z),
                     (length,width,.09),mat,district,math.degrees(t)+90)

    def structure(self, name, x, y, sx, sy, height, district, doors=('south',)):
        # modular hab/industrial shell with open doorway and protruding supports
        base=.25
        self.box((x,y,base),(sx,sy,.50),'pad',district,collider=True)
        sidewall=.52
        for side in ('north','south','east','west'):
            if side in ('north','south'):
                yy=y+(sy/2-.26)*(1 if side=='north' else -1)
                if side in doors:
                    # wide door gap, actual navigable opening
                    gap=min(5.8,sx*.38);slen=(sx-gap)/2
                    for sgn in (-1,1):
                        self.box((x+sgn*(gap/2+slen/2),yy,height/2+.35),
                                 (slen,.52,height-.7),'wall',district,collider=True)
                    self.box((x,yy,height-.20),(gap+.5,.8,.55),'edge',district)
                    self.box((x,yy,height-.68),(gap-.4,.15,.09),'cyan',district)
                else:
                    self.box((x,yy,height/2+.35),(sx,.52,height-.7),'wall',district,collider=True)
                for i in np.linspace(-sx/2+1.5,sx/2-1.5,max(2,int(sx/3.2))):
                    self.box((x+i,yy+(-.30 if side=='south' else .30),height*.65),
                             (1.25,.06,.85),'glass',district)
                    self.box((x+i,yy+(-.35 if side=='south' else .35),height*.27),
                             (1.3,.09,.07),'cyan',district)
            else:
                xx=x+(sx/2-.26)*(1 if side=='east' else -1)
                if side in doors:
                    gap=min(5.8,sy*.38);slen=(sy-gap)/2
                    for sgn in (-1,1):
                        self.box((xx,y+sgn*(gap/2+slen/2),height/2+.35),(.52,slen,height-.7),'wall',district,collider=True)
                    self.box((xx,y,height-.20),(.8,gap+.5,.55),'edge',district)
                else:
                    self.box((xx,y,height/2+.35),(.52,sy,height-.7),'wall',district,collider=True)
        # roof in ribs and plates -- massive industrial form, no organic geometry
        for k in range(-2,3):
            self.box((x+k*sx/5,y,height+.20),(sx/5-.17,sy+.6,.47),'roof',district,collider=True)
        for sgn in [-1,1]:
            self.box((x,y+sgn*(sy/2+.17),height+.52),(sx+.9,.28,.19),'edge',district)
        # corner legs + warning lamps
        for dx in [-sx/2+.5,sx/2-.5]:
            for dy in [-sy/2+.5,sy/2-.5]:
                self.box((x+dx,y+dy,height/2),(.72,.72,height),'dark',district)
                self.box((x+dx,y+dy,height+.36),(.9,.9,.16),'safety',district)
        self.landmarks.append({'name':name,'position':[x,y,0],'size':[sx,sy,height],'type':'building'})

    def tower(self,x,y,height,name):
        d='watchtowers'
        for dx in (-1.8,1.8):
            for dy in (-1.8,1.8):
                self.box((x+dx,y+dy,height/2),(.7,.7,height),'edge',d,collider=True)
                self.box((x+dx,y+dy,height/2),(.12,.82,height-.4),'cyan',d)
        self.box((x,y,height),(6.0,6.0,.65),'roof',d,collider=True)
        self.box((x,y,height+1.2),(5,5,1.9),'glass',d)
        self.box((x,y,height+2.2),(6.4,6.4,.35),'edge',d)
        for i in range(4):
            t=math.pi/2*i
            self.box((x+2.9*math.cos(t),y+2.9*math.sin(t),height+.32),
                     (6.0 if i%2 else .16,.16 if i%2 else 6.0,.7),'safety',d)
        self.cyl((x,y,height+3.8),.19,2.8,'edge',d)
        self.cyl((x,y,height+5.1),.35,.28,'hot',d)
        self.landmarks.append({'name':name,'position':[x,y,height],'type':'tower'})

    def cover(self,x,y,rot=0,kind='crate',district='cover'):
        if kind=='crate':
            self.box((x,y,.85),(1.8,1.8,1.7),'dark',district,rot,collider=True)
            for level in [.23,1.45]:
                self.box((x,y,level),(1.93,1.94,.13),'edge',district,rot)
            for off in [-.64,.64]:
                self.box((x+off,y,.86),(.09,1.92,1.0),'safety',district,rot)
            self.box((x,y,1.76),(1.1,1.1,.05),'cyan',district,rot)
        else:
            self.box((x,y,.75),(4.0,.92,1.5),'wall',district,rot,collider=True)
            self.box((x,y,1.48),(4.25,1.2,.13),'edge',district,rot)
            self.box((x,y,.22),(3.7,1.03,.09),'safety',district,rot)


def build_world(destination, metadata_path=None, collider_path=None, seed=SEED):
    b=Builder(seed)
    rng=b.rng
    # 0. PLANAR TRAVERSAL. All major play surfaces have ground at z=0.20.
    b.box((0,0,-.62),(124,124,1.2),'terrain','environment',collider=True)
    for axis in ('x','y'):
        if axis=='x':
            b.box((0,0,.033),(110,10,.08),'road','roads')
            for x in np.arange(-52,53,7):
                b.box((float(x),0,.09),(2.3,.16,.035),'safety','markings')
        else:
            b.box((0,0,.045),(10,110,.08),'road','roads')
            for y in np.arange(-52,53,7):
                b.box((0,float(y),.11),(.16,2.3,.035),'safety','markings')
    # Major zone foundations and modular pavement
    for x,y,sx,sy in [(0,0,27,27),(-35,28,28,25),(35,-27,29,28),(-34,-33,25,22),(29,34,24,24)]:
        b.box((x,y,.13),(sx,sy,.22),'pad','foundations',collider=True)
        for row in np.arange(-sy/2+3,sy/2-1,5):
            b.box((x,y+row,.25),(sx-.8,.09,.032),'edge','foundations')
    # Perimeter walls (open gates north & south), with vertical light ribs
    for sgn in [-1,1]:
        x=sgn*57
        for yy in (-42,-18,6,30,49):
            b.box((x,yy,2.2),(.95,18,4.4),'wall','perimeter',collider=True)
            b.box((x+sgn*.55,yy,4.55),(.23,18,.22),'cyan','perimeter')
        for xx in (-42,-18,18,42):
            b.box((xx,sgn*57,2.2),(18,1.0,4.4),'wall','perimeter',collider=True)
            b.box((xx,sgn*57,4.49),(18,1.15,.18),'edge','perimeter')
    # road gates with useful visual signage
    for y in (-57,57):
        for x in (-7.5,7.5):
            b.box((x,y,3.4),(1.3,2.1,6.8),'edge','gates',collider=True)
            b.box((x,y,6.85),(1.3,1.3,.19),'cyan','gates')
        b.box((0,y,7.2),(16.5,1.9,1.15),'roof','gates')
        b.box((0,y,6.57),(12.3,2.03,.14),'safety','gates')
    # tower locations avoid walking entrances
    for x,y in [(-51,51),(51,51),(-51,-51),(51,-51)]:
        b.tower(x,y,11.0,f'Sentry_{int(x)}_{int(y)}')
    # 1. CENTER REACTOR - recognizable objective silhouette
    b.cyl((0,0,.28),9.4,.55,'roof','reactor',sides=48,collider=True)
    b.cyl((0,0,1.0),7.0,1.0,'dark','reactor',sides=48,collider=True)
    for r,z in [(8.1,.65),(6.25,1.53),(5.0,2.4),(3.6,5.45)]:b.ring(0,0,z,r,.29,'cyan','reactor',48)
    for i in range(12):
        th=i*math.tau/12
        xx,yy=6.9*math.cos(th),6.9*math.sin(th)
        b.box((xx,yy,2.1),(.58,.78,2.2),'edge','reactor',math.degrees(th),collider=True)
        b.box((xx,yy,3.25),(.70,1.0,.25),'safety','reactor',math.degrees(th))
    b.cyl((0,0,3.65),3.55,4.6,'wall','reactor',sides=32,collider=True)
    b.cyl((0,0,6.2),2.78,.60,'copper','reactor',sides=32)
    b.cyl((0,0,8.0),2.2,3.2,'glass','reactor',sides=32)
    b.cyl((0,0,9.72),2.7,.42,'edge','reactor',sides=32)
    b.cyl((0,0,11.0),1.2,2.15,'cyan','reactor',sides=32)
    b.cyl((0,0,12.1),1.6,.25,'white','reactor',sides=32)
    for i in range(8):
        a=i*math.tau/8
        b.beam((3.4*math.cos(a),3.4*math.sin(a),2.5),
               (2.1*math.cos(a),2.1*math.sin(a),9.3),.35,'copper','reactor')
    b.landmarks.append({'name':'AEGIS Core','position':[0,0,10.5],'type':'objective','radius':9.5})
    # 2. MAIN STRUCTURES
    b.structure('Operations HQ',-35,28,24,21,9.2,'operations',('south','east'))
    b.structure('Vehicle Hangar',35,-27,26,23,10.5,'hangar',('south','west'))
    b.structure('Service Depot',-34,-33,22,18,6.2,'depot',('north',))
    b.structure('Comms Laboratory',29,34,20,19,8.0,'comms',('west',))
    # 3. DISTINCTIVE RADAR MAST + ANTENNAS
    b.cyl((29,34,10),.58,4.0,'edge','comms',sides=12)
    for i in range(3):
        angle=i*120
        b.beam((29,34,11.8),(29+4*math.cos(math.radians(angle)),34+4*math.sin(math.radians(angle)),9.1),
               .18,'copper','comms')
    b.cyl((29,34,12.7),1.55,.3,'cyan','comms',sides=32)
    b.cyl((29,34,13.1),.28,1.0,'white','comms')
    for i in range(4):
        x=-44+i*3.4
        b.box((x,28,10.2),(1.9,5.2,.25),'glass','operations',rot=19)
        b.box((x,28,10.05),(2.2,5.4,.18),'cyan','operations',rot=19)
    # 4. ACCESS RAMPS, WALKWAYS AND RAILS for patrol variation (mostly visual)
    for xx in (-23.0, 22.8):
        b.box((xx,0,1.08),(2.4,16,2.1),'dark','catwalk',collider=True)
        b.box((xx,0,2.22),(2.8,16,.20),'pad','catwalk',collider=True)
        for sy in [-1,1]:
            b.box((xx+sy*1.23,0,3.13),(.10,16.3,1.8),'edge','catwalk')
            for y in np.arange(-7.0,8,2.4):
                b.box((xx+sy*1.25,float(y),2.45),(.20,.12,.4),'cyan','catwalk')
    # 5. LANDING PAD and hangar floor markings
    b.cyl((40,5,.25),10.5,.16,'roof','landing',sides=64)
    b.ring(40,5,.39,8.8,.48,'safety','landing',60)
    b.ring(40,5,.42,6.8,.18,'cyan','landing',48)
    for offset in (-3.3,3.3):
        b.box((40+offset,5,.43),(.55,8,.07),'white','landing')
    b.box((40,5,.46),(8,.55,.07),'white','landing')
    for x,y in [(29,-40),(40,-40),(29,-26),(40,-26)]:
        b.box((x,y,.53),(4,.12,.04),'safety','hangar')
    # 6. COVER placement: keep center lanes mostly clear
    for x,y in [(-16,-17),(-18,16),(17,-17),(17,17),(-29,-8),(-10,32),(29,16),(22,-39),(-43,-11),(10,-32),(35,46),(-36,46)]:
        b.cover(x,y,0 if x>0 else 90,'barrier')
    for x,y in [(-27,-19),(-23,-19),(-36,-19),(25,-21),(20,-21),(27,-11),(-41,10),(-43,13),
                (41,26),(42,30),(-11,-43),(12,43),(-47,-36)]:
        b.cover(x,y,int(rng.integers(0,4))*90,'crate')
    # 7. LIGHTING gantries and street-level details
    for x,y in [(-18,31),(-12,-34),(17,31),(14,-29),(-46,-2),(46,0),(-2,45),(0,-45)]:
        b.cyl((x,y,3.6),.13,7.2,'edge','utility',sides=10)
        b.box((x,y,7.3),(1.4,1.4,.27),'roof','utility')
        b.box((x,y,7.09),(.85,.85,.17),'cyan','utility')
    # dangerous canyon beyond retaining walls with deterministic boulders
    for i in range(105):
        x=float(rng.uniform(-61,61));y=float(rng.uniform(-61,61))
        if abs(x)<46 and abs(y)<46: continue
        rad=float(rng.uniform(.65,2.9));ang=float(rng.uniform(0,360))
        rock=trimesh.creation.icosphere(subdivisions=0,radius=1)
        rock.apply_scale([rad,rad*.72,rad*.41])
        b.add(rock,(x,y,.25+rad*.05),'stone' if i%4 else 'basalt','rockfield',ang)
    # sci-fi hazard stripes, reactor objective waypoints, neon perimeter
    for direction in (-1,1):
        for i in range(7):
            x=direction*(13.5+i*1.55)
            b.box((x,-10,.19),(1.1,.48,.06),'safety','markings',rot=40)
        b.box((direction*9.5,0,.18),(.15,11,.05),'cyan','markings')
    # spawn/extraction at clear ground behind perimeter
    markers=[
      {'id':'player_spawn','position':[-47,-44,.65],'facing_deg':45,'team':'blue'},
      {'id':'team_b_spawn','position':[47,44,.65],'facing_deg':225,'team':'red'},
      {'id':'extract_north','position':[0,51,.6],'facing_deg':180},
      {'id':'reactor_objective','position':[0,-11,.6],'facing_deg':90},
      {'id':'operations_terminal','position':[-33,13,.6],'facing_deg':0},
    ]
    for marker in markers:
        x,y,z=marker['position'];b.cyl((x,y,.24),1.05,.1,'cyan' if marker['id']=='player_spawn' else 'safety','markers',sides=24)
        b.ring(x,y,.3,1.4,.13,'white','markers',20)
    b.landmarks.append({'name':'Drop Zone','position':[-47,-44,0],'type':'spawn'})
    b.landmarks.append({'name':'Extraction','position':[0,51,0],'type':'extraction'})
    # Export by (district,material): stable logical names & far fewer draw calls
    sc=trimesh.Scene(base_frame='world');details=[]
    for (district,kind), meshes in sorted(b.groups.items()):
        merged=trimesh.util.concatenate(meshes)
        merged.visual=trimesh.visual.TextureVisuals(material=material(kind))
        name=f'{district}__{kind}'
        sc.add_geometry(merged,geom_name=name,node_name=name)
        details.append({'name':name,'primitives':len(meshes),'triangles':len(merged.faces),'material':kind})
    dest=Path(destination);dest.parent.mkdir(parents=True,exist_ok=True)
    sc.export(str(dest),file_type='glb')
    collision_path=Path(collider_path or dest.with_name(dest.stem+'_collision.glb'))
    cs=trimesh.Scene(base_frame='world')
    if b.collision:
        # Colliders are approximate; individual mesh collider nodes imported by physics engines.
        for i,mesh in enumerate(b.collision):
            cs.add_geometry(mesh,geom_name=f'Collider_{i:03}',node_name=f'Collider_{i:03}')
    cs.export(str(collision_path),file_type='glb')
    meta={
      'name':'AEGIS OUTPOST','version':'0.2','units':'metres','authoring_up':'Z',
      'gltf_viewer_up':'Y (GLB exporter root transform handled by importer)',
      'description':'Modular sci-fi capture-the-core arena, decorative paths, 4 structures and 4 sentry towers.',
      'world_size_m':[124,124], 'main_ground_elevation_m':0.0,
      'gameplay':{'style':'arena shooter / exploration','suggested_players':'1-8','markers':markers},
      'landmarks':b.landmarks,
      'district_material_batches':details,
      'collision':{'asset':collision_path.name,'kind':'static approximate triangle meshes','count':len(b.collision),
                   'warning':'Collision is separate; optimize/use static trimesh or replace with convex primitives per engine'},
      'navigation':{'asset':'navigation.json','note':'Waypoint graph for flat ground only; not an engine navmesh'},
      'limitations':['No authored lightmap UV2 or baked lightmaps','No playable game controller included',
                     'Hand-authored/craft procedural architecture, not AAA hero art',
                     'Physics collision meshes need engine-specific tuning'],
      'source_seed':seed,
    }
    meta_path=Path(metadata_path or dest.with_suffix('.json'))
    meta_path.write_text(json.dumps(meta,indent=2),encoding='utf8')
    # Connected waypoints on ground. Explicit safe points bypass reactor and large buildings.
    # Not a generated navmesh: used as design guidance for engine import.
    nodes={
      'spawn':[-47,-44,0], 'south_road':[0,-45,0], 'west_road':[-46,0,0],
      'north_road':[0,45,0], 'east_road':[46,0,0],
      'reactor_south':[0,-13,0], 'reactor_north':[0,14,0],
      'reactor_west':[-14,0,0], 'reactor_east':[14,0,0],
      'hangar_gate':[35,-41,0], 'hq_gate':[-35,15,0],
      'depot_gate':[-34,-23,0], 'comms_gate':[17,34,0],
      'extract':[0,51,0],'team_b':[47,44,0],
    }
    edges=[['spawn','south_road'],['south_road','reactor_south'],['south_road','hangar_gate'],
           ['reactor_south','reactor_west'],['reactor_south','reactor_east'],
           ['reactor_west','west_road'],['reactor_west','reactor_north'],
           ['reactor_east','east_road'],['reactor_east','reactor_north'],
           ['reactor_north','north_road'],['north_road','extract'],['north_road','team_b'],
           ['hq_gate','reactor_west'],['depot_gate','south_road'],['comms_gate','reactor_north']]
    (dest.parent/'navigation.json').write_text(json.dumps({'nodes':nodes,'edges':edges,'navmesh':False},indent=2),encoding='utf8')
    return {'visual_glb':str(dest),'collision_glb':str(collision_path),'metadata':str(meta_path),
            'meshes':len(sc.geometry),'triangles':int(sum(len(x.faces) for x in sc.geometry.values())),
            'components':int(sum(len(ms) for ms in b.groups.values())), 'material_keys':len(MATS)}