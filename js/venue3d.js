/* d280 3Dの会場 (まえ: リプレイ作成用のアセットを持ってくる): the replay app's venue (replay assets v0.30) built for the
 * 3D view — looks only, never touches the race. Ported from 08_replay/source/venue_build.py and 09_city/source
 * (grandstand.py, city_assets.py build_skyline / facade_material), so the game's 3D and the replay show the same place:
 *   - 岸の手すり along the whole water outline
 *   - the long glass grandstand on the stand-side bank (x −130…110, square to the start line), its crowd on PC
 *   - なにわ (urban): the city — 4 rows of buildings on the far shore, behind the stand and at both ends, and the
 *     elevated expressway along the far shore. 練習コース (suburban): hills, trees and low houses
 *   - floodlight masts where the night lights are (the 2D poles)
 * Night (夜 1 / 夕方 .35): windows light up at random (the replay's facade shader, rewritten for three), signs,
 * shop fronts, street lamps and the red aviation lights glow.
 * Works in the replay's Blender space (x, yb = −game y, z up) and maps to three as (x, z, −yb) = (x, z, game y). */
import * as THREE from 'three';
import { GLTFLoader } from '../hfgp3d/viewer/vendor/GLTFLoader.js';

export const VENUE3D = {
  stand: { x0: -130, x1: 110, setback: 1, crowdFrac: .5, crowdMax: { 1: 0, 2: 900 } },
  city: { gap: 26, exprOff: 13 },
  mast: { scale: 1.12, lampAt: 15.0 },
  em: .22,              // Cycles emission strength → three emissiveIntensity
  shirts: [0xc8302c, 0x2d5fb8, 0xe8e6de, 0xe0b020, 0x2f8a4a, 0x5a5e66, 0x1d2a44, 0xd06a2a],
};
const NIGHT_OF = { day: 0, evening: .35, night: 1 };

/* ---------- the models (embedded, js/hfgp3d-glb-venue.js) ---------- */
let models = null, loading = null;
const loadScript = src => new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(Error(src)); document.head.appendChild(s); });
export function venueReady() { return !!models; }
export function loadVenueModels() {
  if (models) return Promise.resolve(models);
  if (loading) return loading;
  loading = (async () => {
    if (!window.HFGP3D_GLB || !window.HFGP3D_GLB['venue/city_apartment.glb']) await loadScript(new URL('./hfgp3d-glb-venue.js', import.meta.url).href);
    const E = window.HFGP3D_GLB, loader = new GLTFLoader(), out = {};
    for (const k of Object.keys(E).filter(k => k.startsWith('venue/'))) {
      const raw = atob(E[k]), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const g = await loader.parseAsync(bytes.buffer, '');
      out[k.slice(6, -4)] = proto(g.scene);
    }
    models = out; return out;
  })();
  return loading;
}
// glTF stores v as 1 − v: the facade shader wants the replay's metres up the wall back
function flipV(uv) { const f = new Float32Array(uv.count * 2); for (let i = 0; i < uv.count; i++) { f[i * 2] = uv.getX(i); f[i * 2 + 1] = 1 - uv.getY(i); } return new THREE.BufferAttribute(f, 2); }
// a model → its parts (geometry + material + the part's matrix in the model), the footprint in Blender space
function proto(scene) {
  scene.updateMatrixWorld(true);
  const parts = [], box = new THREE.Box3().setFromObject(scene);
  scene.traverse(o => { if (o.isMesh) { if (o.geometry.attributes.uv && !o.geometry.attributes.fuv) o.geometry.setAttribute('fuv', flipV(o.geometry.attributes.uv)); parts.push({ geo: o.geometry, mat: o.material, m: o.matrixWorld.clone() }); } });
  // three (x, y up, z) → Blender (x, −z, y)
  return { parts, fp: { a: box.min.x, b: box.max.x, c: -box.max.z, d: -box.min.z, top: box.max.y } };
}

