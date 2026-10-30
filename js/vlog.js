/* ---------- 動画用ログ (d164 — HFGP_video_log_implementation_spec v2, file format hfgp-video-replay v1) ----------
   For the separate replay / video app: every boat 60 times a second of race time (t = s from the big clock's zero),
   from 20 s before the start (or from the first moment there is, if the run-up is shorter) until 5 s after the race is
   decided, plus timed events and the official result.
   It lives in memory for the race on screen only. It becomes a file only when リプレイ保存 is pressed on the result,
   and it is dropped the moment the player moves on — no history, nothing in localStorage / IndexedDB / anywhere.
   It only reads the race: no RNG (simRandom / Math.random), no writes to boats, rows or the fleet. */
const VLOG = { formatFeatures: ['highlights-v1', 'trim-pop-v1', 'racer-profile-v1', 'hull-size-v1'], hz: 60, pre: 20, post: 5, maxMiB: 32, chunk: 600, format: 'hfgp-video-replay', formatVersion: 1,
  audioProfileId: 'hfgp-engine-d164', modelSpecId: 'boat3d-d163', venueId: 'standard', courseVersion: 1,
  contactGap: 0.25, contactMinJ: 0.05, bumpEv: 0.3, landEv: 0.5, waitPost: 3 };
const VL_FIELDS = ['x', 'y', 'heading', 'v', 'bank', 'slip', 'hop', 'wil', 'porp', 'roll', 'pitch', 'steer', 'thr', 'splashK', 'rpm', 'vl', 'yaw', 'wakeBump', 'flags', 'lap', 'rank', 'fx', 'fy', 'hv', 'landV', 'progress'];
const VL_NF = VL_FIELDS.length;
// decimals kept in the file for each field (null = whole number)
const VL_DEC = [2, 2, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, null, null, null, 2, 2, 3, 3, 2];
const VL_ANGLE = new Set([2, 5]);                 // heading, slip: interpolate the short way round ±π
const VL_STEP = new Set([18, 19, 20, 21, 22]);    // flags, lap, rank, fx, fy: never blended, nearest step
const VL_FLAG = { capHull: 1, fallen: 2, retired: 4, dq: 8, flying: 16, finished: 32, relegated: 64, player: 128, jump: 256 };
// d171 見どころ (まえ: make the replay log richer for the video app's camera and slow motion): the game writes down the
// moments it already judges — the slit line-up, how the first turn went (決まり手), every change of place that held,
// a bow in on the boat outside going into a turn (舳先がかかる), long side-by-side fights — and a scored list of
// highlight windows built from all the events. Still read-only: nothing here touches the race.
const VL_HL = { passHold: 1.0, near: 40, ovL: [0.5, 6], ovF: [-12, 2], ovMin: 0.3, duelF: 4, duelL: 7, duelMin: 1.5, top: 6 };
// d199 (まえ): replay-video logs are a PC thing — on a phone or tablet nothing about them shows and nothing is recorded
// (a mouse/trackpad as the main pointer counts as a PC, touch-screen laptops included)
const vlPC = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } })();
let vlOn = vlPC;
try { vlOn = vlPC && localStorage.getItem('honorGP.vlog') !== 'off'; } catch (e) {}
let vlHold = false;   // 6艇デモ: wait on the result so this race can be saved (not saved by itself — the button still has to be pressed)

