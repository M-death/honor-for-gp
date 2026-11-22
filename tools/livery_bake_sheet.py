# Bake a hfgp-livery-v1 sheet (base / lane / gloss + livery.json) from the replay v4 boat model and a colour recipe.
# python3 bake_sheet.py <blend> <recipe naniwa|practice> <out_dir> [size]
# The sheet is rasterised (orthographic, z-buffer) from the painted parts as seen from starboard / port / top, then each pixel
# gets its colour from the part, the material and its 3D position — the same recipe the replay app (boat_v3.py) uses.
import sys, json, math, os
import numpy as np
import bpy
from PIL import Image

blend, recipe, out = sys.argv[-4:-1] if len(sys.argv) > 4 and sys.argv[-1].isdigit() else sys.argv[-3:]
SIZE = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 4096
PAINT = ('Hull_Aft', 'Hull_Fore', 'Deck', 'Cowling_Outer', 'Fender_White', 'Stern_Panel')
SKIP = ('Bottom_Paint', 'Rubber', 'Aluminium', 'Varnished_Plywood')
bpy.ops.wm.open_mainfile(filepath=blend)

tris = []   # (xyz[3,3], part, mat, uv[3,2] or None)
allv = []   # bounds = the whole painted objects (bottom faces included), as the replay's livery.py measures them
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.split('.')[0] not in PAINT: continue
    me = o.data; me.calc_loop_triangles(); M = o.matrix_world
    co = np.array([tuple(M @ v.co) for v in me.vertices]); allv.append(co)
    uvl = me.uv_layers.get('NaniwaUV')
    for t in me.loop_triangles:
        mat = me.materials[t.material_index].name.split('.')[0] if me.materials else ''
        if mat in SKIP: continue
        uv = np.array([tuple(uvl.data[l].uv) for l in t.loops]) if uvl else None
        tris.append((co[list(t.vertices)], o.name.split('.')[0], mat, uv))
allp = np.concatenate(allv)
B = dict(ymin=float(allp[:, 1].min()), ymax=float(allp[:, 1].max()), zmin=float(allp[:, 2].min()), zmax=float(allp[:, 2].max()),
         half=float(np.abs(allp[:, 0]).max()))
print('bounds', {k: round(v, 4) for k, v in B.items()}, 'tris', len(tris))
parts = sorted(set(t[1] for t in tris)); mats = sorted(set(t[2] for t in tris))
L, H = B['ymax'] - B['ymin'], B['zmax'] - B['zmin']

def raster(panel, W, Hp):
    """returns part id, material id, xyz, uv per pixel (-1 = empty)"""
    pid = np.full((Hp, W), -1, np.int16); mid = np.full((Hp, W), -1, np.int16)
    dep = np.full((Hp, W), -1e9); P = np.zeros((Hp, W, 3), np.float32); U = np.zeros((Hp, W, 2), np.float32)
    for xyz, part, mat, uv in tris:
        x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
        us = (y - B['ymin']) / L
        if panel == 'S': px, py, d = us * W, (1 - (z - B['zmin']) / H) * Hp, x
        elif panel == 'P': px, py, d = (1 - us) * W, (1 - (z - B['zmin']) / H) * Hp, -x
        else: px, py, d = us * W, (x + B['half']) / (2 * B['half']) * Hp, z
        x0, x1 = int(max(0, math.floor(px.min()))), int(min(W - 1, math.ceil(px.max())))
        y0, y1 = int(max(0, math.floor(py.min()))), int(min(Hp - 1, math.ceil(py.max())))
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        den = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
        if abs(den) < 1e-12: continue
        a = ((py[1] - py[2]) * (gx - px[2]) + (px[2] - px[1]) * (gy - py[2])) / den
        b = ((py[2] - py[0]) * (gx - px[2]) + (px[0] - px[2]) * (gy - py[2])) / den
        c = 1 - a - b
        ins = (a >= -1e-4) & (b >= -1e-4) & (c >= -1e-4)
        if not ins.any(): continue
        dd = a * d[0] + b * d[1] + c * d[2]
        sub = dep[y0:y1 + 1, x0:x1 + 1]; win = ins & (dd > sub)
        if not win.any(): continue
        sub[win] = dd[win]
        pid[y0:y1 + 1, x0:x1 + 1][win] = parts.index(part); mid[y0:y1 + 1, x0:x1 + 1][win] = mats.index(mat)
        for k in range(3): P[y0:y1 + 1, x0:x1 + 1, k][win] = (a * xyz[0, k] + b * xyz[1, k] + c * xyz[2, k])[win]
        if uv is not None:
            for k in range(2): U[y0:y1 + 1, x0:x1 + 1, k][win] = (a * uv[0, k] + b * uv[1, k] + c * uv[2, k])[win]
    return pid, mid, P, U

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

