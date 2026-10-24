#!/usr/bin/env node
// 動画用ログ (hfgp-video-replay v1) の検証用デコーダー。
//   node tools/vlog_check.js <file.json.gz | file.json> [--frame N]
// Reads the file the way a replay app should: checks the format name and version, the field list, every frame's shape,
// the 60 Hz times, the events and the sizes — and refuses a file that does not add up instead of guessing.
const fs = require('fs'), zlib = require('zlib');
const FIELDS = ['x', 'y', 'heading', 'v', 'bank', 'slip', 'hop', 'wil', 'porp', 'roll', 'pitch', 'steer', 'thr', 'splashK', 'rpm', 'vl', 'yaw', 'wakeBump', 'flags', 'lap', 'rank', 'fx', 'fy', 'hv', 'landV', 'progress'];
const LIMIT = { bytes: 64 * 1048576, frames: 60 * 60 * 20, events: 200000, boats: 6 };
const fail = msg => { console.error('NG: ' + msg); process.exit(1); };
const path = process.argv[2];
if (!path) fail('usage: node tools/vlog_check.js <file.json.gz|file.json> [--frame N]');
let buf = fs.readFileSync(path);
if (buf.length > LIMIT.bytes) fail(`file too large (${buf.length} bytes)`);
if (buf[0] === 0x1f && buf[1] === 0x8b) {
  try { buf = zlib.gunzipSync(buf, { maxOutputLength: LIMIT.bytes * 4 }); } catch (e) { fail('broken gzip: ' + e.message); }
}
let o;
try { o = JSON.parse(buf.toString('utf8')); } catch (e) { fail('not JSON: ' + e.message); }
if (o.format !== 'hfgp-video-replay') fail(`format is "${o.format}", not hfgp-video-replay`);
if (o.formatVersion !== 1) fail(`formatVersion ${o.formatVersion} is not supported by this reader (1)`);
if (!Array.isArray(o.fields) || o.fields.length !== FIELDS.length || o.fields.some((f, i) => f !== FIELDS[i])) fail('fields do not match version 1');
if (!Array.isArray(o.boatOrder) || !o.boatOrder.length || o.boatOrder.length > LIMIT.boats) fail('bad boatOrder');
const T = o.timing || {};
if (T.sampleHz !== 60) fail('sampleHz is not 60');
if (!Array.isArray(o.frames) || !o.frames.length) fail('no frames');
if (o.frames.length > LIMIT.frames) fail('too many frames');
if (!Array.isArray(o.events) || o.events.length > LIMIT.events) fail('bad events');
const nb = o.boatOrder.length, dt = 1 / T.sampleHz;
let prev = null;
o.frames.forEach((f, i) => {
  if (!Array.isArray(f) || f.length !== 1 + nb) fail(`frame ${i}: ${f && f.length} entries, expected ${1 + nb}`);
  if (typeof f[0] !== 'number') fail(`frame ${i}: no time`);
  if (prev != null && f[0] <= prev) fail(`frame ${i}: time goes backwards (${prev} → ${f[0]})`);
  if (prev != null && Math.abs(f[0] - prev - dt) > 1e-4) fail(`frame ${i}: gap ${(f[0] - prev).toFixed(5)} s is not 1/60`);
  if (Math.abs(f[0] - (T.sampleOriginSec + i * dt)) > 1e-4) fail(`frame ${i}: time ${f[0]} is off the grid`);
  for (let k = 0; k < nb; k++) {
    const b = f[1 + k];
    if (!Array.isArray(b) || b.length !== FIELDS.length) fail(`frame ${i} boat ${o.boatOrder[k]}: ${b && b.length} values, expected ${FIELDS.length}`);
    b.forEach((v, j) => { if (v !== null && typeof v !== 'number') fail(`frame ${i} boat ${o.boatOrder[k]} ${FIELDS[j]}: not a number`); if (v === null && !['fx', 'fy', 'progress'].includes(FIELDS[j])) fail(`frame ${i} boat ${o.boatOrder[k]} ${FIELDS[j]}: null`); });
  }
  prev = f[0];
});
if (Math.abs(o.frames[0][0] - T.actualStartSec) > 1e-4 || Math.abs(prev - T.actualEndSec) > 1e-4) fail('actualStartSec / actualEndSec do not match the frames');
for (let i = 1; i < o.events.length; i++) if (o.events[i].t < o.events[i - 1].t) fail(`event ${i}: out of order`);
const kinds = {}; for (const e of o.events) kinds[e.type] = (kinds[e.type] || 0) + 1;
const R = o.results || {};
console.log(`OK  ${o.format} v${o.formatVersion}  game ${o.gameVersion}  race ${o.raceId}  mode ${o.header && o.header.mode}`);
console.log(`frames ${o.frames.length}  t ${o.frames[0][0].toFixed(3)} … ${prev.toFixed(3)} s  (requested start ${T.requestedStartSec}, missing lead ${(o.quality && o.quality.missingLeadSec || 0).toFixed(2)} s)`);
console.log(`decided ${T.decidedSec}  post-roll ${T.postRoll ? `${T.postRoll.fromSec} → ${T.postRoll.toSec} (${T.postRoll.source})` : '—'}  end ${o.quality && o.quality.endReason}  complete ${o.quality && o.quality.complete}`);
console.log(`boats ${o.boatOrder.join(',')}  events ${o.events.length}  ${Object.entries(kinds).map(([k, n]) => `${k}:${n}`).join(' ')}`);
if (R.order) console.log(`result ${R.order.map(r => `${r.place}-${r.no}`).join(' ')}  決まり手 ${R.kimarite ?? '—'}  1着タイム ${R.winnerTime != null ? R.winnerTime.toFixed(2) : '—'}`);
else if (R.mode === 'ta') console.log(`タイムアタック time ${R.time != null ? R.time.toFixed(2) : '記録なし'} rank ${R.rank ?? '—'}`);
// d171: highlights (formatFeatures highlights-v1; older files have none)
if (o.highlights && Array.isArray(o.highlights.list)) {
  const L = o.highlights.list;
  for (const h of L) if (!(h.t0 <= h.peak && h.peak <= h.t1)) fail(`highlight ${h.id} window out of order`);
  console.log(`highlights ${L.length}  top: ` + L.filter(h => h.top).map(h => `${h.kind}${h.note ? '(' + h.note + ')' : ''} ${h.t0}–${h.t1}s [${h.boats.join(',')}] ${h.score}`).join(' / '));
}
const fi = process.argv.indexOf('--frame');
if (fi > 0) { const f = o.frames[+process.argv[fi + 1]]; if (f) { console.log(`frame t=${f[0]}`); o.boatOrder.forEach((no, k) => console.log(`  ${no}: ` + FIELDS.map((n, j) => `${n}=${f[1 + k][j]}`).join(' '))); } }
