"""Round 2 crops, part 1: vegetables (leafy, brassica, root, allium, fruiting)
and grains/field crops. Each is a few lines on the grow.py grammars."""
import math

from grow import *  # noqa: F401,F403

DRYC = DRY


# ================================================================ leafy + brassicas

def lettuce_head(c, r, col=C(176, 220, 112), edge=C(150, 204, 92)):
    with at(c):
        lathe([(0, 0), (r * 0.7, 0.02), (r, r * 0.5), (r * 0.85, r * 1.0), (r * 0.4, r * 1.2), (0, r * 1.22)], (0, 0, 0), col, n=10, lobes=5, lobe_depth=0.12, twist=40)
        for i in range(7):
            a = (i * 360 / 7 + 15) * D2R
            leaf((r * 0.55 * math.cos(a), r * 0.55 * math.sin(a), r * 0.05), i * 360 / 7 + 15, r * 1.0, r * 1.15, 48, edge if i % 2 else col,
                 droop=0.3, shape=ROUND)
        for i in range(4):
            a = (i * 90 + 40) * D2R
            leaf((r * 0.3 * math.cos(a), r * 0.3 * math.sin(a), r * 0.6), i * 90 + 40, r * 0.8, r * 0.95, 62, col, droop=0.2, shape=ROUND)


def crop_lettuce(st):
    if opener(st, CREAM, C(160, 210, 100)):
        return
    if st == 5:
        withered_rosette(7, 0.26, 0.24)
        return
    r = {2: 0.1, 3: 0.15, 4: 0.21}[st]
    if st == 2:
        rosette(5, 0.2, 0.2, 40, C(170, 216, 110), droop=0.2)
    else:
        lettuce_head((0, 0, T - 0.02), r)


def crop_kale(st):
    if opener(st, C(90, 70, 60), C(70, 110, 90)):
        return
    col = C(64, 110, 96)
    if st == 5:
        stalk([(0, 0, T - 0.01), (0, 0, 0.42)], 0.05, 0.04, DRY_D)
        withered_rosette(5, 0.28, 0.2)
        return
    h = {2: 0.12, 3: 0.3, 4: 0.42}[st]
    stalk([(0, 0, T - 0.01), (0, 0, T + h)], 0.05, 0.04, C(120, 140, 110))
    for k in range(3 if st == 2 else 8):
        yaw = gold(k)
        z = T + h * (0.4 + 0.6 * k / 8)
        y = yaw * D2R
        L = 0.24 if st == 2 else 0.34
        tip = P(0, 0, z)
        # crinkly frond: a spine with three overlapping round lobes
        for j, f in enumerate((0.35, 0.65, 0.95)):
            leaf(tip + P(math.cos(y) * L * f * 0.6, math.sin(y) * L * f * 0.6, L * f * 0.45), yaw + (j - 1) * 25, L * 0.42, L * 0.38, 40, col if j % 2 else C(84, 130, 110), shape=ROUND, droop=0.1)


def crop_spinach(st):
    if opener(st, C(120, 100, 60), C(60, 120, 60)):
        return
    if st == 5:
        withered_rosette(8, 0.24, 0.2)
        return
    n, L = {2: (5, 0.18), 3: (8, 0.26), 4: (11, 0.3)}[st]
    rosette(n, L, L * 0.6, 45, C(54, 118, 62), droop=0.3, petiole=C(110, 160, 80), prise=0.1)
    if st == 4:
        rosette(5, L * 0.7, L * 0.45, 65, C(70, 136, 72), droop=0.2, yaw0=30, petiole=C(110, 160, 80), prise=0.12)


CHARD = [C(222, 50, 70), C(250, 196, 50), C(240, 120, 160), C(240, 140, 50)]


def crop_chard(st):
    if opener(st, C(130, 90, 70), C(222, 50, 70)):
        return
    if st == 5:
        withered_rosette(6, 0.3, 0.24)
        return
    n, L, H = {2: (4, 0.18, 0.12), 3: (7, 0.28, 0.22), 4: (9, 0.32, 0.3)}[st]
    for i in range(n):
        yaw = gold(i)
        y = yaw * D2R
        b = P(0, 0, T - 0.01)
        tip = b + P(math.cos(y) * 0.13, math.sin(y) * 0.13, H)
        stalk([b, tip], 0.03, 0.024, CHARD[i % 4], n=5, rings=3)
        leaf(tip, yaw, L, L * 0.6, 45, C(60, 120, 64), droop=0.35, shape=ROUND)


def crop_celery(st):
    if opener(st, C(150, 130, 90), C(180, 220, 120)):
        return
    if st == 5:
        withered_rosette(6, 0.26, 0.16, LANCE)
        return
    n, H = {2: (5, 0.16), 3: (8, 0.32), 4: (11, 0.44)}[st]
    for i in range(n):
        a = gold(i) * D2R
        rr = 0.03 + 0.06 * math.sqrt(i / n)
        b = P(rr * math.cos(a), rr * math.sin(a), T - 0.02)
        tip = b + P(rr * math.cos(a) * 0.8, rr * math.sin(a) * 0.8, H * (0.85 + 0.15 * (i % 2)))
        stalk([b, tip], 0.042, 0.034, C(176, 214, 120), n=6, rings=3)
        for j in (-1, 0, 1):
            leaf(tip, gold(i) + j * 40, 0.09, 0.08, 50, C(110, 170, 80), shape=ROUND)


