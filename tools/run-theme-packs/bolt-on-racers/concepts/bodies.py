"""Bolt-On Racers body shells.

Every body is authored once at M size on a deck 1.2 long (y -0.6..0.6, front at
-y) and 0.66 wide (x -0.33..0.33), standing on z = 0 (the chassis 'body' snap).
The assembler scales it to the S or L class deck, so one shell fits every chassis.

Each builder takes a paint dict P (main, acc, roof, trim) and returns the shell's
own snap points (M units, body space) plus 'open' (driver visible or not).
"""
import math

from rk import (C, V, at, box, cyl, cone, ell, lathe, torus, loft, tube, slab, blade, tbox, xslab, rod, star,
                RED, YEL, TEAL, BLUE, WHITE, ORANGE, CHAR, TYRE, BLACK, CHROME, STEEL, GLASS, LAMP, TAILL,
                TAN, PINK, SAUSAGE, CREAM, SHARK, MET, GLOSS, shade)

GL = dict(rough=0.18)


def snaps(roof, hood, rear, tail, front, side, seat, exh=(0.19, 0.6, 0.07), mast=None, open_=False):
    d = dict(roof=roof, hood=hood, rear=rear, tail=tail, front=front, seat=seat,
             side_L=side, side_R=(-side[0], side[1], side[2]),
             exhaust_L=exh, exhaust_R=(-exh[0], exh[1], exh[2]),
             mast=mast or (0.22, rear[1] - 0.03, rear[2]))
    d["open"] = open_
    return d


def headlights(y, z, dx, r=0.052):
    r *= 1.45
    for s in (-1, 1):
        cyl(r, 0.025, (s * dx, y + 0.02, z), CHROME, n=10, rx=90, **MET)
        cyl(r * 0.72, 0.032, (s * dx, y + 0.02, z), LAMP, n=10, rx=90, emit=0.35)


def taillights(y, z, dx, w=0.1, h=0.05):
    for s in (-1, 1):
        box((w, 0.03, h), (s * dx, y, z), TAILL, emit=0.25, **GLOSS)


def grille(y, z, w, h, slots=0):
    box((w, 0.03, h), (0, y, z), CHAR, bevel=0.008)
    if slots:
        for i in range(slots):
            x = -w / 2 + w * (i + 0.5) / slots
            box((w / slots * 0.45, 0.02, h * 0.8), (x, y - 0.012, z), BLACK)


def windscreen(y, z, w, h, tilt=-25):
    with at((0, y, z), rx=tilt):
        box((w, 0.015, h), (0, 0, h / 2), GLASS, bevel=0.005, **GL)


# ---------------------------------------------------------------- open-cockpit shells

def race(P):
    m, a = P["main"], P["acc"]
    xslab([(-0.62, 0.03), (-0.62, 0.11), (-0.36, 0.19), (-0.08, 0.27), (0.46, 0.29), (0.6, 0.25), (0.6, 0.03)],
          0.52, m, bevel=0.09, seg=3, **GLOSS)
    for s in (-1, 1):
        with at((s * 0.25, 0, 0)):
            tbox(0.02, 0.21, (0.08, -0.22, 0.5), (0.07, -0.1, 0.46), a, bevel=0.03, **GLOSS)
            box((0.09, 0.03, 0.09), (0, -0.215, 0.12), BLACK)  # pod intake
    ell((0, -0.6, 0.08), (0.12, 0.06, 0.05), a, seg=8, ring=4, **GLOSS)  # nose tip
    ell((0, -0.02, 0.275), (0.15, 0.21, 0.035), BLACK, seg=12, ring=4)
    windscreen(-0.22, 0.25, 0.22, 0.08, tilt=-35)
    for s in (-1, 1):
        rod((s * 0.12, 0.2, 0.26), (s * 0.12, 0.2, 0.46), 0.022, CHROME, **MET)
    with at((0, 0.2, 0.46), rx=90):
        torus(0.12, 0.024, (0, 0, 0), CHROME, n=10, k=5, arc=180, **MET)
    box((0.3, 0.06, 0.02), (0, 0.55, 0.3), a, **GLOSS)
    return snaps(roof=(0, 0.2, 0.59), hood=(0, -0.34, 0.205), rear=(0, 0.52, 0.29), tail=(0, 0.61, 0.15),
                 front=(0, -0.63, 0.08), side=(0.33, 0.16, 0.12), seat=(0, -0.02, 0.05), exh=(0.14, 0.6, 0.08),
                 mast=(0.2, 0.42, 0.29), open_=True)


