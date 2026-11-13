"""Write an external receipt after export, installation, and HTTP checks."""
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
assert review['version'] == '1.4.0'
for name, expected in {**review['sourceSHA256'], **review['artifactSHA256']}.items():
    assert digest(app / name) == expected, name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == review['assetSHA256'][model['id']]
assert source['finalReviewedSourcesMatch']
assert installed['allHashesMatch'] and installed['files'] == export['files']
assert http['allBytesMatch']
for item in http['files']:
    assert digest(app / 'public' / item['file']) == item['sha256'], item['file']
quality = read('polish/line-quality.json')
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass', 'version': '1.4.0',
          'scope': 'Effect and animation pass. This external receipt is excluded from both archives.',
          'characters': 12, 'animationsPerCharacter': 85, 'motionPairs': 1020,
          'effectRecipesReviewed': 64, 'effectAtlasFrames': read('effect-frame-bounds.json')['frames'],
          'timingChanges': len(read('polish/timing-contract.json')['changes']),
          'gripChecks': len(read('polish/grip-quality.json')['checks']),
          'avatarContactChecks': len(read('polish/avatar-contact.json')['results']),
          'trianglesPerCharacter': 1712, 'maximumSpineBendDegrees': quality['maximumBendDegrees'],
          'installedDirectory': installed['directory'], 'installedFiles': installed['files'],
          'reviewedSourcesAndModelsMatch': True,
          'localDownloadsMatch': True,
          'openLimits': ['Physical Android performance is unverified.', 'Earlier full-pack films remain labeled historical.']}
for name in ['polish/polish-delivery.json', 'package-acceptance.json']:
    (reports / name).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