def crop_bokchoy(st):
    if opener(st, C(130, 100, 70), C(120, 180, 100)):
        return
    if st == 5:
        withered_rosette(6, 0.24, 0.2)
        return
    n, H = {2: (4, 0.12), 3: (7, 0.22), 4: (9, 0.3)}[st]
    for i in range(n):
        yaw = i * 360 / n + 10
        y = yaw * D2R
        b = P(0.03 * math.cos(y), 0.03 * math.sin(y), T - 0.02)
        tip = b + P(math.cos(y) * 0.07, math.sin(y) * 0.07, H)
        tube([b, (b + tip) * 0.5 + P(math.cos(y) * 0.02, math.sin(y) * 0.02, 0), tip], lambda t: (0.05 + 0.02 * t, 0.025), C(240, 246, 226), rings=4, n=6,
             side=(-math.sin(y), math.cos(y), 0))
        leaf(tip - P(0, 0, 0.04), yaw, H * 0.75, H * 0.65, 78, C(70, 140, 70), shape=ROUND, droop=0.05)


def curd(c, r, col=C(250, 246, 230), n=13, seed=3):
    rr = rng(seed)
    ell(c, (r, r, r * 0.6), col, seg=10, ring=5)
    for i in range(n):
        a = gold(i) * D2R
        k = math.sqrt((i + 0.5) / n)
        p = P(c) + P(r * 0.8 * k * math.cos(a), r * 0.8 * k * math.sin(a), r * 0.5 * (1 - k * k) + 0.02)
        ell(p, r * rr.uniform(0.3, 0.38), col, seg=7, ring=5)


def crop_cauliflower(st):
    if opener(st, C(150, 120, 90), CREAM):
        return
    col = C(110, 160, 110)
    if st == 5:
        withered_rosette(7, 0.32, 0.22, LANCE)
        curd((0, 0, T + 0.04), 0.1, C(200, 180, 130))
        return
    n, L = {2: (5, 0.22), 3: (8, 0.34), 4: (8, 0.36)}[st]
    rosette(n, L, L * 0.6, 40 if st < 4 else 55, col, shape=LANCE, droop=0.25)
    if st == 3:
        curd((0, 0, T + 0.04), 0.09)
    if st == 4:
        curd((0, 0, T + 0.07), 0.19)
        rosette(5, 0.3, 0.2, 70, C(124, 176, 120), shape=LANCE, droop=0.35, r0=0.12, yaw0=20)


def crop_broccoli(st):
    if opener(st, C(130, 100, 70), C(60, 140, 70)):
        return
    col = C(90, 140, 100)
    if st == 5:
        withered_rosette(6, 0.3, 0.2, LANCE)
        stalk([(0, 0, T), (0, 0, T + 0.2)], 0.06, 0.05, DRY_D)
        curd((0, 0, T + 0.24), 0.1, C(190, 180, 80))
        return
    H = {2: 0.08, 3: 0.2, 4: 0.28}[st]
    stalk([(0, 0, T - 0.01), (0, 0, T + H)], 0.07, 0.06, C(140, 180, 110))
    rosette({2: 5, 3: 7, 4: 7}[st], {2: 0.22, 3: 0.32, 4: 0.34}[st], 0.22, 35, col, shape=LANCE, droop=0.3, z=T + H * 0.3)
    if st >= 3:
        curd((0, 0, T + H + 0.02), 0.11 if st == 3 else 0.18, C(56, 130, 60) if st == 4 else C(110, 170, 90))


def crop_brussels(st):
    if opener(st, C(130, 100, 70), C(100, 160, 80)):
        return
    if st == 5:
        stalk([(0, 0, T - 0.01), (0, 0, 0.6), (0.06, 0, 0.72)], 0.06, 0.045, DRY_D)
        for z in (0.3, 0.45):
            ell((0.06, -0.04, z), 0.04, C(170, 160, 90), seg=7, ring=5)
        withered_rosette(4, 0.26, 0.2)
        return
    H = {2: 0.18, 3: 0.55, 4: 0.68}[st]
    stalk([(0, 0, T - 0.01), (0, 0, H)], 0.065, 0.05, C(150, 184, 110))
    rosette(5, 0.26 if st > 2 else 0.18, 0.24 if st > 2 else 0.16, 45, C(96, 150, 96), droop=0.3, z=H - 0.02, petiole=C(150, 184, 110), prise=0.05)
    if st >= 3:
        for k in range(14 if st == 4 else 6):
            a = gold(k) * D2R
            z = T + 0.08 + (H - T - 0.15) * k / (14 if st == 4 else 6)
            r = 0.055 if st == 4 else 0.035
            ell((math.cos(a) * 0.075, math.sin(a) * 0.075, z), (r, r, r * 0.95), C(124, 186, 90), seg=8, ring=5)


def artichoke_bud(c, r=0.09, col=C(120, 150, 110), tip=C(150, 90, 130)):
    with at(c):
        for k, (z, rr) in enumerate(((0.0, 1.0), (0.35, 0.85), (0.7, 0.6), (1.0, 0.3))):
            for i in range(7):
                a = i * 360 / 7 + k * 25
                leaf((0, 0, z * r * 1.3 - r * 0.2), a, r * rr * 1.3, r * 0.9, 50 - k * 6, col if k < 2 else tip, shape=ROUND, t=0.02)
        ell((0, 0, r * 0.4), (r * 0.45, r * 0.45, r * 0.9), col, seg=8, ring=6)


def crop_artichoke(st):
    if opener(st, C(130, 110, 90), C(150, 90, 130)):
        return
    col = C(150, 178, 160)
    if st == 5:
        withered_rosette(6, 0.36, 0.14, LANCE)
        stalk([(0, 0, T), (0.02, 0, 0.5), (0.1, -0.05, 0.6)], 0.035, 0.03, DRY_D)
        ell((0.12, -0.06, 0.62), (0.08, 0.08, 0.07), C(150, 110, 150), seg=8, ring=6)
        return
    n, L = {2: (5, 0.24), 3: (7, 0.4), 4: (7, 0.44)}[st]
    rosette(n, L, 0.16, 35, col, shape=LANCE, droop=0.3)
    if st >= 3:
        H = 0.42 if st == 3 else 0.6
        stalk([(0, 0, T), (0, 0, H)], 0.035, 0.03, col)
        artichoke_bud((0, 0, H), 0.06 if st == 3 else 0.1)


