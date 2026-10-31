// Honor for GP — 共通データ（選手・場・モーター・ボート・節間の表）。レース・節間・整備・ライフがここを参照する

// ---- 選手：級ごとの腕（ターン・スタート・判断）と個人パラメータ
/* ---------- CPU driver ----------
   Outputs the same four inputs a player gives (lever, rudder, lean, fore-aft),
   so boatPhysics() can't tell a person from the CPU. One driver per boat.
   Profile knobs:
     lean      how far it leans inside in a turn (0..1)
     up        how far it sits up in a turn (0..1) — sitting up is what makes the hang-on bite
     cruise    how flat it crouches on the straights (0..1) — less wind, more speed
     line      turning radius it aims for around a mark (m)
     turnThr   lever kept through the turn
     react     how quickly its body follows its intent (per second)
     leanLate  how late it starts leaning into a turn (m of travel)
     st        target start timing (s after zero), stJit = spread
     wobble    rudder noise
   Optional racing-line knobs (defaults in brackets):
     look0/lookK  how far ahead it aims: look0 + speed*lookK metres [7, 0.55]
     gain         rudder per radian of heading error [2.2]
     preLean      metres before the turn it starts leaning [4]
     exitEarly    metres before the turn ends it sits back up [4]
   SG級 was found by searching these knobs for the fastest clean laps in this physics. */
const DRIVERS = [
  { name: 'A1', gap: 3.2, grip: 1.0,  lean: 1.0,  up: 1.0,  cruise: 1.0,  line: 16, turnThr: 1.0,  react: 9.4, leanLate: 0,  st: 0.08, stJit: 0.03, wobble: 0.02,
    look0: 20.8, lookK: 0.99, gain: 1.58, preLean: 5.3, exitEarly: 0 },
  { name: 'A2', gap: 3.8, grip: 0.97, lean: 1.0,  up: 0.95,  cruise: 0.95,  line: 16, turnThr: 1.0,  react: 9, leanLate: 0,  st: 0.08, stJit: 0.035, wobble: 0.02 , look0: 20.8, lookK: 0.99, gain: 1.58, preLean: 5.3, exitEarly: 0 },
  { name: 'B1', gap: 5, grip: 0.95, lean: 0.9,  up: 0.85,  cruise: 0.85, line: 16.5, turnThr: 1.0, react: 7.5, leanLate: 2, st: 0.13, stJit: 0.07, wobble: 0.04 , look0: 19, lookK: 0.95, gain: 1.7, preLean: 4.5, exitEarly: 1 },
  { name: 'B2', gap: 6.5, grip: 0.93, lean: 0.8,  up: 0.75,  cruise: 0.75, line: 17, turnThr: 0.95,  react: 6, leanLate: 4,  st: 0.2, stJit: 0.12, wobble: 0.07 , look0: 17, lookK: 0.9,  gain: 1.85, preLean: 4, exitEarly: 2 },
  // トップクラス: A1 on the card, but a cut above — tighter to the buoy, more grip, sharper, surer at the start (SG mode only)
  { name: 'TOP', label: 'A1', top: true, gap: 2.8, grip: 1.05, lean: 1.0, up: 1.0, cruise: 1.0, line: 15.5, turnThr: 1.0, react: 10.5, leanLate: 0, st: 0.06, stJit: 0.02, wobble: 0.01, look0: 20.8, lookK: 0.99, gain: 1.58, preLean: 5.3, exitEarly: 0 },
  // 記念クラス (d140): an A1★ that, given a mark to itself, turns like the fastest time-attack run (race.js KINEN). Same tables as TOP.
  { name: 'TOP', label: 'A1', top: true, gap: 2.8, grip: 1.05, lean: 1.0, up: 1.0, cruise: 1.0, line: 15.5, turnThr: 1.0, react: 10.5, leanLate: 0, st: 0.06, stJit: 0.02, wobble: 0.01, look0: 20.8, lookK: 0.99, gain: 1.58, preLean: 5.3, exitEarly: 0 , kinen: true, stCls: { shift: -0.015, sd: 0.022, dent: 0.02 } },
];

