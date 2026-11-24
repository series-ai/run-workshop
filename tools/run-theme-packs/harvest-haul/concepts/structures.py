"""Farm structures: barn, silo, shed, greenhouse (open frame, no glass), chicken
coop, wind pump, water tower, fences & gates, farm stand, compost bin, beehive.
Chunky toy proportions; a farmer kid is about 1.35 tall."""
import math

from hh import *  # noqa: F401,F403
import crops
import gourds
import props

GL = dict(rough=0.5)
MT = dict(metal=0.35, rough=0.35)
TRIM = C(248, 242, 228)
ROOF = C(96, 84, 92)
ROOF_R = C(150, 60, 50)
STEEL = C(176, 184, 190)
BARN = C(196, 62, 50)


def gable(w, d, h, z, col, over=0.12, t=0.08):
    """A pitched roof: two slabs meeting at a ridge, running along y."""
    a = math.atan2(h, w / 2)
    L = math.hypot(w / 2, h) + over
    for s in (-1, 1):
        with at((s * w / 4, 0, z + h / 2), ry=s * math.degrees(a)):
            box((L, d + over * 2, t), (0, 0, 0), col, bevel=0.02, **GL)
    box((0.08, d + over * 2 + 0.02, 0.1), (0, 0, z + h + 0.02), tuple(c * 0.85 for c in col), bevel=0.02)


def gable_wall(w, h, y, z, col, depth=0.06):
    slab([(-w / 2, 0), (w / 2, 0), (0, h)], depth, (0, y, z), col)


def x_door(w, h, loc, col=TRIM, back=BARN):
    x, y, z = loc
    box((w, 0.05, h), (x, y, z + h / 2), back, bevel=0.01)
    for (bx, bz, bw, bh) in ((0, h - 0.04, w, 0.08), (0, 0.04, w, 0.08), (-w / 2 + 0.04, h / 2, 0.08, h), (w / 2 - 0.04, h / 2, 0.08, h)):
        box((bw, 0.07, bh), (x + bx, y - 0.01, z + bz), col)
    for s in (-1, 1):
        L = math.hypot(w, h) - 0.1
        with at((x, y - 0.02, z + h / 2), ry=s * math.degrees(math.atan2(h, w))):
            box((L, 0.07, 0.07), (0, 0, 0), col)


def barn():
    W, D, H = 2.2, 2.4, 1.3
    with at((0, 0, 0), rz=25):
        box((W, D, H), (0, 0, H / 2), BARN, bevel=0.03, **GL)
        # gambrel roof: lower steep + upper shallow slopes
        for s in (-1, 1):
            with at((s * (W / 2 - 0.12), 0, H + 0.38), ry=s * 62):
                box((0.9, D + 0.24, 0.1), (0, 0, 0), ROOF, bevel=0.02, **GL)
            with at((s * 0.42, 0, H + 0.92), ry=s * 22):
                box((1.0, D + 0.24, 0.1), (0, 0, 0), ROOF, bevel=0.02, **GL)
        box((0.1, D + 0.26, 0.1), (0, 0, H + 1.12), C(80, 70, 78), bevel=0.02)
        for y in (-D / 2 + 0.02, D / 2 - 0.02):
            slab([(-W / 2 + 0.02, 0), (W / 2 - 0.02, 0), (W / 2 - 0.36, 0.72), (0, 1.06), (-W / 2 + 0.36, 0.72)], 0.06, (0, y, H), BARN)
        for y in (-D / 2 - 0.02,):
            # trim along the gambrel edge
            pts = [(-W / 2, H), (-W / 2 + 0.36, H + 0.72), (0, H + 1.06), (W / 2 - 0.36, H + 0.72), (W / 2, H)]
            for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
                L = math.hypot(x1 - x0, z1 - z0)
                with at(((x0 + x1) / 2, y - 0.01, (z0 + z1) / 2), ry=-math.degrees(math.atan2(z1 - z0, x1 - x0))):
                    box((L + 0.06, 0.06, 0.1), (0, 0, 0), TRIM)
            for x in (-W / 2 + 0.03, W / 2 - 0.03):
                box((0.1, 0.06, H), (x, y - 0.01, H / 2), TRIM)
        x_door(1.0, 1.0, (0, -D / 2 - 0.04, 0.0))
        x_door(0.42, 0.42, (0, -D / 2 - 0.05, H + 0.15))  # hayloft
        box((0.12, 0.3, 0.12), (0, -D / 2 - 0.15, H + 0.75), C(120, 84, 56))  # hay hoist beam
        for z in (0.4,):
            for x in (-0.82, 0.82):
                box((0.3, 0.05, 0.3), (x, -D / 2 - 0.03, 0.75), TRIM)
                box((0.22, 0.06, 0.22), (x, -D / 2 - 0.04, 0.75), C(90, 70, 70))
        # weathervane
        cyl(0.02, 0.4, (0, 0, H + 1.16), C(60, 60, 64), n=5)
        slab([(-0.16, 0), (0.12, 0), (0.18, 0.06), (0.12, 0.12), (-0.16, 0.12), (-0.1, 0.06)], 0.02, (0, 0, H + 1.44), C(60, 60, 64))


