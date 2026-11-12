/* 3D視点 (d268 本編・体験版に統合, まえ: 3D試作を本編、体験版に統合、ゴーストも共用): the race seen in 3D — 追尾（少し上から）/ レーサー視点. Looks only: reads the boats, never writes race
 * state, never calls the race RNG. The physics, the HUD, the mini map and every rule stay the 2D game's.
 * World: three.js Y up; game (x, y) → (X, Z) = (x, y), so seen from above it matches the 2D screen (+y down).
 * Boats are the hfgp3d actors (the same models as 3D（新モデル）). Toggle: the 視点 button or the V key. */
import * as THREE from 'three';
import { loadAssetSet } from '../hfgp3d/runtime/boat_actor.js';
import { GLTFLoader } from '../hfgp3d/viewer/vendor/GLTFLoader.js';

const V3 = { modes: ['2d', 'chase', 'racer'], names: { '2d': '2D', chase: '追尾', racer: 'レーサー' }, key: 'honorGP.view3d',
  bank: 1.0, px: 6 };
// スマホ (指で操作する端末): lighter everything — the page was being killed for memory on a phone
const LITE = (() => { try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { return false; } })();
if (LITE) V3.px = 3; else V3.px = 8;
const HQ = !LITE;   // PC: the shaded water and the spray (まえ 2026-11-11: PC前提で3Dを強化、スマホは今のが最低限)
const FRAME_MS = LITE ? 1000 / 30 : 0;   // the 3D view at 30 fps on a phone (the race itself runs as before)
let mode = '2d'; try { mode = localStorage.getItem(V3.key) || '2d'; } catch (e) {}
if (!V3.modes.includes(mode)) mode = '2d';
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const lim = (v, lo, hi) => Math.max(lo, Math.min(hi, fin(v)));

let renderer, canvas, scene, camera, hemi, sun, set = null, world = null, wakeMesh, tod = '', venueId = '';
const actors = new Map();
const camS = { x: 0, y: 0, a: 0, init: false };

/* ---------- the GLBs come embedded (js/hfgp3d-glb.js), as boat3dx.js does ---------- */
const loadScript = src => new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(Error(src)); document.head.appendChild(s); });
const _loadAsync = GLTFLoader.prototype.loadAsync;
if (!GLTFLoader.prototype._p3d) {
  GLTFLoader.prototype._p3d = true;
  GLTFLoader.prototype.loadAsync = function (url, onProgress) {
    const E = window.HFGP3D_GLB, key = E && Object.keys(E).find(k => String(url).endsWith(k));
    if (!key) return _loadAsync.call(this, url, onProgress);
    const raw = atob(E[key]), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return this.parseAsync(bytes.buffer, new URL('.', url).href);
  };
}

/* ---------- the water: one canvas texture painted once per venue / time of day ---------- */
function waterTexture(t) {
  const PX = V3.px, w = COURSE.xMax - COURSE.xMin, h = COURSE.yMax - COURSE.yMin;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * PX); c.height = Math.ceil(h * PX);
  const g = c.getContext('2d'); g.scale(PX, PX); g.translate(-COURSE.xMin, -COURSE.yMin);
  const gr = g.createLinearGradient(0, COURSE.yMin, 0, COURSE.yMax);
  gr.addColorStop(0, '#245d65'); gr.addColorStop(.27, '#28747b'); gr.addColorStop(.66, '#185b69'); gr.addColorStop(1, '#103b4c');
  g.fillStyle = gr; g.fillRect(COURSE.xMin, COURSE.yMin, w, h);
  // the depth bands of the 2D game (d259): 10 m steps, darker toward the mark line, faint at dusk / night
  const K = DEPTH.k[t] || DEPTH.k.day;
  for (const side of [1, -1]) {
    const far = side > 0 ? COURSE.yMax : -COURSE.yMin, n = Math.ceil(far / DEPTH.step);
    for (let i = 0; i < n; i++) {
      g.fillStyle = depthCol(i, K);
      const y0 = i * DEPTH.step, y1 = Math.min(far, (i + 1) * DEPTH.step), top = side > 0 ? y0 : -y1, hh = y1 - y0;
      const N = 20;
      for (let k = 0; k < N; k++) { g.globalAlpha = (k + .5) / N; const d = DEPTH.fade * k / N, ww = DEPTH.fade / N; g.fillRect(-MK + d, top, ww, hh); g.fillRect(MK - d - ww, top, ww, hh); }
      g.globalAlpha = 1; g.fillRect(-MK + DEPTH.fade, top, 2 * MK - 2 * DEPTH.fade, hh);
    }
  }
  // ripples tied to the water: what tells you how fast you go
  let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.lineCap = 'round';
  for (let i = 0; i < w * h / (LITE ? 20 : 7); i++) {
    const x = COURSE.xMin + rnd() * w, y = COURSE.yMin + rnd() * h, L = .5 + rnd() * 1.4, dark = rnd() < .55;
    g.strokeStyle = dark ? 'rgba(3,32,43,.22)' : 'rgba(186,231,222,.16)'; g.lineWidth = dark ? .16 : .09;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y - .18, x + L, y); g.stroke();
  }
  // start line, the line through each mark, the dashed line 20 m before each mark (as in 2D)
  g.setLineDash([1.2, 1]); g.strokeStyle = 'rgba(233,245,242,.6)'; g.lineWidth = .3;
  g.beginPath(); g.moveTo(slitXAt(6), 6); g.lineTo(slitXAt(standY(0)), standY(0)); g.stroke();
  g.setLineDash([.8, 1.4]); g.strokeStyle = 'rgba(233,245,242,.2)'; g.lineWidth = .2;
  for (const m of COURSE.marks) { g.beginPath(); g.arc(m.x, m.y, 11, 0, Math.PI * 2); g.stroke(); }
  g.setLineDash([]); g.strokeStyle = 'rgba(233,245,242,.16)';
  for (const m of COURSE.marks) { g.beginPath(); g.moveTo(m.x, backY(m.x)); g.lineTo(m.x, standY(m.x)); g.stroke(); }
  g.setLineDash([1, 1]); g.strokeStyle = 'rgba(233,245,242,.22)';
  g.beginPath(); g.moveTo(MK - 20, 0); g.lineTo(MK - 20, standY(MK - 20)); g.stroke();
  g.beginPath(); g.moveTo(-MK + 20, backY(-MK + 20)); g.lineTo(-MK + 20, 0); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(LITE ? 2 : 8, renderer.capabilities.getMaxAnisotropy()); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.onUpdate = () => { c.width = c.height = 1; };   // once on the GPU, let the painted canvas go
  return tex;
}


