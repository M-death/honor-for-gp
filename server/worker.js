// Honor for GP 波の向こうに — タイムアタック全体ランキング＋ゴースト共有（Cloudflare Workers + D1）
// 版：server v2（2026-11-03）— v2：版（決まり）の一覧 GET /rules、運営だけの表ごと削除 DELETE /ranking?rules= と DELETE /official?rules=
// 必要な設定（Cloudflare の画面で）：
//   D1 バインド   DB          … D1 データベース hfgp を結ぶ
//   シークレット  ADMIN_KEY   … 運営用の合言葉（公式ゴーストの登録・不正記録の削除に使う）
//   変数（任意）  ALLOW_ORIGIN … ゲームを置くサイト（例 https://xxxx.github.io）。カンマ区切りで複数可。空なら全部許可
//   Cron（任意）  1日1回       … 期限切れの鍵付きゴーストを消す（なくても読むときに期限を見るので表には出ない）
// 表は最初のアクセスで自動で作る。

const CFG = {
  nameMax: 12,
  tMin: 95, tMax: 400,          // 3周タイムの妥当な範囲（秒）
  ghostMaxPts: 4000,            // ゲーム側 TA_GHOST.maxPts と同じ
  bodyMax: 300000,              // 1リクエストの最大バイト数
  shareDays: 7,                 // 鍵付きゴーストの保存日数（まえ 2026-11-02）
  writesPerDay: 200,            // 1つの接続元が1日に書き込める回数
  listMax: 100,
  rulesRe: /^honorGP\.ta\.[A-Za-z0-9_.-]{1,24}$/,   // タイムアタックの決まり（ゲームの TA.key）
  codeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',    // 読み間違えやすい 0 O 1 I は使わない
  codeLen: 6,
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, rules TEXT NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL,
     t REAL NOT NULL, st REAL, laps TEXT, game TEXT, at INTEGER NOT NULL, ghost TEXT, UNIQUE(rules, pid))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores(rules, t)`,
  `CREATE TABLE IF NOT EXISTS shares (code TEXT PRIMARY KEY, rules TEXT NOT NULL, name TEXT NOT NULL, t REAL NOT NULL, ghost TEXT NOT NULL,
     at INTEGER NOT NULL, exp INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS shares_exp ON shares(exp)`,
  `CREATE TABLE IF NOT EXISTS official (id INTEGER PRIMARY KEY AUTOINCREMENT, rules TEXT NOT NULL, title TEXT NOT NULL, name TEXT NOT NULL,
     t REAL NOT NULL, ghost TEXT NOT NULL, at INTEGER NOT NULL, exp INTEGER)`,
  `CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL)`,
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
  schemaReady = true;
}

// ---------- 返事 ----------
function corsHeaders(req, env) {
  const allow = String(env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const ok = !allow.length ? '*' : allow.includes(origin) ? origin : allow[0];
  return { 'Access-Control-Allow-Origin': ok, 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
}
const json = (req, env, data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req, env), ...extra } });
const fail = (req, env, status, msg) => json(req, env, { ok: false, error: msg }, status);
class Bad extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------- 中身の確認 ----------
const cleanName = s => String(s || '名無し').replace(/[<>&"'\s@]+/g, '').slice(0, CFG.nameMax) || '名無し';
function checkRules(r) { if (typeof r !== 'string' || !CFG.rulesRe.test(r)) throw new Bad(400, 'タイムアタックの決まりが不正です'); return r; }
function checkTime(t) { if (!(typeof t === 'number' && t >= CFG.tMin && t <= CFG.tMax)) throw new Bad(400, 'タイムが範囲外です'); return Math.round(t * 1000) / 1000; }
// ゲームの taGhostFile() と同じ形。taGhostCheck() と同じ確認をして、余計な項目は捨てる
function checkGhost(o, rules, t) {
  if (!o || o.format !== 'hfgp-ghost' || o.version !== 1) throw new Bad(400, 'ゴーストの形式が違います');
  if (o.rules !== rules) throw new Bad(400, 'ゴーストの決まりが記録と違います');
  const g = o.g;
  if (!Array.isArray(g) || g.length < 30 || g.length % 3 || g.length > CFG.ghostMaxPts * 3 || !g.every(Number.isFinite)) throw new Bad(400, 'ゴーストの中身が壊れています');
  if (!Number.isFinite(o.g0) || !(o.dt > 0 && o.dt <= 1)) throw new Bad(400, 'ゴーストの中身が壊れています');
  const gt = checkTime(o.t);
  if (t != null && Math.abs(gt - t) > 0.05) throw new Bad(400, 'ゴーストのタイムが記録と違います');
  const span = (g.length / 3) * o.dt;   // 記録された時間の長さ ≒ タイム
  if (span < gt - 5 || span > gt + 30) throw new Bad(400, 'ゴーストの長さがタイムと合いません');
  return { format: 'hfgp-ghost', version: 1, game: String(o.game || '').slice(0, 12), rules, laps: o.laps | 0 || 3, dt: o.dt,
    name: cleanName(o.name), t: gt, lapTimes: Array.isArray(o.lapTimes) ? o.lapTimes.slice(0, 5).map(Number).filter(Number.isFinite) : [],
    st: Number.isFinite(o.st) ? o.st : null, rank: String(o.rank || '').slice(0, 12), at: +o.at || 0, g0: o.g0, g };
}
async function readBody(req) {
  const len = +(req.headers.get('Content-Length') || 0);
  if (len > CFG.bodyMax) throw new Bad(413, 'データが大きすぎます');
  const text = await req.text();
  if (text.length > CFG.bodyMax) throw new Bad(413, 'データが大きすぎます');
  try { return JSON.parse(text); } catch (e) { throw new Bad(400, 'JSON が読めません'); }
}
// 書き込みの回数制限（接続元はハッシュにして保存し、IP そのものは残さない）
async function limitWrites(req, env) {
  const day = new Date().toISOString().slice(0, 10);
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + day));
  const k = day + ':' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  const row = await env.DB.prepare(`INSERT INTO hits (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).bind(k).first();
  if (row && row.n > CFG.writesPerDay) throw new Bad(429, '今日はこれ以上登録できません');
}
function isAdmin(req, env) {
  const key = String(env.ADMIN_KEY || ''), got = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (key.length < 12 || got.length !== key.length) return false;
  let d = 0; for (let i = 0; i < key.length; i++) d |= key.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(CFG.codeLen));
  return [...b].map(v => CFG.codeChars[v % CFG.codeChars.length]).join('');
}

