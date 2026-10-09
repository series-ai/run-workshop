"""A cactus cluster on desert soil, in the Pirate Nation style.

Three saguaro columns (tapered octagonal frustums with domed tops, true
slopes, rule F2), two of them with elbow arms, and one squat barrel
cactus stand on a patch of soft sand. Vertical ribs, pale spine dots, a
shadow side and a few small blossoms are paint (rule S1). The ground has
soft sand patches and no tile grid. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import blob, ctr, limb, make, plan, rock, tuft
from _rep_terrain import soft_ground
from voxgrid import Grid, Part

SIZE = (72, 64, 62)
GROUND = 3.0
RIBS = 8


def ribs(g: Grid, mask: np.ndarray, x0: float, z0: float, y0: float, x1: float, z1: float, y1: float, base: int = 4, dots: bool = True) -> None:
    """Paint vertical ribs on a cactus part whose axis runs from (x0, y0, z0)
    to (x1, y1, z1): a dark groove between ribs, a light crest on each rib,
    pale spine dots along the crests every 4 voxels (`dots`; thin arms
    have none, because their crests are too close) and a darker shadow
    side to -x."""
    X, Y, Z = ctr(g)
    t = np.clip((Y - y0) / max(y1 - y0, 1e-6), 0, 1)
    ax, az = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
    ang = np.arctan2(Z - az, X - ax)
    f = (ang / (2 * math.pi) * RIBS + 0.5) % 1.0  # 0 and 1 at a crest, 0.5 in a groove
    crest = (f < 0.14) | (f > 0.86)
    groove = np.abs(f - 0.5) < 0.12
    P.flat(g, mask, "teal", base)
    P.flat(g, mask & (X < ax - 1.5), "teal", base - 1)  # the shadow side
    P.flat(g, mask & groove, "forest", 3)
    P.flat(g, mask & crest, "teal", base + 1)
    if dots:
        P.flat(g, mask & crest & (np.floor(Y) % 4 == 1), "bone", 6)  # spine dots on the crests


def cactus(g: Grid, x: float, z: float, h: float, r: float, lean=(0.0, 0.0)) -> np.ndarray:
    """A saguaro column with a domed top. Returns the column mask."""
    base = S.flat_ngon(x, z, r, RIBS)
    tx, tz = x + lean[0], z + lean[1]
    top = [(tx + (u - x) * 0.82, tz + (v - z) * 0.82) for u, v in base]
    stem = plan(g, base, GROUND - 0.5, h, "teal", 4, top=top)
    dome = plan(g, top, h, h + r * 0.55, "teal", 4, top=[(tx + (u - tx) * 0.5, tz + (v - tz) * 0.5) for u, v in top])
    m = stem | dome
    ribs(g, m, x, z, GROUND, tx, tz, h)
    X, Y, Z = ctr(g)
    P.flat(g, m & (Y > h), "teal", 5)
    P.flat(g, m & (Y < GROUND + 1.5), "khaki", 3)  # a dusty foot
    return m


def arm(g: Grid, root, elbow, tip, r0: float, r1: float) -> np.ndarray:
    """An arm: a short rising elbow out of the column, then a vertical
    upper arm with a domed tip. Points are (x, y, z)."""
    m = limb(g, root, elbow, r0, r0 * 0.95, "teal", 4, n=8)
    X, Y, Z = ctr(g)
    P.flat(g, m, "teal", 4)
    P.flat(g, m & (Y < elbow[1] - r0 * 0.5), "teal", 3)
    up = limb(g, elbow, tip, r0 * 0.95, r1, "teal", 4, n=8)
    cap = limb(g, tip, (tip[0], tip[1] + r1 * 0.8, tip[2]), r1, r1 * 0.45, "teal", 4, n=8)
    ribs(g, up | cap, elbow[0], elbow[2], elbow[1], tip[0], tip[2], tip[1], dots=False)
    P.flat(g, cap & (Y > tip[1]), "teal", 5)
    return m | up | cap


def blossom(g: Grid, x: float, y: float, z: float) -> None:
    """A small blossom: four magenta petals round a gold centre."""
    X, Y, Z = ctr(g)
    S.disc(g, "y", x, z, 1.6, y - 0.3, y + 1.0, "magenta", 5, n=6)
    P.flat(g, (g.a > 0) & (np.abs(Y - y - 0.5) < 0.6) & (np.hypot(X - x, Z - z) < 0.9), "gold", 6)


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    outline = blob(36, 31, 33, 28, n=10, jitter=0.08, seed=1)
    soil = plan(g, outline, 0, GROUND, "sand", 5, top=[(36 + (x - 36) * 0.94, 31 + (z - 31) * 0.94) for x, z in outline])
    soft_ground(g, soil, "sand", 5, [(22, 28, 10, 8, -1), (48, 46, 11, 7, 1), (14, 12, 8, 6, 1), (58, 18, 7, 6, -1)],
                36, 31, 27)
    # A darker damp ring at each cactus foot.
    for x, z, r in ((23, 28, 6.5), (46, 34, 5.2), (58, 19, 4.5)):
        P.flat(g, soil & (np.hypot(X - x, Z - z) < r + 2.5), "sand", 3)

    cactus(g, 23, 28, 52, 6.5, lean=(1.0, 0.0))
    cactus(g, 46, 34, 35, 5.2, lean=(-0.8, 0.6))
    cactus(g, 58, 19, 24, 4.5, lean=(0.6, -0.6))
    # Elbow arms on the two tall columns.
    arm(g, (20.0, 24.0, 28.0), (13.0, 29.0, 28.0), (13.0, 40.0, 28.0), 3.4, 2.6)
    arm(g, (26.0, 34.0, 28.0), (32.0, 39.0, 28.5), (32.0, 47.0, 28.5), 3.0, 2.3)
    arm(g, (48.0, 20.0, 34.0), (53.0, 24.0, 36.0), (53.0, 30.0, 36.0), 2.6, 2.0)

    # A squat barrel cactus with a ribbed dome.
    barrel = rock(g, 62, 41, GROUND - 0.5, 4.6, 4.4, 6.5, "teal", 4, shrink=0.55, n=8, seed=3)
    ribs(g, barrel, 62, 41, GROUND, 62, 41, GROUND + 6)
    blossom(g, 62.0, GROUND + 6.0, 41.0)

    # Small blossoms near three tops (not caps: they sit to one side).
    blossom(g, 25.0, 52.0 + 6.5 * 0.55 - 1.0, 29.0)
    blossom(g, 13.5, 40.0 + 2.6 * 0.8 - 0.6, 27.5)
    blossom(g, 45.5, 35.0 + 5.2 * 0.55 - 1.0, 35.5)

    for k, (cx, cz, r) in enumerate(((9, 44, 4), (53, 7, 5), (34, 56, 4))):
        st = rock(g, cx, cz, GROUND - 1, r, r * 0.7, r * 0.65, "stone", 5, shrink=0.6, n=6, seed=10 + k)
        P.flat(g, st & (Y > GROUND - 1 + r * 0.65 - 1.0), "stone", 6)
    for k, (tx, tz) in enumerate(((6, 18), (38, 9), (66, 52), (49, 53), (30, 44))):
        tuft(g, tx, tz, GROUND, 5, blades=4, spread=2.5, ramp="khaki", shade=5, seed=20 + k)
    return make("terrain-nature", "cactus-cluster", "Cactus Cluster", Part("cactus-cluster", g))