/* ---------- 遠景 (まえ: 背景を入れて): a sky dome and one painted skyline wrapped round the course — two meshes, no fog ---------- */
const FAR = {
  sky: { day: ['#5f9fd6', '#b9d8ea', '#dfe9e6'], evening: ['#3d4e86', '#e48a5c', '#f6c08a'], night: ['#02040c', '#0a1430', '#18203a'] },
  // [colour far, colour near] of the silhouettes, the haze at their foot
  ink: { day: ['#9db3c3', '#6f8496', '#c9dbe2'], evening: ['#8a6f86', '#4d3f55', '#e2a07c'], night: ['#151b2e', '#0b0f1c', '#141b33'] },
};
function skyDome(t) {
  const [top, mid, low] = FAR.sky[t] || FAR.sky.day, geo = new THREE.SphereGeometry(1200, 24, 16), pos = geo.attributes.position, col = [];
  const cT = new THREE.Color(top), cM = new THREE.Color(mid), cL = new THREE.Color(low), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const h = pos.getY(i) / 1200; if (h < 0) c.copy(cL); else if (h < .18) c.lerpColors(cL, cM, h / .18); else c.lerpColors(cM, cT, Math.min(1, (h - .18) / .6)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -2; return m;
}
function skylineTexture(t, venue) {
  const W = LITE ? 2048 : 4096, H = LITE ? 256 : 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), [far, near, haze] = FAR.ink[t] || FAR.ink.day, k = H / 512;
  let sd = venue === 'suminoe' ? 777 : 4242; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const base = H * .86;   // the ground line
  if (venue === 'suminoe') {
    // 街: two rows of blocks and towers, the far row paler; lit windows at night / dusk
    for (const [row, col, hMin, hMax, wMin, wMax] of [[0, far, 40, 190, 18, 70], [1, near, 20, 110, 24, 90]]) {
      let x = 0;
      while (x < W) {
        const w = (wMin + rnd() * (wMax - wMin)) * k, h = (hMin + Math.pow(rnd(), 2.2) * (hMax - hMin)) * k;
        g.fillStyle = col; g.fillRect(x, base - h, w, h + 2);
        if (rnd() < .12) g.fillRect(x + w * .4, base - h - 18 * k, 2 * k, 18 * k);   // antenna
        if (t !== 'day') { g.fillStyle = t === 'night' ? 'rgba(255,214,140,.75)' : 'rgba(255,220,170,.35)';
          for (let wy = base - h + 6 * k; wy < base - 6 * k; wy += 7 * k) for (let wx = x + 3 * k; wx < x + w - 3 * k; wx += 6 * k) if (rnd() < (row ? .22 : .14)) g.fillRect(wx, wy, 2.4 * k, 2.6 * k); }
        x += w + (rnd() < .3 ? rnd() * 20 * k : 0);
      }
    }
  } else {
    // 練習コース: hills far off, a line of trees nearer
    for (const [col, amp, y0, f] of [[far, 120, 60, .004], [near, 60, 25, .011]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, base);
      const ph = rnd() * 9, ph2 = rnd() * 9;
      for (let x = 0; x <= W; x += 4) { const u = x / W * Math.PI * 2;   // periodic, so the ends meet
        const y = base - (y0 + amp * k * (.5 + .3 * Math.sin(u * Math.round(W * f / 6) + ph) + .2 * Math.sin(u * Math.round(W * f / 2.3) + ph2))) * k; g.lineTo(x, y); }
      g.lineTo(W, base); g.closePath(); g.fill();
    }
    g.fillStyle = near; for (let x = 0; x < W; x += 3 * k) { const h = (8 + rnd() * 14) * k; g.beginPath(); g.ellipse(x, base - h / 2, 5 * k, h / 2 + 2, 0, 0, Math.PI * 2); g.fill(); }
  }
  // haze at the foot, so the silhouettes sit in the distance
  const hz = g.createLinearGradient(0, base - 60 * k, 0, H); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(.55, haze); hz.addColorStop(1, haze);
  g.fillStyle = hz; g.fillRect(0, base - 60 * k, W, H - base + 60 * k);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  tex.onUpdate = () => { c.width = c.height = 1; };
  return tex;
}
function skyline(t, venue) {
  const R = 820, Hm = 170, geo = new THREE.CylinderGeometry(R, R, Hm, 96, 1, true);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: skylineTexture(t, venue), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.position.set((COURSE.xMin + COURSE.xMax) / 2, Hm / 2 - Hm * .14 - 4, (COURSE.yMin + COURSE.yMax) / 2); m.renderOrder = -1; return m;
}