// ---------- 各機能 ----------
async function ranking(req, env, url) {
  const rules = checkRules(url.searchParams.get('rules'));
  const limit = Math.max(1, Math.min(CFG.listMax, +url.searchParams.get('limit') || 50));
  const { results } = await env.DB.prepare(`SELECT id, name, t, st, laps, game, at, ghost IS NOT NULL AS hasGhost FROM scores WHERE rules = ? ORDER BY t ASC, at ASC LIMIT ?`).bind(rules, limit).all();
  const list = results.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, t: r.t, st: r.st, laps: r.laps ? JSON.parse(r.laps) : [], game: r.game, at: r.at, ghost: !!r.hasGhost }));
  const total = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE rules = ?`).bind(rules).first()).n;
  let me = null; const pid = url.searchParams.get('pid');
  if (pid) {
    const mine = await env.DB.prepare(`SELECT id, name, t, at, ghost IS NOT NULL AS hasGhost FROM scores WHERE rules = ? AND pid = ?`).bind(rules, String(pid).slice(0, 64)).first();
    if (mine) {
      const ahead = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE rules = ? AND (t < ? OR (t = ? AND at < ?))`).bind(rules, mine.t, mine.t, mine.at).first()).n;
      me = { rank: ahead + 1, id: mine.id, name: mine.name, t: mine.t, ghost: !!mine.hasGhost };
    }
  }
  return json(req, env, { ok: true, rules, total, list, me }, 200, { 'Cache-Control': 'public, max-age=30' });
}

