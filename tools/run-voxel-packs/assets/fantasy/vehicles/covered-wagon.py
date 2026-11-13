"""Merchant wagon in the Pirate Nation style.

Few chunky volumes: a flared plank bed (true slopes), a puffy canvas hood
built from six facets with dark end bows, big octagonal spoked wheels (the
rear pair oversized) and a sloped tongue. The function prop is oversized so
it reads in a thumbnail: the pack's big lantern, hung from a bent pole over
the driver's bench (the same lantern as the street lantern). A painted
merchant crest on the canvas, a barrel and a crate on the rear step and a
pennant on the hood. Wheels turn and the lantern swings on `move`. Faces -Z.
"""
import numpy as np

import paint as P
from _pn import arch, lantern, wheel
from pnkit import barrel, box, crate, pennant
from voxgrid import C, Asset, Clip, Grid, Part, Socket, _inside_polygon, turn

S = (60, 84, 96)
CX = 30
FA, FR = 27, 10  # front axle z, wheel radius
RA, RR = 64, 13  # rear axle z, wheel radius (oversized, rule F4)
BED_Y0, BED_Y1 = 14, 27  # bed bottom and rail
BZ0, BZ1 = 16, 80  # bed z extent
HZ0, HZ1 = 26, 74  # canvas hood z extent
HOOD_TOP = 60
HALF = 16  # half width of the bed at the rail
PX, PZ = CX + 13, 19  # lantern pole foot
LZ = 11  # lantern centre z (hangs forward over the bench)
ARM_Y = 69  # bottom of the pole arm
WHEEL_X = {"l": (CX - 22, CX - 19), "r": (CX + 19, CX + 22)}


def coords(g: Grid):
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def running_gear(g: Grid) -> None:
    for az, r in ((FA, FR), (RA, RR)):
        ax = box(g, CX - 19, r - 1, az - 1, CX + 19, r + 2, az + 2, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False)
        bol = box(g, CX - 10, r + 2, az - 2, CX + 10, BED_Y0, az + 3, "darkwood", 4)
        P.planks(g, bol, "darkwood", 4, width=2, across="y", nails=False)
    # a sloped tongue (true slope) with a crossbar at its tip
    g.prism("x", [(9, BZ0 + 4), (12, BZ0 + 4), (7, 2), (4, 2)], CX - 1.5, CX + 1.5, C("darkwood", 4))
    P.flat(g, g.solids[-1].mask(g.shape), "darkwood", 4)
    bar = box(g, CX - 9, 4, 3, CX + 9, 7, 6, "darkwood", 3)
    P.planks(g, bar, "darkwood", 3, width=3, across="y", nails=True)


def bed(g: Grid) -> None:
    """A flared plank bed: the sides lean out (true slopes), boards painted
    with dark seams, a dark top rail and dark stakes (rules S2, S4)."""
    poly = [(CX - HALF + 2, BED_Y0), (CX + HALF - 2, BED_Y0), (CX + HALF, BED_Y1), (CX - HALF, BED_Y1)]
    g.prism("z", poly, BZ0, BZ1, C("wood", 5))
    m = g.solids[-1].mask(g.shape)
    P.planks(g, m, "wood", 5, width=3, across="y", length=(14, 22), seed=2)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > BED_Y1 - 2), "darkwood", 3)  # top rail
    P.flat(g, m & (Y < BED_Y0 + 1.5), "darkwood", 4)  # bottom sill
    stakes = m & (((Z - BZ0) % 12 < 2) | (Z > BZ1 - 2) | (Z < BZ0 + 2))
    P.flat(g, stakes & (Y <= BED_Y1 - 2), "darkwood", 4)
    # a painted red-and-gold band along the sides (an accent, rule C1)
    band = m & (Y >= 19) & (Y < 21) & ~stakes
    P.flat(g, band, "red", 4)


