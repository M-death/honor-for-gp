// Honor for GP — 節間モード（前検・予選・優勝戦・モーター抽選・整備）
let askCb = null;
function askConfirm(msg, yes, no) { $('askMsg').textContent = msg; askCb = { yes, no }; $('askBox').hidden = false; }
function askClose(ok) { $('askBox').hidden = true; const c = askCb; askCb = null; if (orient.full && !document.fullscreenElement) lockLandscape(); if (c) (ok ? c.yes : c.no)?.(); }
if (typeof document !== 'undefined' && document.getElementById('askBox')) { $('askYes').addEventListener('click', () => askClose(true)); $('askNo').addEventListener('click', () => askClose(false)); }
let setsu = null;

const setsuRand = n => Math.floor(Math.random() * n);
function setsuShuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = setsuRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const setsuMe = () => setsu && setsu.racers.find(q => q.player);
// motor (0–100, 50 = average). 素性 (cap) is fixed when the motor is delivered — the casting decides it, no rider can
// change it; 整備 only draws it out. cur = what the last riders left it at. stab (0–100) = how evenly it runs race to race.
// Nobody sees these numbers: only 2連率 (rider skill mixed in) and the papers' rough 各足評価.
const setsuU = (a, b) => a + Math.random() * (b - a);
function setsuMotorDraw() {
  const base = clamp(50 + gauss() * 15, 3, 97);
  // 出足型 ↔ 伸び型. The really good ones are good everywhere: the lean and the spread shrink toward the top
  const even = 1 - 0.75 * clamp((base - 60) / 25, 0, 1), lean = gauss() * 6 * even;
  const cap = { low: base + lean + gauss() * 6 * even, mid: base + gauss() * 6 * even, top: base - lean + gauss() * 6 * even };
  for (const k in cap) cap[k] = clamp(base > 65 ? Math.max(cap[k], base - 6) : cap[k], 0, 100);
  const left = setsuU(3, 13);                                                  // how far below its 素性 the last riders left it
  const cur = { low: cap.low - left - setsuU(0, 3), mid: cap.mid - left - setsuU(0, 3), top: cap.top - left - setsuU(0, 3) };
  const stab = clamp(50 + gauss() * 20, 0, 100), dur = pickW([['hi', 3], ['mid', 5], ['lo', 2]]);
  const lvl = (cur.low + cur.mid + cur.top) / 3;
  const m2 = Math.round(clamp(33 + (lvl - 42) * 0.5 + (stab - 50) * 0.05 + gauss() * 5, 8, 62));   // the riders it had are in here too
  // the papers: what they make of each 足, from watching it — roughly right
  const ev = {}; for (const k of ['low', 'mid', 'top']) ev[k] = cur[k] + gauss() * 8 + (m2 - 33) * 0.3;
  // ペラ: it comes with the motor, hammered by whoever had it last (0–100 points added to each 足)
  const pl = gauss() * 3, prop = { low: clamp(pl + gauss() * 2.5, -8, 8), mid: clamp(gauss() * 2.5, -8, 8), top: clamp(-pl + gauss() * 2.5, -8, 8) };
  return { cap, cur, stab, dur, cond: 1, m2, ev, prop };
}
const setsuEv = (q, k) => q.motor.ev[k] + ((q.motor.prop || {})[k] || 0) * 0.7 + (k === 'mid' && q.boat ? (q.boat.turn - 50) * 0.15 : 0);
const setsuEvMark = x => x >= 58 ? "◎" : x >= 47 ? "○" : x >= 35 ? "－" : x >= 25 ? "△" : "×";
// boat: ターンのかかり (grip), 乗り心地 (how it rides waves), 水面抵抗 — fixed, only the tilt is ours to change
// boat (0–100, hidden): ターンのかかり, 乗り心地, 水面抵抗. Nothing to adjust but the tilt; 2連率 only hints at it
function setsuBoatDraw() {
  const h = () => clamp(50 + gauss() * 16, 0, 100), turn = h(), ride = h(), drag = h();
  return { turn, ride, drag, m2: Math.round(clamp(33 + (turn - 50) * 0.18 + (drag - 50) * 0.08 + (ride - 50) * 0.04 + gauss() * 5, 12, 55)) };
}
// below the minimum you ride with the orange vest + weights (vest 0.5 kg, weights in 0.5 kg)
// 個人パラメータ (仮): start / turn / judge around the class anchor, one overall talent, and a 0–100 affinity per course.
// イン志向 riders like the inside, アウト志向 the outside (that's what makes an イン屋 / アウト屋); others have one pet course now and then
function setsuSkillDraw(cls, pref, player) {
  const a = (SKILL_ANCHOR.find(x => x[0] === cls) || ['B1', 42])[1];
  if (player) return { start: a, turn: a, judge: a, course: [50, 50, 50, 50, 50, 50] };
  const o = gauss() * 5, v = () => clamp(a + o + gauss() * 8, 5, 98);
  const course = [0, 1, 2, 3, 4, 5].map(() => clamp(50 + gauss() * 12, 5, 95));
  if (pref === 'in') { course[0] += 25; course[1] += 15; course[4] -= 15; course[5] -= 20; }
  else if (pref === 'out') { course[5] += 25; course[4] += 15; course[0] -= 20; course[1] -= 10; }
  else if (Math.random() < 0.35) course[setsuRand(6)] += 20;
  return { start: v(), turn: v(), judge: v(), course: course.map(x => Math.round(clamp(x, 5, 98))) };
}
const setsuBestCourse = q => { const c = q.skill && q.skill.course; if (!c) return null; const m = Math.max(...c); return m >= 66 ? c.indexOf(m) + 1 : null; };
const setsuSkillScore = (q, waku) => { const k = q.skill; if (!k) return SETSU.skill[q.cls] ?? 0; const ov = k.start * 0.3 + k.turn * 0.45 + k.judge * 0.25; return skillLerp(ov, c => SETSU.skill[c]) + (waku != null ? (k.course[waku] - 50) * 0.008 : 0); };
const setsuEffWt = q => Math.max(q.weight, SETSU.minWt[q.sex] || 52);
const setsuAdjWt = q => q.weight < (SETSU.minWt[q.sex] || 52) ? Math.ceil(((SETSU.minWt[q.sex] || 52) - q.weight) * 2) / 2 : 0;
function setsuNew(name, cls, grade = 'ippan', opt = {}) {
  const sg = grade === 'sg';
  const racers = [], used = new Set();
  const nm = sex => { const fi = SETSU_MEI.indexOf('美咲'), pool = sex === 'f' ? SETSU_MEI.slice(fi) : SETSU_MEI.slice(0, fi); for (;;) { const s = SETSU_SEI[setsuRand(SETSU_SEI.length)] + ' ' + pool[setsuRand(pool.length)]; if (!used.has(s)) { used.add(s); return s; } } };
  const add = (c, player) => { const sex = player ? (opt.sex || 'm') : Math.random() < 0.13 ? 'f' : 'm'; racers.push({ id: racers.length, name: player ? (name || 'あなた') : nm(sex), cls: c, player: !!player,
    sex, height: player && opt.height ? clamp(Math.round(+opt.height), 145, 185) : heightDraw(sex),
    temper: player ? 'normal' : pickW([['calm', 3], ['normal', 5], ['aggr', 2]]), pref: player ? 'waku' : pickW([['waku', 9], ['in', 0.6], ['out', 0.6]]),
    runs: [], excl: false, tilt: -0.5, prop: 'bal' }); const q = racers[racers.length - 1]; q.weight = player && opt.weight ? clamp(+opt.weight, 44, 62) : weightDraw(sex, q.height); q.skill = setsuSkillDraw(c, q.pref, player); };
  add(cls, true);
  // SG: the best in the country — all A1, with a handful of トップクラス
  for (const [c, n] of Object.entries(sg ? SETSU.clsSG : SETSU.cls)) for (let i = 0; i < n - (c === cls ? 1 : 0); i++) add(c, false);
  while (racers.length < 48) add(sg ? 'A1' : 'B1', false);
  // 前検: motor and boat lottery
  const nos = setsuShuffle([...Array(60).keys()].map(i => i + 11));
  const bnos = setsuShuffle([...Array(60).keys()].map(i => i + 11));
  // the venue's 60 motors; 2連率 order over the whole pool (★ = エース機, top 6 = 上位機)
  const pool = [...Array(60)].map(() => setsuMotorDraw());
  pool.map((m, i) => i).sort((a, b) => pool[b].m2 - pool[a].m2).forEach((i, r) => pool[i].rank = r + 1);
  racers.forEach((q, i) => { q.motorNo = nos[i]; q.motor = pool[nos[i] - 11]; q.boatNo = bnos[i]; q.boat = setsuBoatDraw(); });
  const season = opt.season || pickW([['spring', 1], ['summer', 1], ['autumn', 1], ['winter', 1]]);
  setsu = { v: 5, day: 0, grade, season, venue: 'standard', envs: {}, racers, races: [], champ: null, log: [], watchAll: false };
  if (sg) setsuPrelimsSG(); else setsuPrelims();
  setsuSave();
  return setsu;
}
// how many times each rider has had each 枠 so far, and an assignment of 6 riders to 枠 that spreads them
function setsuSeat(ids) {
  const cnt = id => setsu.racers[id].wakuCnt || (setsu.racers[id].wakuCnt = [0, 0, 0, 0, 0, 0]);
  let best = null, bestC = Infinity;
  const perm = (arr, k) => {
    if (k === arr.length) { const c = arr.reduce((s, id, w) => s + cnt(id)[w] * 10 + Math.random(), 0); if (c < bestC) { bestC = c; best = arr.slice(); } return; }
    for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; }
  };
  perm(ids.slice(), 0);
  best.forEach((id, w) => cnt(id)[w]++);
  return best;
}
function setsuRace(day, R, kind, ids, seat = true) { return { day, R, kind, entries: seat ? setsuSeat(ids) : ids, result: null, watch: false }; }
// fill races [r0..r1] (1-based) with the riders: first-half rides then second-half rides, 6 per race
function setsuFill(day, first, second, rFirst, rSecond, kind) {
  const out = [];
  const chunk = (ids, from) => { ids = setsuShuffle(ids); for (let i = 0; i < ids.length; i += 6) out.push(setsuRace(day, from + i / 6, kind(from + i / 6), ids.slice(i, i + 6))); };
  chunk(first, rFirst); chunk(second, rSecond);
  return out;
}
function setsuPrelims() {
  const ids = setsuShuffle(setsu.racers.map(q => q.id)), A = ids.slice(0, 24), Bg = ids.slice(24);
  for (let d = 1; d <= 4; d++) {
    const dbl = d % 2 ? A : Bg, sgl = setsuShuffle(d % 2 ? Bg : A);
    setsu.races.push(...setsuFill(d, [...dbl, ...sgl.slice(0, 12)], [...dbl, ...sgl.slice(12)], 1, 7, () => '予選'));
  }
}
// SG: day 1 ends with the ドリーム戦 (12R) — the six biggest names, 枠 by standing. It counts as a 予選 race.
// The dream riders ride only that on day 1; everyone still gets 6 予選 rides over the 4 days.
function setsuPrelimsSG() {
  const tops = setsu.racers.filter(q => q.cls === 'TOP'), dreamIds = setsuShuffle(tops.length >= 6 ? tops : setsu.racers.filter(q => q.cls === 'TOP' || q.cls === 'A1')).slice(0, 6).map(q => q.id);
  const rest = setsuShuffle(setsu.racers.map(q => q.id).filter(id => !dreamIds.includes(id)));   // 42
  const d1dbl = rest.slice(0, 24), d1sgl = rest.slice(24);                                      // 24 ride twice on day 1, 18 once
  setsu.races.push(...setsuFill(1, [...d1dbl, ...d1sgl.slice(0, 12)], [...d1dbl, ...d1sgl.slice(12)], 1, 7, () => '予選'));
  setsu.races.push(setsuRace(1, 12, 'ドリーム戦', dreamIds, false));
  // days 2–4: the day-1 doubles need 4 more rides (one double day), everyone else 5 (two double days)
  const four = setsuShuffle(d1dbl), five = setsuShuffle([...d1sgl, ...dreamIds]);
  for (let d = 2; d <= 4; d++) {
    const k = d - 2;
    const dbl = [...four.slice(k * 8, k * 8 + 8), ...five.filter((_, i) => i % 3 !== k)];       // 8 + 16 = 24 double riders
    const sgl = setsuShuffle(setsu.racers.map(q => q.id).filter(id => !dbl.includes(id)));      // 24
    setsu.races.push(...setsuFill(d, [...dbl, ...sgl.slice(0, 12)], [...dbl, ...sgl.slice(12)], 1, 7, () => '予選'));
  }
}
const setsuQualPts = q => q.runs.filter(x => x.kind === '予選' || x.kind === 'ドリーム戦');
function setsuRate(q) { const r = setsuQualPts(q); return r.length ? r.reduce((s, x) => s + x.pts, 0) / r.length : 0; }
function setsuStandings() {
  return setsu.racers.slice().sort((a, b) => (a.excl - b.excl) || (setsuRate(b) - setsuRate(a)) || (b.runs.filter(x => x.place === 1).length - a.runs.filter(x => x.place === 1).length) || (a.id - b.id));
}
function setsuBuildDay(d) {
  if (setsu.races.some(r => r.day === d)) return;
  if (d === 5) {
    const st = setsuStandings(), q18 = st.filter(q => !q.excl).slice(0, 18), rest = setsu.racers.filter(q => !q18.includes(q)).map(q => q.id);
    for (const [R, k] of [[12, 0], [11, 1], [10, 2]]) setsu.races.push(setsuRace(5, R, '準優勝戦', [0, 1, 2, 3, 4, 5].map(i => q18[i * 3 + k] && q18[i * 3 + k].id).filter(x => x != null), false));
    const two = setsuShuffle(rest).slice(0, 24);
    setsu.races.push(...setsuFill(5, rest, two, 1, 6, R => R >= 8 ? '特別選抜' : '一般戦'));
  } else if (d === 6) {
    const semis = setsu.races.filter(r => r.day === 5 && r.kind === '準優勝戦');
    const ok = id => !(setsu.racers[id].runs.find(x => x.day === 5 && x.kind === '準優勝戦' && (x.mark === 'F' || x.mark === 'L' || x.furyo)));   // d167: 不良航法 in the 準優 also keeps you out of the 優勝戦
    const firsts = [], seconds = [], thirds = [];
    for (const r of semis) { const o = (r.result ? r.result.order : []).filter(ok); if (o[0] != null) firsts.push(o[0]); if (o[1] != null) seconds.push(o[1]); if (o[2] != null) thirds.push(o[2]); }
    const byRate = a => a.sort((x, y) => setsuRate(setsu.racers[y]) - setsuRate(setsu.racers[x]));
    let fin = [...byRate(firsts), ...byRate(seconds)];
    for (const id of byRate(thirds)) if (fin.length < 6) fin.push(id);
    const restAll = setsu.racers.map(q => q.id).filter(id => !fin.includes(id));
    while (fin.length < 6) fin.push(restAll.pop());
    setsu.races.push(setsuRace(6, 12, '優勝戦', fin, false));
    const rest = setsu.racers.map(q => q.id).filter(id => !fin.includes(id));
    setsu.races.push(...setsuFill(6, rest, setsuShuffle(rest).slice(0, 24), 1, 8, R => R >= 10 ? '特別選抜' : '一般戦'));
  }
  setsu.races.sort((a, b) => a.day - b.day || a.R - b.R);
}
const setsuToday = () => setsu.races.filter(r => r.day === setsu.day).sort((a, b) => a.R - b.R);
const setsuHasMe = r => r.entries.includes(setsuMe().id);
// 各足 = motor + the prop on it (+ my own 仮 re-hammering toward 出足型/伸び型)
function setsuFeet(q) {
  const mo = q.motor, c = mo.cur, pr = mo.prop || { low: 0, mid: 0, top: 0 }, my = q.player ? (SETSU.props[q.prop] || SETSU.props.bal) : { low: 0, mid: 0, top: 0 };
  return { low: c.low + pr.low + my.low, mid: c.mid + pr.mid + my.mid, top: c.top + pr.top + my.top };
}
// the machine as the engine sees it. noisy: this race's spread (安定性); env: today's water/air
function setsuMotor(q, env, noisy) {
  const mo = q.motor, bt = q.boat || { turn: 50, ride: 50, drag: 50 }, f = setsuFeet(q);
  const min = SETSU.minWt[q.sex] || 52, w = setsuEffWt(q);
  const T = env ? env.temp : 20;
  return { deashi: motorMul(f.low, 'low'), mid: motorMul(f.mid, 'mid'), nobi: motorMul(f.top, 'top'),
           powerK: mo.cond * (noisy ? 1 + gauss() * (0.002 + (100 - mo.stab) / 100 * 0.008) : 1),
           tempLow: -0.0012 * (T - 20), tempTop: -0.0005 * (T - 20),
           hullGrip: hullMul(bt.turn, 'turn'), hullRide: hullMul(bt.ride, 'ride'), hullDrag: hullMul(bt.drag, 'drag'),
           weightK: 1 - (w - min) * 0.003, weightGrip: 1 + (w - min) * 0.005 };
}
// ---- the water: per day (strong-wind days, three wind shifts) and per race (tide every 2 races, temperature by the clock)
// the setsu's water: the venue's weather model, one day at a time (cached so a reload shows the same day)
function setsuDayEnv(d) { const E = setsu.envs || (setsu.envs = {}); return E[d] || (E[d] = envDay(venueOf(setsu.venue), setsu.season, E[d - 1])); }
function setsuRaceEnv(race) { return race.env || (race.env = envRace(venueOf(setsu.venue), setsuDayEnv(race.day), race.R)); }
const setsuWaterEnv = e => envPhysics(venueOf(setsu && setsu.venue), e);
const setsuEnvTxt = e => envText(e);
// 出走表 → the rows the race engine takes
function setsuRows(race) {
  return race.entries.map((id, i) => {
    const q = setsu.racers[id];
    return { no: i + 1, sid: id, name: q.name, prof: profFor(q.cls, q.player ? null : q.skill), skill: q.player ? null : q.skill, pref: q.player ? 'waku' : q.pref,
             key: i + 1 + (q.pref === 'in' && !q.player ? -2.6 : q.pref === 'out' && !q.player ? 2.6 : 0) + Math.random() * 0.1,
             temper: q.temper, motor: setsuMotor(q, setsuRaceEnv(race), true), col: LANE_COL[i],
             body: { sex: q.sex, height: q.height || SETSU.body.ref, weight: q.weight, rideWt: setsuEffWt(q) } };
  });
}
// instant result: Plackett–Luce on course × skill × machine, with the odd フライング and 転覆
function setsuQuick(race, omakase) {
  const res = { order: [], marks: {}, st: {}, fouls: {}, quick: true };
  const pool = [], env = setsuRaceEnv(race), we = setsuWaterEnv(env);
  race.entries.forEach((id, i) => {
    const q = setsu.racers[id], safe = q.player && omakase, m = setsuMotor(q, env, true);
    const prof = profFor(q.cls, q.skill);
    let st = Math.max(0.01, (safe ? 0.2 : prof.st + 0.04) + (Math.random() + Math.random() - 1) * (safe ? 0.05 : prof.stJit * 2 + 0.03));
    if (!safe && Math.random() < (SETSU.fly[q.cls] || 0.004)) { res.marks[id] = 'F'; res.st[id] = -(0.01 + Math.random() * 0.04); return; }
    res.st[id] = st;
    if (Math.random() < SETSU.acc * (safe ? 0.3 : 1) * (1 + env.wave / 5) * (env.stab ? 0.8 : 1) * (m.hullRide || 1)) { res.marks[id] = Math.random() < 0.5 ? '転' : '落'; return; }
    const dash = i >= 3, tn = dash ? 0.45 : 0.25;
    const mach = (m.deashi - 1) * (0.75 - tn) * 0.5 + (m.mid - 1) * (0.75 - tn) * 0.5 + (m.nobi - 1) * tn + (m.powerK - 1) * 0.6 + (m.weightK - 1) * 0.5 + (m.hullGrip - 1) * 0.25 + (m.weightGrip - 1) * 0.15;
    // wind: 向かい風 helps the dash (the in boat drifts), 追い風 the in
    const wind = we.wx * (i === 0 ? 0.035 : dash ? -0.03 : 0);
    const tl = q.player ? (q.tilt || 0) : 0;   // my tilt (CPU tilts are set on the water)
    const tilt = tl * (TILT.nobi * tn - TILT.deashi * (0.75 - tn)) - TILT.grip * Math.max(0, tl) * 0.25 - (tl >= 2 ? 0.006 * (tl - 1.5) * (1 + env.wave / 4) : 0);
    const s = setsuSkillScore(q, i) + (safe ? SETSU.omakase : 0) + SETSU.motorK * 1.6 * (mach + tilt) + wind - (st - 0.15) * 2;
    pool.push({ id, w: SETSU.courseW[i] * Math.exp(SETSU.skillK * s) });
  });
  while (pool.length) {
    let r = Math.random() * pool.reduce((a, p) => a + p.w, 0), k = 0;
    for (; k < pool.length - 1; k++) if ((r -= pool[k].w) < 0) break;
    res.order.push(pool[k].id); pool.splice(k, 1);
  }
  return res;
}
function setsuRecord(race, res) {
  race.result = res;
  race.entries.forEach((id, i) => {
    const q = setsu.racers[id], idx = res.order.indexOf(id), mark = res.marks[id] || null;
    const place = idx >= 0 ? idx + 1 : null;
    let pts = place ? SETSU.pts[place - 1] : 0;
    if (res.fouls && res.fouls[id]) pts += SETSU.foulPts * res.fouls[id];
    const fr = res.furyo && res.furyo[id] || 0;
    if (fr) { pts += SETSU.furyoPts * fr; q.furyo = (q.furyo || 0) + fr; }
    if (mark === '失') pts += SETSU.dqPts;   // d167: 妨害失格 −15
    q.runs.push({ day: race.day, R: race.R, kind: race.kind, waku: i + 1, place, mark, pts, st: res.st[id], furyo: fr || 0, self: !!(q.player && res.self) });
    if (mark === 'F' || mark === 'L' || mark === '失' || (q.furyo || 0) >= 2) q.excl = true;
    if (q.motor && q.motor.cond != null) q.motor.cond = Math.max(0.93, q.motor.cond - (SETSU.wear[q.motor.dur] || 0.004) - (mark === '転' || mark === '落' ? 0.015 : 0));
  });
  if (race.kind === '優勝戦' && res.order.length) setsu.champ = res.order[0];
}
function setsuMyToast(race) {
  const me = setsuMe(), x = me.runs.find(r => r.day === race.day && r.R === race.R); if (!x) return;
  toast(`${race.R}R ${race.kind}`, x.mark ? `あなた ${x.mark}` : `あなた ${x.place}着（${x.pts}点）`, x.place === 1 ? 'good' : x.mark ? 'bad' : 'info');
}
function setsuSave() { try { localStorage.setItem(SETSU.key, JSON.stringify(setsu)); } catch (e) {} }
function setsuLoad() { try { const s = JSON.parse(localStorage.getItem(SETSU.key) || 'null'); return s && s.v === 5 ? s : null; } catch (e) { return null; } }
function setsuClear() { try { localStorage.removeItem(SETSU.key); } catch (e) {} }

