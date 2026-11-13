"""Funeral hearse, in the Pirate Nation haunted style.

A glass-sided hearse in purple lacquer with gold trim: a coffin on a bier
painted behind pale glass with magenta curtains, a curved roof (true
slopes) with tall feather plumes on its corners, a coachman's box and two
silver lamps glowing toxic green. Big octagonal spoked wheels (the rear
pair oversized, rule F4). It is drawn by a chunky caricature skeleton
horse: bone legs and ribs, a long skull with glowing eyes and a magenta
plume, under a purple gold-trimmed blanket (F4, F6). `move`: the wheels
roll, the horse trots and nods; `idle`: the horse breathes, nods and
paws the ground. Faces -Z (the horse leads).
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coffin_poly, coords, parts
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket, _inside_polygon, turn

G = (60, 92, 112)
CX = 30.0
BX0, BX1, BZ0, BZ1 = CX - 14, CX + 14, 48, 102  # hearse body
BY0, BY1 = 22, 58
FZ, FR = 58.0, 10.0
RZ, RR = 92.0, 13.0
WX = {"l": (CX - 19, CX - 15), "r": (CX + 15, CX + 19)}
SHOULDER, HIP = 16.0, 34.0  # horse leg z
LEG_TOP = 28.0
NECK = (CX, 38.0, 14.0)
LAMP = (CX - 17.0, 46.0, 49.0)


def hearse() -> Grid:
    g = Grid(*G)
    X, Y, Z = coords(g)
    # running gear
    for az, r in ((FZ, FR), (RZ, RR)):
        box(g, CX - 15, r - 1.5, az - 1.5, CX + 15, r + 1.5, az + 1.5, "purple", 2)
        box(g, CX - 8, r + 1.5, az - 3, CX + 8, BY0, az + 3, "purple", 3)
    # the body: purple lacquer, gold trim, pale glass sides
    body = box(g, BX0, BY0, BZ0, BX1, BY1, BZ1, "purple", 3)
    P.mottle(g, body, "purple", 3, cell=4, seed=1)
    side = body & ((X < BX0 + 1) | (X > BX1 - 1))
    glass = side & (Y > BY0 + 6) & (Y < BY1 - 6) & (Z > BZ0 + 4) & (Z < BZ1 - 4)
    P.flat(g, glass, "purple", 6)
    P.flat(g, glass & (((Z - Y).astype(int) % 11) < 2), "purple", 7)  # a glint
    cof = glass & _inside_polygon(Z, Y, [(v, u) for u, v in coffin_poly(BY0 + 13, BZ0 + 10, 11, 34)])
    P.flat(g, cof, "wood", 6)
    P.flat(g, cof & (np.abs(Y - (BY0 + 13)) < 0.6) & (Z > BZ0 + 14) & (Z < BZ0 + 38), "gold", 5)
    bier = glass & (Y < BY0 + 8)
    P.flat(g, bier, "magenta", 3)
    for z0 in (BZ0 + 4, BZ1 - 9):
        cur = glass & (Z >= z0) & (Z < z0 + 5) & (Y > BY0 + 9)
        P.flat(g, cur, "magenta", 5)
        P.flat(g, cur & (Z.astype(int) % 2 == 0), "magenta", 4)
    trim = body & ((Y < BY0 + 2) | (Y > BY1 - 2) | ((Z < BZ0 + 2) | (Z > BZ1 - 2)) & side)
    P.flat(g, trim, "gold", 4)
    P.flat(g, side & (np.abs(Z - (BZ0 + BZ1) / 2) < 1) & (Y > BY0 + 6) & (Y < BY1 - 6), "gold", 4)
    back = body & (Z > BZ1 - 1)
    P.flat(g, back & (Y > BY0 + 6) & (Y < BY1 - 6) & (np.abs(X - CX) < 9), "purple", 6)
    # corner posts with silver caps
    for x in (BX0 - 1, BX1 - 2):
        for z in (BZ0 - 1, BZ1 - 2):
            box(g, x, BY0, z, x + 3, BY1 + 2, z + 3, "purple", 2)
            box(g, x - 0.5, BY1 + 2, z - 0.5, x + 3.5, BY1 + 4, z + 3.5, "gray", 6)
    # the curved roof with a gold band and four tall plumes
    start = len(g.solids)
    g.prism("z", S.arch(CX, BY1 + 2, BX1 - CX + 1, BY1 + 12, bulge=0.8), BZ0 - 2, BZ1 + 2, C("purple", 4))
    roof = S.last(g)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=2))
    P.flat(g, roof & (Y < BY1 + 4), "gold", 5)
    P.flat(g, roof & ((Z < BZ0 - 1) | (Z > BZ1 + 1)) & (Y > BY1 + 4), "purple", 3)
    for z in range(BZ0 + 6, BZ1 - 4, 8):  # gold finials along the ridge
        box(g, CX - 1.5, BY1 + 11, z, CX + 1.5, BY1 + 14, z + 3, "gold", 5)
    for x in (BX0, BX1):
        for z in (BZ0, BZ1):
            S.cone(g, "y", x, z, 3, BY1 + 6, BY1 + 22, "purple", 2, n=4)
            plume = S.last(g)
            P.flat(g, plume & (Y > BY1 + 14), "magenta", 4)
            box(g, x - 1.5, BY1 + 4, z - 1.5, x + 1.5, BY1 + 7, z + 1.5, "gold", 5)
    # the coachman's box and a sloped footboard
    seat = box(g, CX - 11, BY1 - 16, BZ0 - 9, CX + 11, BY1 - 10, BZ0, "purple", 3)
    P.outline(g, seat, "gold", 4, normal="y")
    cush = box(g, CX - 10, BY1 - 10, BZ0 - 8, CX + 10, BY1 - 8, BZ0 - 1, "magenta", 4)
    g.prism("x", [(BY0, BZ0), (BY0 + 3, BZ0), (BY1 - 17, BZ0 - 9), (BY1 - 20, BZ0 - 9)], CX - 11, CX + 11, C("purple", 3))
    # silver lamps glowing toxic green at the front corners
    for x in (LAMP[0], 2 * CX - LAMP[0]):
        box(g, x - 0.5, LAMP[1] - 6, BZ0 + 1, x + 1.5, LAMP[1] - 4, BZ0 + 3, "gray", 6)
        lamp = box(g, x - 2, LAMP[1] - 4, LAMP[2] - 2, x + 2, LAMP[1] + 3, LAMP[2] + 2, "toxic", 6)
        P.flat(g, edges(lamp), "gray", 6)
        g.prism("y", [(x - 2.5, LAMP[2] - 2.5), (x + 2.5, LAMP[2] - 2.5), (x + 2.5, LAMP[2] + 2.5), (x - 2.5, LAMP[2] + 2.5)], LAMP[1] + 3, LAMP[1] + 7, C("gray", 6), top=[(x, LAMP[2])] * 4)
    return g


def wheel(side: str, az: float, r: float) -> Grid:
    g = Grid(*G)
    x0, x1 = WX[side]
    S.wheel(g, "x", az, 0, r, x0, x1, n=8, spokes=8 if r > 11 else 6, gaps=True, tyre=("gray", 4), rim=("purple", 2), spoke=("gold", 4), hub=("gray", 6))
    return g


def shafts() -> Grid:
    g = Grid(*G)
    for x in (CX - 10, CX + 8):
        S.bar(g, "x", (BY0 + 2, BZ0 + 2), (30, 12), 2.4, x, x + 2, "purple", 3)
        box(g, x - 0.5, 29, 11, x + 2.5, 32, 14, "gold", 4)
    return g


def horse() -> Grid:
    """The skeleton horse body: bone ribs under a purple blanket, a spine,
    a pelvis and a bony tail."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    g.prism("x", [(26, 14), (25, 36), (33, 39), (40, 35), (41, 17), (35, 11)], CX - 6, CX + 6, C("bone", 6))
    ribs = S.last(g)
    gaps = ribs & ((np.abs(X - CX) > 5) | (Y < 27)) & ((Z.astype(int) % 4) == 0) & (Z > 16) & (Z < 33)
    P.flat(g, gaps, "purple", 2)
    P.flat(g, ribs & (Y > 39), "bone", 7)
    blanket = box(g, CX - 7, 32, 19, CX + 7, 42, 31, "purple", 4)
    P.mottle(g, blanket, "purple", 4, cell=3, seed=3)
    P.flat(g, blanket & ((Y < 33) | (Z < 20) | (Z > 30)), "gold", 5)
    for k in range(3):
        box(g, CX - 1.5, 41, 33 + k * 2.5, CX + 1.5, 43, 35 + k * 2.5, "bone", 7)
    for a, b in (((37, 38), (32, 42)), ((32, 42), (26, 43))):
        g.prism("x", S.quad(a, b, 1.3, 1.0), CX - 1, CX + 1, C("bone", 6))
    return g


