"""Harvest props + the scarecrow kit (post + head + hat + outfit)."""
import math

from hh import *  # noqa: F401,F403
import crops
import gourds

RIBBON = {0: (BLUE, C(60, 96, 156)), 1: (RED, C(150, 44, 36)), 2: (C(246, 226, 160), MUSTARD)}
WICKER = C(214, 168, 102)
WICKER_D = C(176, 128, 74)
METAL = C(176, 184, 186)
TWINE = C(196, 150, 96)
BURLAP = C(214, 184, 138)
TERRA = C(206, 112, 72)


# ---------------------------------------------------------------- prize rosettes

def rosette_flat(place, s=1.0):
    """Prize rosette in local xy, facing +z, tails hanging toward -y."""
    a, b = RIBBON[place]
    with at((0, 0, 0), s=s):
        for x in (-0.05, 0.05):
            with at((x * 0.6, -0.12, -0.004), rz=(-12 if x < 0 else 12)):
                box((0.09, 0.26, 0.012), (0, -0.04, 0), a, bevel=0.004)
                box((0.09, 0.012, 0.012), (0, -0.17, 0), a)
        lathe([(0, 0), (0.2, 0.0), (0.21, 0.015), (0.12, 0.03), (0, 0.03)], (0, 0, 0.0), a, n=20, lobes=10, lobe_depth=0.25)
        lathe([(0, 0.02), (0.13, 0.02), (0.135, 0.04), (0, 0.045)], (0, 0, 0), b, n=16, lobes=8, lobe_depth=0.2)
        cyl(0.08, 0.03, (0, 0, 0.04), CREAM, n=10)
        # place number as pips
        for k in range(place + 1):
            ell(((k - place / 2) * 0.04, 0, 0.075), 0.014, b, seg=6, ring=4)


def ribbon_stand(place):
    with at((0, 0, 0), rz=25):
        box((0.36, 0.2, 0.05), (0, 0.02, 0.025), WOOD_D, bevel=0.012)
        box((0.3, 0.04, 0.5), (0, 0.08, 0.3), WOOD, bevel=0.012)
        with at((0, 0.05, 0.4), rx=90):
            rosette_flat(place)


# ---------------------------------------------------------------- soil plots

def _bed(col, top=0.16):
    box((1.1, 1.1, top), (0, 0, top / 2), col, bevel=0.03)
    for i, (sx, sy, x, y) in enumerate(((1.24, 0.08, 0, -0.58), (1.24, 0.08, 0, 0.58), (0.08, 1.08, -0.58, 0), (0.08, 1.08, 0.58, 0))):
        box((sx, sy, top + 0.06), (x, y, (top + 0.06) / 2), WOOD if i % 2 else WOOD_D, bevel=0.015)
    for x in (-0.58, 0.58):
        for y in (-0.58, 0.58):
            box((0.11, 0.11, top + 0.1), (x, y, (top + 0.1) / 2), WOOD_D, bevel=0.015)


def _ridges(col, top=0.16):
    for y in (-0.36, -0.12, 0.12, 0.36):
        with at((-0.5, y, top - 0.01), s=(1, 1, 0.65)):
            cyl(0.085, 1.0, (0, 0, 0), col, n=6, ry=90)


def plot(state):
    with at((0, 0, 0), rz=25):
        if state == "dry":
            _bed(C(196, 152, 104))
            r = rng(3)
            for k in range(5):
                x, y = r.uniform(-0.35, 0.35), r.uniform(-0.35, 0.35)
                a = r.uniform(0, 180)
                for j in range(3):
                    with at((x, y, 0.16), rz=a + j * 50):
                        box((0.16, 0.018, 0.012), (0.08, 0, 0), C(150, 108, 72))
            for k in range(6):
                ell((r.uniform(-0.45, 0.45), r.uniform(-0.45, 0.45), 0.17), r.uniform(0.025, 0.04), C(170, 160, 150), seg=6, ring=4)
            for k in range(2):
                x, y = r.uniform(-0.4, 0.4), r.uniform(-0.4, 0.4)
                for j in range(4):
                    leaf((x, y, 0.16), j * 90 + 20, 0.1, 0.03, 60, DRY, shape=STRAP)
        elif state == "tilled":
            _bed(SOIL)
            _ridges(C(150, 104, 72))
        elif state == "watered":
            _bed(SOIL_WET)
            _ridges(C(112, 76, 56))
            for x, y, sx in ((-0.2, -0.24, 0.16), (0.22, 0.0, 0.12), (0.0, 0.25, 0.1)):
                ell((x, y, 0.165), (sx, 0.06, 0.012), C(130, 168, 196), seg=10, ring=4, rough=0.1)
            for x, y in ((0.3, -0.3), (-0.3, 0.3)):
                ell((x, y, 0.2), (0.012, 0.012, 0.022), C(130, 168, 196), rough=0.1, seg=6, ring=4)
        elif state == "planted":
            _bed(SOIL)
    if state == "planted":
        with at((0, 0, 0.12)):
            crops.crop_carrot(4)


