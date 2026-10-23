# 動画用レースログ（hfgp-video-replay 形式 版1）

d164 で実装。指示書 `HFGP_video_log_implementation_spec_v2.md`（動画制作用ログ強化・実装指示書【意見反映版】）に沿っています。リプレイ動画アプリはこのファイルを読みます。

## 1. 使い方（ゲーム側）

- 設定「動画用ログを記録する」がオンなら、各レースを裏で記録します（初期値オン、`localStorage honorGP.vlog` = on / off）。切り替えは次のレースから効きます。
- ファイルになるのは、結果画面かタイムアタックの結果カードで「リプレイ保存」を押したときだけです。押さずに次へ進むと、その記録は消えます。履歴はなく、localStorage や IndexedDB にも残しません。
- 6艇デモでは、上部の「結果で待つ：オン」にすると結果画面で止まり、保存できます。オフのときは結果画面に「次へ進むと、このリプレイは保存できません（N秒後に次のレース）」と出ます。保存ボタンを押すと自動進行は止まります。
- 対象：6艇デモ、進入ありのレース、レース練習、節間、タイムアタック。6艇スタート練習と挙動検証は対象外です。
- ファイル名：`hfgp_video_<版>_<日時>_<raceId>.json.gz`。gzip（CompressionStream）が使えない環境では `.json` になります。

## 2. 収録範囲

- 時刻 `t` は秒で、大時計が0になった瞬間（スタート合図）が0です。
- 開始は −20 秒です。待機行動がそれより短いときは、記録できた最初の時刻から始まります（6艇デモ（進入なし）は約 −15 秒、タイムアタックは約 −12 秒）。記録していない時間を作って書き足すことはしません。不足は `timing.actualStartSec` と `quality.missingLeadSec` で分かります。動画側は待機カットなどで補ってください。
- 終了は、レースが決まった時刻 `timing.decidedSec` の5秒後です。レースが決まる時刻は、全艇ゴール、事故後の着順確定から結果へのスキップ、不成立、タイムアタックのゴールか失敗のいずれかです。
- 後走の5秒は実際の物理計算のままです（`postRoll.source = "live"`）。タイムアタックは結果カードでゲームが止まるため、止まった後は、レバーを戻して惰性で減速する計算で埋めます（`"live+coast"`）。どこから埋めたかは `quality.coastFromSec` と、イベント `coast_start` / `coast_end` で分かります。
- 終了理由（`quality.endReason`）：`finished`、`skipped_after_accident`、`no_race`、`timeout`、`no_record`（TA失敗）、`partial`（未決着で保存）、`ram_limit`。

## 3. 60Hz の取り方

- 物理計算は毎ステップ（通常 1/120 秒、端末によって変わる）で全艇を写し取ります。それを `t = sampleOriginSec + i/60` の格子に直線補間で並べます。描画のFPS、倍速、停止には左右されません。
- 向き（heading）と横すべり（slip）は、±π をまたがない近い側で補間します。flags、lap、rank、fx、fy は補間せず、近い方の値を使います。
- 1ステップで艇が瞬間移動したとき（3m を超え、速度から見てありえない移動）は補間しません。flags に `jump`（256）を立て、イベント `discontinuity` を出します。

## 4. ファイルの中身

```
{ format: "hfgp-video-replay", formatVersion: 1, gameVersion, raceId, createdAt,
  header: { mode, sg, setsu, entryResult, entries[], playerNo, conditions, venue, units, flags, model, audio, effectSeed },
  timing: { sampleHz: 60, requestedStartSec: -20, sampleOriginSec, actualStartSec, actualEndSec, samples, decidedSec, postRoll },
  boatOrder: [1,2,3,4,5,6], fields: [...26 項目], events: [...], results: {...}, terminalSnapshot, quality,
  frames: [ [t, [艇1の26値], [艇2の26値], …], … ] }
```

- `frames` の艇の並びは `boatOrder` の順です。値の並びは `fields` の順です。
- `entries[]` には、艇番、名前、級、色（`colors` = [艇体, 番号]）、コース、スロー/ダッシュ、プレイヤーかどうか、モーター（deashi / mawari / nobi）、チルトが入ります。
- `conditions` には、周回数（2周戦なら2）、風向き、風速、風ベクトル、潮流、波、雨、安定板、気温、潮位が入ります。
- `effectSeed` は raceId から作ったハッシュです。しぶきなどの演出の乱数に使ってください（ゲームの乱数は進めていません）。
- `terminalSnapshot` は最後の時刻（決着の5秒後）の全艇の状態です。

