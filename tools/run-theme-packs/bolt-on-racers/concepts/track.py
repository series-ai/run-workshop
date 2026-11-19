"""Bolt-On Racers optional track kit. Road tiles are 2.4 wide (two M cars side by side)."""
import math

from rk import (C, V, at, box, cyl, cone, ell, lathe, torus, slab, tbox, xslab, rod, poly, star,
                RED, YEL, TEAL, BLUE, WHITE, ORANGE, CHAR, TYRE, BLACK, CHROME, STEEL, LAMP, TAN, MET, GLOSS)

ROAD, ROAD_EDGE = C(84, 86, 98), C(70, 72, 84)
RW, RT = 2.4, 0.1


def _kerbs(y0, y1, x, n):
    for i in range(n):
        y = y0 + (y1 - y0) * (i + 0.5) / n
        box((0.16, (y1 - y0) / n * 0.98, 0.06), (x, y, RT + 0.0), RED if i % 2 else WHITE, bevel=0.01)


def straight():
    L = 2.4
    box((RW, L, RT), (0, 0, RT / 2), ROAD, bevel=0.02)
    for i in range(3):
        box((0.08, 0.4, 0.012), (0, -L / 2 + 0.4 + i * 0.8, RT + 0.002), WHITE)
    for s in (-1, 1):
        _kerbs(-L / 2, L / 2, s * (RW / 2 - 0.08), 8)


def _sector(r0, r1, a0, a1, z0, z1, col, n=10):
    vs, fs = [], []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        for r in (r0, r1):
            for z in (z0, z1):
                vs.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(n):
        b, c = i * 4, (i + 1) * 4
        # verts: 0 r0z0, 1 r0z1, 2 r1z0, 3 r1z1
        fs += [(b + 1, b + 3, c + 3, c + 1), (b + 0, c + 0, c + 2, b + 2), (b + 2, c + 2, c + 3, b + 3), (b + 0, b + 1, c + 1, c + 0)]
    fs += [(0, 2, 3, 1), (n * 4, n * 4 + 1, n * 4 + 3, n * 4 + 2)]
    poly(vs, fs, col)


def curve():
    r0, r1 = 0.5, 0.5 + RW
    with at((-1.4, -1.4, 0)):
        _sector(r0, r1, 0, 90, 0, RT, ROAD, n=10)
        n = 10
        for i in range(n):
            a0, a1 = 90 * i / n, 90 * (i + 1) / n
            _sector(r1 - 0.16, r1, a0, a1, RT, RT + 0.06, RED if i % 2 else WHITE, n=1)
            _sector(r0, r0 + 0.16, a0, a1, RT, RT + 0.06, WHITE if i % 2 else RED, n=1)
        for i in range(4):
            a = math.radians(11 + i * 22.5)
            rm = (r0 + r1) / 2
            with at((rm * math.cos(a), rm * math.sin(a), RT + 0.002), rz=math.degrees(a)):
                box((0.08, 0.36, 0.012), (0, 0, 0), WHITE)


def ramp():
    L, H = 2.0, 0.6
    xslab([(-L / 2, 0), (L / 2, 0), (L / 2, H), (L / 2 - 0.12, H)], 1.8, YEL, bevel=0.02, **GLOSS)
    ang = math.degrees(math.atan2(H, L - 0.12))
    for i in range(3):
        y = -0.5 + i * 0.45
        z = (y + L / 2) / (L - 0.12) * H
        with at((0, y, z + 0.01), rx=ang):
            for s in (-1, 1):
                box((0.4, 0.1, 0.02), (s * 0.18, 0.0, 0), BLACK, rz=s * 35)
    for s in (-1, 1):
        box((0.06, L * 0.6, 0.06), (s * 0.93, 0.2, 0.15), RED, bevel=0.01)


