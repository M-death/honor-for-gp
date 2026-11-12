"""d280: embed the 3D venue models (hfgp3d/venue/*.glb, from the replay assets v0.30: 09_city, 04_venue floodlight_mast,
07_background spectators / trees / buildings / terrain) into js/hfgp3d-glb-venue.js. Loaded by js/venue3d.js on スマホリッチ and PC."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
parts = [f'  "venue/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"' for f in sorted((root / 'hfgp3d/venue').glob('*.glb'))]
(root / 'js/hfgp3d-glb-venue.js').write_text(
    '// 3D の会場モデル（hfgp3d/venue、リプレイ用アセット v0.30 から）を埋め込んだもの。tools/embed_venue3d.py で作り直す。\n'
    'window.HFGP3D_GLB = Object.assign(window.HFGP3D_GLB || {}, {\n' + ',\n'.join(parts) + '\n});\n', encoding='utf-8')
print('Updated js/hfgp3d-glb-venue.js', len(parts), 'models')
