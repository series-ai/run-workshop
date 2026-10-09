"""Decode the full review video and create a chapter contact sheet."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import subprocess
import tempfile

app = Path(__file__).resolve().parent.parent
recording = app / 'docs/verification/recording'
video = app / 'public/review/inkline-tour.mp4'
metadata = json.loads((recording / 'metadata.json').read_text())
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
sheet = Image.new('RGB', (1200, 825), '#eeece5')
draw = ImageDraw.Draw(sheet)
with tempfile.TemporaryDirectory(prefix='inkline-video-check-') as folder:
    for index, chapter in enumerate(metadata['chapters']):
        end = metadata['chapters'][index + 1]['time'] if index + 1 < len(metadata['chapters']) else metadata['video']['duration']
        offset = 3.08 if index == 6 else 3.5
        time = chapter['time'] + min(offset, (end - chapter['time']) * .5)
        output = Path(folder) / f'{index}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(time), '-i', str(video), '-frames:v', '1', '-vf', 'scale=400:250', str(output)], check=True)
        x, y = index % 3 * 400, index // 3 * 275
        sheet.paste(Image.open(output), (x, y))
        draw.text((x + 8, y + 254), chapter['title'], fill='#151716')
sheet.save(recording / 'contact-sheet.jpg', quality=92)
print('Full video decode and nine chapter frames passed.')
