//⁠​‌​​‌​​​​‌‌​‌‌‌‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌‌​​‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌​​​‌‌‌​‌​‌​​​​​​‌​​​​​‌‌‌​​‌‌​‌​‌‌​​‌‌‌​‌​​​‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌‌‌​‌‌‌​​‌​‌‌​​‌​​​​‌​​‌​​​‌‌‌‌​​​‌‌‌​​​​​​‌‌​​‌​​‌‌‌‌‌​​​‌‌‌​​​​​​‌‌​​​​‌‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌​‌‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​​‌​‌​​​​‌‌​​​‌‌​​‌​‌​​‌​​‌​​​​​​​‌‌​​‌​​​‌‌​​​​​​‌‌​​‌​​​‌‌​‌‌​​​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌​‌​‌​‌​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​​​​‌‌‌‌‌‌​​​‌‌‌​​​​​‌​‌​‌‌‌​​‌​​‌​​​​​​​‌​‌​​​​‌​​‌‌​‌​​‌​‌‌​‌​‌​​​‌​​​‌‌​​‌​‌​‌‌​​​​‌​‌‌‌​‌​​​‌‌​‌​​​​​‌​‌​​‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌‌​‌‌‌‌​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​‌​‌‌​‌‌‌​​‌‌​​​​‌​‌‌​‌‌​​​​‌​​​​​​‌‌​​​‌‌​‌‌​‌‌‌‌​‌‌​​‌​​​‌‌​​‌​‌​​‌​‌‌​​​​‌​​​​​​‌‌​​​​‌​‌‌​‌‌​​​‌‌​‌‌​​​​‌​​​​​​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​​​‌‌‌​‌​​​‌‌‌​​‌‌​​‌​​​​​​‌‌‌​​‌​​‌‌​​‌​‌​‌‌‌​​‌‌​‌‌​​‌​‌​‌‌‌​​‌​​‌‌‌​‌‌​​‌‌​​‌​‌​‌‌​​‌​​​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌​​‌​​​​‌​​​‌‌​​‌​​​‌‌‌​‌​‌​​​​​​‌​‌‌​‌​‌​‌​​‌‌​‌​​‌​​‌​‌​​​‌‌‌​​‌​‌‌​‌​​‌‌​​​‌⁠ d223 (まえ 2026-11-03): タイムアタック全体ランキング＋ゴースト共有。サーバーは Cloudflare Workers + D1（game/server/worker.js）
// ・自己ベストを更新したら「全体ランキングに送る／ゴーストも付けて送る」（ゴースト公開は任意）
// ・ランキング画面に「全体」「公式ゴースト」タブ。ランカー・公式のゴーストは「相手にする」でそのまま走れる
// ・合言葉（6文字）で知り合いにゴーストを渡す／受け取る。7日で消える
const NET = {
  url: 'https://hfgp-ranking.maesrmax300.workers.dev',
  pidKey: 'honorGP.netPid', sentKey: 'honorGP.netSent', timeout: 10000, list: 50,
};
try { const o = localStorage.getItem('honorGP.netUrl'); if (o && /^https?:\/\/[\w.:-]+$/.test(o)) NET.url = o; } catch (e) {}   // tests only

// one id per player on this device (never shown; it is what lets the server keep one record per player)
function netPid() {
  const k = playerKey(NET.pidKey);
  let id = null; try { id = localStorage.getItem(k); } catch (e) {}
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const b = crypto.getRandomValues(new Uint8Array(18));
    id = [...b].map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[v & 63]).join('');
    try { localStorage.setItem(k, id); } catch (e) {}
  }
  return id;
}
async function netCall(path, body) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), NET.timeout);
  try {
    const r = await fetch(NET.url + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store' } : { signal: ctl.signal, cache: 'no-store' });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || `サーバーの返事がありません（${r.status}）`);
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('つながりませんでした（時間切れ）');
    if (e instanceof TypeError) throw new Error('つながりませんでした（ネットにつながっているか確かめてください）');
    throw e;
  } finally { clearTimeout(tm); }
}
const netGhostOf = src => taGhostFile(src);
// the best that was last sent (so the result card doesn't offer to send it twice)
function netSentGet() { try { return JSON.parse(localStorage.getItem(playerKey(NET.sentKey)) || 'null'); } catch (e) { return null; } }
function netSentSet(v) { try { localStorage.setItem(playerKey(NET.sentKey), JSON.stringify(v)); } catch (e) {} }

