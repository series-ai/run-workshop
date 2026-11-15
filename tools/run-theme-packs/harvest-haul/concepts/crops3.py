"""Round 2 crops, part 2: vine & trellis crops, berry bushes, fruit trees and
palms (7 stages), herbs, flowers and exotic/fun crops."""
import math

from grow import *  # noqa: F401,F403
import horn

TRELLIS = C(186, 140, 96)


# ================================================================ vines + trellis

def vine_climb(pts_ctrl, st, leaf_col=LEAF, size=0.2, every=2, shape=HEART, vc=STEM):
    """A vine along control points with leaves; returns the spline points."""
    w = st == 5
    stalk(pts_ctrl, 0.022, 0.016, DRY_D if w else vc, n=4, rings=len(pts_ctrl) * 4)
    sp = spline(pts_ctrl, len(pts_ctrl) * 3)
    for i in range(2, len(sp), every):
        yaw = gold(i) + 180
        leaf(sp[i], yaw, size, size * 0.9, 15 if not w else -45, DRY if w else leaf_col, droop=0.25 if not w else 0.5, shape=shape)
    return sp


def t_trellis(h=1.05, w=0.9):
    for x in (-w / 2, w / 2):
        box((0.07, 0.07, h), (x, 0.12, h / 2), TRELLIS, bevel=0.012)
    box((w + 0.14, 0.06, 0.07), (0, 0.12, h - 0.06), TRELLIS, bevel=0.012)
    tube([(-w / 2, 0.12, h * 0.55), (w / 2, 0.12, h * 0.55)], lambda t: 0.008, C(150, 150, 150), rings=2, n=3)


def crop_grapes(st):
    mound()
    t_trellis()
    if st == 0:
        planted(C(110, 60, 90), PLUM)
        t_trellis()
        return
    if st == 1:
        sprout()
        return
    w = st == 5
    reach = {2: 0.3, 3: 1.0, 4: 1.0, 5: 1.0}[st]
    stalk([(0, 0.05, T - 0.02), (0, 0.08, 0.3), (0.0, 0.1, 0.55 * min(1, reach + 0.3))], 0.05, 0.04, C(130, 90, 64))
    if st == 2:
        for yaw in (30, 160, 280):
            leaf((0, 0.1, 0.5), yaw, 0.2, 0.18, 30, LEAF, shape=HEART)
        return
    for s in (-1, 1):
        vine_climb([(0, 0.1, 0.56), (s * 0.2, 0.1, 0.6), (s * 0.4, 0.1, 0.62)], st, size=0.22, every=1)
        vine_climb([(0, 0.1, 0.56), (s * 0.15, 0.1, 0.8), (s * 0.38, 0.1, 0.96)], st, size=0.22, every=1)
    if st == 4:
        for x in (-0.3, -0.05, 0.22):
            with at((x, 0.0, 0.42), s=1.5):
                horn.grapes()
    elif w:
        with at((0.15, 0.0, 0.45), s=1.1):
            horn.grapes(C(110, 80, 90))


def crop_peas(st):
    mound()
    # twig frame: two hoops of hazel with cross ties
    for x in (-0.25, 0.25):
        stalk([(x, 0.12, mz(0.28) - 0.02), (x * 0.9, 0.12, 0.55), (x * 0.8, 0.12, 0.8)], 0.025, 0.02, C(150, 110, 80), n=5, rings=3)
    for z in (0.35, 0.6):
        tube([(-0.28, 0.12, z), (0.28, 0.12, z)], lambda t: 0.012, TWINE, rings=2, n=4)
    if st == 0:
        planted(C(170, 200, 110), C(110, 180, 80))
        return
    if st == 1:
        sprout()
        return
    w = st == 5
    reach = {2: 0.35, 3: 0.8, 4: 0.85, 5: 0.8}[st]
    for s in (-1, 1):
        sp = vine_climb([(s * 0.05, 0.05, T), (s * 0.15, 0.1, T + reach * 0.4), (s * 0.22, 0.1, T + reach * 0.75), (s * 0.18, 0.1, T + reach)], st,
                        size=0.16, every=2, shape=ROUND)
        if st >= 3:
            tendril(sp[-1], 0 if s > 0 else 180, 0.04)
        if st == 3:
            for i in (4, 8):
                star_flower(sp[i] + P(0, -0.06, 0), (1, 1, 1), C(250, 220, 120), s=1.2, d=(0, -1, 0.3))
        if st == 4:
            for i in (3, 6, 9):
                pod(sp[i] + P(0.0, -0.07, -0.02), (0.1 * s, -0.1, -1), L=0.24, col=C(110, 186, 80), s=1.7)
        if w:
            pod(sp[6] + P(0, -0.07, -0.02), (0.1 * s, -0.1, -1), L=0.2, col=C(190, 170, 110), s=1.5)


def cucumber(c, d=(0, 0, -1), L=0.24, r=0.05, col=C(60, 120, 60)):
    with oriented(c, d):
        tube([(0, 0, 0), (0, 0, L * 0.5), (0.01, 0, L)], lambda t: r * (0.75 + 0.25 * math.sin(math.pi * t)), col, rings=6, n=8, side=(0, 1, 0))
        for k in range(8):
            a = k * 2.3
            ell((r * 0.95 * math.cos(a), r * 0.95 * math.sin(a), L * (0.15 + 0.1 * k)), 0.012, C(200, 220, 160), seg=4, ring=3)


def crop_cucumber(st):
    mound()
    # A-frame trellis with a net
    for s in (-1, 1):
        stalk([(s * 0.35, -0.05, mz(0.35) - 0.02), (s * 0.05, 0.15, 1.0)], 0.03, 0.025, TRELLIS, n=5, rings=2)
        stalk([(s * 0.35, 0.3, mz(0.46) - 0.02), (s * 0.05, 0.15, 1.0)], 0.03, 0.025, TRELLIS, n=5, rings=2)
    for z in (0.35, 0.6, 0.85):
        k = (1.0 - z) / 1.0
        tube([(-0.3 * k - 0.05, 0.0 + 0.15 * (1 - k), z), (0.3 * k + 0.05, 0.0 + 0.15 * (1 - k), z)], lambda t: 0.007, TWINE, rings=2, n=3)
    if st == 0:
        planted(CREAM, C(60, 120, 60))
        return
    if st == 1:
        sprout()
        return
    w = st == 5
    reach = {2: 0.3, 3: 0.85, 4: 0.85, 5: 0.85}[st]
    sp = vine_climb([(0, 0, T), (0.1, 0.0, T + reach * 0.35), (-0.1, 0.05, T + reach * 0.7), (0.05, 0.1, T + reach)], st, size=0.22, every=2)
    sp2 = vine_climb([(0, 0, T), (-0.15, 0.0, T + reach * 0.4), (0.12, 0.05, T + reach * 0.75)], st, size=0.2, every=2)
    if st == 3:
        flower_trumpet(sp[5] + P(0, -0.08, 0), (0, -1, 0.3), s=1.1)
        flower_trumpet(sp2[7] + P(0, -0.08, 0), (0, -1, 0.3), s=1.1)
    if st == 4:
        for i, s_ in ((4, sp), (8, sp), (6, sp2)):
            cucumber(s_[i] + P(0.0, -0.09, 0.0), (0.1, -0.1, -1), L=0.26, r=0.055)
    if w:
        cucumber(on_mound(0.24, -0.2, 0.05), (1, -0.4, -0.1), L=0.2, r=0.045, col=C(170, 160, 90))


