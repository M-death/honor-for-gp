// Honor for GP — 操作（傾き・タッチ・パッド）・音・振動・練習メニュー・計測
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  if(lab.active){ if(W>760)W-=360;else H=Math.floor(H*.57); }
  cv.style.width=W+'px';cv.style.height=H+'px';
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const r = mini.getBoundingClientRect();
  mini.width = Math.round(r.width * DPR); mini.height = Math.round(r.height * DPR);
  $('rotate').hidden = lab.active || !(H > W && !portraitOk);
}
addEventListener('resize', resize);

/* ---------- tilt sensor ---------- */
function screenAngle() {
  const o = screen.orientation;
  const a = (o && typeof o.angle === 'number') ? o.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
  return a * D2R;
}
// Gravity "up" in device axes, rotated into screen axes, then read as lean (roll) and fore-aft (pitch)
function fromUp(ux, uy, uz) {
  const a = screenAngle();
  const sx = ux * Math.cos(a) - uy * Math.sin(a);
  const sy = ux * Math.sin(a) + uy * Math.cos(a);
  return [Math.atan2(-sx, Math.hypot(sy, uz)) / D2R, Math.atan2(sy, uz) / D2R];
}
function readAngles(beta, gamma) {
  const b = beta * D2R, g = gamma * D2R;
  return fromUp(-Math.sin(g) * Math.cos(b), Math.sin(b), Math.cos(g) * Math.cos(b));
}
// DeviceOrientation uses intrinsic Z-X-Y rotations (W3C). Extract screen-normal twist
// relative to the calibrated holding pose; clockwise as seen by the player is positive steering.
function quatMul(a,b){return[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];}
function orientationQuat(alpha,beta,gamma){
 const a=alpha*D2R/2,b=beta*D2R/2,g=gamma*D2R/2;
 return quatMul(quatMul([Math.cos(a),0,0,Math.sin(a)],[Math.cos(b),Math.sin(b),0,0]),[Math.cos(g),0,Math.sin(g),0]);
}
function resetPhoneWheel(){phoneWheel.base=phoneWheel.last!=null?(Array.isArray(phoneWheel.last)?phoneWheel.last.slice():phoneWheel.last):null;phoneWheel.deg=phoneWheel.value=0;input.steer=input.steerT=0;}
function recordPhoneWheel(sample,kind){
 if(controlMode!=='wheel')return;
 if(phoneWheel.kind!==kind){phoneWheel.kind=kind;phoneWheel.base=null;}
 phoneWheel.last=sample;if(phoneWheel.base==null)phoneWheel.base=Array.isArray(sample)?sample.slice():sample;
 let degrees;
 if(kind==='quat'){
  const a=phoneWheel.base,q=quatMul([a[0],-a[1],-a[2],-a[3]],sample);
  degrees=Math.hypot(q[0],q[3])<1e-5?0:wrap(-2*Math.atan2(q[3],q[0])/D2R);
 }else degrees=wrap(sample-phoneWheel.base);
 sensor.got=true;$('note').hidden=true;phoneWheel.deg=degrees*(phoneWheel.invert?-1:1);
 phoneWheel.value=clamp(Math.sign(phoneWheel.deg)*Math.max(0,Math.abs(phoneWheel.deg)-2)/(phoneWheel.range-2));
 if(calib.open){$('calDot').style.transform=`translate(${phoneWheel.value*60}px,0px)`;$('calTxt').textContent=`舵 ${phoneWheel.deg.toFixed(1)}°（OKでここが中央）`;}
}
function wheelFromGravity(ux,uy){
 const a=screenAngle(),sx=ux*Math.cos(a)-uy*Math.sin(a),sy=ux*Math.sin(a)+uy*Math.cos(a);
 if(Math.hypot(sx,sy)<.15){phoneWheel.value=phoneWheel.deg=0;return;}
 recordPhoneWheel(Math.atan2(-sx,sy)/D2R,'gravity');
}
function applyAngles(ang) {
  if(virtualPosture.enabled)return;
  if (!sensor.got) { sensor.got = true; $('note').hidden = true; }
  sensor.last = ang;
  // zeroing: for a short moment after "start", the mean of the readings becomes the level posture
  const z = sensor.zeroing;
  if (z) {
    if (!z.first) z.first = ang.slice();
    z.n++; z.r += wrap(ang[0] - z.first[0]); z.p += wrap(ang[1] - z.first[1]);
    sensor.calib = [z.first[0] + z.r / z.n, z.first[1] + z.p / z.n];
    if (performance.now() > z.until && z.n >= 4) sensor.zeroing = null;
  }
  if (!sensor.calib) sensor.calib = ang.slice();
  let dr = wrap(ang[0] - sensor.calib[0]);
  let dp = -wrap(ang[1] - sensor.calib[1]);
  if (sensor.invR) dr = -dr;
  if (sensor.invP) dp = -dp;
  sensor.deg = [dr, dp];
  if (calib.open) showCalib(ang);
  raw.roll = dz(clamp(dr / sensor.range));
  raw.pitch = dz(clamp(dp / sensor.range));
}
function onOri(e) {
  if(controlMode==='pad')return;
  diag.ori++;
  if (e.beta == null || e.gamma == null) { diag.oriNull++; return; }
  sensor.src = 'ori';
  if(controlMode==='wheel'){
    if(Number.isFinite(e.alpha)&&Number.isFinite(e.beta)&&Number.isFinite(e.gamma))recordPhoneWheel(orientationQuat(e.alpha,e.beta,e.gamma),'quat');
    else {const b=e.beta*D2R,g=e.gamma*D2R;wheelFromGravity(-Math.sin(g)*Math.cos(b),Math.sin(b));}
    return;
  }
  applyAngles(readAngles(e.beta, e.gamma));
}
// fallback: gravity from the accelerometer when orientation events are empty
const gs = { x: 0, y: 0, z: 0, init: false };
function onMot(e) {
  if(controlMode==='pad')return;
  diag.mot++;
  if (sensor.src === 'ori') return;
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null || g.z == null) return;
  let x = g.x, y = g.y, z = g.z;
  if (IOS) { x = -x; y = -y; z = -z; }
  if (!gs.init) { gs.x = x; gs.y = y; gs.z = z; gs.init = true; }
  gs.x += (x - gs.x) * 0.25; gs.y += (y - gs.y) * 0.25; gs.z += (z - gs.z) * 0.25;
  const n = Math.hypot(gs.x, gs.y, gs.z) || 1;
  sensor.src = 'mot';
  if(controlMode==='wheel'){wheelFromGravity(gs.x/n,gs.y/n);return;}
  applyAngles(fromUp(gs.x / n, gs.y / n, gs.z / n));
}
// 傾きの基準: after "start" the player holds the phone the way they'll play, checks the tilt responds,
// and presses OK; that posture becomes level (傾き0) and stays fixed until they set it again.
const calib = { open: false, ref: null, then: null };
function openCalib(then) {
  if(controlMode==='pad'){if(then)then();return;}
  $('calUsePad').hidden=controlMode!=='wheel';
  if(controlMode==='wheel')resetPhoneWheel();
  $('calTitle').textContent=controlMode==='wheel'?'スマホ舵の中央を合わせる':'姿勢の基準を合わせる';
  $('calMsg').textContent=controlMode==='wheel'?'スマホをハンドルのように構え、左右に回して反応を確かめてください。まっすぐ進む持ち方に戻してOKを押します。':'遊ぶときの持ち方で構え、少し傾けて反応を確かめてください。OKを押した姿勢が傾き0になります。';
  calib.open = true; calib.ref = sensor.last ? sensor.last.slice() : null; calib.then = then;
  paused = true; $('calib').hidden = false;
  $('calTxt').textContent = controlMode==='wheel'?'左右に回して舵を確認…':sensor.got ? '左右 0°　前後 0°' : '傾きを確認中…';
  setTimeout(() => { if (calib.open && !sensor.got) $('calTxt').textContent = controlMode==='wheel'?'スマホ舵を取得できません。センサーの許可を確認するか、モード2へ切り替えてください。':'傾きセンサーが見つかりません（PC・コントローラならそのままOK）'; }, 1200);
}
function showCalib(ang) {
  if (!calib.ref) calib.ref = ang.slice();
  let r = wrap(ang[0] - calib.ref[0]), p = -wrap(ang[1] - calib.ref[1]);
  if (sensor.invR) r = -r; if (sensor.invP) p = -p;
  const k = 60 / sensor.range;
  $('calDot').style.transform = `translate(${clamp(r * k, -62, 62)}px, ${clamp(-p * k, -62, 62)}px)`;
  const f = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v));
  $('calTxt').textContent = `左右 ${f(r)}°　前後 ${f(p)}°（OKでここが0）`;
}
function closeCalib() {
  if (!calib.open) return;
  calib.open = false; $('calib').hidden = true;
  zeroTilt();
  paused = false; last = performance.now();
  const then = calib.then; calib.then = null;
  if (then) then();
}
$('calOk').addEventListener('click', closeCalib);
$('calUsePad').addEventListener('click',()=>{setControlMode('pad');closeCalib();});
// the posture the phone is held in when OK is pressed counts as level (傾き0)
function zeroTilt() { if(controlMode==='pad')return;if(controlMode==='wheel'){resetPhoneWheel();return;}sensor.zeroing = { n: 0, r: 0, p: 0, first: null, until: performance.now() + 350 }; }
function recalibrate(msg) {
  sensor.calib = sensor.last ? sensor.last.slice() : null;
  if (msg) toast('基準リセット', msg, 'info');
}
const onTurnScreen = () => { resetVirtualPosture();if(controlMode==='pad')return;if(controlMode==='wheel'){phoneWheel.last=null;resetPhoneWheel();return;} sensor.calib = null; if (running) setTimeout(() => toast('基準リセット', '画面の向きが変わったので、今の持ち方を基準にしました', 'info'), 300); };
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onTurnScreen);
else addEventListener('orientationchange', onTurnScreen);