# ---------------------------------------------------------------- carry & store

def wheelbarrow(load=False):
    with at((0, 0, 0), rz=-30):
        # round toy tub
        with at((0.08, 0, 0.3)):
            lathe([(0.2, 0), (0.36, 0.22), (0.38, 0.27), (0.34, 0.27), (0.2, 0.05), (0, 0.05)], (0, 0, 0), RED, n=10, sx=1.3)
            lathe([(0.37, 0.25), (0.4, 0.27), (0.37, 0.3), (0.34, 0.27)], (0, 0, 0), C(150, 44, 36), n=10, sx=1.3, cap=False)
        # fat wheel at the front (-x)
        cyl(0.17, 0.12, (-0.5, 0.06, 0.17), C(70, 64, 62), n=10, rx=90)
        cyl(0.08, 0.14, (-0.5, 0.07, 0.17), MUSTARD, n=8, rx=90)
        for y in (-0.15, 0.15):
            tube([(-0.5, y * 0.55, 0.17), (-0.2, y, 0.27), (0.4, y, 0.32), (0.75, y * 1.25, 0.42)], lambda t: 0.035, WOOD_D, rings=8, n=6)
            with oriented((0.8, y * 1.25, 0.44), (1, 0, 0.25)):
                cyl(0.045, 0.14, (0, 0, -0.05), DARK, n=6)
            box((0.07, 0.07, 0.3), (0.32, y, 0.15), WOOD_D, bevel=0.015)
        if load:
            for x, y, sc in ((-0.1, -0.08, 0.38), (0.22, 0.06, 0.42), (0.04, 0.16, 0.32)):
                with at((x, y, 0.33)):
                    gourds.gourd("round", "orange", "stub", s=sc)


def basket(kind, fill=None):
    with at((0, 0, 0), rz=25):
        if kind == "bushel":
            lathe([(0.2, 0), (0.29, 0.32), (0.26, 0.32), (0.18, 0.03), (0, 0.03)], (0, 0, 0), WICKER, n=12)
            for z, r in ((0.0, 0.2), (0.12, 0.234), (0.24, 0.268), (0.32, 0.29)):
                torus(r, 0.018, (0, 0, z), WICKER_D, n=12, k=4)
            for sgn in (-1, 1):
                torus(0.06, 0.018, (sgn * 0.28, 0, 0.27), WICKER_D, n=8, k=4, rx=90, ry=sgn * -20)
            top, R = 0.3, 0.26
        elif kind == "handle":
            lathe([(0.17, 0), (0.24, 0.2), (0.22, 0.2), (0.16, 0.03), (0, 0.03)], (0, 0, 0), WICKER, n=12, sx=1.15)
            for z in (0.07, 0.14):
                torus(0.2 + z * 0.3, 0.015, (0, 0, z), WICKER_D, n=12, k=4)
            with at((0, 0, 0.2), s=(1.15, 1, 1)):
                torus(0.24, 0.02, (0, 0, 0), WICKER_D, n=12, k=4)
            torus(0.25, 0.022, (0, 0, 0.2), WICKER_D, n=12, k=4, rx=90, arc=180)
            top, R = 0.18, 0.2
        else:  # trug: long shallow
            with at((0, 0, 0), s=(1.7, 1, 1)):
                lathe([(0.14, 0), (0.22, 0.13), (0.2, 0.13), (0.13, 0.025), (0, 0.025)], (0, 0, 0), WOOD_L, n=10)
                torus(0.215, 0.014, (0, 0, 0.13), WOOD, n=10, k=4)
            torus(0.3, 0.02, (0, 0, 0.12), WOOD, n=12, k=4, rx=90, arc=180)
            top, R = 0.1, 0.18
        if fill == "apples":
            for x, y, z in ((0, 0, 0.0), (0.12, 0.06, -0.01), (-0.1, 0.08, -0.01), (0.05, -0.12, -0.01), (-0.08, -0.08, 0.0), (0.0, 0.03, 0.09)):
                crops.apple_fruit((x * R / 0.22, y * R / 0.22, top + z), 0.085, RED if (x + y) > -0.1 else C(232, 150, 60), rz=x * 900)
        elif fill == "potatoes":
            for k, (x, y) in enumerate(((0, 0), (0.1, 0.06), (-0.1, 0.04), (0.04, -0.1), (-0.06, -0.08))):
                crops.potato((x, y, top + 0.02 * (k == 0)), 0.07, seed=k, rz=k * 50)
        elif fill == "carrots":
            for k, y in enumerate((-0.08, 0.0, 0.08)):
                with at((0.1, y, top + 0.05), rz=180 + (k - 1) * 8):
                    with at((0, 0, 0), ry=80):
                        crops.carrot_root((0, 0, 0), L=0.3, r=0.055, d=(0, 0, -1))
                    for i in range(3):
                        crops.frond((0, 0, 0), i * 120 + 30, 0.2, C(96, 164, 70), lean=60)


