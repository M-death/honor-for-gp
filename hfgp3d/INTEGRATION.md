# ゲーム接続仕様

## 座標・原点

- 単位：メートル。glTFは +Y上、+X右舷、−Z舳先。
- 本体の2D座標を `(x, y)` とすると、3D位置は `(x, 上下高さ, y)`。本体がピクセル単位ならメートルへ変換して渡してください。
- これは本体の「+yが画面の下」を、Blenderの `(x,-y,z)` を経由してglTFのY-upに変換した結果です。glTF側でもさらにyの符号を反転すると二重反転になります。
- 艇体原点から `BowTip` は `(0, 0.16, -2.25)`。当たり判定やゴール判定には本体の値を使い、削減後のメッシュ端から計算し直さないでください。
- `RacerMount` は全LODで共通です。選手のGLBルートをここに接続します。既存の別ソケットへさらに二重にオフセットしないでください。

## Three.jsでの最小使用例

`viewer/index.html` と同じimport mapを設定してください。依存ライブラリーは同梱済みです。

```html
<script type="importmap">
{"imports":{"three":"./viewer/vendor/three.module.js"}}
</script>
```

```javascript
import { loadAssetSet } from './runtime/boat_actor.js';

// ルートに置いたHTMLから呼ぶ例。1レース内でロードは一度だけ。
const assets = await loadAssetSet('./', 'mobile'); // または 'pc1080ti'
const actors = [1,2,3,4,5,6].map(lane => {
  const actor = assets.create({
    lane,
    sex: lane === 4 ? 'f' : 'm',
    heightCm: lane === 4 ? 157 : 165,
  });
  scene.add(actor.root);
  return actor;
});

// 毎描画時：ゲーム本体から「計算済みの見た目」を受け取る。
const actor = actors[boatIndex];
actor.setGameTransform({
  x: visual.xMeters,
  y: visual.yMeters,
  hop: visual.heightMeters,
  modelYaw: visual.modelYawRadians,
  modelBank: visual.modelBankRadians,
  nose: visual.noseRadians,
});
actor.updatePose({
  pitch: visual.riderPitch, // [-1,1]：選手の前後姿勢。舳先角とは別。
  roll: visual.riderRoll,   // [-1,1]：選手の左右姿勢。
  steer: visual.motorSteerRadians,
  propAngle: visual.propellerRadians,
  phase: visual.breathPhase ?? 0,
});
actor.chooseLOD(projectedBoatPixels); // 画面内の艇体長のおおよそのpx数
```

`visual` は呼び出し側で用意する変換結果の例で、現在のゲーム本体に同名フィールドがあるという意味ではありません。本体への実配線は別途必要です。古い出走情報に性別・身長がなければ `sex:'m', heightCm:165` としてください。

`modelYaw/modelBank/nose` はラジアンです。`setGameTransform()` はY軸旋回、艇の前方向（−Z）軸バンク、X軸ピッチの順で合成します。元リプレイのBlender式が `Rz(modelYaw) * Ry(modelBank) * Rx(nose)` のときに対応します。`modelYaw = -drawnHeading - PI/2` としていた経路では、同じmodelYawを渡します。通常のheadingを変換せず直接渡さないでください。別エンジンで向きの定義が異なる場合は、本体の直進1フレームを使って符号を確認してください。

## 姿勢とアニメーション

`RacerPose.update()` は身長に合わせて全体を拡縮したうえで、腕のIKで手を固定グリップへ戻し、脚と胴体を操縦姿勢にします。身長は140～200cmを入力可能、数値検証は140・150・157・165・185・200cmで実施しています。腕が届かない極端な姿勢では、姿勢値をCruise方向へ弱めてグリップを保持します。補正するのは選手の見た目だけで、艇体の位置・角度には影響しません。

`pitch/roll` は選手の姿勢の正規化値です。艇体のピッチ角・バンク角をそのまま渡すAPIではありません。ログ／本体の選手姿勢パラメータから対応させてください。

同じ骨格にAnimationMixerと `updatePose()` を同時適用しないでください。付属GLBクリップを使う場合は直接骨格制御を止めます。既定のロード直後のGLBはレスト姿勢です。必ずCruiseを再生するか、`updatePose()` を一度呼んでから表示してください。`BoatActor` は初期化時に自動で呼びます。

## 艇番色・番号

| 材質名 | 内容 |
|---|---|
| `BoatPaint` | 艇番色を掛ける艇体部分 |
| `RacerPaint` | 艇番色を掛けるスーツ・ヘルメット部分 |
| `BoatNumber` | `boat_number_1.png`～`6.png`を割り当てる |
| `RacerNumber` | `racer_bib_1.png`～`6.png`を割り当てる |
| `BoatLivery` | 競艇場・特別レース用の艇体テクスチャー |
| `BoatDetails` / `RacerDetails` | 頂点カラーを使う固定色 |

色順は白・黒・赤・青・黄・緑。`BoatActor` が各艇の材質を複製して色を設定します。共有材質を直接変更すると全艇が同じ色になるため注意してください。番号の画像はsRGB、glTF用の `flipY=false` で割り当てます。艇体模様は同梱画像のUV配置を維持して差し替えられます。

複製は `SkeletonUtils.clone` を使用します。単純な `scene.clone()` ではスキニングの参照が共有され、別艇の姿勢が混ざることがあります。幾何データと画像は共有し、骨格・色を変える材質は各艇で独立させています。

## LODと表示負荷

`setLOD(0|1|2)` は明示指定。`chooseLOD(px)` は画面上の艇体サイズに基づく切り替えで、100px未満で0→1、38px未満で1→2、戻りは130／52pxです。ヒステリシスにより境界でのちらつきを抑えます。俯瞰のズーム範囲に合わせて数値を調整してください。

一度に表示するのは1つのLODだけです。読み込まれている全LODのメッシュ数と、実際の描画呼び出し数は違います。レーサーは姿勢変形による誤ったカリングを避けるため個別メッシュのfrustum cullingを無効にしています。6艇向けの実装です。多数の艇を扱う場合は艇単位の領域判定を追加してください。

非表示のLODには毎フレームIKをかけません。スマホでは必要に応じて選手の姿勢更新を30Hzにし、艇体の移動描画は通常のフレーム更新に保つこともできます。

`dispose()` は各艇専用の材質とスケルトンを破棄します。共有GLB・画像はアセットセットが保持します。レース切り替え時は同じセットを再利用してください。セット自体を完全に破棄するアプリでは、共有geometry・textureも参照を整理して一度だけdisposeする処理を追加してください。

## ボートの可動部分

- 両版：モーター旋回用 `MotorSteer`、取付け用 `MotorTilt`、エフェクト用ソケット。
- PC版：独立した `Propeller` ノード。スマホ版はモーターへ統合。
- ハンドル・スロットルは独立アニメーション対象から省略。
- 舳先の持ち上がり・跳ね・ウィリーは艇体ルートの角度・位置に反映。
- 飛沫、航跡、水面、背景、物理判定、音声はこのパッケージには含まれません。
