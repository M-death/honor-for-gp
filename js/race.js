// Honor for GP — レース本体：CPU・進入・スタート・水面・判定・結果・写真判定・実況・事故
// the racing line: a stadium around both marks, run anticlockwise
// The racing line: two straights joined by half-circles of radius R. Each circle is pulled toward the
// infield so that its outermost point passes `gap` metres from the mark: the boat swings round and
// brushes the buoy at the apex. gap = R (the default) centres the circle on the mark instead.
const arcX = (R, gap = R) => MK - R + Math.min(gap, R);
const loopLen = (R, gap) => 4 * arcX(R, gap) + 2 * Math.PI * R;
function loopPt(R, s, gap) {
  const M = arcX(R, gap), A = Math.PI * R, L = loopLen(R, gap);
  s = ((s % L) + L) % L;
  if (s < 2 * M) return [-M + s, R];
  s -= 2 * M;
  if (s < A) { const th = Math.PI / 2 - s / R; return [M + R * Math.cos(th), R * Math.sin(th)]; }
  s -= A;
  if (s < 2 * M) return [M - s, -R];
  s -= 2 * M;
  const th = 3 * Math.PI / 2 - s / R; return [-M + R * Math.cos(th), R * Math.sin(th)];
}
function loopS(R, x, y, gap) {
  const M = arcX(R, gap), A = Math.PI * R;
  let best = Infinity, bs = 0;
  const cand = (s, px, py) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < best) { best = d; bs = s; } };
  let t = clamp(x + M, 0, 2 * M); cand(t, -M + t, R);
  t = clamp(M - x, 0, 2 * M); cand(2 * M + A + t, M - t, -R);
  let th = clamp(Math.atan2(y, x - M), -Math.PI / 2, Math.PI / 2);
  cand(2 * M + (Math.PI / 2 - th) * R, M + R * Math.cos(th), R * Math.sin(th));
  th = Math.atan2(y, x + M); if (th < 0) th += 2 * Math.PI; th = clamp(th, Math.PI / 2, 3 * Math.PI / 2);
  cand(4 * M + A + (3 * Math.PI / 2 - th) * R, -M + R * Math.cos(th), R * Math.sin(th));
  return bs;
}
// how far along the loop until the next turn begins (0 while in a turn), and whether we're in one
function turnInfo(R, s, gap) {
  const M = arcX(R, gap), A = Math.PI * R, L = loopLen(R, gap);
  const seg = [[2 * M, 2 * M + A], [4 * M + A, L]];
  for (const [a, b] of seg) if (s >= a && s < b) return { inTurn: true, toTurn: 0, left: b - s };
  const next = s < 2 * M ? 2 * M : 4 * M + A;
  return { inTurn: false, toTurn: next - s, left: 0 };
}
// seconds to reach a line d metres ahead from speed v with the lever wide open
function timeToLine(d, v, crouch = 0, pre = true, boat = null) {
  let x = 0, t = 0;
  const wk = boat && boat.weightK || 1, dk = 0.012 * (1 - 0.1 * crouch) * (boat && boat.stabilizer ? ENV.stabDrag : 1) * (boat && boat.hullDrag || 1), w = waterEnv ? ENV.windAir * waterEnv.wx : 0;
  // the water as the rider reads it: the chop's average drag (waves × how the hull rides them) and the wind's push
  const bump = waterEnv && waterEnv.wave ? waterEnv.wave * ENV.waveBump * waveHeadK(0) * (boat && boat.hullRide || 1) * (boat && boat.stabilizer ? ENV.stabBump : 1) * 1.0 : 0, drift = waterEnv ? ENV.windDrift * waterEnv.wx : 0;
  while (x < d && t < 20) { const vr = v - w, acc = THRUST * thrustK(v) * startK(v, pre, boat) * motorK(boat, v) * wk - dk * vr * Math.abs(vr) - 0.1 * v - bump * (0.8 + v * 0.07) * WAKE.drag; v += acc * 0.05; x += (v + drift) * 0.05; t += 0.05; }
  return t;
}
const wrapRad = a => Math.atan2(Math.sin(a), Math.cos(a));
// Aim point on the racing line, pulled back if the straight run to it would clip a turn mark
// or cut across the boom inside it (a long look-ahead otherwise shortcuts the corner).
function aimOnLine(b, R, s, look, gap) {
  for (let k = 0; k < 8; k++) {
    const [tx, ty] = loopPt(R, s + look, gap);
    if (look < 3 || clearOfMarks(b.x, b.y, tx, ty)) return [tx, ty];
    look *= 0.7;
  }
  return loopPt(R, s + look, gap);
}
function clearOfMarks(x1, y1, x2, y2) {
  for (const m of COURSE.marks) {
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    const t = clamp(((m.x - x1) * dx + (m.y - y1) * dy) / L2, 0, 1);
    if (Math.hypot(x1 + dx * t - m.x, y1 + dy * t - m.y) < 2.8) return false;   // buoy 1.5 m + hull 0.8 m + a little
  }
  if ((y1 > 0) !== (y2 > 0)) {                       // crosses the centreline: only allowed outside the marks
    const xc = x1 + (x2 - x1) * (-y1 / ((y2 - y1) || 1e-9));
    if (Math.abs(xc) < MK + 1.8) return false;
  }
  return true;
}

// How rough the water is at a point from other boats' wake (引き波), and which way that wake runs.
// `ahead` ages the wake so the CPU can judge where it will be, not just where it is.
function wakeAt(x, y, wakes, now, ahead = 0) {
  let w = 0, ang = 0, line = false, fresh = false;
  for (const arr of wakes) for (let i = arr.length - 1; i >= 0; i -= 2) {
    const pt = arr[i], age = now + ahead - pt.t;
    if (age < 0.3) continue;
    if (age > WAKE.life * WAKE_TURN.lifeK) break;
    const ps = pt.s ?? 1, life = WAKE.life * (1 + (WAKE_TURN.lifeK - 1) * clamp((ps - WAKE_TURN.straight) / (1 - WAKE_TURN.straight), 0, 1));
    if (age > life) continue;
    const spread = age * (1.4 + pt.v * 0.12);
    const c = Math.cos(pt.a), s = Math.sin(pt.a), dx = x - pt.x, dy = y - pt.y;
    const lat = Math.abs(-dx * s + dy * c), fwd = Math.abs(dx * c + dy * s);
    // the trough right behind the boat and the two spreading wave lines
    const inTrough = lat < WAKE.width;
    if (fwd < 1.2 && (inTrough || Math.abs(lat - spread) < WAKE.width)) {
      const k = Math.pow(1 - age / life, WAKE.fade) * Math.min(1, pt.v / 15) * ps;   // fresh wake, close behind the boat, hits hardest
      if (k > w) { w = k; ang = pt.a; line = !inTrough; fresh = age < WAKE_CAV.age && ps > WAKE_CAV.ps; }
    }
  }
  return { w, ang, line, fresh };
}
// 引き波 under a hull. Riding along a neighbour's spreading wave line (same direction, side by side)
// only drags a little; the trough right behind a boat and crossing a line square hit hard.
const WAKE_LINE = { along: 0.4, bumpBase: 0.1 };
// 直線とターン: running straight, only the trough right behind a boat really bites — its spreading wave lines are
// ridden over with little more than a shudder. Going round a turn, crossing those lines is what hurts.
const WAKE_STRAIGHT = { line: 0.3, turnYaw: 0.35 };
// キャビ: crossing a fresh, still-splashing wave line hard in a turn can pull air into the prop — the thrust goes for a moment
const WAKE_CAV = { age: 1.0, ps: 0.7, bump: 0.35, rate: 1.2, time: 0.45, thrust: 0.35 };
function setWake(b, wa) {
  const cross = Math.abs(Math.sin(b.a - wa.ang));
  const turnK = clamp(Math.abs(b.yaw || 0) / WAKE_STRAIGHT.turnYaw, 0, 1), lineK = wa.line ? WAKE_STRAIGHT.line + (1 - WAKE_STRAIGHT.line) * turnK : 1;
  b.inWake = wa.w * lineK;
  b.wakeLine = wa.line;
  b.wakeTurn = turnK;
  b.wakeFresh = !!wa.fresh;
  b.wakeBump = wa.w * lineK * (wa.line ? WAKE_LINE.bumpBase + (1 - WAKE_LINE.bumpBase) * cross : 0.35 + 0.65 * cross);
}
const nearMarkAt = (x, y, r) => COURSE.marks.some(m => Math.hypot(x - m.x, y - m.y) < r);

// Risk by class. At a 勝負どころ (close fight going into a turn, not when comfortably clear):
//   go   chance of going for it (ムリ) at that turn      ok   chance it comes off
//   acc  chance a failed attempt ends in 転覆/落水       hit  how badly a heavy contact rattles it
//   fly  chance of misjudging the big clock (フライング)
// 差し構え: where it drops the lever before 1M (m before the turn), how far, when it grips again
// (share of the arc), how much tighter the arc, how much later the lean, how much wider past the buoy
const SASHI = {
  win:   { dropAt: 30, lever: 0.68, regrip: 0.2, rCut: 2,   late: 3, gapAdd: 0.5 },
  place: { dropAt: 38, lever: 0.58, regrip: 0.28, rCut: 1.5, late: 5, gapAdd: 1.5 },
};
// 立ち上がり: out of a turn the boat runs on the line it came out on and edges in toward the inside
// along a shallow straight diagonal (sideways m per m run, by class) — never a curve back in, never back out.
// upAt × top speed: from there on it is "up and running" (crouched).
const EXIT = { vTop: 22.8, upAt: 0.88, settle: 12, slope: { TOP: 0.075, A1: 0.07, A2: 0.06, B1: 0.05, B2: 0.04 },
  steerCap: 0.3, calmRun: 40 };   // coming off the turn: rudder held to this much, opening up over the first calmRun m (no swinging back in)
// 1マーク is where boats go over — CPU riders rarely gamble there (share of their usual rate)
const PUSH_AT_1M = 0.15;
// 絞り: after the start, an outside boat whose bow is `lead` m or more ahead of the boat just inside it
// may squeeze in on it (chance by course), closing to `gap` m centre-to-centre. The squeezed boat mostly
// gives way (引く: lifts and tucks in behind), and only sometimes fights it (抵抗) — which risks going over.
const SQUEEZE = { lead: 2, gap: 3.0, p: { 2: 0.4, 3: 0.85, 4: 0.6, 5: 0.45, 6: 0.35, kado: 0.9 },
                  dentSt: 0.1, dentP: 0.9, dashHitSt: 0, dashHitP: 0.85, dashHardSt: 0.04, outrunV: 1.5, hardP: { calm: 0.25, normal: 0.55, aggr: 0.85 }, dev: 0.1, hardDev: 0.16,   // 凹み (inside ST this much worse): intent, chance to 叩く; max heading off the straight (rad)
                  resist: { calm: 0.06, normal: 0.15, aggr: 0.3 }, yieldLever: 0.55, yieldTime: 1.1,
                  fightCap: 0.08 };   // chance of going over per half-second of rubbing hulls while resisting (× class)
const RISK = {
  A1: { go: 0.06, ok: 0.85, acc: 0.15, hit: 0.6, fly: 0.002 },
  A2: { go: 0.05, ok: 0.72, acc: 0.2,  hit: 0.8, fly: 0.003 },
  B1: { go: 0.04, ok: 0.58, acc: 0.27, hit: 1.0, fly: 0.004 },
  B2: { go: 0.035, ok: 0.42, acc: 0.34, hit: 1.2, fly: 0.006 },
  TOP: { go: 0.08, ok: 0.93, acc: 0.1, hit: 0.45, fly: 0.0015 },
};
// trait = { course, laneY, tactic: 'nige'|'sashi'|'makuri', lineOff, dump, care } (all optional for a lone boat)
const CARVE = { TOP: 1, A1: 0.9, A2: 0.7, B1: 0.5, B2: 0.3 };   // how well a class carves out of a turn (sit-up → crouch, lean held)
// nobody turns perfectly every time: each turn is rolled — how deep the lean goes, how much it sits up, when it starts
// easing out and how cleanly it hands over to the crouch. Top riders vary a little, B2 a lot.
const TURN_SD = { TOP: 0.05, A1: 0.08, A2: 0.12, B1: 0.17, B2: 0.23 };
const gauss = () => { let u = 0, v = 0; while (!u) u = simRandom(); while (!v) v = simRandom(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function turnRoll(prof) {
  const sd = TURN_SD[prof.name] ?? 0.12;
  return { lean: 1 - Math.min(0.5, Math.abs(gauss()) * sd * 0.8), up: 1 - Math.min(0.5, Math.abs(gauss()) * sd),
           carve: clamp(1 - Math.abs(gauss()) * sd * 2.2, 0, 1), easeAt: clamp(0.4 + gauss() * sd * 0.8, 0.15, 0.75) };
}
/* 記念クラス (d140): a CPU built from the time-attack logs (まえ's and the fastest TA CPU, tests/t_tacpu.js).
   When it has a mark to itself it turns the way the fastest solo run does: flat out and crouched to MK − ~28 m,
   then all in at once (lean, rudder, half-crouch), reading ahead which rudder still clears the buoy by `gap`,
   and coming off the lock at heading ±(180 − rel)° with some lean kept. Anyone close and it drives like an A1★. */
const KINEN = { gap: 0.2, pT: 0.35, Lmax: 0.91, kl: 3.4, rel: 42, exR: 0.47, exT: 0.62, exS: 0.88, exP: 1.5, s0: 0.5, rampT: 0.3,
  hz: 60, H: 3.5, from: 60,            // m before the mark it starts reading the turn
  app: 110, Ly: 26, Ly2: 21, ks: 0.04, ka: 2, sMax: 0.15,   // from `app` m out it swings wide to Ly (m off the centreline) for the run in: lean first, a touch of rudder
  near: 12, box: 25, lane: 4, ahead: 25, behind: 10,   // straight: nobody within `near` m ahead/alongside; run-in: nobody in my lane within `ahead` m
  level: 6, reachX: 15, dv: 1.5, gone: 40,       // まくり pays: within `level` m of each inner boat's position, or within reachX m and dv m/s faster
  over: 7, mkR: 9, mkY: 12, mkK: 0.5,  // over them: run in `over` m outside the widest, and clear the buoy by mkR (+mkK per m they sit beyond mkY)
  pathF: 10, pathS: 3.5,               // in the turn, give it up if anyone is within pathF m ahead and pathS m to the side
  oneCut: true };   // d142 お釣り無し (まえ): one cut, held to the release (false = the d140 read-and-correct turn: gap 0.36, hz 20)
const KINEN_MARKS = () => OBSTACLES.filter(o => o.kind === 'mark'), KINEN_BOOMS = () => OBSTACLES.filter(o => o.kind === 'boom');
function kinenGap(c, ob) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  const [px, py, qx, qy] = closestSegSeg(c.x - fx * HULL_AFT, c.y - fy * HULL_AFT, c.x + fx * HULL_FWD, c.y + fy * HULL_FWD, ob.x1, ob.y1, ob.x2, ob.y2);
  return Math.hypot(px - qx, py - qy) - HULL_R - ob.r;
}
// a flat-out, full-lean turn at rudder sv from now: the closest it comes to the mark (−1 = it would cut inside or stall).
// With the rider's current inputs `o` it also plays out how fast the hands and body get there (the ramp-in and the
// driver's react filters), so a rudder chosen once is the rudder that clears — no correcting later
function kinenPredict(b, m, sv, o, prof) {
  const sg = m ? -1 : 1, c = Object.assign({}, b), was = lab.predicting, mk = KINEN_MARKS()[m], bm = KINEN_BOOMS()[m];
  const inp = o ? { thr: 1, steer: o.steer, roll: o.roll, pitch: o.pitch } : { thr: 1, steer: -sv, roll: -1, pitch: KINEN.pT };
  const dt = 1 / 60, kS = 1 - Math.exp(-(prof ? prof.react : 10) * 1.6 * dt), kB = 1 - Math.exp(-(prof ? prof.react : 10) * dt);
  let g = Infinity, ok = false;
  lab.predicting = true;
  for (let i = 0; i < KINEN.H * 60; i++) {
    if (o) {
      const st = Math.min(sv, KINEN.s0 + (1 - KINEN.s0) * clamp(i * dt / KINEN.rampT, 0, 1));
      inp.steer += (-st - inp.steer) * kS; inp.roll += (-1 - inp.roll) * kB;
      inp.pitch += (clamp(KINEN.pT - KINEN.kl * Math.max(0, (c.load || 0) - KINEN.Lmax), -1, 1) - inp.pitch) * kB;   // sits up as the load passes Lmax, as in the turn
    }
    boatPhysics(c, inp, dt);
    g = Math.min(g, kinenGap(c, mk), kinenGap(c, bm) + 0.5);
    if (sg * c.y < 0) { ok = sg * c.x > MK; break; }
    if (c.v < 3) break;
  }
  lab.predicting = was;
  return ok ? g : -1;
}
// who is around, in the mark's frame: in my lane ahead (blocks the run), inside me toward the mark (to go round outside of),
// alongside or ahead out wide (blocks the swing out)
function kinenScan(b, env, m, lx, ly, Ly) {
  const sg = m ? -1 : 1, S = { block: false, wide: false, inner: [], innerY: -Infinity };
  for (const q of env.others) {
    if (q === b || q.cap > 0) continue;
    const qx = sg * q.x, qy = sg * q.y, dx = qx - lx, d = Math.hypot(q.x - b.x, q.y - b.y);
    if (Math.abs(qy - ly) < KINEN.lane && dx > -2 && dx < KINEN.ahead) S.block = true;
    else if (qy < ly - 1 && qy > -KINEN.box && dx > -KINEN.behind && dx < KINEN.gone && qx < MK + 10) { S.inner.push({ q, dx }); S.innerY = Math.max(S.innerY, qy); }
    else if (qy >= ly - 1 && qy < Math.max(ly, Ly) + 6 && dx > -8 && dx < 30) S.wide = true;
  }
  return S;
}
// a full-speed まくり over the boats inside pays only if I can get round them (those `gone` m ahead will be round first): level with the leading one already,
// or close behind it and clearly faster
function kinenMakuriOk(b, S) {
  for (const { q, dx } of S.inner) if (!(dx < KINEN.level || (dx < KINEN.reachX && b.v - q.v > KINEN.dv))) return false;
  return true;
}
// nobody close ahead or alongside (those behind don't matter on a straight)
function kinenClear(b, env, r) {
  const fx = Math.cos(b.a), fy = Math.sin(b.a);
  for (const q of env.others) {
    if (q === b || q.cap > 0) continue;
    const ex = q.x - b.x, ey = q.y - b.y;
    if (Math.hypot(ex, ey) < r && ex * fx + ey * fy > -3) return false;
  }
  return true;
}
// someone in the path of the turn right now (just ahead of my bow, within a hull or so either side)
function kinenInPath(b, env) {
  const fx = Math.cos(b.a), fy = Math.sin(b.a);
  for (const q of env.others) {
    if (q === b || q.cap > 0) continue;
    const ex = q.x - b.x, ey = q.y - b.y, f = ex * fx + ey * fy, s = -ex * fy + ey * fx;
    if (f > 0 && f < KINEN.pathF && s < KINEN.pathS && s > -KINEN.pathS - 3) return true;   // more room kept on the inside, where the lock takes it
  }
  return false;
}
// returns inputs while it is flying the line itself, else null (the A1★ driving carries on).
// d141 (まえ): turn flat out whenever it can; with boats inside, go round outside them flat out if that pays (全速まくり)
function kinenDrive(b, env, mem, dt, o, prof) {
  const kn = mem.kn || (mem.kn = { m: b.y >= 0 ? 0 : 1, ph: 'str', next: 0, sv: 1, tt: 0, t0: 0, need: KINEN.gap });
  if (env.caution || env.cruise || env.retire || b.cap > 0) { kn.ph = 'str'; return null; }
  const m = kn.m, sg = m ? -1 : 1, lx = sg * b.x, ly = sg * b.y, la = wrapRad(b.a + (m ? Math.PI : 0));
  if (kn.ph === 'str') {
    if (sg * b.y < 0 && lx > MK - 40) { kn.m = m ^ 1; return null; }   // already round this one (taken by the A1★ driving)
    if (ly < 0 || !fleet.raceOn) return null;
    const Ly0 = m ? KINEN.Ly2 : KINEN.Ly;
    if (lx < MK - KINEN.app) {   // the straight: flat out on the TA line, held by lean alone, while no one is close ahead or alongside
      if (lx < -MK + 10 || !kinenClear(b, env, KINEN.near)) return null;
      const want = KINEN.ks * (Ly0 - ly) - KINEN.ka * la;
      return { thr: 1, steer: 0, roll: clamp(want, -STRAIGHT_LEAN.free, STRAIGHT_LEAN.free), pitch: 1 };
    }
    let S = kinenScan(b, env, m, lx, ly, Ly0);
    let Ly = S.inner.length ? Math.max(Ly0, S.innerY + KINEN.over) : Ly0;
    if (Ly > Ly0) S = kinenScan(b, env, m, lx, ly, Ly);
    if (S.block || !kinenMakuriOk(b, S)) { kn.ph = 'skip'; return null; }
    if (S.wide) Ly = Math.min(Ly, Math.max(ly, 0));   // someone out wide: no swing out, turn from the lane it is in
    kn.need = S.inner.length ? Math.max(KINEN.gap, KINEN.mkR + Math.max(0, S.innerY - KINEN.mkY) * KINEN.mkK) : KINEN.gap;
    const want = KINEN.ks * (Ly - ly) - KINEN.ka * la;
    const run = { thr: 1, steer: clamp(want * 0.5, -KINEN.sMax, KINEN.sMax), roll: clamp(want, -STRAIGHT_LEAN.free, STRAIGHT_LEAN.free), pitch: 1 };
    if (lx < MK - KINEN.from || time < kn.next) return run;
    kn.next = time + 1 / KINEN.hz;
    if (KINEN.oneCut) {   // お釣り無し: one full cut, held to the release, started the moment it clears (read with the hands' lag)
      if (kinenPredict(b, m, 1, o, prof) < kn.need) return run;
      kn.sv = 1;
    } else if (kinenPredict(b, m, 1) < kn.need) return run;
    kn.ph = 'turn'; kn.tt = time; kn.next = 0; kn.mk = S.inner.length > 0;
  }
  if (kn.ph === 'skip') {
    if (ly < 0 && la < -Math.PI * 0.75) { kn.ph = 'str'; kn.m = m ^ 1; }
    return null;
  }
  if (kn.ph === 'turn' && kinenInPath(b, env)) { kn.ph = 'skip'; return null; }
  if (kn.ph === 'turn') {
    if (!KINEN.oneCut && time >= kn.next && la > -Math.PI / 2 - 0.2) {
      kn.next = time + 1 / KINEN.hz;
      let lo = 0.15, hi = 1;
      if (kinenPredict(b, m, hi) >= kn.need) lo = hi;
      else for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (kinenPredict(b, m, mid) >= kn.need) lo = mid; else hi = mid; }
      kn.sv = lo;
    }
    let sv = Math.min(kn.sv, KINEN.s0 + (1 - KINEN.s0) * clamp((time - kn.tt) / KINEN.rampT, 0, 1));
    if (la <= -Math.PI / 2 && !KINEN.oneCut) sv = 1;
    if (la <= -Math.PI + KINEN.rel * D2R && la < 0) { kn.ph = 'exit'; kn.t0 = time; }
    else return { thr: 1, steer: -sv, roll: -1, pitch: clamp(KINEN.pT - KINEN.kl * Math.max(0, (b.load || 0) - KINEN.Lmax), -1, 1) };
  }
  // exit: rudder off over exS of exT, lean eased out, down into a crouch
  const k = clamp((time - kn.t0) / KINEN.exT, 0, 1);
  if (k >= 1) { kn.ph = 'str'; kn.m = m ^ 1; return null; }
  return { thr: 1, steer: -Math.max(0, 1 - k / KINEN.exS), roll: -(1 - Math.pow(k, KINEN.exP)) * (1 - KINEN.exR * k),
    pitch: clamp(KINEN.pT + (1 - KINEN.pT) * k - KINEN.kl * Math.max(0, (b.load || 0) - KINEN.Lmax), -1, 1) };
}
/* 一発切り (d143, まえ): every class turns お釣り無し — or tries to. On the run in, the rider reads ahead when a turn with
   the rudder put in once (and the body as it is) would round the buoy at the clearance its line asks for, cuts at that
   moment and holds it until the bow comes round, then lets the line-follower take it out. What separates the classes
   is how truly that is done: the clearance aimed for (g, m), how late the hands follow the eye (t, s), how deep the
   cut goes (d, short of full), how far off the release heading (r, °), and how often it checks the turn is working
   (chk, s). When the turn it is holding would miss its line by `tol` m, it cuts again: the お釣り. */
const ONECUT = { on: true, from: 60, hz: 20, H: 3.5, rel: 35, tol: 1.0, svMin: 0.2, dMin: 0.08, near: 16, ahead: 40, side: 8, carveK: 0, hold: 2, holdLean: 2,
  TOP: { g: 0.3, t: 0.02, d: 0.03, r: 4, chk: 0.15 }, A1: { g: 0.5, t: 0.04, d: 0.05, r: 6, chk: 0.2 }, A2: { g: 1.1, t: 0.08, d: 0.12, r: 10, chk: 0.25 },
  B1: { g: 2.0, t: 0.15, d: 0.2, r: 14, chk: 0.3 }, B2: { g: 3.0, t: 0.25, d: 0.3, r: 20, chk: 0.35 } };
// the turn held at rudder sv from now with the body at `body` (and the hands/body lag of this rider): closest hull–buoy gap, −1 = cuts inside
function cutPredict(b, m, sv, o, prof, body) {
  const sg = m ? -1 : 1, c = Object.assign({}, b), was = lab.predicting, mk = KINEN_MARKS()[m], bm = KINEN_BOOMS()[m];
  const inp = { thr: body.thr, steer: o.steer, roll: o.roll, pitch: o.pitch }, dt = 1 / 60;
  const kS = 1 - Math.exp(-prof.react * 1.6 * dt), kB = 1 - Math.exp(-prof.react * dt);
  let g = Infinity, ok = false;
  lab.predicting = true;
  for (let i = 0; i < ONECUT.H * 60; i++) {
    inp.steer += (-sv - inp.steer) * kS; inp.roll += (body.roll - inp.roll) * kB; inp.pitch += (body.pitch - inp.pitch) * kB;
    boatPhysics(c, inp, dt);
    g = Math.min(g, kinenGap(c, mk), kinenGap(c, bm) + 0.5);
    if (sg * c.y < 0) { ok = sg * c.x > MK; break; }
    if (c.v < 3) break;
  }
  lab.predicting = was;
  return ok ? g : -1;
}
// steer for the one cut, or null (the line-follower's rudder stands)
function cutDrive(b, mem, o, prof, gap, body, free) {
  const P = ONECUT[prof.name] || ONECUT.A1;
  const cs = mem.cut || (mem.cut = { m: b.y >= 0 ? 0 : 1, ph: 'app', next: 0 });
  const m = cs.m, sg = m ? -1 : 1, lx = sg * b.x, ly = sg * b.y, la = wrapRad(b.a + (m ? Math.PI : 0));
  if (cs.ph === 'done' || cs.ph === 'app' && sg * b.y < 0 && lx > MK - 60) {   // round this one: wait for the next
    if (lx < MK - 70 || ly < -5 && Math.abs(la) > 2.6 && lx < MK - 20) { cs.m = m ^ 1; cs.ph = 'app'; cs.aim = null; }
    return null;
  }
  if (!free) { if (cs.ph === 'hold') cs.ph = 'done'; return null; }
  if (cs.ph === 'app') {
    if (lx < MK - ONECUT.from || ly < 0 || Math.abs(la) > 0.9) { cs.run = false; return null; }
    if (time < cs.next) return null;
    cs.next = time + 1 / ONECUT.hz;
    if (cs.aim == null) cs.aim = Math.max(0.1, gap - HULL_R - 1.5 + gauss() * P.g);   // the clearance it means to take — as truly as it can judge it
    if (cutPredict(b, m, 1, o, prof, body) < cs.aim) { cs.run = true; return null; }   // not yet: run on straight to the cut point (caller holds it)
    cs.run = false; cs.ph = 'hold'; cs.sv = clamp(1 - Math.abs(gauss()) * P.d, ONECUT.svMin, 1); cs.go = time + Math.abs(gauss()) * P.t;
    cs.rel = -Math.PI + (ONECUT.rel + gauss() * P.r) * D2R; cs.chk = time + P.chk; cs.cuts = 1; mem.cutTurns = (mem.cutTurns || 0) + 1;
  }
  if (time < cs.go) return null;   // the eye has it, the hands not yet
  if (b.v < 5) { cs.ph = 'done'; return null; }   // it has gone wrong (hit, stalled): the line-follower sorts it out
  if (la <= cs.rel && la < 0) { cs.ph = 'done'; return null; }   // round: let go, and the line takes it out
  if (time >= cs.chk && la > -Math.PI / 2 && ly > 2) {   // is it going round where it should? (read while the buoy is still ahead)
    cs.chk = time + P.chk;
    const gp = cutPredict(b, m, cs.sv, o, prof, body);
    if (gp < 0 || gp < cs.aim - ONECUT.tol || gp > cs.aim + ONECUT.tol && cs.sv < 1 - ONECUT.dMin) {   // no — cut again (お釣り): the rudder that would still make the line
      let lo = ONECUT.svMin, hi = 1;   // the gap opens as the rudder comes off: find where it is `aim`
      if (cutPredict(b, m, 1, o, prof, body) >= cs.aim) lo = 1;
      else for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (cutPredict(b, m, mid, o, prof, body) >= cs.aim) lo = mid; else hi = mid; }
      const sv = clamp(lo + gauss() * P.d * 0.5, ONECUT.svMin, 1);
      if (Math.abs(sv - cs.sv) >= ONECUT.dMin) { cs.sv = sv; cs.cuts++; mem.recuts = (mem.recuts || 0) + 1; }   // (a touch is no re-cut — the hands stay)
    }
  }
  return -cs.sv;
}
/* Shared first-mark CPU: used by applyCourse/makeDriver in demo and laboratory.
   These are game tuning values, not official racing rules or measured probabilities. */
