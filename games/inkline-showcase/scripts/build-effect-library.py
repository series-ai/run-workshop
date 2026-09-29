"""Publish fixed-scale effect images and the complete normal-speed film."""
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
import hashlib
import html
import json
import shutil
import subprocess
app = Path(__file__).resolve().parent.parent
root = app / 'docs/verification/polish'
out = app / 'public/review'
report = json.loads((root / 'effects-after.json').read_text())
version = json.loads((app / 'public/assets/manifest.json').read_text())['version']
parts = []
playback = []
for category in ['combat', 'weapons', 'movement', 'destruction', 'status']:
    source = root / f'effects-{category}-normal-speed.webm'
    data = json.loads((root / f'effects-{category}-playback.json').read_text())
    if isinstance(data, str): data = json.loads(data)
    assert not data['errors']
    playback += data['clips']
    parts.append(source)
assert len(playback) == 64 and len({item['id'] for item in playback}) == 64
listing = root / 'effect-video-inputs.txt'
listing.write_text(''.join(f"file '{path}'\n" for path in parts))
video = out / 'effects-normal-speed.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(video)], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
listing.unlink()
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(video)],text=True))
images = out / 'effect-scale'; images.mkdir(exist_ok=True)
sections = []
for category in dict.fromkeys(effect['category'] for effect in report['effects']):
    cards = []
    for effect in (effect for effect in report['effects'] if effect['category'] == category):
        image = Image.open(root / 'effects-after' / f'{effect["id"]}-1.png').convert('RGB')
        image.resize((512,384),Image.Resampling.LANCZOS).save(images / f'{effect["id"]}.jpg',quality=91)
        cards.append(f'<figure id="{effect["id"]}"><a href="effect-scale/{effect["id"]}.jpg"><img src="effect-scale/{effect["id"]}.jpg" alt="{html.escape(effect["label"])} beside a 1.80 metre figure" loading="lazy"></a><figcaption><strong>{html.escape(effect["label"])}</strong><span>{html.escape(effect["description"])}</span></figcaption></figure>')
    sections.append(f'<section><h2>{category}</h2><div class="grid">'+''.join(cards)+'</div></section>')
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INKLINE / All 64 effects</title><link rel="icon" href="../favicon.svg"><style>*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:16px/1.5 system-ui}main{max-width:1160px;margin:auto;padding:28px}a{color:inherit;text-underline-offset:4px}a:focus-visible,video:focus-visible{outline:3px solid #d45538;outline-offset:4px}h1{font-size:48px;line-height:1.05;letter-spacing:-2px}p{max-width:800px;color:#555950}small{color:#a33d26}video{display:block;width:100%;background:#151716}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;border:1px solid #c9ccc2;background:#f7f6f0}img{display:block;width:100%;height:auto}figcaption{padding:14px;font-size:14px}figcaption span{display:block;font-size:12px;color:#61655d;margin-top:5px}h2{margin-top:40px}@media(max-width:600px){main{padding:18px}h1{font-size:36px;letter-spacing:-1px}.grid{grid-template-columns:1fr}}</style></head><body><main><a href="index.html">← Main review</a><h1>Clear effects.<br>One fixed scale.</h1>'''
page+=f'<small>INKLINE {version} / ALL 64 EFFECTS</small><p>Each effect plays twice at normal speed beside the same 1.80 m figure. The camera scale stays fixed. The grid spacing is 0.50 m. These are the actual procedural effects at their default size. No audio.</p><video controls playsinline preload="metadata" aria-label="All 64 effects at normal speed"><source src="effects-normal-speed.mp4" type="video/mp4"></video><p><a href="effects-normal-speed.mp4" download>Download the full effect film</a></p><p>The stills show one frame of each effect. Use the film to check short flashes and the full fade.</p>'
page+=''.join(sections)+'<p><a href="../">Open the live demo</a></p></main></body></html>'
(out / 'effects-library.html').write_text(page)
for index in range(1,9):
    for label in ['before','after']:
        shutil.copy2(root / f'effects-{label}-{index}.jpg',out / f'effects-{label}-{index}.jpg')
files = parts + [video, app / 'src/runtime/effects.ts', app / 'public/assets/characters/stick-standard.glb', root / 'effect-review.html']
receipt = {'checkedAt':datetime.now(timezone.utc).isoformat(),'version':version,'count':64,'errors':[],'duration':float(probe['format']['duration']),'playback':playback,'sha256':{str(path.relative_to(app)):hashlib.sha256(path.read_bytes()).hexdigest() for path in files}}
(root / 'effect-media.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'effects':64,'duration':receipt['duration'],'status':'pass'}))
