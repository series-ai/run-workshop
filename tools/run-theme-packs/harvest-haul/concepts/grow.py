"""Shared growth grammars for the big crop set (round 2): one stage scaffold plus
rosette, clump, bush, trellis-vine, tree and palm builders, and a box of produce
shapes. Each crop in crops2.py / crops3.py is a few parameters on one of these,
plus its own silhouette details and produce item."""
import math

from hh import *  # noqa: F401,F403
from crops import (T, planted, sprout, petiole_leaf, tendril, flower_trumpet, star_flower, calyx, tomato_fruit, apple_fruit,
                   berry, pod, carrot_root, frond, potato, onion_bulb, eggplant_fruit, trifoliate, onion_leaf, leafy_stalk, wheat_head)
import gourds

WATER = C(120, 176, 210)


def opener(st, seed, tag, sprout_col=LEAF_L, mono=False, s=1.0):
    """Stages 0 and 1 are the same scaffold for every crop. Returns True when it drew the stage."""
    if st == 0:
        planted(seed, tag)
        return True
    mound()
    if st == 1:
        sprout(col=sprout_col, mono=mono, s=s)
        return True
    return False


def gold(i):
    return i * 137.5 + 15


def rosette(n, L, w, elev, col, shape=ROUND, droop=0.2, z=None, r0=0.0, yaw0=0.0, petiole=None, prise=0.0, t=0.02):
    z = T - 0.01 if z is None else z
    for i in range(n):
        yaw = yaw0 + i * 360 / n + (i % 2) * 12
        y = yaw * D2R
        b = P(r0 * math.cos(y), r0 * math.sin(y), z)
        if petiole:
            tip = b + P(math.cos(y) * L * 0.25, math.sin(y) * L * 0.25, prise)
            stalk([b, (b + tip) * 0.5 + P(0, 0, prise * 0.2), tip], 0.02, 0.016, petiole, n=5, rings=4)
            leaf(tip, yaw, L, w, elev, col, droop=droop, shape=shape, t=t)
        else:
            leaf(b, yaw, L, w, elev, col, droop=droop, shape=shape, t=t)


