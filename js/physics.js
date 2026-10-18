// Honor for GP — ボートの物理・接触・リプレイログ・トースト
function boatPhysics(b, inp, dt) {
  const fx = Math.cos(b.a), fy = Math.sin(b.a), rx = -fy, ry = fx;
  if (b.cap > 0) {
    b.cap -= dt;
    b.v *= Math.exp(-2.5 * dt); b.vl *= Math.exp(-3 * dt); b.yaw *= Math.exp(-4 * dt);
    b.x += (fx * b.v + rx * b.vl) * dt; b.y += (fy * b.v + ry * b.vl) * dt;
    if (b.cap <= 0) { b.v = 0; b.vl = 0; b.yaw = 0; b.porp = 0; }
    wallsFor(b); b.harmony = 0; return null;
  }

  const t = inp.thr, s = inp.steer, r = inp.roll, p = inp.pitch;
  const sgn = Math.abs(s) > 0.08 ? Math.sign(s) : 0;
  const inside = sgn ? clamp(r * sgn) : 0;

  // sitting far back at speed lifts the bow and the hull starts to hop
  // posture (p): + = 伏せる, crouched flat along the deck; − = 体を起こす, sat up.
  // Crouching cuts wind drag (the boat runs on); sitting up adds drag (slows it) but makes a
  // hang-on to the inside bite much harder, which is what a monkey turn is.
  b.porp = Math.max(0, b.porp - dt * 2);
  // チルト+2以上: the bow rides high and hops (ポーポイズ) — now and then on a flat straight, much more in waves, wake and turns
  if ((b.tilt || 0) >= 2 && b.v > 17 && b.cap <= 0) {
    const rate = TILT.hop * ((b.tilt || 0) - 1.5) * clamp((b.v - 17) / 6, 0, 1) * (1 + (waterEnv ? waterEnv.wave / 3 : 0) + (b.wakeBump || 0) * 4) * (Math.abs(b.yaw) > 0.3 ? 3 : 1) * (b.hullRide || 1);
    if (simRandom() < rate * dt) b.porp = Math.min(1, b.porp + 0.35);
  }

  // the engine never stops: lever at zero is idle, and the hull coasts on
  const te = IDLE + (1 - IDLE) * t;
  const up = Math.max(0, -p), down = Math.max(0, p);
  const drag = 0.012 * (1 + 0.25 * up - 0.1 * down);
  const thrustA = te * THRUST * thrustK(b.v) * startK(b.v, b.preStart, b) * motorK(b) * (b.weightK || 1) * (b.thrMul || 1) * (1 - TRAIL.max * (b.trail || 0)) * (b.cav > 0 ? WAKE_CAV.thrust : 1) * raceFadeK(b);
  heatStep(b, t, dt);
  // wind: the air the boat runs through moves with it (追い風) or against it (向かい風)
  const wAlong = waterEnv ? ENV.windAir * (waterEnv.wx * Math.cos(b.a) + waterEnv.wy * Math.sin(b.a)) : 0, vRel = b.v - wAlong;
  const airA = drag * (b.stabilizer ? ENV.stabDrag : 1) * (b.hullDrag || 1) * vRel * Math.abs(vRel) + 0.1 * b.v;
  let acc = thrustA - airA;
  const holdA = b.hold === 'hang' ? 1.5 * b.v : b.hold ? WAIT_DRAG * b.v : 0;
  acc -= holdA;   // 待機: lever shut and sat up — it still drifts on at a slow walk (~7 km/h); hanging bow-off it all but stops
  acc -= b.porp * (1.2 + simRandom() * 2.2);
  // 引き波: rough water from another boat. Riding in it drags; crossing it at an angle
  // (bump) makes the hull slam and hop, costing more speed and grip and knocking it off line.
  const wk = b.inWake || 0, bump = b.wakeBump || 0;
  const wakeA = (wk * (b.wakeLine ? WAKE_LINE.along : 1) * (0.5 + b.v * 0.04) + bump * (0.8 + b.v * 0.07)) * WAKE.drag;
  acc -= wakeA;
  if (bump > 0.05) b.yaw += (simRandom() * 2 - 1) * bump * 6 * WAKE.kick * (0.3 + 0.7 * (b.wakeTurn || 0)) * dt;
  b.cav = Math.max(0, (b.cav || 0) - dt);
  if (b.wakeFresh && bump > WAKE_CAV.bump && (b.wakeTurn || 0) > 0.5 && b.v > 8 && !(b.cav > 0) && simRandom() < WAKE_CAV.rate * bump * dt) b.cav = WAKE_CAV.time;

  // how hard the hull can be pushed sideways before it lets go: body position, then the rider's skill
  // Posture counts for a lot: leaning in bites, sitting up makes the lean bite harder, staying crouched fights it.
  // A full-throttle turn without the body in it (全速ターン) gets pushed wide by the prop; a proper full-throttle
  // monkey (lean in + sit up) holds it in. Easing the lever (落とす) makes the hull settle and bite.
  // 起こして入り、傾けたまま起こしを緩めて、伏せて抜ける: while the body is held firmly to the inside,
  // easing out of the sit-up into a crouch keeps most of the bite (pose) instead of throwing it away
  const ins = Math.max(0, inside), firm = clamp((ins - 0.5) / 0.4, 0, 1);
  const pose = Math.max(up, firm * (TURN.holdPose + TURN.exitPose * down)), downG = down * (1 - TURN.carve * firm);
  const monkey = ins * (0.4 + 0.6 * pose) * (1 - 0.5 * downG);
  let grip = GRIP_BASE * (1 + 0.15 * pose) * (1 + TURN.lean * ins * (1 + TURN.upBoost * pose - TURN.downCut * downG)) * (1 + 0.5 * Math.min(0, inside))
    * (1 - TURN.thrWide * t * (1 - monkey)) * (1 + TURN.dropGrip * (1 - t))
    * (1 - 0.4 * b.porp) * (1 - (0.12 * wk + 0.28 * bump) * WAKE.grip) * (b.gripBoost || 1) * (b.gripSkill || 1) * tiltGrip(b) * (b.hullGrip || 1) * (b.weightGrip || 1) * mawariK(b, MAWARI.grip) * (1 - CHOP.grip * chopNow());
  grip = Math.max(2, grip);

  const sf = clamp(b.v / 5, 0.3, 1);   // even nearly stopped, the hull can be pivoted round slowly
  const turnBase = 1.35 / (1 + b.v / 35);
  let yawT = s * turnBase * sf * (1 + 0.7 * Math.max(0, inside) * (0.6 + 0.5 * pose - 0.4 * downG)) + r * 0.28 * sf;
  // the nose can only come round as fast as the grip allows at this speed: faster means a wider arc
  const yawCap = grip * YAW_OVER / Math.max(4, b.v);
  yawT = clamp(yawT, -yawCap, yawCap);
  b.yaw += (yawT - b.yaw) * (1 - Math.exp(-5 * dt));

  const demand = b.v * Math.abs(b.yaw);
  const excess = demand - grip;
  if (excess > 0 && Math.abs(b.yaw) > 0.05) b.vl += -Math.sign(b.yaw) * excess * 0.9 * dt;
  b.vl *= Math.exp(-dt * 1.6 * grip / GRIP_BASE);

  b.harmony = sgn ? clamp(0.5 * Math.max(0, inside) + 0.3 * pose + 0.2 * t, 0, 1) : 0;
  // sitting up scrubs speed (it's the brake); crouching while firmly leaned in lets the hull run out of the turn
  const turnLoss = 0.9 * (1 - TURN.keep * b.harmony) * Math.max(0.2, 1 + TURN.upBrake * up - TURN.run * firm * down);   // turns bleed speed; a clean monkey turn keeps more of it
  // a slight lean (no rudder) only nudges the heading and costs nothing; turning on the rudder scrubs speed
  const freeYaw = Math.abs(s) < 0.08 ? Math.min(Math.abs(r), STRAIGHT_LEAN.free) * 0.28 * sf : 0;
  const turnA = Math.max(0, Math.abs(b.yaw) - freeYaw) * b.v * turnLoss + Math.abs(b.vl) * 0.7;
  acc -= turnA;
  // an extreme hang-off without turning (or sat bolt upright at speed) drags on a straight
  const leanA = Math.abs(s) < 0.08 && Math.abs(b.yaw) < 0.12 ? STRAIGHT_LEAN.drag * b.v * Math.max(0, Math.abs(r) - STRAIGHT_LEAN.ok) / (1 - STRAIGHT_LEAN.ok) : 0;
  acc -= leanA;
  if (b.dbg) Object.assign(b.dbg, { thrustA, airA, holdA, wakeA, turnA, leanA, acc, startK: startK(b.v, b.preStart, b), motorK: motorK(b) });
  b.v = Math.max(0, b.v + acc * dt);
  b.a += b.yaw * dt;
  // 潮の流れ carries everyone; the wind pushes on the hull too (追い風 runs a boat on past 1M, 横風 sets it sideways)
  b.x += (fx * b.v + rx * b.vl) * dt + (waterEnv ? (waterEnv.cx + ENV.windDrift * waterEnv.wx) * dt : 0);
  b.y += (fy * b.v + ry * b.vl) * dt + (waterEnv ? ENV.windDrift * waterEnv.wy * dt : 0);

  // 安定度 (load): how close the hull is to letting go; 1.0 is the danger line.
  // Below it the boat is safe. Above it every moment carries a chance of going over that grows
  // with how far past the line it is (and how steady the rider is) — crossing it is a gamble.
  const lowLean = Math.max(0, inside) * clamp((8 - b.v) / 5, 0, 1) * Math.min(1, Math.abs(s) * 1.5);
  const turnLoad = demand / (grip * YAW_OVER), slideLoad = Math.abs(b.vl) / 7;
  b.turnLoadV = 0.85 * turnLoad;
  // a clean turn at the grip limit reads ~0.85 (限界ぎりぎり); a slide, wake or low-speed over-lean takes it past the line
  // 無茶: a deep hang-on at full throttle and near top speed, rudder hard over, is past what the hull will take —
  // worse still done crouched. Easing the lever calms everything down.
  const mucha = ins * t * clamp((b.v / 22.8 - 0.7) / 0.3, 0, 1) * clamp(Math.abs(s) * 1.4 - 0.4, 0, 1) * (1 + 1.2 * down);
  const load = (Math.max(0.85 * turnLoad, slideLoad, lowLean * 1.1) + TURN.mucha * mucha) * (1 - TURN.dropCalm * (1 - t)) + WAKE.unsettle * bump + 0.1 * wk;   // a hull bucking on a wave is on the edge
  b.load = (b.load || 0) + (load - (b.load || 0)) * (1 - Math.exp(-dt * 8));
  let ev = null;
  if (b.load > 1 || Math.abs(b.vl) > 11) {
    const haz = Math.abs(b.vl) > 11 ? 1e3 : HAZARD * Math.pow(b.load - 1, 1.5) * (b.hazMul || 1);
    if (simRandom() < haz * dt) {
      ev = 'cap:' + (lowLean * 1.1 >= Math.max(0.85 * turnLoad, slideLoad) ? '速度がないのに内へ倒れ込んだ'
        : inside < -0.2 ? '外へ体重が逃げて振られた'
        : bump > 0.3 ? '引き波に乗り上げてバランスを崩した'
        : down > 0.5 ? '伏せたまま曲がって握りきれなかった'
        : '限界を越えて握りきれなかった');
    }
  }

  // turn marks and booms: a graze barely slows the boat, a square hit costs a lot
  {
    const fx0 = Math.cos(b.a), fy0 = Math.sin(b.a);
    const ax = b.x - fx0 * HULL_AFT, ay = b.y - fy0 * HULL_AFT, bx2 = b.x + fx0 * HULL_FWD, by2 = b.y + fy0 * HULL_FWD;
    for (const ob of OBSTACLES) {
      const [px, py, qx, qy] = closestSegSeg(ax, ay, bx2, by2, ob.x1, ob.y1, ob.x2, ob.y2);
      let nx = px - qx, ny = py - qy, d = Math.hypot(nx, ny);
      const rr = HULL_R + ob.r;
      if (d >= rr) continue;
      if (d < 1e-4) { nx = b.x - qx; ny = b.y - qy; d = Math.hypot(nx, ny) || 1; }
      nx /= d; ny /= d;
      const pen = rr - Math.min(d, rr);
      b.x += nx * pen; b.y += ny * pen;
      const vx = fx0 * b.v - fy0 * b.vl, vy = fy0 * b.v + fx0 * b.vl;
      const vn = -(vx * nx + vy * ny);                      // speed straight into it
      if (vn > 0) {
        const nvx = vx + nx * vn * 1.2, nvy = vy + ny * vn * 1.2;
        const loss = clamp(0.02 + vn * (ob.kind === 'mark' ? 0.05 : 0.07), 0.02, 0.55);
        b.v = Math.max(0, nvx * fx0 + nvy * fy0) * (1 - loss);
        b.vl = (-nvx * fy0 + nvy * fx0) * 0.5;
        if (vn > 2.5 && !(b.buoyCool > 0)) { ev = ev || (ob.kind === 'mark' ? 'buoy' : 'boom'); b.buoyCool = 1; }
      }
    }
  }
  b.buoyCool = Math.max(0, (b.buoyCool || 0) - dt);
  const vBefore = b.v;
  if (wallsFor(b) && vBefore > 5) ev = ev || 'wall';
  if (ev && ev.startsWith('cap:')) b.cap = 2.2;
  return ev;
}