def neck() -> Grid:
    """A bony neck and a long horse skull with glowing eyes and a plume."""
    g = Grid(*G)
    X, Y, Z = coords(g)
    g.prism("x", S.quad((36, 16), (50, 9), 2.6, 2.2), CX - 2.5, CX + 2.5, C("bone", 6))
    nk = S.last(g)
    P.flat(g, nk & ((Y.astype(int) % 3) == 0), "bone", 4)
    g.prism("x", [(50, 14), (56, 12), (57, 6), (52, 0.5), (46, 0.5), (45, 5), (47, 12)], CX - 3.5, CX + 3.5, C("bone", 6))
    skull = S.last(g)
    P.flat(g, skull & (Y > 55), "bone", 7)
    P.flat(g, skull & (Z < 1.5) & (Y > 48) & (Y < 51), "purple", 2)  # nostrils
    P.flat(g, skull & (Y > 46) & (Y < 47.5) & (Z < 6), "purple", 2)  # mouth line
    eye = skull & (np.abs(Y - 53) < 1.6) & (np.abs(Z - 8) < 1.6) & (np.abs(X - CX) > 2.5)
    P.flat(g, eye, "purple", 1)
    P.flat(g, eye & (np.abs(Y - 53) < 0.6) & (np.abs(Z - 8) < 0.6), "toxic", 7)
    for s in (-1, 1):
        g.prism("x", [(56, 11), (56, 13.5), (61, 13)], CX + s * 2 - 1, CX + s * 2 + 1, C("bone", 6))  # ears
    S.cone(g, "y", CX, 12.5, 2.5, 57, 70, "magenta", 5, n=4)
    P.flat(g, S.last(g) & (Y > 64), "magenta", 6)
    box(g, CX - 3.8, 50, 3, CX + 3.8, 51.5, 12, "purple", 4)  # a bridle strap
    return g


