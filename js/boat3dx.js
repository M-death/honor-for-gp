/* d183 3D（新モデル）: まえ's game assets (hfgp3d/, mobile tier) drawn with Three.js.
 * Same contract as boat3d.js: prepare() renders every boat into a tile of one atlas canvas, seen straight down in the
 * boat's own frame (bow → tile right, starboard → tile down); view.js draws the tile rotated to the boat's heading.
 * Looks only: reads the boats, never writes race state, never calls the race RNG.
 * Loaded as a module (needs http(s): GitHub Pages / the published page). Opened as a local file it never becomes
 * ready and boat3d.js keeps drawing the light 3D model instead.
 * Starts only once 3D（新モデル） is chosen. The GLBs come from js/hfgp3d-glb.js (base64, made by tools/embed_hfgp3d.py):
 * the published page can't serve .glb files. */
import * as THREE from 'three';
import { loadAssetSet } from '../hfgp3d/runtime/boat_actor.js';
import { GLTFLoader } from '../hfgp3d/viewer/vendor/GLTFLoader.js';

const finite = (v, d = 0) => Number.isFinite(v) ? v : d;
const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, finite(v)));
const api = { ready: false, failed: false, reason: '読み込み中', span: 8, tiles: new WeakMap(), count: 0 };
window.Boat3DX = api;
let renderer, canvas, scene, camera, sun, set, tile = 0;
const SIZE = { len: 1.5, wid: 1.25, bow: 2.23 };   // d185: drawn length ×1.5, width ×1.25; bow tip (m ahead of the pivot) stays put
const actors = new Map();   // `${lane}|${sex}` → BoatActor

function actorFor(row) {
  const body = row.body || {}, sex = body.sex === 'f' ? 'f' : 'm', lane = limit(Math.round(row.no || 1), 1, 6);
  const key = lane + '|' + sex;
  let a = actors.get(key);
  if (!a) { a = set.create({ lane, sex, heightCm: 165 }); a.root.visible = false; scene.add(a.root); actors.set(key, a); hullColor(a, lane); }
  if (a.setSuit) a.setSuit(row.racerId || row.name || row.no);   // d369
  a.heightCm = limit(body.height || (sex === 'f' ? 157 : 165), 140, 200);
  return a;
}
// d186 (まえ: colour came and went): the far LOD (2) paints the whole hull in the lane colour, the near ones (0, 1) are white
// with thin lane trim, so zooming flipped the look. Tint the near hulls' livery to the lane colour too (black kept a little
// lighter so the shape still reads).
const HULL_TINT = ['#ffffff', '#3a3f47', '#d73533', '#2867bd', '#e6c128', '#20844f'];
function hullColor(a, lane) {
  for (const l of [0, 1]) a.levels[l].boat.traverse(o => { if (!o.isMesh || o.isSkinnedMesh) return;
    for (const m of [].concat(o.material)) if (m.name.split('.')[0] === 'BoatLivery') m.color.set(HULL_TINT[lane - 1]); });
}
api.prepare = function (rows, scale, dpr, t) {
  api.tiles = new WeakMap(); api.count = 0;
  if (!api.ready) return false;
  try {
    const next = Math.min(384, Math.max(96, Math.ceil(scale * dpr * api.span / 32) * 32));
    const cols = Math.min(3, rows.length), rowCount = Math.ceil(rows.length / cols);
    if (next !== tile || canvas.width !== cols * next || canvas.height !== rowCount * next) { tile = next; renderer.setSize(cols * tile, rowCount * tile, false); }
    renderer.setScissorTest(false); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.setScissorTest(true);
    for (const a of actors.values()) a.root.visible = false;
    rows.forEach((row, i) => {
      const b = row.b, inp = row.inp || {}, a = actorFor(row);
      const capsized = finite(b.cap) > 0 && !b.fallen, gone = finite(b.cap) > 0 || b.fallen;
      const nose = capsized ? 0 : limit((typeof willieMotion === 'function' ? willieMotion(b).nose : (b.wil || 0) * .30) + (b.trim || 0) * .14 + (b.porp || 0) * .045 * Math.sin(t * 18) + (b.hv || 0) * .025 + (typeof rideBob === 'function' ? rideBob(b).nose : 0), -.12, .75);
      a.setLOD(tile >= 160 ? 0 : tile >= 112 ? 1 : 2);
      a.setGameTransform({ x: 0, y: 0, hop: 0, modelYaw: -Math.PI / 2, modelBank: capsized ? Math.PI : -limit(b.bank, -.65, .65), nose });
      a.updatePose({ pitch: limit(inp.pitch, -1, 1), roll: limit(inp.roll, -1, 1), steer: -limit(inp.steer, -1, 1) * .30, propAngle: t * (12 + limit(b.v / 23, 0, 1) * 90) });
      const lv = a.levels[a.lod]; if (lv && lv.racer) lv.racer.visible = !gone;
      a.root.visible = true;
      // the sun stays put on the course while the tile turns with the boat
      const h = finite(b.a); sun.position.set(Math.cos(-h) * -3 - Math.sin(-h) * -2.5, 8, Math.sin(-h) * -3 + Math.cos(-h) * -2.5);
      const x = i % cols * tile, y = Math.floor(i / cols) * tile, vy = canvas.height - y - tile;
      renderer.setViewport(x, vy, tile, tile); renderer.setScissor(x, vy, tile, tile);
      renderer.render(scene, camera);
      a.root.visible = false;
      api.tiles.set(b, { x, y, tile }); api.count++;
    });
    return true;
  } catch (e) { console.warn('3D（新モデル） fallback:', e); fail('描画できません'); return false; }
};
api.draw = function (ctx, b) {
  const q = api.tiles.get(b); if (!api.ready || !q) return false;
  ctx.drawImage(canvas, q.x, q.y, q.tile, q.tile, -api.span / 2, -api.span / 2, api.span, api.span); return true;
};
function fail(reason) { api.ready = false; api.failed = true; api.reason = reason; api.tiles = new WeakMap(); if (window.Boat3D) Boat3D.status(); }
// boat_actor.js loads `${tier}/${kind}_lod${l}.glb` with GLTFLoader.loadAsync: answer from the embedded copies
const loadScript = src => new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(Error(src)); document.head.appendChild(s); });
const _loadAsync = GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync = function (url, onProgress) {
  const E = window.HFGP3D_GLB, key = E && Object.keys(E).find(k => String(url).endsWith(k));
  if (!key) return _loadAsync.call(this, url, onProgress);
  const raw = atob(E[key]), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return this.parseAsync(bytes.buffer, new URL('.', url).href);
};
// d326 (まえ: Braveは新モデルにならない、PCサイトにする（＝読み込み直す）とすぐ新モデルになる): a context the phone took and never gave
// back left 「3D描画の復帰待ち」 for good. As in the 3D view (play3d d314/d318): once the page shows, wait REB.wait s for the
// browser to give it back, else make a new canvas + renderer (the models stay; their GPU copies are made again), up to REB.tries
const REB = { wait: 2.5, tries: 3 }; let rebTimer = 0, rebTries = 0;
function makeRenderer() {
  canvas = document.createElement('canvas'); tile = 0;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
  const cv = canvas;
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (cv !== canvas) return; fail(api.asleep ? '3D視点の間は休止' : '3D描画の復帰待ち'); rebuildLater(); });
  cv.addEventListener('webglcontextrestored', () => { if (cv !== canvas) return; clearTimeout(rebTimer); if (set) { api.ready = true; api.failed = false; api.reason = ''; if (window.Boat3D) Boat3D.status(); } });
}
function rebuildLater() {
  clearTimeout(rebTimer); if (api.asleep || document.hidden || !set) return;
  rebTimer = setTimeout(() => {
    if (api.asleep || document.hidden || api.ready || rebTries >= REB.tries) return;
    rebTries++; try { renderer.dispose(); } catch (e) {}
    try { makeRenderer(); } catch (e) { fail('描画できません'); return; }
    api.ready = true; api.failed = false; api.reason = ''; if (window.Boat3D) Boat3D.status();
  }, REB.wait * 1000);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(rebTimer); else if (set && !api.ready && !api.asleep) { rebTries = 0; rebuildLater(); } });
