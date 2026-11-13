"""EVA suit rack, in the Pirate Nation mecha style.

One iconic shape (rule K3): a whole white hull spacesuit hung on a steel
service frame. The frame is a hazard plinth, two thick dark posts and a
copper cross beam (F3) with an EVA name plate. The suit is the oversized
feature: a chamfered torso that widens to the shoulders (a true slope,
F2) with an orange yoke, a glowing teal life-support readout, a steel
backpack, tapered arms and legs that hang a little askew (F5) and a big
bowl helmet with a cyan visor. Oxygen bottles and a tool box stand on the
plinth. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _pn import pipe
from _props import cham_prism, dots, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

W, D = 30, 18
PX = (2, 24)  # the two posts
YP = 4  # plinth top
YB = 42  # cross beam bottom


def frame() -> Grid:
    g = Grid(W, 50, D)
    X, Y, Z = coords(g)
    # hazard plinth with a lit top rim
    pl = cham_prism(g, "y", 0, 1, W, D - 1, 3, 0, YP, "iron", 4)
    pnpaint.hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    P.flat(g, pl & (Y > YP - 1), "iron", 5)
    # two thick dark posts with rivet rows
    posts = np.zeros(g.shape, dtype=bool)
    for x in PX:
        posts |= box(g, x, YP, 7, x + 4, YB, 11, "iron", 5)
    P.flat(g, posts, "iron", 5)
    P.flat(g, edges(posts), "iron", 3)
    P.flat(g, posts & (np.floor(Y) % 6 == 2) & (Z < 8), "gold", 6)
    P.flat(g, posts & (Z < 8) & (np.abs(X - 4) < 1.2) & (Y > 20) & (Y < 34), "cyan", 5)  # service strip
    # copper cross beam with a painted name plate and a warning lamp
    beam = box(g, 1, YB, 6, W - 1, YB + 4, 12, "rust", 5)
    P.flat(g, beam, "rust", 5)
    P.flat(g, beam & (Y > YB + 2.5), "rust", 6)
    P.flat(g, edges(beam), "rust", 3)
    plate = box(g, 9, YB, 5, 21, YB + 4, 6, "bone", 6)
    P.flat(g, edges(plate), "bone", 4)
    pnglyph.text(g, "-z", 5, 11, YB, "EVA", "iron", 3, depth=2, reach=3)
    P.flat(g, beam & (Z < 7) & (np.abs(X - 25) < 1.4) & (np.abs(Y - (YB + 2)) < 1.4), "cyan", 7)
    # a copper service hose from the beam down the +x post
    pipe(g, [(27, YB - 1, 13), (27, YP + 7, 13)], s=3, ramp="rust", base=4)
    # two oxygen bottles and a tool box on the plinth
    for cx, ramp in ((5.0, "cyan"), (9.5, "teal")):
        bot = ngon_prism(g, "y", cx, 11.0, 2.4, YP, YP + 14, ramp, 5)
        P.flat(g, bot, ramp, 5)
        P.flat(g, bot & ((np.abs(Y - (YP + 3)) < 0.6) | (np.abs(Y - (YP + 11)) < 0.6)), "steel", 4)
        ngon_prism(g, "y", cx, 11.0, 1.3, YP + 14, YP + 16, "rust", 5)
    bx = box(g, 21, YP, 3, 29, YP + 6, 13, "orange", 5)
    P.flat(g, bx, "orange", 5)
    P.flat(g, bx & (Y > YP + 4.5), "orange", 6)
    P.flat(g, edges(bx), "orange", 3)
    P.flat(g, bx & (Z < 4) & (np.abs(X - 25) < 2.2) & (np.abs(Y - (YP + 3)) < 1.2), "steel", 5)
    return g


def torso() -> Grid:
    """The suit body: a white hull shell that widens to the shoulders, an
    orange yoke, a teal life-support readout and a steel backpack."""
    g = Grid(22, 17, 15)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    m = cham_prism(g, "y", 3, 2, 19, 13, 3, 0, 15, "bone", 6, inset=-1.5)
    for f, fr in facets(g, g.solids[n0:]):
        P.plates(g, f, "bone", 6, size=(9, 8), rivets=False, frame=fr)
    P.flat(g, edges(m), "bone", 4)
    P.flat(g, m & (Y > 11.5), "orange", 5)  # shoulder yoke
    P.flat(g, m & (Y > 13.5), "orange", 6)
    P.flat(g, m & (np.abs(Y - 1.0) < 1.2), "orange", 5)  # waist band
    # the chest readout and buttons
    chest = m & (Z < 3) & (X > 6) & (X < 16) & (Y > 4) & (Y < 11)
    P.flat(g, chest, "steel", 3)
    scr = chest & (X > 7) & (X < 15) & (Y > 5) & (Y < 10)
    P.flat(g, scr, "teal", 4)
    for yy in (6, 8):
        P.flat(g, scr & (np.abs(Y - (yy + 0.5)) < 0.6) & (X > 9), "cyan", 6)
    P.flat(g, scr & (np.abs((X - 9) + (Y - 9)) < 0.6), "cyan", 7)
    dots(g, m & (Z < 3), "-z", [(6.0, 2.5), (9.0, 2.5), (12.0, 2.5)], 1.0, "gold", 6)
    # the backpack and a copper hose loop over the shoulder
    pack = box(g, 5, 1, 12, 17, 14, 15, "steel", 5)
    P.plates(g, pack, "steel", 5, size=(6, 5), seed=3)
    P.flat(g, edges(pack), "steel", 3)
    P.flat(g, pack & (Y > 12) & (Z > 13.5), "cyan", 6)
    pipe(g, [(17, 12, 13), (17, 12, 5), (17, 9, 5)], s=2, ramp="rust", base=5, flange=False)
    return g


def limb(length: int, r0: float, r1: float, boot: bool) -> Grid:
    """A tapered white sleeve or trouser with copper joint rings; `boot`
    adds a steel cuff and a stubby boot at the bottom."""
    g = Grid(12, length + 2, 12)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    m = ngon_prism(g, "y", 6, 6, r0, 1, length, "bone", 6, r_top=r1)
    for f, fr in facets(g, g.solids[n0:]):
        P.plates(g, f, "bone", 6, size=(6, 7), rivets=False, frame=fr)
    P.flat(g, m & (Y > length - 1.5), "bone", 4)
    for yy in (length * 0.55, 3.0):
        P.flat(g, m & (np.abs(Y - yy) < 0.9), "rust", 5)
    cuff = ngon_prism(g, "y", 6, 6, r1 + 0.7, 0, 3 if boot else 2, "steel", 4)
    P.flat(g, cuff, "steel", 4)
    P.flat(g, cuff & (Y < 1), "steel", 2)
    if boot:
        bt = box(g, 3, 0, 0, 9, 3, 7, "steel", 4)
        P.flat(g, bt, "steel", 4)
        P.flat(g, bt & (Z < 1), "orange", 5)
        P.flat(g, edges(bt), "steel", 2)
    if not boot:
        glove=box(g,3,0,3,9,4,8,"steel",5)
        P.flat(g,edges(glove),"steel",3)
    return g


def helmet() -> Grid:
    """A big bowl helmet with a cyan visor and an orange crown stripe."""
    g = Grid(16, 12, 16)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    ngon_prism(g, "y", 8, 8, 4.4, 0, 2, "steel", 4)
    ngon_prism(g, "y", 8, 8, 6.4, 2, 7, "bone", 6)
    ngon_prism(g, "y", 8, 8, 6.4, 7, 11, "bone", 6, r_top=3.2)
    for f, fr in facets(g, g.solids[n0 + 1:]):
        P.plates(g, f, "bone", 6, size=(8, 8), rivets=False, frame=fr)
    m = (g.a > 0) & (Y > 2)
    P.flat(g, m & (Y > 9.5), "orange", 5)
    visor = m & (Z < 4) & (Y > 3.5) & (Y < 8.5)
    P.flat(g, visor, "cyan", 5)
    P.flat(g, visor & (Y > 6.5), "cyan", 7)
    P.flat(g, visor & (np.abs((X - 5) + (Y - 7)) < 0.7), "cyan", 7)
    P.flat(g, m & (Y > 3) & (Y < 8) & (X > 13), "gold", 6)  # side connector
    P.flat(g, (g.a > 0) & (Y < 2), "steel", 4)
    return g


def build() -> Asset:
    root = Part("spacesuit-rack", frame())
    # the suit hangs from the beam: helmet 30-41, torso 15-30, legs 3-15
    body = root.add(Part("torso", torso(), pivot=(11.0, 15.0, 7.0), at=(15.0, 30.0, 9.0), rot=(0.0, 0.0, 2.0)))
    body.add(Part("helmet", helmet(), pivot=(8.0, 0.0, 8.0), at=(0.0, 0.0, -1.0), rot=(0.0, -12.0, 4.0)))
    for s, name, rot in ((-1, "arm-l", (0.0, 0.0, 8.0)), (1, "arm-r", (0.0, 0.0, -5.0))):
        body.add(Part(name, limb(13, 2.6, 2.0, False), pivot=(6.0, 13.0, 6.0), at=(s * 10.2, -2.0, -4.0), rot=rot))
    for s, name, rot in ((-1, "leg-l", (3.0, 0.0, 3.0)), (1, "leg-r", (-2.0, 0.0, -3.0))):
        body.add(Part(name, limb(12, 3.4, 2.8, True), pivot=(6.0, 12.0, 6.0), at=(s * 4.0, -15.0, 0.0), rot=rot))
    return Asset(id="space-props-spacesuit-rack", pack="space", category="props", name="EVA Suit Rack", root=root)
