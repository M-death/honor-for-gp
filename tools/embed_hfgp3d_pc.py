"""d279: embed the PC-quality 3D models (hfgp3d/pc1080ti/*.glb) into js/hfgp3d-glb-pc.js.
Loaded only when the 3D画質 is PC (play3d.js), after js/hfgp3d-glb.js — it adds to the same window.HFGP3D_GLB."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
parts = []
for f in sorted((root / 'hfgp3d/pc1080ti').glob('*.glb')):
    parts.append(f'  "pc1080ti/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"')
(root / 'js/hfgp3d-glb-pc.js').write_text(
    '// PC画質の 3D モデル（hfgp3d/pc1080ti）を埋め込んだもの。tools/embed_hfgp3d_pc.py で作り直す。\n'
    'window.HFGP3D_GLB = Object.assign(window.HFGP3D_GLB || {}, {\n' + ',\n'.join(parts) + '\n});\n', encoding='utf-8')
print('Updated js/hfgp3d-glb-pc.js', len(parts), 'models')
