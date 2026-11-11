/* ---------- メニュー (d227, まえ: メニューや設定をすっきり、押す回数を減らす) ----------
   The menu (#pmenu) is the first screen and also the in-game menu. A mode button pressed before the game is running
   does the first-tap work (start(): sound, landscape, sensors) and then runs the button as if from the in-game menu.
   Sub-screens closed with やめる come back here. 設定 is split into tabs; developer things sit under 開発. */
const MENU = { tabKey: 'honorGP.setTab' };
const menuHome = () => { $('pmenu').hidden = false; paused = true; last = performance.now(); };
// first tap: start the game, then the mode
$('pmenu').addEventListener('click', e => {
  const b = e.target.closest('[data-play]'); if (!b || running) return;
  e.stopImmediatePropagation(); e.preventDefault();
  $('pmenu').hidden = true;
  // d263: run the mode on the next tick — with a controller (操作モード コントローラ) start() runs straight through inside this
  // click, and a click() on a button whose own click is still being dispatched does nothing (the run sat paused until X)
  start(() => { beginStart(); paused = true; setTimeout(() => b.click(), 0); });
}, true);
// 練習 ▸ / 相手 ▸: one panel open at a time
for (const bt of document.querySelectorAll('#pmenu [data-panel]')) bt.addEventListener('click', () => {
  for (const o of document.querySelectorAll('#pmenu [data-panel]')) {
    const open = o === bt && $(o.dataset.panel).hidden;
    $(o.dataset.panel).hidden = !open; o.setAttribute('aria-expanded', String(open));
  }
});
function menuRaceAgainUi() {
  let saved = null; try { saved = localStorage.getItem('honorGP.raceCfg'); } catch (e) {}
  const b = $('pmRaceAgain'); b.hidden = !saved || typeof raceCfg === 'undefined';
  if (!b.hidden) b.textContent = `前回と同じ条件で6艇レース（${(VENUES_GEO[raceCfg.venue] || VENUE).name}・${raceCfg.no}号艇・${raceCfg.start === 'fixed' ? '枠なり' : 'ピット離れ'}）`;
}
function menuRefresh() {
  $('pmenu').querySelector('.menu-card').classList.toggle('ingame', running);
  $('pmClose').hidden = !running;
  $('pmModeRow').hidden = !TOUCH_UI; $('controlHelp').hidden = !TOUCH_UI; $('pmKeys').hidden = TOUCH_UI;
  menuRaceAgainUi();
}
new MutationObserver(() => { if (!$('pmenu').hidden) menuRefresh(); }).observe($('pmenu'), { attributes: true, attributeFilter: ['hidden'] });
menuRefresh();
$('pmModeSel').value = controlMode;
// d236 コース: 練習コース / 住之江 (タイムアタック・6艇レース・デモ; 節間は練習コース)
for (const sel of document.querySelectorAll('select.venue-sel')) { sel.value = VENUE.id; }
$('pmVenue').addEventListener('change', e => { setVenue(e.target.value); raceCfg.venue = VENUE.id; try { localStorage.setItem('honorGP.raceCfg', JSON.stringify(raceCfg)); } catch (x) {} menuRaceAgainUi(); });
$('pmModeSel').addEventListener('change', e => setControlMode(e.target.value));
$('pmRaceAgain').addEventListener('click', () => {
  $('pmenu').hidden = true; paused = false; last = performance.now(); initAudio();
  if (fleet) quitFleet(); startRaceMode(raceCfg);
});
$('pmSet').addEventListener('click', () => { resetVirtualPosture(); paused = true; $('reset').hidden = !running; $('settings').hidden = false; });
$('gear').addEventListener('click', () => { $('reset').hidden = !running; });
// やめる / 閉じる on the screens a menu button opens: back to the menu
for (const id of ['wakuClose', 'rsClose', 'setsuNewClose', 'setsuQuit', 'taClose']) if ($(id)) $(id).addEventListener('click', menuHome);
// keyboard: Esc opens / closes the menu while playing
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !running || lab.active) return;
  if (!$('pmenu').hidden) { if ([...document.querySelectorAll('.overlay')].filter(o => !o.hidden).length === 1) $('pmClose').click(); return; }
  if (!paused && [...document.querySelectorAll('.overlay')].every(o => o.hidden)) { e.preventDefault(); $('again').click(); }
});

/* top bar: メニュー + 設定; the developer buttons fold under 開発 ▸ */
const DEV_PILLS = ['labLaunch', 'entryBtn', 'sgBtn', 'slitBtn', 'logBtn'];
for (const id of DEV_PILLS) if ($(id)) $(id).classList.add('devpill');
$('devBtn').addEventListener('click', () => {
  const on = $('devBtn').closest('.pills').classList.toggle('devopen');
  $('devBtn').setAttribute('aria-expanded', String(on)); $('devBtn').textContent = on ? '開発 ▾' : '開発 ▸';
});
function topBarUi() {
  $('again').hidden = !!(fleet && fleet.setsu);
  // 6艇デモ is a developer button; during 節間 (棄権／結果へ) or a demo (自分で操作) it is the race's own button
  const own = !!(fleet && (fleet.setsu || !fleet.playerNo));
  $('demoBtn').classList.toggle('devpill', !fleet);
  $('demoBtn').hidden = !!fleet && !own;
}
{ const _r = refreshFleetUi; refreshFleetUi = () => { _r(); topBarUi(); }; topBarUi(); }

/* 設定: tabs 操作 / 音 / 画面 / 開発 */
{
  const TABS = [['op', '操作'], ['snd', '音'], ['view', '画面'], ['dev', '開発']];
  const OF = { controlMode: 'op', wheelSettings: 'op', postureModeNote: 'op', zero: 'op', invR: 'op', invP: 'op', padRT: 'op', hapOn: 'op', sens: 'op', stAssistOn: 'op',
    sndOn: 'snd', sndVol: 'snd', bgmOn: 'snd', bgmVol: 'snd',
    boatRenderMode: 'view', boatRenderStatus: 'view', screenModeRow: 'view', camMode: 'view', todMode: 'view', jkMode: 'view',
    demoCpuMode: 'dev', tiltSel: 'dev', fpsOn: 'dev', wxMode: 'dev', vlogOn: 'dev', simSpeed: 'dev' };
  const set = $('settings').querySelector('.set'), btnRow = set.lastElementChild;
  let cur = 'op';
  for (const el of set.children) {
    if (el === btnRow) continue;
    const id = Object.keys(OF).find(k => el.id === k || el.querySelector('#' + k));
    if (id) cur = OF[id];
    el.dataset.tab = cur;
  }
  const bar = document.createElement('div'); bar.className = 'set-tabs'; bar.setAttribute('role', 'tablist');
  const show = t => {
    set.dataset.cur = t;
    for (const b of bar.children) { const on = b.dataset.t === t; b.className = on ? 'btn' : 'btn ghost'; b.setAttribute('aria-selected', String(on)); }
    try { localStorage.setItem(MENU.tabKey, t); } catch (e) {}
  };
  for (const [t, name] of TABS) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.t = t; b.id = 'setTab_' + t; b.textContent = name; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => show(t)); bar.appendChild(b);
  }
  set.before(bar);
  let t0 = 'op'; try { t0 = localStorage.getItem(MENU.tabKey) || 'op'; } catch (e) {}
  show(TABS.some(x => x[0] === t0) ? t0 : 'op');
  MENU.showTab = show;
}
