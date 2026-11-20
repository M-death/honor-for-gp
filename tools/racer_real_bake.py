# d369: run with a Python that has bpy:  python tools/racer_real_bake.py <male|female> <hfgp_racer_KIND_realistic.blend (replay 0.37)> <outdir> 2048
# bake 0.37 colour zones into UV-space textures for the game (base with kapok baked, mask = lane/suit/accent weight×shade/2)
import bpy, sys, numpy as np
from PIL import Image
kind, src, out, RES = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
CFG = {'male': {'collarZ': (1.43, 1.43), 'warm': .022, 'vestLum': .67, 'suitLum': .69, 'stripeLum': .22},
       'female': {'collarZ': (1.483, 1.44), 'warm': .05, 'vestLum': .76, 'suitLum': .85, 'stripeLum': .19}}[kind]
KAP = np.array([.80, .55, .02])
TORSO = ('Spine', 'Chest', 'Hips', 'Neck', 'Clavicle_L', 'Clavicle_R'); ARMS = ('UpperArm_L', 'UpperArm_R', 'Forearm_L', 'Forearm_R')
bpy.ops.wm.open_mainfile(filepath=src)
o = bpy.data.objects['RacerMesh_' + kind]; me = o.data
names = [g.name for g in o.vertex_groups]
nv = len(me.vertices)
torso = np.zeros(nv); cloth = np.zeros(nv)
rest = np.array([me.attributes['RacerRest'].data[i].vector[:] for i in range(nv)]) if 'RacerRest' in me.attributes else np.array([v.co[:] for v in me.vertices])
for v in me.vertices:
    best, bw = None, -1
    for g in v.groups:
        if g.weight > bw: best, bw = names[g.group], g.weight
    z = rest[v.index, 2]
    collar = best in ('Head', 'Neck') and z < 1.57
    torso[v.index] = 1. if best in TORSO or collar else 0.
    cloth[v.index] = 1. if best in TORSO or best in ARMS else 0.
me.calc_loop_triangles()
tri_v = np.array([t.vertices[:] for t in me.loop_triangles]); tri_l = np.array([t.loops[:] for t in me.loop_triangles])
uv = np.zeros((len(me.loops), 2)); me.uv_layers['UVMap'].data.foreach_get('uv', uv.ravel())
print('tris', len(tri_v))
# rasterize attrs [torso, cloth, restY, restZ] into RES×RES
attr = np.stack([torso, cloth, rest[:, 1], rest[:, 2]], 1)
img = np.zeros((RES, RES, 4)); cov = np.zeros((RES, RES), bool)
P = uv[tri_l] * RES   # (T,3,2) pixel coords, v up
P[..., 1] = RES - P[..., 1]
for t in range(len(tri_v)):
    p = P[t]; a = attr[tri_v[t]]
    x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
    x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, RES - 1); y1 = min(y1, RES - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
    (ax, ay), (bx, by), (cx, cy) = p
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-12: continue
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d; w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d; w2 = 1 - w0 - w1
    m = (w0 >= -.02) & (w1 >= -.02) & (w2 >= -.02)
    if not m.any(): continue
    val = w0[..., None] * a[0] + w1[..., None] * a[1] + w2[..., None] * a[2]
    sub = img[y0:y1 + 1, x0:x1 + 1]; sub[m] = val[m]; cov[y0:y1 + 1, x0:x1 + 1] |= m
# dilate coverage a few px so seams don't bleed
for _ in range(4):
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.roll(np.roll(img, dy, 0), dx, 1); sc = np.roll(np.roll(cov, dy, 0), dx, 1)
        fill = sc & ~cov; img[fill] = sh[fill]; cov |= fill
base_img = next(i for i in bpy.data.images if 'basecolor' in i.name)
tmp = out + f'/{kind}_base4k.png'; base_img.filepath_raw = tmp; base_img.file_format = 'PNG'; base_img.save()
tex = np.asarray(Image.open(tmp).convert('RGB').resize((RES, RES), Image.LANCZOS)).astype(np.float64) / 255.   # sRGB values
R, G, B = tex[..., 0], tex[..., 1], tex[..., 2]
lum = .2126 * R + .7152 * G + .0722 * B; warm = R - B; blue = B - R
ramp = lambda v, lo, hi: np.clip((v - lo) / (hi - lo), 0, 1)
T = (img[..., 0] > .5) * 1.; Cl = (img[..., 1] > .5) * 1.
rw = ramp(warm, CFG['warm'] - .012, CFG['warm'] + .012)
vest = T * rw * ramp(lum, .22, .30)
stripe = Cl * ramp(blue, .05, .09) * (1 - vest)
suit = Cl * ramp(lum, .42, .5) * (1 - vest) * (1 - rw)
czf, czb = CFG['collarZ']; cz = np.where(img[..., 2] > 0, czf, czb)
collar = np.clip((img[..., 3] - (cz - .006)) / .012, 0, 1)
body = vest * (1 - collar); kap = vest * collar
shade = lambda ref: np.clip(lum / ref, .25, 1.35) ** 2.2
lin = lambda s: np.where(s <= .04045, s / 12.92, ((s + .055) / 1.055) ** 2.4)
srgb = lambda l: np.where(l <= .0031308, l * 12.92, 1.055 * np.clip(l, 0, None) ** (1 / 2.4) - .055)
tl = lin(tex)
# sequential mixes as in 0.37: body, kapok, suit, stripe → effective weights
eb = body * (1 - suit) * (1 - stripe); ek = kap * (1 - suit) * (1 - stripe); es = suit * (1 - stripe); et = stripe
keep = 1 - eb - ek - es - et
baseL = tl * keep[..., None] + (ek * shade(CFG['vestLum']))[..., None] * KAP
mask = np.stack([eb * shade(CFG['vestLum']), es * shade(CFG['suitLum']), et * shade(CFG['stripeLum'])], -1) / 2.
Image.fromarray((np.clip(srgb(baseL), 0, 1) * 255 + .5).astype(np.uint8)).save(out + f'/{kind}_base_{RES}.png')
Image.fromarray((np.clip(mask, 0, 1) * 255 + .5).astype(np.uint8)).save(out + f'/{kind}_mask_{RES}.png')
# preview with sample colours (lane 3 red, suit blue/grey)
prev = baseL + 2 * (mask[..., :1] * np.array([.8, .02, .02]) + mask[..., 1:2] * np.array([.05, .1, .5]) + mask[..., 2:3] * np.array([.6, .6, .6]))
Image.fromarray((np.clip(srgb(prev), 0, 1) * 255 + .5).astype(np.uint8)).save(out + f'/{kind}_preview_{RES}.png')
print('done', kind, 'vest px', int(eb.sum()), 'suit', int(es.sum()), 'stripe', int(et.sum()), 'kap', int(ek.sum()))