const COURSE_CPU = {
 version:'course-v1', readEvery:.20, switchMargin:2.4, holdSeconds:.65,
 predictionSeconds:1.2, attackLeadM:2.5, slotWidthM:6.0, outerMarginM:4.0,
 courses:{
  1:{base:'nige',label:'先マイ・逃げ',weights:{nige:12}},
  2:{base:'sashiWin',label:'先行艇を見て差す',weights:{sashiWin:6,makuri:0,wall:0}},
  3:{base:'makuri',label:'まくり／まくり差し',weights:{makuri:4,makurisashi:4,sashiWin:1}},
  4:{base:'makuri',label:'伸びを生かしてまくる',weights:{makuri:6,makurisashi:2,sashiWin:1}},
  5:{base:'makurisashi',label:'内の攻めに続いてまくり差し',weights:{makurisashi:6,sashiWin:3,makuri:0}},
  6:{base:'sashiPlace',label:'空いた内を差す',weights:{sashiPlace:6,makurisashi:4,makuri:-1}}
 }
};
const CPU_REASON_JA={base:'コースの基本作戦',lead:'伸び・先行で外から攻める',slot:'艇間の開きを狙う',follow:'内艇の攻めに続く',wait:'内が塞がり差し構えで待つ',wall:'外の攻めに対して壁を作る',inside:'先マイを優先',hold:'旋回ラインを維持',closed:'狙った間が閉じたため待つ',forced:'指定戦法を使用'};
function cpuGroundVelocity(b){return{x:b.v*Math.cos(b.a)-b.vl*Math.sin(b.a),y:b.v*Math.sin(b.a)+b.vl*Math.cos(b.a)};}
function cpuReadWater(b,env,trait){
 const horizon=COURSE_CPU.predictionSeconds,vel=cpuGroundVelocity(b);
 const rows=(env.competitors||[]).filter(r=>r.b!==b&&!r.dq&&!r.out&&r.b.cap<=0).map(r=>{
  const v=cpuGroundVelocity(r.b),tactic=r.drv.mem.tacticNow||r.trait.tactic;
  return{no:r.no,course:r.trait.course,x:r.b.x,y:r.b.y,a:r.b.a,v:r.b.v,px:r.b.x+v.x*horizon,py:r.b.y+v.y*horizon,tactic,lineGap:r.drv.mem.cpuLine?.gap??r.prof.gap??5};
 });
 const inner=rows.filter(r=>r.course<trait.course).sort((a,b)=>a.course-b.course),near=inner.at(-1);
 const ownX=b.x+vel.x*horizon;
 const lead=near?b.x-near.x:99,projectedLead=near?ownX-near.px:99;
 const frontLead=inner.length?Math.min(...inner.map(q=>ownX-q.px)):99;
 const attack=near&&['makuri','tsuke'].includes(near.tactic)&&near.x>b.x-3;
 const outer=rows.find(r=>r.course===trait.course+1);
 const outerAttack=!!(outer&&['makuri','tsuke'].includes(outer.tactic)&&outer.x>b.x-3);
 let slot=null;
 // Openings are inferred from both fore/aft separation and available width; a lane number alone is not a gap.
 for(let i=1;i<inner.length;i++){
  const a=inner[i-1],z=inner[i];
  const width=Math.hypot(a.px-z.px,a.py-z.py);
  const stagger=a.px-z.px;
  const following=['makuri','tsuke'].includes(z.tactic)&&z.px-ownX>1.5&&z.lineGap-a.lineGap>=3;
  if(width<COURSE_CPU.slotWidthM||(!following&&stagger<3.5))continue;
  if(Math.max(a.px,z.px)-ownX>28||Math.min(a.px,z.px)-ownX < -35)continue;
  const candidate={innerBoat:a.no,outerBoat:z.no,widthM:width,staggerM:stagger,following,
   gap:clamp((a.lineGap+z.lineGap)/2,5,18),score:width-(following?0:Math.abs(stagger-8)*.3)};
  if(!slot||candidate.score>slot.score)slot=candidate;
 }
 // 1M's outside must be passed before aiming toward the back straight.
 const innerOpen=inner.some(q=>q.a<-.35&&Math.hypot(q.x-MK,q.y)>9&&q.x>b.x-12);
 return{leadM:lead,predictedLeadM:projectedLead,frontLeadM:frontLead,speedAdvMps:near?vel.x-cpuGroundVelocity(env.inner||b).x:0,
  stAdv:env.stAdv||0,innerAttack:!!attack,outerAttack,slot,innerOpen,innerCount:inner.length,
  innerMaxY:inner.length?Math.max(...inner.filter(q=>Math.abs(q.x-b.x)<35).map(q=>q.y),0):0,observedAt:env.now};
}
function cpuChooseFirstMark(b,env,trait,mem){
 const rule=COURSE_CPU.courses[trait.course]||COURSE_CPU.courses[6];
 const phases=['slit','approach','turn','exit'];
 const observedPhase=b.a< -2.35?'exit':b.x>115&&b.a<-.18?'turn':b.x>=60?'approach':'slit';
 const phase=phases[Math.max(phases.indexOf(observedPhase),phases.indexOf(mem.cpuDecision?.phase))];
 if(mem.cpuDecision&&env.now<mem.cpuReadAt&&mem.cpuDecision.phase===phase)return mem.cpuDecision.tactic;
 const obs=cpuReadWater(b,env,trait);mem.cpuReadAt=env.now+COURSE_CPU.readEvery;
 const scores={...rule.weights};
 const aggressive=trait.temper==='aggr'?1.4:trait.temper==='calm'?-1:0;
 if(scores.makuri!=null){
  scores.makuri+=clamp(obs.predictedLeadM,-6,6)*1.3+aggressive+(trait.kado?1.5:0)+(obs.stAdv>.04?.6:0);
  if(obs.innerCount&&obs.frontLeadM< -3)scores.makuri-=4;
  if(obs.innerCount&&obs.predictedLeadM<COURSE_CPU.attackLeadM)scores.makuri-=4;
 }
 if(scores.makurisashi!=null)scores.makurisashi+=obs.slot?(obs.slot.following?6:5):-9;
 if(scores.sashiWin!=null)scores.sashiWin+=(obs.predictedLeadM<1?2:0)+(obs.innerOpen?3:0);
 if(scores.sashiPlace!=null)scores.sashiPlace+=(obs.slot?-1:2)+(obs.innerOpen?2:0);
 if(scores.wall!=null)scores.wall+=obs.outerAttack&&obs.leadM> -3?7:-6;
 let candidate=Object.keys(scores).sort((a,z)=>scores[z]-scores[a])[0];
 // Slit is a provisional intention; attacking requires a lead or a plausible opening by the approach.
 if(phase==='slit'&&!mem.cpuDecision)candidate=rule.base;
 let reason=trait.course===1?'inside':candidate==='makuri'?'lead':candidate==='makurisashi'?(obs.slot?.following?'follow':'slot'):candidate==='wall'?'wall':'wait';
 if(phase==='slit'&&!mem.cpuDecision)reason='base';
 const prev=mem.cpuDecision;
 if(prev&&candidate!==prev.tactic){
  const committed=phase==='turn'||phase==='exit';
  const collapse=prev.tactic==='makurisashi'&&!obs.slot&&b.a> -1.25;
  if(committed){candidate=prev.tactic;reason=collapse?'closed':'hold';}
  else if(env.now-(mem.cpuChangedAt||0)<COURSE_CPU.holdSeconds||(scores[candidate]??-99)<(scores[prev.tactic]??-99)+COURSE_CPU.switchMargin){candidate=prev.tactic;reason='hold';}
 }
 if(!prev||candidate!==prev.tactic)mem.cpuChangedAt=env.now;
 const d={course:trait.course,base:rule.base,baseLabel:rule.label,tactic:candidate,reason,phase,observations:obs,scores,committed:phase==='turn'||phase==='exit'};
 mem.cpuDecision=d;return candidate;
}
function cpuFirstLine(b,env,trait,mem,tactic,R,gap,dt){
 const obs=mem.cpuDecision?.observations||cpuReadWater(b,env,trait);
 let targetR=R,targetGap=gap,stage='normal',waiting=false;
 if(tactic==='makuri'){
  // Preserve outside water and speed: do not drag the outside boat back to the buoy.
  const outside=clamp(Math.max(b.y,Math.min(obs.innerMaxY,b.y)+COURSE_CPU.outerMarginM),16,32);
  if(!mem.cpuWide||b.x<105)mem.cpuWide=outside;
  targetR=Math.max(R,mem.cpuWide);targetGap=clamp(Math.max(gap,mem.cpuWide*.55),8,21);stage='outside';
 }else if(tactic==='makurisashi'){
  if(!mem.cpuWide||b.x<100)mem.cpuWide=clamp(b.y,19,29);
  // Carry speed outside the lagging boats first, then cut into an observed opening.
  if(b.x>MK-8&&b.a<-.45)mem.cpuThreaded=true;
  const threaded=mem.cpuThreaded,exiting=b.a< -2.1;
  if(threaded&&obs.slot&&mem.cpuSlotGap==null)mem.cpuSlotGap=obs.slot.gap;
  stage=exiting?'exit':threaded?'thread':'outside_entry';
  waiting=threaded&&!exiting&&b.a> -1.4&&!obs.slot;
  targetR=threaded&&!waiting?16:mem.cpuWide;
  targetGap=threaded&&!waiting?(mem.cpuSlotGap??6):Math.max(10,mem.cpuWide*.5);
  if(waiting)stage='opening_closed';
 }else if(['sashi','sashiWin','sashiPlace'].includes(tactic)){
  stage=obs.innerOpen?'inside_open':'wait_inside';
  // Keep enough room to turn from outer courses, reducing radius only as the bow comes around.
  if(trait.course>=5&&b.a>-.5){targetR=Math.max(R,Math.min(25,b.y));targetGap=Math.max(gap,8);}
  waiting=!!env.inner&&!obs.innerOpen&&b.x>112&&b.a>-.7&&obs.leadM<2;
 }
 const prev=mem.cpuLine;
 if(!prev||b.x<55)mem.cpuLine={R:targetR,gap:targetGap};
 else {prev.R+=clamp(targetR-prev.R,-5*dt,5*dt);prev.gap+=clamp(targetGap-prev.gap,-4*dt,4*dt);}
 Object.assign(mem.cpuLine,{tactic,stage,waiting,targetR,targetGap});
 return mem.cpuLine;
}

