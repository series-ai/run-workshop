"""Generate the shared cat pattern masks. White = colour B, black = colour A.

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


# Cat UV2 layout (see build_cat.py), by anatomy:
#   tail  u < 0.045, v base (0) to tip (1)
#   body  u 0.05 (rump) .. 0.70 (top of neck), v = round the body: 1 spine,
#         0.5 sides, 0 belly / throat. Chest front ~u 0.42-0.5, waist ~0.24.
#   legs  hind u 0.70-0.72, front u 0.72-0.75, v paw (0) to top (1)
#   head  u 0.76-1 (back of skull to nose), v 0.45-1 (chin to crown)
BODY = (U >= 0.045) & (U < 0.70)
LEGS_H = (U >= 0.70) & (U < 0.72)
LEGS_F = (U >= 0.72) & (U < 0.755)
LEGS = LEGS_H | LEGS_F
FACE = (U >= 0.76) & (V > 0.45)
EARS = blob(0.80, 0.99, 0.012, 0.012)   # every ear samples exactly (0.80, 0.99), see build_heads.py
TAIL = U < 0.045
TAIL_RINGS = TAIL & (np.sin(V * 34) > 0.25) & (V > 0.12)
MUZZLE = FACE & (U > 0.93) & (V < 0.72)
CHIN = FACE & (U > 0.88) & (V < 0.6)
NECK = BODY & (U > 0.5)

# Colour-point (Siamese, Himalayan, Ragdoll, Birman): dark mask, ears, legs, tail.
save_region('points', FACE & (U > 0.88) | EARS | LEGS | TAIL)

# Cream: belly, chest and throat, chin and muzzle in a lighter colour (most
# tabbies; the look of the concept art).
save_region('cream', BODY & (U > 0.18) & (V < 0.22) | BODY & (U > 0.38) & (V < 0.42) | MUZZLE | CHIN)

# Bicolour / tuxedo: white chest, belly, lower legs, muzzle and chin.
save_region('bicolor', BODY & (U > 0.12) & (V < 0.3) | BODY & (U > 0.36) & (V < 0.45) | LEGS & (V < 0.6)
            | MUZZLE | CHIN)

# Van (Turkish Van): white all over but a cap between the ears and the tail.
save_region('van', ~(FACE & (V > 0.82) & (U < 0.93) | EARS | TAIL & (V > 0.15)))

# Mitted (Ragdoll, Birman gloves): white paws, chin and a belly stripe.
save_region('mitted', LEGS & (V < 0.2) | CHIN | MUZZLE & (V < 0.6) | BODY & (U > 0.2) & (V < 0.12))

# Locket: a small white patch on the chest.
save_region('locket', BODY & (U > 0.42) & (U < 0.5) & (V < 0.22))

# Harlequin / piebald: a few colour patches on a white cat, coloured tail and cap.
pie = TAIL | FACE & (V > 0.8) | EARS
for cu, cv, r in [(0.3, 0.8, 0.09), (0.55, 0.75, 0.07), (0.15, 0.6, 0.06)]:
    pie |= blob(cu, cv, r, r * 2.5)
save_region('harlequin', pie)

# Mackerel tabby: soft stripes from the spine down the sides (fading toward
# the belly), a dark spine line, bars on the legs, tail rings, the forehead M.
wob = np.sin(V * 5 + U * 7) * 0.8
mack = BODY & (V > 0.42 + 0.06 * np.sin(U * 50)) & (np.sin(2 * np.pi * U * 13 + wob) > 0.55) & (U < 0.6)
mack |= BODY & (V > 0.95) & (U < 0.6)
mack |= LEGS & (V > 0.2) & (V < 0.85) & (np.sin(V * 28) > 0.7)
mack |= FACE & (U < 0.9) & (V > 0.86) & (np.sin(U * 260) > 0.5)
save_region('mackerel', mack | TAIL_RINGS)

# Classic tabby: a loose swirl on each flank, a butterfly over the shoulders,
# barred legs, tail rings, the forehead M.
dd = np.hypot((U - 0.27) / 0.6, (V - 0.58) * 1.0)
th = np.arctan2(V - 0.58, (U - 0.27) / 0.6)
dd = dd * (1 + 0.2 * np.sin(3 * th + 1))
classic = BODY & (dd < 0.22) & (np.mod(dd * 10 + 0.1 * np.sin(4 * th), 1) < 0.42)
classic |= BODY & (V > 0.93) & (U < 0.6) | BODY & (U > 0.4) & (U < 0.5) & (V > 0.75)
classic |= LEGS & (V > 0.2) & (V < 0.85) & (np.sin(V * 28) > 0.7)
classic |= FACE & (U < 0.9) & (V > 0.86) & (np.sin(U * 260) > 0.5)
save_region('classic', classic | TAIL_RINGS)

# Smoke / shaded: colour on the back and head, shading to a pale belly.
save_region('shaded', BODY & (V > 0.55 + 0.04 * np.sin(U * 40)) | LEGS & (V > 0.7) | FACE & (V > 0.72) | EARS
            | TAIL)


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


# Spots (Egyptian Mau, Ocicat, spotted tabby): round spots.
spots = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(11, 6, 9, 6):
    spots |= wrapped_dist(x, y) < r
save_tile('spots', spots)

# Rosettes (Bengal): spots with lighter centres.
ros = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(8, 9, 13, 5):
    dd = wrapped_dist(x, y)
    ros |= (dd < r) & (dd > r * 0.45)
save_tile('rosettes', ros)

# Ticking (Abyssinian, Somali, Singapura): many small flecks.
tick = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(70, 1.6, 2.6, 2.5):
    tick |= wrapped_dist(x, y) < r
save_tile('ticking', tick)

# Tortoiseshell: irregular interlocking patches of the second colour.
tort = np.zeros((TS, TS), dtype=bool)
for x, y, r in scatter(9, 8, 14, 1):
    for _ in range(5):
        tort |= wrapped_dist(x + rng.uniform(-r, r) * 0.7, y + rng.uniform(-r, r) * 0.7) < r * rng.uniform(0.4, 0.8)
save_tile('tortie', tort)

print('\n'.join(sorted(p.name for p in OUT.iterdir())))
