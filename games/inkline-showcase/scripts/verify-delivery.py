"""Check measured file hashes against the delivered review evidence."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

app = Path(__file__).resolve().parent.parent
report_dir = app / 'docs/verification'
benchmark = json.loads((report_dir / 'browser-benchmark.json').read_text())
final_review = json.loads((report_dir / 'correction/final-review.json').read_text())
assert final_review['status'] == 'pass'
assert len(benchmark['runs']) == 3 and not benchmark['pageErrors']
assert benchmark['runs'][0]['elapsedSeconds'] >= 900

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

measured_sources = {name: value for name, value in benchmark['sourceSHA256'].items()
                    if digest(app / name) == value}
if 'assetSHA256' not in final_review:
    assert len(measured_sources) == len(benchmark['sourceSHA256']), 'Measured source changed'
reviewed_files = {**measured_sources, **final_review['sourceSHA256'], **final_review['artifactSHA256']}
for name, expected in reviewed_files.items():
    assert digest(app / name) == expected, f'Measured source changed: {name}'
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
reviewed_assets = final_review.get('assetSHA256', benchmark['assetSHA256'])
assert len(reviewed_assets) == len(manifest['models'])
for model in manifest['models']:
    assert digest(app / 'public' / model['file']) == reviewed_assets[model['id']], model['id']
measured_assets_match = sum(value == benchmark['assetSHA256'].get(name) for name, value in reviewed_assets.items())

consumer = json.loads((report_dir / 'kinetic/consumer.json').read_text())
assert consumer['pass'] and consumer['exportedRuntimeTypecheck'] and not consumer['errors']
pack_source = app / 'dist-pack/run-inkline/3D/characters/Source'
consumer_files = {str(path.relative_to(pack_source)) for path in (pack_source / 'runtime').glob('*.ts')}
consumer_files.update({'types.ts', 'manifest.json', 'runtime/firearms.json'})
assert set(consumer['sourceSHA256']) == consumer_files, 'Consumer evidence does not cover all exported runtime files'
for name, expected in consumer['sourceSHA256'].items():
    assert digest(pack_source / name) == expected, f'Tested exported source changed: {name}'

report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
    'finalReviewedSourcesMatch': len(final_review['sourceSHA256']),
    'finalReviewedArtifactsMatch': len(final_review['artifactSHA256']),
    'measuredSourcesMatch': len(measured_sources),
    'measuredAssetsMatch': measured_assets_match,
    'reviewedAssetsMatch': len(reviewed_assets),
    'testedExportedSourcesMatch': len(consumer_files),
    'physicalAndroid': 'UNVERIFIED',
}
(report_dir / 'source-unpack-check.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
