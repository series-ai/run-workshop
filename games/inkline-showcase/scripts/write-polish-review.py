"""Verify current polish evidence before the pack is exported."""
from pathlib import Path
from datetime import datetime, timezone
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
checks = ['polish/motion-quality.json', 'polish/grip-quality.json', 'polish/avatar-contact.json',
          'polish/line-quality.json', 'polish/motion-style.json', 'polish/timing-contract.json', 'polish/reload-support.json',
          'polish/effects-after.json', 'polish/effect-quality.json', 'polish/review-page.json',
          'polish/motion-library-published.json', 'polish/game-visual.json', 'kinetic/contact-poses.json', 'kinetic/consumer.json']
for name in checks:
    assert read(name)['pass'], name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
assert manifest['version'] == '1.4.0'
quality = read('polish/line-quality.json')
assert len(quality['bodies']) == 12
assert quality['sourceSHA256'] == digest(app / 'scripts/blender/characters.py')
for body in quality['bodies']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["id"]}.glb')
    assert body['parts'] == 6 and body['triangles'] == 1712 and len(body['clips']) == 85
motion = read('polish/motion-quality.json')
assert sum('clip' in row for row in motion['results']) == 1020
assert sum('boundary' in row for row in motion['results']) == 24
assert motion['sourceSha256'] == quality['sourceSHA256']
assert motion['catalogSha256'] == digest(app / 'public/assets/characters.json')
for body in motion['assets']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["body"]}.glb')
for item in read('polish/grip-quality.json')['hashes']:
    assert digest(app / item['path']) == item['sha256'], item['path']
for name in ['polish/figure-final-media.json', 'polish/effect-media.json']:
    media = read(name)
    assert media['version'] == manifest['version'] and not media['errors']
    for path, expected in media['sha256'].items():
        assert digest(app / path) == expected, path
assert sum(item['count'] for item in read('polish/figure-final-media.json')['playback'].values()) == 85
assert read('polish/effect-media.json')['count'] == 64
assert read('polish/effects-after.json')['sourceSHA256'] == digest(app / 'src/runtime/effects.ts')
assert read('polish/reload-support.json')['sourceSHA256'] == digest(app / 'src/runtime/assets.ts')
performance = read('polish/browser-benchmark.json')
assert len(performance['runs']) == 3 and not performance['pageErrors']
assert performance['runs'][0]['elapsedSeconds'] >= 60
for name, expected in performance['sourceSHA256'].items():
    assert digest(app / name) == expected, name
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == performance['assetSHA256'][model['id']]
game = read('polish/game-performance.json')
assert len(game['runs']) == 4 and not game['pageErrors']
for name, expected in game['sourceSHA256'].items():
    assert digest(app / name) == expected, name
for name, expected in read('polish/motion-style.json')['hashes'].items():
    assert digest(app / name) == expected, name
for name in ['effect-independent-review.md', 'animation-final-review.md']:
    assert (reports / 'polish' / name).stat().st_size > 200
coverage = read('polish/animation-final-coverage.json')
assert coverage['version'] == manifest['version'] and len(coverage['coverage']) == 85
for name, expected in coverage['filmSHA256'].items():
    assert digest(app / name) == expected, name
sources = sorted(path for path in (app / 'src').rglob('*') if path.is_file())
sources += sorted((app / 'scripts/blender').glob('*.py'))
sources += sorted((app / 'public/assets').glob('*.json'))
artifacts = sorted(path for path in (app / 'public/review').rglob('*') if path.is_file())
artifacts += sorted((app / 'public/assets/scenes').glob('*.glb'))
artifacts += sorted((app / 'public/assets/source').glob('*.blend'))
path = reports / 'correction/final-review.json'
prior = reports / 'correction/final-review-1.3.1.json'
if not prior.exists():
    shutil.copy2(path, prior)
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
          'version': manifest['version'], 'scope': 'Full effect and animation review. Targeted pose, timing, scale, and readability corrections.',
          'checks': checks, 'motionPairs': 1020,
          'sourceSHA256': {str(path.relative_to(app)): digest(path) for path in sources},
          'artifactSHA256': {str(path.relative_to(app)): digest(path) for path in artifacts},
          'assetSHA256': {model['id']: digest(app / 'public' / model['file']) for model in manifest['models']},
          'independentReview': ['polish/effect-independent-review.md', 'polish/animation-final-review.md'],
          'performanceEvidence': 'polish/browser-benchmark.json',
          'limits': ['Physical Android performance remains unverified.', 'The 1.3.0 full-pack films and 1.3.1 joint sheets are labeled as earlier material.']}
path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'version': result['version'], 'assets': len(result['assetSHA256'])}))