def spear(b, h, col=C(110, 160, 80), tip=C(130, 100, 140)):
    b = P(b)
    stalk([b, b + P(0, 0, h * 0.6), b + P(0.01, 0, h)], 0.035, 0.03, col, n=6, rings=3)
    lathe([(0.032, 0), (0.036, 0.04), (0.02, 0.07), (0, 0.08)], b + P(0.01, 0, h - 0.01), tip, n=6, lobes=3, lobe_depth=0.2)


def crop_asparagus(st):
    if opener(st, C(110, 80, 60), C(110, 160, 80), mono=True):
        return
    if st == 2:
        for i, (x, y) in enumerate(((0, 0), (0.1, 0.04), (-0.08, 0.06))):
            spear(on_mound(x, y, -0.02), 0.12)
        return
    if st in (3, 5):
        col = C(110, 170, 90) if st == 3 else DRY
        for i in range(5):
            a = gold(i) * D2R
            b = P(on_mound(0.06 * math.cos(a), 0.06 * math.sin(a), -0.01))
            top = b + P(0.1 * math.cos(a), 0.1 * math.sin(a), 0.6)
            stalk([b, top], 0.02, 0.015, col, n=4, rings=3)
            for k in range(4):
                p = b + (top - b) * (0.4 + 0.18 * k)
                ell(p + P(0.06 * math.cos(a + k), 0.06 * math.sin(a + k), 0), (0.08, 0.08, 0.05), col, seg=6, ring=4)
        return
    for i, (x, y) in enumerate(((0, 0), (0.1, 0.04), (-0.08, 0.06), (0.04, -0.1), (-0.06, -0.08), (0.12, -0.06))):
        spear(on_mound(x, y, -0.02), 0.3 + 0.04 * (i % 3))


def crop_pepper(st):
    if opener(st, CREAM, C(222, 50, 40)):
        return
    w = st == 5
    H = {2: 0.3, 3: 0.55, 4: 0.6, 5: 0.45}[st]
    stalk([(0, 0, T - 0.01), (0, 0, H * 0.5), (0.02, 0, H)], 0.045, 0.03, DRY_D if w else STEM)
    for k in range(4 if st == 2 else 9):
        z = T + (H - T) * (0.25 + 0.75 * k / 9)
        petiole_leaf((0, 0, z), gold(k), 0.2 if st > 2 else 0.16, DRY if w else LEAF_D, elev=20 if not w else -30, rise=0.02, shape=LANCE,
                     droop=0.25 if not w else 0.7)
    if st == 3:
        star_flower((0.1, -0.1, H * 0.7), CREAM, MUSTARD, s=1.2)
        pepper((0.12, -0.12, H * 0.5), r=0.05, L=0.09, col=C(90, 150, 70))
    elif st == 4:
        for k, (a, col) in enumerate(((290, C(226, 50, 40)), (210, C(250, 196, 40)), (340, C(240, 120, 30)))):
            y = a * D2R
            pepper((0.16 * math.cos(y), 0.16 * math.sin(y), H * (0.55 + 0.1 * k)), d=(0.2 * math.cos(y), 0.2 * math.sin(y), -1), r=0.085, L=0.15, col=col)
    elif w:
        pepper(on_mound(0.22, -0.2, 0.05), d=(0.4, -0.4, -0.6), r=0.06, L=0.1, col=C(150, 90, 60))


def zucchini(c, rz=0, L=0.42, r=0.07, col=C(56, 110, 60), sz=1.0):
    with at(c, rz=rz, s=(1, 1, sz)):
        tube([(-L / 2, 0, r), (0, 0, r * 1.05), (L / 2, 0, r * 1.1)], lambda t: r * (0.75 + 0.35 * t) if t < 0.92 else r * 0.6, col, rings=8, n=8, side=(0, 1, 0), rough=0.4)
        for i in range(4):
            box((L * 0.7, 0.012, 0.012), (0, 0, r), C(150, 190, 120), rx=i * 45)
        lathe([(0.03, 0), (0.025, 0.05), (0, 0.06)], (-L / 2 - 0.01, 0, r * 0.95), LEAF_D, n=5, ry=-90)


def crop_zucchini(st):
    if opener(st, CREAM, C(56, 110, 60)):
        return
    w = st == 5
    lc = C(96, 150, 76) if not w else DRY
    n = {2: 3, 3: 6, 4: 6, 5: 6}[st]
    for i in range(n):
        yaw = gold(i)
        if w:
            leaf(on_mound(0.05, 0.05, 0.01), yaw, 0.32, 0.3, 4, lc, droop=0.15, shape=ROUND)
        else:
            petiole_leaf((0, 0, T - 0.01), yaw, 0.27 if st > 2 else 0.18, lc, elev=30, rise=0.08 if st > 2 else 0.05, droop=0.25)
    if st == 3:
        flower_trumpet((0.06, -0.1, T + 0.08), (0.2, -0.7, 0.6), s=1.4)
    elif st == 4:
        zucchini(on_mound(0.05, -0.24, -0.04), rz=-15)
        zucchini(on_mound(-0.2, -0.12, -0.04), rz=-130, L=0.34, col=C(250, 210, 60))
        flower_trumpet((0.1, -0.1, T + 0.1), (0.3, -0.7, 0.6), s=1.2)
    elif w:
        zucchini(on_mound(0.05, -0.24, -0.04), rz=-15, col=C(150, 140, 90), sz=0.7)


