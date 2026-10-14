"""Shared cloth pattern masks for the bandanas (plain numpy, used by wear_lib.py).

    python3 cloth.py      # writes rigged/wear/cloth.png

One RGBA texture for every bandana: R dots, G gingham, B stripes, A unused. The game
mixes two colors by one channel (dogcoat.js tintCloth), so any color / pattern is free.
"""
import os

import numpy as np


def cloth_patterns(size=256, n=6):
    yy, xx = np.mgrid[0:size, 0:size] / size
    dots = np.zeros((size, size))
    for oy, ox in ((0, 0), (0.5 / n, 0.5 / n)):
        fx, fy = ((xx - ox) * n) % 1 - 0.5, ((yy - oy) * n) % 1 - 0.5
        dots = np.maximum(dots, np.clip((0.17 - np.sqrt(fx * fx + fy * fy)) * size / n * 1.5, 0, 1))
    band = lambda v: np.clip((np.abs((v * n) % 1 - 0.5) - 0.25) * size / n * 1.5 + 0.5, 0, 1)  # noqa: E731
    gingham = 0.5 * band(xx) + 0.5 * band(yy)
    stripes = band(xx + yy)
    return np.stack([dots, gingham, stripes, np.zeros_like(dots)], -1)


if __name__ == '__main__':
    from PIL import Image
    here = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(here, 'rigged', 'wear'), exist_ok=True)
    Image.fromarray((cloth_patterns() * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(here, 'rigged', 'wear', 'cloth.png'))
