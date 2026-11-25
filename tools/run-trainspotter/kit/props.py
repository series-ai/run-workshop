"""Lineside props. Origin at the base, on the ground; `trackOffset` in the
catalogue is how far from the track centre line to stand them."""
from __future__ import annotations

from catalog import plain
from railkit import C, Clip, Grid, P, Part, coords
from shapes import flat_ngon, last

FPS = 30


def semaphore(name="signal-semaphore"):
    """A lattice-post semaphore signal: a red arm with a white stripe that
    drops level for danger (`close`) and rises 45 degrees for clear (`open`)."""
    H = 88
    post = Grid(10, H + 6, 10)
    post.box(3, 0, 3, 7, H, 7, C("bone", 6))
    X, Y, Z = coords(post)
    P.flat(post, (post.a > 0) & (Y % 8 < 1), "bone", 4)  # lattice bands
    post.box(1, 0, 1, 9, 4, 9, C("stone", 4))  # footing
    post.prism("y", flat_ngon(5, 5, 2.4, 8), H, H + 4, C("iron", 3))  # finial
    for y in range(6, H - 10, 4):  # ladder on the back
        post.box(4, y, 7, 6, y + 1, 9, C("iron", 3))
    post.box(3, H - 14, 1, 7, H - 6, 3, C("iron", 3))  # lamp case
    post.set(5, H - 10, 0, C("gold", 7))
    # the arm: pivot on the post, blade out toward +x, facing oncoming trains (+Z)
    arm = Grid(36, 8, 3)
    arm.box(0, 1, 0, 34, 6, 2, C("red", 4))
    AX, AY, AZ = coords(arm)
    P.flat(arm, (arm.a > 0) & (AX >= 24) & (AX < 28), "skin", 6)
    P.flat(arm, (arm.a > 0) & (AX < 7), "iron", 3)  # spectacle frame
    arm.set(2, 4, 0, C("ember", 5))
    arm.set(5, 4, 0, C("toxic", 4))
    root = Part(name, post, pivot=(5, 0, 5))
    root.add(Part("arm", arm, pivot=(2, 3.5, 1), at=(4, H - 8, -4)))
    clips = [
        Clip("open", {"arm": {"rot": [(0, (0, 0, 0)), (0.5, (0, 0, 48)), (0.65, (0, 0, 43)), (0.8, (0, 0, 45))]}}, loop=False, ease=0.3),
        Clip("close", {"arm": {"rot": [(0, (0, 0, 45)), (0.45, (0, 0, -3)), (0.6, (0, 0, 1)), (0.75, (0, 0, 0))]}}, loop=False, ease=0.3),
    ]
    data = {"kind": "signal", "trackOffset": 34, "states": {"close": "danger", "open": "clear"}}
    return root, [], clips, data


# ---------------------------------------------------------------- helpers
import math  # noqa: E402

import numpy as np  # noqa: E402

import pnkit as K  # noqa: E402
from pnshapes import bar, cone, disc  # noqa: E402


def _hold(part: str, value, t1: float = 0.1) -> dict:
    """Keys that put a part at `value` (loc offset from rest) quickly and keep it there."""
    return {part: {"loc": [(0, value), (t1, value)]}}


def _lens(name: str, cx: float, cy: float, r: float, colour) -> Part:
    """A lit lens: a short glowing disc pivoted on its back face. At rest it sits
    1 voxel inside its housing (hidden); keyed 2 forward it stands 1 proud."""
    g = Grid(int(2 * r) + 2, int(2 * r) + 2, 2)
    c = r + 1
    g.prism("z", flat_ngon(c, c, r, 10), 0, 2, C(*colour))
    return Part(name, g, pivot=(c, c, 0), at=(cx, cy, 0))


def _housing_lamp(g: Grid, cx: float, cy: float, zf: float, r: float, dark) -> None:
    """Paint an unlit lens on a housing's front face (voxel layer just behind zf) and add a visor above it."""
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Z == int(zf) - 1) & ((X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2 < r * r), *dark)
    g.box(int(cx - r - 1), int(cy + r), int(zf), int(cx + r + 1), int(cy + r + 2), int(zf) + 3, C("iron", 2))


