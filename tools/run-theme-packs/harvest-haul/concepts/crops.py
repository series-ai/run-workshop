"""Crops: 6 growth stages each on one shared soil mound (planted, sprout, young,
mature, ripe, withered), the apple tree adds a blossom stage, plus the loose
harvested produce item for every crop."""
import math

from hh import *  # noqa: F401,F403
import gourds

T = MOUND_TOP


# ---------------------------------------------------------------- shared stage pieces

def marker(col):
    """Little wooden plant label at the back of a freshly planted mound."""
    with at((0.2, 0.16, mz(0.26) - 0.02), rz=25, ry=-6):
        box((0.022, 0.022, 0.3), (0, 0, 0.15), WOOD_L)
        box((0.12, 0.024, 0.075), (0, -0.004, 0.26), col, bevel=0.012)


def planted(seed=CREAM, tag=ORANGE):
    mound()
    ell((0, 0, T - 0.004), (0.13, 0.13, 0.014), SOIL_D, seg=8, ring=4)
    for x, y, a in [(-0.04, -0.03, 20), (0.04, 0.0, -30), (0.0, 0.045, 80)]:
        ell((x, y, T + 0.01), (0.026, 0.016, 0.01), seed, rz=a, seg=6, ring=4)
    r = rng(5)
    for i in range(6):
        a = r.uniform(0, 6.28)
        rr = r.uniform(0.2, 0.38)
        ell(on_mound(rr * math.cos(a), rr * math.sin(a), 0.004), r.uniform(0.018, 0.03), SOIL_D, seg=6, ring=4)
    marker(tag)


def sprout(col=LEAF_L, s=1.0, mono=False, at_xy=(0, 0)):
    x, y = at_xy
    z = mz(math.hypot(x, y)) - 0.01
    if mono:
        for k, yaw in enumerate((40, 160, 280)):
            leaf((x, y, z), yaw, 0.2 * s * (1 - 0.15 * k), 0.04 * s, 72, col, droop=0.12, shape=STRAP)
        return
    stalk([(x, y, z), (x, y, z + 0.06 * s), (x + 0.01, y, z + 0.12 * s)], 0.018 * s, 0.013 * s, col)
    for yaw in (25, 205):
        leaf((x + 0.01, y, z + 0.12 * s), yaw, 0.11 * s, 0.09 * s, 28, col, shape=ROUND, droop=0.1)


def petiole_leaf(base, yaw, size, col, elev=25, rise=0.1, droop=0.25, shape=ROUND, scol=None):
    """A leaf on its own short stalk."""
    b = P(base)
    y = yaw * D2R
    top = b + P(math.cos(y) * size * 0.25, math.sin(y) * size * 0.25, rise)
    stalk([b, b + (top - b) * 0.5 + P(0, 0, rise * 0.15), top], 0.014, 0.01, scol or col, n=5, rings=5)
    leaf(top, yaw, size, size * 0.9, elev, col, droop=droop, shape=shape, t=0.016)


def tendril(base, yaw, r=0.05, col=LEAF_L, turns=1.3):
    b = P(base)
    y = yaw * D2R
    d = P(math.cos(y), math.sin(y), 0)
    pts = [b, b + d * 0.06 + P(0, 0, 0.03)]
    c = b + d * 0.1 + P(0, 0, 0.05)
    for i in range(7):
        a = i / 6 * turns * 2 * math.pi
        rr = r * (1 - 0.5 * i / 6)
        pts.append(c + d * rr * math.cos(a) + P(0, 0, rr * math.sin(a)))
    tube(pts, lambda t: 0.022 * (1 - 0.4 * t), col, rings=16, n=5)


def flower_trumpet(c, d, col=C(250, 200, 50), s=1.0):
    with oriented(c, d, s=s):
        lathe([(0.015, 0), (0.03, 0.05), (0.06, 0.1), (0.075, 0.11), (0.05, 0.1), (0, 0.08)], (0, 0, 0), col, n=5, lobes=5, lobe_depth=0.3)


def star_flower(c, col=CREAM, mid=MUSTARD, s=1.0, d=(0, -0.4, 1)):
    with oriented(c, d, s=s):
        for i in range(5):
            leaf((0, 0, 0), i * 72, 0.05, 0.045, 8, col, shape=ROUND, t=0.008)
        ell((0, 0, 0.008), (0.018, 0.018, 0.012), mid, seg=6, ring=4)


def calyx(c, r, col=LEAF_D, n=5, elev=12, d=(0, 0, 1)):
    with oriented(c, d):
        for i in range(n):
            leaf((0, 0, 0), i * 360 / n + 10, r, r * 0.42, elev, col, t=0.008, n=4)


# ---------------------------------------------------------------- produce pieces (reused on plants)

def tomato_fruit(c, r=0.07, col=TOMATO, cal=LEAF_D):
    with at(c):
        lathe([(0, -0.78 * r), (0.62 * r, -0.68 * r), (r, -0.12 * r), (0.9 * r, 0.48 * r), (0.42 * r, 0.8 * r), (0, 0.7 * r)],
              (0, 0, 0), col, n=10, lobes=5, lobe_depth=0.09, rough=0.45)
        if cal:
            calyx((0, 0, 0.7 * r), r * 0.6, cal)
            cyl(0.01, 0.04, (0, 0, 0.7 * r), cal, n=4)


def apple_fruit(c, r=0.08, col=RED, leafy=False, rz=0):
    with at(c, rz=rz):
        lathe([(0, -0.82 * r), (0.4 * r, -0.86 * r), (0.85 * r, -0.5 * r), (r, 0.05 * r), (0.85 * r, 0.6 * r), (0.4 * r, 0.82 * r), (0, 0.66 * r)],
              (0, 0, 0), col, n=9, lobes=0, rough=0.4)
        stalk([(0, 0, 0.62 * r), (0.01, 0, 0.9 * r), (0.04 * r, 0, 1.12 * r)], 0.014 * r / 0.08, 0.009 * r / 0.08, BROWN, n=4, rings=4)
        if leafy:
            leaf((0.01, 0, 0.95 * r), 20, r * 1.2, r * 0.6, 25, LEAF, droop=0.2)


def cob(base, d, L=0.34, husk=C(170, 196, 110), kernels=C(250, 204, 70), peeled=0.45, silk=C(166, 112, 64), s=1.0):
    """Corn ear along d from base: kernels lathe, husk leaves peeled back by `peeled`."""
    with oriented(base, d, s=s):
        r = 0.065
        lathe([(0.03, 0), (r, 0.04), (r * 1.05, 0.14), (r * 0.95, 0.24), (r * 0.6, 0.31), (0, L * 0.98)], (0, 0, 0), kernels, n=10, lobes=10, lobe_depth=0.12)
        # husk leaves hugging / peeled down
        for i in range(4):
            yaw = i * 90 + 20
            if peeled > 0.2:
                leaf((0, 0, 0.05), yaw, L * 0.7, 0.1, -55 + 20 * (1 - peeled), husk, droop=-0.05, shape=LANCE, t=0.012)
            else:
                a = yaw * D2R
                pts = [(0, 0, 0.0)] + [((r + 0.01) * math.cos(a) * (1 - z / L * 0.6), (r + 0.01) * math.sin(a) * (1 - z / L * 0.6), z) for z in (0.08, L * 0.6, L * 0.9)]
                tube(pts, lambda t: (0.05 * (1 - t * 0.7), 0.012), husk, rings=6, n=4, side=(-math.sin(a), math.cos(a), 0))
        if silk:
            for i in range(4):
                a = i * 1.6
                tube([(0, 0, L * 0.93), (0.02 * math.cos(a), 0.02 * math.sin(a), L * 1.06), (0.05 * math.cos(a), 0.05 * math.sin(a), L * 1.1)], lambda t: 0.016, silk, rings=5, n=4)


