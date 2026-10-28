// Honor for GP — ボートの物理（グリップ・旋回・引き波・推力・モーター・水面・熱ダレ）・接触・リプレイログ・トースト
// ---- 物理の数値（レースの挙動を調整するときはこのファイルと race.js だけを触る）
const GRIP_BASE = 5;           // sideways grip; with the turn-rate cap this sets how wide a turn swings at speed (d148–d151 tried 4 and 3.6 for wider turns; d152 back to 5 with the duller exits)
const HAZARD = 0.2;
const WAIT_DRAG = 0.1;   // extra drag sat up with the lever shut while waiting
// 接触による転覆: impulse threshold (j0, never below jMin), how much an unsettled hull lowers it, the impulse range to
// the full chance, how much instability raises it, and the share of that chance the boat that did the hitting faces
// hitter: the boat that hit carries this share of the risk; at heavyJ and above it is as likely to go as the one it hit (d168, まえ: 多重事故は起きる)
const CAPSIZE = { j0: 7.6, jMin: 2.6, unstJ: 3.5, span: 10, unstP: 2, hitter: 0.3, heavyJ: 8, both: true };
// turning: how much leaning in adds grip, how much sitting up amplifies that and staying crouched spoils it,
// how far full throttle pushes a turn wide without the body in it, how much easing the lever settles the hull,
// and how much a flat-out, full-lock, deep hang-on at top speed (無茶) adds to the load
const TURN = { lean: 0.9, upBoost: 0.75, downCut: 0.6, thrWide: 0.15, dropGrip: 0.2, dropCalm: 0.3, mucha: 0.5,
  holdPose: 0.5, exitPose: 0.3, carve: 0.8, upBrake: 0.35, run: 0.7, keep: 0.7,
  crouchLoad: 0.5, crouchWide: 0.25 };   // d137 伏せたまま回る (crouched, leaned firmly in, rudder at full lock): it keeps the speed but the hull is on the edge and the arc swings wide   // carving out: a firm inside lean keeps the bite while easing up into a crouch; a clean turn scrubs less speed
// 引き波: a boat's wake is a thick, lasting wave — width either side of each wave line (m), how long it
// stays rough (s), and how hard crossing it hits speed, heading and grip (1 = the old strength)
// 引き波よけ: lateral offsets (m, + = to my right) a CPU considers to find calm water — wide enough to step out of a pack's wake band
const WAKE_PLAN = { offs: [-4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6], freeAt: 55, nudge: 1.5 };   // freeAt: m before a mark where line changes are free again
const WAKE = { width: 1.4, life: 2.4, drag: 1.8, kick: 1.9, grip: 1.6, unsettle: 0.55, fade: 2.5 };   // fade: how fast a wake dies with age (d118 0.7). Fresh wake hits as hard as ever; an old one fades fast
// 航跡: running in line behind a boat (not crossing its wake) takes the edge off thrust — the closer, the more
const TRAIL = { range: 60, width: 2.5, max: 0.1, dodgeK: 2.5 };          // chance per second of going over, scaled by (load − 1)^1.5 past the danger line
// 直線: lean up to `free` steers the hull a touch at no cost; past `ok` the posture itself drags (per m/s of speed)
const STRAIGHT_LEAN = { free: 0.35, ok: 0.5, drag: 0.035 };
// CPU on a straight (next mark more than `from` m ahead): rudder held within ±steer, the rest of the wanted turn goes to the lean
const STRAIGHT_RUN = { from: 55, steer: 0.06, leanK: 1.5, crouch: 1 };   // crouch: on a clean straight every rider lies flat — the speed is the motor's
const YAW_OVER = 1.15;       // how far past the grip limit the nose may be forced round (the excess slides)       // sideways grip before a slide; lower = turns swing wider at speed
const THRUST = 7.785;         // full-lever push: top speed 81.0 km/h crouched (average motor, tilt 0, calm, no fade; d148), idle ≈ 16 km/h
// 推進の乗り (d151, まえ): the push is best crouched and running straight. With the rudder over, sat up, or leaned
// (past a small trim) the boat picks up speed more slowly — this is what dulls the exit of a turn (the net gain is scaled, so a turn's own speed is kept).
const DRIVE = { steer: 0.3, up: 0.2, lean: 0.2, leanFree: 0.1 };
const driveK = (s, r, up) => (1 - DRIVE.steer * Math.abs(s)) * (1 - DRIVE.up * up) * (1 - DRIVE.lean * Math.max(0, Math.abs(r) - DRIVE.leanFree));
// 行き足 (d151): once racing, the climb from a turn's exit speed up to the top end is slower (the net gain is scaled, so the
// top speed and the speed a turn holds are untouched). The start keeps its own pull (START_ACC), so this fades in after the slit.
const GAIN = { k: 0.5 };
const gainK = (v, pre) => 1 - GAIN.k * clamp(1 - v / PLANE.v, 0, 1) * (1 - (+pre || 0));
// 立ち上がり: the hull drives hard only once it's up on the plane; below that the same lever pulls less
const PLANE = { low: 0.4, v: 23 };
const thrustK = v => 1 - PLANE.low * clamp(1 - v / PLANE.v, 0, 1);
// スタート（起こし→スリット）だけは加速が鈍い: 助走100mでスリット時に全速の85%前後、200mで95%前後。
// 周回中のターン立ち上がりには掛からない（preStart は大時計の針が回っている間、スタートラインを越えるまで）
const START_ACC = { cut: 0.5, v: 22.5, fade: 40, slowK: 1.19, slowFade: 51 };   // slowK: the スロー start's short run-up digs in harder (it reaches the slit slower and is still climbing)   // fade: m past the slit over which the start's dull pull wears off (the dash boats' 伸び tells there)
// 向かい風 holds the スロー's short run-up back (the dash gets its chance); 追い風 helps it along
const startWindK = b => b && b.slowStart && waterEnv ? 1 + clamp(-waterEnv.wx, 0, 8) * 0.03 - clamp(waterEnv.wx, 0, 8) * 0.015 : 1;
const startK = (v, pre, b) => pre ? 1 - Math.min(0.9, START_ACC.cut * (b && b.slowStart ? START_ACC.slowK : 1) * startWindK(b)) * (+pre) * clamp(1 - v / START_ACC.v, 0, 1) : 1;
// after the slit the slow boats are still climbing: the dull pull fades out over the first fade m of the straight
const preStartAfter = (bowX, slow) => clamp(1 - bowX / (slow ? START_ACC.slowFade : START_ACC.fade), 0, 1);
// モーター・ペラ・チルト: 出足 (deashi) shapes the pull at low speed, 伸び (nobi) the top end. Tilt up (+) buys 伸び and
// costs 出足 and grip in the turns; tilt down (−0.5) the other way round.
// 周回ごとの失速: the leader slows a little every lap even when alone.
// 水面の荒れ (CHOP): every boat's wash and prop froth stays in the small pool and bounces off the walls, so the
//   whole water gets choppier as the race goes on — the prop bites a little less and the hull grips a little less.
// 熱ダレ (HEAT): flat out the motor heats up and loses a touch of power; easing the lever lets it cool a bit.
const CHOP = { full: 110, pow: 1.5, thr: 0.05, grip: 0.03 };   // pow > 1: the first lap's water is still clean, it builds up later
const HEAT = { T: 90, cool: 0.4, thr: 0.045 };
// d161 (まえ): the lap-by-lap fade is the race's — 6 boats churning the pool, a motor worked hard (整備 covers it).
// タイムアタック alone on the water keeps only a trace of it
const FADE = { ta: 0.2, test: false };   // test: apply the solo fade to a fleet (CPU 単独 time checks)
const fadeScale = () => fleet && !FADE.test ? 1 : FADE.ta;
// タイムアタック (1艇) fades on its own clock, from the hand hitting zero
const raceElapsed = () => fleet ? (fleet.raceOn && time > fleet.raceStart ? time - fleet.raceStart : 0)
  : soloKind === 'ta' && typeof ta !== 'undefined' && ta.on && time > ta.zero ? time - ta.zero : 0;   // only once the race is off (not in the 待機行動)