function wallsFor(b) {
  let hit = false;
  if (b.x < COURSE.xMin + 2) { b.x = COURSE.xMin + 2; hit = true; }
  if (b.x > COURSE.xMax - 2) { b.x = COURSE.xMax - 2; hit = true; }
  if (b.y < COURSE.yMin + 2) { b.y = COURSE.yMin + 2; hit = true; }
  if (b.y > COURSE.yMax - 2) { b.y = COURSE.yMax - 2; hit = true; }
  if (hit) { b.v *= 0.5; b.vl = 0; }
  return hit;
}

/* ---------- boat-to-boat contact ----------
   Each hull is a capsule (a 3 m spine with 0.8 m of rounding) so bow, side and stern all hit
   where they look. On touch the hulls are pushed apart and trade an impulse along the contact
   normal; the boat driving harder into the other keeps more of its line, an off-centre hit
   spins the hull, and a big enough shove can put a boat over (the physics capsizes it
   when its sideways speed runs away). Returns one event per new touch. */
const HULL_R = 0.8, HULL_AFT = 1.4, HULL_FWD = 1.6;
function closestSegSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy, rx = ax - cx, ry = ay - cy;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  const c = d1x * rx + d1y * ry, bb = d1x * d2x + d1y * d2y, den = a * e - bb * bb;
  if (e < 1e-9) { const s0 = clamp(-c / a, 0, 1); return [ax + d1x * s0, ay + d1y * s0, cx, cy]; }   // second one is a point
  let s = den > 1e-9 ? clamp((bb * f - c * e) / den, 0, 1) : 0;
  let t = (bb * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
  return [ax + d1x * s, ay + d1y * s, cx + d2x * t, cy + d2y * t];
}
function boatContacts(list) {
  const evs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], c = list[j];
    if ((c.x - a.x) ** 2 + (c.y - a.y) ** 2 > 36) continue;
    const fax = Math.cos(a.a), fay = Math.sin(a.a), fcx = Math.cos(c.a), fcy = Math.sin(c.a);
    const [px, py, qx, qy] = closestSegSeg(a.x - fax * HULL_AFT, a.y - fay * HULL_AFT, a.x + fax * HULL_FWD, a.y + fay * HULL_FWD,
                                           c.x - fcx * HULL_AFT, c.y - fcy * HULL_AFT, c.x + fcx * HULL_FWD, c.y + fcy * HULL_FWD);
    let nx = qx - px, ny = qy - py, d = Math.hypot(nx, ny);
    if (d >= 2 * HULL_R) continue;
    if (d < 1e-4) { nx = c.x - a.x; ny = c.y - a.y; d = Math.hypot(nx, ny) || 1; }
    nx /= d; ny /= d;
    const pen = 2 * HULL_R - Math.min(d, 2 * HULL_R);
    a.x -= nx * pen / 2; a.y -= ny * pen / 2; c.x += nx * pen / 2; c.y += ny * pen / 2;
    // velocities in world space
    const vax = fax * a.v - fay * a.vl, vay = fay * a.v + fax * a.vl;
    const vcx = fcx * c.v - fcy * c.vl, vcy = fcy * c.v + fcx * c.vl;
    const vrel = (vcx - vax) * nx + (vcy - vay) * ny;
    if (vrel >= 0) continue;                       // already moving apart
    const J = -(1 + 0.1) * vrel;                    // total impulse (equal masses)
    // the boat pressing harder into the other takes the smaller share
    const aInto = Math.max(0, vax * nx + vay * ny), cInto = Math.max(0, -(vcx * nx + vcy * ny));
    const wA = clamp(0.5 + 0.35 * (cInto - aInto) / (aInto + cInto + 0.5), 0.2, 0.8);
    const JA = J * wA, JC = J * (1 - wA);
    const nax = vax - nx * JA, nay = vay - ny * JA, ncx = vcx + nx * JC, ncy = vcy + ny * JC;
    // hulls shed most of a sideways shove into the water; only a hard hit sends a boat skating
    a.v = Math.max(0, nax * fax + nay * fay) * 0.985; a.vl = clamp(a.vl + ((-nax * fay + nay * fax) - a.vl) * 0.6, -7, 7);
    c.v = Math.max(0, ncx * fcx + ncy * fcy) * 0.985; c.vl = clamp(c.vl + ((-ncx * fcy + ncy * fcx) - c.vl) * 0.6, -7, 7);
    // an off-centre hit swings the hull
    a.yaw += ((px - a.x) * (-ny * JA) - (py - a.y) * (-nx * JA)) * 0.05;
    c.yaw += ((qx - c.x) * (ny * JC) - (qy - c.y) * (nx * JC)) * 0.05;
    // rear-end: the contact is square on one boat's bow
    let rear = -1;
    if (fax * fcx + fay * fcy > 0.8) {
      if (nx * fax + ny * fay > 0.75) rear = i; else if (-(nx * fcx + ny * fcy) > 0.75) rear = j;
    }
    evs.push({ i, j, J, JA, JC, rear, x: (px + qx) / 2, y: (py + qy) / 2 });
  }
  return evs;
}