def _post(g: Grid, x0: int, z0: int, w: int, h: int, ramp=("iron", 3), footing: bool = True) -> None:
    if footing:
        g.box(x0 - 2, 0, z0 - 2, x0 + w + 2, 3, z0 + w + 2, C("stone", 4))
    g.box(x0, 0, z0, x0 + w, h, z0 + w, C(*ramp))


# ---------------------------------------------------------------- signals and crossings
def colour_light(name="signal-colour-light"):
    """A three-aspect colour-light signal on a post: a black head with red,
    yellow and green lenses under visors. `close` lights red (danger), `open`
    lights green (clear), `active` flashes yellow (caution)."""
    H = 70
    g = Grid(14, H + 30, 14)
    _post(g, 5, 5, 4, H, ("steel", 4))
    for y in range(6, H - 4, 4):  # ladder up the back
        g.box(6, y, 9, 8, y + 1, 11, C("iron", 3))
    zf = 10  # front face of the head
    g.box(2, H, 4, 12, H + 28, zf, C("iron", 2))  # head
    g.box(1, H - 2, 3, 13, H, zf + 1, C("iron", 3))  # mounting bracket
    lamps = [("lens-red", H + 22, ("red", 5), ("red", 1)), ("lens-yellow", H + 14, ("gold", 6), ("gold", 1)), ("lens-green", H + 6, ("toxic", 4), ("forest", 1))]
    root = Part(name, g, pivot=(7, 0, 7))
    for lname, cy, lit, dark in lamps:
        _housing_lamp(g, 7, cy, zf, 2.8, dark)
        lens = _lens(lname, 7 - 7, cy, 2.6, lit)
        lens.at = (0, cy, zf - 3 - 7)
        root.add(lens)
    off = (0, 0, 0)
    on = (0, 0, 2)
    def aspect(lit):
        keys = {}
        for lname, *_ in lamps:
            keys.update(_hold(lname, on if lname == lit else off))
        return keys
    flash = {"lens-yellow": {"loc": [(0, on), (0.45, on), (0.5, off), (0.95, off), (1.0, on)]},
             **_hold("lens-red", off, 1.0), **_hold("lens-green", off, 1.0)}
    clips = [Clip("close", aspect("lens-red"), loop=False, ease=0), Clip("open", aspect("lens-green"), loop=False, ease=0),
             Clip("active", flash, loop=True, ease=0)]
    data = {"kind": "signal", "trackOffset": 34, "states": {"close": "danger", "open": "clear", "active": "caution"}}
    return root, [], clips, data


