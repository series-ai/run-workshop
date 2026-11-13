"""Docking clamp, in the Pirate Nation mecha style.

A deck clamp that grips a ship's landing strut: a hazard-striped octagonal
plinth, a plated steel column that tapers as it rises (true slopes, F2)
with a sloped teal console on the front, and a thick orange yoke on top.
The oversized function prop is the pair of claws: chunky curved jaws that
lean in over the yoke and meet at the tip, each with a copper ram, a dark
grip pad and a hazard heel (F3, F4). A warning lamp caps the column. On
`open` the jaws swing apart, on `close` they bite shut; on `idle` the lamp
turns and the jaws breathe. Steam vents from the ram on `open`. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, light_top, ngon_y, octo, plan, plate_facets, plated, side, spin, wave

S = (46, 52, 36)
CX, CZ = 23, 18
YP = 4    # plinth top
YT = 7    # turntable top
YC = 26   # column top
YY = 32   # yoke top
HX, HY = 9, 29   # the jaw hinge, offset from the centre in x


def column() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the plinth: a hazard-striped octagon with a lit rim
    pl = ngon_y(g, CX, CZ, 17, 0, YP, "iron", 5, n=8)
    hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    light_top(g, pl, "steel", 4)
    ring = ngon_y(g, CX, CZ, 14, YP, YT, "steel", 3, n=8)
    P.flat(g, ring, "steel", 3)
    P.flat(g, ring & (np.floor(X + Z) % 5 == 0), "steel", 6)   # painted bolt heads
    light_top(g, ring, "steel", 5)
    # the column: a chamfered steel tower that tapers to the yoke
    n0 = len(g.solids)
    body = plan(g, octo(CX, CZ, 12, 10, 4), YT, YC, "steel", 5, top=octo(CX, CZ, 10, 8, 3))
    plate_facets(g, g.solids[n0:], "steel", 5, size=(10, 8), seed=1)
    P.flat(g, edges(body), "steel", 3)
    band(g, body, 1, YT, YT + 2, "iron", 4)
    P.flat(g, body & (np.abs(Y - 17) < 1.2), "orange", 5)      # a service stripe
    # the console: a sloped teal screen with chunky buttons on the front
    con = side(g, [(14, CZ - 12), (14, CZ - 7), (20, CZ - 8), (20, CZ - 12)], CX - 7, CX + 7, "steel", 4)
    P.flat(g, con, "steel", 4)
    P.flat(g, edges(con), "steel", 2)
    face = con & (Y > 18.4)
    P.flat(g, face, "teal", 4)
    P.flat(g, face & (np.abs(X - CX) < 4), "cyan", 6)
    P.flat(g, face & (np.abs(X - CX) < 1.4), "cyan", 7)
    for bx, ink in ((CX - 5, "gold"), (CX + 5, "orange")):
        P.flat(g, con & (Z < CZ - 11) & (np.abs(X - bx) < 1.4) & (np.abs(Y - 16) < 1.4), ink, 6)
    # the yoke the jaws hinge in, with painted trunnion caps
    yk = box(g, CX - 14, YC, CZ - 8, CX + 14, YY, CZ + 8, "orange", 5)
    P.flat(g, yk, "orange", 5)
    P.flat(g, edges(yk), "orange", 3)
    light_top(g, yk, "orange", 6)
    hazard(g, yk & (np.abs(X - CX) > 11), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    for sx in (-1, 1):
        cap = yk & (np.abs(X - (CX + sx * HX)) < 3.2) & (Z < CZ - 7)
        P.flat(g, cap, "steel", 5)
        P.flat(g, cap & (np.abs(X - (CX + sx * HX)) < 1.4) & (np.abs(Y - (YC + 3)) < 1.4), "gold", 6)
    # a vent box on the +x flank, where the hydraulics breathe
    vb = box(g, CX + 10, 9, CZ - 4, CX + 14, 16, CZ + 4, "iron", 4)
    P.flat(g, vb, "iron", 4)
    P.flat(g, edges(vb), "iron", 2)
    P.flat(g, vb & (X > CX + 13) & (np.floor(Y) % 2 == 0), "steel", 6)
    return g


def lamp() -> Grid:
    """The warning lamp: an octagonal amber lens with one lit reflector side."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    collar = ngon_y(g, CX, CZ, 4, YY, YY + 1, "steel", 3, n=8)
    P.flat(g, collar, "steel", 3)
    lens = ngon_y(g, CX, CZ, 3.2, YY + 1, YY + 5, "orange", 5, n=8)
    P.flat(g, lens, "orange", 5)
    P.flat(g, lens & (Z < CZ), "gold", 7)
    P.flat(g, lens & (Y > YY + 4), "orange", 6)
    cap = ngon_y(g, CX, CZ, 2.6, YY + 5, YY + 7, "steel", 4, n=8, r_top=1.4)
    P.flat(g, cap, "steel", 4)
    return g