// ---- 個人パラメータ (仮): 0–100 per rider. The class tables above are the anchors — a rider at its class's anchor
// value drives exactly like the old class profile; in between, the profile is interpolated field by field.
const SKILL_ANCHOR = [['B2', 28], ['B1', 42], ['A2', 55], ['A1', 70], ['TOP', 82]];
const SKILL_GROUP = { turn: ['gap', 'grip', 'lean', 'up', 'cruise', 'line', 'turnThr', 'leanLate', 'wobble', 'look0', 'lookK', 'gain', 'preLean', 'exitEarly'], judge: ['react'], start: ['st', 'stJit'] };
function skillLerp(v, get) {   // value v → interpolate get(className) between the anchors
  const A = SKILL_ANCHOR; if (v <= A[0][1]) return get(A[0][0]) + (get(A[1][0]) - get(A[0][0])) * (v - A[0][1]) / (A[1][1] - A[0][1]) * 0.5;
  for (let i = 0; i < A.length - 1; i++) if (v <= A[i + 1][1]) { const t = (v - A[i][1]) / (A[i + 1][1] - A[i][1]); return get(A[i][0]) + (get(A[i + 1][0]) - get(A[i][0])) * t; }
  const n = A.length - 1; return get(A[n][0]) + (get(A[n][0]) - get(A[n - 1][0])) * (v - A[n][1]) / (A[n][1] - A[n - 1][1]) * 0.5;
}
const DRV = name => DRIVERS.find(d => d.name === name);
// ---- ネームドレーサー (d203, まえ): a named rider can be put in a 枠 of the 6艇レース (one of each per race).
// prof = the class table it drives by, plus its own ways (race.js / physics.js read the flags):
//   umi — 瀬戸内羽美 (A2, 岡山・児島): pulls to 6コース from any 枠 but the 1 (and from the 1 at any hint of a 前付け);
//   記念-level starts; A2 turns, but takes a clear mark flat out and wide like a 記念 rider (round the outside of a crowd
//   rather than into it); tilt 3.0 always — turns on it without sliding out, still hops on wake; hard to capsize;
//   all but never lets go of the lever, never gives way; leaves her motor as drawn (a bad one stays bad).
const NAMED = [
  { id: 'umi', name: '瀬戸内羽美', kana: 'せとうちうみ', cls: 'A2', branch: '岡山', body: { sex: 'f', height: 145, weight: 41 },
    prof: { ...DRIVERS[1], kinen: true, named: 'umi', label: 'A2', stCls: { shift: -0.045, sd: 0.02, dent: 0.015 }, flyRisk: 0.004,
            wideOut: true, kinenGap: 3, sweep: { from: 30, late: 8, gap: 10, mkR: 12, mkK: 0.6, svMin: 0.3, svEnd: 0, lyMax: 44, wakeDx: [3, 25], wakeDy: [-25, -3], wakeA: 0.25, wakeDx2: 99, leanFrom: 0.4, leanK: 1.6, crouchFrom: 0.5, grid: [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1], wall: 8, slack: 3, minLy: 15 }, softGo: { lead: 1.2, thr: 0.55, hold: 0.4, ahead: 2, calm: 4, roughSd: 0.012, stAdj: 0.045 },
                 noLift: 0.9, tilt: 3.0, tiltTurn: 1, hazMul: 0.3, trait: { pushMul: 2, care: 0.45, resistP: 0.9, shobuMul: 0.4, stSdMul: 0.6 },
            slowTrait: { stShift: 0.05, stSdMul: 1.6, shobuMul: 0 } },   // in the 1コース (slow) her start loses its edge — the 1枠 takes away what makes her good
    temper: 'aggr', out: true, motorLowK: 2 },
];
const NAMED_BY = id => NAMED.find(n => n.id === id);
const profJa = p => p.named ? p.label : p.kinen ? 'A1★記念' : p.top ? 'A1★' : p.name;   // short class tag (result table)
function profFor(cls, sk) {
  const base = DRV(cls) || DRIVERS[2], p = { ...base };
  if (!sk) return p;
  for (const [g, fields] of Object.entries(SKILL_GROUP)) for (const f of fields) p[f] = skillLerp(sk[g], c => DRV(c)[f]);
  p.stCls = {}; for (const f of ['shift', 'sd', 'dent']) p.stCls[f] = Math.max(f === 'shift' ? -0.03 : 0.005, skillLerp(sk.start, c => START_CLASS[c][f]));
  return p;
}

// ---- 選手の気性・戦法と進入志向の表示名
const TACTIC_JA = { makurisashi:'まくり差し', tsuke: 'ツケマイ', wall: '壁', sashiWin: '差し（勝負）', sashiPlace: '差し（着取り）', nige: '逃げ', sashi: '差し', makuri: 'まくり' };
const PREF_JA = { in: 'イン志向', waku: '枠なり', out: 'アウト志向' };
const TEMPER = { calm: { ja: '慎重', dump: 0.05, care: 1.25 }, normal: { ja: '普通', dump: 0.3, care: 0.9 }, aggr: { ja: '攻撃的', dump: 0.75, care: 0.55 } };