function makeDriver(prof, trait = {}) {
  const o = { thr: 0, steer: 0, roll: 0, pitch: 0 };
  const mem = { stTarget: 0, go: false, firstDone: false, dumpT: 0, dumpQ: null, dumpSeen: new Set(), wakeT: 0, wakeOff: 0, wakeOffT: 0, wakeAhead: 0, brace: 0, emergency: 0 };
  function reset() {
    o.thr = o.steer = o.roll = o.pitch = 0;
    // Start judgement: the further out, the harder the timing is to read (stErr, ± spread by course),
    // so outside boats aim later to leave a safety margin. The class adds a little of its own wobble.
    // the extra difficulty of an outside start (over the 1コース's) bites less on an A1 — they can win from
    // anywhere — and more the lower the class
    // スタートの狙い (A1 基準): 勝負駆け 0.05 (フライング覚悟) / ドンピシャ 0.10 / 安定 0.15 — a miss is ~0.20.
    // The class shifts the aim and widens the error; the dash courses are harder to time (but a dash that gets it
    // right comes with the speed for a 一撃まくり), the 1コース easiest.
    const mode = startModeOf(trait);
    mem.stMode = mode;
    const sc = prof.stCls || START_CLASS[prof.name] || START_CLASS.B1;
    const cf = (START_COURSE.by[trait.course - 1] ?? 1.5) * (trait.slow ? 1 : START_COURSE.dash);
    mem.stTarget = START_MODE[mode] + sc.shift + START_COURSE.margin * sc.sd * Math.max(0, cf - START_COURSE.by[0]);
    const ge = gauss() * sc.sd * cf * (trait.stSdMul || 1);
    mem.stErr = mode === 'shobu' ? ge : (ge < 0 ? ge * 0.6 : ge);   // a safe start's early misses mostly get caught (放る)
    if (simRandom() < sc.dent * cf * (mode === 'antei' ? 0.5 : 1)) mem.stErr += 0.06 + simRandom() * 0.15;   // ミス／凹み
    mem.misread = false; mem.hou = false; mem.houed = false;
    mem.houSure = mode !== 'shobu' || simRandom() < START_SHOBU_HOU;   // going for it, it doesn't always pull out in time
    if (simRandom() < (trait.flyRisk || 0)) { mem.stTarget = -0.01 - simRandom() * 0.05; mem.stErr = 0; mem.misread = true; }   // reads the clock wrong and never notices
    mem.cpuDecision=null;mem.cpuLine=null;mem.cpuWide=null;mem.cpuThreaded=false;mem.cpuSlotGap=null;mem.cpuReadAt=0;mem.cpuChangedAt=0;
    mem.push = null; mem.pushDecided = false;
    mem.go = false; mem.firstDone = false; mem.dumpT = 0; mem.dumpQ = null; mem.dumpSeen.clear();
    mem.wakeOff = mem.wakeOffT = mem.wakeAhead = mem.brace = mem.emergency = 0; mem.ft = null; mem.sashiDrop = false; mem.exitHold = null; mem.wasInTurn = false; mem.entryWide = 0; mem.nigeDrop = false; mem.squeeze = null; mem.commit = false; mem.follow = false; mem.followDecided = false; mem.kabe = false; mem.kabeDecided = false; mem.commitDecided = false; mem.turnRole = null; mem.turnStyle = null; mem.sqDecided = false; mem.sqResp = null; mem.sqRespT = 0; mem.resistQ = null; mem.planDecided = false; mem.plan = null; mem.tsukeDecided = false; mem.tsukeQ = null; mem.tacticNow = trait.tactic; mem.tacticLock = null; mem.tacticNow = trait.tactic;
  }
  reset();
  const care = trait.care ?? 1;   // how early it gives way (cautious > 1, aggressive < 1)

  // Avoidance: project every nearby boat and myself 1.4 s ahead along curved paths (current
  // speed, slide and turn rate) and check the real hull shapes for the closest approach.
  // Only boats that would come within touching distance count. Who gives way:
  //   boat ahead → it has the line, I go round and lift off
  //   alongside, it's on my inside → inside has the water, I open the gap
  //   alongside, it's on my outside → I hold my line and just don't drift into it
  //   boat behind → its job, not mine
  // The one deliberate exception is a dump target.
  const PRED_T = [0.05, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.7];
  function predictPos(q, t) {
    const am = q.a + q.yaw * t * 0.5, c = Math.cos(am), s = Math.sin(am);
    return [q.x + (c * q.v - s * q.vl) * t, q.y + (s * q.v + c * q.vl) * t, q.a + q.yaw * t];
  }
  function hullGap(ax, ay, aa, bx, by, ba) {
    const ca = Math.cos(aa), sa = Math.sin(aa), cb = Math.cos(ba), sb = Math.sin(ba);
    const [px, py, qx, qy] = closestSegSeg(ax - ca * HULL_AFT, ay - sa * HULL_AFT, ax + ca * HULL_FWD, ay + sa * HULL_FWD,
                                           bx - cb * HULL_AFT, by - sb * HULL_AFT, bx + cb * HULL_FWD, by + sb * HULL_FWD);
    return Math.hypot(qx - px, qy - py) - 2 * HULL_R;
  }
  // 回りしろ: is there water to my inside (the course runs anticlockwise) — clear of the buoy, the boom and other hulls?
  function insideRoom(b, others, except) {
    const sx = Math.sin(b.a), sy = -Math.cos(b.a);   // unit vector to the inside
    const px = b.x + sx * 2.8, py = b.y + sy * 2.8, fx = px + Math.cos(b.a) * 6, fy = py + Math.sin(b.a) * 6;
    for (const m of COURSE.marks) if (Math.hypot(px - m.x, py - m.y) < 3.5 || Math.hypot(fx - m.x, fy - m.y) < 3.5) return false;
    if (Math.abs(px) < MK + 1 && Math.abs(py) < 1.5) return false;   // the boom inside the marks
    for (const q of others) {
      if (q === b || q === except || q.cap > 0) continue;
      const dx = q.x - b.x, dy = q.y - b.y, f = dx * Math.cos(b.a) + dy * Math.sin(b.a), l = dx * sx + dy * sy;
      if (l > 0.5 && l < 5 && f > -6 && f < 8) return false;
    }
    return true;
  }
  function avoid(b, others) {
    let steerAdd = 0, thrMul = 1, giveWay = false;
    const priority=trait.contactMode==='priority', threats=[];
    if (!others) return { steerAdd, thrMul };
    const fx = Math.cos(b.a), fy = Math.sin(b.a);
    const inTurn = nearMarkAt(b.x, b.y, 22);
    const margin = 0.5 + 0.5 * care + (inTurn ? 0.4 : 0) + (priority ? 1.0 : 0);
    const mine = PRED_T.map(t => predictPos(b, t));
    for (const q of others) {
      if (q === b || (!priority && ((mem.dumpT > 0 && q === mem.dumpQ) || q === mem.resistQ || (q === mem.squeeze && b.x < MK - 45 && b.y > 0)))) continue;
      const dx = q.x - b.x, dy = q.y - b.y;
      if (dx * dx + dy * dy > 900) continue;
      const fwd = dx * fx + dy * fy, lat = -dx * fy + dy * fx;   // lat > 0: q is on my right (outside)
      if (fwd < (priority ? -6 : -2.5)) continue;
      let gapMin = Infinity, tc = 0, rcx = 0, rcy = 0;
      for (let k = 0; k < PRED_T.length; k++) {
        const [ax, ay, aa] = mine[k], [qx, qy, qa] = predictPos(q, PRED_T[k]);
        const g = hullGap(ax, ay, aa, qx, qy, qa);
        if (g < gapMin) { gapMin = g; tc = PRED_T[k]; rcx = qx - ax; rcy = qy - ay; }
        if (g < 0) break;
      }
      const tsukeTgt = !priority && mem.tacticNow === 'tsuke' && q === mem.tsukeQ && !mem.firstDone;
      if (gapMin > (tsukeTgt ? 0.15 : margin)) continue;   // stays clear
      const urg = clamp(1 - tc / 1.8, 0, 1) * (gapMin < 0 ? 1 : 1 - 0.5 * gapMin / margin);
      if(priority)threats.push({boat:fleet?.boats.find(r=>r.b===q)?.no??null,predictedGapM:gapMin,atSeconds:tc,clearanceM:margin});
      const cl = -rcx * fy + rcy * fx;                     // where it will be, across my bow
      // 側面を見せて回っている艇が優先: a boat already turning across in front of me (showing me its side) has the water;
      // running on straight-ish into it, I lift right off and steer for its stern. Only side-to-side contact is racing (ダンプ);
      // putting my bow into its side is not.
      const across = Math.abs(wrapRad(q.a - b.a));
      if (!priority && fwd > -1 && across > SIDE_ON.ang && Math.abs(q.yaw) > SIDE_ON.yaw && Math.abs(b.yaw) < Math.abs(q.yaw)) {
        const sx = q.x - Math.cos(q.a) * 3 - b.x, sy = q.y - Math.sin(q.a) * 3 - b.y;   // just behind its stern
        const sternSide = (-sx * fy + sy * fx) >= 0 ? 1 : -1;
        steerAdd += sternSide * (0.3 + 0.5 * urg);
        thrMul = Math.min(thrMul, 1 - SIDE_ON.cut * urg);
        if (urg > 0.4) mem.emergency = 0.5;
        giveWay = true;
        continue;
      }
      const sameWay = Math.abs(wrapRad(q.a - b.a)) < 0.8 && q.v > b.v - 6;
      if (fwd > 1.5 && sameWay && !priority) {
        // running up behind a boat going the same way (a 差し that couldn't get its bow in): it doesn't throw the rudder
        // over to get out. With water to the inside (回りしろ) it stays in on the inside line; without, it eases out a
        // little. The lever comes off only as much as it takes not to run into it.
        const room = insideRoom(b, others, q);
        steerAdd += room ? -0.12 * urg : (0.12 + 0.2 * urg);
        if (b.v > q.v - 1.5) thrMul = Math.min(thrMul, 1 - urg);
        if (gapMin < 0.2 && tc < 0.6) mem.emergency = 0.3;
      } else if (fwd > 1.5) {
        const side = Math.abs(cl) < 0.5 ? (inTurn ? 1 : (lat >= 0 ? -1 : 1)) : (cl >= 0 ? -1 : 1);
        steerAdd += side * (0.35 + 0.65 * urg);
        if (b.v > q.v - 1) thrMul = Math.min(thrMul, 1 - 0.95 * urg);
        if (urg > 0.5) mem.emergency = 0.4;
      } else if (lat < 0) {
        // I'm the outside boat: open the gap and drop back
        steerAdd += (0.4 + 0.6 * urg) * Math.max(0.8, care);
        thrMul = Math.min(thrMul, 1 - CPU_TURN.outLift * urg);
      } else {
        // I'm the inside boat: keep my line and keep the drive on (I have the water); only if I'm sliding out into it,
        // lift a little to tighten up. Coming off a turn alongside, a rider with the stomach for it leans on it instead (ダンプ)
        steerAdd -= 0.2 * urg;
        thrMul = Math.min(thrMul, 1 - (b.vl > 0.5 ? 0.5 : 0.12) * urg);
        if (b.vl > 0.5) mem.tighten = 0.4;
        if (!priority && nearMarkAt(b.x, b.y, 30) && fwd > -1.5 && !mem.dumpSeen.has(q) && trait.dump > 0) {
          mem.dumpSeen.add(q);
          if (simRandom() < trait.dump * 0.6) { mem.dumpT = 0.55; mem.dumpQ = q; }
        }
      }
    }
    // near a turn mark there is no room inside: only dodge outward, otherwise lift off
    if (inTurn && steerAdd < 0 && !(mem.emergency > 0)) { thrMul = Math.min(thrMul, CPU_TURN.inDodgeThr); steerAdd = 0; }
    return { steerAdd: clamp(steerAdd, -0.9, 0.9), thrMul, priority, threats, giveWay };
  }

  // Wake reading: ten times a second, try a few lines to either side and take the one
  // with the calmest water, paying a little for leaving the racing line.
  function planWake(b, env, dt) {
    mem.wakeT -= dt;
    mem.wakeOff += (mem.wakeOffT - mem.wakeOff) * (1 - Math.exp(-3 * dt));
    if (mem.wakeT > 0 || !env.wakes || !env.wakes.length) return;
    mem.wakeT = 0.1;
    const fx = Math.cos(b.a), fy = Math.sin(b.a), rx = -fy, ry = fx;
    const L1 = Math.max(6, b.v * 0.6), L2 = Math.max(10, b.v * 1.1);
    const nm = nearMarkAt(b.x, b.y, 26);
    let best = 0, bestC = Infinity;
    // on the straight: no line change that would kill the run — only a nudge either side of the line it is on
    const dirX = Math.cos(b.a) >= 0 ? 1 : -1, toMark = (dirX * MK - b.x) * dirX, straight = Math.abs(Math.cos(b.a)) > 0.9 && toMark > WAKE_PLAN.freeAt;   // heading down a straight, the next mark still well ahead
    for (const off of WAKE_PLAN.offs) {
      if (straight && Math.abs(off - mem.wakeOffT) > WAKE_PLAN.nudge) continue;
      let c = wakeAt(b.x + fx * L1 + rx * off * 0.6, b.y + fy * L1 + ry * off * 0.6, env.wakes, env.now, 0.35).w
            + 0.8 * wakeAt(b.x + fx * L2 + rx * off, b.y + fy * L2 + ry * off, env.wakes, env.now, 0.6).w
            + Math.abs(off) * 0.04 + Math.abs(off - mem.wakeOffT) * 0.02;
      if (off < 0 && nm) c += 1;            // no going inside at the mark
      if (off === 0) mem.wakeAhead = c;
      if (c < bestC) { bestC = c; best = off; }
    }
    mem.wakeOffT = best;
    // can't get round it: brace for the hit
    if (bestC > 0.35) mem.brace = 0.5;
  }

  // ダンプ: in a turn, when a boat draws alongside on my outside, lean out and shove it wide.
  // Decided once per boat per turn; how often depends on temperament.
  function considerDump(b, others, dt) {
    mem.dumpT = Math.max(0, mem.dumpT - dt);
    if (!nearMarkAt(b.x, b.y, 30)) { mem.dumpSeen.clear(); return; }
    if (mem.dumpT > 0 || !others || !(trait.dump > 0) || b.v < 8) return;
    const fx = Math.cos(b.a), fy = Math.sin(b.a);
    for (const q of others) {
      if (q === b || q.cap > 0 || mem.dumpSeen.has(q)) continue;
      const dx = q.x - b.x, dy = q.y - b.y;
      const fwd = dx * fx + dy * fy, lat = -dx * fy + dy * fx;
      if (lat > 1.2 && lat < 4.5 && fwd > -3 && fwd < 2.5 && q.v > 8) {
        mem.dumpSeen.add(q);
        if (simRandom() < trait.dump) { mem.dumpT = 0.55; mem.dumpQ = q; return; }
      }
    }
  }

  // env = { now, clockZero (null once racing), laneY, others: boat states, wakes: other boats' trails,
  //         cruise: { ahead } once past the finish }
  function drive(b, env, dt) {
    if(lab.active)mem.labTrace={mode:env.retire?'retire':env.caution?'caution':env.cruise?'cruise':env.clockZero!=null?'start':'racing'};
    let thrT, steerT, rollT = 0, pitchT = 0;
    const k = 1 - Math.exp(-prof.react * dt);
    mem.emergency = Math.max(0, mem.emergency - dt);
    mem.brace = Math.max(0, mem.brace - dt);
    mem.tighten = Math.max(0, (mem.tighten || 0) - dt);
    const av = avoid(b, env.others);
    mem.av = av;
    o.ev = null;
    b.gripBoost = mem.push && mem.push.ok ? 1.35 : 1;
    b.gripSkill = (prof.grip ?? 1) * (trait.affGrip || 1);
    b.hazMul = (RISK[prof.name] || RISK.B1).hit;
    b.pushing = !!mem.push;
    b.commitTurn = !!(mem.commit || mem.follow || mem.kabe);   // others read this: a boat going round flat out

    if (env.retire) {
      // フライング返還: past 1M, peel off to the outside edge and park against it
      const edge = Math.abs(b.y) > COURSE.yMax - 7;
      const [tx, ty] = edge ? [b.x - 5, COURSE.yMin - 10] : [b.x - 40, COURSE.yMin + 3];
      const err = wrapRad(Math.atan2(ty - b.y, tx - b.x) - b.a);
      steerT = clamp(err * 2 + av.steerAdd * 0.5);
      thrT = edge ? 0 : 0.2;
      o.thr += (thrT - o.thr) * (1 - Math.exp(-3 * dt));
    } else if (env.caution) {
      // 事故後: near the wreck (and everywhere once the order is fixed) no overtaking — slow right down, pass it on the outside
      let R = prof.line + 4;
      for (const w of env.caution.wrecks) {
        const mk = COURSE.marks.reduce((m, c) => Math.hypot(w.x - c.x, w.y - c.y) < Math.hypot(w.x - m.x, w.y - m.y) ? c : m);
        const dw = Math.hypot(w.x - mk.x, w.y - mk.y);
        if (dw < 35) R = Math.max(R, Math.min(30, dw + 9));
      }
      const s = loopS(R, b.x, b.y);
      let [tx, ty] = aimOnLine(b, R, s, 10 + b.v * 0.5);
      let nearWreck = Infinity;
      for (const w of env.caution.wrecks) {
        const d = Math.hypot(w.x - b.x, w.y - b.y);
        nearWreck = Math.min(nearWreck, d);
        if (Math.abs(w.x) < MK && Math.sign(w.y) === Math.sign(b.y)) {
          const cd = b.y > 0 ? 1 : -1, along = (w.x - b.x) * cd;
          if (along > -10 && along < 70) {
            let wy = w.y + Math.sign(w.y || 1) * 9;              // 9 m outside the wreck
            if (Math.abs(wy) > COURSE.yMax - 5) wy = w.y - Math.sign(w.y || 1) * 9;
            if (Math.abs(ty) < Math.abs(wy) || Math.abs(wy) < Math.abs(w.y)) ty = wy;
          }
        }
      }
      const err = wrapRad(Math.atan2(ty - b.y, tx - b.x) - b.a);
      steerT = clamp(err * 2 + av.steerAdd * 0.6);
      let vT = clamp(CAUTION_V.near + (nearWreck - 30) * CAUTION_V.k, CAUTION_V.near - 1, CAUTION_V.far);   // 徐行 only near the wreck
      const q = env.caution.ahead;
      if (q) {
        const gap = Math.hypot(q.x - b.x, q.y - b.y);
        if (gap < 25) vT = Math.min(vT, q.v - (25 - gap) * 0.4);
        if (gap < 12) vT = Math.min(vT, q.v);
        if (gap < 6) vT = Math.min(vT, 3);
      }
      thrT = clamp(0.3 + (vT - b.v) * 0.3, 0, 1);
      // 追い抜き禁止: right behind (or alongside) the boat that goes first — lever off and sit up, let it go
      mem.cauYield = !!(q && Math.hypot(q.x - b.x, q.y - b.y) < CAUTION_ZONE.yield && b.v > q.v - 2);
      if (mem.cauYield) { thrT = 0; pitchT = -1; mem.cauYieldAt = time; }
      rollT = turnInfo(R, s).inTurn ? -0.4 : 0;
      o.thr += (thrT - o.thr) * (1 - Math.exp(-4 * dt));
    } else if (env.cruise) {
      // after the finish: ease off and run round wide in finishing order
      const R = 27;
      const s = loopS(R, b.x, b.y);
      const [tx, ty] = aimOnLine(b, R, s, 8 + b.v * 0.5);
      const err = wrapRad(Math.atan2(ty - b.y, tx - b.x) - b.a);
      steerT = clamp(err * 2 + av.steerAdd * 0.6);
      let vT = 8.5;
      const q = env.cruise.ahead;
      if (q) { const gap = Math.hypot(q.x - b.x, q.y - b.y); if (gap < 20) vT = Math.min(vT, q.v - (20 - gap) * 0.3); }
      thrT = clamp(0.3 + (vT - b.v) * 0.25, 0, 1) * av.thrMul;
      rollT = turnInfo(R, s).inTurn ? -0.25 : 0;
      o.thr += (thrT - o.thr) * (1 - Math.exp(-3 * dt));
    } else if (env.clockZero != null) {
      // flying start: idle along the waiting lane, open up when the timing works out
      const d = -boatBow(b).x, rem = env.clockZero - env.now;
      const tFull = timeToLine(Math.max(0, d), b.v, prof.cruise, true, b);   // its own motor's pull, as the rider knows it
      // it goes by its own read of the clock, which is off by stErr
      // lever lag makes it arrive a touch late; from a standstill (待機水面で止まっていた) the hull has to climb onto the plane too
      const aim = rem + mem.stErr + mem.stTarget - 0.05 - (!trait.slow && b.v < 3 ? 0.08 : 0);
      if (!mem.go && tFull >= aim) mem.go = true;
      if (mem.go && tFull < aim - 0.35) mem.go = false;  // would jump the clock: back off
      // 放る: close to the line the clock reads true — if flat out from here would be a certain フライング,
      // throw the lever off and let it coast until it's safe, then open up again
      const stNow = tFull - rem;
      if (mem.go && !mem.misread && mem.houSure && tFull < 1.8 && stNow < HOU_AT) { mem.hou = true; mem.houed = true; }
      if (mem.hou && stNow > HOU_AT + 0.03) mem.hou = false;
      thrT = mem.go && !mem.hou ? 1 : 0;
      const err = wrapRad(Math.atan2(env.laneY - b.y, 25) - b.a);
      // 起こしたらスリットまでは真っ直ぐ: 舵も体の左右の傾きも入れない
      if (!mem.go) steerT = clamp(err * 2.2 + av.steerAdd * 0.3);
      else {
        // straight on, a touch of rudder only to hold the heading; a boat that is clear ahead of the boat inside it
        // (not even overlapping) near the slit may already edge in toward it (スリット前の絞り)
        let want = 0;
        const q = env.inner;
        if (q && b.x > -60 && b.y - q.y > SQUEEZE.gap + 1.5 && clearAhead(b, q)) {
          if (mem.preSq == null) mem.preSq = simRandom() < ((trait.kado ? SQUEEZE.p.kado : SQUEEZE.p[trait.course] ?? 0) * 0.6 * Math.min(1.3, trait.pushMul ?? 1));
          if (mem.preSq) { want = -0.05; mem.preSqOn = true; }
        }
        steerT = clamp((want - wrapRad(b.a)) * 2, -PRE_SLIT.steer, PRE_SLIT.steer);
      }
      pitchT = mem.go ? prof.cruise : 0;   // 起こしたらすぐ伏せる（timeToLine と同じ前提で読む）
      o.thr += (thrT - o.thr) * (1 - Math.exp(-12 * dt));
    } else {
      if (!mem.firstDone && b.y < -4 && b.x < MK - 5) mem.firstDone = true;
      const first = !mem.firstDone && env.laneY != null;
      let R = prof.line + (first ? 0 : (trait.lineOff || 0)), tThr = prof.turnThr, late = prof.leanLate, pre = prof.preLean ?? 4;
      // ツケマイ: on the run to 1M, a まくり boat whose bow is level with (or just ahead of) the boat
      // directly inside it turns tight on that boat's side instead of going round wide, so its wake
      // lands on the inside boat. Decided once on the approach and kept through the turn.
      const courseCpu=trait.cpuMode===COURSE_CPU.version;
      let tactic = trait.tactic;
      // 2コース・3コース read the run-in to 1M (60 m out) and pick a plan:
      //   握る   got the jump on the boat inside (better start and the bow in front) → grip and go over it
      //   壁     the boat outside is coming with a まくり → hold speed and line, and shut it out
      //   差し   otherwise: 勝ちにいく差し (drop late and light, cut in tight, grip early) or
      //          着を取る差し (drop early and deep, a safer line behind, no gambles) — by class and temper
      if (!courseCpu && first && (trait.course === 2 || trait.course === 3) && !trait.kado && env.inner) {
        if (mem.planDecided) tactic = mem.plan;
        else if (b.x > MK - 60) {
          mem.planDecided = true;
          const aggr = trait.pushMul ?? 1;
          const innerAhead = env.inner.x - b.x;                 // + = the inside boat is in front
          const outerComing = env.outer && env.outer.x - b.x > -3 && (env.outerPlan === 'makuri' || env.outerPlan === 'tsuke');
          let plan = tactic;
          if (mem.squeeze) plan = 'makuri';   // it squeezed the inside: now go over the top
          else if (innerAhead < -2.5 && env.stAdv > 0.05 && simRandom() < 0.55 * aggr) plan = 'makuri';
          else if (outerComing && simRandom() < 0.35) plan = 'wall';
          else if (plan === 'sashi') {
            const pWin = ({ TOP: 0.75, A1: 0.65, A2: 0.55, B1: 0.4, B2: 0.3 }[prof.name] ?? 0.45) + (aggr > 1.2 ? 0.15 : aggr < 0.8 ? -0.15 : 0);
            plan = simRandom() < pWin ? 'sashiWin' : 'sashiPlace';
          }
          mem.plan = plan; tactic = plan;
        }
      }
      if (!courseCpu && first && tactic === 'makuri' && !trait.kado && !mem.squeeze && env.others) {
        if (mem.tsukeDecided) tactic = mem.tacticNow;
        else if (b.x > MK - 55) {
          mem.tsukeDecided = true;
          const fx = Math.cos(b.a), fy = Math.sin(b.a);
          let tgt = null, bestL = 99, tf = 0;
          for (const q of env.others) {
            if (q === b) continue;
            const dx = q.x - b.x, dy = q.y - b.y, f = dx * fx + dy * fy, l = -dx * fy + dy * fx;
            if (l < -1 && l > -12 && Math.abs(f) < 10 && -l < bestL) { bestL = -l; tgt = q; tf = f; }
          }
          if (tgt && tf < 1.5 && tf > -6 && simRandom() < (trait.tsuke ?? 0.5)) { tactic = 'tsuke'; mem.tsukeQ = tgt; }
        }
      }
      // まくり見切り: just before 1M, a まくり that hasn't got clear of the boats inside (about a length in front)
      // doesn't force it over the top of them — it switches to まくり差し (if it is close enough and has the nerve) or drops in behind
      if (!courseCpu && first && env.others && !mem.squeeze) {
        if (mem.makuriAbort) tactic = mem.makuriAbort;
        else if (tactic === 'makuri' && b.x > MK - MAKURI_CHECK.at) {
          mem.makuriAbort = null;
          let lead = Infinity;
          for (const q of env.others) { if (q === b || q.cap > 0 || q.y < 0 || q.y >= b.y - 0.5) continue; lead = Math.min(lead, b.x - q.x); }
          if (lead < MAKURI_CHECK.lead) {
            const aggr = trait.pushMul ?? 1;
            mem.makuriAbort = lead > -MAKURI_CHECK.behind && simRandom() < MAKURI_CHECK.pMs * aggr ? 'makurisashi' : 'sashiPlace';
            tactic = mem.makuriAbort;
          } else mem.makuriAbort = 'makuri';
        }
      }
      if(courseCpu&&first){
        tactic=cpuChooseFirstMark(b,env,trait,mem);
        if(trait.preferredTactic&&trait.preferredTactic!=='auto')tactic=trait.preferredTactic;
      }
      if(lab.active){
        const autoCandidate=tactic,forced=env.labDirective?.tactic;
        if(first && forced && forced!=='auto'){
          tactic=forced;
          if(tactic==='tsuke'){
            mem.tsukeQ=env.inner||null;
            if(!mem.tsukeQ)tactic='makuri';
          }
        }
        Object.assign(mem.labTrace,{autoCandidate,requestedTactic:forced||'auto',chosenTactic:first?tactic:'normalLap',forcedTactic:!!(first&&forced&&forced!=='auto'),fallback:forced==='tsuke'&&!env.inner?'noInnerBoat:makuri':null});
      }
      if(courseCpu&&first&&mem.cpuAppliedTactic!==tactic){mem.sashiDrop=false;mem.nigeDrop=false;mem.cpuAppliedTactic=tactic;mem.cpuThreaded=false;mem.cpuSlotGap=null;}
      if (first) mem.tacticNow = tactic;
      if(lab.active&&courseCpu&&first)mem.labTrace.courseDecision={...mem.cpuDecision,actualTactic:tactic,forced:!!(trait.preferredTactic&&trait.preferredTactic!=='auto'||env.labDirective?.tactic&&env.labDirective.tactic!=='auto')};
      // how close to the buoy the apex runs (A1 nearly scrapes it)
      let gap = (prof.gap ?? 5) + (first ? 0 : (trait.lineOff || 0) * 0.5);
      // 逃げ: hug the mark and turn first
      if (first && tactic === 'nige') {
        R = Math.max(8, prof.line - 3.5); pre += 2; gap -= 0.5;
        // 流れる: decided once on the run-in — a 逃げ that swings wide off the buoy leaves the door open for the 差し
        if (mem.nagare == null && b.x > MK - 40 && env.others) {
          const outerAlong = env.others.some(q => q !== b && q.cap <= 0 && q.y > b.y && q.y - b.y < 9 && q.x - b.x > -3);   // (lanes are 7 m apart)
          const p = (NIGE_NAGARE.p[prof.name] ?? 0.25) + (waterEnv ? NIGE_NAGARE.tail * clamp(waterEnv.wx, 0, 8) / 4 : 0) + (outerAlong ? NIGE_NAGARE.press : 0) + (env.others.some(q => q !== b && q.cap <= 0 && q.y > b.y && q.y - b.y < 16 && q.x - b.x > 2) ? NIGE_NAGARE.late : 0);   // an outside boat already in front (beaten at the start)
          mem.nagare = simRandom() < p;
        }
        if (mem.nagare) { R += NIGE_NAGARE.R; gap += NIGE_NAGARE.gap; }
        // coming in hot off a 100 m run-up: blip the lever down just before the mark so it can turn tight
        // and shut the door on the 差し, then grip again as soon as it's pointing round
        const tiN = turnInfo(R, loopS(R, b.x, b.y, gap), gap);
        if (!tiN.inTurn && tiN.toTurn < NIGE_DROP.at) mem.nigeDrop = true;
        if (tiN.inTurn && (Math.PI * R - tiN.left) > Math.PI * R * NIGE_DROP.regrip) mem.nigeDrop = false;
      }
      // 差し: lift off a touch, let the inside boats turn, then cut underneath them
      const isSashi = tactic === 'sashi' || tactic === 'sashiWin' || tactic === 'sashiPlace';
      if (first && isSashi) {
        // 差し構え: drop the lever on the run-in so the inside boat turns first and the outside boats can
        // go over the top, then grip again part-way round and cut in underneath.
        // 勝ちにいく差し drops late and light and grips early, tight to the buoy; 着を取る差し drops early
        // and deep, grips later and runs a safer line a little wider.
        const k = SASHI[tactic === 'sashiPlace' ? 'place' : 'win'];
        R = Math.max(8.5, prof.line - k.rCut); late += k.late; gap += k.gapAdd;
        const tiA = turnInfo(R, loopS(R, b.x, b.y, gap), gap);
        if (!tiA.inTurn && tiA.toTurn < k.dropAt) mem.sashiDrop = true;
        if (tiA.inTurn && (Math.PI * R - tiA.left) > Math.PI * R * k.regrip) mem.sashiDrop = false;
        mem.sashiLever = k.lever;
        tThr = mem.sashiDrop ? k.lever : 1;
      }
      // 壁: stay on the gas and turn just outside the boat inside, so the まくり from outside can't get over
      // まくり・壁 don't aim at the buoy: they aim at the boat inside (the one they are going over / shutting out)
      // and run just outside its line — the turn is taken round that boat, not round the mark
      const tgt = first && (tactic === 'wall' || tactic === 'makuri') ? innerTarget(b, env) : null;
      const tgtGap = q => { const mk = COURSE.marks[0]; return q.x < mk.x ? Math.abs(q.y - mk.y) : Math.hypot(q.x - mk.x, q.y - mk.y); };   // running in: how far off the buoy's line it is; going round: its radius
      if (first && tactic === 'wall') { R = prof.line; gap = tgt ? clamp(tgtGap(tgt) + MAKURI_LINE.wall, prof.gap ?? 5, R) : Math.max(gap, (prof.gap ?? 5) + 4); tThr = 1; }
      // まくり: carry full speed and go over the top of the boats inside — just outside their line, not a wide sweep
      if (first && tactic === 'makuri') {
        R = prof.line + 1.5 + (trait.course - 2) * 1.0; tThr = 1; pre += 5;
        if (tgt) { const off = MAKURI_LINE.off - (MAKURI_LINE.off - MAKURI_LINE.offAhead) * clamp((b.x - tgt.x) / 3, 0, 1); gap = clamp(tgtGap(tgt) + off, (prof.gap ?? 5) + 1, MAKURI_LINE.maxGap); R = Math.max(R, gap); }   // the further in front, the closer over its bow
        else gap = Math.min(R, gap + 2 + trait.course * 0.5);
        mem.makuriTgt = tgt;
      }
      if(first&&tactic==='makurisashi'){R=Math.max(prof.line,21);gap=Math.max(gap,9);pre+=3;tThr=.92;}
      // ツケマイ: ride 3 m outside the target's line, flat out, leaning in early and hard
      if (first && tactic === 'tsuke' && mem.tsukeQ && !mem.turnRole) {
        const q = mem.tsukeQ, mk = COURSE.marks[0], dq = Math.hypot(q.x - mk.x, q.y - mk.y);
        gap = clamp((dq < 30 ? dq : Math.abs(q.y)) + 3, prof.gap ?? 5, 26);
        tThr = 1; pre += 6; late = 0;
      }
      // 1Mの回り順: whoever turns first owns the buoy. Everyone else reads the boat just in front of them:
      //   an outside boat in front (crossing to the buoy) → lift and let it go, then turn tight behind it
      //   an inside boat in front, with water between it and the buoy → 差し through that gap
      //   an inside boat in front, no water inside → go round the outside of it (まくり), on the gas
      // Priorities: no contact, keep the speed, a clean exit — not scraping the buoy for its own sake.
      // Every turn, both marks: the back straight into 2M is the home straight into 1M turned round (x, y → −x, −y),
      // so the same reading works on mirrored positions.
      const tSide = b.y > 0 ? 1 : -1, tb = tSide > 0 ? b : mirrorBoat(b);
      if (env.others && !env.caution && !env.cruise && tb.y > 0 && tb.x > MK - TURN_ORDER.zone) {
        const tr0 = turnInfo(R, loopS(R, b.x, b.y, gap), gap);
        const tEnv = tSide > 0 ? env : { others: env.others.map(mirrorBoat) };
        // each rider's way of taking this turn, decided once as it comes into the zone (see TURN_STYLE)
        if (!mem.turnStyle) mem.turnStyle = first && (mem.commit || mem.kabe) ? 'commit' : first && mem.follow ? 'follow' : turnStyleOf(tb, tEnv, trait, prof, first);
        if (!tr0.inTurn || !mem.turnRole || mem.turnRole.role === 'wait') {
          const r0 = turnRoleOf(tb, tEnv, mem.turnStyle);
          if (r0.q) r0.q = r0.q.src || r0.q;
          if (r0.yieldTo) r0.yieldTo = r0.yieldTo.src || r0.yieldTo;
          r0.side = tSide; mem.turnRole = r0;
        } else {
          // the line is set once it is turning, but a boat that has since got clear in front still gets let through
          const r1 = turnRoleOf(tb, tEnv, mem.turnStyle);
          if (r1.yieldTo && !mem.turnRole.yieldTo) mem.turnRole.yieldTo = r1.yieldTo.src || r1.yieldTo;
        }
        const ro = mem.turnRole, offMark = (prof.gap ?? 5) + TURN_ORDER.others;   // only the first one round scrapes the buoy
        if (ro.role === 'mark' && !ro.yieldTo) { R = first && (tactic === 'makuri' || tactic === 'tsuke') ? Math.max(9, prof.line + TURN_ORDER.swellOut * 0.5) : Math.min(R, Math.max(prof.line, 9)); gap = Math.min(gap, prof.gap ?? 5); }   // a まくり round first still goes in flat out and swings a little
        else if (ro.role === 'mark') { R = Math.max(9, prof.line - 1); gap = Math.max(gap, offMark - 1); }   // let the outside boat go, then turn in behind it
        else if (ro.role === 'sashi') { R = Math.max(8.5, prof.line - (ro.between ? 0 : 2)); gap = clamp(ro.gapT ?? ro.room - TURN_ORDER.sashiIn, ro.forced ? 3.5 : TURN_ORDER.sashiMin, Math.max(R, ro.gapT ?? 0)); R = Math.max(R, gap); }
        else if (ro.role === 'wait') { gap = clamp(Math.max(gap, offMark + TURN_ORDER.outOff, gapOffMark(tb)), 0, 30); R = Math.max(R, gap); }   // hold off: keep my line (no turning in) while the inside sorts itself out
        else if (ro.role === 'waitIn') { R = Math.max(8.5, prof.line - 2.5); gap = Math.max(prof.gap ?? 5, 3) + 1; }   // then 最内差し: tight, behind the pack that has swung out
        else if (ro.role === 'out' || ro.role === 'wide') {
          const off = ro.role === 'wide' ? TURN_ORDER.wideOff : ro.over ? TURN_ORDER.overOff : TURN_ORDER.outOff;
          gap = clamp((ro.q ? ro.qGap : offMark) + off, ro.over ? (prof.gap ?? 5) : offMark, 28); R = Math.max(R, prof.line + (ro.role === 'wide' ? TURN_ORDER.swellWide : ro.over ? TURN_ORDER.swellOver : TURN_ORDER.swellOut), gap); tThr = 1;   // flat out round the outside: a bigger circle — it swings out, and that opens the inside for the 差し
        }
        if (ro.role !== 'mark' && ro.role !== 'sashi' && ro.role !== 'waitIn' && !ro.over) gap = Math.max(gap, offMark);
        // going round the outside of a boat that is right alongside and hasn't started turning yet: don't turn in on it — hold the line until it does
        if ((ro.role === 'out' || ro.role === 'wide') && ro.q && ro.q.cap <= 0) {
          const tq = tSide > 0 ? ro.q : mirrorBoat(ro.q), qHead = wrapRad(tq.a);
          if (qHead > -TURN_ORDER.startedA && Math.abs(tq.x - tb.x) < TURN_ORDER.alongX) { gap = Math.max(gap, gapOffMark(tb) + 1.5); R = Math.max(R, gap); }
        }
      } else if (!(tb.y > 0 && tb.x > MK - TURN_ORDER.zone)) { mem.turnRole = null; mem.turnStyle = null; }
      // 勝負どころ: going into a turn in a close fight (never when comfortably clear), sometimes go for it.
      // Whether it comes off is decided by class up front; the physics then plays it out.
      {
        const t0 = turnInfo(R, loopS(R, b.x, b.y, gap), gap);
        // 舳先がかかる: going into a turn, a boat on my inside whose bow is past my stern has the 差し — even a few cm in.
        //   still behind me (no overlap)      → 差させない: shut the door, run tighter to the buoy
        //   bow in, short of my cockpit       → no shutting the door on it any more: keep my line
        //   bow at my cockpit (half a boat+)  → I can't turn in on it: grip and run round outside it
        // And from the inside: my bow in on the boat outside me → that 差し is mine — no lifting, straight through.
        mem.hesaki = false;
        if (env.others && (t0.inTurn || t0.toTurn < 40)) {
          const fx = Math.cos(b.a), fy = Math.sin(b.a);
          let shut = false, deep = 0;
          for (const q of env.others) {
            if (q === b || q.cap > 0) continue;
            const dx = q.x - b.x, dy = q.y - b.y, f = dx * fx + dy * fy, l = -dx * fy + dy * fx, qBow = f + BOW_TIP;
            if (l < -0.5 && l > -6 && f > -12 && f < 2) {                   // on my inside
              if (qBow <= -HESAKI.stern) shut = true;
              else if (qBow >= HESAKI.deep) deep = Math.max(deep, -l);
            }
            if (l > 0.5 && l < 6 && f > 0 && f - HESAKI.stern < BOW_TIP) mem.hesaki = true;   // outside me, its stern behind my bow
          }
          if (deep) { gap = Math.max(gap, (prof.gap ?? 5) + deep + HESAKI.outOff); R = Math.max(R, gap); tThr = 1; }
          else if (shut) gap = Math.max(2.8, gap - 1.2);
          if (mem.hesaki && !first) { tThr = 1; mem.sashiDrop = false; }
        }
        if (!t0.inTurn && t0.toTurn > 60) { mem.pushDecided = false; mem.push = null; }
        if (!mem.pushDecided && !t0.inTurn && t0.toTurn < 35) {
          mem.pushDecided = true;
          const rk = RISK[prof.name] || RISK.B1;
          const at1M = b.y > 0;   // on the home straight, the next mark is 1M
          if (env.battle && !(first && tactic === 'sashiPlace') && simRandom() < rk.go * (trait.pushMul ?? 1) * (at1M ? PUSH_AT_1M : 1)) mem.push = { ok: simRandom() < rk.ok, applied: false, done: false };
        }
        if (mem.push) { R = Math.max(7.5, R - 2.5); gap = Math.max(2.8, gap - 1); tThr = 1; late = 0; pre += 3; }
      }
      // still out wide when the next mark comes up: don't dive back in — take the turn wider instead
      if (mem.entryWide) gap = Math.min(R, gap + mem.entryWide);
      if(lab.active&&env.labDirective){
        if(env.labDirective.R!=null)R=env.labDirective.R;
        if(env.labDirective.gap!=null)gap=env.labDirective.gap;
        gap=Math.min(gap,R);
      }
      if(first&&(courseCpu||tactic==='makurisashi'&&!mem.turnRole)){
        const line=cpuFirstLine(b,env,trait,mem,tactic,R,gap,dt);
        R=line.R;gap=Math.min(line.gap,R);
        if(lab.active&&env.labDirective){if(env.labDirective.R!=null)R=env.labDirective.R;if(env.labDirective.gap!=null)gap=Math.min(env.labDirective.gap,R);}
        if(lab.active)mem.labTrace.courseLine={...line,R,gap};
      }
      const s = loopS(R, b.x, b.y, gap);
      let look = (prof.look0 ?? 7) + b.v * (prof.lookK ?? 0.55);
      // A long look-ahead cuts the chord across an outside arc. Follow the intended wide turn.
      if(first&&courseCpu&&(tactic==='makuri'||tactic==='makurisashi'&&mem.cpuLine?.stage==='outside_entry'))look=Math.min(look,R*.75+6);
      let [tx, ty] = aimOnLine(b, R, s, look, gap);
      // 立ち上がり: coming out of a turn, put the power down and run straight on the line it came out on.
      // Only once the boat is up to speed does it start drifting across to where it wants to be — slowly.
      const tiNow = turnInfo(R, s, gap);
      // finishing a turn wide of the line: aim along the straight at the width it's at, not back in at the line —
      // cutting back in here is what makes the boat over-rotate and swing round in a curve
      if (tiNow.inTurn && Math.abs(tx) < MK && Math.sign(ty) === Math.sign(b.y) && Math.abs(b.y) > Math.abs(ty)) ty = Math.sign(ty) * Math.abs(b.y);
      if (tiNow.inTurn) { mem.wasInTurn = true; mem.exitHold = null; }
      else if (mem.wasInTurn) {
        mem.wasInTurn = false; mem.entryWide = 0;
        if (Math.abs(b.x) > MK - 40) mem.exitHold = { y: Math.abs(b.y), side: Math.sign(b.y) || 1, up: false, run: 0 };
      }
      const eh = mem.exitHold;
      if (eh && !env.finalStretch && tiNow.toTurn > 55 && Math.sign(b.y) === eh.side) {
        // only ever in: a boat that came out tighter than its line keeps the tight line
        const want = Math.min(Math.abs(ty), eh.y);
        if (b.v >= EXIT.vTop * EXIT.upAt) eh.up = true;
        // a straight diagonal: sideways in proportion to the distance run, eased in over the first few metres
        eh.run += b.v * dt;
        const rate = (EXIT.slope[prof.name] ?? 0.06) * b.v * clamp(eh.run / EXIT.settle, 0, 1);
        eh.y += clamp(want - eh.y, -rate * dt, 0);
        const dir = eh.side > 0 ? 1 : -1;   // home straight runs +x, back straight −x
        look *= 1.3;
        tx = b.x + dir * look; ty = eh.side * eh.y;
      } else if (eh && tiNow.toTurn <= 55) {
        mem.entryWide = Math.max(0, eh.y - Math.abs(ty));
        mem.exitHold = null;
      }
      const accelerating = !!(mem.exitHold && !mem.exitHold.up);
      // first straight: hold the entry lane, then converge on the mark
      if (first && b.y > 0 && b.x < MK - 45) { const w = clamp((b.x + 20) / (MK - 25), 0, 1); ty = env.laneY + (ty - env.laneY) * w; }
      // first straight: a boat right ahead on my line → ease just out of its 航跡 (a little, within my lane)
      if (first && b.y > 0 && b.x > -5 && b.x < MK - 45 && env.others) {
        let lead = null, best = 40;
        for (const q of env.others) {
          if (q === b || q.cap > 0 || q.v < 8) continue;
          const al = q.x - b.x;
          if (al > 3 && al < best && Math.abs(q.y - b.y) < TRAIL.width + 0.3) { lead = q; best = al; }
        }
        if (lead) {
          const pref = Math.sign(b.y - lead.y) || (mem.fsSide || 1);
          for (const sd of [pref, -pref]) {
            const y2 = lead.y + sd * (TRAIL.width + 0.6);
            if (Math.abs(y2 - env.laneY) > 2.6 || y2 < 6) continue;
            const blocked = env.others.some(q => q !== b && q !== lead && q.cap <= 0 && q.x - b.x > -12 && q.x - b.x < 6 && Math.sign(q.y - b.y) === Math.sign(y2 - b.y) && Math.abs(q.y - y2) < 3.2);
            if (!blocked) { ty = b.y + (y2 - b.y) * TRAIL.dodgeK; mem.fsSide = sd; break; }
          }
        }
      }
      // 絞り: got the jump on the boat inside? squeeze in on it, slowly enough not to be 斜行
      let squeezing = false;
      if((lab.active||courseCpu) && trait.squeezeMode && trait.squeezeMode!=='legacy'){
        const sq=labSqueezeDecision(b,env,mem,trait.squeezeMode,first,look);
        if(lab.active)mem.labTrace.squeezeDecision=sq.detail;
        if(sq.targetY!=null){tx=b.x+look;ty=sq.targetY;}
        squeezing=sq.detail.active;
        if(sq.started)o.ev='squeeze';
      } else if (!(trait.contactMode==='priority') && first && b.y > 0 && env.inner && b.x < MK - 45) {
        // スリットを越えたら一気に勝負: the intent is set at the slit, and it squeezes the moment it is clear ahead of
        // the boat inside (turning toward a boat it still overlaps would be 第19条)
        if (!mem.sqDecided && b.x > 0) {
          mem.sqDecided = true;
          const pc = trait.kado ? SQUEEZE.p.kado : SQUEEZE.p[trait.course] ?? 0;
          // 凹み: the boat inside got a poor start → most riders go for it, and some hammer straight across (叩く)
          // a dash that timed it as well as the inside (or better) comes with the speed: 一撃まくり
          const dashHit = !trait.slow && (env.stAdv ?? 0) >= SQUEEZE.dashHitSt;
          const dent = (env.stAdv ?? 0) > SQUEEZE.dentSt || (dashHit && (env.stAdv ?? 0) > SQUEEZE.dashHardSt);
          mem.sqIntent = mem.preSqOn || simRandom() < (dent ? SQUEEZE.dentP : dashHit ? SQUEEZE.dashHitP : pc) * Math.min(1.3, trait.pushMul ?? 1);
          mem.sqHard = dent && mem.sqIntent && simRandom() < (SQUEEZE.hardP[trait.temper] ?? 0.5);
          // 叩きに入る: straight after the slit, a dash that is already in front of the boat inside, or plainly
          // out-running it (伸び), goes for it there and then
        }
        // 叩きに入る: judged a little past the slit (COMMIT.at m), once the スロー boats have had a chance to 伸び返す —
        // only a dash that is really in front of the boat inside and still pulling away on it goes for it.
        // 3コース likewise against a 2 that has sat back in its 差し構え.
        if (!mem.commitDecided && b.x > COMMIT.at && env.inner.cap <= 0) {
          mem.commitDecided = true;
          const lead = b.x - env.inner.x, dv = b.v - env.inner.v;
          const ok = !trait.slow ? lead >= COMMIT.lead && dv >= COMMIT.dv : trait.course === 3 && lead >= MAKURI3.lead && dv >= 0;
          if (ok && simRandom() < (trait.slow ? MAKURI3.p : SQUEEZE.dashHitP) * Math.min(1.3, trait.pushMul ?? 1)) { mem.sqIntent = true; mem.commit = true; }
        }
        // カド受け: the 4カド comes over → the 3 stays on the gas as a wall (no giving way), then turns flat out round the outside
        if (trait.course === 3 && trait.slow && env.outerCommit && !mem.commit && !mem.kabeDecided) { mem.kabeDecided = true; mem.kabe = simRandom() < (MAKURI3.wallP[trait.temper] ?? 0.4); }
        // the moment its bow is clear of the inside boat's (舳先がかからない), it turns in
        // the moment its bow is clear of the inside boat's (舳先がかからない), it turns in. A committed dash starts closing
        // straight away, but stays SQUEEZE.gap outside the boat until it is clear of it (any contact on the straight is its fault)
        if (mem.sqIntent && !mem.squeeze && env.inner.cap <= 0 && (mem.commit || clearAhead(b, env.inner))) { mem.squeeze = env.inner; o.ev = 'squeeze'; }
        // 叩く: past one, and the next one in is also clear behind → keep going across it too
        if ((mem.sqHard || mem.commit) && mem.squeeze && env.others && clearAhead(b, mem.squeeze)) {
          // clear of this one: across its bow and on to the next boat in (held off it in turn until clear of that one too)
          let nx = null;
          for (const q of env.others) if (q !== b && q !== mem.squeeze && q.cap <= 0 && q.y > 0 && q.y < mem.squeeze.y && (!nx || q.y > nx.y)) nx = q;
          if (nx && (mem.commit || clearAhead(b, nx))) mem.squeeze = nx;
        }
        // 連動: the dash inside me has gone in to 叩く → follow it round, outside it and flat out, and まくる a little wide of the scramble at the buoy
        if (!trait.slow && !mem.commit && !mem.squeeze && env.innerCommit && !mem.followDecided && b.x > 0) { mem.followDecided = true; mem.follow = simRandom() < (FOLLOW.p[trait.temper] ?? 0.75); }
        if (mem.follow && env.inner && env.inner.cap <= 0) { ty = Math.max(ty - 8, env.inner.y + FOLLOW.off); squeezing = true; }
        if (mem.squeeze && mem.squeeze.cap <= 0) { ty = Math.max(ty - (mem.sqHard || mem.commit ? 10 : 6), mem.squeeze.y + SQUEEZE.gap); squeezing = true; }   // (an ordinary 絞り; only the 叩き decided at COMMIT.at goes round flat out)
      }
      // being squeezed from outside: give way (引く — lift, tuck in behind) or, now and then, fight it (抵抗)
      if (mem.kabe && !mem.sqResp) { mem.sqResp = 'kabe'; mem.sqRespT = 0; }
      if (first && b.y > 0 && env.outerSqueeze && !mem.sqResp && b.x < MK - 45) {
        mem.sqResp = trait.contactMode==='priority' ? 'yield' : simRandom() < (SQUEEZE.resist[trait.temper] ?? 0.15) ? 'resist' : 'yield';
        mem.sqRespT = SQUEEZE.yieldTime;
        if (mem.sqResp === 'resist') mem.resistQ = env.outer;
        o.ev = mem.sqResp;
        if (mem.sqResp === 'yield' && (trait.course === 2 || trait.course === 3) && !mem.planDecided) { mem.planDecided = true; mem.plan = 'sashiPlace'; }
      }
      mem.sqRespT = Math.max(0, mem.sqRespT - dt);
      if (mem.sqResp === 'yield' && mem.sqRespT > 0) ty = b.y;   // 叩かれた側: holds its line — doesn't dive in, doesn't push out
      // 張る: push out into it — only on the first straight, against a boat really outside me (it used to stay on for
      // the rest of the race and, with the 'outside' boat over on the back straight, dragged the rider across the infield)
      if (first && mem.sqResp === 'resist' && b.y > 0 && b.x < MK - 45 && env.outer && env.outer.y > b.y) ty = Math.min(env.outer.y - 1.1, b.y + 2);
      if (!(first && b.x < MK - 45)) mem.resistQ = null;
      // read the wake and shift the line toward calmer water
      planWake(b, env, dt);
      if (mem.wakeOff) { const fx = Math.cos(b.a), fy = Math.sin(b.a); tx += -fy * mem.wakeOff; ty += fx * mem.wakeOff; }
      // Don't sit in a boat's wake: on a straight, if a boat ahead is on my line, move over and run
      // alongside it instead (5 m to the side, where no one is behind or alongside me). After the last
      // turn it looks further ahead and commits harder, since the run home is all straight.
      if ((Math.abs(b.x) < STRAIGHT_X + 10 || accelerating) && env.others && !first) {
        const cd = b.y > 0 ? 1 : -1, reach = env.finalStretch ? TRAIL.range : accelerating ? 45 : TRAIL.range, gapSide = env.finalStretch ? 4 : 3.5;   // just clear of its 航跡 (no need to go a whole lane over)
        let lead = null, best = reach;
        for (const q of env.others) {
          if (q === b || q.cap > 0 || Math.sign(q.y) !== Math.sign(b.y)) continue;
          const along = (q.x - b.x) * cd;
          if (along > 2 && along < best && Math.abs(q.y - b.y) < 3.5) { lead = q; best = along; }
        }
        if (lead) {
          mem.sideT = (mem.sideT || 0) - dt;
          if (mem.sideLead !== lead || mem.sideY == null || mem.sideT <= 0) {
            mem.sideT = 0.5;
            mem.sideLead = lead; mem.sideY = null;
            // try inside first, then outside — but while still accelerating out of a turn, only the side I'm
            // already on relative to it (no cutting across its bow)
            // coming off a turn behind a boat (a 差し that didn't get its bow in): stay in on the inside line if there is
            // water there; only otherwise ease out to its outside — the side it is already on, no cutting across its bow
            const sides = accelerating ? (b.y * Math.sign(b.y) <= lead.y * Math.sign(b.y) + 1 ? [-Math.sign(b.y)] : [-Math.sign(b.y), Math.sign(b.y)]) : [-Math.sign(b.y), Math.sign(b.y)];
            for (const sd of sides) {
              const y2 = lead.y + sd * gapSide;
              if (Math.abs(y2) < 5 || Math.abs(y2) > COURSE.yMax - 6 || Math.sign(y2) !== Math.sign(b.y)) continue;
              const blocked = env.others.some(q => {
                if (q === b || q === lead || q.cap > 0) return false;
                const al = (q.x - b.x) * cd, dy = q.y - b.y;
                // someone behind or alongside on that side: moving over would be 斜行
                if (al > -14 && al < 4 && Math.sign(dy) === Math.sign(y2 - b.y) && Math.abs(dy) < gapSide + 3) return true;
                // someone already up ahead on that line: I'd just be in their wake instead
                return al >= 4 && al < best + 8 && Math.abs(q.y - y2) < 3.2;
              });
              if (!blocked) { mem.sideY = y2; break; }
            }
          }
          if (mem.sideY != null) { ty = b.y + (mem.sideY - b.y) * TRAIL.dodgeK; if (mem.exitHold) mem.exitHold.y = Math.abs(mem.sideY); }   // aim past it: the line is read far ahead, so a plain target would take ages to reach
        } else { mem.sideLead = null; mem.sideY = null; }
      }
      // 斜行 is not allowed: on a straight, cap how steeply it angles across the water.
      // Nearly parallel while any boat is on that side (behind or alongside); a moderate angle only when clear.
      if (Math.abs(b.x) < STRAIGHT_X && env.others) {
        const cd = b.y > 0 ? 1 : -1, courseA = cd > 0 ? 0 : Math.PI;
        let want = wrapRad(Math.atan2(ty - b.y, tx - b.x) - courseA);
        const dyDir = Math.sign(ty - b.y);
        const crowded = dyDir !== 0 && env.others.some(q => {
          if (squeezing && q === mem.squeeze) return false;
          if (q === mem.resistQ) return false;
          if (q === b) return false;
          const along = (q.x - b.x) * cd;
          return along > -14 && along < 4 && Math.sign(q.y - b.y) === dyDir && Math.abs(q.y - b.y) < 8;
        });
        const maxDev = squeezing ? ((lab.active||courseCpu)&&trait.squeezeMode==='lead'?0.12:(mem.sqHard||mem.commit||mem.follow)?SQUEEZE.hardDev:SQUEEZE.dev) : mem.resistQ ? 0.07 : crowded ? 0.03 : 0.22;
        want = clamp(want, -maxDev, maxDev);
        tx = b.x + Math.cos(courseA + want) * look; ty = b.y + Math.sin(courseA + want) * look;
      }
      if(lab.active)Object.assign(mem.labTrace,{target:{x:tx,y:ty},R,gap});
      const err = wrapRad(Math.atan2(ty - b.y, tx - b.x) - b.a);
      if(trait.contactMode==='priority'){mem.dumpT=0;mem.dumpQ=null;}else considerDump(b, env.others, dt);
      const dumping = mem.dumpT > 0;
      steerT = clamp(err * (prof.gain ?? 2.2) * (accelerating ? 0.75 : 1) + (dumping ? 0.65 : av.steerAdd) + (simRandom() * 2 - 1) * prof.wobble * (accelerating ? 0.5 : 1));
      // ターンから直線へ: don't crank the rudder to snap onto the straight — ease onto it
      if (mem.exitHold && !dumping && mem.exitHold.run < EXIT.calmRun) {
        const cap = Math.max(EXIT.steerCap + (1 - EXIT.steerCap) * mem.exitHold.run / EXIT.calmRun, Math.abs(av.steerAdd));
        steerT = clamp(steerT, -cap, cap);
      }
      const ti = turnInfo(R, s, gap);
      // body goes in once the turn is close enough (late drivers lean later)
      const leanIn = ti.inTurn ? (ti.left > 0 && (Math.PI * R - ti.left) >= late) : ti.toTurn < pre + b.v * 0.15 - late;
      if (leanIn && !mem.wasLean) mem.tq = turnRoll(prof);   // how this turn comes off
      mem.wasLean = leanIn;
      const tq = mem.tq || { lean: 1, up: 1, carve: 1, easeAt: 0.4 };
      const exiting = ti.inTurn && ti.left < (prof.exitEarly ?? 4);
      if (leanIn && !exiting) {
        rollT = -prof.lean * tq.lean * clamp((b.v - 4) / 4, 0, 1);   // anticlockwise course: inside is left
        const upA = prof.up * tq.up * CPU_TURN.upK;
        pitchT = -upA;
        thrT = tThr;
        // 起こして入り、傾けたまま起こしを緩めて伏せながら抜ける — the better the rider, the cleaner the hand-over
        if (ti.inTurn) {
          const prog = 1 - ti.left / (Math.PI * R), skill = (CARVE[prof.name] ?? 0.5) * tq.carve;
          const ease = clamp((prog - tq.easeAt * CPU_TURN.easeK) / 0.5, 0, 1) * skill;
          pitchT = -upA + (upA + 0.9) * ease;
        }
        if (tactic === 'tsuke' && first) { rollT = -Math.max(prof.lean, 0.9) * clamp((b.v - 4) / 4, 0, 1); pitchT = -Math.max(prof.up, 0.8); }
        if (mem.push) {
          rollT = -clamp((b.v - 4) / 4, 0, 1); pitchT = -1;
          const into = Math.PI * R - ti.left;
          if (!mem.push.ok && !mem.push.applied && ti.inTurn && into > Math.PI * R * 0.3) { mem.push.applied = true; o.ev = 'pushFail'; }
        }
        // bracing for wake mid-turn: ease the lean and the lever a touch so the hull doesn't let go
        if (mem.brace > 0) { rollT *= 0.85; thrT *= 0.9; }   // bracing mid-turn: ease the lean and the lever a touch
        if (mem.tighten > 0) { rollT = Math.min(rollT, -0.9 * clamp((b.v - 4) / 4, 0, 1)); pitchT = Math.min(pitchT, -0.8); }
      } else {
        if (mem.push && mem.push.ok && !mem.push.done && ti.inTurn) { mem.push.done = true; o.ev = 'pushOk'; }
        thrT = 1;
        pitchT = b.v > 12 || accelerating ? prof.cruise : 0;   // out of the turn: get down and let it run
        if (env.finalStretch && b.v > 12) pitchT = 1;   // flat out for the line
        // bracing on a straight: come up off the deck a touch to ride the wave out
        if (mem.brace > 0) pitchT = Math.min(pitchT, 0.3);
      }
      thrT = dumping ? Math.max(thrT, 0.9) : thrT * av.thrMul;
      const avoiding = av.thrMul < 0.8 || mem.emergency > 0 || av.giveWay;   // getting out of someone's way beats any 全速 plan
      // (and doesn't lift on the straight either: the boat coming across has to get clear itself)
      if (first && mem.kabe && b.y > 0 && !avoiding) { thrT = Math.max(thrT, 0.97); pitchT = Math.max(pitchT, -0.2); }   // 壁: flat out alongside it
      if (mem.resistQ) thrT = 1;
      if (first && isSashi && mem.sashiDrop) { thrT = Math.min(thrT, mem.sashiLever); pitchT = Math.min(pitchT, 0); }   // lever down, sat up
      if (first && tactic === 'wall' && !(mem.emergency > 0)) thrT = Math.max(thrT, 0.95);
      if (first && tactic === 'nige' && mem.nigeDrop) thrT = Math.min(thrT, NIGE_DROP.lever[prof.name] ?? 0.7);
      if (first && tactic === 'makuri' && !(mem.emergency > 0)) thrT = 1;   // まくり: flat out all the way round
      // 回り順 on the lever: yield = lift until the outside boat has crossed in front; 差し = ease until clear behind its stern; まくり外 = flat
      const ro = mem.turnRole && !env.caution && !env.cruise ? mem.turnRole : null;
      if (ro && (ro.q ? ro.q.cap <= 0 : ro.yieldTo || ro.role === 'wait' || ro.commit)) {
        const sd = ro.side || 1, yq = ro.yieldTo;   // compare in the mirrored frame of this turn
        if (ro.commit && !avoiding) { thrT = Math.max(thrT, 0.98); pitchT = Math.max(pitchT, -0.2); }   // 全速ターン: no lifting before or into the turn
        else if (yq && yq.cap <= 0 && sd * yq.y > sd * b.y - 1.5 && sd * (yq.x - b.x) < 9) { thrT = Math.min(thrT, TURN_ORDER.yieldThr); pitchT = Math.min(pitchT, 0); }
        else if (ro.role === 'sashi' && ro.q && sd * (ro.q.x - b.x) < TURN_ORDER.sashiClear) thrT = Math.min(thrT, TURN_ORDER.sashiThr);
        else if (ro.role === 'wait' && ro.busy) { thrT = Math.min(thrT, TURN_ORDER.waitThr); pitchT = Math.min(pitchT, 0); }
        else if ((ro.role === 'wide' || ro.role === 'out') && !avoiding) thrT = Math.max(thrT, 0.97);   // the wide turn only pays if it is taken flat out
      }
      // 差し順: on a 差し or 壁 line, a boat alongside on my inside turns first. Rather than turning side by side
      // with it (and into it), lift and drop in about a length behind it — this is what strings the field out at 1M.
      if (!ro && first && SASHI_ORDER.tactics.includes(tactic) && env.others && b.y > 0 && b.x > MK - (tactic === 'wall' ? SASHI_ORDER.atWall : SASHI_ORDER.at)) {
        let q = null;
        const win = tactic === 'sashiWin', clr = win ? SASHI_ORDER.win.clear : SASHI_ORDER.clear;
        for (const o of env.others) { if (o === b || o.cap > 0 || o.y < 0 || o.y >= b.y - 0.5) continue; const d = o.x - b.x; if (d > -SASHI_ORDER.alongside && d < clr) { q = o; break; } }
        mem.sashiYield = q;
        if (q) { thrT = Math.min(thrT, win ? SASHI_ORDER.win.thr : SASHI_ORDER.thr); pitchT = Math.min(pitchT, 0); }
      }
      if(first&&(courseCpu||tactic==='makurisashi'&&!mem.turnRole)){
        if(tactic==='makurisashi'){
          thrT=Math.min(thrT,mem.cpuLine?.stage==='thread'?.90:1);
          if(mem.cpuLine?.waiting)thrT=Math.min(thrT,.45);
        }
        if(mem.cpuLine?.waiting){thrT=Math.min(thrT,.50);pitchT=Math.min(pitchT,0);}
      }
      // 外全速ターン (1周目の1マーク): how a rider goes round the outside flat out — run wide on a diagonal past the mark,
      // pivot hard in one short burst well beyond it (sat up only for that), then lean round crouched and drive out.
      // Circling the buoy on the rudder with the body up (the old way) scrubbed CPU boats down to ~25 km/h.
      {
        const tr = mem.turnRole && mem.turnRole.role, ftRole = (tr === 'out' || tr === 'wide' || mem.commit || mem.follow || FULLT.forceCourse === trait.course) && (!FULLT.onlyCourse || FULLT.onlyCourse === trait.course);
        if (FULLT.on && first && (ftRole || (mem.ft && mem.ft.phase !== 'run')) && !mem.push && !avoiding && b.cap <= 0 && !env.caution && !env.cruise && !(mem.ft && mem.ft.phase === 'done')) {
          const ft = mem.ft || (mem.ft = { phase: 'run' }), hd = wrapRad(b.a);
          if (ft.phase === 'run' && b.y > 0 && b.x > MK - FULLT.from) {
            const q = mem.turnRole && mem.turnRole.q, minY = Math.max(FULLT.minY, q && q.cap <= 0 ? q.y + FULLT.clear : 0);
            const px = MK + FULLT.over, py = clamp(b.y, minY, FULLT.maxY);
            const err = wrapRad(Math.atan2(py - b.y, px - b.x) - b.a);
            steerT = clamp(err * (prof.gain ?? 2) + av.steerAdd, -1, 1); rollT = 0; pitchT = prof.cruise; thrT = 1;
            // an inside neighbour still alongside and too close to swing with → hold on a bit wider before turning
            const tight = FULLT.stagger && env.others.some(o => o !== b && o.cap <= 0 && o.y > -2 && o.y < b.y - 0.5 && b.y - o.y < FULLT.stagger && Math.abs(o.x - b.x) < 6);
            if (b.x >= MK + FULLT.swingAt && (!tight || b.x >= MK + FULLT.swingMax)) { ft.phase = 'pivot'; ft.t = 0; }
          }
          if (ft.phase === 'swing') {   // carve in on the lean, crouched and flat out, to set the bow up for the pivot
            steerT = -FULLT.swingSteer; rollT = -FULLT.roll * clamp((b.v - 4) / 4, 0, 1); pitchT = FULLT.swingPitch; thrT = 1;
            if (hd < -FULLT.swingTo) { ft.phase = 'pivot'; ft.t = 0; }
          }
          if (ft.phase === 'pivot') {
            ft.t += dt; steerT = -1; rollT = -FULLT.roll * clamp((b.v - 4) / 4, 0, 1); pitchT = FULLT.pivotPitch; thrT = 1;
            if (hd < -FULLT.pivotTo || hd > 2.6 || ft.t > 4) ft.phase = 'arc';
          }
          if (ft.phase === 'arc') {
            steerT = -FULLT.arcSteer; rollT = -1 * clamp((b.v - 4) / 4, 0, 1); pitchT = FULLT.arcPitch; thrT = 1;
            if (Math.abs(hd) > FULLT.doneAt || b.x < MK - 25) { ft.phase = 'drive'; ft.t = 0; ft.y = Math.min(b.y, -FULLT.exitMinY); }
          }
          if (ft.phase === 'drive') {   // drive out crouched and flat out on its own line — don't cut back across the pack
            ft.t += dt; const err = wrapRad(Math.atan2(ft.y - b.y, -30) - b.a);
            steerT = clamp(err * (prof.gain ?? 2) + av.steerAdd, -1, 1); rollT = 0; pitchT = 1; thrT = 1;
            if (ft.t > FULLT.driveT || b.x < MK - 45) ft.phase = 'done';
          }
        }
      }
      // near the danger line with nobody to fight: back off a touch (no point risking it).
      // In a close fight it holds on; only a deliberate 勝負 goes past the line. Cautious riders ease earlier.
      const near1M = Math.hypot(b.x - MK, b.y) < 40;
      if (!mem.push && !(first && mem.ft && mem.ft.phase !== 'done') && !(first && (tactic === 'makuri' || mem.commit)) && (!env.battle || near1M) && (b.load || 0) > 0.95 + 0.06 * (1 - Math.min(1, care))) { thrT *= 0.9; }
      // swerving against the lean (dodging outward mid-turn): take the body out of it too
      if (Math.abs(steerT) > 0.2 && rollT !== 0 && Math.sign(steerT) !== Math.sign(rollT)) rollT *= 0.6;
      if(lab.active){const targets=labTraceInputs(mem,env,{thr:thrT,steer:steerT,roll:rollT,pitch:pitchT},b,prof,o);thrT=targets.thr;steerT=targets.steer;rollT=targets.roll;pitchT=targets.pitch;}
      if(!lab.active&&trait.contactMode==='priority'){
        const safe=labPriorityPlan(b,env,{thr:thrT,steer:steerT,roll:rollT,pitch:pitchT},mem,prof,o);
        ({thr:thrT,steer:steerT,roll:rollT,pitch:pitchT}=safe.inputs);mem.cpuSafety=safe.detail;
      }
      // 直線: the rudder is a brake — on a straight it stays (nearly) dead ahead. The line is moved with the body
      // (a lean slides the boat over) instead. Only an emergency or a 締め (dump, squeeze, resist) throws it.
      {
        const dirX = Math.cos(b.a) >= 0 ? 1 : -1, toMark = (dirX * MK - b.x) * dirX;
        if (mem.firstDone && !env.caution && Math.abs(Math.cos(b.a)) > 0.9 && toMark > STRAIGHT_RUN.from && !(mem.emergency > 0) && !(mem.dumpT > 0) && !mem.squeeze && !mem.resistQ && !mem.push) {
          const want = steerT; steerT = clamp(want, -STRAIGHT_RUN.steer, STRAIGHT_RUN.steer);
          const extra = want - steerT;
          if (Math.abs(extra) > 0.02) rollT = clamp(rollT + Math.sign(extra) * Math.min(STRAIGHT_LEAN.free, Math.abs(extra) * STRAIGHT_RUN.leanK), -STRAIGHT_LEAN.ok, STRAIGHT_LEAN.ok);
          if (thrT > 0.9) pitchT = Math.max(pitchT, STRAIGHT_RUN.crouch);
        }
      }
      if (ONECUT.on && !lab.active) {   // 一発切り: the rudder for the turn itself
        const close = env.others && env.others.some(q => {   // someone right there, or on my line ahead: race them, don't read the buoy
          if (q === b || q.cap > 0) return false;
          const ex = q.x - b.x, ey = q.y - b.y, f = ex * Math.cos(b.a) + ey * Math.sin(b.a), sd = -ex * Math.sin(b.a) + ey * Math.cos(b.a);
          return f > -3 && (Math.hypot(ex, ey) < ONECUT.near || f < ONECUT.ahead && Math.abs(sd) < ONECUT.side);
        });
        const free = b.cap <= 0 && !env.caution && !env.cruise && !dumping && !avoiding && !mem.push && !first && !close && !(mem.emergency > 0);   // (1周1M is the start battle: its entry, 逃げ・差し・まくり lines as they were)
        const upA = prof.up * CPU_TURN.upK, body = { thr: tThr, roll: -prof.lean * clamp((b.v - 4) / 4, 0, 1), pitch: -upA + (upA + 0.9) * ONECUT.carveK * (CARVE[prof.name] ?? 0.5) };   // the body it turns with: half up, as much crouch as the class can carve with
        const cut = cutDrive(b, mem, o, prof, gap, body, free);
        if (cut == null && mem.cut && mem.cut.run && free) {   // the run in to the cut: straight, the line held on the lean, body up only when it cuts
          const la = wrapRad(b.a + (mem.cut.m ? Math.PI : 0));
          steerT = clamp(-ONECUT.hold * la, -STRAIGHT_RUN.steer, STRAIGHT_RUN.steer); rollT = clamp(-ONECUT.holdLean * la, -STRAIGHT_LEAN.free, STRAIGHT_LEAN.free);
          if (thrT > 0.9) pitchT = Math.max(pitchT, prof.cruise);
        }
        if (cut != null) { steerT = cut; rollT = body.roll; pitchT = body.pitch; thrT = Math.max(thrT, body.thr * av.thrMul); }   // body in with the cut, held as it was read
      }
      if (prof.kinen) { const kn = kinenDrive(b, env, mem, dt, o, prof); mem.knOn = !!kn; if (kn) { thrT = kn.thr; steerT = kn.steer; rollT = kn.roll; pitchT = kn.pitch; } }
      if (b.cap > 0) { thrT = 0; rollT = 0; pitchT = 0; }
      o.thr += (thrT - o.thr) * (1 - Math.exp(-6 * dt));
    }
    if(lab.active && mem.labTrace.mode!=='racing')Object.assign(mem.labTrace,{cpuTargets:{thr:thrT,steer:steerT,roll:rollT,pitch:pitchT},targetInputs:{thr:thrT,steer:steerT,roll:rollT,pitch:pitchT},numericOverride:false,overrideSuppressed:!!env.labDirective});
    o.steer += (steerT - o.steer) * (1 - Math.exp(-prof.react * (mem.emergency > 0 ? 3 : 1.6) * dt));
    o.roll += (rollT - o.roll) * k;
    o.pitch += (pitchT - o.pitch) * k;
    return o;
  }
  return { prof, trait, drive, reset, out: o, dumping: q => mem.dumpT > 0 && mem.dumpQ === q, mem };
}

