/* d282 性能ログ (まえ: 本体にテスト機構を。媒体（PCかスマホ）、モード、処理、最高・最低・平均fpsが記録される検証ログ)
 * 設定 → 開発 →「性能ログを記録する」. While a race runs (not paused, page visible) the frames are counted in 1-second
 * windows; one record per stretch with the same 媒体・視点・画質 — a change of 視点/画質/場/時間帯, a pause or the end of
 * the race closes it (kept if ≥ 5 s). Kept in this browser (last 80), shown in a table, copy as text / save as CSV.
 * Looks at the screen only: never touches the race. */
const PERF = { only1M: false, key: 'honorGP.perfLog', onKey: 'honorGP.perf', max: 80, minSecs: 5, on: false, seg: null, win: null, prev: 0 };
try { PERF.on = localStorage.getItem(PERF.onKey) === 'on'; PERF.only1M = localStorage.getItem('honorGP.perf1M') === 'on'; } catch (e) {}
function perfList() { try { return JSON.parse(localStorage.getItem(PERF.key) || '[]'); } catch (e) { return []; } }
function perfSave(list) { try { localStorage.setItem(PERF.key, JSON.stringify(list.slice(-PERF.max))); } catch (e) {} }

// 媒体: phone or PC (touch-only = スマホ), the OS, the screen and the pixel ratio
function perfDevice() {
  let phone = false; try { phone = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) {}
  const ua = navigator.userAgent || '', os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return { kind: phone ? 'スマホ' : 'PC', os: os + (br ? '・' + br : ''), screen: `${screen.width}×${screen.height}`, dpr: +(devicePixelRatio || 1).toFixed(2) };
}
// モード (視点) and 処理 (what is drawn and how)
function perfMode() {
  const V = window.View3D, m3 = V && V.mode && V.mode !== '2d';
  const cams = { follow: '追いかけ', close: '拡大追尾', auto: '自動ズーム' };
  const cm = cams[typeof camMode !== 'undefined' ? camMode : ''] || '';
  const mode = m3 ? '3D ' + ({ chase: '追尾', racer: 'レーサー', top: `上空（${cm}）` }[V.mode] || V.mode) : '2D ' + cm;
  let proc;
  if (m3) { const I = V.info || {}; proc = `${I.label || I.tier || '?'}・水面${({ simple: '簡易', shade: '陰影', reflect: '反射' })[I.water] || I.water || '?'}`; }
  else { const B = window.Boat3D, s = $('boatRenderMode'); proc = '艇：' + (s && s.selectedOptions[0] ? s.selectedOptions[0].textContent : B ? B.mode : '2D') + `・解像度×${typeof DPR !== 'undefined' ? DPR : '?'}`; }
  const race = typeof fleet !== 'undefined' && fleet ? '6艇' : 'ソロ（TA・練習）';
  const venue = typeof VENUE !== 'undefined' ? VENUE.name || VENUE.id : '';
  const tod = { day: '昼', evening: '夕方', night: '夜' }[typeof todNow === 'function' ? todNow() : ''] || '';
  const wet = typeof waterEnv !== 'undefined' && waterEnv && waterEnv.rain && fleet ? '・雨' : '';   // d284
  return { mode, proc, race, place: `${venue}・${tod}${wet}` };
}
function perfClose() {
  const s = PERF.seg; PERF.seg = null; PERF.win = null;
  if (!s || s.secs < PERF.minSecs || !s.n) return;
  const r = { at: new Date(s.t0).toLocaleString('ja-JP', { hour12: false }), ver: typeof GAME_VER !== 'undefined' ? GAME_VER : '', ...s.dev, ...s.m,
    window: s.win, secs: Math.round(s.secs), avg: +(s.frames / s.secs).toFixed(1), max: Math.round(s.max), min: Math.round(s.min), worstMs: Math.round(s.worst),
    simMs: s.ticks ? +(s.simMs / s.ticks).toFixed(2) : '', drawMs: s.ticks ? +(s.drawMs / s.ticks).toFixed(2) : '', d3Ms: s.d3n ? +(s.d3Ms / s.d3n).toFixed(2) : '' };
  const list = perfList(); list.push(r); perfSave(list); perfTable();
}
// called from main.js frame() every animation frame
function perfFrame(now) {
  const dt = now - (PERF.prev || now); PERF.prev = now;
  if (!PERF.on) { if (PERF.seg) perfClose(); return; }
  // d283 スタート〜1周1Mだけ: the same stretch of every race (before any boat has rounded 1M — fewer boats, flyings and wrecks later on change the load)
  const only1M = PERF.only1M && !(typeof fleet !== 'undefined' && fleet && !fleet.boats.some(r => r.past1M));
  const live = typeof running !== 'undefined' && running && !paused && !document.hidden && !(typeof RPV !== 'undefined' && RPV.on) && !only1M;
  if (!live || dt <= 0 || dt > 500) { if (!live && PERF.seg) perfClose(); PERF.win = null; return; }
  const m = perfMode(), k = JSON.stringify(m) + innerWidth + 'x' + innerHeight;
  if (PERF.seg && PERF.seg.k !== k) perfClose();
  if (!PERF.seg) { PERF.d3 = null; PERF.lastDraw = 0; PERF.seg = { k, m, dev: perfDevice(), win: `${innerWidth}×${innerHeight}`, t0: Date.now(), secs: 0, frames: 0, n: 0, max: 0, min: Infinity, worst: 0 }; PERF.win = null; return; }
  // in 3D, count the 3D view's own draws (スマホ軽量 draws at most 30 a second while the game loop runs on)
  const V = window.View3D, d3 = V && V.mode !== '2d' ? V.draws : null, got = d3 == null ? 1 : Math.max(0, d3 - (PERF.d3 ?? d3)); PERF.d3 = d3;
  const s = PERF.seg; s.secs += dt / 1000; s.frames += got;
  // d283: where the time goes (CPU ms a frame): レース計算, 2D描画 (+音・HUD; in 3D the 2D view still works out its camera), 3D描画
  if (typeof PERF_T !== 'undefined') { s.simMs = (s.simMs || 0) + PERF_T.sim; s.drawMs = (s.drawMs || 0) + PERF_T.draw; s.ticks = (s.ticks || 0) + 1; }
  if (d3 != null && got) { s.d3Ms = (s.d3Ms || 0) + (V.ms || 0); s.d3n = (s.d3n || 0) + 1; }
  if (got) { if (PERF.lastDraw) s.worst = Math.max(s.worst, now - PERF.lastDraw); PERF.lastDraw = now; }   // 最長: the longest gap between two drawn frames
  if (!PERF.win) PERF.win = { t: 0, n: 0 };
  PERF.win.t += dt; PERF.win.n += got;
  if (PERF.win.t >= 1000) { const f = PERF.win.n * 1000 / PERF.win.t; s.max = Math.max(s.max, f); s.min = Math.min(s.min, f); s.n++; PERF.win = { t: 0, n: 0 }; }
}
addEventListener('visibilitychange', () => { if (document.hidden) perfClose(); });
addEventListener('pagehide', () => perfClose());

