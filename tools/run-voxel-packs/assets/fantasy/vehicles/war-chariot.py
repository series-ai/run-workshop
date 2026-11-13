"""War chariot in the Pirate Nation style.

A two-wheel battle car for one standing driver. A D-shaped plank floor sits
on one axle under its rear half. A curved breastwork wraps the front: five
red panels with gold rims that reach the hip of a 36-voxel person (18 above
the floor), and side walls whose rims slope down to the open back (true
slopes, rule F2). A draught pole runs out under the floor and curves up to
a bowed yoke for two horses. Big six-spoke wheels carry gold hubs, and a
curved iron scythe blade turns out from each axle end. A gold lion glows on
the front panel, and a quiver of javelins rides on the left wall (rules C3,
F5).

The oversized function prop is the long war spear (rule F4). It lies in
two iron loops on the right wall, with a leaf blade, a gold collar and a
red streamer. On `attack` it draws back and thrusts forward through the
loops (PFX at the blade). On `move` the wheels turn and the car rides the
wheel corners, so the wheels touch the ground at each frame. About 45
wide, 62 long and 34 tall. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import coords, glyph, plank_box
from _vehicle_contact import Axle, body_keys, check_rest, spin_keys
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

SZ = (52, 48, 70)
CX = 26.0
AZ, WR, NSIDE = 52.0, 12.0, 12  # axle z, wheel flat radius, wheel sides
WHEEL_X = {"l": (CX - 20, CX - 17), "r": (CX + 17, CX + 20)}
FL0, FL1 = 12, 15  # floor bottom and top
RIM = 33  # top of the front breastwork: 18 above the floor (hip height)
CZ0, CZ1 = 36, 60  # car front and back
HALF = 12  # half width of the car
SPEAR_X, SPEAR_Y = CX + 14.0, 26.0  # spear axis
SPEAR_Z0, SPEAR_Z1 = 4.0, 66.0  # blade tip and butt
SECONDS = 1.2


def floor(g: Grid) -> None:
    """A D-shaped plank floor, framed in dark wood, and a rear step."""
    plan = [(CX - HALF, CZ1), (CX - HALF, CZ0 + 9), (CX - 9, CZ0 + 3), (CX - 4, CZ0), (CX + 4, CZ0),
            (CX + 9, CZ0 + 3), (CX + HALF, CZ0 + 9), (CX + HALF, CZ1)]
    g.prism("y", plan, FL0, FL1, C("wood", 5))
    m = S.last(g)
    X, Y, Z = coords(g)
    P.planks(g, m, "wood", 5, width=3, across="z", length=(30, 30), nails=True, frame="top", seed=1)
    P.flat(g, m & (Y < FL1 - 1), "darkwood", 3)
    step = plank_box(g, CX - 6, FL0 - 3, CZ1, CX + 6, FL0 - 1, CZ1 + 3, "darkwood", 4, across="x", width=3, seed=2)
    box(g, CX - 5, FL0 - 1, CZ1, CX - 3, FL0, CZ1 + 2, "iron", 4)
    box(g, CX + 3, FL0 - 1, CZ1, CX + 5, FL0, CZ1 + 2, "iron", 4)


def breastwork(g: Grid) -> np.ndarray:
    """Front panels (vertical, flat rims at RIM) and side walls whose rims
    slope down to the back. Red boards, gold rims, bronze studs."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    t = 2.0  # wall thickness
    outer = [(CX - HALF, CZ0 + 13), (CX - HALF, CZ0 + 9), (CX - 9, CZ0 + 3), (CX - 4, CZ0), (CX + 4, CZ0),
             (CX + 9, CZ0 + 3), (CX + HALF, CZ0 + 9), (CX + HALF, CZ0 + 13)]
    inner = [(CX - HALF + t, CZ0 + 13), (CX - HALF + t, CZ0 + 9.8), (CX - 8, CZ0 + 3 + t), (CX - 3.6, CZ0 + t),
             (CX + 3.6, CZ0 + t), (CX + 8, CZ0 + 3 + t), (CX + HALF - t, CZ0 + 9.8), (CX + HALF - t, CZ0 + 13)]
    for k in range(len(outer) - 1):
        seg = [outer[k], outer[k + 1], inner[k + 1], inner[k]]
        g.prism("y", seg, FL1, RIM, C("red", 4))
    # side walls: the rim slopes from RIM down to 24 at the back
    for s in (-1, 1):
        x0 = CX + s * HALF - (t if s > 0 else 0)
        g.prism("x", [(FL1, CZ0 + 13), (RIM, CZ0 + 13), (24, CZ1), (FL1, CZ1)], x0, x0 + t, C("red", 4))
    solids = g.solids[start:]
    wall = np.logical_or.reduce([s.mask(g.shape) for s in solids])
    for fm, fr in S.facets(g, solids):
        P.planks(g, fm, "red", 4, width=3, across="y", length=(40, 40), nails=False, frame=fr, seed=3)
    # the gold rim and the dark sill (rule S4)
    top = wall & ((Y > RIM - 1.6) | ((np.abs(X - CX) > HALF - t - 0.1) & (Y > (RIM - (Z - CZ0 - 13) * (RIM - 24) / (CZ1 - CZ0 - 13)) - 1.6)))
    P.flat(g, top, "gold", 5)
    P.flat(g, wall & (Y < FL1 + 1), "darkwood", 3)
    # a gold band and bronze studs along the middle of the panels
    band = wall & (np.abs(Y - 23) < 0.6)
    P.flat(g, band, "gold", 4)
    studs = band & ((np.floor(X + Z).astype(int) % 4) == 0)
    P.flat(g, studs, "gold", 7)
    # the front panel carries a gold lion on a deep red field
    front = wall & (Z < CZ0 + 1) & (Y > FL1 + 2) & (Y < RIM - 2)
    P.flat(g, front, "red", 3)
    P.flat(g, front & ((np.abs(X - CX) > 3.2) | (Y < FL1 + 3) | (Y > RIM - 3)), "gold", 5)
    glyph(g, "-z", CZ0, int(CX) - 3, FL1 + 6, "lion", "gold", 6, reach=1)
    return wall