def carrot_root(c, L=0.3, r=0.065, col=C(242, 126, 40), d=(0, 0, -1)):
    with oriented(c, d):
        lathe([(0, -0.01), (r * 0.9, 0.0), (r, 0.04), (r * 0.8, L * 0.4), (r * 0.45, L * 0.75), (0, L)], (0, 0, 0), col, n=8)
        for z in (L * 0.3, L * 0.55):
            torus(r * 0.82 * (1 - z / L * 0.7), 0.007, (0, 0, z), col, n=8, k=4)


def frond(base, yaw, h, col, droop=0.0, lean=20):
    """Feathery carrot top: a stem with little leaflets."""
    b = P(base)
    y = yaw * D2R
    d = P(math.cos(y), math.sin(y), 0)
    l = lean * D2R
    pts = [b + d * h * math.sin(l) * f + P(0, 0, h * math.cos(l) * f) - P(0, 0, droop * h * f * f) + d * droop * h * f * 0.5 for f in (0, 0.33, 0.66, 1)]
    stalk(pts, 0.012, 0.007, col, n=4, rings=6)
    sp = spline(pts, 7)
    for i, k in enumerate((2, 4)):
        side = 1 if i % 2 else -1
        leaf(sp[k], yaw + side * 55, h * 0.36, h * 0.24, 30 - droop * 60, col, droop=droop * 0.5, t=0.01)
    leaf(sp[6], yaw, h * 0.32, h * 0.22, 60 - droop * 120, col, t=0.01, shape=ROUND)


def potato(c, r=0.075, col=C(206, 160, 106), seed=1, rz=0):
    with at(c, rz=rz):
        ell((0, 0, 0), (r * 1.25, r, r * 0.85), col, seg=8, ring=6)
        rr = rng(seed)
        for _ in range(3):
            a = rr.uniform(0, 6.28)
            ell((r * 1.05 * math.cos(a), r * 0.85 * math.sin(a), rr.uniform(-0.2, 0.4) * r), r * 0.12, C(176, 128, 84), seg=5, ring=3)


def onion_bulb(c, r=0.12, col=C(212, 146, 72), dry=False):
    with at(c):
        lathe([(0, 0), (0.03, 0.0), (r * 0.8, r * 0.3), (r, r * 0.75), (r * 0.8, r * 1.2), (r * 0.3, r * 1.55), (r * 0.15, r * 1.75), (0, r * 1.8)],
              (0, 0, 0), col, n=10, lobes=5, lobe_depth=0.05, twist=20)
        for a in range(4):
            tube([(0, 0, 0.005), ((0.012 + 0.01 * a) * math.cos(a * 1.5), (0.012 + 0.01 * a) * math.sin(a * 1.5), -0.035)], lambda t: 0.004, CREAM, rings=3, n=3)


def eggplant_fruit(c, d=(0, 0, -1), L=0.24, r=0.075, col=PLUM):
    with oriented(c, d):
        lathe([(0, 0), (r * 0.45, 0.01), (r * 0.7, L * 0.25), (r, L * 0.65), (r * 0.85, L * 0.92), (0, L)], (0, 0, 0), col, n=10, rough=0.25)
        lathe([(r * 0.55, -0.005), (r * 0.6, 0.04), (0, 0.05)], (0, 0, 0), LEAF_D, n=5, lobes=5, lobe_depth=0.3)
        for i in range(5):
            leaf((0, 0, 0.035), i * 72, r * 0.9, r * 0.5, -60, LEAF_D, t=0.008, n=4)
        stalk([(0, 0, 0), (0, 0, -0.04), (0.01, 0, -0.07)], 0.014, 0.012, LEAF_D, n=5, rings=4)


def berry(c, r=0.06, col=C(228, 50, 60), d=(0, 0, -1), seeds=True):
    with oriented(c, d):
        lathe([(0, 0), (r * 0.7, 0.01), (r, r * 0.5), (r * 0.7, r * 1.15), (0, r * 1.55)], (0, 0, 0), col, n=8, rough=0.4)
        calyx((0, 0, -0.002), r * 0.9, LEAF, elev=-20, d=(0, 0, -1))
        if seeds:
            for k in range(8):
                a = k * 2.4
                z = r * (0.35 + 0.12 * (k % 4))
                rr = r * (0.98 - 0.25 * (k % 4) / 3)
                ell((rr * math.cos(a), rr * math.sin(a), z), r * 0.08, C(250, 226, 120), seg=4, ring=3)


def pod(c, d, L=0.26, col=LEAF, curve=0.04, s=1.0):
    with oriented(c, d, s=s):
        tube([(0, 0, 0), (curve * 0.4, 0, L * 0.3), (curve, 0, L * 0.7), (curve * 0.6, 0, L)],
             lambda t: (0.03 * min(1, 5 * t, 5 * (1 - t)) * (0.8 + 0.2 * abs(math.sin(3 * math.pi * t))) + 0.004, 0.022),
             col, rings=14, n=6, side=(0, 1, 0))


def crookneck(c, s=1.0, col=C(252, 204, 62), rz=0, sz=1.0):
    """Yellow crookneck squash lying on its side: fat bulb, neck curling up."""
    with at(c, rz=rz, s=(s, s, s * sz)):
        pts = [(-0.17, 0, 0.085), (-0.06, 0, 0.085), (0.05, 0, 0.08), (0.13, 0, 0.1), (0.18, 0, 0.16), (0.18, 0, 0.21)]

        def prof(t):
            if t < 0.12:
                return 0.04 + 0.05 * math.sin(t / 0.12 * math.pi / 2)
            return 0.09 - 0.055 * min(1, (t - 0.12) / 0.7) ** 1.2
        tube(pts, prof, col, rings=12, n=9, rough=0.5, side=(0, 1, 0))
        lathe([(0.022, 0), (0.016, 0.05), (0.02, 0.06), (0, 0.065)], (0.18, 0, 0.2), LEAF_D, n=5, ry=-6)


def sunflower_head(c, d, r=0.2, petal=C(250, 198, 46), disc=C(120, 72, 42), wilted=False):
    with oriented(c, d):
        lathe([(r * 0.95, -0.05), (r * 1.0, 0.0), (r * 0.98, 0.04), (r * 0.7, 0.06), (0, 0.065)], (0, 0, 0), disc, n=12)
        lathe([(0.04, -0.12), (r * 0.6, -0.07), (r * 0.95, -0.05)], (0, 0, 0), LEAF_D if not wilted else DRY_D, n=12)
        n = 14
        pcol = petal if not wilted else DRY
        L = r * (0.75 if not wilted else 0.45)
        for i in range(n):
            leaf((r * 0.85 * math.cos(i * 2 * math.pi / n), r * 0.85 * math.sin(i * 2 * math.pi / n), 0.0), i * 360 / n, L, r * 0.36,
                 6 if not wilted else -40, pcol, shape=ROUND, t=0.012)
            a = (i + 0.5) * 2 * math.pi / n
            leaf((r * 0.8 * math.cos(a), r * 0.8 * math.sin(a), -0.02), math.degrees(a), L * 0.85, r * 0.32, -8 if not wilted else -50,
                 tuple(x * 0.9 for x in pcol), shape=ROUND, t=0.012)
        # seed spiral dots
        for k in range(16):
            a = k * 2.4
            rr = r * 0.8 * math.sqrt((k + 1) / 16)
            ell((rr * math.cos(a), rr * math.sin(a), 0.058 - rr * 0.1), 0.022, tuple(x * 0.75 for x in disc), seg=5, ring=3)