/* ---------- 6-boat demo race ----------
   Each boat: class (A1–B2 driver profile), entry preference, course, slow/dash start, first-turn tactic. */
const STRAIGHT_X = MK - 23;   // |x| below this is straight water
const SASHI_ORDER = { tactics: ['sashi', 'sashiWin', 'sashiPlace', 'wall'], at: 30, atWall: 18, alongside: 2.5, clear: 4, thr: 0.55, win: { clear: 2.5, thr: 0.72 } };
const CAUTION_V = { near: 10, k: 0.25, far: 21 };
// 着順確定: the last boat must be this far (m) past the wreck as well as round the next turn mark.
// Until then they still race, except within `near` m of a wreck: there it is 徐行, outside it, no passing.
const CAUTION_LOCK = { past: 10, near: 25, along: 4, lap: 0.5 };
// 追い抜き禁止区間: from 150 m before the turn mark the wreck lies toward (1M: the start line; 2M: the middle of the
// back straight — the riders' own agreement) to `past` m beyond the wreck. Inside it the boat ahead goes first
// (side by side: the inside one); everywhere else it is still a race.
const CAUTION_ZONE = { past: 20, yield: 10 };   // yield: closer than this (m) to the boat that goes first → lever off, sit up   // lap: the last boat runs at least this share of a lap before the pass that fixes it   // along: closer than this (m, along the course) counts as side by side
const nearWreck = (b, d) => fleet.wrecks.some(w => Math.hypot(w.x - b.x, w.y - b.y) < d);   // m/s at the wreck, gain per m away, cap away from it
// 流れ: how often the 逃げ swings wide off 1M (by class), and how much more under pressure / after a poor start
const NIGE_NAGARE = { p: { TOP: 0.1, A1: 0.13, A2: 0.18, B1: 0.24, B2: 0.3 }, press: 0.15, late: 0.15, tail: 0.1, R: 3.5, gap: 2 };   // m before 1M; overlap window (m behind / ahead of the inside boat); lever while yielding
const MAKURI_LINE = { off: 4, offAhead: 2.2, wall: 3, maxGap: 26, behind: 8 };   // m outside the target boat's line (まくり / 壁); ignore inside boats this far behind
// the boat a まくり goes over: the nearest one inside me (on the home side) that isn't already well beaten
function innerTarget(b, env) {
  if (!env.others) return null;
  let best = null;
  for (const q of env.others) {
    if (q === b || q.cap > 0 || q.y < 0 || q.y >= b.y - 0.5 || b.x - q.x > MAKURI_LINE.behind) continue;
    if (!best || q.y > best.y) best = q;
  }
  return best;
}
const TURN_ORDER = { dropSashi: true, dropLead: 2, dropRoom: 1, commitLead: 3.0, startedA: 0.3, alongX: 7, overOff: 2, swellOver: 2, slotOff: 3, swellOut: 4, swellWide: 5, others: 3, sashiMin: 4, forceRoom: 3.5, wideOff: 5, waitThr: 0.7, yieldMargin: 2.5, zone: 38, ahead: 2.0, lat: 16, room: 5, sashiIn: 3.5, outOff: 4, yieldThr: 0.65, sashiThr: 0.9, sashiClear: 4 };
// how far off the buoy a boat is: running in, its distance off the buoy's line; going round, its radius
function gapOffMark(q) { const mk = COURSE.marks[0]; return q.x < mk.x ? Math.abs(q.y - mk.y) : Math.hypot(q.x - mk.x, q.y - mk.y); }
// my part in the 1M turn order (see the driver): 'mark' (I turn first), 'yield', 'sashi' or 'out'
// a boat seen from the other straight: the course turned round about its centre
const mirrorBoat = o => ({ x: -o.x, y: -o.y, a: o.a + Math.PI, v: o.v, cap: o.cap, src: o });
const sameBoat = (o, b) => (o.src || o) === (b.src || b);
function turnRoleOf(b, env, style) {
  // no swinging out wide into a boat that is right there on my outside
  if (style === 'wide' && env.others.some(o => !sameBoat(o, b) && o.cap <= 0 && o.y > b.y + 0.5 && o.y - b.y < 7 && o.x - b.x > -4 && o.x - b.x < 8)) style = 'normal';
  // an outside boat clear in front of me (舳先もかかっていない) is crossing to the buoy → let it go
  // an inside boat in front of me, or still overlapping me → I can't have the buoy: 差し inside it if there is water, else round the outside
  let yieldTo = null, inner = null, innerD = Infinity;
  const ins = [];   // the boats inside me that I am not clearly in front of
  for (const o of env.others) {
    if (sameBoat(o, b) || o.cap > 0 || o.y < -3 || o.x < MK - 70 || Math.abs(o.y - b.y) > TURN_ORDER.lat) continue;
    // an outside boat clearly in front — or one going flat out round the outside (叩き／まくり) with its nose in front: I turn after it
    if (o.y > b.y + 0.5) { const oc = (o.src || o).commitTurn; if (((o.x - 2.2) - (b.x + BOW_TIP) >= CLEAR_AHEAD + TURN_ORDER.yieldMargin || (oc && o.x - b.x > TURN_ORDER.commitLead)) && (!yieldTo || o.x > yieldTo.x)) yieldTo = o; continue; }   // clearly in front — not just a nose
    if (o.y >= b.y - 0.5) continue;
    if ((b.x - 2.2) - (o.x + BOW_TIP) >= CLEAR_AHEAD + TURN_ORDER.yieldMargin) continue;
    if (style === 'commit' && b.x - o.x > TURN_ORDER.commitLead) continue;   // going flat out with my nose in front: it turns after me (the same test it uses)   // clearly in front of it (the same test it uses to give way): no obstacle
    ins.push(o);
    const d = (b.y - o.y) + Math.max(0, b.x - o.x) * 0.5;
    if (d < innerD) { innerD = d; inner = o; }
  }
  // the lever (yield to a boat crossing in front) and the line (relative to the boats inside) are separate calls
  // committed (4カドが叩きにいった): no lifting for anyone — it goes round flat out, outside the buoy
  const flat = style === 'commit' || style === 'follow';
  const y = yieldTo && !flat ? { yieldTo } : flat ? { commit: true } : {};
  if (style === 'commit' && !inner) return { role: 'out', over: true, ...y };
  if (style === 'follow') return { role: 'wide', q: inner, qGap: ins.length ? Math.max(...ins.map(gapOffMark)) : 0, ...y };   // 連動のまくり: wide of the buoy, flat out
  // 待つ: the inside is a scramble → lift, let them all swing out, then take the inside behind them
  if (style === 'wait') {
    let busy = 0;
    // still busy until every boat inside is through in front of me (stern past my bow) — only then cut in behind them
    for (const o of env.others) if (!sameBoat(o, b) && o.cap <= 0 && o.y > -6 && o.y < b.y - 0.5 && o.x - b.x > -6 && !clearAhead(o, b)) busy++;
    return busy >= 1 ? { role: 'wait', busy, ...y } : { role: 'waitIn', ...y };
  }
  if (!inner) return style === 'wide' && yieldTo ? { role: 'wide', ...y } : { role: 'mark', ...y };
  // going round the outside: outside every inside boat's arc, not just the nearest one's
  const qGap = Math.max(...ins.map(gapOffMark));
  // water inside it: once it is round the buoy, its radius; still running in, it will tighten up by a few metres yet
  const room = inner.x >= MK - 5 ? qGap : qGap - 3;
  // 差し needs the inside boat to be in front (I go through behind it); alongside it there is no way in
  if (style === 'wide') return { role: 'wide', q: inner, qGap, ...y };   // 外を全速で: never mind the gap inside
  // commit: the boat it was hammering tightened up to the buoy → 大まくり round the outside; it swung wide → まくり差し through the gap
  // 差し / まくり差し: every inside boat must be in front of me (stern past my bow) — then look for a way through.
  // Their lines round the buoy are arcs at different distances off it; the gap between the buoy and the innermost arc
  // is the 差し, a gap between two arcs (a まくり swinging the others out) is the まくり差し. Take the innermost one wide enough.
  if (ins.every(o => clearAhead(o, b))) {
    const arcs = ins.map(o => { const g = gapOffMark(o); return o.x >= MK - 5 ? g : g - 3; }).sort((p, q) => p - q);
    let prev = 0;
    for (const g of arcs) {
      const w = g - prev, need = style === 'force' ? TURN_ORDER.forceRoom : TURN_ORDER.room;
      if (w >= need) {
        const gapT = prev === 0 ? g - TURN_ORDER.sashiIn : prev + TURN_ORDER.slotOff;   // inside the arc / just outside the inner one
        return { role: 'sashi', q: inner, qGap, room: g, gapT, between: prev > 0, forced: style === 'force' && w < TURN_ORDER.room, ...y };
      }
      prev = g;
    }
  }
  // 混雑回避: alongside the inside boat(s) rather than in front — don't swing round the outside of the whole pack;
  // ease a touch, drop in behind its stern and take the water inside its arc (突けるならイン)
  if (TURN_ORDER.dropSashi && style !== 'commit' && style !== 'wide' && ins.every(o => o.x - b.x > -TURN_ORDER.dropLead)) {
    const arcs = ins.map(o => { const g = gapOffMark(o); return o.x >= MK - 5 ? g : g - 3; }).sort((p, q) => p - q);
    let prev = 0;
    for (const g of arcs) {
      if (g - prev >= TURN_ORDER.room + TURN_ORDER.dropRoom) {
        const gapT = prev === 0 ? g - TURN_ORDER.sashiIn : prev + TURN_ORDER.slotOff;
        return { role: 'sashi', q: inner, qGap, room: g, gapT, between: prev > 0, drop: true, ...y };
      }
      prev = g;
    }
  }
  // already in front of them all (just not by enough to cut across): over the top, close outside them — まくり
  return { role: 'out', q: inner, qGap, over: style === 'commit' || ins.every(o => clearAhead(b, o)), ...y };
}
// how a rider means to take 1M, picked once on the run-in: 'normal' (read the boat in front), 'wide' (round the outside
// flat out — often worth places), 'force' (dive inside even through a small gap), 'wait' (outside boats only: when the
// inside is crowded, lift and turn late and tight behind them all — the 6コース 最内差し)
const COMMIT = { at: 25, lead: 3.5, dv: 1.0 };   // 叩き: decided this far past the slit; needs this lead (m) and this much more speed (m/s) than the boat inside
const SIDE_ON = { ang: 0.6, yaw: 0.3, cut: 0.95 };   // giving way to a boat turning across: heading difference (rad), its turn rate (rad/s), how hard to lift
const MAKURI3 = { lead: 1.5, p: 0.6, wallP: { calm: 0.25, normal: 0.45, aggr: 0.65 } };   // 3コース: m in front of the 2 to go for it; chance; カド受けの壁 by temper
const FOLLOW = { p: { calm: 0.55, normal: 0.75, aggr: 0.9 }, off: 5 };   // 連動: chance to follow a 叩き from inside; how far outside it to run
// 外全速ターン: from how far before 1M it swings out; how far past the mark it pivots; the lane it keeps outside the
// boat inside; when to start the pivot (m before, at 20 m/s); lean, how far it sits up; heading to pivot to, then
// a crouched leaning arc (a little rudder) until it points down the back straight
// how hard a CPU sits up through a turn (1 = the old way). Sitting up grips but brakes hard: the player's flat carve showed
// the old CPU turn scrubbing to ~27 km/h where ~45 is there to be had.
const CPU_TURN = { upK: 0.5, easeK: 0.6, outLift: 0.3, inDodgeThr: 0.85 };
const FULLT = { on: false, from: 60, over: 0, minY: 18, maxY: 32, clear: 7, pivotPitch: 0, swingAt: -7, swingSteer: 0.15, swingPitch: 0, swingTo: 0.6, roll: 0.95, up: 0.7, pivotTo: 2.75, arcSteer: 0.1, arcPitch: 0.9, doneAt: 2.95, exitMinY: 12, driveT: 2.5, stagger: 0, swingMax: 8, forceCourse: 0, onlyCourse: 0 };
const TURN_STYLE = { waitLater: 0.1, wide: { calm: 0.3, normal: 0.25, aggr: 0.18 }, crowdWide: 0.3, force: { calm: 0.03, normal: 0.08, aggr: 0.2 }, wait: { 4: 0.08, 5: 0.15, 6: 0.3 } };
function turnStyleOf(b, env, trait, prof, first) {
  if (first && (trait.course ?? 1) === 1) return 'normal';
  let crowd = 0;
  for (const o of env.others) if (!sameBoat(o, b) && o.cap <= 0 && o.y > 0 && o.y < b.y && Math.abs(o.x - b.x) < 12) crowd++;
  const t = trait.temper || 'normal', r = simRandom();
  // waiting for the inside to sort itself out: on the first turn it is the outside courses' move; later, anyone with traffic inside
  // a crowd inside: going round it flat out (外を全速) usually beats sitting behind it, so most go wide rather than wait
  const pw = crowd >= 2 ? (first ? TURN_STYLE.wait[trait.course] ?? 0 : TURN_STYLE.waitLater) : 0, pwide = (TURN_STYLE.wide[t] ?? 0.25) + (crowd >= 2 ? TURN_STYLE.crowdWide : crowd ? TURN_STYLE.crowdWide / 2 : 0), pf = TURN_STYLE.force[t] ?? 0.08;
  return r < pw ? 'wait' : r < pw + pwide ? 'wide' : r < pw + pwide + pf ? 'force' : 'normal';
}
const MAKURI_CHECK = { at: 35, lead: 1.5, behind: 4, pMs: 0.5 };   // m before 1M it decides; m in front it needs; within m behind it may still まくり差し
const LREF = loopLen(13);
const FIXED_ENTRY = true;
// 起こし positions (m before the start line) by course, and the rare 3カド
const OKOSHI = { 1: [95, 105], 2: [100, 115], 3: [110, 125], 4: [185, 200], 5: [195, 210], 6: [195, 210] };
const KADO3_RATE = 0.08, KADO3_OKOSHI = [165, 180];
const IDLE_V = 4.2;
// start timing: how far off each course reads the clock (± s), the share of that it adds as a safety margin,
// and the flat-out ST below which a boat near the line throws the lever off (放る) instead of going early
const ST_SPREAD = { 1: 0.05, 2: 0.11, 3: 0.11, 4: 0.08, 5: 0.10, 6: 0.10, kado: 0.08, def: 0.10 };   // 4カド (and 3カド) is the easiest start after the 1
const ST_MARGIN = 0.5, HOU_AT = 0.01;
const START_MODE = { shobu: 0.05, pin: 0.10, antei: 0.15 };
// how hard each spot is to time (× sd), by course: the 1コース is the easiest to read, harder the further out.
// A dash boat (any course) times it from a run-up — harder still, but it crosses with the speed on.
// margin: how much later (× its extra error) an outside boat aims to stay clear of a フライング
const START_COURSE = { by: [0.6, 0.85, 1.0, 1.2, 1.35, 1.5], dash: 1.15, margin: 0.5 };
const START_PICK = { calm: { shobu: 0.04, antei: 0.4 }, normal: { shobu: 0.12, antei: 0.25 }, aggr: { shobu: 0.25, antei: 0.1 } };
const START_SHOBU_HOU = 0.75;   // going for 0.05, the chance it still throws the lever off when it would be early
function startModeOf(trait) {
  const p = START_PICK[trait.temper] || START_PICK.normal, r = simRandom();
  const shobu = p.shobu * (trait.shobuMul ?? 1);   // 勝負駆け (e.g. needing points on the last 予選 day) makes it likelier
  return r < shobu ? 'shobu' : r < shobu + p.antei ? 'antei' : 'pin';
}
// per-start error: sd (s), a bias added to the read, and the chance of a late one (凹み, +0.08〜0.25 s)
const START_FEEL = { TOP: { sd: 0.03, bias: 0, dent: 0.02 }, A1: { sd: 0.035, bias: 0, dent: 0.035 }, A2: { sd: 0.045, bias: 0, dent: 0.05 }, B1: { sd: 0.05, bias: 0, dent: 0.07 }, B2: { sd: 0.06, bias: 0, dent: 0.1 } };
// by class: how much of that extra outside-start difficulty it actually suffers
const ST_OUT = { TOP: 0.4, A1: 0.5, A2: 0.8, B1: 1.1, B2: 1.3 };
// 1コース逃げ: how far before 1M it eases the lever, to what (by class), and when it grips again (share of the arc)
const NIGE_DROP = { at: 22, regrip: 0.2, lever: { TOP: 0.76, A1: 0.72, A2: 0.68, B1: 0.62, B2: 0.58 } };   // steady speed with the lever shut (m/s)   // demo: every boat takes its own number's course, 3 slow / 3 dash
let demoCpuMode='legacy';   // 標準はd42までで調整したCPU。コース別作戦 v1 は試験中（設定で切替）
let fleet = null, simSpeed = 1.5, sgMode = false;   // demo playback speed; the race clock always shows real race time

