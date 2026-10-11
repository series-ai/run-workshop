"""Build a review sheet from the current runtime effect previews."""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont

app = Path(__file__).resolve().parent.parent
catalog = json.loads((app / 'public/assets/effects.json').read_text())['effects']
columns, cell_width, cell_height, top = 8, 176, 192, 128
paper, ink, accent = '#eeece5', '#151716', '#d45538'
sheet = Image.new('RGB', (columns * cell_width + 48, math.ceil(len(catalog) / columns) * cell_height + top + 44), paper)
draw = ImageDraw.Draw(sheet)
font_root = Path('/System/Library/Fonts/Supplemental')
def font(size, bold=False):
    path = font_root / ('Arial Bold.ttf' if bold else 'Arial.ttf')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)
draw.text((28, 22), 'INKLINE / ACTUAL RUNTIME CAPTURES', fill=accent, font=font(13, True))
draw.text((28, 47), f'{len(catalog)} procedural effects.', fill=ink, font=font(34, True))
draw.text((28, 94), 'Open dust strokes, impact stars, paper cores, arcs, sparks, and environment effects.', fill='#656863', font=font(14))
for index, effect in enumerate(catalog):
    x, y = 24 + index % columns * cell_width, top + index // columns * cell_height
    preview = Image.open(app / 'public/assets/previews' / f"effect-{effect['id']}.png").convert('RGBA')
    preview.thumbnail((164, 164), Image.Resampling.LANCZOS)
    sheet.paste(preview, (x + (cell_width - preview.width) // 2, y + 2), preview)
    draw.line((x + 8, y + 173, x + cell_width - 8, y + 173), fill='#c9ccc3')
    draw.text((x + 8, y + 178), effect['id'], fill=ink, font=font(11))
draw.text((28, sheet.height - 26), 'REAL EFFECT PREVIEWS / FIXED PARTICLE POOLS / NO CONCEPT IMAGERY', fill='#656863', font=font(11))
for relative in ['public/review/effects-64.png', 'docs/verification/expansion/effects-64.png']:
    sheet.save(app / relative)
print(f'Built the sheet from {len(catalog)} current effect previews.')