/* ---------- small helpers ---------- */
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; const r = () => (s = s * 16807 % 2147483647) / 2147483647; r.u = (a, b) => a + (b - a) * r(); r.pick = arr => arr[Math.floor(r() * arr.length) % arr.length]; return r; }
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);
// Blender-space placement (x, yb, z, rotation about z) → a three matrix
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function bmat(x, yb, z, rot, s = 1, sy = s) { return new THREE.Matrix4().compose(new THREE.Vector3(x, z, -yb), _q.setFromAxisAngle(_up, rot), new THREE.Vector3(s, sy, s)); }

/* ---------- materials ---------- */
// the replay's window shader (city_assets.facade_material): u = metres along the wall, v = metres up
const FACADES = {
  curtain: [1.6, 3.8, .92, .86, [.30, .33, .36], [.10, .16, .22], .38], curtain_g: [1.6, 3.8, .92, .86, [.26, .30, .29], [.08, .16, .14], .38],
  curtain_br: [1.8, 3.8, .90, .84, [.30, .27, .24], [.16, .12, .08], .36], office: [2.4, 3.6, .78, .48, [.52, .52, .50], [.07, .10, .13], .45],
  office_dk: [2.2, 3.6, .70, .52, [.24, .25, .27], [.06, .09, .12], .45], office_wm: [2.4, 3.6, .72, .50, [.58, .50, .40], [.07, .09, .11], .45],
  apartment: [3.2, 2.95, .50, .55, [.70, .66, .58], [.08, .10, .12], .42], apart_tile: [3.0, 2.95, .46, .55, [.55, .42, .34], [.08, .10, .12], .42],
  shop_up: [2.6, 3.0, .45, .50, [.70, .66, .58], [.09, .11, .13], .42], hotel: [2.0, 3.3, .60, .62, [.68, .66, .62], [.09, .13, .17], .5],
  parking: [6.0, 3.0, .96, .55, [.58, .58, .56], [.02, .02, .02], 0] };
