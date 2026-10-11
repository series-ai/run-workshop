"""Write the measured performance section from the final browser report."""
from pathlib import Path
import hashlib
import json

app = Path(__file__).resolve().parent.parent
report = json.loads((app / 'docs/verification/browser-benchmark.json').read_text())
runs = report['runs']
assert len(runs) == 3 and not report['pageErrors'] and runs[0]['elapsedSeconds'] >= 900
for name, expected in report['sourceSHA256'].items():
    assert hashlib.sha256((app / name).read_bytes()).hexdigest() == expected, name
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
for model in manifest['models']:
    assert hashlib.sha256((app / 'public' / model['file']).read_bytes()).hexdigest() == report['assetSHA256'][model['id']]
lines = [
    '## Measured desktop result', '',
    f"Measured on {report['startedAt'][:10]} with Chromium {report['browser']} and {report['host']['cpu']}. The renderer was {runs[0]['initial']['gpu']}. The drawing buffer was {runs[0]['initial']['buffer']['width']}×{runs[0]['initial']['buffer']['height']}. All measured source and model hashes match the delivered files.", '',
    '| Stage | Figures | Configured effects | Observed active effects | Duration | Mean FPS | P95 frame time |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: |',
]
for label, run in zip(['Baseline', 'Stress', 'Return'], runs):
    effects = [sample['effects'] for sample in run['samples']]
    lines.append(f"| {label} | {run['load']['figures']} | {run['load']['effects']} | {min(effects)}–{max(effects)} | {run['elapsedSeconds']:.1f} s | {run['meanFPS']:.1f} | {run['p95FrameMs']:.1f} ms |")
slow = sum(run['slowFramesOver33ms'] for run in runs)
geometries = ', '.join(str(run['final']['stats']['geometries']) for run in runs)
textures = ', '.join(str(run['final']['stats']['textures']) for run in runs)
lines += ['', f'{slow} measured frames exceeded 33 ms. The browser reported no page errors. Effect counts vary as bursts expire and restart.', '',
          f'Geometry counts at the end of baseline, stress, and return were {geometries}. Texture counts were {textures}. The return stage checks the resource count after the larger crowd is removed. These counters do not measure every browser or driver allocation.', '',
          'This result applies to the measured Mac and browser. The Android target remains unverified.', '']
game_report = json.loads((app / 'docs/verification/expansion/game-performance.json').read_text())
assert len(game_report['runs']) == 4 and not game_report['pageErrors']
for name, expected in game_report['sourceSHA256'].items():
    assert hashlib.sha256((app / name).read_bytes()).hexdigest() == expected, name
lines += ['## Moving cameras and assembled scenes', '',
          '| Scene | Duration | Mean FPS | P95 frame time |',
          '| --- | ---: | ---: | ---: |']
for run in game_report['runs']:
    lines.append(f"| {run['label']} | {run['elapsedSeconds']:.1f} s | {run['meanFPS']:.1f} | {run['p95FrameMs']:.1f} ms |")
lines += ['', 'Combat and parkour use movement and action input during measurement. Both extra scenes run their environment effects. These are desktop checks. They do not establish Android performance.', '']
stress_path = app / 'docs/verification/kinetic/cpu-stress.json'
if stress_path.exists():
    stress = json.loads(stress_path.read_text())
    assert stress['cpuRate'] == 4 and len(stress['runs']) == 4 and not stress['pageErrors']
    for name, expected in stress['sourceSHA256'].items():
        assert hashlib.sha256((app / name).read_bytes()).hexdigest() == expected, name
    lines += ['## Desktop CPU stress check', '',
              'The same four scene tests also ran with Chromium CPU throttling set to 4. This checks CPU margin on this desktop. It is not an Android device model. GPU speed, memory bandwidth, touch input, and phone heat limits are not reproduced.', '',
              '| Scene | Duration | Mean FPS | P95 frame time |',
              '| --- | ---: | ---: | ---: |']
    for run in stress['runs']:
        lines.append(f"| {run['label']} | {run['elapsedSeconds']:.1f} s | {run['meanFPS']:.1f} | {run['p95FrameMs']:.1f} ms |")
    lines += ['', 'Read `verification/kinetic/cpu-stress.json` for the samples and matching source hashes.', '']
camera_path = app / 'docs/verification/correction/camera-performance.json'
if camera_path.exists():
    camera_report = json.loads(camera_path.read_text())
    assert camera_report['pass'] and len(camera_report['runs']) == 2 and not camera_report['errors']
    for name, expected in camera_report['sourceSHA256'].items():
        assert hashlib.sha256((app / name).read_bytes()).hexdigest() == expected, name
    lines += ['## Low-ceiling camera check', '',
              'The route reaches checkpoint five with real movement input. The top view then holds for 30 seconds at each CPU rate. The camera keeps its requested direction and uses a local foreground cutaway. Pixel checks run before and after each timed interval. Continuous samples check framing and camera drift. Raw geometry obstruction remains in the report.', '',
              '| Camera | Desktop CPU rate | Duration | Mean FPS | P95 frame time |',
              '| --- | ---: | ---: | ---: | ---: |']
    for run in camera_report['runs']:
        lines.append(f"| Continuous camera with cutaway | {run['cpuRate']} | {run['durationSeconds']:.1f} s | {run['meanFPS']:.1f} | {run['p95FrameMs']:.1f} ms |")
    lines += ['', 'This is a desktop cost check. It does not model a phone GPU or thermal limit.', '']
path = app / 'docs/performance.md' 
path.write_text(path.read_text().split('## Measured desktop result')[0] + '\n'.join(lines))
print('\n'.join(lines))
