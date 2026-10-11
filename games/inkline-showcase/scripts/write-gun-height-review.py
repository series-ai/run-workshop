"""Bind lower-chest firearm evidence to the current source, assets, and review files."""
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


def verify_hashes(hashes):
    entries = hashes.items() if isinstance(hashes, dict) else ((item['path'], item['sha256']) for item in hashes)
    for name, expected in entries:
        assert digest(app / name) == expected, name


checks = ['gun-height.json', 'foot-contact.json', 'combat-stance.json', 'firearm-quality.json',
          'reload-support.json', 'figure-motion-quality.json', 'grip-quality.json',
          'avatar-contact.json', 'line-quality.json', 'motion-style.json',
          'timing-contract.json', 'review-page.json', 'motion-library-published.json']
for name in checks:
    evidence = read('gun-height/' + name)
    assert evidence['pass'], name
    if 'hashes' in evidence:
        verify_hashes(evidence['hashes'])

manifest = json.loads((app / 'public/assets/manifest.json').read_text())
assert manifest['version'] == '1.4.4'
characters = {model['id'] for model in manifest['models'] if model['kind'] == 'character'}
assert len(characters) == 12 and len(manifest['animations']) == 85
height = read('gun-height/gun-height.json')
assert not height['failures'] and all(check['pass'] for check in height['checks'])
weapon_clips = {('rifle', 'rifle-idle'), ('rifle', 'rifle-fire'), ('rifle', 'rifle-reload'),
                ('shotgun', 'rifle-idle'), ('shotgun', 'shotgun-fire')}
assert {(check['body'], check['weapon'], check['clip']) for check in height['checks']} == {
    (body, weapon, clip) for body in characters for weapon, clip in weapon_clips}
protected = {'block', 'punch-left', 'punch-right', 'punch-heavy', 'uppercut',
             'kick-front', 'kick-roundhouse', 'kick-air'}
assert {(row['body'], row['clip']) for row in height['preservation']} == {
    (body, clip) for body in characters for clip in protected}
assert all(row['pass'] for row in height['preservation'])
foot = read('gun-height/foot-contact.json')
assert {check['body'] for check in foot['checks']} == characters
assert all(check['declared'] and check['drift'] < .003 and check['heightError'] < .003 for check in foot['checks'])
timing = read('gun-height/timing-contract.json')
assert timing['after'] == manifest['version'] and not timing['changes']
assert timing['sourceSHA256'] == digest(app / 'scripts/blender/characters.py')
quality = read('gun-height/line-quality.json')
assert quality['sourceSHA256'] == digest(app / 'scripts/blender/characters.py')
assert {body['id'] for body in quality['bodies']} == characters
for body in quality['bodies']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["id"]}.glb')
    assert body['parts'] == 6 and body['triangles'] == 1712 and len(body['clips']) == 85
motion = read('gun-height/figure-motion-quality.json')
motion_pairs = sum('clip' in row for row in motion['results'])
assert motion_pairs == 1020 and sum('boundary' in row for row in motion['results']) == 24
assert motion['sourceSha256'] == quality['sourceSHA256']
assert motion['catalogSha256'] == digest(app / 'public/assets/characters.json')
for body in motion['assets']:
    assert body['sha256'] == digest(app / f'public/assets/characters/{body["body"]}.glb')
assert read('gun-height/reload-support.json')['sourceSHA256'] == digest(app / 'src/runtime/assets.ts')

unit = read('gun-height/unit-tests.json')
assert unit['success'] and unit['numFailedTests'] == 0
landing_tests = [suite for suite in unit['testResults'] if suite['name'].endswith('/src/runtime/renderer.test.ts')]
assert len(landing_tests) == 1 and landing_tests[0]['status'] == 'passed'
assert len(landing_tests[0]['assertionResults']) >= 4
browser = read('browser-tests.json')
assert browser['stats']['unexpected'] == 0 and browser['stats']['expected'] >= 13
consumer = read('kinetic/consumer.json')
assert consumer['pass'] and consumer['exportedRuntimeTypecheck'] and not consumer['errors']
for name, expected in consumer['sourceSHA256'].items():
    assert digest(app / 'dist-pack/run-inkline/3D/characters/Source' / name) == expected, name
assert read('kinetic/contact-poses.json')['pass']
independent = read('gun-height/independent-review.json')
assert independent['pass'] and not independent['blockers']
assert all(finding['status'] == 'closed' for finding in independent['findings'])
for field in ('sourceSHA256', 'assetSHA256', 'catalogSHA256', 'evidenceSHA256'):
    verify_hashes(independent[field])

media = read('gun-height/figure-final-media.json')
assert media['version'] == manifest['version'] and not media['errors']
assert sum(group['count'] for group in media['playback'].values()) == 85
verify_hashes(media['sha256'])
published = read('gun-height/motion-library-published.json')
assert published['clipCount'] == 85
verify_hashes({item['file']: item['sha256'] for item in published['files']})

sources = [path for folder in ('src', 'scripts') for path in (app / folder).rglob('*')
           if path.is_file() and path.suffix in ('.ts', '.tsx', '.css', '.py', '.json')]
sources += list((app / 'public/assets').glob('*.json'))
evidence_names = ['gun-height/' + name for name in checks] + [
    'gun-height/unit-tests.json', 'gun-height/independent-review.json', 'gun-height/figure-final-media.json',
    'browser-tests.json', 'kinetic/consumer.json', 'kinetic/contact-poses.json']
artifacts = [path for path in (app / 'public/review').rglob('*') if path.is_file()]
artifacts += list((app / 'public/assets/previews').glob('*.png'))
artifacts += list((app / 'public/assets/source').glob('*.blend'))
artifacts += [reports / name for name in evidence_names]
artifacts += [app / 'docs/gun-height.md']
assets = {model['id']: digest(app / 'public' / model['file']) for model in manifest['models']}
target = reports / 'correction/final-review.json'
backup = target.with_name('final-review-1.4.3.json')
if not backup.exists():
    assert json.loads(target.read_text())['version'] == '1.4.3'
    shutil.copy2(target, backup)
assert json.loads(backup.read_text())['version'] == '1.4.3'
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'version': '1.4.4',
    'scope': 'Lower-chest rifle and shotgun poses, support contact, and protected stance and strike poses.',
    'checks': evidence_names, 'motionPairs': motion_pairs,
    'gunHeightChecks': len(height['checks']), 'protectedClipChecks': len(height['preservation']),
    'footContactChecks': len(foot['checks']), 'unitTests': unit['numPassedTests'],
    'browserTests': browser['stats']['expected'],
    'sourceSHA256': {str(path.relative_to(app)): digest(path) for path in sorted(set(sources))},
    'artifactSHA256': {str(path.relative_to(app)): digest(path) for path in sorted(set(artifacts))},
    'assetSHA256': assets, 'physicalAndroid': 'UNVERIFIED', 'currentPerformanceMeasured': False,
    'historicalPerformanceEvidence': ['browser-benchmark.json', 'polish/browser-benchmark.json', 'stance/browser-benchmark.json'],
    'limits': ['Run-to-idle blends can move support feet.',
               'Ramp movement has no separate terrain targets for each foot.',
               'No new performance measurement was made. Earlier benchmark reports are historical.',
               'Physical Android performance is unverified.'],
}
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: result[key] for key in ('status', 'version', 'motionPairs', 'gunHeightChecks', 'footContactChecks', 'unitTests', 'browserTests')}))