def beet_root(c, r=0.1, col=MAGENTA, d=(0, 0, -1)):
    with oriented(c, d):
        lathe([(0, -0.012), (r * 0.6, -0.01), (r, r * 0.45), (r * 0.85, r * 1.1), (r * 0.4, r * 1.55), (0, r * 1.95)], (0, 0, 0), col, n=9)
        tube([(0, 0, r * 1.9), (0.01, 0, r * 2.6), (0.03, 0, r * 3.1)], lambda t: 0.012 * (1 - t), col, rings=4, n=4)


def cabbage_head(c, r=0.2, col=C(188, 216, 132), vein=C(214, 232, 170)):
    with at(c):
        lathe([(0, -0.02), (r * 0.6, -0.0), (r * 0.98, r * 0.5), (r, r * 0.95), (r * 0.8, r * 1.45), (r * 0.4, r * 1.72), (0, r * 1.78)],
              (0, 0, 0), col, n=10, lobes=5, lobe_depth=0.06, twist=40)
        # overlapping wrapper leaves
        for i in range(4):
            yaw = i * 90 + 30
            a = yaw * D2R
            ctr = P(math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, r * 0.6)
            with oriented(ctr, P(math.cos(a), math.sin(a), 0.35)):
                lathe([(0, -0.02), (r * 0.55, 0.0), (r * 0.62, 0.035), (0, 0.045)], (0, 0, 0), vein, n=8, sx=1.0, sy=1.25)


# ---------------------------------------------------------------- crops

LEAFC = {False: LEAF, True: DRY}


def crop_pumpkin(st):
    if st == 0:
        return planted(CREAM, ORANGE)
    mound()
    if st == 1:
        return sprout()
    w = st == 5
    lc = DRY if w else LEAF
    if st == 2:
        stalk([(0, 0, T - 0.01), (0.02, 0.02, T + 0.05), (0.05, 0.06, T + 0.07)], 0.02, 0.016, STEM)
        for yaw, sz in ((200, 0.2), (100, 0.18), (330, 0.17)):
            petiole_leaf((0.02, 0.02, T + 0.05), yaw, sz, LEAF, elev=25, rise=0.08)
        tendril((0.04, 0.05, T + 0.06), 20, 0.04)
        return
    # vine across the mound
    stalk([(0, 0, T - 0.01), (0.1, 0.12, mz(0.16) + 0.02), (0.25, 0.25, mz(0.35) + 0.03), (0.38, 0.22, 0.04)], 0.024, 0.016, DRY_D if w else STEM)
    leaves = [(150, 0.34, (-0.02, 0.1)), (90, 0.3, (0.1, 0.14)), (40, 0.3, (0.22, 0.22)), (230, 0.28, (-0.05, 0.02)), (330, 0.26, (0.3, 0.1))]
    if st == 4:
        leaves = [(150, 0.32, (-0.02, 0.14)), (90, 0.3, (0.1, 0.18)), (40, 0.3, (0.24, 0.24)), (200, 0.26, (-0.12, 0.1))]
    for yaw, sz, (x, y) in leaves:
        if w:
            leaf(on_mound(x, y, 0.01), yaw, sz * 0.9, sz * 0.8, 6, lc, droop=0.15, shape=ROUND, t=0.014)
        else:
            petiole_leaf(on_mound(x, y), yaw, sz, lc, elev=22, rise=0.16)
    if st == 3:
        tendril(on_mound(0.3, 0.2, 0.02), -30, 0.05)
        flower_trumpet(on_mound(-0.12, -0.12, 0.02), (-0.4, -0.7, 0.6), s=1.2)
        with at(on_mound(0.12, -0.2, -0.02)):
            _green_pumpkin(0.34)
    elif st == 4:
        tendril(on_mound(0.3, 0.24, 0.02), -40, 0.05)
        with at(on_mound(0.02, -0.1, -0.05)):
            gourds.gourd("round", "orange", "curly", s=0.82)
    else:
        with at(on_mound(0.02, -0.1, -0.05)):
            gourds.gourd("round", "withered", "dry", s=(0.74, 0.74, 0.5))


def _green_pumpkin(s):
    g = Gourd(gourds.BODIES["round"][0], 8, 0.1)
    with at((0, 0, 0), s=s, rz=25):
        g.build(C(120, 160, 72))
        with at((0, 0, 0.5)):
            gourds.stem("stub")


def crop_corn(st):
    if st == 0:
        return planted(C(250, 204, 70), MUSTARD)
    mound()
    if st == 1:
        return sprout(mono=True)
    if st == 2:
        for k, yaw in enumerate((20, 110, 200, 290, 70)):
            leaf((0, 0, T - 0.01), yaw, 0.42 - 0.05 * k, 0.07, 66, LEAF, droop=0.25, shape=STRAP)
        return
    w = st == 5
    sc = DRY if w else C(138, 176, 80)
    lc = DRY if w else LEAF
    H = 1.3
    if w:
        pts = [(0, 0, T - 0.02), (0, 0, 0.7), (0.02, 0, 1.25), (0.12, -0.05, 1.5), (0.3, -0.1, 1.5)]
    else:
        pts = [(0, 0, T - 0.02), (0, 0, 0.7), (0, 0, 1.3), (0, 0, H)]
    stalk(pts, 0.085, 0.05, sc, n=6)
    # nodes
    for z in (0.45, 0.75, 1.05):
        torus(0.075, 0.016, (0, 0, z), sc, n=6, k=4)
    for k, z in enumerate((0.3, 0.48, 0.66, 0.84, 1.0, 1.14)):
        yaw = (25 + 180 * k + (k * 15)) % 360
        L = (0.85 - 0.07 * k) * (0.6 if w else 1.0)
        leaf((0, 0, z), yaw, L, 0.17, 38 if not w else 0, lc, droop=0.55 if not w else 0.9, shape=STRAP)
    top = P(pts[-1])
    tcol = STRAW if st == 4 else (DRY_D if w else C(196, 210, 120))
    if not w:
        for i in range(6):
            a = i * 60 * D2R
            tube([top, top + P(0.04 * math.cos(a), 0.04 * math.sin(a), 0.14), top + P(0.12 * math.cos(a), 0.12 * math.sin(a), 0.2)],
                 lambda t: 0.034 * (1 - 0.5 * t), tcol, rings=5, n=5)
        tube([top, top + P(0, 0, 0.25)], lambda t: 0.04 * (1 - 0.6 * t), tcol, rings=3, n=4)
    if st == 3:
        cob((0.05, -0.04, 0.72), (0.4, -0.5, 1.0), L=0.22, peeled=0, silk=C(226, 214, 130), kernels=C(200, 214, 120), s=1.4)
    elif st == 4:
        cob((0.06, -0.04, 0.56), (0.45, -0.35, 1.0), L=0.32, peeled=0.0, silk=C(150, 96, 56), s=1.9)
        cob((-0.06, -0.02, 0.8), (-0.6, -0.2, 1.0), L=0.28, peeled=0.0, silk=C(150, 96, 56), s=1.75)
    elif w:
        cob((0.05, -0.05, 0.75), (0.5, -0.4, -0.3), L=0.28, peeled=0.0, husk=DRY_D, kernels=C(196, 160, 90), silk=C(110, 80, 60), s=1.4)