# ================================================================ roots + alliums

def root_crop(st, seed, tag, leaf_col, shoulder, leaves=(4, 7, 8), L=(0.18, 0.3, 0.34), shape=ROUND, petiole=None):
    if opener(st, seed, tag):
        return
    if st >= 4:
        shoulder()
    n = {2: leaves[0], 3: leaves[1], 4: leaves[2], 5: leaves[1]}[st]
    l = {2: L[0], 3: L[1], 4: L[2], 5: L[1]}[st]
    z = T + 0.06 if st >= 4 else T - 0.01
    if st == 5:
        rosette(n, l, l * 0.6, 5, DRY, shape=shape, droop=0.4, z=z)
        return
    rosette(n, l, l * 0.5, 45, leaf_col, shape=shape, droop=0.35, z=z, petiole=petiole or tuple(c * 0.9 for c in leaf_col), prise=0.1)


def crop_radish(st):
    def sh():
        ell((0, 0, T + 0.03), (0.12, 0.12, 0.11), C(232, 60, 90), seg=10, ring=6)
        ell((0, 0, T - 0.04), (0.1, 0.1, 0.06), C(250, 240, 240), seg=10, ring=4)
    root_crop(st, C(160, 110, 80), C(232, 60, 90), C(100, 160, 80), sh, petiole=C(200, 90, 110))


def crop_turnip(st):
    def sh():
        lathe([(0.0, T - 0.05), (0.15, T), (0.17, T + 0.06), (0.12, T + 0.13), (0, T + 0.15)], (0, 0, 0), CREAM, n=10)
        lathe([(0.168, T + 0.06), (0.12, T + 0.13), (0, T + 0.155)], (0, 0, 0.004), C(150, 70, 140), n=10)
    root_crop(st, C(140, 110, 80), C(150, 70, 140), C(90, 150, 80), sh, L=(0.2, 0.32, 0.36))


def crop_parsnip(st):
    def sh():
        lathe([(0.12, T - 0.04), (0.14, T + 0.05), (0.1, T + 0.09), (0, T + 0.1)], (0, 0, 0), C(244, 230, 190), n=9)
        torus(0.13, 0.01, (0, 0, T + 0.02), C(230, 214, 170), n=9, k=4)
    root_crop(st, C(200, 180, 140), C(244, 230, 190), C(110, 160, 80), sh, shape=LANCE, L=(0.2, 0.34, 0.38))


def crop_sweetpotato(st):
    if opener(st, C(190, 90, 70), C(196, 90, 80)):
        return
    w = st == 5
    lc = C(110, 140, 80) if not w else DRY
    stalk([(0, 0, T - 0.01), (0.15, 0.12, mz(0.2) + 0.02), (0.36, 0.1, 0.04), (0.42, -0.1, 0.03)], 0.022, 0.016, C(130, 70, 90) if not w else DRY_D)
    stalk([(0, 0, T - 0.01), (-0.15, 0.08, mz(0.17) + 0.02), (-0.36, -0.05, 0.04)], 0.022, 0.016, C(130, 70, 90) if not w else DRY_D)
    n = {2: 3, 3: 7, 4: 7, 5: 6}[st]
    for i in range(n):
        a = gold(i) * D2R
        rr = 0.06 + 0.25 * (i / n)
        p = on_mound(rr * math.cos(a), rr * math.sin(a))
        leaf(p, gold(i), 0.2, 0.18, 30 if not w else 0, lc, droop=0.2, shape=HEART)
    if st >= 4:
        for x, y, rz in ((0.22, -0.26, 30), (-0.2, -0.22, -30)):
            with at(on_mound(x, y, 0.0), rz=rz):
                ell((0, 0, 0), (0.12, 0.07, 0.065), C(196, 90, 80) if not w else C(160, 100, 90), seg=8, ring=6)


def garlic_bulb(c, r=0.11, col=C(246, 240, 236), stripe=C(196, 150, 190)):
    with at(c):
        lathe([(0, 0), (r * 0.7, 0.01), (r, r * 0.6), (r * 0.85, r * 1.15), (r * 0.3, r * 1.6), (0, r * 1.7)], (0, 0, 0), col, n=10, lobes=6, lobe_depth=0.12)
        for i in range(3):
            a = i * 120 * D2R
            tube([P(r * 0.55 * math.cos(a), r * 0.55 * math.sin(a), r * 0.3), P(r * 0.85 * math.cos(a), r * 0.85 * math.sin(a), r * 0.75),
                  P(r * 0.3 * math.cos(a), r * 0.3 * math.sin(a), r * 1.5)], lambda t: 0.012, stripe, rings=4, n=4)


def crop_garlic(st):
    if opener(st, CREAM, C(196, 150, 190), mono=True):
        return
    w = st == 5
    if st >= 4:
        garlic_bulb((0, 0, T - 0.06), 0.12, col=C(246, 240, 236) if not w else C(220, 200, 180))
    n = {2: 4, 3: 6, 4: 6, 5: 5}[st]
    for i in range(n):
        leaf((0, 0, T + (0.12 if st >= 4 else -0.01)), i * 360 / n + 20, 0.38 if st > 2 else 0.24, 0.07, 70 if not w else 10,
             C(110, 160, 110) if not w else DRY, droop=0.5 if st > 2 else 0.25, shape=STRAP)
    if st == 3:
        pts = [(0, 0, T), (0, 0, 0.5), (0.08, 0, 0.62), (0.14, 0, 0.55), (0.1, 0, 0.47)]
        tube(pts, lambda t: 0.022, C(120, 170, 110), rings=10, n=5)
        lathe([(0.02, 0), (0.035, 0.03), (0, 0.08)], (0.1, 0, 0.45), CREAM, n=6, rx=180)