def pole(g: Grid) -> None:
    """The axle, the draught pole that curves up to the yoke, and the yoke."""
    X, Y, Z = coords(g)
    ax = box(g, CX - 17, WR - 1.5, AZ - 1.5, CX + 17, WR + 1.5, AZ + 1.5, "darkwood", 3)
    P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False, seed=11)
    # a swan-neck pole: three straight runs (true slopes) under the floor and up
    for (y0, z0), (y1, z1) in (((10.5, 58.0), (10.5, 34.0)), ((10.5, 34.0), (14.0, 18.0)), ((14.0, 18.0), (21.0, 5.0))):
        bar = S.bar(g, "x", (y0, z0), (y1, z1), 3.0, CX - 1.5, CX + 1.5, "darkwood", 4)
        P.planks(g, bar, "darkwood", 4, width=3, across="y", nails=False, seed=int(z0))
    for zb in (30.0, 18.5):
        box(g, CX - 2, 9 if zb > 20 else 12.5, zb - 1, CX + 2, 13 if zb > 20 else 16.5, zb + 1, "gold", 5)  # gold pole bands
    # the yoke: a bowed crossbar with two saddles that drop to the horses' necks
    for s in (-1, 1):
        arm = S.bar(g, "z", (CX, 22.5), (CX + s * 13.0, 20.0), 2.6, 3, 6, "wood", 5)
        P.planks(g, arm, "wood", 5, width=2, across="z", nails=False, seed=13)
        for xo in (5.0, 10.0):
            g.prism("z", [(CX + s * xo - 1.0, 21.5 - xo * 0.17), (CX + s * xo + 1.0, 21.5 - xo * 0.17), (CX + s * (xo + 1.8), 15.5), (CX + s * (xo - 1.8), 15.5)],
                    3.5, 5.5, C("darkwood", 3))
        tip = S.disc(g, "z", CX + s * 13.0, 20.0, 1.6, 2.5, 6.5, "gold", 5, n=8)
    knob = S.disc(g, "z", CX, 22.5, 2.0, 1, 7, "gold", 5, n=8)
    P.flat(g, knob & (Y > 23), "gold", 7)


