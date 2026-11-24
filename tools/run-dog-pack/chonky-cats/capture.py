"""Frame strips of the cat clips, from headless Chrome on the GPU.

python3 chonky-cats/capture.py <clip>[:cats[:n[:side|mirror[:zoom]]]] | gallery[:clip[:WxH]] | skin | skin-dogs | props | sizes | cover | library | fit[:body] | colours[:body[:back]] ... [--out DIR]     (from tools/run-dog-pack)

Serves tools/run-dog-pack, opens viewer.html?strip=... for each request, one at a time, and
saves the PNG the page posts back to DIR/strip-<clip>[-side].png (default /tmp/chonky-cats).
"""
import base64
import os
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
here = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
out = '/tmp/chonky-cats'
if '--out' in args:
    i = args.index('--out')
    out = args[i + 1]
    del args[i:i + 2]
os.makedirs(out, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        name = parse_qs(urlparse(self.path).query)['name'][0]
        data = self.rfile.read(int(self.headers['Content-Length'])).decode()
        tmp = os.path.join(out, '.' + name + '.part')   # rename when complete: the waiting loop
        open(tmp, 'wb').write(base64.b64decode(data.split(',', 1)[1]))   # never sees half a file
        os.replace(tmp, os.path.join(out, name))
        self.send_response(200)
        self.end_headers()

    def log_message(self, *a):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=os.path.dirname(here)))
threading.Thread(target=server.serve_forever, daemon=True).start()
port = server.server_address[1]
for req in args:
    if req == 'sizes':   # checks/cat-sizes.html: each body's bounds per pose, JSON
        name, path = 'cat-sizes.json', os.path.join(out, 'cat-sizes.json')
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--use-angle=metal', f'http://127.0.0.1:{port}/chonky-cats/checks/cat-sizes.html?save={name}'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 180:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('SIZES', path if os.path.exists(path) else 'FAILED')
        continue
    if req.startswith('colours'):   # colours[:body]: colorways.html, every colourway of a body (or the 30 breeds)
        body, back = (req.split(':') + ['', ''])[1:3]
        name = f'colours-{body or "breeds"}{"-back" if back else ""}.png'
        path = os.path.join(out, name)
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=1800,1200', '--hide-scrollbars', '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/colorways.html?{"body=" + body if body else "breeds"}&save={name}' + ('&back' if back else '') + os.environ.get('VIEW_EXTRA', '')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 180:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('COLOURS', path if os.path.exists(path) else 'FAILED')
        continue
    if req.startswith('fit'):   # fit[:body]: props/fit-check.html, a big cat inside every container
        body = (req.split(':') + ['cobby'])[1]
        name = f'fit-{body}.png'
        path = os.path.join(out, name)
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=1900,1500', '--hide-scrollbars', '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/props/fit-check.html?body={body}&save={name}'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 120:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('FIT', path if os.path.exists(path) else 'FAILED')
        continue
    if req == 'library':   # library-check.html: the packaged files, loaded as a game does
        name, path = 'library.png', os.path.join(out, 'library.png')
        for f in (path, path + '.json'):
            if os.path.exists(f):
                os.remove(f)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=1800,1000', '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/library-check.html?save={name}'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path + '.json') and time.time() - t0 < 180:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('LIBRARY', path if os.path.exists(path) else 'FAILED', open(path + '.json').read() if os.path.exists(path + '.json') else '')
        continue
    if req == 'cover':   # promo/cover.html, the 2048 square cover (VIEW_EXTRA: &v=..., &lift=...)
        name, path = 'cover.png', os.path.join(out, 'cover.png')
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=1100,1100', '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/promo/cover.html?save={name}' + os.environ.get('VIEW_EXTRA', '')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 180:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('COVER', path if os.path.exists(path) else 'FAILED')
        continue
    if req == 'props':   # props/props-check.html: every prop at its real size beside a Moggy
        name, path = 'props.png', os.path.join(out, 'props.png')
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=1800,1500', '--hide-scrollbars', '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/props/props-check.html?save={name}'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 120:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('PROPS', path if os.path.exists(path) else 'FAILED')
        continue
    if req in ('skin', 'skin-dogs'):   # skin-check.html: every clip on every body (or ?pack=dogs), as JSON
        name = req + '.json'
        path = os.path.join(out, name)
        if os.path.exists(path):
            os.remove(path)
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--use-angle=metal', '--mute-audio',
                               f'http://127.0.0.1:{port}/chonky-cats/skin-check.html?save={name}' + ('&pack=dogs' if req == 'skin-dogs' else '')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 900:
            time.sleep(0.5)
        ch.kill()
        ch.wait()
        print('SKIN', path if os.path.exists(path) else 'FAILED')
        continue
    if req.startswith('gallery'):   # gallery[:clip[:WxH]]: the default viewer page
        parts = req.split(':')
        clip = parts[1] if len(parts) > 1 else 'walk'
        size = parts[2] if len(parts) > 2 else '1400x800'
        clip, size = clip or 'walk', size or '1400x800'
        name = f'gallery-{clip}-{size}.png'
        path = os.path.join(out, name)
        if os.path.exists(path):
            os.remove(path)
        url = f'http://127.0.0.1:{port}/chonky-cats/viewer.html?clip={clip}&save={name}'
        ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', '--user-data-dir=/tmp/chonky-cats/chrome',
                               '--window-size=' + size.replace('x', ','), '--hide-scrollbars', '--use-angle=metal',
                               '--ignore-gpu-blocklist', '--mute-audio', url],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        t0 = time.time()
        while not os.path.exists(path) and time.time() - t0 < 60:
            time.sleep(0.3)
        ch.kill()
        ch.wait()
        print('GALLERY', path if os.path.exists(path) else 'FAILED')
        continue
    clip, cats, n, side, zoom = (req.split(':') + ['', '', '', ''])[:5]
    mirror = side == 'mirror'
    side = '' if mirror else side
    cats = cats or 'moggy,cobby,munchkin,sleek'
    n = int(n or 8)
    name = f'strip-{clip}{"-side" if side else ""}{"-mirror" if mirror else ""}.png'
    path = os.path.join(out, name)
    if os.path.exists(path):
        os.remove(path)
    rows = len(cats.split(','))
    extra = os.environ.get('VIEW_EXTRA', '')   # e.g. VIEW_EXTRA='&wear=collar'
    url = f'http://127.0.0.1:{port}/chonky-cats/viewer.html?strip={clip}&cats={cats}&n={n}&save={name}' + extra + ('&side' if side else '') + (f'&zoom={zoom}' if zoom else '') + ('&mirror' if mirror else '')
    cw, chh = (int(v) for v in os.environ.get('CELL', '170x190').split('x'))   # CELL=400x400 for bigger cells
    ch = subprocess.Popen(['nice', '-n', '19', CHROME, '--headless=new', f'--user-data-dir=/tmp/chonky-cats/chrome',
                           f'--window-size={n * cw},{rows * chh}', '--hide-scrollbars', '--use-angle=metal',
                           '--ignore-gpu-blocklist', '--mute-audio', url],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    while not os.path.exists(path) and time.time() - t0 < 60:
        time.sleep(0.3)
    ch.kill()
    ch.wait()
    print('STRIP', path if os.path.exists(path) else 'FAILED ' + clip)
server.shutdown()
