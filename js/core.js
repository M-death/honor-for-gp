// Honor for GP — 共通の道具・コースの形・スタートの決まり・プレイヤー艇の状態
const lab = {active:false,finished:false,inSim:false,rng:42,steps:0,config:null,data:null};
function simRandom(){
 if(lab.predicting)return .5;
 if(!lab.inSim)return Math.random();
 lab.rng=(lab.rng+0x6D2B79F5)>>>0;let t=lab.rng;
 t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
 return ((t^(t>>>14))>>>0)/4294967296;
}
let VR = null;   // 動画用ログ (vlog.js) — null until it loads
const D2R = Math.PI / 180;
const $ = id => document.getElementById(id);
// 版: shown on the start screen and written into the logs. Bump it with every update (dNNN).
const GAME_VER = 'd286';
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
/* ---------- 場データ (d235, まえ: コースに関することを全て作り変える — 住之江の図から) ----------
   Coordinates stay as before: x along the line through the two marks (1M at +MK, 2M at −MK), y = 0 on that line,
   +y the スタンド side (the start straight), −y the 対岸 side. The banks come from the venue: distance from the mark line
   to the wall at 2M / 中央 / 1M (straight between, the end segments carried on past the marks), water behind each mark,
   and the スリット drawn square to the stand — so it leans off square to the mark line by slitK (x = slitK·y). */
