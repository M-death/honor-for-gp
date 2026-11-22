# d376: build the game boat LODs from the replay 0.43 boat v4 (hfgp_boat_hull_v4.blend) + the old game motor.
# python build_boat_v3.py <hull_v4.blend> <old_game_hfgp3d_dir> <out_dir>
# Painted parts (hull sides, deck, cowl outside, fenders, stern panels — as the replay's livery.py) become one material
# HullLivery: the game paints it from the venue's livery sheet (hfgp-livery-v1, UV-free, boat_actor.js). The cowl lip and
# inside are HullLip / HullInner (plain colours from livery.json "parts"). Bottom paint, wood, rubber, metal stay as they are.
import bpy, bmesh, sys, math
import numpy as np
from mathutils import Vector
src, old, out = sys.argv[-3:]
PAINT = ('Hull_Aft', 'Hull_Fore', 'Deck', 'Cowling_Outer', 'Fender_White', 'Stern_Panel')
SKIP = ('Bottom_Paint', 'Rubber', 'Aluminium', 'Varnished_Plywood')
DY = .498          # new hull origin = cockpit; the game's RacerMount sits 0.498 m ahead of the boat origin
import os
COWL_TOP = float(os.environ.get('COWL_TOP', '0'))   # >0: squash the cowl walls so their top is at this height (m)
TARGET = {'pc1080ti': [20000, 7000, 2500], 'mobile': [6000, 2500, 1200]}
DROP = [set(), {'Cowl_Fastener', 'Steering_Wire', 'Throttle_Cable', 'Stern_Handle', 'Floor_Grip_Mat', 'Bow_Handle'},
        {'Cowl_Fastener', 'Steering_Wire', 'Throttle_Cable', 'Stern_Handle', 'Floor_Grip_Mat', 'Bow_Handle', 'Bottom_Fin', 'Side_Impact_Pad',
         'Throttle_Bracket', 'Steering_Mount', 'Cowling_Base_Seal', 'Transom_Cap', 'Motor_Mount_Plate', 'Soft_Bow_Cap', 'Side_Coaming',
         'Front_Coaming', 'Wheel_Mesh', 'Steering_Column', 'Throttle_Mesh', 'Cowling_Inner'}]
ST = [(-1.20, .55), (-.95, .62), (-.45, .65), (.15, .625), (.65, .54), (1.1, .42), (1.5, .285), (1.77, .18), (1.91, .14), (1.95, .10)]
def width(y):
    for a, b in zip(ST, ST[1:]):
        if y <= b[0]: return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0])
    return .10
# material zone of each source material
ZONE = {'Bottom_Paint': 'BoatBottom',
        'Varnished_Plywood': 'BoatWood', 'Rubber': 'BoatRubber', 'Rubber_Grip': 'BoatRubber', 'Aluminium': 'BoatMetal',
        'Metal_Aluminium': 'BoatMetal', 'Fasteners': 'BoatMetal', 'Paint_White': 'BoatGuard', 'Race_Number': 'BoatMetal'}
def srgb2lin(c): return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)
MATS = {  # name: (base colour sRGB, roughness, metallic, clearcoat)
    'HullLivery': ((1, 1, 1), .26, 0, .4), 'HullLip': ((1, 1, 1), .26, 0, .4), 'HullInner': ((1, 1, 1), .3, 0, .2),
    'BoatBottom': ((.92, .63, .17), .4, 0, .3), 'BoatWood': ((.62, .34, .14), .37, 0, .25), 'BoatRubber': ((.10, .11, .12), .72, 0, 0),
    'BoatMetal': ((.72, .76, .82), .29, .8, 0), 'BoatGuard': ((.94, .95, .96), .3, 0, .3)}

def fix_factors(path):
    import json, struct
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); rest = b[20 + n:]
    for m in j.get('materials', []):
        k = m['name'].split('.')[0]
        if k in MATS:
            c = srgb2lin(MATS[k][0]); m.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = [*c, 1]
    t = json.dumps(j, separators=(',', ':')).encode(); t += b' ' * (-len(t) % 4)
    body = struct.pack('<II', len(t), 0x4E4F534A) + t + rest
    open(path, 'wb').write(b[:8] + struct.pack('<I', 12 + len(body)) + body)

