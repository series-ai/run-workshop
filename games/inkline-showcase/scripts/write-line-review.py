"""Record the checked 1.3.1 character files before export."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil

app = Path(__file__).resolve().parent.parent
reports = app / 'docs/verification'

def read(name):
    path = reports / name
    if not path.exists():
        raise SystemExit(f'{name} is not committed (raw QA trace removed from git). '
                         'Regenerate it first with the committed harnesses - see '
                         'docs/verification/README.md, section Raw traces and bundles.')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

checks = [
    'correction/line-quality.json', 'correction/line-motion-quality.json',
    'correction/line-grip-quality.json', 'correction/line-avatar-contact.json',
    'correction/line-fixtures.json', 'correction/release-compatibility.json',
    'kinetic/contact-poses.json', 'kinetic/consumer.json',
    'correction/line-review-page.json',
]
for name in checks:
    assert read(name)['pass'], name
quality = read('correction/line-quality.json')
assert len(quality['bodies']) == 12 and quality['samples'] == 53292
assert quality['sourceSHA256'] == digest(app / 'scripts/blender/characters.py')
for body in quality['bodies']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["id"]}.glb')
    assert body['parts'] == 6 and body['triangles'] == 1712 and len(body['clips']) == 85
motion = read('correction/line-motion-quality.json')
assert sum('clip' in row for row in motion['results']) == 1020
assert sum('boundary' in row for row in motion['results']) == 24
assert motion['sourceSha256'] == quality['sourceSHA256']
assert motion['catalogSha256'] == digest(app / 'public/assets/characters.json')
for body in motion['assets']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["body"]}.glb')
for name in ['correction/line-grip-quality.json']:
    for item in read(name)['hashes']:
        assert digest(app / item['path']) == item['sha256'], item['path']
media = read('correction/figure-final-media.json')
assert media['version'] == '1.3.1' and not media['errors']
assert sum(item['count'] for item in media['playback'].values()) == 85
for name, expected in media['sha256'].items():
    assert digest(app / name) == expected, name
assert read('correction/motion-library-published.json')['clipCount'] == 85
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
sources = sorted(path for path in (app / 'src').rglob('*') if path.is_file())
sources += sorted((app / 'scripts/blender').glob('*.py'))
sources += sorted((app / 'public/assets').glob('*.json'))
artifacts = sorted(path for path in (app / 'public/review').rglob('*') if path.is_file())
artifacts += sorted((app / 'public/assets/scenes').glob('*.glb'))
artifacts += sorted((app / 'public/assets/source').glob('*.blend'))
path = reports / 'correction/final-review.json'
prior = reports / 'correction/final-review-1.3.0.json'
if not prior.exists():
    shutil.copy2(path, prior)
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
    'version': manifest['version'], 'scope': 'Joint geometry and spine-motion follow-up. Prior timed camera and performance evidence applies to its recorded 1.3.0 files.',
    'checks': checks, 'motionPairs': 1020,
    'sourceSHA256': {str(path.relative_to(app)): digest(path) for path in sources},
    'artifactSHA256': {str(path.relative_to(app)): digest(path) for path in artifacts},
    'assetSHA256': {model['id']: digest(app / 'public' / model['file']) for model in manifest['models']},
    'independentReview': 'joint-line-review.md',
    'limits': ['Physical Android performance remains unverified.', 'The 1.3.0 full-pack films are retained and labeled as earlier material.'],
}
path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'version': result['version'], 'assets': len(result['assetSHA256'])}))
