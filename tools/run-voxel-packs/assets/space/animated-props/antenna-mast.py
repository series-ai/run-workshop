"""Antenna mast, in the Pirate Nation mecha style.

A relay mast on a hazard plinth: a plated equipment hut with a teal screen
and a louvred vent at the foot, then a real orange lattice tower in two
stages — thick rails with true diagonal braces on every face (F2, F3) —
stepping in at a banded collar. A hazard service deck caps it. The
oversized function prop is the dish: a white faceted bowl with an orange
rim, painted range rings, three struts and a copper feed horn, on a
copper yoke that carries the red beacon lamp as well (F4). On `idle` the
yoke scans and the dish nods; on `spin` it sweeps a whole turn and the
scan pulse fires. Faces -Z.
"""
import numpy as np

from _bld import truss
from _life import P, Clip, Grid, Rig, asset, box, coords, edges, facet_paint, hazard, light_top, ngon_y, plate_facets, plated, spin, wave
from pnshapes import bar, cone, ngon_radius

S = (44, 84, 44)
CX, CZ = 22, 22
YP = 5      # plinth top
Y1, Y2 = 6, 30    # lattice stage one
Y3 = 50           # lattice stage two top
YD = 53           # the service deck top: the yoke turns here
YH = 66           # the dish centre
HW1, HD1 = 11, 8  # stage one half width (x) and half depth (z)
HW2, HD2 = 7, 5.5


def lattice(g: Grid, y0: int, y1: int, hw: float, hd: float, braces: int, seed: int) -> None:
    """One stage: two truss panels on the x faces (rails and true diagonal
    braces), and an X of braces on each z face between them."""
    for x0 in (CX - hw, CX + hw - 3):
        truss(g, "x", (y0, CZ), (y1, CZ), 2 * hd, x0, x0 + 3, ramp="orange", base=5, braces=braces, thick=2.4)
    step = (y1 - y0) / braces
    for k in range(braces):
        ya, yb = y0 + k * step + 1, y0 + (k + 1) * step - 1
        for z0 in (CZ - hd - 1, CZ + hd - 2):
            bar(g, "z", (CX - hw + 2, ya), (CX + hw - 2, yb), 2.0, z0, z0 + 3, "orange", 4)
            bar(g, "z", (CX - hw + 2, yb), (CX + hw - 2, ya), 2.0, z0, z0 + 3, "orange", 4)
    del seed


def mast() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pl = ngon_y(g, CX, CZ, 16, 0, YP, "iron", 5, n=8)
    hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    light_top(g, pl, "steel", 4)
    # the equipment hut at the foot, on the -z side
    hut = box(g, CX - 12, YP, CZ - 16, CX + 4, YP + 16, CZ - 9, "steel", 5)
    plated(g, hut, "steel", 5, size=(9, 7), seed=1)
    P.flat(g, edges(hut), "steel", 3)
    roof = box(g, CX - 13, YP + 16, CZ - 17, CX + 5, YP + 18, CZ - 8, "orange", 5)
    P.flat(g, roof, "orange", 5)
    P.flat(g, edges(roof), "orange", 3)
    light_top(g, roof, "orange", 6)
    front_ = hut & (Z < CZ - 15.4)
    door = front_ & (X > CX - 10) & (X < CX - 3) & (Y < YP + 12)
    P.flat(g, door, "steel", 4)
    P.outline(g, door, "steel", 2, normal="z")
    P.flat(g, door & (np.abs(Y - (YP + 6)) < 0.8) & (X > CX - 5), "gold", 6)
    scr = front_ & (X > CX - 2) & (X < CX + 3) & (Y > YP + 7) & (Y < YP + 14)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & (np.floor(Y) % 2 == 0), "cyan", 6)
    vent = hut & (X > CX + 3.4) & (Y > YP + 3) & (Y < YP + 12) & (Z > CZ - 15) & (Z < CZ - 10)
    P.flat(g, vent, "iron", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 6)
    # the two lattice stages and the collar between them
    lattice(g, Y1, Y2, HW1, HD1, 3, 2)
    lattice(g, Y2 + 3, Y3, HW2, HD2, 3, 3)
    collar = box(g, CX - HW1 - 1, Y2, CZ - HD1 - 2, CX + HW1 + 1, Y2 + 3, CZ + HD1 + 2, "iron", 4)
    P.flat(g, collar, "iron", 4)
    P.flat(g, edges(collar), "iron", 2)
    light_top(g, collar, "iron", 6)
    P.flat(g, collar & (np.floor(X + Z) % 5 == 0) & (np.abs(Y - (Y2 + 1)) < 0.6), "gold", 6)
    # a copper cable run up the +x rail of both stages
    for y0, y1, hw in ((YP, Y2, HW1), (Y2 + 3, Y3, HW2)):
        cab = box(g, CX + hw, y0, CZ - 2, CX + hw + 3, y1, CZ + 2, "rust", 5)
        P.flat(g, cab, "rust", 5)
        P.flat(g, cab & (np.floor(Y) % 5 == 0), "rust", 3)
        P.flat(g, edges(cab), "rust", 3)
    # the service deck: a plated octagon with a hazard rim
    n1 = len(g.solids)
    deck = ngon_y(g, CX, CZ, 11, Y3, YD, "steel", 5, n=8)
    plate_facets(g, g.solids[n1:], "steel", 5, size=(6, 3), seed=4)
    rd = ngon_radius(g, "y", CX, CZ, 8)
    hazard(g, deck & (rd > 9.0), period=4, a=("orange", 5), b=("steel", 3), frame="top")
    light_top(g, deck & (rd <= 9.0), "steel", 6)
    P.flat(g, edges(deck), "steel", 3)
    return g