def wheat_head(top, d, col, L=0.18, awns=True, s=1.0):
    with oriented(top, d, s=s):
        lathe([(0.012, 0), (0.03, 0.04), (0.032, L * 0.6), (0.016, L), (0, L * 1.05)], (0, 0, 0), col, n=5)
        for k in range(5):
            z = 0.025 + k * L * 0.17
            for sgn in (-1, 1):
                with at((0, 0, z), rz=90 * (k % 2), ry=sgn * 32):
                    ell((sgn * 0.0, 0, 0.03), (0.022, 0.016, 0.034), col, seg=6, ring=4)
        if awns:
            for k in range(4):
                a = k * 90 * D2R
                tube([(0, 0, L * 0.6), (0.03 * math.cos(a), 0.03 * math.sin(a), L * 1.3), (0.05 * math.cos(a), 0.05 * math.sin(a), L * 1.6)],
                     lambda t: 0.004, col, rings=3, n=3)


def crop_wheat(st):
    if st == 0:
        return planted(C(214, 170, 90), STRAW)
    mound()
    if st == 1:
        for x, y in ((-0.08, 0.02), (0.08, -0.03), (0.0, 0.09)):
            sprout(mono=True, s=0.7, at_xy=(x, y))
        return
    r = rng(7)
    spots = [(0.0, 0.0), (0.17, 0.06), (-0.16, 0.08), (0.08, -0.17), (-0.12, -0.13)]
    if st == 2:
        for x, y in spots[:7]:
            for k in range(2):
                leaf(on_mound(x, y, -0.01), r.uniform(0, 360), r.uniform(0.18, 0.28), 0.035, r.uniform(62, 80), LEAF, droop=0.15, shape=STRAP)
        return
    w = st == 5
    col = {3: C(150, 190, 84), 4: C(232, 192, 92), 5: C(168, 148, 112)}[st]
    hcol = {3: C(170, 206, 104), 4: C(240, 200, 100), 5: C(150, 128, 96)}[st]
    for i, (x, y) in enumerate(spots):
        b = P(on_mound(x, y, -0.02))
        H = r.uniform(0.6, 0.74)
        lean = P(x * 0.6 + r.uniform(-0.05, 0.05), y * 0.6 + r.uniform(-0.05, 0.05), 0)
        if w:
            # lodged: bent over halfway
            bd = P(x, y, 0).normalized() if (x or y) else P(0.6, -0.8, 0)
            mid = b + P(0, 0, H * 0.55) + lean * 0.3
            tip = mid + bd * 0.1 + P(0, 0, 0.03)
            stalk([b, mid, tip], 0.026, 0.018, col, n=5, rings=6)
            wheat_head(tip, bd + P(0, 0, -1.2), hcol, L=0.13, awns=False, s=2.0)
            continue
        tip = b + P(0, 0, H) + lean
        nod = P(0.25 * (1 if st == 4 else 0.3), -0.1, 0) if st == 4 else P(0, 0, 0)
        stalk([b, b + P(0, 0, H * 0.5) + lean * 0.4, tip], 0.026, 0.018, col, n=5, rings=5)
        wheat_head(tip, (tip - b).normalized() + nod * 0.6, hcol, L=0.16 if st == 3 else 0.19, s=2.3, awns=False)
        leaf(b + P(0, 0, 0.1 + 0.1 * (i % 3)), r.uniform(0, 360), 0.3, 0.07, 45, col if st != 3 else LEAF, droop=0.3, shape=STRAP)


def crop_carrot(st):
    if st == 0:
        return planted(C(200, 170, 120), C(242, 126, 40))
    mound()
    if st == 1:
        return sprout(mono=True, s=0.75)
    w = st == 5
    col = DRY if w else C(96, 164, 70)
    n, h = {2: (4, 0.22), 3: (7, 0.4), 4: (8, 0.44), 5: (7, 0.36)}[st]
    if st >= 4:
        lathe([(0.1, 0.08), (0.125, 0.17), (0.1, 0.225), (0.04, 0.24), (0, 0.24)], (0, 0, 0), C(250, 122, 32), n=9)
        torus(0.12, 0.012, (0, 0, 0.18), C(250, 122, 32), n=9, k=4)
    base = (0, 0, 0.225 if st >= 4 else T - 0.01)
    for i in range(n):
        frond(base, i * 360 / n + 15, h * (0.85 + 0.15 * (i % 2)), col, droop=0.55 if w else 0.0, lean=15 + 12 * (i % 3))


def leafy_stalk(base, yaw, h, col, leaves=3, droop=0.0, lean=25, size=0.13):
    b = P(base)
    y = yaw * D2R
    d = P(math.cos(y), math.sin(y), 0)
    l = lean * D2R
    pts = [b + d * h * math.sin(l) * f + P(0, 0, h * math.cos(l) * f) - P(0, 0, droop * h * f * f) + d * droop * h * f * 0.6 for f in (0, 0.4, 0.75, 1)]
    stalk(pts, 0.018, 0.012, col, n=5, rings=6)
    sp = spline(pts, 7)
    for k in range(leaves):
        i = 6 - k * 2 if k < 3 else 1
        leaf(sp[i], yaw + (k - 1) * 60, size, size * 0.62, 20 - droop * 70, col, droop=0.12 + droop * 0.3, shape=ROUND)
    return sp[-1]


def crop_potato(st):
    if st == 0:
        mound()
        ell((0, 0, T - 0.004), (0.13, 0.13, 0.014), SOIL_D, seg=8, ring=4)
        potato((0.0, 0.0, T + 0.01), r=0.06, seed=2)
        ell((0.02, 0.0, T + 0.05), (0.012, 0.012, 0.02), LEAF_L, seg=5, ring=3)
        marker(C(206, 160, 106))
        return
    mound()
    if st == 1:
        return sprout(col=C(130, 170, 80), s=0.9)
    w = st == 5
    pc = C(206, 160, 106)
    if st == 2:
        for i in range(4):
            leafy_stalk((0, 0, T - 0.01), i * 90 + 30, 0.18, LEAF, leaves=2, size=0.1)
        return
    col = {3: LEAF, 4: C(150, 170, 74), 5: DRY}[st]
    n = 7
    if st >= 4:
        potato(on_mound(0.24, -0.26, 0.0), 0.1, pc, seed=3, rz=30)
        potato(on_mound(-0.24, -0.2, -0.005), 0.085, pc, seed=4, rz=-40)
        potato(on_mound(0.36, 0.06, -0.01), 0.075, pc, seed=5, rz=70)
    for i in range(n):
        tip = leafy_stalk((0, 0, T - 0.01), i * 360 / n + 10, 0.4 if not w else 0.32, col, leaves=3, droop=0.7 if w else (0.15 if st == 4 else 0.0),
                          lean=28 + 8 * (i % 2), size=0.14)
        if st == 3 and i % 2 == 0:
            for k in range(3):
                star_flower(tip + P(0.03 * math.cos(k * 2.1), 0.03 * math.sin(k * 2.1), 0.05), C(238, 226, 246), MUSTARD, s=0.8)