### 4.1 フィールド（版1、26項目）

| # | 名前 | 単位・意味 | 小数 |
|---|---|---|---|
| 0 | x | m、+x = 2D画面の右（1M側） | 2 |
| 1 | y | m、+y = 2D画面の下 | 2 |
| 2 | heading | rad、0 = +x、+ は +y 側へ回る向き | 3 |
| 3 | v | m/s、艇首方向の速さ | 2 |
| 4 | bank | rad、艇の傾き（+ = 右下がり） | 3 |
| 5 | slip | rad、進行方向 − 艇首方向 | 3 |
| 6 | hop | m、跳ねの高さ | 3 |
| 7 | wil | ウィリーの艇首上げ量 | 3 |
| 8 | porp | ポーポイズの量 | 3 |
| 9 | roll | −1〜1、選手の体重移動（+ = 右） | 3 |
| 10 | pitch | −1〜1、選手の姿勢（+ = 前傾、− = 起こす） | 3 |
| 11 | steer | −1〜1、実際に効いたハンドル | 3 |
| 12 | thr | 0〜1、実際に効いたレバー | 3 |
| 13 | splashK | しぶきの強さ | 3 |
| 14 | rpm | 0〜1.15、エンジン音の高さの指標（回転数そのものではない） | 3 |
| 15 | vl | m/s、横方向の速さ | 2 |
| 16 | yaw | rad/s、回頭の速さ | 3 |
| 17 | wakeBump | 引き波を越えた衝撃 | 3 |
| 18 | flags | ビットの和（下表） | 整数 |
| 19 | lap | 周回数 | 整数 |
| 20 | rank | 現在の順位（0 = 順位なし） | 整数 |
| 21 | fx | 落水した選手の x（落水中以外は null） | 2 |
| 22 | fy | 落水した選手の y（落水中以外は null） | 2 |
| 23 | hv | m/s、上下の速さ | 3 |
| 24 | landV | m/s、最後の着水の強さ | 3 |
| 25 | progress | レースの進み具合の値（距離ではない。TAは null） | 2 |

位置の精度は 1cm、角度の精度は 0.001 rad（約 0.06 度）です。公式の時刻（ST・ゴール）はイベントの payload に丸めずに入れています。

### 4.2 flags

| ビット | 名前 | 意味 |
|---|---|---|
| 1 | capHull | 転覆（艇がひっくり返っている） |
| 2 | fallen | 落水（選手が水中にいる。位置は fx, fy） |
| 4 | retired | フライングで1M以降は返還・帰投 |
| 8 | dq | 失格 |
| 16 | flying | フライング |
| 32 | finished | 実際にゴールした（結果だけ割り当てられた艇は含まない） |
| 64 | relegated | 着順の繰り下げ |
| 128 | player | プレイヤーの艇 |
| 256 | jump | このサンプルで瞬間移動した（補間していない） |

### 4.3 イベント

`{ t, type, no, payload }`。`no` は艇番で、全体にかかわるイベントは null です。並びは時刻順です。

| type | payload |
|---|---|
| clock_start / start_signal | なし（大時計の動き出し、0秒） |
| st | `{st, flying, late}`（t = 実際にスタートラインを越えた時刻） |
| mark | `{mark: "1M"/"2M", lap}` ターンマークに差しかかった |
| lap | `{lap}`（TAは `lapTime` も） |
| finish | `{dq, place}`（TAは `{time, place}`） |
| photo | `{place, other, dt, tie}` 写真判定 |
| contact | `{other, J, x, y}` 艇どうしの接触（同じ組は0.25秒に1件、強い方を残す） |
| rear_hit / dump | `{other, J}` / `{other}` |
| hit | `{what}` ブイ・壁など |
| inside_course | 内側航走 |
| capsize / fall | `{why, x, y}` 転覆 / 落水 |
| foul | `{kind: 不良航法 / 待機行動違反, other, why}` |
| dq | `{why}` |
| retire | フライング艇の帰投 |
| order_locked | `{order: [艇番…]}` 事故後の着順確定 |
| result_assigned | `{place}` 走らずに結果が割り当てられた |
| skip | 結果へスキップ |
| willie_start / willie_end | ウィリーの始まりと終わり |
| landing | `{v}` 着水（0.5 m/s 超） |
| bow_dig | 艇首が刺さった |
| wake_hit | `{bump}` 引き波の衝撃（0.3 超） |
| jikkyo | `{key, args, style, text}` 実況（実況オフでも key と args は記録） |
| fail | `{why}` TA の記録なし |
| discontinuity | `{dist}` 瞬間移動 |
| race_end | `{reason, note}` |
| postroll_start / coast_start / coast_end | 後走の区切り |

