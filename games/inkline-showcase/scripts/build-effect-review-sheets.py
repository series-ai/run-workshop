"""Arrange fixed-scale effect captures beside the same reference figure."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import sys
label = sys.argv[1] if len(sys.argv) > 1 else 'after'
root = Path('docs/verification/polish')
report = json.loads((root / f'effects-{label}.json').read_text())
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
small = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 11)
for page in range(8):
    sheet = Image.new('RGB', (1024, 1724), '#eeece5')
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), f'INKLINE / {label.upper()} / DEFAULT EFFECT SCALE / 1.80 M FIGURE', fill='#151716', font=font)
    for row, effect in enumerate(report['effects'][page * 8:page * 8 + 8]):
        y = 44 + row * 209
        draw.text((12, y + 22), effect['id'], fill='#151716', font=small)
        draw.text((12, y + 42), f"{effect['duration']:.2f}s / {effect['count']} main", fill='#656863', font=small)
        for frame in range(3):
            im = Image.open(root / f'effects-{label}' / f'{effect["id"]}-{frame}.png').convert('RGB')
            im.thumbnail((256, 192))
            sheet.paste(im, (242 + frame * 258, y))
        draw.line((12, y + 202, 1012, y + 202), fill='#d5d4cc')
    sheet.save(root / f'effects-{label}-{page + 1}.jpg', quality=91)
print(f'Built eight {label} sheets.')
