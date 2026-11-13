"""Place actual front and rear hit captures in one review sheet."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

app = Path(__file__).resolve().parent.parent
source = app / 'docs/verification/correction/camera-reactions'
sheet = Image.new('RGB', (1600, 620), '#eeece5')
draw = ImageDraw.Draw(sheet)
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font_path, 36)
label = ImageFont.truetype(font_path, 25)
small = ImageFont.truetype(font_path, 19)
draw.text((30, 24), 'INKLINE / Directional falls', font=title, fill='#151716')
draw.text((30, 75), 'Cropped runtime captures. The red target moves away from the strike.', font=small, fill='#656863')
for index, (name, caption, crop) in enumerate([
    ('front-side.png', 'Hit from the front / backward fall', (200, 240, 1200, 640)),
    ('rear-side.png', 'Hit from the back / forward fall', (240, 240, 1240, 640)),
]):
    capture = Image.open(source / name).convert('RGB').crop(crop)
    capture.thumbnail((760, 400))
    left = 20 + index * 800
    draw.text((left + 10, 139), caption, font=label, fill='#151716')
    sheet.paste(capture, (left, 193))
draw.line((800, 130, 800, 530), fill='#c9ccc2', width=1)
draw.text((30, 555), 'Same exported figure. Separate forward and backward recovery clips retain the landing pose.', font=small, fill='#656863')
sheet.save(app / 'public/review/reaction-directions.png')