function pickW(pairs) { let r = simRandom() * pairs.reduce((a, p) => a + p[1], 0); for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; }

// the six riders for a race: class, entry preference, temperament, motor. SG: all A1 with a few トップクラス, one of them 記念クラス.
function newRows(fixedEntry) {
  const rows = [];
  for (let no = 1; no <= 6; no++) {
    const pi = sgMode ? 0 : pickW([[0, 2], [1, 3], [2, 3], [3, 2]]);   // SG: everyone is A1
    const pref = fixedEntry ? 'waku' : pickW([['waku', 8], ['in', 1.0], ['out', 1.2]]);
    rows.push({ no, prof: DRIVERS[pi], pref, key: no + (pref === 'in' ? -2.6 : pref === 'out' ? 2.6 : 0) + simRandom() * 0.1,
                temper: pickW([['calm', 3], ['normal', 5], ['aggr', 2]]), motor: { deashi: 0.94 + simRandom() * 0.12, nobi: 0.95 + simRandom() * 0.09, mawari: 0.95 + simRandom() * 0.1 }, col: LANE_COL[no - 1] });
  }
  if (sgMode) {
    const n = pickW([[1, 5], [2, 4], [3, 1]]);
    rows.slice().sort(() => simRandom() - 0.5).slice(0, n).forEach((r, i) => { r.prof = DRIVERS.find(d => d.top && !d.kinen === !!i); });   // d140: the first one is 記念クラス
  }
  return rows;
}
// give a boat its course for the race: lane, start style, first-turn plan, and a fresh CPU driver
function applyCourse(r, course, slow, kado, okoshi) {
  const mode=lab.active?(lab.config?.cpuMode||'legacy'):demoCpuMode;
  let tactic = course === 1 ? 'nige'
    : kado ? 'makuri'
    : course === 2 ? 'sashi'   // 2コース goes in 差し構え; on the run-in it may grip or wall instead
    : course === 4 && !slow ? pickW([['makuri', 7], ['sashi', 3]])
    : pickW([['sashi', 5], ['makuri', 5]]);
  if(mode===COURSE_CPU.version)tactic=COURSE_CPU.courses[course].base;
  const laneY = LANE.y0 + (course - 1) * LANE.step;
  // コース相性: on a course it likes it rides to win (bolder), on one it doesn't it rides for a place (safer)
  const aff = r.skill && r.skill.course ? r.skill.course[course - 1] : 50, tMap = ['calm', 'normal', 'aggr'];
  const tEff = r.skill ? tMap[clamp(Math.round({ calm: 0, normal: 1, aggr: 2 }[r.temper] + (aff - 50) / 22), 0, 2)] : r.temper;
  const rT = r.temper; r.temper = tEff;
  r.trait = { cpuMode:mode,contactMode:mode===COURSE_CPU.version?'priority':'normal',squeezeMode:mode===COURSE_CPU.version?'lead':'legacy',course, laneY, tactic, slow, kado, okoshi, temper: r.temper, lineOff: simRandom() * 2.5, dump: TEMPER[r.temper].dump, care: TEMPER[r.temper].care,
              tsuke: ({ TOP: 0.8, A1: 0.7, A2: 0.55, B1: 0.35, B2: 0.2 }[r.prof.name] || 0.4) + (r.temper === 'aggr' ? 0.15 : 0),
              pushMul: { calm: 0.5, normal: 1, aggr: 1.6 }[r.temper], flyRisk: (RISK[r.prof.name] || RISK.B1).fly,
              aff, stSdMul: 1.25 - aff / 200, affGrip: 1 + (aff - 50) * 0.0004 };
  r.temper = rT;   // the rider's own nature stays; the race's mood is in trait.temper
  r.drv = makeDriver(r.prof, r.trait);
  if (!r.player) r.inp = r.drv.out;
}
function raceFieldsInit(r) {
  r.wake = r.wake || []; r.prevY = r.b.y; r.vis = 0; r.st = null; r.laps = 0; r.fin = null; r.prog = boatBow(r.b).x - 1000; r.flying = false;
}
// チルト: CPU riders mostly sit at −0.5 inside; the dash courses go 0 / +0.5 for 伸び, and now and then a rider
// gambles on a big tilt (はね). The player picks their own in the settings. Called again once the course is known.
function fitMotor(r, course, again) {
  const b = r.b;
  b.deashi = r.motor.deashi; b.nobi = r.motor.nobi; b.mawari = r.motor.mawari || 0;
  b.mMid = r.motor.mid ?? null; b.powerK = r.motor.powerK || 1; b.tempLow = r.motor.tempLow || 0; b.tempTop = r.motor.tempTop || 0;
  b.hullGrip = r.motor.hullGrip || 1; b.hullRide = r.motor.hullRide || 1; b.hullDrag = r.motor.hullDrag || 1;
  b.weightK = r.motor.weightK || 1; b.weightGrip = r.motor.weightGrip || 1; b.stabilizer = !!(waterEnv && waterEnv.stabilizer);
  if (r.player) { b.tilt = playerTilt; return; }
  if (again && !r.tiltAuto) return;
  r.tiltAuto = true;
  const out = course >= 4 || (r.trait && r.trait.kado);
  b.tilt = out ? pickW([[-0.5, 2], [0, 4], [0.5, 3], [1, 1], [2, 0.3], [3, 0.15]]) : pickW([[-0.5, 8], [0, 2], [0.5, 0.4]]);
  r.tilt = b.tilt;
}
function setupFleet() {
  const rows = newRows(FIXED_ENTRY);
  // entry: boats take courses by preference, inside first
  rows.sort((a, b) => a.key - b.key);
  // 3カド: now and then the 3コース boat pulls back to dash from ~140 m, and then it's まくり or nothing
  const kado3 = FIXED_ENTRY && simRandom() < KADO3_RATE;
  const nSlow = FIXED_ENTRY ? (kado3 ? 2 : 3) : pickW([[3, 6], [2, 2], [4, 2]]);
  rows.forEach((r, i) => {
    const course = i + 1;
    const slow = course <= nSlow;
    const kado = demoCpuMode===COURSE_CPU.version?course===nSlow+1:kado3 && course === 3;
    // 起こし: where it opens the lever, metres before the line. It idles in from further back so that it
    // reaches that point just as the clock says go (the lever itself still goes by timing, for the ST).
    const [okLo, okHi] = kado ? KADO3_OKOSHI : OKOSHI[course] || OKOSHI[6];
    const okoshi = okLo + simRandom() * (okHi - okLo);
    const creep = Math.max(0, RUNUP - (timeToLine(okoshi, IDLE_V, r.prof.cruise) - 0.1));
    const x0 = -(okoshi + IDLE_V * creep) - BOW_TIP;
    applyCourse(r, course, slow, kado, okoshi);
    r.b = { x: x0, y: r.trait.laneY, a: 0, v: IDLE_V, vl: 0, yaw: 0, porp: 0, cap: 0 };
    fitMotor(r, course);
    raceFieldsInit(r);
  });
  rows.sort((a, b) => a.no - b.no);
  return rows;
}
function freshFleet(boats) {
  const f = { boats, order: [], rank: boats.slice(), focus: fleet ? fleet.focus : null, endAt: 0, raceStart: 0, rankT: 0, touchCool: {}, cutCool: {}, touches: 0, dumps: 0, rears: 0, cuts: 0, dqs: 0, finOrder: [], tsukeTry: 0, tsukeWin: 0, caution: false, lockOrder: [], wrecks: [], accidents: 0, pushTry: 0, pushFail: 0, cutsInside: 0, squeezes: 0, resists: 0, yields: 0 };
  for (const r of boats) r.wakesOthers = boats.filter(q => q !== r).map(q => q.wake);
  f.byCourse = {}; for (const r of boats) if (r.trait) f.byCourse[r.trait.course] = r;
  return f;
}

/* ---------- 進入 (pit-out and the fight for courses) ----------
   Follows the real flow of 待機行動, simplified:
     ピット離れ   boats sit in the pits; a lamp counts down and on "GO" each rider opens up. Reaction time plus
                  the motor's 出足 decides how cleanly it gets away (an early jump stalls it).
     小回り防止ブイ  out of the pits flat out, round the outside of the buoy beyond 1M, onto the back straight.
     バック側     running to 2M in lanes, inside to outside. A boat that gets ENTRY.steal m ahead of the boat inside
                  it takes its course (前付け). The inside boat may speed up to fight it off (抵抗).
     2マーク     round 2M; from passing it until the boat squares up to the start line it may 引く (pull back
                  to dash). Dash boats are placed from the outside; the rest go slow, inside first.
     回り直し     a boat still not facing the line well after the first one did goes round again: outermost.
     待機        each boat settles on its spot and sits nearly still. The big clock runs from the pit release:
                  1分40秒 to the start, as in the real thing; its hand sweeps the last 12 s and the race's own start
                  takes over (the player keeps the lever until the line).
     待機行動違反  (減点, not a DQ) 間隔不足 between the buoy and 2M, 接触 while waiting, crossing the start line
                  before the hand starts. Squaring up later than a boat outside you means
                  going outside it: no 割り込み. */
const ENTRY = {
  pitX: -280, pitY: [24, 28.5, 33, 37.5, 42, 46.5], // ピット: well behind 2M on the home side (130 m), bows toward 1M; 1号艇 innermost
  lamp: 3,                                          // s of lamp countdown before the release
  runR: k => 11 + 4.2 * k,                          // lane radius for slot k on the way round: outer boats swing round wide (clear of the far bank)
  vPull: 4.5,                                       // m/s backing away to the dash spot (引く: bow away from the slit)
  pullTurn: 8,                                      // s to swing round to face the line again, settle and square up
  kado: { early4: 0.15, k3: 0.4, k2: 0.1, ample: 4 },  // 4コース pulls early (by mistake) / 3カド and 2カド when that leaves time to spare
  pitRunOut: 6,                                     // m longer straight run per pit further out
  opp: { gap: 3, p: { calm: 0.12, normal: 0.3, aggr: 0.55 } },   // 隙: an outer boat this far ahead of the boat inside may go for its course (chance by temper)
  vBack: 9.5, vPush: 3, vTurn: 4.5, vBuoy: 8,                 // (fallback cruise) / extra m/s pushing for a course / rounding 2M / rounding the buoy (m/s)
  steal: 5, claimLead: 9.2,                        // コース主張: a claiming boat takes the inside course once it is 2艇身 (9.2 m) ahead of that boat
                                         // m ahead of the inside neighbour to take its course
  maeRate: 0.09,                                    // share of races where a CPU rider goes for 前付け (≈10% of races end with one; later a rider trait)
  resist: { calm: 0.35, normal: 0.55, aggr: 0.8 },  // chance an inside boat fights a 前付け off (+0.25 for the 1コース, less when many are going slow)
  fightLimit: { calm: 4, normal: 7, aggr: 11 },     // s of fighting before giving it up (+4 for the 1コース)
  fightV: 2.1,                                      // m/s two boats fighting for a course creep at in the waiting water (bows level, neither gives)
  tooDeep: 88,                                      // m: a fight projected to leave the 起こし shorter than this is given up
  hangA: 1.2,                                       // rad: bow off the line while hanging before squaring up
  faceRate: 1.5,                                    // m/s: square up once a straight idle from here would just fill the time
  total: 100,                                       // s from the pit release to the start (実際の待機行動 ≈ 1分40秒)
  rewindAfter: 16,                                  // s after the 3rd boat squares up: still not facing → 回り直し
  rewindBy: 30,                                     // s before the start: still not round 2M → 回り直し
  pitRun: [80, 100],                                // m run straight out of the pits flat out before turning for the buoy
  pitSteal: 9,                                      // m ahead of the inside boat at the end of that run: a late boat loses its course there
  dashSwing: 40,                                    // m further back than 2M a dash boat rounds (to come out ~200 m from the line)
  dashDepth: 16,                                    // m of extra run-up for a dash called the moment the boat leaves the pits
  gap: 6, gapT: 1.2,                                // 艇2つ分: closer than this behind a boat for this long = 間隔不足
  slowX: -117, dashX: -196,                         // waiting spots (m before the line); a dash called early sits deeper
  react: { TOP: 0.08, A1: 0.1, A2: 0.14, B1: 0.2, B2: 0.28 },   // pit reaction (s) by class
};
const SMALL_TURN_BUOY = { x: -MK + 20, y: 0 };      // 小回り防止ブイ: 20 m from 2M toward the centre (its real place); boats leaving the pits go round outside it
let onEntryHandoff = null;                          // UI hook

function makeEntryFleet(playerNo, opts = {}) {
  const rows = opts.rows || newRows(false);
  const go = time + ENTRY.lamp;
  rows.forEach(r => {
    r.player = r.no === playerNo;
    r.b = { x: ENTRY.pitX, y: ENTRY.pitY[r.no - 1], a: 0, v: 0, vl: 0, yaw: 0, porp: 0, cap: 0 };
    fitMotor(r, r.no);
    r.inp = { thr: 0, steer: 0, roll: 0, pitch: 0 };
    r.en = { slot: r.no, stage: 'pit', react: r.player ? null : go + Math.max(0.03, (ENTRY.react[r.prof.name] ?? 0.18) + (simRandom() - 0.5) * 0.14),
             dash: false, rewind: false, faced: false, facedAt: 0, resistVs: new Map(), runLen: ENTRY.pitRun[0] + (r.no - 1) * ENTRY.pitRunOut + simRandom() * (ENTRY.pitRun[1] - ENTRY.pitRun[0]), oppSeen: new Set(), claimLeft: 0, straightDone: false, decided: false, dashBonus: 0, gapT: 0, slowT: 0 };
    raceFieldsInit(r);
    r.entryViol = [];
  });
  // 前付け race: one CPU rider (an イン志向 one if there is) goes for a course further in
  const mae = !opts.noMae && simRandom() < ENTRY.maeRate;
  if (mae) {
    const cand = rows.filter(r => !r.player && r.no >= 2);
    const inPref = cand.filter(r => r.pref === 'in');
    const pick = (inPref.length ? inPref : cand)[Math.floor(simRandom() * (inPref.length || cand.length))];
    if (pick) { pick.en.wantIn = true; pick.en.mae = true; pick.en.claimLeft = 2; }
  }
  const f = freshFleet(rows);
  f.entry = { t0: time, go, zero: go + ENTRY.total, mae, lampStep: -1, faced: [], steals: 0, stealLog: [], lastFacedAt: 0, done: false, viol: [] };
  f.pitMode = true; f.playerNo = playerNo || null;
  f.focus = playerNo || null;
  return f;
}
const laneYOf = course => LANE.y0 + (course - 1) * LANE.step;
// provisional courses from the current lane order: slow boats inside first, then dash boats, then 回り直し
function entryOrder(E, boats) {
  const bySlot = boats.slice().sort((a, b) => a.en.slot - b.en.slot);
  // dash courses go by the order of pulling: the first to pull takes the outermost
  const slow = bySlot.filter(r => !r.en.dash && !r.en.rewind), dash = bySlot.filter(r => r.en.dash && !r.en.rewind).sort((a, b) => (b.en.pullSeq || 0) - (a.en.pullSeq || 0)), rew = bySlot.filter(r => r.en.rewind);
  const order = [...slow, ...dash, ...rew];
  order.forEach((r, i) => { r.en.course = i + 1; });
  return { order, nSlow: slow.length };
}
function entrySpot(r, nSlow, contested) {
  const c = r.en.course;
  if (!r.en.dash && !r.en.rewind) {
    // more boats going slow, or a course taken by force, leaves the inside less room: shallower run-up (深イン)
    const deep = Math.max(0, nSlow - 3) * 7 + (contested ? 8 : 0);
    return { x: ENTRY.slowX - (c - 1) * 2.5 + (c === 1 ? 5 : 0) + deep * (1 - (c - 1) * 0.2), y: laneYOf(c) };   // イン sits 5 m deeper
  }
  // dash: the earlier the call, the deeper (longer run-up) the spot it takes
  return { x: Math.max(COURSE.xMin + 10, ENTRY.dashX - Math.max(0, c - nSlow - 1) * 3 - (r.en.dashBonus || 0)), y: laneYOf(c) };
}
// how far round the pre-start loop a boat is: 0 leaving the pits … 1 squared up to the line
function entryProgress(r) {
  const en = r.en, b = r.b;
  if (en.stage === 'pit') return 0;
  if (en.stage === 'out') return 0.1;
  if (en.stage === 'back') return 0.2 + 0.6 * clamp((MK - b.x) / (2 * MK - 30), 0, 1);
  if (en.stage === 'turn') return 0.85;
  return en.faced ? 1 : 0.95;
}
function callDash(r) {
  const en = r.en, E = fleet.entry;
  en.dash = true; en.decided = true; en.pullSeq = E.pullSeq = (E.pullSeq || 0) + 1;
  en.dashBonus = ENTRY.dashDepth * clamp((0.95 - entryProgress(r)) / 0.85, 0, 1);
  // already round 2M: turn the bow away from the slit and back off to the dash spot (引く)
  if (en.stage === 'approach' && !en.faced) { en.pulling = 'back'; en.dashBonus = 0; en.facing = false; en.hang = false; }
}
// 引く (CPU), decided every step while hanging after 2M. Courses outside go to whoever pulls first (6, 5, 4…),
// so a boat only pulls once every boat outside it has pulled (or is staying slow). The 6 often goes early and
// the 5 follows; the 4 waits till the last moment it can still make the dash spot, so nobody inside can follow
// (3カド — and very rarely 2カド — happen only when the boat outside left time to spare). Boats going for an
// inside course never pull.
function cpuPullDecide(r, boats, sp, T) {
  const en = r.en;
  if (en.dash || en.faced || en.pulling || r.player || (en.wantIn && !en.gaveUp) || en.slot <= 1) return;
  const staySlow = q => (q.en.wantIn && !q.en.gaveUp) || q.pref === 'in' || (q.player && !q.en.dash) || q.en.noPull;
  if (!boats.every(q => q.en.slot <= en.slot || q.en.dash || q.en.rewind || staySlow(q))) return;
  const need = Math.max(0, r.b.x - (-190)) / ENTRY.vPull + ENTRY.pullTurn;
  // an outside boat (5, 6) that has already run out ahead of the 4 stays slow — the 4 can then pull
  if (en.slot >= 5 && !en.pullAt) {
    const four = boats.find(q => q.en.slot === 4 && !q.en.dash);
    const needFour = four ? Math.max(0, four.b.x + 190) / ENTRY.vPull + ENTRY.pullTurn : 0;
    // still not pulled when the 4 is down to its last moment, and out in front of it: too late — it stays slow and the 4 can go
    if (four && !four.en.faced && T <= needFour + 4 && r.b.x > four.b.x + 3) { en.noPull = true; toast('スロー', `${r.no}号艇は引かずにスローへ`, 'info'); return; }
  }
  if (en.pullAt == null) {
    if (r.pref === 'in') { en.noPull = true; return; }
    if (en.slot >= 4) {
      const last = en.slot === 4 || !boats.some(q => q.en.slot === en.slot - 1 && !q.en.dash && q.en.slot >= 4);
      en.pullAt = en.slot >= 5 || r.pref === 'out' ? 10 + simRandom() * 12          // 6 (and 5 after it): early, with time to spare for the 4
        : simRandom() < ENTRY.kado.early4 ? 5 + simRandom() * 8 : 0.4 + simRandom() * 1.2;   // 4: at the last moment
      if (!last && en.slot === 4) en.pullAt = 0.4 + simRandom() * 1.2;
    } else {
      // 3 (or 2): only if the boat outside pulled with time to spare
      const p = (en.slot === 3 ? ENTRY.kado.k3 + (en.lost ? 0.3 : 0) : ENTRY.kado.k2) * (r.pref === 'out' ? 2 : 1);
      if (T - need > ENTRY.kado.ample && simRandom() < p) en.pullAt = 1 + simRandom() * 3;
      else { en.noPull = true; return; }
    }
  }
  if (T <= need + en.pullAt) { callDash(r); toast('引く', `${r.no}号艇がダッシュへ`, 'info'); }
}
// 待機行動違反: 減点 (shown, recorded), not a disqualification. Once per kind per boat.
function entryFoul(r, kind) {
  if (r.entryViol.includes(kind)) return;
  r.entryViol.push(kind); fleet.entry.viol.push({ no: r.no, kind });
  toast('待機行動違反', `${r.no}号艇 ${kind}（減点）`, 'bad');
  if (typeof buildCard === 'function' && typeof document !== 'undefined' && document.getElementById('cardBody')) buildCard();
}
const thrFor = (v, vT) => clamp(0.25 + (vT - v) * 0.35, 0, 1);
// The engine never stops: lever shut and sat up, a boat still runs on at about WAIT_V. So waiting is
// timing — the only way to kill time is to swing the bow off the line (it then moves slower toward it),
// and only so far. Arrive too early, or hold the lever too long, and the boat ends up deep (起こし short).
const WAIT_V = 1.8;   // m/s the hull settles at, lever shut and sat up (≈7 km/h)
const creepAfter = ok => WAIT_V * Math.max(0, RUNUP - timeToLine(ok, WAIT_V) - 0.2) + 2;   // m still crept after the hand starts (till the lever opens)
// steering for the pit-out loop: along the home side to the 小回り防止ブイ, round it (outside), back to 2M, round 2M
function entryAim(b, R, stage, look, A = -MK) {
  const Bx = SMALL_TURN_BUOY.x;
  const round = cx => { const ph = Math.atan2(b.y, b.x - cx) - look / R; return [cx + R * Math.cos(ph), R * Math.sin(ph)]; };
  if (stage === 'out') {
    if (b.y > 0 && b.x < Bx - 2) return [Math.min(b.x + look, Bx), R];
    return round(Bx);
  }
  if (stage === 'back' && b.x > A + 1) return [Math.max(b.x - look, A), -R];
  return round(A);
}
// pace from the buoy to 2M: come round 2M so that, after squaring up, the drift at idle carries the boat
// onto its 起こし mark as the hand starts. Slow boats round earlier, dash boats later (with a little spare).
function entryPace(r, R, nSlow, contested, leftOverride) {
  const E = fleet.entry, b = r.b, en = r.en;
  const sp = entrySpot(r, nSlow, contested), xh = sp.x - creepAfter(-sp.x);
  const drift = Math.max(0, xh - (-MK + 2)) / 1.35;                 // s of idling from squaring up to the mark
  const tA = E.zero - RUNUP - Math.PI * R / ENTRY.vTurn - drift - (en.dash ? 14 : 3);
  const left = leftOverride ?? Math.max(0, b.x - (-MK - (en.dash ? ENTRY.dashSwing : 0) + 3));
  return clamp(left / Math.max(0.5, tA - time), 1.8, 10);
}
function laneProg(r) {
  const b = r.b, st = r.en.stage;
  if (st === 'out' && r.en.straightDone && b.y > 5 && b.x < SMALL_TURN_BUOY.x - 8) return b.x;
  if (st === 'back') return -b.x;
  return null;
}
// ピット離れのコース取り: at the end of its straight run, a boat that is pitSteal m ahead of the boat inside it
// (late out of the pits) goes for that course. It has to really pass it first: it keeps its own line and enough
// speed to stay in front, and takes the course (turns in) only once it is a clear 8 m ahead — never behind it.
// If the late boat comes back at it, the attempt is dropped. Then it may go again for the next boat in.
// Returns the speed it must keep (0 = no constraint).
function pitOutSteal(r, boats) {
  if (fleet.noMae) return 0;
  const en = r.en, E = fleet.entry;
  let vMin = 0;
  if (en.passing) {   // turned in: keep ahead until across the passed boat's line
    const q = en.passing;
    if (en.stage === 'out' && Math.abs(r.b.y) > Math.abs(q.b.y) - 1.5) vMin = q.b.v + 1;
    else en.passing = null;
  }
  if (en.stage !== 'out' || r.b.x > SMALL_TURN_BUOY.x - 20 || (!r.player && r.pref === 'out')) { en.stealFrom = null; return vMin; }
  if (!en.stealFrom) {
    const i = boats.find(q => q.en.slot === en.slot - 1);
    if (i && (i.en.stage === 'pit' || (i.en.stage === 'out' && !i.en.straightDone)) && r.b.x - i.b.x >= ENTRY.pitSteal) {
      // a CPU rider decides there and then whether to claim the late boat's course; the player has to press コース主張
      if (!r.player && en.claimLeft <= 0 && !en.oppSeen.has(i.no)) { en.oppSeen.add(i.no); if (simRandom() < (ENTRY.opp.p[r.temper] ?? 0.4) + 0.3) { en.claimLeft = 1; en.wantIn = true; } }
      if (en.claimLeft > 0) en.stealFrom = i;
    }
  }
  const i = en.stealFrom;
  if (!i) return vMin;
  // the boat being passed sees it coming: it may open up and run alongside to shut the door (ブロック)
  if (i.en.stage === 'out' && !i.player && i.en.blockVs !== r) {
    i.en.blockVs = r;
    i.en.block = simRandom() < (ENTRY.resist[i.temper] ?? 0.55) + (i.en.slot === 1 ? 0.15 : 0) ? r : null;
    if (i.en.block) toast('ブロック', `${i.no}号艇が前に出て${r.no}号艇を入れさせない`, 'warn');
  }
  if (i.en.slot !== en.slot - 1 || r.b.x - i.b.x < 0) { en.stealFrom = null; return vMin; }   // it came back at me: no
  vMin = Math.max(vMin, i.en.stage === 'pit' ? 0 : i.b.v + 1.5);
  if (en.claimLeft <= 0) { en.stealFrom = null; return vMin; }
  if (r.b.x - i.b.x >= ENTRY.claimLead) {
    en.slot--; i.en.slot++; E.pitSteals = (E.pitSteals || 0) + 1; i.en.lost = true;
    en.claimLeft--; if (!en.claimLeft && r.player) en.wantIn = false;
    en.stealFrom = null; en.passing = i;
    toast('ピット離れ', `${r.no}号艇が出遅れた${i.no}号艇を抜いて内へ`, 'warn');
  }
  return vMin;
}
function startFight(a, c) {
  if (a.en.fightWith || c.en.fightWith) return;
  a.en.fightWith = c; c.en.fightWith = a; a.en.fightT = c.en.fightT = 0;
  toast('抵抗', `${a.no}号艇が${c.no}号艇の前付けに抵抗`, 'warn');
}
// one of a fighting pair gives up
function endFight(r, why) {
  const q = r.en.fightWith; if (!q) return;
  r.en.fightWith = null; q.en.fightWith = null; r.en.gaveUp = true;
  const inner = r.en.slot < q.en.slot;
  if (!inner) { r.en.gained = 2; r.en.claimLeft = 0; toast('前付け断念', `${r.no}号艇 ${why}`, 'info'); return; }
  // the inside boat lets it in: before squaring up it may pull right back to dash instead
  if (!r.en.faced && r.en.slot >= 2 && !r.player && simRandom() < 0.55) {
    callDash(r); r.en.decided = true; toast('引く', `${r.no}号艇 ${why}、ダッシュへ`, 'info'); return;
  }
  // once squared up nobody can cross over: the inside boat keeps its course, it just stops pushing forward
  toast('抵抗やめ', `${r.no}号艇 ${why}`, 'info');
}
// an inside boat challenged for its course: fight it, let it in, or pull back to dash rather than be squeezed deep
function entryAnswer(r, nSlowNow) {
  const en = r.en;
  const pRes = (ENTRY.resist[r.temper] ?? 0.55) + (en.slot === 1 ? 0.25 : 0) - Math.max(0, nSlowNow - 3) * 0.15;
  if (simRandom() < pRes) return 'resist';
  if (en.slot >= 2 && simRandom() < (en.slot >= 3 ? 0.55 : 0.12) + Math.max(0, nSlowNow - 3) * 0.2) {
    callDash(r); en.decided = true; toast('引く', `${r.no}号艇 前付けを受けずダッシュへ`, 'info'); return 'hiku';
  }
  return 'yield';
}