// d236 (まえ: これまでのコースは基本練習用コースとして残す、住之江は別で集計、6艇レースもコースを選べる): two venues, switched with setVenue
const VENUES_GEO = {
  standard: { id: 'standard', name: '練習コース', courseVersion: 1, taSuffix: '',   // the course up to d234 (a ±58 m box, a square start line)
    stand: [[-150, 58], [0, 58], [150, 58]], back: [[-150, 58], [0, 58], [150, 58]], behind1: 50, behind2: 160, slitK: 0,
    lanes: [10, 18.5, 27, 35, 42.5, 50], laneMax: 52, pitX: -280, spotRoom: 10 },
  suminoe: { id: 'suminoe', name: 'なにわ競艇場',   // d249 (まえ): 実名は使わない — 表示名は架空。id 'suminoe' は中の名前（TA記録・リプレイの場IDのまま）
    courseVersion: 2, taSuffix: '.suminoe',
    stand: [[-150, 63], [0, 51], [150, 45]],   // スタンド側 (m from the mark line)
    back: [[-150, 67], [0, 75], [150, 85]],    // 対岸側
    behind1: 70, behind2: 120,                 // water behind 1M / behind 2M (the pits are past 2M)
    slitK: 0.06,                               // (63 − 45) / 300: the stand closes in on the mark line toward 1M
    // at the start line; spacing as まえ asked (5 m of water between the slow boats, 4 m between the dash boats, hull 1.3 m →
    // 6.3 / 5.3 m centre to centre). d237 (まえ): 1号艇 8 m from the mark line to the hull's centre (was 15, provisional)
    lanes: [8, 14.3, 20.6, 25.9, 31.2, 36.5], laneMax: 46, pitX: -262, spotRoom: 25 },
};
const VENUE_LIST = ['standard', 'suminoe'];
let VENUE = VENUES_GEO.standard;
const venueEdge = (pts, x) => { const i = x <= pts[1][0] ? 0 : 1, [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); };
const standY = x => venueEdge(VENUE.stand, x);          // the stand-side wall (+y)
const backY = x => -venueEdge(VENUE.back, x);           // the far wall (−y)
const wallGap = (x, y) => y >= 0 ? standY(x) - y : y - backY(x);   // m of water left between (x, y) and the wall on its side
const slitXAt = y => VENUE.slitK * Math.max(0, y);      // where the start line is at this y
const toSlit = p => slitXAt(p.y) - p.x;                 // m still to run to the start line (along x)
// a course is a line square to the start line (parallel to the stand), given by its distance from the mark line at the slit
const laneYAt = (yAtSlit, x) => yAtSlit - VENUE.slitK * x;
const START_GATE = {x:0,side:1,k:0};   // (k follows the venue: setVenue)
const laneA = () => -Math.atan(VENUE.slitK);   // the heading square to the start line
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
  const gd=pt=>(pt.x-g.x-(g.k||0)*Math.max(0,pt.y))*g.side;   // d235: the line can lean (x = g.x + k·y)
  if(!(gd(a)<0 && gd(b)>=0))return null;
  let lo=0,hi=1;
  for(let i=0;i<42;i++){
    const u=(lo+hi)/2,v=gd(boatBow(interpolatePose(p,q,u)));
    if(v<0)lo=u;else hi=u;
  }
  const u=(lo+hi)/2,at=boatBow(interpolatePose(p,q,u));
  return Math.sign(at.y)===g.side?p.t+(q.t-p.t)*u:null;
}
// 隊形: 7 m centre to centre (about 5.5 m of water between hulls), as on a real start; the course is wide enough for it
// d232 (まえ: ほんの少しだけ全体を外へ — 1枠が窮屈にならないように、外は遠くなる): y0 8 → 9
// d234 (まえ: 1・2・3号艇の間隔を広めに、もう1mほど外へ、ダッシュ勢もインから遠く): was 9/16/23/30/37/44 (7 m apart)
// d235/d236: per venue (VENUES_GEO.lanes), measured at the start line
const LANE = { ys: [] };
// d235: the course box is the venue's outline; the banks themselves are standY/backY. Filled in by setVenue.
const COURSE = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, marks: [{ x: MK, y: 0, name: '1M' }, { x: -MK, y: 0, name: '2M' }] };
const VENUE_OUTLINE = [];
const venueHooks = [];   // other files: what to redo when the venue changes (TA records, ranking table…)
function setVenue(id, keep = true) {
  VENUE = VENUES_GEO[id] || VENUES_GEO.standard;
  COURSE.xMin = -MK - VENUE.behind2; COURSE.xMax = MK + VENUE.behind1;
  COURSE.yMin = Math.min(backY(COURSE.xMin), backY(COURSE.xMax), -venueEdge(VENUE.back, 0)); COURSE.yMax = Math.max(standY(COURSE.xMin), standY(COURSE.xMax), standY(0));
  VENUE_OUTLINE.length = 0;
  VENUE_OUTLINE.push([COURSE.xMin, standY(COURSE.xMin)], ...VENUE.stand.map(([x, y]) => [x, y]), [COURSE.xMax, standY(COURSE.xMax)], [COURSE.xMax, backY(COURSE.xMax)], ...VENUE.back.slice().reverse().map(([x, y]) => [x, -y]), [COURSE.xMin, backY(COURSE.xMin)]);
  START_GATE.k = VENUE.slitK; LANE.ys = VENUE.lanes.slice();
  if (keep) try { localStorage.setItem('honorGP.venue', VENUE.id); } catch (e) {}
  for (const f of venueHooks) try { f(); } catch (e) {}
  for (const sel of document.querySelectorAll('select.venue-sel')) sel.value = VENUE.id;
}
{ let v0 = 'standard'; try { v0 = localStorage.getItem('honorGP.venue') || 'standard'; } catch (e) {} setVenue(VENUES_GEO[v0] ? v0 : 'standard', false); }
// 消波装置: a float boom running 30 m in from each turn mark along the course centreline,
// so a boat can't cut inside a mark without hitting it
const BOOM_LEN = 30;
const OBSTACLES = [
  ...COURSE.marks.map(m => ({ kind: 'mark', x1: m.x, y1: m.y, x2: m.x, y2: m.y, r: 1.5 })),
  { kind: 'boom', x1: MK - 2, y1: 0, x2: MK - 2 - BOOM_LEN, y2: 0, r: 0.35 },
  { kind: 'boom', x1: -MK + 2, y1: 0, x2: -MK + 2 + BOOM_LEN, y2: 0, r: 0.35 },
];
const START = { x: -95, y: 20, a: 0 }; // d264 (まえ): 30 → 20 — タイムアタック・大時計スタートは理想のラインのかなり外から始まっていた、水の色一段分内へ
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
const HULL_STERN = 0.9;   // d187: the transom, m behind the pivot (real-size hull)
// d187: the CPUs still judge room and 舳先 with the old, larger hull (their margins were tuned on it); only contact and the pictures are real size
const PLAN_HULL = { r: 0.8, aft: 1.4, fwd: 1.6, stern: 2.2 };
const HESAKI = { stern: PLAN_HULL.stern, deep: 0, outOff: 3 };
const clearAhead = (b, q) => (b.x - PLAN_HULL.stern) - (q.x + BOW_TIP) >= CLEAR_AHEAD;
// d187 (まえ: every model real size): the boat pictures (2D sprite, light 3D, new model) were drawn ≈5 m × 1.6 m around the pivot;
// squeeze them to the real hull (≈3.1 m × 1.3 m) with the bow tip kept at BOW_TIP.
const DRAW_HULL = { k: 0.63, w: 0.8, x: 0.83 };
const hullDrawTf = c => { c.translate(DRAW_HULL.x, 0); c.scale(DRAW_HULL.k, DRAW_HULL.w); };
const SS = { phase: 'off', t0: 0, hideAt: 0 };
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const diag = { ori: 0, oriNull: 0, mot: 0, framed: (() => { try { return window.self !== window.top; } catch (e) { return true; } })() };

let playerTilt = -0.5;   // the player's own tilt (settings)
// d257 (まえ: タイムアタックのモーターは○近く、最高速度80.5あたり、練習コースも同じ): the solo boat's motor (TA・展示・練習).
// d260 (まえ: ミスありで1'44"8は速い、展示は速くない → 出足・回り足は平均に戻し、最高速だけ80ちょい): 出足・中速・回り足 1.00、
// 伸び 1.025 (○と◎のさかい). CPU solo なにわ, tilt −0.5, no wind: top 80.2–80.7 km/h, A1 1'47"4→1'48"0, 記念 1'44"8→1'45"5.
// (d257 was 出足 1.02 中速 1.02 回り足 1.01.) The 後ろ重心 pop on the exit now buys more (まえ: 出足を補う技術).
const SOLO_MOTOR = { deashi: 1, mMid: 1, mawari: 1, nobi: 1.025 };
const B = { x: START.x, y: START.y, a: START.a, v: 0, vl: 0, yaw: 0, porp: 0, cap: 0, ...SOLO_MOTOR, tilt: playerTilt };
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