def jeep(P):
    m, a = P["main"], P["acc"]
    box((0.66, 1.2, 0.17), (0, 0, 0.085), m, bevel=0.07, **GLOSS)
    tbox(0.17, 0.31, (0.3, -0.6, -0.12), (0.29, -0.59, -0.13), m, bevel=0.03, **GLOSS)  # bonnet
    for s in (-1, 1):
        box((0.07, 0.72, 0.14), (s * 0.295, 0.24, 0.24), m, bevel=0.025, **GLOSS)  # tub sides
    box((0.66, 0.07, 0.14), (0, 0.565, 0.24), m, bevel=0.025, **GLOSS)
    box((0.52, 0.66, 0.02), (0, 0.24, 0.17), BLACK)  # floor
    box((0.52, 0.04, 0.12), (0, -0.12, 0.23), CHAR)  # dash
    grille(-0.605, 0.21, 0.3, 0.13, slots=7)
    headlights(-0.6, 0.22, 0.22, r=0.045)
    box((0.66, 0.05, 0.05), (0, -0.62, 0.05), CHAR, bevel=0.01)
    # fold-up windscreen frame
    with at((0, -0.13, 0.3), rx=-8):
        box((0.6, 0.03, 0.025), (0, 0, 0.2), CHAR)
        for s in (-1, 1):
            box((0.025, 0.03, 0.2), (s * 0.29, 0, 0.1), CHAR)
        box((0.56, 0.012, 0.17), (0, 0, 0.1), GLASS, **GL)
    # roll bar
    for s in (-1, 1):
        rod((s * 0.27, 0.36, 0.3), (s * 0.27, 0.36, 0.58), 0.022, CHAR)
    rod((-0.27, 0.36, 0.58), (0.27, 0.36, 0.58), 0.022, CHAR)
    # rear seats + spare tyre
    box((0.4, 0.14, 0.06), (0, 0.42, 0.2), CHAR, bevel=0.02)
    with at((0, 0.64, 0.24), rz=90):
        lathe([(0.07, -0.04), (0.12, -0.04), (0.14, -0.02), (0.14, 0.02), (0.12, 0.04), (0.07, 0.04), (0.07, -0.04)],
              (0, 0, 0), TYRE, n=12, ry=90, cap=False, rough=0.9)
        cyl(0.075, 0.07, (-0.035, 0, 0), a, n=10, ry=90)
    return snaps(roof=(0, 0.36, 0.6), hood=(0, -0.36, 0.31), rear=(0, 0.52, 0.31), tail=(0, 0.69, 0.24),
                 front=(0, -0.63, 0.08), side=(0.33, -0.3, 0.1), seat=(0, 0.1, 0.11), mast=(0.25, 0.5, 0.31), open_=True)


def rocket(P):
    m, a = P["main"], P["acc"]
    rings = [((0, -0.42, 0.21), 0.2, 0.15), ((0, -0.2, 0.22), 0.27, 0.2), ((0, 0.1, 0.22), 0.3, 0.215),
             ((0, 0.4, 0.22), 0.29, 0.21), ((0, 0.56, 0.22), 0.22, 0.17), ((0, 0.6, 0.22), 0.16, 0.13)]
    loft(rings, m, n=10, **GLOSS)
    loft([((0, -0.7, 0.2), 0, 0), ((0, -0.6, 0.2), 0.1, 0.08), ((0, -0.48, 0.21), 0.18, 0.14), ((0, -0.4, 0.21), 0.205, 0.155)],
         a, n=10, **GLOSS)
    lathe([(0.14, 0), (0.17, 0.08), (0.12, 0.08)], (0, 0.58, 0.22), CHROME, n=10, rx=-90, cap=False, **MET)
    cyl(0.12, 0.02, (0, 0.6, 0.22), BLACK, n=10, rx=-90)
    # fins
    xslab([(0.18, 0.4), (0.6, 0.4), (0.66, 0.66), (0.52, 0.66)], 0.04, a, bevel=0.01, **GLOSS)
    for s in (-1, 1):
        with at((s * 0.26, 0.38, 0.14), ry=s * -25):
            box((0.26, 0.24, 0.035), (s * 0.1, 0.05, 0), a, bevel=0.012, **GLOSS)
    # portholes / band
    for s in (-1, 1):
        cyl(0.04, 0.02, (s * 0.29, 0.2, 0.25), CHROME, n=8, ry=90 * s, **MET)
    ell((0, -0.06, 0.42), (0.15, 0.2, 0.035), BLACK, seg=12, ring=4)
    windscreen(-0.27, 0.4, 0.22, 0.09, tilt=-40)
    return snaps(roof=(0, 0.24, 0.43), hood=(0, -0.38, 0.35), rear=(0, 0.46, 0.4), tail=(0, 0.66, 0.22),
                 front=(0, -0.62, 0.1), side=(0.3, 0.05, 0.16), seat=(0, -0.06, 0.18), exh=(0.17, 0.56, 0.08),
                 mast=(0.18, 0.42, 0.4), open_=True)


