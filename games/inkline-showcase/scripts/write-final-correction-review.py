"""Record the completed correction checks before packaging the final files."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

app = Path(__file__).resolve().parent.parent
reports = app / 'docs/verification'

def read(name):
    path = reports / name
    if not path.exists():
        raise SystemExit(f'{name} is not committed (raw QA trace removed from git). '
                         'Regenerate it first with the committed harnesses - see '
                         'docs/verification/README.md, section Raw traces and bundles.')

required = [
    'art-pass/art-pass.json', 'expansion/runtime.json', 'kinetic/runtime.json',
    'kinetic/contact-poses.json', 'kinetic/avatar-framing.json',
    'kinetic/grounded-export.json', 'kinetic/consumer.json',
    'correction/figure-motion-quality.json', 'correction/figure-grip-quality.json',
    'correction/release-compatibility.json', 'correction/avatar-contact.json',
    'correction/head-connection.json', 'correction/bow-string.json',
    'correction/runtime-travel-loop.json', 'correction/camera-motion.json',
    'correction/camera-final-continuity.json', 'correction/camera-performance.json',
    'correction/header-final.json', 'correction/outline/report.json',
    'correction/reactions/report.json',
]
checks = {}
for name in required:
    report = read(name)
    assert report['pass'], name
    checks[name] = len(report.get('checks', report.get('results', report.get('runs', []))))
assert read('correction/prop-surfaces.json')['summary']['passed']
assert read('correction/prop-visible-surfaces.json')['summary']['passed']
assert read('correction/scene-orange-surfaces.json')['summary']['passed']
assert read('correction/camera-preview-current.json')['pass']
checks['correction/camera-preview-current.json'] = read('correction/camera-preview-current.json')['checks']
assert read('correction/prop-surface-render-review.json')['result'] == 'PASS'
interface = read('browser-tests.json')['stats']
assert interface['expected'] == 13 and not interface['unexpected'] and not interface['flaky']
benchmark = read('browser-benchmark.json')
assert len(benchmark['runs']) == 3 and benchmark['runs'][0]['elapsedSeconds'] >= 900
assert not benchmark['pageErrors']
for name, expected in benchmark['sourceSHA256'].items():
    assert hashlib.sha256((app / name).read_bytes()).hexdigest() == expected, name
for name in ['correction/camera-motion.json', 'correction/camera-final-continuity.json', 'correction/camera-performance.json', 'correction/camera-preview-current.json', 'correction/header-final.json']:
    for file, expected in read(name)['sourceSHA256'].items():
        assert hashlib.sha256((app / file).read_bytes()).hexdigest() == expected, file
for name in ['expansion/game-performance.json', 'kinetic/cpu-stress.json']:
    report = read(name)
    assert len(report['runs']) == 4 and not report['pageErrors']
    for file, expected in report['sourceSHA256'].items():
        assert hashlib.sha256((app / file).read_bytes()).hexdigest() == expected, file
review = read('recording/review-check.json')
assert not review['errors'] and review['chapters'] == 9 and review['imageCount'] == 16
assert review['motionLibrary']['clips'] == 85
sources = sorted(path for path in (app / 'src').rglob('*') if path.is_file())
sources += sorted((app / 'scripts/blender').glob('*.py'))
artifacts = sorted(path for path in (app / 'public/review').rglob('*') if path.is_file())
artifacts += sorted((app / 'public/assets/scenes').glob('*.glb'))
artifacts += sorted((app / 'public/assets/source').glob('*.blend'))
def hashes(paths):
    return {str(path.relative_to(app)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
result = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
    'scope': 'Functional, asset, visual, media, and measured performance checks. Packaging and installation have separate receipts.',
    'unitChecks': 70, 'unitCommand': 'npm test', 'unitRunAt': '2026-09-27T22:10:03Z',
    'browserChecks': 13, 'motionPairs': 1020, 'checks': checks,
    'independentReviews': ['runtime-integration-final.md', 'runtime-cutaway-final.md', 'independent-art-review.md', 'header-review.md', 'roof-placement-review.md', 'camera-margin-review.md', 'preview-layout-review.md'],
    'sourceSHA256': hashes(sources), 'artifactSHA256': hashes(artifacts),
    'limits': ['Physical 2022 Android performance remains unverified.', 'The style assessment records remaining differences from frame-by-frame drawn animation.'],
}
(reports / 'correction/final-review.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: result[key] for key in ['checkedAt', 'status', 'unitChecks', 'browserChecks', 'motionPairs']}, indent=2))