const TOD = {
  day: { sky: 0x9fc9e6, fog: 0xb4d3e4, hemi: [0xdfefff, 0x2a4a58, 1.5], sun: [0xffffff, 2.2], water: 0xffffff, ground: 0x7d8a7a },
  evening: { sky: 0xe7a46f, fog: 0xd99a72, hemi: [0xffd2a8, 0x3a3040, 1.1], sun: [0xffb070, 1.8], water: 0xe8c0a0, ground: 0x6c625a },
  night: { sky: 0x070b1c, fog: 0x0a1026, hemi: [0x8090c0, 0x101420, 0.55], sun: [0xfff2d6, 0.9], water: 0x6d7f9a, ground: 0x23262e },
};

/* ---------- course: water, banks, stand, marks, booms, the aerial wires ---------- */
function shapeXY(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
const flat = (geo, h) => { geo.rotateX(Math.PI / 2); geo.translate(0, h, 0); return geo; };   // shape (x, y) → world (x, h, y)
function buildWorld() {
  if (world) { scene.remove(world.g); world.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); }
  const g = new THREE.Group(), T = TOD[tod] || TOD.day, out = VENUE_OUTLINE.slice();
  // water
  const wGeo = flat(new THREE.ShapeGeometry(shapeXY(out)), 0), pos = wGeo.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - COURSE.xMin) / (COURSE.xMax - COURSE.xMin); uv[i * 2 + 1] = (pos.getZ(i) - COURSE.yMin) / (COURSE.yMax - COURSE.yMin); }
  wGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const water = new THREE.Mesh(wGeo, HQ
    ? new THREE.MeshStandardMaterial({ map: waterTexture(tod), color: new THREE.Color(T.water).multiplyScalar(.62), roughness: .5, metalness: 0, normalMap: rippleNormals(), normalScale: new THREE.Vector2(.22, .22), envMapIntensity: tod === 'night' ? .2 : .42, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({ map: waterTexture(tod), color: T.water, side: THREE.DoubleSide }));
  g.add(water);
  // ground around the water, with the water cut out; the bank top is 1 m up
  const BANK = 1.0, R = 900, ground = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
  ground.holes.push(new THREE.Path(out.map(([x, y]) => new THREE.Vector2(x, y))));
  g.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ground), BANK), new THREE.MeshLambertMaterial({ color: T.ground, side: THREE.DoubleSide })));
  // the bank walls
  const wp = [];
  for (let i = 0; i < out.length; i++) {
    const [x1, y1] = out[i], [x2, y2] = out[(i + 1) % out.length];
    wp.push(x1, -.4, y1, x2, -.4, y2, x2, BANK, y2, x1, -.4, y1, x2, BANK, y2, x1, BANK, y1);
  }
  const wallGeo = new THREE.BufferGeometry(); wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wallGeo.computeVertexNormals();
  g.add(new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: tod === 'night' ? 0x3a3d44 : 0xc9c4b6, side: THREE.DoubleSide })));
  // a plain stand building behind the stand-side bank (x −130…110, as the replay app has it)
  const stand = new THREE.Group(), sm = new THREE.MeshLambertMaterial({ color: tod === 'night' ? 0x4a4e5a : 0xd8d6cf }), glass = new THREE.MeshBasicMaterial({ color: tod === 'night' ? 0xffe3a0 : 0x5a7f96 });
  for (let x = -130; x < 110; x += 30) {
    const y = standY(x + 15) + 14, b = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 18), sm); b.position.set(x + 15, BANK + 7, y + 9); stand.add(b);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(27, 4), glass); w.position.set(x + 15, BANK + 9, y - .05); w.rotation.y = Math.PI; stand.add(w);
  }
  g.add(stand);
  // 大時計: a dial on a post at the middle of the stand side
  const clk = new THREE.Group(), cy = standY(0) + 6;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, 12, 8), new THREE.MeshLambertMaterial({ color: 0x777777 })); post.position.set(0, BANK + 6, cy); clk.add(post);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: 0xf4f4f0 })); dial.position.set(0, BANK + 14, cy - .5); dial.rotation.y = Math.PI; clk.add(dial);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4, 4.5, 32), new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide })); ring.position.copy(dial.position); ring.rotation.y = Math.PI; clk.add(ring);
  g.add(clk);
  // turn marks (orange) and the float booms toward the centre
  const mm = new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: tod === 'night' ? 0x552000 : 0x000000 }), wm = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bm = new THREE.MeshLambertMaterial({ color: 0xe8e2c8 });
  for (const o of OBSTACLES) {
    if (o.kind === 'mark') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r * .85, o.r, 1.6, 20), mm); m.position.set(o.x1, .8, o.y1); g.add(m);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(o.r * .5, o.r * .85, .5, 20), wm); top.position.set(o.x1, 1.85, o.y1); g.add(top);
    } else if (o.kind === 'boom') {
      const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), b = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, L, 8), bm);
      b.rotation.z = Math.PI / 2; b.position.set((o.x1 + o.x2) / 2, .12, (o.y1 + o.y2) / 2); g.add(b);
    }
  }
  // 空中線 (distance marks): a wire over the home straight with flags, square to the stand like the start line
  const dm = new THREE.Group(); dm.name = 'dist';
  for (const [d, col] of DIST_MARKS) {
    const yTop = standY(-d) - 1, X = y => slitXAt(y) - d, H = 6, cm = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    for (const y of [2.2, yTop]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, H, 6), cm); p.position.set(X(y), H / 2, y); dm.add(p); }
    const wire = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X(2.2), H, 2.2), new THREE.Vector3(X(yTop), H, yTop)]);
    dm.add(new THREE.Line(wire, new THREE.LineBasicMaterial({ color: 0xdddddd })));
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.45, 0, -1.1, 0, 0, 0, .45], 3));
    for (let y = 5; y < yTop - 1; y += 4.5) { const f = new THREE.Mesh(fg, cm); f.position.set(X(y), H, y); dm.add(f); }
  }
  g.add(dm);
  // night lights: bright poles round the course
  if (tod === 'night') {
    const pm = new THREE.MeshBasicMaterial({ color: 0xfff2d6 });
    for (const [x, y] of NIGHT_POLES) { const p = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), pm); p.position.set(x, 18, y); g.add(p); }
  }
  scene.add(g);
  const dome = skyDome(tod), sky2 = skyline(tod, VENUE.id); g.add(dome); g.add(sky2);
  if (HQ) {   // the sky (and skyline) reflected in the water and on the boats
    const envScene = new THREE.Scene(); envScene.add(skyDome(tod)); envScene.add(skyline(tod, VENUE.id));
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(envScene, 0.02, .1, 2500);
    if (scene.environment) scene.environment.dispose(); scene.environment = rt.texture; pm.dispose();
  }
  world = { g, dist: dm, water, dome, sky2 }; WX3.key = '';
  scene.background = new THREE.Color(T.sky); scene.fog = new THREE.Fog(T.fog, 120, 520);
  hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2]; sun.color.set(T.sun[0]); sun.intensity = T.sun[1];
}


