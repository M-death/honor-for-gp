/* ---------- 動画用ログ (d164 — HFGP_video_log_implementation_spec v2, file format hfgp-video-replay v1) ----------
   For the separate replay / video app: every boat 60 times a second of race time (t = s from the big clock's zero),
   from 20 s before the start (or from the first moment there is, if the run-up is shorter) until 5 s after the race is
   decided, plus timed events and the official result.
   It lives in memory for the race on screen only. It becomes a file only when リプレイ保存 is pressed on the result,
   and it is dropped the moment the player moves on — no history, nothing in localStorage / IndexedDB / anywhere.
   It only reads the race: no RNG (simRandom / Math.random), no writes to boats, rows or the fleet. */
const VLOG = { hz: 60, pre: 20, post: 5, maxMiB: 32, chunk: 600, format: 'hfgp-video-replay', formatVersion: 1,
  audioProfileId: 'hfgp-engine-d164', modelSpecId: 'boat3d-d163', venueId: 'standard', courseVersion: 1,
  contactGap: 0.25, contactMinJ: 0.05, bumpEv: 0.3, landEv: 0.5, waitPost: 3 };
const VL_FIELDS = ['x', 'y', 'heading', 'v', 'bank', 'slip', 'hop', 'wil', 'porp', 'roll', 'pitch', 'steer', 'thr', 'splashK', 'rpm', 'vl', 'yaw', 'wakeBump', 'flags', 'lap', 'rank', 'fx', 'fy', 'hv', 'landV', 'progress'];
const VL_NF = VL_FIELDS.length;
// decimals kept in the file for each field (null = whole number)
const VL_DEC = [2, 2, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, null, null, null, 2, 2, 3, 3, 2];
const VL_ANGLE = new Set([2, 5]);                 // heading, slip: interpolate the short way round ±π
const VL_STEP = new Set([18, 19, 20, 21, 22]);    // flags, lap, rank, fx, fy: never blended, nearest step
const VL_FLAG = { capHull: 1, fallen: 2, retired: 4, dq: 8, flying: 16, finished: 32, relegated: 64, player: 128, jump: 256 };
let vlOn = true;
try { vlOn = localStorage.getItem('honorGP.vlog') !== 'off'; } catch (e) {}
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
      Object.assign(p, { wil, bump, vis, landAge: b.landAge, stuckAge: b.stuckAge }); R.prevBoat.set(b, p);
    }
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
  function header() {
    const ents = R.solo ? [{ no: 1, name: playerName(), class: null, colors: [PLAYER_STYLE.hull, PLAYER_STYLE.num], course: 1, player: true, motor: { deashi: B.deashi ?? 1, mawari: B.mawari ?? 1, nobi: B.nobi ?? 1 }, tilt: B.tilt ?? 0 }]
      : fleet.boats.map(r => ({ no: r.no, name: r.name || (r.player ? playerName() : null), class: r.prof ? profJa(r.prof) : null, colors: r.col, course: r.trait.course, slow: !!r.trait.slow,
        player: !!r.player, motor: { deashi: r.b.deashi ?? 1, mawari: r.b.mawari ?? 1, nobi: r.b.nobi ?? 1 }, tilt: r.b.tilt ?? 0 }));
    const st = !R.solo && fleet.setsu && fleet.setsu.race;
    const env = R.solo || !waterEnv ? { calm: true, laps: R.solo ? TA.laps : 3 } : { laps: raceLaps(), dir: waterEnv.dir, wind: waterEnv.wind, windVec: { wx: waterEnv.wx, wy: waterEnv.wy },
      tideFlow: waterEnv.cx, wave: waterEnv.wave, rain: !!waterEnv.rain, stabilizer: !!waterEnv.stabilizer, temp: waterEnv.temp, tideLv: waterEnv.tideLv };
    let seedH = 2166136261; for (const ch of R.id) seedH = Math.imul(seedH ^ ch.charCodeAt(0), 16777619) >>> 0;
    return {
      mode: R.mode, sg: !R.solo && !!sgMode, setsu: st ? { day: st.day, race: st.R, kind: st.kind || null } : null, entryResult: !R.solo && fleet.entryResult ? fleet.entryResult.text : null,
      entries: ents, playerNo: R.solo ? 1 : fleet.playerNo || null, conditions: env,
      venue: { name: '標準', venueId: VLOG.venueId, courseVersion: VLOG.courseVersion, markX: MK, startLineX: 0 },
      units: { x: 'm, +x = right on the 2D screen (toward 1M)', y: 'm, +y = down on the 2D screen', heading: 'rad, 0 = +x, positive turns toward +y', v: 'm/s along the heading',
        bank: 'rad, + = right side down', slip: 'rad, travel direction minus heading', roll: '-1..1 rider lean (+ = right)', pitch: '-1..1 rider posture (+ = crouched, - = sat up)',
        steer: '-1..1 applied rudder', thr: '0..1 applied lever', rpm: '0..1.15 engine pitch index (not revolutions per minute)', vl: 'm/s sideways', yaw: 'rad/s', hop: 'm', hv: 'm/s up', landV: 'm/s at the last landing',
        progress: 'race progress value (not a distance)', t: 's from the big clock reaching zero' },
      view: typeof DRIFT_VIEW !== 'undefined' && DRIFT_VIEW.on ? { driftView: { gain: DRIFT_VIEW.gain, vLo: DRIFT_VIEW.vLo, vHi: DRIFT_VIEW.vHi, max: DRIFT_VIEW.max,
        formula: 'drawnHeading = heading - clamp(gain * slip * clamp((v - vLo) / (vHi - vLo), 0, 1), -max, max)  (the game draws the hull at this angle; d166)' } } : null,
      flags: VL_FLAG, model: { specId: VLOG.modelSpecId, colorsFrom: 'entries[].colors' },
      audio: { audioProfileId: VLOG.audioProfileId, idle: IDLE, rpmFormula: 'clamp(0.15 + 0.55*(IDLE + (1-IDLE)*thr) + 0.35*v/23 - 0.1*turnLoad, 0, 1.15)',
        pitchHz: '58 + 150*rpm + (no % 6)*1.7', voices: R.solo ? [{ no: 1, detuneHz: 1.7 }] : fleet.boats.map(r => ({ no: r.no, detuneHz: (r.no % 6) * 1.7 })) },
      effectSeed: seedH
    };
  }
  async function build() {
    const zr = R.zeroT, o = { format: VLOG.format, formatVersion: VLOG.formatVersion, gameVersion: GAME_VER, raceId: R.id, createdAt: R.createdAt.toISOString() };
    if (!R.solo && fleet && fleet.resShown) R.results = results();
    o.header = header();
    const actualEnd = R.origin + (R.n - 1) / VLOG.hz;
    o.timing = { sampleHz: VLOG.hz, raceZero: 'big clock reaches 0 (start signal)', requestedStartSec: -VLOG.pre, sampleOriginSec: R.origin, actualStartSec: R.origin, actualEndSec: actualEnd,
      samples: R.n, decidedSec: R.endT != null ? rt(R.endT) : null, postRoll: R.endT != null ? { fromSec: rt(R.endT), toSec: rt(R.endT) + VLOG.post, seconds: VLOG.post, source: R.postSrc || 'incomplete' } : null };
    o.boatOrder = R.solo ? [1] : fleet.boats.map(r => r.no);
    o.fields = VL_FIELDS;
    o.events = R.events.map(e => ({ t: rt(e.T), type: e.type, no: e.no, ...(e.payload ? { payload: e.payload } : {}) })).filter(e => e.t >= R.origin - 1e-6).sort((a, b) => a.t - b.t);
    o.results = R.results || results();
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
  const h = $('vlHold');
  if (h) { h.hidden = !vlOn || !fleet || !!fleet.playerNo || !!fleet.setsu; h.textContent = `結果で待つ：${vlHold ? 'オン' : 'オフ'}`; h.classList.toggle('alt', !vlHold); }
}
function vlResultNote(demoAuto) {
  const m = $('resVidMsg'); if (!m) return;
  m.textContent = ''; m.hidden = true;
  if (!vlOn) return;
  if (!VR.has()) { m.textContent = '走行データがないためリプレイ保存できません'; m.hidden = false; return; }
  if (demoAuto) { m.textContent = `次へ進むと、このリプレイは保存できません（${demoAuto}秒後に次のレース）`; m.hidden = false; }
}
if ($('vlogOn')) {
  $('vlogOn').checked = vlOn;
  $('vlogOn').addEventListener('change', e => { vlOn = e.target.checked; try { localStorage.setItem('honorGP.vlog', vlOn ? 'on' : 'off'); } catch (x) {} vlUi(); });   // takes effect from the next race
}
if ($('vlHold')) $('vlHold').addEventListener('click', () => { vlHold = !vlHold; vlUi(); });
if ($('resVid')) $('resVid').addEventListener('click', () => { clearTimeout(resTimer); resTimer = 0; clearInterval(resCountT); resCountT = 0; VR.save($('resVidMsg')); });
if ($('taVid')) $('taVid').addEventListener('click', () => VR.save($('taVidMsg')));