def ground_vine(st, leaf_col=C(96, 150, 76)):
    w = st == 5
    stalk([(0, 0, T - 0.01), (-0.15, 0.1, mz(0.18) + 0.02), (-0.32, 0.0, mz(0.32) + 0.02), (-0.34, -0.2, 0.04)], 0.022, 0.014, DRY_D if w else STEM)
    stalk([(0, 0, T - 0.01), (0.16, 0.06, mz(0.17) + 0.02), (0.32, 0.18, 0.06), (0.42, 0.0, 0.02)], 0.02, 0.012, DRY_D if w else STEM)
    tendril((-0.34, -0.2, 0.04), 240, 0.04, LEAF_L if not w else DRY)
    for yaw, sz, (x, y) in [(120, 0.26, (-0.05, 0.1)), (60, 0.24, (0.12, 0.12)), (200, 0.22, (-0.27, 0.06)), (10, 0.2, (0.3, 0.14))]:
        if w:
            leaf(on_mound(x, y, 0.02), yaw, sz * 0.85, sz * 0.75, 10, DRY, droop=0.15, shape=ROUND)
        else:
            petiole_leaf(on_mound(x, y), yaw, sz * 1.15, leaf_col, elev=20, rise=0.08, droop=0.2)


def crop_melon(st, kind="cantaloupe"):
    if opener(st, CREAM, C(214, 180, 110) if kind == "cantaloupe" else C(84, 150, 70)):
        return
    if st == 2:
        for yaw in (210, 110, 330):
            petiole_leaf((0, 0, T - 0.01), yaw, 0.18, C(96, 150, 76), elev=30, rise=0.06)
        return
    ground_vine(st)
    if st == 3:
        flower_trumpet(on_mound(0.05, -0.18, 0.02), (0.1, -0.7, 0.7), s=1.1)
        with at(on_mound(0.12, -0.22, -0.02), s=0.4):
            melon((0, 0, 0), kind=kind)
    elif st == 4:
        with at(on_mound(0.05, -0.18, -0.06), s=1.0 if kind == "cantaloupe" else 1.05):
            melon((0, 0, 0), kind=kind)
    else:
        with at(on_mound(0.05, -0.18, -0.06), s=(0.8, 0.8, 0.55)):
            melon((0, 0, 0), kind=kind)


def crop_watermelon(st):
    crop_melon(st, "watermelon")


def crop_kiwi(st):
    mound()
    # pergola: two posts and a top frame
    for x in (-0.38, 0.38):
        box((0.08, 0.08, 1.2), (x, 0.15, 0.6), TRELLIS, bevel=0.012)
    for y in (-0.15, 0.15):
        box((0.95, 0.07, 0.07), (0, y, 1.18), TRELLIS, bevel=0.012)
    box((0.07, 0.42, 0.07), (0, 0.0, 1.24), TRELLIS, bevel=0.012)
    if st == 0:
        planted(C(60, 40, 30), C(150, 110, 70))
        return
    if st == 1:
        sprout()
        return
    w = st == 5
    stalk([(0, 0.05, T - 0.02), (0.05, 0.1, 0.6), (0.0, 0.05, 1.12)], 0.05, 0.035, C(130, 90, 64))
    if st == 2:
        for z in (0.4, 0.6):
            leaf((0.04, 0.08, z), gold(int(z * 10)), 0.2, 0.18, 20, LEAF, shape=HEART)
        return
    for s in (-1, 1):
        vine_climb([(0, 0.05, 1.12), (s * 0.2, 0.0, 1.22), (s * 0.4, -0.1, 1.2)], st, size=0.24, every=1, shape=HEART)
        vine_climb([(0, 0.05, 1.12), (s * 0.15, 0.15, 1.24), (s * 0.35, 0.15, 1.2)], st, size=0.24, every=1, shape=HEART)
    if st == 3:
        for x in (-0.25, 0.1, 0.3):
            star_flower((x, -0.08, 1.08), CREAM, MUSTARD, s=1.2, d=(0, -0.5, -1))
    if st == 4:
        for x, y in ((-0.3, -0.12), (-0.1, -0.1), (0.15, -0.14), (0.32, -0.06), (0.0, 0.1)):
            stalk([(x, y, 1.15), (x, y, 1.05)], 0.012, 0.01, BROWN, n=4, rings=2)
            kiwi((x, y, 0.98), 0.075)
    if w:
        kiwi(on_mound(0.25, -0.2, 0.06), 0.06, C(120, 90, 60))


# ================================================================ berry bushes

BUSH = [((0, 0, 0.42), 0.24), ((0.18, -0.04, 0.34), 0.18), ((-0.18, 0.04, 0.34), 0.18), ((0.02, -0.16, 0.3), 0.16)]
BUSH_TALL = [((0, 0, 0.55), (0.22, 0.22, 0.32)), ((0.15, -0.06, 0.38), 0.17), ((-0.15, 0.05, 0.4), 0.17)]
BUSH_WIDE = [((0, 0, 0.34), (0.32, 0.3, 0.17)), ((0.26, -0.06, 0.3), 0.15), ((-0.26, 0.06, 0.3), 0.15)]
BUSH_VASE = [((0.12, -0.03, 0.5), 0.15), ((-0.12, 0.05, 0.5), 0.15), ((0.0, 0.13, 0.55), 0.15), ((0.0, -0.12, 0.4), 0.14)]


def berry_cluster(p, col, n=5, r=0.035, spread=0.04, crown=True):
    for i in range(n):
        a = i * 2.4
        q = P(p) + P(spread * math.cos(a) * math.sqrt(i / n), spread * math.sin(a) * math.sqrt(i / n), -0.02 * (i % 3))
        ell(q, r, col, seg=8, ring=6, rough=0.35)
        if crown:
            ell(q + P(0, 0, r * 0.85), r * 0.3, tuple(c * 0.6 for c in col), seg=5, ring=3)


def raspberry(c, r=0.045, col=C(226, 50, 80)):
    with at(c):
        for k in range(3):
            for i in range(6 - k):
                a = i * 360 / (6 - k) * D2R
                ell((r * (1 - 0.25 * k) * 0.7 * math.cos(a), r * (1 - 0.25 * k) * 0.7 * math.sin(a), -k * r * 0.55), r * 0.42, col, seg=6, ring=4)
        ell((0, 0, -r * 1.3), r * 0.42, col, seg=6, ring=4)
        calyx((0, 0, r * 0.25), r * 0.8, LEAF_D, elev=10)


def gooseberry(c, r=0.05, col=C(170, 210, 110)):
    with at(c):
        ell((0, 0, 0), (r, r, r * 1.1), col, seg=10, ring=6, rough=0.25)
        for a in (0, 60, 120):
            torus(r * 1.0, 0.004, (0, 0, 0), tuple(c * 1.12 for c in col), n=10, k=3, rx=90, rz=a)
        ell((0, 0, -r * 1.1), r * 0.2, BROWN, seg=5, ring=3)


def currant_string(c, col, n=5, r=0.032):
    c = P(c)
    stalk([c, c + P(0.02, 0, -0.18)], 0.008, 0.006, LEAF_D, n=4, rings=2)
    for i in range(n):
        ell(c + P(0.02 * i / n + (0.022 if i % 2 else -0.018), -0.02, -0.03 - i * 0.035), r, col, seg=8, ring=6, rough=0.2)


def crop_blueberry(st):
    bush(st, dict(tag=C(80, 110, 200), leaf=C(84, 140, 124), blobs=BUSH_TALL, flower=(1, 1, 1),
                  fruit=lambda p, d, i: berry_cluster(p, C(80, 100, 196), n=5, r=0.04), nfruit=10))