/* ---------- 天気 (d271, まえ: 3D視点に天気の状態を反映、2Dみたいに): the same waterEnv the 2D view reads (6艇レースだけ) —
   雨: grey sky and fog drawn in, the light dimmed, rain streaks slanting with the wind; 風・波: the ripples drift downwind
   and stand up with the wind and the wave height ---------- */
const WX3 = { key: '', rain: null, wv: 0, ux: 0, uy: 0, wave: 0, n: LITE ? 450 : 1400, box: 36, top: 26, len: .9, fall: 9 };
function wxNow() { return fleet && waterEnv ? waterEnv : null; }
function wxApply() {
  const e = wxNow(), T = TOD[tod] || TOD.day, rain = !!(e && e.rain), key = e ? [e.rain ? 1 : 0, e.wx, e.wy, e.wave].join() : '-';
  WX3.wv = e ? Math.hypot(e.wx, e.wy) : 0; WX3.ux = WX3.wv > .3 ? e.wx / WX3.wv : 0; WX3.uy = WX3.wv > .3 ? e.wy / WX3.wv : 0; WX3.wave = e ? e.wave || 0 : 0;
  if (key === WX3.key) return; WX3.key = key;
  const g = rain ? (tod === 'night' ? .3 : .5) : 0, cloud = new THREE.Color(tod === 'night' ? 0x0e1216 : tod === 'evening' ? 0x8a7f7a : 0x8c969c);
  scene.background = new THREE.Color(T.sky).lerp(cloud, g);
  scene.fog = new THREE.Fog(new THREE.Color(T.fog).lerp(cloud, g), rain ? 50 : 120, rain ? 290 : 520);
  hemi.intensity = T.hemi[2] * (rain ? .78 : 1); sun.intensity = T.sun[1] * (rain ? .3 : 1);
  for (const m of [world.dome, world.sky2]) if (m && m.material) m.material.color.setScalar(rain ? (tod === 'night' ? .7 : .62) : 1);
  const wm = world.water && world.water.material;
  if (wm && wm.normalScale) { const k = .22 * (1 + Math.min(WX3.wv, 8) * .12 + Math.min(WX3.wave, 15) * .035); wm.normalScale.set(k, k); }
  if (rain && !WX3.rain) makeRain();
  if (WX3.rain) WX3.rain.visible = rain;
}
function makeRain() {
  const n = WX3.n, pos = new Float32Array(n * 6), seed = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const h = k => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); }; seed[i * 3] = h(1); seed[i * 3 + 1] = h(2); seed[i * 3 + 2] = h(3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: tod === 'night' ? 0x9aa8b8 : 0xd6e4ec, transparent: true, opacity: LITE ? .45 : .38, depthWrite: false }));
  m.frustumCulled = false; m.userData.seed = seed; scene.add(m); WX3.rain = m;
}
function stepRain() {   // streaks in a box round the camera, falling and blown with the wind (no dice: the race is untouched)
  const m = WX3.rain; if (!m || !m.visible) return;
  const p = m.geometry.attributes.position.array, sd = m.userData.seed, B = WX3.box, t = performance.now() / 1000, c = camera.position;
  const wx = WX3.ux * WX3.wv * .5, wz = WX3.uy * WX3.wv * .5, L = WX3.len;
  for (let i = 0; i < WX3.n; i++) {
    const sp = WX3.fall * (.85 + .3 * sd[i * 3 + 2]), y = WX3.top - ((sd[i * 3 + 1] * WX3.top + t * sp) % WX3.top);
    const fallT = (WX3.top - y) / sp;
    const W2 = 2 * B, x = c.x + ((sd[i * 3] * W2 + wx * fallT) % W2 + W2) % W2 - B, z = c.z + (((sd[(i * 7 % WX3.n) * 3 + 1]) * W2 + wz * fallT) % W2 + W2) % W2 - B;
    const j = i * 6, k = L / sp; p[j] = x; p[j + 1] = y; p[j + 2] = z; p[j + 3] = x + wx * k; p[j + 4] = y - L; p[j + 5] = z + wz * k;
  }
  m.geometry.attributes.position.needsUpdate = true;
}

