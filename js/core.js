// Honor for GP — 共通の道具・コースの形・スタートの決まり・プレイヤー艇の状態
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
// 版: shown on the start screen and written into the logs. Bump it with every update (dNNN).
const GAME_VER = 'd147';
if ($('verTag')) $('verTag').textContent = GAME_VER;
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
