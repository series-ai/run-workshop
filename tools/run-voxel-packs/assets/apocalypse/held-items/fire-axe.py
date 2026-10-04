"""Fire axe: an oversized signal-red head on a stout, weathered ash handle.
The head has a broad flared blade with a curved, honed silver edge (one
nick in it) on one side and a tapering pick on the other, both in one
piece with the eye. The red paint is chipped to bare steel and rusted at
the eye, with blood on the blade and two rivets. Hazard tape wraps the
handle under the head; the grip is black rubber tape with lighter wrap
bands and a steel end cap. The head sits at +X, the blade faces +Y."""
from _kit import held_asset
from voxgrid import C, Grid

HY0, HY1 = 15, 18  # handle rows (3 thick)
HZ0, HZ1 = 1, 4  # handle layers (3 thick)
EX0, EX1 = 29, 39  # the eye of the head, along x (lugs a little wider than the neck)
NX0, NX1 = 31, 37  # the neck where the blade and the pick leave the eye
EY0, EY1 = 14, 20  # the eye, along y
EDGE_Y = 34  # the top of the blade edge at its crown


def blade_top(x: int) -> int:
    """The curved edge: highest at the crown, falling off to both horns."""
    return EDGE_Y - round(((x - 31.5) / 14.5) ** 2 * 5)


def build():
    g = Grid(47, 36, 5)
    red = lambda s: C("red", s)  # noqa: E731

    # ---- the handle: weathered ash with grain streaks
    for x in range(2, EX1):
        for y in range(HY0, HY1):
            for z in range(HZ0, HZ1):
                streak = (y * 3 + z * 5 + x // 7) % 5
                shade = 3 if streak == 0 else 5 if streak == 3 else 4
                g.set(x, y, z, C("wood", shade))
    for x, y, z in ((19, HY1 - 1, 2), (20, HY1 - 1, 2), (19, HY0, 1), (24, HY0 + 1, HZ0)):
        g.set(x, y, z, C("darkwood", 4))  # a knot and weathered checks
    for x in range(26, EX0):  # hazard tape under the head
        for y in range(HY0, HY1):
            for z in range(HZ0, HZ1):
                g.set(x, y, z, C("gold", 5) if (x + y + z) % 4 < 2 else C("darkwood", 2))
    # ---- the grip: black rubber tape with lighter wrap bands, a steel end cap
    for x in range(2, 14):
        for y in range(HY0, HY1):
            for z in range(HZ0, HZ1):
                g.set(x, y, z, C("iron", 3) if (x + y - z) % 3 == 0 else C("iron", 1))
    g.box(0, HY0 - 1, HZ0 - 1, 2, HY1 + 1, HZ1 + 1, C("steel", 4))  # end cap
    g.box(1, HY0 - 1, HZ0 - 1, 2, HY1 + 1, HZ1 + 1, C("steel", 6))
    g.box(13, HY0, HZ0, 14, HY1, HZ1, C("iron", 0))  # the tape's last turn

    # ---- the head: eye, flared blade (+y) and pick (-y), one solid piece
    head = []
    for x in range(EX0, EX1):  # the eye: as thick as the blade, so the head reads as one forging
        for y in range(EY0, EY1):
            for z in range(HZ0, HZ1):
                head.append((x, y, z))
    for y in range(EY1, EDGE_Y + 1):  # the blade sweeps out in a concave flare, most on the beard side
        k = y - EY1
        x0, x1 = NX0 - round(0.07 * k * k), NX1 + round(0.045 * k * k)
        for x in range(x0, x1):
            top = blade_top(x)
            if y < top:
                zs = range(2, 3) if y >= top - 2 else range(HZ0, HZ1)  # it thins to a honed edge
                for z in zs:
                    head.append((x, y, z))
    for k in range(13):  # the pick tapers to a point
        y = EY0 - 1 - k
        c, hw = 34.0 - k * 0.15, 2.9 - k * 0.23
        zs = range(HZ0, HZ1) if k < 11 else range(2, 3)
        for x in range(round(c - hw), round(c + hw) + 1):
            for z in zs:
                head.append((x, y, z))
    filled = set(head)
    for x, y, z in head:
        g.set(x, y, z, red(4))
    # dark framed rim on the head's outline (rule S4) and a lighter upper sheen
    for x, y, z in head:
        rim = any((x + dx, y + dy, z) not in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if rim:
            g.set(x, y, z, red(2))
    # volume: the right flank of the blade catches the light, the throat under the edge is shaded
    for x, y, z in head:
        if y < EY1 or (x, y, z) not in filled:
            continue
        k = y - EY1
        if NX1 + round(0.045 * k * k) - 3 <= x < NX1 + round(0.045 * k * k) - 1 and z != 2:
            g.set(x, y, z, red(5))
        elif blade_top(x) - 4 <= y < blade_top(x) - 2 and z != 2:
            g.set(x, y, z, red(3))
    # the honed edge: the thin lip is bright steel over a darker bevel line, with a nick
    for x in range(EX0 - 14, EX1 + 9):
        col = [y for y in range(EY1, blade_top(x)) if (x, y, 2) in filled]
        if not col:
            continue
        ymax = max(col)
        for y, shade in ((ymax, 7), (ymax - 1, 5)):
            for z in range(HZ0, HZ1):
                if (x, y, z) in filled:
                    g.set(x, y, z, C("steel", shade))
    g.set(24, blade_top(24) - 1, 2, 0)  # the nick
    g.set(24, blade_top(24) - 2, 2, C("steel", 4))
    # the pick's honed point
    for k in range(10, 13):
        y = EY0 - 1 - k
        for x in range(24, 40):
            for z in range(HZ0, HZ1):
                if (x, y, z) in filled:
                    g.set(x, y, z, C("steel", 5 if k == 10 else 6 if k < 12 else 7))
    # wear: chipped paint to bare steel, rust at the eye, blood on the blade, rivets
    # (paint only voxels of the head, so no wear mark floats off it)
    def wear(x, y, z, c):
        if (x, y, z) in filled:
            g.set(x, y, z, c)

    for x, y in ((24, 31), (25, 31), (40, 29), (41, 29), (33, 9)):
        for z in (HZ0, HZ1 - 1):
            wear(x, y, z, C("steel", 5))
    for x, y in ((31, 14), (32, 14), (36, 14), (37, 15), (30, 15)):
        for z in (HZ0, HZ1 - 1):
            wear(x, y, z, C("rust", 4))
    for x, y in ((31, 19), (36, 19)):
        wear(x, y, HZ0, C("steel", 6))  # rivets
        wear(x, y, HZ1 - 1, C("steel", 6))
    for x, y in ((27, 31), (27, 30), (27, 29), (34, 31), (34, 30), (35, 31)):
        wear(x, y, HZ0, C("blood", 3))
        wear(x, y, HZ1 - 1, C("blood", 2))
    # the handle's end grain and steel wedge show through the top of the eye
    for y in range(HY0, HY1):
        for z in range(HZ0, HZ1):
            g.set(EX1 - 1, y, z, C("darkwood", 4))
    g.set(EX1 - 1, HY0 + 1, 2, C("steel", 6))
    gy, gz = (HY0 + HY1) / 2, (HZ0 + HZ1) / 2
    return held_asset("fire-axe", "Fire Axe", g, grip=(7, gy, gz), sockets=[("socket-tip", (32, EDGE_Y, gz)), ("socket-trail", (32, 27, gz))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.36}])