def crate(fill=None):
    W, D, H = 0.66, 0.44, 0.34
    with at((0, 0, 0), rz=25):
        box((W - 0.04, D - 0.04, 0.04), (0, 0, 0.03), WOOD_D)
        for x in (-W / 2 + 0.03, W / 2 - 0.03):
            for y in (-D / 2 + 0.03, D / 2 - 0.03):
                box((0.06, 0.06, H), (x, y, H / 2), WOOD_D, bevel=0.008)
        for z in (0.07, 0.18, 0.29):
            for y in (-D / 2 + 0.01, D / 2 - 0.01):
                box((W - 0.04, 0.03, 0.075), (0, y, z), WOOD, bevel=0.008)
            for x in (-W / 2 + 0.01, W / 2 - 0.01):
                box((0.03, D - 0.04, 0.075), (x, 0, z), WOOD, bevel=0.008)
        # hand hole on the ends
        for x in (-W / 2 - 0.006, W / 2 + 0.006):
            box((0.02, 0.12, 0.035), (x, 0, 0.29), DARK)
        if fill == "apples":
            for i in range(3):
                for j in range(2):
                    crops.apple_fruit(((i - 1) * 0.19, (j - 0.5) * 0.19, H - 0.02), 0.09, RED if (i + j) % 3 else C(232, 150, 60), rz=i * 70 + j * 40)
            crops.apple_fruit((0.05, 0.0, H + 0.1), 0.09, RED)
        elif fill == "pumpkins":
            for x, y, s in ((-0.15, -0.05, 0.36), (0.15, 0.05, 0.4)):
                with at((x, y, H - 0.1)):
                    gourds.gourd("round", "orange", "stub", s=s)
            with at((0.02, -0.12, H - 0.06)):
                gourds.gourd("flat", "ghost white", "curly", s=0.25)
        elif fill == "corn":
            for k in range(5):
                crops.cob((-0.24, (k - 2) * 0.075, H - 0.02 + 0.03 * (k % 2)), (1, 0.05 * (k - 2), 0.1), L=0.36, peeled=0.7 if k % 2 else 0.0, silk=None)


# ---------------------------------------------------------------- hay + fences

def hay(kind):
    with at((0, 0, 0), rz=25):
        if kind == "round":
            with at((0, -0.35, 0.46)):
                cyl(0.46, 0.7, (0, 0, 0), STRAW, n=12, rx=-90)
                for y in (0.0, 0.7):
                    for r in (0.12, 0.24, 0.36):
                        torus(r, 0.02, (0, y + (0.005 if y else -0.005), 0), STRAW_D, n=12, k=4, rx=90)
                for y in (0.2, 0.5):
                    torus(0.465, 0.018, (0, y, 0), TWINE, n=12, k=4, rx=90)
        elif kind == "square":
            _bale((0, 0, 0))
        else:
            _bale((-0.42, 0, 0))
            _bale((0.42, 0, 0), rz=4)
            _bale((0.0, 0.02, 0.42), rz=-6)
            _bale((-0.2, -0.55, 0), rz=90)


def _bale(loc, rz=0):
    with at(loc, rz=rz):
        box((0.8, 0.46, 0.42), (0, 0, 0.21), STRAW, bevel=0.05)
        for x in (-0.2, 0.2):
            box((0.04, 0.48, 0.44), (x, 0, 0.21), TWINE)
        r = rng(int(loc[0] * 10 + 5))
        for k in range(6):
            x = r.uniform(-0.35, 0.35)
            with at((x, r.choice((-0.23, 0.23)), r.uniform(0.08, 0.36))):
                cone(0.025, 0.08, (0, 0, 0), STRAW_D, n=4, rx=90 * (1 if r.random() < 0.5 else -1), rz=r.uniform(-30, 30))


def _post(x, y, h=0.72, col=WOOD_D):
    box((0.15, 0.15, h), (x, y, h / 2), col, bevel=0.025)
    cone(0.106, 0.09, (x, y, h), col, n=4, rz=45)


def _rail(a, b, z, col=WOOD):
    a, b = P(a), P(b)
    d = b - a
    ang = math.degrees(math.atan2(d.y, d.x))
    box((d.length, 0.08, 0.14), ((a.x + b.x) / 2, (a.y + b.y) / 2, z), col, bevel=0.025, rz=ang)