def crossing_gate(name="crossing-gate"):
    """A level-crossing barrier: a pedestal with a long striped boom and a
    counterweight. Raised at rest; `close` lowers the boom across the road
    (toward +X), `open` raises it again."""
    g = Grid(14, 34, 14)
    _post(g, 3, 3, 8, 22, ("skin", 5))
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y >= 20) & (Y < 22), "red", 4)
    g.box(4, 22, 4, 10, 30, 10, C("iron", 3))  # mechanism housing
    L = 76
    boom = Grid(L + 10, 5, 3)
    boom.box(0, 0, 0, 10, 5, 3, C("iron", 2))  # counterweight
    boom.box(10, 1, 0, L + 10, 4, 3, C("skin", 6))
    BX_, BY_, BZ_ = coords(boom)
    P.flat(boom, (boom.a > 0) & (BX_ >= 10) & (((BX_ - 10) // 8) % 2 == 1), "red", 4)
    for lx in (30, 54, L + 6):  # lamps on the boom
        boom.box(lx, 4, 1, lx + 2, 5, 2, C("red", 6))
    root = Part(name, g, pivot=(7, 0, 7))
    arm = Part("boom", boom, pivot=(10, 2.5, 1.5), at=(0, 26, 4.5), rot=(0, 0, 85))
    root.add(arm)
    down = [(0, (0, 0, 0)), (2.0, (0, 0, -88)), (2.2, (0, 0, -83)), (2.4, (0, 0, -85))]
    up = [(0, (0, 0, -85)), (2.4, (0, 0, 0))]
    clips = [Clip("close", {"boom": {"rot": down}}, loop=False, ease=0.3), Clip("open", {"boom": {"rot": up}}, loop=False, ease=0.3)]
    data = {"kind": "crossing", "trackOffset": 40, "boomLength": L, "states": {"close": "road closed", "open": "road open"}}
    return root, [], clips, data


def crossing_lights(name="crossing-lights"):
    """Level-crossing warning lights: two red lamps on a black backboard under a
    white cross board. `active` flashes them alternately."""
    H = 62
    g = Grid(32, H + 2, 12)
    _post(g, 14, 4, 4, H - 10, ("skin", 5))
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y < 34) & ((Y // 6) % 2 == 0) & (Y > 3), "red", 4)
    zf = 9
    g.box(2, 36, 3, 30, 48, zf, C("iron", 2))  # backboard, deep enough to hide the unlit lenses
    lamps = (("lamp-l", 8), ("lamp-r", 24))
    root = Part(name, g, pivot=(16, 0, 6))
    for lname, cx in lamps:
        _housing_lamp(g, cx, 42, zf, 3.2, ("red", 1))
        lens = _lens(lname, 0, 0, 3.0, ("red", 6))
        lens.at = (cx - 16, 42, zf - 3 - 6)
        root.add(lens)
    # cross board above: two crossed white bars with a red edge
    for p0, p1 in (((4, 50), (28, 62)), ((4, 62), (28, 50))):
        bar(g, "z", p0, p1, 3.0, 6, 8, "skin", 6)
    on, off = (0, 0, 2), (0, 0, 0)
    flash = {"lamp-l": {"loc": [(0, on), (0.45, on), (0.5, off), (0.95, off), (1.0, on)]},
             "lamp-r": {"loc": [(0, off), (0.45, off), (0.5, on), (0.95, on), (1.0, off)]}}
    clips = [Clip("active", flash, loop=True, ease=0)]
    data = {"kind": "crossing", "trackOffset": 40, "states": {"active": "warning"}}
    return root, [], clips, data


# ---------------------------------------------------------------- lineside
def water_tower(name="water-tower"):
    """A lineside water tower: a timber tank with iron hoops and a conical
    roof on four braced legs, and a spout swung toward the track (-X)."""
    g = Grid(60, 92, 52)
    X, Y, Z = coords(g)
    cx, cz, leg = 34, 26, 40
    for lx in (cx - 16, cx + 13):
        for lz in (cz - 16, cz + 13):
            g.box(lx, 0, lz, lx + 3, leg + 2, lz + 3, C("darkwood", 3))
    for (a, b) in (((cx - 15, 4), (cx + 14, leg - 2)), ((cx - 15, leg - 2), (cx + 14, 4))):
        for z in (cz - 15, cz + 14):
            bar(g, "z", a, b, 1.6, z, z + 1, "darkwood", 2)
    g.box(cx - 19, leg, cz - 19, cx + 19, leg + 3, cz + 19, C("darkwood", 2))  # deck
    tank = disc(g, "y", cx, cz, 19, leg + 3, leg + 31, "wood", 4, n=12)
    rr = np.hypot(X + 0.5 - cx, Z + 0.5 - cz)
    ang = np.arctan2(Z + 0.5 - cz, X + 0.5 - cx)
    P.flat(g, tank & (((ang * 19) // 3).astype(int) % 2 == 0), "wood", 3)  # staves
    for y in (leg + 8, leg + 17, leg + 26):
        P.flat(g, tank & (Y >= y) & (Y < y + 1), "iron", 3)  # hoops
    cone(g, "y", cx, cz, 21, leg + 31, leg + 44, "stone", 2, n=12)
    # spout: a pipe out toward the track, with a canvas hose hanging from it
    bar(g, "z", (cx - 18, leg + 12), (4, leg + 6), 3, cz - 2, cz + 2, "iron", 3)
    g.box(3, leg - 14, cz - 1, 6, leg + 7, cz + 1, C("darkwood", 1))
    root = Part(name, g, pivot=(cx, 0, cz))
    data = {"kind": "water", "trackOffset": 60}
    return root, [], [], data


def water_crane(name="water-crane"):
    """A water crane: an iron column with a swinging arm and hose. At rest the
    arm lies along the track; `open` swings it 90 degrees over the line (-X)."""
    top = 66  # the arm clears a tender top (about 58 above the ground)
    g = Grid(16, top, 16)
    g.box(2, 0, 2, 14, 4, 14, C("stone", 4))
    disc(g, "y", 8, 8, 3.5, 4, top - 4, "iron", 3, n=10)
    disc(g, "y", 8, 8, 5, top - 4, top, "iron", 4, n=10)  # head
    arm = Grid(8, 16, 36)
    arm.box(2, 10, 0, 6, 14, 34, C("iron", 3))  # pipe along -z from the pivot (grid z 34)
    arm.box(1, 9, 0, 7, 15, 4, C("iron", 4))  # elbow at the far end
    arm.box(3, 0, 0, 5, 9, 3, C("darkwood", 2))  # leather hose hanging from it
    root = Part(name, g, pivot=(8, 0, 8))
    root.add(Part("arm", arm, pivot=(4, 10, 34), at=(0, top, 0)))
    swing = [(0, (0, 0, 0)), (1.6, (0, 90, 0))]
    back = [(0, (0, 90, 0)), (1.6, (0, 0, 0))]
    clips = [Clip("open", {"arm": {"rot": swing}}, loop=False, ease=0.3), Clip("close", {"arm": {"rot": back}}, loop=False, ease=0.3)]
    data = {"kind": "water", "trackOffset": 34, "armLength": 34}
    return root, [], clips, data


def catenary_mast(name="catenary-mast"):
    """An overhead-line mast for electrified track: a lattice steel mast with a
    cantilever reaching over the line (-X, to the track centre) and a 64-long
    run of contact wire, so a mast every track unit makes a continuous wire.
    Stand it `trackOffset` from the track centre line."""
    off, wire_y = 34, 92  # the wire is 84 above the rail
    XL = -off - 4  # grid x 0 is local x -38
    g = Grid(off + 10, 106, 66)
    X, Y, Z = coords(g)
    mx = off + 4 - 3  # mast grid x (local -3..3)
    zc = 32
    g.box(mx - 1, 0, zc - 4, mx + 7, 3, zc + 4, C("stone", 4))
    g.box(mx, 0, zc - 2, mx + 6, 104, zc + 2, C("steel", 3))
    P.flat(g, (g.a > 0) & (X >= mx) & (X < mx + 6) & (Y > 3) & ((Y + X) % 6 == 0), "steel", 5)  # lattice
    g.box(2, 100, zc - 1, mx, 102, zc + 1, C("steel", 4))  # cantilever
    bar(g, "z", (mx, 86), (10, 100), 1.6, zc - 1, zc + 1, "steel", 4)  # stay
    for x in (mx - 3, 8):
        g.box(x, 96, zc - 1, x + 2, 100, zc + 1, C("bone", 6))  # insulators
    g.box(3, wire_y + 1, zc - 1, 5, 100, zc + 1, C("steel", 5))  # dropper
    g.box(3, wire_y, 0, 5, wire_y + 1, 66, C("iron", 2))  # contact wire, 64 plus overlap
    root = Part(name, g, pivot=(-XL, 0, zc))
    data = {"kind": "catenary", "trackOffset": off, "wireY": wire_y, "span": 64}
    return root, [], [], data


def lamp_post(name="lamp-post"):
    """A platform lamp: a fluted column with a lantern; stands on a platform or the ground."""
    g = Grid(10, 58, 10)
    X, Y, Z = coords(g)
    g.box(2, 0, 2, 8, 4, 8, C("iron", 2))
    disc(g, "y", 5, 5, 1.6, 4, 46, "iron", 3, n=8)
    g.box(2, 46, 2, 8, 48, 8, C("iron", 2))
    g.box(2, 48, 2, 8, 54, 8, C("sand", 7))  # lit glass
    P.flat(g, (g.a > 0) & (Y >= 48) & (Y < 54) & (((X == 2) | (X == 7)) & ((Z == 2) | (Z == 7))), "iron", 2)
    cone(g, "y", 5, 5, 4.5, 54, 58, "iron", 2, n=4)
    root = Part(name, g, pivot=(5, 0, 5))
    return root, [], [], {"kind": "lamp", "standsOn": "platform or ground"}


def bench(name="platform-bench"):
    """A platform bench: cast-iron ends and timber slats."""
    g = Grid(14, 16, 28)
    X, Y, Z = coords(g)
    for z in (1, 25):
        g.box(2, 0, z, 12, 2, z + 2, C("iron", 2))
        g.box(3, 2, z, 5, 15, z + 2, C("iron", 2))
        g.box(9, 2, z, 11, 8, z + 2, C("iron", 2))
    g.box(2, 7, 0, 12, 9, 28, C("wood", 4))  # seat
    g.box(2, 9, 0, 4, 15, 28, C("wood", 4))  # back
    P.flat(g, (g.a > 0) & ((Y == 7) | (Y == 11) | (Y == 13)) & (X < 12), "wood", 2)
    root = Part(name, g, pivot=(7, 0, 14))
    return root, [], [], {"kind": "bench", "standsOn": "platform"}


def nameboard(name="station-nameboard"):
    """A station nameboard on two legs, left blank for a game to letter."""
    g = Grid(52, 30, 4)
    for x in (8, 42):
        g.box(x, 0, 1, x + 2, 26, 3, C("iron", 3))
    g.box(2, 16, 0, 50, 28, 3, C("bone", 7))
    P.outline(g, P.region(g, 2, 16, 0, 50, 28, 3) & (g.a > 0), "blood", 3, normal="z")
    root = Part(name, g, pivot=(26, 0, 2))
    return root, [], [], {"kind": "sign", "standsOn": "platform or ground", "board": [46, 10]}


def luggage_trolley(name="luggage-trolley"):
    """A platform luggage trolley with a T-handle, loaded with two cases and a trunk."""
    g = Grid(18, 22, 36)
    for z in (6, 26):
        for x in (2, 15):
            disc(g, "x", 3, z, 3, x, x + 1, "iron", 2, n=8)
    g.box(2, 5, 2, 16, 7, 32, C("wood", 4))  # deck
    g.box(8, 7, 31, 10, 20, 33, C("iron", 3))  # handle stem
    g.box(4, 18, 31, 14, 20, 33, C("iron", 3))  # handle bar
    g.box(3, 7, 4, 15, 15, 14, C("darkwood", 3))  # trunk
    g.box(4, 15, 5, 14, 16, 13, C("ember", 4))
    g.box(4, 7, 16, 11, 13, 25, C("navy", 4))  # case
    g.box(11, 7, 16, 15, 11, 28, C("rust", 5))  # case
    root = Part(name, g, pivot=(9, 0, 18))
    return root, [], [], {"kind": "trolley", "standsOn": "platform"}


def speed_board(name="speed-board"):
    """A lineside speed limit board: a white board with a black border and a
    painted limit, on a post. Stand it `trackOffset` from the track."""
    from pnglyph import text, text_size

    g = Grid(20, 40, 6)
    g.box(9, 0, 2, 11, 28, 4, C("iron", 3))
    g.box(2, 24, 3, 18, 38, 5, C("skin", 6))
    P.outline(g, P.region(g, 2, 24, 3, 18, 38, 5) & (g.a > 0), "iron", 1, normal="z")
    w, h = text_size("60")
    text(g, "+z", 5, 10 - w // 2, 31 - h // 2, "60", "iron", 1)
    root = Part(name, g, pivot=(10, 0, 3))
    return root, [], [], {"kind": "sign", "trackOffset": 30}


CATALOG = [
    plain("signals-crossings", semaphore, "animated-props", "tall-prop", "props", tier="slice"),
    plain("signals-crossings", colour_light, "animated-props", "tall-prop", "props"),
    plain("signals-crossings", crossing_gate, "animated-props", "tall-prop", "props"),
    plain("signals-crossings", crossing_lights, "animated-props", "tall-prop", "props"),
    plain("lineside-props", water_tower, "props", "tall-prop", "props"),
    plain("lineside-props", water_crane, "animated-props", "tall-prop", "props"),
    plain("lineside-props", catenary_mast, "props", "tall-prop", "props"),
    plain("lineside-props", lamp_post, "props", "lamp", "props"),
    plain("lineside-props", bench, "props", "kit", "props"),
    plain("lineside-props", nameboard, "props", "kit", "props"),
    plain("lineside-props", luggage_trolley, "props", "kit", "props"),
    plain("lineside-props", speed_board, "props", "kit", "props"),
]
