"""Decode the comparison and phone films and check their delivery formats."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile

from PIL import Image, ImageDraw

app = Path(__file__).resolve().parent.parent
recording = app / 'docs/verification/recording'
results = []
for name, width, height, minimum in [
    ('inkline-kinetic-comparison', 1600, 1000, 28),
    ('inkline-phone', 390, 844, 25),
]:
    video = app / 'public/review' / f'{name}.mp4'
    original = video.with_suffix('.webm')
    probe = lambda path: json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path),
    ], text=True))
    data, source = probe(video), probe(original)
    stream = next(item for item in data['streams'] if item['codec_type'] == 'video')
    duration = float(data['format']['duration'])
    assert (stream['width'], stream['height']) == (width, height), name
    assert stream['codec_name'] == 'h264' and stream['pix_fmt'] == 'yuv420p', name
    assert duration >= minimum, name
    assert abs(duration - float(source['format']['duration'])) < .15, name
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
    cell_width = 600 if width == 1600 else 260
    cell_height = round(height * cell_width / width)
    sheet = Image.new('RGB', (cell_width * 3, cell_height + 28), '#eeece5')
    draw = ImageDraw.Draw(sheet)
    with tempfile.TemporaryDirectory(prefix='inkline-film-frames-') as directory:
        for index, fraction in enumerate([.2, .55, .85]):
            time = duration * fraction
            frame = Path(directory) / f'{index}.png'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(time), '-i', str(video),
                            '-frames:v', '1', '-vf', f'scale={cell_width}:{cell_height}', str(frame)], check=True)
            sheet.paste(Image.open(frame), (index * cell_width, 0))
            draw.text((index * cell_width + 8, cell_height + 7), f'{time:.2f} s', fill='#151716')
    sheet.save(recording / f'{name}-frames.jpg', quality=94)
    results.append({'file': str(video.relative_to(app)), 'duration': duration,
                    'width': width, 'height': height, 'fullDecode': True,
                    'timingMatchesWebM': True, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest()})
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'pass': True, 'videos': results,
          'physicalAndroid': 'UNVERIFIED'}
(recording / 'secondary-videos.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