def smooth(v, a, b, lo, hi):
    if a > b: a, b, lo, hi = b, a, hi, lo
    t = np.clip((v - a) / (b - a), 0, 1); t = t * t * (3 - 2 * t); return lo + (hi - lo) * t

def checker(P):
    """boat_v3._hull_paint (practice): the contrast checker ribbon from the bow deck down the port side"""
    C = {'rows': 3, 'cellY': .10, 'c0': -.10, 'c1': -.78, 'yBow': 1.68, 'ySide': .85, 'w0': .16, 'w1': .23, 'fade0': -.25, 'fade1': -1.15, 'wave': .02}
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    q = x + np.sign(x) * np.maximum(.19 - z, 0)
    c = smooth(y, C['yBow'], C['ySide'], C['c0'], C['c1']) + np.sin(y * 3.2) * smooth(y, C['ySide'], .2, 0, C['wave'])
    w = smooth(y, C['yBow'], C['ySide'] - .2, C['w0'], C['w1'])
    v = (q - c) / w
    inside = np.clip((.5 - np.abs(v)) * 400, 0, 1)
    cv = (v + .5) * C['rows']; cy = y / C['cellY']
    par = np.mod(np.floor(cv) + np.floor(cy), 2)
    size = smooth(y, C['fade0'], C['fade1'], 1, 0)
    fu = np.abs(np.mod(cy, 1) - .5); fv = np.abs(np.mod(cv, 1) - .5); half = size * .5
    sq = np.clip((half - fu) * 300, 0, 1) * np.clip((half - fv) * 300, 0, 1)
    return inside * par * sq

deck_img = None
if recipe == 'naniwa':
    im = bpy.data.images.get('naniwa_deck_basecolor.png')
    deck_img = np.array(im.pixels[:], np.float32).reshape(im.size[1], im.size[0], 4)[..., :3]   # bottom-up, linear? (sRGB bytes)
    deck_img = (deck_img * 255)

def colour(pid, mid, P, U):
    hh, ww = pid.shape
    base = np.zeros((hh, ww, 3), np.float32); lane = np.zeros((hh, ww, 3), np.float32); gloss = np.full((hh, ww), 255, np.float32)
    pn = np.array(parts + ['']); mn = np.array(mats + [''])
    pp = pn[pid]; mm = mn[mid]; cov = pid >= 0
    if recipe == 'naniwa':
        purple, green = hexc('#5e1f9c'), hexc('#2ef209')
        base[:] = purple
        base[mm == 'Naniwa_Green'] = green
        dk = cov & (pp == 'Deck')
        if dk.any():
            iy = np.clip(((U[..., 1]) * deck_img.shape[0]).astype(int), 0, deck_img.shape[0] - 1)
            ix = np.clip((U[..., 0] * deck_img.shape[1]).astype(int), 0, deck_img.shape[1] - 1)
            s = deck_img[iy, ix]
            gs = s[..., 1] / 255; gl = np.where(gs <= .04045, gs / 12.92, ((gs + .055) / 1.055) ** 2.4)   # the replay compares the linear G
            g = np.clip((gl - .15) / .2, 0, 1)[..., None]          # the green band stays, the purple is the deep purple
            col = purple * (1 - g) + green * g
            base[dk] = col[dk]
    else:
        red, white = hexc('#c8202a'), hexc('#e4ecf4')
        base[:] = white
        base[pp == 'Cowling_Outer'] = red
        hull = cov & np.isin(pp, ['Hull_Aft', 'Hull_Fore', 'Deck'])
        lane[..., 0][hull] = 255
        ch = checker(P)
        lane[..., 1][hull] = (ch * 255)[hull]
        lane[..., 0][hull] = (255 * (1 - ch))[hull]
    return base, lane, gloss, cov