// ターンの引き波 is big and lingers; a boat running straight leaves only a low wave
const WAKE_TURN = { straight: 0.4, yawFull: 0.55, lifeK: 1.35 };
const wakeStrength = b => WAKE_TURN.straight + (1 - WAKE_TURN.straight) * clamp(Math.abs(b.yaw || 0) / WAKE_TURN.yawFull, 0, 1);
function boatFx(b, arr, dt) {
  const fx = Math.cos(b.a), fy = Math.sin(b.a), rx = -fy, ry = fx;
  if (b.v > 1.5) {
    b.wakeAcc = (b.wakeAcc || 0) + dt;
    if (b.wakeAcc > 0.04) { b.wakeAcc = 0; arr.push({ x: b.x - fx * 2.1, y: b.y - fy * 2.1, a: b.a, t: time, v: b.v, s: wakeStrength(b) }); }
  }
  while (arr.length && time - arr[0].t > WAKE.life * WAKE_TURN.lifeK + 0.2) arr.shift();
  if ((b.wakeBump || 0) > 0.3 && b.v > 8 && simRandom() < 0.5) {
    const side = simRandom() < 0.5 ? -1 : 1;
    spray.push({ x: b.x + fx * 1.6 + rx * side * 0.7, y: b.y + fy * 1.6 + ry * side * 0.7, vx: rx * side * 3 + fx * 2, vy: ry * side * 3 + fy * 2, t: time, life: 0.45 });
  }
  if (Math.abs(b.vl) > 1.2 || (Math.abs(b.yaw) > 0.5 && b.v > 9)) {
    const out = Math.abs(b.vl) > 0.3 ? Math.sign(b.vl) : -Math.sign(b.yaw);
    for (let i = 0; i < 2; i++) {
      const sp = 3 + simRandom() * 4 + Math.abs(b.vl);
      spray.push({ x: b.x - fx * 1.2 + rx * out * 0.9, y: b.y - fy * 1.2 + ry * out * 0.9,
        vx: rx * out * sp - fx * 2 + (simRandom() - .5) * 2, vy: ry * out * sp - fy * 2 + (simRandom() - .5) * 2, t: time, life: 0.5 + simRandom() * 0.4 });
    }
  }
}

