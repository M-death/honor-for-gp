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
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if(lab.active){
    if(!paused&&!lab.finished&&$('labSetup').hidden){
      lab.accumulator+=dt*lab.rate;
      while(lab.accumulator>=1/120&&!paused&&!lab.finished){labStep();lab.accumulator-=1/120;}
    }
    pollPadButtons(dt);hapticsStop();updateAudio();draw();labUpdate();return;
  }
  pollPadButtons(dt);
  if (running && !paused) {
    if (fleet && playerActive()) { updateInput(dt); fleetStep(dt / 2, input); fleetStep(dt / 2, input); cutinCheck(); const pr = playerRow(); if (pr && playerRacing(pr)) hapticsFrame(dt, pr.b); }   // practice runs in real time
    else if (fleet) { const n = Math.ceil(simSpeed * 2); for (let i = 0; i < n; i++) fleetStep(dt * simSpeed / n, input); }
    else { updateInput(dt); step(dt / 2); step(dt / 2); hapticsFrame(dt, B); }
  }
  if (!running || paused || (fleet && !playerRacing(playerRow()))) hapticsStop();
  updateAudio();
  draw(); updateHud();
}
document.addEventListener('visibilitychange', () => { last = performance.now(); keys.clear(); });
resize();
requestAnimationFrame(frame);