def dilate(arrs, cov, n=48):
    """pad outward: each empty pixel takes a covered neighbour (n passes = n px)"""
    cov = cov.copy()
    for _ in range(n):
        if cov.all(): break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sc = np.roll(np.roll(cov, dy, 0), dx, 1)
            if dy == 1: sc[0] = False
            if dy == -1: sc[-1] = False
            if dx == 1: sc[:, 0] = False
            if dx == -1: sc[:, -1] = False
            take = ~cov & sc
            if not take.any(): continue
            for a in arrs:
                src = np.roll(np.roll(a, dy, 0), dx, 1); a[take] = src[take]
            cov = cov | take
    # anything still empty takes the nearest row/column value (rare: far corners)
    return cov

S = SIZE
sheet_b = np.zeros((S, S, 3), np.float32); sheet_l = np.zeros((S, S, 3), np.float32); sheet_g = np.zeros((S, S), np.float32)
for panel, r0, r1 in (('S', 0, S // 4), ('P', S // 4, S // 2), ('T', S // 2, S)):
    pid, mid, P, U = raster(panel, S, r1 - r0)
    b, l, g, cov = colour(pid, mid, P, U)
    dilate([b, l, g], cov, 64)
    sheet_b[r0:r1], sheet_l[r0:r1], sheet_g[r0:r1] = b, l, g
    print('panel', panel, 'covered', round(float(cov.mean()), 3))
os.makedirs(out, exist_ok=True)
Image.fromarray(sheet_b.clip(0, 255).astype(np.uint8)).save(f'{out}/base.png', optimize=True)
imgs = {'base': 'base.png'}
if recipe == 'practice':
    Image.fromarray(sheet_l.clip(0, 255).astype(np.uint8)).save(f'{out}/lane.png', optimize=True); imgs['lane'] = 'lane.png'
Image.fromarray(sheet_g.clip(0, 255).astype(np.uint8)).save(f'{out}/gloss.png', optimize=True); imgs['gloss'] = 'gloss.png'

us = lambda y: round((y - B['ymin']) / L, 4)
vS = lambda z: round(1 - (z - B['zmin']) / H, 4)
if recipe == 'naniwa':
    paint = {'roughness': .12, 'coat': 1.0, 'coatRoughness': .02}
    marks = [{'type': 'text', 'text': 'NANIWA', 'panel': 'T', 'u': us(.66), 'v': .5, 'height': round(.12 / (2 * B['half']), 4),
              'maxWidth': round(.58 / L, 4), 'rotate': 90, 'italic': .18, 'fill': '#b6f000', 'edge': '#12041c', 'edgeWidth': .08}]
    for pn, u in (('S', us(-.68)), ('P', round(1 - us(-.68), 4))):
        marks.append({'type': 'number', 'panel': pn, 'u': u, 'v': vS(.315), 'height': round(.24 / H, 4), 'italic': .12,
                      'fill': 'contrast', 'edge': 'lane', 'edgeWidth': .1})
    extra = {'lip': '#2ef209', 'inner': '#5e1f9c'}
    name = 'naniwa'
else:
    paint = {'roughness': .26, 'coat': .35, 'coatRoughness': .18}
    nh, hgt = .176, .215
    marks = []
    for pn, f in (('S', lambda y: us(y)), ('P', lambda y: round(1 - us(y), 4))):
        marks.append({'type': 'number', 'panel': pn, 'u': f(-.938), 'v': vS(.3225), 'height': round(nh / H, 4), 'italic': .1,
                      'fill': 'lane', 'edge': '#0c0c0c', 'edgeWidth': .08})
        marks.append({'type': 'surname', 'panel': pn, 'u': f(-.499), 'v': vS(.3225), 'height': round(hgt * .58 / H, 4),
                      'maxWidth': round(.56 / L, 4), 'fill': '#f6f6f2', 'edge': '#0c0c0c', 'edgeWidth': .08})
    extra = {'lip': '#e4ecf4', 'inner': '#e4ecf4'}
    name = 'practice'
J = {'schema': 'hfgp-livery-v1', 'name': name, 'images': imgs, 'paint': paint, 'marks': marks,
     'parts': extra, 'boundsM': {k: round(v, 4) for k, v in B.items()}}
json.dump(J, open(f'{out}/livery.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', out)