/* ---- flow ---- */
let setsuTab = 'ban', setsuPre = null;   // setsuPre: the race of mine waiting to start (pre-race panel)
function setsuOpen() { paused = true; $('setsu').hidden = false; setsuRender(); }
function setsuHide() { $('setsu').hidden = true; }
// run the day forward: instant results until a race that needs me (mine, or one marked to watch)
function setsuAdvance(mode = 'step') {
  if (!setsu) return;
  if (setsu.day === 0) { setsuNextDay(); if (mode !== 'setsu') return; }
  for (const race of setsuToday()) {
    if (race.result) continue;
    const mine = setsuHasMe(race);
    if (mine && mode === 'step') { setsuPre = race; setsuRender(); return; }
    if (!mine && race.watch && mode === 'step') { setsuRun(race, false); return; }
    setsuRecord(race, setsuQuick(race, mine));
  }
  setsuSave();
  if (mode === 'setsu' && setsu.day < SETSU.days) { setsuNextDay(); setsuAdvance('setsu'); return; }
  setsuRender();
}
function setsuNextDay() {
  if (setsu.day >= SETSU.days) return;
  setsu.day++; setsuBuildDay(setsu.day);
  for (const q of setsu.racers) if (q.motor && q.motor.cond != null) q.motor.cond += (1 - q.motor.cond) * SETSU.recover;
  { const me = setsuMe(); if (me) me.form = Math.round(clamp(me.form == null ? 50 + gauss() * 18 : me.form * 0.5 + 25 + gauss() * 16, 5, 95)); }   // 調子（仮）: drifts day to day   // 整備 overnight (AP later) setsuPre = null; setsuTab = 'ban'; setsuSave(); setsuRender();
}
// on the water: my race (I ride) or a race I watch
function setsuRun(race, ride) {
  const rows = setsuRows(race), me = setsuMe();
  const myNo = ride ? race.entries.indexOf(me.id) + 1 : null;
  if (ride) { playerTilt = me.tilt; const ts = $('tiltSel'); if (ts) ts.value = String(me.tilt); }
  setsuHide(); setsuPre = null; paused = false; last = performance.now(); initAudio();
  if (!$('slitPhoto').hidden) $('slitPhoto').hidden = true;
  const env = setsuRaceEnv(race);
  startEntry(myNo, 'race', { rows, setsu: { race }, env: setsuWaterEnv(env) });
  toast(`${SETSU.dayJa[setsu.day]} ${race.R}R ${race.kind}`, (ride ? `${myNo}号艇で出走` : '観戦中（「結果へ」で飛ばせます）') + ' ・ ' + setsuEnvTxt(env), 'info');
}
// the race on the water is over: read the result off the fleet
function setsuRaceDone(abandon) {
  const f = fleet, race = f.setsu.race;
  const res = { order: [], marks: {}, st: {}, fouls: {}, self: !!f.playerNo };
  for (const r of f.rank) {
    res.st[r.sid] = r.st;
    if (r.entryViol && r.entryViol.length) res.fouls[r.sid] = r.entryViol.length;
    if (r.fouls) (res.furyo || (res.furyo = {}))[r.sid] = r.fouls;
    if (r.flying) res.marks[r.sid] = 'F';
    else if (r.st != null && r.st > 1) res.marks[r.sid] = 'L';
    else if (r.out) res.marks[r.sid] = r.out === '落水' ? '落' : '転';
    else if (abandon && r.player) res.marks[r.sid] = '欠';
    else if (r.dq) res.marks[r.sid] = '失';
    else if (r.fin != null || r.skipped) res.order.push(r.sid);
  }
  // still out on the course (cut short): in their running order
  for (const r of f.rank) if (!res.marks[r.sid] && !res.order.includes(r.sid)) res.order.push(r.sid);
  if (runLog) runLogEnd('節間');
  fleet = null; waterEnv = null; $('order').hidden = true; refreshFleetUi();
  setsuRecord(race, res); setsuSave();
  if (res.self) setsuMyToast(race);
  setsuOpen();
}
// 観戦をやめる: the rest of this race is worked out instantly
function setsuSkipWatch() {
  const race = fleet.setsu.race;
  fleet = null; waterEnv = null; $('order').hidden = true; refreshFleetUi();
  setsuRecord(race, setsuQuick(race, false)); setsuSave(); setsuOpen();
}

