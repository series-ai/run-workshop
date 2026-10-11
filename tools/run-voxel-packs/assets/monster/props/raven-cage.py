"""Raven cage, in the Pirate Nation haunted style.

One iconic shape (rule K3): a rusted iron birdcage standing on a
chamfered stone plinth. A flared pan holds straw, a bone and a dropped
feather; eight thick bars with two hoops rise to a faceted dome (true
slopes) and the little door hangs open on one hinge (rule F5). A caught
soul burns toxic green between the bars and lights them from inside
(rule C3). A fat purple raven with a gold beak and one toxic eye perches
on the dome, so the silhouette reads at 128 px (rule F6).

Paint uses soft ramps (rule S3): each material has a few close tones, and
the contrast sits at edges, seams and hoops, not in a speckle.

socket-wisp sits in the middle of the cage, on the soul. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import crow
from _kit import pfx, single
from _props import idx, union
from pnkit import box
from voxgrid import C, Grid, Socket

W, H, D = 28, 40, 28
CX = CZ = 14.0
PLINTH, TRAY, BARS, DOME = 5, 8, 24, 29  # tops of the plinth, pan, bars and dome
CR = 7.5  # the bar circle radius
WISP = (CX, 15.0, CZ)


def plinth(g: Grid) -> None:
    """A chamfered stone plinth with a light cap and moss at its foot."""
    from pnpaint import blotch

    _X, Y, _Z = idx(g)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, 10.0, 8), 0, PLINTH - 1, C("gray", 5), top=S.flat_ngon(CX, CZ, 9.0, 8))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), cracks=0.0, frame=fr, seed=1))
    cap = S.disc(g, "y", CX, CZ, 10.5, PLINTH - 1, PLINTH + 1, "gray", 6)
    P.flat(g, cap, "gray", 6)
    P.outline(g, cap, "gray", 4, normal="y")
    P.flat(g, cap & (Y == PLINTH), "gray", 6)
    blotch(g, union(g, start) & (Y < 2), "moss", 4, cell=3, chance=0.3, seed=4)


def pan(g: Grid) -> None:
    """The flared iron pan with straw bedding, a bone and a feather."""
    X, Y, Z = idx(g)
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, CR - 1.0, 8), PLINTH + 1, TRAY, C("gray", 4), top=S.flat_ngon(CX, CZ, CR + 1.2, 8))
    tray = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "gray", 4, size=(8, 4), rivets=False, frame=fr, seed=5))
    P.flat(g, tray & (Y < PLINTH + 2), "gray", 3)
    P.flat(g, tray & (Y == TRAY - 1), "rust", 3)  # a rusted lip
    bed = S.disc(g, "y", CX, CZ, CR + 0.6, TRAY - 1, TRAY, "sand", 4)
    top = bed & (Y == TRAY - 1)
    P.flat(g, top, "sand", 3)
    P.flat(g, top & (((X + Z * 2) % 4) == 0), "sand", 4)  # straw laid in one direction
    P.flat(g, top & (np.abs(X + 0.5 - (CX - 2.0)) < 2.8) & (np.abs(Z + 0.5 - (CZ + 2.0)) < 0.7), "bone", 7)
    P.flat(g, top & (np.abs(X + 0.5 - (CX + 3.0)) < 0.6) & (np.abs(Z + 0.5 - (CZ - 2.0)) < 2.4), "purple", 3)


def cage(g: Grid) -> None:
    """Eight thick bars with two hoops, lit from inside by the caught soul,
    a faceted dome and a door hanging open on one hinge."""
    X, Y, Z = idx(g)
    pts = S.flat_ngon(CX, CZ, CR, 8)
    bars = np.zeros(g.shape, dtype=bool)
    for bx, bz in pts:
        bars |= box(g, bx - 1.2, TRAY - 1, bz - 1.2, bx + 1.2, BARS, bz + 1.2, "gray", 4)
    for ry in (TRAY + 5, BARS - 5):  # two hoops round the bars
        for k in range(8):
            bars |= S.bar(g, "y", pts[k], pts[(k + 1) % 8], 1.6, ry, ry + 2, "gray", 5)
    # Dark iron bars with a lit outer edge; the hoops carry the rivets.
    P.flat(g, bars, "gray", 3)
    rr = np.hypot(X + 0.5 - CX, Z + 0.5 - CZ)
    P.flat(g, bars & (rr > CR + 0.6), "gray", 4)
    hoop = bars & ((np.abs(Y - (TRAY + 5.5)) < 1.1) | (np.abs(Y - (BARS - 4.5)) < 1.1))
    P.flat(g, hoop, "gray", 4)
    P.flat(g, hoop & (Y == TRAY + 5), "gray", 2)
    P.flat(g, hoop & (Y == BARS - 5) & (((X + Z) % 3) == 0), "gray", 6)
    P.flat(g, bars & ~hoop & (Y < TRAY + 2), "rust", 3)  # rust where the bars meet the pan
    # the inner faces catch the toxic light of the soul
    inner = bars & (np.hypot(X + 0.5 - CX, Z + 0.5 - CZ) < CR - 0.4) & (Y > TRAY) & (Y < BARS - 2)
    P.flat(g, inner, "gray", 6)
    P.flat(g, inner & (np.abs(Y - WISP[1]) < 5), "toxic", 3)
    # the caught soul: a faceted toxic orb floating in the middle
    orb = S.dome(g, CX, CZ, WISP[1] - 3, 3.4, h=6.0, n=8, rings=2, ramp="toxic", base=5,
                 painter=lambda gg, mm, fr: P.flat(gg, mm, "toxic", 5), ribs=("toxic", 4))
    P.flat(g, orb & (Y > WISP[1]), "toxic", 6)
    P.flat(g, orb & (Y > WISP[1] + 1), "toxic", 7)
    S.cone(g, "y", CX, CZ, 3.4, WISP[1] - 6, WISP[1] - 3, "toxic", 4, n=8, r_top=1.0, tip="lo")
    P.flat(g, S.last(g), "toxic", 4)
    # the dome: two stacked frustums, dark iron with a lit crown
    start = len(g.solids)
    S.cone(g, "y", CX, CZ, CR + 1.4, BARS - 1, BARS + 3, "gray", 4, n=8, r_top=CR - 1.5)
    S.cone(g, "y", CX, CZ, CR - 1.5, BARS + 3, DOME, "gray", 4, n=8, r_top=1.8)
    dome = union(g, start)
    # A calm iron dome: one tone per band, dark ribs on the facet seams,
    # a rivet row above the rusted eave line.
    P.flat(g, dome, "gray", 4)
    P.flat(g, dome & (Y >= BARS + 3), "gray", 5)
    P.flat(g, dome & (Y > DOME - 2), "gray", 6)
    P.flat(g, dome & S.seams(g, g.solids[start:], 0.8), "gray", 2)
    P.flat(g, dome & (Y == BARS - 1), "rust", 3)
    P.flat(g, dome & (Y == BARS) & (((X + Z) % 3) == 0), "gray", 6)
    # the little door, swung open on one hinge toward -z
    door = S.bar(g, "y", (CX - 1.0, CZ - CR + 0.5), (CX - 5.5, CZ - CR - 3.5), 1.8, TRAY + 2, BARS - 4, "gray", 5)
    P.flat(g, door, "gray", 5)
    P.flat(g, door & ((Y == TRAY + 2) | (Y == BARS - 5)), "gray", 3)
    for hy in (TRAY + 3, BARS - 6):  # the hinge straps on the near bar
        P.flat(g, (g.a > 0) & (np.abs(Y - hy) < 1.1) & (np.hypot(X + 0.5 - (CX - 1.0), Z + 0.5 - (CZ - CR)) < 2.6), "gray", 6)


def build():
    g = Grid(W, H, D)
    plinth(g)
    pan(g)
    cage(g)
    X, Y, Z = idx(g)
    # the raven perches on the crown, facing -x so its beak reads in profile
    rx, ry = CX + 3.0, DOME - 1
    crow(g, rx, ry, CZ, facing=-1, ramp="purple", base=3)
    bird = (g.a > 0) & (Y >= ry) & (np.abs(Z + 0.5 - CZ) < 2.5)
    P.flat(g, bird & (np.abs(X + 0.5 - (rx - 2.0)) < 0.7) & (np.abs(Y - (ry + 6)) < 0.7), "toxic", 7)  # the eye
    P.flat(g, bird & (Y > ry + 6) & (X > rx - 3) & (X < rx + 2), "purple", 3)  # a lit crown
    # Feathers: a lighter breast, dark wing rows and a dark tail tip.
    body = bird & ~np.isin(g.a, [C("gold", k) for k in range(8)]) & ~np.isin(g.a, [C("toxic", k) for k in range(8)])
    P.flat(g, body & (X < rx + 1) & (Y < ry + 5) & (Y > ry + 1), "purple", 4)
    P.flat(g, body & (X >= rx + 1) & (Y < ry + 6) & ((Y % 2) == 0), "purple", 1)
    P.flat(g, body & (X > rx + 5), "purple", 1)
    return single("raven-cage", "props", "Raven Cage", g,
                  sockets=[Socket("socket-wisp", at=(WISP[0] - W / 2, WISP[1], WISP[2] - D / 2))],
                  pfx=[pfx("rvx-monster-ghost-wisps", "socket-wisp", "idle", size=16)])