def crop_leek(st):
    if opener(st, C(90, 70, 60), C(150, 190, 150), mono=True):
        return
    w = st == 5
    H = {2: 0.2, 3: 0.32, 4: 0.4, 5: 0.32}[st]
    r = {2: 0.04, 3: 0.06, 4: 0.075, 5: 0.06}[st]
    cyl(r, H, (0, 0, T - 0.04), C(244, 244, 226) if not w else C(220, 200, 170), n=8, r2=r * 0.95)
    cyl(r * 0.96, H * 0.35, (0, 0, T - 0.04 + H * 0.7), C(190, 220, 160) if not w else DRY, n=8)
    for i in range(5 if st > 2 else 3):
        side = 1 if i % 2 else -1
        leaf((0, 0, T - 0.04 + H * (0.9 + 0.05 * i)), 25 + 90 + side * 90 + i * 8, 0.3 + 0.04 * i, 0.1, 60 if not w else 0,
             C(80, 140, 120) if not w else DRY, droop=0.6, shape=STRAP)


def crop_shallot(st):
    """Red onions / shallots: a cluster of three bulbs."""
    if opener(st, C(160, 80, 90), C(150, 50, 80), mono=True):
        return
    w = st == 5
    pos = ((0, 0.02), (0.1, -0.05), (-0.09, -0.05))
    for k, (x, y) in enumerate(pos[:1 if st == 2 else 3]):
        if st >= 4:
            onion_bulb(on_mound(x, y, -0.07), 0.1, C(160, 60, 90) if not w else C(150, 110, 100))
        z = mz(math.hypot(x, y)) + (0.1 if st >= 4 else -0.01)
        for i in range(3):
            onion_leaf((x, y, z), i * 120 + 20 + k * 40, 0.36 if st > 2 else 0.24, (C(110, 170, 96) if st < 4 else C(170, 186, 90)) if not w else DRY,
                       flop=0.7 if st >= 4 else 0.0, r=0.028)


# ================================================================ grains + field crops

def crop_rice(st):
    if st == 0:
        planted(C(240, 230, 200), C(240, 200, 120))
        water_top()
        return
    mound()
    water_top()
    if st == 1:
        sprout(mono=True, s=0.8)
        return
    w = st == 5
    spots = [(0, 0), (0.15, 0.04), (-0.13, 0.07), (0.05, -0.15), (-0.1, -0.12)]
    col = {2: C(120, 190, 80), 3: C(110, 180, 74), 4: C(200, 190, 90), 5: C(170, 150, 110)}[st]
    for i, (x, y) in enumerate(spots):
        b = P(on_mound(x, y, 0.0))
        for k in range(4):
            leaf(b, gold(i * 4 + k), 0.24 if st == 2 else 0.4, 0.05, 72, col, droop=0.4, shape=STRAP)
        if st >= 3:
            top = b + P(x * 0.5, y * 0.5, 0.42)
            stalk([b, top], 0.016, 0.014, col, n=4, rings=3)
            # drooping panicle
            hd = (top + P(0.1, -0.05, -0.12))
            pts = [top, top + P(0.06, -0.02, 0.03), hd]
            gc = C(240, 210, 110) if st == 4 else (C(150, 200, 90) if st == 3 else C(170, 150, 110))
            tube(pts, lambda t: 0.012, gc, rings=5, n=4)
            for j, f in enumerate((0.3, 0.5, 0.7, 0.9)):
                p = spline(pts, 11)[int(f * 10)]
                ell(p + P(0, -0.015 * (j % 2), -0.01), (0.022, 0.018, 0.03), gc, seg=6, ring=4)


def barley_head(top, d, col, s=1.0):
    wheat_head(top, d, col, L=0.18, awns=False, s=s)
    with oriented(top, d, s=s):
        for k in range(6):
            a = k * 60 * D2R
            tube([(0, 0, 0.1), (0.03 * math.cos(a), 0.03 * math.sin(a), 0.25), (0.06 * math.cos(a), 0.06 * math.sin(a), 0.36)], lambda t: 0.006, col, rings=3, n=3)


def field_clump(st, stalk_col, head, spots=None, H=(0.5, 0.7), leaves=True):
    spots = spots or [(0.0, 0.0), (0.17, 0.06), (-0.16, 0.08), (0.08, -0.17), (-0.12, -0.13)]
    r = rng(7)
    for i, (x, y) in enumerate(spots):
        b = P(on_mound(x, y, -0.02))
        h = r.uniform(*H)
        lean = P(x * 0.5, y * 0.5, 0)
        tip = b + P(0, 0, h) + lean
        stalk([b, b + P(0, 0, h * 0.5) + lean * 0.4, tip], 0.026, 0.018, stalk_col, n=5, rings=5)
        head(tip, (tip - b).normalized() + P(0.15, -0.05, 0), i)
        if leaves:
            leaf(b + P(0, 0, 0.1), gold(i), 0.28, 0.06, 45, stalk_col, droop=0.3, shape=STRAP)


def crop_barley(st):
    if opener(st, C(214, 180, 110), C(220, 190, 120), mono=True):
        return
    if st == 2:
        for i in range(8):
            leaf(on_mound(0.1 * math.cos(i), 0.1 * math.sin(i), -0.01), gold(i), 0.26, 0.05, 70, LEAF, droop=0.2, shape=STRAP)
        return
    col = {3: C(150, 190, 84), 4: C(222, 186, 110), 5: C(168, 148, 112)}[st]
    if st == 5:
        field_clump(st, col, lambda t, d, i: barley_head(t, P(d) + P(0.6, -0.3, -1.4), col, s=1.6), H=(0.3, 0.4))
        return
    field_clump(st, col, lambda t, d, i: barley_head(t, P(d) + P(0.3, 0, -0.2) * (st == 4), col, s=1.8))