def silo():
    with at((0, 0, 0), rz=25):
        lathe([(0.62, 0), (0.62, 3.0), (0.0, 3.0)], (0, 0, 0), C(196, 200, 196), n=14, **GL)
        lathe([(0.66, 2.98), (0.55, 3.25), (0.3, 3.45), (0, 3.52)], (0, 0, 0), C(150, 156, 160), n=14, **MT)
        for z in (0.5, 1.0, 1.5, 2.0, 2.5):
            torus(0.625, 0.025, (0, 0, z), STEEL, n=14, k=4, **MT)
        lathe([(0.66, 0), (0.66, 0.25), (0, 0.25)], (0, 0, 0), C(160, 150, 140), n=14)
        # ladder + chute on the camera side
        for x in (-0.12, 0.12):
            box((0.04, 0.04, 3.1), (x, -0.66, 1.55), C(70, 70, 74))
        for k in range(14):
            box((0.24, 0.03, 0.03), (0, -0.66, 0.2 + k * 0.21), C(70, 70, 74))
        box((0.24, 0.3, 0.2), (0.0, -0.75, 3.15), BARN, bevel=0.02)


def shed():
    with at((0, 0, 0), rz=25):
        box((1.2, 1.0, 0.95), (0, 0, 0.475), C(110, 150, 120), bevel=0.03, **GL)
        for i in range(6):
            box((0.03, 1.02, 0.95), (-0.5 + i * 0.2, 0, 0.475), C(96, 132, 106))
        with at((0, 0.0, 1.05), ry=-12):
            box((1.45, 1.25, 0.08), (0, 0, 0), ROOF_R, bevel=0.02, **GL)
        slab([(-0.6, 0), (0.6, 0), (0.6, 0.25)], 0.04, (0, -0.51, 0.95), C(110, 150, 120))
        slab([(-0.6, 0), (0.6, 0), (0.6, 0.25)], 0.04, (0, 0.51, 0.95), C(110, 150, 120))
        box((0.42, 0.05, 0.7), (0.25, -0.52, 0.35), TRIM, bevel=0.01)
        box((0.36, 0.06, 0.64), (0.25, -0.53, 0.35), C(90, 120, 100))
        ell((0.38, -0.57, 0.36), 0.025, MUSTARD, seg=6, ring=4)
        box((0.3, 0.05, 0.24), (-0.28, -0.52, 0.6), TRIM)
        box((0.24, 0.06, 0.18), (-0.28, -0.53, 0.6), C(80, 80, 90))
        # leaning tools
        with at((-0.62, -0.38, 0.0), ry=-12):
            cyl(0.03, 0.9, (0, 0, 0.1), C(206, 160, 104), n=6)
            box((0.24, 0.05, 0.16), (0, 0, 0.08), STEEL, **MT)


