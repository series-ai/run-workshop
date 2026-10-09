"""Pack rendered effect frames into transparent 4 by 2 sprite sheets."""
from pathlib import Path
import json
from datetime import datetime, timezone
from PIL import Image

root = Path(__file__).resolve().parent.parent / 'public/assets'
effects = json.loads((root / 'effects.json').read_text())['effects']
atlas = []
results = []
for effect in effects:
    sheet = Image.new('RGBA', (1536, 768), (0, 0, 0, 0))
    for frame in range(8):
        source = Image.open(root.parent.parent / '.cache/effect-frames' / f'{effect["id"]}-{frame}.png').convert('RGBA')
        bounds = source.getchannel('A').getbbox()
        if bounds and (bounds[0] < 2 or bounds[1] < 2 or bounds[2] > 382 or bounds[3] > 382):
            raise ValueError(f"Effect frame touches its border: {effect['id']} frame {frame}, {bounds}")
        if frame == 7 and bounds is not None:
            raise ValueError(f"Last effect frame must be clear: {effect['id']}")
        margin = min(bounds[0], bounds[1], 384 - bounds[2], 384 - bounds[3]) if bounds else None
        results.append({'file': f'{effect["id"]}-{frame}.png', 'bounds': bounds, 'margin': margin})
        sheet.paste(source, ((frame % 4) * 384, (frame // 4) * 384))
    output = root / 'effects' / f'{effect["id"]}.png'
    sheet.save(output, optimize=True)
    atlas.append({'id': effect['id'], 'file': f'effects/{effect["id"]}.png', 'columns': 4, 'rows': 2, 'frames': 8, 'frameWidth': 384, 'frameHeight': 384, 'duration': round(max([effect['duration']] + [layer.get('duration', effect['duration']) for layer in effect.get('layers', [])]) * 1.25 * 8 / 7, 4), 'alpha': True})
(root / 'effects/atlas.json').write_text(json.dumps({'version': 1, 'effects': atlas}, indent=2) + '\n')
print(f'Packed {len(atlas)} transparent effect sheets.')

report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'frames': len(results), 'clippedFrames': 0, 'minimumMargin': min(item['margin'] for item in results if item['margin'] is not None), 'results': results}
(root.parent.parent / 'docs/verification/effect-frame-bounds.json').write_text(json.dumps(report, indent=2) + '\n')