def tractor(P):
    m, a = P["main"], P.get("acc", WHITE)
    box((0.42, 1.18, 0.12), (0, 0, 0.06), CHAR, bevel=0.02)
    tbox(0.1, 0.44, (0.2, -0.62, 0.02), (0.18, -0.58, -0.02), m, bevel=0.07, seg=3, **GLOSS)  # bonnet
    grille(-0.625, 0.27, 0.28, 0.24, slots=5)
    headlights(-0.62, 0.38, 0.12, r=0.035)
    box((0.42, 0.1, 0.08), (0, -0.62, 0.06), CHAR, bevel=0.015)  # front weight
    for s in (-1, 1):
        for i in range(3):
            box((0.01, 0.12, 0.03), (s * 0.19, -0.4 + i * 0.13, 0.3), BLACK)
    rod((0.1, -0.35, 0.4), (0.1, -0.35, 0.8), 0.028, CHAR)  # exhaust stack
    cyl(0.04, 0.03, (0.1, -0.35, 0.8), CHROME, n=8, **MET)
    cyl(0.05, 0.12, (-0.1, -0.2, 0.42), a, n=8)  # air intake
    box((0.62, 0.62, 0.08), (0, 0.29, 0.15), CHAR, bevel=0.02)  # platform
    for s in (-1, 1):
        with at((s * 0.28, 0, 0)):
            tbox(0.12, 0.46, (0.05, 0.02, 0.6), (0.05, 0.12, 0.52), m, bevel=0.04, seg=2, **GLOSS)  # fenders
    # dash + steering
    box((0.22, 0.08, 0.2), (0, 0.0, 0.3), m, bevel=0.02, **GLOSS)
    rod((0, 0.02, 0.38), (0, 0.11, 0.46), 0.014, STEEL, **MET)
    torus(0.06, 0.013, (0, 0.11, 0.46), CHAR, n=10, k=4, rx=55)
    # seat + ROPS
    box((0.2, 0.18, 0.05), (0, 0.3, 0.21), BLACK, bevel=0.015)
    box((0.2, 0.05, 0.16), (0, 0.4, 0.29), BLACK, bevel=0.015)
    for s in (-1, 1):
        rod((s * 0.24, 0.52, 0.19), (s * 0.24, 0.52, 0.9), 0.024, a)
    rod((-0.24, 0.52, 0.9), (0.24, 0.52, 0.9), 0.024, a)
    return snaps(roof=(0, 0.52, 0.92), hood=(0, -0.3, 0.44), rear=(0, 0.56, 0.19), tail=(0, 0.6, 0.15),
                 front=(0, -0.67, 0.08), side=(0.33, 0.32, 0.28), seat=(0, 0.29, 0.21), exh=(0.16, 0.6, 0.08),
                 mast=(0.28, 0.56, 0.46), open_=True)


