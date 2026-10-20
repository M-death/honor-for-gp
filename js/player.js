/* ---------- プレイヤー（記録の持ち主） ----------
   Several people can share one device: each named player gets their own storage — タイムアタックの自己ベスト・
   ゴースト・ログ and the リプレイログ (localStorage keys get "@name"). The unnamed default (ゲスト) keeps the old
   keys, so records made before d135 stay where they were. */
const PLAYER = { key: 'honorGP.players', max: 8, nameMax: 12 };
let players = { list: [], cur: '' };
try { const p = JSON.parse(localStorage.getItem(PLAYER.key) || 'null'); if (p && Array.isArray(p.list)) players = { list: p.list, cur: p.list.includes(p.cur) ? p.cur : '' }; } catch (e) {}
const playerKey = k => players.cur ? `${k}@${players.cur}` : k;
const playerName = () => players.cur || 'ゲスト';
function playerSave() { try { localStorage.setItem(PLAYER.key, JSON.stringify(players)); } catch (e) {} }
function playerUi() {
  const sel = $('plSel'); sel.textContent = '';
  for (const n of ['', ...players.list]) { const o = document.createElement('option'); o.value = n; o.textContent = n || 'ゲスト（名前なし）'; sel.appendChild(o); }
  sel.value = players.cur; $('plDel').disabled = !players.cur;
}
function playerSet(name) {
  players.cur = name; playerSave(); playerUi();
  if (typeof taReload === 'function') taReload();
  toast('プレイヤー', `${playerName()} の記録に切り替えました`, 'info');
}
function playerAdd() {
  const n = $('plName').value.trim().replace(/[@\s]+/g, '').slice(0, PLAYER.nameMax);
  if (!n) { toast('プレイヤー', '名前を入れてください', 'warn'); return; }
  if (!players.list.includes(n)) {
    if (players.list.length >= PLAYER.max) { toast('プレイヤー', `登録は${PLAYER.max}人までです`, 'warn'); return; }
    players.list.push(n);
  }
  $('plName').value = ''; playerSet(n);
}
// 消す: the name and everything stored under it (after asking)
function playerDel() {
  const n = players.cur; if (!n) return;
  $('pmenu').hidden = true;
  askConfirm(`${n} の記録（自己ベスト・ゴースト・ログ）をすべて消しますか？`, () => {
    for (const k of [TA.key, TA.logKey, RP.key]) { try { localStorage.removeItem(`${k}@${n}`); } catch (e) {} }
    players.list = players.list.filter(x => x !== n); playerSet('');
    $('pmenu').hidden = false;
  }, () => { $('pmenu').hidden = false; });
}
$('plSel').addEventListener('change', e => playerSet(e.target.value));
$('plAdd').addEventListener('click', playerAdd);
$('plName').addEventListener('keydown', e => { if (e.key === 'Enter') playerAdd(); });
$('plDel').addEventListener('click', playerDel);
playerUi();
