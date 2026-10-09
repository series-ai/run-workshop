"""A darkwood flanged mace with a framed steel head and engraved cheeks.

The haft and head run along +X in the PN held-item frame.
"""
import numpy as np

from _kit import held
from voxgrid import C, Grid


L = 36
CY = CZ = 7


def _idx(g: Grid):
    x = np.arange(g.shape[0])[:, None, None] + 0.5
    y = np.arange(g.shape[1])[None, :, None] + 0.5 - CY
    z = np.arange(g.shape[2])[None, None, :] + 0.5 - CZ
    return x, y, z


def _ring(g: Grid, x, y, z, x0: int, x1: int, half: int, ramp: str, shade: int):
    ay, az = np.abs(y), np.abs(z)
    mask = (x >= x0) & (x < x1) & (ay < half) & (az < half)
    mask &= ~((ay > half - 1) & (az > half - 1))
    g.where(mask, C(ramp, shade))
    g.where(mask & (y < 0), C(ramp, max(1, shade - 2)))


def build():
    g = Grid(L, 15, 15)
    x, y, z = _idx(g)
    ay, az = np.abs(y), np.abs(z)
    shaft = (x < 28) & (ay < 1) & (az < 1)
    quadrant = (y > 0).astype(int) * 2 + ((y > 0) ^ (z > 0)).astype(int)

    # The pommel and warm wood haft keep the PN fantasy palette.
    _ring(g, x, y, z, 0, 2, 2, "iron", 4)
    g.where(shaft & (x >= 2), C("wood", 4))
    g.where(shaft & (x >= 2) & (y > 0), C("wood", 5))
    grain = shaft & (x >= 12) & (x < 25) & (y > 0) & (z > 0)
    grain &= (np.floor(x).astype(int) % 7) == 0
    g.where(grain, C("darkwood", 3))

    # Rust leather wraps form an even grip with dark spiral seams.
    grip = shaft & (x >= 3) & (x < 12)
    g.where(grip, C("rust", 3))
    g.where(grip & (((np.floor(x).astype(int) + quadrant) % 3) == 0), C("rust", 1))
    g.where(grip & (y > 0) & (((np.floor(x).astype(int) + quadrant) % 3) != 0), C("rust", 4))

    # A matched iron-and-gold socket joins the haft to the head.
    _ring(g, x, y, z, 24, 25, 2, "iron", 4)
    _ring(g, x, y, z, 25, 26, 2, "gold", 5)
    _ring(g, x, y, z, 26, 28, 3, "iron", 4)
    _ring(g, x, y, z, 27, 28, 3, "gold", 4)

    # A rounded barrel supports eight long, tapered striking flanges.
    radius = np.sqrt(y * y + z * z)
    core_radius = np.where((x < 29) | (x >= 33), 3.0, 3.5)
    core = (x >= 27) & (x < 35) & (radius <= core_radius)
    g.where(core, C("steel", 4))
    g.where(core & (y > 0), C("steel", 5))
    g.where(core & (z > 0) & (y >= 0), C("steel", 6))

    axial = (x >= 28) & (x < 34)
    valid_bounds = (y > -6) & (y < 7) & (z > -6) & (z < 7)
    fin_edges = np.zeros(g.shape, dtype=bool)
    fin_faces = np.zeros(g.shape, dtype=bool)
    fin_seams = np.zeros(g.shape, dtype=bool)
    fin_studs = np.zeros(g.shape, dtype=bool)
    for i in range(8):
        angle = i * np.pi / 4
        radial = y * np.sin(angle) + z * np.cos(angle)
        tangent = y * np.cos(angle) - z * np.sin(angle)
        reach = np.where((x < 29.5) | (x >= 32.5), 4.8, 6.5)
        flange = axial & valid_bounds & (radial >= 2.5) & (radial <= reach) & (np.abs(tangent) < 1.25)
        g.where(flange, C("steel", 4))
        g.where(flange & ((y > 0) | (z > 0)), C("steel", 5))
        g.where(flange & (y > 0) & (z > 0), C("steel", 6))
        fin_edges |= flange & ((x < 29) | (x >= 33))
        outer = flange & (radial > reach - 1.0)
        fin_faces |= outer
        fin_seams |= outer & (np.floor(x).astype(int) == 31)
        fin_studs |= outer & (np.floor(x).astype(int) == 30) & (np.abs(tangent) < 0.75)

    # Thin dark borders and one gold fastener finish each broad flange face.
    g.where(fin_edges, C("steel", 3))
    g.where(fin_faces, C("steel", 6))
    g.where(fin_seams, C("steel", 2))
    g.where(fin_studs, C("gold", 4))

    # The round striking cap has a small royal-blue gem at its center.
    end = (x >= 34) & (x < 36) & (radius <= 3.5)
    g.where(end, C("steel", 4))
    g.where(end & (radius > 2.6), C("steel", 2))
    front = end & (x >= 35)
    g.where(front & (radius < 1.8), C("blue", 4))
    g.where(front & (radius < 0.7), C("gold", 6))

    return held("flanged-mace", "Flanged Mace", g, (6.5, CY, CZ),
                {"socket-head": (31, CY + 0.5, CZ + 0.5)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-head",
                  "trigger": "manual", "size": 0.3}])