def fence(kind):
    with at((0, 0, 0), rz=10):
        if kind == "straight":
            _post(-0.5, 0)
            _post(0.5, 0)
            for z in (0.3, 0.6):
                _rail((-0.5, -0.06, 0), (0.5, -0.06, 0), z)
        elif kind == "corner":
            _post(0.45, 0.45)
            _post(-0.55, 0.45)
            _post(0.45, -0.55)
            for z in (0.3, 0.6):
                _rail((-0.55, 0.39, 0), (0.45, 0.39, 0), z)
                _rail((0.39, 0.45, 0), (0.39, -0.55, 0), z)
        else:
            _post(-0.57, 0, 0.88)
            _post(0.57, 0, 0.88)
            with at((-0.49, -0.02, 0), rz=-22):
                for z in (0.18, 0.66):
                    box((0.98, 0.08, 0.13), (0.49, 0, z), RED, bevel=0.02)
                for x in (0.05, 0.93):
                    box((0.12, 0.08, 0.6), (x, 0, 0.42), RED, bevel=0.02)
                box((0.98 * 1.05, 0.06, 0.11), (0.49, -0.01, 0.42), C(150, 44, 36), ry=-27, bevel=0.02)
                for z in (0.22, 0.64):
                    box((0.1, 0.07, 0.03), (0.0, -0.01, z), DARK)
                box((0.08, 0.06, 0.05), (0.98, -0.02, 0.55), DARK)


# ---------------------------------------------------------------- tools + market

def watering_can():
    with at((0, 0, 0), rz=-20):
        lathe([(0, 0), (0.19, 0), (0.21, 0.03), (0.21, 0.22), (0.17, 0.29), (0, 0.3)], (0, 0, 0), SAGE, n=10, rough=0.5)
        torus(0.21, 0.02, (0, 0, 0.04), C(120, 148, 96), n=10, k=4)
        torus(0.06, 0.014, (-0.04, 0, 0.3), C(120, 148, 96), n=8, k=4)
        ell((-0.04, 0, 0.3), (0.05, 0.05, 0.01), C(70, 90, 70), seg=8, ring=4)
        tube([(0.15, 0, 0.06), (0.27, 0, 0.16), (0.36, 0, 0.3), (0.39, 0, 0.36)], lambda t: 0.05 - 0.015 * t, SAGE, rings=8, n=6)
        with oriented((0.38, 0, 0.36), (0.6, 0, 0.8)):
            lathe([(0.035, 0), (0.08, 0.05), (0.085, 0.08), (0, 0.083)], (0, 0, 0), C(120, 148, 96), n=8)
        tube([(-0.2, 0, 0.08), (-0.3, 0, 0.18), (-0.24, 0, 0.38), (-0.04, 0, 0.36)], lambda t: 0.035, C(120, 148, 96), rings=10, n=6)


def scale(load=False):
    with at((0, 0, 0), rz=25):
        box((0.46, 0.34, 0.08), (0, 0, 0.04), RED, bevel=0.025)
        box((0.4, 0.28, 0.04), (0, 0, 0.1), C(150, 44, 36), bevel=0.01)
        cyl(0.045, 0.32, (0, 0.06, 0.1), C(150, 44, 36), n=8)
        # dial facing front
        with at((0, -0.0, 0.42), rx=90):
            cyl(0.17, 0.08, (0, 0, -0.04), RED, n=14)
            cyl(0.14, 0.02, (0, 0, 0.04), CREAM, n=14)
            torus(0.15, 0.015, (0, 0, 0.05), GOLD, n=14, k=4, rough=0.35, metal=0.6)
            for k in range(9):
                a = math.radians(-60 + k * 15 + 90)
                box((0.008, 0.03, 0.006), (0.115 * math.cos(a), 0.115 * math.sin(a), 0.063), DARK, rz=math.degrees(a) - 90)
            box((0.012, 0.11, 0.008), (0.02, 0.05, 0.066), RED, rz=-20 if load else 25)
            cyl(0.018, 0.012, (0, 0, 0.06), DARK, n=6)
        # pan
        cyl(0.03, 0.08, (0, 0.06, 0.59), GOLD, n=6, rough=0.35, metal=0.6)
        lathe([(0.0, 0.66), (0.08, 0.66), (0.26, 0.71), (0.26, 0.73), (0.23, 0.72), (0.08, 0.685), (0, 0.685)], (0, 0.06, 0), GOLD, n=12, rough=0.35, metal=0.6)
        if load:
            with at((0, 0.06, 0.66)):
                gourds.gourd("round", "orange", "curly", s=0.5)


