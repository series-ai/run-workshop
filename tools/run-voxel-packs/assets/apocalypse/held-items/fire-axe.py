"""Fire axe: a broad silver blade and rear pick on a signal-red head.
The head joins a stout ash handle with hazard tape and a black wrapped grip."""
from _kit import held_asset
from voxgrid import C, Grid

HY0, HY1 = 15, 18  # handle rows (3 thick)
HZ0, HZ1 = 1, 4  # handle layers (3 thick)
EX0, EX1 = 29, 39  # the eye of the head, along x (lugs a little wider than the neck)
EY0, EY1 = 14, 20  # the eye, along y
EDGE_ROWS = {
    20: (28, 38), 21: (26, 38), 22: (23, 37), 23: (21, 36),
    24: (20, 35), 25: (19, 34), 26: (18, 33), 27: (18, 33),
    28: (18, 33), 29: (19, 34), 30: (20, 35), 31: (22, 36),
    32: (24, 37), 33: (27, 37),
}


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
    g.box(0, HY0 - 1, HZ0 - 1, 2, HY1 + 1, HZ1 + 1, C("iron", 1))  # dark pommel rim
    g.box(0, HY0, HZ0, 1, HY1, HZ1, C("steel", 5))  # inset steel cap
    g.box(13, HY0, HZ0, 14, HY1, HZ1, C("iron", 0))  # the tape's last turn

    # ---- a single forged head: curved blade on -x, red cheek, rear pick on +x
    head = set()
    for y, (left, right) in EDGE_ROWS.items():
        for x in range(left, right):
            for z in range(HZ0, HZ1):
                head.add((x, y, z))
    # The eye joins the blade, pick, and handle as one chunky head.
    for x in range(EX0, EX1):
        for y in range(EY0, EY1):
            for z in range(HZ0, HZ1):
                head.add((x, y, z))
    # Rear pick: a stout horizontal spur that tapers to a steel point.
    pick_rows = {15: (37, 42), 16: (37, 46), 17: (37, 45), 18: (37, 42)}
    for y, (left, right) in pick_rows.items():
        for x in range(left, right):
            for z in range(HZ0, HZ1):
                head.add((x, y, z))

    for x, y, z in head:
        g.set(x, y, z, red(4))
    # Paint the broad cutting bevel as a clean, curved steel band.
    for y, (left, _right) in EDGE_ROWS.items():
        for offset, shade in ((0, 7), (1, 6), (2, 4), (3, 3)):
            for z in range(HZ0, HZ1):
                if (left + offset, y, z) in head:
                    g.set(left + offset, y, z, C("steel", shade))
    # Keep the red cheek in broad zones with a dark forged outline.
    for x, y, z in head:
        if x >= 24 and z in (HZ0, HZ1 - 1):
            if x in (EX0, EX1 - 1) and EY0 + 1 <= y < EY1 - 1:
                g.set(x, y, z, red(2))
            elif 27 + (y - 22) // 3 <= x < 29 + (y - 22) // 3 and 22 <= y <= 29:
                g.set(x, y, z, red(5))
    # Deliberate rust at the eye and two large steel rivets.
    for x, y in ((31, 15), (32, 15), (31, 16)):
        for z in (HZ0, HZ1 - 1):
            g.set(x, y, z, C("rust", 4))
    for x, y in ((33, 18), (37, 18)):
        for z in (HZ0, HZ1 - 1):
            g.set(x, y, z, C("gold", 4))
    # Bright steel facets mark the pick's outer point.
    for x, y in ((43, 16), (44, 16), (45, 16), (43, 17), (44, 17)):
        for z in (HZ0, HZ1 - 1):
            if (x, y, z) in head:
                g.set(x, y, z, C("steel", 7 if x == 45 else 6 if x == 44 else 5))
    gy, gz = (HY0 + HY1) / 2, (HZ0 + HZ1) / 2
    return held_asset("fire-axe", "Fire Axe", g, grip=(7, gy, gz), sockets=[("socket-tip", (32, 32, gz)), ("socket-trail", (32, 27, gz))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.36}])