def hood(g: Grid) -> None:
    """The canvas hood: six true facets, puffed wider than the bed, with
    painted rib bands and stitch seams, a merchant crest on both sides and
    dark end bows. The ends show an opening with cargo, all painted."""
    poly = arch(CX, BED_Y1, HALF - 1, HOOD_TOP, bulge=1.6)
    g.prism("z", poly, HZ0 + 1, HZ1 - 1, C("bone", 5))
    canvas = g.solids[-1].mask(g.shape)
    P.mottle(g, canvas, "bone", 5, cell=3, seed=3)
    X, Y, Z = coords(g)
    P.flat(g, canvas & ((Z - HZ0) % 4 < 1) & (Y < BED_Y1 + 5), "bone", 4)  # gathered hem
    ribs = canvas & np.isin(np.floor(Z).astype(int), [37, 38, 49, 50, 61, 62])
    P.flat(g, ribs, "sand", 4)
    # merchant crest: a red roundel with a gold ring and a gold coin
    cz, cy = (HZ0 + HZ1) / 2, 44
    d = np.hypot(Z - cz, Y - cy)
    side = canvas & (np.abs(X - CX) > HALF - 4)
    P.flat(g, side & (d < 9.5), "gold", 5)
    P.flat(g, side & (d < 8.0), "red", 4)
    P.flat(g, side & (d < 4.2), "gold", 6)
    P.flat(g, side & (d < 4.2) & (np.abs(Z - cz) < 0.8), "gold", 4)
    # end bows: thick dark frames, a little larger than the canvas (rule F3)
    big = arch(CX, BED_Y1, HALF, HOOD_TOP + 1.5, bulge=2.2)
    for z0 in (HZ0, HZ1 - 3):
        g.prism("z", big, z0, z0 + 3, C("darkwood", 4))
        bow = g.solids[-1].mask(g.shape)
        P.planks(g, bow, "darkwood", 4, width=3, across="y", nails=False, seed=z0)
        # the open end, painted on the outer face of the bow
        face = bow & ((np.floor(Z).astype(int) == z0) if z0 == HZ0 else (np.floor(Z).astype(int) == z0 + 2))
        inner = arch(CX, BED_Y1, HALF - 4, HOOD_TOP - 4, bulge=1.0)
        hole = face & _inside_polygon(X, Y, inner)
        P.flat(g, hole, "sand", 3)  # canvas in shadow: warm, never murky (rule C2)
        P.flat(g, hole & (Y > HOOD_TOP - 12), "sand", 2)
        # cargo in the opening: a crate and a sack, painted
        cr = hole & (X > CX - 11) & (X < CX - 1) & (Y < BED_Y1 + 10)
        P.flat(g, cr, "wood", 5)
        P.flat(g, cr & ((np.abs(X - (CX - 6)) > 4) | (Y > BED_Y1 + 9) | (Y < BED_Y1 + 1)), "darkwood", 4)
        sack = hole & (np.hypot((X - (CX + 5)) / 5.0, (Y - (BED_Y1 + 5)) / 5.5) < 1)
        P.flat(g, sack, "sand", 5)
        P.flat(g, sack & (Y > BED_Y1 + 9), "sand", 4)


def bench(g: Grid) -> None:
    seat = box(g, CX - 12, BED_Y1, BZ0 + 1, CX + 12, BED_Y1 + 4, HZ0, "darkwood", 4)
    P.planks(g, seat, "darkwood", 4, width=2, across="y", nails=True, seed=7)
    cushion = box(g, CX - 11, BED_Y1 + 4, BZ0 + 2, CX + 11, BED_Y1 + 6, HZ0 - 1, "red", 4)
    P.mottle(g, cushion, "red", 4, cell=2, seed=8)
    P.outline(g, cushion, "red", 3, normal="y")
    # a sloped footboard in front of the bench (a true slope)
    g.prism("x", [(BED_Y0 + 9, BZ0), (BED_Y0 + 12, BZ0), (BED_Y0 + 17, BZ0 - 6), (BED_Y0 + 14, BZ0 - 7)], CX - 12, CX + 12, C("wood", 4))
    fb = g.solids[-1].mask(g.shape)
    P.planks(g, fb, "wood", 4, width=3, across="x", nails=False, seed=9)
    P.outline(g, fb, "darkwood", 3, normal="x")
    # the lantern pole: up from the bed corner, then forward over the bench
    pole = box(g, PX - 2, BED_Y1 - 4, PZ - 2, PX + 1, ARM_Y + 3, PZ + 1, "darkwood", 4)
    arm = box(g, PX - 2, ARM_Y, LZ - 2, PX + 1, ARM_Y + 3, PZ - 2, "darkwood", 4)
    P.planks(g, pole | arm, "darkwood", 4, width=3, across="x", nails=False, seed=10)
    g.prism("x", [(ARM_Y - 8, PZ - 2), (ARM_Y - 5, PZ - 2), (ARM_Y, PZ - 6), (ARM_Y, PZ - 9)], PX - 1.5, PX + 0.5, C("darkwood", 3))  # brace
    box(g, PX - 1, ARM_Y - 3, LZ - 1, PX, ARM_Y, LZ + 1, "stone", 3)  # hook