def greenhouse():
    """Open frame only: no glass, no transparent panels. Beds inside show through."""
    W, D, H = 1.6, 2.0, 0.9
    with at((0, 0, 0), rz=25):
        box((W + 0.1, D + 0.1, 0.12), (0, 0, 0.06), C(200, 196, 186), bevel=0.02)
        fr = TRIM
        for x in (-W / 2, W / 2):
            for y in (-D / 2, 0, D / 2):
                box((0.06, 0.06, H), (x, y, H / 2 + 0.1), fr)
            box((0.06, D, 0.06), (x, 0, H + 0.1), fr)
            box((0.06, D, 0.05), (x, 0, 0.5), fr)
        for y in (-D / 2, D / 2):
            box((W, 0.06, 0.06), (0, y, H + 0.1), fr)
            for s in (-1, 1):
                L = math.hypot(W / 2, 0.55)
                with at((s * W / 4, y, H + 0.1 + 0.275), ry=s * math.degrees(math.atan2(0.55, W / 2))):
                    box((L, 0.06, 0.06), (0, 0, 0), fr)
            box((0.06, 0.06, 0.55), (0, y, H + 0.1 + 0.275), fr)
        for y in (-D / 2 + 0.5, D / 2 - 0.5):
            for s in (-1, 1):
                L = math.hypot(W / 2, 0.55)
                with at((s * W / 4, y, H + 0.1 + 0.275), ry=s * math.degrees(math.atan2(0.55, W / 2))):
                    box((L, 0.05, 0.05), (0, 0, 0), fr)
        box((0.06, D, 0.06), (0, 0, H + 0.65), fr)
        # rolled shade cloth on one roof slope (opaque fabric)
        with at((-W / 4, 0, H + 0.1 + 0.3), ry=-math.degrees(math.atan2(0.55, W / 2))):
            box((0.42, D, 0.03), (0.1, 0, 0.04), C(240, 236, 220), **GL)
            cyl(0.06, D, (-0.13, -D / 2, 0.06), C(220, 214, 196), n=8, rx=-90)
        # door frame front
        for x in (-0.22, 0.22):
            box((0.06, 0.06, H), (x, -D / 2, H / 2 + 0.1), fr)
        # beds with seedlings inside
        for x in (-0.45, 0.45):
            box((0.5, D - 0.3, 0.2), (x, 0, 0.22), WOOD, bevel=0.02)
            box((0.42, D - 0.38, 0.04), (x, 0, 0.32), SOIL)
            for k in range(4):
                with at((x, -0.6 + k * 0.4, 0.33), s=0.45):
                    crops.sprout(s=1.3)
        # potted plants on a shelf
        for k in range(3):
            lathe([(0.07, 0), (0.09, 0.12), (0.0, 0.12)], (0.55, -0.85 + k * 0.12, 0.12), TERRA, n=8)


TERRA = C(206, 112, 72)


def coop():
    with at((0, 0, 0), rz=25):
        for x in (-0.4, 0.4):
            for y in (-0.3, 0.3):
                box((0.07, 0.07, 0.4), (x, y, 0.2), WOOD_D)
        box((1.0, 0.8, 0.6), (0, 0, 0.7), C(240, 214, 150), bevel=0.03, **GL)
        for i in range(5):
            box((1.02, 0.82, 0.02), (0, 0, 0.45 + i * 0.12), C(222, 192, 130))
        gable(1.0, 0.8, 0.35, 1.0, ROOF_R)
        for y in (-0.4, 0.4):
            gable_wall(1.0, 0.35, y, 1.0, C(240, 214, 150))
        box((0.28, 0.05, 0.3), (0.22, -0.42, 0.6), C(90, 60, 50), bevel=0.01)  # pop hole
        with at((0.22, -0.42, 0.45), rx=-35):
            box((0.26, 0.6, 0.03), (0, -0.3, 0), WOOD)
            for k in range(4):
                box((0.26, 0.03, 0.02), (0, -0.08 - k * 0.14, 0.02), WOOD_D)
        # nest box on the side
        box((0.3, 0.6, 0.35), (0.62, 0, 0.68), C(240, 214, 150), bevel=0.02)
        with at((0.62, 0, 0.9), ry=-20):
            box((0.4, 0.7, 0.05), (0, 0, 0), ROOF_R, bevel=0.01)
        for k, y in enumerate((-0.15, 0.1)):
            ell((0.5, y - 0.2, 0.06), (0.04, 0.04, 0.05), CREAM if k else C(214, 170, 120), seg=6, ring=5)
        box((0.25, 0.05, 0.18), (-0.22, -0.42, 0.8), TRIM)
        box((0.2, 0.06, 0.13), (-0.22, -0.43, 0.8), C(90, 60, 50))