const chopNow = () => Math.pow(clamp(raceElapsed() / CHOP.full, 0, 1), CHOP.pow) * fadeScale();
function heatStep(b, thr, dt) { if (!raceElapsed()) { b.heat = 0; return; } b.heat = clamp((b.heat || 0) + (thr - HEAT.cool) * dt / HEAT.T, 0, 1); }
const raceFadeK = b => (1 - CHOP.thr * chopNow()) * (1 - HEAT.thr * fadeScale() * (b.heat || 0));
// 回り足 (quick races): extra pull and bite while the boat is turning; 1 = average motor
const MAWARI = { yaw: 0.35, thr: 2.5, grip: 1.2 };
const mawariK = (b, k) => b && b.mawari ? 1 + (b.mawari - 1) * k * clamp(Math.abs(b.yaw) / MAWARI.yaw, 0, 1) : 1;
const TILT = { hop: 0.25, nobi: 0.006, deashi: 0.01, grip: 0.035, steps: [-0.5, 0, 0.5, 1, 1.5, 2, 3] };
function motorK(b, v = b.v) {
  if (!b || b.nobi == null) return 1;
  const t = b.tilt || 0;
  if (b.mMid == null) { const w = clamp((v - 14) / 8, 0, 1); return ((b.deashi - TILT.deashi * t) * (1 - w) + (b.nobi + TILT.nobi * t) * w) * (b.powerK || 1) * mawariK(b, MAWARI.thr); }
  // 3つの速度域: 出足 (low), 回り足・行き足 (mid), 伸び (top), blended by speed; temperature hits the low end harder
  const wTop = clamp((v - 16) / 6, 0, 1), wLow = clamp((13 - v) / 6, 0, 1), wMid = Math.max(0, 1 - wTop - wLow);
  const lo = b.deashi - TILT.deashi * t + (b.tempLow || 0), top = b.nobi + TILT.nobi * t + (b.tempTop || 0), mid = b.mMid + (b.tempLow || 0) * 0.5 + (b.tempTop || 0) * 0.5;
  return (lo * wLow + mid * wMid + top * wTop) * (b.powerK || 1);
}
// その日の水面 (節間): wind (m/s, a vector: +x = blowing from 2M toward 1M = 追い風 on the home straight), tide current, wave height (cm)
let waterEnv = null;
// the chop runs with the wind: punching into it (向かい) slams the hull, running with it (追い波) is far smoother
const waveHeadK = a => { if (!waterEnv) return 1; const w = Math.hypot(waterEnv.wx, waterEnv.wy); if (w < 0.3) return 0.65; const c = (waterEnv.wx * Math.cos(a) + waterEnv.wy * Math.sin(a)) / w; return 0.65 - 0.35 * c; };
const ENV = { windDrift: 0.035, windAir: 0.025, waveBump: 0.012, waveStab: 6, stabDrag: 1.08, stabBump: 0.6, boatMass: 110 };
/* バウンド (d155, まえ): crossing a wake or a wave crest at speed throws the hull up. In the air the prop is out of the
   water (thrust gone, worse when crouched — the bow goes down and the stern comes up) and the hull barely bites.
   Landing crouched (前荷重) digs the bow in — 刺さり: speed lost, the hull bucks (load) and a big one can put it over —
   and it springs straight back up again. Sat back with the knees taking it, it lands flat and settles. A lever eased
   off, the tilt down and the 安定板 all keep it lower. h = hop in m, hv = its vertical speed. */
const BOUNCE = { on: true, g: 15.7, h: 0.3, rise: 0.025, bumpMin: 0.04, bumpFull: 0.15, hMax: 0.5, gap: 0.12, down: 0.6, up: 0.45, lever: 0.65, stab: 0.6, tilt: 0.12,
  airThr: 0.6, airDown: 0.4, airGrip: 0.35, stuck: 0.12, stuckFrom: 0.3, stuckLoad: 0.7, reb: 0.3, rebDown: 0.9, rebUp: 0.7, rebMin: 1.2, hRef: 0.25, stuckStraight: 0.1,
  porp: 0.12 };   // d181 (まえ): a porpoise (tilt / bow held high) is a small hop, not a wake jump — before, one on a flat straight threw the hull 47 cm
function bounceStep(b, t, down, up, dt) {
  const bump = Math.max((b.wakeBump || 0) * (1 - (1 - WILLIE.wake) * (b.wil || 0)), (b.porp || 0) * BOUNCE.porp);
  if (b.hv == null) { b.hop = 0; b.hv = 0; b.bumpRef = bump; b.landAge = 9; b.landV = 0; b.stuckAge = 9; }
  b.landAge += dt; b.stuckAge += dt;
  b.bumpRef += (bump - b.bumpRef) * (1 - Math.exp(-dt * 4));
  if (!BOUNCE.on) return;
  const rise = bump - b.bumpRef;
  if (rise > BOUNCE.rise && bump > BOUNCE.bumpMin && b.hop < 0.02 && b.landAge > BOUNCE.gap && b.v > 8) {
    const H = Math.min(BOUNCE.hMax, BOUNCE.h * clamp(bump / BOUNCE.bumpFull, 0, 1.5) * clamp((b.v - 8) / 14, 0, 1.2) * Math.max(0.2, 1 + BOUNCE.down * down - BOUNCE.up * up)
      * (1 - BOUNCE.lever * (1 - t)) * (b.stabilizer ? BOUNCE.stab : 1) * (1 + BOUNCE.tilt * (b.tilt || 0)) * (1 + TRIM.bounce * (b.trimPop || 0)));
    b.hv = Math.max(b.hv, Math.sqrt(2 * BOUNCE.g * H)); b.bumpRef = bump;
  }
  if (b.hop <= 0 && b.hv <= 0) return;
  b.hv -= BOUNCE.g * dt; b.hop += b.hv * dt;
  if (b.hop > 0) return;
  // landing
  const vi = -b.hv, sev = vi / Math.sqrt(2 * BOUNCE.g * BOUNCE.hRef);
  b.hop = 0; b.landAge = 0; b.landV = vi;
  const dig = clamp((down - BOUNCE.stuckFrom) / (1 - BOUNCE.stuckFrom), 0, 1);
  if (dig > 0 && sev > 0.3) {   // 刺さり — d172 (まえ): on a straight it is a jolt, not a brake (stuckStraight of the turn's loss)
    const tk = BOUNCE.stuckStraight + (1 - BOUNCE.stuckStraight) * (b.wakeTurn ?? 1);
    b.v *= 1 - BOUNCE.stuck * sev * dig * tk;
    b.load = (b.load || 0) + BOUNCE.stuckLoad * sev * dig * dig; b.stuckAge = 0;
  }
  b.hv = vi > BOUNCE.rebMin ? vi * BOUNCE.reb * Math.max(0.1, 1 + BOUNCE.rebDown * down - BOUNCE.rebUp * up) * (0.5 + 0.5 * t) : 0;
}
/* ウィリーターン (d156, まえ): in a turn, weight thrown back twice — タタン — with the lever squeezed in at the same moment
   lifts the bow and the hull runs on its tail: far less of it in the water, so the turn bleeds much less speed, it drives
   out harder, and a wake under it barely touches it. It only comes up with a strong low end (出足) and a prop that is
   biting (回り足, not in the air, not cavitating, not on a wake). Held sat back with the lever in; crouch or let the lever
   go and the bow comes down (crouched = 刺さり). A failed try just scrubs speed — or, off balance, puts it over.
   b.wil: 0..1 how far up the bow is; b.wilT: time in it. */