def scythes(g: Grid) -> None:
    """Iron axle caps with a curved scythe blade turned back from each."""
    X, Y, Z = coords(g)
    for s in (-1, 1):
        x0 = CX + s * 21.5
        cap = S.disc(g, "x", WR, AZ, 1.6, min(x0, x0 - s * 1.0), max(x0, x0 - s * 1.0), "iron", 5, n=8)
        blade = [(x0 - s * 0.8, AZ - 1.0), (x0 + s * 0.2, AZ - 2.0), (x0 + s * 0.9, AZ + 4.0), (x0 + s * 0.6, AZ + 9.0), (x0 - s * 0.2, AZ + 3.0)]
        g.prism("y", blade, WR - 0.6, WR + 0.6, C("steel", 5))
        bm = S.last(g)
        P.flat(g, bm & (Z > AZ + 2.5), "steel", 7)  # the honed edge
        P.flat(g, cap & (np.abs(Y - WR) < 0.6), "gold", 5)


def spear_loops(g: Grid) -> None:
    """Two iron loops on the right wall that hold the spear."""
    for z in (CZ0 + 15.0, CZ1 - 5.0):
        box(g, CX + HALF, SPEAR_Y - 2.5, z - 1, SPEAR_X + 2.0, SPEAR_Y - 1.0, z + 1, "iron", 5)
        box(g, SPEAR_X + 1.0, SPEAR_Y - 2.5, z - 1, SPEAR_X + 2.0, SPEAR_Y + 1.5, z + 1, "iron", 5)


def quiver(g: Grid) -> None:
    """A red leather quiver of javelins, slanted on the left wall."""
    X, Y, Z = coords(g)
    xq = CX - HALF - 3.0
    q = S.bar(g, "x", (FL1 + 1.0, CZ1 - 4.0), (RIM - 1.0, CZ1 - 12.0), 4.2, xq, xq + 3.0, "red", 3)
    P.flat(g, q & (np.floor(Y).astype(int) % 6 == 0), "gold", 5)
    P.flat(g, edges(q), "red", 2)
    for dz, dx in ((-1.0, 0.6), (0.6, 1.6), (-0.2, 2.4)):
        S.bar(g, "x", (RIM - 1.0, CZ1 - 12.0 + dz), (RIM + 0.8, CZ1 - 12.7 + dz), 1.0, xq + dx - 0.5, xq + dx + 0.5, "wood", 6)
        fl = S.bar(g, "x", (RIM + 0.8, CZ1 - 12.7 + dz), (RIM + 2.6, CZ1 - 13.4 + dz), 1.6, xq + dx - 0.5, xq + dx + 0.5, "bone", 6)
        P.flat(g, fl & (Y > RIM + 1.8), "red", 5)
    box(g, CX - HALF - 1, FL1 + 6, CZ1 - 8, CX - HALF, FL1 + 8, CZ1 - 6, "iron", 4)  # the strap to the wall


def body() -> Grid:
    g = Grid(*SZ)
    floor(g)
    breastwork(g)
    pole(g)
    scythes(g)
    spear_loops(g)
    quiver(g)
    return g