def hotdog(P):
    ell((0, 0, 0.16), (0.33, 0.58, 0.17), TAN, seg=12, ring=6)
    ell((0, 0, 0.16), (0.335, 0.585, 0.06), shade(TAN, 0.88), seg=12, ring=4)  # bun seam
    ell((0, 0, 0.3), (0.19, 0.7, 0.15), SAUSAGE, seg=12, ring=6, **GLOSS)
    pts = []
    for i in range(10):
        y = 0.08 + i * 0.05
        x = 0.09 * (1 if i % 2 else -1)
        q = 1 - (y / 0.7) ** 2 - (x / 0.19) ** 2
        pts.append((x, y, 0.3 + 0.15 * math.sqrt(max(q, 0.02)) + 0.008))
    tube(pts, lambda t: 0.02, YEL, rings=40, n=5, **GLOSS)
    pts = []
    for i in range(5):
        y = -0.6 + i * 0.05
        x = 0.06 * (1 if i % 2 else -1)
        q = 1 - (y / 0.7) ** 2 - (x / 0.19) ** 2
        pts.append((x, y, 0.3 + 0.15 * math.sqrt(max(q, 0.02)) + 0.006))
    tube(pts, lambda t: 0.018, YEL, rings=20, n=5, **GLOSS)
    ell((0, -0.2, 0.445), (0.13, 0.17, 0.03), BLACK, seg=12, ring=4)
    windscreen(-0.4, 0.4, 0.2, 0.08, tilt=-35)
    headlights(-0.55, 0.15, 0.17, r=0.04)
    return snaps(roof=(0, 0.06, 0.45), hood=(0, -0.48, 0.38), rear=(0, 0.5, 0.36), tail=(0, 0.66, 0.28),
                 front=(0, -0.6, 0.1), side=(0.33, 0.0, 0.15), seat=(0, -0.2, 0.2), exh=(0.16, 0.56, 0.06),
                 mast=(0.12, 0.42, 0.38), open_=True)


def shark(P):
    m = P["main"]
    rings = [((0, -0.66, 0.18), 0.08, 0.07), ((0, -0.55, 0.2), 0.2, 0.15), ((0, -0.3, 0.21), 0.29, 0.2),
             ((0, 0.05, 0.22), 0.32, 0.215), ((0, 0.35, 0.22), 0.28, 0.19), ((0, 0.56, 0.22), 0.16, 0.12),
             ((0, 0.62, 0.23), 0.08, 0.07)]
    loft(rings, m, n=10, **GLOSS)
    ell((0, -0.04, 0.12), (0.29, 0.6, 0.12), WHITE, seg=10, ring=6)  # belly
    # mouth + teeth
    ell((0, -0.56, 0.12), (0.15, 0.07, 0.045), C(150, 30, 50), seg=10, ring=4)
    for i in range(6):
        x = -0.11 + i * 0.044
        cone(0.018, 0.04, (x, -0.6 + abs(x) * 0.5, 0.16), WHITE, n=4, ry=180)
    for s in (-1, 1):
        ell((s * 0.2, -0.44, 0.27), (0.03, 0.03, 0.035), BLACK, seg=8, ring=6)
        ell((s * 0.22, -0.46, 0.285), 0.01, WHITE, seg=6, ring=4)
        for k in range(3):
            box((0.01, 0.012, 0.08), (s * 0.29, -0.2 + k * 0.05, 0.22), shade(m, 0.7), rx=-10)  # gills
        with at((s * 0.28, -0.05, 0.1), ry=s * 30):
            box((0.2, 0.14, 0.03), (s * 0.1, 0.03, 0), m, bevel=0.01, **GLOSS)  # pectoral fins
    xslab([(-0.02, 0.4), (0.26, 0.4), (0.24, 0.48), (0.18, 0.7)], 0.05, m, bevel=0.012, **GLOSS)  # dorsal
    xslab([(0.5, 0.25), (0.6, 0.2), (0.82, 0.54), (0.74, 0.55)], 0.05, m, bevel=0.012, **GLOSS)  # tail
    xslab([(0.56, 0.2), (0.62, 0.22), (0.76, 0.06), (0.7, 0.04)], 0.04, m, bevel=0.01, **GLOSS)
    ell((0, -0.25, 0.42), (0.14, 0.15, 0.03), BLACK, seg=12, ring=4)
    return snaps(roof=(0, 0.35, 0.41), hood=(0, -0.45, 0.33), rear=(0, 0.46, 0.38), tail=(0, 0.6, 0.12),
                 front=(0, -0.66, 0.08), side=(0.31, 0.12, 0.2), seat=(0, -0.25, 0.16), exh=(0.16, 0.5, 0.06),
                 mast=(0.18, 0.32, 0.4), open_=True)


