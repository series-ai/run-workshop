"""Publish side-view contact comparisons from the actual character files."""
from pathlib import Path
import html
import json
import shutil

app = Path(__file__).resolve().parent.parent
source = app / 'docs/verification/stance'
output = app / 'public/review'
images = output / 'stance'
images.mkdir(exist_ok=True)
capture = json.loads((source / 'capture.json').read_text())
assert capture['pass'] and not capture['errors']
sections = []
for clip in capture['clips']:
    title = html.escape(clip.replace('-', ' ').title())
    figures = []
    for label in ('before', 'after'):
        name = f'{label}-{clip}-1.png'
        shutil.copy2(source / name, images / name)
        figures.append(f'<figure><a href="stance/{name}"><img src="stance/{name}" alt="{title}: {label}, at contact"></a><figcaption>{label.title()}</figcaption></figure>')
    sections.append(f'<section><h2>{title}</h2><div class="pair">{"".join(figures)}</div></section>')
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INKLINE / Combat stance</title><link rel="icon" href="../favicon.svg"><style>
*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:16px/1.5 system-ui}main{max-width:920px;margin:auto;padding:32px}a{color:inherit;text-underline-offset:4px}a:focus-visible{outline:3px solid #c94426;outline-offset:4px}header{padding-bottom:24px;border-bottom:1px solid #c9ccc2}small{color:#a33d26;letter-spacing:2px}h1{font-size:46px;line-height:1.08;letter-spacing:-2px;margin:24px 0 14px}p{max-width:720px;color:#53574f}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;border:1px solid #c9ccc2}img{display:block;width:100%}figcaption{padding:8px 12px;font:12px monospace}section{padding:24px 0;border-bottom:1px solid #c9ccc2}h2{font-size:22px;margin:0 0 12px}@media(max-width:600px){main{padding:20px}h1{font-size:34px;letter-spacing:-1px}.pair{gap:6px}h2{font-size:18px}}
</style></head><body><main><header><a href="index.html">Main review</a><h1>Combat stance.<br>Before and after.</h1><small>1.4.1 / ACTUAL EXPORTED CONTACT POSES</small><p>Both columns use the same side camera and the authored hit time. No effects cover the figures. Punch lean falls from 22–25 degrees to 9–13 degrees. Standing kick lean falls from about 24 degrees to 11 degrees. The support foot now sits below the body. Guns aim forward at contact, then recoil.</p><p><a href="motion-library.html">Watch all clips at normal speed</a> · <a href="../">Open the live demo</a></p></header>'''
(output / 'stance-review.html').write_text(page + ''.join(sections) + '</main></body></html>')
print(f'Published {len(sections)} side-view comparisons.')