function showNote(text) { const n = $('note'); n.textContent = text; n.hidden = false; }

/* ---------- sound (Web Audio, all synthesised — no audio files) ----------
   エンジン   one voice per boat: a buzzy two-stroke note whose pitch and brightness follow the lever
              and the boat's speed; it dies when the boat goes over. The followed/own boat is up front,
              the others fade with distance and sit left/right by where they are on screen.
   水切り     a water hiss under the followed boat that rises with speed
   スプラッシュ spray noise when the hull slides or turns hard
   引き波     a dull slap each time the followed boat slams over a wave line
   接触・転覆  a knock, or a long crashing splash; the big clock pips at 3, 2, 1 and chimes at 0 */
const snd = { ctx: null, on: true, vol: 0.7, master: null, noise: null, engines: new Map(), hiss: null, spl: null, lastBump: 0, lastSec: null };
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (snd.ctx) { if (snd.ctx.state === 'suspended') snd.ctx.resume().catch(() => {}); return; }
  try { snd.ctx = new AC(); } catch (e) { return; }
  const c = snd.ctx;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  snd.master = c.createGain(); snd.master.gain.value = 0;
  snd.master.connect(comp); comp.connect(c.destination);
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  snd.noise = buf;
  snd.hiss = noiseBed('lowpass', 900, 0.7);
  snd.spl = noiseBed('bandpass', 1800, 0.9);
}
function noiseBed(type, freq, q) {
  const c = snd.ctx, src = c.createBufferSource(); src.buffer = snd.noise; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(snd.master); src.start();
  return { f, g };
}
const DRIVE_CURVE = (() => { const n = 1024, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(2.2 * x); } return a; })();
function makeEngine() {
  const c = snd.ctx;
  const osc = c.createOscillator(); osc.type = 'sawtooth';
  const sub = c.createOscillator(); sub.type = 'square';
  const whine = c.createOscillator(); whine.type = 'triangle';
  const lfo = c.createOscillator(); lfo.frequency.value = 17 + Math.random() * 8;   // the rough burble of a two-stroke
  const lfoG = c.createGain(); lfoG.gain.value = 4;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  const mix = c.createGain(); mix.gain.value = 0.5;
  const subG = c.createGain(); subG.gain.value = 0.35;
  const whG = c.createGain(); whG.gain.value = 0.12;
  osc.connect(mix); sub.connect(subG); subG.connect(mix); whine.connect(whG); whG.connect(mix);
  const sh = c.createWaveShaper(); sh.curve = DRIVE_CURVE;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
  const g = c.createGain(); g.gain.value = 0;
  mix.connect(sh); sh.connect(f); f.connect(g);
  let out = g;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) { g.connect(pan); out = pan; }
  out.connect(snd.master);
  const t = c.currentTime;
  osc.start(t); sub.start(t); whine.start(t); lfo.start(t);
  return { osc, sub, whine, f, g, pan, stop() { try { osc.stop(); sub.stop(); whine.stop(); lfo.stop(); } catch (e) {} g.disconnect(); } };
}
function oneShot(dur, f0, f1, vol, type = 'bandpass', q = 1) {
  if (!snd.ctx || !snd.on) return;
  const c = snd.ctx, t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = snd.noise;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(snd.master);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function pip(freq, dur, vol) {
  if (!snd.ctx || !snd.on) return;
  const c = snd.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(snd.master); o.start(t); o.stop(t + dur + 0.05);
}
// how loud something at (x, y) is from where the camera is looking
const earGain = (x, y) => clamp(1 - Math.hypot(x - cam.x, y - cam.y) / 140, 0, 1);
function sfxHit(x, y, strength) { const e = earGain(x, y); if (e > 0.05) oneShot(0.25, 900, 180, 0.5 * e * clamp(strength / 6, 0.3, 1), 'lowpass', 2); }
function sfxCapsize(x, y) { const e = earGain(x, y); if (e > 0.05) { oneShot(1.4, 3000, 200, 0.7 * e, 'bandpass', 0.6); oneShot(0.5, 300, 60, 0.6 * e, 'lowpass', 1); } }
function updateAudio() {
  if (!snd.ctx) return;
  const c = snd.ctx, t = c.currentTime;
  const live = snd.on && running && !paused && !document.hidden;
  snd.master.gain.setTargetAtTime(live ? snd.vol : 0, t, 0.08);
  if (!live) return;
  const fr = fleet ? focusRow() : null;
  const list = fleet ? fleet.boats.map(r => ({ id: r.no, b: r.b, inp: r.inp, focus: r === fr })) : [{ id: 0, b: B, inp: input, focus: true }];
  const seen = new Set();
  for (const e of list) {
    seen.add(e.id);
    let v = snd.engines.get(e.id);
    if (!v) { v = makeEngine(); snd.engines.set(e.id, v); }
    const b = e.b, thr = IDLE + (1 - IDLE) * (e.inp ? e.inp.thr : 0);
    const rpm = clamp(0.15 + 0.55 * thr + 0.35 * b.v / 23 - 0.1 * (b.turnLoadV || 0), 0, 1.15);
    const f0 = 58 + 150 * rpm + (e.id % 6) * 1.7;   // each engine a hair apart so six don't merge into one
    v.osc.frequency.setTargetAtTime(f0, t, 0.05);
    v.sub.frequency.setTargetAtTime(f0 / 2, t, 0.05);
    v.whine.frequency.setTargetAtTime(f0 * 4.02, t, 0.05);
    v.f.frequency.setTargetAtTime(350 + 2800 * thr * (0.6 + 0.4 * b.v / 23), t, 0.05);
    const dead = b.cap > 0;
    const vol = dead ? 0 : e.focus ? 0.2 : 0.2 * 0.5 * earGain(b.x, b.y) ** 1.5;
    v.g.gain.setTargetAtTime(vol, t, dead ? 0.3 : 0.06);
    if (v.pan) v.pan.pan.setTargetAtTime(e.focus ? 0 : clamp((b.x - cam.x) / 70, -0.9, 0.9), t, 0.1);
  }
  for (const [id, v] of snd.engines) if (!seen.has(id)) { v.stop(); snd.engines.delete(id); }
  // water hiss and spray under the boat we're with
  const me = list.find(e => e.focus);
  if (me) {
    const b = me.b, alive = b.cap <= 0;
    snd.hiss.g.gain.setTargetAtTime(alive ? 0.07 * clamp(b.v / 22, 0, 1) : 0, t, 0.1);
    snd.hiss.f.frequency.setTargetAtTime(500 + 1500 * clamp(b.v / 22, 0, 1), t, 0.1);
    const spray = alive ? clamp(Math.max(Math.abs(b.vl) / 4, (Math.abs(b.yaw) > 0.35 ? Math.abs(b.yaw) * b.v / 14 : 0)), 0, 1) : 0;
    snd.spl.g.gain.setTargetAtTime(0.22 * spray, t, 0.06);
    const bump = b.wakeBump || 0;
    if (alive && bump > 0.3 && snd.lastBump <= 0.3) oneShot(0.18, 420, 120, 0.35 * bump, 'lowpass', 1.5);
    snd.lastBump = bump;
  }
  // the big clock: pips at 3, 2, 1 and a chime at zero
  if (SS.phase === 'count') {
    const rem = SS.t0 + CLOCK - time, sec = Math.ceil(rem);
    if (sec !== snd.lastSec) { if (sec >= 1 && sec <= 3) pip(880, 0.12, 0.25); else if (sec === 0) pip(1320, 0.5, 0.3); snd.lastSec = sec; }
  } else snd.lastSec = null;
}
// browsers only allow sound after the viewer interacts: wake it up on any tap, click or key
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (snd.ctx && snd.ctx.state === 'suspended') snd.ctx.resume().catch(() => {}); }, true);