function entryStep(dt, playerInput) {
  time += dt;
  const E = fleet.entry, boats = fleet.boats, all = boats.map(r => r.b);
  // pit lamp
  const step = Math.floor(time - E.t0);
  if (step !== E.lampStep && time < E.go + 0.5) { E.lampStep = step; const n = ENTRY.lamp - step; toast(n > 0 ? String(n) : 'ピット離れ', n > 0 ? 'ピット離れまで' : 'GO', n > 0 ? 'info' : 'good'); }
  for (const r of boats) { setWake(r.b, wakeAt(r.b.x, r.b.y, r.wakesOthers, time)); r.b.trail = 0; }
  const { order, nSlow } = entryOrder(E, boats);
  fleet.rank = order;
  const contested = E.steals > 0;

  // 前付け: on the back straight, a boat far enough ahead of the boat inside it takes its lane
  // (out to the buoy along the home side, or back from it to 2M — wherever both are running their lanes)
  const inLanes = boats.filter(r => laneProg(r) != null).sort((a, b) => a.en.slot - b.en.slot);
  // 隙があれば: an outer CPU boat that finds itself ahead of the boat inside it may go for that course
  // (once per neighbour; at most one course gained this way, so the slow group doesn't get pushed too deep)
  for (let k = 1; k < inLanes.length; k++) {
    const o = inLanes[k], i = inLanes[k - 1];
    if (fleet.noMae || o.player || o.en.wantIn || o.en.dash || o.en.gaveUp || o.pref === 'out' || (o.en.gained || 0) >= 1) continue;
    if (o.en.slot !== i.en.slot + 1 || o.en.stage !== i.en.stage || o.en.oppSeen.has(i.no)) continue;
    if (laneProg(o) - laneProg(i) < ENTRY.opp.gap || i.b.v > o.b.v) continue;   // a real gap: the inside boat is behind and not closing
    o.en.oppSeen.add(i.no);
    if ((o.en.slot > 3 || i.en.slot === 1) && o.pref !== 'in') continue;   // the 1コース is only gone for by イン志向; dash-minded outside boats leave the slow courses alone   // the dash-minded outside boats don't fight for the slow courses
    if (simRandom() < (ENTRY.opp.p[o.temper] ?? 0.4)) { o.en.wantIn = true; o.en.opp = true; o.en.claimLeft = 1; }
  }
  for (let k = 1; k < inLanes.length; k++) {
    const o = inLanes[k], i = inLanes[k - 1];
    if (o.en.slot !== i.en.slot + 1 || o.en.stage !== i.en.stage) continue;
    // only a boat claiming the course (コース主張: the player's button, or a CPU rider going for it) ever takes it,
    // and only once it has got 2艇身 clear of the boat inside — however far ahead a boat runs, without a claim nothing changes
    if (!o.en.dash && o.en.claimLeft > 0 && !o.en.gaveUp && laneProg(o) - laneProg(i) >= ENTRY.claimLead) {       // running −x: smaller x is further along
      o.en.slot--; i.en.slot++; E.steals++; o.en.stole = true; i.en.lost = true; o.en.gained = (o.en.gained || 0) + 1;
      o.en.claimLeft--; if (!o.en.claimLeft && o.player) o.en.wantIn = false;
      if (o.en.fightWith === i) { o.en.fightWith = null; i.en.fightWith = null; }
      toast('前付け', `${o.no}号艇が${i.no}号艇の内に入った`, 'warn');
    }
  }

  for (const r of boats) {
    const b = r.b, en = r.en;
    let vT = 0, thr = 0, tx = b.x + 10, ty = b.y, holdIt = false;
    // ---- stage changes
    if (en.stage === 'pit') {
      if (r.player && en.pressAt == null && playerInput && playerInput.thr > 0.3) {
        en.pressAt = time;
        if (time < E.go) { en.react = E.go + 0.6; toast('早すぎ', 'エンスト気味で出遅れ', 'bad'); }
        else { en.react = time; const d = time - E.go; toast(d < 0.1 ? '好ピット離れ' : d < 0.25 ? 'ピット離れ' : '出遅れ', `反応 ${d.toFixed(2)}秒`, d < 0.1 ? 'good' : d < 0.25 ? 'warn' : 'bad'); }
      }
      if (r.player && en.pressAt == null && time > E.go + 2.5) { en.pressAt = time; en.react = time; toast('大きく出遅れ', 'ピット離れの合図でアクセル', 'bad'); }
      if (en.react != null && time >= en.react) en.stage = 'out';
      else { b.v = 0; b.vl = 0; b.yaw = 0; r.inp = { thr: 0, steer: 0, roll: 0, pitch: 0 }; continue; }
    }
    if (en.stage === 'out' && b.y < -5 && Math.cos(b.a) < -0.3 && b.x < SMALL_TURN_BUOY.x + 3) { en.stage = 'back'; if (!r.player) cpuDashEarly(r); }
    if (en.stage === 'back' && b.x < -MK - (en.dash ? ENTRY.dashSwing : 0) + 3) en.stage = 'turn';
    if (en.stage === 'turn' && b.x < -MK - 4 && b.y > 0.55 * ENTRY.runR(en.slot)) { en.stage = 'approach'; }
    if (en.stage === 'approach' && en.facing && Math.cos(b.a) > 0.97 && b.y > 2 && (Math.abs(laneYOf(en.course || en.slot) - b.y) < 2.5 || E.zero - RUNUP - time < 11)) {   // squared up only once on its course's line (it can't move across after)
      en.stage = 'wait'; en.faced = true; en.facedAt = time; E.faced.push(r); E.lastFacedAt = time;
      // 見透し線 priority: a slow boat squaring up after a boat outside it has already squared up
      // may not force its way inside (割り込み禁止) — it takes the course outside that boat instead
      if (r.player && !en.dash && !en.rewind) {
        const outerSet = boats.filter(q => q !== r && q.en.faced && !q.en.dash && !q.en.rewind && q.en.slot > en.slot && q.en.facedAt < time - 3 && q.b.y < b.y + 1);   // only boats it would have to cut inside of
        if (outerSet.length) {
          const to = Math.max(...outerSet.map(q => q.en.slot)), from = en.slot;
          for (const q of boats) if (q !== r && q.en.slot > from && q.en.slot <= to) q.en.slot--;
          en.slot = to;
          toast('割り込み不可', `${r.no}号艇 正対が遅れ、外へ`, 'warn');
        }
      }
    }
    // 回り直し: far too late squaring up
    if (!en.faced && !en.rewind && (en.stage === 'out' || en.stage === 'back') &&
        ((E.faced.length >= 3 && time > E.faced[2].en.facedAt + ENTRY.rewindAfter) || time > E.zero - ENTRY.rewindBy)) {
      en.rewind = true; en.dash = true; toast('回り直し', `${r.no}号艇 大外から`, 'warn');
    }
    // ---- where to go and how fast
    const R = ENTRY.runR(en.slot);
    if (en.stage === 'out' || en.stage === 'back' || en.stage === 'turn') {
      // a dash boat swings wide round 2M (further back) to come out with a long run-up
      [tx, ty] = entryAim(b, R, en.stage, 5 + b.v * 0.5, -MK - (en.dash ? ENTRY.dashSwing : 0));
      const Bx = SMALL_TURN_BUOY.x, Aeff = -MK - (en.dash ? ENTRY.dashSwing : 0);
      if (en.stage === 'turn') vT = en.rewind ? 7 : ENTRY.vTurn;
      else if (en.stage === 'out' && b.y < 5) vT = ENTRY.vBuoy;   // round the buoy under control
      else {
        // pits → buoy → 2M: run along, timed to come round 2M when it's right for its course
        const left = en.stage === 'out' ? Math.max(0, Bx - b.x) + Math.PI * R + Math.max(0, Bx - (Aeff + 3)) : Math.max(0, b.x - (Aeff + 3));
        vT = entryPace(r, R, nSlow, contested, left);
        if (en.stage === 'out' && b.x > Bx - 22) vT = Math.min(vT, ENTRY.vBuoy);
        en.pace = vT;
        // wants a course further in (イン志向, or the player's own call): push
        const inner = boats.find(q => q.en.stage === en.stage && laneProg(q) != null && q.en.slot === en.slot - 1);
        if (!r.player && en.claimLeft > 0 && inner && !en.gaveUp && !en.dash) vT += ENTRY.vPush;
        // being challenged from outside: fight it off, let it in, or pull back to dash
        const outer = boats.find(q => q.en.stage === en.stage && laneProg(q) != null && q.en.slot === en.slot + 1);
        if (!r.player && !en.dash && outer && laneProg(r) != null && outer.en.claimLeft > 0 && !outer.en.gaveUp && !outer.en.dash && laneProg(outer) - laneProg(r) > -8 && outer.b.v > b.v + 0.3) {
          if (!en.resistVs.has(outer)) en.resistVs.set(outer, entryAnswer(r, nSlow));
          if (en.resistVs.get(outer) === 'resist' && !en.gaveUp) { vT = Math.max(vT, outer.b.v + (laneProg(outer) - laneProg(r) > ENTRY.claimLead * 0.4 ? 2 : 0.6)); startFight(r, outer); }   // 抵抗: never let it get 2艇身 clear
        }
        if (en.fightWith && !en.gaveUp && !r.player) vT = Math.max(vT, en.fightWith.b.v + (en.fightWith.en.slot > en.slot ? 2 : 0.5));
      }
    } else {
      // after 2M. Once a boat squares up to the start line it may not use the rudder again, so all the
      // timing is done before that: it hangs with its bow off the line (rudder over, sat up, barely moving),
      // edging to its lane, and turns to face only when a straight idle from there lands it on its 起こし
      // mark as the hand starts. Face too soon (or come round 2M too early) and there's no undoing it: deep.
      const sp = entrySpot(r, nSlow, contested), ok = -sp.x, xh = sp.x - creepAfter(ok);
      const T = Math.max(0.5, E.zero - RUNUP - time), D = xh - b.x;
      cpuPullDecide(r, boats, sp, T);
      const manual = r.player && playerInput && playerInput.thr >= 0.08 && !en.pulling;
      if (en.pulling === 'back') {
        // bow round to the outside and away from the slit, then back off toward the dash spot
        if (b.x <= sp.x + 6 && Math.cos(b.a) < -0.5) en.pulling = 'round';
        // the swing always goes through the outside (+y): never across the boats inside
        if (Math.cos(b.a) > -0.5) { const ta = b.a + (Math.sin(b.a) < -0.5 ? -1.2 : 1.2); tx = b.x + Math.cos(ta) * 15; ty = b.y + Math.sin(ta) * 15; }
        else { tx = b.x - 25; ty = sp.y - 7; }
        vT = Math.cos(b.a) > -0.5 ? 2 : ENTRY.vPull;   // backing off a little inside its lane: the swing round comes out on it
      } else if (en.pulling === 'round') {
        // swing round again through the outside to face the line
        // round through the outside: while the bow still points back or inward, keep turning that way (clockwise on screen)
        if (Math.cos(b.a) < 0 && Math.sin(b.a) < 0.7) { const ta = b.a - 1.2; tx = b.x + Math.cos(ta) * 15; ty = b.y + Math.sin(ta) * 15; }
        else { tx = b.x + 12; ty = b.y + 10; }
        vT = 1.8;
        if (Math.cos(b.a) > 0.5) en.pulling = null;
      }
      if (en.pulling) { en.hang = false; en.projOk = null; }
      else {
      let rate = D > 0 ? D / T : 0;
      if (!en.faced) {
        const dy = sp.y - b.y;
        if (!en.facing) {
          const ready = rate >= ENTRY.faceRate && Math.abs(dy) < 2.5;
          // an outside boat that means to pull keeps its bow off the line until it does (it can't pull once squared up)
          const willPull = !r.player && !en.dash && !en.noPull && en.slot >= 4 && r.pref !== 'in' && !(en.wantIn && !en.gaveUp);
          if (!willPull && (ready || manual || T < 11 || (dy < -3 && T < 16) || (en.fightWith && !en.gaveUp))) en.facing = true;
        }
        if (en.facing) { tx = b.x + 20; ty = b.y + clamp(dy, -6, 6); vT = WAIT_V; }
        else {
          // out to the lane at a steep angle (little headway toward the line), then hang there bow-out
          if (dy > 2.5) { const aT = Math.atan2(dy, 4); tx = b.x + 12 * Math.cos(aT); ty = b.y + 12 * Math.sin(aT); vT = 3; en.hang = false; }
          else if (dy < -2.5) { const aT = Math.atan2(dy, 6); tx = b.x + 12 * Math.cos(aT); ty = b.y + 12 * Math.sin(aT); vT = 2.5; en.hang = false; }   // took a course further in: cross in front to it before squaring up
          else { tx = b.x + 12 * Math.cos(ENTRY.hangA); ty = b.y + 12 * Math.sin(ENTRY.hangA); vT = 0; en.hang = true; }
        }
        en.projOk = Math.max(0, -Math.max(xh, b.x + 0.3 * T) - creepAfter(ok));
      } else {
        en.hang = false;
        if (en.fightWith && !en.gaveUp) rate = Math.max(rate, ENTRY.fightV);   // neither gives: bows level, straight on
        // a slow boat keeps its bow level with the slow boats outside it (else they'd get inside it)
        if (!en.dash && !en.rewind) {
          let mx = -Infinity, mv = 0;
          for (const q of boats) if (q !== r && q.en.faced && !q.en.dash && !q.en.rewind && q.en.slot > en.slot && q.b.x > mx) { mx = q.b.x; mv = q.b.v * Math.cos(q.b.a); }
          if (mx > b.x - 1 && mx < -85) rate = Math.max(rate, Math.min(3, mv + (mx - b.x + 1) * 0.3));   // but not chasing a boat gone mad toward the line
        }
        // straight at the line: the rudder only holds the heading
        tx = b.x + 30; ty = b.y; vT = Math.max(rate, 0.5);
        const xProj = b.x + Math.max(rate, WAIT_V, manual ? b.v : 0) * T;
        en.projOk = Math.max(0, -xProj - creepAfter(Math.max(20, -xProj)));
      }
      en.waitRate = rate;
      }
    }
    // ピット離れ: straight out of the pit lane flat out for 80–100 m, then turn for the buoy and pace it
    if (en.stage === 'out' && !en.straightDone) {
      if (b.x >= ENTRY.pitX + en.runLen) en.straightDone = true;
      else { tx = b.x + 20; ty = ENTRY.pitY[r.no - 1]; vT = 30; }
    }
    if (en.straightDone || en.passing) { const vMin = pitOutSteal(r, boats); if (vMin > vT) vT = vMin; }
    // ブロック: keep level with (a little ahead of) the boat trying to get past, until it gives up or the buoy
    if (en.block) {
      const q = en.block;
      if (q.en.stealFrom !== r || en.stage !== 'out' || b.x > SMALL_TURN_BUOY.x - 20) en.block = null;
      else vT = Math.max(vT, q.b.v + (q.b.x > b.x - 2 ? 2 : 0.5));
    }
    // 6艇スタート練習: the outside CPU boats pull early, on the way to 2M (outermost first)
    if (fleet.practice6 && !r.player && !en.dash && (en.stage === 'back' || en.stage === 'turn') && en.slot >= 4 && r.pref !== 'in'
        && boats.every(q => q.en.slot <= en.slot || q.en.dash || q.player)) { callDash(r); toast('引く', `${r.no}号艇がダッシュへ`, 'info'); }
    if (en.rewind && en.stage === 'back') vT = Math.max(vT, ENTRY.vBack);
    // keep 艇2つ分 off the stern of a boat ahead in the same lane (the rule between the buoy and 2M)
    if (!r.player && en.stage !== 'wait') {
      const hx = Math.cos(b.a), hy = Math.sin(b.a);
      for (const q of boats) {
        if (q === r || q.en.stage === 'pit') continue;
        const dx = q.b.x - b.x, dy = q.b.y - b.y, along = dx * hx + dy * hy, lat = Math.abs(-dx * hy + dy * hx);
        if (along > 0 && along < ENTRY.gap + 4 && lat < 2.8) vT = Math.min(vT, q.b.v - 0.4 - (ENTRY.gap + 4 - along) * 0.35);
      }
    }
    const err = wrapRad(Math.atan2(ty - b.y, tx - b.x) - b.a);
    const steer = en.faced ? clamp(err * 2.2, -0.12, 0.12) : clamp(err * 2.2);   // squared up: no more rudder
    // the player's lever rules until 2M; after that, lever shut = the boat settles itself onto its spot
    const auto = !r.player || en.pulling || ((en.stage === 'approach' || en.stage === 'wait') && !(playerInput && playerInput.thr >= 0.08));
    if (!auto) thr = playerInput ? playerInput.thr : 0;
    else thr = thrFor(b.v, vT);
    if (auto && en.hang) { holdIt = 'hang'; thr = 0; }   // rudder over, sat up: all but stopped (the engine still turns)
    // the player's own boat, once squared up: no pacing toward the line or keeping level with the boat outside —
    // lever shut means sat up and drifting (the engine never stops), the rest is the player's lever
    else if (auto && en.stage === 'wait') { if (r.player || vT < b.v + 0.1 || vT <= WAIT_V) { holdIt = true; thr = 0; } else thr = clamp(0.1 + (vT - b.v) * 0.5, 0, 0.6); }   // lever shut and sat up: it still runs on
    else if (auto && (vT <= 2 || vT < b.v - 0.8)) { holdIt = true; thr = 0; }   // settle: lever shut, sit up and let it die
    b.hold = holdIt;
    r.inp = { thr, steer, roll: 0, pitch: 0 };
    boatPhysics(b, r.inp, dt);
    boatFx(b, r.wake, dt);
  }
  // fights for a course: each side gives up after a while, or when it's being dragged too deep
  for (const r of boats) {
    const en = r.en;
    // claims and fights for a course are settled on the way to 2M: from there on the order stands
    if (en.stage !== 'pit' && en.stage !== 'out' && en.stage !== 'back') {
      en.claimLeft = 0;
      if (en.fightWith) { en.fightWith.en.fightWith = null; en.fightWith = null; }
    }
    if (!en.fightWith) continue;
    en.fightT += dt;
    const lim = (ENTRY.fightLimit[r.temper] ?? 7) + (en.slot === 1 ? 4 : 0);
    if (en.faced && en.projOk != null && en.projOk < ENTRY.tooDeep && simRandom() < dt * (r.player ? 0 : 0.5)) endFight(r, '深くなりすぎて');
    else if (en.fightT > lim && !r.player) endFight(r, '抵抗を諦めて');
  }
  // 待機行動違反 checks
  for (const r of boats) {
    const b = r.b, en = r.en;
    if (en.stage === 'pit') continue;
    // 間隔不足: between the buoy and 2M, sitting on another boat's stern (and closing) — 艇2つ分 apart
    if (en.stage === 'back' || en.stage === 'turn') {
      let close = false;
      for (const q of boats) {
        if (q === r || (q.en.stage !== 'back' && q.en.stage !== 'turn')) continue;
        const hx = Math.cos(q.b.a), hy = Math.sin(q.b.a), dx = b.x - q.b.x, dy = b.y - q.b.y;
        const along = dx * hx + dy * hy, lat = Math.abs(-dx * hy + dy * hx);
        if (along < -1 && along > -ENTRY.gap && lat < 2.2 && b.v > q.b.v - 0.2) { close = true; break; }
      }
      en.gapT = close ? en.gapT + dt : Math.max(0, en.gapT - dt * 0.5);
      if (en.gapT > ENTRY.gapT) entryFoul(r, '間隔不足');
    }
    // over the start line before the hand has started
    if ((en.stage === 'approach' || en.stage === 'wait') && boatBow(b).x >= 0 && boatBow(b).y > 0) entryFoul(r, '大時計前にスタートライン越え');
  }
  for (const e of boatContacts(all)) {
    if (e.J < 0.8) continue;
    const a = boats[e.i], c = boats[e.j];
    const who = e.rear === e.i ? a : e.rear === e.j ? c : (a.b.v > c.b.v ? a : c);   // the boat that ran into the other
    // jostling on the way out of the pits isn't 待機行動 yet; from the back straight on it is
    if (who.en.stage === 'pit' || who.en.stage === 'out' || (!who.player && e.J < 1.5)) continue;
    entryFoul(who, '待機中の接触');
  }
  // the hand starts 12 s out: hand over to the race's own start
  if (time >= E.zero - RUNUP) entryHandoff();
}
function cpuDashEarly(r) {
  // early 引き on the back straight (it then swings wide round 2M): the 6 now and then, the 5 more likely once
  // the 6 has gone, an out-minded rider anywhere from the 3 out. The 4 doesn't — it waits.
  if (r.en.decided || r.en.wantIn || r.pref === 'in') return;
  const boats = fleet.boats, slot = r.en.slot, outerDash = boats.some(q => q.en.slot === slot + 1 && q.en.dash);
  const p = r.pref === 'out' && slot >= 3 ? 0.6 : slot === 6 ? 0.6 : slot === 5 ? (outerDash ? 0.7 : 0) : 0;
  if (p && boats.every(q => q.en.slot <= slot || q.en.dash) && simRandom() < p) {
    callDash(r);
    r.en.dashBonus = ENTRY.dashDepth * (0.55 + simRandom() * 0.45);
  }
}
function cpuDashChoice(r, nSlowNow) {
  const en = r.en;
  if (en.decided) return;
  en.decided = true;
  const slot = en.slot;
  if (en.wantIn && !en.gaveUp) return;   // went in for a course: stays slow
  if (slot <= 2) return;
  if (r.pref === 'out' || (slot >= 4 && simRandom() < 0.92) || (slot === 3 && (simRandom() < KADO3_RATE || (en.lost && simRandom() < 0.5)))) { en.dash = true; en.dashBonus = ENTRY.dashDepth * simRandom() * 0.15; }
}
// コース主張 (button / controller A): each press asks for one course further in. Only while running to 2M.
function playerClaim() {
  const r = fleet && fleet.entry && fleet.boats.find(q => q.player);
  if (!r || fleet.noMae) return;
  const en = r.en;
  if (en.dash || !['pit', 'out', 'back'].includes(en.stage)) { toast('主張できない', en.dash ? 'ダッシュに引いた後は主張できない' : '2マークを回ったらコースは決まり', 'warn'); return; }
  const want = Math.min(en.slot - 1, en.claimLeft + 1);
  if (want <= en.claimLeft) { toast('主張できない', 'これ以上内のコースはない', 'warn'); return; }
  en.claimLeft = want; en.wantIn = true; en.gaveUp = false;
  toast('コース主張', `あと${en.claimLeft}つ内へ（内の艇より2艇身前に出れば入れ替わる）`, 'info');
}
function playerDash() {
  const r = fleet && fleet.entry && fleet.boats.find(q => q.player);
  if (!r) return;
  const en = r.en;
  if (en.dash) return;
  if (en.stage !== 'pit' && !en.faced) {
    callDash(r);
    toast('ダッシュ', en.pulling ? 'スリットに背を向けて後ろへ引く。引いた順に外のコース' : `後ろに引く。外から配置・助走 +${Math.round(en.dashBonus)}m`, 'info');
  } else toast('今は引けない', en.stage === 'pit' ? 'ピットを出てから' : '正対したあとは引けない', 'warn');
}
function entryHandoff() {
  const E = fleet.entry;
  const { nSlow } = entryOrder(E, fleet.boats);
  // courses are counted from the inside as the boats actually lie (slow group, then dash, then 回り直し);
  // nobody can have got inside another after squaring up, so this is the order they hold
  const grp = r => r.en.rewind ? 2 : r.en.dash ? 1 : 0;
  // the courses as claimed and pulled (slow by slot, dash by pull order); each boat is then settled on its line
  const order = entryOrder(E, fleet.boats).order;
  order.forEach((r, i) => {
    r.en.course = i + 1;
    const course = i + 1, slow = !r.en.dash && !r.en.rewind, kado = !slow && course === 3;
    applyCourse(r, course, slow, kado, Math.round(-boatBow(r.b).x - creepAfter(Math.max(20, -boatBow(r.b).x))));
    r.b.thrMul = 1; r.b.hold = true;
    if (!r.player && r.tiltAuto) fitMotor(r, course, true);
  });
  // each boat runs in on the line it squared up on (it can't steer across now), kept in course order
  let yPrev = 2;
  for (const r of order) { r.trait.laneY = clamp(Math.max(r.b.y, yPrev + 4.5), 4, 46); yPrev = r.trait.laneY; r.b.y = r.trait.laneY; r.b.a = wrapRad(r.b.a) * 0.3; }   // settle each boat on its line, bow straight: from the 起こし on there's no rudder
  fleet.byCourse = {}; for (const r of fleet.boats) fleet.byCourse[r.trait.course] = r;
  fleet.rank = order;
  fleet.entryResult = { text: order.slice(0, nSlow).map(r => r.no).join('') + '/' + order.slice(nSlow).map(r => r.no).join(''), steals: E.steals, nSlow,
                        rewinds: fleet.boats.filter(r => r.en.rewind).length, viol: E.viol.slice() };
  fleet.entry = null;
  SS.phase = 'count'; SS.t0 = time + PRE_RUN; SS.hideAt = 0;
  toast('進入', fleet.entryResult.text + (E.steals ? '　前付けあり' : '') + (E.pitSteals ? '　ピット離れでコース取り' : ''), 'info');
  // the player's own boat: its (shadow) CPU must not plan attacks that other boats would react to
  for (const r of fleet.boats) if (r.player && fleet.fullControl) Object.assign(r.trait, { pushMul: 0, dump: 0, tsuke: 0 });
  // 6艇スタート練習: after the slit everyone just takes 1M in turn with room between them (no attacks, squeezes or dumps)
  if (fleet.practice6) for (const r of fleet.boats) {
    Object.assign(r.trait, { pushMul: 0, dump: 0, tsuke: 0 });
    if (r.trait.course > 1) { r.trait.tactic = 'sashiPlace'; r.trait.lineOff = (r.trait.course - 1) * 1.2; Object.assign(r.drv.mem, { planDecided: true, plan: 'sashiPlace', tacticNow: 'sashiPlace' }); }
  }
  if (onEntryHandoff) onEntryHandoff();
}

let entryMode = false;
/* ---- 場と水面: everything about the water comes from the venue (場) — 水質, 潮, the wind it gets, how rough it runs.
   One weather model for every mode: a day (wind strength, three shifts, tide phase, the day's temperature), then each
   race of it (wind gusting about the day's, tide every 2 races, temperature by the clock). Tide, temperature and waves
   are carried on the env already; their own effects and visuals hang off these fields when they come in. ---- */
