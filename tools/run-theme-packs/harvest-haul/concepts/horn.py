"""Cornucopias: a woven horn (tapering curled tube + weave bands) in 3 sizes and
2 trims, free-mixing fill pieces, and filled examples built only from them."""
import math

from hh import *  # noqa: F401,F403
import crops
import gourds

WICKER = C(214, 168, 102)
WICKER_D = C(176, 128, 74)
INNER = C(92, 60, 40)
GOLD_M = dict(rough=0.35, metal=0.6)

# horn centreline in local space: mouth at -x, tail curls up behind at +x
CTRL = [(-0.5, 0.0, 0.42), (-0.2, 0.0, 0.31), (0.15, 0.0, 0.23), (0.45, 0.0, 0.2), (0.68, 0.0, 0.3),
        (0.75, 0.0, 0.5), (0.63, 0.0, 0.62), (0.5, 0.0, 0.57)]
YAW = 60  # turns the mouth toward the front-left of the 3/4 camera


def prof(t):
    return 0.37 * (1 - t) ** 1.3 + 0.025


def horn_shell(trim="wicker"):
    N = 26
    pts = spline(CTRL, N)
    tube(CTRL, prof, WICKER, rings=N, n=10)
    band = GOLD if trim == "gold" else WICKER_D
    for k in range(1, N - 2):
        t = k / (N - 1)
        tg = (pts[k + 1] - pts[k - 1]).normalized()
        gold_band = trim == "gold" and k in (6, 13, 19)
        if not gold_band and k % 2:
            continue
        with oriented(pts[k], tg):
            with at((0, 0, 0), rz=18 * k):
                if gold_band:
                    torus(prof(t) * 1.02, 0.03, (0, 0, 0), GOLD, n=12, k=4, **GOLD_M)
                else:
                    torus(prof(t) * 0.99, 0.02, (0, 0, 0), band, n=10, k=4)
    # mouth: rim + dark inside
    t0 = (pts[0] - pts[1]).normalized()
    r0 = prof(0)
    with oriented(pts[0], t0):
        torus(r0 * 1.0, 0.045, (0, 0, 0), GOLD if trim == "gold" else WICKER_D, n=14, k=5, **(GOLD_M if trim == "gold" else {}))
        ell((0, 0, 0.004), (r0 * 0.92, r0 * 0.92, 0.012), INNER, seg=12, ring=4)
    # curly tail tip
    with oriented(pts[-1], (pts[-1] - pts[-2]).normalized()):
        ell((0, 0, 0.0), 0.035, band if trim == "gold" else WICKER_D, seg=6, ring=4, **(GOLD_M if trim == "gold" else {}))
    if trim == "gold":
        # bow at the waist
        p = pts[9]
        with at(p + P(0, -prof(9 / 25) - 0.02, 0.05), rx=90):
            for sgn in (-1, 1):
                ell((sgn * 0.07, 0, 0), (0.07, 0.035, 0.03), RED, seg=6, ring=4, rz=sgn * 15)
            ell((0, 0, 0.0), 0.03, RED, seg=6, ring=4)
    return pts[0], t0, r0


def horn(s=1.0, trim="wicker"):
    with at((0, 0, 0), rz=YAW, s=s):
        horn_shell(trim)


# ---------------------------------------------------------------- fill pieces (each on the ground at the origin)

def grapes(col=PLUM):
    r = 0.045
    k = 0
    for row, n in enumerate((4, 3, 3, 2, 1)):
        z = 0.24 - row * 0.05
        for i in range(n):
            a = i * 2 * math.pi / n + row * 0.6
            rr = 0.045 * (n - 1) / 2 + (0.01 if n > 1 else 0)
            ell((rr * math.cos(a), rr * math.sin(a), z), r, col if (k % 3) else tuple(c * 0.85 for c in col), seg=8, ring=6, rough=0.35)
            k += 1
    stalk([(0, 0, 0.26), (0.01, 0, 0.32), (0.04, 0, 0.35)], 0.012, 0.01, BROWN, n=4, rings=4)
    leaf((0.01, 0, 0.3), 200, 0.16, 0.14, 20, LEAF, shape=HEART, droop=0.2)


def wheat_bunch():
    for i, y in enumerate((-0.05, -0.025, 0.0, 0.025, 0.05)):
        b = P(-0.2, y * 1.6, 0.03)
        tip = P(0.18, y * 3, 0.06 + 0.01 * (i % 2))
        stalk([b, (b + tip) * 0.5, tip], 0.012, 0.01, C(226, 186, 90), n=4, rings=3)
        crops.wheat_head(tip, (1, y * 2, 0.15), C(240, 200, 100), L=0.14, s=1.0)
    with oriented((-0.06, 0, 0.04), (1, 0, 0)):
        torus(0.045, 0.014, (0, 0, 0), RED, n=8, k=4)


def pear(col=C(206, 210, 96)):
    lathe([(0, 0), (0.05, 0.0), (0.085, 0.04), (0.09, 0.08), (0.06, 0.13), (0.045, 0.18), (0.03, 0.2), (0, 0.21)], (0, 0, 0), col, n=9, rough=0.5)
    stalk([(0, 0, 0.2), (0.005, 0, 0.24), (0.02, 0, 0.27)], 0.01, 0.007, BROWN, n=4, rings=3)
    ell((0.06, -0.06, 0.07), (0.035, 0.02, 0.04), C(226, 150, 70), seg=6, ring=4, rz=-45)