// Stop the phone's auto-rotate from flipping the screen mid-race: go full screen and lock the
// orientation the phone is in now (Android Chrome etc.; iPhone browsers don't allow either, so it's skipped).
function lockLandscape() {
  try {
    const el = document.documentElement, o = screen.orientation;
    if (!o || typeof o.lock !== 'function') return;
    const lock = () => {
      // keep whichever way the phone is held now (縦のまま試す stays portrait)
      const t = o.type || (portraitOk ? 'portrait' : 'landscape');
      o.lock(t).then(() => { orient.locked = true; }).catch(() => {});
    };
    if (document.fullscreenElement) { orient.full = true; lock(); return; }
    if (orient.stayWindow) return;   // PC: the player left full screen once — keep the window
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { orient.full = true; lock(); }).catch(() => {});
  } catch (e) {}
}
const orient = { locked: false, full: false };   // full: the player had full screen (taken back on the next tap if lost)
// on a PC (mouse, no touch), leaving full screen (Esc etc.) is the player's choice: don't go back into it
const isPC = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches && !('ontouchstart' in window) && !(navigator.maxTouchPoints > 0); } catch (e) { return false; } };
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && orient.full && isPC()) { orient.full = false; orient.stayWindow = true; } });
async function enableTiltInput(){
  let ok = true;
  // both requests fire inside the same tap so iOS still counts it as a user gesture
  const reqs = [];
  try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') reqs.push(DeviceOrientationEvent.requestPermission()); } catch (e) { ok = false; }
  try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') reqs.push(DeviceMotionEvent.requestPermission()); } catch (e) { ok = false; }
  try { const res = await Promise.all(reqs.map(p => p.catch(() => 'error'))); if (res.length && !res.includes('granted')) ok = false; } catch (e) { ok = false; }
  if(controlMode==='pad')return false;
  if (!start.listening) { start.listening = true; addEventListener('deviceorientation', onOri); addEventListener('devicemotion', onMot); }
  return ok;
}
function disableTiltInput(){
 removeEventListener('deviceorientation',onOri);removeEventListener('devicemotion',onMot);start.listening=false;
 sensor.zeroing=null;raw.roll=raw.pitch=0;
}
async function start(after) {
  initAudio();
  lockLandscape();          // must start inside the tap
  const ok=controlMode==='pad'?true:await enableTiltInput();
  $('start').hidden = true;
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
  // check the tilt and fix 傾き0, then the game begins
  openCalib(() => { running = true; last = performance.now(); if (after) after(); else beginStart(); afterStartCheck(ok); });
}
function afterStartCheck(ok) {
  setTimeout(() => {
    if (controlMode==='pad' || sensor.got || fleet) return;
    const d = `診断：向き ${diag.ori}回（値なし ${diag.oriNull}）／加速度 ${diag.mot}回／${diag.framed ? '埋め込み表示' : '単独表示'}／${window.isSecureContext ? 'HTTPS' : '非HTTPS'}${ok ? '' : '／許可なし'}`;
    showNote((diag.framed
      ? '傾きが検知できていません。アプリ内の埋め込み表示ではセンサーが止められている可能性が高いです。単独のページとして開くと動くはずです。'
      : '傾きが検知できていません。ブラウザの設定で「モーションと画面の向き」へのアクセスを許可してください。') + '\n' + d + '\n（タップで閉じる）');
  }, 1800);
}
$('go').addEventListener('click', () => { start(); });
$('goDemo').addEventListener('click', () => { start(() => entryMode ? startEntry(null) : startFleet()); });
$('stayPortrait').addEventListener('click', () => { portraitOk = true; $('rotate').hidden = true; });