def rear(g: Grid) -> None:
    step = box(g, CX - 12, BED_Y0, BZ1, CX + 12, BED_Y0 + 2, BZ1 + 10, "darkwood", 4)
    P.planks(g, step, "darkwood", 4, width=3, across="x", nails=True, seed=11)
    barrel(g, CX + 6, BZ1 + 5, BED_Y0 + 2, 12, 4.8, ramp="wood", hoop="darkwood", base=5)
    crate(g, CX - 11, BED_Y0 + 2, BZ1 + 1, 8, seed=12)
    pennant(g, CX - 1, HOOD_TOP - 2, HZ1 - 5, 14, 12, "red")


def body() -> Grid:
    g = Grid(*S)
    running_gear(g)
    bed(g)
    hood(g)
    bench(g)
    rear(g)
    return g


def hanging_lantern() -> tuple[Grid, dict]:
    g = Grid(*S)
    info = lantern(g, PX - 1, 0, LZ, seed=20)
    # lift it so the ring meets the hook under the arm
    lift = ARM_Y - 3 - info["top"]
    out = Grid(*S)
    out.a[:, lift:, :] = g.a[:, : S[1] - lift, :]
    out.solids = [s.shifted((0, lift, 0)) for s in g.solids]
    info["glow"] = (info["glow"][0], info["glow"][1] + lift, info["glow"][2])
    info["top"] += lift
    return out, info


def wheel_grid(side: str, az: int, r: int) -> Grid:
    g = Grid(*S)
    x0, x1 = WHEEL_X[side]
    wheel(g, x0, x1, r, az, r, spokes=8, rim=3.0 if r > 10 else 2.6, hub=3.2 if r > 10 else 2.6, seed=r)
    return g


def build() -> Asset:
    g = body()
    lg, info = hanging_lantern()
    wheels = {f"wheel-{side}{end}": (wheel_grid(side, az, r), ((WHEEL_X[side][0] + WHEEL_X[side][1]) / 2, r, az))
              for side in ("l", "r") for end, az, r in (("f", FA, FR), ("b", RA, RR))}
    occ = (g.a > 0) | (lg.a > 0)
    for wg, _ in wheels.values():
        occ |= wg.a > 0
    xs, ys, zs = np.nonzero(occ)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)

    def rel(p):
        return (p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])

    root = Part("covered-wagon", g, pivot=pivot)
    clips = {}
    for name, (wg, hub) in wheels.items():
        root.add(Part(name, wg, pivot=hub, at=rel(hub)))
        # rear: one turn per 1.2 s; the smaller front wheels turn 450° (their 4-fold pattern loops seamlessly)
        clips[name] = {"rot": turn(1.2, "x", -300)}
    hang = (PX - 1.0, float(info["top"]), float(LZ))
    root.add(Part("lantern", lg, pivot=hang, at=rel(hang)))
    clips["lantern"] = {"rot": [(t, (a, 0.0, 0.0)) for t, a in ((0, 0.0), (0.3, 7.0), (0.6, 0.0), (0.9, -7.0), (1.2, 0.0))]}
    clips["covered-wagon"] = {"rot": [(t, (0.0, 0.0, a)) for t, a in ((0, 0.0), (0.3, 1.0), (0.6, 0.0), (0.9, -1.0), (1.2, 0.0))]}
    return Asset(id="fantasy-vehicles-covered-wagon", pack="fantasy", category="vehicles", name="Merchant Wagon", root=root,
                 clips=[Clip("move", clips)], sockets=[Socket("socket-lantern", at=rel(info["glow"]), parent="lantern")])

