"""Matter fabricator, in the Pirate Nation mecha style.

An open-gantry deck printer, built so nothing sits in a recess: a chamfered
steel cabinet on a hazard plinth with a teal console, a hazard build deck on
top, two thick orange gantry rails and a cross bar over the deck (F3, F4).
The oversized function prop stands in the open on the deck: a chunky white
hull bracket, half made, its fresh top layers still glowing cyan, under a
print head that hangs from the bar on a copper feed. A tilted FAB sign and a
warning lamp cap the rails (F5). On `active` the head sweeps the deck, the
platform steps down a layer and the bracket rises out of it; on `idle` the
head rests and bobs. Sparks bind at the nozzle. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Part, Rig, asset, box, coords, edges, front, hazard, keys, light_top, ngon_y, plate_facets, plated, side, wave
from pnshapes import facets
from voxgrid import C
import pnglyph

S = (34, 46, 34)
CX, CZ = 17, 17
YC = 16  # cabinet top
DECK = 18  # the build platform top at rest
PART = 6  # the bracket on the platform is this tall
YN = 24  # the nozzle tip, level with the top of the bracket
YH = 34  # the print head block top
YBAR = 34  # the gantry cross bar
YTOP = 36  # the rail tops
RX = (2, 28)  # the gantry rails
HX = CX - 6  # the head parks off centre at rest, so the bracket stays clear


def cabinet() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pl = ngon_y(g, CX, CZ, 15, 0, 3, "iron", 5, n=8)
    hazard(g, pl, period=4, a=("orange", 5), b=("iron", 5))
    light_top(g, pl, "steel", 4)
    n0 = len(g.solids)
    body = ngon_y(g, CX, CZ, 14, 3, YC, "steel", 5, n=8, r_top=13)
    plate_facets(g, g.solids[n0:], "steel", 5, size=(9, 7), seed=1)
    P.flat(g, edges(body), "steel", 3)
    # the console: a sloped teal screen and chunky buttons on the front
    con = side(g, [(YC - 7, CZ - 15), (YC - 7, CZ - 9), (YC, CZ - 10), (YC, CZ - 15)], CX - 9, CX + 9, "steel", 4)
    P.flat(g, con, "steel", 4)
    P.flat(g, edges(con), "steel", 2)
    top = con & (Y > YC - 2.2)
    P.flat(g, top, "teal", 4)
    for x0 in (CX - 6, CX + 1):
        P.flat(g, top & (X > x0) & (X < x0 + 5), "cyan", 6)
    P.flat(g, con & (Z < CZ - 14) & (np.abs(X - (CX - 6)) < 1.5) & (np.abs(Y - (YC - 4)) < 1.5), "gold", 6)
    P.flat(g, con & (Z < CZ - 14) & (np.abs(X - (CX - 2)) < 1.5) & (np.abs(Y - (YC - 4)) < 1.5), "cyan", 6)
    # drawer fronts and a copper feed trunk up the +x flank to the bar
    for yy in (5, 10):
        dr = box(g, CX + 1, yy, CZ - 15, CX + 12, yy + 4, CZ - 14, "bone", 6)
        P.flat(g, edges(dr), "bone", 4)
        P.flat(g, dr & (np.abs(X - (CX + 6)) < 2.5), "rust", 5)
    feed = box(g, CX + 12, 4, CZ - 2, CX + 15, YBAR, CZ + 2, "rust", 5)
    P.flat(g, feed, "rust", 5)
    P.flat(g, feed & (np.floor(Y) % 6 == 2), "rust", 3)
    P.flat(g, edges(feed), "rust", 3)
    gantry(g)
    return g


def gantry(g: Grid) -> None:
    """Two orange rails and a cross bar standing in the open over the deck,
    so the head and the part are lit from the front, never in a recess."""
    X, Y, Z = coords(g)
    rails = np.zeros(g.shape, dtype=bool)
    for x0 in RX:
        rails |= box(g, x0, YC, CZ - 5, x0 + 4, YTOP, CZ + 5, "orange", 5)
    P.flat(g, rails, "orange", 5)
    P.flat(g, edges(rails), "orange", 3)
    hazard(g, rails & (Y < YC + 5), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, rails & (Z < CZ - 4) & (np.abs(Y - (YC + 11)) < 5), "cyan", 6)  # travel strips
    P.flat(g, rails & (Y > YTOP - 1.5), "orange", 6)
    bar = box(g, RX[0] + 1, YBAR, CZ - 3, RX[1] + 3, YBAR + 3, CZ + 5, "steel", 5)
    plated(g, bar, "steel", 5, size=(6, 3), seed=2)
    P.flat(g, edges(bar), "steel", 3)
    light_top(g, bar, "steel", 6)
    P.flat(g, bar & (Z < CZ - 2), "orange", 5)
    P.flat(g, bar & (Z < CZ - 2) & (np.floor(X) % 6 < 3), "iron", 4)  # the travel rack
    # a warning lamp on the +x rail top
    P.flat(g, rails & (X > RX[1] + 0.5) & (Y > YTOP - 2.5), "gold", 7)


def deck() -> Grid:
    """The build platform: a hazard-edged steel plate on a lift column."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    col = box(g, CX - 4, YC - 4, CZ - 2, CX + 4, DECK - 2, CZ + 4, "iron", 5)
    P.flat(g, col, "iron", 5)
    P.flat(g, col & (np.floor(Y) % 3 == 0), "steel", 4)
    pl = box(g, CX - 11, DECK - 2, CZ - 8, CX + 11, DECK, CZ + 8, "steel", 5)
    plated(g, pl, "steel", 5, size=(5, 5), seed=4)
    P.flat(g, edges(pl), "steel", 3)
    P.flat(g, pl & (Y > DECK - 1) & (np.floor(X + Z) % 4 == 0), "steel", 6)
    hazard(g, pl & (Y > DECK - 1) & ((np.abs(X - CX) > 8) | (np.abs(Z - CZ) > 5)), period=4,
           a=("orange", 5), b=("steel", 3), frame="top")
    return g