/* ---------- PC: さざ波 (a tiling normal map that drifts) ---------- */
let rippleTex = null;
function rippleNormals() {
  if (rippleTex) return rippleTex;
  const N = 256, h = new Float32Array(N * N), c = document.createElement('canvas'); c.width = c.height = N;
  let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const waves = []; for (let i = 0; i < 26; i++) { const kx = Math.round((rnd() - .5) * 24), ky = Math.round((rnd() - .5) * 14) || 1; waves.push([kx, ky, rnd() * 6.28, 1 / Math.hypot(kx, ky)]); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (const [kx, ky, ph, a] of waves) v += a * Math.sin((kx * x + ky * y) / N * 6.2832 + ph); h[y * N + x] = v; }
  const g = c.getContext('2d'), img = g.createImageData(N, N), H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
    img.data[o] = (-dx / l * .5 + .5) * 255; img.data[o + 1] = (-dy / l * .5 + .5) * 255; img.data[o + 2] = (1 / l * .5 + .5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  rippleTex = new THREE.CanvasTexture(c); rippleTex.wrapS = rippleTex.wrapT = THREE.RepeatWrapping;
  rippleTex.repeat.set((COURSE.xMax - COURSE.xMin) / 4.5, (COURSE.yMax - COURSE.yMin) / 4.5);   // one tile ≈ 4.5 m
  rippleTex.anisotropy = 8;
  return rippleTex;
}

/* ---------- PC: 飛沫 — particles thrown by the hull, from the same values the 2D game draws its spray from ----------
   ターンの外側 (splashK: flat hull = a tall wall, deep bank = a thin low sheet), 横すべり (slip), 艇尾 (rooster tail at speed),
   舳先 (bow wash), 着水 (landing slap). Looks only. */
const SPRAY = { max: 7000, g: 9.8, drag: 1.6 };
let spray3 = null; const landSeen = new WeakMap(); let lastGameT = null;
function makeSpray() {
  const n = SPRAY.max, geo = new THREE.BufferGeometry();
  const P = new Float32Array(n * 3), S = new Float32Array(n), A = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(S, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(A, 1).setUsage(THREE.DynamicDrawUsage));
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { map: { value: new THREE.CanvasTexture(c) }, scale: { value: 400 }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: 'attribute float size; attribute float alpha; varying float vA; uniform float scale; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 tint; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < 0.01) discard; gl_FragColor = vec4(tint, t.a * vA); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  spray3 = { pts, P, S, A, vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n), life: new Float32Array(n), age: new Float32Array(n), size0: new Float32Array(n), a0: new Float32Array(n), n: 0, acc: new WeakMap() };
}
let sd3 = 7; const r3 = () => (sd3 = (sd3 * 16807) % 2147483647) / 2147483647;
// one drop at the hull's local (lx forward, ly to the right), thrown with local velocity (vx forward, vy right, up)
function drop(b, lx, ly, vx, vy, up, size, life, alpha) {
  const S3 = spray3; if (S3.n >= SPRAY.max) return;
  const i = S3.n++, c = Math.cos(b.a), s = Math.sin(b.a), bvx = (b.v || 0) * c - (b.vl || 0) * s * 0, bvz = (b.v || 0) * s;
  S3.P[i * 3] = b.x + lx * c - ly * s; S3.P[i * 3 + 1] = .15 + fin(b.hop); S3.P[i * 3 + 2] = b.y + lx * s + ly * c;
  S3.vx[i] = vx * c - vy * s + bvx * .35; S3.vz[i] = vx * s + vy * c + bvz * .35; S3.vy[i] = up;
  S3.life[i] = life; S3.age[i] = 0; S3.size0[i] = size; S3.a0[i] = alpha;
}
function emitFor(b, dt) {
  if (fin(b.cap) > 0 || b.fallen) return;
  const S3 = spray3; let acc = S3.acc.get(b) || 0;
  const v = fin(b.v), sk = lim((b.splashK || 0) / 1.2, 0, 1.4), yaw = fin(b.yaw), sl = lim((Math.abs(b.slip || 0) - .05) / .25, 0, 1);
  // how many drops this frame (per kind), carried over so a slow frame doesn't lose them
  const want = { turn: sk > .12 && v > 7 && Math.abs(yaw) > .2 ? 380 * sk : 0, slide: sl > 0 && v > 6 ? 260 * sl : 0,
    tail: v > 6 ? 120 * lim((v - 6) / 14, 0, 1) : 0, bow: v > 5 ? 70 * lim(v / 23, 0, 1) : 0 };
  acc += (want.turn + want.slide + want.tail + want.bow) * dt;
  let n = Math.floor(acc); acc -= n; S3.acc.set(b, acc);
  const tot = want.turn + want.slide + want.tail + want.bow || 1;
  for (let k = 0; k < n; k++) {
    const pick = r3() * tot;
    if (pick < want.turn) {   // the outside of the turn: flat hull → a tall heavy wall, banked deep → a low thin sheet
      const side = -Math.sign(yaw), hgt = sk * sk, u = r3();
      drop(b, .6 - u * 2.2, side * (.6 + r3() * .2), -1 - r3() * 2, side * (2 + 4.5 * sk * r3()), 1 + 5.5 * hgt * (.5 + r3()), .16 + .3 * sk * r3(), .5 + .7 * hgt * r3(), .5 + .4 * Math.min(1, sk));
    } else if (pick < want.turn + want.slide) {   // skating sideways: a sheet off the side it slides toward
      const side = Math.sign(b.vl) || 1;
      drop(b, .9 - r3() * 2.4, side * .62, -r3(), side * (2 + 3 * sl * r3()), .8 + 2.4 * sl * r3(), .14 + .2 * sl * r3(), .45 + .4 * r3(), .55 * sl + .2);
    } else if (pick < want.turn + want.slide + want.tail) {   // rooster tail off the prop
      drop(b, -1.75, (r3() - .5) * .25, -1.5 - r3() * 2.5, (r3() - .5) * .8, 2.2 + r3() * 2.2 * lim(v / 20, 0, 1), .12 + r3() * .2, .55 + r3() * .35, .5);
    } else {   // bow wash, both sides
      const side = r3() < .5 ? -1 : 1;
      drop(b, .9 + r3() * .3, side * .45, -.5, side * (1 + r3() * 1.8), .6 + r3() * 1.2, .08 + r3() * .12, .3 + r3() * .25, .45);
    }
  }
  // 着水: the slap as it lands from a hop
  const la = fin(b.landAge, 9); if (la < .05 && fin(b.landV) > 1) {
    const key = Math.round((time - la) * 100); if (landSeen.get(b) !== key) { landSeen.set(b, key);
      const sp = lim(b.landV / 4, 0, 1); for (let i = 0; i < 70 * sp + 10; i++) { const side = i % 2 ? 1 : -1; drop(b, 1 - r3() * 3, side * .6, -r3(), side * (1.5 + r3() * 3.5 * sp), 1 + r3() * 2.5 * sp, .14 + r3() * .2, .4 + r3() * .4, .7); } }
  }
}
function stepSpray(rows, dt) {
  const S3 = spray3;
  for (const row of rows) emitFor(row.b, dt);
  let j = 0;
  for (let i = 0; i < S3.n; i++) {
    const age = S3.age[i] + dt; if (age >= S3.life[i]) continue;
    const dr = Math.exp(-SPRAY.drag * dt);
    const vx = S3.vx[i] * dr, vz = S3.vz[i] * dr, vy = S3.vy[i] - SPRAY.g * dt;
    let y = S3.P[i * 3 + 1] + vy * dt; if (y < 0) continue;   // back in the water
    const k = age / S3.life[i];
    if (j !== i) { S3.vx[j] = vx; S3.vz[j] = vz; S3.vy[j] = vy; S3.life[j] = S3.life[i]; S3.size0[j] = S3.size0[i]; S3.a0[j] = S3.a0[i]; }
    else { S3.vx[j] = vx; S3.vz[j] = vz; S3.vy[j] = vy; }
    S3.P[j * 3] = S3.P[i * 3] + vx * dt; S3.P[j * 3 + 1] = y; S3.P[j * 3 + 2] = S3.P[i * 3 + 2] + vz * dt;
    S3.age[j] = age; S3.S[j] = S3.size0[j] * (1 + 1.6 * k); S3.A[j] = S3.a0[j] * (1 - k) * (1 - k * .3);
    j++;
  }
  S3.n = j;
  const geo = S3.pts.geometry; geo.setDrawRange(0, j);
  for (const nm of ['position', 'size', 'alpha']) geo.attributes[nm].needsUpdate = true;
}

/* ---------- wakes: one dynamic mesh of quads (the core and the two spreading wave lines) ---------- */
const WMAX = LITE ? 8000 : 24000;   // quads
function makeWake() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WMAX * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WMAX * 6 * 4), 4).setUsage(THREE.DynamicDrawUsage));
  wakeMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  wakeMesh.frustumCulled = false; wakeMesh.renderOrder = 1; scene.add(wakeMesh);
}
function drawWakes(arrs) {
  const P = wakeMesh.geometry.attributes.position.array, C = wakeMesh.geometry.attributes.color.array;
  let n = 0;
  const quad = (ax, ay, bx, by, wa, wb, r, gg, bb, al1, al2) => {
    if (n >= WMAX) return;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const v = [ax + nx * wa, ay + ny * wa, ax - nx * wa, ay - ny * wa, bx - nx * wb, by - ny * wb, bx + nx * wb, by + ny * wb];
    const o = n * 18, c = n * 24, idx = [0, 1, 2, 0, 2, 3], al = [al1, al1, al2, al2];
    for (let k = 0; k < 6; k++) { const j = idx[k]; P[o + k * 3] = v[j * 2]; P[o + k * 3 + 1] = .04; P[o + k * 3 + 2] = v[j * 2 + 1]; C[c + k * 4] = r; C[c + k * 4 + 1] = gg; C[c + k * 4 + 2] = bb; C[c + k * 4 + 3] = al[j]; }
    n++;
  };
  for (const arr of arrs) {
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i - 1], q = arr[i], ap = time - p.t, aq = time - q.t;
      if (aq > 3 || ap > 3.1) continue;
      const vf = Math.min(1, q.v / 10), A = x => Math.max(0, 1 - x / 3) * vf;
      quad(p.x, p.y, q.x, q.y, .3 + ap * .3, .3 + aq * .3, .85, .95, .95, .26 * A(ap), .26 * A(aq));   // white core
      for (const side of [-1, 1]) {
        const sp = ap * (1.4 + p.v * .12), sq = aq * (1.4 + q.v * .12);
        quad(p.x - Math.sin(p.a) * side * sp, p.y + Math.cos(p.a) * side * sp, q.x - Math.sin(q.a) * side * sq, q.y + Math.cos(q.a) * side * sq,
          .14 + ap * .12, .14 + aq * .12, .9, .97, .97, .38 * A(ap), .38 * A(aq));
      }
    }
  }
  wakeMesh.geometry.setDrawRange(0, n * 6);
  wakeMesh.geometry.attributes.position.needsUpdate = true; wakeMesh.geometry.attributes.color.needsUpdate = true;
}