/* ---------- settings ---------- */
$('gear').addEventListener('click', () => { resetVirtualPosture();paused = true; $('settings').hidden = false; });
$('close').addEventListener('click', () => { paused = false; last = performance.now(); $('settings').hidden = true; });
$('zero').addEventListener('click', () => { $('settings').hidden = true; openCalib(() => toast('基準リセット', 'OKを押した持ち方が傾き0になりました', 'info')); });
$('padRT').addEventListener('change', e => { pad.useRT = e.target.checked; });
$('sndOn').addEventListener('change', e => { snd.on = e.target.checked; initAudio(); });
$('sndVol').addEventListener('input', e => { snd.vol = e.target.value / 100; $('sndVolOut').textContent = e.target.value; });
$('hapOn').addEventListener('change', e => { hap.on = e.target.checked; if (!hap.on) { hap.active = true; hapticsStop(); } });
$('hapTest').addEventListener('click', () => {
  const g = currentPad();
  if (g && g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: 400, strongMagnitude: 1, weakMagnitude: 1 }).catch(() => {});
  else if (navigator.vibrate) { try { navigator.vibrate([120, 60, 240]); } catch (e) {} }
  else toast('振動できません', 'この端末・ブラウザは振動に対応していません（iPhoneは非対応）', 'warn');
  if (padBlocked) toast('コントローラ使用不可', 'この画面ではコントローラが禁止されています。ファイルを単独のページとして開いてください', 'warn');
});
$('invR').addEventListener('change', e => { sensor.invR = e.target.checked; });
$('invP').addEventListener('change', e => { sensor.invP = e.target.checked; });
$('sens').addEventListener('input', e => { sensor.range = +e.target.value; $('sensOut').textContent = e.target.value + '°'; });
$('reset').addEventListener('click', () => { $('settings').hidden = true; paused = false; last = performance.now(); restartPractice(); });
$('again').addEventListener('click', () => { if (!running || paused) return; paused = true; $('pmenu').hidden = false; });
// 練習の種類: 'p6' 6艇スタート練習 / 'race' レース練習（3周）; solo: 'tenji' 展示航走 / 'clock' 大時計スタート
let practiceKind = 'race', soloKind = 'clock';
const WAKU_NOTE = {
  p6: 'ランプの数字が消えて「ピット離れ」でアクセル。舵は自動で、アクセルだけで待機位置まで運びます（前付けなし）。2マークを回る前でも後でも、正対する前なら「引く」でダッシュ（引いた順に外のコース）。大時計が回り始めたらスタート。スリットを越えたら自動で1マークを回り、スリット写真で終了します。',
  race: 'ランプの数字が消えて「ピット離れ」でアクセル。「主張」ボタン（コントローラはA）を押すたびに一つ内のコースを狙います（押さない限りコースは取りにいきません。主張中は白く点滅）。内の艇より2艇身前に出れば入れ替わり、内の艇は抵抗して前に出させまいとすることがあります。主張できるのは2マークまで。正対するまでに「引く」（コントローラはB）でダッシュ。待機中の舵は自動。スタート後は舵・体重移動・アクセルすべて自分で操作して3周（ゴールしたら自動で流します）。'
};
function closeMenu() { $('pmenu').hidden = true; paused = false; last = performance.now(); }
function openWaku(kind) { practiceKind = kind; $('wakuNote').textContent = WAKU_NOTE[kind]; $('pmenu').hidden = true; paused = true; $('waku').hidden = false; }
function soloRestart() { soloKind === 'tenji' ? beginTenji() : beginStart(); }
// 練習をやり直す (settings / controller X): start the practice in progress again from the beginning
function restartPractice() {
  for (const id of ['meas', 'pmenu', 'waku']) $(id).hidden = true;
  if (!$('slitPhoto').hidden) $('slitPhoto').hidden = true;
  paused = false; last = performance.now();
  if (fleet && fleet.setsu) { toast('節間モード', '本番のレースはやり直せません', 'warn'); return; }
  if (fleet && fleet.playerNo) startEntry(fleet.playerNo, fleet.practice6 ? 'p6' : 'race');
  else if (fleet) nextRace();
  else soloRestart();
}
$('pm6').addEventListener('click', () => openWaku('p6'));
$('pmRace').addEventListener('click', () => openWaku('race'));
$('pmTenji').addEventListener('click', () => { closeMenu(); if (fleet) quitFleet(); beginTenji(); });
$('pmClock').addEventListener('click', () => { closeMenu(); if (fleet) quitFleet(); beginStart(); });
$('pmClose').addEventListener('click', closeMenu);
$('note').addEventListener('click', () => { $('note').hidden = true; });

/* ---------- オリジナル展示タイム style measurement (スタート練習, 2 laps) ----------
   展示タイム   back straight, the 150 m running into 2M (伸び)
   直線タイム   back straight from just out of 1M to mid-straight (行き足)
   まわり足     from 22 m before 1M on the home side, round 1M, to 23 m out on the back side (回り足)
   一周タイム   one full lap, gate on the back straight */