def oat_head(top, col, s=1.0):
    with at(top, s=s):
        for k in range(7):
            a = k * 2.4
            z = -0.02 - 0.03 * k
            b = P(0, 0, z * 0.5 + 0.05)
            e = P(0.07 * math.cos(a), 0.07 * math.sin(a), z)
            tube([b, e], lambda t: 0.008, col, rings=2, n=3)
            lathe([(0.02, 0), (0.024, 0.03), (0, 0.06)], e, col, n=5, rx=170)


def crop_oats(st):
    if opener(st, C(220, 200, 150), C(214, 196, 140), mono=True):
        return
    if st == 2:
        for i in range(8):
            leaf(on_mound(0.1 * math.cos(i), 0.1 * math.sin(i), -0.01), gold(i), 0.26, 0.05, 70, C(120, 170, 100), droop=0.2, shape=STRAP)
        return
    col = {3: C(140, 184, 110), 4: C(226, 206, 140), 5: C(168, 148, 112)}[st]
    field_clump(st, col, lambda t, d, i: oat_head(t, col, s=1.5 if st != 5 else 1.2), H=(0.55, 0.7) if st != 5 else (0.35, 0.45))


def crop_soy(st):
    if opener(st, C(232, 210, 140), C(190, 170, 100)):
        return
    w = st == 5
    lc = {2: LEAF, 3: LEAF, 4: C(190, 180, 80), 5: DRY}[st]
    n = {2: 3, 3: 7, 4: 7, 5: 6}[st]
    for i in range(n):
        trifoliate((0, 0, T - 0.01), gold(i), 0.18 if st > 2 else 0.12, lc, droop=0.6 if w else 0.0, size=0.13 if st > 2 else 0.1)
    if st == 3:
        for i in range(4):
            a = gold(i) * D2R
            ell((0.12 * math.cos(a), 0.12 * math.sin(a), T + 0.2), 0.03, C(200, 170, 230), seg=6, ring=4)
    if st >= 4:
        for i in range(6):
            a = (i * 60 + 200) * D2R
            pod((0.14 * math.cos(a), 0.14 * math.sin(a), T + 0.18), (0.3 * math.cos(a), 0.3 * math.sin(a), -1), L=0.16,
                col=C(196, 170, 110) if not w else C(150, 120, 90), s=1.6)


def cotton_boll(c, s=1.0, open_=True):
    with at(c, s=s):
        for i in range(5):
            leaf((0, 0, 0), i * 72, 0.07, 0.05, 20, C(120, 84, 60), shape=ROUND)
        if open_:
            for i in range(4):
                a = i * 90 * D2R
                ell((0.04 * math.cos(a), 0.04 * math.sin(a), 0.05), 0.05, (1, 1, 1), seg=8, ring=6)
            ell((0, 0, 0.08), 0.05, (1, 1, 1), seg=8, ring=6)
        else:
            lathe([(0.04, 0), (0.05, 0.03), (0, 0.08)], (0, 0, 0), C(120, 170, 90), n=6, lobes=3, lobe_depth=0.2)


def crop_cotton(st):
    if opener(st, C(250, 250, 250), C(250, 250, 250)):
        return
    w = st == 5
    H = {2: 0.3, 3: 0.6, 4: 0.62, 5: 0.55}[st]
    stalk([(0, 0, T - 0.01), (0.01, 0, H * 0.6), (0, 0.01, H)], 0.04, 0.028, C(130, 90, 70))
    bl = [((0, 0, H), 0.2), ((0.15, 0.0, H - 0.15), 0.15), ((-0.14, 0.04, H - 0.12), 0.15)] if st > 2 else [((0, 0, H), 0.14)]
    if w:
        for (c, r) in bl:
            stalk([P(0, 0, H * 0.5), P(c)], 0.02, 0.015, C(120, 84, 60), n=4, rings=3)
            cotton_boll(P(c) + P(0, 0, 0.0), s=1.2)
        return
    lc = LEAF if st < 4 else C(160, 130, 80)
    canopy(bl, lc)
    if st == 3:
        for p, d in on_canopy(bl, 5, 4):
            flower_trumpet(p, d, col=C(250, 230, 190), s=0.9)
    if st == 4:
        for p, d in on_canopy(bl, 8, 4, up=(-0.2, 0.9)):
            cotton_boll(p, s=1.4)


def crop_sugarcane(st):
    if opener(st, C(160, 120, 90), C(150, 90, 120), mono=True):
        return
    w = st == 5
    canes = [(0, 0), (0.12, 0.05), (-0.1, 0.07), (0.04, -0.12)]
    H = {2: 0.3, 3: 1.0, 4: 1.25, 5: 1.0}[st]
    col = {2: C(140, 180, 90), 3: C(140, 176, 90), 4: C(170, 110, 150), 5: C(180, 150, 110)}[st]
    for i, (x, y) in enumerate(canes[:2 if st == 2 else 4]):
        b = P(on_mound(x, y, -0.02))
        h = H * (0.85 + 0.15 * (i % 2))
        top = b + P(x * 0.3, y * 0.3, h)
        cyl(0.05, h, b, col, n=7)
        for k in range(1, int(h / 0.18)):
            torus(0.052, 0.014, b + P(x * 0.3 * k * 0.18 / h, y * 0.3 * k * 0.18 / h, k * 0.18), tuple(c * 0.8 for c in col), n=7, k=4)
        for k in range(4):
            leaf(top - P(0, 0, 0.05 * k), gold(i * 4 + k), 0.5 if st > 2 else 0.3, 0.09, 55, C(110, 170, 80) if not w else DRY,
                 droop=0.7, shape=STRAP)