def crop_raspberry(st):
    if opener(st, C(150, 80, 80), C(226, 50, 80)):
        return
    w = st == 5
    canes = [(0, 0, 25), (0.08, 0.05, 140), (-0.08, 0.04, 260), (0.02, -0.08, 330)]
    H = {2: 0.35, 3: 0.75, 4: 0.8, 5: 0.65}[st]
    for i, (x, y, yaw) in enumerate(canes):
        y_ = yaw * D2R
        b = P(on_mound(x, y, -0.02))
        top = b + P(math.cos(y_) * 0.25, math.sin(y_) * 0.25, H)
        mid = b + P(math.cos(y_) * 0.05, math.sin(y_) * 0.05, H * 0.7)
        stalk([b, mid, top], 0.03, 0.02, C(150, 100, 90) if not w else DRY_D, n=5, rings=6)
        sp = spline([b, mid, top], 7)
        for k in range(2, 7, 2 if st == 2 else 1):
            trifoliate(sp[k], yaw + 60 * (k % 2) - 30, 0.06, LEAF if not w else DRY, droop=0.5 if w else 0.1, size=0.11)
        if st == 3:
            star_flower(sp[5] + P(0, -0.06, -0.03), (1, 1, 1), MUSTARD, s=1.1)
        if st == 4:
            for k in (3, 5, 6):
                raspberry(sp[k] + P(0.0, -0.07, -0.05), 0.055)


def crop_gooseberry(st):
    bush(st, dict(tag=C(170, 210, 110), leaf=C(110, 160, 90), blobs=BUSH_WIDE, flower=C(230, 200, 180),
                  fruit=lambda p, d, i: gooseberry(p - P(0, 0, 0.02), 0.06), nfruit=9))


def crop_redcurrant(st):
    bush(st, dict(tag=C(220, 40, 50), leaf=C(100, 160, 90), blobs=BUSH_VASE, flower=C(220, 230, 170),
                  fruit=lambda p, d, i: currant_string(p, C(226, 40, 50)), nfruit=8))


def crop_blackcurrant(st):
    bush(st, dict(tag=C(70, 40, 80), leaf=C(90, 150, 90), blobs=BUSH_VASE, flower=C(220, 230, 170),
                  fruit=lambda p, d, i: currant_string(p, C(64, 40, 80)), nfruit=8))


# ================================================================ fruit trees (7 stages)

ROUND_C = [((0.0, 0.0, 1.45), 0.5), ((0.35, -0.05, 1.25), 0.36), ((-0.33, 0.05, 1.28), 0.36), ((0.05, 0.22, 1.25), 0.36), ((0.1, -0.25, 1.22), 0.32)]
TALL_C = [((0.0, 0.0, 1.65), (0.36, 0.36, 0.5)), ((0.2, -0.08, 1.3), 0.32), ((-0.2, 0.06, 1.3), 0.32), ((0.02, -0.2, 1.35), 0.28)]
WIDE_C = [((0.0, 0.0, 1.3), (0.55, 0.5, 0.32)), ((0.4, -0.1, 1.2), 0.3), ((-0.4, 0.08, 1.22), 0.3), ((0.0, -0.3, 1.22), 0.28)]
GLOSSY_C = [((0.0, 0.0, 1.3), 0.46), ((0.3, -0.1, 1.15), 0.32), ((-0.3, 0.05, 1.15), 0.32), ((0.0, -0.25, 1.1), 0.3)]
OLIVE_C = [((0.15, 0.0, 1.3), (0.3, 0.3, 0.2)), ((-0.25, 0.05, 1.22), (0.28, 0.28, 0.18)), ((0.0, 0.1, 1.48), (0.3, 0.3, 0.2)),
           ((0.35, -0.1, 1.12), (0.22, 0.22, 0.15)), ((-0.1, -0.22, 1.12), (0.24, 0.24, 0.16))]


def _hang(fn):
    return lambda p, d, i: fn(p - P(0, 0, 0.04), i)


TREES = {
    "Pear tree": dict(tag=C(200, 210, 90), leaf=C(100, 160, 80), blobs=TALL_C, blossom=(1, 1, 1),
                      fruit=_hang(lambda p, i: _pear(p)), drop=lambda p, w: _pear(p, True)),
    "Cherry tree": dict(tag=C(206, 30, 50), leaf=C(110, 170, 90), blobs=ROUND_C, blossom=C(255, 196, 214), nfruit=12,
                        fruit=_hang(lambda p, i: cherries(p - P(0, 0, 0.08), 0.045)), drop=lambda p, w: cherries(p, 0.045, C(120, 60, 60) if w else C(206, 30, 50))),
    "Peach tree": dict(tag=C(250, 158, 110), leaf=C(110, 168, 84), blobs=WIDE_C, blossom=C(250, 170, 190),
                       fruit=_hang(lambda p, i: peach(p, 0.08)), drop=lambda p, w: peach(p + P(0, 0, 0.08), 0.08, C(190, 140, 110) if w else C(250, 158, 110))),
    "Lemon tree": dict(tag=C(252, 222, 70), leaf=C(60, 120, 64), blobs=GLOSSY_C, blossom=(1, 1, 1), trunk_h=0.7,
                       fruit=_hang(lambda p, i: lemon(p, 0.075)), drop=lambda p, w: lemon(p + P(0, 0, 0.07), 0.075, C(200, 180, 100) if w else C(252, 222, 70), d=(1, 0, 0.2))),
    "Orange tree": dict(tag=ORANGE, leaf=C(56, 116, 62), blobs=GLOSSY_C, blossom=(1, 1, 1), trunk_h=0.7,
                        fruit=_hang(lambda p, i: ballfruit(p, 0.085, C(250, 150, 40), stem=None, leafy=LEAF_D if i % 3 == 0 else None)),
                        drop=lambda p, w: ballfruit(p + P(0, 0, 0.08), 0.085, C(190, 140, 90) if w else C(250, 150, 40), stem=None)),
    "Plum tree": dict(tag=C(128, 60, 120), leaf=C(110, 150, 80), blobs=ROUND_C, blossom=(1, 1, 1),
                      fruit=_hang(lambda p, i: plum(p, 0.07)), drop=lambda p, w: plum(p + P(0, 0, 0.07), 0.07, C(110, 80, 90) if w else C(128, 60, 120))),
    "Olive tree": dict(tag=C(110, 120, 60), leaf=C(150, 172, 130), blobs=OLIVE_C, blossom=C(240, 240, 200), twist=120, trunk_r=0.12, nfruit=8,
                       fruit=_hang(lambda p, i: olives(p)), drop=lambda p, w: olives(p + P(0, 0, 0.04))),
    "Avocado tree": dict(tag=C(70, 100, 50), leaf=C(60, 112, 64), blobs=GLOSSY_C, blossom=C(230, 230, 170), nfruit=8,
                         fruit=lambda p, d, i: (stalk([p, p - P(0, 0, 0.05)], 0.012, 0.01, BROWN, n=4, rings=2), avocado(p - P(0, 0, 0.03), (0, 0, -1))),
                         drop=lambda p, w: avocado(p + P(0, 0, 0.07), (1, -0.3, 0.1), col=C(90, 80, 50) if w else C(70, 100, 50))),
}


def _pear(p, w=False):
    with at(P(p) - P(0, 0, 0.16) if not w else P(p)):
        horn.pear(C(150, 130, 80) if w else C(206, 210, 96))


def make_tree(name):
    spec = TREES[name]
    return lambda st: tree(st, spec)


# ---------------------------------------------------------------- palms

