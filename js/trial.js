/* ---------- 体験版 (trial) ----------
   The trial is the main game's files plus this one: it hides the modes that aren't in the trial and makes
   「スタート」 go straight into タイムアタック. To update the trial, copy the main game's js/ and index.html over
   and keep this file and its <script> line (and the 体験版 title). */
const TRIAL = { ver: 't52', base: 'd181' };
if ($('verTag')) $('verTag').textContent = `${TRIAL.ver}（${GAME_VER}）`;
const TRIAL_HIDE = ['labLaunch', 'labLaunchStart', 'entryBtn', 'sgBtn', 'logBtn', 'pm6', 'pmRace', 'pmSetsu', 'pmReplay'];
for (const id of TRIAL_HIDE) {
  const el = $(id); if (!el) continue;
  el.hidden = true; el.style.display = 'none';
  const nx = el.nextElementSibling; if (nx && nx.tagName === 'P') nx.style.display = 'none';
}
{ const sel = $('demoCpuMode'); if (sel && sel.closest('label')) sel.closest('label').style.display = 'none'; }
// 「スタート」 (and A on the start screen) begins a タイムアタック
{ const _start = start; start = after => _start(after || beginTA); }