/* ---------- boats ---------- */
function actorFor(row) {
  const body = row.body || {}, sex = body.sex === 'f' ? 'f' : 'm', lane = lim(Math.round(row.no || 1), 1, 6), key = lane + '|' + sex;
  let a = actors.get(key);
  if (!a) { a = set.create({ lane, sex, heightCm: 165 }); scene.add(a.root); actors.set(key, a); }
  a.heightCm = lim(body.height || (sex === 'f' ? 157 : 165), 140, 200);
  return a;
}
const ghostActors = new Map(), GHOST_TINT = { best: '#9fe8d4', rival: '#ffb3d9' };
function ghostActor(kind) {
  let a = ghostActors.get(kind);
  if (!a) {
    a = set.create({ lane: 1, sex: 'm', heightCm: 165 });
    for (const m of a.materials) { m.transparent = true; m.opacity = kind === 'rival' ? .45 : .38; m.depthWrite = false;
      const n = m.name.split('.')[0]; if (n === 'BoatPaint' || n === 'RacerPaint' || n === 'BoatLivery') m.color.set(GHOST_TINT[kind]); }
    a.root.traverse(o => { if (o.isMesh) o.renderOrder = 3; });
    scene.add(a.root); ghostActors.set(kind, a);
  }
  return a;
}
function rowsNow() { return fleet ? fleet.boats.filter(r => !r.gone) : [{ b: B, inp: input, no: 1 }]; }
function targetRow() { if (!fleet) return { b: B }; return focusRow() || fleet.boats[0]; }