const envU = (a, b) => a + Math.random() * (b - a);
const envPick = w => { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i; return 0; };
function envDay(V, season, prev, force) {
  const W = V.wind, u = Math.random(), storm = force === 'storm' || u < (W.stormP || 0), strong = storm || u < (W.stormP || 0) + W.strongP;
  const base = storm ? envU(...W.storm) : strong ? envU(...W.strong) : envU(...W.base);
  const rain = Math.random() < (storm ? V.rain.storm : strong ? V.rain.strong : V.rain.calm);
  const dirs = [ENV_DIRS[envPick(W.dirW)]];
  for (let i = 1; i < 3; i++) { if (Math.random() < W.keepP) { dirs.push(dirs[i - 1]); continue; } let d; do d = ENV_DIRS[envPick(W.dirW)]; while (d === dirs[i - 1]); dirs.push(d); }
  const tide0 = prev ? (prev.tide0 + 2 + Math.floor(Math.random() * 2)) % 12 : Math.floor(Math.random() * 12);
  const tBase = (SEASONS[season] || SEASONS.spring).t + V.temp.off + envU(-V.temp.jitter, V.temp.jitter);
  return { strong, storm, rain, base, dirs, tide0, tBase };
}
function envRace(V, D, R) {
  const dir = D.dirs[Math.min(2, Math.floor((R - 1) / 4))], wind = Math.round(D.base * envU(...V.wind.gust) * 2) / 2;
  const hasTide = V.tide.amp > 0, ts = (D.tide0 + Math.floor((R - 1) / 2)) % 12, ph = ts / 12 * Math.PI * 2;
  const tideLv = hasTide ? Math.round(100 + V.tide.amp * Math.cos(ph)) : null, flow = hasTide ? Math.round(-Math.sin(ph) * 100) / 100 : 0;
  const wave = Math.max(0, Math.round(wind * (V.wave[dir] ?? V.wave.横風) + (hasTide && tideLv > 100 + V.tide.amp * 0.55 ? V.wave.highTide : 0) + envU(-0.5, 0.5)));
  const hour = V.start.hour + (R - 1) * V.start.per, temp = Math.round((D.tBase + V.temp.swing * Math.sin(Math.PI * (hour - 8) / 12)) * 10) / 10;
  const short = wave >= V.short.wave || wind >= V.short.wind;
  return { dir, wind, wave, tideLv, tideJa: hasTide ? TIDE_JA[ts] : null, flow, temp, stab: short || wave >= V.stab.wave || wind >= V.stab.wind,
           laps: short ? 2 : 3, rain: !!D.rain,
           time: `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}` };
}
// what the race engine takes (waterEnv): the wind as a vector (+x = toward 1M from the start = 追い風), the tide's drift,
// waves, 安定板 — plus the readings, for the screen and for effects still to come
function envPhysics(V, e) {
  const w = e.wind, wx = e.dir === '追い風' ? w : e.dir === '向かい風' ? -w : 0, wy = e.dir === '横風(外向き)' ? w : e.dir === '横風(内向き)' ? -w : 0;
  return { wx, wy, cx: V.tide.flow * e.flow, wave: e.wave, stabilizer: e.stab, dir: e.dir, wind: w, temp: e.temp, tideLv: e.tideLv, tideJa: e.tideJa, water: V.water, laps: e.laps || 3, rain: !!e.rain };
}
const envText = e => `${e.time}頃 ${e.rain ? '雨 ' : ''}${e.wind ? e.dir + ' ' + e.wind.toFixed(1) + 'm' : '無風'} 波${e.wave}cm 気温${e.temp.toFixed(0)}℃${e.tideJa ? ` ${e.tideJa}（${e.tideLv}cm）` : ''}${e.stab ? ' 安定板' : ''}${e.laps === 2 ? ' 周回短縮（2周）' : ''}`;
function randomWaterEnv(force) {
  const V = VENUES.standard, season = Object.keys(SEASONS)[Math.floor(Math.random() * 4)];
  return envPhysics(V, envRace(V, envDay(V, season, null, force), 1 + Math.floor(Math.random() * 12)));
}
// 周回: 3周, or 2周 when the race is shortened for rough water (周回短縮)
const raceLaps = () => (waterEnv && waterEnv.laps) || 3;
// 設定「天候」: 'auto' = the day's weather as drawn (6艇デモは無風), 'storm' = always 荒天 (to try it out)
let wxMode = 'auto';
try { wxMode = localStorage.getItem('honorGP.weather') || 'auto'; } catch (e) {}
const wxForced = () => wxMode === 'storm' && !lab.active ? Object.assign(randomWaterEnv('storm'), { forced: true }) : null;
function wxAnnounce() {
  if (!waterEnv) return;
  if (waterEnv.laps === 2) toast('周回短縮', `荒天のため2周戦${waterEnv.stabilizer ? '・安定板使用' : ''}`, 'warn');
  else if (waterEnv.stabilizer) toast('安定板使用', '水面が荒れています', 'info');
}
function startEntry(playerNo, kind = 'race', opts = {}) {
  if (runLog) runLogEnd('途中でやり直し');
  waterEnv = opts.env || wxForced() || (playerNo && !lab.active ? randomWaterEnv() : null);
  fleet = makeEntryFleet(playerNo, { noMae: kind === 'p6', rows: opts.rows });
  fleet.setsu = opts.setsu || null;
  fleet.practice6 = kind === 'p6'; fleet.noMae = kind === 'p6'; fleet.fullControl = !!playerNo && kind === 'race';
  ptrs.clear(); steerTouch = false; sideOn('thr'); sideOn('steer');
  input.thr = input.steer = input.roll = input.pitch = 0;
  wake.length = 0; spray.length = 0;
  SS.phase = 'entry'; SS.hideAt = 0; $('clock').hidden = false;
  buildOrderStrip(); buildCard(); wxAnnounce();
  refreshFleetUi();
}
function nextRace() {
  if (fleet && fleet.setsu) return;   // 節間モード: the race decides what comes next
  if (fleet && fleet.playerNo) startEntry(fleet.playerNo);
  else if (entryMode) startEntry(null);
  else startFleet();
}
const playerRow = () => fleet && fleet.playerNo ? fleet.boats.find(r => r.player) : null;
// the player has the lever from the pits until the start line
// レース練習: the player keeps the boat for the whole race (until the finish, an accident or a フライング retirement)
const playerRacing = r => !!(r && fleet && fleet.fullControl && r.fin == null && !r.out && !(r.flying && r.passed1M));
function playerActive() { const r = playerRow(); return !!(r && (fleet.entry || (r.st == null && !r.lateTold) || playerRacing(r))); }
function startFleet() {
  if (runLog) runLogEnd('途中で終了');
  { const fw = wxForced(); if (fw) waterEnv = fw; else if (waterEnv && waterEnv.forced) waterEnv = null; }
  fleet = freshFleet(setupFleet());
  ptrs.clear(); steerTouch = false; sideOn('thr'); sideOn('steer');
  wake.length = 0; spray.length = 0;
  SS.phase = 'count'; SS.t0 = time + PRE_RUN; SS.hideAt = 0; $('clock').hidden = false;
  buildOrderStrip(); buildCard();
  const k3 = fleet.boats.some(r => r.trait.kado&&r.trait.course===3);
  toast(k3 ? '3カド' : sgMode ? 'SG' : '6艇レース', k3 ? '3コースがカド。伸びと内艇の動きから攻め方を判断' : '枠なり進入・スロー3艇／ダッシュ3艇。出走表で各艇の特性を確認できます', 'info');
  wxAnnounce();
  refreshFleetUi();
}
function stopFleet() {
  fleet = null;
  input.thr = input.steer = input.roll = input.pitch = 0;
  $('order').hidden = true;
  beginStart();
  refreshFleetUi();
}
function refreshFleetUi() {
  $('demoBtn').textContent = fleet ? (fleet.setsu ? (fleet.playerNo ? '棄権' : '結果へ') : fleet.playerNo ? '練習をやめる' : '自分で操作') : '6艇デモ';
  $('cardBtn').hidden = !fleet;
  $('skipBtn').hidden = true;
  $('demoTag').hidden = !fleet;
  $('again').hidden = !!fleet;
}

const IDLE_INPUT = { thr: 0, steer: 0, roll: 0, pitch: 0 };
function fleetStep(dt, playerInput) {
  if (fleet.entry) { entryStep(dt, playerInput); return; }
  const timingBefore=fleet.boats.map(r=>timingPose(r.b,time));
  time += dt;
  const zero = SS.t0 + CLOCK;
  if(!lab.active && !fleet.slit)fleet.slit=slitCreate(fleet.playerNo?'レース練習':'6艇デモ');
  const all = fleet.boats.map(r => r.b);
  // 引き波: how much wake is under each hull, and how square it is crossing it
  for (const r of fleet.boats) {
    setWake(r.b, wakeAt(r.b.x, r.b.y, r.wakesOthers, time));
    // 波: the day's chop under every hull (a rough-riding boat feels it more; 安定板 takes the edge off it)
    if (waterEnv && waterEnv.wave > 0) {
      const wb = waterEnv.wave * ENV.waveBump * waveHeadK(r.b.a) * (r.b.hullRide || 1) * (r.b.stabilizer ? ENV.stabBump : 1) * (0.5 + 0.5 * Math.abs(Math.sin(time * 2.1 + r.b.x * 0.19 + r.no)));
      r.b.wakeBump = Math.max(r.b.wakeBump || 0, wb);
    }
    // 航跡: a boat ahead on (nearly) my line
    let tr = 0; const fx = Math.cos(r.b.a), fy = Math.sin(r.b.a);
    for (const q of fleet.boats) {
      if (q === r || q.b.cap > 0 || q.b.v < 8) continue;
      const dx = q.b.x - r.b.x, dy = q.b.y - r.b.y, f = dx * fx + dy * fy;
      if (f < 3 || f > TRAIL.range) continue;
      const l = Math.abs(-dx * fy + dy * fx);
      if (l < TRAIL.width) tr = Math.max(tr, (1 - f / TRAIL.range) * (1 - 0.5 * l / TRAIL.width));
    }
    r.b.trail = tr;
  }
  // 勝負どころ: racing boats with a rival within 12 m — except a leader already 25 m clear
  const racing = fleet.rank.filter(r => r.st != null && r.fin == null && !r.dq);
  for (const r of fleet.boats) r.battle = false;
  racing.forEach((r, i) => {
    const near = racing.some(q => q !== r && Math.hypot(q.b.x - r.b.x, q.b.y - r.b.y) < 12);
    const clear = i === 0 && (racing.length < 2 || Math.hypot(racing[1].b.x - r.b.x, racing[1].b.y - r.b.y) > 25);
    r.battle = near && !clear;
  });
  for (const r of fleet.boats) {
    const b = r.b;
    let o = IDLE_INPUT;
    if (!r.out) {
      const fi = r.fin != null ? fleet.finOrder.indexOf(r) : -1;
      const occupied=lab.active?fleet.boats.filter(q=>!q.dq).sort((a,b)=>a.trait.course-b.trait.course):null;
      const inR=lab.active?occupied.filter(q=>q.trait.course<r.trait.course).at(-1):fleet.byCourse[r.trait.course-1];
      const outR=lab.active?occupied.find(q=>q.trait.course>r.trait.course):fleet.byCourse[r.trait.course+1];
    const env = { now: time, clockZero: (r.st == null && time < zero + 1.2) ? zero : null, laneY: r.trait.laneY, others: all, wakes: r.wakesOthers,
                  competitors:fleet.boats, inner: inR && !inR.dq ? inR.b : null, outer: outR && !outR.dq ? outR.b : null,
                  outerPlan: outR ? (outR.drv.mem.tacticNow || outR.trait.tactic) : null,
                  innerCommit: !!(inR && !inR.dq && inR.drv && inR.drv.mem.commit),
                  outerCommit: !!(outR && !outR.dq && outR.drv && outR.drv.mem.commit),
                  outerSqueeze: fleet.boats.some(q => q !== r && !q.dq && q.drv && q.drv.mem.squeeze === r.b),
                  stAdv: inR && r.st != null ? (inR.st != null ? inR.st - r.st : Math.max(0, time - zero) - r.st) : 0,   // inside boat not across yet: at least this much behind
                    battle: r.battle, retire: r.flying && r.passed1M,
                    cruise: r.fin != null ? { ahead: fi > 0 ? fleet.finOrder[fi - 1].b : null } : null,
                    caution: fleet.caution && r.fin == null && !r.dq && (fleet.locked || inCautionZone(r) || nearWreck(b, CAUTION_LOCK.near)) ? { ahead: cautionAhead(r), wrecks: fleet.wrecks } : null };
      env.finalStretch = r.laps === raceLaps() - 1 && (r.vis & 2) && b.y > 0;   // round the last mark, heading for the line
      if(lab.active)labBeforeDrive(r,env);
      o = r.drv.drive(b, env, dt);
      if(lab.active)labAfterDrive(r,o,env);
      if (r.player && r.st == null && time - dt > zero + 1 && !r.lateTold) { r.lateTold = true; toast('出遅れ', fleet.fullControl ? '1秒以内に越えられなかった' : '1秒以内に越えられなかった。CPUが引き継ぎ', 'bad'); }
      if (r.player && r.st == null && !r.lateTold) {
        // the player has the lever (and posture) until the start line; steering follows the lane
        const ps = playerInput ? playerInput.steer : 0;
        if (SS.phase === 'count') zigCheck(b, ps, r);
        o = { thr: playerInput ? playerInput.thr : 0, steer: clamp(ps, -PRE_SLIT.steer, PRE_SLIT.steer), roll: 0, pitch: playerInput ? playerInput.pitch : 0, ev: null };   // スリットまでは舵は微調整だけ、傾きなし
        r.inp = o;
      } else if (r.player && playerRacing(r)) {
        // past the slit: rudder, lean, posture and lever are all the player's
        const pi = playerInput || IDLE_INPUT;
        o = { thr: pi.thr, steer: pi.steer, roll: pi.roll, pitch: pi.pitch, ev: null };
        r.inp = o; b.gripBoost = 1; b.pushing = false;
      } else if (r.player && r.inp !== r.drv.out) r.inp = r.drv.out;
      b.hold = fleet.pitMode && r.st == null && (r.player ? o.thr < 0.08 : !r.drv.mem.go) || (!r.player && r.drv.mem.cauYieldAt === time);
      if (o.ev === 'pushFail') pushFailed(r);
      else if (o.ev === 'squeeze') { fleet.squeezes++; toast('絞り', `${r.no}号艇が内の${inR?.no??"?"}号艇を絞りにいく`, 'info'); }
      else if (o.ev === 'resist') { fleet.resists++; toast('抵抗', `${r.no}号艇が張って抵抗`, 'warn'); }
      else if (o.ev === 'yield') fleet.yields++;
      else if (o.ev === 'pushOk') { fleet.pushTry++; toast('勝負', `${r.no}号艇が攻めのターンを決めた`, 'good'); }
    }
    if(lab.active)r.labApplied={thr:o.thr,steer:o.steer,roll:o.roll,pitch:o.pitch};
    b.slowStart = !!(r.trait && r.trait.slow);
    b.preStart = lab.active ? 0 : r.st == null ? (SS.phase === 'count' ? 1 : 0) : (!r.drv.mem.firstDone && b.y > 0 && r.laps === 0 ? preStartAfter(boatBow(b).x, b.slowStart) : 0);
    if (r.player && !lab.active) {
      if (!r.logged && !runLog && r.st == null && SS.phase === 'count' && o.thr >= 0.3) { r.logged = true; runLogBegin(b, `${r.no}号艇 ${r.trait.course}コース${r.trait.slow ? 'スロー' : 'ダッシュ'}`, zero); }
      if (runLog && runLog.b === b && (r.drv.mem.firstDone || r.out || time > zero + 30)) runLogEnd(`起こし ${Math.round(r.trait.okoshi || 0)}m / ST ${r.st == null ? '—' : r.st < 0 ? 'F' + fmtST(-r.st) : fmtST(r.st)} / チルト ${b.tilt} / 出足 ${(b.deashi || 1).toFixed(3)} 伸び ${(b.nobi || 1).toFixed(3)}`);
    }
    const ev = boatPhysics(b, o, dt);
    if (r.player && runLog && runLog.b === b) runLogStep(b, o, zero, r.st != null && !r.logSt ? (r.logSt = true, 'スリット通過') : '');
    if(lab.active&&ev)labEvent('physics',r.no,{label:ev});
    if (ev && ev.startsWith('cap:') && !r.out) accident(r, '転覆', ev.slice(4));
    else if (ev === 'buoy' || ev === 'boom') toast(ev === 'buoy' ? 'ターンマーク接触' : '消波装置に接触', `${r.no}号艇`, 'warn');
    // 内側航走: crossing the course centreline between the marks means a mark was cut
    if (r.st != null && !r.dq && r.fin == null && !r.relegated && r.prevY != null && Math.sign(r.prevY) !== Math.sign(b.y) && Math.abs(b.x) < MK - 1) {
      if(lab.active)labEvent('inside_course',r.no,{label:'内側航走'});
      r.relegated = true; fleet.cutsInside++;
      toast('内側航走', `${r.no}号艇 ターンマークの内側を通過　6着扱い`, 'bad');
    }
    r.prevY = b.y;
    boatFx(b, r.wake, dt);
    if (r.flying && !r.passed1M && b.y < -5 && b.x < MK - 10) r.passed1M = true;
    if (b.x > MK - 15) r.vis |= 1;
    if (b.x < -MK + 15) r.vis |= 2;
  }

  // 斜行: on a straight, a boat sliding sideways across one that is behind or alongside it
  if (time > zero + 1.5 && !fleet.caution) for (const r of fleet.boats) {
    const b = r.b;
    // judged once the boat is properly on the straight, not while it is still coming out of a turn
    if (r.st == null || r.fin != null || r.dq || b.cap > 0 || Math.abs(b.x) > STRAIGHT_X - 12) continue;
    const vy = Math.sin(b.a) * b.v + Math.cos(b.a) * b.vl;   // sideways speed across the straight
    if (Math.abs(vy) < 2.2) continue;
    const cd = b.y > 0 ? 1 : -1;
    for (const q of fleet.boats) {
      if (q === r || q.b.cap > 0 || q.dq) continue;
      const along = (q.b.x - r.b.x) * cd, gap = q.b.y - b.y;
      if (along > -10 && along < 1.5 && Math.sign(gap) === Math.sign(vy) && Math.abs(gap) < 4.5) {
        cutAcross(r, q, vy, gap, '斜行');
        break;
      }
    }
  }
  // 第19条: on a straight, moving across toward a boat it overlaps fore and aft (並走中に相手側へ転舵) is 不良航法.
  // Before the slit the same sudden 斜行 into a neighbour is a 待機行動違反 instead.
  if (!fleet.caution && !lab.active) for (const r of fleet.boats) {
    const b = r.b;
    if (r.fin != null || r.dq || r.out || b.cap > 0 || b.y <= 0 && r.st == null || Math.abs(b.x) > STRAIGHT_X - 12) continue;
    const pre = r.st == null;
    if (pre && SS.phase !== 'count') continue;
    const vy = Math.sin(b.a) * b.v + Math.cos(b.a) * b.vl;
    if (Math.abs(vy) < (pre ? 0.9 : RULE19.vy)) continue;
    const cd = b.y > 0 ? 1 : -1;
    for (const q of fleet.boats) {
      if (q === r || q.b.cap > 0 || q.dq || (pre !== (q.st == null))) continue;
      const along = (q.b.x - b.x) * cd, gap = q.b.y - b.y;
      if (Math.abs(along) >= RULE19.overlap || Math.sign(gap) !== Math.sign(vy) || Math.abs(gap) > RULE19.gap) continue;
      if (pre) {
        const key = r.no * 10 + q.no + 100;
        if ((fleet.cutCool[key] || 0) > time) continue;
        fleet.cutCool[key] = time + 3;
        startFoul(r, 'スタート前の斜行'); break;
      }
      cutAcross(r, q, vy, gap, '第19条');
      break;
    }
  }
  // ツケマイ result: once both are round 1M, is the attacker in front of its target?
  for (const r of fleet.boats) {
    const m = r.drv.mem;
    if (m.tacticNow !== 'tsuke' || !m.tsukeQ || r.tsukeJudged || r.out) continue;
    const q = m.tsukeQ;
    if (r.b.y < -5 && q.y < -5 && r.b.x < MK - 12 && q.x < MK - 12) {
      r.tsukeJudged = true; fleet.tsukeTry++;
      const t = fleet.boats.find(x => x.b === q);
      if (r.b.x < q.x - 1) { fleet.tsukeWin++; toast('ツケマイ', `${r.no}号艇が${t.no}号艇に張りついて回り、前に出た`, 'good'); }
      else toast('ツケマイ不発', `${r.no}号艇、${t.no}号艇を捉えきれず`, 'warn');
    }
  }
  // hull contact
  for (const e of boatContacts(all)) {
    const A = fleet.boats[e.i], Bt = fleet.boats[e.j];
    if(lab.active)labEvent('contact',A.no,{label:'艇間接触',other:Bt.no,x:e.x,y:e.y,impulse:e.J});
    // fighting a squeeze side by side (抵抗): hull rubbing on hull, even gently, can put the resisting boat over
    const fighter = A.drv.mem.resistQ === Bt.b ? A : Bt.drv.mem.resistQ === A.b ? Bt : null;
    if (fighter && !fighter.out && time > (fighter.fightRollT || 0)) {
      fighter.fightRollT = time + 0.5;
      const other = fighter === A ? Bt : A;
      if (simRandom() < SQUEEZE.fightCap * (RISK[fighter.prof.name] || RISK.B1).hit) accident(fighter, simRandom() < 0.5 ? '転覆' : '落水', `${other.no}号艇の絞りに抵抗して接触`);
    }
    if (e.J < 1.5) continue;
    for (let n = 0; n < Math.min(14, 4 + e.J * 2); n++) {
      const an = simRandom() * Math.PI * 2, sp = 1.5 + simRandom() * e.J;
      spray.push({ x: e.x, y: e.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, t: time, life: 0.4 + simRandom() * 0.4 });
    }
    const key = Math.min(A.no, Bt.no) * 10 + Math.max(A.no, Bt.no);
    if ((fleet.touchCool[key] || 0) > time) continue;
    fleet.touchCool[key] = time + 2;
    fleet.touches++;
    // 頭から側面へ: the boat whose bow went into the other's side carries it — if that boat goes over, 妨害失格
    for (const [x, y] of [[A, Bt], [Bt, A]]) {
      const bw = boatBow(x.b), ang = Math.abs(wrapRad(x.b.a - y.b.a));
      if (ang > SIDE_ON.ang && Math.hypot(e.x - bw.x, e.y - bw.y) < 1.6 && !x.dq) { x.interfere = { q: y, t: time }; x.tbone = (x.tbone || 0) + 1; }
    }
    (fleet.touchLog || (fleet.touchLog = [])).push({ t: time, a: A, b: Bt, J: e.J, x: e.x, y: e.y, ra: A.drv && A.drv.mem.turnRole && A.drv.mem.turnRole.role, rb: Bt.drv && Bt.drv.mem.turnRole && Bt.drv.mem.turnRole.role, pa: [A.b.x, A.b.y, A.b.a], pb: [Bt.b.x, Bt.b.y, Bt.b.a] });
    sfxHit(e.x, e.y, e.J);
    // contact right after cutting across the victim's path is interference
    for (const [x, y] of [[A, Bt], [Bt, A]]) if (x.lastCut && x.lastCut.q === y && time - x.lastCut.t < CUT.window && !x.dq) { furyo(x, y, `${x.lastCut.kind}で${y.no}号艇に接触`); x.interfere = { q: y, t: time }; x.lastCut = null; }
    const dumper = A.drv.dumping(Bt.b) ? A : Bt.drv.dumping(A.b) ? Bt : null;
    if (dumper) { const vic = dumper === A ? Bt : A; fleet.dumps++; toast('ダンプ', `${dumper.no}号艇が${vic.no}号艇を外へ押し出した`, 'warn'); }
    else if (e.rear >= 0 && e.J > 3) { const hit = fleet.boats[e.rear], vic = hit === A ? Bt : A; fleet.rears++; toast('追突', `${hit.no}号艇が${vic.no}号艇に後ろから接触`, 'bad'); }
    else if (e.J > 2.5) toast('接触', `${A.no}号艇と${Bt.no}号艇`, 'warn');
    // a heavy hit can put the boat that took the brunt of it over, or its rider in the water
    // a heavy hit can put either boat over — the one that took the brunt more likely, the one that hit it too —
    // and far more easily when the hull was already unsettled (bucking on a wake, near its grip limit, sliding)
    const vic = e.JA >= e.JC ? A : Bt, other = vic === A ? Bt : A;
    for (const [x, y, share] of [[vic, other, 1], [other, vic, CAPSIZE.hitter]]) {
      if (x.out) continue;
      const xb = x.b, vb = xb.wakeBump || 0, unst = Math.max(0, (xb.load || 0) - 0.7) + Math.max(0, Math.abs(xb.vl) - 1.5) * 0.15;
      const jLim = Math.max(CAPSIZE.jMin, CAPSIZE.j0 - 6 * vb - CAPSIZE.unstJ * unst);
      if (e.J <= jLim) continue;
      const p = clamp((e.J - jLim) / CAPSIZE.span * (1 + 2 * vb + CAPSIZE.unstP * unst), 0, 0.6) * share * (RISK[x.prof.name] || RISK.B1).hit;
      if (simRandom() < p) { accident(x, simRandom() < 0.5 ? '転覆' : '落水', `${y.no}号艇との接触${vb > 0.3 ? '（引き波で暴れていた）' : unst > 0.2 ? '（姿勢が乱れていた）' : x === other ? '（当てた側）' : ''}`); break; }
    }
  }
  fleetTimingStep(timingBefore,zero);
  if (fleet.practice6 && !fleet.p6Done && SS.phase !== 'count') {
    const live = fleet.boats.filter(r => !r.dq && !r.out);
    if (live.every(r => r.drv.mem.firstDone) || time > zero + 30) finishP6();
  }
  if(!lab.active)slitCapture(fleet.slit,time-zero,fleet.boats);
  if (SS.phase === 'count' && time > zero + 1.2) {
    SS.phase = 'done'; SS.hideAt = time + 2.5; fleet.raceStart = zero; fleet.raceOn = true;
    const started = fleet.boats.filter(r => r.st != null && r.st >= 0).sort((a, b) => a.st - b.st);
    if (started.length) toast('スタート', `トップST ${started[0].no}号艇 ${fmtST(started[0].st)}（${started[0].trait.slow ? 'スロー' : 'ダッシュ'}）`, 'info');
  }
  if (SS.phase === 'done' && SS.hideAt && time > SS.hideAt) { SS.phase = 'off'; $('clock').hidden = true; }
  rpSample(fleet, zero);
  jikkyo(zero, dt);
  fleet.rankT -= dt;
  if (fleet.rankT <= 0) { fleet.rankT = 0.25; fleet.rank = fleet.boats.slice().sort((a, b) => b.prog - a.prog); }
  const stillRacing = fleet.boats.filter(r => !r.dq && r.fin == null).length;
  if (!fleet.endAt && time > zero + 5 && (stillRacing === 0 || (fleet.order.length && time > fleet.order[0].fin + 30))) {
    fleet.endAt = time + 7;
    if (!lab.active) rpFinish(fleet);
    if(!lab.active)slitArchive(fleet.slit,fleet.boats,resultLine());
    if(!lab.active)setTimeout(() => toast('レース結果', fleet ? resultLine() : '', 'good'), 300);
  }
  if (fleet.endAt && time > fleet.endAt && !fleet.resShown) {if(lab.active)labFinish('レース終了');else { fleet.resShown = true; resultShow(fleet.setsu ? () => setsuRaceDone() : () => nextRace()); }}
}

// Judge all boats before sorting: a faster crossing within the same step wins,
// regardless of boat number, array order or render frame rate.
function fleetTimingStep(previous,zero){
  const hadWinner=fleet.order.length>0;
  let finishedNow=false;
  for(let i=0;i<fleet.boats.length;i++){
    const r=fleet.boats[i],at=gateCrossing(START_GATE,previous[i],timingPose(r.b,time));
    if(at==null || r.out)continue;
    if(r.st==null){
      r.st=startOffset(at,zero);r.vis=0;
      if(r.st<0){r.flying=true;r.dq=true;toast('フライング',`${r.no}号艇 F${fmtST(-r.st)}　返還、1マークを過ぎたら離脱${r.player?cutinNote(r.st):''}`,'bad');}
      else if(r.player&&!r.lateTold)toast(r.st<=.15?'好スタート':r.st<=.3?'スタート':'遅れ気味',`ST ${fmtST(r.st)}${cutinNote(r.st)}${fleet.fullControl?'':'　ここからCPUが引き継ぎ'}`,r.st<=.15?'good':r.st<=.3?'warn':'bad');
    }else if(r.vis===3&&r.fin==null&&!r.flying){
      r.laps++;r.vis=0;
      if(r.laps>=raceLaps()){r.fin=at;r.finY=boatBow(r.b).y;r.finV=r.b.v;finishedNow=true;fleet.finOrder.push(r);if(!r.dq)fleet.order.push(r);}
    }
  }
  fleet.finOrder.sort((a,b)=>a.fin-b.fin);fleet.order.sort((a,b)=>a.fin-b.fin);
  if(finishedNow)photoCheck();
  if(!hadWinner&&fleet.order.length){const r=fleet.order[0];toast('ゴール',`1着 ${r.no}号艇 ${fmtRT(r.fin-zero)}（${r.trait.course}コース・${TACTIC_JA[r.drv.mem.tacticNow||r.trait.tactic]}）`,'good');}
  for(const r of fleet.boats){
    const b=r.b,bow=boatBow(b),li=fleet.locked?fleet.lockOrder.indexOf(r):-1;
    const pg=r.fin!=null?1e6-fleet.order.indexOf(r):li>=0?5e5-li:r.st==null?bow.x-1000:r.laps*LREF+((loopS(13,bow.x,bow.y)-MK+LREF)%LREF);
    r.prog=r.dq?-3e6+(r.out?0:1):r.relegated?-2e6+pg/1e3:pg;
  }
  if(finishedNow)fleet.rank=fleet.boats.slice().sort((a,b)=>b.prog-a.prog);
  // 決まり手の材料: how each boat took the first 1M, and who led once it was over
  if(!fleet.k1){
    for(const r of fleet.boats){const b=r.b;if(r.apexR==null&&r.st!=null&&!r.dq&&b.y<0&&b.x>MK-8)r.apexR=Math.hypot(b.x-MK,b.y);}   // how wide each boat went round the first 1M
    const run=fleet.boats.filter(r=>!r.dq&&r.st!=null);
    if(time>zero+8&&(run.every(r=>r.drv.mem.firstDone)||time>zero+35)){const lead=fleet.boats.slice().sort((a,b)=>b.prog-a.prog).find(r=>!r.dq);fleet.k1={lead};}
  }
  cautionCheck();
}

