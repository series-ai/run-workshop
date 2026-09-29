"""Verify exported references, inventory hashes, sheets, and archive bytes."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
from PIL import Image

app = Path(__file__).resolve().parent.parent
pack = app / 'dist-pack/run-inkline'
inventory_name = '3D/characters/Source/inventory-checksums.json'
inventory = json.loads((pack / inventory_name).read_text())

def digest(data):
    return hashlib.sha256(data).hexdigest()

def file_at(base, name):
    path = (base / name).resolve()
    assert path.is_relative_to(pack.resolve()) and path.is_file(), name
    return path

files = {str(path.relative_to(pack)) for path in pack.rglob('*') if path.is_file()}
assert files == set(inventory['files']) | {inventory_name}
assert len(inventory['files']) == inventory['totalFiles']
assert sum(entry['bytes'] for entry in inventory['files'].values()) == inventory['totalBytes']
for name, entry in inventory['files'].items():
    data = file_at(pack, name).read_bytes()
    assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], name
assert file_at(pack, '3D/characters/Source/runtime/firearms.json').read_bytes() == (app / 'src/runtime/firearms.json').read_bytes()
references = 0
for name in ['3D/characters/Source/manifest.json', '3D/characters/Source/characters.json', '3D/city/Source/props.json']:
    for model in json.loads((pack / name).read_text())['models']:
        for field in ['file', 'thumbnail']:
            file_at(pack, model[field])
            references += 1
atlas = json.loads((pack / '2D/misc/atlas.json').read_text())
effects = json.loads((pack / '2D/misc/effects.json').read_text())['effects']
assert len(atlas['effects']) == len(effects) == 64
assert {effect['id'] for effect in atlas['effects']} == {effect['id'] for effect in effects}
for scene in ['industrial-district', 'service-yard', 'roof-works']:
    file_at(pack, f'3D/city/Samples/{scene}.glb')
    file_at(pack, f'3D/city/Source/{scene}.blend')
    layout = json.loads(file_at(pack, f'3D/city/Source/{scene}.json').read_text())
    catalog_ids = {model['id'] for model in json.loads((pack / '3D/city/Source/props.json').read_text())['models']}
    assert all(item['id'] in catalog_ids for item in layout['placements'])
translucent_sheets = []
for effect in atlas['effects']:
    with Image.open(file_at(pack / '2D/misc', effect['file'])) as sheet:
        assert sheet.mode == 'RGBA'
        assert sheet.size == (effect['columns'] * effect['frameWidth'], effect['rows'] * effect['frameHeight'])
        alpha_min, alpha_max = sheet.getchannel('A').getextrema()
        assert alpha_min == 0 and alpha_max > 0, effect['id']
        if alpha_max < 255:
            translucent_sheets.append({'id': effect['id'], 'maximumAlpha': alpha_max})
for scene in json.loads((pack / '3D/city/Source/environment-layouts.json').read_text())['layouts']:
    file_at(pack, scene['file'])
    file_at(pack, scene['layout'])
    file_at(pack, scene['source'])
licenses = list(pack.glob('*/*/License.txt'))
assert len(licenses) == 7
assert all(path.read_text().startswith('SPDX-License-Identifier: MIT\n') for path in licenses)
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
    'files': len(files), 'references': references, 'sheets': len(atlas['effects']),
    'licenseLeaves': len(licenses), 'inventoryEntries': len(inventory['files']),
    'uncompressedBytes': inventory['totalBytes'],
    'inventorySHA256': digest((pack / inventory_name).read_bytes()),
    'translucentSheets': translucent_sheets,
}
(app / 'docs/verification/export-integrity.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