const GATES = {
  tenji: { from: { x: 10, side: -1 }, to: { x: -140, side: -1 } },
  choku: { from: { x: 120, side: -1 }, to: { x: -43, side: -1 } },
  mawari: { from: { x: MK - 22, side: 1 }, to: { x: MK - 23, side: -1 } },
};
const LAP_GATE = { x: -43, side: -1 };
const MEAS_LAPS = 2;
const MEAS_JA = { tenji: '展示タイム', choku: '直線タイム', mawari: 'まわり足タイム', isshu: '一周タイム' };
const meas = { on: false, t: {}, open: {}, lapGateAt: null, startAt: 0, st: null };
function measReset() { Object.assign(meas, { on: false, t: { tenji: [], choku: [], mawari: [], isshu: [] }, open: {}, lapGateAt: null, startAt: 0, st: null }); }
measReset();
// All exhibition, straight, turning and one-lap gates use bow crossings.
function measStep(previous,current) {
  if (!meas.on) return;
  const lapNo = lap.n + 1;
  for (const k in GATES) {
    const g = GATES[k],from=gateCrossing(g.from,previous,current),to=gateCrossing(g.to,previous,current);
    if(from!=null)meas.open[k]=from;
    if(meas.open[k]!=null && to!=null && to>=meas.open[k]){
      const v=to-meas.open[k];meas.open[k]=null;
      if(meas.t[k].length<MEAS_LAPS){meas.t[k][lapNo-1]=v;toast(MEAS_JA[k],`${lapNo}周目 ${v.toFixed(2)}秒`,'info');}
    }
  }
  const at=gateCrossing(LAP_GATE,previous,current);
  if(at!=null){
    if(meas.lapGateAt!=null && meas.t.isshu.length<MEAS_LAPS){const v=at-meas.lapGateAt;meas.t.isshu.push(v);toast(MEAS_JA.isshu,`${v.toFixed(2)}秒`,'info');}
    meas.lapGateAt=at;
  }
}
function measFinish(total) {
  meas.on = false;
  slitArchive(practiceSlit, [{no:1,st:meas.st}], 'スタート練習');
  $('measSlit').hidden=!(practiceSlit && practiceSlit.archived);
  const tb = $('measBody'); tb.textContent = '';
  const row = (name, a, best) => {
    const tr = document.createElement('tr');
    [name, ...a].forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i && best != null && i - 1 === best) td.className = 'best'; tr.appendChild(td); });
    tb.appendChild(tr);
  };
  for (const k of ['tenji', 'choku', 'mawari']) {
    const a = [0, 1].map(i => meas.t[k][i] != null ? meas.t[k][i].toFixed(2) : '—');
    const vals = meas.t[k].filter(v => v != null);
    row(MEAS_JA[k], a, vals.length === 2 ? (meas.t[k][0] <= meas.t[k][1] ? 0 : 1) : null);
  }
  row(MEAS_JA.isshu, [meas.t.isshu[0] != null ? meas.t.isshu[0].toFixed(2) : '—', ''], null);
  row('ST', [meas.st == null ? '—' : meas.st < 0 ? 'F ' + fmtST(-meas.st) : fmtST(meas.st), ''], null);
  row('2周タイム', [fmtRT(total), ''], null);
  $('measNote').textContent = '展示＝2マーク手前150m（伸び）／直線＝1マークを出た後の行き足／まわり足＝1マーク手前22mから回って出口23mまで／一周＝バック側の計測線から1周。緑は2周のうち良い方。';
  paused = true; $('meas').hidden = false;
}
$('measAgain').addEventListener('click', () => { $('meas').hidden = true; paused = false; last = performance.now(); soloRestart(); });
$('measClose').addEventListener('click', () => { $('meas').hidden = true; paused = false; last = performance.now(); });

function resetBoat() {
  resetVirtualPosture();
  Object.assign(B, { x: START.x, y: START.y, a: START.a, v: 4, vl: 0, yaw: 0, porp: 0, cap: 0, zig: null, zigTold: false, deashi: 1, nobi: 1, tilt: playerTilt, logged: false });
  if (runLog) runLogEnd('途中でやり直し');
  input.thr = 0; wake.length = 0; spray.length = 0; T.on = false;
  cam.x = B.x; cam.y = B.y;
  lap.n = 0; lap.start = time; lap.visR = lap.visL = false; lap.prevY = B.y;
  measReset();
}
// 展示航走: one boat, from the back straight round 2M; the timing starts when it crosses the slit, then 2 laps
function beginTenji() {
  soloKind = 'tenji';
  resetBoat();
  Object.assign(B, { x: 70, y: -24, a: Math.PI, v: 14 });
  cam.x = B.x; cam.y = B.y; lap.prevY = B.y;
  SS.phase = 'tenji'; SS.hideAt = 0; practiceSlit = null;
  $('measSlit').hidden = true; $('clock').hidden = true;
  toast('展示航走', '2マークを回ってスリットを越えたら計測開始（2周）', 'info');
}
function beginStart() {
  soloKind = 'clock';
  resetBoat();
  SS.phase = 'count'; SS.t0 = time; SS.hideAt = 0;
  practiceSlit=slitCreate('スタート練習');
  $('measSlit').hidden=true;
  $('clock').hidden = false;
  toast('大時計スタート', '針が0を指してから1秒以内にスタートラインを越える', 'info');
}
const fmtRT = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}'${String(Math.floor(s)).padStart(2, '0')}"${Math.floor((s % 1) * 10)}`; };
const fmtST = v => v >= 1 ? v.toFixed(2) : '.' + String(Math.round(v * 100)).padStart(2, '0');
function judgeStart(st,at=time) {
  SS.phase = 'done'; SS.hideAt = time + 2.5;
  lap.start = at;
  meas.on = true; meas.startAt = at; meas.st = st;
  if (st < 0) toast('フライング', `F ${fmtST(-st)}　針が0になる前に越えた`, 'bad');
  else if (st <= 0.15) toast('好スタート', `ST ${fmtST(st)}`, 'good');
  else if (st <= 0.3) toast('スタート', `ST ${fmtST(st)}`, 'warn');
  else toast('遅れ気味', `ST ${fmtST(st)}`, 'bad');
}