function splash(b) {
  for (let i = 0; i < 26; i++) {
    const a = simRandom() * Math.PI * 2, s = 2 + simRandom() * 6;
    spray.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: time, life: 0.9 + simRandom() * 0.6 });
  }
}

function step(dt) {
  const previous=timingPose(B,time);
  time += dt;
  B.preStart = SS.phase === 'count' ? 1 : (soloKind === 'clock' && lap.n === 0 && B.y > 0 && B.x > -5 ? preStartAfter(boatBow(B).x) : 0);
  // 起こし〜スリット: 舵と体の左右の傾きは固定（真っ直ぐだけ）。通過してから入力を受け付ける
  if (SS.phase === 'count') zigCheck(B, input.steer, null);
  const binp = SS.phase === 'count' ? { thr: input.thr, steer: clamp(input.steer, -PRE_SLIT.steer, PRE_SLIT.steer), roll: 0, pitch: input.pitch } : input;
  if (soloKind === 'clock' && SS.phase === 'count' && !B.logged && !runLog && input.thr >= 0.3) { B.logged = true; runLogBegin(B, '大時計スタート（1艇）', SS.t0 + CLOCK); }
  if (runLog && runLog.b === B && ((B.y < -4 && B.x < MK - 5) || time > SS.t0 + CLOCK + 30)) runLogEnd(`ST ${meas.st == null ? '—' : meas.st < 0 ? 'F' + fmtST(-meas.st) : fmtST(meas.st)} / チルト ${B.tilt}`);
  const ev = boatPhysics(B, binp, dt);
  if (runLog && runLog.b === B) runLogStep(B, binp, SS.t0 + CLOCK, '');
  harmony = B.harmony || 0;
  hitCool = Math.max(0, hitCool - dt);
  if (ev) {
    if (ev.startsWith('cap:')) { splash(B); T.on = false; toast('転覆', ev.slice(4), 'bad'); hapticShot(0.45, 1); sfxCapsize(B.x, B.y); }
    else {
      hapticShot(0.15, 0.7); sfxHit(B.x, B.y, 5);
      if (!hitCool) { toast(ev === 'buoy' ? '接触' : ev === 'boom' ? '消波装置' : '岸壁', ev === 'buoy' ? 'ターンマークに強く当たった' : ev === 'boom' ? 'マーク内側の消波装置に当たった' : 'コースの端にぶつかった', 'bad'); hitCool = 1.5; }
    }
  }
  slitCapture(practiceSlit,time-(SS.t0+CLOCK),[{no:1,b:B,trait:{course:1}}]);
  if (B.cap > 0) return;
  boatFx(B, wake, dt);

  // big-clock start: the line must be crossed 0–1.0 s after the hand hits zero
  const current=timingPose(B,time),crossAt=gateCrossing(START_GATE,previous,current);
  const crossed=crossAt!=null;
  if (SS.phase === 'tenji') {
    if (crossed) {
      SS.phase = 'off'; lap.start = crossAt; lap.n = 0; lap.visR = lap.visL = false;
      meas.on = true; meas.startAt = crossAt; meas.st = null;
      toast('計測開始', 'スリットから2周', 'good'); return;
    }
  }
  if (SS.phase === 'count') {
    if (crossed) { judgeStart(startOffset(crossAt,SS.t0+CLOCK),crossAt); lap.visR = lap.visL = false; return; }
    if (time > SS.t0 + CLOCK + 1) { SS.phase = 'done'; SS.hideAt = time + 2.5; toast('出遅れ', '1秒以内にスタートラインを越えられなかった', 'bad'); }
  }
  if (SS.phase === 'done' && SS.hideAt && time > SS.hideAt) { SS.phase = 'off'; $('clock').hidden = true; }

  measStep(previous,current);
  // laps: cross the line at x=0 on the lower straight after rounding both marks
  if (SS.phase !== 'count' && Math.sign(lap.prevY || B.y) !== Math.sign(B.y) && Math.abs(B.x) < MK - 1) toast('内側航走', 'ターンマークの内側を通過（レースなら6着扱い）', 'bad');
  lap.prevY = B.y;
  if (B.x > MK - 15) lap.visR = true;
  if (B.x < -MK + 15) lap.visL = true;
  if (crossed) {
    if (lap.visR && lap.visL) {
      const lt = crossAt - lap.start;
      lap.best = lap.best == null ? lt : Math.min(lap.best, lt);
      lap.n++;
      if (!T.on) toast(`${lap.n}周`, `ラップ ${fmt(lt)}`, 'info');
      if (meas.on && lap.n >= MEAS_LAPS) measFinish(crossAt - meas.startAt);
    }
    lap.start = crossAt; lap.visR = lap.visL = false;
  }

  // turn grading
  if (!T.on && Math.abs(B.yaw) > 0.55 && B.v > 7) Object.assign(T, { on: true, sum: 0, n: 0, maxVl: 0, minV: B.v, entryV: B.v, quiet: 0 });
  if (T.on) {
    T.sum += harmony * dt; T.n += dt;
    T.maxVl = Math.max(T.maxVl, Math.abs(B.vl)); T.minV = Math.min(T.minV, B.v);
    if (Math.abs(B.yaw) < 0.3) { T.quiet += dt; if (T.quiet > 0.35) gradeTurn(); } else T.quiet = 0;
  }
}

