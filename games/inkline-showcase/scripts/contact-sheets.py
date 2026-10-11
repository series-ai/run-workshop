"""Build inspection sheets from the actual asset previews."""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw

app = Path(__file__).resolve().parent.parent
root = app / 'public/assets'
manifest = json.loads((root / 'manifest.json').read_text())
for group in ['character', 'industrial', 'weapons', 'city', 'parkour', 'sports', 'sci-fi', 'animation', 'effect']:
    if group == 'animation':
        items = [('animation-' + a['id'], a['id']) for a in manifest['animations']]
    elif group == 'effect':
        items = [('effect-' + a['id'], a['id']) for a in json.loads((root / 'effects.json').read_text())['effects']]
    else:
        items = [(a['id'], a['id']) for a in manifest['models'] if a['kind'] == group or a['category'] == group]
    width, height, columns = 160, 180, 6
    sheet = Image.new('RGB', (columns * width, math.ceil(len(items) / columns) * height), '#eeece5')
    draw = ImageDraw.Draw(sheet)
    for index, (name, label) in enumerate(items):
        preview = Image.open(root / 'previews' / f'{name}.png').convert('RGBA')
        preview.thumbnail((160, 156))
        x, y = (index % columns) * width, (index // columns) * height
        sheet.paste(preview, (x, y), preview)
        draw.text((x + 4, y + 157), label, fill='#171918')
    sheet.save(app / 'docs/verification' / f'contact-{group}.jpg', quality=90)