const WILLIE = { on: true, vMin: 11, steerMin: 0.3, yawMin: 0.2, dGood: 1.03, mGood: 1.02, p0: 0.3, pMax: 0.95,
  rise: 6, maxT: 3.0, holdP: -0.15, holdThr: 0.75, exitSteer: 0.15,
  loss: 0.7, wake: 0.3, drive: 0.5, grip: 1.15, bite: 0.85, load: 0.22, failV: 0.1, failLoad: 0.45, failDownLoad: 0.6, endHop: 0.12 };
// d160 (まえ): 出足・回り足とも ○ 以上 (above an average motor) is the minimum — an average motor (タイムアタック) never
// gets the bow up; the better both are, the surer it is, ◎ and ◎ (出足 1.03・回り足 1.02) almost always
const willieFeet = b => ({ d: (b.deashi ?? 1) - TILT.deashi * (b.tilt || 0), m: b.mMid ?? (b.mawari || 1) });
const willieOdds = b => {
  const f = willieFeet(b);
  if (!(f.d > 1 && f.m > 1)) return 0;
  const k = Math.min((f.d - 1) / (WILLIE.dGood - 1), (f.m - 1) / (WILLIE.mGood - 1));
  return clamp(WILLIE.p0 + (WILLIE.pMax - WILLIE.p0) * k, 0, WILLIE.pMax);
};
/* 後ろ重心・前重心 (d173, まえ): the rider's weight fore and aft sets the hull's trim. Crouched forward the bow sits down
   (least wind, the top speed — the existing 伏せ); sat back it rides a little higher. Thrown back hard (input.trimSnap)
   at the exit of a turn, the bow pops up: the stern and prop dig in and bite (the push comes on harder for a moment) while
   less hull is in the water (less bite sideways — done mid-turn it runs wide). It pays only when the rider gets back down
   after it: held up, the wind on the body eats it. Real boats: bow up = less wetted hull, prop deeper; too high = porpoise.
   Getting going from near stopped (起こし) the bow is better down, so the pop does nothing below vLo.
   b.trim: −0.3..1.2 (1 ≈ bow 8° up) = trimBase (the posture, looks only) + trimPop (the throw-back), b.kick: s of the pop's push left. ウィリー is the extreme of this. */
const TRIM = { up: 0.35, down: 0.15, vRef: 12, rate: 4, k: 40, c: 9, snap: 9, cool: 2.0, kick: 0.6, kickT: 0.7, vLo: 7, vFull: 11, vTop: 18, vOff: 21.5, grip: 0.25, turnYaw: 0.3, exitT: 1.5, exitFade: 1.0,
  // d174 リスク (まえ): thrown up too early (still turning hard) or while the hull is skating, the prop comes out and spins (キャビ) instead of
  // biting; the pop always unsettles the hull a little (load), much more on a wake, sliding, or banked deep — enough to put it over;
  // a bow up meets a wake and gets thrown higher; held up at speed it starts to porpoise
  misYaw: 0.35, misSpan: 0.4, slip0: 0.25, slipSpan: 0.25, cavT: 0.5, risk0: 0.15, riskMis: 0.6, riskWake: 0.8, wakeRef: 0.3, riskBank: 0.4, bank0: 0.3, bankSpan: 0.2, load: 3.0, bounce: 1.0, porpTrim: 0.5, porpV: 19, porpRate: 1.5 };
