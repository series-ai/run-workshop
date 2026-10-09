"""Data pad: a rugged field tablet in white hull plastic with orange rubber
corner bumpers, a dark steel bezel round a recessed screen and a chunky
pistol grip under it, so it reads as a one-hand tool. The screen shows a
radar scope with a sweep and a blip, plus status bars. A steel holo
emitter on the far end projects a small ringed planet on a cyan light
beam (the beam joins the planet to the lens, so nothing floats).
Held-item frame: the emitter end along +X, screen facing +Y, grip on the
palm side (-Y)."""
import numpy as np

from _kit import C, Grid, cbox, held, idx, light

BX0, BX1 = 0, 20      # body along x
BY0, BY1 = 5, 9       # body height
BZ0, BZ1 = 1, 15      # body depth
SY = BY1 - 1          # top layer of the body (the screen layer)
PX, PY, PZ = 22, 15, 8  # holo planet centre


def body(g: Grid) -> None:
    x, y, z = idx(g)
    cbox(g, BX0, BY0, BZ0, BX1, BY1, BZ1, C("bone", 6), r=1)
    side = (g.a == C("bone", 6))
    # a dark seam round the sides where the two shell halves meet
    g.where(side & (y == BY0 + 1), C("steel", 3))
    g.where(side & (y == BY0), C("bone", 4))
    # orange rubber bumpers on the four corners
    for x0 in (BX0, BX1 - 4):
        for z0 in (BZ0 - 1, BZ1 - 3):
            cbox(g, x0, BY0 - 1, z0, x0 + 4, BY1 + 1, z0 + 4, C("orange", 4), r=1)
            g.box(x0 + 1, BY1, z0 + 1, x0 + 3, BY1 + 1, z0 + 3, C("orange", 3))


def screen(g: Grid) -> None:
    x, y, z = idx(g)
    # steel bezel one layer proud of the body, screen recessed inside it
    g.box(3, BY1, 3, 17, BY1 + 1, 13, C("steel", 3))
    g.box(4, BY1, 4, 16, BY1 + 1, 12, 0)
    g.box(4, SY, 4, 16, SY + 1, 12, C("navy", 1))
    lay = (y == SY) & (x >= 4) & (x < 16) & (z >= 4) & (z < 12)
    # radar scope: ring, cross hair, sweep and a blip
    cx, cz = 7.5, 7.5
    r = np.hypot(x - cx, z - cz)
    ring = lay & (x < 12) & (np.abs(r - 3.3) < 0.5)
    g.where(ring, C("plasma", 3))
    g.where(lay & (x >= 8) & (x <= 9) & (z == x - 1), C("plasma", 7))
    g.where(lay & (x == 7) & (z == 7), C("plasma", 7))
    g.where(lay & (x == 5) & (z == 9), C("orange", 6))
    # status readout: a header line and three level bars
    g.where(lay & (x >= 12) & (x <= 14) & (z == 11), C("teal", 3))
    for zz, n, col in ((9, 3, ("cyan", 6)), (7, 2, ("toxic", 5)), (5, 1, ("orange", 6))):
        g.where(lay & (x >= 12) & (x < 12 + n) & (z == zz), C(*col))


def keys(g: Grid) -> None:
    # three chunky keys and a speaker grille on the near end
    for zz, col in ((4, "red"), (7, "gold"), (10, "cyan")):
        g.box(1, BY1, zz, 3, BY1 + 1, zz + 2, C(col, 5))
        g.set(1, BY1, zz, C(col, 6))
    for xx in (4, 6, 8):
        g.box(xx, BY1, BZ1 - 1, xx + 1, BY1 + 1, BZ1, C("iron", 3))


def grip(g: Grid) -> None:
    x, y, z = idx(g)
    # a pistol grip on the palm side with finger ribs and an orange end cap
    cbox(g, 3, 0, 5, 9, BY0, 11, C("iron", 4), r=1, edges="y")
    g.where((g.a == C("iron", 4)) & (x == 3) & (y % 2 == 1), C("iron", 2))
    g.where((g.a == C("iron", 4)) & (z == 5) & (y % 2 == 1), C("iron", 3))
    cbox(g, 3, 0, 5, 9, 1, 11, C("orange", 4), r=1, edges="y")
    # a thumb strap clip at the top of the grip
    g.box(9, 3, 6, 11, BY0, 10, C("steel", 4))


def emitter(g: Grid) -> None:
    x, y, z = idx(g)
    cbox(g, BX1, BY0, 5, BX1 + 4, BY1, 11, C("steel", 4), r=1)
    g.box(BX1, BY0, 5, BX1 + 1, BY1, 11, C("rust", 4))  # copper collar
    g.box(BX1 + 1, BY1, 6, BX1 + 4, BY1 + 1, 10, C("steel", 3))
    g.box(BX1 + 1, BY1 + 1, 7, BX1 + 4, BY1 + 2, 9, C("plasma", 6))  # lens
    # the light beam up to the planet: a narrow cone of cyan
    for yy in range(BY1 + 2, PY - 2):
        g.box(PX - 1, yy, PZ - 1, PX + 1, yy + 1, PZ + 1, C("plasma", 4))
    # the projected planet: a cyan globe with a band and an orange ring
    xa, ya, za = x + 0.5, y + 0.5, z + 0.5
    rr = np.hypot(np.hypot(xa - PX, ya - PY), za - PZ)
    globe = rr <= 3.0
    g.where(globe, C("plasma", 5))
    g.where(globe & (ya > PY + 1.2), C("plasma", 6))
    g.where(globe & (ya > PY + 2.2), C("plasma", 7))
    g.where(globe & (np.abs(ya - PY + 0.8) < 0.5), C("teal", 4))  # a cloud band
    # a tilted orange ring round it (it cuts into the globe, so it is joined)
    tilt = ya - PY - 0.45 * (xa - PX)
    ring = (np.abs(tilt) < 0.55) & (np.hypot(xa - PX, za - PZ) < 4.6) & (rr > 2.2)
    g.where(ring & ~globe, C("orange", 4))


def build():
    g = Grid(26, 19, 16)
    grip(g)
    body(g)
    screen(g)
    keys(g)
    emitter(g)
    light(g, ramps=("bone", "orange", "steel", "iron"))
    return held("data-pad", "Holo Data Pad", g, grip=(6, BY0 + 1, 8), sockets={"socket-holo": (PX, PY, PZ)},
                pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-holo", "trigger": "manual", "size": 0.3}])
