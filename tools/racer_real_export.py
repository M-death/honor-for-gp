# d369: python tools/racer_real_export.py <male|female> <blend> <outdir>  → outdir/{mobile,pc1080ti}/racer_KIND_lodN.glb
import bpy, sys
kind, src, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
targets = [('mobile', 0, 9000), ('mobile', 1, 3500), ('mobile', 2, 1500), ('pc1080ti', 0, 36000), ('pc1080ti', 1, 12000), ('pc1080ti', 2, 4000)]
for tier, lod, tri in targets:
    bpy.ops.wm.open_mainfile(filepath=src)
    arm = bpy.data.objects['RacerRoot_' + kind]; o = bpy.data.objects['RacerMesh_' + kind]
    for ob in list(bpy.data.objects):
        if ob not in (arm, o): bpy.data.objects.remove(ob)
    arm.name = 'RacerRoot'; o.name = 'RacerMesh'; arm.data.pose_position = 'REST'
    print('xf', tuple(round(x, 3) for x in arm.matrix_world.translation), tuple(round(x, 3) for x in arm.scale), tuple(round(x, 3) for x in o.matrix_world.translation))
    me = o.data
    for a in [a.name for a in me.attributes if a.name in ('RacerRest', 'hfgp_torso', 'hfgp_cloth', 'hfgp_collar')]: me.attributes.remove(me.attributes[a])
    n0 = len(me.polygons)
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = tri / n0; m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    # decimate must come before the armature modifier
    while o.modifiers[0].name != 'dec': bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
    mat = bpy.data.materials.new('RacerReal'); mat.use_nodes = True
    p = mat.node_tree.nodes['Principled BSDF']; p.inputs['Roughness'].default_value = .7; p.inputs['Metallic'].default_value = 0
    me.materials.clear(); me.materials.append(mat)
    print(tier, lod, 'tris', sum(len(p.vertices) - 2 for p in me.polygons))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=f'{outdir}/{tier}/racer_{kind}_lod{lod}.glb', export_format='GLB', use_selection=True, export_skins=True,
        export_animations=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_yup=True, export_apply=False)
