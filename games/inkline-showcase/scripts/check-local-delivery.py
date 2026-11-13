"""Check that the production server delivers the current review and archives."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
from urllib.request import urlopen

app = Path(__file__).resolve().parent.parent
base = 'http://localhost:4197/'
items = [
    'review/joint-before.png', 'review/joint-after.png',
    'review/gun-height-before-rifle.png', 'review/gun-height-after-rifle.png',
    'review/gun-height-before-shotgun.png', 'review/gun-height-after-shotgun.png',
    'review/block-before.png', 'review/block-after.png',
    'review/stance-review.html', 'assets/props/rifle.glb', 'assets/props/shotgun.glb', 'review/effects-library.html', 'review/effects-normal-speed.mp4', 'assets/manifest.json', 'assets/characters.json',
    'review/index.html', 'review/line-before.png', 'review/line-after.png', 'review/line-pale-joints.png', 'review/motion-library.html', 'review/motion-movement.mp4', 'review/motion-combat.mp4', 'review/motion-other.mp4', 'review/inkline-tour.mp4', 'review/captions.vtt',
    'review/inkline-kinetic-comparison.mp4', 'review/kinetic-comparison.png', 'review/inkline-phone.mp4',
    'review/reaction-directions.png', 'review/unarmed-playback.png', 'review/body-family.png', 'review/character-family.png', 'review/service-yard.png', 'review/roof-works.png', 'review/effects-64.png', 'review/animation-expansion.png', 'review/phone-combat.png', 'review/phone-animation.png',
    'assets/scenes/service-yard.glb', 'assets/scenes/roof-works.glb',
]
items += [str(path.relative_to(app / 'public')) for path in sorted((app / 'public/assets/characters').glob('*.glb'))]
items += [str(path.relative_to(app / 'public')) for path in sorted((app / 'public/review/effect-scale').glob('*.jpg'))]
items += [str(path.relative_to(app / 'public')) for path in sorted((app / 'public/review/stance').glob('*.png'))]
results = []
for name in items:
    with urlopen(base + name) as response:
        payload = response.read()
        assert response.status == 200
        assert payload == (app / 'public' / name).read_bytes(), name
        results.append({'file': name, 'bytes': len(payload),
                        'sha256': hashlib.sha256(payload).hexdigest(), 'httpStatus': response.status})
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'demo': base, 'files': results, 'allBytesMatch': True}
(app / 'docs/verification/local-delivery.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
