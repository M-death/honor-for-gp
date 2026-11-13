/* ---------- ゲーム内リプレイ (d228, まえ: 動画用ログをゲームの中で再生して走りをチェックしたい) ----------
   Plays a 動画用ログ (hfgp-video-replay, see vlog.js / VIDEO_LOG.md) inside the game. Nothing is simulated again: every
   frame of the file is drawn as it was recorded (position, heading, speed, bank, slip, hop, posture, lever, rudder…),
   so an old log keeps showing the race it recorded even after the physics changes. The game's own drawing (view.js)
   is used: while it plays, `fleet` is a stand-in built from the file and the race loop is not run.
   Opens from the race / タイムアタック result (the race just run) or from a saved file (メニュー › 開発用).
   Controls: 再生・一時停止, ±5 s, ±1 frame, speed 0.1–4×, seek bar, camera (follow / close / all boats / 1M / 2M / start),
   the boat to follow. Keys: Space, ←/→ (Shift: 1 s), , and . (one frame), 1–6, C (camera), ↑/↓ or V (view, d285), Esc (close).
   Controller: A play/pause, B close, ↑/↓ the view (as in the race, d285–286 まえ), Y 表示 2D ⇄ 3D, ←/→ the boat to follow,
   LT/RT ±5 s, LB/RB speed. 表示 3D: the 2D cameras (追いかけ・拡大・全艇・1M・2M・スタート) become 上空 framed the same,
   plus 追尾（3D）・レーサー（3D）. */
const RPV = { on: false, P: null, t: 0, rate: 1, play: true, saved: null, off: 1000, fixed: null, seeking: false, padPrev: [] };
const RPV_RATES = [0.1, 0.25, 0.5, 1, 2, 4];
const RPV_FIX = { mark1: [{ x: MK - 40, y: -38 }, { x: MK + 42, y: 40 }], mark2: [{ x: -MK - 42, y: -40 }, { x: -MK + 40, y: 38 }], start: [{ x: -130, y: 2 }, { x: 25, y: 56 }] };

