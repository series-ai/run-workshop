"""Habitat dome, in the Pirate Nation mecha style.

A faceted white dome of twelve sloped hull panels on steel ribs (true
slopes), on a plated drum with a hazard band and a round steel plinth. A
steel airlock with a steep plated gable roof and a wide blast door sits on
the front. Its function prop is oversized: a giant tilted antenna dish on
the roof that turns on `idle`. Two tall oxygen tanks feed the dome through
copper pipes; crates and a fuel drum sit at the base. Detail (plates,
rivets, windows, stripes, letters) is painted. Faces -Z (the airlock).
"""
import numpy as np

import paint as P
from _pn import coords, gear, glow_window, gore_dome, hazard, last, pipe, plated, prism_y, apothem, text
from pnkit import box, edges, gable_roof, ngon, on_face
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot, turn

W, H, D = 112, 64, 104
CX, CZ = 52, 56  # dome axis
PLINTH, DRUM = 5, 14  # tops of the plinth and the drum
RINGS = [(38, 0), (35, 16), (25, 31), (12, 39)]  # dome panels (d, y above the drum)
TOP = DRUM + RINGS[-1][1]  # the panels end here; the collar caps them
AX0, AX1, AZ0, AZ1 = 38, 66, 8, 30  # airlock walls; the front is z = AZ0
AWALL, ARIDGE = 36, 54


def base() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth = prism_y(g, CX, CZ, apothem(46, 12), 0, PLINTH, "steel", 4)
    P.plates(g, plinth, "steel", 4, size=(12, 5), seed=1)
    P.flat(g, plinth & (Y > PLINTH - 1) & (np.hypot(X - CX, Z - CZ) > 43), "steel", 5)  # lit rim
    drum = prism_y(g, CX, CZ, apothem(39, 12), PLINTH, DRUM, "steel", 4)
    P.plates(g, drum, "steel", 4, size=(9, 9), seed=2)
    hazard(g, drum & (Y > DRUM - 4), period=6)
    # core under the panels: only its seams show between the panels
    for (d0, y0), (d1, y1) in zip(RINGS, RINGS[1:]):
        prism_y(g, CX, CZ, apothem(d1 - 1.5, 12), DRUM + y0, DRUM + y1, "steel", 3)
    collar = prism_y(g, CX, CZ, apothem(15, 12), TOP - 2, TOP + 3, "steel", 4)
    P.plates(g, collar, "steel", 4, size=(8, 5), seed=3)
    P.flat(g, collar & (Y > TOP + 2), "orange", 5)
    hatch = prism_y(g, CX, CZ, apothem(9, 12), TOP + 3, TOP + 5, "steel", 5)
    P.flat(g, hatch & (np.hypot(X - CX, Z - CZ) < 6), "steel", 3)
    return g