def bathtub(P):
    a = P.get("acc", BLUE)
    sx, sy = 0.92, 1.62
    for s in (-1, 1):
        for t in (-1, 1):
            ell((s * 0.24, t * 0.42, 0.05), (0.06, 0.06, 0.06), YEL, seg=8, ring=6, **MET)  # claw feet
    lathe([(0.28, 0.06), (0.335, 0.1), (0.36, 0.33), (0.375, 0.37), (0.35, 0.385), (0.33, 0.37), (0.315, 0.2), (0, 0.2)],
          (0, 0, 0), WHITE, n=14, sx=sx, sy=sy, **GLOSS)
    lathe([(0.322, 0.0), (0.322, 0.012), (0, 0.012)], (0, 0, 0.3), C(150, 214, 245), n=14, sx=sx, sy=sy, rough=0.2)
    import random
    rr = random.Random(4)
    for i in range(14):
        ang = rr.uniform(0, 2 * math.pi)
        rad = rr.uniform(0.2, 0.3)
        ell((math.cos(ang) * rad * sx, math.sin(ang) * rad * sy, 0.32), rr.uniform(0.025, 0.05), WHITE, seg=6, ring=4)
    # taps + shower pole
    rod((0, 0.54, 0.36), (0, 0.54, 0.82), 0.016, CHROME, **MET)
    rod((0, 0.54, 0.82), (0, 0.44, 0.84), 0.016, CHROME, **MET)
    lathe([(0.02, 0), (0.06, -0.04)], (0, 0.42, 0.84), CHROME, n=8, **MET)
    for s in (-1, 1):
        cyl(0.018, 0.04, (s * 0.07, 0.54, 0.37), CHROME, n=6, **MET)
        cyl(0.03, 0.015, (s * 0.07, 0.54, 0.41), RED if s > 0 else BLUE, n=6)
    # rubber duck on the front rim
    with at((0.1, -0.5, 0.39), rz=-30):
        ell((0, 0, 0.04), (0.05, 0.065, 0.04), YEL, seg=8, ring=6)
        ell((0, -0.03, 0.1), 0.033, YEL, seg=8, ring=6)
        cone(0.014, 0.03, (0, -0.06, 0.1), ORANGE, n=4, rx=90)
    return snaps(roof=(0, 0.5, 0.86), hood=(0, -0.53, 0.38), rear=(0, 0.6, 0.38), tail=(0, 0.62, 0.22),
                 front=(0, -0.62, 0.16), side=(0.34, 0.0, 0.22), seat=(0, 0.06, 0.16), exh=(0.15, 0.56, 0.1),
                 mast=(-0.18, 0.5, 0.38), open_=True)


# ---------------------------------------------------------------- closed shells

def _cabin(z0, z1, bot, top, roof_col, roof_t=0.035):
    tbox(z0, z1, bot, top, GLASS, bevel=0.04, seg=2, **GL)
    (tx, t0, t1) = top
    tbox(z1 - 0.005, z1 + roof_t, (tx + 0.012, t0 - 0.012, t1 + 0.012), (tx, t0, t1), roof_col, bevel=0.03, seg=2, **GLOSS)
    # pillars: a body-coloured band between the windscreen and side glass
    (bx, b0, b1) = bot
    for s in (-1, 1):
        rod((s * (bx - 0.005), b0 + 0.005, z0), (s * (tx + 0.002), t0 + 0.005, z1), 0.016, roof_col, n=4)
        rod((s * (bx - 0.005), b1 - 0.005, z0), (s * (tx + 0.002), t1 - 0.005, z1), 0.016, roof_col, n=4)


def muscle(P):
    m, a, rf = P["main"], P["acc"], P.get("roof", P["main"])
    tbox(0.0, 0.26, (0.33, -0.6, 0.6), (0.31, -0.56, 0.57), m, bevel=0.085, seg=3, **GLOSS)
    tbox(0.25, 0.3, (0.11, -0.54, -0.14), (0.09, -0.48, -0.16), m, bevel=0.015, **GLOSS)  # bonnet bulge
    _cabin(0.255, 0.45, (0.3, -0.1, 0.36), (0.25, 0.02, 0.27), rf)
    grille(-0.605, 0.16, 0.44, 0.08)
    box((0.62, 0.04, 0.04), (0, -0.615, 0.07), CHROME, bevel=0.012, **MET)
    box((0.62, 0.04, 0.04), (0, 0.615, 0.07), CHROME, bevel=0.012, **MET)
    headlights(-0.6, 0.165, 0.25, r=0.045)
    taillights(0.6, 0.18, 0.22, w=0.14)
    for s in (-1, 1):
        box((0.02, 0.1, 0.05), (s * 0.33, 0.02, 0.2), BLACK)  # side vent
    return snaps(roof=(0, 0.15, 0.485), hood=(0, -0.32, 0.3), rear=(0, 0.53, 0.26), tail=(0, 0.61, 0.15),
                 front=(0, -0.63, 0.08), side=(0.33, -0.15, 0.13), seat=(0, 0.1, 0.05), exh=(0.2, 0.6, 0.05),
                 mast=(0.24, 0.5, 0.26))


