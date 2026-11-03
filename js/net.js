// d223 (まえ 2026-11-03): タイムアタック全体ランキング＋ゴースト共有。サーバーは Cloudflare Workers + D1（game/server/worker.js）
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
let netVer = TA.key;
const netVerName = k => k.replace(/^honorGP\.ta\./, '');
async function netVerUi() {
  const sel = $('rankVer'); if (!sel) return;
  sel.hidden = netTab === 'local';
  if (netTab === 'local' || sel.dataset.loaded) return;
  const add = (k, label) => { const had = [...sel.options].find(o => o.value === k); if (had) { had.textContent = label; return; } const o = document.createElement('option'); o.value = k; o.textContent = label; sel.appendChild(o); };
  add(TA.key, `${netVerName(TA.key)}（今の版）`);
  try { const j = await netCall('/rules'); for (const r of j.list) add(r.rules, `${netVerName(r.rules)}${r.rules === TA.key ? '（今の版）' : ''}　${r.n}人`); sel.dataset.loaded = '1'; } catch (e) {}
  sel.value = netVer;
}
async function netShowTab(tab) {
  netTab = tab;
  for (const b of document.querySelectorAll('#rankTabs button')) b.classList.toggle('ghost', b.dataset.tab !== tab);
  const box = $('rankList'), note = $('rankNote'), cur = netVer === TA.key, vtxt = cur ? '' : `（${netVerName(netVer)}の記録・ゴーストはこの版では走れません）`;
  box.textContent = ''; netVerUi();
  if (tab === 'local') { note.textContent = 'この端末で走った速い順に10位まで。プレイヤーの名前はメニューで登録できます。'; taRankTable(box); return; }
  if (tab === 'net') {
    note.textContent = `全国の自己ベスト（1人1記録）。上位${NET.list}位まで。「相手」でその人のゴーストと走れます（公開している人だけ）。${vtxt}`;
    netNote(box, '読み込み中…');
    try {
      const pid = netPid(), j = await netCall(`/ranking?rules=${encodeURIComponent(netVer)}&limit=${NET.list}&pid=${encodeURIComponent(pid)}`);
      if (netTab !== 'net') return;
      box.textContent = '';
      if (!j.list.length) { netNote(box, 'まだ誰も登録していません。自己ベストを出したら結果画面から送れます。'); return; }
      const me = j.me && j.me.id;
      netTable(box, ['順位', '名前', 'タイム', '級', '日付', 'ゴースト'], j.list.map(e => ({ hi: e.id === me,
        cells: [`${e.rank}`, e.name, fmtRT(e.t), taRank(e.t), netDay(e.at), e.ghost ? (cur ? netRivalBtn('相手', () => netCall(`/ghost/${e.id}`)) : 'あり') : '—'] })));
      netNote(box, j.me ? `あなた：${j.me.rank}位（${fmtRT(j.me.t)}）／全${j.total}人` : `全${j.total}人。あなたはまだ登録していません。`);
    } catch (e) { if (netTab === 'net') { box.textContent = ''; netNote(box, `読み込めませんでした：${e.message}`); } }
    return;
  }
  if (tab === 'official') {
    note.textContent = `作者やイベントのゴーストです。「相手」でそのゴーストと走れます。${vtxt}`;
    netNote(box, '読み込み中…');
    try {
      const j = await netCall(`/official?rules=${encodeURIComponent(netVer)}`);
      if (netTab !== 'official') return;
      box.textContent = '';
      if (!j.list.length) { netNote(box, 'いまは公式ゴーストがありません。'); return; }
      netTable(box, ['名前', 'タイム', '級', 'ゴースト'], j.list.map(e => ({
        cells: [`${e.title}（${e.name}）`, fmtRT(e.t), taRank(e.t), cur ? netRivalBtn('相手', async () => (await netCall(`/official/${e.id}`)).ghost) : 'あり'] })));
    } catch (e) { if (netTab === 'official') { box.textContent = ''; netNote(box, `読み込めませんでした：${e.message}`); } }
  }
}
$('rankVer').addEventListener('change', e => { netVer = e.target.value; netShowTab(netTab); });
// d226 (まえ): 開発版だけ — the table on screen is emptied (before the public start). 全体・公式 need the 運営の合言葉 (asked each time, never kept)
async function netResetTable() {
  if (netTab === 'local') {
    if (!confirm('端末内ランキングを全部消しますか？（自己ベストは残ります）')) return;
    taRankSave([]); netShowTab('local'); toast('ランキング', '端末内ランキングをリセットしました', 'info'); return;
  }
  const what = netTab === 'net' ? '全体ランキング' : '公式ゴースト', ver = netVerName(netVer);
  if (!confirm(`${ver} の${what}を全部消しますか？（元に戻せません）`)) return;
  const key = prompt('運営の合言葉（ADMIN_KEY）'); if (!key) return;
  try {
    const r = await fetch(`${NET.url}/${netTab === 'net' ? 'ranking' : 'official'}?rules=${encodeURIComponent(netVer)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || r.status);
    if (netTab === 'net') try { localStorage.removeItem(playerKey(NET.sentKey)); } catch (e) {}
    toast('ランキング', `${ver} の${what}をリセットしました（${j.changed}件）`, 'info'); netShowTab(netTab);
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
  const c = (prompt('もらった合言葉（6文字）を入れてください') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return;
  try {
    const j = await netCall(`/share/${c}`);
    const g = taGhostCheck(j.ghost); taRivalSet(g);
    toast('ゴースト', `${g.name} ${fmtRT(g.t)} のゴーストと走ります`, 'good');
  } catch (e) { toast('合言葉', `受け取れませんでした：${e.message}`, 'bad'); }
});