def airlock(g: Grid) -> None:
    X, Y, Z = coords(g)
    walls = box(g, AX0, PLINTH, AZ0, AX1, AWALL, AZ1, "steel", 4)
    plated(g, walls, "steel", 4, size=(7, 8), seed=4)
    # thick corner posts (rule F3)
    for x0 in (AX0 - 1, AX1 - 3):
        post = box(g, x0, PLINTH, AZ0 - 1, x0 + 4, AWALL, AZ0 + 3, "steel", 3)
        P.flat(g, post & (np.floor(Y) % 6 == 3) & ((np.floor(X) - x0) % 4 == 1), "steel", 5)
    beam = box(g, AX0 - 2, AWALL - 3, AZ0 - 2, AX1 + 2, AWALL, AZ1, "steel", 3)
    P.plates(g, beam, "steel", 3, size=(8, 3), seed=5)
    roof = gable_roof(g, AX0, AX1, AZ0, AZ1, AWALL, ARIDGE, ramp="steel", base=5, thick=4, overhang=4, trim="steel", gable="bone", ridge="z", seed=6)
    P.plates(g, roof["slabs"], "steel", 5, size=(11, 8), seed=7)
    P.flat(g, roof["slabs"] & ((Z < AZ0 - 2) | (Z > AZ1 + 2)), "steel", 4)  # dark barge boards
    P.flat(g, roof["ridge"], "rust", 4)
    gable = roof["attic"]
    P.mottle(g, gable, "bone", 5, seed=8)
    # wide, short blast door (rule F4)
    dx0, dx1 = 43, 61
    frame = box(g, *on_face("-z", AZ0, dx0 - 3, dx1 + 3, PLINTH, PLINTH + 29, 0, 2), "steel", 3)
    hazard(g, frame, period=4, a=("orange", 5), b=("steel", 3))
    leaf = box(g, *on_face("-z", AZ0 - 2, dx0, dx1, PLINTH, PLINTH + 26, 0, 1), "steel", 5)
    P.plates(g, leaf, "steel", 5, size=(9, 13), seed=9)
    P.flat(g, leaf & (np.abs(X - (dx0 + dx1) / 2) < 0.6), "steel", 3)  # split line
    win = leaf & (Y > PLINTH + 17) & (Y < PLINTH + 22) & (np.abs(X - (dx0 + dx1) / 2) > 2) & (np.abs(X - (dx0 + dx1) / 2) < 7)
    P.flat(g, win, "cyan", 6)
    P.flat(g, leaf & (Y > PLINTH + 10) & (Y < PLINTH + 12) & (np.abs(X - (dx0 + dx1) / 2) < 5), "gold", 6)  # handle bar
    # a light over the door
    lamp = box(g, *on_face("-z", AZ0 - 2, 50, 54, PLINTH + 29, PLINTH + 32, 0, 3), "orange", 6)
    P.flat(g, lamp & (Y < PLINTH + 30), "steel", 3)
    # doorstep
    step = box(g, dx0 - 4, 0, AZ0 - 8, dx1 + 4, PLINTH, AZ0, "steel", 3)
    plated(g, step, "steel", 3, size=(6, 5), seed=10)
    hazard(g, step & (Z < AZ0 - 7), period=4)
    # side windows in copper frames (PN mecha)
    w = box(g, *on_face("-x", AX0, AZ0 + 7, AZ0 + 17, PLINTH + 12, PLINTH + 24, 0, 1), "cyan", 6)
    glow_window(g, w)
    # a big copper gear on the visible side wall (PN mecha)
    gear(g, "x", PLINTH + 18, (AZ0 + AZ1) / 2, 8.5, AX1, AX1 + 3, teeth=9, depth=2.5, ramp="rust", base=4)
    box(g, AX1 + 3, PLINTH + 16, (AZ0 + AZ1) // 2 - 2, AX1 + 5, PLINTH + 20, (AZ0 + AZ1) // 2 + 2, "gold", 5)
    # sign board in the gable: HAB-1
    sign = box(g, *on_face("-z", AZ0, 42, 63, AWALL + 2, AWALL + 9, 0, 1), "orange", 5)
    P.flat(g, edges(sign), "orange", 3)
    text(g, "-z", AZ0 - 1, 61, AWALL + 3, "HAB-1", "bone", 7)


def tanks(g: Grid) -> None:
    """Two tall oxygen tanks on the visible +X side, piped into the drum."""
    X, Y, Z = coords(g)
    for cx, cz, h, r, top in ((96, 42, 38, 8, 52), (93, 66, 30, 7, 46)):
        body = prism_y(g, cx, cz, apothem(r, 8), 0, h, "orange", 5, n=8)
        P.mottle(g, body, "orange", 5, seed=cx)
        P.flat(g, body & (Y > 4) & (Y < 8), "bone", 6)  # white bands
        P.flat(g, body & (Y > h - 8) & (Y < h - 4), "bone", 6)
        P.flat(g, body & (np.abs(np.degrees(np.arctan2(Z - cz, X - cx)) % 45 - 22.5) < 3), "orange", 4)  # facet seams
        P.flat(g, body & (Y < 2.5), "steel", 4)  # foot ring
        cap = prism_y(g, cx, cz, apothem(r - 2, 8), h, h + 3, "rust", 4, n=8)
        P.flat(g, cap & (Y > h + 2), "rust", 5)
        # a tall copper pipe from the tank top, over and down into the dome
        pipe(g, [(cx, h + 3, cz), (cx, top, cz), (CX + 31, top, cz), (CX + 31, DRUM + 16, cz)], s=5, ramp="rust", base=4)
    text(g, "+x", 104, 45, 16, "O2", "bone", 7, scale=1)


def props(g: Grid) -> None:
    X, Y, Z = coords(g)
    for x0, y0, z0, s, seed in ((10, 0, 16, 13, 11), (12, 13, 18, 9, 12), (24, 0, 10, 10, 13)):
        c = box(g, x0, y0, z0, x0 + s, y0 + s, z0 + s, "orange", 5)
        P.mottle(g, c, "orange", 5, seed=seed)
        P.flat(g, edges(c), "steel", 4)
        P.flat(g, c & (np.abs(Y - (y0 + s / 2)) < 1) & (np.abs(X - (x0 + s / 2)) < 2.5), "cyan", 6)
    # fuel drum by the airlock
    g.prism("y", ngon(72, 12, 5.5, 8), 0, 13, C("orange", 5))
    drum = last(g)
    P.flat(g, drum & (Y > 3) & (Y < 5), "steel", 3)
    P.flat(g, drum & (Y > 9) & (Y < 11), "steel", 3)
    P.flat(g, drum & (Y > 12), "orange", 3)


def dish() -> Grid:
    """The giant antenna dish (rule K1): a 12-sided white bowl painted with
    rings, a steel back, a copper feed on two diagonal struts."""
    g = Grid(50, 24, 50)
    c = 25
    back = prism_y(g, c, c, 12, 0, 3, "steel", 4)
    P.plates(g, back, "steel", 4, size=(6, 3), seed=20)
    bowl = prism_y(g, c, c, 23, 3, 6, "bone", 6)
    X, Y, Z = coords(g)
    rr = np.hypot(X - c, Z - c)
    P.flat(g, bowl & (np.floor(rr) % 6 == 0), "bone", 4)  # rings read as a curved bowl
    P.flat(g, bowl & (rr > 20.5), "orange", 5)  # hazard-orange rim
    P.flat(g, bowl & (rr > 20.5) & (np.floor(np.degrees(np.arctan2(Z - c, X - c)) / 15) % 2 == 0), "orange", 4)
    P.flat(g, bowl & (Y > 5) & (rr < 3), "steel", 3)
    box(g, c - 1, 6, c - 1, c + 1, 16, c + 1, "steel", 5)  # feed mast
    # two struts from the rim to the feed (true diagonals)
    for z0, z1 in ((c - 19, c - 2), (c + 19, c + 2)):
        a, b = (z0, z0 + 2.5) if z0 < z1 else (z0 - 2.5, z0)
        g.prism("x", [(5.5, a), (5.5, b), (17.5, z1 + (1 if z0 < z1 else -1)), (17.5, z1 - (1 if z0 < z1 else -1))], c - 1, c + 1, C("steel", 5))
    head = box(g, c - 3, 16, c - 3, c + 3, 21, c + 3, "rust", 4)
    P.flat(g, edges(head), "rust", 3)
    box(g, c - 1, 21, c - 1, c + 1, 23, c + 1, "cyan", 7)
    return g


def mount() -> Grid:
    """Turntable on the mast: a 12-sided copper ring with a yoke."""
    g = Grid(16, 10, 16)
    ring = prism_y(g, 8, 8, 7.5, 0, 3, "rust", 4)
    X, Y, Z = coords(g)
    P.flat(g, ring & (np.floor(np.degrees(np.arctan2(Z - 8, X - 8)) / 30) % 2 == 0), "rust", 5)
    box(g, 6, 3, 5, 10, 9, 11, "steel", 4)
    return g


def build() -> Asset:
    g = base()
    airlock(g)
    tanks(g)
    props(g)
    # mast on the collar
    mast = box(g, CX - 2, TOP + 5, CZ - 2, CX + 2, TOP + 14, CZ + 2, "steel", 4)
    P.flat(g, mast & (np.floor(coords(g)[1]) % 4 == 0), "orange", 5)
    pivot = bounds_pivot(g)
    root = Part("hab-dome", g, pivot=pivot)
    gore_dome(root, "panel", (CX - pivot[0], DRUM, CZ - pivot[2]), RINGS, n=12, skin="bone", rib="steel", rib_w=6.0, paint_gore=paint_gore)
    turntable = root.add(Part("turntable", mount(), pivot=(8.0, 0.0, 8.0), at=(CX - pivot[0], TOP + 14, CZ - pivot[2])))
    turntable.add(Part("dish", dish(), pivot=(25.0, 0.0, 25.0), at=(0.0, 7.0, 0.0), rot=(-38.0, 0.0, 8.0)))
    return Asset(
        id="space-buildings-hab-dome", pack="space", category="buildings", name="Habitat Dome", root=root,
        clips=[Clip("idle", {"turntable": {"rot": turn(12.0, "y", 30.0)}})],
    )


def paint_gore(g: Grid, k: int, segs) -> None:
    """White hull panels: plate seams, rivets, an orange skirt, teal windows."""
    for i, (m, s, u, length, width) in enumerate(segs):
        half = width / 2
        P.mottle(g, m, "bone", 5, cell=3, seed=30 + k)
        seam = (s < 1.0) | (s > length - 1.0) | (np.abs(u) > half - 1.0)
        rivet = (np.abs(np.abs(u) - (half - 2.5)) < 0.6) & ((np.abs(s - 2.5) < 0.6) | (np.abs(s - (length - 2.5)) < 0.6))
        if i == 0:
            P.flat(g, m & (s < 4.5), "orange", 5)
            P.flat(g, m & (s < 4.5) & ((np.floor(u + s) // 3) % 2 == 0), "orange", 4)
            if True:
                win = m & (s > 7) & (s < length - 3) & (np.abs(u) < half - 4)
                P.flat(g, win, "cyan", 6)
                P.flat(g, win & (s > length - 5.5), "cyan", 7)
                frame = m & (s > 6) & (s < length - 2) & (np.abs(u) < half - 3) & ~win
                P.flat(g, frame, "rust", 4)
        elif i == 1:
            P.flat(g, m & (np.abs(s - length / 2) < 0.5), "bone", 3)
            if k % 3 == 1:
                P.flat(g, m & (np.abs(u) < 1.5) & (s > 2) & (s < length - 2), "orange", 5)
        P.flat(g, m & seam, "bone", 3)
        P.flat(g, m & rivet, "steel", 5)