def acorn(loc, rz=0, lay=False):
    with at(loc, rz=rz, ry=80 if lay else 0):
        lathe([(0, 0), (0.03, 0.005), (0.042, 0.04), (0.04, 0.07), (0, 0.075)], (0, 0, 0), C(196, 140, 80), n=8)
        lathe([(0.044, 0.06), (0.05, 0.08), (0.03, 0.1), (0, 0.1)], (0, 0, 0), C(130, 96, 64), n=8)
        cyl(0.008, 0.03, (0, 0, 0.095), C(110, 80, 56), n=4)


def nuts():
    acorn((0, 0, 0))
    acorn((0.09, 0.04, 0.042), rz=40, lay=True)
    with at((-0.08, 0.05, 0.045)):
        ell((0, 0, 0), (0.05, 0.045, 0.045), C(170, 126, 80), seg=8, ring=6)
        torus(0.047, 0.006, (0, 0, 0), C(150, 106, 66), n=10, k=3, rx=90)


MAPLE = [(0, 0.18), (0.03, 0.1), (0.08, 0.13), (0.07, 0.07), (0.16, 0.09), (0.11, 0.03), (0.13, -0.01), (0.05, -0.01),
         (0.02, -0.05), (0, -0.03), (-0.02, -0.05), (-0.05, -0.01), (-0.13, -0.01), (-0.11, 0.03), (-0.16, 0.09),
         (-0.07, 0.07), (-0.08, 0.13), (-0.03, 0.1)]


def maple_leaf(col=C(222, 92, 44)):
    with at((0, 0, 0.02), rx=-90 + 10, rz=25):
        slab(MAPLE, 0.016, (0, 0, 0), col)
        tube([(0, 0, -0.03), (0.0, 0, -0.08), (0.02, 0, -0.11)], lambda t: 0.007, BROWN, rings=3, n=3)


def mini_pumpkin():
    gourds.gourd("flat", "orange", "tall", s=0.26)


def mini_gourd():
    gourds.gourd("pear", "speckled", "curly", s=0.36, rz=60)


def corn_piece():
    crops.cob((-0.15, 0, 0.065), (1, -0.15, 0.08), L=0.3, peeled=0.75, silk=None)


def apple_piece(col=RED):
    crops.apple_fruit((0, 0, 0.075), 0.09, col, leafy=True)


FILL = [("mini pumpkin", mini_pumpkin), ("pear gourd", mini_gourd), ("corn", corn_piece), ("apple", apple_piece),
        ("grapes", grapes), ("wheat", wheat_bunch), ("pear", pear), ("nuts", nuts), ("maple leaf", maple_leaf)]
F = dict(FILL)


def place(name, loc, rz=0.0, s=1.0, **kw):
    with at(loc, rz=rz, s=s):
        F[name](**kw)


# ---------------------------------------------------------------- filled examples (only the parts above)

K = 1.6  # fill pieces are drawn a touch oversize next to the horn: toy proportions

SPILL = {
    0: [("apple", (-0.5, 0.08, 0.2), 0), ("grapes", (-0.48, -0.14, 0.1), -60), ("apple", (-0.78, 0.22, 0), 40),
        ("nuts", (-0.86, -0.16, 0), 0), ("maple leaf", (-1.08, 0.04, 0), -20)],
    1: [("mini pumpkin", (-0.52, 0.06, 0.14), 0), ("corn", (-0.5, -0.12, 0.3), 200), ("grapes", (-0.45, 0.22, 0.18), -90),
        ("apple", (-0.82, -0.2, 0), 0), ("pear", (-0.9, 0.18, 0), 0), ("mini pumpkin", (-1.12, -0.02, 0), 50),
        ("nuts", (-0.66, 0.42, 0), 30), ("maple leaf", (-1.25, -0.34, 0), 10)],
    2: [("wheat", (-0.38, 0.0, 0.5), 190), ("mini pumpkin", (-0.55, 0.04, 0.1), 0), ("pear gourd", (-0.5, -0.22, 0.16), 0),
        ("grapes", (-0.45, 0.24, 0.16), -90), ("apple", (-0.86, -0.26, 0), 0), ("corn", (-0.95, 0.14, 0), 150),
        ("pear", (-0.75, 0.42, 0), 0), ("mini pumpkin", (-1.2, -0.08, 0), 50), ("apple", (-1.1, -0.46, 0), 50, C(232, 150, 60)),
        ("nuts", (-0.62, -0.5, 0), 30), ("maple leaf", (-1.4, 0.16, 0), 10), ("maple leaf", (-1.05, 0.5, 0), 70, MUSTARD)],
}


def filled(kind):
    s, trim = {0: (0.75, "wicker"), 1: (1.0, "wicker"), 2: (1.3, "gold")}[kind]
    with at((0, 0, 0), rz=YAW):
        with at((0, 0, 0), s=s):
            horn_shell(trim)
        # local frame: mouth faces -x; the spill runs out along -x
        for it in SPILL[kind]:
            name, (x, y, z), rz = it[:3]
            kw = {"col": it[3]} if len(it) > 3 else {}
            place(name, (x * s, y * s, z * s), rz=rz, s=s * K, **kw)


def fill_cell(f):
    with at((0, 0, 0), s=K):
        f()


def rows():
    return [
        ("Horn sizes (wicker)", [("small", lambda: horn(0.75)), ("medium", lambda: horn(1.0)), ("large", lambda: horn(1.3))]),
        ("Trims", [("wicker", lambda: horn(1.0)), ("gold trim + bow", lambda: horn(1.0, "gold"))]),
        ("Fill pieces: produce (mix freely)", [(n, (lambda f=f: fill_cell(f))) for n, f in FILL[:5]]),
        ("Fill pieces: extras", [(n, (lambda f=f: fill_cell(f))) for n, f in FILL[5:]]),
        ("Filled examples (built only from the pieces above)", [("small", lambda: filled(0)), ("medium", lambda: filled(1)), ("large, gold", lambda: filled(2))]),
    ]