def windpump():
    with at((0, 0, 0), rz=25):
        for x in (-0.45, 0.45):
            for y in (-0.45, 0.45):
                stalk([(x, y, 0), (x * 0.25, y * 0.25, 2.6)], 0.035, 0.028, C(160, 164, 170), n=5, rings=2)
        for k, z in enumerate((0.6, 1.2, 1.8, 2.3)):
            r = 0.45 * (1 - z / 2.6 * 0.75)
            for (a, b) in (((-r, -r), (r, -r)), ((r, -r), (r, r)), ((r, r), (-r, r)), ((-r, r), (-r, -r))):
                tube([(a[0], a[1], z), (b[0], b[1], z)], lambda t: 0.018, C(160, 164, 170), rings=2, n=4)
        box((0.3, 0.3, 0.06), (0, 0, 2.62), C(150, 154, 160))
        with at((0, 0, 2.85)):
            box((0.16, 0.5, 0.16), (0, 0.1, 0), C(120, 124, 130), bevel=0.02)
            with at((0, -0.2, 0), rx=90):
                cyl(0.08, 0.08, (0, 0, 0), RED, n=8)
                for k in range(12):
                    with at((0, 0, 0.04), rz=k * 30):
                        box((0.08, 0.5, 0.02), (0, 0.33, 0), TRIM if k % 2 else RED, rx=0, rz=0, ry=20)
            slab([(0, -0.25), (0.75, -0.18), (0.75, 0.22), (0, 0.25)], 0.03, (0, 0.6, 0), RED, rz=90)
        # water trough
        box((0.9, 0.36, 0.3), (0.8, -0.6, 0.15), WOOD, bevel=0.03)
        ell((0.8, -0.6, 0.29), (0.4, 0.14, 0.02), C(120, 176, 210), seg=10, ring=4, rough=0.15)


def water_tower():
    with at((0, 0, 0), rz=25):
        for x in (-0.5, 0.5):
            for y in (-0.5, 0.5):
                stalk([(x, y, 0), (x * 0.7, y * 0.7, 2.0)], 0.06, 0.05, WOOD_D, n=6, rings=2)
        for z in (0.7, 1.4):
            k = 1 - z / 2.0 * 0.3
            for (a, b) in (((-0.5 * k, -0.5 * k), (0.5 * k, -0.5 * k)), ((0.5 * k, -0.5 * k), (0.5 * k, 0.5 * k))):
                tube([(a[0], a[1], z), (b[0], b[1], z)], lambda t: 0.03, WOOD_D, rings=2, n=5)
        box((1.0, 1.0, 0.08), (0, 0, 2.0), WOOD_D)
        lathe([(0.55, 2.04), (0.58, 2.9), (0.0, 2.9)], (0, 0, 0), WOOD, n=12, **GL)
        for z in (2.2, 2.5, 2.8):
            torus(0.575, 0.025, (0, 0, z), C(80, 80, 86), n=12, k=4, **MT)
        lathe([(0.66, 2.88), (0.0, 3.4)], (0, 0, 0), BARN, n=12, **GL)
        ell((0, 0, 3.42), 0.06, MUSTARD, seg=6, ring=4)
        tube([(0.4, -0.3, 2.3), (0.55, -0.55, 2.0), (0.6, -0.65, 1.5)], lambda t: 0.04, C(80, 80, 86), rings=5, n=6)