function trimStep(b, inp, t, down, up, dt) {
  const trimT = (TRIM.up * up - TRIM.down * down) * clamp(b.v / TRIM.vRef, 0, 1);
  if (b.trimBase == null) { b.trimBase = trimT; b.trimPop = 0; b.trimV = 0; b.kick = 0; b.snapAt = -9; b.turnAt = -99; }
  b.kick = Math.max(0, b.kick - dt);
  if (Math.abs(b.yaw || 0) > TRIM.turnYaw) b.turnAt = time;
  if (inp.trimSnap) {
    inp.trimSnap = false;
    if (b.cap <= 0 && !(b.hop > 0.02) && !(b.wilT > 0) && time - b.snapAt > TRIM.cool && b.v > TRIM.vLo) {
      // the push only comes at a turn's exit (the hull still rolled, the prop slipping); on a straight the prop already bites
      const exit = clamp(1 - (time - (b.turnAt ?? -99) - TRIM.exitT) / TRIM.exitFade, 0, 1);
      const mis = Math.max(clamp((Math.abs(b.yaw || 0) - TRIM.misYaw) / TRIM.misSpan, 0, 1), clamp((Math.abs(b.slip || 0) - TRIM.slip0) / TRIM.slipSpan, 0, 1));
      const wk = clamp((b.wakeBump || 0) / TRIM.wakeRef, 0, 1), bk = clamp((Math.abs(b.bank || 0) - TRIM.bank0) / TRIM.bankSpan, 0, 1);
      b.snapAt = time; b.trimV += TRIM.snap * (0.4 + 0.6 * t); b.kick = TRIM.kickT * exit * (1 - mis); b.kickK = exit * (1 - mis); b.snapEv = true;
      if (mis > 0.3) b.cav = Math.max(b.cav || 0, TRIM.cavT * mis);   // too soon / skating: the prop lets go
      b.trimRisk = TRIM.risk0 + TRIM.riskMis * mis + TRIM.riskWake * wk + TRIM.riskBank * bk; b.trimMis = mis;
    }
  }
  b.trimBase += (trimT - b.trimBase) * (1 - Math.exp(-TRIM.rate * dt));   // the posture's own trim: looks only
  // the pop: a damped spring that only a throw-back sets going (sat back it settles higher, crouched it drops straight back)
  b.trimV += (-TRIM.k * (1 + 1.5 * down) * b.trimPop - TRIM.c * b.trimV) * dt;
  b.trimPop = Math.max(0, b.trimPop + b.trimV * dt); if (b.trimPop <= 0 && b.trimV < 0) b.trimV = 0;
  b.trim = clamp(b.trimBase + b.trimPop, -0.3, 1.2);
  if (b.trim > TRIM.porpTrim && b.v > TRIM.porpV && b.cap <= 0 && simRandom() < TRIM.porpRate * (b.trim - TRIM.porpTrim) * dt) b.porp = Math.min(1, (b.porp || 0) + 0.35);   // bow held high at speed: it porpoises
}
// the pop's extra push: strongest at a turn's exit speed, nothing near the top end (the prop is already biting) or near stopped
const trimKickK = (b, t) => b.kick > 0 && !(b.hop > 0.02) ? TRIM.kick * (b.kick / TRIM.kickT) * t * clamp((b.v - TRIM.vLo) / (TRIM.vFull - TRIM.vLo), 0, 1) * clamp((TRIM.vOff - b.v) / (TRIM.vOff - TRIM.vTop), 0, 1) : 0;
function willieStep(b, inp, t, s, down, up, dt) {
  if (inp.willie) {
    inp.willie = false;
    if (WILLIE.on && !(b.wilT > 0) && b.cap <= 0) {
      const inTurn = Math.abs(s) > WILLIE.steerMin && Math.abs(b.yaw) > WILLIE.yawMin && b.v > WILLIE.vMin;
      const biting = !(b.hop > 0.02) && !(b.cav > 0) && (b.wakeBump || 0) < 0.25;
      const ok = inTurn && biting && t > 0.9 && simRandom() < willieOdds(b);
      b.wilTry = (b.wilTry || 0) + 1;
      if (ok) { b.wilT = 1e-3; b.wilOk = (b.wilOk || 0) + 1; b.wilEv = 'ok'; b.trimPop = 0; b.trimV = 0; b.kick = 0; }   // the ウィリー takes over from the first tap's pop
      else {   // 失敗: the bow will not come up; the hull scrubs and bucks
        b.v *= 1 - WILLIE.failV; b.load = (b.load || 0) + WILLIE.failLoad + WILLIE.failDownLoad * down; b.wilFail = 0; b.wilEv = !inTurn ? 'noturn' : !biting ? 'bite' : t <= 0.9 ? 'lever' : willieOdds(b) <= 0 ? 'motor' : 'power';
      }
    }
  }
  b.wilFail = (b.wilFail ?? 9) + dt;
  if (b.wilT > 0) {
    b.wilT += dt;
    const end = b.wilT > WILLIE.maxT || -up + down > WILLIE.holdP + 0.35 || t < WILLIE.holdThr || Math.abs(s) < WILLIE.exitSteer || b.hop > 0.05 || b.cap > 0;
    if (end) { b.wilT = 0; if (b.cap <= 0 && b.wil > 0.3) { b.hop = WILLIE.endHop * b.wil; b.hv = 0; } }   // the bow drops back onto the water
  }
  b.wil = b.wilT > 0 ? Math.min(1, (b.wil || 0) + dt * WILLIE.rise) : Math.max(0, (b.wil || 0) - dt * WILLIE.rise * 2);
}
// the player's own ウィリー: say how it went
function willieToast(b) {
  if (!b.wilEv) return;
  const e = b.wilEv; b.wilEv = null;
  if (e === 'ok') toast('ウィリー', '舳先が上がった！ 起こしたままレバーを握って', 'good');
  else toast('ウィリー失敗', { noturn: 'ターン中でないと上がらない', bite: 'ペラが水をつかんでいない（跳ね・引き波）', lever: 'レバーを握り込めていない', motor: '出足・回り足とも○以上のモーターでないと上がらない' }[e] || '舳先が上がらない（出足・回り足が足りない）', 'warn');
}
const tiltGrip = b => 1 - TILT.grip * Math.max(0, b.tilt || 0) + 0.02 * Math.max(0, -(b.tilt || 0));

