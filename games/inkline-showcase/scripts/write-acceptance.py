"""Write the external delivery receipt after archive and installation checks."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

app = Path(__file__).resolve().parent.parent
evidence = app / 'docs/verification'

def read(name):
    path = evidence / name
    if not path.exists():
        raise SystemExit(f'{name} is not committed (raw QA trace removed from git). '
                         'Regenerate it first with the committed harnesses - see '
                         'docs/verification/README.md, section Raw traces and bundles.')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

assert read('correction/final-review.json')['status'] == 'pass'
checks = {}
for name in ['art-pass/art-pass.json', 'kinetic/runtime.json',
             'kinetic/contact-poses.json', 'correction/camera-motion.json',
             'kinetic/avatar-framing.json', 'expansion/runtime.json',
             'kinetic/grounded-export.json', 'kinetic/consumer.json',
             'correction/figure-motion-quality.json',
             'correction/release-compatibility.json',
             'correction/avatar-contact.json', 'correction/bow-string.json',
             'correction/head-connection.json',
             'correction/runtime-travel-loop.json',
             'correction/outline/report.json', 'correction/reactions/report.json',
             'correction/camera-performance.json']:
    result = read(name)
    assert result['pass'], name
    checks[name] = len(result.get('checks', result.get('results', [])))
assert read('correction/prop-surfaces.json')['summary']['passed']
checks['correction/prop-surfaces.json'] = read('correction/prop-surfaces.json')['files']
assert read('correction/scene-orange-surfaces.json')['summary']['passed']
checks['correction/scene-orange-surfaces.json'] = read('correction/scene-orange-surfaces.json')['summary']['scenes_scanned']

assets = read('asset-report.json')
motion = read('motion-bounds.json')
interface = read('browser-tests.json')['stats']
review = read('recording/review-check.json')
tour = read('recording/metadata.json')
phone = read('recording/phone-metadata.json')
secondary = read('recording/secondary-videos.json')
benchmark = read('browser-benchmark.json')
export = read('export-integrity.json')
source = read('source-unpack-check.json')
installed = read('installation.json')
http = read('local-delivery.json')
assert len(motion['results']) == assets['characters'] * assets['animationsPerCharacter'] and all(row['finite'] for row in motion['results'])
assert interface['expected'] == 13 and not interface['unexpected'] and not interface['flaky']
assert not tour['errors'] and len(tour['chapters']) == 9
assert not review['errors'] and review['chapters'] == 9 and review['imageCount'] == 16
assert review['motionLibrary']['clips'] == 85 and len(review['motionLibrary']['videos']) == 3
assert not phone['errors'] and phone['score'] > 0 and secondary['pass']
assert len(benchmark['runs']) == 3 and benchmark['runs'][0]['elapsedSeconds'] >= 900
for name, expected in benchmark['sourceSHA256'].items():
    assert digest(app / name) == expected, f'Measured source changed: {name}'
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == benchmark['assetSHA256'][model['id']], model['id']
assert not benchmark['pageErrors'] and export['status'] == source['status'] == 'pass'
assert source['sourceTypecheck'] and source['archivedMeasuredAssetsMatch'] == 303
assert installed['allHashesMatch'] and installed['files'] == export['files']
assert http['allBytesMatch']
for item in http['files']:
    assert digest(app / 'public' / item['file']) == item['sha256'], item['file']
for item in secondary['videos']:
    assert digest(app / item['file']) == item['sha256'], item['file']

result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
    'scope': 'External receipt. This file is excluded from both archives.',
    'version': json.loads((app / 'public/assets/manifest.json').read_text())['version'], 'models': assets['characters'] + assets['props'],
    'characters': assets['characters'], 'props': assets['props'], 'effects': 64,
    'animationsPerCharacter': assets['animationsPerCharacter'],
    'unitTests': read('correction/final-review.json')['unitChecks'],
    'browserTests': interface['expected'], 'motionPairs': len(motion['results']),
    'checks': checks, 'videoSeconds': tour['video']['duration'],
    'comparisonSeconds': review['comparison']['duration'],
    'phoneVideoSeconds': review['phoneVideo']['duration'], 'videoChapters': 9,
    'fullMotionReviewClips': review['motionLibrary']['clips'],
    'installedDirectory': installed['directory'], 'installedFiles': installed['files'],
    'measuredRuntimeAndModelsMatch': True,
    'localDownloadsMatch': True,
    'openLimits': ['Physical performance on a 2022 Android phone is unverified.'],
}
(evidence / 'package-acceptance.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
