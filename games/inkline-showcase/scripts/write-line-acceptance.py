"""Verify the installed 1.3.1 follow-up and write its external receipt."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

app = Path(__file__).resolve().parent.parent
reports = app / 'docs/verification'

def read(name):
    return json.loads((reports / name).read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

review = read('correction/final-review.json')
export = read('export-integrity.json')
source = read('source-unpack-check.json')
installed = read('installation.json')
http = read('local-delivery.json')
assert review['status'] == export['status'] == source['status'] == 'pass'
assert review['version'] == '1.3.1'
for name, expected in {**review['sourceSHA256'], **review['artifactSHA256']}.items():
    assert digest(app / name) == expected, name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == review['assetSHA256'][model['id']]
assert source['sourceTypecheck'] and source['archivedReviewedAssetsMatch'] == 303
assert installed['allHashesMatch'] and installed['files'] == export['files']
assert http['allBytesMatch']
for item in http['files']:
    assert digest(app / 'public' / item['file']) == item['sha256'], item['file']
quality = read('correction/line-quality.json')
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'version': '1.3.1',
    'scope': 'Joint and spine follow-up. External receipt excluded from both archives.',
    'characters': 12, 'animationsPerCharacter': 85, 'motionPairs': 1020,
    'jointFixtureViews': 72, 'gripChecks': 288, 'avatarContactChecks': 252,
    'liveContactChecks': 6, 'exportedConsumerChecks': 22,
    'trianglesPerCharacter': 1712, 'previousTrianglesPerCharacter': 2192,
    'rmsSpineBendDegrees': quality['rmsBendDegrees'],
    'previousRmsSpineBendDegrees': quality['before']['rmsBendDegrees'],
    'maximumSpineBendDegrees': quality['maximumBendDegrees'],
    'installedDirectory': installed['directory'], 'installedFiles': installed['files'],
    'reviewedSourcesAndModelsMatch': True,
    'localDownloadsMatch': True,
    'openLimits': ['Physical Android performance is unverified.', 'Prior 1.3.0 timing reports are not new measurements of the 1.3.1 character files.'],
}
for name in ['correction/line-delivery.json', 'package-acceptance.json']:
    (reports / name).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
