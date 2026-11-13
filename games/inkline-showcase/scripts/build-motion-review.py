"""Publish the complete recorded clip review with its source clip list."""
from pathlib import Path
import hashlib
import html
import json
import shutil
import subprocess
import sys

app = Path(__file__).resolve().parent.parent
source = app / (sys.argv[1] if len(sys.argv) > 1 else 'docs/verification/correction')
out = app / 'public/review'
metadata = json.loads((source / 'figure-final-media.json').read_text())
sections = []
files = []
for key, title in [('movement', 'Movement'), ('combat', 'Combat and equipment'), ('other', 'Reactions and secondary actions')]:
    stem = f'motion-{key}'
    webm = out / f'{stem}.webm'
    shutil.copy2(source / f'figure-final-{key}-normal-speed.webm', webm)
    mp4 = out / f'{stem}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(webm), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(mp4)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp4), '-f', 'null', '-'], check=True)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(mp4)], text=True))
    clips = metadata['playback'][key]['clips']
    duration = float(probe['format']['duration'])
    rows = ''.join(f'<li>{html.escape(clip)}</li>' for clip in clips)
    sections.append(f'<section><h2>{title} <span>{len(clips)} clips / {duration:.1f} seconds</span></h2><video controls playsinline preload="metadata" aria-label="{title} at normal speed"><source src="{stem}.mp4" type="video/mp4"><source src="{stem}.webm" type="video/webm"></video><p><a href="{stem}.mp4" download>Download this recording</a></p><details><summary>Clip list</summary><ul>{rows}</ul></details></section>')
    files.append({'file': str(mp4.relative_to(app)), 'clips': clips, 'duration': duration, 'sha256': hashlib.sha256(mp4.read_bytes()).hexdigest()})
assert sum(len(file['clips']) for file in files) == 85
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INKLINE / All 85 clips</title><link rel="icon" href="../favicon.svg"><style>
*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:16px/1.5 system-ui}main{max-width:1080px;margin:auto;padding:32px}a{color:inherit;text-underline-offset:4px}a:focus-visible,summary:focus-visible,video:focus-visible{outline:3px solid #d45538;outline-offset:4px}header{border-bottom:1px solid #c9ccc2;padding-bottom:24px}small{color:#a33d26;letter-spacing:2px}h1{font-size:48px;line-height:1.05;letter-spacing:-2px;margin:24px 0 14px}p{max-width:760px;color:#53574f}section{padding:28px 0;border-bottom:1px solid #c9ccc2}h2{font-size:24px}h2 span{display:block;font-size:13px;font-weight:400;color:#656863}video{display:block;width:100%;background:#151716}summary{cursor:pointer;padding:8px 0}ul{columns:3;font:13px/1.8 monospace;padding-left:20px}@media(max-width:600px){main{padding:20px}h1{font-size:36px;letter-spacing:-1px}ul{columns:2}h2{font-size:21px}}</style></head><body><main><header><a href="index.html">← Main review</a><h1>All 85 clips.<br>Normal speed.</h1><small>ACTUAL EXPORTED FIGURES / NO EFFECTS</small><p>Front, side, and three-quarter views use the final character files. Loops play twice. Other actions reach their final sample. Combat clips show their equipment. These recordings have no audio.</p></header>'''
page = page.replace('ACTUAL EXPORTED FIGURES / NO EFFECTS', html.escape(metadata['version']) + ' / ACTUAL EXPORTED FIGURES / NO EFFECTS')
page += ''.join(sections) + '<footer><p>These are asset motion previews. Walk and run clips play in place, so the support foot moves backward as the body stays at the center. Climb and vault clips need placement and contact logic in a game.</p><p><a href="../">Open the live demo</a></p></footer></main></body></html>'
(out / 'motion-library.html').write_text(page)
(source / 'motion-library-published.json').write_text(json.dumps({'pass': True, 'clipCount': 85, 'source': 'figure-final-media.json', 'files': files}, indent=2) + '\n')
print('Published and decoded all 85 motion clips in three recordings.')