function facadeMat(style, night, seed = 0) {
  const F = FACADES[style] || FACADES.office, m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uNight: { value: night }, uFac: { value: new THREE.Vector4(F[0], F[1], F[2], F[3]) }, uWall: { value: lin(...F[4]) },
      uGlass: { value: lin(...F[5]) }, uLit: { value: F[6] }, uSeed: { value: seed }, uEm: { value: 1.25 } });
    sh.vertexShader = 'attribute vec2 fuv; uniform float uSeed; varying vec2 vFuv; varying float vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vFuv = fuv; vSeed = uSeed;\n#ifdef USE_INSTANCING\n vSeed += fract(dot(instanceMatrix[3].xz, vec2(.0137, .0291))) * 97.0;\n#endif');
    sh.fragmentShader = 'uniform float uNight; uniform vec4 uFac; uniform vec3 uWall; uniform vec3 uGlass; uniform float uLit; uniform float uEm; varying vec2 vFuv; varying float vSeed;\n' +
      'float h3(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n' +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  vec2 cc = vFuv / uFac.xy, ff = fract(cc), ci = floor(cc);
  float y0 = uFac.w < .8 ? .12 : .07;
  float fWin = step((1. - uFac.z) * .5, ff.x) * step(ff.x, (1. + uFac.z) * .5) * step(y0, ff.y) * step(ff.y, y0 + uFac.w) * step(.3, vFuv.y);
  vec4 fR = vec4(h3(vec3(ci, vSeed)), h3(vec3(ci.yx + 7.1, vSeed + 3.)), h3(vec3(ci + 13.7, vSeed + 5.)), h3(vec3(ci + 2.3, vSeed + 9.)));
  float wv = mix(.82, 1.12, .6 * h3(vec3(floor(vFuv * .35), vSeed)) + .4 * fract(vSeed * 7.13));
  diffuseColor.rgb = mix(uWall * wv, uGlass * mix(.75, 1.25, fR.w), fWin);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(.78, .06, fWin);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(0., .35, fWin);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 warm = fR.y > .55 ? vec3(1., .93, .82) : vec3(1., .70, .40); vec3 tint = fR.z > .82 ? vec3(.78, .88, 1.) : warm;
    totalEmissiveRadiance += tint * fWin * step(fR.x, uNight * uLit) * mix(.35, 1.2, fR.w) * pow(uNight, 1.5) * uEm; }`);
  };
  m.customProgramCacheKey = () => 'hfgp-facade';
  return m;
}
// plain colours (city_assets.materials / grandstand stand_materials); emit = [r, g, b, strength at night]
const PLAIN = {
  roof: [.32, .32, .31, .9], roof_dark: [.16, .17, .18, .85], concrete: [.56, .56, .53, .85], metal: [.55, .57, .58, .4, .8], dark_metal: [.12, .13, .14, .45, .6],
  rail: [.75, .76, .74, .45, .6], shopfront: [.05, .07, .09, .05, .3, [1, .92, .78, 5]], awning_red: [.55, .08, .06, .7], awning_blue: [.05, .18, .42, .7], awning_green: [.06, .32, .16, .7],
  sign_a: [.92, .55, .05, .5, 0, [1, .62, .1, 6]], sign_b: [.08, .45, .85, .5, 0, [.2, .6, 1, 6]], sign_c: [.85, .12, .30, .5, 0, [1, .2, .4, 6]], sign_w: [.9, .9, .88, .5, 0, [1, .98, .92, 5]],
  aviation: [.6, .05, .04, .4, 0, [1, .06, .03, 40]], lamp: [.9, .88, .8, .3, 0, [1, .86, .62, 25]], asphalt: [.07, .075, .08, .9], barrier: [.45, .52, .55, .6],
  seat: [.04, .16, .42, .55], seat_w: [.72, .74, .76, .55], step: [.50, .50, .48, .85], white: [.82, .83, .82, .5],
  under: [.30, .31, .32, .7, 0, [1, .93, .80, 3]], ad1: [.03, .08, .22, .5, 0, [.25, .45, 1, 2.5]], ad2: [.70, .48, .08, .5, 0, [1, .72, .2, 2.5]], ad3: [.55, .07, .08, .5, 0, [1, .2, .2, 2.5]] };
// the replay's material names in the city GLBs → PLAIN
const NAMED = { City_Roof: 'roof', City_Roof_Dark: 'roof_dark', City_Concrete: 'concrete', City_Metal: 'metal', City_Metal_Dark: 'dark_metal', City_Railing: 'rail',
  City_Shopfront_Glass: 'shopfront', City_Awning_Red: 'awning_red', City_Awning_Blue: 'awning_blue', City_Awning_Green: 'awning_green', City_Sign_A: 'sign_a', City_Sign_B: 'sign_b',
  City_Sign_C: 'sign_c', City_Sign_White: 'sign_w', City_Aviation_Light: 'aviation', City_Street_Lamp: 'lamp', City_Asphalt: 'asphalt', City_Sound_Barrier: 'barrier' };
function plainMat(key, night) {
  const P = PLAIN[key], m = new THREE.MeshStandardMaterial({ color: lin(P[0], P[1], P[2]), roughness: P[3], metalness: P[4] || 0, side: THREE.DoubleSide });
  const e = P[5]; if (e) { m.emissive = lin(e[0], e[1], e[2]); m.emissiveIntensity = (night * e[3] + .02 * e[3]) * VENUE3D.em; }
  return m;
}
// a GLB's own material → ours (facade shader / plain colours / its own, lit at night where it should be)
function matFor(src, night, cache) {
  const n = (src.name || '').replace(/\.\d+$/, '');
  if (cache.has(src)) return cache.get(src);
  let m;
  if (n.startsWith('City_Facade_')) m = facadeMat(n.slice(12), night);
  else if (NAMED[n]) m = plainMat(NAMED[n], night);
  else { m = src.clone();
    if (n === 'City_Billboard_Emblem' && m.map) { m.emissive = new THREE.Color(1, 1, 1); m.emissiveMap = m.map; m.emissiveIntensity = (night * 3 + .06) * VENUE3D.em * 1.6; }
    if (n === 'Light_Lens') { m.emissive = new THREE.Color(1, .95, .82); m.emissiveIntensity = .15 + night * 6; } }
  cache.set(src, m); return m;
}

/* ---------- instancing: one InstancedMesh per model part ---------- */
function instanced(model, mats, night, opt = {}) {
  const g = new THREE.Group(); if (!mats.length) return g;
  const cache = new Map();
  for (const p of model.parts) {
    let mat = matFor(p.mat, night, cache);
    const tint = opt.tint && opt.tint(p.mat.name || '');
    if (tint) { mat = mat.clone(); mat.color.set(0xffffff); }
    const im = new THREE.InstancedMesh(p.geo, mat, mats.length);
    const t = new THREE.Matrix4();
    mats.forEach((M, i) => { im.setMatrixAt(i, t.multiplyMatrices(M, p.m)); if (tint) im.setColorAt(i, tint(p.mat.name, i)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = false;
    g.add(im);
  }
  return g;
}

/* ---------- a mesh built face by face (the replay's bmesh _box / _quad), with real-size UVs like city_assets._finish ---------- */
class MB {
  constructor(n) { this.p = Array.from({ length: n }, () => []); this.u = Array.from({ length: n }, () => []); }
  quad(pts, mi) {
    const [a, b, c] = pts, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let tx = -ny, ty = nx; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const uv = q => Math.abs(nz) < .7 ? [q[0] * tx + q[1] * ty, q[2]] : [q[0], q[1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const q = pts[i]; this.p[mi].push(q[0], q[2], -q[1]); this.u[mi].push(...uv(q)); }
  }
  box(x0, y0, z0, x1, y1, z1, ms, mt, top = true, bottom = false) {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) this.quad(f.map(i => v[i]), ms);
    if (top) this.quad([4, 5, 6, 7].map(i => v[i]), mt);
    if (bottom) this.quad([3, 2, 1, 0].map(i => v[i]), mt);
  }
  mesh(mats) {
    const g = new THREE.Group();
    this.p.forEach((P, i) => { if (!P.length) return;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('fuv', new THREE.Float32BufferAttribute(this.u[i], 2)); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mats[i])); });
    return g;
  }
}

/* ---------- the glass grandstand (09_city/source/grandstand.py) ---------- */
const STAND = { length: 240, apron: 6, rows: 10, row_d: .85, row_h: .42, parapet: 1.1, hall_front: 16, hall_back: 44, floors: 5, floor_h: 4.4, lean: 4,
  tower_w: 30, tower_h: 9, canopy_over: 5, canopy_t: .9, stair_w: 9, column_step: 12 };
function grandstand(length, night) {
  const C = Object.assign({}, STAND, { length });
  const order = ['concrete', 'glass', 'glass_g', 'seat', 'seat_w', 'step', 'white', 'under', 'roof_dark', 'metal', 'rail', 'ad1', 'ad2', 'ad3', 'lamp'];
  const I = Object.fromEntries(order.map((k, i) => [k, i])), B = new MB(order.length), seats = [];
  const L = C.length, hx = L / 2, y0 = -C.apron, rows = C.rows, rd = C.row_d, rh = C.row_h;
  B.box(-hx, y0 - .3, 0, hx, y0, C.parapet, I.white, I.white);
  const ads = ['ad1', 'ad2', 'ad1', 'ad3'];
  for (let x = -hx + 2, k = 0; x + 10 <= hx - 2; x += 10, k++) B.quad([[x, y0 + .02, .25], [x + 9.4, y0 + .02, .25], [x + 9.4, y0 + .02, C.parapet - .1], [x, y0 + .02, C.parapet - .1]], I[ads[k % 4]]);
  const aisles = []; for (let a = -Math.trunc(hx) + 20; a < Math.trunc(hx) - 10; a += 24) aisles.push(a);
  const xs = [-hx + 1, ...aisles, hx - 1];
  for (let r = 0; r < rows; r++) {
    const ya = y0 - r * rd, yb = y0 - (r + 1) * rd, z = (r + 1) * rh;
    B.box(-hx, yb, 0, hx, ya, z, I.step, I.step, true);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a2 = xs[j] + .8, b2 = xs[j + 1] - .8; if (b2 - a2 < 2) continue;
      const mi = (r === 3 || r === 4) && Math.abs((xs[j] + xs[j + 1]) / 2) < 30 ? I.seat_w : I.seat;
      B.box(a2, yb + .12, z, b2, yb + .48, z + .42, mi, mi);
      for (let sx = a2 + .6; sx < b2 - .4; sx += .62) seats.push([sx, yb + .35, z]);
    }
  }
  const zt = rows * rh, yt = y0 - rows * rd, yf = -C.hall_front, yb_ = -C.hall_back, H = C.floors * C.floor_h, lean = C.lean, sw = C.stair_w;
  const gx0 = -hx + sw, gx1 = hx - sw, tw = C.tower_w / 2;
  for (const [a, b] of [[gx0, -tw], [tw, gx1]]) B.quad([[a, yf, zt], [b, yf, zt], [b, yf - lean, zt + H], [a, yf - lean, zt + H]], I.glass);
  B.box(-hx, yf, 0, hx, yt, zt, I.concrete, I.step);
  B.box(gx0, yb_, 0, gx1, yf, zt, I.concrete, I.concrete, false);
  B.quad([[gx1, yb_, zt], [gx0, yb_, zt], [gx0, yb_, zt + H], [gx1, yb_, zt + H]], I.glass_g);
  for (const [xx, s] of [[gx0, -1], [gx1, 1]]) { const q = [[xx, yf, zt], [xx, yb_, zt], [xx, yb_, zt + H], [xx, yf - lean, zt + H]]; B.quad(s > 0 ? q : q.reverse(), I.concrete); }
  for (let f = 1; f < C.floors; f++) { const z = zt + f * C.floor_h, d = lean * f / C.floors; B.box(gx0, yf - d - .05, z - .25, gx1, yf - d + .35, z + .05, I.white, I.white); }
  const ct = C.canopy_t, over = C.canopy_over;
  B.box(-hx + 2, yb_ - 1, zt + H, hx - 2, yf - lean + over, zt + H + ct, I.white, I.roof_dark, true, false);
  B.quad([[-hx + 2, yf - lean + over, zt + H - .01], [hx - 2, yf - lean + over, zt + H - .01], [hx - 2, yf - lean, zt + H - .01], [-hx + 2, yf - lean, zt + H - .01]].reverse(), I.under);
  const th = C.tower_h, tl = lean * .6;
  B.quad([[-tw, yf + 1.5, zt], [tw, yf + 1.5, zt], [tw, yf + 1.5 - tl, zt + H + th], [-tw, yf + 1.5 - tl, zt + H + th]], I.glass_g);
  B.box(-tw, yf - 14, zt, tw, yf + 1.4 - tl, zt + H + th, I.concrete, I.roof_dark);
  for (const xx of [-tw, tw]) B.quad([[xx, yf + 1.5, zt], [xx, yf + 1.4 - tl, zt], [xx, yf + 1.4 - tl, zt + H + th], [xx, yf + 1.5 - tl, zt + H + th]], I.white);
  B.box(-tw - 1.5, yf - 16, zt + H + th, tw + 1.5, yf + 3.5 - lean * .6, zt + H + th + .8, I.white, I.roof_dark);
  for (const [a, b] of [[-hx, gx0], [gx1, hx]]) {
    B.box(a, yb_, 0, b, yf + 2, zt + H + 2.5, I.concrete, I.roof_dark);
    const n = Math.trunc((b - a) / .9);
    for (let j = 0; j < n; j++) { const xx = a + .45 + j * (b - a - .9) / Math.max(1, n - 1); B.box(xx - .12, yf + 2, 2, xx + .12, yf + 2.6, zt + H + 1.5, I.white, I.white); }
  }
  for (let x = -hx + C.column_step; x < hx - C.column_step / 2; x += C.column_step) {
    if (Math.abs(x) > tw + 2) B.box(x - .3, yf + over * .6 - .3, zt, x + .3, yf + over * .6 + .3, zt + H, I.white, I.white);
    B.box(x - 1.2, yf - lean + over - 1.2, zt + H - .15, x + 1.2, yf - lean + over - .9, zt + H - .02, I.lamp, I.lamp);
  }
  for (const xx of [-hx * .6, -hx * .25, hx * .3, hx * .62]) B.box(xx - 4, yb_ + 4, zt + H + ct, xx + 4, yb_ + 10, zt + H + ct + 2.2, I.metal, I.metal);
  const mats = order.map(k => k === 'glass' ? facadeMat('curtain', night, 11) : k === 'glass_g' ? facadeMat('curtain_g', night, 23) : plainMat(k, night));
  return { g: B.mesh(mats), seats, depth: C.hall_back + 1 };
}

/* ---------- the quay rail (venue_build.quay: two bars and a post every 3 m, 0.4 m in from the edge) ---------- */
function quayRail(outline, z, night) {
  const B = new MB(1), n = outline.length;
  let area = 0; for (let i = 0; i < n; i++) { const [x0, y0] = outline[i], [x1, y1] = outline[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const s = area > 0 ? 1 : -1;   // outward = to the right of a counter-clockwise edge
  const bar = (a, b, z0, z1, t) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * t, ny = dx / L * t;
    const v = [[a[0] - nx, a[1] - ny, z0], [a[0] + nx, a[1] + ny, z0], [a[0] + nx, a[1] + ny, z1], [a[0] - nx, a[1] - ny, z1], [b[0] - nx, b[1] - ny, z0], [b[0] + nx, b[1] + ny, z0], [b[0] + nx, b[1] + ny, z1], [b[0] - nx, b[1] - ny, z1]];
    for (const f of [[0, 4, 7, 3], [1, 5, 6, 2], [3, 7, 6, 2], [0, 1, 5, 4]]) B.quad(f.map(i => v[i]), 0); };
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = s * dy / L * .4, ny = -s * dx / L * .4, a2 = [a[0] + nx, a[1] + ny], b2 = [b[0] + nx, b[1] + ny];
    bar(a2, b2, z + 1.0, z + 1.05, .06); bar(a2, b2, z + .5, z + .54, .06);
    const m = Math.max(1, Math.trunc(L / 3));
    for (let j = 0; j <= m; j++) { const u = j / m, p = [a2[0] + (b2[0] - a2[0]) * u, a2[1] + (b2[1] - a2[1]) * u]; bar(p, [p[0] + dx / L * .08, p[1] + dy / L * .08], z, z + 1.05, .05); }
  }
  return B.mesh([plainMat('rail', night)]);
}

/* ---------- the city (city_assets.build_skyline + venue_build.city) ---------- */
const KINDS = ['office_tower', 'office_mid', 'apartment', 'shop_row', 'hotel_tower', 'parking'];
const ROWS = [[0, ['shop_row', 'shop_row', 'apartment', 'office_mid', 'parking']], [55, ['apartment', 'office_mid', 'apartment', 'office_mid', 'parking']],
  [120, ['office_mid', 'apartment', 'office_tower', 'office_mid']], [190, ['office_tower', 'office_tower', 'office_mid', 'hotel_tower', 'apartment']]];
function skyline(put, seed, x0, x1, yFront, rot, depth = 230, gap = 6) {
  const r = rng(seed * 7919 + 13), R = new THREE.Matrix4().makeRotationY(rot);
  for (const [ry, kinds] of ROWS) {
    if (ry > depth) break;
    for (let x = x0 + r.u(0, 20); x < x1;) {
      const kind = r.pick(kinds), M = models['city_' + kind]; if (!M) { x += 20; continue; }
      const { a, b, d } = M.fp, hs = kind === 'shop_row' || kind === 'parking' ? 1 : r.u(.85, 1.2);   // a little height variety (one model per kind)
      put(kind, new THREE.Matrix4().multiplyMatrices(R, bmat(x + b, yFront + ry + r.u(0, 8) + d, 0, Math.PI + r.u(-.03, .03), 1, hs)));
      x += b - a + gap + r.u(0, 10);
    }
  }
}

/* ---------- build ---------- */
// ctx: { level (1 スマホリッチ, 2 PC), tod, urban, bank, standY, backY, course, slitK, outline, poles }
export function buildVenue3d(ctx) {
  const night = NIGHT_OF[ctx.tod] ?? 0, g = new THREE.Group(), noRefl = [], S = VENUE3D.stand;
  const by = x => -ctx.standY(x), far = x => -ctx.backY(x);   // Blender y of the stand-side bank (−) / the far bank (+)
  const z = ctx.bank;
  // 手すり
  g.add(quayRail(ctx.outline.map(([x, y]) => [x, -y]), z, night));
  // the glass grandstand, square to the start line, set back so its front never sticks out over a bent bank
  const th = Math.atan(ctx.slitK), xc = (S.x0 + S.x1) / 2, yc = by(xc);
  let dev = -Infinity; for (let j = 0; j <= 40; j++) { const x = S.x0 + (S.x1 - S.x0) * j / 40; dev = Math.max(dev, (yc + Math.tan(th) * (x - xc)) - by(x)); }
  const back = Math.max(0, dev) + S.setback;
  const st = grandstand(S.x1 - S.x0, night), SM = bmat(xc + Math.sin(th) * back, yc - Math.cos(th) * back, z, th);
  st.g.applyMatrix4(SM); g.add(st.g);
  // the crowd (PC): fewer toward the ends, as the replay seats them
  const crowdN = S.crowdMax[ctx.level] || 0;
  if (crowdN > 0) {
    const r = rng(7), poses = ['spectator_seated', 'spectator_program', 'spectator_cheering', 'spectator_lean'].filter(k => models[k]), per = poses.map(() => []);
    let n = 0;
    for (const [sx, sy, sz] of st.seats) {
      const p = S.crowdFrac * (1.25 - Math.min(1, Math.abs(sx) / ((S.x1 - S.x0) / 2)) * .6);
      if (r() > p || n >= crowdN) continue;
      const k = Math.floor(r() * poses.length) % poses.length, s = r.u(.94, 1.04);
      // the spectator models face Blender −y; the stand faces +y → turned round
      per[k].push(new THREE.Matrix4().multiplyMatrices(SM, bmat(sx + r.u(-.1, .1), sy, sz, Math.PI + r.u(-.25, .25), s))); n++;
    }
    const col = new THREE.Color();
    poses.forEach((k, i) => { const cr = rng(31 + i), cols = per[i].map(() => VENUE3D.shirts[Math.floor(cr() * VENUE3D.shirts.length) % VENUE3D.shirts.length]);
      const im = instanced(models[k], per[i], night, { tint: name => /Shirt/.test(name) ? (nm, j) => col.set(cols[j]) : null }); g.add(im); noRefl.push(im); });
  }
  const xMin = ctx.course.xMin, xMax = ctx.course.xMax, xs = []; for (let x = xMin - 20; x <= xMax + 20; x += 10) xs.push(x);
  const farMax = Math.max(...xs.map(far)), nearMax = Math.max(...xs.map(x => ctx.standY(x)));
  if (ctx.urban) {
    const C = VENUE3D.city, gp = C.gap, xa = xMin - gp - 30, xb = xMax + gp + 20, by_kind = {};
    const put = (kind, M) => (by_kind[kind] = by_kind[kind] || []).push(M);
    [[xa, -120], [-120, 60], [60, xb]].forEach(([a, b], j) => skyline(put, 31 + j, a, b, Math.max(far(a), far((a + b) / 2), far(b)) + gp + 14, 0));
    // behind the stand and either side of it (the band turned round: its front faces the water at −y)
    const standBack = -(yc - Math.cos(th) * back) + st.depth + 12;
    [[xa, S.x0 - 8], [S.x0, S.x1], [S.x1 + 8, xb]].forEach(([a, b], j) => skyline(put, 41 + j, -b, -a, j === 1 ? standBack : Math.max(ctx.standY(a), ctx.standY(b)) + gp + 30, Math.PI, 200));
    skyline(put, 51, -farMax - 40, nearMax + 40, xMax + gp + 20, -Math.PI / 2, 160);
    skyline(put, 52, -nearMax - 40, farMax + 40, -(xMin - gp - 30), Math.PI / 2, 160);
    for (const k of Object.keys(by_kind)) g.add(instanced(models['city_' + k], by_kind[k], night));
    // the elevated expressway along the far shore (40 m pieces)
    if (models.city_expressway) { const M = []; for (let x = xa; x < xb; x += 40) M.push(bmat(x, farMax + C.exprOff, z, 0)); g.add(instanced(models.city_expressway, M, night)); }
    // two emblem boards over the far shore, facing the water
    if (models.city_billboard) g.add(instanced(models.city_billboard, [bmat(-MKX(ctx) * .55, farMax + 6, z, Math.PI), bmat(MKX(ctx) * .5, farMax + 6, z, Math.PI)], night));
  } else {
    // 練習コース (suburban): hills, trees and low houses beyond the far bank, and hills behind the stand
    const r = rng(5), cx = (xMin + xMax) / 2, put = {};
    const add = (k, M) => (put[k] = put[k] || []).push(M);
    if (models.terrain_backdrop) { add('terrain_backdrop', bmat(cx, farMax + 60 - 40, z - 1.18 - .02, 0)); add('terrain_backdrop', bmat(cx, -(nearMax + 70 - 40), z - 1.18 - .02, Math.PI)); }
    for (let x = xMin - 60; x < xMax + 60; x += r.u(7, 15)) {
      const y = far(Math.max(xMin, Math.min(xMax, x))) + r.u(9, 40), k = r() < .62 ? 'tree_broadleaf' : 'tree_columnar';
      add(k, bmat(x, y, z, r.u(0, 6.28), r.u(.8, 1.35)));
      if (r() < .35) add(r() < .5 ? 'tree_broadleaf' : 'tree_columnar', bmat(x + r.u(-3, 3), y + r.u(12, 30), z, r.u(0, 6.28), r.u(.9, 1.5)));
    }
    for (let x = xMin - 40; x < xMax + 40; x += r.u(22, 40)) add(r() < .5 ? 'building_lowrise' : 'building_service', bmat(x, far(Math.max(xMin, Math.min(xMax, x))) + r.u(48, 70), z, Math.PI + r.u(-.1, .1)));
    for (const x of [S.x0 - 30, S.x0 - 14, S.x1 + 14, S.x1 + 30]) add('tree_broadleaf', bmat(x, by(x) - r.u(8, 30), z, r.u(0, 6.28), r.u(1, 1.4)));
    for (const k of Object.keys(put)) if (models[k]) g.add(instanced(models[k], put[k], night));
  }
  // floodlight masts at the night-light poles, lamps turned to the water
  let lampH = 0;
  if (models.floodlight_mast && ctx.poles.length) {
    const M = [], s = VENUE3D.mast.scale;
    for (const [x, y] of ctx.poles) { const tx = Math.max(xMin, Math.min(xMax, x)) - x, ty = -y, rot = Math.atan2(tx, ty);   // three: +z of the model → toward the water
      M.push(new THREE.Matrix4().compose(new THREE.Vector3(x, z, y), _q.setFromAxisAngle(_up, rot), new THREE.Vector3(s, s, s))); }
    g.add(instanced(models.floodlight_mast, M, night)); lampH = z + VENUE3D.mast.lampAt * s;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { g, noRefl, lampH, stand: true };
}
const MKX = ctx => (ctx.course.xMax - ctx.course.xMin) / 2;