VR = (() => {
  let R = null, gen = 0, seq = 0, url = null;
  const nowZero = () => SS.t0 + CLOCK;
  const fin = v => Number.isFinite(v) ? v : NaN;
  const rowsOf = () => R.solo ? [{ no: 1, b: B, r: null }] : fleet.boats.map(r => ({ no: r.no, b: r.b, r }));
  // one boat's state as the race has it right now (the applied input comes from the physics call, not the device)
  function snap(out, k, row, rankOf) {
    const b = row.b, r = row.r, inp = R.inp.get(b) || { thr: 0, steer: 0, roll: 0, pitch: 0 }, o = k * VL_NF;
    let fl = 0;
    if (b.cap > 0 && !b.fallen) fl |= VL_FLAG.capHull;
    if (b.fallen) fl |= VL_FLAG.fallen;
    if (r) {
      if (r.flying && r.passed1M) fl |= VL_FLAG.retired;
      if (r.dq) fl |= VL_FLAG.dq;
      if (r.flying) fl |= VL_FLAG.flying;
      if (r.fin != null && !r.skipped) fl |= VL_FLAG.finished;
      if (r.relegated) fl |= VL_FLAG.relegated;
      if (r.player) fl |= VL_FLAG.player;
    } else { fl |= VL_FLAG.player; if (ta.done) fl |= VL_FLAG.finished; }
    const v = [b.x, b.y, b.a, b.v, b.bank || 0, b.slip || 0, b.hop || 0, b.wil || 0, b.porp || 0, inp.roll || 0, inp.pitch || 0, inp.steer || 0, inp.thr || 0,
      b.splashK || 0, engineRpm(b, inp.thr || 0), b.vl || 0, b.yaw || 0, b.wakeBump || 0, fl, r ? r.laps : lap.n, rankOf(row),
      b.fallen ? b.fx : NaN, b.fallen ? b.fy : NaN, b.hv || 0, b.landV || 0, r ? r.prog : NaN];
    for (let i = 0; i < VL_NF; i++) out[o + i] = i === 21 || i === 22 || i === 25 ? fin(v[i]) : (Number.isFinite(v[i]) ? v[i] : 0);
  }
  function begin(mode) {
    discard();
    if (!vlOn || lab.active) return;
    gen++; seq++;
    const at = new Date();
    R = { gen, mode, solo: mode === 'ta', id: `${at.getTime().toString(36)}${seq}`, createdAt: at, inp: new WeakMap(), prevBoat: new Map(), contactAt: new Map(),
      zeroT: null, ring: [], prev: null, origin: null, n: 0, chunks: [], cur: null, curN: 0, nb: 0, events: [],
      endT: null, endReason: null, endNote: null, results: null, state: 'RECORDING', full: false, terminal: null,
      q: { steps: 0, maxDt: 0, jumps: 0, firstT: null, lastT: null, coastFrom: null }, blob: null, file: null };
  }
  function discard() {
    if (R) gen++;
    R = null;
    if (url) { const u = url; url = null; setTimeout(() => URL.revokeObjectURL(u), 60000); }
    vlUi();
  }
  const ev = (type, no, payload, at) => { if (!R || R.state === 'IDLE') return; R.events.push({ T: at != null ? at : time, type, no: no == null ? null : no, payload: payload || null }); };
  // hull contact: one event per pair per VLOG.contactGap s (a rub lasts several steps), the hardest hit of it kept
  function contact(a, b, e) {
    if (!R || !(e.J >= VLOG.contactMinJ)) return;   // resting hulls touching (J ≈ 0) are not hits
    const k = Math.min(a, b) * 10 + Math.max(a, b), last = R.contactAt.get(k);
    if (last && time - last.T < VLOG.contactGap) { if (e.J > last.payload.J) Object.assign(last.payload, { J: e.J, x: e.x, y: e.y }); return; }
    const E = { T: time, type: 'contact', no: a, payload: { other: b, J: e.J, x: e.x, y: e.y } };
    R.events.push(E); R.contactAt.set(k, E);
  }
  // the physics call's input for this hull (thr, steer, roll, pitch as actually applied)
  const inp = (b, i) => { if (R) R.inp.set(b, { thr: i.thr || 0, steer: i.steer || 0, roll: i.roll || 0, pitch: i.pitch || 0 }); };
  // short moments a 60 Hz sample could miss: the bow coming up, a landing, the hull digging in, a wake hit
  function watch(rows) {
    for (const row of rows) {
      const b = row.b, p = R.prevBoat.get(b) || {};
      const wil = (b.wilT || 0) > 0, bump = b.wakeBump || 0, vis = row.r ? row.r.vis || 0 : 0;
      if (wil && !p.wil) ev('willie_start', row.no, null);
      if (!wil && p.wil) ev('willie_end', row.no, null);
      if (b.snapAt != null && p.snapAt != null && b.snapAt !== p.snapAt) ev('trim_pop', row.no, { push: +(b.kickK || 0).toFixed(2) });   // d173 後ろ重心: the bow thrown up
      if (b.landAge === 0 && p.landAge !== 0 && (b.landV || 0) > VLOG.landEv) ev('landing', row.no, { v: b.landV });
      if (b.stuckAge === 0 && p.stuckAge !== 0) ev('bow_dig', row.no, null);
      if (bump > VLOG.bumpEv && !(p.bump > VLOG.bumpEv)) ev('wake_hit', row.no, { bump });
      if (row.r) {
        const nw = vis & ~(p.vis || 0);
        if (row.r.st != null && nw & 1) ev('mark', row.no, { mark: '1M', lap: row.r.laps + 1 });
        if (row.r.st != null && nw & 2) ev('mark', row.no, { mark: '2M', lap: row.r.laps + 1 });
        const ret = !!(row.r.flying && row.r.passed1M);
        if (ret && !p.ret) ev('retire', row.no, null);
        p.ret = ret;
      }
      Object.assign(p, { wil, bump, vis, landAge: b.landAge, stuckAge: b.stuckAge, snapAt: b.snapAt ?? -9 }); R.prevBoat.set(b, p);
    }
  }
  // 見どころ: the race's own judgements, read off the fleet each step (no RNG, no writes)
  const runningNow = r => !r.out && !r.dq && !r.flying && !(r.b.cap > 0) && r.fin == null && !r.skipped;
  const zoneOf = b => b.x > MK - VL_HL.near ? '1M' : b.x < -(MK - VL_HL.near) ? '2M' : 'straight';
  function plays() {
    if (R.solo || R.zeroT == null || time < R.zeroT || !fleet) return;
    const P = R.pl || (R.pl = { pair: new Map(), ov: new Map(), duel: new Map(), slit: false, k1: false, live: false });
    // スリット: the line-up the moment the first boat reaches the start line
    if (!P.slit && fleet.boats.some(r => r.st != null)) {
      P.slit = true;
      const bx = new Map(fleet.boats.map(r => [r, boatBow(r.b).x])), lead = Math.max(...bx.values());
      const first = fleet.boats.find(r => bx.get(r) === lead);
      ev('slit', first.no, { boats: fleet.boats.map(r => ({ no: r.no, course: r.trait.course, dash: !r.trait.slow, gapM: +(lead - bx.get(r)).toFixed(2), kmh: +(r.b.v * 3.6).toFixed(1), flying: !!r.flying })) });
    }
    // 1周1M が終わった（決まり手の判定と同じ時点）
    if (!P.k1 && fleet.k1) {
      P.k1 = true; const L = fleet.k1.lead;
      ev('first_turn', L.no, { kimarite: kimariteOf(L), order: fleet.rank.filter(r => !r.out && !r.dq && !r.flying).map(r => r.no) });
    }
    const run = fleet.boats.filter(runningNow), order = fleet.rank.filter(r => run.includes(r)), pos = new Map(order.map((r, i) => [r, i]));
    // passes and fights count from the first boat reaching the 1M approach — before that it is the start's line-up (スリット)
    if (!P.live) { if (!run.some(r => r.b.x > MK - VL_HL.near)) return; P.live = true; }
    for (let i = 0; i < run.length; i++) for (let j = i + 1; j < run.length; j++) {
      const a = run[i], b = run[j], k = a.no * 10 + b.no;
      // 順位の入れ替わり: the new order has to hold for passHold s; the event is dated when it changed
      const ahead = pos.get(a) < pos.get(b), s = P.pair.get(k);
      if (!s) P.pair.set(k, { st: ahead, cand: null });
      else if (ahead === s.st) s.cand = null;
      else if (s.cand == null) s.cand = time;
      else if (time - s.cand >= VL_HL.passHold) {
        s.st = ahead; const w = ahead ? a : b, o = ahead ? b : a;
        ev('pass', w.no, { other: o.no, place: pos.get(w) + 1, lead: pos.get(w) === 0, where: zoneOf(w.b), lap: w.laps + 1 }, s.cand); s.cand = null;
      }
      // 舳先がかかる (the CPU's own test, race.js): going into or through a turn, the inside boat's bow past the outside boat's stern
      for (const [A, q] of [[a, b], [b, a]]) {
        const ko = q.no * 10 + A.no, fx = Math.cos(A.b.a), fy = Math.sin(A.b.a), dx = q.b.x - A.b.x, dy = q.b.y - A.b.y;
        const f = dx * fx + dy * fy, l = -dx * fy + dy * fx, qBow = f + BOW_TIP;
        const on = zoneOf(A.b) !== 'straight' && l < -VL_HL.ovL[0] && l > -VL_HL.ovL[1] && f > VL_HL.ovF[0] && f < VL_HL.ovF[1] && qBow > -HESAKI.stern;
        const o = P.ov.get(ko);
        if (on) { const d = qBow + HESAKI.stern; if (!o) P.ov.set(ko, { T: time, d, cock: qBow >= HESAKI.deep, where: zoneOf(A.b), lap: A.laps + 1 }); else { o.d = Math.max(o.d, d); o.cock = o.cock || qBow >= HESAKI.deep; }
          const po = P.ov.get(ko); if (A.b.hzPlan && A.b.hzPlan.side === 'out') po.outPlan = A.b.hzPlan.plan; if (q.b.hzPlan && q.b.hzPlan.side === 'in') po.inPlan = q.b.hzPlan.plan; }
        else if (o) { closeOv(ko, o); P.ov.delete(ko); }
      }
      // 競り合い: hulls level (overlapping along the heading) and close side by side, kept up
      const fx = Math.cos(a.b.a), fy = Math.sin(a.b.a), dx = b.b.x - a.b.x, dy = b.b.y - a.b.y;
      const level = Math.abs(dx * fx + dy * fy) < VL_HL.duelF && Math.abs(-dx * fy + dy * fx) < VL_HL.duelL, du = P.duel.get(k);
      const best = Math.min(pos.get(a), pos.get(b)) + 1;
      if (level) { if (!du) P.duel.set(k, { T: time, a: a.no, b: b.no, best, last: time }); else { du.best = Math.min(du.best, best); du.last = time; } }
      else if (du) { closeDuel(k, du); P.duel.delete(k); }
    }
    // a boat that drops out ends its overlaps and fights
    for (const [k, o] of P.ov) if (!run.some(r => r.no === Math.floor(k / 10)) || !run.some(r => r.no === k % 10)) { closeOv(k, o); P.ov.delete(k); }
    for (const [k, du] of P.duel) if (!run.some(r => r.no === du.a) || !run.some(r => r.no === du.b)) { closeDuel(k, du); P.duel.delete(k); }
  }
  function closeOv(k, o) { const sec = time - o.T; if (sec >= VL_HL.ovMin) ev('bow_overlap', Math.floor(k / 10), { other: k % 10, sec: +sec.toFixed(2), depthM: +o.d.toFixed(2), level: o.cock ? 'cockpit' : 'bow', where: o.where, lap: o.lap, outerPlan: o.outPlan || null, innerPlan: o.inPlan || null }, o.T); }
  function closeDuel(k, du) { const sec = du.last - du.T; if (sec >= VL_HL.duelMin) ev('duel', du.a, { other: du.b, sec: +sec.toFixed(2), bestPlace: du.best }, du.T); }
  function flushPlays() {
    if (!R || !R.pl) return;
    for (const [k, o] of R.pl.ov) closeOv(k, o);
    for (const [k, du] of R.pl.duel) closeDuel(k, du);
    R.pl.ov.clear(); R.pl.duel.clear();
  }
  // the highlight list for the video app: windows (t0–t1, peak) scored 1–10, the best few that do not overlap marked top
  function highlights(E) {
    const H = [], add = (kind, t0, t1, peak, score, boats, note) => H.push({ kind, t0, t1, peak, score, boats: [...new Set(boats)], ...(note ? { note } : {}) });
    const first = (type, f = () => true) => E.find(e => e.type === type && f(e));
    const p0 = e => e.payload || {};
    const slit = first('slit'), sts = E.filter(e => e.type === 'st');
    if (sts.length) { const tS = slit ? slit.t : Math.min(...sts.map(e => e.t)); add('start', -4, tS + 3, tS, 7, slit ? [slit.no] : sts.map(e => e.no)); }
    const m1 = first('mark', e => p0(e).mark === '1M' && p0(e).lap === 1), ft = first('first_turn');
    if (m1) add('first_turn', m1.t - 2, Math.min((ft ? ft.t : m1.t + 6) + 1, m1.t + 12), m1.t + 1.5, 10, ft ? [ft.no] : [m1.no], ft ? p0(ft).kimarite : null);
    for (const e of E) {
      const p = p0(e);
      if (e.type === 'pass' && m1 && ft && e.t >= m1.t - 2 && e.t <= ft.t) continue;   // part of the first turn
      if (e.type === 'pass') add('pass', e.t - 3, e.t + 2, e.t, p.place === 1 ? 9 : p.place === 2 ? 6 : p.place === 3 ? 5 : 3, [e.no, p.other], p.where);
      else if (e.type === 'bow_overlap') add('bow_overlap', e.t - 1, e.t + p.sec + 1, e.t + p.sec / 2, p.level === 'cockpit' ? 6 : 4, [e.no, p.other], p.where);
      else if (e.type === 'duel') add('duel', e.t - 1, e.t + p.sec + 1, e.t + p.sec / 2, Math.min(8, 3 + Math.round(p.sec / 2)) + (p.bestPlace <= 2 ? 1 : 0), [e.no, p.other]);
      else if (e.type === 'capsize' || e.type === 'fall') add('accident', e.t - 4, e.t + 3, e.t, 8, [e.no]);
      else if (e.type === 'dump') add('dump', e.t - 2, e.t + 2, e.t, 5, [e.no, p.other]);
      else if (e.type === 'willie_start') add('willie', e.t - 1.5, e.t + 2.5, e.t + 0.5, 4, [e.no]);
      else if (e.type === 'photo') add('photo_finish', e.t - 4, e.t + 2, e.t, 9, [e.no, p.other]);
      else if (e.type === 'finish' && p.place === 1) add('winner_finish', e.t - 4, e.t + 3, e.t, 6, [e.no]);
    }
    // the same kind overlapping in time is one moment (a boat passing two at once, a pile-up)
    H.sort((a, b) => a.t0 - b.t0);
    const out = [];
    for (const h of H) {
      const m = out.find(o => o.kind === h.kind && h.t0 < o.t1 && (h.kind === 'accident' || (h.kind === 'pass' ? o.boats[0] === h.boats[0] : h.boats.every(n => o.boats.includes(n)))));
      if (m) { m.t1 = Math.max(m.t1, h.t1); if (h.score > m.score) { m.score = h.score; m.peak = h.peak; if (h.note) m.note = h.note; } m.boats = [...new Set(m.boats.concat(h.boats))]; }
      else out.push(h);
    }
    const lo = E.length ? Math.min(...E.map(e => e.t)) : -VLOG.pre, hi = R.endT != null ? rt(R.endT) + VLOG.post : Infinity;
    out.forEach((h, i) => { h.id = i + 1; h.t0 = Math.max(lo, +h.t0.toFixed(2)); h.t1 = Math.min(hi, +h.t1.toFixed(2)); h.peak = +Math.min(h.t1, Math.max(h.t0, h.peak)).toFixed(2); h.top = false; });
    const picked = [];
    for (const h of out.slice().sort((a, b) => b.score - a.score || a.t0 - b.t0)) {
      if (picked.length >= VL_HL.top) break;
      if (picked.some(o => h.t0 < o.t1 && o.t0 < h.t1)) continue;
      h.top = true; picked.push(h);
    }
    return out;
  }
  function store(vals, t) {
    if (!R.cur || R.curN === VLOG.chunk) {
      if ((R.chunks.length + 1) * VLOG.chunk * R.nb * VL_NF * 4 > VLOG.maxMiB * 1048576) { R.full = true; finish('ram_limit', t); return false; }
      R.cur = new Float32Array(VLOG.chunk * R.nb * VL_NF); R.curN = 0; R.chunks.push(R.cur);
    }
    R.cur.set(vals, R.curN * R.nb * VL_NF); R.curN++; R.n++;
    return true;
  }
  const lerpA = (a, b, f) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * f; };
  function blend(p, c, f, jump) {
    const o = new Float64Array(p.V.length), nf = jump ? (f < 1 ? 0 : 1) : f;
    for (let i = 0; i < o.length; i++) {
      const k = i % VL_NF;
      o[i] = VL_STEP.has(k) ? (nf < 0.5 ? p.V[i] : c.V[i]) : VL_ANGLE.has(k) ? lerpA(p.V[i], c.V[i], nf) : p.V[i] + (c.V[i] - p.V[i]) * nf;
      if (k === 21 || k === 22) o[i] = nf < 0.5 ? p.V[i] : c.V[i];
    }
    return o;
  }
  // the 60 Hz grid (t = origin + n/60, all on the zero-based grid): every grid time between two physics steps
  function emit(p, c) {
    const zr = R.zeroT, pt = p.T - zr, ct = c.T - zr, end = R.endT != null ? R.endT + VLOG.post - zr : Infinity;
    for (;;) {
      const t = R.origin + R.n / VLOG.hz;
      if (t > ct + 1e-9) break;
      if (t > end + 1e-9) { R.terminal = { t: end, V: blend(p, c, (end - pt) / Math.max(1e-9, ct - pt), c.jump) }; R.state = 'READY'; R.postSrc = R.postSrc || 'live'; vlUi(); return; }
      const V = blend(p, c, ct > pt ? Math.max(0, (t - pt) / (ct - pt)) : 1, c.jump);
      if (c.jump && t >= ct - 1e-9) for (let k = 0; k < R.nb; k++) V[k * VL_NF + 18] = V[k * VL_NF + 18] | VL_FLAG.jump;
      if (!store(V, t)) return;
    }
  }
  // after each physics step (fleet or the solo boat)
  function frame() {
    if (!R || R.state !== 'RECORDING') return;
    if (R.solo ? (fleet || soloKind !== 'ta') : !fleet) return;
    const rows = rowsOf();
    if (!R.nb) R.nb = rows.length;
    const rankOf = R.solo ? () => 1 : (row => { const i = fleet.rank.indexOf(row.r); return i < 0 ? 0 : i + 1; });
    const V = new Float64Array(R.nb * VL_NF);
    rows.forEach((row, k) => snap(V, k, row, rankOf));
    watch(rows);
    plays();
    const c = { T: time, V, jump: false };
    if (R.prev) {
      const dt = c.T - R.prev.T;
      if (dt <= 0) return;
      R.q.maxDt = Math.max(R.q.maxDt, dt);
      for (let k = 0; k < R.nb; k++) {
        const o = k * VL_NF, d = Math.hypot(V[o] - R.prev.V[o], V[o + 1] - R.prev.V[o + 1]);
        if (d > Math.max(3, (Math.max(V[o + 3], R.prev.V[o + 3]) + 5) * dt * 3)) { c.jump = true; R.q.jumps++; ev('discontinuity', rows[k].no, { dist: d }); }
      }
    }
    R.q.steps++; if (R.q.firstT == null) R.q.firstT = c.T; R.q.lastT = c.T;
    if (R.zeroT == null) {
      const known = R.solo || (!fleet.entry && SS.phase !== 'entry');   // the big clock's zero is set once the 進入 is over
      if (!known) { R.ring.push(c); while (R.ring.length && c.T - R.ring[0].T > VLOG.pre + 1) R.ring.shift(); R.prev = c; return; }
      R.zeroT = nowZero();
      ev('clock_start', null, null, R.zeroT - CLOCK); ev('start_signal', null, null, R.zeroT);
      const list = R.ring.filter(s => s.T - R.zeroT >= -VLOG.pre - 1 / VLOG.hz).concat([c]);
      R.ring = [];
      const t0 = list[0].T - R.zeroT;
      R.origin = -VLOG.pre + Math.max(0, Math.ceil((t0 + VLOG.pre) * VLOG.hz - 1e-6)) / VLOG.hz;
      R.prev = list[0];
      for (let i = 1; i < list.length && R.state === 'RECORDING'; i++) { emit(R.prev, list[i]); R.prev = list[i]; }
      if (list.length === 1) emit(R.prev, R.prev);
      return;
    }
    emit(R.prev, c); R.prev = c;
  }
  // the race is decided (all boats home / 不成立 / skipped to the result / TA over): 5 s more of picture, then stop
  function finish(reason, at, note) {
    if (!R || R.endT != null) return;
    R.endT = at != null ? at : time; R.endReason = reason; R.endNote = note || null;
    flushPlays();
    ev('race_end', null, { reason, note: note || null }, R.endT);
    ev('postroll_start', null, null, R.endT);
    if (reason === 'ram_limit') { R.state = 'READY'; R.postSrc = 'none'; }
    R.results = results();
    vlUi();
  }
  // the board as the result screen shows it (fixed when the race is decided; refreshed when the board is drawn)
  function results() {
    if (R.solo) return { mode: 'ta', st: ta.st, laps: ta.laps.slice(), time: ta.done ? ta.lastAt - ta.zero : null, rank: ta.done ? taRank(ta.lastAt - ta.zero) : null, noRecord: !ta.done };
    const f = fleet, zr = R.zeroT ?? nowZero(), P = photoPairs(), tieB = new Set(P.filter(p => p.tie).map(p => p.b));
    let place = 0, shown = 0;
    const rows = f.rank.map(r => {
      const pl = r.flying ? 'F' : r.st != null && r.st > 1 ? 'L' : r.out ? (r.out === '落水' ? '落' : '転') : r.dq ? '失' : (shown++, tieB.has(r) ? String(place) : String(place = shown));
      return { no: r.no, place: pl, course: r.trait.course, st: r.st, finishT: r.fin != null && !r.skipped ? r.fin - zr : null, resultAssigned: !!r.skipped,
        dq: !!r.dq, out: r.out || null, flying: !!r.flying, relegated: !!r.relegated, fouls: r.fouls || 0, finished: r.fin != null && !r.skipped };
    });
    return { mode: R.mode, order: rows, kimarite: f.order[0] ? kimarite() : null, locked: !!f.locked, caution: !!f.caution,
      photo: P.map(p => ({ place: p.place, a: p.a.no, b: p.b.no, dt: p.dt, tie: p.tie })), winnerTime: f.order[0] && !f.order[0].skipped ? f.order[0].fin - zr : null };
  }
  // the end of the 5 s when the race stopped moving before it was over (the solo result pauses the game):
  // a controlled coast from the last real state — the lever shut, the hull running down — marked as such
  function coast() {
    if (!R || R.state !== 'RECORDING' || R.zeroT == null || R.endT == null || !R.prev) return;
    const p = R.prev, end = R.endT + VLOG.post - R.zeroT;
    R.q.coastFrom = p.T - R.zeroT; R.postSrc = 'live+coast';
    ev('coast_start', null, null, p.T);
    const V = Float64Array.from(p.V);
    let tPrev = p.T - R.zeroT;
    for (;;) {
      const t = R.origin + R.n / VLOG.hz;
      if (t > end + 1e-9) break;
      const dt = Math.max(0, t - tPrev); tPrev = t;
      for (let k = 0; k < R.nb; k++) {
        const o = k * VL_NF, fl = V[o + 18];
        const v = V[o + 3] * Math.exp(-dt * 0.45), a = V[o + 2];
        V[o] += Math.cos(a) * v * dt; V[o + 1] += Math.sin(a) * v * dt; V[o + 3] = v;
        V[o + 16] *= Math.exp(-dt * 3); V[o + 2] += V[o + 16] * dt; V[o + 15] *= Math.exp(-dt * 3);
        V[o + 11] = 0; V[o + 12] = 0; V[o + 9] *= Math.exp(-dt * 2); V[o + 10] *= Math.exp(-dt * 2);
        V[o + 4] *= Math.exp(-dt * 2); V[o + 5] *= Math.exp(-dt * 3); V[o + 13] = 0; V[o + 17] = 0; V[o + 6] = 0; V[o + 7] = 0; V[o + 23] = 0;
        V[o + 14] = fl & (VL_FLAG.capHull | VL_FLAG.fallen) ? 0 : engineRpm({ v, turnLoadV: 0 }, 0);
      }
      if (!store(V, t)) return;
    }
    R.terminal = { t: end, V: Float64Array.from(V) };
    ev('coast_end', null, null, R.endT + VLOG.post);
    R.state = 'READY'; vlUi();
  }
  // ---- the file ----
  const rnd = (v, d) => { if (!Number.isFinite(v)) return null; if (d == null) return Math.round(v); const m = 10 ** d; const r = Math.round(v * m) / m; return r === 0 ? 0 : r; };
  const boatJson = (V, k) => { const a = new Array(VL_NF), o = k * VL_NF; for (let i = 0; i < VL_NF; i++) a[i] = rnd(V[o + i], VL_DEC[i]); return a; };
  const rt = T => R.zeroT == null ? null : Math.round((T - R.zeroT) * 1e6) / 1e6;
  // d172 体格 for the rider model (height and sex change the look; weight is the riding weight's source)
  const bodyJson = bd => bd ? { sex: bd.sex, heightCm: bd.height, weightKg: bd.weight, rideWeightKg: bd.rideWt } : { sex: 'm', heightCm: SETSU.body.ref, weightKg: SETSU.minWt.m, rideWeightKg: SETSU.minWt.m };
  function header() {
    const ents = R.solo ? [{ no: 1, name: playerName(), class: null, colors: [PLAYER_STYLE.hull, PLAYER_STYLE.num], course: 1, player: true, motor: { deashi: B.deashi ?? 1, mawari: B.mawari ?? 1, nobi: B.nobi ?? 1 }, tilt: B.tilt ?? 0, body: bodyJson(null) }]
      : fleet.boats.map(r => ({ no: r.no, name: r.name || (r.player ? playerName() : null), class: r.prof ? profJa(r.prof) : null, colors: r.col, course: r.trait.course, slow: !!r.trait.slow,
        player: !!r.player, motor: { deashi: r.b.deashi ?? 1, mawari: r.b.mawari ?? 1, nobi: r.b.nobi ?? 1 }, tilt: r.b.tilt ?? 0, body: bodyJson(r.body) }));
    const st = !R.solo && fleet.setsu && fleet.setsu.race;
    // d175 racer-profile-v1: who rides (name always, 登録番号, 読み, 成績, motor/boat numbers) and what race this is. Unknown = null
    const noProf = { racerId: null, nameKana: null, branch: null, term: null, age: null, stats: { winRate: null, localWinRate: null, top2Rate: null, avgST: null, flying: null, late: null },
                     motorNo: null, boatNo: null, motorTop2Rate: null, boatTop2Rate: null, series: null };
    const inSetsu = st && typeof setsu !== 'undefined' && setsu && setsu.racers;
    for (const e of ents) {
      const r = R.solo ? null : fleet.boats.find(q => q.no === e.no);
      let pr = { ...noProf, profileScope: 'race' };
      if (inSetsu && r && r.sid != null && setsu.racers[r.sid]) {
        pr = { ...setsuProfile(r.sid), profileScope: 'setsu' };
        pr.series = pr.series.filter(x => !(x.day === st.day && x.R === st.R));   // the 節 so far, before this race
      }
      if (!pr.name) pr.name = e.name || (e.player ? playerName() : racerNameFromHash(strHash(R.id + '#' + e.no), e.body.sex));   // a one-off CPU rider gets a made-up name
      if (pr.nameKana == null) pr.nameKana = racerKana(pr.name);
      Object.assign(e, pr);
    }
    const race = st ? { title: st.kind || null, raceNo: st.R ?? null, grade: setsu.grade === 'sg' ? 'SG' : '一般', venueName: venueOf(setsu.venue).name, date: null, day: st.day ?? null,
                        dayLabel: SETSU.dayJa[st.day] || null, startTime: st.env && st.env.time || null }
      : { title: null, raceNo: null, grade: !R.solo && sgMode ? 'SG' : null, venueName: venueOf('standard').name, date: null, day: null, dayLabel: null, startTime: null };
    const env = R.solo || !waterEnv ? { calm: true, laps: R.solo ? TA.laps : 3 } : { laps: raceLaps(), dir: waterEnv.dir, wind: waterEnv.wind, windVec: { wx: waterEnv.wx, wy: waterEnv.wy },
      tideFlow: waterEnv.cx, wave: waterEnv.wave, rain: !!waterEnv.rain, stabilizer: !!waterEnv.stabilizer, temp: waterEnv.temp, tideLv: waterEnv.tideLv };
    let seedH = 2166136261; for (const ch of R.id) seedH = Math.imul(seedH ^ ch.charCodeAt(0), 16777619) >>> 0;
    return {
      mode: R.mode, sg: !R.solo && !!sgMode, race, setsu: st ? { day: st.day, race: st.R, kind: st.kind || null } : null, entryResult: !R.solo && fleet.entryResult ? fleet.entryResult.text : null,
      entries: ents, playerNo: R.solo ? 1 : fleet.playerNo || null, conditions: env,
      venue: { name: '標準', venueId: VLOG.venueId, courseVersion: VLOG.courseVersion, markX: MK, startLineX: 0 },
      units: { x: 'm, +x = right on the 2D screen (toward 1M)', y: 'm, +y = down on the 2D screen', heading: 'rad, 0 = +x, positive turns toward +y', v: 'm/s along the heading',
        bank: 'rad, + = right side down', slip: 'rad, travel direction minus heading', roll: '-1..1 rider lean (+ = right)', pitch: '-1..1 rider posture (+ = crouched, - = sat up)',
        steer: '-1..1 applied rudder', thr: '0..1 applied lever', rpm: '0..1.15 engine pitch index (not revolutions per minute)', vl: 'm/s sideways', yaw: 'rad/s', hop: 'm', hv: 'm/s up', landV: 'm/s at the last landing',
        progress: 'race progress value (not a distance)', t: 's from the big clock reaching zero' },
      // d187 (まえ: everything real size): the hull the race uses for contact and the size the game draws every boat at
      hull: { lengthM: +(BOW_TIP + HULL_STERN).toFixed(2), beamM: 2 * HULL_R, bowTipM: BOW_TIP, sternM: HULL_STERN,
        capsule: { r: HULL_R, aft: HULL_AFT, fwd: HULL_FWD },
        note: 'x along the heading from the boat position (x, y): bow tip +bowTipM, transom -sternM; contact = capsule from -aft to +fwd with radius r. Draw the boat at this size, bow tip on +bowTipM (the motor hangs off the transom).' },
      view: { driftView: typeof DRIFT_VIEW !== 'undefined' && DRIFT_VIEW.on ? { gain: DRIFT_VIEW.gain, vLo: DRIFT_VIEW.vLo, vHi: DRIFT_VIEW.vHi, max: DRIFT_VIEW.max,
        formula: 'drawnHeading = heading - clamp(gain * slip * clamp((v - vLo) / (vHi - vLo), 0, 1), -max, max)  (the game draws the hull at this angle; d166)' } : null,
        // d175: the bow's trim (d173), with this version's numbers, so an old log keeps its old look if the game is retuned
        trim: { up: TRIM.up, down: TRIM.down, vRef: TRIM.vRef, rate: TRIM.rate, k: TRIM.k, c: TRIM.c, snap: TRIM.snap, snapThr0: 0.4, snapThrK: 0.6, downK: 1.5, min: -0.3, max: 1.2,
          degPerUnit: 8, nose3dRadPerUnit: 0.14, liftMPerUnit: BOUNCE_VIEW.trim,
          formula: { base: 'trimBase eases toward (up*max(0,-pitch) - down*max(0,pitch)) * clamp(v/vRef, 0, 1) at rate per s (pitch: + crouched, - sat up)',
            pop: 'at each trim_pop event: popV += snap * (snapThr0 + snapThrK * thr); every step: popV += (-k * (1 + downK*max(0,pitch)) * pop - c * popV) * dt; pop = max(0, pop + popV*dt) (popV = 0 when pop hits 0 going down)',
            total: 'trim = clamp(trimBase + pop, min, max); bow angle = trim * degPerUnit deg (the game 3D tilts the nose by trim * nose3dRadPerUnit rad and lifts the hull by max(0,trim) * liftMPerUnit m); willie (wil) takes over and zeroes pop' } } },
      flags: VL_FLAG, model: { specId: VLOG.modelSpecId, colorsFrom: 'entries[].colors' },
      audio: { audioProfileId: VLOG.audioProfileId, idle: IDLE, rpmFormula: 'clamp(0.15 + 0.55*(IDLE + (1-IDLE)*thr) + 0.35*v/23 - 0.1*turnLoad, 0, 1.15)',
        pitchHz: '58 + 150*rpm + (no % 6)*1.7', voices: R.solo ? [{ no: 1, detuneHz: 1.7 }] : fleet.boats.map(r => ({ no: r.no, detuneHz: (r.no % 6) * 1.7 })) },
      effectSeed: seedH
    };
  }
  async function build() {
    const zr = R.zeroT, o = { format: VLOG.format, formatVersion: VLOG.formatVersion, formatFeatures: VLOG.formatFeatures, gameVersion: GAME_VER, raceId: R.id, createdAt: R.createdAt.toISOString() };
    if (!R.solo && fleet && fleet.resShown) R.results = results();
    o.header = header();
    const actualEnd = R.origin + (R.n - 1) / VLOG.hz;
    o.timing = { sampleHz: VLOG.hz, raceZero: 'big clock reaches 0 (start signal)', requestedStartSec: -VLOG.pre, sampleOriginSec: R.origin, actualStartSec: R.origin, actualEndSec: actualEnd,
      samples: R.n, decidedSec: R.endT != null ? rt(R.endT) : null, postRoll: R.endT != null ? { fromSec: rt(R.endT), toSec: rt(R.endT) + VLOG.post, seconds: VLOG.post, source: R.postSrc || 'incomplete' } : null };
    o.boatOrder = R.solo ? [1] : fleet.boats.map(r => r.no);
    o.fields = VL_FIELDS;
    o.events = R.events.map(e => ({ t: rt(e.T), type: e.type, no: e.no, ...(e.payload ? { payload: e.payload } : {}) })).filter(e => e.t >= R.origin - 1e-6).sort((a, b) => a.t - b.t);
    o.results = R.results || results();
    o.highlights = { version: 1, scoreScale: '1–10 (10 = the race-deciding moment)', top: 'the best few that do not overlap in time', list: highlights(o.events) };
    o.terminalSnapshot = R.terminal ? { t: Math.round(R.terminal.t * 1e6) / 1e6, boats: o.boatOrder.map((_, k) => boatJson(R.terminal.V, k)) } : null;
    o.quality = { complete: R.endT != null && !!R.terminal && !R.full, endReason: R.endReason, endNote: R.endNote, ramLimited: R.full, physicsSteps: R.q.steps, maxPhysicsStepSec: R.q.maxDt,
      samplesInterpolated: R.n, discontinuities: R.q.jumps, coastFromSec: R.q.coastFrom, missingLeadSec: Math.max(0, R.origin + VLOG.pre), method: 'resampled from physics steps (linear; angles the short way; states nearest)' };
    const head = JSON.stringify(o).slice(0, -1);
    const parts = [head, ',"frames":['];
    let i = 0, first = true;
    for (const ch of R.chunks) {
      const nIn = ch === R.cur ? R.curN : VLOG.chunk, lines = [];
      for (let j = 0; j < nIn; j++, i++) {
        const V = ch.subarray(j * R.nb * VL_NF, (j + 1) * R.nb * VL_NF), fr = [Math.round((R.origin + i / VLOG.hz) * 1e6) / 1e6];
        for (let k = 0; k < R.nb; k++) fr.push(boatJson(V, k));
        lines.push(JSON.stringify(fr));
      }
      if (lines.length) { parts.push((first ? '' : ',') + lines.join(',')); first = false; }
      await new Promise(res => setTimeout(res, 0));
    }
    parts.push(']}');
    const json = new Blob(parts, { type: 'application/json' });
    const stamp = R.createdAt.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    const base = `hfgp_video_${GAME_VER}_${stamp}_${R.id}`;
    if (typeof CompressionStream === 'function' && json.stream) {
      try {
        const gz = await new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob();
        return { blob: new Blob([gz], { type: 'application/gzip' }), name: base + '.json.gz', raw: json.size };
      } catch (e) {}
    }
    return { blob: json, name: base + '.json', raw: json.size };
  }
  // リプレイ保存
  async function save(msgEl) {
    if (!R) return;
    const g = gen;
    if (R.state === 'EXPORTING') return;
    if (R.state === 'RECORDING') {
      if (R.endT == null) finish('partial', time, '保存時点で未決着');
      say(msgEl, '終了後の映像を記録中…');
      const until = performance.now() + VLOG.waitPost * 1000;
      while (R && R.gen === g && R.state === 'RECORDING' && !paused && performance.now() < until) await new Promise(res => setTimeout(res, 150));
      if (!R || R.gen !== g) return;
      if (R.state === 'RECORDING') coast();
    }
    if (!R || R.gen !== g || R.state !== 'READY') return;
    R.state = 'EXPORTING'; say(msgEl, 'ファイルを作成中…'); vlUi();
    let out = null;
    try { out = R.file || await build(); } catch (e) { if (R && R.gen === g) { R.state = 'READY'; say(msgEl, 'ファイルを作れませんでした。もう一度押すか、次へ進んでください'); vlUi(); } return; }
    if (!R || R.gen !== g) return;   // moved on while it was being made: it is not brought back
    R.file = out; R.state = 'READY';
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(out.blob);
    const a = document.createElement('a'); a.href = url; a.download = out.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    say(msgEl, `ダウンロードを開始しました。ファイルを確認してください（${out.name}、${(out.blob.size / 1048576).toFixed(2)}MB）`, url, out.name);
    vlUi();
  }
  function say(el, text, href, name) {
    if (!el) return;
    el.textContent = text; el.hidden = false;
    if (href) { const a = document.createElement('a'); a.href = href; a.download = name; a.textContent = '　ファイルをダウンロード'; el.appendChild(a); }
  }
  return { begin, discard, ev, contact, inp, frame, finish, coast, save, build, results,
    get rec() { return R; }, has: () => !!R && R.zeroT != null && R.n > 0,
    refreshResults: () => { if (R && !R.solo && fleet) R.results = results(); } };
})();

