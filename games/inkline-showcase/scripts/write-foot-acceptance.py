"""Write the external foot correction receipt after delivery checks pass."""
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
assert review['version'] == '1.4.2' and review['currentPerformanceMeasured'] is False
for name, expected in {**review['sourceSHA256'], **review['artifactSHA256']}.items():
    assert digest(app / name) == expected, name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
assert manifest['version'] == review['version']
assert {model['id'] for model in manifest['models']} == set(review['assetSHA256'])
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == review['assetSHA256'][model['id']]
assert source['finalReviewedSourcesMatch']
assert installed['allHashesMatch'] and installed['files'] == export['files']
assert http['allBytesMatch']
for item in http['files']:
    assert digest(app / 'public' / item['file']) == item['sha256'], item['file']
foot = read('feet/foot-contact.json')
quality = read('feet/line-quality.json')
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'version': '1.4.2',
    'scope': 'Flat-ground foot contact and grounded landing recovery. This external receipt is excluded from both archives.',
    'characters': 12, 'animationsPerCharacter': 85, 'motionPairs': review['motionPairs'],
    'footContactChecks': len(foot['checks']), 'footContactClips': len({check['clip'] for check in foot['checks']}),
    'maximumFootDriftMetres': max(check['drift'] for check in foot['checks']),
    'maximumFootHeightErrorMetres': max(check['heightError'] for check in foot['checks']),
    'stanceChecks': len(read('feet/combat-stance.json')['checks']),
    'firearmChecks': len(read('feet/firearm-quality.json')['checks']),
    'timingChanges': len(read('feet/timing-contract.json')['changes']),
    'gripChecks': len(read('feet/grip-quality.json')['checks']),
    'avatarContactChecks': len(read('feet/avatar-contact.json')['results']),
    'unitTests': review['unitTests'], 'browserTests': review['browserTests'],
    'trianglesPerCharacter': 1712, 'maximumSpineBendDegrees': quality['maximumBendDegrees'],
    'installedDirectory': installed['directory'], 'installedFiles': installed['files'],
    'reviewedSourcesAndModelsMatch': True,
    'localDownloadsMatch': True,
    'currentPerformanceMeasured': False, 'physicalAndroid': 'UNVERIFIED',
    'historicalPerformanceEvidence': review['historicalPerformanceEvidence'],
    'openLimits': review['limits'],
}
for name in ['feet/foot-delivery.json', 'package-acceptance.json']:
    (reports / name).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