def loop():
    R, Wd, n = 1.5, 0.9, 22
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        x = -0.55 + 1.1 * i / (n - 1)
        y, z = R * math.sin(a), R - R * math.cos(a)
        seg_len = 2 * math.pi * R / n * 1.04
        with at((x, y, z), rx=math.degrees(a)):
            box((Wd, seg_len, 0.06), (0, 0, -0.03), ROAD)
            for s in (-1, 1):
                box((0.1, seg_len, 0.1), (s * (Wd / 2 + 0.03), 0, -0.01), RED if i % 2 else WHITE)
    for s in (-1, 1):
        rod((s * 0.9, 0.0, 0.0), (s * 0.9, 0.0, R * 2 - 0.1), 0.05, STEEL, **MET)
    box((2.0, 0.3, 0.06), (0, 0, 0.03), CHAR)
    for y, x in ((-2.0, -0.55), (2.0, 0.55)):
        box((Wd, 1.2, RT), (x, y, RT / 2), ROAD)


def boost_pad():
    box((1.4, 1.6, 0.06), (0, 0, 0.03), CHAR, bevel=0.02)
    box((1.3, 1.5, 0.02), (0, 0, 0.065), C(60, 40, 110))
    for i in range(3):
        y = 0.45 - i * 0.45
        for s in (-1, 1):
            box((0.5, 0.14, 0.03), (s * 0.18, y, 0.08), C(255, 200, 40) if i != 1 else ORANGE, rz=s * -38, emit=1.0)


def barriers():
    for i in range(3):
        with at((0, -0.75 + i * 0.75, 0)):
            tbox(0.0, 0.42, (0.2, -0.36, 0.36), (0.1, -0.34, 0.34), RED if i % 2 else WHITE, bevel=0.03, **GLOSS)
            box((0.05, 0.1, 0.05), (0, 0.36, 0.38), CHAR)
    with at((0.8, 0, 0)):
        for i in range(4):
            box((0.06, 0.06, 0.4), (0, -1.0 + i * 0.66, 0.2), STEEL, **MET)
        for z in (0.22, 0.32):
            box((0.05, 2.1, 0.07), (-0.05, 0, z), CHROME, bevel=0.012, **MET)


def tyre_stack():
    for (x, y, h) in ((0, 0, 4), (0.42, 0.1, 3), (0.2, -0.38, 2)):
        for k in range(h):
            with at((x, y, 0.08 + k * 0.16)):
                lathe([(0.11, -0.08), (0.18, -0.08), (0.2, -0.05), (0.2, 0.05), (0.18, 0.08), (0.11, 0.08), (0.11, -0.08)],
                      (0, 0, 0), TYRE, n=12, cap=False, rough=0.9)
                if k == h - 1:
                    cyl(0.11, 0.02, (0, 0, -0.06), CHAR, n=12)
        torus(0.2, 0.015, (x, y, 0.08 + (h - 1) * 0.16), RED if h % 2 else WHITE, n=12, k=4)


def cones():
    for (x, y, rz) in ((0, 0, 0), (0.42, 0.25, 20), (-0.36, 0.3, -10)):
        with at((x, y, 0), rz=rz):
            box((0.28, 0.28, 0.04), (0, 0, 0.02), ORANGE, bevel=0.01)
            lathe([(0.11, 0.04), (0.02, 0.44), (0, 0.44)], (0, 0, 0), ORANGE, n=10, **GLOSS)
            lathe([(0.083, 0.15), (0.058, 0.25)], (0, 0, 0.002), WHITE, n=10, cap=False)
    with at((0.45, -0.3, 0.06), rx=90, rz=60):
        lathe([(0.11, 0.04), (0.02, 0.44), (0, 0.44)], (0, 0, 0), ORANGE, n=10, **GLOSS)


def gate():
    for s in (-1, 1):
        box((0.2, 0.2, 1.4), (s * 1.3, 0, 0.7), RED, bevel=0.03, **GLOSS)
        box((0.26, 0.26, 0.08), (s * 1.3, 0, 0.04), CHAR)
    box((2.8, 0.18, 0.36), (0, 0, 1.45), WHITE, bevel=0.02)
    for i in range(14):
        for j in range(2):
            if (i + j) % 2:
                box((0.18, 0.02, 0.15), (-1.17 + i * 0.18, -0.09, 1.38 + j * 0.15), BLACK)
    for i in range(3):
        cyl(0.05, 0.04, (-0.15 + i * 0.15, -0.1, 1.73), CHAR, n=8, rx=90)
        cyl(0.04, 0.045, (-0.15 + i * 0.15, -0.1, 1.73), (RED, YEL, C(80, 230, 90))[i], n=8, rx=90, emit=1.0)
    box((0.6, 0.12, 0.14), (0, 0, 1.73), CHAR, bevel=0.02)
    box((2.4, 0.3, 0.012), (0, 0, 0.006), WHITE)