function gradeTurn() {
  T.on = false;
  if (T.n < 0.6) return;
  const avg = T.sum / T.n;
  const detail = `進入 ${kmh(T.entryV)} → 最低 ${kmh(T.minV)} km/h`;
  if (avg >= 0.68 && T.maxVl < 3.5) toast('モンキーターン', detail, 'good');
  else if (avg >= 0.42 && T.maxVl < 5.5) toast('まずまず', detail + '（体を起こして、もっと内へ）', 'warn');
  else toast('流れた', detail + (T.maxVl >= 5 ? '（外へ流された）' : '（体重移動が足りない）'), 'bad');
}

const kmh = v => Math.round(v * 3.6);
const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };

// ---- スタートの「イケるっ」: the rider's feel for the start, coloured by 調子 (仮). It reads "if I hold it wide open from
// here, where do I cross?" — but through its own bias: off form it sees ghosts (早いっ when it was fine), on a high it
// gets cocky (イケるっ when it was early). Once a race, somewhere between 2.8 s and 1 s before the clock hits zero.
const CUTIN = { from: 2.8, to: 1.0, goMax: 0.15, slow: 0.35, slowFor: 380 };
let slowUntil = 0;
function playerForm() {
  if (fleet && fleet.setsu && typeof setsu !== 'undefined' && setsu) { const me = setsuMe(); if (me && me.form != null) return me.form; }
  if (fleet && fleet.form == null) fleet.form = Math.round(clamp(50 + gauss() * 20, 5, 95));
  return fleet ? fleet.form : 50;
}
function cutinCheck() {
  const pr = playerRow();
  if (!fleet || !pr || pr.st != null || fleet.cutinDone || SS.phase !== 'count' || pr.out) return;
  const rem = SS.t0 + CLOCK - time;
  if (fleet.cutinAt == null) fleet.cutinAt = CUTIN.to + Math.random() * (CUTIN.from - CUTIN.to);
  if (rem > fleet.cutinAt) return;
  fleet.cutinDone = true;
  const b = pr.b; if (Math.cos(b.a) < 0.9) return;   // not squared up to the line yet
  const pred = timeToLine(Math.max(0, -boatBow(b).x), b.v, 1, true, b) - rem;
  const form = playerForm();
  const bias = form < 50 ? -(50 - form) * 0.0012 : form > 85 ? (form - 85) * 0.003 : 0;   // 弱気 sees it early, 浮つき sees it safe
  const n = gauss() * (0.015 + (100 - form) * 0.0004);
  // 弱気 only ever reads it earlier than it is (ghost 早いっ); 浮つき only reads it safer (false イケるっ)
  const kind = pred + Math.min(0, bias) + n < 0 ? 'early' : pred + Math.max(0, bias) + n <= CUTIN.goMax ? 'go' : null;
  if (!kind || Math.random() > 0.35 + form * 0.005) return;
  fleet.cutin = { kind, pred, form };
  const el = $('cutin'); $('cutinTxt').textContent = kind === 'go' ? 'イケるっ！' : '早いっ！';
  el.classList.toggle('early', kind === 'early'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  slowUntil = performance.now() + CUTIN.slowFor;
  try { navigator.vibrate && navigator.vibrate(kind === 'go' ? 40 : [30, 40, 30]); } catch (e) {}
}
// after the slit: was the feel right?
function cutinNote(st) {
  const c = fleet && fleet.cutin; if (!c) return '';
  if (c.kind === 'go') return st < 0 ? '　「イケるっ」…感覚に騙された' : '　「イケるっ」の通り';
  return c.pred >= 0 ? `　「早いっ」…握っていれば ST ${fmtST(c.pred)} だった` : '　「早いっ」で正解';
}
/* ---- リプレイログ (検証用): every race is recorded quietly (4 times a second: each boat's position, heading, speed,
   inputs and what its CPU is up to, plus every message). After the race you choose whether to keep it; kept logs are
   shown as text to copy and paste. ---- */
const RP = { every: 0.25, keep: 6, key: 'hfgp-replays' };
let rpLast = null, rpIdx = 0, rpWasPaused = false, rpFromMenu = false;
const rpN = (v, d = 1) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d).replace(/\.0+$/, '').replace(/^-0$/, '0');
function rpBegin(f, zero) {
  const e = waterEnv, st = f.setsu && f.setsu.race;
  const head = [`#HFGP-REPLAY v1 ${'d127'} ${new Date().toISOString()}`,
    `#mode ${lab.active ? 'lab' : st ? `setsu day${st.day} ${st.R}R ${st.kind}` : f.playerNo ? `race player=${f.playerNo}` : 'demo'} entry=${f.entry ? 'pit' : 'fixed'}`,
    `#env ${e ? `${windJa(e)} wave=${e.wave}cm cx=${rpN(e.cx, 2)} stab=${e.stabilizer ? 1 : 0}${e.temp != null ? ` temp=${e.temp}` : ''}${e.tideJa ? ` tide=${e.tideJa}${e.tideLv}` : ''}` : 'calm'}`,
    '#boat no cls name temper pref motor(deashi/mid/nobi/power) hull(grip/ride/drag) weightK tilt skill(start/turn/judge) courseAff'];
  for (const r of f.boats) { const b = r.b, k = r.skill;
    head.push(`B ${r.no} ${r.prof.top ? 'TOP' : r.prof.name} ${(r.name || '-').replace(/\s+/g, '')} ${r.temper} ${r.pref} ${rpN(b.deashi, 3)}/${rpN(b.mMid, 3)}/${rpN(b.nobi, 3)}/${rpN(b.powerK || 1, 3)} ${rpN(b.hullGrip || 1, 3)}/${rpN(b.hullRide || 1, 2)}/${rpN(b.hullDrag || 1, 3)} ${rpN(b.weightK || 1, 3)} ${rpN(b.tilt, 1)} ${k ? `${Math.round(k.start)}/${Math.round(k.turn)}/${Math.round(k.judge)} ${k.course.join(',')}` : '-'}${r.player ? ' PLAYER' : ''}`); }
  head.push('#S t | no x y heading(deg) v(km/h) thr steer roll pitch flags…  (t = s from the start signal; flags: role=m mark/s sashi/o out/w wide/W wait, sty, C 叩き F 連動 K 壁 Q 絞り R 抵抗 Y 引く P 勝負 A 回避 cap 転覆 out dq Fly relegated fin)');
  f.rp = { head, rows: [], ev: [], next: -999, zero };
}
function rpSample(f, zero) {
  if (lab.active) return;
  if (!f.rp) rpBegin(f, zero);
  const rp = f.rp; if (time < rp.next) return; rp.next = time + (time - zero < -15 ? 1 : RP.every);   // the long wait in the pits: once a second
  const t = time - zero, parts = [`S ${rpN(t, 2)}`];
  for (const r of f.boats) { const b = r.b, m = r.drv && r.drv.mem || {}, i = r.player ? input : r.inp || {};
    const fl = [];
    if (m.turnRole) fl.push('role=' + ({ mark: 'm', sashi: 's', out: 'o', wide: 'w', wait: 'W', waitIn: 'Wi' }[m.turnRole.role] || m.turnRole.role));
    if (m.turnStyle) fl.push('sty=' + m.turnStyle);
    if (m.commit) fl.push('C'); if (m.follow) fl.push('F'); if (m.kabe) fl.push('K'); if (m.squeeze) fl.push('Q'); if (m.sqResp === 'resist') fl.push('R'); if (m.sqResp === 'yield') fl.push('Y'); if (m.push) fl.push('P');
    if (m.av && (m.av.priority || Math.abs(m.av.steerAdd || 0) > 0.05 || (m.av.thrMul ?? 1) < 0.95)) fl.push('A');
    if (b.cap > 0) fl.push('cap'); if (r.out) fl.push('out'); if (r.dq) fl.push('dq'); if (r.flying) fl.push('Fly'); if (r.relegated) fl.push('relegated'); if (r.fin != null) fl.push('fin');
    parts.push(`${r.no} ${rpN(b.x)} ${rpN(b.y)} ${Math.round(((b.a * 180 / Math.PI) % 360 + 540) % 360 - 180)} ${Math.round(b.v * 3.6)} ${rpN(i.thr, 2)} ${rpN(i.steer, 2)} ${rpN(i.roll, 2)} ${rpN(i.pitch, 2)}${fl.length ? ' ' + fl.join(' ') : ''}`); }
  rp.rows.push(parts.join(' | '));
}
function rpFinish(f) {
  if (!f || !f.rp || f.rp.done) return;
  const rp = f.rp; rp.done = true;
  const res = ['#result ' + (typeof resultLine === 'function' ? resultLine() : '')];
  for (const r of f.boats) res.push(`R ${r.no} course=${r.trait ? r.trait.course : '-'}${r.trait && r.trait.slow ? ' slow' : ' dash'} ST=${r.st == null ? '-' : rpN(r.st, 2)} fin=${r.fin != null ? rpN(r.fin - rp.zero, 2) : '-'}${r.relegated ? ' relegated' : ''}${r.out ? ' ' + r.out : ''}${r.dq ? ' dq' : ''}${r.flying ? ' F' : ''}`);
  const text = [...rp.head, ...rp.rows, '#events (t, message)', ...rp.ev, ...res].join('\n');
  const st = f.setsu && f.setsu.race;
  rpLast = { at: Date.now(), title: `${st ? `節間 ${SETSU.dayJa[setsu ? setsu.day : 0] || ''} ${st.R}R ${st.kind}` : f.playerNo ? 'レース練習' : 'デモ'}　${resultLine()}`, text };
  if (typeof document !== 'undefined' && $('rpChip')) { $('rpChip').hidden = false; clearTimeout(rpFinish.t); rpFinish.t = setTimeout(() => { $('rpChip').hidden = true; }, 25000); }
}
const rpLoad = () => { try { return JSON.parse(localStorage.getItem(RP.key) || '[]'); } catch (e) { return []; } };
function rpStore(entry) { const all = rpLoad(); all.unshift(entry); while (all.length > RP.keep) all.pop(); for (;;) { try { localStorage.setItem(RP.key, JSON.stringify(all)); break; } catch (e) { if (all.length <= 1) break; all.pop(); } } return all; }
function rpOpen(i = 0) {
  const all = rpLoad(); rpIdx = clamp(i, 0, Math.max(0, all.length - 1));
  paused = true; $('rpBox').hidden = false;
  const e = all[rpIdx];
  $('rpInfo').textContent = e ? `${rpIdx + 1}/${all.length}　${new Date(e.at).toLocaleString('ja-JP')}　${e.title}　（${Math.round(e.text.length / 1024)}KB）` : '保存したログはまだありません。レースが終わったら画面下の「残す」で保存できます。';
  $('rpText').value = e ? e.text : '';
  $('rpOlder').disabled = !e || rpIdx >= all.length - 1; $('rpNewer').disabled = !e || rpIdx <= 0; $('rpDel').disabled = !e;
}
function rpCloseBox() { $('rpBox').hidden = true; if (rpFromMenu) { rpFromMenu = false; $('pmenu').hidden = false; return; } paused = rpWasPaused; last = performance.now(); if (orient.full && !document.fullscreenElement) lockLandscape(); }
async function rpCopy() {
  const ta = $('rpText'), txt = ta.value; if (!txt) return;
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {}
  if (!ok) { try { ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); ok = document.execCommand('copy'); } catch (e) {} }
  toast('リプレイログ', ok ? 'コピーしました' : 'コピーできませんでした。テキストを長押しして全選択→コピーしてください', ok ? 'good' : 'warn');
}
if (typeof document !== 'undefined' && document.getElementById('rpBox')) {
  $('rpKeep').addEventListener('click', () => { $('rpChip').hidden = true; if (!rpLast) return; rpStore(rpLast); rpWasPaused = paused; rpOpen(0); });
  $('rpSkip').addEventListener('click', () => { $('rpChip').hidden = true; });
  $('rpCopy').addEventListener('click', rpCopy);
  $('rpOlder').addEventListener('click', () => rpOpen(rpIdx + 1));
  $('rpNewer').addEventListener('click', () => rpOpen(rpIdx - 1));
  $('rpDel').addEventListener('click', () => { const all = rpLoad(); all.splice(rpIdx, 1); try { localStorage.setItem(RP.key, JSON.stringify(all)); } catch (e) {} rpOpen(Math.min(rpIdx, all.length - 1)); });
  $('rpClose').addEventListener('click', rpCloseBox);
}
function toast(big, small, kind) {
  if (typeof fleet !== 'undefined' && fleet && fleet.rp && !fleet.rp.done) fleet.rp.ev.push(`${rpN(time - fleet.rp.zero, 2)} ${big} ${small}`);
  const el = $('toast');
  $('tBig').textContent = big; $('tSmall').textContent = small;
  el.dataset.kind = kind;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