def crop_tomato(st):
    if st == 0:
        return planted(C(240, 220, 160), TOMATO)
    mound()
    if st == 1:
        return sprout()
    w = st == 5
    # stake + ties
    box((0.06, 0.06, 1.2), (0.09, 0.11, 0.6), WOOD_L, bevel=0.012)
    cone(0.042, 0.06, (0.09, 0.11, 1.2), WOOD_L, n=4, rz=45)
    H = {2: 0.42, 3: 1.05, 4: 1.1, 5: 0.85}[st]
    col = DRY if w else LEAF_D
    scol = DRY_D if w else STEM
    pts = [(0, 0, T - 0.01), (0.04, 0.05, H * 0.35), (0.03, 0.06, H * 0.7), (0.05, 0.05, H)]
    if w:
        pts = [(0, 0, T - 0.01), (0.04, 0.05, H * 0.4), (0.05, 0.04, H * 0.75), (-0.1, -0.05, H * 0.7)]
    stalk(pts, 0.042, 0.026, scol)
    sp = spline(pts, 9)
    for z in (0.35, 0.7) if st > 2 else (0.3,):
        torus(0.06, 0.01, (0.06, 0.08, z * H + 0.05), CREAM, n=8, k=4, rx=10)
    r = rng(9)
    nl = 4 if st == 2 else 9
    for k in range(nl):
        i = 1 + int(k * 7 / nl)
        yaw = k * 137 + 20
        L = 0.24 if st == 2 else 0.3 - 0.01 * k
        p = sp[i]
        y = yaw * D2R
        tip = p + P(math.cos(y) * L * 0.8, math.sin(y) * L * 0.8, 0.06)
        stalk([p, p + (tip - p) * 0.5 + P(0, 0, 0.04), tip], 0.02, 0.013, scol, n=4, rings=5)
        for sgn in (-1, 0, 1):
            leaf(p + (tip - p) * (0.55 + 0.45 * (sgn == 0)), yaw + sgn * 50, 0.15 if sgn else 0.18, 0.12, 10 if not w else -40, col,
                 droop=0.12 if not w else 0.5, shape=ROUND)
    if st == 3:
        for k, i in enumerate((3, 5, 7)):
            y = (k * 120 + 250) * D2R
            c = sp[i] + P(math.cos(y) * 0.13, math.sin(y) * 0.13, -0.05)
            tomato_fruit(c, 0.065, C(150, 196, 84), LEAF_D)
            star_flower(c + P(0.07, -0.05, 0.1), MUSTARD, C(220, 150, 40), s=1.3)
    elif st == 4:
        for k, i in enumerate((2, 4, 6)):
            y = (k * 95 + 250) * D2R
            c = sp[i] + P(math.cos(y) * 0.17, math.sin(y) * 0.17, -0.06)
            for j in range(3 if k != 1 else 2):
                a = j * 2.1 + k
                tomato_fruit(c + P(0.1 * math.cos(a), 0.1 * math.sin(a), -0.06 * j), 0.115 - 0.01 * j)
    elif w:
        with at((0, 0, 0)):
            tomato_fruit(on_mound(0.22, -0.2, 0.05), 0.07, C(120, 60, 40), DRY_D)


def crop_cabbage(st):
    if st == 0:
        return planted(C(150, 100, 70), C(188, 216, 132))
    mound()
    if st == 1:
        return sprout(col=C(150, 196, 120))
    w = st == 5
    lc = C(124, 172, 100) if not w else DRY
    if st == 2:
        for i in range(5):
            leaf((0, 0, T - 0.01), i * 72 + 10, 0.2, 0.17, 38, lc, droop=0.15, shape=ROUND, curl=0.3)
        return
    if st == 3:
        cabbage_head((0, 0, T - 0.02), 0.11, C(176, 210, 128))
        for i in range(7):
            leaf((0, 0, T), i * 360 / 7 + 10, 0.32, 0.28, 32, lc, droop=0.25, shape=ROUND)
        return
    if st == 4:
        for i in range(7):
            leaf((0, 0, T), i * 360 / 7 + 30, 0.34, 0.3, 26, lc, droop=0.2, shape=ROUND)
        cabbage_head((0, 0, T - 0.04), 0.24)
        for i in range(4):
            yaw = i * 90 + 70
            a = yaw * D2R
            leaf((math.cos(a) * 0.12, math.sin(a) * 0.12, T + 0.02), yaw, 0.26, 0.26, 58, C(150, 192, 110), droop=0.3, shape=ROUND)
        return
    for i in range(7):
        leaf((0, 0, T), i * 360 / 7 + 30, 0.36, 0.3, 4, DRY if i % 2 else C(200, 176, 96), droop=0.25, shape=ROUND)
    with at((0, 0, 0), s=(1, 1, 0.8)):
        cabbage_head((0, 0, T - 0.03), 0.15, C(176, 168, 100), C(196, 186, 120))


def crop_beetroot(st):
    if st == 0:
        return planted(C(120, 70, 60), MAGENTA)
    mound()
    if st == 1:
        return sprout(col=C(130, 170, 80), s=0.9)
    w = st == 5
    n = {2: 3, 3: 6, 4: 7, 5: 6}[st]
    L = {2: 0.2, 3: 0.32, 4: 0.36, 5: 0.32}[st]
    lc = C(64, 116, 64) if not w else DRY
    sc = C(196, 50, 80) if not w else C(170, 110, 100)
    base = (0, 0, T + 0.12) if st >= 4 else (0, 0, T - 0.01)
    if st >= 4:
        ell((0, 0, T + 0.02), (0.17, 0.17, 0.14), MAGENTA, seg=10, ring=6)
    for i in range(n):
        yaw = i * 360 / n + 20
        y = yaw * D2R
        b = P(base)
        el = 65 if not w else 30
        tip = b + P(math.cos(y) * L * 0.3, math.sin(y) * L * 0.3, L * 0.5 * (1 if not w else 0.4))
        stalk([b, b + (tip - b) * 0.5, tip], 0.014, 0.01, sc, n=4, rings=5)
        leaf(tip, yaw, L * 0.75, L * 0.5, el - 20 if not w else -20, lc, droop=0.25 if not w else 0.6, shape=ROUND)


def crop_sunflower(st):
    if st == 0:
        return planted(C(70, 60, 56), C(250, 198, 46))
    mound()
    if st == 1:
        return sprout(s=1.1)
    w = st == 5
    H = {2: 0.45, 3: 1.35, 4: 1.55, 5: 1.4}[st]
    sc = C(120, 160, 70) if not w else DRY
    lc = LEAF if not w else DRY
    if w:
        pts = [(0, 0, T - 0.02), (0.0, 0, H * 0.5), (0.03, 0, H * 0.88), (0.12, -0.08, H), (0.2, -0.16, H * 0.92)]
    else:
        pts = [(0, 0, T - 0.02), (0, 0, H * 0.5), (0, 0, H)]
    stalk(pts, 0.085 if st > 2 else 0.03, 0.06 if st > 2 else 0.02, sc)
    nl = 4 if st == 2 else 8
    for k in range(nl):
        z = T + (H - T) * (0.15 + 0.75 * k / nl)
        yaw = k * 140 + 20
        sz = (0.2 if st == 2 else 0.42 - 0.025 * k)
        petiole_leaf((0, 0, z), yaw, sz, lc, elev=20 if not w else -10, rise=0.05, droop=0.3 if not w else 0.9, shape=HEART, scol=sc)
    if st == 3:
        top = P(0, 0, H)
        with at(top):
            lathe([(0.03, -0.02), (0.1, 0.03), (0.09, 0.09), (0.04, 0.14), (0, 0.15)], (0, 0, 0), C(100, 150, 66), n=8)
            for i in range(8):
                leaf((0.08 * math.cos(i * 0.785), 0.08 * math.sin(i * 0.785), 0.03), i * 45, 0.09, 0.05, 50, LEAF_D, t=0.01)
            for i in range(6):
                leaf((0.04 * math.cos(i), 0.04 * math.sin(i), 0.1), i * 60, 0.05, 0.035, 65, C(240, 200, 60), t=0.01)
    elif st == 4:
        sunflower_head((0.06, -0.1, H + 0.16), (0.44, -0.86, 0.25), r=0.36)
        stalk([(0, 0, H - 0.05), (0, 0, H + 0.05), (0.02, -0.03, H + 0.1)], 0.06, 0.05, sc, n=6, rings=4)
    elif w:
        sunflower_head((0.22, -0.2, H * 0.86), (0.25, -0.35, -1.0), r=0.24, petal=DRY, disc=C(90, 64, 44), wilted=True)