def _sedan(P, extra=None):
    m, rf = P["main"], P.get("roof", P["main"])
    tbox(0.0, 0.25, (0.33, -0.6, 0.6), (0.31, -0.56, 0.57), m, bevel=0.085, seg=3, **GLOSS)
    _cabin(0.245, 0.47, (0.31, -0.2, 0.34), (0.26, -0.08, 0.25), rf)
    grille(-0.605, 0.15, 0.3, 0.07)
    box((0.64, 0.05, 0.06), (0, -0.615, 0.06), CHAR, bevel=0.015)
    box((0.64, 0.05, 0.06), (0, 0.615, 0.06), CHAR, bevel=0.015)
    headlights(-0.6, 0.16, 0.23, r=0.045)
    taillights(0.6, 0.17, 0.22)
    for s in (-1, 1):
        box((0.012, 0.012, 0.18), (s * 0.331, 0.06, 0.13), shade(m, 0.7))  # door shut line
        box((0.016, 0.05, 0.014), (s * 0.332, -0.02, 0.19), CHROME, **MET)  # handle


def police(P):
    m, a = P["main"], P.get("acc", WHITE)
    _sedan(P)
    for s in (-1, 1):
        box((0.012, 0.42, 0.14), (s * 0.333, 0.02, 0.12), a, bevel=0.004)  # white doors
        with at((s * 0.342, -0.08, 0.13), rz=90 * s):
            slab(star(0.045), 0.012, (0, 0, 0), YEL, **GLOSS)
    box((0.66, 0.06, 0.05), (0, -0.64, 0.07), CHAR, bevel=0.01)  # push bar base
    return snaps(roof=(0, 0.08, 0.505), hood=(0, -0.42, 0.25), rear=(0, 0.52, 0.25), tail=(0, 0.62, 0.14),
                 front=(0, -0.66, 0.07), side=(0.33, -0.3, 0.13), seat=(0, 0.05, 0.05), mast=(0.24, 0.5, 0.25))


def taxi(P):
    m = P["main"]
    _sedan(P)
    for s in (-1, 1):
        for i in range(11):
            for j in range(2):
                col = BLACK if (i + j) % 2 else WHITE
                box((0.01, 0.06, 0.03), (s * 0.334, -0.3 + i * 0.06, 0.175 + j * 0.03), col)
    box((0.22, 0.09, 0.08), (0, 0.04, 0.545), LAMP, bevel=0.015, emit=0.3)
    box((0.225, 0.095, 0.02), (0, 0.04, 0.53), BLACK)
    return snaps(roof=(0, 0.15, 0.505), hood=(0, -0.42, 0.25), rear=(0, 0.52, 0.25), tail=(0, 0.62, 0.14),
                 front=(0, -0.64, 0.06), side=(0.33, -0.35, 0.1), seat=(0, 0.05, 0.05), mast=(0.24, 0.5, 0.25))