// 艇の傾き (d158, まえ): the hull's own bank (not the rider's body), + = right side down, radians. Rolled in by the rider's
// weight to the inside (more when sat up — a monkey turn) and by the carve itself. Banked deep, the hull cuts the water
// on a knife edge: little scrub, little spray, a sharp turn. Turning flat, the side slaps the water: big spray, a brake.
// Too deep near the limit and it can go.
const BANK = { on: true, max: 0.5, lean: 0.75, pose: 0.4, carve: 0.25, rate: 5, ref: 0.5, flatDrag: 0.45, sharp: 0.25, bite: 0.3, overFrom: 0.9, overLoad: 0.35 };
const DRIFT = { on: true, yawK: 1.15, align: 0.5, kL: 3.0, gripK: 1.5, scrub: 0.3, latDrag: 0.05, slipOk: 0.45, slipSpan: 0.35, slideK: 0.5 };
function boatPhysics(b, inp, dt) {
  const fx = Math.cos(b.a), fy = Math.sin(b.a), rx = -fy, ry = fx;
  if (b.cap > 0) {
    b.cap -= dt;
    b.v *= Math.exp(-2.5 * dt); b.vl *= Math.exp(-3 * dt); b.yaw *= Math.exp(-4 * dt);
    b.x += (fx * b.v + rx * b.vl) * dt; b.y += (fy * b.v + ry * b.vl) * dt;
    if (b.cap <= 0) { b.v = 0; b.vl = 0; b.yaw = 0; b.porp = 0; }
    wallsFor(b); b.harmony = 0; return null;
  }

  // d176 押し出し: a boat shoved by another skates sideways for a moment and its rudder can't take it straight back
  const shK = b.shoveT > 0 ? clamp(b.shoveT / SHOVE.t, 0, 1) : 0;
  if (b.shoveT > 0) b.shoveT -= dt;
  const t = inp.thr, s = inp.steer * (1 - SHOVE.steer * shK), r = inp.roll, p = inp.pitch;
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
  bounceStep(b, t, down, up, dt);
  willieStep(b, inp, t, s, down, up, dt);
  trimStep(b, inp, t, down, up, dt);
  const air = b.hop > 0.02 ? 1 : 0, wil = b.wil || 0;
  const drag = 0.012 * (1 + 0.25 * up - 0.1 * down);
  const thrustA = te * THRUST * thrustK(b.v) * startK(b.v, b.preStart, b) * motorK(b) * (b.weightK || 1) * (b.thrMul || 1) * (1 - TRAIL.max * (b.trail || 0)) * (b.cav > 0 ? WAKE_CAV.thrust : 1) * (1 + trimKickK(b, t)) * raceFadeK(b) * (1 - air * BOUNCE.airThr * (1 - BOUNCE.airDown + BOUNCE.airDown * down));
  heatStep(b, t, dt);
  // wind: the air the boat runs through moves with it (追い風) or against it (向かい風)
  const wAlong = waterEnv ? ENV.windAir * (waterEnv.wx * Math.cos(b.a) + waterEnv.wy * Math.sin(b.a)) : 0, vRel = b.v - wAlong;
  const airA = drag * (b.stabilizer ? ENV.stabDrag : 1) * (b.hullDrag || 1) * (b.bodyDrag || 1) * vRel * Math.abs(vRel) + 0.1 * b.v;
  let acc = thrustA - airA;
  const holdA = b.hold === 'hang' ? 1.5 * b.v : b.hold ? WAIT_DRAG * b.v : 0;
  acc -= holdA;   // 待機: lever shut and sat up — it still drifts on at a slow walk (~7 km/h); hanging bow-off it all but stops
  acc -= b.porp * (1.2 + simRandom() * 2.2);
  // 引き波: rough water from another boat. Riding in it drags; crossing it at an angle
  // (bump) makes the hull slam and hop, costing more speed and grip and knocking it off line.
  const wk = (b.inWake || 0) * (1 - (1 - WILLIE.wake) * wil), bump = (b.wakeBump || 0) * (1 - (1 - WILLIE.wake) * wil);
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
  const crouchLock = down * firm * clamp((Math.abs(s) - 0.5) / 0.4, 0, 1);
  const monkey = ins * (0.4 + 0.6 * pose) * (1 - 0.5 * downG);
  let grip = GRIP_BASE * (1 + 0.15 * pose) * (1 + TURN.lean * ins * (1 + TURN.upBoost * pose - TURN.downCut * downG)) * (1 + 0.5 * Math.min(0, inside))
    * (1 - TURN.thrWide * t * (1 - monkey)) * (1 + TURN.dropGrip * (1 - t))
    * (1 - 0.4 * b.porp) * (1 - (0.12 * wk + 0.28 * bump) * WAKE.grip) * (b.gripBoost || 1) * (b.gripSkill || 1) * tiltGrip(b) * (b.hullGrip || 1) * (b.bodyGrip || 1) * (b.weightGrip || 1) * mawariK(b, MAWARI.grip) * (1 - CHOP.grip * chopNow()) * (1 - air * BOUNCE.airGrip) * (DRIFT.on ? 1 : 1 - (1 - WILLIE.grip) * wil) * (1 - TRIM.grip * clamp(b.trimPop || 0, 0, 1));
  grip = Math.max(2, grip);

  // 艇の傾き: where the hull is rolled to, and how much of it is to the inside of the turn it is making
  let bankIn = 0, tf = 0;
  if (BANK.on) {
    const yd = Math.sign(b.yaw || 0), turnK = clamp(Math.abs(b.yaw || 0) / 0.6, 0, 1) * clamp(b.v / 12, 0, 1);
    const bankT = BANK.max * clamp(BANK.lean * r * (1 - BANK.pose + BANK.pose * Math.max(pose, up)) + BANK.carve * yd * turnK, -1, 1);
    b.bank = (b.bank || 0) + (bankT - (b.bank || 0)) * (1 - Math.exp(-BANK.rate * dt));
    bankIn = yd ? yd * b.bank / BANK.max : 0;   // 1 = rolled all the way in, 0 = flat, < 0 = leaning out
    tf = clamp((Math.abs(b.yaw || 0) - 0.15) / 0.45, 0, 1) * clamp(b.v / 10, 0, 1);
    grip *= 1 + BANK.sharp * tf * (bankIn - BANK.ref);   // the chine set deep in bites: a sharper turn
  }
  const sf = clamp(b.v / 5, 0.3, 1);   // even nearly stopped, the hull can be pivoted round slowly
  const turnBase = 1.35 / (1 + b.v / 35);
  let yawT = s * turnBase * sf * (1 + 0.7 * Math.max(0, inside) * (0.6 + 0.5 * pose - 0.4 * downG)) + r * 0.28 * sf;
  // the nose can only come round as fast as the grip allows at this speed: faster means a wider arc
  const yawCap = grip * YAW_OVER / Math.max(4, b.v) * (1 - TURN.crouchWide * crouchLock) * (DRIFT.on ? DRIFT.yawK : 1);
  yawT = clamp(yawT, -yawCap, yawCap);
  if (DRIFT.on) yawT += DRIFT.align * b.vl / Math.max(4, b.v);   // a hull slid far out of line swings back toward where it is going
  b.yaw += (yawT - b.yaw) * (1 - Math.exp(-5 * dt));

  let demand, latNeed = 0;
  if (DRIFT.on) {
    // ドリフト (d157): the nose comes round first and the boat carries on — the water under it is now coming at it from the
    // side (vl, + = toward the left of the bow). The inside chine and fin bite on that (up to `grip`, the edge the rider
    // is giving it) and bend the path round; whatever they can't hold slides on out.
    const da = b.yaw * dt, c = Math.cos(da), sn = Math.sin(da), v0 = b.v, l0 = b.vl;
    b.v = Math.max(0, v0 * c + l0 * sn); b.vl = l0 * c - v0 * sn;
    latNeed = DRIFT.kL * (1 + BANK.bite * tf * (bankIn - BANK.ref)) * Math.abs(b.vl);   // d159: the chine set deep catches the slide sooner
    const cap = grip * DRIFT.gripK * (1 - (1 - WILLIE.bite) * wil), aLat = Math.min(latNeed, cap);   // ウィリー: less hull in the water — less bite, it slides more
    b.vl -= Math.sign(b.vl) * Math.min(Math.abs(b.vl), Math.min(aLat, cap * (1 - SHOVE.grip * shK)) * dt);   // d176: shoved, the hull bites less and is carried on sideways
    demand = aLat / DRIFT.gripK * YAW_OVER;   // the edge working at its limit reads like the old grip limit (~0.85)
    b.slideX = Math.max(0, latNeed - cap) / cap;   // more coming at it sideways than the edge can hold: it is skating out
    b.slip = Math.atan2(b.vl, Math.max(0.5, b.v));
  } else {
    demand = b.v * Math.abs(b.yaw);
    const excess = demand - grip;
    if (excess > 0 && Math.abs(b.yaw) > 0.05) b.vl += -Math.sign(b.yaw) * excess * 0.9 * dt;
    b.vl *= Math.exp(-dt * 1.6 * grip / GRIP_BASE * (1 - SHOVE.grip * shK));
  }

  b.harmony = sgn ? clamp(0.5 * Math.max(0, inside) + 0.3 * pose + 0.2 * t, 0, 1) : 0;
  // sitting up scrubs speed (it's the brake); crouching while firmly leaned in lets the hull run out of the turn
  const turnLoss = 0.9 * (1 - TURN.keep * b.harmony) * Math.max(0.2, 1 + TURN.upBrake * up - TURN.run * firm * down);   // turns bleed speed; a clean monkey turn keeps more of it
  // a slight lean (no rudder) only nudges the heading and costs nothing; turning on the rudder scrubs speed
  const freeYaw = Math.abs(s) < 0.08 ? Math.min(Math.abs(r), STRAIGHT_LEAN.free) * 0.28 * sf : 0;
  const turnA = (Math.max(0, Math.abs(b.yaw) - freeYaw) * b.v * turnLoss * (DRIFT.on ? DRIFT.scrub : 1) + Math.abs(b.vl) * (DRIFT.on ? DRIFT.latDrag : 0.7)) * (1 - WILLIE.loss * wil);
  const flatA = BANK.on ? turnA * BANK.flatDrag * tf * clamp(BANK.ref - bankIn, -0.6, 1.2) : 0;   // flat in the turn: the side slaps the water (banked deep: less scrub than the old turn)
  acc -= turnA + flatA;
  b.splashK = b.cap > 0 ? 0 : clamp(tf * clamp(b.v / 18, 0, 1.2) * (0.25 + 1.1 * clamp(1 - bankIn, 0, 1.5)) + 0.8 * (b.slideX || 0), 0, 2);   // スプラッシュ: flat or skating, a wall of water; on the knife edge, a thin sheet
  // an extreme hang-off without turning (or sat bolt upright at speed) drags on a straight
  const leanA = Math.abs(s) < 0.08 && Math.abs(b.yaw) < 0.12 ? STRAIGHT_LEAN.drag * b.v * Math.max(0, Math.abs(r) - STRAIGHT_LEAN.ok) / (1 - STRAIGHT_LEAN.ok) : 0;
  acc -= leanA;
  if (b.dbg) Object.assign(b.dbg, { thrustA, airA, holdA, wakeA, turnA, leanA, acc, startK: startK(b.v, b.preStart, b), motorK: motorK(b) });
  if (acc > 0) acc *= driveK(s, r, up) * gainK(b.v, b.preStart) * (1 + WILLIE.drive * wil);   // 推進の乗り・行き足: only the gain in speed is dulled, not the speed a turn holds or the top speed
  b.v = Math.max(0, b.v + acc * dt);
  b.a += b.yaw * dt;
  // 潮の流れ carries everyone; the wind pushes on the hull too (追い風 runs a boat on past 1M, 横風 sets it sideways)
  b.x += (fx * b.v + rx * b.vl) * dt + (waterEnv ? (waterEnv.cx + ENV.windDrift * waterEnv.wx) * dt : 0);
  b.y += (fy * b.v + ry * b.vl) * dt + (waterEnv ? ENV.windDrift * waterEnv.wy * dt : 0);

  // 安定度 (load): how close the hull is to letting go; 1.0 is the danger line.
  // Below it the boat is safe. Above it every moment carries a chance of going over that grows
  // with how far past the line it is (and how steady the rider is) — crossing it is a gamble.
  const lowLean = Math.max(0, inside) * clamp((8 - b.v) / 5, 0, 1) * Math.min(1, Math.abs(s) * 1.5);
  const turnLoad = demand / (grip * YAW_OVER), slideLoad = DRIFT.on ? Math.max(Math.max(0, Math.abs(b.slip || 0) - DRIFT.slipOk) / DRIFT.slipSpan, DRIFT.slideK * (b.slideX || 0)) : Math.abs(b.vl) / 7;
  b.turnLoadV = 0.85 * turnLoad;
  // a clean turn at the grip limit reads ~0.85 (限界ぎりぎり); a slide, wake or low-speed over-lean takes it past the line
  // 無茶: a deep hang-on at full throttle and near top speed, rudder hard over, is past what the hull will take —
  // worse still done crouched. Easing the lever calms everything down.
  const mucha = ins * t * clamp((b.v / 22.8 - 0.7) / 0.3, 0, 1) * clamp(Math.abs(s) * 1.4 - 0.4, 0, 1) * (1 + 1.2 * down);
  const load = (Math.max(0.85 * turnLoad, slideLoad, lowLean * 1.1) + TURN.mucha * mucha) * (1 - TURN.dropCalm * (1 - t)) + WAKE.unsettle * bump + 0.1 * wk + TURN.crouchLoad * crouchLock + WILLIE.load * wil + TRIM.load * (b.trimPop || 0) * (b.trimRisk || 0) + (BANK.on ? BANK.overLoad * tf * Math.max(0, bankIn - BANK.overFrom) / (1 - BANK.overFrom) : 0);   // a hull bucking on a wave is on the edge
  b.load = (b.load || 0) + (load - (b.load || 0)) * (1 - Math.exp(-dt * 8));
  let ev = null;
  if (b.load > 1 || Math.abs(b.vl) > 11) {
    const haz = Math.abs(b.vl) > 11 ? 1e3 : HAZARD * Math.pow(b.load - 1, 1.5) * (b.hazMul || 1);
    if (simRandom() < haz * dt) {
      ev = 'cap:' + ((b.trimPop || 0) > 0.2 && (b.trimRisk || 0) > 0.3 ? '舳先を跳ね上げてバランスを崩した' : b.wilFail < 0.6 ? 'ウィリーに失敗してバランスを崩した' : wil > 0.3 ? 'ウィリー中にバランスを崩した' : b.stuckAge < 0.5 ? 'バウンドの着水で舳先が刺さった' : lowLean * 1.1 >= Math.max(0.85 * turnLoad, slideLoad) ? '速度がないのに内へ倒れ込んだ'
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
   Each hull is a capsule (a 1.8 m spine with 0.65 m of rounding, real size since d187) so bow, side and stern all hit
   where they look. On touch the hulls are pushed apart and trade an impulse along the contact
   normal; the boat driving harder into the other keeps more of its line, an off-centre hit
   spins the hull, and a big enough shove can put a boat over (the physics capsizes it
   when its sideways speed runs away). Returns one event per new touch. */
const HULL_R = 0.65, HULL_AFT = 0.25, HULL_FWD = 1.58;   // d187 (まえ: real size): 3.1 m × 1.3 m, bow tip 2.23, stern −0.9 (was 0.8/1.4/1.6 = 4.6 × 1.6 m)
const SIDE_PUSH = { k: 0.3, yawMax: 0.15 };
/* d176 押し出し・押し込み (まえ: a hit only killed both boats' speed — side to side and ダンプ should knock a boat off its line).
   The boat pressing harder into the other (closing speed, rider weight, a little more if it is ahead) keeps its line and most of
   its speed; the other is thrown sideways (kick per unit impulse) and skates for up to t s with its bite cut (grip) and its rudder
   weak (steer), so it is really carried out wide or pressed in. Only for boats running roughly the same way (not rear-ends). */
const SHOVE = { on: true, k: 0.7, t: 0.8, jRef: 2.5, grip: 0.6, steer: 0.35, keep: 0.6, ahead: 0.3, same: 0.3, vlMax: 9 };
const CONTACT_SCRUB = { k: 0.015, jRef: 3 };   // a real knock (impulse jRef) still costs 1.5 %; a rub costs next to nothing   // share of the closing speed passed on; only while both run straight
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
    // d172 (まえ: two boats rubbing side by side both died): the scrub is per hit, by how hard — it was a flat 1.5 % every
    // physics step, so a long rub (a bow in alongside) took 16 % a second off both boats
    const va0 = a.v, vla0 = a.vl, vc0 = c.v, vlc0 = c.vl;
    const scrub = 1 - CONTACT_SCRUB.k * Math.min(1, J / CONTACT_SCRUB.jRef);
    a.v = Math.max(0, nax * fax + nay * fay) * scrub; a.vl = clamp(a.vl + ((-nax * fay + nay * fax) - a.vl) * 0.6, -7, 7);
    c.v = Math.max(0, ncx * fcx + ncy * fcy) * scrub; c.vl = clamp(c.vl + ((-ncx * fcy + ncy * fcx) - c.vl) * 0.6, -7, 7);
    if (SHOVE.on && fax * fcx + fay * fcy > SHOVE.same && !(fax * fcx + fay * fcy > 0.8 && (nx * fax + ny * fay > 0.75 || -(nx * fcx + ny * fcy) > 0.75))) {
      const mx = fax + fcx, my = fay + fcy, aAhead = ((a.x - c.x) * mx + (a.y - c.y) * my) > 0 ? 1 : 0;
      const sA = (aInto + 0.3) * (a.weightGrip || 1) * (1 + SHOVE.ahead * aAhead), sC = (cInto + 0.3) * (c.weightGrip || 1) * (1 + SHOVE.ahead * (1 - aAhead));
      const P = sA >= sC ? a : c, V = P === a ? c : a, share = Math.abs(sA - sC) / (sA + sC);
      const P0 = P === a ? [va0, vla0] : [vc0, vlc0];
      P.v += (P0[0] - P.v) * SHOVE.keep * (0.5 + share); P.vl += (P0[1] - P.vl) * SHOVE.keep * (0.5 + share);   // the pusher holds its line
      const ox = P === a ? nx : -nx, oy = P === a ? ny : -ny, fvx = Math.cos(V.a), fvy = Math.sin(V.a);   // away from the pusher
      const kick = SHOVE.k * J * (0.5 + share);
      V.vl = clamp(V.vl + kick * (-ox * fvy + oy * fvx), -SHOVE.vlMax, SHOVE.vlMax);
      V.shoveT = Math.max(V.shoveT || 0, SHOVE.t * clamp(J / SHOVE.jRef, 0.3, 1));
      V.shoveBy = P;
    }
    // an off-centre hit swings the hull
    a.yaw += ((px - a.x) * (-ny * JA) - (py - a.y) * (-nx * JA)) * 0.05;
    c.yaw += ((qx - c.x) * (ny * JC) - (qy - c.y) * (nx * JC)) * 0.05;
    // rear-end: the contact is square on one boat's bow
    let rear = -1;
    if (fax * fcx + fay * fcy > 0.8) {
      if (nx * fax + ny * fay > 0.75) rear = i; else if (-(nx * fcx + ny * fcy) > 0.75) rear = j;
    }
    // d172 (まえ): on a straight, a faster boat rubbing the side of the one ahead from behind hands it some speed (押し出し)
    let push = 0;
    if (rear < 0 && fax * fcx + fay * fcy > 0.8 && Math.abs(a.yaw || 0) < SIDE_PUSH.yawMax && Math.abs(c.yaw || 0) < SIDE_PUSH.yawMax) {
      const ahead = (c.x - a.x) * fax + (c.y - a.y) * fay, back = ahead > 0 ? a : c, front = ahead > 0 ? c : a, dv = back.v - front.v;
      if (dv > 0) { push = SIDE_PUSH.k * dv; front.v += push; back.v -= push; }
    }
    evs.push({ i, j, J, JA, JC, rear, push, x: (px + qx) / 2, y: (py + qy) / 2 });
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
      const sk = 0.45 + 0.8 * (b.splashK || 0), sp = (3 + simRandom() * 4 + Math.abs(b.vl)) * sk;   // d158: banked deep a thin sheet, flat a big throw
      spray.push({ x: b.x - fx * 1.2 + rx * out * 0.9, y: b.y - fy * 1.2 + ry * out * 0.9,
        vx: rx * out * sp - fx * 2 + (simRandom() - .5) * 2, vy: ry * out * sp - fy * 2 + (simRandom() - .5) * 2, t: time, life: (0.5 + simRandom() * 0.4) * (0.6 + 0.5 * sk) });
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
  B.preStart = SS.phase === 'count' ? 1 : ((soloKind === 'clock' || soloKind === 'ta') && lap.n === 0 && B.y > 0 && B.x > -5 ? preStartAfter(boatBow(B).x) : 0);
  // 起こし〜スリット: 舵と体の左右の傾きは固定（真っ直ぐだけ）。通過してから入力を受け付ける
  if (SS.phase === 'count') zigCheck(B, input.steer, null);
  const binp = SS.phase === 'count' ? { thr: input.thr, steer: clamp(input.steer, -PRE_SLIT.steer, PRE_SLIT.steer), roll: 0, pitch: input.pitch } : input;
  if ((soloKind === 'clock' || soloKind === 'ta') && SS.phase === 'count' && !B.logged && !runLog && input.thr >= 0.3) { B.logged = true; runLogBegin(B, '大時計スタート（1艇）', SS.t0 + CLOCK); }
  if (runLog && runLog.b === B && ((B.y < -4 && B.x < MK - 5) || time > SS.t0 + CLOCK + 30)) runLogEnd(`ST ${meas.st == null ? '—' : meas.st < 0 ? 'F' + fmtST(-meas.st) : fmtST(meas.st)} / チルト ${B.tilt}`);
  if (VR) VR.inp(B, binp);
  const ev = boatPhysics(B, binp, dt);
  willieToast(B);
  if (runLog && runLog.b === B) runLogStep(B, binp, SS.t0 + CLOCK, '');
  harmony = B.harmony || 0;
  hitCool = Math.max(0, hitCool - dt);
  if (ev) {
    if (VR) VR.ev(ev.startsWith('cap:') ? 'capsize' : 'hit', 1, ev.startsWith('cap:') ? { why: ev.slice(4) } : { what: ev });
    if (ev.startsWith('cap:')) { splash(B); T.on = false; toast('転覆', ev.slice(4), 'bad'); hapticShot(0.45, 1); sfxCapsize(B.x, B.y); }
    else {
      hapticShot(0.15, 0.7); sfxHit(B.x, B.y, 5);
      if (!hitCool) { toast(ev === 'buoy' ? '接触' : ev === 'boom' ? '消波装置' : '岸壁', ev === 'buoy' ? 'ターンマークに強く当たった' : ev === 'boom' ? 'マーク内側の消波装置に当たった' : 'コースの端にぶつかった', 'bad'); hitCool = 1.5; }
    }
  }
  slitCapture(practiceSlit,time-(SS.t0+CLOCK),[{no:1,b:B,trait:{course:1}}]);
  if (soloKind === 'ta') taStep();
  if (VR) VR.frame();
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
    if (time > SS.t0 + CLOCK + 1) { SS.phase = 'done'; SS.hideAt = time + 2.5; toast('出遅れ', '1秒以内にスタートラインを越えられなかった', 'bad'); if (soloKind === 'ta') taFail('出遅れ'); }
  }
  if (SS.phase === 'done' && SS.hideAt && time > SS.hideAt) { SS.phase = 'off'; $('clock').hidden = true; }

  measStep(previous,current);
  // laps: cross the line at x=0 on the lower straight after rounding both marks
  if (SS.phase !== 'count' && Math.sign(lap.prevY || B.y) !== Math.sign(B.y) && Math.abs(B.x) < MK - 1) { toast('内側航走', 'ターンマークの内側を通過（レースなら6着扱い）', 'bad'); if (soloKind === 'ta') taFail('内側航走'); }
  lap.prevY = B.y;
  if (B.x > MK - 15) lap.visR = true;
  if (B.x < -MK + 15) lap.visL = true;
  if (crossed) {
    if (lap.visR && lap.visL) {
      const lt = crossAt - lap.start;
      lap.best = lap.best == null ? lt : Math.min(lap.best, lt);
      lap.n++;
      if (soloKind === 'ta') taLap(crossAt);
      else {
        if (!T.on) toast(`${lap.n}周`, `ラップ ${fmt(lt)}`, 'info');
        if (meas.on && lap.n >= MEAS_LAPS) measFinish(crossAt - meas.startAt);
      }
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
// gets cocky (イケるっ when it was early). Once a race, somewhere between CUTIN.from and CUTIN.to s before the clock hits zero.
// d172 (まえ): earlier (was 2.8–1.0 s) so there is time to see it and act on it, and no more slow motion with it (0.35×
// for 0.38 s) — the slow-down itself was the cue, and it taught letting go of the lever the instant anything appeared.
const CUTIN = { from: 4.0, to: 2.2, goMax: 0.15 };
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
// the same box also shows other kinds of log: rpSrc = { key, title, empty }, rpBack = where closing it returns to
let rpSrc = null, rpBack = null;
// replay logs are kept per player (player.js); before it has loaded, the shared key
const rpKeyNow = () => typeof playerKey === 'function' ? playerKey(RP.key) : RP.key;
const rpN = (v, d = 1) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d).replace(/\.0+$/, '').replace(/^-0$/, '0');
function rpBegin(f, zero) {
  const e = waterEnv, st = f.setsu && f.setsu.race;
  const head = [`#HFGP-REPLAY v1 ${GAME_VER} ${new Date().toISOString()}`,
    `#player ${typeof playerName === 'function' ? playerName() : '-'}`,
    `#mode ${lab.active ? 'lab' : st ? `setsu day${st.day} ${st.R}R ${st.kind}` : f.playerNo ? `race player=${f.playerNo}` : 'demo'} entry=${f.entry ? 'pit' : 'fixed'}`,
    `#env ${e ? `${windJa(e)} wave=${e.wave}cm cx=${rpN(e.cx, 2)} stab=${e.stabilizer ? 1 : 0}${e.temp != null ? ` temp=${e.temp}` : ''}${e.tideJa ? ` tide=${e.tideJa}${e.tideLv}` : ''}` : 'calm'}`,
    '#boat no cls name temper pref motor(deashi/mid/nobi/power) hull(grip/ride/drag) weightK tilt skill(start/turn/judge) courseAff body(sex/cm/kg)'];
  for (const r of f.boats) { const b = r.b, k = r.skill;
    head.push(`B ${r.no} ${r.prof.kinen ? 'KINEN' : r.prof.top ? 'TOP' : r.prof.name} ${(r.name || '-').replace(/\s+/g, '')} ${r.temper} ${r.pref} ${rpN(b.deashi, 3)}/${rpN(b.mMid, 3)}/${rpN(b.nobi, 3)}/${rpN(b.powerK || 1, 3)} ${rpN(b.hullGrip || 1, 3)}/${rpN(b.hullRide || 1, 2)}/${rpN(b.hullDrag || 1, 3)} ${rpN(b.weightK || 1, 3)} ${rpN(b.tilt, 1)} ${k ? `${Math.round(k.start)}/${Math.round(k.turn)}/${Math.round(k.judge)} ${k.course.join(',')}` : '-'} ${r.body ? `${r.body.sex}/${r.body.height}/${r.body.rideWt}` : '-'}${r.player ? ' PLAYER' : ''}`); }
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
const rpLoad = () => { try { return JSON.parse(localStorage.getItem(rpSrc ? rpSrc.key : rpKeyNow()) || '[]'); } catch (e) { return []; } };
function rpStore(entry) { const all = rpLoad(); all.unshift(entry); while (all.length > RP.keep) all.pop(); for (;;) { try { localStorage.setItem(rpKeyNow(), JSON.stringify(all)); break; } catch (e) { if (all.length <= 1) break; all.pop(); } } return all; }
function rpOpen(i = 0) {
  const all = rpLoad(); rpIdx = clamp(i, 0, Math.max(0, all.length - 1));
  paused = true; $('rpBox').hidden = false;
  const e = all[rpIdx];
  $('rpHead').textContent = rpSrc ? rpSrc.title : `リプレイログ（${typeof playerName === 'function' ? playerName() : '-'}）`;
  $('rpInfo').textContent = e ? `${rpIdx + 1}/${all.length}　${new Date(e.at).toLocaleString('ja-JP')}　${e.title}　（${Math.round(e.text.length / 1024)}KB）` : rpSrc ? rpSrc.empty : '保存したログはまだありません。レースが終わったら画面下の「残す」で保存できます。';
  $('rpText').value = e ? e.text : '';
  $('rpOlder').disabled = !e || rpIdx >= all.length - 1; $('rpNewer').disabled = !e || rpIdx <= 0; $('rpDel').disabled = !e; $('rpSave').disabled = !e;
}
function rpCloseBox() { $('rpBox').hidden = true; if (rpBack) { const f = rpBack; rpBack = null; rpSrc = null; f(); return; } if (rpFromMenu) { rpFromMenu = false; $('pmenu').hidden = false; return; } paused = rpWasPaused; last = performance.now(); if (orient.full && !document.fullscreenElement) lockLandscape(); }
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
  $('rpDel').addEventListener('click', () => { const all = rpLoad(); all.splice(rpIdx, 1); try { localStorage.setItem(rpSrc ? rpSrc.key : rpKeyNow(), JSON.stringify(all)); } catch (e) {} rpOpen(Math.min(rpIdx, all.length - 1)); });
  // ファイルに保存: the shown log as a .txt download (easier than copying 60KB on a phone)
  $('rpSave').addEventListener('click', () => { const e = rpLoad()[rpIdx]; if (!e) return;
    const a = document.createElement('a'), d = new Date(e.at), p = n => String(n).padStart(2, '0');
    a.href = URL.createObjectURL(new Blob([e.text], { type: 'text/plain' }));
    a.download = `${rpSrc ? rpSrc.file : 'hfgp_replay'}_${typeof playerName === 'function' ? playerName() : 'guest'}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $('rpClose').addEventListener('click', rpCloseBox);
}
function toast(big, small, kind) {
  if (typeof fleet !== 'undefined' && fleet && fleet.rp && !fleet.rp.done) fleet.rp.ev.push(`${rpN(time - fleet.rp.zero, 2)} ${big} ${small}`);
  const el = $('toast');
  $('tBig').textContent = big; $('tSmall').textContent = small;
  el.dataset.kind = kind;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

