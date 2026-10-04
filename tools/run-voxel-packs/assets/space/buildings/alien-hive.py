"""Alien hive, in the Pirate Nation mecha style (the space pack's alien motif).

A xeno hive held in a research containment station. A twelve-sided steel
plinth with a hazard-striped rim carries a white-hull containment drum
with dark corner posts, a hazard band, a copper lip and glowing teal
windows. Out of the drum swells the hive itself: a violet resin pod
(stacked 12-sided frustums, true slopes) in clean colour fields, caged by
steel straps and two steel hoops, with glowing cyan egg sacs between the
straps. A steel clamp collar grips its leaning neck, and the function
prop sits on top, oversized: a glowing cyan heart bulb that pulses on
`idle` and puffs spores (socket-spores). A plated lab airlock with a
steep steel gable roof, a blast door and a HIVE sign stands at the front.
Two copper tesla containment pylons of different heights with cyan orbs
flank the hive and pipe into the drum; crates, drums and beacons sit on
the plinth. Detail is painted. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import beacon, blast_door, coords, corner_posts, crate, facet_paint, fuel_drum, hull_on, plates_on, sign, steel_box, steel_roof, window
from pnkit import box, edges
from pnshapes import _owners
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 136, 104, 136
CX, CZ = 68.0, 68.0
N = 12
PL = 5            # plinth top
RING_R, RING_Y = 44, 30   # containment drum radius and top
# the pod: (y, flat radius, centre shift x, centre shift z), bottom to top
POD = [(28, 41, 0, 0), (40, 42, 0, 0), (54, 36, 1, 1), (66, 27, 2, 1), (76, 17, 3, 2), (84, 11, 4, 2)]
TOP = (CX + 4, 88, CZ + 2)  # crown (x, y, z): the heart sits here
FRONT = CZ - RING_R        # the front flat of the drum
AX0, AX1, AZ0 = int(CX) - 15, int(CX) + 15, 10  # airlock walls; its front is z = AZ0
AWALL, ARIDGE = 34, 52


def ring(r: float, dx: float = 0.0, dz: float = 0.0):
    return S.flat_ngon(CX + dx, CZ + dz, r, N)


def shade_facets(g: Grid, solids, ramp: str, base: int, seam: int | None = 2, width: float = 0.85) -> np.ndarray:
    """Clean colour fields: one shade per facet by the way it faces, and a
    dark frame on the facet edges (rule S4). No per-voxel noise."""
    idx, owner, _best, second, normals = _owners(g, solids)
    m = np.zeros(g.shape, dtype=bool)
    m[idx] = True
    shades = np.array([base + (1 if n[1] > 0.55 else (-1 if n[1] < -0.35 else 0)) for n in normals])
    g.a[idx] = (C(ramp, 0) + np.clip(shades[owner], 1, 7)).astype(np.uint8)
    if seam is not None:
        edge = np.zeros(g.shape, dtype=bool)
        sel = second > -width
        edge[tuple(i[sel] for i in idx)] = True
        P.flat(g, edge, ramp, max(1, base - seam))
    return m


def sector(g: Grid, dx=0.0, dz=0.0):
    """Facet index round the axis (0 = the facet facing -Z) and position across it."""
    X, Y, Z = coords(g)
    a = (np.arctan2(Z - CZ - dz, X - CX - dx) + math.pi / 2 + math.pi / N) % (2 * math.pi)
    f = a / (2 * math.pi) * N
    return np.floor(f).astype(int) % N, f % 1


# ------------------------------------------------------------------ base
def plinth(g: Grid) -> None:
    X, Y, Z = coords(g)
    pl = S.disc(g, "y", CX, CZ, 62, 0, PL, "steel", 4, n=N)
    facet_paint(g, [g.solids[-1]], plates_on("steel", 4, size=(12, 8), seed=1))
    d = S.ngon_radius(g, "y", CX, CZ, N)
    rim = pl & (Y > PL - 1) & (d > 58)
    P.flat(g, rim, "orange", 4)
    P.flat(g, rim & ((np.floor(X + Z) // 3) % 2 == 0), "steel", 2)
    P.flat(g, pl & (Y < 1), "steel", 2)
    # front steps up to the airlock
    st = box(g, AX0 - 2, 0, AZ0 - 9, AX1 + 2, PL - 2, AZ0 - 4, "steel", 3)
    P.flat(g, edges(st), "steel", 2)


def drum(g: Grid) -> None:
    """The white-hull containment drum with posts, bands and windows."""
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    S.disc(g, "y", CX, CZ, RING_R, PL, RING_Y, "bone", 5, n=N)
    facet_paint(g, g.solids[n0:], hull_on("bone", 5, size=(10, 9), seed=2))
    m = g.solids[n0].mask(g.shape)
    k, f = sector(g)
    P.flat(g, m & (Y < PL + 3), "steel", 3)                       # steel foot band
    hz = m & (Y >= PL + 3) & (Y < PL + 6)
    P.flat(g, hz, "orange", 4)                                    # hazard band
    P.flat(g, hz & ((np.floor(X + Z + Y) // 3) % 2 == 0), "steel", 2)
    P.flat(g, m & ((f < 0.06) | (f > 0.94)), "bone", 3)           # facet seams
    # dark steel corner posts on every other corner (rule F3)
    for c in range(0, N, 2):
        a = -math.pi / 2 + math.pi / N + 2 * math.pi * c / N
        R = S.corner(RING_R, N) - 0.5
        px, pz = CX + R * math.cos(a), CZ + R * math.sin(a)
        post = S.disc(g, "y", px, pz, 3.0, PL, RING_Y + 1, "steel", 3, n=8)
        P.flat(g, post, "steel", 3)
        P.flat(g, post & (np.floor(Y) % 6 == 2), "steel", 5)
    # a copper lip round the top of the drum
    lip = S.disc(g, "y", CX, CZ, RING_R + 1.5, RING_Y - 2, RING_Y + 1, "rust", 4, n=N)
    P.flat(g, lip, "rust", 4)
    P.flat(g, lip & (Y > RING_Y), "rust", 5)
    P.flat(g, lip & (Y < RING_Y - 1), "rust", 3)
    # teal windows in copper frames on the side and back flats
    window(g, "-x", CX - RING_R, CZ - 6, CZ + 6, PL + 9, PL + 19)
    window(g, "+x", CX + RING_R, CZ - 6, CZ + 6, PL + 9, PL + 19)
    window(g, "+z", CZ + RING_R, CX - 6, CX + 6, PL + 9, PL + 19)


# ------------------------------------------------------------------ hive
def pod(g: Grid) -> None:
    """The violet resin pod, caged by steel straps and hoops."""
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    for (y0, r0, x0, z0), (y1, r1, x1, z1) in zip(POD, POD[1:]):
        g.prism("y", ring(r0, x0, z0), y0, y1, C("purple", 4), top=ring(r1, x1, z1))
    solids = g.solids[n0:]
    m = shade_facets(g, solids, "purple", 4, seam=None)
    for yj in (40.0, 54.0, 66.0, 76.0):
        P.flat(g, m & (np.abs(Y - yj) < 0.6), "purple", 2)          # dark joins between the bulges
    shift_x = np.interp(Y, [p[0] for p in POD], [p[2] for p in POD])
    shift_z = np.interp(Y, [p[0] for p in POD], [p[3] for p in POD])
    k, f = sector(g, shift_x, shift_z)
    above = m & (Y > RING_Y + 1)
    # glowing egg sacs in the bays between the straps
    for (yy, bays, ry) in ((46.0, (1, 4, 7, 10), 4.6), (60.0, (2, 5, 8, 11), 3.8)):
        e = ((f - 0.5) / 0.34) ** 2 + ((Y - yy) / ry) ** 2
        sac = above & np.isin(k, bays)
        P.flat(g, sac & (e < 1.0), "purple", 2)
        P.flat(g, sac & (e < 0.62), "plasma", 4)
        P.flat(g, sac & (e < 0.25), "plasma", 6)
        P.flat(g, sac & (np.abs(f - 0.42) < 0.06) & (np.abs(Y - yy - ry * 0.35) < 0.6), "plasma", 7)
    # the lit crown of the pod
    P.flat(g, m & (Y > 76) & ~(edges_of(g, solids)), "purple", 5)
    # steel straps up four corners and two hoops (the cage)
    strap = above & (((k % 2 == 0) & (f < 0.13)) | ((k % 2 == 1) & (f > 0.87)))
    P.flat(g, strap, "steel", 4)
    P.flat(g, strap & ((f < 0.05) | (f > 0.95)), "steel", 2)
    for yh in (38.0, 53.0, 68.0):
        hoop = above & (np.abs(Y - yh) < 1.6)
        P.flat(g, hoop, "steel", 4)
        P.flat(g, hoop & (np.abs(Y - yh) > 1.0), "steel", 2)
        P.flat(g, hoop & strap, "steel", 6)                       # bolts where they cross
    # the clamp collar round the neck
    n1 = len(g.solids)
    g.prism("y", ring(12.5, 4, 2), 80, 88, C("steel", 4))
    col = shade_facets(g, g.solids[n1:], "steel", 4, seam=2)
    P.flat(g, col & (np.abs(Y - 84) < 1.0), "orange", 4)
    kk, ff = sector(g, 4, 2)
    P.flat(g, col & (np.abs(ff - 0.5) < 0.12) & (np.abs(Y - 84) < 1.0), "steel", 2)


def drips(g: Grid) -> None:
    """Violet resin oozing over the copper lip in a few places (life, F5)."""
    X, Y, Z = coords(g)
    for deg, ln in ((-58.0, 9), (32.0, 13), (118.0, 7), (205.0, 11), (250.0, 8)):
        a = math.radians(deg)
        R = RING_R + 0.6
        px, pz = CX + R * math.cos(a), CZ + R * math.sin(a)
        y1 = RING_Y + 1.5
        g.prism("y", S.flat_ngon(px, pz, 0.7, 6), y1 - ln, y1 - ln + 2, C("purple", 4), top=S.flat_ngon(px, pz, 1.8, 6))
        g.prism("y", S.flat_ngon(px, pz, 1.8, 6), y1 - ln + 2, y1, C("purple", 4), top=S.flat_ngon(px, pz, 2.6, 6))
        d = g.solids[-2].mask(g.shape) | g.solids[-1].mask(g.shape)
        P.flat(g, d, "purple", 4)
        P.flat(g, d & (Y > y1 - 2), "purple", 5)
        P.flat(g, d & (Y < y1 - ln + 1.5), "plasma", 5)


def edges_of(g: Grid, solids) -> np.ndarray:
    return S.seams(g, solids, 0.85)


# ------------------------------------------------------------------ station
def airlock(g: Grid) -> None:
    X, Y, Z = coords(g)
    az1 = int(FRONT) + 4
    steel_box(g, AX0, PL, AZ0, AX1, AWALL, az1, seed=4)
    corner_posts(g, AX0, AX1, AZ0, az1, PL, AWALL, size=4)
    steel_roof(g, AX0, AX1, AZ0, az1, AWALL + 1, ARIDGE, ridge="z", overhang=3, seed=5)
    blast_door(g, "-z", AZ0, AX0 + 6, AX1 - 6, PL, PL + 22, seed=6)
    sign(g, "-z", AZ0, CX, AWALL + 3, "HIVE", pad=2)
    # a cyan light strip over the door and a warning lamp on each post
    lit = box(g, AX0 + 5, PL + 26, AZ0 - 2, AX1 - 5, PL + 27, AZ0, "plasma", 6)
    P.flat(g, lit, "plasma", 6)
    for x in (AX0 - 1, AX1 - 3):
        lamp = box(g, x, AWALL, AZ0 - 1, x + 4, AWALL + 3, AZ0 + 3, "orange", 5)
        P.flat(g, lamp & (Y > AWALL + 2), "orange", 7)


def pylon(g: Grid, px: float, pz: float, h: int) -> None:
    """A copper tesla containment pylon with a cyan orb (PN mecha)."""
    X, Y, Z = coords(g)
    foot = box(g, px - 5, PL, pz - 5, px + 5, PL + 5, pz + 5, "steel", 3)
    P.plates(g, foot, "steel", 3, size=(5, 5))
    P.flat(g, edges(foot), "steel", 2)
    col = S.disc(g, "y", px, pz, 3.0, PL + 5, h - 16, "steel", 4, n=8)
    P.flat(g, col, "steel", 4)
    P.flat(g, col & (np.floor(Y) % 8 == 0), "steel", 2)
    ins = S.disc(g, "y", px, pz, 3.6, h - 16, h - 13, "bone", 6, n=8)
    P.flat(g, ins, "bone", 6)
    coil = S.cone(g, "y", px, pz, 4.6, h - 13, h - 3, "rust", 4, n=8, r_top=3.4)
    P.flat(g, coil & (np.floor(Y) % 2 == 0), "rust", 6)
    P.flat(g, coil & (np.floor(Y) % 2 == 1), "rust", 3)
    orb = S.cone(g, "y", px, pz, 2.6, h - 3, h, "plasma", 4, n=8, r_top=4.2)
    orb |= S.cone(g, "y", px, pz, 4.2, h, h + 3, "plasma", 5, n=8)
    orb |= S.cone(g, "y", px, pz, 4.2, h + 3, h + 6, "plasma", 6, n=8, r_top=2.0)
    P.flat(g, orb & (Y > h + 3), "plasma", 7)


def station(g: Grid) -> None:
    X, Y, Z = coords(g)
    airlock(g)
    pylon(g, CX - 51, CZ + 16, 78)
    pylon(g, CX + 49, CZ - 22, 64)
    # copper feed pipes from the pylon feet into the drum
    S.pipe(g, [(CX - 46, PL + 3, CZ + 16), (CX - RING_R + 2, PL + 3, CZ + 16)], s=4, ramp="rust", base=4)
    S.pipe(g, [(CX + 44, PL + 3, CZ - 22), (CX + RING_R - 6, PL + 3, CZ - 22)], s=4, ramp="rust", base=4)
    # crates and drums by the airlock, beacons on the plinth rim
    crate(g, int(CX) + 22, PL, 12, 10)
    crate(g, int(CX) + 24, PL + 10, 14, 6, ramp="steel", base=5, stripe=("orange", 5))
    crate(g, int(CX) + 34, PL, 20, 8, ramp="bone", base=6, stripe=("plasma", 6))
    fuel_drum(g, CX - 26, 16, PL, h=12, r=4.5)
    fuel_drum(g, CX - 34, 22, PL, h=10, r=4, ramp="steel")
    for bx, bz in ((CX - 40, CZ - 40), (CX + 40, CZ + 40), (CX - 30, CZ + 50)):
        beacon(g, int(bx), PL, int(bz), h=8, lamp=("orange", 5))


def body() -> Grid:
    g = Grid(W, H, D)
    plinth(g)
    drum(g)
    pod(g)
    station(g)
    drips(g)
    return g


def heart() -> Grid:
    """The pulsing heart bulb: faceted glowing cyan frustums with violet veins."""
    g = Grid(44, 40, 44)
    X, Y, Z = coords(g)
    c = 22
    clamp = S.cone(g, "y", c, c, 13, 0, 3, "steel", 3, n=8)
    P.flat(g, clamp, "steel", 3)
    P.flat(g, clamp & (Y > 2), "steel", 5)
    lo = S.cone(g, "y", c, c, 18, 3, 15, "plasma", 4, n=8, r_top=12, tip="lo")
    lo |= S.cone(g, "y", c, c, 18, 15, 31, "plasma", 4, n=8, r_top=6)
    P.flat(g, lo, "plasma", 4)
    P.flat(g, lo & (Y > 12), "plasma", 5)
    P.flat(g, lo & (Y > 22), "plasma", 6)
    ang = np.degrees(np.arctan2(Z - c, X - c))
    vein = lo & (np.abs(((ang + 360) % 45) - 22.5 - (Y - 8) * 1.5) < 2.4) & (Y < 27)
    P.flat(g, vein, "purple", 3)
    P.flat(g, lo & (Y > 27), "plasma", 7)
    tip = S.cone(g, "y", c, c, 6, 31, 39, "purple", 5, n=8, r_top=1.5)
    P.flat(g, tip, "purple", 5)
    P.flat(g, tip & (Y > 35), "purple", 6)
    return g


def pulse():
    keys = []
    for i in range(9):
        t = i * 1.4 / 8
        s = 1.0 + 0.14 * (0.5 - 0.5 * math.cos(2 * math.pi * i / 8)) * (1 if i % 4 != 3 else 0.6)
        keys.append((t, (s, s * 0.95 + 0.05, s)))
    return keys


def build() -> Asset:
    g = body()
    root = Part("alien-hive", g)
    root.add(Part("heart", heart(), pivot=(22.0, 0.0, 22.0), at=(TOP[0], TOP[1] - 1, TOP[2])))
    return Asset(
        id="space-buildings-alien-hive", pack="space", category="buildings", name="Alien Hive", root=root,
        clips=[Clip("idle", {"heart": {"scale": pulse()}})],
        sockets=[Socket("socket-spores", at=(TOP[0], TOP[1] + 39, TOP[2]))],
        pfx=[{"effectId": "rvx-space-spore-drift", "socket": "socket-spores", "trigger": "idle", "size": 60}],
    )
