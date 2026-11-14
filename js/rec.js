/* ---------- 簡易リプレイ動画 (d304, まえ: ゲームプレイの視点そのもので、音はゲーム中のものをそのまま、視点は作成時に選んだものだけ;
   スタート20秒前から結果画面が出るまで) ----------
   From the race result: pick one view and the boat to follow, then the race's own 60 fps log is played back once at real
   speed in the game's replay (replay.js — nothing simulated again) while the screen and the game's sound are recorded in
   the browser (MediaRecorder: MP4 where the browser can, otherwise WebM). The picture is the game's own canvas (3D, its
   lens drops and sun flare, or 2D) cropped to 16:9, with a small HUD drawn on it (clock, order, the boat's speed, 実況, the
   result). The sound: the same engines / water / clock pips, and the race BGM and goal fanfare when the player raced.
   It takes as long as the race: start −20 s to the end of the log (5 s after the race is decided ≈ when the result shows). */
const REC = { on: false, mr: null, chunks: [], cv: null, g: null, dest: null, W: 1280, H: 720, pre: 20, warm: 1.2, mime: '', url: null, ext: 'webm', ui: null, ind: null, view: '', no: 0, jk: null, jkI: 0, P: null, cancel: false };
const REC_VIEWS = [['3d:chase', '3D 追尾'], ['3d:racer', '3D レーサー'], ['3d:top', '3D 上空'], ['2d:follow', '2D 追いかけ'], ['2d:auto', '2D 全艇']];
function recMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
const recCan = () => !!(document.createElement('canvas').captureStream) && recMime() !== null;
const rec3dOk = () => { const V = window.View3D; return !!V && !V.error; };

// the panel under the result: 視点 / 艇 / 録画開始, then the save link
function recPanel(host, msgEl) {
  try { clearTimeout(resTimer); resTimer = 0; clearInterval(resCountT); resCountT = 0; } catch (e) {}   // (6艇デモ: stay on this result)
  if (msgEl && /^次へ進むと/.test(msgEl.textContent)) msgEl.hidden = true;   // the demo's countdown is stopped now
  let p = REC.ui;
  if (!p) {
    p = REC.ui = document.createElement('div'); p.id = 'recBox';
    p.style.cssText = 'margin:8px 0 0;padding:8px 10px;border:1px solid var(--hud-line,#355);border-radius:8px;font-size:13px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center';
    p.innerHTML = '<b style="width:100%">リプレイ動画を作る（スタート20秒前〜結果まで・等速で録画）</b>' +
      '<label>視点 <select id="recView"></select></label><label>追う艇 <select id="recNo"></select></label>' +
      '<button class="btn" id="recGo">録画開始</button><span id="recMsg" style="width:100%;font-size:12px;color:var(--muted,#9bb)"></span><a id="recSave" class="btn" hidden>動画を保存</a><button class="btn ghost" id="recShare" hidden>共有</button>';
  }
  host.after(p); p.hidden = false; p.dataset.msg = msgEl ? msgEl.id : '';
  const vs = p.querySelector('#recView'); if (!vs.options.length || vs.dataset.v3 !== String(rec3dOk())) {
    vs.textContent = ''; vs.dataset.v3 = String(rec3dOk());
    for (const [v, t] of REC_VIEWS) if (v.startsWith('2d') || rec3dOk()) { const o = document.createElement('option'); o.value = v; o.textContent = t; vs.appendChild(o); }
    let last = ''; try { last = localStorage.getItem('honorGP.recView') || ''; } catch (e) {}
    const V = window.View3D, now = V && !V.error ? (V.mode === 'chase' || V.mode === 'racer' || V.mode === 'top' ? '3d:' + V.mode : '2d:follow') : '2d:follow';
    vs.value = [...vs.options].some(o => o.value === last) ? last : now; if (vs.selectedIndex < 0) vs.selectedIndex = 0;
  }
  const ns = p.querySelector('#recNo'); ns.textContent = '';
  const rows = fleet && fleet.boats ? fleet.boats : [], me = fleet && fleet.playerNo;
  for (const r of rows) { const o = document.createElement('option'); o.value = r.no; o.textContent = `${r.no}号艇${r.no === me ? '（自分）' : ''}`; ns.appendChild(o); }
  if (!rows.length) { const o = document.createElement('option'); o.value = 1; o.textContent = '1号艇'; ns.appendChild(o); }
  ns.value = String(me || (fleet && fleet.focus) || 1); ns.parentElement.hidden = rows.length < 2;
  p.querySelector('#recGo').onclick = () => recStart(vs.value, +ns.value, msgEl);
  if (!REC.url) { p.querySelector('#recSave').hidden = true; p.querySelector('#recShare').hidden = true; p.querySelector('#recMsg').textContent = recCan() ? '' : 'このブラウザは画面の録画ができません'; }
  p.querySelector('#recGo').disabled = !recCan();
}