def printed() -> Grid:
    """The half-made part on the platform: a chunky white hull bracket, cut
    level, standing in the open so it reads at 128 px."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    m = front(g, [(CX - 8, DECK), (CX + 8, DECK), (CX + 8, DECK + 2), (CX + 4, DECK + PART),
                  (CX - 4, DECK + PART), (CX - 8, DECK + 2)], CZ - 5, CZ + 4, "bone", 7)
    for f, fr in facets(g, g.solids[n0:]):
        P.plates(g, f, "bone", 7, size=(5, 4), rivets=False, frame=fr)
    P.flat(g, edges(m), "bone", 4)
    P.flat(g, m & (np.abs(Y - (DECK + 1)) < 0.7), "orange", 5)  # a printed trim line
    P.flat(g, m & (np.abs(Z - CZ) < 1.0), "bone", 5)  # the seam the head last ran down
    P.flat(g, m & (Y > DECK + PART - 2), "cyan", 6)  # the fresh top layer still glows
    P.flat(g, m & (Y > DECK + PART - 1), "cyan", 7)
    return g


def head() -> Grid:
    """The print head hanging from the bar: a steel block with an orange
    face, a copper feed coil and a glowing nozzle."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    blk = box(g, HX - 4, YH - 8, CZ - 9, HX + 4, YH - 1, CZ + 1, "steel", 5)
    plated(g, blk, "steel", 5, size=(5, 4), seed=5)
    P.flat(g, edges(blk), "steel", 3)
    P.flat(g, blk & (Y > YH - 2.5), "orange", 5)
    face = blk & (Z < CZ - 8)
    P.flat(g, face, "orange", 5)
    P.flat(g, face & (np.abs(X - HX) < 3) & (Y > YH - 7) & (Y < YH - 3), "cyan", 6)
    P.flat(g, face & (np.abs(X - HX) < 1.2) & (Y > YH - 7) & (Y < YH - 3), "cyan", 7)
    # the carriage that joins the head to the bar behind it
    car = box(g, HX - 3, YH - 3, CZ - 1, HX + 3, YBAR + 1, CZ + 5, "iron", 5)
    P.flat(g, car, "iron", 5)
    P.flat(g, edges(car), "iron", 3)
    P.flat(g, car & (Z < CZ), "gold", 6)
    coil = box(g, HX + 3, YH - 7, CZ - 7, HX + 9, YH - 2, CZ - 3, "rust", 5)
    P.flat(g, coil, "rust", 5)
    P.flat(g, coil & (np.floor(Y) % 2 == 0), "rust", 3)
    P.flat(g, edges(coil), "rust", 3)
    noz = ngon_y(g, HX, CZ - 4, 3.0, YN, YH - 8, "steel", 4, n=8, r_top=1.5)
    P.flat(g, noz, "steel", 4)
    P.flat(g, edges(noz), "steel", 2)
    P.flat(g, noz & (Y < YN + 1.4), "orange", 6)
    return g


def board() -> Grid:
    """The FAB sign board on the -x rail top."""
    g = Grid(20, 12, 6)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 2, 20, 10, 4, "orange", 5)
    P.flat(g, m, "orange", 5)
    P.flat(g, edges(m), "orange", 3)
    P.flat(g, m & (Y > 8.5), "orange", 6)
    pnglyph.text(g, "-z", 2, 2, 2, "FAB", "bone", 7, scale=1, depth=1, reach=0)
    return g


def build():
    rig = Rig()
    rig.add("fabricator", cabinet(), (CX, 0, CZ))
    rig.add("deck", deck(), (CX, YC, CZ), "fabricator")
    rig.add("print", printed(), (CX, DECK, CZ), "deck")
    rig.add("head", head(), (HX, YH, CZ), "fabricator")
    sign = Part("sign", board(), pivot=(10.0, 0.0, 3.0), at=(float(RX[0] + 2 - CX), float(YTOP), 0.0), rot=(0.0, 0.0, 9.0))
    rig.root.children.append(sign)
    z = (0.0, 0.0, 0.0)
    # the bracket rises out of the platform instead of scaling, so one voxel
    # stays one unit in every frame (scale.node)
    active = {
        "head": {"loc": keys((0, z), (0.75, (12, 0, 0)), (1.5, z), (2.25, (12, 0, 0)), (3.0, z))},
        "deck": {"loc": keys((0, (0, -2, 0)), (1.5, (0, -1, 0)), (3.0, (0, -2, 0)))},
        "print": {"loc": keys((0, z), (1.5, (0, 2, 0)), (3.0, z))},
    }
    idle = {"head": {"loc": wave(4.0, "y", 0.4)}, "deck": {"loc": wave(4.0, "y", 0.3, phase=1.6)}}
    nozzle = rig.sock("socket-nozzle", (HX, YN, CZ - 4), parent="head")
    return asset("animated-props", "fabricator", "Matter Fabricator", rig.root,
                 clips=[Clip("active", active), Clip("idle", idle)], sockets=[nozzle],
                 pfx=[{"effectId": "rvx-space-weld-sparks", "socket": "socket-nozzle", "trigger": "clip:active", "size": 7, "aim": [0.0, -1.0, 0.0]}])
