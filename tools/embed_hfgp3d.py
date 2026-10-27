"""d183: embed the 3D（新モデル） GLBs (hfgp3d/mobile/*.glb) into js/hfgp3d-glb.js.
The published page can't serve .glb files, so boat3dx.js reads them from this script instead
(GitHub Pages could fetch them, but one path for both keeps it simple). Run after replacing a GLB."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
parts = []
for f in sorted((root / 'hfgp3d/mobile').glob('*.glb')):
    parts.append(f'  "mobile/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"')
(root / 'js/hfgp3d-glb.js').write_text(
    '// 3D（新モデル）の GLB（hfgp3d/mobile）をそのまま埋め込んだもの。tools/embed_hfgp3d.py で作り直す。\n'
    'window.HFGP3D_GLB = {\n' + ',\n'.join(parts) + '\n};\n', encoding='utf-8')
print('Updated js/hfgp3d-glb.js', len(parts), 'models')
