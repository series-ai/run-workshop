"""Build side-by-side comparison sheets against external voxel character reference stills.

Usage:
  VERIFY_OUT=<shots> VERIFY_DPR=2 VERIFY_CLIP=Idle_Loop node scripts/verify-visual.mjs
  python3 scripts/compare-references.py --shots <shots> --references <dir> --out <dir> \
      [--previous <dir of an earlier capture> --previous-label v5] [--version v6]

`--shots` is a directory of lab screenshots from `verify-visual.mjs` (1440 x 900 CSS pixels, any
device scale). `--references` holds the reference crops (`ref_body_hero.png`, `ref_blonde.png`,
`ref_redhat.png`, `ref_scout2.png`, `ref_chris.png`, `ref_body_guard.png`, `ref_body_chris.png`).
The reference stills are not in the repository. Python 3 with Pillow is necessary.

Output: `cmp_1_hero_<version>.png` .. `cmp_6_guard_<version>.png` (head close-ups) and
`cmp_bodies_<version>.png` (full bodies). Examine each sheet before you accept a look change.

The head crop is a fixed square in CSS pixels. The lab camera frames each character by its height, thus
the crop that puts the head at the same size is in proportion to the head envelope of that version.
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--shots', required=True)
parser.add_argument('--references', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--previous')
parser.add_argument('--previous-label', default='previous')
parser.add_argument('--version', default='v6')
parser.add_argument('--head-crop', type=float, default=98,
                    help='half side of the head crop in CSS pixels (the 0.25 m head envelope of v6)')
parser.add_argument('--previous-head-crop', type=float, default=120,
                    help='half side of the head crop of the earlier capture (the 0.32 m head envelope of v5)')
args = parser.parse_args()

CSS_WIDTH = 1440     # viewport width of verify-visual.mjs in CSS pixels
BG = (13, 19, 30)
PANEL = 380
HEADER = 34
GAP = 14

def font(size):
    for path in ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

FONT = font(15)

def avatar_rows(im, x0, x1, y0, y1, step):
    """Rows and columns of the avatar: pixels that are not the dark blue backdrop."""
    px = im.load()
    hits = []
    for y in range(y0, y1, step):
        row = [x for x in range(x0, x1, step) if is_avatar(px[x, y])]
        if len(row) > 3:
            hits.append((y, min(row), max(row)))
    return hits

def is_avatar(p):
    r, g, b = p[:3]
    return r > 70 or g > 78 or ((r + g + b) > 235 and not (b > r + 18 and b > g + 6))

def scale_of(im):
    """Device scale factor of a lab screenshot."""
    scale = im.width / CSS_WIDTH
    if scale != int(scale):
        raise ValueError(f'The screenshot is {im.width} px wide. It must be a multiple of {CSS_WIDTH} px.')
    return int(scale)


def head_crop(im, half_css):
    """Square crop around the head of a lab screenshot. `half_css` is half of its side in CSS pixels."""
    s = scale_of(im)
    hits = avatar_rows(im, 650 * s, 1200 * s, 165 * s, 650 * s, s)
    top = hits[0][0]
    head = [h for h in hits if h[0] < top + 150 * s]
    cx = (min(h[1] for h in head) + max(h[2] for h in head)) // 2
    half = round(half_css * s)
    lift = round(0.18 * half)
    return im.crop((cx - half, top - lift, cx + half, top - lift + 2 * half))

def body_crop(im):
    """Portrait crop around the full body of a lab screenshot."""
    s = scale_of(im)
    hits = avatar_rows(im, 650 * s, 1200 * s, 165 * s, 840 * s, s)
    top = hits[0][0]
    body = [h for h in hits if h[0] < top + 640 * s]
    cx = (min(h[1] for h in body) + max(h[2] for h in body)) // 2
    return im.crop((cx - 175 * s, top - 30 * s, cx + 175 * s, top + 545 * s))

def fit(im, w, h):
    """Scale to cover w x h, then center-crop."""
    k = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * k)), max(h, round(im.height * k))), Image.LANCZOS if k < 1 else Image.NEAREST)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

def sheet(panels, w, h, out):
    width = len(panels) * w + (len(panels) + 1) * GAP
    canvas = Image.new('RGB', (width, h + HEADER + GAP), BG)
    draw = ImageDraw.Draw(canvas)
    x = GAP
    for label, color, im in panels:
        draw.text((x, 9), label, fill=color, font=FONT)
        canvas.paste(fit(im, w, h), (x, HEADER))
        x += w + GAP
    canvas.save(out)
    print(out, canvas.size)

OURS = (240, 180, 70)
OLD = (150, 160, 175)
REF = (110, 175, 245)

def ref(name, box=None):
    im = Image.open(os.path.join(args.references, name)).convert('RGB')
    return im.crop(box) if box else im


def shot(directory, name):
    return Image.open(os.path.join(directory, f'lab-{name}.png')).convert('RGB')


def ours(name, label, crop, previous_crop=None):
    """Panels of our character: the previous capture (optional) and the current capture."""
    panels = []
    if args.previous:
        panels.append((f'{label} ({args.previous_label})', OLD, (previous_crop or crop)(shot(args.previous, name))))
    panels.append((f'{label} ({args.version})', OURS, crop(shot(args.shots, name))))
    return panels


def head_now(im):
    return head_crop(im, args.head_crop)


def head_before(im):
    return head_crop(im, args.previous_head_crop)

# Output name, lab screenshot, our label, reference label, reference crop.
FACES = [
    ('cmp_1_hero', '04-heist-wrecker', 'Heist Wrecker', 'Reference Hero', ref('ref_body_hero.png', (150, 95, 400, 345))),
    ('cmp_2_blonde', '05-heist-fixer', 'Heist Fixer', 'Reference Blonde', ref('ref_blonde.png')),
    ('cmp_3_lookout', '06-heist-lookout', 'Heist Lookout', 'Reference Red Hat', ref('ref_redhat.png')),
    ('cmp_4_scout', '07-heist-scout', 'Heist Scout', 'Reference Bandana', ref('ref_scout2.png')),
    ('cmp_5_chris', '08-workshop-craftsman', 'Workshop Craftsman', 'Reference Chris', ref('ref_chris.png', (60, 40, 330, 310))),
    ('cmp_6_guard', '11-night-guard', 'Night Guard', 'Reference Guard', ref('ref_body_guard.png', (165, 60, 425, 320))),
]
BODIES = [
    ('04-heist-wrecker', 'Heist Wrecker', 'Reference Hero', ref('ref_body_hero.png')),
    ('11-night-guard', 'Night Guard', 'Reference Guard', ref('ref_body_guard.png')),
    ('08-workshop-craftsman', 'Workshop Craftsman', 'Reference Chris', ref('ref_body_chris.png')),
]

os.makedirs(args.out, exist_ok=True)
for out, name, label, ref_label, ref_im in FACES:
    sheet([*ours(name, label, head_now, head_before), (ref_label, REF, ref_im)], PANEL, PANEL,
          os.path.join(args.out, f'{out}_{args.version}.png'))

panels = []
for name, label, ref_label, ref_im in BODIES:
    panels += [*ours(name, label, body_crop), (ref_label, REF, ref_im)]
sheet(panels, 300, 520, os.path.join(args.out, f'cmp_bodies_{args.version}.png'))
