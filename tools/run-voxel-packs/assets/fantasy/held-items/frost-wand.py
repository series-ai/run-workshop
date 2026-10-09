"""Frost wand: a warm ash wand with a spiral leather grip, gold collars and
a gold pommel gem, crowned by an oversized faceted ice crystal held in a
gold claw, with frost shards splaying out like a snowflake and frost
creeping down the shaft. Tip along +X."""
import numpy as np

from _kit import held
from voxgrid import C, Grid

L, W = 45, 17
CY = CZ = 8  # the shaft axis lies on a grid line: even widths stay centred


def _idx(g: Grid):
    x = np.arange(g.shape[0])[:, None, None]
    y = np.arange(g.shape[1])[None, :, None]
    z = np.arange(g.shape[2])[None, None, :]
    return x, y + 0.5 - CY, z + 0.5 - CZ  # x index, signed centre offsets from the axis


def ring(g: Grid, x0: int, x1: int, half: int, ramp: str, shade: int, rim: int | None = None) -> None:
    """A collar 2*half wide with its four corners cut (reads round)."""
    x, dy, dz = _idx(g)
    m = (x >= x0) & (x < x1) & (np.abs(dy) < half) & (np.abs(dz) < half)
    m &= ~((np.abs(dy) > half - 1) & (np.abs(dz) > half - 1))
    g.where(m, C(ramp, shade))
    if rim is not None:  # the lower half one shade darker: a lit top, a shaded underside
        g.where(m & (dy < 0), C(ramp, rim))


def build():
    g = Grid(L, W, W)
    x, dy, dz = _idx(g)
    shaft = (np.abs(dy) < 1) & (np.abs(dz) < 1)
    quad = (dy > 0).astype(int) * 2 + ((dy > 0) ^ (dz > 0)).astype(int)  # 0..3 around the axis
    # pommel: a gold knob with an ice gem set in its end
    ring(g, 1, 4, 2, "gold", 5, rim=3)
    ring(g, 1, 2, 2, "gold", 3)
    g.box(0, CY - 1, CZ - 1, 1, CY + 1, CZ + 1, C("cyan", 6))
    g.set(0, CY, CZ - 1, C("cyan", 7))
    # grip: a dark leather strap wound in a spiral
    grip = shaft & (x >= 4) & (x < 13)
    g.where(grip, C("rust", 3))
    g.where(grip & (((x + quad) % 3) == 0), C("rust", 1))
    g.where(grip & (((x + quad) % 3) == 1) & (dy > 0), C("rust", 4))
    ring(g, 12, 14, 2, "gold", 5, rim=3)
    # shaft: warm wood with grain streaks, a gold band
    wood = shaft & (x >= 14) & (x < 27)
    g.where(wood, C("wood", 4))
    g.where(wood & (dy > 0), C("wood", 5))
    g.where(wood & (((x * 2 + quad) % 7) == 0), C("wood", 2))
    ring(g, 19, 20, 2, "gold", 5, rim=3)
    # frost creeping down the shaft from the head: a solid rime collar, then thinning patches
    g.where(wood & (x >= 24), C("sky", 6))
    g.where(wood & (x >= 24) & (dy > 0), C("sky", 7))
    g.where(wood & (x >= 21) & (x < 24) & (dy > 0) & (((x + quad) % 2) == 0), C("sky", 7))
    # gold setting: a flared cup with four teeth that grip the crystal
    ring(g, 27, 28, 2, "gold", 4, rim=2)
    ring(g, 28, 29, 3, "gold", 5, rim=3)
    lip = (x == 29) & (np.abs(dy) + np.abs(dz) <= 5) & (np.abs(dy) < 4) & (np.abs(dz) < 4)
    g.where(lip, C("gold", 5))
    g.where(lip & (dy < 0), C("gold", 3))
    g.where(lip & (np.abs(dy) + np.abs(dz) > 4), C("gold", 2))  # dark outer edge of the cup
    for sy, sz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for px in (30, 31):
            if sy:
                yy = CY + 3 if sy > 0 else CY - 4
                g.box(px, yy, CZ - 1, px + 1, yy + 1, CZ + 1, C("gold", 6 if px == 31 else 4))
            else:
                zz = CZ + 3 if sz > 0 else CZ - 4
                g.box(px, CY - 1, zz, px + 1, CY + 1, zz + 1, C("gold", 6 if px == 31 else 4))
    # the crystal: a big faceted diamond-section shard, dark at the root, white at the tip
    rad = np.where(x < 34, 3.6, np.maximum(3.6 - (x - 33.5) * 0.36, 0))
    cry = (x >= 29) & (np.abs(dy) + np.abs(dz) <= rad) & ~((x <= 31) & g.a.astype(bool) & (np.abs(dy) + np.abs(dz) > 2.5))
    g.where(cry, C("cyan", 3))
    g.where(cry & (dy > 0), C("cyan", 5))
    g.where(cry & (dy > 0) & (dz > 0), C("cyan", 6))
    g.where(cry & (dy < 0) & (dz < 0), C("cyan", 2))
    g.where(cry & (x < 31), C("blue", 4))
    edge = cry & (np.abs(dy) + np.abs(dz) > rad - 1.01) & (np.abs(np.abs(dy) - np.abs(dz)) < 1) & (dy > 0)
    g.where(edge & (x >= 32), C("cyan", 7))  # bright facet ridges
    g.where(cry & (x >= 40), C("sky", 7))
    # three smaller ice shards break out of the root at different angles
    xx, yy_, zz_ = np.meshgrid(np.arange(L) + 0.5, np.arange(W) + 0.5, np.arange(W) + 0.5, indexing="ij")
    for p0, d, ln, r0, ramp in (((31.0, CY + 2.0, CZ + 0.0), (0.55, 0.83, 0.0), 6.5, 1.7, "sky"),
                                ((31.0, CY - 1.0, CZ - 2.0), (0.55, -0.3, -0.78), 6.0, 1.7, "cyan"),
                                ((31.0, CY - 2.0, CZ + 1.5), (0.55, -0.62, 0.55), 5.0, 1.5, "sky")):
        d = np.array(d) / np.linalg.norm(d)
        rx, ry, rz = xx - p0[0], yy_ - p0[1], zz_ - p0[2]
        t = rx * d[0] + ry * d[1] + rz * d[2]
        perp = np.sqrt(np.maximum(rx * rx + ry * ry + rz * rz - t * t, 0))
        m = (t >= 0) & (t <= ln) & (perp <= r0 * (1 - t / (ln + 0.6)) + 0.25)
        g.where(m, C(ramp, 5))
        g.where(m & (t > ln * 0.55), C(ramp, 6))
        g.where(m & (t > ln * 0.8), C("sky", 7))
    return held("frost-wand", "Frost Wand", g, (6.5, CY, CZ), {"socket-tip": (42, CY, CZ)},
                [{"effectId": "rvx-fantasy-frost-nova", "socket": "socket-tip", "trigger": "manual", "size": 0.4}])