// ---------- 結果画面：全体ランキングに送る ----------
function netResultUi(run, isBest) {
  const row = $('netRow'); if (!row) return;
  const sent = netSentGet(), b = taBest;
  const can = !!(run && b && Math.abs(run.t - b.t) < 1e-6 && b.g);
  const done = can && sent && Math.abs(sent.t - b.t) < 1e-6;
  row.hidden = !can;
  $('netSend').hidden = !!done;                 // sent without a ghost: the ghost can still be added (same time)
  $('netSendG').hidden = !!(done && sent.ghost);
  $('netMsg').textContent = !can ? '' : done ? `全体ランキングに送信済み（${sent.rank}位${sent.ghost ? '・ゴースト公開中' : ''}）` : isBest ? '自己ベストです。全体ランキングに送りますか？' : '';
}
async function netSend(withGhost) {
  const b = taBest; if (!b || !b.g) return;
  const msg = $('netMsg'); msg.textContent = '送信中…';
  $('netSend').disabled = $('netSendG').disabled = true;
  try {
    const j = await netCall('/score', { rules: TA.key, pid: netPid(), name: playerName(), t: b.t, st: b.st, laps: b.laps, game: GAME_VER, ghost: withGhost ? netGhostOf(b) : undefined });
    netSentSet({ t: b.t, rank: j.rank, ghost: !!withGhost, at: Date.now() });
    msg.textContent = `全体ランキング ${j.rank}位${withGhost ? '・ゴーストを公開しました' : ''}`;
    toast('全体ランキング', `${fmtRT(b.t)}　${j.rank}位`, 'good');
    netResultUi({ t: b.t }, false);
  } catch (e) { msg.textContent = `送れませんでした：${e.message}`; }
  finally { $('netSend').disabled = $('netSendG').disabled = false; }
}
$('netSend').addEventListener('click', () => netSend(false));
$('netSendG').addEventListener('click', () => netSend(true));

