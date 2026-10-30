/* ---------- タイムアタック (1艇・大時計スタートから3周・級判定) ----------
   The time is a race time: from the hand hitting zero to the finish line on the 3rd lap. Calm water, an average
   motor (出足・伸び1.0), and only a trace of the race's fade (水面の荒れ・熱ダレ, d161: FADE.ta) — alone on the water it holds its speed.
   フライング・出遅れ・転覆・内側航走 end the run with no record. The best run is kept in this browser and comes back
   as a ghost boat. */
// d148–d152: the turns (and the exits) got wider (GRIP_BASE), so the old bests were reset — a new key; the old 'honorGP.ta' is left unread
// d157: the turns slide now (ドリフト) — the old bests were reset again (d158: more slide and the hull's bank; d159: deep bank pays; d161: less fade in タイムアタック — reset each time)
const TA = { laps: 3, key: 'honorGP.ta.d161', ghostDt: 0.1, failWait: 1.8, logKey: 'hfgp-ta-logs', logKeep: 10 };
// 級: the slowest time (s) that still earns it. CPU 1艇 on calm water, average motor (d130, median):
// A1★ 1'47"7  A1 1'48"6  A2 1'49"6  B1 1'53"9  B2 1'59"6. d132: まえ set the bands — 記念クラス is beyond the CPU's best.
// d136: エクストラ (まえ) — GP覇者 and レジェンド sit above 記念クラス
const TA_EXTRA = ['レジェンド', 'GP覇者'];
// d152 (まえ): bands set to 記念 1'45"0, A1 1'47"0, B2 1'58"0 (CPU 1艇 with fade: 記念 1'45"0 A1★ 1'48"0 A1 1'48"6 A2 1'48"7 B1 1'51"2 B2 1'57"9)
// (old d132/d136: レジェンド 1'43"0 GP覇者 1'44"0 記念 1'45"0 A1 1'46"5 A2 1'50"0 B1 1'54"0 B2 2'00"0)
// d161 (まえ): タイムアタック keeps only a fifth of the race's lap fade — about 2 s faster, so every band moved 2 s with it
// (CPU 1艇: 記念 1'43"3 A1★ 1'45"2 A1 1'45"7 A2 1'46"7 B1 1'49"1)
// d165 (まえ): titles only, not race-time targets — レジェンド 1'42"0 GP覇者 1'43"0 記念 1'44"5 A1 1'46"0 A2 1'48"0 B1 1'52"0 B2 1'55"0
const TA_RANKS = [['レジェンド', 102.0], ['GP覇者', 103.0], ['記念クラス', 104.5], ['A1', 106.0], ['A2', 108.0], ['B1', 112.0], ['B2', 115.0], ['ルーキー', Infinity]];
const ta = { on: false, zero: 0, lastAt: 0, laps: [], st: null, path: [], nextPt: 0, done: false, log: [], ev: [], corners: [], cur: null, cSide: -1 };
// the best run belongs to the player chosen in the practice menu (player.js)
let taBest = null;
function taReload() { taBest = null; try { taBest = JSON.parse(localStorage.getItem(playerKey(TA.key)) || 'null'); } catch (e) {} }
taReload();
// 羽美のヒント: the first whose class this run reaches (fastest first)
const UMI_HINT = [['記念クラス', '全開のまま…体をぐっと倒すの。'], ['A1', 'わたし、ターンでレバーを離さないよ〜。']];
const taRank = t => TA_RANKS.find(r => t <= r[1])[0];
const taGap = d => (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2);