def palm(st, kind):
    banana = kind == "banana"
    if opener(st, C(120, 84, 56), C(250, 214, 70) if banana else C(120, 84, 56), s=1.2):
        return
    w = st == 6
    if st == 2:
        for i in range(4 if banana else 3):
            yaw = gold(i)
            leaf((0, 0, T - 0.01), yaw, 0.45 if banana else 0.4, 0.2 if banana else 0.1, 60, LEAF if not banana else C(100, 170, 80),
                 droop=0.4, shape=STRAP if banana else LANCE)
        return
    H = 1.05 if banana else 1.6
    if banana:
        cyl(0.13, H, (0, 0, T - 0.04), C(140, 170, 90), n=8, r2=0.1)
        top = P(0, 0, T + H - 0.04)
    else:
        pts = [(0, 0, T - 0.04), (0.06, 0, H * 0.4), (0.15, -0.02, H * 0.8), (0.12, -0.05, H)]
        stalk(pts, 0.1, 0.07, C(160, 120, 80), n=7, rings=10)
        for k, p in enumerate(spline(pts, 8)[1:-1]):
            torus(0.09 - 0.004 * k, 0.018, p, C(130, 96, 64), n=8, k=4)
        top = P(pts[-1])
    lc = LEAF if not w else DRY
    n = 7 if banana else 8
    for i in range(n):
        yaw = i * 360 / n + 10
        if banana:
            leaf(top, yaw, 0.7, 0.36, 40 if not w else -10, lc if not w else DRY, droop=0.6 if not w else 1.2, shape=STRAP, t=0.02)
        else:
            y = yaw * D2R
            leaf(top, yaw, 0.68, 0.26, 25 if not w else -20, lc, droop=0.75 if not w else 1.1, shape=LANCE, t=0.024)
            leaf(top + P(0, 0, 0.02), yaw + 20, 0.5, 0.16, 35 if not w else -10, tuple(c * 0.9 for c in lc), droop=0.6, shape=LANCE, t=0.022)
    if w:
        if banana:
            bananas(on_mound(0.25, -0.2, 0.1), 3, C(120, 90, 60))
        else:
            coconut(on_mound(0.28, -0.18, 0.1), 0.1)
        return
    if banana:
        if st == 4:
            stalk([top, top + P(0.1, -0.1, -0.1), top + P(0.16, -0.16, -0.3)], 0.03, 0.025, C(140, 170, 90), n=5, rings=4)
            lathe([(0, 0), (0.06, 0.03), (0.07, 0.1), (0, 0.18)], top + P(0.16, -0.16, -0.48), C(150, 50, 90), n=7, rx=0)
        if st == 5:
            stalk([top, top + P(0.12, -0.12, -0.08), top + P(0.18, -0.18, -0.25)], 0.03, 0.025, C(140, 170, 90), n=5, rings=4)
            for k in range(3):
                with at(top + P(0.18, -0.18, -0.28 - 0.12 * k), rz=-60 + k * 40):
                    bananas((0, 0, 0), 5, C(250, 214, 70) if k else C(170, 210, 80))
    else:
        if st == 4:
            for i in range(5):
                a = i * 72 * D2R
                stalk([top, top + P(0.12 * math.cos(a), 0.12 * math.sin(a), -0.12)], 0.012, 0.01, C(230, 220, 150), n=4, rings=2)
        if st in (3, 5):
            for i in range(4 if st == 5 else 2):
                a = (262 + i * 22) * D2R
                coconut(top + P(0.15 * math.cos(a), 0.15 * math.sin(a), -0.34 - 0.07 * (i % 2)), 0.12 if st == 5 else 0.08, green=st == 3 or i % 2 == 0)


def crop_banana(st):
    palm(st, "banana")


def crop_coconut(st):
    palm(st, "coconut")


# ================================================================ herbs

def herb_mound(st, col, leaf_shape=ROUND, size=0.1, flower=None, n=(5, 10, 14), spikes=None, H=(0.12, 0.22, 0.28), stem=None):
    if st == 5:
        for i in range(6):
            a = gold(i) * D2R
            stalk([P(0, 0, T - 0.01), P(0.15 * math.cos(a), 0.15 * math.sin(a), T + 0.12)], 0.02, 0.014, DRY_D, n=4, rings=2)
            leaf(P(0.15 * math.cos(a), 0.15 * math.sin(a), T + 0.12), gold(i), size * 0.8, size * 0.5, -30, DRY, shape=leaf_shape)
        return
    k = {2: 0, 3: 1, 4: 2}[st]
    cnt, h = n[k], H[k]
    for i in range(cnt):
        a = gold(i) * D2R
        rr = 0.18 * math.sqrt((i + 0.5) / cnt) * (0.6 + 0.4 * k)
        b = P(0, 0, T - 0.01)
        tip = P(rr * math.cos(a), rr * math.sin(a), T + h * (0.7 + 0.3 * ((i * 7) % 5) / 4))
        stalk([b, (b + tip) * 0.5, tip], 0.02, 0.015, stem or tuple(c * 0.85 for c in col), n=4, rings=3)
        for j in range(2):
            leaf(tip - P(0, 0, 0.03 * j), gold(i) + j * 140, size * (1 - 0.2 * j), size * 0.8, 35, col, shape=leaf_shape, droop=0.15)
        if spikes and k == 2 and i % 2 == 0:
            spikes(tip + P(0, 0, 0.02))
    if flower and k >= 1:
        for p, d in on_canopy([((0, 0, T + h * 0.8), 0.2)], 4 if k == 1 else 6, 3, up=(0.3, 1.0)):
            flower(p)


def spike(col, h=0.14, r=0.025):
    def f(p):
        stalk([P(p), P(p) + P(0, 0, h * 0.6)], 0.012, 0.01, C(120, 150, 110), n=4, rings=2)
        for k in range(5):
            ell(P(p) + P(0, 0, h * 0.5 + k * r * 1.3), (r, r, r * 1.2), col, seg=6, ring=4)
    return f


def crop_basil(st):
    if opener(st, C(60, 50, 40), C(96, 186, 80)):
        return
    herb_mound(st, C(96, 186, 80), size=0.12, spikes=spike((1, 1, 1), 0.1, 0.02) if st == 4 else None)


def crop_mint(st):
    if opener(st, C(80, 60, 50), C(110, 200, 150)):
        return
    herb_mound(st, C(110, 196, 140), leaf_shape=HEART, size=0.1, n=(6, 12, 18), H=(0.1, 0.18, 0.24))


def crop_lavender(st):
    if opener(st, C(80, 70, 70), C(160, 120, 210)):
        return
    if st == 5:
        herb_mound(5, C(150, 170, 150), leaf_shape=STRAP)
        return
    herb_mound(st, C(150, 176, 150), leaf_shape=STRAP, size=0.12, n=(6, 12, 16), H=(0.1, 0.18, 0.22))
    if st >= 3:
        for i in range(9 if st == 4 else 4):
            a = gold(i) * D2R
            rr = 0.16 * math.sqrt((i + 0.5) / 9)
            b = P(rr * math.cos(a), rr * math.sin(a), T + 0.15)
            spike(C(150, 110, 210) if st == 4 else C(170, 160, 200), 0.24, 0.028)(b)