def rally(P):
    m, a, rf = P["main"], P["acc"], P.get("roof", P["main"])
    tbox(0.0, 0.27, (0.33, -0.6, 0.6), (0.31, -0.55, 0.57), m, bevel=0.09, seg=3, **GLOSS)
    _cabin(0.265, 0.5, (0.31, -0.18, 0.54), (0.26, -0.04, 0.46), rf)
    box((0.12, 0.16, 0.035), (0, 0.18, 0.55), CHAR, bevel=0.01)  # roof vent
    # livery: diagonal flash
    for s in (-1, 1):
        with at((s * 0.333, 0.02, 0.14), rz=90 * s):
            slab([(-0.3, -0.12), (-0.05, -0.12), (0.3, 0.12), (0.05, 0.12)], 0.01, (0, 0, 0), a)
    # lamp pod on the bonnet
    box((0.42, 0.05, 0.06), (0, -0.48, 0.3), CHAR, bevel=0.012)
    for i in range(4):
        x = -0.15 + i * 0.1
        cyl(0.04, 0.03, (x, -0.49, 0.32), CHAR, n=10, rx=90)
        cyl(0.03, 0.035, (x, -0.49, 0.32), YEL, n=10, rx=90, emit=0.4)
    grille(-0.605, 0.15, 0.26, 0.07)
    headlights(-0.6, 0.15, 0.22, r=0.04)
    taillights(0.6, 0.18, 0.22)
    for s in (-1, 1):
        box((0.12, 0.015, 0.12), (s * 0.24, 0.62, 0.02), CHAR)  # mud flaps
    return snaps(roof=(0, 0.3, 0.535), hood=(0, -0.3, 0.27), rear=(0, 0.48, 0.535), tail=(0, 0.61, 0.15),
                 front=(0, -0.63, 0.07), side=(0.33, -0.36, 0.12), seat=(0, 0.06, 0.05), mast=(0.24, 0.42, 0.535))


def bubble(P):
    m, a = P["main"], P["acc"]
    ell((0, 0, 0.27), (0.33, 0.6, 0.3), m, seg=12, ring=8, **GLOSS)
    ell((0, 0, 0.22), (0.338, 0.608, 0.035), a, seg=12, ring=4, **GLOSS)  # belt line
    ell((0, -0.12, 0.42), (0.25, 0.32, 0.2), GLASS, seg=12, ring=6, **GL)  # glass dome
    ell((0, -0.06, 0.6), (0.06, 0.06, 0.02), m, seg=8, ring=4)
    for s in (-1, 1):
        ell((s * 0.19, -0.5, 0.33), (0.06, 0.05, 0.06), CHROME, seg=8, ring=6, **MET)
        ell((s * 0.19, -0.535, 0.33), (0.045, 0.03, 0.045), LAMP, seg=8, ring=6, emit=0.35)
        ell((s * 0.2, 0.52, 0.3), (0.04, 0.04, 0.04), TAILL, seg=8, ring=6, emit=0.2)
    box((0.06, 0.03, 0.02), (0.0, -0.61, 0.18), CHROME, **MET)
    return snaps(roof=(0, 0.1, 0.6), hood=(0, -0.42, 0.45), rear=(0, 0.42, 0.49), tail=(0, 0.6, 0.27),
                 front=(0, -0.62, 0.12), side=(0.33, 0.12, 0.2), seat=(0, 0.0, 0.08), exh=(0.15, 0.56, 0.08),
                 mast=(0.18, 0.38, 0.48))


def icecream(P):
    m, a = P["main"], P.get("acc", TEAL)
    tbox(0.0, 0.24, (0.33, -0.6, 0.6), (0.32, -0.58, 0.59), m, bevel=0.07, seg=3, **GLOSS)
    tbox(0.23, 0.32, (0.31, -0.6, -0.34), (0.3, -0.58, -0.36), m, bevel=0.03, **GLOSS)  # bonnet
    tbox(0.23, 0.82, (0.33, -0.36, 0.6), (0.3, -0.28, 0.57), m, bevel=0.09, seg=3, **GLOSS)  # body box
    tbox(0.3, 0.6, (0.315, -0.45, -0.3), (0.29, -0.36, -0.3), GLASS, bevel=0.02, **GL)  # windscreen
    box((0.67, 0.6, 0.06), (0, 0.15, 0.14), a, bevel=0.01)  # pastel band
    box((0.672, 0.6, 0.025), (0, 0.15, 0.08), PINK, bevel=0.005)
    # serving hatch + counter + awning (left side)
    box((0.03, 0.42, 0.24), (0.32, 0.16, 0.5), BLACK)
    box((0.08, 0.44, 0.025), (0.35, 0.16, 0.38), CHROME, **MET)
    for i in range(5):
        with at((0.39, -0.02 + i * 0.09, 0.66), ry=28):
            box((0.17, 0.09, 0.014), (0, 0, 0), PINK if i % 2 else WHITE)
    # big cone on the roof
    with at((0, -0.08, 0.8)):
        lathe([(0.0, 0.0), (0.1, 0.2), (0.11, 0.21)], (0, 0, 0), TAN, n=10, lobes=0)
        ell((0, 0, 0.24), (0.11, 0.11, 0.08), CREAM, seg=10, ring=6)
        ell((0, 0, 0.32), 0.085, PINK, seg=10, ring=6)
        ell((0.02, -0.02, 0.41), 0.022, RED, seg=6, ring=4)
    headlights(-0.6, 0.16, 0.22, r=0.04)
    grille(-0.605, 0.18, 0.22, 0.06)
    box((0.64, 0.05, 0.05), (0, -0.615, 0.05), CHROME, bevel=0.012, **MET)
    taillights(0.6, 0.2, 0.24, w=0.06, h=0.1)
    return snaps(roof=(0, 0.28, 0.82), hood=(0, -0.48, 0.32), rear=(0, 0.52, 0.82), tail=(0, 0.6, 0.42),
                 front=(0, -0.63, 0.06), side=(0.33, -0.2, 0.13), seat=(0, -0.2, 0.07), mast=(0.24, 0.5, 0.82))


