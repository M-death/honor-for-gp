/*⁠​‌​​‌​​​​‌‌​‌‌‌‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌‌​​‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌​​​‌‌‌​‌​‌​​​​​​‌​​​​​‌‌‌​​‌‌​‌​‌‌​​‌‌‌​‌​​​‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌‌‌​‌‌‌​​‌​‌‌​​‌​​​​‌​​‌​​​‌‌‌‌​​​‌‌‌​​​​​​‌‌​​‌​​‌‌‌‌‌​​​‌‌‌​​​​​​‌‌​​​​‌‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌​‌‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​​‌​‌​​​​‌‌​​​‌‌​​‌​‌​​‌​​‌​​​​​​​‌‌​​‌​​​‌‌​​​​​​‌‌​​‌​​​‌‌​‌‌​​​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌​‌​‌​‌​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​​​​‌‌‌‌‌‌​​​‌‌‌​​​​​‌​‌​‌‌‌​​‌​​‌​​​​​​​‌​‌​​​​‌​​‌‌​‌​​‌​‌‌​‌​‌​​​‌​​​‌‌​​‌​‌​‌‌​​​​‌​‌‌‌​‌​​​‌‌​‌​​​​​‌​‌​​‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌‌​‌‌‌‌​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​‌​‌‌​‌‌‌​​‌‌​​​​‌​‌‌​‌‌​​​​‌​​​​​​‌‌​​​‌‌​‌‌​‌‌‌‌​‌‌​​‌​​​‌‌​​‌​‌​​‌​‌‌​​​​‌​​​​​​‌‌​​​​‌​‌‌​‌‌​​​‌‌​‌‌​​​​‌​​​​​​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​​​‌‌‌​‌​​​‌‌‌​​‌‌​​‌​​​​​​‌‌‌​​‌​​‌‌​​‌​‌​‌‌‌​​‌‌​‌‌​​‌​‌​‌‌‌​​‌​​‌‌‌​‌‌​​‌‌​​‌​‌​‌‌​​‌​​​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌​​‌​​​​‌​​​‌‌​​‌​​​‌‌‌​‌​‌​​​​​​‌​‌‌​‌​‌​‌​​‌‌​‌​​‌​​‌​‌​​​‌‌‌​​‌​‌‌​‌​​‌‌​​​‌⁠ d355 足合わせ (まえ: チュートリアルの最終レッスン、羽美との2艇合わせ足): two laps side by side with 羽美 (a real boat,
   contact on). Lap 1 the player runs inside, lap 2 outside; on the stand-side straight after lap 1's 2M both boats are
   driven to swap places and control comes back at the slit. Points only while close: a combo builds while the two
   stay near (closer = faster), shown climbing in the score; it is banked when the combo ends, lost on contact.
   羽美 runs a normal clean line (no tilt 3.0): about 70 km/h on the straights, turns around 8 割 of race pace, and she
   eases / pushes a little to stay level. The player's motor here tops out a little above her (≈73 km/h). */
const ASHI = { on: false, phase: '', U: null, uin: { thr: 0, steer: 0, roll: 0, pitch: 0 }, mB: null, mU: null,
  score: 0, pot: 0, comboT: 0, tick: 0, gap0: 0, out: 0, best: 0, shown: 0, hot: false, contactT: 0, capT: 0, swapSt: 0, uOff: 22, bOff: 16 };
const ASHI_K = { rU1: 26, rB1: 20, rU2: 20, rB2: 25, vTurn0: 0, vTurnK: 0.8, off: 5, vMax: 70 / 3.6, vPush: 73 / 3.6, turnK: 0.8, nobi: 0.92, lv: [2, 4, 6, 9], pts: [500, 300, 200, 100], turnX: 2, zoneA: [0.30, 0.20, 0.13, 0.07], every: 0.5, multEvery: 5, multMax: 5, grace: 0.6, commit: 3,
  key: 'honorGP.ashi.v3.best', ranks: [['SS', 1.1], ['S', 0.8], ['A', 0.55], ['B', 0.3], ['C', 0]], perfect: 180000 };
try { ASHI.best = +(localStorage.getItem(ASHI_K.key) || 0); } catch (e) {}
const UMI_REAL = { hull: '#20844f', num: '#ffffff', label: '6', helmet: '#20844f' };

// d356 (まえ: ラインは中央線からある程度離れた綺麗な直線とターン、ターンの後は直進、内を走れるスペースを十分に):
// a stadium — straights parallel to the centreline at |y| = R, half circles of radius R round each mark, straight on after.
// Progress S is measured on the R = ASHI_K.rRef loop from the slit (x = 0, stand side), so boats on different R compare by S.
const ASHI_L = 4 * MK + 2 * Math.PI * 18;
function ashiSeg(S) {   // → [kind, value] for progress S within a lap
  const R = 18, L = ASHI_L, s = ((S % L) + L) % L, t1 = MK, t2 = t1 + Math.PI * R, t3 = t2 + 2 * MK, t4 = t3 + Math.PI * R;
  if (s < t1) return ['stand', s];
  if (s < t2) return ['m1', (s - t1) / R];
  if (s < t3) return ['back', MK - (s - t2)];
  if (s < t4) return ['m2', (s - t3) / R];
  return ['stand', -MK + (s - t4)];
}
function ashiLine(S, R) {
  const [k, v] = ashiSeg(S);
  if (k === 'stand') return { x: v, y: R, a: 0 };
  if (k === 'back') return { x: v, y: -R, a: Math.PI };
  if (k === 'm1') return { x: MK + R * Math.sin(v), y: R * Math.cos(v), a: -v };
  return { x: -MK - R * Math.sin(v), y: -R * Math.cos(v), a: Math.PI - v };
}
// is S in (or within `pre` m before) a turn?
function ashiInTurn(S, pre) { const k = ashiSeg(S + pre)[0], k0 = ashiSeg(S)[0]; return k === 'm1' || k === 'm2' || k0 === 'm1' || k0 === 'm2'; }
function ashiProgress(b) {
  const R = 18, ax = Math.abs(b.x);
  if (ax <= MK) return b.y >= 0 ? (b.x >= 0 ? b.x : ASHI_L + b.x) : MK + Math.PI * R + (MK - b.x);
  if (b.x > 0) return MK + R * clamp(Math.atan2(b.x - MK, b.y), 0, Math.PI);
  return 3 * MK + Math.PI * R + R * clamp(Math.atan2(-(b.x + MK), -b.y), 0, Math.PI);
}
function ashiMatch(m, b) {
  const s = ashiProgress(b), prev = ((m.S % ASHI_L) + ASHI_L) % ASHI_L;
  if (s < prev - ASHI_L / 2) m.lap++; else if (s > prev + ASHI_L / 2) m.lap--;
  m.S = m.lap * ASHI_L + (s >= ASHI_L ? s - ASHI_L : s);
}
function ashiMatcher(S) { return { lap: Math.floor(S / ASHI_L), S }; }
// the stand-side straight after 2M: where the swap starts
const ASHI_SWAP = ASHI_L - MK + 20;