// ---- 級ごとのスタートの精度
const START_CLASS = { TOP: { shift: -0.01, sd: 0.028, dent: 0.03 }, A1: { shift: 0, sd: 0.035, dent: 0.05 }, A2: { shift: 0.02, sd: 0.045, dent: 0.07 }, B1: { shift: 0.04, sd: 0.055, dent: 0.09 }, B2: { shift: 0.06, sd: 0.065, dent: 0.12 } };

// ---- 艇番の色
const LANE_COL = [['#f4f7f6', '#0a2c38'], ['#1f2629', '#f4f7f6'], ['#e0453c', '#ffffff'], ['#2f6fe0', '#ffffff'], ['#f2cf2e', '#1c1300'], ['#2fa35a', '#ffffff']];

// ---- 場（水面）：風・潮・波・季節
const ENV_DIRS = ['追い風', '向かい風', '横風(外向き)', '横風(内向き)'];
const SEASONS = { spring: { ja: '春', t: 16 }, summer: { ja: '夏', t: 30 }, autumn: { ja: '秋', t: 20 }, winter: { ja: '冬', t: 7 } };
const TIDE_JA = ['満潮', '下げ潮', '下げ潮', '下げ潮', '下げ潮', '下げ潮', '干潮', '上げ潮', '上げ潮', '上げ潮', '上げ潮', '上げ潮'];
const VENUES = {
  // the one water we have for now; a real 場 later gets its own numbers (淡水: tide.amp 0; 荒れ水面: wave.k up; 追い風の場: dirW)
  standard: { name: '標準水面', water: '海水',
    tide: { amp: 90, flow: 0.25 },                                     // 潮位の振れ (cm) and the current at mid-tide (m/s)
    wind: { strongP: 0.2, base: [0.3, 3], strong: [4, 8], stormP: 0.05, storm: [8, 11], gust: [0.8, 1.2], dirW: [1, 1, 1, 1], keepP: 0.3 },
    rain: { storm: 0.8, strong: 0.25, calm: 0.08 },                      // chance the day is wet (荒天 / 風の強い日 / 穏やかな日)
    wave: { 追い風: 0.8, 向かい風: 1.6, 横風: 1.1, highTide: 1 },          // cm of wave per m/s of wind, + at high tide
    stab: { wave: 5, wind: 6 },                                          // 安定板 when the water is this rough
    short: { wave: 12, wind: 9 },                                        // 周回短縮 (3周→2周) when it is rougher still
    temp: { off: 0, swing: 4, jitter: 3 },                               // ℃ against the season, the day's swing, day to day
    start: { hour: 10 + 40 / 60, per: 0.5 } },                           // R1 at 10:40, then every 30 min
};
const venueOf = key => VENUES[key] || VENUES.standard;

// ---- 節間：日程・得点・級の人数・ペラ・摩耗
const SETSU = {
  days: 6, perDay: 12, pts: [10, 8, 6, 4, 2, 1], foulPts: -7, furyoPts: -10, dqPts: -15,
  cls: { A1: 8, A2: 10, B1: 24, B2: 5 },
  skill: { TOP: 1.0, A1: 0.7, A2: 0.35, B1: 0, B2: -0.45 },
  clsSG: { TOP: 10, A1: 38 },
  courseW: [0.56, 0.14, 0.12, 0.11, 0.06, 0.04], skillK: 1.25, motorK: 17,
  fly: { TOP: 0.0015, A1: 0.002, A2: 0.003, B1: 0.004, B2: 0.006 }, acc: 0.004, omakase: -0.45,
  props: { deashi: { ja: '出足型', low: 6, mid: 2, top: -5 }, bal: { ja: '前の形のまま', low: 0, mid: 0, top: 0 }, nobi: { ja: '伸び型', low: -5, mid: 0, top: 6 } },
  tilts: [-0.5, 0, 0.5, 1, 1.5, 2, 3],
  key: 'hfgp-setsu-v1',
  minWt: { m: 52, f: 47 },
  // d172 体格 (まえ; the life-sim will go deeper): height in cm. 養成所 takes no one over 175 cm, but now and then a rider
  // grew after debut. Taller = the monkey kick and reach (a touch more grip in the turn) but more body in the wind and a
  // heavier natural weight to keep down (wPerCm); shorter = the reverse. Health cost of cutting weight: life-sim.
  body: { hMean: { m: 165, f: 157 }, hSd: 4.5, hMax: 175, growP: 0.02, growMax: 4, wPerCm: 0.3, ref: 165, gripPerCm: 0.002, dragPerCm: 0.0004, femaleP: 0.13 },
  wear: { hi: 0.002, mid: 0.004, lo: 0.007 }, durJa: { hi: '高', mid: '並', lo: '低' }, recover: 0.6,
  get season() { return SEASONS; },
  dayJa: ['前検日', '初日', '2日目', '3日目', '4日目', '5日目（準優勝戦）', '最終日（優勝戦）'],
};
// in-page yes/no (the browser's confirm() drops full screen on phones)