function beginTA() {
  beginStart();
  soloKind = 'ta'; waterEnv = null;
  Object.assign(ta, { on: true, zero: SS.t0 + CLOCK, lastAt: SS.t0 + CLOCK, laps: [], st: null, path: [], nextPt: SS.t0, done: false, log: [], ev: [], corners: [], cur: null, cSide: -1 });
  if (VR) VR.begin('ta');
  toast('タイムアタック', `${playerName()}　大時計スタートから${TA.laps}周　${taBest ? '自己ベスト ' + fmtRT(taBest.t) : '走ったタイムで級を判定'}`, 'info');
}
// every physics step of the solo boat
function taStep() {
  if (!ta.on) return;
  if (time >= ta.nextPt) {
    ta.path.push(+B.x.toFixed(2), +B.y.toFixed(2), +B.a.toFixed(3)); ta.nextPt += TA.ghostDt;
    ta.log.push(`${rpN(time - ta.zero, 2)} ${rpN(B.x)} ${rpN(B.y)} ${Math.round(((B.a * 180 / Math.PI) % 360 + 540) % 360 - 180)} ${rpN(B.v * 3.6)} ${rpN(input.thr, 2)} ${rpN(input.steer, 2)} ${rpN(input.roll, 2)} ${rpN(input.pitch, 2)} ${rpN(B.load, 2)} ${Math.round((B.yaw || 0) * 57.3)}${B.cap > 0 ? ' cap' : ''}`);
  }
  if (SS.phase !== 'count') taMarkGap();
  if (B.cap > 0) taFail('転覆');
}
// マークとの間隔: for each corner, the closest the hull came to the turn mark — from the hull's edge (the capsule
// HULL_AFT behind to HULL_FWD ahead of the centre, HULL_R wide) to the buoy's surface (r 1.5 m). 0 = touching.
const TA_CORNER = { from: 30 };   // a corner is the water beyond MK − 30 m on that mark's side
const TA_PART_JA = { bow: '艇首', mid: '中央', stern: '艇尾' };
function taMarkGap() {
  const side = B.x > MK - TA_CORNER.from ? 0 : B.x < -(MK - TA_CORNER.from) ? 1 : -1;
  if (side !== ta.cSide) { if (ta.cur) taCornerEnd(); ta.cSide = side; ta.cur = side < 0 ? null : { m: side ? '2M' : '1M', gap: Infinity }; }
  if (!ta.cur) return;
  const ob = OBSTACLES.filter(o => o.kind === 'mark')[side], c = Math.cos(B.a), s = Math.sin(B.a);
  const [px, py, qx, qy] = closestSegSeg(B.x - c * HULL_AFT, B.y - s * HULL_AFT, B.x + c * HULL_FWD, B.y + s * HULL_FWD, ob.x1, ob.y1, ob.x2, ob.y2);
  const gap = Math.hypot(px - qx, py - qy) - HULL_R - ob.r;
  if (gap < ta.cur.gap) {
    const along = (px - B.x) * c + (py - B.y) * s;
    Object.assign(ta.cur, { gap, t: time - ta.zero, v: B.v * 3.6, part: along > HULL_FWD - 0.3 ? 'bow' : along < -HULL_AFT + 0.3 ? 'stern' : 'mid' });
  }
}
function taCornerEnd() {
  const k = ta.cur; ta.cur = null;
  if (!k || !isFinite(k.gap)) return;
  k.lap = ta.laps.length + 1; ta.corners.push(k);
  taEv(`${k.m} lap${k.lap} gap=${Math.max(0, k.gap).toFixed(2)}m t=${k.t.toFixed(2)} v=${Math.round(k.v)} part=${k.part}`);
}
const taGapJa = g => g <= 0.02 ? '接触' : `${g.toFixed(2)}m`;
// per lap: "1周 1M 0.12m（中央）・2M 0.30m（艇首）"
const taCornersJa = list => [1, 2, 3].map(l => { const cs = list.filter(k => k.lap === l); return cs.length ? `${l}周 ` + cs.map(k => `${k.m} ${taGapJa(k.gap)}（${TA_PART_JA[k.part]}）`).join('・') : ''; }).filter(Boolean).join('　');
const taEv = msg => ta.ev.push(`${rpN(time - ta.zero, 2)} ${msg}`);
function taStart(st) { if (!ta.on) return; ta.st = st; if (VR) VR.ev('st', 1, { st, flying: st < 0 }, ta.zero + st); taEv(`ST ${st < 0 ? 'F' + fmtST(-st) : fmtST(st)}`); if (st < 0) taFail('フライング'); }
function taLap(at) {
  if (!ta.on) return;
  const lt = at - ta.lastAt, n = ta.laps.push(lt); ta.lastAt = at;
  if (VR) VR.ev('lap', 1, { lap: n, lapTime: lt }, at);
  taEv(`lap${n} ${lt.toFixed(2)}`);
  const b = taBest && taBest.laps ? taBest.laps.slice(0, n).reduce((s, v) => s + v, 0) : null;
  const sum = at - ta.zero;
  if (n >= TA.laps) { taFinish(sum); return; }
  toast(`${n}周`, `ラップ ${lt.toFixed(2)}${b != null ? `　自己ベスト比 ${taGap(sum - b)}` : ''}`, 'info');
}
function taFail(why) {
  if (!ta.on) return;
  taEv(`fail ${why}`); ta.on = false;
  if (VR) { VR.ev('fail', 1, { why }); VR.finish('no_record', time, why); }
  toast(why, '記録なし', 'bad');
  setTimeout(() => taShow(null, why), TA.failWait * 1000);
}
function taFinish(t) {
  if (ta.cur) taCornerEnd();
  ta.on = false; ta.done = true;
  if (VR) { VR.ev('finish', 1, { time: t, place: 1 }, ta.zero + t); VR.finish('finished', ta.zero + t); }
  const prev = taBest, best = !prev || t < prev.t;
  const mt = taMeasNow();
  if (best) {
    taBest = { t, laps: ta.laps.slice(), st: ta.st, meas: mt, rank: taRank(t), g: ta.path, g0: SS.t0 - ta.zero, at: Date.now() };
    try { localStorage.setItem(playerKey(TA.key), JSON.stringify(taBest)); } catch (e) {}
  }
  taLogSave(t, best);
  toast(best ? '自己ベスト更新' : 'ゴール', `${fmtRT(t)}　${taRank(t)}`, best ? 'good' : 'info');
  setTimeout(() => taShow({ t, laps: ta.laps.slice(), st: ta.st, meas: mt }, null, best ? prev : taBest, best), 1200);
}
// the result card. run = this run (null if it ended with no record), ref = the best to compare against
function taShow(run, why, ref = taBest, isBest = false) {
  if (soloKind !== 'ta' || fleet) return;
  $('taTime').textContent = run ? fmtRT(run.t) : '記録なし';
  const rk = run ? taRank(run.t) : '';
  $('taRank').textContent = rk; $('taRank').hidden = !run;
  $('taRank').className = 'ta-rank' + (TA_EXTRA.includes(rk) ? ' ex' : rk === '記念クラス' ? ' top' : '');
  let msg;
  if (!run) msg = why === 'フライング' ? 'フライング：針が0を指す前にスタートラインを越えました。' : why === '出遅れ' ? '出遅れ：針が0を指してから1秒以内に越えられませんでした。' : why === '転覆' ? '転覆：ターンで体重移動が足りないか、アクセルを開けすぎました。' : '内側航走：ターンマークの内側を通りました。';
  else {
    const i = TA_RANKS.findIndex(r => r[0] === rk), up = i > 0 ? TA_RANKS[i - 1] : null;
    msg = (isBest ? (ref ? `自己ベスト更新！（${taGap(run.t - ref.t)}秒）` : '初めての記録です。') : `自己ベストまで ${(run.t - ref.t).toFixed(2)}秒。`)
      + (up ? `　${up[0]}まであと${(run.t - up[1]).toFixed(1)}秒。` : '　最高ランクです。');
  }
  $('taMsg').textContent = msg;
  // d202 (まえ): 羽美 (the girl in the manual's manga) drops a hint about the full-speed turn once a run is fast enough
  const hint = run && UMI_HINT.find(([rank]) => run.t <= TA_RANKS.find(r => r[0] === rank)[1]);
  $('taHint').hidden = !hint; if (hint) $('taHintTxt').textContent = hint[1];
  const tb = $('taBody'); tb.textContent = '';
  const row = (name, a, b) => { const tr = document.createElement('tr'); [name, a, b].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); }); tb.appendChild(tr); };
  const st = v => v == null ? '—' : v < 0 ? 'F ' + fmtST(-v) : fmtST(v);
  const cur = run || { laps: ta.laps, st: ta.st };
  for (let i = 0; i < TA.laps; i++) row(`${i + 1}周`, cur.laps[i] != null ? cur.laps[i].toFixed(2) : '—', ref && ref.laps[i] != null ? ref.laps[i].toFixed(2) : '—');
  row('ST', st(cur.st), ref ? st(ref.st) : '—');
  row('タイム', run ? fmtRT(run.t) : '—', ref ? fmtRT(ref.t) : '—');
  taMeasTable(run ? run.meas : taMeasNow(), ref && ref.meas);
  $('taGaps').textContent = ta.corners.length ? 'マークとの間隔（艇体の端〜ブイ）　' + taCornersJa(ta.corners) : '';
  $('taNote').textContent = '級の目安（3周）：' + TA_RANKS.filter(r => !TA_EXTRA.includes(r[0])).slice(0, -1).map(r => `${r[0]} ${fmtRT(r[1])}`).join('／') + '／それより遅いとルーキー。エクストラ：' + TA_RANKS.filter(r => TA_EXTRA.includes(r[0])).reverse().map(r => `${r[0]} ${fmtRT(r[1])}`).join('／') + '。タイムは針が0を指してからゴールまで。' + TA_MEAS_NOTE;
  $('taSlit').hidden = !(practiceSlit && practiceSlit.archived);
  if ($('taVidMsg')) { $('taVidMsg').textContent = ''; $('taVidMsg').hidden = true; }
  if (typeof vlUi === 'function') vlUi();
  paused = true; $('taBox').hidden = false;
}
// 区間タイム (展示・直線・まわり足・一周): the same gates as the practice 展示航走 (input.js GATES), every lap
const TA_MEAS_KEYS = ['tenji', 'choku', 'mawari', 'isshu'];
const TA_MEAS_NOTE = '　区間：展示＝バックのスタートライン延長から2マークまで150m／直線＝1マークからスタートライン延長まで120m／まわり足＝1マーク手前22mから出口23mまで／一周＝バックのスタートライン延長から次の周の同じ所まで（2周目・3周目の欄）。緑はその区間の今回いちばん速い周。';
const taMeasNow = () => { const o = {}; for (const k of TA_MEAS_KEYS) o[k] = (meas.t[k] || []).map(v => v == null ? null : +v.toFixed(3)); return o; };
// 一周 is measured back straight to back straight, so its n-th value ends in lap n+1
const taMeasLaps = (m, k) => { const a = (m && m[k]) || []; return k === 'isshu' ? [null, ...a] : a; };
const taMeasLog = m => TA_MEAS_KEYS.map(k => `${k}=` + Array.from({ length: TA.laps }, (_, i) => { const v = taMeasLaps(m, k)[i]; return v == null ? '-' : v.toFixed(2); }).join('/')).join(' ');
function taMeasTable(m, ref) {
  let tab = $('taMeas');
  if (!tab) {
    tab = document.createElement('table'); tab.id = 'taMeas'; tab.className = 'mtab';
    $('taBody').closest('table').after(tab);
  }
  tab.textContent = '';
  const tr = cells => { const r = document.createElement('tr'); cells.forEach(([v, cls, th]) => { const c = document.createElement(th ? 'th' : 'td'); c.textContent = v; if (cls) c.style.color = 'var(--good)'; r.appendChild(c); }); tab.appendChild(r); };
  tr([['区間', '', 1], ...Array.from({ length: TA.laps }, (_, i) => [`${i + 1}周`, '', 1]), ['自己ベスト時', '', 1]]);
  for (const k of TA_MEAS_KEYS) {
    const a = taMeasLaps(m, k), vals = a.filter(v => v != null), lo = vals.length > 1 ? Math.min(...vals) : null;
    const r = taMeasLaps(ref, k).filter(v => v != null);
    tr([[MEAS_JA[k].replace('タイム', '')], ...Array.from({ length: TA.laps }, (_, i) => [a[i] == null ? '—' : a[i].toFixed(2), a[i] != null && a[i] === lo ? 'good' : '']), [r.length ? Math.min(...r).toFixed(2) : '—']]);
  }
}
// ログ: every finished run is kept (the last TA.logKeep, plus the current best which is never pushed out)
function taLogSave(t, best) {
  const pad = typeof currentPad === 'function' && currentPad();
  const text = [`#HFGP-TA v1 ${GAME_VER} ${new Date().toISOString()}`,
    `#result time=${t.toFixed(2)} rank=${taRank(t)} ST=${ta.st == null ? '-' : ta.st.toFixed(3)} laps=${ta.laps.map(v => v.toFixed(2)).join('/')}${best ? ' best' : ''}`,
    `#meas ${taMeasLog(taMeasNow())}`,
    `#player ${playerName()}`,
    `#setup laps=${TA.laps} water=calm motor=avg(deashi1/nobi1) tilt=${rpN(B.tilt, 1)} control=${controlMode}${pad ? '+controller' : ''}`,
    '#S t x y heading(deg) v(km/h) thr steer roll pitch load yaw(deg/s)  (t = s from the start signal, every 0.1 s; x,y in m, start line x=0, 1M x=+' + MK + ', 2M x=-' + MK + ')',
    ...ta.log, '#events (t, what; gap = hull edge to buoy surface at its closest in that corner, part = which part of the hull)', ...ta.ev].join('\n');
  const key = playerKey(TA.logKey);
  let all = []; try { all = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
  if (best) for (const e of all) e.best = false;
  all.unshift({ at: Date.now(), title: `タイムアタック ${fmtRT(t)} ${taRank(t)}${best ? '（自己ベスト）' : ''}`, text, best });
  while (all.length > TA.logKeep) { const i = all.map(e => !!e.best).lastIndexOf(false); all.splice(i < 0 ? all.length - 1 : i, 1); }
  for (;;) { try { localStorage.setItem(key, JSON.stringify(all)); break; } catch (e) { const i = all.map(e => !!e.best).lastIndexOf(false); if (all.length <= 1 || i <= 0) break; all.splice(i, 1); } }
}
function taLogOpen(back) {
  rpSrc = { key: playerKey(TA.logKey), title: `タイムアタックのログ（${playerName()}）`, file: 'hfgp_ta', empty: 'タイムアタックのログはまだありません。3周走りきると自動で残ります。' };
  rpBack = back; rpOpen(0);
}
$('taLog').addEventListener('click', () => { $('taBox').hidden = true; taLogOpen(() => { $('taBox').hidden = false; paused = true; }); });
$('pmTALog').addEventListener('click', () => { $('pmenu').hidden = true; taLogOpen(() => { $('pmenu').hidden = false; paused = true; }); });
const taClose = () => { $('taBox').hidden = true; if (VR) VR.discard(); paused = false; last = performance.now(); };   // 動画用ログ: closing the card drops it
$('taAgain').addEventListener('click', () => { taClose(); beginTA(); });
$('taClose').addEventListener('click', taClose);
$('taSlit').addEventListener('click', () => slitOpen(practiceSlit));
$('pmTA').addEventListener('click', () => { closeMenu(); if (fleet) quitFleet(); beginTA(); });

// ゴースト: the best run, drawn faint, on the same clock
const GHOST_STYLE = { hull: '#9fe8d4', num: '#0a2c38', label: 'G', helmet: '#9fe8d4' };
const GHOST_IN = { thr: 0, steer: 0, roll: 0, pitch: 0 };
function taDrawGhost() {
  if (soloKind !== 'ta' || fleet || !taBest || !taBest.g || !(ta.on || ta.done)) return;
  const g = taBest.g, n = g.length / 3, u = (time - ta.zero - taBest.g0) / TA.ghostDt;
  if (u < 0 || u >= n - 1) return;
  const i = Math.floor(u), f = u - i, j = i * 3;
  let da = g[j + 5] - g[j + 2]; da = Math.atan2(Math.sin(da), Math.cos(da));
  const gb = { x: g[j] + (g[j + 3] - g[j]) * f, y: g[j + 1] + (g[j + 4] - g[j + 1]) * f, a: g[j + 2] + da * f,
    v: Math.hypot(g[j + 3] - g[j], g[j + 4] - g[j + 1]) / TA.ghostDt, vl: 0, yaw: 0, porp: 0, cap: 0, load: 0 };
  // d170 (まえ: the ghost didn't slide): only x, y, heading are stored, so the slip comes from the path — the way it travels
  // against the way it points, as physics.js b.slip — and drawBoatAt swings the stern out the same as a live boat
  const dx = g[j + 3] - g[j], dy = g[j + 4] - g[j + 1], fx = Math.cos(gb.a), fy = Math.sin(gb.a);
  gb.slip = Math.atan2(-fy * dx + fx * dy, Math.max(0.05, fx * dx + fy * dy));
  ctx.save(); ctx.globalAlpha = 0.38; drawBoatAt(gb, GHOST_IN, GHOST_STYLE, false); ctx.restore();
}
