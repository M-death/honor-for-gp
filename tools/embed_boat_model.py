"""Regenerate the offline JS payload from the bundled, supported GLB model."""
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
payload = base64.b64encode((root / 'assets/boat_racer_lowpoly.glb').read_bytes()).decode('ascii')
(root / 'js/boat-model-data.js').write_text(
    '// Original GLB embedded verbatim so file:// works without fetch or a CDN.\n'
    'window.HFGP_BOAT_GLB_BASE64 = "' + payload + '";\n', encoding='utf-8')
print('Updated js/boat-model-data.js')