/* ---------- the camera ---------- */
/* 振り返り (まえ: アクセルと逆のトリガーで後ろを見る): the other trigger turns the view round. The angle follows how far the
   trigger is in (pull slowly → turns slowly, snap it → looks back at once, hold it part way → the view stays there);
   let go → back to the front. First pull looks over the inside shoulder (port: the turns are to the left); pull, let go
   and pull again quickly → over the outside shoulder. Controller only, 3D only; the race never sees it. */
const LOOK = { max: Math.PI * 0.95, rate: 9, back: 7, tap: 0.35, on: 0.06 };
const look = { cur: 0, side: -1, held: false, upAt: -9, downAt: -9 };
function lookTrigger() {
  try { if (typeof currentPad !== 'function' || typeof pad === 'undefined') return 0; const g = currentPad(); if (!g) return 0;
    const b = g.buttons[pad.useRT ? 6 : 7]; return b ? b.value || (b.pressed ? 1 : 0) : 0; } catch (e) { return 0; }
}
function lookBack(dt) {
  const v = lookTrigger(), now = performance.now() / 1000;
  if (!look.held && v > LOOK.on) { look.held = true; look.side = now - look.upAt < LOOK.tap && look.upAt - look.downAt < LOOK.tap ? 1 : -1; look.downAt = now; }
  else if (look.held && v <= LOOK.on) { look.held = false; look.upAt = now; }
  const target = look.held ? look.side * LOOK.max * Math.min(1, (v - LOOK.on) / (1 - LOOK.on)) : 0;
  look.cur += (target - look.cur) * (1 - Math.exp(-dt * (look.held ? LOOK.rate : LOOK.back)));
  return look.cur;
}
function placeCamera(dt) {
  const t = targetRow().b, k = 1 - Math.exp(-dt * (mode === 'racer' ? 14 : 4));
  if (!camS.init) { camS.x = t.x; camS.y = t.y; camS.a = t.a; camS.init = true; }
  // the heading the camera looks along follows the hull (smoothed, so a drift shows as the boat turning against the view)
  let da = ((t.a - camS.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; camS.a += da * k;
  camS.x = t.x; camS.y = t.y;
  const off = lookBack(dt), c = Math.cos(camS.a + off), s = Math.sin(camS.a + off), hop = fin(t.hop) + (typeof rideBob === 'function' ? rideBob(t).h : 0);
  if (mode === 'chase') {
    camera.fov = 60; camera.position.set(camS.x - c * 11, 4.2 + hop * .5, camS.y - s * 11);
    camera.lookAt(camS.x + c * 14, .6, camS.y + s * 14);
  } else {
    // the racer's eyes: a little behind the boat's pivot, crouched; the bow is in view
    camera.fov = 72; const ex = t.x - Math.cos(t.a) * .55, ey = t.y - Math.sin(t.a) * .55;
    camera.position.set(ex, 1.25 + hop, ey);
    camera.lookAt(ex + c * 30, .2 + hop * .5, ey + s * 30);
    const bank = lim(t.bank, -.65, .65) * .5; camera.rotateZ(-bank);
  }
  camera.updateProjectionMatrix();
}

/* ---------- frame ---------- */
let last = 0, lost = false;
function render(now) {
  requestAnimationFrame(render);
  if (mode === '2d' || !set || lost) { if (canvas.style.display !== 'none') { canvas.style.display = 'none'; light2d(false); } return; }
  if (FRAME_MS && now - last < FRAME_MS - 2) return;
  if (canvas.style.display !== 'block') { canvas.style.display = 'block'; light2d(true); }
  try { frame3d(now); } catch (e) { console.warn('3D視点:', e); if (!render.warned) { render.warned = true; } }
}
// while the 3D view is up, the 2D course underneath is drawn to a 1×1 canvas (next to nothing), and the light-3D boat
// sprites (another WebGL canvas) are not rendered; the 2D HUD, mini map and controls stay
const _prep = window.Boat3D && Boat3D.prepare;
function light2d(on) {
  const cv = document.getElementById('cv');
  if (window.Boat3D && _prep) Boat3D.prepare = on ? () => false : _prep;
  if (on) { cv.width = 1; cv.height = 1; } else if (typeof resize === 'function') resize();
}
function frame3d(now) {
  const cv = document.getElementById('cv'); if (cv.width !== 1) { cv.width = 1; cv.height = 1; }
  const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
  const w = innerWidth, h = innerHeight, dpr = LITE ? 1 : Math.min(1.5, devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  const t = todNow();
  if (t !== tod || VENUE.id !== venueId) { tod = t; venueId = VENUE.id; buildWorld(); }
  world.dist.visible = !!fleet; wxApply();
  for (const a of actors.values()) a.root.visible = false;
  const rows = rowsNow(), me = targetRow().b, focal = h / 2 / Math.tan(camera.fov * Math.PI / 360);
  for (const row of rows) {
    const b = row.b, inp = row.inp || {}, a = actorFor(row);
    const capsized = fin(b.cap) > 0 && !b.fallen, gone = fin(b.cap) > 0 || b.fallen;
    const nose = capsized ? 0 : lim((typeof willieMotion === 'function' ? willieMotion(b).nose : (b.wil || 0) * .30) + (b.trim || 0) * .14 + (b.porp || 0) * .045 * Math.sin(time * 18) + (b.hv || 0) * .025, -.12, .75);
    const rb = typeof rideBob === 'function' ? rideBob(b) : { h: 0, nose: 0 };   // d266 走りの揺れ (looks only)
    a.setGameTransform({ x: b.x, y: b.y, hop: fin(b.hop) + rb.h + (typeof willieMotion === 'function' ? willieMotion(b).h * .5 : 0), modelYaw: -Math.PI / 2 - b.a, modelBank: capsized ? Math.PI : lim(b.bank, -.65, .65) * V3.bank, nose: capsized ? 0 : nose + rb.nose });
    const dist = Math.hypot(b.x - camera.position.x, b.y - camera.position.z) || 1;
    a.chooseLOD(3.3 * focal / dist * (LITE ? .6 : 1));
    a.updatePose({ pitch: lim((b.wil || 0) > .3 && !(fin(b.cap) > 0) ? Math.min(inp.pitch || 0, -.7) : inp.pitch, -1, 1),   /* d272: ウィリー中は体を後ろへ */ roll: lim(inp.roll, -1, 1), steer: -lim(inp.steer, -1, 1) * .30, propAngle: time * (12 + lim(b.v / 23, 0, 1) * 90) });
    const lv = a.levels[a.lod]; if (lv && lv.racer) lv.racer.visible = !gone && !(mode === 'racer' && b === me);
    a.root.visible = true;
  }
  // タイムアタックのゴースト (自己ベスト・相手): the same poses the 2D game draws, see-through
  for (const gh of ghostActors.values()) gh.root.visible = false;
  if (typeof taGhostsNow === 'function') for (const { b, kind } of taGhostsNow()) {
    const a = ghostActor(kind);
    a.setGameTransform({ x: b.x, y: b.y, hop: 0, modelYaw: -Math.PI / 2 - b.a, modelBank: 0, nose: 0 });
    a.chooseLOD(3.3 * focal / (Math.hypot(b.x - camera.position.x, b.y - camera.position.z) || 1) * (LITE ? .6 : 1));
    a.updatePose({ propAngle: time * 60 }); a.root.visible = true;
  }
  drawWakes(fleet ? fleet.boats.filter(r => !r.gone).map(r => r.wake) : [wake]);
  if (HQ) {
    const sdt = lastGameT == null ? 0 : lim(time - lastGameT, 0, .1); lastGameT = time;   // the race clock (a demo can run fast)
    if (spray3) { stepSpray(sdt > 0 ? rows : [], sdt); spray3.pts.material.uniforms.scale.value = h / 2 / Math.tan(camera.fov * Math.PI / 360);
      spray3.pts.material.uniforms.tint.value.set(tod === 'night' ? 0x9fb2c8 : tod === 'evening' ? 0xffe2c8 : 0xffffff); }
    if (rippleTex && !paused) { const d = WX3.wv > .3 ? (.4 + WX3.wv * .35) / 4.5 : 0; rippleTex.offset.x += dt * (.018 - WX3.ux * d); rippleTex.offset.y += dt * (.011 - WX3.uy * d); }   // d271: downwind like the 2D ripples
  }
  placeCamera(dt); stepRain();
  sun.position.set(me.x - 60, 120, me.y - 80); sun.target.position.set(me.x, 0, me.y);
  renderer.render(scene, camera);
}

/* ---------- the switch: a pill in the top bar and the V key ---------- */
function setMode(m) {
  mode = m; try { localStorage.setItem(V3.key, m); } catch (e) {}
  btn.textContent = '視点：' + V3.names[m]; camS.init = false;
  document.body.classList.toggle('v3d', m !== '2d');   // d274: the 姿勢 pad sits over the boat in 3D → fainter (index.html)
  if (m !== '2d') boot();
}
const btn = document.createElement('button'); btn.className = 'pill'; btn.id = 'view3dBtn';
btn.addEventListener('click', e => { e.stopPropagation(); setMode(V3.modes[(V3.modes.indexOf(mode) + 1) % V3.modes.length]); btn.blur(); });
document.querySelector('.pills').prepend(btn);
addEventListener('keydown', e => { if ((e.key === 'v' || e.key === 'V') && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) btn.click(); });

let booting = null;
function boot() {
  if (booting) return booting;
  canvas = document.createElement('canvas'); canvas.id = 'cv3d';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
  document.getElementById('cv').after(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: LITE ? 'default' : 'high-performance' });
  // if the phone takes the GPU back, fall back to 2D instead of freezing the screen
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; btn.textContent = '視点：2D（3D停止）'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; tod = ''; setMode(mode); });
  renderer.outputColorSpace = THREE.SRGBColorSpace; if (HQ) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 1500);
  hemi = new THREE.HemisphereLight(0xdfefff, 0x2a4a58, 1.5); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(sun); scene.add(sun.target);
  makeWake(); if (HQ) makeSpray();
  booting = (async () => {
    if (!window.HFGP3D_GLB) await loadScript(new URL('./hfgp3d-glb.js', import.meta.url).href);
    set = await loadAssetSet(new URL('../hfgp3d/', import.meta.url).href, 'mobile');
    window.View3D.ready = true;
  })().catch(e => { console.warn('3D視点:', e); btn.textContent = '視点：3D読み込み失敗'; window.View3D.error = String(e); });
  requestAnimationFrame(render);
  return booting;
}
window.View3D = { ready: false, setMode, get mode() { return mode; }, look };
setMode(mode);