def hop_cone(c, d=(0, 0, -1), s=1.0, col=C(186, 220, 110)):
    with oriented(c, d, s=s):
        for k in range(4):
            for i in range(5):
                leaf((0, 0, k * 0.025), i * 72 + k * 36, 0.04, 0.045, -60, col, shape=ROUND, t=0.012, n=4)
        lathe([(0.01, 0), (0.025, 0.04), (0.02, 0.09), (0, 0.11)], (0, 0, 0), col, n=6)


def crop_hops(st):
    mound()
    # pole + string, present every stage
    cyl(0.04, 1.4, (0.12, 0.12, mz(0.17) - 0.03), WOOD, n=6)
    box((0.3, 0.05, 0.05), (0.04, 0.12, 1.38), WOOD_D)
    tube([(-0.1, 0.12, 1.38), (-0.06, 0.06, 0.8), (0, 0, T)], lambda t: 0.006, TWINE, rings=4, n=3)
    if st == 0:
        planted(C(130, 110, 70), C(186, 220, 110))
        return
    if st == 1:
        sprout()
        return
    w = st == 5
    reach = {2: 0.35, 3: 1.2, 4: 1.25, 5: 1.2}[st]
    pts = []
    for i in range(16):
        f = i / 15
        z = T + (1.36 - T) * f * reach / 1.25
        a = f * 9
        base = P(-0.1 * f, 0.12 * f, z)
        pts.append(base + P(0.05 * math.cos(a), 0.05 * math.sin(a), 0))
    stalk(pts, 0.02, 0.016, STEM if not w else DRY_D, n=4, rings=24)
    sp = spline(pts, 16)
    for i in range(2, 16, 2):
        leaf(sp[i], gold(i) + 200, 0.18, 0.18, 10 if not w else -40, LEAF if not w else DRY, droop=0.3, shape=HEART)
    if st >= 4:
        for i in range(3, 15, 2):
            hop_cone(sp[i] + P(0.06, -0.08, -0.04), (0.2, -0.2, -1), s=1.5, col=C(186, 220, 110) if not w else C(170, 150, 100))


VEG = [
    ("Lettuce", crop_lettuce), ("Kale", crop_kale), ("Spinach", crop_spinach), ("Rainbow chard", crop_chard), ("Celery", crop_celery),
    ("Bok choy", crop_bokchoy), ("Cauliflower", crop_cauliflower), ("Broccoli", crop_broccoli), ("Brussels sprouts", crop_brussels),
    ("Artichoke", crop_artichoke), ("Asparagus", crop_asparagus), ("Bell pepper", crop_pepper), ("Zucchini", crop_zucchini),
    ("Radish", crop_radish), ("Turnip", crop_turnip), ("Parsnip", crop_parsnip), ("Sweet potato", crop_sweetpotato),
    ("Garlic", crop_garlic), ("Leek", crop_leek), ("Red shallot", crop_shallot),
]
GRAINS = [("Rice paddy", crop_rice), ("Barley", crop_barley), ("Oats", crop_oats), ("Soybean", crop_soy), ("Cotton", crop_cotton),
          ("Sugarcane", crop_sugarcane), ("Hops", crop_hops)]


# ================================================================ produce

def _herb_top(col):
    return lambda p, d, i: leaf(p, gold(i), 0.08, 0.07, 50, col, shape=ROUND)


