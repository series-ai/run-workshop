"""Bind the completed stance and firearm checks to the delivered files."""
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
checks = ['combat-stance.json', 'firearm-quality.json', 'reload-support.json',
          'figure-motion-quality.json', 'grip-quality.json', 'avatar-contact.json',
          'line-quality.json', 'motion-style.json', 'timing-contract.json',
          'review-page.json', 'motion-library-published.json', 'capture.json']
for name in checks:
    assert read('stance/' + name)['pass'], name
timing = read('stance/timing-contract.json')
assert not timing['changes']
unit = read('stance/unit-tests.json')
assert unit['success'] and unit['numFailedTests'] == 0
browser = read('browser-tests.json')
assert browser['stats']['unexpected'] == 0 and browser['stats']['expected'] >= 13
consumer = read('kinetic/consumer.json')
assert consumer['pass'] and consumer['exportedRuntimeTypecheck']
assert read('kinetic/contact-poses.json')['pass']
independent = read('stance/independent-review.json')
assert independent['pass'] and not independent['openFindings']
for name, expected in independent['hashes'].items():
    assert digest(app / name) == expected, name
media = read('stance/figure-final-media.json')
assert not media['errors'] and sum(group['count'] for group in media['playback'].values()) == 85
for name, expected in media['sha256'].items():
    assert digest(app / name) == expected, name
benchmark = read('stance/browser-benchmark.json')
assert len(benchmark['runs']) == 3 and not benchmark['pageErrors']
for name, expected in benchmark['sourceSHA256'].items():
    assert digest(app / name) == expected, name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
assert manifest['version'] == '1.4.1'
sources = [path for folder in ('src', 'scripts') for path in (app / folder).rglob('*')
           if path.is_file() and path.suffix in ('.ts', '.tsx', '.css', '.py', '.json')]
sources += list((app / 'public/assets').glob('*.json'))
artifacts = [path for path in (app / 'public/review').rglob('*') if path.is_file()]
artifacts += list((app / 'public/assets/previews').glob('*.png'))
artifacts += list((app / 'public/assets/source').glob('*.blend'))
artifacts += [reports / 'stance' / name for name in checks]
artifacts += [reports / 'stance/independent-review.json', reports / 'stance/unit-tests.json', reports / 'stance/browser-benchmark.json']
assets = {model['id']: digest(app / 'public' / model['file']) for model in manifest['models']}
assert assets == benchmark['assetSHA256']
target = reports / 'correction/final-review.json'
backup = target.with_name('final-review-1.4.0.json')
if not backup.exists():
    assert json.loads(target.read_text())['version'] == '1.4.0'
    shutil.copy2(target, backup)
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'version': '1.4.1',
    'scope': 'Combat stance and rifle/shotgun fit, recoil, support hand, pump, and magazine contacts.',
    'checks': ['stance/' + name for name in checks] + ['kinetic/consumer.json', 'kinetic/contact-poses.json', 'browser-tests.json'],
    'motionPairs': 1020, 'unitTests': unit['numPassedTests'], 'browserTests': browser['stats']['expected'],
    'sourceSHA256': {str(path.relative_to(app)): digest(path) for path in sorted(set(sources))},
    'artifactSHA256': {str(path.relative_to(app)): digest(path) for path in sorted(set(artifacts))},
    'assetSHA256': assets, 'physicalAndroid': 'UNVERIFIED',
}
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: result[key] for key in ('status', 'version', 'motionPairs', 'unitTests', 'browserTests')}))
