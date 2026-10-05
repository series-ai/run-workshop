"""Archmage staff with a carved warmwood haft and a set cyan crystal."""
import numpy as np

from _kit import held
from voxgrid import C, Grid


L, W = 58, 13
CY = CZ = 6


def _coords():
    x = np.arange(L)[:, None, None]
    y = np.arange(W)[None, :, None]
    z = np.arange(W)[None, None, :]
    return x, y - CY, z - CZ


def build():
    g = Grid(L, W, W)
    x, dy, dz = _coords()
    ay, az = np.abs(dy), np.abs(dz)
    quad = (dy > 0).astype(int) * 2 + ((dy > 0) ^ (dz > 0)).astype(int)

    # A square-cut pommel caps the broad, warmwood shaft.
    shaft = (x >= 2) & (x < 46) & (ay <= 1) & (az <= 1)
    g.where(shaft, C("darkwood", 4))
    g.where(shaft & (dy > 0), C("wood", 5))
    grain = shaft & (dy == 0) & (dz == -1)
    grain &= ((x >= 5) & (x < 10)) | ((x >= 24) & (x < 30)) | ((x >= 33) & (x < 39))
    g.where(grain, C("darkwood", 3))
    grain_light = shaft & (dy == 0) & (dz == 1) & (x >= 16) & (x < 23)
    g.where(grain_light, C("wood", 6))
    pommel = (x < 3) & (ay <= 2) & (az <= 2) & ~((ay == 2) & (az == 2))
    g.where(pommel, C("steel", 4))
    g.where(pommel & (dy > 0), C("steel", 6))
    g.where((x == 0) & (ay <= 1) & (az <= 1), C("gold", 5))

    # A shaped leather grip has stepped shoulders and a painted spiral seam.
    grip = (x >= 12) & (x < 20) & (ay <= 2) & (az <= 2)
    grip &= ~(((x == 12) | (x == 19)) & ((ay == 2) | (az == 2)))
    g.where(grip, C("rust", 3))
    g.where(grip & (dy > 0), C("rust", 5))
    g.where(grip & (((x + quad) % 3) == 0), C("darkwood", 3))
    for x0 in (11, 20, 29, 40):
        band = (x == x0) & (ay <= 2) & (az <= 2) & ~((ay == 2) & (az == 2))
        g.where(band, C("steel", 5))
        g.where(band & (dy > 0), C("steel", 6))
        rivets = band & (ay == 2) & (az == 0)
        g.where(rivets, C("gold", 6))

    # The crystal seat is a broad gold collar with four attached prongs.
    seat = (x >= 43) & (x < 47) & (ay <= 2) & (az <= 2)
    seat &= ~((ay == 2) & (az == 2))
    g.where(seat, C("gold", 4))
    g.where(seat & (dy > 0), C("gold", 6))
    g.where(seat & (dy < 0), C("gold", 3))
    prongs = []
    for y0, z0 in ((3, 0), (-3, 0), (0, 3), (0, -3)):
        prong = (x >= 46) & (x < 50) & (dy >= y0) & (dy < y0 + 1)
        if y0 == 0:
            prong = (x >= 46) & (x < 50) & (dy >= -1) & (dy <= 1) & (dz == z0)
        else:
            prong = prong & (dz >= -1) & (dz <= 1)
        prongs.append(prong)
        g.where(prong, C("gold", 5))
        g.where(prong & (dy > 0), C("gold", 7))

    # One large octahedral crystal makes the magic head read as a single gem.
    crystal = (x >= 45) & (x <= 56) & ((np.abs(x - 51) * 0.9 + ay * 0.75 + az * 0.75) <= 5.0)
    g.where(crystal, C("cyan", 4))
    g.where(crystal & (dy > 0), C("cyan", 6))
    g.where(crystal & (dz > 0) & (dy >= 0), C("sky", 6))
    g.where(crystal & (dy < 0) & (dz < 0), C("blue", 3))
    # Broad facet streaks add a cut-glass highlight without adding loose pieces.
    g.where(crystal & (dy >= 1) & (dz >= 0) & ((x + dz) % 4 == 0), C("cyan", 7))
    g.where(crystal & (dy <= -2) & (dz <= 0), C("blue", 4))
    # Paint the prongs last so each one remains visible against the gem.
    for prong in prongs:
        g.where(prong, C("gold", 5))
        g.where(prong & (dy > 0), C("gold", 7))

    return held("mage-staff", "Archmage Staff", g, (15.5, CY, CZ),
                {"socket-tip": (50, CY + 0.5, CZ + 0.5)},
                [{"effectId": "rvx-fantasy-arcane-bolt", "socket": "socket-tip",
                  "trigger": "manual", "size": 0.6, "aim": [1.0, 0.0, 0.0]}])
