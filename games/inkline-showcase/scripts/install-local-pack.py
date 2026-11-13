"""Update only the managed local INKLINE pack after checking its old files."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil

app = Path(__file__).resolve().parent.parent
source = app / 'dist-pack/run-inkline'
target = Path('/Users/pany/dev/jam-ready-assets/run-inkline')
inventory_name = '3D/characters/Source/inventory-checksums.json'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

new = json.loads((source / inventory_name).read_text())
for name, item in new['files'].items():
    assert digest(source / name) == item['sha256'], name
old = json.loads((target / inventory_name).read_text()) if target.exists() else {'files': {}}
for name, item in old['files'].items():
    assert digest(target / name) == item['sha256'], f'Local file changed: {name}'
# Preserve unrelated files. Refuse to replace a file outside the old inventory.
for name in new['files']:
    destination = target / name
    assert not destination.exists() or name in old['files'], f'Unmanaged local file: {name}'
for name in new['files']:
    destination = target / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / name, destination)
shutil.copy2(source / inventory_name, target / inventory_name)
for name in old['files'].keys() - new['files'].keys():
    (target / name).unlink()
for name, item in new['files'].items():
    assert digest(target / name) == item['sha256'], name
assert digest(target / inventory_name) == digest(source / inventory_name)
report = {
    'installedAt': datetime.now(timezone.utc).isoformat(), 'directory': str(target),
    'files': len(new['files']) + 1, 'allHashesMatch': True,
    'existingManagedFilesCheckedBeforeWrite': len(old['files']),
}
(app / 'docs/verification/installation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