async function recStart(view, no, msgEl) {
  if (REC.on) return;
  const msg = t => { const m = REC.ui && REC.ui.querySelector('#recMsg'); if (m) m.textContent = t; };
  try { localStorage.setItem('honorGP.recView', view); } catch (e) {}
  if (REC.url) { URL.revokeObjectURL(REC.url); REC.url = null; }
  initAudio();
  msg('準備中…');
  REC.on = true; REC.cancel = false; REC.view = view; REC.no = no;
  await rpvFromRecorder(msgEl);
  if (!RPV.on) { REC.on = false; msg('このレースのリプレイは用意できませんでした'); return; }
  const P = REC.P = RPV.P;
  // the view picked, and nothing else
  const V = window.View3D, [d, v] = view.split(':');
  if (d === '3d' && V && !V.error) { if (v === 'top') { rpvDisp(true); $('rpvCam').value = 'follow'; rpvCamSet('follow'); } else { $('rpvCam').value = 'v3:' + v; rpvCamSet('v3:' + v); } }
  else { if (V && !V.error && V.mode !== '2d') V.setMode('2d'); $('rpvCam').value = v || 'follow'; rpvCamSet(v || 'follow'); }
  if (P.rows.some(r => r.no === no)) fleet.focus = no;
  // the player's boat drives the race BGM / fanfare (replay.js keeps BGM off otherwise)
  for (const r of P.rows) r.player = r.no === P.playerNo;
  bgm.goalKey = null; bgm.goal = null;
  // from 20 s before the start, held still for a moment so the 3D view has drawn the place
  RPV.play = false; rpvSeekTo(Math.max(P.t0, -REC.pre));
  document.body.classList.add('rpvrec');
  recIndicator(true);
  REC.jk = (P.d.events || []).filter(e => e.type === 'jikkyo' && e.payload && e.payload.text); REC.jkI = 0;
  { const t0 = performance.now(); await new Promise(res => setTimeout(res, REC.warm * 1000));   // 3D models may still be loading the first time
    while (d === '3d' && window.View3D && !window.View3D.ready && !window.View3D.error && performance.now() - t0 < 10000) await new Promise(res => setTimeout(res, 200)); }
  if (REC.cancel || !RPV.on) return recEnd(true);
  // the canvas that is recorded, 16:9
  if (!REC.cv) { REC.cv = document.createElement('canvas'); REC.g = REC.cv.getContext('2d'); }
  const big = Math.max(innerWidth, innerHeight) * Math.min(2, devicePixelRatio || 1) >= 1800;
  REC.W = big ? 1920 : 1280; REC.H = REC.W * 9 / 16; REC.cv.width = REC.W; REC.cv.height = REC.H;
  recCompose();
  const vs = REC.cv.captureStream(60), tracks = [...vs.getVideoTracks()];
  try {
    const c = snd.ctx; if (c) {
      if (!REC.dest) REC.dest = c.createMediaStreamDestination();
      recTapAudio(true);
      tracks.push(...REC.dest.stream.getAudioTracks());
    }
  } catch (e) {}
  REC.mime = recMime(); REC.ext = /mp4/.test(REC.mime) ? 'mp4' : 'webm';
  try { REC.mr = new MediaRecorder(new MediaStream(tracks), Object.assign({ videoBitsPerSecond: REC.W > 1280 ? 12e6 : 8e6, audioBitsPerSecond: 160e3 }, REC.mime ? { mimeType: REC.mime } : {})); }
  catch (e) { msg('録画を始められませんでした：' + e.message); return recEnd(true); }
  REC.chunks = [];
  REC.mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.mr.onstop = () => recDone();
  REC.mr.start(1000);
  RPV.play = true; RPV.rate = 1; $('rpvRate').value = '1';
}
// the game's sound into the recording too (the speakers keep it)
function recTapAudio(on) {
  const c = snd.ctx; if (!c || !REC.dest) return;
  const outs = []; if (snd.comp || snd.master) outs.push(snd.comp || snd.master); if (bgm.out) outs.push(bgm.out);
  for (const n of outs) { try { if (on) n.connect(REC.dest); else n.disconnect(REC.dest); } catch (e) {} }
}
function recIndicator(on) {
  if (!REC.ind) {
    const d = REC.ind = document.createElement('div');
    d.style.cssText = 'position:fixed;right:calc(12px + var(--sr,0px));bottom:calc(12px + var(--sb,0px));z-index:30;background:rgba(10,14,20,.82);color:#fff;border-radius:20px;padding:6px 8px 6px 14px;font-size:13px;display:flex;gap:10px;align-items:center';
    d.innerHTML = '<span style="color:#ff4d4d">●</span><span id="recT">録画の準備</span><button class="btn ghost" id="recStop" style="padding:4px 10px">中止</button>';
    document.body.appendChild(d); d.querySelector('#recStop').onclick = () => { REC.cancel = true; if (REC.mr && REC.mr.state !== 'inactive') REC.mr.stop(); else recEnd(true); };
  }
  REC.ind.hidden = !on; REC.ind.style.display = on ? 'flex' : 'none';
}
// every frame: copy the screen in and draw the HUD (called after the 2D draw / the 3D render)
function recCompose() {
  if (!REC.on || !REC.cv || !RPV.on) return;
  const g = REC.g, W = REC.W, H = REC.H, V = window.View3D, three = V && !V.error && V.mode !== '2d';
  const src = three ? [$('cv3d'), $('lens3d'), $('flare3d')] : [$('cv')];
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (const c of src) {
    if (!c || !c.width || c.style.display === 'none') continue;
    const sw = c.width, sh = c.height, k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;   // cover, centred
    try { g.drawImage(c, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {}
  }
  recHud(g, W, H);
  if (REC.mr && REC.mr.state === 'recording') {
    const P = REC.P, el = $('recT'); if (el) el.textContent = `録画中 ${fmtClock(RPV.t - Math.max(P.t0, -REC.pre))} / ${fmtClock(P.t1 - Math.max(P.t0, -REC.pre))}`;
    if (RPV.t >= P.t1 - 1e-6 || !RPV.play) setTimeout(() => { if (REC.mr && REC.mr.state === 'recording') REC.mr.stop(); }, 400);   // the last frames, then stop
  }
}
const fmtClock = s => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
function recHud(g, W, H) {
  const P = REC.P, T = RPV.t, u = H / 720, d = P.d, Hh = d.header || {}, race = Hh.race || {};
  const box = (x, y, w, h, a = .62) => { g.fillStyle = `rgba(6,14,22,${a})`; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 10 * u) : g.rect(x, y, w, h); g.fill(); };
  g.textBaseline = 'middle'; g.textAlign = 'left';
  // top left: what race, the clock
  const title = P.solo ? 'タイムアタック' : Hh.mode === 'setsu' || Hh.setsu ? `節間 ${race.dayLabel || ''} ${race.raceNo ? race.raceNo + 'R' : ''}`.trim() : Hh.mode === 'demo' ? '6艇デモ' : '6艇レース';
  const venue = Hh.venue && (Hh.venue.name || Hh.venue.displayName) || '';
  box(16 * u, 14 * u, 300 * u, 70 * u);
  g.fillStyle = '#cfe3ea'; g.font = `600 ${15 * u}px system-ui,sans-serif`; g.fillText(`${title}${venue ? '　' + venue : ''}`, 28 * u, 32 * u);
  g.fillStyle = '#fff'; g.font = `700 ${26 * u}px system-ui,sans-serif`; g.fillText(T < 0 ? `スタートまで ${(-T).toFixed(1)}` : fmtRT(T), 28 * u, 62 * u);
  // the order (after the start), the boat followed and its speed
  const rows = P.rows;
  if (rows.length > 1 && T >= 0) {
    const ord = fleet.rank || rows, s = 34 * u; box(16 * u, 92 * u, (ord.length * (s + 6 * u)) + 18 * u, s + 16 * u);
    ord.forEach((q, i) => { const x = 25 * u + i * (s + 6 * u), y = 100 * u; g.globalAlpha = q.gone || q.out ? .4 : 1; g.fillStyle = q.col[0]; g.fillRect(x, y, s, s);
      g.fillStyle = q.col[1]; g.font = `800 ${20 * u}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(q.no, x + s / 2, y + s / 2 + u); g.textAlign = 'left'; g.globalAlpha = 1; });
  }
  const r = rows.find(q => q.no === fleet.focus) || rows[0];
  if (r) {
    box(16 * u, H - 74 * u, 260 * u, 58 * u);
    g.fillStyle = r.col[0]; g.fillRect(26 * u, H - 64 * u, 38 * u, 38 * u); g.fillStyle = r.col[1]; g.textAlign = 'center'; g.font = `800 ${22 * u}px system-ui,sans-serif`; g.fillText(r.no, 45 * u, H - 44 * u);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `700 ${30 * u}px system-ui,sans-serif`; const sv = `${Math.round(r.b.v * 3.6)}`; g.fillText(sv, 76 * u, H - 44 * u); const sx = 76 * u + g.measureText(sv).width + 8 * u;
    g.font = `500 ${14 * u}px system-ui,sans-serif`; g.fillStyle = '#cfe3ea'; g.fillText('km/h' + (r.name ? '　' + r.name : ''), sx, H - 44 * u);
  }
  // 実況: the line the game showed, for 4 s
  const J = REC.jk; while (REC.jkI < J.length && J[REC.jkI].t <= T - 4) REC.jkI++;
  const j = J.slice(REC.jkI).find(e => e.t <= T && e.t > T - 4);
  if (j) { g.font = `700 ${22 * u}px system-ui,sans-serif`; const tw = g.measureText(j.payload.text).width + 40 * u; box((W - tw) / 2, 18 * u, tw, 44 * u, .7); g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.fillText(j.payload.text, W / 2, 41 * u); g.textAlign = 'left'; }
  // the result once decided
  const res = d.results;
  if (res && P.decided != null && T >= P.decided) {
    const t = P.solo ? (res.time != null ? `タイム ${fmtRT(res.time)}${res.rank ? '（' + res.rank + '）' : ''}` : '記録なし') : (res.order || []).slice(0, 6).map(o => `${o.place}着 ${o.no}`).join('　') + (res.kimarite ? `　決まり手 ${res.kimarite}` : '');
    g.font = `800 ${28 * u}px system-ui,sans-serif`; const tw = g.measureText(t).width + 50 * u; box((W - tw) / 2, H / 2 - 34 * u, tw, 68 * u, .78);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(t, W / 2, H / 2); g.textAlign = 'left';
  }
}
function recDone() {
  const ok = !REC.cancel && REC.chunks.length;
  if (ok) {
    const blob = new Blob(REC.chunks, { type: (REC.mime || 'video/webm').split(';')[0] }); REC.url = URL.createObjectURL(blob); REC.blob = blob;
    const dt = new Date(), p2 = n => String(n).padStart(2, '0'), name = `hfgp_replay_${dt.getFullYear()}${p2(dt.getMonth() + 1)}${p2(dt.getDate())}_${p2(dt.getHours())}${p2(dt.getMinutes())}.${REC.ext}`;
    const a = REC.ui.querySelector('#recSave'); a.href = REC.url; a.download = name; a.hidden = false;
    const sh = REC.ui.querySelector('#recShare'), file = new File([blob], name, { type: blob.type });
    sh.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    sh.onclick = () => navigator.share({ files: [file] }).catch(() => {});
    REC.ui.querySelector('#recMsg').textContent = `できました（${REC.ext.toUpperCase()}・${(blob.size / 1048576).toFixed(1)} MB）`;
  } else if (REC.ui) REC.ui.querySelector('#recMsg').textContent = REC.cancel ? '録画を中止しました' : '録画できませんでした';
  recEnd(false);
}
function recEnd(early) {
  recTapAudio(false);
  REC.on = false; REC.mr = null; REC.chunks = []; REC.P = null;
  document.body.classList.remove('rpvrec'); recIndicator(false);
  if (RPV.on) { for (const r of RPV.P.rows) r.player = false; rpvClose(); }
  if (early && REC.ui) { const m = REC.ui.querySelector('#recMsg'); if (m && /準備/.test(m.textContent)) m.textContent = REC.cancel ? '録画を中止しました' : ''; }
}
{ // the hooks: compose after each 2D frame of the replay; 3D calls View3D.afterRender (play3d.js)
  // while recording the race runs on the wall clock (not the game's 0.05 s cap): a slow frame drops pictures instead of
  // slowing the race, so the picture keeps in time with the sound
  let wall = 0;
  const _f = rpvFrame; rpvFrame = dt => { const n = performance.now(); if (REC.mr && REC.mr.state === 'recording') dt = Math.min(.5, wall ? (n - wall) / 1000 : dt); wall = n; _f(dt); const V = window.View3D; if (REC.on && !(V && !V.error && V.mode !== '2d')) recCompose(); };
  window.recAfter3D = () => { if (REC.on) recCompose(); };
  // BGM while recording: the race track in time with the start, the goal fanfare when the player finishes (as in the race)
  const _w = bgmWant; bgmWant = () => {
    if (!(REC.on && RPV.on && REC.mr)) return _w();
    if (!BGM.enabled || !bgm.on || !snd.on || !snd.ctx) return null;
    const P = REC.P, pr = P && P.rows.find(r => r.no === P.playerNo); if (!pr) return null;
    if (bgm.goalKey !== P && pr.fin != null) { bgm.goalKey = P; bgm.goal = 'start'; }
    if (bgm.goal === 'start' || bgm.goal === 'play') return { key: 'goal' };
    if (bgm.goalKey === P || !RPV.play) return null;
    const key = P.pit ? 'race' : 'race2', tr = BGM.tr[key]; if (!tr) return null;
    bgmLoad(key); bgmLoad('goal');
    const pos = tr.startAt + RPV.t;
    return pos < (tr.from || 0) ? { key: 'wait:' + key } : { key, pos };
  };
}
for (const [btn, msg] of [['resRec', 'resVidMsg'], ['taRec', 'taVidMsg']]) { const b = $(btn); if (b) b.addEventListener('click', () => recPanel(b.parentElement, $(msg))); }