// 写真判定: two boats crossing the line within PHOTO.gap s of each other (about 1.7 m at full speed) go to the photo;
// within PHOTO.tie s it is a 同着 (dead heat) and both get the same place
const PHOTO = { gap: 0.08, tie: 0.0015, wait: 2.5 };
function photoPairs() {
  const o = fleet.order.filter(r => !r.skipped), P = [];
  for (let i = 1; i < o.length; i++) { const a = o[i - 1], b = o[i], dt = b.fin - a.fin; if (dt < PHOTO.gap) P.push({ a, b, dt, place: fleet.order.indexOf(a) + 1, tie: dt < PHOTO.tie }); }
  return P;
}
function photoCheck() {
  fleet.photoSaid = fleet.photoSaid || [];
  for (const p of photoPairs()) {
    const k = p.a.no * 10 + p.b.no; if (fleet.photoSaid.includes(k)) continue; fleet.photoSaid.push(k);
    jkSay('photo', p.place, p.a.no, p.b.no);
    toast('写真判定', `${p.place}着争い ${p.a.no}号艇と${p.b.no}号艇`, 'warn');
  }
}
// the photo: where each boat's bow was when the first of the group touched the line (along = m behind the line)
function photoDraw(cv, groups) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  c.fillStyle = '#0d2633'; c.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 7) { c.fillStyle = `rgba(255,255,255,${0.03 + 0.03 * ((x / 7) % 2)})`; c.fillRect(x, 0, 4, H); }   // the slit camera's water streaks
  const lx = W * 0.72, pxm = 34;   // finish line, px per m
  c.strokeStyle = '#ff4a3d'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, H); c.stroke();
  const boats = groups.flat(), ys = boats.map(r => r.finY), y0 = Math.min(...ys), y1 = Math.max(...ys), span = Math.max(4, y1 - y0);
  const lane = (H - 30) / Math.max(1, boats.length);
  boats.slice().sort((a, b) => a.finY - b.finY).forEach((r, i) => {
    const first = groups.find(g => g.includes(r))[0], back = (r.fin - first.fin) * (r.finV || 20);
    const bx = lx - back * pxm, cy = 16 + lane * (i + 0.5), L = 3 * pxm, Hh = Math.min(lane * 0.7, 26);
    c.fillStyle = r.col[0]; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(bx, cy); c.lineTo(bx - L * 0.25, cy - Hh / 2); c.lineTo(bx - L, cy - Hh / 2); c.lineTo(bx - L, cy + Hh / 2); c.lineTo(bx - L * 0.25, cy + Hh / 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = r.col[1]; c.font = `bold ${Math.round(Hh * 0.7)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(r.no), bx - L * 0.6, cy + 1);
  });
  c.fillStyle = '#fff'; c.font = '11px sans-serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('ゴール', lx - 4, 3);
}
const photoGapJa = p => p.tie ? '同着' : (d => d < 0.3 ? `舳先わずか（約${Math.max(1, Math.round(d * 100))}cm）` : `約${d.toFixed(1)}m`)(p.dt * (p.b.finV || 20));

// 決まり手 (from the winner's first 1M)
function kimarite() {
  const w = fleet.order[0]; if (!w) return '—';
  const L = fleet.k1 && fleet.k1.lead;
  if (L && L !== w) return L.dq ? '恵まれ' : '抜き';
  return kimariteOf(w);
}
// how a boat took the first 1M
function kimariteOf(w) {
  if (w.trait.course === 1) return '逃げ';
  // round the outside of every inside boat = まくり, inside all of them = 差し, between = まくり差し
  const inner = fleet.boats.filter(r => r.trait.course < w.trait.course && r.apexR != null);
  if (w.apexR == null || !inner.length) return 'まくり';
  const inside = inner.filter(r => r.apexR < w.apexR).length;
  return inside === inner.length ? 'まくり' : inside === 0 ? '差し' : 'まくり差し';
}
// レース結果画面 (like the official result board): place, boat, rider, class, course, ST, time, 決まり手
function resultShow(after) {
  const f = fleet, box = $('resBox'), tb = $('resBody'); tb.textContent = '';
  const st = f.setsu && f.setsu.race;
  $('resTitle').textContent = st ? `${st.day}日目 ${st.R}R ${st.kind || ''}` : f.playerNo ? `${f.playerNo}号艇で出走` : '6艇デモ';
  const named = f.boats.some(r => r.name || r.player); box.querySelector('table').classList.toggle('noname', !named);
  const w = f.order[0];
  $('resInfo').textContent = w ? `決まり手：${kimarite()}　1着タイム ${w.skipped ? '—' : fmtRT(w.fin - f.raceStart)}${f.caution ? '　（事故のため着順確定）' : ''}${waterEnv ? `　${waterEnv.rain ? '雨 ' : ''}${windJa(waterEnv)} 波${waterEnv.wave}cm${waterEnv.stabilizer ? ' 安定板' : ''}${waterEnv.laps === 2 ? ' 周回短縮（2周）' : ''}` : ''}` : '';
  const P = photoPairs(), tieB = new Set(P.filter(p => p.tie).map(p => p.b));
  let place = 0, shown = 0;
  for (const r of f.rank) {
    const tr = document.createElement('tr');
    const pl = r.flying ? 'F' : r.st != null && r.st > 1 ? 'L' : r.out ? (r.out === '落水' ? '落' : '転') : r.dq ? '失' : (shown++, tieB.has(r) ? String(place) : String(place = shown));
    const tm = r.fin != null && !r.skipped && !r.dq ? fmtRT(r.fin - f.raceStart) : '—';
    const cells = [pl, r.no, (r.player ? '★' : '') + (r.name || (r.player ? 'あなた' : '—')), profJa(r.prof), r.trait.course, r.st == null ? '—' : r.st < 0 ? 'F' + fmtST(-r.st) : fmtST(r.st), tm + (r.relegated ? '（内側航走）' : '')];
    cells.forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i === 1) { td.className = 'no'; td.style.background = r.col[0]; td.style.color = r.col[1]; } if (i === 0) td.className = 'pl'; tr.appendChild(td); });
    if (r.player) tr.className = 'me';
    tb.appendChild(tr);
  }
  // 写真判定: the photo first, the board once the judges have looked at it
  const ph = $('resPhoto'), tw = box.querySelector('.tablewrap');
  ph.hidden = !P.length; tw.hidden = false; resPhotoT = 0;
  if (P.length) {
    const groups = []; for (const p of P) { const g = groups.find(g => g.includes(p.a)); if (g) g.push(p.b); else groups.push([p.a, p.b]); }
    photoDraw($('resPhotoCv'), groups);
    const txt = P.map(p => `${p.place}着争い ${p.a.no}－${p.b.no}：${photoGapJa(p)}`).join('　');
    $('resPhotoTxt').textContent = '写真判定中…'; tw.hidden = true;
    resPhotoT = setTimeout(() => { resPhotoT = 0; $('resPhotoTxt').textContent = '写真判定　' + txt; tw.hidden = false; }, PHOTO.wait * 1000);
  }
  box.hidden = false; resAfter = after;
  // the 6艇デモ moves on by itself; a race the player is in (or a 節間 race) waits for 次へ
  clearTimeout(resTimer); resTimer = !f.playerNo && !f.setsu ? setTimeout(resNext, (RESULT_AUTO + (P.length ? PHOTO.wait : 0)) * 1000) : 0;
}
const RESULT_AUTO = 6;   // s the result board stays up in the demo
let resAfter = null, resTimer = 0, resPhotoT = 0;
function resNext() { if (resPhotoT) { clearTimeout(resPhotoT); resPhotoT = 0; const p = photoPairs(); $('resPhotoTxt').textContent = '写真判定　' + p.map(q => `${q.place}着争い ${q.a.no}－${q.b.no}：${photoGapJa(q)}`).join('　'); $('resBox').querySelector('.tablewrap').hidden = false; return; }
  clearTimeout(resTimer); if ($('resBox').hidden) return; $('resBox').hidden = true; const a = resAfter; resAfter = null; if (a) a(); }
/* ---- 実況テキスト: at the key moments a line of commentary slides across the top of the screen.
   Styles: 標準 (plain), 熱血 (児島風のノリ — big and loud). A venue can name its own style later (VENUES[...].jikkyo). ---- */
const JK = { hold: 3.2, gap: 0.6, posEvery: 0.5, posCool: 4 };
let jkMode = 'std';
try { jkMode = localStorage.getItem('honorGP.jikkyo') || 'std'; } catch (e) {}
const JK_LINES = {
  std: {
    entry: a => `進入は ${a}`,
    wx: (sh, st) => sh ? `荒天のため周回短縮、2周戦${st ? '。安定板を使用しています' : ''}` : '安定板を使用しています',
    start: (n, st) => `スタートしました。トップスタートは${n}号艇、${st}`,
    fly: n => `${n}号艇、フライング。返還となります`,
    nige: n => `1マーク、${n}号艇が先マイ。逃げる体勢`,
    makuri: n => `1マーク、${n}号艇のまくり`,
    sashi: n => `1マーク、${n}号艇が差して出る`,
    makurizashi: n => `1マーク、${n}号艇がまくり差し`,
    order: (a, b, c) => `1周1マーク、先頭${a}号艇、2番手${b}号艇${c ? `、3番手${c}号艇` : ''}`,
    lead: n => `${n}号艇が先頭に立ちました`,
    second: (n, m) => `2番手争い、${n}号艇が${m}号艇をかわしました`,
    lap2: n => `2周目、先頭は${n}号艇`,
    last: (n, m) => `最終周回、先頭${n}号艇${m ? `、2番手${m}号艇` : ''}`,
    goal: n => `${n}号艇、1着でゴール`,
    photo: (pl, a, b) => `${pl}着争い、${a}号艇と${b}号艇はほぼ並んでゴール。写真判定です`,
    acc: (n, k) => `${n}号艇、${k}。事故艇が出ています`,
    lock: () => '着順が確定しました' },
  hot: {
    entry: a => `さあ、進入は ${a}！`,
    wx: (sh, st) => sh ? `この荒れ水面、周回短縮の2周戦！${st ? ' 安定板装着！' : ''}` : '水面は荒れ模様、安定板装着！',
    start: (n, st) => `スタートしました！ トップスタートは${n}号艇 ${st}！`,
    fly: n => `ああっと${n}号艇フライング！ 返還です！`,
    nige: n => `${n}号艇、先マイ！ 逃げる、逃げる、そのまま！`,
    makuri: n => `${n}号艇、まくったー！ 一気に外から！`,
    sashi: n => `${n}号艇、差したー！ 内をズバッと！`,
    makurizashi: n => `${n}号艇、まくり差しー！ 間を割って出る！`,
    order: (a, b, c) => `先頭${a}号艇！ 2番手${b}号艇${c ? `、3番手${c}号艇` : ''}！`,
    lead: n => `${n}号艇、ここで先頭！ 逆転だー！`,
    second: (n, m) => `2番手争いが激しい！ ${n}号艇が${m}号艇を抜いた！`,
    lap2: n => `2周目！ 先頭は${n}号艇、逃げ切れるか！`,
    last: (n, m) => `最終周回！ 先頭${n}号艇${m ? `、追う${m}号艇` : ''}！`,
    goal: n => `${n}号艇、そのまま、そのまま、ゴールイン！`,
    photo: (pl, a, b) => `際どい！ ${pl}着争い、${a}号艇と${b}号艇、並んでゴール！ 写真判定だー！`,
    acc: (n, k) => `ああっと${n}号艇${k}！ 事故艇が出ています！`,
    lock: () => '着順確定！' }
};
const jk = { q: [], t: 0 };
function jkSay(key, ...args) {
  if (jkMode === 'off' || lab.active || !fleet) return;
  const L = JK_LINES[jkMode] || JK_LINES.std, f = L[key];
  if (f) jk.q.push(f(...args));
  if (jk.q.length > 3) jk.q.splice(0, jk.q.length - 3);   // never run far behind the race
}
function jkShow(dt) {
  jk.t -= dt;
  if (jk.t > 0 || !jk.q.length) return;
  const el = $('jk'), txt = jk.q.shift();
  el.textContent = txt; el.hidden = false; el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
  jk.t = JK.hold + JK.gap;
}
// called every fleet step: watch the race and call the moments
function jikkyo(zero, dt) {
  const f = fleet; if (lab.active) return;
  const J = f.jk || (f.jk = { posT: 0, coolT: 0 });
  if (!J.entry && SS.phase === 'count' && time > zero - CLOCK) {
    J.entry = true;
    const bs = f.boats.slice().sort((a, b) => a.trait.course - b.trait.course);
    if (waterEnv && (waterEnv.laps === 2 || waterEnv.stabilizer)) jkSay('wx', waterEnv.laps === 2, waterEnv.stabilizer);
    jkSay('entry', bs.filter(r => r.trait.slow).map(r => r.no).join('') + '／' + bs.filter(r => !r.trait.slow).map(r => r.no).join(''));
  }
  if (!J.start && time > zero + 1.2) {
    J.start = true;
    const ok = f.boats.filter(r => r.st != null && r.st >= 0).sort((a, b) => a.st - b.st);
    if (ok.length) jkSay('start', ok[0].no, fmtST(ok[0].st));
    for (const r of f.boats) if (r.flying) jkSay('fly', r.no);
  }
  if (f.k1 && !J.m1) {
    J.m1 = true;
    const L = f.k1.lead;
    if (L && !L.dq) {
      const k = L.trait.course === 1 ? 'nige' : { 'まくり': 'makuri', '差し': 'sashi', 'まくり差し': 'makurizashi' }[kimariteOf(L)] || 'makuri';
      jkSay(k, L.no);
      const run = f.rank.filter(r => !r.dq);
      if (run[1]) jkSay('order', run[0].no, run[1].no, run[2] && run[2].no);
      J.top = run.slice(0, 2);
    }
  }
  J.coolT -= dt; J.posT -= dt;
  if (J.m1 && !f.locked && !f.endAt && J.posT <= 0) {
    J.posT = JK.posEvery;
    const run = f.rank.filter(r => !r.dq && (r.fin == null || f.order.includes(r)));
    const [a, b] = run;
    if (a && J.top && J.coolT <= 0) {
      if (J.top[0] !== a && a.fin == null) { jkSay('lead', a.no); J.coolT = JK.posCool; }
      else if (b && J.top[1] && J.top[1] !== b && b.fin == null && J.top[0] === a) { jkSay('second', b.no, J.top[1].no); J.coolT = JK.posCool; }
    }
    J.top = run.slice(0, 2);
  }
  const lead = f.rank.find(r => !r.dq);
  if (lead && J.m1 && !f.endAt) {
    if (lead.laps === 1 && raceLaps() > 2 && !J.l2) { J.l2 = true; jkSay('lap2', lead.no); }
    if (lead.laps === raceLaps() - 1 && !J.l3) { J.l3 = true; const run = f.rank.filter(r => !r.dq); jkSay('last', lead.no, run[1] && run[1].no); }
  }
  if (f.order[0] && !J.goal && time - f.order[0].fin > PHOTO.gap) { J.goal = true; if (!(f.order[1] && f.order[1].fin - f.order[0].fin < PHOTO.gap)) jkSay('goal', f.order[0].no); }
  jkShow(dt);
}
function resultLine() {
  let place = 0;
  return fleet.rank.map(r => r.flying ? `F ${r.no}` : r.out ? `${r.out} ${r.no}` : r.dq ? `失格 ${r.no}`
    : `${++place}着 ${r.no}` + (r.relegated ? '（内側航走）' : r.fin != null && !r.skipped ? ` ${fmtRT(r.fin - fleet.raceStart)}` : '')).join('  ');
}
// the boat directly ahead in the frozen order that is still out on the course
// Before the order is fixed, near the wreck (大きく回避する区間): the boat in front goes first; two boats side by side
// (overlapping by less than CAUTION_LOCK.along m) — the inside one goes first. Returns the boat I must follow.
const offLine = b => Math.abs(b.x) < MK ? Math.abs(b.y) : Math.hypot(Math.abs(b.x) - MK, b.y);   // how far out from the inside
function cautionPrior(q, r) {   // does q go before r?
  const d = q.prog - r.prog;
  if (Math.abs(d) >= CAUTION_LOCK.along) return d > 0;
  return offLine(q.b) < offLine(r.b);
}
function cautionAhead(r) {
  if (fleet.locked) {
    const ord = fleet.lockOrder, i = ord.indexOf(r);
    for (let k = i - 1; k >= 0; k--) { const q = ord[k]; if (q.fin == null && !q.dq) return q.b; }
    return null;
  }
  let best = null, bd = Infinity;
  for (const q of fleet.boats) {
    if (q === r || q.fin != null || q.dq || q.st == null || !cautionPrior(q, r)) continue;
    const d = q.prog - r.prog;
    if (d > -CAUTION_LOCK.along && d < bd) { bd = d; best = q; }
  }
  return best ? best.b : null;
}
// 事故後の着順確定: the order is fixed once the last boat still running has come round the next turn mark
// (past the wreck, outside it) — until then it still counts as raced. Only then can the race be skipped.
// prog of the end of each turn (1M exit, 2M exit) within a lap, measured the same way as r.prog
const TURN_EXIT = (() => { const M = arcX(13), A = Math.PI * 13, L = loopLen(13), p = s => ((s - MK + L) % L + L) % L; return [p(2 * M + A), p(L)].sort((a, b) => a - b); })();
// the two 150 m-before-the-mark lines (x = 0 on the home and the back straight), in the same measure as r.prog
const ZONE_FROM = [loopS(13, 0, 30), loopS(13, 0, -30)].map(s => ((s - MK) % LREF + LREF) % LREF).sort((a, b) => a - b);
// where in the lap (same measure as r.prog) the no-overtaking zone for a wreck starts, and how long it is
function cautionZoneFor(w) {
  const wp = ((loopS(13, w.x, w.y) - MK) % LREF + LREF) % LREF;
  let s = -Infinity; for (const e of ZONE_FROM) if (e <= wp) s = Math.max(s, e);
  if (s === -Infinity) s = ZONE_FROM[ZONE_FROM.length - 1] - LREF;
  return { s, len: wp + CAUTION_ZONE.past - s };
}
const inCautionZone = r => (fleet.cZones || []).some(z => ((r.prog - z.s) % LREF + LREF) % LREF < z.len);
function nextTurnExit(pg) {
  const lap = Math.floor(pg / LREF), at = pg - lap * LREF;
  for (const e of TURN_EXIT) if (e >= at) return lap * LREF + e;
  return (lap + 1) * LREF + TURN_EXIT[0];
}
function cautionCheck() {
  if (!fleet.caution || fleet.locked || fleet.endAt) return;
  const run = fleet.boats.filter(q => !q.dq && q.fin == null);
  if (run.length && !run.every(q => q.prog >= fleet.lockAt)) return;
  fleet.locked = true;
  fleet.rank = fleet.boats.slice().sort((a, b) => b.prog - a.prog);
  fleet.lockOrder = fleet.rank.filter(q => !q.dq);
  if (!lab.active) { toast('着順確定', '最後尾が1周して事故艇の外を回り着順が確定', 'warn'); jkSay('lock'); skipRace(); }   // 確定したら結果へ
}
function accident(r, kind, why) {
  if (r.out) return;
  if(lab.active)labEvent('accident',r.no,{label:kind,reason:why});
  const wreckProg = r.prog > -1e6 && r.prog < 5e5 ? r.prog : 0;
  r.out = kind; r.dq = true; fleet.accidents++;
  // the boat that cut across it and hit it just before: 妨害失格
  for (const x of fleet.boats) if (x !== r && !x.dq && x.interfere && x.interfere.q === r && time - x.interfere.t < 3) { x.hindered = true; disqualify(x, `${r.no}号艇を${kind}させた`); }
  const b = r.b;
  b.cap = 1e9; b.fallen = kind === '落水'; b.v *= 0.4; b.vl *= 0.3;
  if (b.fallen) { b.fx = b.x - Math.cos(b.a) * 3.5 + Math.sin(b.a) * 1.5; b.fy = b.y - Math.sin(b.a) * 3.5 - Math.cos(b.a) * 1.5; }
  splash(b); sfxCapsize(b.x, b.y);
  toast(kind, `${r.no}号艇 ${why}　失格`, 'bad');
  jkSay('acc', r.no, kind);
  fleet.wrecks.push(b); (fleet.cZones = fleet.cZones || []).push(cautionZoneFor(b));
  if (!fleet.caution) {
    fleet.caution = true;
    fleet.rank = fleet.boats.slice().sort((a, b) => b.prog - a.prog);   // fresh, not the 0.25 s-old display order
    fleet.lockOrder = fleet.rank.filter(q => !q.dq); fleet.locked = false;
    // fixed once the last boat still running has come round the course again (at least one turn mark on the way, so
    // everyone gets a turn to make up places) and run wide past the wreck on its outside — not at the first pass by it
    const run = fleet.boats.filter(q => !q.dq && q.fin == null && q.st != null), last = run.length ? Math.min(...run.map(q => q.prog)) : 0;
    let lockAt = wreckProg + CAUTION_LOCK.past;
    while (lockAt < Math.max(nextTurnExit(last), last + LREF * CAUTION_LOCK.lap)) lockAt += LREF;
    fleet.lockAt = lockAt;
    if(!lab.active)setTimeout(() => toast('事故発生', '事故艇の手前のストレートから追い抜き禁止（前の艇が優先、並んだら内側）。最後尾が1周して事故艇の外を回ったら着順確定', 'warn'), 1800);
  }
}
function pushFailed(r) {
  fleet.pushTry++; fleet.pushFail++;
  const rk = RISK[r.prof.name] || RISK.B1;
  if (simRandom() < rk.acc) accident(r, simRandom() < 0.55 ? '転覆' : '落水', '無理なターン');
  else { r.b.vl += 6; r.b.v *= 0.6; toast('ターン膨らむ', `${r.no}号艇、勝負に出たが握りきれず大きく流れた`, 'warn'); }
}

// 蛇行: the rudder flicked from one side to the other zigFlips times within zigWindow s before the slit
// 入力ログ: the player's own run from the 起こし (lever opened during the start) to past 1M — inputs and what the
// physics made of them, every 0.1 s, kept for the last 5 runs to view and copy after the race
const runLogs = [];
let runLog = null;
function runLogBegin(b, label, zero) {
  runLog = { label, zero, rows: [], last: -1, b, at: new Date() };
  b.dbg = {};
}
function runLogStep(b, inp, zero, extra) {
  if (!runLog || runLog.b !== b) return;
  if (time - runLog.last < 0.1 - 1e-9 && !extra) return;
  runLog.last = time;
  const d = b.dbg || {}, f = (v, n = 2) => (v == null || !isFinite(v)) ? '' : (+v).toFixed(n);
  runLog.rows.push([f(time - zero, 2), f(b.x, 1), f(b.y, 1), f(b.v * 3.6, 1), f(d.acc, 2), f(inp.thr, 2), f(inp.steer, 2), f(inp.roll, 2), f(inp.pitch, 2),
    b.hold ? (b.hold === 'hang' ? 'hang' : 'hold') : '-', f(d.startK, 3), f(d.motorK, 3), f(d.thrustA, 2), f(d.airA, 2), f(d.holdA, 2), f(d.wakeA, 2), f(d.turnA, 2), f(d.leanA, 2),
    f(b.inWake, 2), f(b.wakeBump, 2), f(b.trail, 2), f(b.load, 2), f(b.yaw * 57.3, 1), extra || ''].join('\t'));
}
function runLogEnd(meta) {
  if (!runLog) return;
  const L = runLog; runLog = null; L.b.dbg = null;
  if (L.rows.length < 3) return;
  const head = ['時刻(合図=0)', 'x', 'y', '速度km/h', '加速度m/s2', 'アクセル', '舵', '左右傾き', '姿勢(+伏せ)', '待機減速', 'スタート補正', 'モーター', '推力', '空気抵抗', '待機抵抗', '引き波抵抗', '旋回損失', '姿勢抵抗', '引き波', '横切り', '航跡', '安定度', '旋回°/s', '備考'];
  L.text = `# Honor for GP 入力ログ ${L.label} ${L.at.toLocaleString()}\n# ${meta || ''}\n# 推力〜姿勢抵抗は m/s²（加速度 = 推力 − 各抵抗）\n` + head.join('\t') + '\n' + L.rows.join('\n');
  runLogs.unshift(L); if (runLogs.length > 5) runLogs.pop();
  $('slitLog').hidden = false;
  toast('入力ログ', '起こし〜1マークを記録（右上の「入力ログ」で見る）', 'info');
}
let logWasPaused = false;
function logOpen() {
  if (runLog) runLogEnd('記録途中');
  if (!runLogs.length) { toast('入力ログなし', '大時計が回っている間にレバーを開けると、起こし〜1マークを記録します', 'warn'); return; }
  logWasPaused = paused; paused = true;
  const sel = $('logSel'); sel.textContent = '';
  runLogs.forEach((L, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${L.at.toLocaleTimeString()} ${L.label}`; sel.appendChild(o); });
  sel.value = '0'; $('logText').value = runLogs[0].text; $('logMsg').textContent = ''; $('logView').hidden = false;
}
function zigCheck(b, steer, r) {
  const sg = Math.abs(steer) > 0.03 ? Math.sign(steer) : 0;
  if (!sg) return;
  b.zig = b.zig || { last: 0, flips: [] };
  if (b.zig.last && sg !== b.zig.last) {
    b.zig.flips.push(time); b.zig.flips = b.zig.flips.filter(t => time - t < PRE_SLIT.zigWindow);
    if (b.zig.flips.length >= PRE_SLIT.zigFlips) { b.zig.flips = []; if (r) startFoul(r, '蛇行'); else if (!b.zigTold) { b.zigTold = true; toast('待機行動違反', '蛇行（スリットまでは真っ直ぐ）', 'bad'); } }
  }
  b.zig.last = sg;
}
// 待機行動違反 (減点) during the run to the slit; once per kind per boat
// After the slit, moving across another boat is not in itself a foul — 絞り is part of racing. It becomes
// 不良航法 only when it actually gets in the way: the boat cut across is hit (or forced off) within a couple
// of seconds, or the cut is so steep and so close that it plainly endangers it. If the boat hit goes over: 妨害失格.
// 不良航法 costs points (節間: −10, twice in a 節 = 賞典除外) but the race result stands.
const CUT = { window: 2.0, steep: 4.2, steepGap: 2.6 };
function cutAcross(r, q, vy, gap, kind) {
  r.lastCut = { q, t: time, kind };
  if (Math.abs(vy) >= CUT.steep && Math.abs(gap) < CUT.steepGap) {
    const key = r.no * 10 + q.no + 200;
    if ((fleet.cutCool[key] || 0) > time) return;
    fleet.cutCool[key] = time + 3;
    furyo(r, q, `${q.no}号艇の前へ急角度で${kind === '斜行' ? '斜行' : '転舵'}`);
  }
}
function furyo(r, q, why) {
  const key = r.no * 10 + q.no + 300;
  if ((fleet.cutCool[key] || 0) > time) return;
  fleet.cutCool[key] = time + 4;
  if(lab.active)labEvent('foul',r.no,{label:'不良航法',other:q.no});
  r.fouls = (r.fouls || 0) + 1; fleet.cuts++;
  toast('不良航法', `${r.no}号艇 ${why}（減点）`, 'bad');
}
function startFoul(r, kind) {
  r.entryViol = r.entryViol || [];
  if (r.entryViol.includes(kind)) return;
  r.entryViol.push(kind);
  if(lab.active)labEvent('foul',r.no,{label:kind});
  toast('待機行動違反', `${r.no}号艇 ${kind}（減点）`, 'bad');
  if (typeof document !== 'undefined' && document.getElementById('cardBody') && fleet) buildCard();
}
function disqualify(r, why) {
  if (r.dq) return;
  if(lab.active)labEvent('disqualified',r.no,{label:'妨害失格',reason:why});
  r.dq = true; fleet.dqs++;
  toast('妨害失格', `${r.no}号艇（${why}）`, 'bad');
}

function focusRow() {
  if (!fleet) return null;
  return fleet.boats.find(r => r.no === fleet.focus) || fleet.rank[0];
}
function buildOrderStrip() {
  const box = $('order'); box.hidden = false; box.textContent = '';
  for (const r of fleet.boats) {
    const btn = document.createElement('button');
    btn.className = 'chip'; btn.id = 'chip' + r.no; btn.textContent = r.no;
    btn.style.background = r.col[0]; btn.style.color = r.col[1];
    btn.setAttribute('aria-label', `${r.no}号艇を追尾`);
    btn.addEventListener('click', () => { fleet.focus = fleet.focus === r.no ? null : r.no; });
    box.appendChild(btn);
  }
}
function updateOrderStrip() {
  if (!fleet) return;
  fleet.rank.forEach((r, i) => {
    const c = $('chip' + r.no); if (!c) return;
    c.style.order = i;
    c.classList.toggle('on', fleet.focus === r.no);
    c.classList.toggle('f', r.flying);
    c.classList.toggle('dq', !!r.dq && !r.flying);
    c.classList.toggle('top', !!r.prof.top);
    c.classList.toggle('foul', !r.dq && (!!r.fouls || !!(r.entryViol && r.entryViol.length)));
  });
}
function buildCard() {
  const tb = $('cardBody'); tb.textContent = '';
  for (const r of fleet.boats) {
    const tr = document.createElement('tr');
    const dsh = !r.motor ? '—' : r.motor.deashi >= 1.03 ? '◎' : r.motor.deashi >= 0.98 ? '○' : '△';
    const nb = !r.motor || r.motor.nobi == null ? '—' : r.motor.nobi >= 1.015 ? '◎' : r.motor.nobi >= 0.985 ? '○' : '△';
    const mw = !r.motor || r.motor.mawari == null ? '—' : r.motor.mawari >= 1.02 ? '◎' : r.motor.mawari >= 0.98 ? '○' : '△';
    const tl = r.b && r.b.tilt != null ? (r.b.tilt > 0 ? '+' : '') + r.b.tilt.toFixed(1) : '—';
    const cells = [r.no, (r.name ? r.name + ' ' : '') + (r.prof.kinen ? 'A1 ★記念クラス' : r.prof.top ? 'A1 ★トップ' : r.prof.name), (r.trait ? `${r.trait.course}コース` : '未定') + (r.entryViol && r.entryViol.length ? ' ⚠待機行動違反' : ''), r.trait ? (r.trait.kado ? 'カド' : r.trait.slow ? 'スロー' : 'ダッシュ') + (r.trait.okoshi ? ` ${Math.round(r.trait.okoshi)}m` : '') : '—', r.trait ? (r.trait.cpuMode===COURSE_CPU.version?`${COURSE_CPU.courses[r.trait.course].label} → ${TACTIC_JA[r.drv.mem.tacticNow||r.trait.tactic]}`:TACTIC_JA[r.trait.tactic]) : '—', PREF_JA[r.pref], TEMPER[r.temper].ja, dsh, mw, nb, tl];
    cells.forEach((v, i) => {
      const td = document.createElement('td'); td.textContent = v;
      if (i === 0) { td.className = 'no'; td.style.background = r.col[0]; td.style.color = r.col[1]; }
      if (i === 1 && r.prof.top) td.className = 'top';
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
}
$('demoCpuMode').addEventListener('change',e=>{demoCpuMode=e.target.value;if(fleet&&!lab.active)nextRace();});
$('simSpeed').addEventListener('change', e => { simSpeed = +e.target.value; });
$('tiltSel').addEventListener('change', e => { playerTilt = +e.target.value; B.tilt = playerTilt; B.deashi = B.nobi = 1; const pr = playerRow(); if (pr) pr.b.tilt = playerTilt; });
$('sgBtn').addEventListener('click', () => {
  sgMode = !sgMode;
  $('sgBtn').textContent = sgMode ? 'SG：オン' : 'SG：オフ';
  $('sgBtn').setAttribute('aria-pressed', String(sgMode));
  $('sgBtn').classList.toggle('sg', sgMode);
  if (fleet && running && !paused) nextRace();
});
$('entryBtn').addEventListener('click', () => {
  entryMode = !entryMode;
  $('entryBtn').textContent = entryMode ? '進入：ピット離れ' : '進入：固定';
  $('entryBtn').setAttribute('aria-pressed', String(entryMode));
  $('entryBtn').classList.toggle('on', entryMode);
  toast(entryMode ? 'ピット離れモード' : '進入固定', entryMode ? 'ピット離れから進入争い。スタート練習は枠を選んで自分で操作' : '枠なり進入で固定', 'info');
  if (fleet && running && !paused && !fleet.playerNo) nextRace();
});
for (let no = 1; no <= 6; no++) {
  const bt = document.createElement('button');
  bt.textContent = no; bt.style.background = LANE_COL[no - 1][0]; bt.style.color = LANE_COL[no - 1][1];
  bt.setAttribute('aria-label', `${no}号艇で練習`);
  bt.addEventListener('click', () => { $('waku').hidden = true; paused = false; last = performance.now(); initAudio(); startEntry(no, practiceKind); });
  $('wakuBtns').appendChild(bt);
}
$('wakuClose').addEventListener('click', () => { $('waku').hidden = true; paused = false; last = performance.now(); });
$('dashBtn').addEventListener('click', () => playerDash());
$('claimBtn').addEventListener('click', () => playerClaim());
onEntryHandoff = () => { $('clock').hidden = false; buildCard(); };
$('demoBtn').addEventListener('click', () => { initAudio(); if (!running || paused) return;
  if (fleet && fleet.setsu) { if (!fleet.playerNo) setsuSkipWatch(); else { const was = paused; paused = true; askConfirm('このレースを棄権しますか？（欠場扱い・0点）', () => { paused = was; setsuRaceDone(true); }, () => { paused = was; last = performance.now(); }); } return; }
  fleet ? stopFleet() : entryMode ? startEntry(null) : startFleet(); });
$('skipBtn').addEventListener('click', skipRace);
$('resNext').addEventListener('click', resNext);
$('wxMode').value = wxMode;
$('wxMode').addEventListener('change', e => { wxMode = e.target.value; try { localStorage.setItem('honorGP.weather', wxMode); } catch (x) {} });
$('jkMode').value = jkMode;
$('jkMode').addEventListener('change', e => { jkMode = e.target.value; try { localStorage.setItem('honorGP.jikkyo', jkMode); } catch (x) {} if (jkMode === 'off') { jk.q.length = 0; $('jk').hidden = true; } });
// after an accident the order is frozen anyway, so jump straight to the result
function skipRace() {
  if (!fleet || !fleet.locked || fleet.endAt) return;
  for (const r of fleet.lockOrder) if (r.fin == null && !r.dq) { r.fin = time; r.skipped = true; fleet.order.push(r); }
  for (const r of fleet.boats) if (r.fin != null && !r.dq) r.prog = r.relegated ? -2e6 + (1e6 - fleet.order.indexOf(r)) / 1e3 : 1e6 - fleet.order.indexOf(r);
  fleet.rank = fleet.boats.slice().sort((a, b) => b.prog - a.prog);
  fleet.endAt = time + 4;
  if(!lab.active)slitArchive(fleet.slit,fleet.boats,resultLine());
  toast('レース結果', resultLine(), 'good');
}
$('cardBtn').addEventListener('click', () => { if (!fleet) return; paused = true; buildCard(); $('card').hidden = false; });
$('cardClose').addEventListener('click', () => { paused = false; last = performance.now(); $('card').hidden = true; });

/* ---------- recorded slit photographs ---------- */