/* ---- screen ---- */
const setsuClsJa = c => c === 'TOP' ? 'A1★' : c;
const setsuEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setsuMotorTag = q => q.motor.rank === 1 ? `<b style="color:#ffb02e">★${q.motorNo}</b>` : q.motor.rank <= 6 ? `<b style="color:#ffb02e">${q.motorNo}</b>` : String(q.motorNo);
const setsuMark = (x) => x.mark ? x.mark : x.place ? String(x.place) : '-';
function setsuChip(i) { const c = LANE_COL[i]; return `<i class="sw" style="background:${c[0]};color:${c[1]}">${i + 1}</i>`; }
function setsuRaceTable(race) {
  const res = race.result;
  const rows = race.entries.map((id, i) => {
    const q = setsu.racers[id];
    const run = res ? q.runs.find(x => x.day === race.day && x.R === race.R) : null;
    const st = res && res.st[id] != null ? (res.st[id] < 0 ? 'F' + (-res.st[id]).toFixed(2).slice(1) : res.st[id].toFixed(2).replace(/^0/, '')) : '';
    return `<tr class="${q.player ? 'me' : ''}"><td>${setsuChip(i)}</td><td class="nm">${setsuEsc(q.name)}<small> ${q.sex === 'f' ? '♀' : ''}${q.height ? q.height + 'cm ' : ''}${setsuEffWt(q)}kg${setsuBestCourse(q) ? ` 得意${setsuBestCourse(q)}c` : ''}</small></td><td>${setsuClsJa(q.cls)}</td><td class="num">${setsuRate(q).toFixed(2)}</td><td class="num">${setsuMotorTag(q)}<small>(${q.motor.m2}%)</small> <small>${['low', 'mid', 'top'].map(k => setsuEvMark(setsuEv(q, k))).join('')}</small></td><td class="num pl">${run ? setsuMark(run) : ''}</td><td class="num">${st}</td></tr>`;
  }).join('');
  return `<table class="race st"><thead><tr><th>枠</th><th>選手</th><th>級</th><th>得点率</th><th>モーター<small>(2連率) 出回伸</small></th><th>着</th><th>ST</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function setsuRender() {
  if (!setsu) return;
  const me = setsuMe(), st = setsuStandings(), myRank = st.indexOf(me) + 1;
  const d = setsu.day;
  $('setsuTitle').innerHTML = `<small>${setsu.grade === 'sg' ? 'SG競走' : '一般戦'} ・ ${setsuEsc(me.name)}（${setsuClsJa(me.cls)}）</small>${SETSU.dayJa[d]}`;
  $('setsuMeLine').textContent = d === 0 ? `モーター ${me.motorNo}号機（2連率 ${me.motor.m2}%）・ボート ${me.boatNo}号艇`
    : `得点率 ${setsuRate(me).toFixed(2)}（${me.excl ? '賞典除外' : myRank + '位/48'}）  ` + me.runs.map(setsuMark).join(' ');
  for (const b of document.querySelectorAll('#setsuTabs button')) b.classList.toggle('on', b.dataset.t === setsuTab && !setsuPre);
  const body = $('setsuBody'); let h = '';
  const done = d > 0 && setsuToday().every(r => r.result);
  if (setsuPre) {
    h += `<p class="setsu-h">${setsuPre.R}R ${setsuPre.kind} — あなたは${setsuPre.entries.indexOf(me.id) + 1}号艇</p><p>${setsuEnvTxt(setsuRaceEnv(setsuPre))}</p><p>今日の調子（仮）：${me.form ?? 50}　— 高いほどスタートの「イケるっ」が出やすく当たりやすい。低いと弱気の「早いっ」に騙されやすく、高すぎると浮ついた「イケるっ」が混じる</p>`;
    h += `<div class="row"><button class="btn" id="sRide">自分で走る</button><button class="btn ghost" id="sAuto">おまかせ（安全運転）</button><button class="btn ghost" id="sBack">戻る</button></div>`;
    h += setsuRaceTable(setsuPre) + setsuSeibi() + `<p>おまかせは無理をしない走りで、フライングや事故は起きませんが、着順は自分で走るより落ちやすくなります。</p>`;
  } else if (setsuTab === 'ban') {
    if (d === 0) h += `<p class="setsu-h">前検日：モーター・ボートの抽選</p><p>あなたは <b>${me.motorNo}号機</b>（2連率 ${me.motor.m2}%）、<b>${me.boatNo}号艇</b>を引きました。「整備」でチルトとペラを決めて、初日へ進みます。</p>` + setsuMotorLine(me) + `<p>上位機の行き先：${setsu.racers.filter(q => q.motor.rank <= 6).sort((x, y) => x.motor.rank - y.motor.rank).map(q => `${setsuMotorTag(q)}(${q.motor.m2}%) ${setsuEsc(q.name)}`).join('、') || 'なし'}</p>` + `<p>開催：${(SETSU.season[setsu.season] || SETSU.season.spring).ja}・${venueOf(setsu.venue).name}・水質 ${venueOf(setsu.venue).water}${venueOf(setsu.venue).tide.amp > 0 ? '（潮の満ち引きあり）' : ''}。風は日によって強弱があり、1日に何度か向きが変わります。</p>`;
    else for (const race of setsuToday()) {
      const mine = setsuHasMe(race);
      const watch = !race.result && !mine ? `<label class="wt"><input type="checkbox" data-w="${race.R}" ${race.watch ? 'checked' : ''}>観戦</label>` : '';
      h += `<div class="setsu-r ${mine ? 'mine' : ''} ${race.result ? 'done' : ''}"><div class="setsu-rh"><b>${race.R}R</b> ${race.kind}${mine ? ' <span class="tag">出走</span>' : ''}${watch}<br><small>${setsuEnvTxt(setsuRaceEnv(race))}</small></div>${setsuRaceTable(race)}</div>`;
    }
    if (d === SETSU.days && done) {
      const c = setsu.racers[setsu.champ];
      h = `<p class="setsu-h">優勝 ${c ? setsuEsc(c.name) + '（' + setsuClsJa(c.cls) + '）' : '—'}${c && c.player ? ' — おめでとう！' : ''}</p>` + setsuSummary() + (() => { const f = setsu.races.find(r => r.kind === '優勝戦'); return f ? `<div class="setsu-r mine"><div class="setsu-rh"><b>12R</b> 優勝戦</div>${setsuRaceTable(f)}</div>` : ''; })() + h;
    }
  } else if (setsuTab === 'rank') {
    h += `<table class="race st"><thead><tr><th>順</th><th>選手</th><th>級</th><th>得点率</th><th>成績</th></tr></thead><tbody>` +
      st.map((q, i) => `<tr class="${q.player ? 'me' : ''}"><td class="num">${q.excl ? '除' : i + 1}</td><td class="nm">${setsuEsc(q.name)}</td><td>${setsuClsJa(q.cls)}</td><td class="num">${setsuRate(q).toFixed(2)}</td><td class="num runs">${q.runs.map(setsuMark).join(' ')}</td></tr>`).join('') + `</tbody></table><p>予選は 1着10・2着8・3着6・4着4・5着2・6着1点の平均（得点率）。不良航法は${SETSU.furyoPts}点（2回で賞典除外、準優勝戦なら優勝戦に乗れません）。妨害失格は${SETSU.dqPts}点で賞典除外。フライング・出遅れは賞典除外（準優・優勝戦に乗れません）。上位18人が5日目の準優勝戦へ、準優の1・2着が優勝戦へ。</p>`;
  } else if (setsuTab === 'seibi') {
    h += setsuMotorLine(me) + setsuSeibi();
  }
  body.innerHTML = h;
  const cd = $('setsu').querySelector('.card'); if (cd) cd.scrollTop = 0;
  const nx = $('setsuNext');
  nx.hidden = !!setsuPre;
  nx.textContent = d === 0 ? '初日へ' : done ? (d < SETSU.days ? '翌日へ' : '節を終える') : '次のレースへ';
  $('setsuDay').hidden = !!setsuPre || d === 0 || done;
  $('setsuAll').hidden = !!setsuPre || (d === SETSU.days && done);
  wireSetsuBody();
}
function setsuMotorLine(q) {
  const mo = q.motor, bt = q.boat || {}, adj = setsuAdjWt(q);
  const rk = mo.rank === 1 ? '★エース機（2連率 場内1位）' : mo.rank <= 6 ? `上位機（2連率 場内${mo.rank}位）` : `2連率 場内${mo.rank}位/60`;
  return `<p>モーター ${q.motorNo}号機 2連率 ${mo.m2}% ・ ${rk}<br>`
    + `記者評価：出足 ${setsuEvMark(setsuEv(q, 'low'))} ・ 回り足 ${setsuEvMark(setsuEv(q, 'mid'))} ・ 伸び ${setsuEvMark(setsuEv(q, 'top'))}（◎上位 ○やや上 －並 △やや下 ×下位。あくまで外からの見立て）<br>`
    + `ボート ${q.boatNo}号艇 2連率 ${bt.m2 ?? '—'}%<br>`
    + `${q.height ? `身長 ${q.height}cm${q.height > SETSU.body.hMax ? '（デビュー後に伸びた）' : ''}　` : ''}体重 ${q.weight.toFixed(1)}kg${adj ? `（最低${SETSU.minWt[q.sex]}kg：ベスト＋重り ${adj.toFixed(1)}kg）` : ''}</p>`;
}
function setsuSeibi() {
  const me = setsuMe();
  const tl = SETSU.tilts.map(t => `<option value="${t}" ${t === me.tilt ? 'selected' : ''}>${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t).toFixed(1)}</option>`).join('');
  const pr = Object.entries(SETSU.props).map(([k, p]) => `<option value="${k}" ${k === me.prop ? 'selected' : ''}>${p.ja}</option>`).join('');
  return `<div class="row setsu-seibi"><label>チルト <select id="sTilt">${tl}</select></label><label>ペラ <select id="sProp">${pr}</select></label></div><p>チルトを上げると伸びが出る代わりに出足とターンが甘くなります。+2.0以上は艇首が浮いて跳ねやすく（波・引き波・ターンで特に）、直線番長向き。ペラはモーターに付いてきた前の選手の形のままか、出足型・伸び型に叩き直すか（仮。おまかせのときも反映）。</p>`;
}
function setsuSummary() {
  const me = setsuMe(), runs = me.runs;
  const wins = runs.filter(x => x.place === 1).length, n = runs.length;
  const fin = runs.find(x => x.kind === '優勝戦'), semi = runs.find(x => x.kind === '準優勝戦');
  return `<p>あなたの節：${n}走 ${wins}勝 ・ 予選得点率 ${setsuRate(me).toFixed(2)}${me.excl ? '（賞典除外）' : ''} ・ ${fin ? '優勝戦 ' + setsuMark(fin) + '着' : semi ? '準優 ' + setsuMark(semi) + '着' : '予選敗退'}</p>`;
}
function wireSetsuBody() {
  for (const cb of document.querySelectorAll('#setsuBody input[data-w]')) cb.addEventListener('change', e => { const r = setsuToday().find(x => x.R === +e.target.dataset.w); if (r) { r.watch = e.target.checked; setsuSave(); } });
  const me = setsuMe();
  const t = $('sTilt'); if (t) t.addEventListener('change', e => { me.tilt = +e.target.value; setsuSave(); });
  const p = $('sProp'); if (p) p.addEventListener('change', e => { me.prop = e.target.value; setsuSave(); setsuRender(); });
  const ride = $('sRide'); if (ride) ride.addEventListener('click', () => setsuRun(setsuPre, true));
  const auto = $('sAuto'); if (auto) auto.addEventListener('click', () => { const r = setsuPre; setsuPre = null; setsuRecord(r, setsuQuick(r, true)); setsuSave(); setsuMyToast(r); setsuRender(); });
  const back = $('sBack'); if (back) back.addEventListener('click', () => { setsuPre = null; setsuRender(); });
}
function setsuStart() {
  const saved = setsuLoad();
  $('setsuResume').hidden = !saved;
  if (saved) $('setsuResumeTxt').textContent = `続き：${saved.grade === 'sg' ? 'SG' : '一般戦'}・${saved.racers.find(q => q.player).name}・${SETSU.dayJa[saved.day]}`;
  $('pmenu').hidden = true; paused = true; $('setsuNewBox').hidden = false;
}
if (typeof document !== 'undefined' && document.getElementById('setsu')) {
  $('pmSetsu').addEventListener('click', () => { if (fleet) quitFleet(); setsuStart(); });
  $('pmReplay').addEventListener('click', () => { rpWasPaused = true; rpFromMenu = true; $('pmenu').hidden = true; rpOpen(0); });
  $('setsuGo').addEventListener('click', () => { $('setsuNewBox').hidden = true; setsuNew($('setsuName').value.trim().slice(0, 12), $('setsuCls').value, $('setsuGrade').value, { sex: $('setsuSex').value, weight: +$('setsuWt').value || 0, height: +$('setsuHt').value || 0, season: $('setsuSeason').value }); setsuTab = 'ban'; setsuPre = null; setsuOpen(); });
  $('setsuResume').addEventListener('click', () => { $('setsuNewBox').hidden = true; setsu = setsuLoad(); setsuTab = 'ban'; setsuPre = null; setsuOpen(); });
  $('setsuSex').addEventListener('change', e => { $('setsuWt').value = e.target.value === 'f' ? '48' : '53'; });
  $('setsuNewClose').addEventListener('click', () => { $('setsuNewBox').hidden = true; paused = false; last = performance.now(); });
  // a tap is a user gesture: if full screen was lost somewhere, take it back
  for (const id of ['setsuNext', 'setsuDay', 'setsuAll', 'setsuQuit', 'setsuGo', 'setsuResume']) $(id).addEventListener('click', () => { if (orient.full && !document.fullscreenElement) lockLandscape(); });
  $('setsuNext').addEventListener('click', () => {
    const done = setsu.day > 0 && setsuToday().every(r => r.result);
    if (setsu.day === 0 || (done && setsu.day < SETSU.days)) setsuNextDay();
    else if (done) { setsuClear(); setsu = null; setsuHide(); paused = false; last = performance.now(); toast('節間モード', '節が終わりました', 'good'); }
    else setsuAdvance('step');
  });
  $('setsuDay').addEventListener('click', () => setsuAdvance('day'));
  $('setsuAll').addEventListener('click', () => askConfirm('節の最後までおまかせで進めますか？（自分のレースもおまかせ）', () => setsuAdvance('setsu')));
  $('setsuQuit').addEventListener('click', () => { setsuSave(); setsuHide(); paused = false; last = performance.now(); toast('節間モード', '中断しました。練習メニューの「節間モード」から続きができます', 'info'); });
  for (const b of document.querySelectorAll('#setsuTabs button')) b.addEventListener('click', () => { setsuPre = null; setsuTab = b.dataset.t; setsuRender(); });
}