def market_stall(stocked=True):
    with at((0, 0, 0), rz=20):
        # counter
        box((1.7, 0.7, 0.1), (0, 0, 0.78), WOOD, bevel=0.02)
        box((1.6, 0.04, 0.6), (0, -0.32, 0.43), WOOD_L, bevel=0.01)
        for x in (-0.55, 0, 0.55):
            box((0.48, 0.02, 0.44), (x, -0.345, 0.45), CREAM, bevel=0.01)
        for x in (-0.8, 0.8):
            for y in (-0.31, 0.31):
                box((0.08, 0.08, 1.9 if y > 0 else 1.75), (x, y, (1.9 if y > 0 else 1.75) / 2), WOOD_D, bevel=0.01)
        # striped awning, sloping to the front
        n = 8
        for i in range(n):
            x = -0.92 + (i + 0.5) * 1.84 / n
            box((1.84 / n, 0.9, 0.05), (x, -0.05, 1.86), RED if i % 2 == 0 else CREAM, rx=-9)
        for i in range(n):
            x = -0.92 + (i + 0.5) * 1.84 / n
            with at((x, -0.5, 1.78)):
                slab([(-0.115, 0.0), (0.115, 0.0), (0.09, -0.1), (0.0, -0.14), (-0.09, -0.1)], 0.03, (0, 0, 0), RED if i % 2 == 0 else CREAM)
        # sign board on top
        box((0.9, 0.06, 0.24), (0, 0.33, 2.08), MUSTARD, bevel=0.02)
        box((0.8, 0.07, 0.15), (0, 0.33, 2.08), CREAM)
        for x in (-0.25, 0.0, 0.25):
            ell((x, 0.29, 2.08), (0.045, 0.02, 0.045), [ORANGE, RED, LEAF][int((x + 0.25) / 0.25)], seg=8, ring=4)
        if stocked:
            for k, (x, fill) in enumerate(((-0.52, "pumpkins"), (0.0, "apples"), (0.52, "corn"))):
                with at((x, 0.0, 0.83), s=0.72):
                    with at((0, 0, 0), rz=-45):
                        crate(fill)
            with at((-0.62, -0.28, 0.0)):
                gourds.gourd("squat", "orange", "stub", s=0.55)
            with at((0.6, -0.5, 0.0)):
                basket("bushel", "apples")
            with at((0.2, -0.5, 0.0), s=0.6):
                hay("square")


# ---------------------------------------------------------------- scarecrow kit
NECK = 1.42


def post(kind="cross"):
    lean = 0 if kind == "cross" else 6
    with at((0, 0, 0), ry=lean):
        box((0.14, 0.14, NECK + 0.02), (0, 0.04, (NECK + 0.02) / 2), WOOD_D, bevel=0.025)
        box((0.98, 0.12, 0.13), (0, 0.04, 1.2), WOOD_D, bevel=0.025, ry=-3 if kind != "cross" else 0)
    lathe([(0.3, 0), (0.26, 0.05), (0.12, 0.09), (0, 0.1)], (0, 0, 0), SOIL, n=10)
    for k in range(4):
        a = k * 1.6
        ell((0.2 * math.cos(a), 0.2 * math.sin(a), 0.05), 0.03, C(170, 160, 150), seg=6, ring=4)


def _tuft(p, d, n=5, L=0.1, col=STRAW, spread=0.6):
    p, d = P(p), P(d).normalized()
    u, v = kit.frame(d, (0, 0, 1))
    for i in range(n):
        a = i * 2 * math.pi / n
        dd = (d + (u * math.cos(a) + v * math.sin(a)) * spread).normalized()
        with oriented(p, dd):
            cone(0.022, L, (0, 0, 0), col if i % 2 else STRAW_D, n=4)


def head(kind):
    """Builds a head on the neck; returns (hat z, head radius)."""
    z, r = _head(kind)
    return z * HK, r * HK


HK = 1.7  # chibi: big heads
LOOK = P(0.42, -0.9, 0.06).normalized()
BLUSH = C(255, 150, 150)


def _face(c, rad, size=0.034):
    face(P(c) + LOOK * rad, LOOK, size=size, blush=BLUSH)