def withered_rosette(n=6, L=0.3, w=0.24, shape=ROUND):
    """Flopped tan leaves lying over the mound (kept above its slope so they show)."""
    rosette(n, L, w, 18, DRY, shape=shape, droop=0.25, z=T + 0.02)
    rosette(max(3, n // 2), L * 0.7, w * 0.7, 35, DRY_D, shape=shape, droop=0.3, yaw0=30, z=T + 0.02)


def water_top(r=0.36):
    """Flooded mound top (rice, cranberry bog)."""
    ell((0, 0, mz(r * 0.6) + 0.004), (r, r, 0.03), WATER, seg=12, ring=4, rough=0.15)


def canopy(blobs, col, seg=8):
    for c, r in blobs:
        rr = r if isinstance(r, (tuple, list)) else (r, r, r * 0.86)
        ell(c, rr, col, seg=seg, ring=6)


def on_canopy(blobs, n, seed, front=True, up=(-0.3, 0.9)):
    """Points on the outside of a canopy, mostly on the camera side."""
    r = rng(seed)
    pts = []
    for k in range(n * 6):
        c, rad = blobs[r.randrange(len(blobs))]
        rad = rad if isinstance(rad, (int, float)) else rad[0]
        th = r.uniform(-2.6, -0.2) if (front and r.random() < 0.8) else r.uniform(0, 6.28)
        ph = r.uniform(*up)
        d = P(math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph))
        p = P(c) + P(d.x * rad, d.y * rad, d.z * rad * 0.86)
        if any((p - q[0]).length < 0.11 for q in pts):
            continue
        pts.append((p, d))
        if len(pts) >= n:
            break
    return pts


def trunk(h, r, col=C(140, 98, 66), lean=0.0, twist=30):
    lathe([(r * 1.5, T - 0.04), (r * 1.15, T + 0.06), (r, h * 0.6), (r * 0.92, h)], (0, 0, 0), col, n=8, twist=twist, ry=lean)


def branches(spread, z0, z1, col=C(140, 98, 66), n=4, r=0.055):
    out = []
    for i in range(n):
        a = (i * 360 / n + 30) * D2R
        b = P(spread * math.cos(a), spread * math.sin(a) * 0.8, z1 + 0.05 * (i % 2))
        stalk([P(0, 0, z0), (P(0, 0, z0) + b) * 0.5 + P(0, 0, 0.06), b], r, r * 0.6, col, n=6, rings=4)
        out.append(b)
    return out


def blossoms(pts, col=C(250, 214, 222), mid=MUSTARD):
    for p, d in pts:
        with oriented(p, d):
            for i in range(5):
                leaf((0, 0, 0), i * 72, 0.06, 0.05, 15, col if i % 2 else (1, 1, 1), shape=ROUND, t=0.01, n=4)
            ell((0, 0, 0.012), 0.02, mid, seg=5, ring=3)


# ---------------------------------------------------------------- the tree grammar (7 stages)
TREE_STAGES = ["planted", "sprout", "sapling", "mature", "blossom", "ripe", "withered"]


def tree(st, spec):
    """spec: seed, tag, leaf, blobs [(c, r)], bark, trunk_h, trunk_r, blossom col, fruit(p, d, i), nfruit, drop(p)."""
    if opener(st, spec.get("seed", C(90, 60, 40)), spec["tag"], s=1.15):
        return
    bark = spec.get("bark", C(140, 98, 66))
    if st == 2:
        stalk([(0, 0, T - 0.02), (0.01, 0, 0.45), (-0.01, 0.01, 0.72)], 0.045, 0.028, bark)
        for yaw in (30, 160, 270):
            leaf((-0.01, 0.01, 0.72), yaw, 0.17, 0.11, 35, spec["leaf"], droop=0.1, shape=spec.get("shape", ROUND))
        leaf((0.01, 0, 0.5), 300, 0.15, 0.1, 30, spec["leaf"], shape=spec.get("shape", ROUND))
        return
    h = spec.get("trunk_h", 0.8)
    trunk(h, spec.get("trunk_r", 0.1), bark, twist=spec.get("twist", 30))
    tips = branches(spec.get("spread", 0.3), h - 0.05, h + 0.35, bark, n=spec.get("nbranch", 4))
    if st == 6:
        for b in tips:
            stalk([b, b + P(0.06, 0, 0.12), b + P(0.08, -0.04, 0.2)], 0.035, 0.025, bark, n=5, rings=4)
            leaf(b + P(0.02, 0, 0.05), 300, 0.1, 0.06, -30, DRY, droop=0.3)
        for p, yaw in (((0.3, -0.22, 0.02), 30), ((-0.2, -0.3, 0.02), 120)):
            leaf(p, yaw, 0.1, 0.07, 0, DRY_D)
        if spec.get("drop"):
            spec["drop"](P(0.3, -0.14, mz(0.33)), True)
        return
    blobs = spec["blobs"]
    cc = spec["leaf"] if st != 4 else tuple(min(1, c * 1.1 + 0.03) for c in spec["leaf"])
    canopy(blobs, cc)
    if spec.get("extra"):
        spec["extra"](st)
    if st == 4:
        blossoms(on_canopy(blobs, 18, 12), spec.get("blossom", C(250, 214, 222)))
    elif st == 5:
        for i, (p, d) in enumerate(on_canopy(blobs, spec.get("nfruit", 10), 7, up=spec.get("up", (-0.5, 0.7)))):
            with at(p + d * 0.05, s=spec.get("fs", 1.45)):
                spec["fruit"](P(0, 0, 0), d, i)
        if spec.get("drop"):
            spec["drop"](P(0.32, -0.16, mz(0.36)), False)


# ---------------------------------------------------------------- the bush grammar (berries, coffee, tea)

def bush(st, spec):
    """spec: seed, tag, leaf, blobs(scale) fn, stems col, flower col, fruit(p, d, i), nfruit."""
    if opener(st, spec.get("seed", C(110, 70, 60)), spec["tag"]):
        return
    stem = spec.get("stem", C(130, 92, 64))
    k = {2: 0.5, 3: 0.85, 4: 1.0, 5: 0.9}[st]
    for a in (0, 120, 240):
        y = (a + 20) * D2R
        stalk([(0, 0, T - 0.01), (0.08 * math.cos(y) * k, 0.08 * math.sin(y) * k, T + 0.15 * k), (0.15 * math.cos(y) * k, 0.15 * math.sin(y) * k, T + 0.3 * k)],
              0.035, 0.025, stem if st != 5 else DRY_D, n=5, rings=4)
    blobs = [((c[0] * k, c[1] * k, T + (c[2] - T) * k), tuple(x * k for x in r) if isinstance(r, (tuple, list)) else r * k) for c, r in spec["blobs"]]
    if st == 5:
        for (c, r) in blobs[:3]:
            r = r if isinstance(r, (int, float)) else r[0]
            for j in range(3):
                a = (j * 120 + 40) * D2R
                stalk([P(c) - P(0, 0, r * 0.5), P(c) + P(r * 0.8 * math.cos(a), r * 0.8 * math.sin(a), r * 0.4)], 0.02, 0.014, DRY_D, n=4, rings=3)
        rosette(5, 0.14, 0.1, 0, DRY, droop=0.1, r0=0.25)
        return
    canopy(blobs, spec["leaf"])
    if spec.get("leafy", True):
        for p, d in on_canopy(blobs, 8 if st > 2 else 3, 3):
            leaf(p, math.degrees(math.atan2(d.y, d.x)), 0.12 * k, 0.09 * k, 25, tuple(c * 1.08 for c in spec["leaf"]), shape=ROUND)
    if st == 3 and spec.get("flower"):
        for p, d in on_canopy(blobs, 7, 5):
            star_flower(p + d * 0.02, spec["flower"], MUSTARD, s=1.0, d=tuple(d))
    if st == 4:
        for i, (p, d) in enumerate(on_canopy(blobs, spec.get("nfruit", 9), 9, up=(-0.3, 0.7))):
            with at(p + d * 0.03, s=spec.get("fs", 1.3)):
                spec["fruit"](P(0, 0, 0), d, i)


# ---------------------------------------------------------------- produce shapes (centred near the origin)

def ballfruit(c, r, col, stem=BROWN, leafy=None, sq=0.9, rough=0.45, n=9):
    with at(c):
        ell((0, 0, 0), (r, r, r * sq), col, seg=n, ring=6, rough=rough)
        if stem:
            stalk([(0, 0, r * sq * 0.85), (0.01, 0, r * sq * 1.2), (0.03, 0, r * sq * 1.4)], 0.012, 0.009, stem, n=4, rings=3)
        if leafy:
            leaf((0.01, 0, r * sq * 1.15), 20, r * 1.1, r * 0.6, 25, leafy, droop=0.2)


def pepper(c, d=(0, 0, -1), r=0.09, L=0.16, col=C(222, 50, 40)):
    with oriented(c, d):
        lathe([(0.02, -0.01), (r * 0.8, 0.0), (r, L * 0.35), (r * 0.85, L * 0.8), (r * 0.4, L), (0, L * 1.02)], (0, 0, 0), col, n=8, lobes=4, lobe_depth=0.18, rough=0.3)
        lathe([(0.03, -0.012), (0.035, -0.04), (0.02, -0.07), (0, -0.075)], (0, 0, 0), LEAF_D, n=5)


def chili(c, d=(0, 0, -1), L=0.18, r=0.03, col=C(226, 44, 40)):
    with oriented(c, d):
        tube([(0, 0, 0), (0.0, 0, L * 0.4), (0.015, 0, L * 0.8), (0.04, 0, L)], lambda t: r * (1 - 0.85 * t) + 0.004, col, rings=7, n=6, side=(0, 1, 0), rough=0.3)
        lathe([(r * 1.1, -0.005), (r * 0.6, -0.025), (0, -0.03)], (0, 0, 0), LEAF_D, n=5, lobes=5, lobe_depth=0.3)


def lemon(c, r=0.075, col=C(252, 222, 70), d=(0, 0, 1)):
    with oriented(c, d):
        lathe([(0, -r * 1.35), (r * 0.35, -r * 1.15), (r * 0.9, -r * 0.5), (r, 0), (r * 0.9, r * 0.5), (r * 0.35, r * 1.15), (0, r * 1.35)],
              (0, 0, 0), col, n=9, rough=0.4)


def peach(c, r=0.085, col=C(250, 158, 110), blush=C(236, 96, 90)):
    with at(c, rz=25):
        ell((0, 0, 0), (r, r * 0.95, r * 0.95), col, seg=9, ring=6)
        ell((r * 0.35, -r * 0.4, r * 0.15), (r * 0.6, r * 0.55, r * 0.6), blush, seg=7, ring=5)
        box((0.01, r * 0.2, r * 1.6), (0, -r * 0.92, 0.0), tuple(x * 0.85 for x in col))
        stalk([(0, 0, r * 0.85), (0, 0, r * 1.1)], 0.012, 0.01, BROWN, n=4, rings=2)
        leaf((0, 0, r * 1.05), 30, r * 1.3, r * 0.6, 25, LEAF, droop=0.2)


def cherries(c, r=0.05, col=C(206, 30, 50)):
    top = P(c) + P(0, 0, 0.14)
    for s in (-1, 1):
        b = P(c) + P(s * 0.05, 0, 0)
        stalk([top, (top + b) * 0.5 + P(s * 0.03, 0, 0.02), b + P(0, 0, r * 0.8)], 0.01, 0.008, LEAF_D, n=4, rings=4)
        ell(b, (r, r, r * 0.92), col, seg=8, ring=6, rough=0.3)
    leaf(top, 40, 0.1, 0.05, 30, LEAF, droop=0.2)


def avocado(c, d=(0, 0, -1), r=0.08, col=C(70, 100, 50)):
    with oriented(c, d):
        lathe([(0.02, 0), (r * 0.55, r * 0.3), (r * 0.7, r * 0.9), (r, r * 1.6), (r * 0.8, r * 2.1), (0, r * 2.25)], (0, 0, 0), col, n=9, rough=0.6)


def plum(c, r=0.07, col=C(128, 60, 120)):
    with at(c):
        ell((0, 0, 0), (r * 0.95, r, r * 1.05), col, seg=9, ring=6, rough=0.35)
        box((0.008, r * 0.2, r * 1.5), (0, -r * 0.97, 0), tuple(x * 0.8 for x in col))


def olives(c, col=C(110, 120, 60), n=4):
    for i in range(n):
        a = i * 2.2
        ell(P(c) + P(0.04 * math.cos(a), 0.04 * math.sin(a), -0.03 * i), (0.032, 0.032, 0.042), col if i % 2 else C(70, 60, 64), seg=7, ring=5, rough=0.3)
    leaf(c, 200, 0.14, 0.05, 20, C(150, 170, 140), shape=LANCE)


def kiwi(c, r=0.07, col=C(150, 110, 70)):
    with at(c, rz=25):
        ell((0, 0, 0), (r * 1.25, r, r), col, seg=9, ring=6, rough=0.95)
        ell((-r * 1.22, 0, 0), (0.012, r * 0.35, r * 0.35), C(170, 210, 90), seg=6, ring=4)


def bananas(c, n=5, col=C(250, 214, 70)):
    with at(c):
        for i in range(n):
            a = (i - (n - 1) / 2) * 16
            with at((0, 0, 0), rz=a):
                tube([(0, 0, 0.0), (0, -0.06, -0.08), (0, -0.16, -0.12), (0, -0.25, -0.08)], lambda t: 0.035 * (1 - 0.4 * abs(t - 0.5) * 2) + 0.006,
                     col, rings=8, n=5, side=(1, 0, 0))
                ell((0, -0.25, -0.08), 0.014, C(90, 70, 50), seg=5, ring=3)
        cyl(0.04, 0.08, (0, 0.02, -0.02), C(150, 160, 70), n=6)


def coconut(c, r=0.11, col=C(120, 84, 56), green=False):
    with at(c):
        ell((0, 0, 0), (r, r, r * 1.05), C(118, 160, 64) if green else col, seg=10, ring=7, rough=0.85)
        if not green:
            for a in (0, 120, 240):
                ell((r * 0.3 * math.cos(math.radians(a)), r * 0.3 * math.sin(math.radians(a)), r * 0.98), 0.018, C(70, 48, 36), seg=5, ring=3)


def melon(c, s=1.0, kind="cantaloupe"):
    with at(c, s=s, rz=25):
        if kind == "watermelon":
            g = Gourd([(0, 0), (0.15, 0.01), (0.25, 0.08), (0.28, 0.2), (0.25, 0.33), (0.14, 0.4), (0, 0.41)], 10, 0.02)
            with at((-0.2, 0, 0.27), ry=90):
                g.build(C(84, 150, 70), rough=0.4)
                g.stripes(C(46, 100, 50), w=0.06, z0=0.02, z1=0.98)
        else:
            g = Gourd([(0, 0.02), (0.18, 0), (0.27, 0.08), (0.3, 0.2), (0.27, 0.33), (0.15, 0.4), (0, 0.39)], 10, 0.05)
            g.build(C(214, 180, 110))
            g.speckles(C(236, 220, 170), 60, 0.022, z0=0.08, z1=0.92)
            with at((0, 0, 0.39)):
                gourds.stem("curly")


def bundle(stems, col_stem, top_fn, tie=TWINE, h=0.32, spread=0.035):
    """A tied bunch (herbs, asparagus, scallions): stems fanning up from a twine tie."""
    r = rng(4)
    for i in range(stems):
        a = i * 2.4
        rr = spread * math.sqrt(i + 0.5)
        b = P(rr * math.cos(a), rr * math.sin(a), 0.02)
        tip = P(rr * math.cos(a) * 2.6, rr * math.sin(a) * 2.6, h * r.uniform(0.85, 1.05))
        stalk([b, (b + tip) * 0.5, tip], 0.014, 0.012, col_stem, n=5, rings=3)
        top_fn(tip, (tip - b).normalized(), i)
    torus(spread * 2.4, 0.02, (0, 0, h * 0.3), tie, n=10, k=4)
