// Honor for GP — メインループ
let last = performance.now();
// d184 (まえ): fps in the corner (設定・公開後も残す) — to compare 艇の表示 on one's own phone/PC. Counts real frames.
const FPS = { on: false, n: 0, t0: 0 };
try { FPS.on = localStorage.getItem('honorGP.fps') === 'on'; } catch (e) {}
function fpsShow() { const el = $('fpsTag'); if (el) el.hidden = !FPS.on; const c = $('fpsOn'); if (c) c.checked = FPS.on; }
function fpsCount(now) {
  if (!FPS.on) return;
  if (!FPS.t0) { FPS.t0 = now; FPS.n = 0; return; }
  FPS.n++;
  if (now - FPS.t0 >= 1000) {
    const f = Math.round(FPS.n * 1000 / (now - FPS.t0)), B3 = window.Boat3D;
    const how = !B3 || B3.mode === '2d' ? '2D' : B3.via === 'x' ? '新モデル' : B3.ready ? '軽量3D' : '2D';
    $('fpsTag').textContent = `${f} fps・${how}`; FPS.t0 = now; FPS.n = 0;
  }
}
if ($('fpsOn')) $('fpsOn').addEventListener('change', e => { FPS.on = e.target.checked; FPS.t0 = 0; try { localStorage.setItem('honorGP.fps', FPS.on ? 'on' : 'off'); } catch (x) {} fpsShow(); });
fpsShow();
function frame(now) {
  fpsCount(now);
  // never let one bad frame stop the loop
  try { tick(now); } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } }
  requestAnimationFrame(frame);
}
const STEP = { dt: 1 / 120, acc: 0, max: 12 };   // d268: fixed physics step (max 12 a frame, 0.1 s)
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (typeof RPV !== 'undefined' && RPV.on) { rpvFrame(dt); return; }   // d228 ゲーム内リプレイ: the recorded race is drawn, nothing runs
  if(lab.active){
    if(!paused&&!lab.finished&&$('labSetup').hidden){
      lab.accumulator+=dt*lab.rate;
      while(lab.accumulator>=1/120&&!paused&&!lab.finished){labStep();lab.accumulator-=1/120;}
    }
    pollPadButtons(dt);hapticsStop();updateAudioAll();draw();labUpdate();return;
  }
  pollPadButtons(dt);
  if (running && !paused) {
    // d268 (まえ: 3Dで走ると速すぎる、ミスだらけでレコード): the physics ran one or two steps of half a frame, so its step size
    // followed the frame rate — a slower frame (the 3D view, a busy PC) made bigger steps and a quicker boat (CPU solo,
    // 1/40 s steps ≈ 0.5 s a run faster than 1/120). Now always fixed 1/120 s steps, as many as the real time needs
    // (at 60 fps the same two steps a frame as before, so 2D at 60 fps is unchanged).
    const steps = n => { STEP.acc = Math.min(STEP.acc + n, STEP.max * STEP.dt); const k = Math.floor(STEP.acc / STEP.dt + 1e-6); STEP.acc -= k * STEP.dt; return k; };
    if (fleet && playerActive()) { updateInput(dt); for (let k = steps(dt); k > 0; k--) fleetStep(STEP.dt, input); cutinCheck(); const pr = playerRow(); if (pr && playerRacing(pr)) hapticsFrame(dt, pr.b); }   // practice runs in real time
    else if (fleet) { for (let k = steps(dt * simSpeed); k > 0; k--) fleetStep(STEP.dt, input); }
    else { updateInput(dt); for (let k = steps(dt); k > 0; k--) step(STEP.dt); hapticsFrame(dt, B); }
  }
  if (!running || paused || (fleet && !playerRacing(playerRow()))) hapticsStop();
  updateAudioAll();
  draw(); updateHud();
}
document.addEventListener('visibilitychange', () => { last = performance.now(); keys.clear(); });
resize();
requestAnimationFrame(frame);