// 自分の記録を送る。前の記録より速いときだけ入れ替わる。ghost は「ゴースト登録しますか？」で はい のときだけ付ける
async function postScore(req, env) {
  const b = await readBody(req);
  const rules = checkRules(b.rules), t = checkTime(b.t);
  const pid = String(b.pid || ''); if (!/^[A-Za-z0-9_-]{16,64}$/.test(pid)) throw new Bad(400, '端末の番号が不正です');
  const ghost = b.ghost ? JSON.stringify(checkGhost(b.ghost, rules, t)) : null;
  await limitWrites(req, env);
  const name = cleanName(b.name), st = Number.isFinite(b.st) ? b.st : null;
  const laps = Array.isArray(b.laps) ? JSON.stringify(b.laps.slice(0, 5).map(Number).filter(Number.isFinite)) : null;
  const game = String(b.game || '').slice(0, 12), now = Date.now();
  const old = await env.DB.prepare(`SELECT id, t FROM scores WHERE rules = ? AND pid = ?`).bind(rules, pid).first();
  let improved = false;
  if (!old) {
    await env.DB.prepare(`INSERT INTO scores (rules, pid, name, t, st, laps, game, at, ghost) VALUES (?,?,?,?,?,?,?,?,?)`).bind(rules, pid, name, t, st, laps, game, now, ghost).run();
    improved = true;
  } else if (t < old.t) {
    await env.DB.prepare(`UPDATE scores SET name=?, t=?, st=?, laps=?, game=?, at=?, ghost=? WHERE id=?`).bind(name, t, st, laps, game, now, ghost, old.id).run();
    improved = true;
  } else {
    // 記録は更新しないが、名前の変更と（同じタイムの）ゴースト登録だけは受ける
    if (ghost && Math.abs(t - old.t) < 0.0005) await env.DB.prepare(`UPDATE scores SET name=?, ghost=? WHERE id=?`).bind(name, ghost, old.id).run();
    else await env.DB.prepare(`UPDATE scores SET name=? WHERE id=?`).bind(name, old.id).run();
  }
  const mine = await env.DB.prepare(`SELECT id, t, at FROM scores WHERE rules = ? AND pid = ?`).bind(rules, pid).first();
  const ahead = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE rules = ? AND (t < ? OR (t = ? AND at < ?))`).bind(rules, mine.t, mine.t, mine.at).first()).n;
  return json(req, env, { ok: true, improved, id: mine.id, best: mine.t, rank: ahead + 1 });
}

// 自分のゴーストを取り下げる／記録ごと消す（端末の番号を知っている本人だけ）
async function withdraw(req, env) {
  const b = await readBody(req);
  const rules = checkRules(b.rules), pid = String(b.pid || '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(pid)) throw new Bad(400, '端末の番号が不正です');
  const q = b.all ? `DELETE FROM scores WHERE rules = ? AND pid = ?` : `UPDATE scores SET ghost = NULL WHERE rules = ? AND pid = ?`;
  const r = await env.DB.prepare(q).bind(rules, pid).run();
  return json(req, env, { ok: true, changed: r.meta.changes });
}

async function getRankGhost(req, env, id) {
  const r = await env.DB.prepare(`SELECT ghost FROM scores WHERE id = ?`).bind(id).first();
  if (!r || !r.ghost) throw new Bad(404, 'このゴーストはありません');
  return json(req, env, JSON.parse(r.ghost), 200, { 'Cache-Control': 'public, max-age=300' });
}

// 鍵付きゴースト：合言葉（6文字）を知っている人だけ取れる。7日で消える
async function postShare(req, env) {
  const b = await readBody(req);
  const rules = checkRules(b.rules);
  const g = checkGhost(b.ghost, rules, null);
  await limitWrites(req, env);
  const now = Date.now(), exp = now + CFG.shareDays * 864e5;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await env.DB.prepare(`INSERT INTO shares (code, rules, name, t, ghost, at, exp) VALUES (?,?,?,?,?,?,?)`).bind(code, rules, g.name, g.t, JSON.stringify(g), now, exp).run();
      return json(req, env, { ok: true, code, exp });
    } catch (e) { if (!/UNIQUE/i.test(String(e))) throw e; }
  }
  throw new Bad(500, '合言葉を作れませんでした。もう一度試してください');
}
async function getShare(req, env, code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = await env.DB.prepare(`SELECT ghost, exp FROM shares WHERE code = ?`).bind(code).first();
  if (!r || r.exp < Date.now()) throw new Bad(404, '合言葉のゴーストが見つかりません（7日で消えます）');
  return json(req, env, { ok: true, exp: r.exp, ghost: JSON.parse(r.ghost) });
}

// 公式（運営・イベント・コラボ）ゴースト：登録と削除は ADMIN_KEY を持つ運営だけ。days を付けなければ期限なし
// 記録のある版（タイムアタックの決まり）の一覧。ランキング画面で版を選ぶのに使う
async function listRules(req, env) {
  const a = (await env.DB.prepare(`SELECT rules, COUNT(*) AS n, MIN(t) AS best, MAX(at) AS last FROM scores GROUP BY rules`).all()).results;
  const b = (await env.DB.prepare(`SELECT rules, COUNT(*) AS n FROM official WHERE exp IS NULL OR exp > ? GROUP BY rules`).bind(Date.now()).all()).results;
  const m = new Map();
  for (const r of a) m.set(r.rules, { rules: r.rules, n: r.n, best: r.best, last: r.last, official: 0 });
  for (const r of b) { const e = m.get(r.rules) || { rules: r.rules, n: 0, best: null, last: 0, official: 0 }; e.official = r.n; m.set(r.rules, e); }
  return json(req, env, { ok: true, list: [...m.values()].sort((x, y) => (y.last || 0) - (x.last || 0)) });
}
// 運営だけ：その版の表を丸ごと消す（公開前のリセットなど）
async function adminClear(req, env, url, table) {
  if (!isAdmin(req, env)) throw new Bad(403, '運営の合言葉が違います');
  const rules = checkRules(url.searchParams.get('rules'));
  const r = await env.DB.prepare(`DELETE FROM ${table} WHERE rules = ?`).bind(rules).run();
  return json(req, env, { ok: true, changed: r.meta.changes });
}
async function listOfficial(req, env, url) {
  const rules = checkRules(url.searchParams.get('rules'));
  const { results } = await env.DB.prepare(`SELECT id, title, name, t, at, exp FROM official WHERE rules = ? AND (exp IS NULL OR exp > ?) ORDER BY id DESC`).bind(rules, Date.now()).all();
  return json(req, env, { ok: true, list: results }, 200, { 'Cache-Control': 'public, max-age=60' });
}
async function getOfficial(req, env, id) {
  const r = await env.DB.prepare(`SELECT ghost, title, exp FROM official WHERE id = ?`).bind(id).first();
  if (!r || (r.exp && r.exp < Date.now())) throw new Bad(404, 'このゴーストはありません');
  return json(req, env, { ok: true, title: r.title, ghost: JSON.parse(r.ghost) }, 200, { 'Cache-Control': 'public, max-age=300' });
}
async function postOfficial(req, env) {
  if (!isAdmin(req, env)) throw new Bad(403, '運営の合言葉が違います');
  const b = await readBody(req);
  const rules = checkRules(b.rules ?? (b.ghost && b.ghost.rules));
  const g = checkGhost(b.ghost, rules, null);
  const title = String(b.title || '作者ゴースト').slice(0, 40);
  const exp = b.days > 0 ? Date.now() + b.days * 864e5 : null;
  const r = await env.DB.prepare(`INSERT INTO official (rules, title, name, t, ghost, at, exp) VALUES (?,?,?,?,?,?,?) RETURNING id`).bind(rules, title, g.name, g.t, JSON.stringify(g), Date.now(), exp).first();
  return json(req, env, { ok: true, id: r.id, exp });
}
async function adminDelete(req, env, table, id) {
  if (!isAdmin(req, env)) throw new Bad(403, '運営の合言葉が違います');
  const r = await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return json(req, env, { ok: true, changed: r.meta.changes });
}

async function cleanup(env) {
  await ensureSchema(env);
  const now = Date.now(), keepHits = new Date(now - 2 * 864e5).toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM shares WHERE exp < ?`).bind(now),
    env.DB.prepare(`DELETE FROM official WHERE exp IS NOT NULL AND exp < ?`).bind(now),
    env.DB.prepare(`DELETE FROM hits WHERE k < ?`).bind(keepHits),
  ]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '') || '/', m = req.method;
    try {
      if (!env.DB) throw new Bad(500, 'D1 が結ばれていません（バインド名 DB）');
      await ensureSchema(env);
      let a;
      if (p === '/' && m === 'GET') return json(req, env, { ok: true, service: 'hfgp-ranking', version: 2 });
      if (p === '/ranking' && m === 'GET') return await ranking(req, env, url);
      if (p === '/score' && m === 'POST') return await postScore(req, env);
      if (p === '/score/withdraw' && m === 'POST') return await withdraw(req, env);
      if ((a = p.match(/^\/ghost\/(\d+)$/)) && m === 'GET') return await getRankGhost(req, env, +a[1]);
      if (p === '/share' && m === 'POST') return await postShare(req, env);
      if ((a = p.match(/^\/share\/([A-Za-z0-9]{4,12})$/)) && m === 'GET') return await getShare(req, env, a[1]);
      if (p === '/rules' && m === 'GET') return await listRules(req, env);
      if (p === '/ranking' && m === 'DELETE') return await adminClear(req, env, url, 'scores');
      if (p === '/official' && m === 'DELETE') return await adminClear(req, env, url, 'official');
      if (p === '/official' && m === 'GET') return await listOfficial(req, env, url);
      if (p === '/official' && m === 'POST') return await postOfficial(req, env);
      if ((a = p.match(/^\/official\/(\d+)$/)) && m === 'GET') return await getOfficial(req, env, +a[1]);
      if ((a = p.match(/^\/official\/(\d+)$/)) && m === 'DELETE') return await adminDelete(req, env, 'official', +a[1]);
      if ((a = p.match(/^\/score\/(\d+)$/)) && m === 'DELETE') return await adminDelete(req, env, 'scores', +a[1]);
      return fail(req, env, 404, 'ありません');
    } catch (e) {
      if (e instanceof Bad) return fail(req, env, e.status, e.message);
      console.error(e);
      return fail(req, env, 500, 'サーバーでエラーが出ました');
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cleanup(env)); },
};
