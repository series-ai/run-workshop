"""Generate the shared dog pattern masks. White = colour B, black = colour A.

python3 scripts/gen_patterns.py

Region masks are side views of "dog space": u runs tail (0) to nose (1), v runs
floor (0) to the top of the dog (1). The shader projects them from the side,
so the same mask lands on the back/belly/muzzle of any body.

Tile masks are seamless surface patterns (spots, brindle, merle) that the
shader wraps over each body's UVs (even texel density, see prep_body.py).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parent.parent / 'kit' / 'patterns'
OUT.mkdir(parents=True, exist_ok=True)
RW, RH = 256, 128  # region masks
TS = 128           # tile masks
rng = np.random.default_rng(7)

# Region-mask grid. Row 0 is the top of the image, i.e. v = 1.
U, V = np.meshgrid(np.linspace(0, 1, RW), np.linspace(1, 0, RH))


def blob(cu, cv, ru, rv):
    return ((U - cu) / ru) ** 2 + ((V - cv) / rv) ** 2 < 1


def save_region(name, mask):
    """Save at 2x with soft edges; the shader thresholds at 0.5 for smooth outlines."""
    img = Image.fromarray((mask * 255).astype(np.uint8)).resize((RW * 2, RH * 2), Image.BILINEAR)
    img.filter(ImageFilter.GaussianBlur(2.5)).save(OUT / f'region-{name}.png')


# Saddle / blanket: dark back from the shoulders to the base of the tail.
save_region('saddle', (blob(0.42, 0.78, 0.30, 0.22) | blob(0.08, 0.8, 0.1, 0.25)) & (U < 0.72))

# Tuxedo: white chest, belly, feet and a blaze down the muzzle.
save_region('tuxedo', blob(0.72, 0.38, 0.16, 0.26) | (V < 0.3) & (U > 0.25) & (U < 0.85)
            | (V < 0.12) | blob(0.97, 0.62, 0.08, 0.14))

# Face mask: dark muzzle and ears (pug, mastiff).
# The small blob at (0.80, 0.99) is where every head's ear sockets sample, so masked
# breeds get dark ears without darkening the skull.
save_region('mask', (U > 0.87) & (V > 0.45) | blob(0.80, 0.995, 0.02, 0.03))

# Tan points: tan legs, chest spot, muzzle and brow dots (doberman, rottweiler).
save_region('points', (V < 0.24) | blob(0.95, 0.62, 0.07, 0.1) | blob(0.8, 0.5, 0.06, 0.08)
            | blob(0.88, 0.82, 0.025, 0.03) | blob(0.06, 0.55, 0.05, 0.08))

# Piebald: a few big patches on a white dog (beagle, jack russell, cow-print).
pie = np.zeros_like(U, dtype=bool)
for cu, cv, r in [(0.88, 0.82, 0.16), (0.5, 0.75, 0.17), (0.25, 0.68, 0.12), (0.62, 0.58, 0.08)]:
    pie |= blob(cu, cv, r, r * 1.6)
save_region('piebald', pie)


def save_tile(name, mask):
    """Save at 2x with soft, seamless edges: the shader thresholds at 0.5, so a
    blurred edge gives smooth round outlines at any zoom instead of texel steps."""
    img = Image.fromarray((mask * 255).astype(np.uint8))
    tiled = Image.new('L', (TS * 3, TS * 3))
    for i in range(3):
        for j in range(3):
            tiled.paste(img, (i * TS, j * TS))
    tiled = tiled.resize((TS * 6, TS * 6), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
    tiled.crop((TS * 2, TS * 2, TS * 4, TS * 4)).save(OUT / f'tile-{name}.png')


TU, TV = np.meshgrid(np.arange(TS), np.arange(TS))


def wrapped_dist(cx, cy):
    dx = np.abs(TU - cx)
    dy = np.abs(TV - cy)
    return np.hypot(np.minimum(dx, TS - dx), np.minimum(dy, TS - dy))


def scatter(n, rmin, rmax, min_gap):
    pts = []
    while len(pts) < n:
        x, y, r = rng.uniform(0, TS), rng.uniform(0, TS), rng.uniform(rmin, rmax)
        if all(np.hypot(*(np.minimum(np.abs(np.subtract((x, y), p[:2])), TS - np.abs(np.subtract((x, y), p[:2]))))) > r + p[2] + min_gap for p in pts):
            pts.append((x, y, r))
    return pts


# Spots (dalmatian): separate round spots.
spots = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(9, 7, 11, 6):
    spots |= wrapped_dist(x, y) < r
save_tile('spots', spots)

# Ticking / roan / speckle (setters, GSP, Bluetick, Cattle Dog): many small flecks.
tick = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(70, 1.6, 2.6, 2.5):
    tick |= wrapped_dist(x, y) < r
save_tile('ticking', tick)

# Merle: irregular blotches made from overlapping circles.
merle = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(6, 10, 16, 2):
    for _ in range(4):
        merle |= wrapped_dist(x + rng.uniform(-r, r) * 0.6, y + rng.uniform(-r, r) * 0.6) < r * rng.uniform(0.5, 0.9)
save_tile('merle', merle)

# Brindle: wavy vertical stripes, periodic in both directions.
x = TU / TS * 2 * np.pi
y = TV / TS * 2 * np.pi
wave = np.sin(x * 6 + 1.3 * np.sin(y * 2) + 0.6 * np.sin(y * 3 + x))
save_tile('brindle', wave > 0.35)

print('\n'.join(sorted(p.name for p in OUT.iterdir())))