// drive a boat along a line: pure pursuit for the rudder, lean with it, flat on the straights; thr holds speed vt
function ashiDrive(b, inp, m, off, vt, dt) {
  const look = Math.max(6, b.v * 0.7), t = ashiLine(m.S + look, off);
  let e = Math.atan2(t.y - b.y, t.x - b.x) - b.a; e = Math.atan2(Math.sin(e), Math.cos(e));
  const k = 1 - Math.exp(-dt * 9), st = clamp(2.6 * e, -1, 1);
  inp.steer += (st - inp.steer) * k;
  inp.roll += (clamp(inp.steer * 1.3, -1, 1) - inp.roll) * k;
  inp.pitch += ((Math.abs(inp.steer) < 0.25 ? 1 : 0) - inp.pitch) * k;
  inp.thr += (clamp(0.75 + 0.5 * (vt - b.v), 0, 1) - inp.thr) * (1 - Math.exp(-dt * 6));
}
// 羽美's own pace: 70 km/h on the straights, 8 割 of the race line in turns; she eases / pushes to keep level with the player
function ashiUmiV(gap) {
  const base = ashiInTurn(ASHI.mU.S, 25) ? ASHI_K.vTurn0 + ASHI_K.vTurnK * ASHI.uOff : ASHI_K.vMax;
  return clamp(base + clamp(0.4 * gap, -5, 1.6), 6, ASHI_K.vPush);
}

// ---- HUD ----
function ashiUi() {
  if ($('ashiHud')) return;
  const css = document.createElement('style');
  css.textContent = `#ashiHud{position:fixed;left:50%;top:calc(98px + var(--st,0px));transform:translateX(-50%);z-index:4;pointer-events:none;text-align:center;color:#fff;text-shadow:0 1px 3px #000a}
@media (max-width:1000px){#ashiHud{top:calc(140px + var(--st,0px))}}
#ashiHud .lbl{font-size:12px;font-weight:700;opacity:.85}#ashiHud .sc{font:800 30px/1.1 var(--num-font,system-ui);transition:transform .12s,color .12s;display:inline-block}
#ashiHud.hot .sc{color:#ffd23f;transform:scale(1.35);text-shadow:0 0 12px #ffb30088,0 1px 3px #000}#ashiHud .cb{font-size:13px;font-weight:800;color:#ffd23f;min-height:18px}
#ashiHud.lost .sc{color:#ff6b6b;animation:ashiShake .35s}@keyframes ashiShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#ashiHud .sc .n{display:inline-block}#ashiHud .pops{position:relative;height:0}
#ashiHud .pop{position:absolute;left:50%;top:-34px;font:800 16px/1 var(--num-font,system-ui);color:#ffe27a;white-space:nowrap;text-shadow:0 0 8px #ff9d00,0 1px 2px #000;pointer-events:none}
#ashiHud .pop.t2{color:#8ff3ff;text-shadow:0 0 10px #00c8ff,0 1px 2px #000}#ashiHud .lvup{position:absolute;left:50%;top:-6px;transform:translateX(-50%);font:900 22px/1 var(--num-font,system-ui);color:#fff;white-space:nowrap;text-shadow:0 0 14px #ff3d7f,0 0 4px #000}
#ashiHud[data-lv="2"].hot .cb{margin-top:4px}#ashiHud[data-lv="3"].hot .cb{margin-top:8px}#ashiHud[data-lv="4"].hot .cb{margin-top:12px}#ashiHud[data-lv="5"].hot .cb{margin-top:16px}
#ashiHud[data-lv="2"].hot .sc{transform:scale(1.5);color:#ffc23a;text-shadow:0 0 16px #ff9d00aa,0 1px 3px #000}
#ashiHud[data-lv="3"].hot .sc{transform:scale(1.65);color:#ff9e2c;animation:ashiGlow .7s ease-in-out infinite}
#ashiHud[data-lv="4"].hot .sc{transform:scale(1.8);animation:ashiGlow .45s ease-in-out infinite,ashiHot 1.1s linear infinite}
#ashiHud[data-lv="5"].hot .sc{transform:scale(2);animation:ashiGlow .3s ease-in-out infinite,ashiRainbow .8s linear infinite,ashiJit .12s steps(2) infinite}
@keyframes ashiGlow{50%{text-shadow:0 0 26px #ff7b00,0 0 8px #fff3,0 1px 3px #000}}
@keyframes ashiHot{0%{color:#ffd23f}33%{color:#ff7a2c}66%{color:#ff3d7f}100%{color:#ffd23f}}
@keyframes ashiRainbow{0%{color:#ff4d4d}20%{color:#ffb84d}40%{color:#fff04d}60%{color:#5dff7a}80%{color:#5dc8ff}100%{color:#ff4dff}}
@keyframes ashiJit{0%{translate:-1px 1px}100%{translate:1px -1px}}`;
  document.head.appendChild(css);
  const h = document.createElement('div'); h.id = 'ashiHud'; h.hidden = true;
  h.innerHTML = '<div class="lbl" id="ashiLbl"></div><div class="pops" id="ashiPops"></div><div class="sc" id="ashiSc"><span class="n" id="ashiN">0</span></div><div class="cb" id="ashiCb"></div>';
  document.body.appendChild(h);
}
const ashiFmt = v => Math.round(v).toLocaleString('ja-JP');
function ashiHudStep(dt) {
  const h = $('ashiHud'); if (!h) return;
  const target = ASHI.score + ASHI.pot;
  if (ASHI.shown < target) ASHI.shown = Math.min(target, ASHI.shown + Math.max(100, (target - ASHI.shown) * 6 * dt) );
  else ASHI.shown = target;
  ASHI.shown = Math.round(ASHI.shown / 100) * 100;
  $('ashiN').textContent = ashiFmt(ASHI.shown);
  h.classList.toggle('hot', ASHI.comboT > 0); h.dataset.lv = ASHI.comboT > 0 ? String(Math.min(ASHI_K.multMax, 1 + Math.floor(ASHI.comboT / ASHI_K.multEvery))) : '0';
  const mult = Math.min(ASHI_K.multMax, 1 + Math.floor(ASHI.comboT / ASHI_K.multEvery));
  $('ashiCb').textContent = ASHI.comboT > 0 ? `コンボ ${ASHI.comboT.toFixed(0)}秒 ×${mult}${ASHI.turnOn ? '　ターン×2' : ''}${ASHI.pot ? '　+' + ashiFmt(ASHI.pot) : ''}` : '';
  if (ASHI.phase === 'show' || (ASHI.phase === 'end' && ASHI.fin)) { $('ashiLbl').textContent = '足合わせ　確定'; $('ashiCb').textContent = ASHI.fin ? `ランク ${ASHI.fin.r}` : ''; h.classList.remove('hot'); h.dataset.lv = '0'; return; }
  const lapTxt = ASHI.phase === 'lead' ? 'スリットからスタート' : ASHI.phase === 'swap' ? '入れ替え中…スリットから2周目' : ASHI.phase === 'run' ? (ASHI.mB.lap < 1 ? '1周目・内側' : '2周目・外側') : '';
  $('ashiLbl').textContent = '足合わせ　' + lapTxt;
}