async function rpvParse(blob) {
  const buf = await blob.arrayBuffer(), u = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  let text;
  if (u[0] === 0x1f && u[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('このブラウザは .gz を開けません');
    text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } else text = new TextDecoder().decode(buf);
  const d = JSON.parse(text);
  if (d.format !== 'hfgp-video-replay' || !Array.isArray(d.frames) || !d.frames.length || !Array.isArray(d.fields)) throw new Error('動画用ログのファイルではありません');
  return d;
}
function rpvPrep(d) {
  const F = d.fields, I = {};
  for (const n of ['x', 'y', 'heading', 'v', 'bank', 'slip', 'hop', 'wil', 'porp', 'roll', 'pitch', 'steer', 'thr', 'splashK', 'vl', 'yaw', 'wakeBump', 'flags', 'lap', 'rank', 'fx', 'fy', 'hv', 'landV', 'progress']) I[n] = F.indexOf(n);
  const H = d.header || {}, ents = H.entries || [], order = d.boatOrder || ents.map(e => e.no);
  const fl = Object.assign({ capHull: 1, fallen: 2, retired: 4, dq: 8, flying: 16, finished: 32, relegated: 64, player: 128, jump: 256, gone: 512 }, H.flags || {});
  const land = new Map();
  for (const e of d.events || []) if (e.type === 'landing' && e.no != null) { if (!land.has(e.no)) land.set(e.no, []); land.get(e.no).push(e.t); }
  const fr = d.frames, hz = (d.timing && d.timing.sampleHz) || 60;
  const rows = order.map((no, k) => {
    const en = ents.find(e => e.no === no) || {};
    return { no, k, b: { x: 0, y: 0, a: 0, v: 0 }, inp: { thr: 0, steer: 0, roll: 0, pitch: 0 }, col: en.colors || [PLAYER_STYLE.hull, PLAYER_STYLE.num], prof: { top: false },
      name: en.name || null, cls: en.class || null, course: en.course || null, wake: [], gone: false, out: null, fin: null, flying: false, passed1M: false, laps: 0, rk: 0, land: land.get(no) || [] };
  });
  const c = H.conditions || {};
  const env = c.calm ? null : { wx: (c.windVec && c.windVec.wx) || 0, wy: (c.windVec && c.windVec.wy) || 0, rain: !!c.rain, wave: c.wave || 0, dir: c.dir, wind: c.wind || 0, cx: c.tideFlow || 0,
    stabilizer: !!c.stabilizer, temp: c.temp, tideLv: c.tideLv };
  const solo = H.mode === 'ta';
  const pit = !solo && fr.length && fr[0].slice(1).some(v => v && v[I.x] < -230);
  return { d, I, fl, rows, hz, fr, n: fr.length, t0: fr[0][0], t1: fr[fr.length - 1][0], env, night: c.timeOfDay === 'night' || (!c.timeOfDay && c.lighting === 'floodlights'), evening: ['evening', 'dusk', 'sunset', 'twilight'].includes(c.timeOfDay), solo, pit, trim: H.view && H.view.trim, playerNo: H.playerNo || null,
    decided: d.timing && d.timing.decidedSec };
}
// one boat at race time T, blended between the two recorded frames around it
function rpvSample(P, r, T) {
  const fi = clamp((T - P.t0) * P.hz, 0, P.n - 1), i0 = Math.floor(fi), i1 = Math.min(P.n - 1, i0 + 1), f = fi - i0;
  const A = P.fr[i0][1 + r.k], C = P.fr[i1][1 + r.k], I = P.I;
  const g = n => { const j = I[n]; if (j < 0) return 0; const a = A[j], c = C[j]; if (a == null) return c == null ? NaN : c; if (c == null) return a; return a + (c - a) * f; };
  const ga = n => { const j = I[n]; if (j < 0) return 0; const a = A[j] || 0, c = C[j] || 0; return a + Math.atan2(Math.sin(c - a), Math.cos(c - a)) * f; };
  const st = n => { const j = I[n]; return j < 0 ? 0 : (f < 0.5 ? A : C)[j]; };
  const b = r.b, flags = st('flags') | 0, FL = P.fl;
  b.x = g('x'); b.y = g('y'); b.a = ga('heading'); b.v = g('v'); b.bank = g('bank'); b.slip = ga('slip'); b.hop = g('hop'); b.wil = g('wil'); b.porp = g('porp');
  b.splashK = g('splashK'); b.vl = g('vl'); b.yaw = g('yaw'); b.wakeBump = g('wakeBump'); b.hv = g('hv'); b.landV = g('landV');
  b.cap = flags & FL.capHull ? 1 : 0; b.fallen = !!(flags & FL.fallen); b.fx = st('fx'); b.fy = st('fy'); b.shoveT = 0; b.trimPop = 0;
  r.inp.roll = g('roll'); r.inp.pitch = g('pitch'); r.inp.steer = g('steer'); r.inp.thr = g('thr');
  // 後ろ重心 (d173): the trim's resting value from posture and speed, with the log's own numbers (the pop after a lever snap is left out)
  const tr = P.trim; b.trim = tr ? clamp((tr.up * Math.max(0, -r.inp.pitch) - tr.down * Math.max(0, r.inp.pitch)) * clamp(b.v / tr.vRef, 0, 1), tr.min ?? -0.3, tr.max ?? 1.2) : 0;
  let la = 9; for (const t of r.land) { if (t > T) break; la = T - t; } b.landAge = la;
  r.gone = !!(flags & FL.gone); r.out = b.fallen ? 'fall' : null; r.flying = !!(flags & FL.flying); r.passed1M = !!(flags & FL.retired); r.dq = !!(flags & FL.dq);
  r.fin = flags & FL.finished ? T : null; r.laps = st('lap') | 0; r.rk = st('rank') | 0; r.spd = b.v;
}
// the wake: the last 3 s of where the boat was, straight from the file (works the same after a jump back)
function rpvWake(P, r, T) {
  const w = r.wake; w.length = 0;
  if (r.gone) return;
  const I = P.I, step = Math.max(1, Math.round(P.hz * 0.04)), iEnd = Math.floor(clamp((T - P.t0) * P.hz, 0, P.n - 1)), i0 = Math.max(0, iEnd - Math.round(3 * P.hz));
  for (let i = i0 - (i0 % step); i <= iEnd; i += step) {
    if (i < 0) continue;
    const v = P.fr[i][1 + r.k]; if (!v) continue;
    const a = v[I.heading] || 0;
    w.push({ x: v[I.x] - Math.cos(a) * 2.1, y: v[I.y] - Math.sin(a) * 2.1, a, t: P.fr[i][0] + RPV.off, v: v[I.v] || 0, s: 1 });
  }
}
function rpvApply() {
  const P = RPV.P, T = RPV.t;
  for (const r of P.rows) { rpvSample(P, r, T); rpvWake(P, r, T); }
  fleet.rank = P.rows.slice().sort((a, b) => (a.rk || 99) - (b.rk || 99));
  time = T + RPV.off;
}
function rpvStart(d) {
  const P = rpvPrep(d);
  RPV.saved = { venue: VENUE.id, fleet, running, paused, time, camMode, waterEnv, todMode, spray: spray.splice(0), cam: { x: cam.x, y: cam.y, s: cam.s }, ov: [...document.querySelectorAll('.overlay')].filter(o => !o.hidden) };
  for (const o of RPV.saved.ov) o.hidden = true;
  RPV.P = P; RPV.t = P.t0; RPV.play = true; RPV.on = true; RPV.rate = +$('rpvRate').value || 1;
  fleet = { replay: true, boats: P.rows, rank: P.rows.slice(), focus: P.playerNo || (P.rows[0] && P.rows[0].no), entry: false, pitMode: P.pit, order: [], setsu: null, raceCfg: null };
  { const v = d.header && d.header.venue; setVenue(v && VENUES_GEO[v.venueId] ? v.venueId : 'standard', false); }   // d236: the log's course (no venueId = the old 練習コース)
  waterEnv = P.env; todMode = P.night ? 'night' : P.evening ? 'evening' : 'day';
  running = true; paused = false;
  document.body.classList.add('replaying'); $('rpv').hidden = false;
  const H = d.header || {}, race = H.race || {};
  $('rpvTitle').textContent = `リプレイ　${P.solo ? 'タイムアタック' : H.mode === 'setsu' || H.setsu ? `節間 ${race.dayLabel || ''} ${race.raceNo ? race.raceNo + 'R' : ''}` : H.mode === 'race' ? '6艇レース' : H.mode === 'demo' ? '6艇デモ' : (H.mode || '')}　${d.gameVersion || ''}`;
  const bx = $('rpvBoats'); bx.textContent = '';
  for (const r of P.rows) {
    const bt = document.createElement('button'); bt.textContent = r.no; bt.style.background = r.col[0]; bt.style.color = r.col[1]; bt.dataset.no = r.no;
    bt.title = `${r.no}号艇${r.name ? ' ' + r.name : ''}を追う`; bt.addEventListener('click', () => { fleet.focus = r.no; rpvUi(true); }); bx.appendChild(bt);
  }
  bx.hidden = P.rows.length < 2;
  { const V = window.View3D, m = V && !V.error && (V.mode === 'chase' || V.mode === 'racer') ? 'v3:' + V.mode : null;   // d285: start in the view the race was watched in
    const s = $('rpvCam'); if (m) s.value = m; else if (!RPV_FIX[s.value] && [...s.options].some(o => o.value === camMode)) s.value = camMode; }
  rpvCamSet($('rpvCam').value);
  rpvApply(); rpvUi(true);
}
function rpvClose() {
  if (!RPV.on) return;
  const s = RPV.saved; RPV.on = false; RPV.P = null; RPV.fixed = null;
  if (s.venue !== VENUE.id) setVenue(s.venue, false);
  fleet = s.fleet; running = s.running; paused = s.paused; time = s.time; camMode = s.camMode; waterEnv = s.waterEnv; todMode = s.todMode;
  spray.length = 0; spray.push(...s.spray); cam.x = s.cam.x; cam.y = s.cam.y; cam.s = s.cam.s;
  document.body.classList.remove('replaying'); $('rpv').hidden = true;
  for (const o of s.ov) o.hidden = false;
  RPV.saved = null; last = performance.now();
}
const rpv3 = () => { const V = window.View3D; return !!V && !V.error && V.mode !== '2d'; };
function rpvCamSet(v) {
  const V = window.View3D;
  if (v.startsWith('v3:')) {   // d285: 追尾 / レーサー (play3d.js) — 3D can't start → back to 追いかけ
    if (V && !V.error) { RPV.fixed = null; V.setMode(v.slice(3)); rpvDispUi(); return; }
    v = 'follow'; $('rpvCam').value = v;
  }
  if (V && (V.mode === 'chase' || V.mode === 'racer')) V.setMode('top');   // d286: a 2D camera picked in 3D = 上空 framed by it
  RPV.fixed = RPV_FIX[v] || null;
  camMode = RPV.fixed ? 'auto' : v; cam.s = 0; rpvDispUi();
}
// d286 表示 2D ⇄ 3D: 3D starts as 上空 framed by the camera picked
function rpvDisp(to3) {
  const V = window.View3D; if (!V || V.error || to3 === rpv3()) return rpvDispUi();
  if (!to3) { V.setMode('2d'); const s = $('rpvCam'); if (s.value.startsWith('v3:')) { s.value = 'follow'; rpvCamSet('follow'); } }
  else V.setMode('top');
  rpvDispUi();
}
function rpvDispUi() { const d = $('rpvDisp'); if (d) d.value = rpv3() ? '3d' : '2d'; for (const o of $('rpvCam').options) if (o.value.startsWith('v3:')) o.hidden = !rpv3(); }
// d285–286 ↑/↓: the views of the chosen 表示 in the race's order (the fixed 1M / 2M / スタート cameras stay in the list only)
function rpvViewStep(d) {
  const list = ['follow', 'close', 'auto'].concat(rpv3() ? ['v3:chase', 'v3:racer'] : []);
  const s = $('rpvCam'); let i = list.indexOf(s.value); if (i < 0) i = d > 0 ? -1 : 0;
  s.value = list[(i + d + list.length) % list.length]; rpvCamSet(s.value); rpvUi(true);
}
const rpvSeekTo = T => { const P = RPV.P; RPV.t = clamp(T, P.t0, P.t1); rpvApply(); rpvUi(true); };
const rpvFmt = T => T < 0 ? `スタートまで ${(-T).toFixed(1)}秒` : fmtRT(T);
function rpvUi(force) {
  const P = RPV.P; if (!P) return;
  const now = performance.now(); if (!force && now - (rpvUi.t || 0) < 90) return; rpvUi.t = now;
  if (!RPV.seeking) $('rpvSeek').value = Math.round((RPV.t - P.t0) / Math.max(1e-6, P.t1 - P.t0) * 1000);
  $('rpvPlay').textContent = RPV.play ? '一時停止' : '再生';
  $('rpvClock').textContent = rpvFmt(RPV.t) + (RPV.rate !== 1 ? `　${RPV.rate}倍` : '');
  const r = P.rows.find(q => q.no === fleet.focus) || P.rows[0];
  if (r) {
    const p = r.inp, pos = p.pitch > 0.15 ? '伏せ' : p.pitch < -0.15 ? '起こし' : '中間', lean = Math.abs(p.roll) < 0.1 ? '' : p.roll > 0 ? '・右へ' : '・左へ';
    $('rpvBoat').textContent = `${r.no}号艇${r.name ? ' ' + r.name : ''}${r.cls ? '（' + r.cls + '）' : ''}　${(r.b.v * 3.6).toFixed(1)}km/h　レバー ${Math.round(p.thr * 100)}%　舵 ${p.steer > 0 ? '右' : p.steer < 0 ? '左' : ''}${Math.round(Math.abs(p.steer) * 100)}%　姿勢 ${pos}${lean}　${r.laps ? '周回 ' + r.laps : ''}${r.fin != null ? '　ゴール' : r.out ? '　転覆' : r.gone ? '　レース外' : ''}`;
  }
  const od = $('rpvOrder'); od.textContent = '';
  if (P.rows.length > 1) for (const q of fleet.rank) { const s = document.createElement('span'); s.textContent = q.no; s.style.background = q.col[0]; s.style.color = q.col[1]; if (q.gone || q.out) s.style.opacity = '.4'; od.appendChild(s); }
  for (const b of $('rpvBoats').children) b.classList.toggle('on', +b.dataset.no === fleet.focus);
  // the official result once the race is decided
  const res = P.d.results, show = res && P.decided != null && RPV.t >= P.decided;
  $('rpvRes').hidden = !show;
  if (show && !$('rpvRes').dataset.done) {
    $('rpvRes').dataset.done = '1';
    $('rpvRes').textContent = P.solo ? (res.time != null ? `タイム ${fmtRT(res.time)}${res.rank ? '（' + res.rank + '）' : ''}` : '記録なし')
      : (res.order || []).map(o => `${o.place}着 ${o.no}`).join('　') + (res.kimarite ? `　決まり手 ${res.kimarite}` : '');
  }
  if (!show) delete $('rpvRes').dataset.done;
}
function rpvTick(dt) {
  const P = RPV.P;
  rpvPad(dt); if (!RPV.on) return;   // d285: B closed it (rpvApply ran on with no file)
  if (RPV.play && !RPV.seeking) {
    RPV.t += dt * RPV.rate;
    if (RPV.t >= P.t1) { RPV.t = P.t1; RPV.play = false; }
  }
  paused = !RPV.play;   // the engines go quiet while it is stopped
  rpvApply(); rpvUi();
}
function rpvRateStep(d) {
  const i = clamp(RPV_RATES.indexOf(RPV.rate) + d, 0, RPV_RATES.length - 1);
  RPV.rate = RPV_RATES[i < 0 ? 3 : i]; $('rpvRate').value = String(RPV.rate); rpvUi(true);
}
function rpvFocusStep(d) {
  const rows = RPV.P.rows; if (rows.length < 2) return;
  const i = rows.findIndex(r => r.no === fleet.focus); fleet.focus = rows[(i + d + rows.length) % rows.length].no; rpvUi(true);
}
function rpvPad(dt) {
  const g = currentPad(); if (!g) return;
  const down = i => !!(g.buttons[i] && g.buttons[i].pressed), edge = i => down(i) && !RPV.padPrev[i];
  if (edge(0)) RPV.play = !RPV.play;
  if (edge(1)) { RPV.padPrev = []; rpvClose(); return; }
  if (edge(6)) rpvSeekTo(RPV.t - 5); if (edge(7)) rpvSeekTo(RPV.t + 5);   // d285: LT/RT seek (the 十字キー is view / boat now)
  if (edge(4)) rpvRateStep(-1); if (edge(5)) rpvRateStep(1);
  if (edge(12)) rpvViewStep(-1); if (edge(13)) rpvViewStep(1);
  if (edge(14)) rpvFocusStep(-1); if (edge(15)) rpvFocusStep(1);
  if (edge(3)) rpvDisp(!rpv3());   // d286 Y = 表示 2D ⇄ 3D
  RPV.padPrev = g.buttons.map(b => b.pressed);
}
// tick() in main.js hands the frame here while a replay is on
function rpvFrame(dt) { rpvTick(dt); if (!RPV.on) return; updateAudio(); draw(); }

{ // the recorded race is drawn, not driven: no BGM, the fixed cameras look at a place instead of the boats
  const _w = bgmWant; bgmWant = () => RPV.on ? null : _w();
  const _t = camAutoTargets; camAutoTargets = () => RPV.on && RPV.fixed ? RPV.fixed : _t();
}
$('rpvPlay').addEventListener('click', () => { if (RPV.t >= RPV.P.t1) RPV.t = RPV.P.t0; RPV.play = !RPV.play; rpvUi(true); });
$('rpvBack').addEventListener('click', () => rpvSeekTo(RPV.t - 5));
$('rpvFwd').addEventListener('click', () => rpvSeekTo(RPV.t + 5));
$('rpvPrev').addEventListener('click', () => { RPV.play = false; rpvSeekTo(RPV.t - 1 / RPV.P.hz); });
$('rpvNext').addEventListener('click', () => { RPV.play = false; rpvSeekTo(RPV.t + 1 / RPV.P.hz); });
$('rpvRate').addEventListener('change', e => { RPV.rate = +e.target.value || 1; rpvUi(true); });
$('rpvCam').addEventListener('change', e => rpvCamSet(e.target.value));
$('rpvDisp').addEventListener('change', e => rpvDisp(e.target.value === '3d'));
$('rpvSeek').addEventListener('input', e => { RPV.seeking = true; const P = RPV.P; rpvSeekTo(P.t0 + (P.t1 - P.t0) * e.target.value / 1000); });
$('rpvSeek').addEventListener('change', () => { RPV.seeking = false; });
$('rpvClose').addEventListener('click', rpvClose);
addEventListener('keydown', e => {
  if (!RPV.on || e.target.closest && e.target.closest('input[type=text],input[type=number],textarea')) return;
  const k = e.key; let used = true;
  if (k === ' ') RPV.play = !RPV.play;
  else if (k === 'ArrowLeft') rpvSeekTo(RPV.t - (e.shiftKey ? 1 : 5));
  else if (k === 'ArrowRight') rpvSeekTo(RPV.t + (e.shiftKey ? 1 : 5));
  else if (k === ',') { RPV.play = false; rpvSeekTo(RPV.t - 1 / RPV.P.hz); }
  else if (k === '.') { RPV.play = false; rpvSeekTo(RPV.t + 1 / RPV.P.hz); }
  else if (/^[1-6]$/.test(k) && RPV.P.rows.some(r => r.no === +k)) { fleet.focus = +k; rpvUi(true); }
  else if (k === 'c' || k === 'C') { const s = $('rpvCam'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; rpvCamSet(s.value); }
  else if (k === 'ArrowUp') rpvViewStep(-1);
  else if (k === 'ArrowDown') rpvViewStep(1);
  else if (k === 'V' && e.shiftKey) rpvDisp(!rpv3());   // d286 Shift+V = 表示
  else if (k === 'v' || k === 'V') rpvViewStep(1);   // (the race's V key, kept in step with the 視点 list)
  else if (k === 'Escape') rpvClose();
  else used = false;
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); rpvUi(true); }
}, true);

// where a replay comes from: the race just run (result screens) or a saved file
async function rpvFromRecorder(msgEl) {
  try { clearTimeout(resTimer); resTimer = 0; clearInterval(resCountT); resCountT = 0; } catch (e) {}
  initAudio();
  const f = await VR.file(msgEl);
  if (!f) { if (msgEl) { msgEl.textContent = 'このレースのリプレイは用意できませんでした'; msgEl.hidden = false; } return; }
  try { rpvStart(await rpvParse(f.blob)); } catch (e) { if (msgEl) { msgEl.textContent = '再生できませんでした：' + e.message; msgEl.hidden = false; } }
}
if ($('resPlay')) $('resPlay').addEventListener('click', () => rpvFromRecorder($('resVidMsg')));
if ($('taPlay')) $('taPlay').addEventListener('click', () => rpvFromRecorder($('taVidMsg')));
$('rpvOpen').addEventListener('click', () => { initAudio(); $('rpvFile').value = ''; $('rpvFile').click(); });
$('rpvFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  try { rpvStart(await rpvParse(f)); } catch (err) { toast('リプレイ', '再生できませんでした：' + err.message, 'warn'); }
});