### 4.4 結果（results）

- レース：`order[]` = `{no, place, course, st, finishT, resultAssigned, dq, out, flying, relegated, fouls, finished}`、`kimarite`、`locked`、`caution`、`photo[]`、`winnerTime`。place は結果画面と同じ表記です（"1"〜、"F"、"L"、"転"、"落"、"失"）。
- タイムアタック：`{mode: "ta", st, laps[], time, rank, noRecord}`。

## 5. 音の作り直し

音は録音しません。`rpm`、`v`、`yaw`、`wakeBump`、`thr` から作り直します。

- `rpm = clamp(0.15 + 0.55*(IDLE + (1−IDLE)*thr) + 0.35*v/23 − 0.1*turnLoad, 0, 1.15)`、IDLE = 0.08。ゲームの音と同じ関数（`engineRpm`）で計算しています。音オフや AudioContext がない状態でも記録されます。
- ゲーム内の音の高さは `58 + 150*rpm + (艇番 % 6)*1.7` Hz です（`header.audio.voices`）。
- 音の作り方が変わったときは `header.audio.audioProfileId` が変わります。

## 5.5 描く向き（d166）

ゲームはターンの入りで尻の流れを大きく見せるため、艇を `heading` より内側に向けて描いています（物理と当たり判定は `heading` のまま）。式と値は `header.view.driftView` に入っています。動画もゲームと同じ見え方にするなら、この式で描く向きを求めてください。

## 6. 容量と負荷（d164 実測）

| レース | 収録 | JSON | gzip | 保存処理 | 記録用RAM |
|---|---|---|---|---|---|
| 6艇デモ（3周） | 156 秒 | 6.17MB | 1.16MB | 0.74 秒 | 5.7MB |
| 進入あり（3周） | 150 秒 | 5.87MB | 1.11MB | 0.79 秒 | 5.7MB |
| SG・事故スキップ | 101 秒 | 3.86MB | 0.70MB | 0.46 秒 | 3.9MB |
| 荒天（2周戦） | 112 秒 | 4.60MB | 0.90MB | 0.87 秒 | 4.3MB |
| タイムアタック | 127 秒 | 約 0.85MB | 約 0.14MB | — | 約 0.8MB |

- 測定はPCの Chromium（ヘッドレス）で、保存処理は JSON 化と gzip の合計です。記録の負荷は物理1ステップあたり約0.04ミリ秒です。
- Android の実機では未確認です。
- 記録用RAMの上限は32MiBです（`VLOG.maxMiB`）。上限に達すると、その時点で記録を終えます（`endReason: "ram_limit"`）。ゲームは続き、それまでの分は保存できます。

## 7. 確認済みのこと

- 競走に影響しないこと：記録オンで、通常384レース（8シード×48）と荒天192レースが d163 と全く同じ結果になりました。記録は乱数（simRandom / Math.random）を使いません。
- 60Hz の格子（1/60 秒刻み、時刻が戻らない）、全サンプルの配列の長さ、イベントの時刻順。
- 開始時刻：進入ありは −20 秒、デモは約 −15 秒、TA は約 −12 秒。
- 終了：通常、事故スキップ、TA のゴールと失敗（惰性で埋める場合も）で、5秒の後走と終了理由が入っていること。
- ブラウザでの確認：保存ボタン、ダウンロード、gzip、デコーダーでの読み込み、結果で待つ、カウントダウン表示、次へで記録が消えること、設定オフでボタンが消えること。

## 8. デコーダー

`node tools/vlog_check.js <file.json.gz|file.json> [--frame N]`

形式名、版、fields、全フレームの形、1/60 の時刻、イベントの順番、件数とサイズの上限を確認し、要約を表示します。壊れた gzip、JSON でないもの、版違い、配列の長さが合わないもの、時刻が戻るものは NG として止めます。

## 9. 版の決まり

- fields を足したり並べ替えたりしたら、`formatVersion` を上げます。
- 読む側は、知らない版は読まずに止めます（項目数を推測しない）。
- 3Dモデルの仕様は `header.model.specId`（今は `boat3d-d163`、MODEL_3D.md 参照）、コースは `venue.venueId` と `courseVersion` です。