// ---- flow ----
function ashiBegin() {
  ashiUi();
  ASHI.on = true; ASHI.phase = 'lead'; ASHI.fin = null; ASHI.kirai = false; Object.assign(ASHI, { score: 0, pot: 0, comboT: 0, tick: 0, out: 0, shown: 0, contactT: 0, capT: 0, swapSt: 0, uOff: ASHI_K.rU1, bOff: ASHI_K.rB1 });
  soloKind = 'tut'; resetBoat(); SS.phase = 'off'; $('clock').hidden = true; practiceSlit = null; meas.on = false;
  B.nobi = ASHI_K.nobi;
  const S0 = -75, pb = ashiLine(S0, ASHI_K.rB1), pu = ashiLine(S0, ASHI_K.rU1);
  Object.assign(B, { x: pb.x, y: pb.y, a: pb.a, v: 15, cap: 0 });
  ASHI.U = Object.assign({}, B, { x: pu.x, y: pu.y, a: pu.a, v: 15, cap: 0, vl: 0, yaw: 0, porp: 0 });
  Object.assign(ASHI.uin, { thr: 0.8, steer: 0, roll: 0, pitch: 1 });
  ASHI.mB = ashiMatcher(S0); ASHI.mU = ashiMatcher(S0); ASHI.hand = { thr: 0.8, steer: 0, roll: 0, pitch: 1 };
  cam.x = B.x; cam.y = B.y; lap.prevY = B.y;
  $('ashiHud').hidden = false; tutBar('スリットまでは、わたしが合わせるね。');
}
function ashiEnd() { ASHI.on = false; ASHI.phase = ''; ASHI.U = null; if ($('ashiHud')) $('ashiHud').hidden = true; }
function ashiRank(s) { for (const [r, f] of ASHI_K.ranks) if (s >= ASHI_K.perfect * f) return r; return 'C'; }
// d363 (まえ): after lap 2 the score is fixed, then 羽美 says 「私の全速を見せてあげる、ついてきて」 and runs her real race
// set-up — tilt 3.0, a ◎ motor — round 1M, down the back straight and round 2M; the player drives free with the usual
// TA motor (top ≈80 km/h): follow her, or get passed. Blocking her on purpose (sitting in her path while she closes, or
// hitting her) → 「いじわる、きらい」. The result card comes after her 2M.
const ASHI_SHOW = { w: 9, look: 1.7, nobi: 1.07, deashi: 1.05, mMid: 1.05, endS: 3 * ASHI_L - MK + 20, maxT: 45, path: 2.6, ahead: 16, dodge: 7, blockK: 2.2 };
// d364 (まえ: 羽美はガチのライン、もっと内側を、レース中と同じ感じで): the show lap follows her real TA line (TUT_PATH,
// not the eased tutorial copy): 2–3 m off the marks, her own lean/trim from that run, flat out
// w: the line near each mark pushed out by w m (tapering to nothing 40 m away) — her motor carries more speed than the TA one
function ashiMakeRaw(w) { const n = TUT_PATH.length / 8, p = []; let s = 0;
  for (let i = 0; i < n; i++) { const j = i * 8; let x = TUT_PATH[j], y = TUT_PATH[j + 1]; const mx = Math.sign(x) * MK, d = Math.hypot(x - mx, y);
    if (d < 40 && d > 0.01) { const f = (d + w * (1 - d / 40)) / d; x = mx + (x - mx) * f; y *= f; }
    if (i) s += Math.hypot(x - p[i - 1].x, y - p[i - 1].y);
    p.push({ x, y, roll: TUT_PATH[j + 6], pitch: TUT_PATH[j + 7], s }); }
  return { p, n, L: s + Math.hypot(p[0].x - p[n - 1].x, p[0].y - p[n - 1].y) }; }
