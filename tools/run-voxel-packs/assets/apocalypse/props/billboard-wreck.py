"""Wrecked roadside billboard, in the Pirate Nation style.

A tall roadside landmark (rules F4, F6): two steel posts on concrete
footings, each held by a rear strut, carry a 64-wide board high above the
36-voxel person. The bottom of the board is at y = 36, so a person walks
under it. One post has buckled at a collar, so the board leans a few
degrees (rule F5). A box girder under the board carries a grated catwalk
with a yellow hand rail; its last section has broken off its hinge and
hangs down. The top-right corner of the board is torn away. The poster is
one bold graphic (RUN and a skull over a hazard band), torn in a few places
so the bare steel shows, with one peeled strip that hangs from the tear.
The back is corrugated sheet on battens. Two lamp hoods sit on the top
edge. Every mark is paint (rule S1); sloped faces carry only smooth paint,
never speckle (rule S3).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, root, rubble, rust_runs, weeds
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import C, Grid

# the root grid: footings, posts and struts
GW, GH, GD = 72, 64, 34
BOARD_Y = 36  # the girder bottom: at the head height of a person
BOARD_Z = 2  # the root z of the board grid's z = 0 (the catwalk front)
ZP = BOARD_Z + 11  # the post plane: the back face of the board
LEFT = 14  # the straight post (x)
RIGHT = (52.0, 55.5)  # the buckled post: the foot x and the collar x
KINK = 20.0  # the collar height of the buckled post
POST_TOP = 62

# the board grid
BW, BGH, BGD = 64, 38, 11
GY0, GY1 = 0, 7  # the box girder
PY0, PY1 = 7, 31  # the panel
FZ0, FZ1 = 7, 11  # the panel and the girder in z (the front face is at z = 7)
CAT_END = 48  # the fixed catwalk stops here; the broken section hangs from it
OUTLINE = [(0, PY0), (BW, PY0), (BW, 19), (60, 22), (62, 25), (57, 28), (55, PY1), (0, PY1)]  # the torn corner


def lamp(g: Grid, lx: int) -> None:
    """One gooseneck lamp on the top edge of the panel, its hood over the poster."""
    arm = box(g, lx, PY1, FZ0 + 1, lx + 2, PY1 + 6, FZ0 + 3, "steel", 4)
    arm |= box(g, lx, PY1 + 4, 3, lx + 2, PY1 + 6, FZ0 + 3, "steel", 4)
    P.flat(g, arm, "steel", 4)
    P.flat(g, edges(arm), "steel", 3)
    hood = box(g, lx - 2, PY1 + 1, 1, lx + 4, PY1 + 4, 6, "steel", 5)
    X, Y, Z = coords(g)
    P.flat(g, hood & (Y > PY1 + 3), "steel", 6)
    P.flat(g, hood & (Y < PY1 + 2), "gold", 6)  # the lamp glass under the hood
    P.flat(g, edges(hood) & (Y > PY1 + 2), "steel", 3)


def board() -> Grid:
    """The board: girder, panel, poster, catwalk and lamps."""
    g = Grid(BW, BGH, BGD)
    X, Y, Z = coords(g)
    # the box girder under the panel: rust-red plates with rivets
    gird = box(g, 0, GY0, FZ0, BW, GY1, FZ1, "rust", 4)
    P.plates(g, gird, "rust", 4, size=(8, 7), seed=2)
    P.flat(g, edges(gird), "rust", 2)
    # the panel: one prism with a torn top-right corner
    g.prism("z", OUTLINE, FZ0, FZ1, C("steel", 5))
    panel = g.solids[-1].mask(g.shape)
    P.flat(g, panel, "steel", 5)
    # the back: corrugated sheet on three battens and two rails
    back = panel & (Z > FZ1 - 1)
    pnpaint.corrugate(g, back, "steel", 5, period=3, sheet=12, length=PY1 - PY0, frame="z")
    for bx in (4, BW // 2 - 2, BW - 16):
        bat = back & (X > bx) & (X < bx + 4)
        P.flat(g, bat, "darkwood", 5)
        P.outline(g, bat, "darkwood", 4, normal="z")
    for by in (PY0 + 3, PY1 - 5):
        rail = back & (Y > by) & (Y < by + 3)
        P.flat(g, rail, "darkwood", 5)
        P.outline(g, rail, "darkwood", 4, normal="z")
    rust_runs(g, back, ((10, PY1 - 3, FZ1, 2.4), (BW - 12, PY0 + 8, FZ1, 2.2)), base=5, drip=5, seed=4)
    # the poster on the front face
    face = panel & (Z < FZ0 + 1)
    P.flat(g, face, "bone", 6)
    P.flat(g, face & (Y > PY1 - 6), "bone", 7)  # the sun-bleached top of the poster
    pnpaint.hazard(g, face & (Y < PY0 + 4) & (Y > PY0 + 1), period=6, a=("gold", 5), b=("darkwood", 4), frame="z")
    pnglyph.text(g, "-z", FZ0, 5, PY0 + 6, "RUN", "red", 4, scale=2)
    pnglyph.icon(g, "-z", FZ0, 40, PY0 + 5, "skull", "darkwood", 4, scale=2)
    # tears in the poster: bare steel under a ragged dark edge
    chips(g, face, ((3, PY1 - 3, FZ0, 3.6), (30, PY0 + 3, FZ0, 3.0), (BW - 3, PY0 + 6, FZ0, 3.2)), "steel", 4, seed=6)
    rust_runs(g, face, ((24, PY1 - 2, FZ0, 1.4), (50, PY1 - 2, FZ0, 1.4)), base=5, drip=6, seed=7)
    # the frame round the panel (none on the torn corner)
    rim = panel & ((X < 1) | (Y < PY0 + 1) | (Y > PY1 - 1) | ((X > BW - 1) & (Y < 19)))
    P.flat(g, rim, "steel", 4)
    # the peeled strip that hangs from the tear, one voxel proud of the face
    strip = bar(g, "z", (58.5, 23.0), (61.0, 12.0), 3.0, FZ0 - 1, FZ0, "bone", 7)
    P.flat(g, strip, "bone", 7)
    P.flat(g, strip & (Y < 15), "red", 4)  # a piece of the red print
    # the grated catwalk in front of the girder, with a hazard-yellow hand rail
    floor = box(g, 2, 5, 0, CAT_END, 7, FZ0, "steel", 5)
    P.flat(g, floor & ((np.floor(X) % 3 == 0) | (np.floor(Z) % 3 == 0)), "steel", 4)  # the grate
    P.flat(g, edges(floor), "steel", 3)
    for px in (2, 16, 30, CAT_END - 2):
        post = box(g, px, 7, 0, px + 2, 13, 2, "steel", 4)
        P.flat(g, post, "steel", 4)
    hand = box(g, 2, 12, 0, CAT_END, 14, 2, "gold", 5)
    P.flat(g, hand & (Y > 13), "gold", 6)
    P.flat(g, edges(hand), "gold", 3)
    for bx in (6, 24, 42):  # the brackets: true slopes from the girder to the catwalk front
        g.prism("x", [(5.0, 1.0), (5.0, float(FZ0)), (0.0, float(FZ0))], bx, bx + 2, C("steel", 4))
        P.flat(g, g.solids[-1].mask(g.shape), "steel", 4)
    lamp(g, 10)
    lamp(g, 32)
    return g


def broken_section() -> Grid:
    """The last catwalk section: it has broken off its hinge and hangs."""
    g = Grid(14, 9, 7)
    X, Y, Z = coords(g)
    floor = box(g, 0, 0, 0, 14, 2, 7, "steel", 5)
    P.flat(g, floor & ((np.floor(X) % 3 == 0) | (np.floor(Z) % 3 == 0)), "steel", 4)
    P.flat(g, edges(floor), "steel", 3)
    post = box(g, 11, 2, 0, 13, 8, 2, "steel", 4)
    P.flat(g, post, "steel", 4)
    hand = box(g, 0, 7, 0, 13, 9, 2, "gold", 5)
    P.flat(g, hand & (Y > 8), "gold", 6)
    P.flat(g, edges(hand), "gold", 3)
    rust_runs(g, floor, ((1, 1, 3, 1.6),), base=4, drip=0, seed=9)
    return g


def footing(g: Grid, x0, z0, x1, z1, seed: int) -> np.ndarray:
    """A concrete footing block, 4 high."""
    pad = box(g, x0, 0, z0, x1, 4, z1, "stone", 5)
    pnpaint.concrete(g, pad, "stone", 5, size=8, cracks=4, seed=seed)
    P.flat(g, edges(pad), "stone", 3)
    return pad


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    steel = np.zeros(g.shape, dtype=bool)
    # the straight post, with plates and rust runs
    post = box(g, LEFT, 2, ZP, LEFT + 4, POST_TOP, ZP + 4, "steel", 5)
    P.plates(g, post, "steel", 5, size=(4, 8), seed=3)
    P.flat(g, edges(post), "steel", 3)
    steel |= post
    # the buckled post: two straight lengths that meet at a collar
    fx, kx = RIGHT
    low = bar(g, "z", (fx + 2.0, 2.0), (kx + 2.0, KINK), 4.0, ZP, ZP + 4, "steel", 5)
    up = bar(g, "z", (kx + 2.0, KINK), (fx + 2.0, float(POST_TOP)), 4.0, ZP, ZP + 4, "steel", 5)
    for m in (low, up):
        P.flat(g, m, "steel", 5)
        P.flat(g, m & (Y < 6), "steel", 4)
    collar = box(g, int(kx) - 1, int(KINK) - 2, ZP - 1, int(kx) + 6, int(KINK) + 2, ZP + 5, "rust", 4)
    P.flat(g, collar, "rust", 4)
    P.flat(g, edges(collar), "rust", 2)
    steel |= low | up
    # a rear strut for each post, from a gusset to a rear footing
    for x0 in (LEFT, int(fx)):
        strut = bar(g, "x", (30.0, float(ZP + 2)), (3.0, float(ZP + 16)), 3.0, x0, x0 + 4, "steel", 4)
        P.flat(g, strut, "steel", 4)
        gus = box(g, x0 - 1, 26, ZP + 3, x0 + 5, 32, ZP + 5, "steel", 6)
        P.flat(g, gus, "steel", 6)
        P.flat(g, edges(gus), "steel", 4)
        footing(g, x0 - 2, ZP + 13, x0 + 6, ZP + 20, seed=x0 + 1)
    rust_runs(g, steel, ((LEFT, 40, ZP, 1.8), (LEFT + 4, 18, ZP + 2, 1.6), (fx + 4.0, 12, ZP, 1.6)), base=5, drip=6, seed=8)
    # the front footings, with rubble and weeds at their feet
    footing(g, LEFT - 3, ZP - 3, LEFT + 7, ZP + 7, seed=1)
    footing(g, int(fx) - 3, ZP - 3, int(fx) + 7, ZP + 7, seed=2)
    rubble(g, LEFT - 5.0, ZP + 1.0, 0, 2.6, 2.6, seed=9, ramp="stone", base=5)
    rubble(g, fx + 9.5, ZP - 2.0, 0, 2.4, 2.2, seed=10, ramp="stone", base=4)
    weeds(g, LEFT + 9, ZP - 2, seed=11)
    weeds(g, int(fx) - 7, ZP + 4, seed=12)
    r = root("billboard-wreck", g)
    b = child(r, "board", board(), pivot=(BW / 2, 0.0, 0.0), at_grid=(GW / 2, float(BOARD_Y), float(BOARD_Z)), rot=(0.0, 0.0, -3.0))
    child(b, "broken-catwalk", broken_section(), pivot=(0.0, 0.0, 0.0), at_grid=(float(CAT_END), 5.0, 0.0), rot=(0.0, 0.0, -28.0))
    return asset("billboard-wreck", "Wrecked Billboard", r)