def yoke() -> Grid:
    """The turning yoke: a steel slew ring, a copper post and the red beacon."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    ring = ngon_y(g, CX, CZ, 6.5, YD, YD + 2, "steel", 4, n=8)
    P.flat(g, ring, "steel", 4)
    light_top(g, ring, "steel", 6)
    P.flat(g, ring & (np.floor(X + Z) % 4 == 0), "gold", 6)
    post = box(g, CX - 3, YD + 2, CZ - 3, CX + 3, YH - 2, CZ + 3, "rust", 5)
    P.flat(g, post, "rust", 5)
    P.flat(g, post & (np.floor(Y) % 5 == 0), "rust", 3)
    P.flat(g, edges(post), "rust", 3)
    P.flat(g, post & (Z < CZ - 2.4) & (np.abs(X - CX) < 1.4), "cyan", 6)
    # the beacon on a stub arm behind the post, so it turns with the dish
    arm = box(g, CX - 2, YH - 4, CZ + 3, CX + 2, YH - 1, CZ + 8, "iron", 4)
    P.flat(g, arm, "iron", 4)
    P.flat(g, edges(arm), "iron", 2)
    lens = ngon_y(g, CX, CZ + 6, 3.0, YH - 1, YH + 3, "orange", 5, n=8)
    P.flat(g, lens, "orange", 5)
    P.flat(g, lens & (Z > CZ + 6), "gold", 7)
    cap = ngon_y(g, CX, CZ + 6, 2.6, YH + 3, YH + 5, "iron", 4, n=8, r_top=1.3)
    P.flat(g, cap, "iron", 4)
    return g


def dish() -> Grid:
    """The oversized bowl: a white faceted frustum with an orange rim,
    painted range rings, three struts and a copper feed horn."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    zf = CZ - 7
    n0 = len(g.solids)
    m = cone(g, "z", CX, YH, 13, zf, zf + 6, "bone", 6, n=10, r_top=5, tip="hi")
    facet_paint(g, g.solids[n0:], lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(16, 13), rivets=False, frame=fr, seed=5))
    d = ngon_radius(g, "z", CX, YH, 10)
    face = m & (Z < zf + 1)
    P.flat(g, m, "bone", 5)
    P.flat(g, face, "bone", 6)
    for r0, r1, sh in ((3.0, 4.6, 5), (7.4, 9.0, 5)):
        P.flat(g, face & (d > r0) & (d <= r1), "bone", sh)
    P.flat(g, face & (d > 10.8), "orange", 6)
    P.flat(g, m & (Z > zf + 1) & (d > 9.8), "orange", 5)
    P.flat(g, edges(m), "bone", 4)
    hub = box(g, CX - 3, YH - 3, zf + 5, CX + 3, YH + 3, zf + 9, "steel", 4)
    P.flat(g, hub, "steel", 4)
    P.flat(g, edges(hub), "steel", 2)
    # three struts and the copper feed horn with a cyan tip
    tip_z = zf - 8
    bar(g, "x", (YH + 11.5, zf), (YH + 1, tip_z), 1.6, CX - 0.9, CX + 0.9, "steel", 5)
    for s in (-1, 1):
        bar(g, "y", (CX + s * 11.5, zf), (CX + s * 1, tip_z), 1.6, YH - 0.9, YH + 0.9, "steel", 5)
    horn = box(g, CX - 2, YH - 2, tip_z - 3, CX + 2, YH + 2, tip_z + 2, "rust", 5)
    P.flat(g, horn, "rust", 5)
    P.flat(g, edges(horn), "rust", 3)
    P.flat(g, horn & (Z < tip_z - 2), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.add("mast", mast(), (CX, 0, CZ))
    rig.add("yoke", yoke(), (CX, YD, CZ), "mast")
    rig.add("dish", dish(), (CX, YH, CZ), "yoke", rot=(-22.0, 0.0, 0.0))
    idle = {"yoke": {"rot": wave(8.0, "y", 52.0)},
            "dish": {"rot": wave(8.0, "x", 7.0, phase=1.2, base=(-22.0, 0.0, 0.0))}}
    spin_ = {"yoke": {"rot": spin(5.0, "y", 360)}}
    sig = rig.sock("socket-signal", (CX, YH, CZ - 18), parent="dish")
    return asset("animated-props", "antenna-mast", "Antenna Mast", rig.root,
                 clips=[Clip("idle", idle), Clip("spin", spin_)],
                 sockets=[sig],
                 pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-signal", "trigger": "clip:spin", "size": 22, "aim": [0.0, 0.0, -1.0], "at": 0.3}])