def crop_rosemary(st):
    if opener(st, C(80, 60, 50), C(60, 110, 90)):
        return
    if st == 5:
        herb_mound(5, C(80, 110, 90), leaf_shape=STRAP)
        return
    k = {2: 3, 3: 6, 4: 8}[st]
    H = {2: 0.2, 3: 0.4, 4: 0.48}[st]
    for i in range(k):
        a = gold(i) * D2R
        b = P(0.03 * math.cos(a), 0.03 * math.sin(a), T - 0.01)
        tip = b + P(0.1 * math.cos(a), 0.1 * math.sin(a), H * (0.8 + 0.2 * (i % 2)))
        stalk([b, tip], 0.022, 0.016, C(130, 110, 80), n=4, rings=2)
        sp = spline([b, tip], 6)
        for j in range(1, 6):
            for s in (-1, 1):
                leaf(sp[j], gold(i) + s * 80 + j * 20, 0.07, 0.025, 30, C(60, 110, 90), shape=STRAP, t=0.016)
        if st == 4:
            ell(tip, 0.03, C(140, 160, 230), seg=6, ring=4)


def crop_parsley(st):
    if opener(st, C(80, 60, 40), C(70, 160, 70)):
        return
    if st == 5:
        herb_mound(5, C(70, 160, 70))
        return
    n = {2: 4, 3: 8, 4: 12}[st]
    for i in range(n):
        a = gold(i) * D2R
        tip = P(0.14 * math.cos(a), 0.14 * math.sin(a), T + 0.16 + 0.04 * (i % 3))
        stalk([P(0, 0, T - 0.01), tip], 0.016, 0.012, C(110, 170, 80), n=4, rings=2)
        for j in range(4):
            b = j * 1.6
            ell(tip + P(0.035 * math.cos(b), 0.035 * math.sin(b), 0.01 * j), 0.04, C(70, 160, 70) if j % 2 else C(90, 176, 80), seg=6, ring=4)


def crop_chives(st):
    if opener(st, C(40, 40, 40), C(190, 130, 220), mono=True):
        return
    w = st == 5
    n = {2: 6, 3: 12, 4: 14, 5: 10}[st]
    for i in range(n):
        a = gold(i) * D2R
        b = P(0.05 * math.cos(a), 0.05 * math.sin(a), T - 0.01)
        h = {2: 0.2, 3: 0.32, 4: 0.36, 5: 0.25}[st] * (0.8 + 0.2 * (i % 3) / 2)
        tip = b + P(0.08 * math.cos(a), 0.08 * math.sin(a), h)
        if w:
            tip = b + P(0.2 * math.cos(a), 0.2 * math.sin(a), 0.05)
        tube([b, (b + tip) * 0.5 + P(0, 0, 0.02), tip], lambda t: 0.018 * (1 - 0.5 * t), C(80, 160, 80) if not w else DRY, rings=4, n=5)
        if st == 4 and i % 3 == 0:
            ell(tip, 0.05, C(190, 130, 220), seg=7, ring=5)


# ================================================================ flowers

def tulip_head(c, col, s=1.0):
    with at(c, s=s):
        for i in range(6):
            a = i * 60 + (30 if i % 2 else 0)
            leaf((0, 0, 0), a, 0.13, 0.11, 72 if i % 2 else 66, col if i % 2 else tuple(x * 0.9 for x in col), shape=ROUND, t=0.02)
        ell((0, 0, 0.04), (0.05, 0.05, 0.06), col, seg=8, ring=5)


def crop_tulip(st):
    if opener(st, C(200, 170, 120), C(232, 50, 70), mono=True):
        return
    w = st == 5
    n = 3 if st == 2 else 5
    for i in range(n):
        a = gold(i) * D2R
        b = P(0.08 * math.cos(a), 0.08 * math.sin(a), T - 0.01)
        h = 0.36 if st > 2 else 0.18
        tip = b + P(0.04 * math.cos(a), 0.04 * math.sin(a), h if not w else h * 0.6)
        for j in range(2):
            leaf(b, gold(i) + j * 160, 0.24 if st > 2 else 0.18, 0.09, 70, C(110, 170, 120) if not w else DRY, droop=0.4, shape=STRAP)
        if st == 2:
            continue
        stalk([b, tip], 0.02, 0.018, C(110, 170, 100) if not w else DRY_D, n=4, rings=2)
        cols = [C(232, 50, 70), C(250, 200, 50), C(250, 130, 170), C(240, 120, 40), C(180, 100, 200)]
        if st == 3:
            lathe([(0.02, 0), (0.04, 0.05), (0, 0.1)], tip, C(150, 200, 120), n=6)
        elif st == 4:
            tulip_head(tip, cols[i % 5])
        else:
            for k in range(3):
                leaf(tip + P(0, 0, 0.01), gold(i) + k * 120, 0.1, 0.07, -50, C(170, 110, 100), shape=ROUND)


def rose_head(c, col=C(232, 60, 90), s=1.0):
    with at(c, s=s):
        for ring_, (n, L, e) in enumerate(((6, 0.08, 20), (5, 0.07, 45), (4, 0.055, 70))):
            for i in range(n):
                leaf((0, 0, 0.01 * ring_), i * 360 / n + ring_ * 30, L, L * 1.1, e, tuple(x * (1 - 0.06 * ring_) for x in col), shape=ROUND, t=0.02)
        ell((0, 0, 0.04), (0.035, 0.035, 0.04), tuple(x * 0.8 for x in col), seg=7, ring=5)
        calyx((0, 0, -0.01), 0.06, LEAF_D, elev=-20)


def crop_rose(st):
    def fl(p, d, i):
        rose_head(p, [C(232, 60, 90), C(250, 160, 180), C(250, 210, 90)][i % 3], s=1.3)
    bush(st, dict(tag=C(232, 60, 90), leaf=C(70, 130, 70), blobs=[((0, 0, 0.42), 0.22), ((0.17, -0.04, 0.34), 0.16), ((-0.17, 0.04, 0.34), 0.16)],
                  flower=C(250, 180, 190), fruit=fl, nfruit=6, stem=C(90, 120, 70)))


def crop_sunflower_red(st):
    import crops
    if st == 4:
        crops.crop_sunflower(3)
        # swap the bud for a red head
        H = 1.35
        crops.sunflower_head((0.06, -0.1, H + 0.12), (0.44, -0.86, 0.25), r=0.3, petal=C(196, 50, 40), disc=C(70, 40, 30))
        return
    crops.crop_sunflower(st)


def pompom(c, r, col, n=24, seed=1):
    rr = rng(seed)
    for i in range(n):
        a = gold(i) * D2R
        z = 1 - 2 * (i + 0.5) / n
        q = math.sqrt(max(0, 1 - z * z))
        p = P(c) + P(q * math.cos(a) * r, q * math.sin(a) * r, z * r * 0.9)
        ell(p, r * 0.32, col if i % 3 else tuple(x * 0.92 for x in col), seg=6, ring=4)
    ell(c, r * 0.85, col, seg=8, ring=6)


def crop_teddy_sunflower(st):
    if opener(st, C(70, 60, 56), C(250, 200, 50)):
        return
    w = st == 5
    H = {2: 0.35, 3: 0.75, 4: 0.85, 5: 0.7}[st]
    stalk([(0, 0, T - 0.02), (0, 0, H)], 0.06, 0.045, C(120, 160, 70) if not w else DRY)
    for k in range(3 if st == 2 else 6):
        petiole_leaf((0, 0, T + (H - T) * (0.15 + 0.8 * k / 6)), gold(k), 0.26, LEAF if not w else DRY, elev=20 if not w else -20, rise=0.04,
                     droop=0.3, shape=HEART, scol=C(120, 160, 70))
    if st == 3:
        pompom((0, 0, H + 0.06), 0.09, C(150, 190, 80), n=10)
    elif st == 4:
        pompom((0.02, -0.03, H + 0.14), 0.2, C(252, 196, 40), n=30)
    elif w:
        pompom((0.1, -0.08, H - 0.02), 0.13, C(170, 130, 70), n=16)