def build(tier, lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {}
    for n, (c, r, m, cc) in MATS.items():
        mt = bpy.data.materials.new(n); mt.use_nodes = True; p = mt.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*srgb2lin(c), 1); p.inputs['Roughness'].default_value = r; p.inputs['Metallic'].default_value = m
        p.inputs['Coat Weight'].default_value = cc if tier == 'pc1080ti' else 0; p.inputs['Coat Roughness'].default_value = .16
        mats[n] = mt
    with bpy.data.libraries.load(src, link=False) as (fr, to): to.objects = list(fr.objects)
    for o in to.objects:
        if o: bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    keep = []
    for o in objs:
        base = o.name.split('.')[0]
        if base in ('Flag_Mesh',) or base in DROP[lod]: bpy.data.objects.remove(o); continue
        keep.append(o)
    # bake transforms, move to game origin, remap materials into zones
    for o in keep:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in keep:
        base = o.name.split('.')[0]
        me = o.data
        for v in me.vertices: v.co.y += DY
        if COWL_TOP and base in ('Cowling_Outer', 'Cowling_Inner', 'Cowling_Opening_Lip', 'Side_Coaming', 'Front_Coaming', 'Side_Impact_Pad'):
            for v in me.vertices:
                if v.co.z > .2: v.co.z = .2 + (v.co.z - .2) * (COWL_TOP - .2) / (.625 - .2)
        old_names = [m.name.split('.')[0] if m else 'Aluminium' for m in me.materials]
        zones = []
        for n in old_names:
            if base in PAINT and n not in SKIP: zones.append('HullLivery')
            elif base == 'Cowling_Opening_Lip': zones.append('HullLip')
            elif base == 'Cowling_Inner': zones.append('HullInner')
            elif n == 'Paint_White': zones.append('BoatGuard')        # soft bow
            else: zones.append(ZONE.get(n, 'BoatMetal'))
        idx = [zones[p.material_index] for p in me.polygons]
        me.materials.clear()
        used = sorted(set(idx))
        for z in used: me.materials.append(mats[z])
        for i, p in enumerate(me.polygons): p.material_index = used.index(idx[i])
    for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o not in keep]: bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.join(); hull = bpy.context.view_layer.objects.active; hull.name = 'BoatMesh'; hull.data.name = 'BoatMesh'
    # weld coincident verts per material island so collapse has something to work with
    bm = bmesh.new(); bm.from_mesh(hull.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(hull.data); bm.free()
    # old motor
    bpy.ops.import_scene.gltf(filepath=f'{old}/{tier}/boat_lod{lod}.glb')
    imp = [o for o in bpy.data.objects if o != hull]
    oldmesh = bpy.data.objects.get('BoatMesh.001')
    if oldmesh: bpy.data.objects.remove(oldmesh)
    motor_tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' and o != hull for p in o.data.polygons)
    tgt = TARGET[tier][lod] - motor_tris
    n0 = sum(len(p.vertices) - 2 for p in hull.data.polygons)
    if n0 > tgt:
        md = hull.modifiers.new('dec', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = tgt / n0; md.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = hull; bpy.ops.object.modifier_apply(modifier='dec')
    for p in hull.data.polygons: p.use_smooth = True
    hull.data.set_sharp_from_angle(angle=math.radians(40)) if hasattr(hull.data, 'set_sharp_from_angle') else None
    # d375 (まえ: のっぺりしてる): new UVs on the decimated hull + ambient occlusion baked into a grey map. Every hull material
    # takes it as its colour map (map × the material colour, so the venue colours still work): contact shadows round the
    # cowl, the cockpit, under the gunwale and fittings give the hull depth.
    AO_RES = {'pc1080ti': [1024, 512, 256], 'mobile': [512, 256, 128]}[tier][lod]
    me = hull.data
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT'); hull.select_set(True); bpy.context.view_layer.objects.active = hull
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.004, area_weight=.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('hull_ao', AO_RES, AO_RES, alpha=False, float_buffer=False); img.colorspace_settings.name = 'sRGB'
    for mt in me.materials:
        nt = mt.node_tree; t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.name = 'AO'; nt.nodes.active = t
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 256
    sc.render.bake.margin = 4; sc.render.bake.use_selected_to_active = False
    if sc.world is None: sc.world = bpy.data.worlds.new('W')
    bpy.ops.object.bake(type='AO', margin=4)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    g = px[:, 0].reshape(AO_RES, AO_RES)
    for _ in range(2):   # soften the bake noise (islands have a 4 px margin)
        g = (g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)) / 5
    px[:, 0] = g.ravel()
    ao = np.clip(px[:, 0], 0, 1) ** 1.25 * .82 + .18          # keep the darkest crease at ~0.2, open faces near 1
    px[:, 0] = px[:, 1] = px[:, 2] = ao; img.pixels.foreach_set(px.ravel()); img.pack()
    for mt in me.materials:
        nt = mt.node_tree; p = nt.nodes['Principled BSDF']; nt.links.new(nt.nodes['AO'].outputs['Color'], p.inputs['Base Color'])
    root = bpy.data.objects['BoatRoot']; hull.parent = root
    # nodes that moved with the new hull shape
    def put(name, xyz):
        o = bpy.data.objects.get(name)
        if o: mw = o.matrix_world.copy(); mw.translation = Vector(xyz); o.matrix_world = mw
    put('BowTip', (0, 2.31, .16))      # the game's pennant stands 0.16 m behind BowTip: just behind the bow handle (racer view keeps it small)
    put('FX_Bow_Port', (-.45, 1.438, .1)); put('FX_Bow_Starboard', (.45, 1.438, .1)); put('FX_Wake', (0, -1.2 + DY, .02))
    n1 = sum(len(p.vertices) - 2 for p in hull.data.polygons)
    import os; os.makedirs(f'{out}/{tier}', exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=f'{out}/{tier}/boat_lod{lod}.glb', export_format='GLB', export_extras=False, export_animations=False,
                              export_apply=True, export_texcoords=True, export_normals=True)
    fix_factors(f'{out}/{tier}/boat_lod{lod}.glb')
    print('BUILT', tier, lod, 'hull', n0, '->', n1, 'motor', motor_tris, 'total', n1 + motor_tris, [m.name for m in hull.data.materials])

for tier in TARGET:
    for lod in range(3): build(tier, lod)