/* ---------- keyboard ---------- */
addEventListener('keydown', e => { if(lab.active || !$('labSetup').hidden || !$('slitPhoto').hidden)return; keys.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (e.code === 'Space' && !e.repeat && fleet && fleet.entry && fleet.playerNo) playerDash(); });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/* ---------- touch: left half = throttle lever, right half = rudder ---------- */
const ptrs = new Map();
let steerTouch = false;
const leverSpan = () => $('track').getBoundingClientRect().height || 200;
function sideOn(side) { $(side === 'thr' ? 'lever' : 'wheel').classList.toggle('on', [...ptrs.values()].some(p => p.side === side)); }
cv.addEventListener('pointerdown', e => {
  if (!running || paused || (fleet && !playerActive())) return;
  e.preventDefault();
  if(controlMode==='wheel'&&e.clientX<W*.5)return;
  const side = controlMode==='wheel'?'thr':e.clientX < W * 0.5 ? 'thr' : 'steer';
  ptrs.set(e.pointerId, { side, x0: e.clientX, y0: e.clientY, v0: input.thr });
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (side === 'steer') { steerTouch = true; input.steerT = 0; }
  sideOn(side);
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (p.side === 'thr') input.thr = clamp(p.v0 + (p.y0 - e.clientY) / leverSpan(), 0, 1);
  else input.steerT = clamp((e.clientX - p.x0) / (Math.min(W, H) * 0.2));
});
function endPtr(e) {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (p.side === 'steer') { steerTouch = [...ptrs.values()].some(q => q.side === 'steer'); if (!steerTouch) input.steerT = 0; }
  sideOn(p.side);
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);