// ---------- ランキング画面のタブ ----------
let netTab = 'local';
function netTable(box, head, rows) {
  const tab = document.createElement('table'); tab.className = 'mtab rk';
  const add = (cells, th, hi) => { const r = document.createElement('tr'); if (hi) r.className = 'hi'; for (const v of cells) { const c = document.createElement(th ? 'th' : 'td'); if (v instanceof Node) c.appendChild(v); else c.textContent = v; r.appendChild(c); } tab.appendChild(r); };
  add(head, true); rows.forEach(r => add(r.cells, false, r.hi)); box.appendChild(tab);
}
const netDay = ms => { if (!ms) return '—'; const d = new Date(ms); return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`; };
function netNote(box, text) { const p = document.createElement('p'); p.textContent = text; p.style.fontSize = '13px'; box.appendChild(p); }
function netRivalBtn(label, load) {
  const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = label; b.style.padding = '2px 8px'; b.style.fontSize = '12px';
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { const g = taGhostCheck(await load()); taRivalSet(g); toast('ゴースト', `${g.name} ${fmtRT(g.t)} のゴーストと走ります`, 'good'); b.textContent = '相手に設定'; }
    catch (e) { toast('ゴースト', `読み込めませんでした：${e.message || e}`, 'bad'); b.disabled = false; }
  });
  return b;
}
// d226 (まえ): the ranking can be shown by version (TA.key). The physics stays put, but a serious hole may get fixed — then TA.key moves on and
// the old version's table stays readable here. Ghosts can only be raced on the version they were made on.
// d383 (まえ 2026-11-03 決定: 総合＋入力別): the server keeps one table per input (TA.key + '' / '.key' / '.ctrl', d351/d352). The
// screen picks a version+venue (netBase) and an input (netIn); 総合 merges the three tables here — each player's best once, with an icon.
// No server change: players are told apart by name (you by your own record; the shared name ゲスト is never merged).
const NET_IN = { all: { label: '総合', ic: '' }, ctrl: { sfx: '.ctrl', label: 'コントローラー', ic: '🎮' }, key: { sfx: '.key', label: 'キーボード', ic: '⌨️' }, touch: { sfx: '', label: 'タッチ', ic: '👆' } };
const netBaseOf = k => k.replace(/\.(ctrl|key)$/, '');
const netInOf = k => /\.ctrl$/.test(k) ? 'ctrl' : /\.key$/.test(k) ? 'key' : 'touch';
const netOld = b => +(b.replace(/^honorGP\.ta\./, '').split('.')[0].slice(1)) < 350;   // before d350 there was only the touch table
let netBase = netBaseOf(TA.key), netIn = 'all';
let netVer = TA.key;   // the single table in use (an input picked) — the reset of the dev build and the version note read it
const netRules = () => netOld(netBase) ? [netBase] : netIn === 'all' ? ['ctrl', 'key', 'touch'].map(i => netBase + NET_IN[i].sfx) : [netBase + NET_IN[netIn].sfx];
const netVerName = k => { const m = k.replace(/^honorGP\.ta\./, '').split('.'), ctrl = m.includes('ctrl'), kb = m.includes('key'), mm = m.filter(x => x !== 'ctrl' && x !== 'key'); const v = mm[1] && Object.values(VENUES_GEO).find(g => g.taSuffix === '.' + mm[1]); return `${mm[0]} ${v ? v.name : mm[1] || VENUES_GEO.standard.name}${ctrl ? '・コントローラー' : kb ? '・キーボード' : (+mm[0].slice(1) >= 350 ? '・タッチ' : '')}`; };   // d351: the controller board rides on the key too   // d236: the venue rides on the key
const netBaseName = b => netVerName(b).replace(/・タッチ$/, '');
function netKeyChanged() { netBase = netBaseOf(TA.key); const sel = $('rankVer'); if (sel) delete sel.dataset.loaded; }
venueHooks.push(netKeyChanged);
async function netVerUi() {
  const sel = $('rankVer'), isel = $('rankIn'); if (!sel) return;
  const off = netTab === 'local' || netTab === 'ashi';
  sel.hidden = off; if (isel) { isel.hidden = off || netOld(netBase); isel.value = netIn; }
  if (off || sel.dataset.loaded) { sel.value = netBase; return; }
  const cur = netBaseOf(TA.key), n = {};
  const add = (b, label) => { const had = [...sel.options].find(o => o.value === b); if (had) { had.textContent = label; return; } const o = document.createElement('option'); o.value = b; o.textContent = label; sel.appendChild(o); };
  add(cur, `${netBaseName(cur)}（今の版）`);
  try { const j = await netCall('/rules'); for (const r of j.list) { const b = netBaseOf(r.rules); n[b] = (n[b] || 0) + (r.n || 0); }
    // d388: records from before the public release (the testers' bases) are not listed
    const vn = b => +(b.replace(/^honorGP\.ta\./, '').split('.')[0].slice(1)) || 0;
    for (const b of Object.keys(n)) if (vn(b) >= vn(TA.keyBase)) add(b, `${netBaseName(b)}${b === cur ? '（今の版）' : ''}　のべ${n[b]}人`); sel.dataset.loaded = '1'; } catch (e) {}
  sel.value = netBase;
}
async function netShowTab(tab) {
  netTab = tab;
  for (const b of document.querySelectorAll('#rankTabs button')) b.classList.toggle('ghost', b.dataset.tab !== tab);
  const rules = netRules(), all = rules.length > 1;
  netVer = rules[0];
  const box = $('rankList'), note = $('rankNote'), cur = netBase === netBaseOf(TA.key), vtxt = cur ? '' : `（${netBaseName(netBase)}の記録・ゴーストはこの版では走れません）`;
  const icon = k => NET_IN[netInOf(k)].ic;
  const runnable = k => k === TA.key;   // a ghost runs only on its own table (version, venue and input)
  box.textContent = ''; netVerUi();
  if ($('rankSub')) $('rankSub').textContent = tab === 'ashi' ? '足合わせ（羽美と2周）' : 'タイムアタック（3周）';
  if ($('rivalRow')) $('rivalRow').hidden = tab === 'ashi';
  if (tab === 'ashi') { if (typeof ashiRankShow === 'function') ashiRankShow(box, note); return; }   // d362
  if (tab === 'local') { note.textContent = 'この端末で走った速い順に10位まで。プレイヤーの名前はメニューで登録できます。'; taRankTable(box); return; }
  if (tab === 'net') {
    note.textContent = `全国の自己ベスト（1人1記録${all ? '、総合はコントローラー・キーボード・タッチの中で一番速い記録' : ''}）。上位${NET.list}位まで。「相手」でその人のゴーストと走れます（公開している人だけ・同じ操作の記録だけ）。${vtxt}`;
    netNote(box, '読み込み中…');
    try {
      const pid = netPid();
      const js = await Promise.all(rules.map(r => netCall(`/ranking?rules=${encodeURIComponent(r)}&limit=${NET.list}&pid=${encodeURIComponent(pid)}`).then(j => ({ r, j }))));
      if (netTab !== 'net') return;
      box.textContent = '';
      let rows = [];
      for (const { r, j } of js) for (const e of j.list) rows.push({ e, r, me: !!(j.me && j.me.id === e.id) });
      rows.sort((a, b) => a.e.t - b.e.t || a.e.at - b.e.at);
      if (all) { const seen = new Set(); rows = rows.filter(x => { const k = x.me ? 'me' : x.e.name && x.e.name !== 'ゲスト' ? 'n:' + x.e.name : null; if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; }); }
      rows = rows.slice(0, NET.list);
      if (!rows.length) { netNote(box, 'まだ誰も登録していません。自己ベストを出したら結果画面から送れます。'); return; }
      let rank = 0, lastT = null;
      rows.forEach((x, i) => { if (x.e.t !== lastT) { rank = i + 1; lastT = x.e.t; } x.rank = all ? rank : x.e.rank; });
      const ghostCell = x => x.e.ghost ? (cur && runnable(x.r) ? netRivalBtn('相手', () => netCall(`/ghost/${x.e.id}`)) : 'あり') : '—';
      netTable(box, all ? ['順位', '', '名前', 'タイム', '級', '日付', 'ゴースト'] : ['順位', '名前', 'タイム', '級', '日付', 'ゴースト'], rows.map(x => ({ hi: x.me,
        cells: all ? [`${x.rank}`, icon(x.r), x.e.name, fmtRT(x.e.t), taRank(x.e.t), netDay(x.e.at), ghostCell(x)] : [`${x.rank}`, x.e.name, fmtRT(x.e.t), taRank(x.e.t), netDay(x.e.at), ghostCell(x)] })));
      if (all) {
        const mine = rows.find(x => x.me), anyMe = js.some(({ j }) => j.me), tot = js.reduce((s, { j }) => s + (j.total || 0), 0);
        netNote(box, mine ? `あなた：総合${mine.rank}位（${fmtRT(mine.e.t)} ${icon(mine.r)}）／のべ${tot}記録` : anyMe ? `あなたは総合${NET.list}位の外です／のべ${tot}記録` : `のべ${tot}記録。あなたはまだ登録していません。`);
        netNote(box, '🎮 コントローラー　⌨️ キーボード　👆 タッチ');
      } else { const j = js[0].j; netNote(box, j.me ? `あなた：${j.me.rank}位（${fmtRT(j.me.t)}）／全${j.total}人` : `全${j.total}人。あなたはまだ登録していません。`); }
    } catch (e) { if (netTab === 'net') { box.textContent = ''; netNote(box, `読み込めませんでした：${e.message}`); } }
    return;
  }
  if (tab === 'official') {
    note.textContent = `作者やイベントのゴーストです。「相手」でそのゴーストと走れます（同じ操作のものだけ）。${vtxt}`;
    netNote(box, '読み込み中…');
    try {
      const js = await Promise.all(rules.map(r => netCall(`/official?rules=${encodeURIComponent(r)}`).then(j => ({ r, j }))));
      if (netTab !== 'official') return;
      box.textContent = '';
      const rows = []; for (const { r, j } of js) for (const e of j.list) rows.push({ e, r });
      rows.sort((a, b) => a.e.t - b.e.t);
      if (!rows.length) { netNote(box, 'いまは公式ゴーストがありません。'); return; }
      const gc = x => cur && runnable(x.r) ? netRivalBtn('相手', async () => (await netCall(`/official/${x.e.id}`)).ghost) : 'あり';
      netTable(box, all ? ['', '名前', 'タイム', '級', 'ゴースト'] : ['名前', 'タイム', '級', 'ゴースト'], rows.map(x => ({
        cells: all ? [icon(x.r), `${x.e.title}（${x.e.name}）`, fmtRT(x.e.t), taRank(x.e.t), gc(x)] : [`${x.e.title}（${x.e.name}）`, fmtRT(x.e.t), taRank(x.e.t), gc(x)] })));
    } catch (e) { if (netTab === 'official') { box.textContent = ''; netNote(box, `読み込めませんでした：${e.message}`); } }
  }
}
$('rankVer').addEventListener('change', e => { netBase = e.target.value; netShowTab(netTab); });
if ($('rankIn')) $('rankIn').addEventListener('change', e => { netIn = e.target.value; netShowTab(netTab); });
// d226 (まえ): 開発版だけ — the table on screen is emptied (before the public start). 全体・公式 need the 運営の合言葉 (asked each time, never kept)
async function netResetTable() {
  if (netTab === 'local') {
    if (!confirm('端末内ランキングを全部消しますか？（自己ベストは残ります）')) return;
    taRankSave([]); netShowTab('local'); toast('ランキング', '端末内ランキングをリセットしました', 'info'); return;
  }
  if (netTab === 'ashi') {   // d362
    if (confirm('足合わせの端末内ランキングを全部消しますか？')) { try { localStorage.removeItem(ASHI_K.rankKey); } catch (e) {} }
    if (!confirm('足合わせの全体ランキングも全部消しますか？（元に戻せません）')) { netShowTab('ashi'); return; }
    const key = prompt('運営の合言葉（ADMIN_KEY）'); if (!key) return;
    try {
      const r = await fetch(`${NET.url}/ashi?rules=${encodeURIComponent(ASHI_K.rules)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || r.status);
      try { localStorage.removeItem(playerKey(ASHI_K.sentKey)); } catch (e) {}
      toast('ランキング', `足合わせの全体ランキングをリセットしました（${j.changed}件）`, 'info');
    } catch (e) { toast('ランキング', `リセットできませんでした：${e.message}`, 'bad'); }
    netShowTab('ashi'); return;
  }
  const what = netTab === 'net' ? '全体ランキング' : '公式ゴースト', rules = netRules(), ver = rules.length > 1 ? `${netBaseName(netBase)}（総合＝3つとも）` : netVerName(rules[0]);
  if (!confirm(`${ver} の${what}を全部消しますか？（元に戻せません）`)) return;
  const key = prompt('運営の合言葉（ADMIN_KEY）'); if (!key) return;
  try {
    let n = 0;
    for (const rl of rules) {
      const r = await fetch(`${NET.url}/${netTab === 'net' ? 'ranking' : 'official'}?rules=${encodeURIComponent(rl)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || r.status);
      n += j.changed || 0;
    }
    if (netTab === 'net') try { localStorage.removeItem(playerKey(NET.sentKey)); } catch (e) {}
    toast('ランキング', `${ver} の${what}をリセットしました（${n}件）`, 'info'); netShowTab(netTab);
  } catch (e) { toast('ランキング', `リセットできませんでした：${e.message}`, 'bad'); }
}
$('rankReset').addEventListener('click', netResetTable);
for (const b of document.querySelectorAll('#rankTabs button')) b.addEventListener('click', () => netShowTab(b.dataset.tab));

// ---------- 合言葉 ----------
$('shareCode').addEventListener('click', async () => {
  const b = taBest, out = $('shareTxt');
  if (!b || !b.g) { toast('合言葉', 'まだ自己ベストがありません。タイムアタックを3周走りきってください', 'bad'); return; }
  out.hidden = false; out.textContent = '合言葉を作っています…';
  try {
    const j = await netCall('/share', { rules: TA.key, ghost: netGhostOf(b) });
    const d = new Date(j.exp);
    out.textContent = `合言葉：${j.code}（${fmtRT(b.t)}のゴースト・${d.getMonth() + 1}/${d.getDate()}まで）`;
    try { await navigator.clipboard.writeText(j.code); toast('合言葉', `${j.code}（コピーしました）`, 'good'); } catch (e) { toast('合言葉', j.code, 'good'); }
  } catch (e) { out.textContent = `作れませんでした：${e.message}`; }
});
$('codeLoad').addEventListener('click', async () => {
  // d255: with a controller, the on-screen keyboard (英数) instead of the browser's prompt
  const raw = typeof currentPad === 'function' && currentPad() ? await new Promise(res => padKeyboard({ title: 'もらった合言葉（6文字）', max: 6, mode: 'abc' }, res)) : prompt('もらった合言葉（6文字）を入れてください');
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return;
  try {
    const j = await netCall(`/share/${c}`);
    const g = taGhostCheck(j.ghost); taRivalSet(g);
    toast('ゴースト', `${g.name} ${fmtRT(g.t)} のゴーストと走ります`, 'good');
  } catch (e) { toast('合言葉', `受け取れませんでした：${e.message}`, 'bad'); }
});
