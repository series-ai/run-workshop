"""Build the review index and captions from the recorded chapter times."""
from pathlib import Path
import json
import re
import subprocess

app = Path(__file__).resolve().parent.parent
review = app / 'public/review'
recording = app / 'docs/verification/recording'
metadata_path = recording / 'metadata.json'
metadata = json.loads(metadata_path.read_text())
if isinstance(metadata, str):
    metadata = json.loads(metadata)
chapters = metadata['chapters']
assert len(chapters) == 9
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json',
    str(review / 'inkline-tour.mp4'),
], text=True))
video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
duration = float(probe['format']['duration'])
assert video['width'] == 1600 and video['height'] == 1000 and duration > 100
assert all(0 <= chapter['time'] < duration for chapter in chapters)
assert all(a['time'] < b['time'] for a, b in zip(chapters, chapters[1:]))

def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}'

captions = ['WEBVTT', '']
for index, chapter in enumerate(chapters):
    end = chapters[index + 1]['time'] if index + 1 < len(chapters) else duration
    captions += [str(index + 1), f"{timestamp(chapter['time'])} --> {timestamp(end)}",
                 chapter['title'], chapter['description'], '']
(review / 'captions.vtt').write_text('\n'.join(captions))
index_path = review / 'index.html'
html = index_path.read_text()
html, count = re.subn(r'(<script id="chapter-data" type="application/json">).*?(</script>)',
                     lambda match: match[1] + json.dumps(chapters) + match[2], html, flags=re.S)
assert count == 1
index_path.write_text(html)
metadata['video'] = {'duration': duration, 'width': video['width'], 'height': video['height'],
                     'codec': video['codec_name'], 'pixelFormat': video['pix_fmt'],
                     'audio': any(stream['codec_type'] == 'audio' for stream in probe['streams'])}
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata['video'], indent=2))