/* ---------- optional left-hand virtual posture stick ---------- */
function resetVirtualPosture(){
 const id=virtualPosture.pointer;virtualPosture.pointer=null;virtualPosture.roll=virtualPosture.pitch=0;
 const zone=$('postureZone');zone.classList.remove('active');$('postureThumb').style.transform='translate(0px,0px)';
 if(id!=null)try{zone.releasePointerCapture(id);}catch(_){}
}
async function setControlMode(mode,persist=true){
 if(!['tilt','pad','wheel'].includes(mode))mode='tilt';
 controlMode=mode;virtualPosture.enabled=mode!=='tilt';resetVirtualPosture();
 for(const id of ptrs.keys())try{cv.releasePointerCapture(id);}catch(_){}ptrs.clear();steerTouch=false;keys.clear();sideOn('thr');sideOn('steer');
 raw.roll=raw.pitch=input.roll=input.pitch=input.steer=input.steerT=0;
 phoneWheel.base=phoneWheel.last=null;phoneWheel.kind=null;phoneWheel.value=phoneWheel.deg=0;
 $('controlMode').value=mode;for(const e of document.querySelectorAll('[name="startControlMode"]'))e.checked=e.value===mode;
 $('postureStick').hidden=!virtualPosture.enabled;$('phoneSteerReadout').hidden=mode!=='wheel';$('wheelSettings').hidden=mode!=='wheel';
 document.body.classList.toggle('virtual-pad',virtualPosture.enabled);document.body.classList.toggle('phone-wheel',mode==='wheel');
 const help={tilt:'左手でアクセル、右手で舵。スマホの左右・前後の傾きで姿勢を操作します。',pad:'左手側にアクセルと姿勢パッド、右手側に舵。傾きセンサーは停止します。',wheel:'左手は姿勢パッド、右手はアクセル。スマホをハンドルのように時計回りで右舵、反時計回りで左舵。センサーは舵だけに使います。'};
 $('controlHelp').textContent=$('postureModeNote').textContent=help[mode];
 $('zero').disabled=mode==='pad';$('zero').textContent=mode==='wheel'?'今の持ち方を舵の中央にする':'今の持ち方を姿勢の基準にする';
 for(const id of ['invR','invP','sens'])$(id).disabled=mode!=='tilt';
 if(persist)try{localStorage.setItem('honorGP.controlMode',mode);}catch(_){}
 disableTiltInput();sensor.got=false;sensor.calib=null;sensor.last=null;sensor.src=null;gs.init=false;
 if(mode==='pad')$('note').hidden=true;
 else if(running){const ok=await enableTiltInput();if(controlMode===mode)afterStartCheck(ok);}
}
function moveVirtualPosture(e){
 const r=$('postureZone').getBoundingClientRect(),radius=Math.max(1,r.width/2-18);
 let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
 const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 const dead=.08,mag=Math.hypot(x,y),scale=mag>dead?(mag-dead)/((1-dead)*mag):0;
 virtualPosture.roll=x*scale;virtualPosture.pitch=-y*scale;
 $('postureThumb').style.transform=`translate(${x*radius}px,${y*radius}px)`;
}
$('postureZone').addEventListener('pointerdown',e=>{
 e.preventDefault();e.stopPropagation();
 if(!virtualPosture.enabled||!running||paused||lab.active||(fleet&&!playerActive())||virtualPosture.pointer!=null)return;
 virtualPosture.pointer=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
 e.currentTarget.classList.add('active');moveVirtualPosture(e);
});
$('postureZone').addEventListener('pointermove',e=>{if(e.pointerId!==virtualPosture.pointer)return;e.preventDefault();e.stopPropagation();moveVirtualPosture(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('postureZone').addEventListener(name,e=>{if(e.pointerId===virtualPosture.pointer)resetVirtualPosture();});
for(const e of document.querySelectorAll('[name="startControlMode"]'))e.addEventListener('change',()=>{if(e.checked)setControlMode(e.value);});
$('controlMode').addEventListener('change',e=>setControlMode(e.target.value));
$('wheelRange').addEventListener('input',e=>{phoneWheel.range=+e.target.value;$('wheelRangeOut').textContent=e.target.value+'°';});
$('wheelInvert').addEventListener('change',e=>{phoneWheel.invert=e.target.checked;resetPhoneWheel();});
addEventListener('blur',resetVirtualPosture);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetVirtualPosture();});
/* ---------- game controller (Gamepad API, standard layout) ----------
   LT = throttle lever (left hand, like the real boat; RT can be chosen in settings)
   right stick ←→ = rudder,  left stick ←→ = lean,  left stick ↑ = 伏せる / ↓ = 体を起こす
   A = start / OK / もう一度 / コース主張,  X = 練習をやり直す,  B = 引く（待機行動中。画面が開いていれば閉じる）,  Y = 引く,  Menu = settings */
const pad = { idx: -1, seenAt: -1, useRT: false, prev: [] };
const padDz = v => Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88;
// Embedded views (like the in-app preview) can forbid controller access outright; then getGamepads
// throws. Treat that as "no controller" for the rest of the session instead of letting it stop the game.
let padBlocked = false;
function currentPad() {
  if (padBlocked || !navigator.getGamepads) return null;
  let list;
  try { list = navigator.getGamepads(); } catch (e) { padBlocked = true; return null; }
  for (const g of list || []) if (g && g.connected) return g;
  return null;
}
/* ---- コントローラでメニュー操作: 十字キー／左スティックで選び、A＝決定、B＝キャンセル ----
   Works on whichever menu is on top (overlays, the lab screens, the replay chip). */
const PAD_MENU = { repeat0: 0.38, repeat: 0.14, stick: 0.55 };
const padNav = { surf: null, el: null, held: 0, t: 0 };
function padMenuSurface() {
  let best = null, bz = -1;
  for (const el of document.querySelectorAll('.overlay, #labSetup, #labRun, #rpChip')) {
    if (el.hidden || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const z = +getComputedStyle(el).zIndex || 0;
    if (z >= bz) { bz = z; best = el; }
  }
  return best;
}
function padMenuItems(surf) {
  return [...surf.querySelectorAll('button, select, input, textarea, summary, [tabindex="0"]')].filter(e => !e.disabled && e.offsetParent !== null && !e.closest('[hidden]') && !(e.tagName === 'INPUT' && e.type === 'hidden') && !(e.tagName === 'TEXTAREA' && e.readOnly));
}
function padMenuMark(el) {
  if (padNav.el && padNav.el !== el) padNav.el.classList.remove('padfocus');
  padNav.el = el;
  if (!el) return;
  el.classList.add('padfocus');
  try { el.focus({ preventScroll: true }); } catch (e) {}
  try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
}
function padMenuCancel(surf) {
  const items = [...surf.querySelectorAll('button')].filter(e => !e.disabled && e.offsetParent !== null);
  const c = items.find(e => /(Close|close|No|Skip|Cancel)$/.test(e.id) || /^(やめる|閉じる|キャンセル|いいえ|残さない)/.test(e.textContent.trim()));
  if (c) { c.click(); return true; }
  return false;
}
// true while a menu is open (the controller is driving the menu, not the boat)
function padMenu(g, down, edge, dt) {
  const surf = padMenuSurface();
  if (!surf) { if (padNav.el) padMenuMark(null); padNav.surf = null; return false; }
  const items = padMenuItems(surf);
  if (padNav.surf !== surf || !items.includes(padNav.el)) {
    padNav.surf = surf;
    // start on the menu's main button (the first .btn that isn't a ghost), else the first item
    padMenuMark(items.find(e => e.classList.contains('btn') && !e.classList.contains('ghost')) || items[0] || null);
  }
  const ay = g.axes[1] || 0, ax = g.axes[0] || 0;
  const dir = down(12) || ay < -PAD_MENU.stick ? -1 : down(13) || ay > PAD_MENU.stick ? 1 : 0;
  const side = down(14) || ax < -PAD_MENU.stick ? -1 : down(15) || ax > PAD_MENU.stick ? 1 : 0;
  const any = dir || side;
  let step = false;
  if (!any) padNav.held = 0;
  else if (padNav.held === 0) { step = true; padNav.held = 1; padNav.t = PAD_MENU.repeat0; }
  else { padNav.t -= dt; if (padNav.t <= 0) { step = true; padNav.t = PAD_MENU.repeat; } }
  const el = padNav.el;
  if (step && el) {
    const adjust = side && !dir && (el.tagName === 'SELECT' || el.tagName === 'INPUT' && el.type === 'range');
    if (adjust) {
      if (el.tagName === 'SELECT') { const i = clamp(el.selectedIndex + side, 0, el.options.length - 1); if (i !== el.selectedIndex) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); } }
      else { if (side > 0) el.stepUp(); else el.stepDown(); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    } else if (items.length) {
      const i = items.indexOf(el), d = dir || side;
      padMenuMark(items[(i + d + items.length) % items.length]);
    }
  }
  if (edge(0) && padNav.el) {
    const e = padNav.el;
    if (e.tagName === 'SELECT') { const i = (e.selectedIndex + 1) % e.options.length; e.selectedIndex = i; e.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'number')) { try { e.focus(); } catch (x) {} }
    else e.click();
  }
  if (edge(1)) padMenuCancel(surf);
  return true;
}
function pollPadButtons(dt = 0) {
  const g = currentPad();
  $('padTag').hidden = !g;
  if (!g) return;
  const down = i => !!(g.buttons[i] && g.buttons[i].pressed);
  const edge = i => down(i) && !pad.prev[i];
  // a menu is open: the controller works the menu (Start still opens/closes 設定)
  if (padMenu(g, down, edge, dt) && !edge(9)) { pad.prev = g.buttons.map(b => b.pressed); return; }
  if (edge(0) && running && !paused && fleet && fleet.entry && $('start').hidden && !calib.open) playerClaim();   // A = コース主張
  else if (edge(0) && !$('start').hidden) start();
  else if (edge(0) && calib.open) closeCalib();
  else if (edge(0) && !$('rotate').hidden) { portraitOk = true; $('rotate').hidden = true; }
  else if (edge(0) && !$('meas').hidden) $('measAgain').click();   // 計測結果: A = もう一度
  if (edge(9)) { if ($('settings').hidden) { if (running) { paused = true; $('settings').hidden = false; } } else { paused = false; last = performance.now(); $('settings').hidden = true; } }
  if (edge(1)) {
    if (!$('settings').hidden) { paused = false; last = performance.now(); $('settings').hidden = true; }
    else if (!$('card').hidden) { paused = false; last = performance.now(); $('card').hidden = true; }
    else if (!$('meas').hidden) $('measClose').click();
    else if (running && !paused && fleet && fleet.entry && fleet.playerNo) playerDash();   // 待機行動中: B = 引く（ダッシュ）
  }
  if (edge(2) && running && $('settings').hidden && $('card').hidden) restartPractice();   // X = 練習をやり直す
  if (edge(3) && running && !paused && fleet && fleet.entry && fleet.playerNo) playerDash();
  pad.prev = g.buttons.map(b => b.pressed);
}
// returns the controller's four channels, or null when no controller is in use
function readPad() {
  const g = currentPad();
  if (!g) return null;
  const trig = i => (g.buttons[i] ? g.buttons[i].value : 0);
  const thr = trig(pad.useRT ? 7 : 6);
  const steer = padDz(g.axes[2] || 0), roll = padDz(g.axes[0] || 0), pitch = -padDz(g.axes[1] || 0);
  if (thr > 0.02 || steer || roll || pitch) pad.seenAt = performance.now();
  // once touched, the controller drives until it has sat idle for 3 s (so touch/keys can take back over)
  if (pad.seenAt < 0 || performance.now() - pad.seenAt > 3000) return null;
  return { thr, steer, roll, pitch };
}
addEventListener('gamepadconnected', e => toast('コントローラ接続', `${pad.useRT ? '右' : '左'}トリガー＝スロットル／右スティック＝舵／左スティック＝体重移動`, 'info'));
addEventListener('gamepaddisconnected', () => toast('コントローラ切断', 'タッチ・キーボード操作に戻りました', 'info'));