def crop_squash(st):
    if st == 0:
        return planted(CREAM, C(252, 204, 62))
    mound()
    if st == 1:
        return sprout()
    w = st == 5
    lc = C(96, 150, 76) if not w else DRY
    vc = STEM if not w else DRY_D
    if st == 2:
        for yaw, sz in ((210, 0.2), (110, 0.19), (330, 0.17)):
            petiole_leaf((0, 0, T - 0.01), yaw, sz, lc, elev=30, rise=0.12)
        return
    # trailing vine loops
    stalk([(0, 0, T - 0.01), (-0.15, 0.1, mz(0.18) + 0.02), (-0.32, 0.0, mz(0.32) + 0.02), (-0.34, -0.2, 0.04), (-0.2, -0.36, 0.03)], 0.022, 0.014, vc)
    stalk([(0, 0, T - 0.01), (0.16, 0.06, mz(0.17) + 0.02), (0.32, 0.18, 0.06), (0.42, 0.0, 0.02)], 0.02, 0.012, vc)
    tendril((-0.2, -0.36, 0.03), 240, 0.04, LEAF_L if not w else DRY)
    tendril((0.42, 0.0, 0.03), 300, 0.035, LEAF_L if not w else DRY)
    for yaw, sz, (x, y) in [(120, 0.3, (-0.05, 0.08)), (60, 0.26, (0.12, 0.1)), (200, 0.24, (-0.25, 0.04)), (10, 0.22, (0.3, 0.12)), (250, 0.2, (-0.3, -0.18))]:
        if w:
            leaf(on_mound(x, y, 0.01), yaw, sz * 0.85, sz * 0.75, 4, lc, droop=0.2, shape=ROUND)
        else:
            petiole_leaf(on_mound(x, y), yaw, sz * 1.15, lc, elev=16, rise=0.1 if sz > 0.25 else 0.06, droop=0.2)
    if st == 3:
        flower_trumpet(on_mound(0.05, -0.18, 0.02), (0.1, -0.7, 0.7), s=1.3)
        flower_trumpet(on_mound(-0.24, -0.18, 0.02), (-0.4, -0.6, 0.7), s=1.1)
    elif st == 4:
        crookneck(on_mound(0.1, -0.22, -0.04), s=1.6, rz=-10)
        crookneck(on_mound(-0.26, -0.08, -0.04), s=1.35, rz=-140)
    else:
        crookneck(on_mound(0.06, -0.2, -0.03), s=1.1, col=C(206, 170, 96), rz=-15, sz=0.7)


def crop_beans(st):
    mound()
    # teepee of three poles, tied at the top: present at every stage
    TOP = P(0, 0, 1.35)
    bases = [P(0.3 * math.cos(a), 0.3 * math.sin(a), mz(0.3) - 0.02) for a in (math.radians(100), math.radians(220), math.radians(340))]
    for b in bases:
        d = TOP - b
        stalk([b, b + d * 0.5, TOP + d.normalized() * 0.12], 0.045, 0.035, WOOD, n=6, rings=3)
    torus(0.09, 0.04, TOP + P(0, 0, -0.02), STRAW, n=8, k=4)
    if st == 0:
        ell((0, 0, T - 0.004), (0.13, 0.13, 0.014), SOIL_D, seg=8, ring=4)
        for b in bases:
            ell(b + P(0, 0, 0.03), (0.026, 0.018, 0.012), C(150, 90, 80), seg=6, ring=4)
        marker(C(220, 80, 60))
        return
    if st == 1:
        for b in bases:
            sprout(s=0.8, at_xy=(b.x * 0.75, b.y * 0.75))
        return
    w = st == 5
    lc = LEAF if not w else DRY
    vc = STEM if not w else DRY_D
    reach = {2: 0.32, 3: 0.95, 4: 1.0, 5: 0.95}[st]
    r = rng(4)
    for vi, b in enumerate(bases):
        d = TOP - b
        u, v = kit.frame(d, (0, 0, 1))
        pts = []
        for i in range(14):
            f = reach * i / 13
            a = i * 0.9 + vi
            pts.append(b + d * f + (u * math.cos(a) + v * math.sin(a)) * 0.06 + P(0, 0, 0.02))
        stalk(pts, 0.02, 0.014, vc, n=4, rings=28)
        sp = spline(pts, 14)
        for i in range(2, 14, 2):
            if st == 2 and i > 12:
                continue
            out = (sp[i] - P(0, 0, sp[i].z)).normalized()
            yaw = math.degrees(math.atan2(out.y, out.x)) + r.uniform(-60, 60)
            sz = 0.2 if st == 2 else 0.26
            leaf(sp[i], yaw, sz, sz * 0.85, 10 if not w else -45, lc, droop=0.2 if not w else 0.5, shape=HEART)
        if st == 3:
            for i in (4, 7, 10):
                ell(sp[i] + P(0, 0, 0.0) + (sp[i] - P(0, 0, sp[i].z)).normalized() * 0.09, (0.045, 0.045, 0.04), C(230, 70, 56), seg=6, ring=4)
        if st == 4:
            for i in (4, 8, 11):
                o = (sp[i] - P(0, 0, sp[i].z)).normalized()
                pod(sp[i] + o * 0.08, (o.x * 0.25, o.y * 0.25, -1), L=0.3, col=C(104, 168, 70), s=1.8)
        if w:
            for i in (5, 9):
                o = (sp[i] - P(0, 0, sp[i].z)).normalized()
                pod(sp[i] + o * 0.06, (o.x * 0.25, o.y * 0.25, -1), L=0.28, col=C(200, 170, 110), curve=0.06, s=1.3)


def trifoliate(base, yaw, h, col, scol=None, droop=0.0, size=0.09):
    b = P(base)
    y = yaw * D2R
    tip = b + P(math.cos(y) * h * 1.1, math.sin(y) * h * 1.1, h * 0.6 * (1 - droop))
    stalk([b, b + (tip - b) * 0.5 + P(0, 0, 0.03), tip], 0.011, 0.008, scol or col, n=4, rings=5)
    for k in (-1, 0, 1):
        leaf(tip, yaw + k * 55, size, size * 0.8, 18 - droop * 60, col, shape=ROUND, droop=0.1 + droop * 0.4)