let ASHI_RAW = null;
function ashiRawAt(S) {
  const { p, n, L } = ASHI_RAW; const s = ((S % L) + L) % L; let lo = 0, hi = n - 1;
  if (s >= p[n - 1].s) { const a = p[n - 1], b = p[0], f = (s - a.s) / (L - a.s); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, roll: a.roll, pitch: a.pitch }; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s <= s) lo = m; else hi = m; }
  const a = p[lo], b = p[hi], f = (s - a.s) / ((b.s - a.s) || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, roll: a.roll + (b.roll - a.roll) * f, pitch: a.pitch + (b.pitch - a.pitch) * f };
}
// her progress along the raw line: the nearest point a little ahead of the last
function ashiRawTrack(b, S0) {
  let best = S0, bd = 1e9; for (let d = -4; d <= 30; d += 0.5) { const q = ashiRawAt(S0 + d), e = (q.x - b.x) ** 2 + (q.y - b.y) ** 2; if (e < bd) { bd = e; best = S0 + d; } }
  return best;
}
function ashiRawStart(b) { let best = 0, bd = 1e9; for (let s = 0; s < ASHI_RAW.L; s += 1) { const q = ashiRawAt(s), e = (q.x - b.x) ** 2 + (q.y - b.y) ** 2 + (Math.cos(b.a) * (q.x - b.x) + Math.sin(b.a) * (q.y - b.y) < 0 ? 1e6 : 0); if (e < bd) { bd = e; best = s; } } return best; }
function ashiShowDrive(U, inp, dt) {
  ASHI.rs = ashiRawTrack(U, ASHI.rs);
  const look = Math.max(6, U.v * ASHI_SHOW.look), t = ashiRawAt(ASHI.rs + look), h = ashiRawAt(ASHI.rs + 3);
  // dodging: the aim moves outside (to her left: the loops run clockwise) by ASHI.dodge
  const ta = Math.atan2(t.y - U.y, t.x - U.x), ox = -Math.sin(ta) * ASHI.dodge, oy = Math.cos(ta) * ASHI.dodge;
  let e = Math.atan2(t.y + oy - U.y, t.x + ox - U.x) - U.a; e = Math.atan2(Math.sin(e), Math.cos(e));
  const k = 1 - Math.exp(-dt * 9), st = clamp(2.6 * e, -1, 1);
  inp.steer += (st - inp.steer) * k;
  inp.roll += (clamp(Math.min(h.roll, inp.steer * 1.3), -1, 1) - inp.roll) * k;
  inp.pitch += (h.pitch - inp.pitch) * k;
  inp.thr += ((ASHI.lift ? clamp(0.75 + 0.5 * (B.v - 1 - U.v), 0, 1) : 1) - inp.thr) * (1 - Math.exp(-dt * 6));
}
function ashiFix() {
  ashiBank(); const s = ASHI.score, r = ashiRank(s), nb = s > ASHI.best;
  if (nb) { ASHI.best = s; try { localStorage.setItem(ASHI_K.key, String(s)); } catch (e) {} }
  ashiRankAdd(s, r);
  ASHI.fin = { s, r, nb };
}
function ashiShowBegin() {
  ashiFix(); ASHI.phase = 'show'; ASHI_RAW = ashiMakeRaw(ASHI_SHOW.w); ASHI.rs = ashiRawStart(ASHI.U); ASHI.showT = 0; ASHI.blockT = 0; ASHI.kirai = false; ASHI.dodge = 0;
  B.nobi = SOLO_MOTOR.nobi; B.deashi = SOLO_MOTOR.deashi; B.mMid = SOLO_MOTOR.mMid; B.mawari = SOLO_MOTOR.mawari;   // the player's full motor back (≈80 km/h)
  Object.assign(ASHI.U, { tilt: 3, tiltTurn: 1, tiltFit: null, nobi: ASHI_SHOW.nobi, deashi: ASHI_SHOW.deashi, mMid: ASHI_SHOW.mMid, mawari: ASHI_SHOW.mMid });
  tutBar('私の全速を見せてあげる、ついてきて');
}
function ashiKirai(why) {
  if (ASHI.kirai) return; ASHI.kirai = true; ASHI.kiraiWhy = why; tutBar('いじわる、きらい');
}
function ashiFinish() {
  ASHI.phase = 'end'; if (!ASHI.fin) ashiFix();
  const { s, r, nb } = ASHI.fin;
  const say = ASHI.kirai ? '…じゃましたでしょ。いじわる。きらい。' : { SS: '…すごすぎ。わたしより、上手かも。', S: 'すごい…ずっと、となりにいた。', A: 'うん、いい感じ。…レースでも、こうやって並ぶの。', B: 'もうちょっと、寄ってきていいよ。', C: '…遠かったね。もう一回、走ろ。' }[r];
  tutTalk('足合わせ　結果', [`${ashiFmt(s)} 点　ランク ${r}${nb ? '　自己ベスト！' : `　（ベスト ${ashiFmt(ASHI.best)}）`}`, say], '',
    [['次へ', () => { ashiEnd(); tutStep(TUT.step + 1); }, true], ['もう一回', () => { tutGo(); ashiBegin(); }]]);
  // d362 (まえ): a personal best can go to the 全体ランキング straight from the result card
  if (nb && s > 0) {
    const row = $('tutBtns'), b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = '全体ランキングに送る';
    b.addEventListener('click', async () => { b.disabled = true; b.textContent = '送信中…'; const m = await ashiSend(); b.textContent = m; });
    row.appendChild(b);
  }
}
// the player's boat driven during the lead-in and the swap
function ashiAutoB(dt, vt) {
  const H = ASHI.hand;
  ashiDrive(B, H, ASHI.mB, ASHI.bOff, vt, dt);
  input.thr = H.thr; input.steer = H.steer; input.roll = H.roll; input.pitch = H.pitch;
}
// per frame after the player's input is read
function ashiInput(dt) {
  if (!ASHI.on || paused || !ASHI.U) return;
  ashiMatch(ASHI.mB, B); ashiMatch(ASHI.mU, ASHI.U);
  const gap = ASHI.mB.S - ASHI.mU.S;
  if (ASHI.phase === 'lead') ashiAutoB(dt, ASHI.U.v + 0.5 * (0 - gap));
  else if (ASHI.phase === 'swap') {
    // drop back about two boat lengths, step outside, then come level again by the slit
    const st = ASHI.swapSt;
    if (st === 0 && gap < -7) ASHI.swapSt = 1;
    if (ASHI.swapSt >= 1) ASHI.bOff = Math.min(ASHI_K.rB2, ASHI.bOff + dt * 4);
    if (ASHI.swapSt === 1 && ASHI.bOff >= ASHI_K.rB2 - 0.5) ASHI.swapSt = 2;
    ASHI.want = ASHI.swapSt === 0 ? -9 : ASHI.swapSt === 1 ? -8 : 0;
    ashiAutoB(dt, ASHI.U.v + 0.8 * (ASHI.want - gap));
  }   // 'run': the player drives
}
// per physics step: 羽美's boat, contact, score, phases
function ashiStep(dt) {
  if (!ASHI.on || !ASHI.U || ASHI.phase === 'end') return;
  const U = ASHI.U, gap = ASHI.mB.S - ASHI.mU.S;
  // her line: outside on lap 1 and in the lead-in, inside once the swap has moved the player out
  if (ASHI.phase === 'swap' && ASHI.swapSt >= 1 && ASHI.bOff > ASHI_K.rB1 + 3.5) ASHI.uOff = Math.max(ASHI_K.rU2, ASHI.uOff - dt * 3);
  if (ASHI.phase === 'show') ashiShowDrive(U, ASHI.uin, dt);
  else ashiDrive(U, ASHI.uin, ASHI.mU, ASHI.uOff, ASHI.phase === 'swap' ? clamp(Math.max(B.v, ashiUmiV(0) - 3) + 0.6 * (gap - (ASHI.want || 0)), 6, ASHI_K.vMax) : ashiUmiV(gap), dt);
  boatPhysics(U, ASHI.uin, dt);
  if (U.cap <= 0) boatFx(U, wake, dt);
  if (U.cap > 0 && U.cap < 0.05) { const p = ashiLine(ASHI.mU.S, ASHI.uOff); Object.assign(U, { x: p.x, y: p.y, a: p.a, v: 12, cap: 0 }); }
  ASHI.bInto = ashiInto(B, U); ASHI.uInto = ashiInto(U, B);   // d363: who pressed into whom, before the contact resolves
  const evs = (B.cap > 0 || U.cap > 0) ? [] : boatContacts([B, U]);
  ASHI.contactT = Math.max(0, ASHI.contactT - dt);
  // phases by the player's progress (S = 0 is the slit)
  const S = ASHI.mB.S;
  if (ASHI.phase === 'lead' && S >= 0) { ASHI.phase = 'run'; tutBar('スタート！　…となり、離れないでね。'); }
  else if (ASHI.phase === 'run' && ASHI.mB.lap === 0 && S >= ASHI_SWAP) { ashiBank(); ASHI.phase = 'swap'; ASHI.swapSt = 0; ASHI.want = -9; ASHI.hand = { thr: input.thr, steer: input.steer, roll: input.roll, pitch: input.pitch }; tutBar('入れ替えるね。スリットから、今度は外側。'); }
  else if (ASHI.phase === 'swap' && S >= ASHI_L) { ASHI.phase = 'run'; ASHI.bOff = ASHI_K.rB2; ASHI.uOff = ASHI_K.rU2; ASHI.hand = null; tutBar('2周目！　外から、ついてきて。'); }
  else if (ASHI.phase === 'run' && S >= 2 * ASHI_L) { ashiShowBegin(); return; }
  if (ASHI.phase === 'show') { ashiShowStep(dt, evs); return; }
  if (ASHI.phase !== 'run') return;
  // the player capsized: the combo is gone, back alongside her
  if (B.cap > 0) { if (ASHI.comboT) ashiLose('…だいじょうぶ？'); ASHI.capT += dt;
    if (ASHI.capT > 2.2) { ASHI.capT = 0; const off = ASHI.mB.lap < 1 ? ASHI_K.rB1 : ASHI_K.rB2, p = ashiLine(ASHI.mU.S - 10, off); Object.assign(B, { x: p.x, y: p.y, a: p.a, v: 12, cap: 0, vl: 0, yaw: 0 }); ASHI.mB = ashiMatcher(ASHI.mU.S - 10); }
    return; }
  if (evs.length && !ASHI.contactT) { ASHI.contactT = 1; ashiLose('ちょっと〜！'); sfxHit && sfxHit(B.x, B.y, 4); hapticShot && hapticShot(0.2, 0.8); return; }
  // d358 (まえ): a 2 m ring inside the old ones = the high score; ×2 while the player is in a turn
  // d361 (まえ): only her near side counts — running inside (lap 1) her outside half scores nothing, running outside (lap 2) her inside half
  const cx = U.x + Math.cos(U.a) * 0.66, cy = U.y + Math.sin(U.a) * 0.66, bx = B.x + Math.cos(B.a) * 0.66, by = B.y + Math.sin(B.a) * 0.66;
  const inSide = (bx - cx) * Math.sin(U.a) - (by - cy) * Math.cos(U.a) > 0, okSide = inSide === ashiValidIn();
  const d = Math.hypot(U.x - B.x, U.y - B.y), zi0 = ASHI_K.lv.findIndex(r => d < r), zi = okSide ? zi0 : -1, lv = zi < 0 ? 0 : ASHI_K.pts[zi];
  ASHI.wrongSide = !okSide && zi0 >= 0;
  const kseg = ashiSeg(ASHI.mB.S)[0]; ASHI.turnOn = kseg === 'm1' || kseg === 'm2'; ASHI.zone = zi;
  if (lv) {
    ASHI.out = 0; ASHI.comboT += dt; ASHI.tick += dt;
    if (ASHI.tick >= ASHI_K.every) { ASHI.tick -= ASHI_K.every; const mult = Math.min(ASHI_K.multMax, 1 + Math.floor(ASHI.comboT / ASHI_K.multEvery)), add = lv * (ASHI.turnOn ? ASHI_K.turnX : 1) * mult; ASHI.pot += add; ashiPop(add, mult, ASHI.turnOn); ashiBeat(mult, false); }
    // d360 (まえ: コンボは継続しながら3秒ごとに加点): every 3 s of an unbroken combo its points go into the score
    ASHI.commitT = (ASHI.commitT || 0) + dt; if (ASHI.commitT >= ASHI_K.commit) { ASHI.commitT = 0; ashiCommit(); }
  } else if (ASHI.pot || ASHI.comboT) { ASHI.out += dt; if (ASHI.out > ASHI_K.grace) ashiBank(); }
}
// d363 the show run: she drives flat out; a player in her path ahead makes her swing wide, then lift; staying there = blocking
function ashiInto(a, c) {   // a's sideways speed toward c, across the two boats' mean heading (a rear-end by c isn't a's doing)
  const mx = Math.cos(a.a) + Math.cos(c.a), my = Math.sin(a.a) + Math.sin(c.a), ml = Math.hypot(mx, my) || 1;
  let nx = -my / ml, ny = mx / ml; if ((c.x - a.x) * nx + (c.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
  const fx = Math.cos(a.a), fy = Math.sin(a.a); return Math.max(0, (fx * a.v - fy * (a.vl || 0)) * nx + (fy * a.v + fx * (a.vl || 0)) * ny); }
function ashiShowStep(dt, evs) {
  const U = ASHI.U, K = ASHI_SHOW; ASHI.showT += dt;
  const fx = Math.cos(U.a), fy = Math.sin(U.a), dx = B.x - U.x, dy = B.y - U.y, fw = dx * fx + dy * fy, lat = -dx * fy + dy * fx;
  // her path = the line she is on a little ahead (the dodge widens it, away from the centreline)
  // her raw line level with the player, and that line moved out by her dodge (outside = her left: the loops run clockwise)
  const r0 = ashiRawAt(ASHI.rs + Math.max(2, fw)), r1 = ashiRawAt(ASHI.rs + Math.max(2, fw) + 1), ta = Math.atan2(r1.y - r0.y, r1.x - r0.x);
  const rawD = Math.hypot(B.x - r0.x, B.y - r0.y), dodD = Math.hypot(B.x - (r0.x - Math.sin(ta) * ASHI.dodge), B.y - (r0.y + Math.cos(ta) * ASHI.dodge));
  const near = B.cap <= 0 && fw > -4 && fw < K.ahead && U.v > B.v - 1;
  ASHI.dodge = near && rawD < K.path + 1.5 ? Math.min(K.dodge, ASHI.dodge + dt * 5) : near && ASHI.dodge > 0 && fw > -4 ? ASHI.dodge : Math.max(0, ASHI.dodge - dt * 1.5);
  ASHI.lift = B.cap <= 0 && fw > 2 && fw < 9 && dodD < K.path && U.v > B.v + 0.5;   // still in her way on the line she swung out to: she has to ease
  if (ASHI.lift) ASHI.blockT += dt; else ASHI.blockT = Math.max(0, ASHI.blockT - dt * 0.25);
  if (ASHI.blockT > K.blockK) ashiKirai('block');
  if (evs.length && !ASHI.contactT) { ASHI.contactT = 1; sfxHit && sfxHit(B.x, B.y, 4); hapticShot && hapticShot(0.2, 0.8);
    if (ASHI.bInto > 2 * ASHI.uInto + 1 || ASHI.blockT > 0.4) ashiKirai(`hit ${ASHI.bInto.toFixed(1)}/${ASHI.uInto.toFixed(1)}`); }
  if (B.cap > 0) { ASHI.capT += dt; if (ASHI.capT > 2.2) { ASHI.capT = 0; const p = ashiLine(ASHI.mU.S - 15, ASHI_K.rB2); Object.assign(B, { x: p.x, y: p.y, a: p.a, v: 12, cap: 0, vl: 0, yaw: 0 }); ASHI.mB = ashiMatcher(ASHI.mU.S - 15); } }
  if (ASHI.mU.S >= K.endS || ASHI.showT > K.maxT) ashiFinish();
}
// d359 (まえ: 連続コンボ加算中は数字の動きをだんだん派手に): each tick a +N rises from the score and the number kicks,
// both bigger with the combo level; level ups flash ×N; the score itself grows, glows, burns and goes rainbow (CSS data-lv)
function ashiPop(add, mult, turn) {
  const box = $('ashiPops'), n = $('ashiN'); if (!box || !n || !n.animate) return;
  const k = 1 + 0.25 * (mult - 1);
  const e = document.createElement('div'); e.className = 'pop' + (turn ? ' t2' : ''); e.textContent = '+' + ashiFmt(add);
  e.style.fontSize = (14 + 4 * mult) + 'px'; box.appendChild(e);
  const dx = (Math.random() - 0.5) * 40 * k;
  e.animate([{ transform: `translate(-50%,0) scale(${0.6 * k})`, opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),${-28 - 10 * mult}px) scale(${k})`, opacity: 0 }], { duration: 700 + 80 * mult, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => e.remove();
  n.animate([{ scale: 1 + 0.12 * k, rotate: (mult >= 4 ? (Math.random() < .5 ? -1 : 1) * 3 * (mult - 3) : 0) + 'deg' }, { scale: 1, rotate: '0deg' }], { duration: 220, easing: 'ease-out' });
  if (mult > (ASHI.lastMult || 1)) { const u = document.createElement('div'); u.className = 'lvup'; u.textContent = ['', '', 'コンボ×2！', 'コンボ×3！！', 'コンボ×4！！！', 'MAX ×5！！！！'][mult] || ''; box.appendChild(u);
    u.animate([{ transform: 'translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.3)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,-44px) scale(1)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => u.remove(); }
  ASHI.lastMult = mult;
}
// d361 (まえ: コンボ加算の時はドン、ドン、ドンとビートを刻んで): a kick drum on every 0.5 s tick, layers added as the
// combo level rises (×3 a clap, ×5 a high tom); the 3-second commit is a bigger, longer ドーン with a crash
function ashiBeat(mult, big) {
  if (typeof snd === 'undefined' || !snd.ctx || !snd.on) return;
  const c = snd.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), v = (big ? 1 : 0.7) * (0.75 + 0.06 * mult);
  o.type = 'sine'; o.frequency.setValueAtTime(big ? 130 : 150 + 8 * mult, t); o.frequency.exponentialRampToValueAtTime(big ? 38 : 46, t + (big ? 0.4 : 0.16));
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.6 : 0.24));
  o.connect(g); g.connect(snd.master); o.start(t); o.stop(t + 0.7);
  oneShot(0.03, 3500, 2000, 0.25 * v, 'highpass', 0.7);   // the beater click
  if (mult >= 3 && !big) oneShot(0.12, 1600, 1200, 0.22 + 0.05 * (mult - 3), 'bandpass', 1.2);
  if (mult >= 5 && !big) pip(330, 0.12, 0.12);
  if (big) oneShot(0.9, 7000, 3000, 0.25, 'highpass', 0.5);
}
function ashiCommit() {
  if (!ASHI.pot) return; ashiBeat(Math.min(ASHI_K.multMax, 1 + Math.floor(ASHI.comboT / ASHI_K.multEvery)), true); const add = ASHI.pot; ASHI.score += add; ASHI.pot = 0;
  const box = $('ashiPops'); if (box && box.animate) { const e = document.createElement('div'); e.className = 'lvup'; e.style.color = '#ffe27a'; e.textContent = '+' + ashiFmt(add);
    box.appendChild(e); e.animate([{ transform: 'translate(-50%,10px) scale(1.4)', opacity: 1 }, { transform: 'translate(-50%,40px) scale(.6)', opacity: 0 }], { duration: 600, easing: 'ease-in' }).onfinish = () => e.remove(); }
}
function ashiBank() { ASHI.lastMult = 1; ASHI.commitT = 0; ASHI.score += ASHI.pot; ASHI.pot = 0; ASHI.comboT = 0; ASHI.tick = 0; ASHI.out = 0; }
// d360 (まえ: ぶつかったら0は厳しい、わざとコンボを切る): a contact / capsize only breaks the combo — the points stay
function ashiLose(say) {
  const had = ASHI.comboT > 0; ashiBank();
  const h = $('ashiHud'); if (h && had) { h.classList.remove('lost'); void h.offsetWidth; h.classList.add('lost'); setTimeout(() => h.classList.remove('lost'), 400); }
  const keep = TUT.said; tutBar(say + (had ? '　（コンボが切れた）' : '')); setTimeout(() => { if (ASHI.on && ASHI.phase === 'run') tutBar(keep); }, 1800);
}
// 2D: draw her boat; 3D: a row like a race boat (play3d rowsNow)
// the scoring rings round her (d358): faint, darker the higher the rate; the ring the player is in glows a little more
const ashiValidIn = () => !(ASHI.phase === 'swap' || (ASHI.mB && ASHI.mB.lap >= 1));   // the player's scoring side: her inside on lap 1
function ashiDraw() {
  if (!ASHI.on || !ASHI.U) return;
  if (ASHI.phase === 'show' || ASHI.phase === 'end') { drawBoatAt(ASHI.U, ASHI.uin, UMI_REAL, false); return; }
  const U = ASHI.U, R = ASHI_K.lv, cx = U.x + Math.cos(U.a) * 0.66, cy = U.y + Math.sin(U.a) * 0.66;   // hull middle
  ctx.save();
  // the scoring half gold, the other half grey (d361)
  const vin = ashiValidIn();
  for (const inner of [true, false]) {
    const a0 = inner ? U.a - Math.PI : U.a, ok = inner === vin;
    for (let i = R.length - 1; i >= 0; i--) {
      ctx.beginPath(); ctx.arc(cx, cy, R[i], a0, a0 + Math.PI); if (i > 0) ctx.arc(cx, cy, R[i - 1], a0 + Math.PI, a0, true); else ctx.lineTo(cx, cy); ctx.closePath();
      ctx.fillStyle = ok ? `rgba(255,214,90,${ASHI_K.zoneA[i] * (ASHI.zone === i ? 1.6 : 1)})` : `rgba(140,160,180,${ASHI_K.zoneA[i] * 0.55})`; ctx.fill();
    }
  }
  ctx.restore();
  drawBoatAt(U, ASHI.uin, UMI_REAL, false);
}
// for play3d: [radius, alpha] from the outside in, centre
function ashiZones() { if (!ASHI.on || !ASHI.U || ASHI.phase === 'show' || ASHI.phase === 'end') return null; return { x: ASHI.U.x + Math.cos(ASHI.U.a) * 0.66, y: ASHI.U.y + Math.sin(ASHI.U.a) * 0.66, h: ASHI.U.a, vin: ashiValidIn(), r: ASHI_K.lv, a: ASHI_K.zoneA.map((a, i) => a * (ASHI.zone === i ? 1.6 : 1)), b: ASHI_K.zoneA.map(a => a * 0.8) }; }
function ashiRows() { return ASHI.on && ASHI.U ? [{ b: ASHI.U, inp: ASHI.uin, no: 6, body: { sex: 'f', height: 145 } }] : []; }
{ const _ui = updateInput; updateInput = function (dt) { _ui(dt); ashiInput(dt); }; }
{ const _st = step; step = function (dt) { _st(dt); ashiStep(dt); if (ASHI.on) ashiHudStep(dt); }; }

// ---------- d362 (まえ): 足合わせのランキング（端末内10位まで／全体は1人1記録、サーバー v3 の /ashi） ----------
// d388 (まえ: 公開時は全ての記録を消して): v2 — a new table on the server and new keys on the device (best, list, sent)
ASHI_K.rules = 'honorGP.ashi.v3';   // d389: v3 (the release table once more)      // 点数の決まりが変わったら次の版にして表を分ける
ASHI_K.rankKey = 'honorGP.ashi.v3.rank'; ASHI_K.sentKey = 'honorGP.ashi.v3.sent';
function ashiRankLoad() { try { const a = JSON.parse(localStorage.getItem(ASHI_K.rankKey) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function ashiRankAdd(score, grade) {
  if (!(score > 0)) return;
  const a = ashiRankLoad(); a.push({ name: playerName(), score, grade, at: Date.now() });
  a.sort((p, q) => q.score - p.score || p.at - q.at);
  try { localStorage.setItem(ASHI_K.rankKey, JSON.stringify(a.slice(0, 10))); } catch (e) {}
}
// best of the current player (the device best key is shared, so the player's own best comes from the local list)
function ashiMyBest() { const n = playerName(); let m = null; for (const e of ashiRankLoad()) if (e.name === n && (!m || e.score > m.score)) m = e; return m; }
function ashiSentGet() { try { return JSON.parse(localStorage.getItem(playerKey(ASHI_K.sentKey)) || 'null'); } catch (e) { return null; } }
async function ashiSend() {
  const m = ashiMyBest(); if (!m) return '送る記録がありません';
  try {
    const j = await netCall('/ashi', { rules: ASHI_K.rules, pid: netPid(), name: playerName(), score: Math.round(m.score / 100) * 100, grade: m.grade, game: GAME_VER });
    try { localStorage.setItem(playerKey(ASHI_K.sentKey), JSON.stringify({ score: m.score, rank: j.rank, at: Date.now() })); } catch (e) {}
    toast('足合わせ 全体ランキング', `${ashiFmt(j.best)} 点　${j.rank}位`, 'good');
    return `全体 ${j.rank}位`;
  } catch (e) { return ashiNetErr(e); }
}
const ashiNetErr = e => /ありません（404）|^ありません$/.test(e.message) ? 'サーバーが古い版です（v3 に更新すると使えます）' : `送れませんでした：${e.message}`;
// the ランキング screen tab 「足合わせ」
async function ashiRankShow(box, note) {
  note.textContent = 'チュートリアルの最終レッスン「足合わせ」の点数。端末内は10位まで、全体は1人1記録で上位50位まで。';
  const h = document.createElement('h4'); h.textContent = '端末内'; h.style.margin = '4px 0'; box.appendChild(h);
  const a = ashiRankLoad(), me = playerName();
  if (!a.length) netNote(box, 'まだ記録がありません。チュートリアルの「足合わせだけ」からすぐ遊べます。');
  else netTable(box, ['順位', '名前', '点数', 'ランク', '日付'], a.map((e, i) => ({ hi: e.name === me, cells: [`${i + 1}`, e.name, ashiFmt(e.score), e.grade || ashiRank(e.score), netDay(e.at)] })));
  const mb = ashiMyBest(), sent = ashiSentGet();
  if (mb && !(sent && sent.score >= mb.score)) {
    const b = document.createElement('button'); b.className = 'btn ghost'; b.style.margin = '6px 0'; b.textContent = `自己ベスト ${ashiFmt(mb.score)} 点を全体ランキングに送る`;
    b.addEventListener('click', async () => { b.disabled = true; b.textContent = '送信中…'; const m = await ashiSend(); if (netTab === 'ashi') netShowTab('ashi'); else b.textContent = m; });
    box.appendChild(b);
  }
  const h2 = document.createElement('h4'); h2.textContent = '全体'; h2.style.margin = '10px 0 4px'; box.appendChild(h2);
  const wait = document.createElement('div'); box.appendChild(wait); netNote(wait, '読み込み中…');
  try {
    const j = await netCall(`/ashi?rules=${encodeURIComponent(ASHI_K.rules)}&limit=${NET.list}&pid=${encodeURIComponent(netPid())}`);
    if (netTab !== 'ashi') return;
    wait.textContent = '';
    if (!j.list.length) { netNote(wait, 'まだ誰も登録していません。自己ベストを出したら結果画面から送れます。'); return; }
    const mine = j.me && j.me.id;
    netTable(wait, ['順位', '名前', '点数', 'ランク', '日付'], j.list.map(e => ({ hi: e.id === mine, cells: [`${e.rank}`, e.name, ashiFmt(e.score), e.grade || ashiRank(e.score), netDay(e.at)] })));
    netNote(wait, j.me ? `あなた：${j.me.rank}位（${ashiFmt(j.me.score)} 点）／全${j.total}人` : `全${j.total}人。あなたはまだ登録していません。`);
  } catch (e) { if (netTab === 'ashi') { wait.textContent = ''; netNote(wait, /ありません/.test(e.message) && /404|^ありません$/.test(e.message) ? 'サーバーが古い版のため、全体ランキングはまだ使えません（サーバー v3 に更新すると使えます）。' : `読み込めませんでした：${e.message}`); } }
}