/* ---------- haptics (controller rumble / Android vibration) ----------
   Four layers, each with its own feel:
     コーナー    a light, steady hum on the high-frequency motor that grows with how hard the boat is turning
     引き波      a short heavy knock each time the hull slams over a wave line
     安定度      a heartbeat — ドクン、ドクン — that quickens and hardens as the boat nears the danger line
     危険ライン超え  both motors flat out and ragged
   Plus one-shots for a hit or a capsize. Phones only get on/off buzzes, so strength becomes pulse length. */
const hap = { on: true, beat: -1, beatT: 0, beatMag: 0, knock: 0, lastBump: 0, shot: 0, shotMag: 0, sendT: 0, phoneBusy: 0, phonePri: 0, humT: 0, active: false };
function hapticShot(dur, mag) { hap.shot = Math.max(hap.shot, dur); hap.shotMag = Math.max(hap.shotMag, mag); }
function phoneBuzz(pattern, pri, busyMs) {
  if (!navigator.vibrate) return;
  const now = performance.now();
  if (now < hap.phoneBusy && pri <= hap.phonePri) return;
  try { navigator.vibrate(pattern); } catch (e) {}
  hap.phoneBusy = now + busyMs; hap.phonePri = pri;
}
function hapticsStop() {
  if (!hap.active) return;
  hap.active = false;
  const g = currentPad();
  if (g && g.vibrationActuator && g.vibrationActuator.reset) g.vibrationActuator.reset().catch(() => {});
  try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
}
function hapticsFrame(dt, b) {
  if (!hap.on || !running || paused || (fleet && !playerRacing(playerRow()))) { hapticsStop(); return; }
  hap.active = true;
  const load = b.cap > 0 ? 0 : (b.load || 0), turn = b.cap > 0 ? 0 : (b.turnLoadV || 0), bump = b.wakeBump || 0;
  let strong = 0, weak = 0, phone = null;
  // コーナー: steady hum
  const hum = clamp((turn - 0.3) / 0.55, 0, 1);
  weak = Math.max(weak, hum * 0.35);
  // 引き波: a knock on each new wave line
  if (bump > 0.25 && hap.lastBump <= 0.25) { hap.knock = 0.09; phone = { p: 30, pri: 2, ms: 60 }; }
  hap.lastBump = bump;
  if (hap.knock > 0) { hap.knock -= dt; strong = Math.max(strong, 0.35 + 0.6 * bump); }
  // 安定度: heartbeat from 0.6 up to the line
  if (load > 0.6 && load < 1) {
    const x = (load - 0.6) / 0.4;
    hap.beatT -= dt;
    if (hap.beatT <= 0) {
      hap.beatT = 0.9 - 0.65 * x; hap.beat = 0; hap.beatMag = 0.3 + 0.55 * x;
      phone = { p: [Math.round(20 + 25 * x), 60, Math.round(15 + 20 * x)], pri: 2, ms: 160 };
    }
  } else hap.beatT = 0;
  if (hap.beat >= 0) {
    hap.beat += dt;
    const ph = hap.beat;
    if (ph < 0.07 || (ph > 0.14 && ph < 0.2)) { strong = Math.max(strong, hap.beatMag); weak = Math.max(weak, hap.beatMag * 0.4); }
    if (ph > 0.2) hap.beat = -1;
  }
  // 危険ライン超え: violent and ragged
  if (load >= 1) {
    strong = 0.85 + 0.15 * simRandom(); weak = 0.7 + 0.3 * simRandom();
    phone = { p: [90, 25, 70, 25, 110], pri: 3, ms: 300 };
  }
  // one-shots
  if (hap.shot > 0) { hap.shot -= dt; strong = Math.max(strong, hap.shotMag); weak = Math.max(weak, hap.shotMag); phone = { p: Math.round(hap.shotMag * 300), pri: 4, ms: 320 }; if (hap.shot <= 0) hap.shotMag = 0; }
  // controller: refresh the rumble every 50 ms with an overlapping 90 ms effect so it reads as continuous
  const now = performance.now(), g = currentPad();
  if (g && now - hap.sendT > 50) {
    hap.sendT = now;
    const va = g.vibrationActuator;
    if (va && va.playEffect) va.playEffect('dual-rumble', { startDelay: 0, duration: 90, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {});
    else if (g.hapticActuators && g.hapticActuators[0]) { try { g.hapticActuators[0].pulse(Math.max(strong, weak), 90); } catch (e) {} }
  }
  // phone (no controller in use): priority buzzes, and a faint tick for the corner hum
  if (!g || pad.seenAt < 0) {
    if (phone) phoneBuzz(phone.p, phone.pri, phone.ms);
    else if (hum > 0.2) { hap.humT -= dt; if (hap.humT <= 0) { hap.humT = 0.12; phoneBuzz(Math.round(4 + 10 * hum), 1, 40); } }
  }
}

function updateInput(dt) {
  const k = 1 - Math.exp(-dt * 10);
  const gp = readPad();
  if (gp) {
    // the controller is driving: it sets all four channels
    input.thr += (gp.thr - input.thr) * (1 - Math.exp(-dt * 14));
    input.steer += ((controlMode==='wheel'?phoneWheel.value:gp.steer) - input.steer) * (1 - Math.exp(-dt * 12));
    // left stick = posture; the on-screen posture pad only takes over while a finger is actually on it
    const vp = virtualPosture.enabled && virtualPosture.pointer != null;
    input.roll += ((vp ? virtualPosture.roll : gp.roll) - input.roll) * k;
    input.pitch += ((vp ? virtualPosture.pitch : gp.pitch) - input.pitch) * k;
    return;
  }
  if (keys.has('KeyW')) input.thr = Math.min(1, input.thr + dt * 1.2);
  if (keys.has('KeyS')) input.thr = Math.max(0, input.thr - dt * 1.2);
  const ks = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const st = controlMode==='wheel'?phoneWheel.value:steerTouch ? input.steerT : ks;
  input.steer += (st - input.steer) * (1 - Math.exp(-dt * 9));
  const kr = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  const kp = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
  let tr = raw.roll, tp = raw.pitch;
  if(virtualPosture.enabled){tr=virtualPosture.roll;tp=virtualPosture.pitch;if(virtualPosture.pointer==null&&(kr||kp)){tr=kr;tp=kp;}}
  else if (kr || kp || !sensor.got) { tr = kr; tp = kp; }
  input.roll += (tr - input.roll) * k;
  input.pitch += (tp - input.pitch) * k;
}

/* ---------- boat physics (metres, seconds) ----------
   Shared by the player and any CPU boat.
   inp = { thr 0..1 lever, steer -1..1 rudder (right +), roll -1..1 lean (right +), pitch -1..1 (forward lean +) }
   Returns null, or an event: 'cap:<reason>', 'buoy', 'wall'. */