// ---- the screen: the setting, the demo's 結果で待つ, the save buttons on the race result and on the タイムアタック card ----
function vlUi() {
  const has = !!(VR && VR.has()), r = VR && VR.rec;
  for (const id of ['resVid', 'taVid']) { const el = $(id); if (el) { el.hidden = !vlOn || (!has && !(r && r.state === 'RECORDING')); el.disabled = !!(r && r.state === 'EXPORTING'); } }
  // 6艇レース (d198, まえ): the result asks whether to save the replay log — on a PC only
  const rv = $('resVid'); if (rv) { const rm = vlRaceMode(); rv.textContent = rm ? '保存する' : 'リプレイ保存'; if (rm && !vlPC) rv.hidden = true; }
  const h = $('vlHold');
  if (h) { h.hidden = !vlOn || !fleet || !!fleet.playerNo || !!fleet.setsu; h.textContent = `結果で待つ：${vlHold ? 'オン' : 'オフ'}`; h.classList.toggle('alt', !vlHold); }
}
const vlRaceMode = () => !!(fleet && fleet.raceCfg);
function vlResultNote(demoAuto) {
  const m = $('resVidMsg'); if (!m) return;
  m.textContent = ''; m.hidden = true;
  if (!vlOn) return;
  if (vlRaceMode()) { if (vlPC && VR.has()) { m.textContent = 'リプレイ作成用のログを保存しますか？（保存しないときは「次へ」）'; m.hidden = false; } return; }
  if (!VR.has()) { m.textContent = '走行データがないためリプレイ保存できません'; m.hidden = false; return; }
  if (demoAuto) { m.textContent = `次へ進むと、このリプレイは保存できません（${demoAuto}秒後に次のレース）`; m.hidden = false; }
}
if ($('vlogOn')) {
  $('vlogOn').checked = vlOn;
  if (!vlPC) { const l = $('vlogOn').closest('label'), nx = l && l.nextElementSibling; if (l) l.style.display = 'none'; if (nx && nx.tagName === 'P') nx.style.display = 'none'; }
  $('vlogOn').addEventListener('change', e => { vlOn = e.target.checked; try { localStorage.setItem('honorGP.vlog', vlOn ? 'on' : 'off'); } catch (x) {} vlUi(); });   // takes effect from the next race
}
if ($('vlHold')) $('vlHold').addEventListener('click', () => { vlHold = !vlHold; vlUi(); });
if ($('resVid')) $('resVid').addEventListener('click', () => { clearTimeout(resTimer); resTimer = 0; clearInterval(resCountT); resCountT = 0; VR.save($('resVidMsg')); });
if ($('taVid')) $('taVid').addEventListener('click', () => VR.save($('taVidMsg')));
