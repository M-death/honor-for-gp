"""d183: embed the 3D（新モデル） GLBs (hfgp3d/mobile/*.glb) into js/hfgp3d-glb.js.
The published page can't serve .glb files, so boat3dx.js reads them from this script instead
(GitHub Pages could fetch them, but one path for both keeps it simple). Run after replacing a GLB."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
parts = []
for f in sorted((root / 'hfgp3d/mobile').glob('*.glb')):
    parts.append(f'  "mobile/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"')
# d324 (まえ: Wi-Fi の調子が悪いと「組み立て中」が終わらなかった): the rig and the 12 number textures ride along too, so 組み立て
# needs no request of its own (play3d.js answers fetch / TextureLoader from these)
# d369: the realistic racers' phone textures (racer_real_*_1k) too; the 2k ones go with the PC models (embed_hfgp3d_pc.py)
for f in [root / 'hfgp3d/runtime/rig_rest.json', *sorted(f for f in (root / 'hfgp3d/textures').glob('*.*') if f.suffix in ('.png', '.jpg') and '_2k.' not in f.name)]:
    parts.append(f'  "{f.parent.name}/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"')
# d376: the venue paint sheets (hfgp3d/liveries/<venue>/livery.json + its images, hfgp-livery-v1) — small flat PNGs
for f in sorted((root / 'hfgp3d/liveries').glob('*/*.*')):
    if f.suffix.lower() in ('.json', '.png', '.jpg', '.jpeg', '.webp'):
        parts.append(f'  "liveries/{f.parent.name}/{f.name}": "' + base64.b64encode(f.read_bytes()).decode('ascii') + '"')
(root / 'js/hfgp3d-glb.js').write_text(
    '// 3D（新モデル）の GLB（hfgp3d/mobile）をそのまま埋め込んだもの。tools/embed_hfgp3d.py で作り直す。\n'
    'window.HFGP3D_GLB = {\n' + ',\n'.join(parts) + '\n};\n', encoding='utf-8')
print('Updated js/hfgp3d-glb.js', len(parts), 'files')
