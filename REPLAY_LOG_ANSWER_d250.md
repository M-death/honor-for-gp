# 回答：リプレイ動画用ログ なにわ競艇場（住之江の仮称）対応

2026-11-07 · 本編側（d250）より

要望書「リプレイ動画用ログ 住之江（仮称）対応の要望書」への回答です。要望はほぼそのまま入れました。項目の詳しい説明は VIDEO_LOG.md の「d250 場の配置」の項、使い方は REPLAY_APP_GUIDE.md §3 にあります。

なお、お持ちのログは d229 のものだと思います。d235 から `header.venue` に `stand`・`back`・`outline`・`startLineK`・`laneYAtSlit`（formatFeatures `venue-geometry-v1`）が入っていて、コースの形はそれでも描けます。d250 では、要望の名前と形でも入れました。

## 質問への回答

| 質問 | 回答 |
| --- | --- |
| `venue` の項目名と形 | 要望1の表の名前をそのまま使いました：`marks`・`course`・`water`・`standsSide`・`stands`・`clock`・`pit`・`lights`・`waterType`・`scenery`・`distMarks`・`jikkyoStyle`。スタートラインは斜めなので、両端の点を `startLine: [[x,y],[x,y]]` に入れました（`startLineX` 0 と `startLineK` も残しています）。`markX` も残しています |
| `formatFeatures` の名前と版 | `venue-layout-v1`（d250〜）。同時に `race-info-v1` も足しました（下の「レース情報」） |
| `venueId` と場名 | `suminoe`（中のIDのまま。画面には出さないでください）／場名「**なにわ競艇場**」（`venue.name`）。ログの `courseVersion` は 2 |
| 両マーク | 1M `{x:150, y:0}`、2M `{x:−150, y:0}`（マーク線は y 0。マーク間300m） |
| スタートライン | `[[0, 0], [3.05, 50.88]]`。スタンドに直角なので、マーク線に対して少し斜めです（x = 0.06 × y） |
| 走れる水面の範囲 | `course` xMin −270・xMax 220・yMin −89.67・yMax 72.6 |
| 水面の外形 | `water`（10点の多角形）。スタンド側の壁はマーク線から 2M 63m・中央 51m・1M 45m、対岸側は 67・75・85m。1Mの後ろ70m、2Mの後ろ120m。四角ではありません |
| 観客席 | `standsSide` "+y"。`stands` は null：本編にスタンドの建物は無いので、置き方はリプレイ側に任せます |
| 大時計 | `clock {x: 0, y: 51, onBank: true}`：スタンド側の岸の真ん中（場の図のとおり） |
| ピット | `pit {x: −262, y: [24, 28.5, 33, 37.5, 42, 46.5], exitHeading: 0}`：2Mの後ろのスタンド側。艇は1M向き、1号艇がいちばん内側 |
| 水質・潮 | 淡水（`waterType` "fresh"）。潮は無し（`tideFlow` 0、`tideLv` null） |
| ナイター | ナイター場には固定しません。昼・夕方・夜はプレイヤーの設定と節間の時刻で決まり、`conditions.timeOfDay` に入ります。照明の並びは両場とも同じ決め方（両岸に40mごと・岸から7m外、両端に3本ずつ）で、柱の位置そのものを `lights.poles` に入れました |
| `windVec` の向き | **吹いていく向き**です（今の読み方のままで合っています）。+x ＝ 1Mへ向かう風 ＝ 追い風、+y ＝ スタンド側へ吹く風 |
| `tideFlow` の向き | 流れていく向きで、+x が正（1Mへ流れる） |
| 標準水面にも入れるか | 入れます。練習コース（`standard`）のログにも同じ項目が入ります（`waterType` "salt"、`scenery` "suburban"） |
| サンプルログ | 今お渡しします（下） |

### 景色・実況

- `scenery`：なにわ "urban"（街並み）、練習コース "suburban"（山と木）。
- `jikkyoStyle`：そのレースの実況の設定（`std` 標準 / `hot` 熱血 / `off` なし）。場ごとのスタイルではなく、プレイヤーの設定です。

### レース情報（`race-info-v1`）

まえの指示で、リプレイが取れる全てのログ（節間・6艇レース・デモ・タイムアタック）に、開始時のレース情報が入るようにしました（`header.race`）。

- 全部：`venueName`（なにわ競艇場／練習コース）と `venueId`、`startTime`。
- 節間：今までどおり（`title`、`raceNo`、`day`／`dayLabel`、`grade`、`startTime`）。
- 6艇レース・デモ：`title`（6艇レース／デモレース）、`raceNo`（その日に走った順で1〜12R、夕方は10〜12R）、`day` 1・`dayLabel` 初日、`startTime`（昼は1R 10:40から30分ごと、ナイターは1R 15:10から）。
- タイムアタック：`title` タイムアタック、`attempt`（何回目か）、`startTime`。`raceNo`・`day` は null。

## サンプルログ（d250、なにわ競艇場、6艇・全編）

`video_log_samples/` に入れました。

| ファイル | 中身 |
| --- | --- |
| `sample_d250_naniwa_day.json.gz` | 昼。1R 10:40 |
| `sample_d250_naniwa_night.json.gz` | 夜（ナイター）。同じ番組の15:40発走 |
| `sample_d250_naniwa_nearbank.json.gz` | 昼。2号艇が1Mの手前でスタンド側の壁から2.75mまで寄ります（x 91・y 44.6 付近）。岸の位置の確認に使ってください |

コース全体のスクリーンショットは今回は付けていません。形はログの `water` が本編と同じ値です。照合に要るなら言ってください。
