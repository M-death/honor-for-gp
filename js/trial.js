/* ---------- 体験版 (trial) ----------
   The trial is the main game's files plus this one. d198 (まえ): the public trial has two modes only — タイムアタック and
   6艇レース — and a short settings screen. To update the trial, copy the main game's js/ and index.html over and keep this
   file and its <script> line (and the 体験版 title). */
const TRIAL = { ver: 't88', base: 'd217' };
if ($('verTag')) $('verTag').textContent = `${TRIAL.ver}（${GAME_VER}）`;
const trialHide = el => { if (!el) return; el.hidden = true; el.style.display = 'none'; };
// modes and tools that aren't in the trial
for (const id of ['labLaunch', 'labLaunchStart', 'goDemo', 'entryBtn', 'sgBtn', 'logBtn', 'slitBtn', 'vlHold',
                  'pm6', 'pmRace', 'pmTALog', 'pmTenji', 'pmClock', 'pmSetsu', 'pmReplay', 'taLog', 'taSlit']) trialHide($(id));
// start screen: タイムアタック / 6艇レース
$('go').textContent = 'タイムアタック';
$('goRace').className = 'btn';
// menu: the two modes, no long explanations
for (const p of $('pmenu').querySelectorAll('p')) trialHide(p);
{ const s = $('pmenu').querySelector('h1 small'); if (s) s.textContent = 'メニュー'; }
$('again').textContent = 'メニュー';
$('pmTA').textContent = 'タイムアタック（1艇・3周・級判定）';
$('pmRaceMode').textContent = '6艇レース';
// settings: what a player needs; the rest of the controls under 詳しい操作設定, the developer ones gone
{
  const lab = id => $(id) && $(id).closest('label');
  for (const id of ['demoCpuMode', 'tiltSel', 'fpsOn', 'wxMode', 'vlogOn', 'simSpeed']) {
    const l = lab(id); trialHide(l);
    const nx = l && l.nextElementSibling; if (nx && nx.tagName === 'P') trialHide(nx);
  }
  { const nx = lab('sens') && lab('sens').nextElementSibling; if (nx && nx.tagName === 'P') trialHide(nx); }
  const det = document.createElement('details'), sum = document.createElement('summary');
  sum.textContent = '詳しい操作設定'; sum.style.cursor = 'pointer'; det.appendChild(sum);
  const box = document.createElement('div'); box.className = 'set'; box.style.marginTop = '6px'; det.appendChild(box);
  $('zero').after(det);
  for (const el of [$('wheelSettings'), lab('invR'), lab('invP')]) if (el) box.appendChild(el);
}
// the top bar's 6艇デモ button is only 「やめる」 during a race in the trial
{ const _r = refreshFleetUi; refreshFleetUi = () => { _r(); $('demoBtn').hidden = !fleet; }; $('demoBtn').hidden = !fleet; }
// 「タイムアタック」 (and A on the start screen) begins a タイムアタック
{ const _start = start; start = after => _start(after || beginTA); }