async function init() {
  if (!window.HFGP3D_GLB) await loadScript(new URL('./hfgp3d-glb.js', import.meta.url).href);
  try { makeRenderer(); } catch (e) { e.noGL = true; throw e; }
  // d312 (まえ: スマホで3Dが選べない／2Dに戻る、「新モデルは3D描画の復帰待ち」): the 3D view (play3d) and this 2D boat renderer
  // each hold a WebGL context and a phone takes one back. While the 3D view shows, this one sleeps (gives its context up) and
  // wakes when 2D comes back; a context the phone took is picked up again when it is restored
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a4a58, 1.4));
  sun = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(sun); scene.add(sun.target);
  // d185 (まえ: same size as the light model): the real-size model (≈3.3 m) is drawn stretched to the light 3D's size
  // (≈5 m × 1.6 m, close to the hit capsule) by narrowing the view, with the bow tip kept where it was. Looks only.
  const s = api.span / 2, L = SIZE.len, W = SIZE.wid, cx = SIZE.bow - SIZE.bow / L;
  camera = new THREE.OrthographicCamera(cx - s / L, cx + s / L, s / W, -s / W, 0.1, 40);
  camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);   // bow (+x after the yaw) → right, starboard (+z) → down
  set = await loadAssetSet(new URL('../hfgp3d/', import.meta.url).href, 'mobile');
  for (const lane of [1, 2, 3, 4, 5, 6]) actorFor({ no: lane, body: { sex: 'm' } });
  api.ready = true; api.reason = '';
  if (window.Boat3D) Boat3D.status();
}
api.sleep = () => { if (api.asleep || !renderer) return; api.asleep = true; try { renderer.forceContextLoss(); } catch (e) {} };
api.wake = () => { if (!api.asleep) return; api.asleep = false; try { renderer.forceContextRestore(); } catch (e) {} rebTries = 0; rebuildLater(); };   // d326: not given back → a new one
let started = false;
api.start = () => { if (started) return; started = true; api.reason = '読み込み中'; if (window.Boat3D) Boat3D.status();
  init().catch(e => { console.warn('3D（新モデル） unavailable:', e); fail(!e || !e.noGL ? '読み込めません' : 'ブラウザが3D描画を止めています — ブラウザを完全に終了して開き直してください'); }); };   // d327: no WebGL at all ≠ a failed download
if (window.Boat3D && Boat3D.mode === 'new3d') api.start();