def produce2(name):
    if name == "Lettuce":
        lettuce_head((0, 0, 0.0), 0.2)
    elif name == "Kale":
        with at((0, 0, 0)):
            bundle(5, C(120, 150, 110), lambda p, d, i: [leaf(p - d * 0.05 * j, gold(i) + j * 30, 0.12, 0.11, 60, C(64, 110, 96), shape=ROUND) for j in range(2)], h=0.3)
    elif name == "Spinach":
        bundle(6, C(110, 160, 80), lambda p, d, i: leaf(p, gold(i), 0.14, 0.12, 50, C(54, 118, 62), shape=ROUND), h=0.22)
    elif name == "Rainbow chard":
        r = rng(2)
        for i in range(4):
            a = (i - 1.5) * 12
            with at((0, 0, 0.03), rz=25 + a, ry=-80):
                stalk([(0, 0, 0), (0, 0, 0.22)], 0.03, 0.025, CHARD[i], n=5, rings=2)
                leaf((0, 0, 0.2), 90, 0.24, 0.2, 90, C(60, 120, 64), shape=ROUND)
    elif name == "Celery":
        for i in range(5):
            a = gold(i) * D2R
            b = P(0.03 * math.cos(a), 0.03 * math.sin(a), 0)
            stalk([b, b * 2 + P(0, 0, 0.4)], 0.04, 0.035, C(176, 214, 120), n=6, rings=2)
            leaf(b * 2 + P(0, 0, 0.4), gold(i), 0.1, 0.09, 50, C(110, 170, 80), shape=ROUND)
    elif name == "Bok choy":
        with at((0, 0, 0), s=0.9):
            for i in range(6):
                yaw = i * 60
                y = yaw * D2R
                tip = P(math.cos(y) * 0.05, math.sin(y) * 0.05, 0.28)
                tube([P(0, 0, 0), tip], lambda t: (0.05 + 0.02 * t, 0.025), C(240, 246, 226), rings=3, n=6, side=(-math.sin(y), math.cos(y), 0))
                leaf(tip - P(0, 0, 0.03), yaw, 0.2, 0.17, 80, C(70, 140, 70), shape=ROUND)
    elif name == "Cauliflower":
        for i in range(6):
            leaf((0, 0, 0.02), i * 60, 0.24, 0.16, 55, C(110, 160, 110), shape=LANCE, droop=0.2)
        curd((0, 0, 0.1), 0.18)
    elif name == "Broccoli":
        stalk([(0, 0, 0.0), (0, 0, 0.12)], 0.06, 0.05, C(140, 180, 110))
        curd((0, 0, 0.15), 0.18, C(56, 130, 60))
    elif name == "Brussels sprouts":
        for i, (x, y) in enumerate(((0, 0), (0.1, 0.04), (-0.08, 0.06), (0.03, 0.1))):
            ell((x, y, 0.055), (0.06, 0.06, 0.055), C(124, 186, 90), seg=8, ring=6)
    elif name == "Artichoke":
        artichoke_bud((0, 0, 0.04), 0.13)
    elif name == "Asparagus":
        with at((0, 0, 0.06), ry=80, rz=25):
            bundle(7, C(110, 160, 80), lambda p, d, i: lathe([(0.03, 0), (0.034, 0.04), (0.02, 0.07), (0, 0.08)], p, C(130, 100, 140), n=6), h=0.4, spread=0.025)
    elif name == "Bell pepper":
        pepper((0, 0, 0.17), d=(0, 0, -1), r=0.12, L=0.17)
    elif name == "Zucchini":
        zucchini((0, 0, 0), rz=-30, L=0.46, r=0.08)
    elif name == "Radish":
        for i, (x, y) in enumerate(((0, 0), (0.12, 0.05))):
            ell((x, y, 0.08), (0.08, 0.08, 0.075), C(232, 60, 90), seg=10, ring=6)
            tube([(x, y, 0.005), (x + 0.01, y, -0.03)], lambda t: 0.012, CREAM, rings=2, n=4)
            leaf((x, y, 0.15), 60 + i * 60, 0.16, 0.1, 60, C(100, 160, 80), shape=ROUND)
    elif name == "Turnip":
        lathe([(0.0, 0), (0.15, 0.05), (0.17, 0.12), (0.12, 0.19), (0, 0.21)], (0, 0, 0), CREAM, n=10)
        lathe([(0.168, 0.12), (0.12, 0.19), (0, 0.215)], (0, 0, 0.004), C(150, 70, 140), n=10)
        for i in range(3):
            leaf((0, 0, 0.2), i * 120, 0.18, 0.12, 60, C(90, 150, 80), shape=ROUND)
    elif name == "Parsnip":
        with at((0, 0, 0.08), ry=80, rz=25):
            carrot_root((0, 0, 0), L=0.36, r=0.08, col=C(244, 230, 190))
            for i in range(3):
                leaf((0, 0, 0), i * 120, 0.18, 0.12, 50, C(110, 160, 80), shape=LANCE)
    elif name == "Sweet potato":
        for x, rz in ((0, 20), (0.08, -40)):
            with at((x, x, 0.07), rz=rz):
                ell((0, 0, 0), (0.15, 0.08, 0.07), C(196, 90, 80), seg=8, ring=6)
    elif name == "Garlic":
        garlic_bulb((0, 0, 0), 0.16)
        stalk([(0, 0, 0.25), (0, 0, 0.32)], 0.02, 0.018, C(200, 190, 160))
    elif name == "Leek":
        with at((0, 0, 0.08), ry=-80, rz=25):
            cyl(0.08, 0.36, (0, 0, -0.1), C(244, 244, 226), n=8)
            cyl(0.078, 0.12, (0, 0, 0.16), C(190, 220, 160), n=8)
            for i in range(3):
                leaf((0, 0, 0.26), i * 120, 0.2, 0.1, 70, C(80, 140, 120), shape=STRAP, droop=0.2)
    elif name == "Red shallot":
        for i, (x, y) in enumerate(((0, 0), (0.12, 0.04), (0.04, 0.12))):
            onion_bulb((x, y, 0), 0.09, C(160, 60, 90))
    elif name == "Rice paddy":
        with at((0, 0, 0)):
            lathe([(0.14, 0), (0.2, 0.18), (0.18, 0.2), (0.12, 0.03), (0, 0.03)], (0, 0, 0), C(200, 160, 110), n=10)
            ell((0, 0, 0.16), (0.18, 0.18, 0.06), C(250, 248, 236), seg=10, ring=5)
            for i in range(10):
                a = gold(i) * D2R
                ell((0.1 * math.cos(a) * (i / 10), 0.1 * math.sin(a) * (i / 10), 0.2), (0.025, 0.018, 0.012), (1, 1, 1), seg=5, ring=3)
    elif name == "Barley":
        bundle(6, C(222, 186, 110), lambda p, d, i: barley_head(p, d, C(222, 186, 110), s=1.2), h=0.5)
    elif name == "Oats":
        bundle(5, C(226, 206, 140), lambda p, d, i: oat_head(p, C(226, 206, 140), s=1.0), h=0.45)
    elif name == "Soybean":
        for i in range(3):
            with at((i * 0.06 - 0.06, 0, 0.03), rz=25 + i * 10):
                pod((0, -0.12, 0.0), (0, 1, 0.05), L=0.24, col=C(196, 170, 110), s=1.5)
    elif name == "Cotton":
        cotton_boll((0, 0, 0.02), s=2.2)
    elif name == "Sugarcane":
        for i in range(3):
            with at((0, i * 0.1 - 0.1, 0.05 + 0.08 * (i == 1)), rz=25, ry=90):
                cyl(0.05, 0.6, (0, 0, -0.3), C(170, 110, 150), n=7)
                for k in range(4):
                    torus(0.052, 0.014, (0, 0, -0.3 + 0.15 * k + 0.07), C(136, 88, 120), n=7, k=4)
    elif name == "Hops":
        for i, (x, y) in enumerate(((0, 0), (0.1, 0.05), (-0.05, 0.1))):
            hop_cone((x, y, 0.2), (0, 0, -1), s=2.2)
        leaf((0, 0.05, 0.22), 60, 0.2, 0.2, 10, LEAF, shape=HEART)
