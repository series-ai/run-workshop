"""Holy water flask: a chunky round flask of glowing blessed water, held
by its long leather-wrapped neck. Grey iron (two riveted straps, a
shoulder cap, a grip collar and a foot) frames the glass; a big
bone-white cross sits on both faces; a violet-and-bone rosary rings the
neck with a small cross pendant; a cork sealed with magenta wax closes
the end. The water glows a vivid ghostly cyan (the pack's spirit colour,
as the wailing ghost), brightest at the top. Every part is one
face-connected solid.
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
    # the long neck, wrapped in dark brown leather cord (the grip)
    neck = sec(2, 12, 1.01)
    g.a[neck] = C("darkwood", 6)
    g.a[neck & ((X + quad) % 3 == 0)] = C("darkwood", 4)
    g.a[neck & (yc > 0) & ((X + quad) % 3 == 1)] = C("darkwood", 7)
    # the cork and its magenta wax seal with drips
    cork = sec(1, 3, 2)
    g.a[cork] = C("wood", 5)
    g.a[cork & (yc > 0)] = C("wood", 6)
    seal = sec(0, 1, 2) | (sec(1, 2, 2.01) & ~sec(1, 2, 1.5) & ((quad % 2) == 0))
    g.a[seal] = C("magenta", 3)
    g.a[seal & (yc > 0)] = C("magenta", 5)
    # the rosary ringing the neck: violet and bone beads, a gold bead
    beads = sec(9, 10, 2) & ~neck
    g.a[beads] = C("purple", 4)
    g.a[beads & (((Y + Z) % 2) == 0)] = C("bone", 7)
    g.a[beads & (yc < -1) & (np.abs(zc) < 1)] = C("gold", 5)
    # its strand and a small bone cross pendant, lying on the shoulder
    g.a[(X >= 10) & (X < 13) & (Y == c - 3) & (Z == c - 1)] = C("purple", 4)
    g.a[(X == 11) & (Y == c - 3) & (Z == c - 1)] = C("bone", 7)
    # (the pendant cross is on the shoulder cap, see below)
    # the grip collar and the iron shoulder cap
    col = sec(11, 12, 2)
    g.a[col] = C("gray", 3)
    cap = sec(12, 14, 3)
    g.a[cap] = C("gray", 5)
    g.a[cap & (yc > 1.5)] = C("gray", 6)
    g.a[cap & (X == 12)] = C("gray", 3)
    # the flask: a round octagonal body of glowing blessed water
    profile = ((14, 15, 3), (15, 16, 4), (16, 23, 5), (23, 24, 4), (24, 25, 3))
    body = np.zeros(g.shape, dtype=bool)
    for x0, x1, r in profile:
        body |= sec(x0, x1, r)
    ang = np.degrees(np.arctan2(yc, -zc)) % 360  # 0 = front (-z), 90 = top
    octant = ((ang + 22.5) // 45).astype(int) % 8
    for k, sh in enumerate((4, 5, 6, 5, 3, 2, 2, 3)):
        g.a[body & (octant == k)] = C("cyan", sh)
    g.a[body & ((X == 14) | (X == 24))] = C("cyan", 2)  # dark glass rims at both ends
    g.a[body & (octant == 1) & (X >= 17) & (X < 22)] = C("cyan", 7)  # glass highlight
    for bx, by, bz in ((18, c - 3, 1), (20, c - 2, 1), (19, c - 4, 2), (17, c + 3, 10), (21, c - 3, 10)):
        g.a[bx, by, bz] = C("bone", 7) if g.a[bx, by, bz] else 0  # rising bubbles on the glass
    g.a[body & (X == 15) & (yc > 2.5)] = C("bone", 7)  # meniscus glint
    # the iron foot
    foot = sec(25, 26, 3)
    g.a[foot] = C("gray", 3)
    g.a[foot & (ay < 2) & (az < 2)] = C("gray", 4)
    g.a[foot & (yc > 1.5) & ~octo(ay, az, 2)] = C("gray", 6)
    # the cage: two iron straps over the top and the bottom, riveted
    for x0, x1, r in profile:
        for s in (1, -1):
            lo = c + r if s > 0 else c - r - 1
            g.box(x0, lo, c - 1, x1, lo + 1, c + 1, C("gray", 3))
    strap = (g.a == C("gray", 3)) & (ay > 2.5)
    g.a[strap & ((X == 17) | (X == 22))] = C("gray", 6)
    # a big bone-white cross on both faces (the holy cue), dark edged
    for s in (1, -1):
        zf = c + 5 if s > 0 else c - 6
        g.box(16, c - 1, zf, 24, c + 1, zf + 1, C("bone", 7))  # upright
        g.box(20, c - 3, zf, 22, c + 3, zf + 1, C("bone", 7))  # crossbar
        cross = (g.a == C("bone", 7)) & (Z == zf)
        edge = cross & ((X == 16) | (X == 23) | (ay > 2) | (yc < 0) & ~((X >= 20) & (X < 22)))
        g.a[edge] = C("bone", 4)
    # the pendant: a small bone cross hanging from the strand, on the cap
    g.a[(X >= 12) & (X < 15) & (Y == c - 4) & (Z == c - 1)] = C("bone", 7)
    g.a[(X == 13) & (Y == c - 4) & (Z >= c - 2) & (Z < c + 1)] = C("bone", 7)
    return held("holy-water", "Holy Water", g, (6, c, c), {"socket-splash": (20, c, c)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-splash", "manual", size=0.36)])