def crop_marigold(st):
    if opener(st, C(60, 50, 40), C(250, 140, 30)):
        return
    def fl(p, d, i):
        pompom(p + P(0, 0, 0.02), 0.06, [C(250, 140, 30), C(252, 196, 40)][i % 2], n=12)
    bush(st, dict(tag=C(250, 140, 30), leaf=C(70, 130, 60), blobs=[((0, 0, 0.32), 0.2), ((0.15, -0.03, 0.27), 0.15), ((-0.15, 0.03, 0.27), 0.15)],
                  flower=C(250, 200, 120), fruit=fl, nfruit=7, leafy=False))


# ================================================================ exotic + fun

def crop_coffee(st):
    def fr(p, d, i):
        berry_cluster(p, C(206, 40, 40) if i % 3 else C(150, 190, 80), n=4, r=0.035, crown=False)
    bush(st, dict(tag=C(206, 40, 40), leaf=C(50, 110, 60), blobs=[((0, 0, 0.5), (0.22, 0.22, 0.3)), ((0.15, -0.05, 0.38), 0.17), ((-0.15, 0.04, 0.4), 0.17)],
                  flower=(1, 1, 1), fruit=fr, nfruit=9))


def cacao_pod(c, d=(0, 0, -1), s=1.0, col=C(232, 160, 40)):
    with oriented(c, d, s=s):
        lathe([(0, 0), (0.04, 0.02), (0.07, 0.08), (0.075, 0.15), (0.05, 0.22), (0, 0.25)], (0, 0, 0), col, n=10, lobes=5, lobe_depth=0.15)


def crop_cacao(st):
    spec = dict(tag=C(150, 80, 40), leaf=C(60, 120, 64), blobs=[((0.0, 0.0, 1.35), 0.42), ((0.3, -0.05, 1.2), 0.3), ((-0.3, 0.05, 1.2), 0.3)],
                blossom=C(250, 230, 220), trunk_h=0.95, nfruit=0, fruit=lambda p, d, i: None,
                drop=lambda p, w: cacao_pod(p + P(0, 0, 0.08), (1, -0.3, 0.1), col=C(130, 90, 60) if w else C(232, 160, 40)))

    def extra(s):
        if s == 5:
            for k, (a, z) in enumerate(((290, 0.45), (210, 0.65), (340, 0.75), (250, 0.85))):
                y = a * D2R
                cacao_pod((0.11 * math.cos(y), 0.11 * math.sin(y), z), (0.2 * math.cos(y), 0.2 * math.sin(y), -1),
                          col=[C(232, 160, 40), C(196, 80, 40), C(240, 200, 60), C(196, 80, 40)][k], s=1.3)
    spec["extra"] = extra
    tree(st, spec)


def crop_tea(st):
    def fr(p, d, i):
        leaf(p, gold(i), 0.08, 0.05, 70, C(150, 210, 100))
        ell(p + P(0, 0, 0.05), (0.015, 0.015, 0.035), C(170, 220, 120), seg=5, ring=3)
    bush(st, dict(tag=C(60, 120, 60), leaf=C(56, 120, 66), blobs=[((0, 0, 0.36), (0.34, 0.3, 0.18)), ((0.2, -0.1, 0.3), 0.15), ((-0.2, 0.05, 0.3), 0.15)],
                  flower=(1, 1, 1), fruit=fr, nfruit=12))


def pineapple(c, s=1.0, col=C(232, 170, 50), unripe=False):
    with at(c, s=s):
        g = Gourd([(0, 0), (0.08, 0.0), (0.12, 0.06), (0.13, 0.15), (0.11, 0.24), (0.06, 0.29), (0, 0.3)], 0, 0, n=10)
        g.build(C(150, 180, 80) if unripe else col)
        for k in range(5):
            for i in range(8):
                th = (i * 45 + k * 22.5) * D2R
                p, nrm = g.surf(th, 0.04 + k * 0.05)
                with oriented(p, nrm):
                    lathe([(0.025, 0), (0.012, 0.012), (0, 0.016)], (0, 0, 0), C(150, 110, 40) if not unripe else C(110, 150, 60), n=4)
        for i in range(8):
            leaf((0, 0, 0.27), i * 45, 0.16 - 0.03 * (i % 2), 0.05, 65 + 10 * (i % 2), C(70, 140, 80), shape=LANCE, t=0.016)


def crop_pineapple(st):
    if opener(st, C(150, 110, 60), C(232, 170, 50), mono=True):
        return
    w = st == 5
    n = {2: 6, 3: 10, 4: 12, 5: 10}[st]
    L = {2: 0.22, 3: 0.36, 4: 0.38, 5: 0.32}[st]
    for i in range(n):
        leaf((0, 0, T - 0.01), gold(i), L, 0.07, 40 + 15 * (i % 3) if not w else 10, C(80, 140, 90) if not w else DRY, droop=0.25, shape=LANCE)
    if st == 3:
        stalk([(0, 0, T), (0, 0, T + 0.18)], 0.03, 0.03, C(80, 140, 90))
        lathe([(0.04, 0), (0.06, 0.05), (0.04, 0.1), (0, 0.12)], (0, 0, T + 0.18), C(220, 70, 120), n=8)
    elif st == 4:
        stalk([(0, 0, T), (0, 0, T + 0.15)], 0.03, 0.03, C(80, 140, 90))
        pineapple((0, 0, T + 0.15), s=1.25)
    elif w:
        pineapple(on_mound(0.2, -0.2, -0.02), s=0.9, col=C(170, 120, 70))


def dragonfruit(c, s=1.0, col=C(236, 70, 140)):
    with at(c, s=s):
        ell((0, 0, 0.1), (0.1, 0.1, 0.12), col, seg=9, ring=6, rough=0.4)
        for k in range(3):
            for i in range(5):
                a = (i * 72 + k * 36)
                y = a * D2R
                leaf((0.09 * math.cos(y), 0.09 * math.sin(y), 0.03 + 0.07 * k), a, 0.06, 0.04, 55, C(150, 200, 90) if k == 2 else col, shape=LANCE, t=0.014)


def crop_dragonfruit(st):
    mound()
    box((0.09, 0.09, 1.0), (0, 0.06, 0.5), TRELLIS, bevel=0.012)
    torus(0.18, 0.03, (0, 0.06, 1.0), C(150, 150, 150), n=10, k=4)
    if st == 0:
        planted(C(30, 30, 30), C(236, 70, 140))
        return
    if st == 1:
        sprout(col=C(110, 170, 90))
        return
    w = st == 5
    col = C(100, 170, 90) if not w else C(170, 160, 100)
    reach = {2: 0.4, 3: 1.0, 4: 1.0, 5: 1.0}[st]

    def seg3(a, b):
        tube([a, b], lambda t: (0.06, 0.035), col, rings=3, n=3)
    seg3(P(0.05, 0, T), P(0.05, 0, T + reach * 0.85))
    if st >= 3:
        for s in (-1, 1):
            a = P(0.05, 0, 1.0)
            for k, (dx, dz) in enumerate(((0.2, 0.05), (0.32, -0.15), (0.36, -0.4))):
                b = P(0.05 + s * dx, -0.05 * k, 1.0 + dz)
                seg3(a, b)
                a = b
            if st == 3:
                lathe([(0.03, 0), (0.12, 0.08), (0.14, 0.12), (0, 0.1)], a + P(0, -0.04, 0), (1, 1, 1), n=10, lobes=8, lobe_depth=0.3, rx=-80)
            if st == 4:
                dragonfruit(a + P(0, -0.08, -0.12), s=1.1)
                dragonfruit(P(0.05 + s * 0.2, -0.08, 0.92), s=0.9)