def spear() -> tuple[Grid, tuple]:
    """The long war spear: an ash shaft with dark grip bands, a gold collar,
    a leaf blade, a red streamer and an iron butt spike."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    zb = SPEAR_Z0 + 11.0  # the base of the blade
    g.prism("z", S.flat_ngon(SPEAR_X, SPEAR_Y, 0.95, 6, facing=-np.pi / 2), zb, SPEAR_Z1 - 2, C("wood", 6))
    shaft = S.last(g)
    P.flat(g, shaft & ((np.floor(Z).astype(int) % 9) == 0), "wood", 4)
    P.flat(g, shaft & (Z > SPEAR_Z1 - 14) & (Z < SPEAR_Z1 - 8), "darkwood", 3)  # the grip
    g.prism("z", S.flat_ngon(SPEAR_X, SPEAR_Y, 1.2, 6, facing=-np.pi / 2), SPEAR_Z1 - 2, SPEAR_Z1, C("iron", 5))  # butt spike
    collar = S.disc(g, "z", SPEAR_X, SPEAR_Y, 1.4, zb, zb + 2.5, "gold", 5, n=6)
    P.flat(g, collar & (Y > SPEAR_Y + 0.5), "gold", 7)
    leaf = [(SPEAR_Y - 0.6, zb), (SPEAR_Y + 0.6, zb), (SPEAR_Y + 2.4, zb - 4.0), (SPEAR_Y + 0.4, SPEAR_Z0), (SPEAR_Y - 0.4, SPEAR_Z0), (SPEAR_Y - 2.4, zb - 4.0)]
    g.prism("x", leaf, SPEAR_X - 0.6, SPEAR_X + 0.6, C("steel", 6))
    blade = S.last(g)
    P.flat(g, blade & (np.abs(Y - SPEAR_Y) < 0.6), "steel", 4)  # the midrib
    # a red streamer tied below the collar
    g.prism("x", [(SPEAR_Y, zb + 3.0), (SPEAR_Y, zb + 5.0), (SPEAR_Y - 5.0, zb + 9.0), (SPEAR_Y - 6.0, zb + 7.0)], SPEAR_X - 0.5, SPEAR_X + 0.5, C("red", 5))
    P.flat(g, S.last(g) & (Y < SPEAR_Y - 4), "red", 3)
    return g, (SPEAR_X, SPEAR_Y, SPEAR_Z1 - 10.0)


def wheel_grid(side: str) -> tuple[Grid, tuple]:
    g = Grid(*SZ)
    x0, x1 = WHEEL_X[side]
    info = S.wheel(g, "x", AZ, 0, WR, int(x0), int(x1), n=NSIDE, spokes=6, gaps=True, tyre=("iron", 4), rim=("darkwood", 4),
                   spoke=("wood", 5), hub=("gold", 5), rim_w=2.4, hub_r=2.8, hub_out=0.5)
    return g, info["centre"]


def build() -> Asset:
    g = body()
    sg, hinge = spear()
    wheels = {f"wheel-{side}": wheel_grid(side) for side in ("l", "r")}
    occ = (g.a > 0) | (sg.a > 0)
    for wg, _ in wheels.values():
        occ |= wg.a > 0
    xs, ys, zs = np.nonzero(occ)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)
    if pivot[1] != 0.0:
        raise ValueError(f"war-chariot: lowest voxel is at y={pivot[1]}, the wheels must stand on y = 0")

    def rel(p):
        return (p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])

    root = Part("chariot", g, pivot=pivot)
    root.add(Part("spear", sg, pivot=hinge, at=rel(hinge)))
    # one turn per clip, 10 deg per frame: a frame falls on each moment when
    # a flat side is down, so the contact stays within 0.05 between frames
    rate = -360.0 / SECONDS
    move = {}
    for name, (wg, hub) in wheels.items():
        root.add(Part(name, wg, pivot=hub, at=rel(hub)))
        move[name] = {"rot": spin_keys(SECONDS, lambda t: rate * t)}
    axles = [Axle(WR, AZ - pivot[2], WR, NSIDE)]
    check_rest(axles)
    loc, _ = body_keys(axles, lambda t: [rate * t], SECONDS)
    move["chariot"] = {"loc": loc}
    # the spear draws back, then thrusts out through the loops
    attack = {"spear": {"loc": [(0.0, (0.0, 0.0, 0.0)), (0.12, (0.0, 0.0, 4.0)), (0.3, (0.0, 0.0, -10.0)),
                                (0.45, (0.0, 0.0, -10.0)), (0.7, (0.0, 0.0, 0.0))]}}
    tip = (SPEAR_X, SPEAR_Y, SPEAR_Z0 + 2.0)
    return Asset(id="fantasy-vehicles-war-chariot", pack="fantasy", category="vehicles", name="War Chariot", root=root,
                 clips=[Clip("move", move), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-function", at=rel(tip), parent="spear")],
                 pfx=[{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-function", "trigger": "clip:attack", "size": 18, "at": 0.3}])