def leg(side: int, z0: float) -> Grid:
    g = Grid(*G)
    x = CX + side * 4.5
    for a, b, r in (((LEG_TOP, z0), (14, z0 + 2), 1.8), ((14, z0 + 2), (3, z0), 1.5)):
        g.prism("x", S.quad(a, b, r, r * 0.85), x - 1.5, x + 1.5, C("bone", 6))
    box(g, x - 2, 12.5, z0, x + 2, 16, z0 + 4, "bone", 7)
    box(g, x - 2, 0, z0 - 2.5, x + 2, 3, z0 + 2, "purple", 2)
    return g


def build() -> Asset:
    grids = {"hearse": hearse(), "shafts": shafts(), "horse": horse(), "neck": neck()}
    joints = [("hearse", None, (CX, RR, RZ)), ("shafts", "hearse", (CX, BY0 + 2, BZ0 + 2)), ("horse", "hearse", (CX, 30.0, 26.0)), ("neck", "horse", NECK)]
    legs = {"leg-fl": (-1, SHOULDER), "leg-fr": (1, SHOULDER), "leg-bl": (-1, HIP), "leg-br": (1, HIP)}
    for name, (s, z0) in legs.items():
        grids[name] = leg(s, z0)
        joints.append((name, "horse", (CX + s * 4.5, LEG_TOP, z0)))
    wheels = {}
    for side in ("l", "r"):
        for end, az, r in (("f", FZ, FR), ("b", RZ, RR)):
            name = f"wheel-{side}{end}"
            grids[name] = wheel(side, az, r)
            joints.append((name, "hearse", ((WX[side][0] + WX[side][1]) / 2, r, az)))
            wheels[name] = {"rot": turn(1.2, "x", -300)}
    root = parts(grids, joints)

    def trot(phase):
        k = [(0.0, 22.0), (0.3, 0.0), (0.6, -22.0), (0.9, 0.0), (1.2, 22.0)]
        return {"rot": [(t, (a if phase == 0 else -a, 0.0, 0.0)) for t, a in k]}

    move = dict(wheels)
    move.update({"leg-fl": trot(0), "leg-br": trot(0), "leg-fr": trot(1), "leg-bl": trot(1)})
    move["horse"] = {"loc": [(t, (0.0, y, 0.0)) for t, y in ((0, 0.0), (0.3, 1.5), (0.6, 0.0), (0.9, 1.5), (1.2, 0.0))]}
    move["neck"] = {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (0.3, 8.0), (0.6, 0.0), (0.9, 8.0), (1.2, 0.0))]}
    idle = {
        "horse": {"scale": [(t, (1.0, s, 1.0)) for t, s in ((0, 1.0), (1.0, 1.03), (2.0, 1.0), (3.0, 1.03), (4.0, 1.0))]},
        "neck": {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (1.2, 12.0), (1.8, 10.0), (2.4, 0.0), (4.0, 0.0))]},
        "leg-fr": {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (2.6, 0.0), (2.9, -30.0), (3.2, 0.0), (3.5, -30.0), (3.8, 0.0), (4.0, 0.0))]},
    }
    rel = lambda p: (p[0] - CX, p[1] - RR, p[2] - RZ)  # noqa: E731
    return Asset(
        id="monster-vehicles-hearse-carriage", pack="monster", category="vehicles", name="Funeral Hearse", root=root,
        clips=[Clip("move", move), Clip("idle", idle)],
        sockets=[Socket("socket-lamp", at=rel(LAMP), parent="hearse"), Socket("socket-horse", at=rel((CX, 44.0, 26.0)), parent="horse")],
        pfx=[{"effectId": "rvx-monster-ghost-wisps", "socket": "socket-horse", "trigger": "idle", "size": 40}],
    )