def crop_chili(st):
    if opener(st, C(250, 230, 160), C(226, 44, 40)):
        return
    w = st == 5
    bl = [((0, 0, 0.42), 0.2), ((0.15, -0.03, 0.34), 0.15), ((-0.15, 0.04, 0.34), 0.15)]
    k = {2: 0.55, 3: 0.9, 4: 1.0, 5: 0.85}[st]
    stalk([(0, 0, T - 0.01), (0, 0, T + 0.2 * k)], 0.035, 0.03, STEM if not w else DRY_D)
    if w:
        withered_rosette(5, 0.22, 0.14, LANCE)
        chili(on_mound(0.22, -0.2, 0.04), (1, -0.4, -0.1), col=C(130, 60, 40))
        return
    canopy([((c[0] * k, c[1] * k, T + (c[2] - T) * k), r * k) for c, r in bl], C(70, 140, 70))
    if st == 3:
        for p, d in on_canopy(bl, 5, 6):
            star_flower(p, (1, 1, 1), C(230, 230, 180), s=1.0, d=tuple(d))
    if st == 4:
        for i, (p, d) in enumerate(on_canopy(bl, 9, 6, up=(-0.5, 0.5))):
            chili(p + P(0, 0, -0.01), (0.2 * d.x, 0.2 * d.y, -1), L=0.18, col=[C(226, 44, 40), C(250, 150, 30), C(90, 160, 70)][i % 3])


def mushroom(c, r, h, cap=C(160, 104, 70), stem=CREAM, s=1.0, tilt=0.0):
    with at(c, s=s, ry=tilt):
        cyl(r * 0.35, h, (0, 0, 0), stem, n=7, r2=r * 0.3)
        lathe([(r * 0.3, h - 0.01), (r, h + r * 0.05), (r * 0.95, h + r * 0.3), (r * 0.5, h + r * 0.6), (0, h + r * 0.65)], (0, 0, 0), cap, n=10)
        lathe([(r * 0.3, h - 0.012), (r * 0.98, h + r * 0.04), (0, h + r * 0.04)], (0, 0, 0), C(240, 220, 190), n=10)


def crop_mushroom_log(st):
    """Shiitake on a log laid over the mound."""
    mound()
    with at((0, 0, mz(0.0) + 0.06), rz=25):
        cyl(0.15, 0.85, (-0.42, 0, 0), C(150, 104, 70), n=9, ry=90)
        for x in (-0.43, 0.43):
            cyl(0.13, 0.02, (x, 0, 0), C(222, 186, 136), n=9, ry=90)
            torus(0.07, 0.01, (x + (0.012 if x > 0 else -0.012), 0, 0), C(190, 150, 100), n=9, k=3, ry=90)
        for x in (-0.2, 0.15):
            box((0.03, 0.06, 0.08), (x, 0, 0.14), C(120, 84, 56), bevel=0.01)
        if st == 0:
            for x, a in ((-0.25, 30), (0.0, 80), (0.25, 130)):
                y = math.radians(a)
                ell((x, -0.15 * math.cos(y) * 0.9, 0.15 * math.sin(y) * 0.9), 0.025, C(240, 230, 200), seg=6, ring=4)
            return
        spots = [(-0.28, 70), (-0.05, 100), (0.2, 75), (0.32, 120), (0.05, 140), (-0.18, 130)]
        w = st == 5
        for k, (x, a) in enumerate(spots):
            y = math.radians(a)
            p = (x, -0.15 * math.cos(y) * 0.95, 0.15 * math.sin(y) * 0.95)
            sz = {1: 0.035, 2: 0.06, 3: 0.1, 4: 0.135, 5: 0.09}[st] * (0.8 + 0.2 * (k % 2))
            if st == 1 and k % 2:
                continue
            with oriented(p, (0, -math.cos(y) * 0.6, math.sin(y) + 0.4)):
                mushroom((0, 0, 0), sz, sz * 0.7, cap=C(160, 104, 70) if not w else C(110, 90, 80), stem=CREAM if not w else C(200, 180, 150),
                         tilt=20 if w else 0)


def crop_cranberry(st):
    """Cranberry bog: a low mat of tiny leaves; flooded for harvest, berries float."""
    if st == 0:
        planted(C(200, 40, 50), C(200, 40, 50))
        return
    mound()
    if st == 1:
        sprout(s=0.7)
        return
    w = st == 5
    if st == 4:
        water_top(0.42)
    n = {2: 10, 3: 22, 4: 18, 5: 20}[st]
    r = rng(5)
    for i in range(n):
        a = gold(i) * D2R
        rr = 0.36 * math.sqrt((i + 0.5) / n)
        p = P(on_mound(rr * math.cos(a), rr * math.sin(a), 0.01))
        leaf(p, gold(i), 0.12, 0.08, 25, (C(70, 120, 60) if st < 4 else C(150, 80, 60)) if not w else DRY_D, shape=ROUND)
    if st == 3:
        for i in range(6):
            a = gold(i) * D2R
            ell(on_mound(0.25 * math.cos(a), 0.25 * math.sin(a), 0.06), 0.02, C(250, 190, 200), seg=6, ring=4)
    if st == 4:
        for i in range(30):
            a = gold(i) * D2R
            rr = 0.38 * math.sqrt((i + 0.5) / 30)
            ell((rr * math.cos(a), rr * math.sin(a), mz(rr * 0.6) + 0.035), 0.035, C(206, 30, 50), seg=8, ring=6, rough=0.3)
    if w:
        for i in range(5):
            a = gold(i) * D2R
            ell(on_mound(0.2 * math.cos(a), 0.2 * math.sin(a), 0.025), 0.025, C(110, 50, 50), seg=6, ring=4)


VINES = [("Grapes", crop_grapes), ("Peas", crop_peas), ("Cucumber", crop_cucumber), ("Cantaloupe", crop_melon),
         ("Watermelon", crop_watermelon), ("Kiwi", crop_kiwi)]
BERRIES = [("Blueberry", crop_blueberry), ("Raspberry", crop_raspberry), ("Gooseberry", crop_gooseberry),
           ("Redcurrant", crop_redcurrant), ("Blackcurrant", crop_blackcurrant)]
FRUIT_TREES = [(n, make_tree(n)) for n in TREES] + [("Banana", crop_banana), ("Coconut palm", crop_coconut)]
HERBS = [("Basil", crop_basil), ("Mint", crop_mint), ("Lavender", crop_lavender), ("Rosemary", crop_rosemary), ("Parsley", crop_parsley),
         ("Chives", crop_chives)]
FLOWERS = [("Tulip", crop_tulip), ("Rose", crop_rose), ("Red sunflower", crop_sunflower_red), ("Teddy-bear sunflower", crop_teddy_sunflower),
           ("Marigold", crop_marigold)]
EXOTIC = [("Coffee", crop_coffee), ("Cacao", crop_cacao), ("Tea bush", crop_tea), ("Pineapple", crop_pineapple), ("Dragonfruit", crop_dragonfruit),
          ("Chili", crop_chili), ("Mushroom log", crop_mushroom_log), ("Cranberry bog", crop_cranberry)]
SEVEN = {n for n, _ in FRUIT_TREES} | {"Cacao"}


# ================================================================ produce

def herb_bunch(col, shape=ROUND, flower=None):
    def top(p, d, i):
        leaf(p, gold(i), 0.15, 0.13, 50, col, shape=shape)
        leaf(p - d * 0.08, gold(i) + 150, 0.13, 0.11, 40, col, shape=shape)
        if flower:
            flower(p)
    bundle(6, tuple(c * 0.85 for c in col), top, h=0.3)