def _head(kind):
    with at((0, 0, NECK - 0.03), s=HK):
        if kind == "sack":
            ell((0, 0, 0.21), (0.21, 0.19, 0.22), BURLAP, seg=10, ring=7)
            torus(0.085, 0.02, (0, 0, 0.03), TWINE, n=8, k=4)
            _tuft((0, 0, 0.02), (0, 0, -1), 6, 0.12, spread=0.9)
            _face((0, 0, 0.19), 0.19)
            with at((0, 0, 0), rz=-40):
                box((0.07, 0.02, 0.06), (-0.12, -0.15, 0.3), C(186, 150, 104), rx=-20, rz=-30, bevel=0.005)
            return 0.4, 0.2
        if kind == "pumpkin":
            with at((0, 0, -0.02)):
                gourds.carved("happy", s=0.48)
            return 0.36, 0.3
        if kind == "turnip":
            lathe([(0, -0.03), (0.04, 0.0), (0.16, 0.08), (0.2, 0.2), (0.17, 0.32), (0.1, 0.38), (0, 0.39)], (0, 0, 0), CREAM, n=10)
            lathe([(0.193, 0.24), (0.17, 0.32), (0.1, 0.38), (0, 0.395)], (0, 0, 0.003), C(150, 70, 140), n=10)
            tube([(0, 0, 0.0), (0.0, 0, -0.06), (0.03, 0, -0.1)], lambda t: 0.02 * (1 - t), CREAM, rings=4, n=4)
            for i in range(4):
                leaf((0, 0, 0.38), i * 90 + 30, 0.16, 0.1, 50, LEAF, droop=0.25, shape=ROUND)
            _face((0, 0, 0.15), 0.19)
            return 0.38, 0.17
        if kind == "straw":
            ell((0, 0, 0.2), (0.2, 0.19, 0.21), STRAW, seg=10, ring=7)
            for z in (0.1, 0.3):
                torus(0.19 * (1 - abs(z - 0.2) * 2.4), 0.014, (0, 0, z), TWINE, n=10, k=4)
            _tuft((0, 0, 0.4), (0, 0, 1), 7, 0.12, spread=1.0)
            _tuft((0, 0, 0.02), (0, 0, -1), 6, 0.1, spread=0.9)
            _face((0, 0, 0.19), 0.2)
            return 0.4, 0.19
        if kind == "bucket":
            lathe([(0.2, 0.0), (0.15, 0.36), (0.0, 0.36)], (0, 0, 0), METAL, n=10, rough=0.4, metal=0.5)
            for z, r in ((0.02, 0.2), (0.3, 0.158)):
                torus(r, 0.014, (0, 0, z), C(140, 148, 150), n=10, k=4, rough=0.4, metal=0.5)
            torus(0.21, 0.01, (0, 0, 0.05), C(110, 116, 118), n=12, k=4, rx=-75, arc=180, metal=0.5)
            _face((0, 0, 0.17), 0.175, size=0.03)
            return 0.36, 0.16


def hat(kind, z, r):
    k = r / 0.2
    with at((0, 0, NECK - 0.03 + z - 0.03 * k), s=k):
        if kind == "sun hat":
            lathe([(0.36, 0.0), (0.36, 0.02), (0.2, 0.05), (0, 0.05)], (0, 0, 0), STRAW, n=12, lobes=6, lobe_depth=0.04, rx=-6)
            lathe([(0.18, 0.02), (0.17, 0.14), (0.1, 0.17), (0, 0.17)], (0, 0, 0), STRAW, n=10, rx=-6)
            with at((0, 0, 0), rx=-6):
                torus(0.177, 0.025, (0, 0, 0.05), RED, n=10, k=4)
                leaf((0.15, -0.08, 0.07), -40, 0.1, 0.05, 30, MUSTARD)
        elif kind == "pointy":
            lathe([(0.3, 0.0), (0.3, 0.02), (0, 0.025)], (0, 0, 0), C(110, 84, 64), n=10, ry=5)
            tube([(0, 0, 0.0), (0, 0, 0.18), (0.04, 0, 0.34), (0.16, 0, 0.4)], lambda t: 0.17 * (1 - t) + 0.01, C(110, 84, 64), rings=9, n=10)
            with at((0, 0, 0), rz=25):
                box((0.07, 0.03, 0.07), (0.1, -0.08, 0.1), C(220, 160, 70), rx=-20, rz=40, bevel=0.005)
            torus(0.165, 0.022, (0, 0, 0.04), MUSTARD, n=10, k=4)
        elif kind == "top hat":
            lathe([(0.28, 0.0), (0.28, 0.02), (0.15, 0.03), (0, 0.03)], (0, 0, 0), C(66, 56, 60), n=12)
            cyl(0.15, 0.32, (0, 0, 0.02), C(66, 56, 60), n=10, r2=0.165)
            cyl(0.155, 0.06, (0, 0, 0.04), RED, n=10)
            leaf((0.05, -0.15, 0.08), 70, 0.16, 0.04, 70, STRAW_D, shape=STRAP)
        elif kind == "flat cap":
            lathe([(0.2, 0.0), (0.2, 0.05), (0.15, 0.1), (0, 0.11)], (0, 0, 0), SAGE, n=10, sy=1.05)
            with at((0, 0, 0.03), rz=25):
                with at((0, -0.17, 0), rx=-8):
                    box((0.26, 0.16, 0.03), (0, -0.04, 0), C(120, 148, 96), bevel=0.012)
            ell((0, 0, 0.11), 0.03, C(120, 148, 96), seg=6, ring=4)
        elif kind == "flower pot":
            lathe([(0.14, 0.0), (0.19, 0.0), (0.19, 0.05), (0.17, 0.06), (0.13, 0.26), (0, 0.26)], (0, 0, 0), TERRA, n=10)
            stalk([(0, 0, 0.25), (0.0, 0, 0.33), (0.02, 0, 0.38)], 0.012, 0.01, LEAF)
            for yaw in (20, 200):
                leaf((0.02, 0, 0.38), yaw, 0.1, 0.08, 30, LEAF, shape=ROUND)