def jaw(s: int) -> Grid:
    """One claw: a thick arm that leans in over the yoke and ends in a
    narrower hooked tip, with a copper ram boss, dark grip teeth on the
    inward face and a hazard heel. `s` = -1 low x, +1 high x."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    hx = CX + s * HX
    i = -s  # inward: toward the centre line
    # the forearm, a thick front prism that leans in (true slopes both ways)
    pts = [(hx - i * 6, HY - 4), (hx + i * 6, HY - 4), (hx + i * 7, HY + 4),
           (hx + i * 7, HY + 13), (hx + i * 1, HY + 13), (hx - i * 3, HY + 4)]
    if i < 0:
        pts = pts[::-1]
    arm = front(g, pts, CZ - 7, CZ + 7, "steel", 5)
    plated(g, arm, "steel", 5, size=(7, 6), seed=2 + (s > 0))
    P.flat(g, edges(arm), "steel", 3)
    # the hooked tip: narrower in x and z, so the silhouette steps in (F3)
    tip_pts = [(hx + i * 7, HY + 10), (hx + i * 8, HY + 17), (hx + i * 4, HY + 19), (hx - i * 1, HY + 16), (hx + i * 1, HY + 10)]
    if i < 0:
        tip_pts = tip_pts[::-1]
    tip = front(g, tip_pts, CZ - 5, CZ + 5, "bone", 6)
    P.flat(g, tip, "bone", 6)
    P.flat(g, edges(tip), "bone", 4)
    P.flat(g, tip & (Y > HY + 16), "bone", 7)
    # the grip teeth on the inward faces of both arm and tip
    grip = (arm | tip) & ((X - hx) * i > 3.5) & (Y > HY)
    P.flat(g, grip, "rust", 5)
    P.flat(g, grip & (np.floor(Y) % 3 == 0), "rust", 3)
    P.flat(g, grip & (np.floor(Y) % 6 == 1), "gold", 6)
    # a hazard heel and an orange band round the elbow
    hazard(g, arm & (Y < HY - 1.5), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, arm & (np.abs(Y - (HY + 7)) < 1.3) & ((X - hx) * i < 3.5), "orange", 5)
    # the copper ram boss on the outward flank, with a lit collar
    ram = front(g, [(hx - i * 7, HY - 1), (hx - i * 2, HY - 1), (hx - i * 1, HY + 8), (hx - i * 6, HY + 7)][::i], CZ - 3, CZ + 3, "rust", 5)
    P.flat(g, ram, "rust", 5)
    P.flat(g, ram & (np.floor(Y) % 4 == 1), "rust", 3)
    P.flat(g, edges(ram), "rust", 3)
    # a cyan sensor pip on the front of the tip, so the claw reads at 128 px
    eye = tip & (Z < CZ - 4) & (np.abs(Y - (HY + 15)) < 2.0) & (np.abs(X - (hx + i * 4)) < 2.0)
    P.flat(g, eye, "cyan", 6)
    P.flat(g, eye & (np.abs(Y - (HY + 15)) < 0.9), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.add("clamp", column(), (CX, 0, CZ))
    rig.add("lamp", lamp(), (CX, YY, CZ), "clamp")
    rig.add("jaw-l", jaw(-1), (CX - HX, HY, CZ), "clamp")
    rig.add("jaw-r", jaw(1), (CX + HX, HY, CZ), "clamp")
    z = (0.0, 0.0, 0.0)
    OPEN = 36.0
    open_ = {"jaw-l": {"rot": keys((0, z), (0.3, (0, 0, -4)), (1.0, (0, 0, OPEN)))},
             "jaw-r": {"rot": keys((0, z), (0.3, (0, 0, 4)), (1.0, (0, 0, -OPEN)))},
             "lamp": {"rot": spin(1.0, "y", 360)}}
    close = {"jaw-l": {"rot": keys((0, (0, 0, OPEN)), (0.7, (0, 0, -3)), (1.0, z))},
             "jaw-r": {"rot": keys((0, (0, 0, -OPEN)), (0.7, (0, 0, 3)), (1.0, z))},
             "lamp": {"rot": spin(1.0, "y", 360)}}
    idle = {"lamp": {"rot": spin(3.0, "y", 360)},
            "jaw-l": {"rot": wave(4.0, "z", 2.0)},
            "jaw-r": {"rot": wave(4.0, "z", -2.0)}}
    vent = rig.sock("socket-vent", (CX + 14, 13, CZ), parent="clamp")
    return asset("animated-props", "docking-clamp", "Docking Clamp", rig.root,
                 clips=[Clip("idle", idle), Clip("open", open_, loop=False), Clip("close", close, loop=False)],
                 sockets=[vent],
                 pfx=[{"effectId": "rvx-space-launch-steam", "socket": "socket-vent", "trigger": "clip:open", "size": 10, "aim": [1.0, 0.3, 0.0]}])