def delivery(P):
    m, a = P["main"], P.get("acc", ORANGE)
    tbox(0.0, 0.2, (0.33, -0.6, 0.6), (0.32, -0.59, 0.59), CHAR, bevel=0.03)
    tbox(0.18, 0.66, (0.32, -0.6, -0.2), (0.3, -0.52, -0.2), a, bevel=0.08, seg=3, **GLOSS)  # cab-over cab
    tbox(0.38, 0.6, (0.305, -0.61, -0.3), (0.29, -0.545, -0.3), GLASS, bevel=0.015, **GL)
    tbox(0.18, 0.86, (0.33, -0.18, 0.6), (0.31, -0.16, 0.58), m, bevel=0.09, seg=3, **GLOSS)  # cargo box
    for s in (-1, 1):
        box((0.01, 0.74, 0.07), (s * 0.333, 0.2, 0.3), a)
        with at((s * 0.337, 0.22, 0.6), rz=90 * s):
            box((0.24, 0.006, 0.18), (0, 0, 0), TAN)
            box((0.24, 0.008, 0.03), (0, 0, 0.02), C(180, 130, 70))
            box((0.03, 0.008, 0.18), (0, 0, 0), C(180, 130, 70))
    box((0.012, 0.012, 0.66), (0, 0.606, 0.52), shade(m, 0.7))  # rear door split
    headlights(-0.6, 0.14, 0.22, r=0.04)
    box((0.64, 0.05, 0.08), (0, -0.615, 0.08), CHAR, bevel=0.015)
    taillights(0.6, 0.22, 0.26, w=0.06, h=0.1)
    return snaps(roof=(0, 0.2, 0.86), hood=(0, -0.42, 0.66), rear=(0, 0.52, 0.86), tail=(0, 0.6, 0.4),
                 front=(0, -0.63, 0.08), side=(0.33, -0.35, 0.1), seat=(0, -0.35, 0.2), mast=(0.24, 0.5, 0.86))


BODIES = {
    "race": (race, "Race car", dict(main=RED, acc=WHITE), "coupe"),
    "muscle": (muscle, "Muscle car", dict(main=ORANGE, acc=CHAR), "coupe"),
    "bubble": (bubble, "Retro bubble car", dict(main=TEAL, acc=WHITE), "hatchback"),
    "rally": (rally, "Rally car", dict(main=BLUE, acc=YEL, roof=WHITE), "buggy"),
    "jeep": (jeep, "Jeep", dict(main=YEL, acc=CHAR), "buggy"),
    "police": (police, "Police", dict(main=BLUE, acc=WHITE, roof=WHITE), "coupe"),
    "taxi": (taxi, "Taxi", dict(main=YEL, acc=CHAR), "hatchback"),
    "icecream": (icecream, "Ice-cream van", dict(main=WHITE, acc=TEAL), "van"),
    "delivery": (delivery, "Delivery van", dict(main=WHITE, acc=ORANGE), "van"),
    "rocket": (rocket, "Rocket car", dict(main=WHITE, acc=RED), "hover"),
    "tractor": (tractor, "Tractor", dict(main=RED, acc=WHITE), "pickup"),
    "hotdog": (hotdog, "Hot dog car", dict(main=SAUSAGE, acc=YEL), "hatchback"),
    "shark": (shark, "Shark car", dict(main=SHARK, acc=WHITE), "coupe"),
    "bathtub": (bathtub, "Bathtub kart", dict(main=WHITE, acc=BLUE), "kart"),
}
BODY_ORDER = list(BODIES)