def flag():
    rod((0, 0, 0), (0, 0, 1.1), 0.02, STEEL, **MET)
    ell((0, 0, 1.12), 0.035, YEL, seg=8, ring=6)
    for i in range(6):
        for j in range(4):
            col = BLACK if (i + j) % 2 else WHITE
            wave = 0.05 * math.sin(i * 0.9)
            box((0.012, 0.09, 0.09), (wave, 0.05 + i * 0.09, 1.05 - j * 0.09), col)


def pit_stop():
    box((1.6, 1.2, 0.04), (0, 0, 0.02), C(200, 200, 206))
    box((1.6, 0.08, 0.9), (0, 0.56, 0.45), WHITE, bevel=0.02)
    for s in (-1, 1):
        box((0.06, 0.06, 0.9), (s * 0.78, -0.56, 0.45), CHAR)
    for i in range(8):
        with at((-0.7 + i * 0.2, 0, 0.92), rx=-8):
            box((0.2, 1.3, 0.03), (0, 0, 0), RED if i % 2 else WHITE)
    # tool chest, tyre rack, fuel pump, lollipop
    box((0.3, 0.2, 0.36), (0.5, 0.4, 0.18), RED, bevel=0.02, **GLOSS)
    for k in range(3):
        box((0.26, 0.012, 0.02), (0.5, 0.295, 0.08 + k * 0.1), CHROME, **MET)
    for k in range(3):
        with at((-0.5, 0.35, 0.12 + k * 0.17), ry=0):
            lathe([(0.08, -0.06), (0.14, -0.06), (0.15, 0.06), (0.08, 0.06), (0.08, -0.06)], (0, 0, 0), TYRE, n=10, cap=False)
    box((0.22, 0.18, 0.5), (0.0, 0.4, 0.25), YEL, bevel=0.03, **GLOSS)
    rod((0.11, 0.4, 0.3), (0.2, 0.2, 0.2), 0.015, BLACK)
    rod((0.6, -0.4, 0.04), (0.6, -0.4, 0.6), 0.015, STEEL, **MET)
    with at((0.6, -0.4, 0.68), rx=90):
        cyl(0.12, 0.02, (0, 0, -0.01), RED, n=12)


def item_box():
    with at((0, 0, 0.7), rx=20, ry=25, rz=30):
        box((0.6, 0.6, 0.6), (0, 0, 0), C(120, 220, 255), bevel=0.08, emit=0.35, rough=0.2)
        for (ax, sgn) in ((0, -1), (1, 1), (2, 1), (0, 1), (1, -1), (2, -1)):
            rot = {(0, -1): dict(rx=0), (0, 1): dict(rz=180), (1, 1): dict(rz=90), (1, -1): dict(rz=-90), (2, 1): dict(rx=-90), (2, -1): dict(rx=90)}[(ax, sgn)]
            with at((0, 0, 0), **rot):
                _qmark((0, -0.305, 0))
    for (x, y, z) in ((0.5, -0.2, 1.1), (-0.45, 0.1, 0.35), (0.35, 0.3, 0.2)):
        ell((x, y, z), 0.05, YEL, seg=4, ring=2, emit=1.0)
    ell((0, 0, 0.01), (0.4, 0.4, 0.01), C(200, 200, 210), seg=12, ring=2)


def _qmark(c):
    with at(c):
        with at((0, 0, 0.05), rx=90):
            torus(0.1, 0.035, (0, 0, 0), WHITE, n=10, k=4, arc=250, rz=-70)
        box((0.07, 0.03, 0.12), (0.0, -0.005, -0.08), WHITE)
        box((0.07, 0.03, 0.07), (0, -0.005, -0.21), WHITE)


TRACK = [
    ("Road straight", straight), ("Road curve", curve), ("Ramp", ramp), ("Loop", loop), ("Boost pad", boost_pad),
    ("Barriers", barriers), ("Tyre stack", tyre_stack), ("Cones", cones), ("Start/finish gate", gate),
    ("Checkered flag", flag), ("Pit stop", pit_stop), ("Item box", item_box),
]