def crop_strawberry(st):
    if st == 0:
        return planted(C(250, 226, 120), C(228, 50, 60))
    mound()
    if st == 1:
        return sprout(s=0.8)
    w = st == 5
    lc = C(84, 148, 70) if not w else DRY
    if st >= 3:
        # straw mulch
        r = rng(8)
        for i in range(22):
            a = r.uniform(0, 6.28)
            rr = r.uniform(0.18, 0.4)
            p = P(on_mound(rr * math.cos(a), rr * math.sin(a), 0.008))
            box((0.1, 0.014, 0.01), p, STRAW if i % 3 else STRAW_D, rz=r.uniform(0, 180), rx=r.uniform(-12, 12))
    n = {2: 3, 3: 6, 4: 6, 5: 6}[st]
    for i in range(n):
        trifoliate((0, 0, T - 0.01), i * 360 / n + 20, 0.12 if st == 2 else 0.17, lc, droop=0.7 if w else 0.0, size=0.1 if st == 2 else 0.14)
    if st == 3:
        for k in range(3):
            a = (k * 120 + 250) * D2R
            star_flower((0.12 * math.cos(a), 0.12 * math.sin(a), 0.3), CREAM, MUSTARD, s=1.4)
        berry(on_mound(0.24, -0.2, 0.04), 0.045, C(170, 210, 110), d=(0.3, -0.2, -1), seeds=False)
    elif st == 4:
        for k, (x, y) in enumerate([(0.2, -0.28), (-0.12, -0.3), (0.33, -0.05), (-0.3, -0.08)]):
            c = P(on_mound(x, y, 0.08))
            stalk([P(0, 0, 0.2), P(x * 0.6, y * 0.6, 0.24), c + P(0, 0, 0.0)], 0.012, 0.01, LEAF, n=4, rings=5)
            berry(c, 0.1 - 0.01 * (k % 2), d=(x * 0.4, y * 0.4, -1))
    elif w:
        berry(on_mound(0.24, -0.22, 0.03), 0.05, C(120, 56, 50), d=(0.3, -0.3, -1), seeds=False)


def crop_eggplant(st):
    if st == 0:
        return planted(C(240, 220, 160), PLUM)
    mound()
    if st == 1:
        return sprout(col=C(130, 170, 100))
    w = st == 5
    lc = C(104, 148, 96) if not w else DRY
    sc = C(96, 80, 110) if not w else DRY_D
    H = {2: 0.32, 3: 0.6, 4: 0.64, 5: 0.5}[st]
    pts = [(0, 0, T - 0.01), (0.01, 0.0, H * 0.5), (0.0, 0.02, H)]
    stalk(pts, 0.026, 0.018, sc)
    sp = spline(pts, 8)
    nl = 4 if st == 2 else 8
    for k in range(nl):
        i = 1 + int(k * 6 / nl)
        yaw = k * 137 + 40
        sz = 0.18 if st == 2 else 0.3 - 0.012 * k
        petiole_leaf(sp[i] - P(0, 0, 0.06 * (k % 2)), yaw, sz * (0.7 if w else 1.0), lc, elev=28 if not w else -30, rise=0.0, droop=0.3 if not w else 0.8, shape=ROUND, scol=sc)
    if st == 3:
        for k, i in enumerate((3, 5)):
            a = (k * 140 + 260) * D2R
            star_flower(sp[i] + P(0.12 * math.cos(a), 0.12 * math.sin(a), 0.02), C(186, 140, 210), MUSTARD, s=1.1, d=(math.cos(a), math.sin(a), 0.3))
        eggplant_fruit(sp[4] + P(0.1, -0.1, -0.02), L=0.1, r=0.035)
    elif st == 4:
        for k, (i, a) in enumerate(((3, 290), (4, 210), (5, 340))):
            a = a * D2R
            eggplant_fruit(sp[i] + P(0.17 * math.cos(a), 0.17 * math.sin(a), -0.02), d=(0.3 * math.cos(a), 0.3 * math.sin(a), -1), L=0.3 - 0.04 * k, r=0.095 - 0.01 * k)
    elif w:
        eggplant_fruit(on_mound(0.24, -0.2, 0.06), d=(0.6, -0.4, -0.5), L=0.16, r=0.05, col=C(96, 70, 70))


def onion_leaf(base, yaw, h, col, flop=0.0, r=0.018):
    b = P(base)
    y = yaw * D2R
    d = P(math.cos(y), math.sin(y), 0)
    if flop:
        pts = [b, b + P(0, 0, h * 0.35) + d * 0.02, b + P(0, 0, h * 0.42) + d * h * 0.25, b + d * h * 0.75 + P(0, 0, h * 0.15 * (1 - flop))]
    else:
        pts = [b, b + P(0, 0, h * 0.5) + d * h * 0.06, b + P(0, 0, h) + d * h * 0.2]
    r = max(r, 0.035)
    tube(pts, lambda t: r * (1 - 0.6 * t), col, rings=8, n=6)


def crop_onion(st):
    if st == 0:
        mound()
        ell((0, 0, T - 0.004), (0.13, 0.13, 0.014), SOIL_D, seg=8, ring=4)
        onion_bulb((0, 0, T - 0.01), 0.055)
        marker(C(212, 146, 72))
        return
    mound()
    if st == 1:
        onion_leaf((0, 0, T - 0.01), 30, 0.18, LEAF_L, r=0.014)
        onion_leaf((0, 0, T - 0.01), 200, 0.14, LEAF_L, r=0.012)
        return
    w = st == 5
    col = C(110, 170, 96)
    if st == 2:
        for i in range(4):
            onion_leaf((0, 0, T - 0.01), i * 90 + 20, 0.3, col, r=0.025)
        return
    if st == 3:
        onion_bulb((0, 0, T - 0.06), 0.08, C(220, 200, 140))
        for i in range(6):
            onion_leaf((0, 0, T + 0.05), i * 60 + 20, 0.5 + 0.05 * (i % 2), col, r=0.03)
        return
    bc = C(212, 146, 72) if not w else C(190, 140, 90)
    onion_bulb((0, 0, T - 0.08), 0.17, bc)
    lc = C(170, 186, 90) if not w else DRY
    for i in range(5):
        onion_leaf((0, 0, T + 0.2), i * 72 + 210, 0.42, lc, flop=1.0 if w else 0.6, r=0.032)


