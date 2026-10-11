"""Record the full motion or effect set through the local review pages."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

app = Path(__file__).resolve().parent.parent
kind = sys.argv[1]
assert kind in ('motion', 'effects')
root = app / os.environ.get('INKLINE_REVIEW_OUTPUT', 'docs/verification/polish')
root.mkdir(parents=True, exist_ok=True)
version = json.loads((app / 'public/assets/manifest.json').read_text())['version']
session = f'inkline-polish-{kind}'

def cli(*args):
    result = subprocess.run(['playwright-cli', f'-s={session}', '--raw', *args], cwd=app,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    if '### Error' in result.stdout:
        raise RuntimeError(result.stdout)
    return result.stdout.strip()

groups = ['movement', 'combat', 'other'] if kind == 'motion' else ['Combat', 'Weapons', 'Movement', 'Destruction', 'Status']
if len(sys.argv) > 2:
    assert kind == 'effects' and sys.argv[2] in groups
    groups = [sys.argv[2]]
playback = {}
try:
    cli('open', 'http://localhost:5197/')
    for group in groups:
        url = (f'correction/line-review.html?assets=/assets&reel={group}&output={root.relative_to(app)}' if kind == 'motion'
               else f'polish/effect-review.html?category={group}')
        cli('goto', 'http://localhost:5197/docs/verification/' + url)
        cli('run-code', '--filename=' + str(app / 'docs/verification/polish' / f'record-{kind}.js'))
        result = json.loads(cli('eval', 'JSON.stringify(window.' + ('__lineMotionPlayback' if kind == 'motion' else '__effectPlayback') + ')'))
        if isinstance(result, str):
            result = json.loads(result)
        assert not result['errors'], result
        filename = f'figure-final-{group}-playback.json' if kind == 'motion' else f'effects-{group.lower()}-playback.json'
        (root / filename).write_text(json.dumps(result, indent=2) + '\n')
        playback[group] = result['playback'] if kind == 'motion' else result
        print(json.dumps({'group': group, 'count': playback[group]['count']}), flush=True)
finally:
    cli('close')

if kind == 'motion':
    assert sum(value['count'] for value in playback.values()) == 85
    files = [root / f'figure-final-{group}-normal-speed.webm' for group in groups]
    files += [app / name for name in ['scripts/blender/characters.py', 'public/assets/characters/stick-standard.glb',
                                     'public/assets/characters.json', 'src/runtime/assets.ts', 'docs/verification/correction/line-review.html']]
    result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'version': version, 'errors': [], 'playback': playback,
              'sha256': {str(path.relative_to(app)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}}
    (root / 'figure-final-media.json').write_text(json.dumps(result, indent=2) + '\n')