def picket(kind):
    col = TRIM
    with at((0, 0, 0), rz=10):
        if kind in ("picket", "picket-gate"):
            box((1.1, 0.04, 0.07), (0, 0.02, 0.24), col)
            box((1.1, 0.04, 0.07), (0, 0.02, 0.5), col)
            n = 7
            for i in range(n):
                x = -0.48 + i * 0.96 / (n - 1)
                if kind == "picket-gate" and 1 <= i <= 5:
                    continue
                box((0.1, 0.04, 0.6), (x, -0.02, 0.3), col, bevel=0.01)
                cone(0.072, 0.07, (x, -0.02, 0.6), col, n=4, rz=45)
            if kind == "picket-gate":
                with at((-0.34, -0.05, 0), rz=-25):
                    for i in range(4):
                        x = 0.1 + i * 0.15
                        box((0.1, 0.04, 0.55), (x, 0, 0.3), col, bevel=0.01)
                        cone(0.072, 0.07, (x, 0, 0.575), col, n=4, rz=45)
                    for z in (0.18, 0.45):
                        box((0.6, 0.04, 0.07), (0.32, 0.03, z), col)
                    ell((0.6, -0.04, 0.32), 0.03, MUSTARD, seg=6, ring=4)
        elif kind == "stone":
            r = rng(2)
            for row in range(3):
                for i in range(5 - row % 2):
                    x = -0.5 + i * 0.24 + (0.12 if row % 2 else 0)
                    ell((x, 0, 0.1 + row * 0.15), (0.13, 0.15, 0.09), C(170, 166, 160) if (i + row) % 2 else C(150, 146, 142), seg=7, ring=5)
            for i in range(4):
                leaf((-0.3 + i * 0.2, -0.1, 0.42), 270 + i * 30, 0.08, 0.06, 20, LEAF, shape=ROUND)
        elif kind == "hedge":
            for i in range(4):
                ell((-0.42 + i * 0.28, 0, 0.32), (0.22, 0.2, 0.3), LEAF_D if i % 2 else C(90, 146, 70), seg=8, ring=6)
            for i in range(3):
                ell((-0.28 + i * 0.28, -0.16, 0.5), 0.05, C(250, 200, 210), seg=6, ring=4)


def farm_stand():
    with at((0, 0, 0), rz=20):
        box((1.2, 0.6, 0.08), (0, 0, 0.62), WOOD, bevel=0.02)
        for x in (-0.55, 0.55):
            for y in (-0.25, 0.25):
                box((0.07, 0.07, 1.3 if y > 0 else 1.2), (x, y, (1.3 if y > 0 else 1.2) / 2), WOOD_D)
        box((1.2, 0.04, 0.5), (0, -0.28, 0.36), C(110, 150, 120), bevel=0.01)
        with at((0, 0.0, 1.3), rx=-14):
            box((1.45, 0.85, 0.07), (0, 0, 0), ROOF_R, bevel=0.02)
        # chalkboard sign + honesty box
        box((0.5, 0.04, 0.24), (0, -0.33, 1.1), C(60, 66, 62), bevel=0.02)
        for i in range(3):
            box((0.3 - i * 0.06, 0.01, 0.02), (-0.04, -0.355, 1.16 - i * 0.05), CREAM)
        box((0.18, 0.16, 0.14), (0.42, 0.0, 0.73), C(110, 150, 120), bevel=0.02)
        box((0.08, 0.17, 0.012), (0.42, 0.0, 0.8), DARK)
        # produce: a basket, a pumpkin, jars
        with at((-0.3, 0.0, 0.66), s=0.6):
            props.basket("bushel", "apples")
        with at((0.08, 0.05, 0.66)):
            gourds.gourd("round", "orange", "curly", s=0.32)
        for k in range(3):
            lathe([(0.04, 0), (0.045, 0.1), (0.03, 0.11), (0, 0.11)], (0.2 + k * 0.1, -0.18, 0.66), C(240, 160, 40), n=8, rough=0.3)
            cyl(0.035, 0.03, (0.2 + k * 0.1, -0.18, 0.77), [RED, C(250, 250, 240), RED][k], n=8)


