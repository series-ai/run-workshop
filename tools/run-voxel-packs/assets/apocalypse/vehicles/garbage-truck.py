"""Scavenger garbage truck, in the Pirate Nation style.

A chunky caricature refuse truck (rule F4): a stubby olive cab with a steep
windscreen and a sloped hood (true slopes, rule F2) pulls a huge ribbed
hopper with chamfered shoulders and a sloped front wall, on six fat octagonal wheels. The oversized
function prop (rules F4, K1) is the rear packer: a tall tail loader with a
toothed hopper lip and two fat rams, which swings wide on `active`. A
bull bar of welded pipe, a tall twin exhaust stack, a roof light bar, a
salvage rack of drums and a spare tyre finish it. Ribs, the SANITATION
stencil, hazard stripes, rust blooms and grime are paint (rule S1).
Clips: move (the wheels roll), idle (the engine shakes), active (the
tail loader lifts and drops). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _bld import bloom, label, rig, wheel_grid
from _cars import glass_pane, headlight, rivet_row
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket

GW, GH, GD = 64, 94, 138
BX0, BX1 = 8, 56  # the body sides
R, TW = 12, 9  # the wheel flat radius and tread width
FLOOR = 24  # the chassis deck, clear of the wheels
CAB0, CAB1, CAB_TOP = 4, 44, 64
HOP0, HOP1, HOP_TOP = 44, 112, 74
TAIL0, TAIL1 = 112, 132
HINGE = (32.0, 74.0, 112.0)  # the tail loader hinge, high on the back of the hopper
AXLES = (28.0, 76.0, 98.0)
PAINT = ("khaki", 4)
# the cab side profile as (z, y), front to back
CAB = [(CAB0, FLOOR), (CAB0, 44), (CAB0 + 6, 50), (18, 52), (24, CAB_TOP), (40, CAB_TOP), (CAB1, 58), (CAB1, FLOOR)]


def chassis(g: Grid) -> np.ndarray:
    """Two deep frame rails, the axle beams and the fuel tank."""
    X, Y, Z = S.coords(g)
    m = np.zeros(g.shape, dtype=bool)
    for rx in (14, 44):
        m |= box(g, rx, 16, 2, rx + 6, FLOOR, TAIL1, "steel", 3)
    for az in AXLES:  # the axle beams out to the hubs
        m |= box(g, 2, 8, az - 3, 62, 15, az + 3, "steel", 4)
    P.plates(g, m, "steel", 3, size=(14, 5), rivets=True, seed=1)
    P.flat(g, edges(m), "steel", 2)
    tank = S.disc(g, "z", 6.0, 19.0, 5.0, 50, 76, "steel", 5, n=8)
    P.flat(g, tank & (np.floor(Z) % 9 == 0), "steel", 3)
    P.flat(g, tank & (Y < 16), "steel", 3)
    return m | tank


def cab(g: Grid) -> np.ndarray:
    """The olive cab: a steep windscreen, a grille, lamps and a bull bar."""
    X, Y, Z = S.coords(g)
    ramp, sh = PAINT
    g.prism("x", [(y, z) for z, y in CAB], BX0, BX1, C(ramp, sh))
    m = S.last(g)
    P.plates(g, m, ramp, sh, size=(13, 10), rivets=False, seed=2)
    for fm, fr in S.facets(g, [g.solids[-1]]):
        if fr == "top":
            P.flat(g, fm, ramp, sh + 2)
    P.flat(g, m & (Y > CAB_TOP - 2) & (Z > 28) & (Z < 38), "bone", 6)  # the cream roof hatch
    P.flat(g, m & (Y > 42) & (Y < 44), ramp, sh - 2)  # the belt line
    P.flat(g, m & (Y < FLOOR + 4), ramp, sh - 2)
    # the glass: a steep windscreen and two door windows
    ws = m & (Y > 50) & (Y < CAB_TOP - 2) & (Z > 18) & (Z < 27) & (X > BX0 + 2) & (X < BX1 - 2)
    glass_pane(g, ws, seed=3, base=("navy", 1), glint=("sky", 4), period=13)
    for x in (BX0, BX1 - 1):
        win = m & (np.abs(X - x - 0.5) < 0.6) & (Y > 46) & (Y < 58) & (Z > 28) & (Z < CAB1 - 4)
        glass_pane(g, win, seed=4, base=("navy", 1), glint=("sky", 4), period=11)
        P.outline(g, win, ramp, sh - 2, normal="x")
        P.flat(g, m & (np.abs(X - x - 0.5) < 0.6) & (Y > 32) & (Y < 36) & (Z > 30) & (Z < 38), "steel", 6)  # the door handle
    # the nose: a toothed grille, round lamps and a welded pipe bull bar
    grille = box(g, 18, 28, CAB0 - 1, 46, 42, CAB0, "steel", 5)
    P.flat(g, grille & (np.floor(X) % 3 == 0), "steel", 3)
    P.outline(g, grille, "steel", 2, normal="z")
    for hx in (13.0, 51.0):
        headlight(g, hx, 34.0, CAB0, r=3.4, lens=("gold", 7), bezel=("steel", 6))
    bar = box(g, 4, 24, 0, 60, 29, 4, "steel", 4)
    bar |= S.bar(g, "x", (24.0, 1.5), (46.0, 1.5), 2.2, 6, 58, "steel", 4)
    for bx in (14, 30, 46):
        bar |= box(g, bx, 22, 0, bx + 4, 46, 3, "steel", 4)
    PP.hazard(g, bar & (Y < 29) & (Z < 2), period=7, a=("gold", 5), b=("darkwood", 3))
    P.flat(g, bar & (Y > 29), "steel", 5)
    P.flat(g, edges(bar), "steel", 2)
    return m | grille | bar


def hopper(g: Grid) -> np.ndarray:
    """The body: one ribbed prism with chamfered shoulders, a packing seam,
    a stencil down both sides and a salvage rack on the roof."""
    X, Y, Z = S.coords(g)
    ramp, sh = PAINT
    prof = [(BX0 + 5, FLOOR), (BX1 - 5, FLOOR), (BX1, FLOOR + 6), (BX1, HOP_TOP - 8),
            (BX1 - 7, HOP_TOP), (BX0 + 7, HOP_TOP), (BX0, HOP_TOP - 8), (BX0, FLOOR + 6)]
    g.prism("z", prof, HOP0 + 6, HOP1, C(ramp, sh))
    m = S.last(g)
    # the sloped front wall of the hopper, up off the cab roof (a true slope)
    g.prism("x", [(FLOOR, HOP0), (HOP_TOP - 6, HOP0), (HOP_TOP - 6, HOP0 + 6), (FLOOR, HOP0 + 6)], BX0 + 2, BX1 - 2, C(ramp, sh))
    m |= S.last(g)
    g.prism("x", [(CAB_TOP - 4, HOP0 - 8), (HOP_TOP - 6, HOP0), (HOP_TOP - 6, HOP0 + 6), (FLOOR, HOP0 + 6), (FLOOR, HOP0 - 8)], BX0 + 4, BX1 - 4, C(ramp, sh))
    m |= S.last(g)
    for fm, fr in S.facets(g, [g.solids[-1]]):
        PP.corrugate(g, fm, ramp, sh, period=4, sheet=15, length=40, frame=fr, seed=5)
    P.flat(g, m & (Y > HOP_TOP - 9) & (Y < HOP_TOP - 7), ramp, sh - 2)  # the chamfer shadow
    P.flat(g, m & (Y < FLOOR + 5), ramp, sh - 2)
    for by in (FLOOR + 7, HOP_TOP - 13):  # two cream body bands with a dark lip
        P.flat(g, m & (Y > by) & (Y < by + 3), "bone", 6)
        P.flat(g, m & (np.abs(Y - by) < 0.6), ramp, sh - 2)
    for face, plane in (("+x", BX1), ("-x", BX0)):  # the stencil, never mirrored
        label(g, face, plane, (HOP0 + HOP1) / 2 + 3, FLOOR + 18, "WASTE", "bone", 7, scale=2, gap=1)
    bloom(g, m, 9, ((BX0, FLOOR, HOP0), (BX1, HOP_TOP, HOP1)), r=(2.5, 5.0), ramp="rust", shades=(5, 4), seed=6)
    # the roof: a walkway, a rack of drums and a lashed spare tyre
    walk = box(g, 20, HOP_TOP, HOP0 + 4, 44, HOP_TOP + 2, HOP1 - 4, "steel", 4)
    P.flat(g, walk & (np.floor(Z) % 4 == 0), "steel", 2)
    for cz in (HOP0 + 12, HOP0 + 30):
        S.drum(g, 32, cz, HOP_TOP + 2, 12, 5.5, ramp="red", base=4, band=("bone", 6), wear=True, seed=int(cz))
    S.tyre(g, "y", 32.0, HOP1 - 12, 8.0, HOP_TOP + 2, HOP_TOP + 7, rubber=("gray", 3), hub=("steel", 5), n=8)
    for rz in (HOP0 + 6, HOP0 + 38, HOP1 - 6):  # the rack hoops over the walkway
        S.bar(g, "x", (HOP_TOP + 2, rz), (HOP_TOP + 15, rz), 1.6, 18, 20, "steel", 4)
        S.bar(g, "x", (HOP_TOP + 2, rz), (HOP_TOP + 15, rz), 1.6, 44, 46, "steel", 4)
        S.bar(g, "z", (18.0, HOP_TOP + 14), (46.0, HOP_TOP + 14), 1.6, rz, rz + 2, "steel", 4)
    # the twin exhaust stacks behind the cab, and the hydraulic lines
    for sx in (BX0 - 2.5, BX1 + 2.5):
        st = S.disc(g, "y", sx, HOP0 + 6, 2.6, FLOOR, 82, "steel", 4, n=8)
        P.flat(g, st & (np.floor(Y) % 9 == 0), "steel", 3)
        P.flat(g, st & (Y > 78), "darkwood", 3)  # the sooted mouth
        S.disc(g, "y", sx, HOP0 + 6, 3.6, 82, 84, "steel", 5, n=8)
    for hz in (HOP0 + 14, HOP0 + 22):
        S.bar(g, "z", (BX1 + 1.0, FLOOR + 4), (BX1 + 1.0, HOP_TOP - 10), 1.3, hz, hz + 2, "rust", 4)
    return m | walk


def tailgate() -> Grid:
    """The rear packer: a tall ribbed loader with a toothed hopper lip, two
    fat rams and a hazard-striped bumper (the function prop)."""
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    prof = [(BX0 - 1, 18), (BX1 + 1, 18), (BX1 + 1, HOP_TOP - 6), (BX1 - 6, HOP_TOP + 2), (BX0 + 6, HOP_TOP + 2), (BX0 - 1, HOP_TOP - 6)]
    g.prism("z", prof, TAIL0, TAIL1 - 4, C("steel", 4))
    m = S.last(g)
    for fm, fr in S.facets(g, [g.solids[-1]]):
        P.plates(g, fm, "steel", 4, size=(12, 9), rivets=True, frame=fr, seed=7)
    # the open hopper mouth at the back: a dark throat under a toothed lip
    g.prism("x", [(26, TAIL1 - 4), (26, TAIL1), (52, TAIL1), (52, TAIL1 - 10)], BX0 + 3, BX1 - 3, C("steel", 3))
    mouth = S.last(g)
    P.flat(g, mouth, "steel", 2)
    P.flat(g, mouth & (Y > 48), "steel", 3)
    for tx in range(BX0 + 4, BX1 - 4, 6):  # the teeth along the lip
        box(g, tx, 22, TAIL1 - 5, tx + 4, 28, TAIL1 - 1, "bone", 6)
    P.flat(g, m & (Y > HOP_TOP - 7) & (Y < HOP_TOP - 5), "steel", 2)
    PP.blotch(g, m, "rust", 5, cell=5, chance=0.08, seed=8)
    for ry, rr in ((50.0, 5.0), (34.0, 4.0)):  # two rust blooms with bleeds
        d = np.hypot(Y - ry, (Z - (TAIL0 + 6)) * 0.7)
        P.flat(g, m & (d < rr) & (X > BX1 - 2), "rust", 5)
        P.flat(g, m & (d < rr * 0.5) & (X > BX1 - 2), "rust", 4)
    # two fat hydraulic rams down the sides, with bright polished stems
    for sx in (BX0 - 2, BX1 - 1):
        ram = S.bar(g, "z", (sx + 1.5, 30.0), (sx + 1.5, 62.0), 3.0, TAIL0 - 2, TAIL0 + 4, "steel", 5)
        P.flat(g, ram & (Y > 44) & (Y < 58), "bone", 7)
        P.flat(g, edges(ram), "steel", 3)
    # the rear bumper, a hazard panel and two tail lights
    bump = box(g, BX0 - 3, 18, TAIL1 - 6, BX1 + 3, 26, TAIL1, "steel", 4)
    PP.hazard(g, bump, period=7, a=("gold", 5), b=("darkwood", 3))
    P.flat(g, edges(bump), "steel", 2)
    for tx in (BX0 - 1, BX1 - 5):
        P.flat(g, m & (np.abs(Z - (TAIL1 - 5)) < 1.2) & (X > tx) & (X < tx + 6) & (Y > 38) & (Y < 46), "red", 5)
    rivet_row(g, range(BX0, BX1, 7), [HOP_TOP - 10], [TAIL0], C("steel", 6))
    return g


def build() -> Asset:
    g = Grid(GW, GH, GD)
    chassis(g)
    cab(g)
    hopper(g)
    wheels = [wheel_grid(g.shape, x0, x0 + TW, az, R, rim=("steel", 6), hub=("gold", 5), spokes=6, tyre=("gray", 3))
              for az in AXLES for x0 in (BX0 - 6, BX1 - TW + 6)]
    swing = [(0.0, (0.0, 0.0, 0.0)), (0.9, (-44.0, 0.0, 0.0)), (2.1, (-44.0, 0.0, 0.0)),
             (2.7, (-6.0, 0.0, 0.0)), (2.9, (0.0, 0.0, 0.0)), (3.4, (0.0, 0.0, 0.0))]
    parts = [("tailgate", tailgate(), HINGE, (0.0, 0.0, 0.0), None, None)]
    root, clips, socks = rig("garbage-truck", g, wheels, (BX1 + 2.5, 84.0, HOP0 + 6), spin_s=0.9,
                             body_parts=parts, bounce=0.5,
                             extra_sockets=[("socket-stack", (BX0 - 2.5, 84.0, HOP0 + 6))])
    rp = root.pivot
    socks.append(Socket("socket-mouth", at=(0.0, 30.0 - rp[1], float(TAIL1) - rp[2]), parent="tailgate"))
    clips.append(Clip("active", {"tailgate": {"rot": [(t, v) for t, v in swing]}}))
    return Asset(id="apocalypse-vehicles-garbage-truck", pack="apocalypse", category="vehicles",
                 name="Scavenger Garbage Truck", root=root, clips=clips, sockets=socks,
                 pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 26, "aim": [0.0, 1.0, 0.0]},
                      {"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-stack", "trigger": "idle", "size": 18},
                      {"effectId": "rvx-apocalypse-crate-dust", "socket": "socket-mouth", "trigger": "clip:active", "size": 36, "at": 2.9}])