def produce3(name):
    if name == "Grapes":
        horn.grapes()
    elif name == "Peas":
        for i in range(3):
            with at((i * 0.06 - 0.06, 0, 0.03), rz=25 + i * 10):
                pod((0, -0.13, 0.0), (0, 1, 0.05), L=0.26, col=C(110, 186, 80), s=1.6)
    elif name == "Cucumber":
        cucumber((-0.13, 0, 0.055), (1, -0.3, 0.02), L=0.3, r=0.06)
    elif name == "Cantaloupe":
        melon((0, 0, 0))
    elif name == "Watermelon":
        melon((0, 0, 0), kind="watermelon")
    elif name == "Kiwi":
        kiwi((0, 0, 0.07), 0.07)
        with at((0.15, 0.05, 0.07), rz=25):
            ell((0, 0, 0), (0.02, 0.07, 0.07), C(150, 110, 70), seg=9, ring=6)
            ell((-0.012, 0, 0), (0.012, 0.062, 0.062), C(130, 200, 70), seg=9, ring=6)
            ell((-0.02, 0, 0), (0.006, 0.02, 0.02), C(250, 250, 220), seg=6, ring=4)
    elif name == "Blueberry":
        berry_cluster((0, 0, 0.04), C(80, 100, 196), n=7, r=0.04, spread=0.07)
    elif name == "Raspberry":
        raspberry((0, 0, 0.08), 0.07)
        raspberry((0.11, 0.05, 0.08), 0.06)
    elif name == "Gooseberry":
        gooseberry((0, 0, 0.06), 0.06)
        gooseberry((0.1, 0.05, 0.055), 0.055)
    elif name == "Redcurrant":
        currant_string((0, 0, 0.3), C(226, 40, 50), n=6, r=0.04)
    elif name == "Blackcurrant":
        currant_string((0, 0, 0.3), C(64, 40, 80), n=6, r=0.04)
    elif name == "Pear tree":
        horn.pear()
    elif name == "Cherry tree":
        cherries((0, 0, 0.05), 0.06)
    elif name == "Peach tree":
        peach((0, 0, 0.085), 0.09)
    elif name == "Lemon tree":
        lemon((0, 0, 0.075), 0.08, d=(1, -0.3, 0.1))
        leaf((0.0, 0.05, 0.1), 60, 0.12, 0.06, 20, LEAF_D)
    elif name == "Orange tree":
        ballfruit((0, 0, 0.09), 0.09, C(250, 150, 40), stem=BROWN, leafy=LEAF_D)
    elif name == "Plum tree":
        plum((0, 0, 0.07), 0.075)
    elif name == "Olive tree":
        olives((0, 0, 0.16), n=5)
    elif name == "Avocado tree":
        avocado((0, 0, 0.08), (1, -0.3, 0.05))
        with at((0.15, 0.08, 0.06), rz=25):
            ell((0, 0, 0), (0.02, 0.07, 0.06), C(200, 220, 120), seg=9, ring=6)
            ell((-0.02, 0, 0), (0.012, 0.03, 0.03), C(130, 84, 50), seg=8, ring=5)
    elif name == "Banana":
        bananas((0, 0, 0.14), 5)
    elif name == "Coconut palm":
        coconut((0, 0, 0.11), 0.11)
    elif name == "Basil":
        herb_bunch(C(96, 186, 80))
    elif name == "Mint":
        herb_bunch(C(110, 196, 140), HEART)
    elif name == "Lavender":
        bundle(7, C(150, 176, 150), lambda p, d, i: spike(C(150, 110, 210), 0.14, 0.025)(p), h=0.32)
    elif name == "Rosemary":
        herb_bunch(C(60, 110, 90), STRAP)
    elif name == "Parsley":
        bundle(6, C(110, 170, 80), lambda p, d, i: [ell(p + P(0.03 * math.cos(j), 0.03 * math.sin(j), 0), 0.035, C(70, 160, 70), seg=6, ring=4) for j in range(3)], h=0.3)
    elif name == "Chives":
        bundle(9, C(80, 160, 80), lambda p, d, i: ell(p, 0.04, C(190, 130, 220), seg=7, ring=5) if i % 3 == 0 else None, h=0.35, spread=0.02)
    elif name == "Tulip":
        bundle(3, C(110, 170, 100), lambda p, d, i: tulip_head(p, [C(232, 50, 70), C(250, 200, 50), C(250, 130, 170)][i]), h=0.4)
    elif name == "Rose":
        stalk([(0, 0, 0.0), (0, 0, 0.35)], 0.02, 0.018, C(90, 120, 70))
        leaf((0, 0, 0.18), 40, 0.1, 0.07, 30, C(70, 130, 70), shape=ROUND)
        rose_head((0, 0, 0.36), s=1.6)
    elif name == "Red sunflower":
        import crops
        crops.sunflower_head((0, 0, 0.33), (0.44, -0.86, 0.15), r=0.22, petal=C(196, 50, 40), disc=C(70, 40, 30))
    elif name == "Teddy-bear sunflower":
        pompom((0, 0, 0.2), 0.2, C(252, 196, 40), n=30)
    elif name == "Marigold":
        pompom((0, 0, 0.08), 0.08, C(250, 140, 30), n=14)
        pompom((0.14, 0.04, 0.07), 0.07, C(252, 196, 40), n=12)
    elif name == "Coffee":
        berry_cluster((0, 0, 0.05), C(206, 40, 40), n=6, r=0.045, spread=0.06, crown=False)
        leaf((0.0, 0.08, 0.05), 80, 0.14, 0.07, 20, C(50, 110, 60))
    elif name == "Cacao":
        cacao_pod((-0.12, 0, 0.075), (1, -0.25, 0.05), s=1.4)
    elif name == "Tea bush":
        stalk([(0, 0, 0), (0, 0, 0.12)], 0.015, 0.012, C(130, 110, 80))
        for i, (yaw, e) in enumerate(((20, 40), (200, 40), (110, 70))):
            leaf((0, 0, 0.1 + 0.02 * i), yaw, 0.14, 0.08, e, C(110, 180, 90) if i < 2 else C(170, 220, 120))
    elif name == "Pineapple":
        pineapple((0, 0, 0), 1.0)
    elif name == "Dragonfruit":
        dragonfruit((0, 0, 0), 1.0)
        with at((0.2, 0.08, 0.0), rz=25):
            ell((0, 0, 0.09), (0.02, 0.09, 0.1), C(236, 70, 140), seg=9, ring=6)
            ell((-0.02, 0, 0.09), (0.012, 0.08, 0.09), (1, 1, 1), seg=9, ring=6)
            for k in range(8):
                ell((-0.03, 0.05 * math.cos(k), 0.09 + 0.05 * math.sin(k)), 0.006, DARK, seg=4, ring=3)
    elif name == "Chili":
        for i in range(3):
            chili((i * 0.06 - 0.06, 0, 0.04), (0.3, -1, 0.2), L=0.2, col=[C(226, 44, 40), C(250, 150, 30), C(90, 160, 70)][i])
    elif name == "Mushroom log":
        mushroom((0, 0, 0), 0.1, 0.08)
        mushroom((0.12, 0.06, 0), 0.08, 0.06, tilt=10)
        mushroom((-0.08, 0.1, 0), 0.06, 0.05, tilt=-10)
    elif name == "Cranberry bog":
        berry_cluster((0, 0, 0.035), C(206, 30, 50), n=9, r=0.035, spread=0.09, crown=False)