/* ---------- the table (設定 → 開発 →「性能ログを見る」) ---------- */
const PERF_COLS = [['at', '日時'], ['ver', '版'], ['kind', '媒体'], ['os', '機種'], ['screen', '画面'], ['dpr', '倍率'], ['window', '窓'], ['mode', 'モード'], ['proc', '処理'],
  ['race', 'レース'], ['place', '場'], ['secs', '秒'], ['avg', '平均fps'], ['max', '最高fps'], ['min', '最低fps'], ['worstMs', '最長ms'], ['simMs', '計算ms'], ['drawMs', '2D描画ms'], ['d3Ms', '3D描画ms']];
let perfBox = null;
function perfTable() {
  if (!perfBox || perfBox.hidden) return;
  const list = perfList(), tb = perfBox.querySelector('tbody');
  tb.innerHTML = '';
  for (const r of list.slice().reverse()) { const tr = document.createElement('tr'); for (const [k] of PERF_COLS) { const td = document.createElement('td'); td.textContent = r[k] ?? ''; tr.appendChild(td); } tb.appendChild(tr); }
  perfBox.querySelector('.pl-n').textContent = `${list.length}件`;
}
const perfText = sep => [PERF_COLS.map(c => c[1]).join(sep), ...perfList().map(r => PERF_COLS.map(([k]) => String(r[k] ?? '').replace(/[\t\n,]/g, ' ')).join(sep))].join('\n');
function perfOpen() {
  if (!perfBox) {
    perfBox = document.createElement('div'); perfBox.id = 'perfLogBox'; perfBox.className = 'overlay'; perfBox.style.zIndex = 60;
    perfBox.innerHTML = `<div class="card" style="max-width:min(96vw,1100px);width:96vw;max-height:88vh;display:flex;flex-direction:column;gap:8px">
      <h2 style="margin:0">性能ログ <small class="pl-n" style="color:var(--muted);font-size:13px"></small></h2>
      <p style="margin:0;font-size:12px">レース中（一時停止以外）の描画回数。視点・画質・場・時間帯・窓の大きさが同じ区間ごとに1行（5秒以上）。最高・最低は1秒ごとの値、最長msは一番長くかかった1フレーム。計算ms・2D描画ms・3D描画msは1フレームあたりのCPU時間の平均（GPUの時間は入らない）。</p>
      <div style="overflow:auto;flex:1;border:1px solid rgba(255,255,255,.15);border-radius:8px"><table style="border-collapse:collapse;font-size:12px;white-space:nowrap;width:100%">
        <thead><tr>${PERF_COLS.map(c => `<th style="position:sticky;top:0;background:#1b2330;padding:4px 6px;text-align:left">${c[1]}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-a="copy">テキストでコピー</button><button class="btn ghost" data-a="csv">CSVで保存</button><button class="btn ghost" data-a="clear">消す</button><button class="btn ghost" data-a="close">閉じる</button><span class="pl-msg" role="status" style="align-self:center;font-size:12px"></span></div></div>`;
    document.body.appendChild(perfBox);
    const style = document.createElement('style'); style.textContent = '#perfLogBox td{padding:3px 6px;border-top:1px solid rgba(255,255,255,.08)}'; document.head.appendChild(style);
    const msg = t => { perfBox.querySelector('.pl-msg').textContent = t; };
    perfBox.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === 'close') perfBox.hidden = true;
      if (a === 'copy') { const t = perfText('\t'); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => msg('コピーしました'), () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); msg('コピーしました'); } catch (x) { msg('コピーできませんでした'); } ta.remove(); }); }
      if (a === 'csv') { const b = new Blob(['﻿' + perfText(',')], { type: 'text/csv' }), u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = `hfgp_perf_${Date.now()}.csv`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); msg('保存しました'); }
      if (a === 'clear') { perfSave([]); perfTable(); msg('消しました'); }
    });
  }
  perfBox.hidden = false; perfBox.querySelector('.pl-msg').textContent = ''; perfTable();
}
{
  const c = $('perfOn'); if (c) { c.checked = PERF.on; c.addEventListener('change', e => { PERF.on = e.target.checked; if (!PERF.on) perfClose(); try { localStorage.setItem(PERF.onKey, PERF.on ? 'on' : 'off'); } catch (x) {} }); }
  const o = $('perf1M'); if (o) { o.checked = PERF.only1M; o.addEventListener('change', e => { PERF.only1M = e.target.checked; perfClose(); try { localStorage.setItem('honorGP.perf1M', PERF.only1M ? 'on' : 'off'); } catch (x) {} }); }
  const b = $('perfView'); if (b) b.addEventListener('click', e => { e.preventDefault(); perfOpen(); });
}
