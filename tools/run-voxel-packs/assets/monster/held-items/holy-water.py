"""Holy water flask: a moonlit blue flask in a gothic iron cage.
A gold-edged bone reliquary marks both sides. A violet ribbon binds the
leather grip. Magenta wax seals the cork. Every part is face-connected.
Held-item frame: +X forward (the flask), origin = Hand.R joint."""
import numpy as np

from _kit import C, Grid, held, pfx

L = 28
c = 6


def octo(ay, az, r: float) -> np.ndarray:
    """Inside an octagonal cross-section of flat radius r about the axis."""
    return (ay < r) & (az < r) & (ay + az < 1.4 * r)


def build():
    g = Grid(L, 2 * c, 2 * c)
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    yc, zc = Y + 0.5 - c, Z + 0.5 - c
    ay, az = np.abs(yc), np.abs(zc)
    quad = (yc > 0).astype(int) * 2 + (zc > 0).astype(int)
    sec = lambda x0, x1, r: (X >= x0) & (X < x1) & octo(ay, az, r)  # noqa: E731
    # The long neck has a dark leather grip.
    neck = sec(2, 12, 1.01)
    g.a[neck] = C("darkwood", 6)
    g.a[neck & ((X + quad) % 3 == 0)] = C("darkwood", 4)
    g.a[neck & (yc > 0) & ((X + quad) % 3 == 1)] = C("darkwood", 7)
    # The cork has a magenta wax seal with short drips.
    cork = sec(1, 3, 2)
    g.a[cork] = C("wood", 5)
    g.a[cork & (yc > 0)] = C("wood", 6)
    seal = sec(0, 1, 2) | (sec(1, 2, 2.01) & ~sec(1, 2, 1.5) & ((quad % 2) == 0))
    g.a[seal] = C("magenta", 2)
    g.a[seal & (yc > 0)] = C("magenta", 2)
    # A full violet ribbon makes a clear band around the grip.
    ribbon = sec(10, 11, 2)
    g.a[ribbon] = C("purple", 3)
    g.a[ribbon & (yc > 0)] = C("purple", 5)
    g.a[ribbon & (yc < -0.5) & (np.abs(zc) < 1)] = C("magenta", 3)
    # The grip collar and the iron shoulder cap.
    col = sec(11, 12, 2)
    g.a[col] = C("gray", 3)
    cap = sec(12, 14, 3)
    g.a[cap] = C("gray", 5)
    g.a[cap & (yc > 1.5)] = C("gray", 6)
    g.a[cap & (X == 12)] = C("gray", 3)
    # The flask holds pale, silvery moonlight blue water.
    profile = ((14, 15, 3), (15, 16, 4), (16, 23, 5), (23, 24, 4), (24, 25, 3))
    body = np.zeros(g.shape, dtype=bool)
    for x0, x1, r in profile:
        body |= sec(x0, x1, r)
    ang = np.degrees(np.arctan2(yc, -zc)) % 360  # 0 = front (-z), 90 = top
    octant = ((ang + 22.5) // 45).astype(int) % 8
    for k, sh in enumerate((4, 5, 6, 5, 3, 3, 3, 4)):
        g.a[body & (octant == k)] = C("sky", sh)
    # Dark glass rims frame the ends. Three blue tones keep the broad faces calm.
    g.a[body & ((X == 14) | (X == 24))] = C("iron", 3)
    g.a[body & (octant == 1) & (X >= 17) & (X < 22)] = C("sky", 7)
    g.a[body & (octant == 0) & (X >= 18) & (X < 22)] = C("sky", 6)
    for bx, by, bz in ((18, c - 3, 1), (20, c - 2, 1), (19, c - 4, 2), (17, c + 3, 10), (21, c - 3, 10)):
        if g.a[bx, by, bz]:
            g.a[bx, by, bz] = C("sky", 7)
    g.a[body & (X == 15) & (yc > 2.5)] = C("bone", 6)
    # The iron foot has a framed inset and small gold rivets.
    foot = sec(25, 26, 3)
    g.a[foot] = C("gray", 3)
    g.a[foot & (ay < 2) & (az < 2)] = C("gray", 4)
    g.a[foot & (yc > 1.5) & ~octo(ay, az, 2)] = C("gray", 6)
    # Iron straps wrap the top and bottom of the glass.
    for x0, x1, r in profile:
        for s in (1, -1):
            lo = c + r if s > 0 else c - r - 1
            g.box(x0, lo, c - 1, x1, lo + 1, c + 1, C("gray", 3))
    strap = (g.a == C("gray", 3)) & (ay > 2.5)
    g.a[strap & ((X == 17) | (X == 22))] = C("iron", 5)
    # Iron cage bands sit on the glass surface.
    for s in (1, -1):
        side = body & ((X == 17) | (X == 22)) & ((ay >= 3.5) | (az >= 3.5))
        g.a[side] = C("gray", 3)
        g.a[side & (yc > 1.5)] = C("gray", 5)
    # The reliquary cross is a painted gold and bone emblem.
    front_depth = np.max(np.where(body, Z, -1), axis=2)
    back_depth = np.min(np.where(body, Z, g.shape[2]), axis=2)
    for s in (1, -1):
        zf = front_depth if s > 0 else back_depth
        face = body & (Z == zf[:, :, None])
        gold_cross = (((X >= 19) & (X <= 21) & (Y >= c - 2) & (Y <= c + 2)) |
                      ((X >= 16) & (X <= 24) & (Y >= c - 1) & (Y <= c + 1)))
        bone_cross = (((X >= 19) & (X <= 21) & (Y >= c - 2) & (Y <= c + 2)) |
                      ((X >= 17) & (X <= 23) & (Y >= c - 1) & (Y <= c + 1)))
        terminals = (((X == 19) | (X == 21)) & ((Y == c - 2) | (Y == c + 2)) |
                     ((X == 16) | (X == 24)) & (Y == c))
        g.a[face & gold_cross] = C("gold", 2)
        g.a[face & bone_cross] = C("bone", 7)
        g.a[face & terminals] = C("gold", 3)
        g.a[face & (X == 20) & (Y == c)] = C("magenta", 2)
    # Gold pins finish the inset on the far end plate.
    g.box(25, c - 2, c - 2, 26, c + 2, c + 2, C("gray", 3))
    g.box(25, c - 1, c - 1, 26, c + 1, c + 1, C("gray", 5))
    g.set(25, c, c, C("gold", 5))
    g.set(25, c - 1, c - 1, C("gray", 2)).set(25, c + 1, c + 1, C("gray", 2))
    return held("holy-water", "Holy Water", g, (6, c, c), {"socket-splash": (20, c, c)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-splash", "manual", size=0.36)])