def crop_apple(st):
    """7 stages: planted, sprout, sapling, mature, blossom, ripe, withered."""
    if st == 0:
        return planted(C(90, 60, 40), RED)
    mound()
    if st == 1:
        return sprout(s=1.15)
    bark = C(140, 98, 66)
    if st == 2:
        stalk([(0, 0, T - 0.02), (0.01, 0, 0.45), (-0.01, 0.01, 0.75)], 0.045, 0.028, bark)
        stalk([(0.01, 0, 0.5), (0.1, 0.0, 0.62), (0.16, -0.02, 0.66)], 0.014, 0.01, bark, n=4, rings=4)
        for p, yaw in (((-0.01, 0.01, 0.75), 30), ((-0.01, 0.01, 0.75), 160), ((-0.01, 0.01, 0.75), 270), ((0.16, -0.02, 0.66), 0), ((0.06, 0, 0.58), 230)):
            leaf(p, yaw, 0.17, 0.11, 35, LEAF, droop=0.1, shape=ROUND)
        torus(0.032, 0.008, (0, 0, 0.3), CREAM, n=6, k=4)
        box((0.03, 0.03, 0.55), (-0.08, 0.06, 0.37), WOOD_L)
        return
    w = st == 6
    # trunk + branches
    lathe([(0.16, T - 0.04), (0.12, T + 0.06), (0.1, 0.5), (0.095, 0.8)], (0, 0, 0), bark, n=8, twist=30)
    branches = [((0, 0, 0.75), (0.32, -0.08, 1.15)), ((0, 0, 0.78), (-0.3, 0.05, 1.18)), ((0, 0, 0.8), (0.0, 0.18, 1.3)), ((0, 0, 0.8), (0.05, -0.05, 1.4))]
    for a, b in branches:
        stalk([P(a), (P(a) + P(b)) * 0.5 + P(0, 0, 0.05), P(b)], 0.06, 0.035, bark, n=6, rings=4)
    if w:
        for a, b in branches:
            b = P(b)
            stalk([b, b + P(0.08 * (1 if b.x >= 0 else -1), 0, 0.14), b + P(0.1 * (1 if b.x >= 0 else -1), -0.05, 0.22)], 0.035, 0.025, bark, n=5, rings=4)
            leaf(b + P(0.02, 0, 0.05), 300, 0.1, 0.06, -30, DRY, droop=0.3)
        for p, yaw in (((0.3, -0.22, 0.02), 30), ((-0.2, -0.3, 0.02), 120), ((0.4, 0.05, 0.02), 200)):
            leaf(p, yaw, 0.1, 0.07, 0, DRY_D)
        apple_fruit((0.3, -0.12, mz(0.32) + 0.04), 0.06, C(140, 80, 56))
        return
    canopy = [((0.0, 0.0, 1.45), 0.5), ((0.35, -0.05, 1.25), 0.36), ((-0.33, 0.05, 1.28), 0.36), ((0.05, 0.22, 1.25), 0.36), ((0.1, -0.25, 1.22), 0.32)]
    cc = LEAF if st != 4 else C(130, 180, 90)
    for c, r in canopy:
        ell(c, (r, r, r * 0.86), cc, seg=8, ring=6)
    r = rng(12)
    if st in (4, 5):
        pts = []
        for c, rad in canopy:
            for _ in range(8 if st == 4 else 4):
                th = r.uniform(-2.6, -0.2) if r.random() < 0.8 else r.uniform(0, 6.28)
                ph = r.uniform(-0.3, 0.9)
                d = P(math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph))
                p = P(c) + P(d.x * rad, d.y * rad, d.z * rad * 0.86)
                if any((p - q).length < 0.12 for q in pts):
                    continue
                pts.append(p)
                if st == 4:
                    with oriented(p, d):
                        for i in range(5):
                            leaf((0, 0, 0), i * 72, 0.06, 0.05, 15, C(250, 214, 222) if i % 2 else (1, 1, 1), shape=ROUND, t=0.01, n=4)
                        ell((0, 0, 0.01), 0.018, MUSTARD, seg=5, ring=3)
                else:
                    apple_fruit(p + d * 0.04, 0.095, RED if r.random() < 0.8 else C(232, 90, 50), rz=r.uniform(0, 360))
        if st == 5:
            apple_fruit((0.32, -0.14, mz(0.35) + 0.08), 0.095, RED)


CROPS = [
    ("Pumpkin", crop_pumpkin, 6), ("Corn", crop_corn, 6), ("Wheat", crop_wheat, 6), ("Carrot", crop_carrot, 6),
    ("Potato", crop_potato, 6), ("Tomato", crop_tomato, 6), ("Cabbage", crop_cabbage, 6), ("Beetroot", crop_beetroot, 6),
    ("Sunflower", crop_sunflower, 6), ("Squash vine", crop_squash, 6), ("Bean pole", crop_beans, 6), ("Strawberry", crop_strawberry, 6),
    ("Eggplant", crop_eggplant, 6), ("Onion", crop_onion, 6), ("Apple tree", crop_apple, 7),
]
STAGES = ["planted", "sprout", "young", "mature", "ripe", "withered"]
APPLE_STAGES = ["planted", "sprout", "sapling", "mature", "blossom", "ripe", "withered"]


# ---------------------------------------------------------------- produce (the loose harvested item)

def produce(name):
    if name == "Pumpkin":
        gourds.gourd("round", "orange", "leafy", s=0.6)
    elif name == "Corn":
        cob((0, 0, 0.07), (1, -0.15, 0.12), L=0.36, peeled=0.7, silk=C(150, 96, 56))
    elif name == "Wheat":
        with at((0, 0, 0.0), rz=25):
            r = rng(3)
            for i in range(11):
                a = i * 2.4
                rr = 0.035 * math.sqrt(i)
                b = P(rr * math.cos(a), rr * math.sin(a), 0)
                top = b * 2.4 + P(0, 0, 0.62)
                stalk([b, b * 0.3 + P(0, 0, 0.3), top], 0.012, 0.01, C(226, 186, 90), n=4, rings=4)
                wheat_head(top, (top - b * 0.3 - P(0, 0, 0.3)).normalized(), C(240, 200, 100), L=0.16)
            torus(0.07, 0.022, (0, 0, 0.26), RED, n=8, k=4)
            ell((0.0, -0.075, 0.26), (0.03, 0.02, 0.025), RED, seg=6, ring=4)
    elif name == "Carrot":
        with at((0, 0, 0.07), rz=25, ry=80):
            carrot_root((0, 0, 0), L=0.34, r=0.07, d=(0, 0, -1))
            for i in range(4):
                frond((0, 0, -0.01), i * 90 + 40, 0.24, C(96, 164, 70), lean=25)
    elif name == "Potato":
        potato((0.0, 0.0, 0.075 * 0.85), 0.085, seed=6, rz=20)
        potato((0.13, 0.08, 0.05), 0.06, seed=7, rz=-40)
    elif name == "Tomato":
        tomato_fruit((0, 0, 0.065 * 0.78 * 1.5), 0.095)
    elif name == "Cabbage":
        for i in range(5):
            leaf((0, 0, 0.03), i * 72 + 20, 0.2, 0.2, 40, C(124, 172, 100), droop=0.25, shape=ROUND)
        cabbage_head((0, 0, 0.02), 0.17)
    elif name == "Beetroot":
        with at((0, 0, 0.1), rz=25, ry=-75):
            beet_root((0, 0, 0), 0.1, d=(0, 0, -1))
            for i, yaw in enumerate((-25, 0, 25)):
                y = yaw * D2R
                tip = P(math.sin(y) * 0.06, 0, 0.2)
                stalk([P(0, 0, 0), tip * 0.5, tip], 0.013, 0.01, C(196, 50, 80), n=4, rings=4)
                with oriented(tip, tip.normalized()):
                    leaf((0, 0, 0), 0 + i * 120, 0.2, 0.12, 70, C(64, 116, 64), droop=0.1, shape=ROUND)
    elif name == "Sunflower":
        sunflower_head((0, 0, 0.33), (0.44, -0.86, 0.15), r=0.22)
        stalk([(0.0, 0.08, 0.0), (0, 0.06, 0.15), (0.0, 0.03, 0.3)], 0.03, 0.026, C(120, 160, 70))
    elif name == "Squash vine":
        crookneck((0, 0, 0), s=1.3, rz=-30)
    elif name == "Bean pole":
        for k, (a, x) in enumerate(((-12, -0.05), (4, 0.0), (18, 0.06))):
            with at((x, 0, 0.03), rz=25 + a):
                pod((0, -0.13, 0.0), (0, 1, 0.05), L=0.28, col=C(104, 168, 70) if k != 1 else C(120, 180, 80))
    elif name == "Strawberry":
        berry((0, 0, 0.12), 0.09, d=(0.2, -0.3, -1))
        berry((0.13, 0.07, 0.1), 0.07, d=(-0.4, 0.2, -1))
    elif name == "Eggplant":
        eggplant_fruit((-0.12, 0.0, 0.08), d=(1, -0.3, -0.05), L=0.3, r=0.09)
    elif name == "Onion":
        onion_bulb((0, 0, 0.0), 0.13)
        tube([(0, 0, 0.22), (0.01, 0, 0.27), (0.05, -0.01, 0.31)], lambda t: 0.014 * (1 - 0.6 * t), C(196, 160, 100), rings=4, n=5)
    elif name == "Apple tree":
        apple_fruit((0, 0, 0.09 * 0.86), 0.1, RED, leafy=True)