// ---- 節間：選手の名前
const SETSU_SEI = ['佐藤','鈴木','高橋','田中','渡辺','伊藤','山本','中村','小林','加藤','吉田','山田','佐々木','山口','松本','井上','木村','林','清水','山崎','森','池田','橋本','阿部','石川','前田','藤田','小川','岡田','後藤','長谷川','村上','近藤','石井','坂本','遠藤','青木','西村','福田','太田','三浦','藤原','岡本','松田','中川','中島','原田','小野','竹内','金子','和田','中山','石田','上田','森田','柴田','酒井','宮崎','横山','宮本'];
const SETSU_MEI = ['大輔','拓也','翔太','健太','直樹','和也','達也','亮','誠','剛','哲也','雄一','隆之','浩二','慎吾','勇気','颯太','蓮','悠斗','陸','海斗','匠','航','聡','智也','学','修','純一','雅人','秀樹','大樹','祐介','俊介','武','龍之介','翼','優','光','真司','啓太','美咲','彩','愛','舞','遥','結衣','真由','千尋'];
// 読み (テロップ用, d175): same order as SETSU_SEI / SETSU_MEI
const SETSU_SEI_KANA = ['さとう','すずき','たかはし','たなか','わたなべ','いとう','やまもと','なかむら','こばやし','かとう','よしだ','やまだ','ささき','やまぐち','まつもと','いのうえ','きむら','はやし','しみず','やまざき','もり','いけだ','はしもと','あべ','いしかわ','まえだ','ふじた','おがわ','おかだ','ごとう','はせがわ','むらかみ','こんどう','いしい','さかもと','えんどう','あおき','にしむら','ふくだ','おおた','みうら','ふじわら','おかもと','まつだ','なかがわ','なかじま','はらだ','おの','たけうち','かねこ','わだ','なかやま','いしだ','うえだ','もりた','しばた','さかい','みやざき','よこやま','みやもと'];
const SETSU_MEI_KANA = ['だいすけ','たくや','しょうた','けんた','なおき','かずや','たつや','りょう','まこと','つよし','てつや','ゆういち','たかゆき','こうじ','しんご','ゆうき','そうた','れん','ゆうと','りく','かいと','たくみ','わたる','さとし','ともや','まなぶ','おさむ','じゅんいち','まさと','ひでき','だいき','ゆうすけ','しゅんすけ','たけし','りゅうのすけ','つばさ','ゆう','ひかる','しんじ','けいた','みさき','あや','あい','まい','はるか','ゆい','まゆ','ちひろ'];
// "姓 名" → "せい めい" (null for a name that isn't from the tables, e.g. the player's own)
function racerKana(name) {
  const [a, b] = String(name || '').split(' '), i = SETSU_SEI.indexOf(a), k = SETSU_MEI.indexOf(b);
  return i >= 0 && k >= 0 ? SETSU_SEI_KANA[i] + ' ' + SETSU_MEI_KANA[k] : null;
}
// a name for a one-off rider from a hash (no dice: the race is untouched); women take the names from 美咲 on
function racerNameFromHash(h, sex) {
  const fi = SETSU_MEI.indexOf('美咲'), pool = sex === 'f' ? SETSU_MEI.slice(fi) : SETSU_MEI.slice(0, fi);
  return SETSU_SEI[h % SETSU_SEI.length] + ' ' + pool[Math.floor(h / SETSU_SEI.length) % pool.length];
}
const strHash = str => { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

// ---- モーター：素性(0–100)→出足・回り足・伸びの倍率
// multiplier at 0 / 25 / 50 / 75 / 100: steep at the bottom (a ワースト機 is hopeless), flattening at the top
const MOTOR_K = { low: [0.90, 0.97, 1, 1.025, 1.05], mid: [0.92, 0.975, 1, 1.02, 1.04], top: [0.955, 0.985, 1, 1.012, 1.02] };
const motorMul = (x, band) => { const k = MOTOR_K[band], f = clamp(x, 0, 100) / 25, i = Math.min(3, Math.floor(f)); return k[i] + (k[i + 1] - k[i]) * (f - i); };

// ---- ボート：素性→回り・乗り心地・抵抗の倍率
const HULL_K = { turn: [0.95, 1, 1.04], ride: [1.3, 1, 0.75], drag: [1.015, 1, 0.985] };   // multiplier at 0 / 50 / 100
const hullMul = (x, k) => { const [a, m, b] = HULL_K[k]; x = clamp(x, 0, 100); return x < 50 ? a + (m - a) * x / 50 : m + (b - m) * (x - 50) / 50; };