def outfit(kind):
    body = {"plaid shirt": RED, "overalls": CREAM, "long coat": MUSTARD, "sack tunic": BURLAP}[kind]
    sleeve = {"plaid shirt": RED, "overalls": C(232, 220, 196), "long coat": MUSTARD, "sack tunic": BURLAP}[kind]
    hem = {"long coat": 0.45, "sack tunic": 0.62}.get(kind, 0.72)
    prof = [(0.17, hem), (0.2, hem + 0.06), (0.21, 0.98), (0.24, 1.17), (0.17, 1.3), (0.06, NECK - 0.02), (0, NECK - 0.02)]
    if kind == "long coat":
        prof = [(0.26, hem), (0.25, hem + 0.05), (0.21, 0.98), (0.24, 1.17), (0.17, 1.3), (0.06, NECK - 0.02), (0, NECK - 0.02)]
    if kind == "sack tunic":
        prof = [(0.27, hem), (0.26, hem + 0.05), (0.22, 0.98), (0.24, 1.17), (0.17, 1.3), (0.06, NECK - 0.02), (0, NECK - 0.02)]
    lathe(prof, (0, 0.04, 0), body, n=10, sy=0.72)
    for sgn in (-1, 1):
        tube([(sgn * 0.15, 0.04, 1.2), (sgn * 0.3, 0.04, 1.18), (sgn * 0.42, 0.04, 1.17)], lambda t: 0.1 - 0.012 * t, sleeve, rings=5, n=8)
        _tuft((sgn * 0.44, 0.04, 1.17), (sgn, 0, -0.15), 5, 0.1)
    for i in range(7):
        a = math.radians(i * 360 / 7 + 10)
        rr = prof[0][0]
        with oriented((rr * math.cos(a), 0.04 + rr * 0.72 * math.sin(a), hem + 0.02), (math.cos(a) * 0.3, math.sin(a) * 0.3, -1)):
            cone(0.025, 0.12, (0, 0, 0), STRAW if i % 2 else STRAW_D, n=4)
    front = lambda z, rr: (rr * math.cos(math.radians(-65)), 0.04 + rr * 0.72 * math.sin(math.radians(-65)), z)  # noqa: E731
    if kind == "plaid shirt":
        for z in (0.82, 0.98, 1.12):
            torus(0.215 if z < 1.1 else 0.235, 0.018, (0, 0.04, z), C(130, 36, 30), n=10, k=4, sy=0.72) if False else \
                lathe([(0.212 if z < 1.1 else 0.236, z - 0.02), (0.216 if z < 1.1 else 0.24, z), (0.212 if z < 1.1 else 0.236, z + 0.02)],
                      (0, 0.04, 0), C(130, 36, 30), n=10, sy=0.72, cap=False)
        for sgn in (-1, 1):
            for x in (0.3, 0.44):
                torus(0.098, 0.014, (sgn * x * 0.85, 0.04, 1.18), C(130, 36, 30), n=8, k=4, ry=90)
        with oriented(front(1.05, 0.215), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            box((0.1, 0.09, 0.02), (0, 0, 0), C(232, 196, 120), bevel=0.005)
    elif kind == "overalls":
        lathe([(0.19, 0.7), (0.205, 0.76), (0.212, 0.98), (0.0, 0.98)], (0, 0.04, 0), C(96, 128, 160), n=10, sy=0.74)
        with oriented(front(1.04, 0.2), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            box((0.2, 0.16, 0.025), (0, 0, 0), C(96, 128, 160), bevel=0.006)
            for x in (-0.07, 0.07):
                ell((x, 0.07, 0.02), 0.018, MUSTARD, seg=6, ring=4)
        for sgn in (-1, 1):
            tube([(sgn * 0.08, -0.12, 1.1), (sgn * 0.11, -0.08, 1.28), (sgn * 0.1, 0.12, 1.3), (sgn * 0.08, 0.18, 1.1)], lambda t: 0.018, C(96, 128, 160), rings=8, n=4)
        with oriented(front(0.84, 0.21), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            box((0.09, 0.08, 0.02), (0.05, 0, 0), RED, bevel=0.005)
    elif kind == "long coat":
        for z in (0.7, 0.85, 1.0):
            with oriented(front(z, 0.235 - (z - 0.7) * 0.05), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
                ell((0, 0, 0.0), (0.022, 0.022, 0.012), C(120, 76, 50), seg=6, ring=4)
        lathe([(0.2, 1.24), (0.24, 1.28), (0.12, 1.36), (0.06, 1.38)], (0, 0.04, 0), C(196, 150, 40), n=10, sy=0.75, cap=False)
        with oriented(front(0.6, 0.255), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            box((0.1, 0.1, 0.02), (0.04, 0, 0), SAGE, bevel=0.005)
    elif kind == "sack tunic":
        lathe([(0.225, 0.9), (0.235, 0.93), (0.225, 0.96)], (0, 0.04, 0), TWINE, n=10, sy=0.74, cap=False)
        with oriented(front(0.93, 0.235), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            tube([(0, 0, 0), (0.02, -0.08, 0.01), (0.0, -0.16, 0.02)], lambda t: 0.012, TWINE, rings=4, n=4)
        with oriented(front(0.75, 0.262), (math.cos(math.radians(-65)), math.sin(math.radians(-65)), 0)):
            box((0.11, 0.09, 0.02), (-0.03, 0, 0), C(232, 150, 60), bevel=0.005)


def scarecrow(head_k="sack", hat_k="sun hat", outfit_k="plaid shirt", post_k="cross"):
    with at((0, 0, 0), rz=10):
        post(post_k)
        if outfit_k:
            outfit(outfit_k)
        if head_k:
            z, r = head(head_k)
            if hat_k:
                hat(hat_k, z, r)


HEADS = ["sack", "pumpkin", "turnip", "straw", "bucket"]
HATS = ["sun hat", "pointy", "top hat", "flat cap", "flower pot"]
OUTFITS = ["plaid shirt", "overalls", "long coat", "sack tunic"]
COMBOS = [("Classic", ("sack", "sun hat", "plaid shirt")), ("Spooky Jack", ("pumpkin", "pointy", "long coat")),
          ("Turnip Tom", ("turnip", "flat cap", "overalls")), ("Bucket Bert", ("bucket", "flower pot", "sack tunic")),
          ("Gentleman Straw", ("straw", "top hat", "long coat"))]


def _head_only(k):
    with at((0, 0, -NECK + 0.1), rz=10):
        head(k)
    box((0.14, 0.14, 0.12), (0, 0.04, 0.0), WOOD_D)


def _hat_only(k):
    with at((0, 0, -NECK + 0.03), rz=10):
        hat(k, 0.0, 0.2)
    with at((0, 0, -0.18)):
        ell((0, 0, 0.18), (0.19, 0.19, 0.08), C(232, 226, 214), seg=10, ring=4)


def scarecrow_rows():
    return [
        ("Posts", [("cross post", lambda: scarecrow(None, None, None, "cross")), ("leaning post", lambda: scarecrow(None, None, None, "lean"))]
         + [(f"outfit: {o}", (lambda o=o: scarecrow(None, None, o))) for o in OUTFITS]),
        ("Heads (snap to the neck)", [(h, (lambda h=h: _head_only(h))) for h in HEADS]),
        ("Hats (snap to the head top, scale to its radius)", [(h, (lambda h=h: _hat_only(h))) for h in HATS]),
        ("Combos (only parts from above)", [(n, (lambda c=c: scarecrow(*c))) for n, c in COMBOS]),
    ]


def rows():
    return [
        ("Soil plots", [("dry", lambda: plot("dry")), ("tilled", lambda: plot("tilled")), ("watered", lambda: plot("watered")),
                        ("tilled + crop mound", lambda: plot("planted"))]),
        ("Carry & store", [("wheelbarrow", wheelbarrow), ("wheelbarrow, loaded", lambda: wheelbarrow(True)), ("bushel basket", lambda: basket("bushel")),
                           ("bushel, apples", lambda: basket("bushel", "apples")), ("handle basket", lambda: basket("handle", "potatoes")),
                           ("trug, carrots", lambda: basket("trug", "carrots"))]),
        ("Crates", [("crate, empty", crate), ("crate, apples", lambda: crate("apples")), ("crate, pumpkins", lambda: crate("pumpkins")),
                    ("crate, corn", lambda: crate("corn"))]),
        ("Hay & fences", [("round bale", lambda: hay("round")), ("square bale", lambda: hay("square")), ("bale stack", lambda: hay("stack")),
                          ("fence straight", lambda: fence("straight")), ("fence corner", lambda: fence("corner")), ("fence gate", lambda: fence("gate"))]),
        ("Market", [("market stall, stocked", market_stall), ("market stall, bare", lambda: market_stall(False))]),
        ("Tools & awards", [("watering can", watering_can), ("weighing scale", scale), ("scale + pumpkin", lambda: scale(True)),
                            ("1st prize", lambda: ribbon_stand(0)), ("2nd prize", lambda: ribbon_stand(1)), ("3rd prize", lambda: ribbon_stand(2))]),
    ]
