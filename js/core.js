// Honor for GP — 共通の道具・水面とボートの物理定数・モーター・プレイヤー艇の状態
const lab = {active:false,finished:false,inSim:false,rng:42,steps:0,config:null,data:null};
function simRandom(){
 if(lab.predicting)return .5;
 if(!lab.inSim)return Math.random();
 lab.rng=(lab.rng+0x6D2B79F5)>>>0;let t=lab.rng;
 t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
 return ((t^(t>>>14))>>>0)/4294967296;
}
const D2R = Math.PI / 180;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const clamp = (v, a = -1, b = 1) => v < a ? a : v > b ? b : v;
const wrap = d => ((d + 540) % 360 + 360) % 360 - 180;
const dz = v => Math.abs(v) < 0.06 ? 0 : (v - Math.sign(v) * 0.06) / 0.94;
const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue(n).trim();
const C = { water: tok('--water'), deep: tok('--water-deep'), bank: tok('--bank'), buoy: tok('--buoy'), good: tok('--good'), warn: tok('--warn'), bad: tok('--bad'), lever: tok('--lever'), line: tok('--hud-line') };

// Real course: start line midway, each turn mark 150 m from it (300 m apart), 3 laps of ~600 m.
const MK = 150;
// Timing uses the actual pointed bow in the deck outline, not the centre or collision capsule.
const BOW_TIP = 2.25;
const START_GATE = {x:0,side:1};
// 水面の距離標識 (m before the start line) and their colours: 200/150 for the dash 起こし, 100 for the slow, 45–5 for the last touch
const DIST_MARKS = [[200, '#e9f5f2'], [150, '#f2cf2e'], [100, '#e8463c'], [45, '#3f8cff'], [40, '#35c46a'], [30, '#ff9a2e'], [5, '#e8463c']];
const startOffset = (at,zero) => Math.abs(at-zero)<1e-9?0:at-zero;
const boatBow = b => ({x:b.x+BOW_TIP*Math.cos(b.a),y:b.y+BOW_TIP*Math.sin(b.a)});
const timingPose = (b,t) => ({x:b.x,y:b.y,a:b.a,t});
function interpolatePose(p,q,u){
  const da=Math.atan2(Math.sin(q.a-p.a),Math.cos(q.a-p.a));
  return {...p,x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u,a:p.a+da*u};
}
// Half-open crossing prevents counting the same point twice. Resolve within a physics step
// using the same position/heading interpolation as the photograph (including a turning bow).
function gateCrossing(g,p,q){
  const a=boatBow(p),b=boatBow(q);
  if(!((a.x-g.x)*g.side<0 && (b.x-g.x)*g.side>=0))return null;
  let lo=0,hi=1;
  for(let i=0;i<42;i++){
    const u=(lo+hi)/2,v=(boatBow(interpolatePose(p,q,u)).x-g.x)*g.side;
    if(v<0)lo=u;else hi=u;
  }
  const u=(lo+hi)/2,at=boatBow(interpolatePose(p,q,u));
  return Math.sign(at.y)===g.side?p.t+(q.t-p.t)*u:null;
}
const GRIP_BASE = 5;         // sideways grip; with the turn-rate cap this sets how wide a turn swings at speed
const HAZARD = 0.2;
const WAIT_DRAG = 0.1;   // extra drag sat up with the lever shut while waiting
// 接触による転覆: impulse threshold (j0, never below jMin), how much an unsettled hull lowers it, the impulse range to
// the full chance, how much instability raises it, and the share of that chance the boat that did the hitting faces
const CAPSIZE = { j0: 7.6, jMin: 2.6, unstJ: 3.5, span: 10, unstP: 2, hitter: 0.3 };
// turning: how much leaning in adds grip, how much sitting up amplifies that and staying crouched spoils it,
// how far full throttle pushes a turn wide without the body in it, how much easing the lever settles the hull,
// and how much a flat-out, full-lock, deep hang-on at top speed (無茶) adds to the load
const TURN = { lean: 0.9, upBoost: 0.75, downCut: 0.6, thrWide: 0.15, dropGrip: 0.2, dropCalm: 0.3, mucha: 0.5,
  holdPose: 0.5, exitPose: 0.3, carve: 0.8, upBrake: 0.35, run: 0.7, keep: 0.7 };   // carving out: a firm inside lean keeps the bite while easing up into a crouch; a clean turn scrubs less speed
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
const THRUST = 7.85;          // full-lever push: top speed ≈ 82 km/h crouched, idle ≈ 16 km/h
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
const raceElapsed = () => fleet && fleet.raceOn && time > fleet.raceStart ? time - fleet.raceStart : 0;   // only once the race is off (not in the 待機行動)
const chopNow = () => Math.pow(clamp(raceElapsed() / CHOP.full, 0, 1), CHOP.pow);
function heatStep(b, thr, dt) { if (!raceElapsed()) { b.heat = 0; return; } b.heat = clamp((b.heat || 0) + (thr - HEAT.cool) * dt / HEAT.T, 0, 1); }
const raceFadeK = b => (1 - CHOP.thr * chopNow()) * (1 - HEAT.thr * (b.heat || 0));
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
const tiltGrip = b => 1 - TILT.grip * Math.max(0, b.tilt || 0) + 0.02 * Math.max(0, -(b.tilt || 0));
// 隊形: 7 m centre to centre (about 5.5 m of water between hulls), as on a real start; the course is wide enough for it
const LANE = { y0: 8, step: 7 };
const COURSE = { xMin: -310, xMax: 200, yMin: -58, yMax: 58, marks: [{ x: MK, y: 0, name: '1M' }, { x: -MK, y: 0, name: '2M' }] };
// 消波装置: a float boom running 30 m in from each turn mark along the course centreline,
// so a boat can't cut inside a mark without hitting it
const BOOM_LEN = 30;
const OBSTACLES = [
  ...COURSE.marks.map(m => ({ kind: 'mark', x1: m.x, y1: m.y, x2: m.x, y2: m.y, r: 1.5 })),
  { kind: 'boom', x1: MK - 2, y1: 0, x2: MK - 2 - BOOM_LEN, y2: 0, r: 0.35 },
  { kind: 'boom', x1: -MK + 2, y1: 0, x2: -MK + 2 + BOOM_LEN, y2: 0, r: 0.35 },
];
const START = { x: -95, y: 30, a: 0 };
const IDLE = 0.08;          // idle thrust share with the lever fully closed
const CLOCK = 12;           // big-clock countdown seconds
// 6艇レース: 針が回り出す PRE_RUN 秒前から待機行動の艇が動ける（スタートの加速が鈍いので、ダッシュの助走200mに12秒では足りない）
const PRE_RUN = 3, RUNUP = CLOCK + PRE_RUN;
// 起こし〜スリット: only a small rudder correction is possible (no lean) — enough to keep straight, not to swerve.
// 蛇行 (switching the rudder side to side) is a 待機行動違反. Free again from the slit.
const PRE_SLIT = { steer: 0.06, zigFlips: 3, zigWindow: 4 };
// 並走中に相手側へ転舵 (第19条): while hulls overlap fore and aft, moving across toward the other boat faster than this (m/s)
const RULE19 = { vy: 1.3, overlap: 4.6, gap: 4.5 };
// a boat is clear ahead (no overlap at all) when its stern is this far past the other's bow
const CLEAR_AHEAD = 0.5;
// 舳先がかかる (m along the hull): stern is this far behind the centre; a bow this far past the other's centre is at its cockpit
const HESAKI = { stern: 2.2, deep: 0, outOff: 3 };
const clearAhead = (b, q) => (b.x - 2.2) - (q.x + BOW_TIP) >= CLEAR_AHEAD;
const SS = { phase: 'off', t0: 0, hideAt: 0 };
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const diag = { ori: 0, oriNull: 0, mot: 0, framed: (() => { try { return window.self !== window.top; } catch (e) { return true; } })() };