def compost():
    with at((0, 0, 0), rz=25):
        for x in (-0.45, 0.45):
            for y in (-0.4, 0.4):
                box((0.07, 0.07, 0.6), (x, y, 0.3), WOOD_D)
        for z in (0.1, 0.25, 0.4, 0.55):
            for y in (-0.4, 0.4):
                box((0.92, 0.04, 0.1), (0, y, z), WOOD, bevel=0.01)
            box((0.04, 0.8, 0.1), (0.45, 0, z), WOOD, bevel=0.01)
        for z in (0.1, 0.25):
            box((0.04, 0.8, 0.1), (-0.45, 0, z), WOOD, bevel=0.01)
        lathe([(0.42, 0.1), (0.38, 0.5), (0.2, 0.68), (0, 0.72)], (0, 0, 0), C(100, 70, 50), n=10, sx=1.0, sy=0.9)
        r = rng(3)
        for k in range(8):
            a = r.uniform(0, 6.28)
            p = (0.25 * math.cos(a), 0.2 * math.sin(a), 0.55 + r.uniform(0, 0.1))
            [lambda: ell(p, 0.05, ORANGE, seg=6, ring=4), lambda: leaf(p, r.uniform(0, 360), 0.12, 0.08, 10, LEAF_L, shape=ROUND),
             lambda: ell(p, (0.06, 0.03, 0.02), C(240, 220, 150), seg=6, ring=4)][k % 3]()


def beehive():
    with at((0, 0, 0), rz=25):
        box((0.6, 0.5, 0.15), (0, 0, 0.075), WOOD_D, bevel=0.02)
        for k, col in enumerate((C(250, 236, 196), C(250, 214, 110), C(250, 236, 196))):
            box((0.5, 0.42, 0.22), (0, 0, 0.27 + k * 0.23), col, bevel=0.03, **GL)
        gable(0.56, 0.48, 0.14, 0.95, ROOF_R, over=0.04, t=0.05)
        for y in (-0.24, 0.24):
            gable_wall(0.5, 0.14, y, 0.95, C(250, 236, 196), depth=0.04)
        box((0.24, 0.05, 0.04), (0, -0.22, 0.18), DARK)
        box((0.3, 0.12, 0.02), (0, -0.28, 0.15), WOOD)
        # bees: little striped balls with wings (no faces)
        for p in ((0.2, -0.4, 0.5), (-0.15, -0.45, 0.7), (0.32, -0.25, 0.9)):
            with at(p, rz=40):
                ell((0, 0, 0), (0.05, 0.035, 0.035), MUSTARD, seg=8, ring=6)
                for x in (-0.012, 0.018):
                    ell((x, 0, 0), (0.008, 0.037, 0.037), DARK, seg=8, ring=4)
                for s in (-1, 1):
                    ell((0, s * 0.02, 0.04), (0.02, 0.012, 0.03), (1, 1, 1), seg=6, ring=4, rx=s * 30)


BIG = [("barn", barn), ("silo", silo), ("wind pump", windpump), ("water tower", water_tower)]
MID = [("shed", shed), ("greenhouse (open frame)", greenhouse), ("chicken coop", coop), ("farm stand", farm_stand)]
SMALL = [("compost bin", compost), ("beehive", beehive), ("picket fence", lambda: picket("picket")), ("picket gate", lambda: picket("picket-gate")),
         ("stone wall", lambda: picket("stone")), ("hedge", lambda: picket("hedge"))]