let playerTilt = -0.5;   // the player's own tilt (settings)
const B = { x: START.x, y: START.y, a: START.a, v: 0, vl: 0, yaw: 0, porp: 0, cap: 0, deashi: 1, nobi: 1, tilt: playerTilt };
const input = { thr: 0, steer: 0, steerT: 0, roll: 0, pitch: 0 };
const raw = { roll: 0, pitch: 0 };
const virtualPosture={enabled:false,pointer:null,roll:0,pitch:0};
let controlMode='tilt';
const phoneWheel={base:null,last:null,kind:null,value:0,deg:0,range:30,invert:false};
const sensor = { got: false, calib: null, invR: false, invP: false, range: 18, deg: [0, 0] };
const keys = new Set();
const cam = { x: B.x, y: B.y };
const wake = [], spray = [];
const lap = { n: 0, start: 0, best: null, visR: false, visL: false, prevY: B.y };
const T = { on: false, sum: 0, n: 0, maxVl: 0, minV: 99, entryV: 0, quiet: 0 };
let running = false, paused = false, time = 0, harmony = 0, lowLeanT = 0, hitCool = 0, wakeAcc = 0, portraitOk = false;
let W = 0, H = 0, DPR = 1;
const slitHistory=[];
let slitCam=false, slitSerial=0, practiceSlit=null, slitSelected=null, slitWasPaused=false, slitReturnFocus=null;

/* ---------- sizing ---------- */
