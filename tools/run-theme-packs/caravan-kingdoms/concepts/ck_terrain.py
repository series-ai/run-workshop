"""Caravan Kingdoms: hex terrain tiles, trees and tile decorators."""
from ck_base import *  # noqa: F401,F403
from ck_base import _bm_obj  # noqa: F401

TREE = 1.4  # global tree / plant scale against the radius-1 hex

# ---------------------------------------------------------------- trees + plants


def poplar(p, s=1.0, rgb=POPLAR):
    with at(p, s=s * TREE):
        cyl(0.022, 0.06, (0, 0, 0), WOOD, n=6)
        lathe([(0.0, 0.04), (0.045, 0.055), (0.066, 0.1), (0.068, 0.17), (0.052, 0.25), (0.026, 0.3), (0, 0.315)], (0, 0, 0), rgb, n=8)


def palm(p, s=1.0, lean=(0.035, 0.0), rz=0.0):
    with at(p, s=s * TREE, rz=rz):
        top = (lean[0], lean[1], 0.27)
        tube([(0, 0, 0), (lean[0] * 0.2, lean[1] * 0.2, 0.13), top], lambda t: 0.03 - 0.01 * t, PALM_T, rings=5, n=6)
        for i in range(7):
            a = math.radians(i * 360 / 7 + 10)
            tip = (top[0] + math.cos(a) * 0.15, top[1] + math.sin(a) * 0.15, top[2] - 0.05)
            blade(top, tip, 0.1, C(96, 160, 70) if i % 2 else C(120, 180, 76), side=(0, 0, 1), bend=0.035, t=0.014)
        for i in range(3):
            a = math.radians(i * 120 + 40)
            ell((top[0] + math.cos(a) * 0.028, top[1] + math.sin(a) * 0.028, top[2] - 0.03), 0.024, OCHRE, seg=6, ring=4)


def mulberry(p, s=1.0):
    with at(p, s=s * TREE):
        cyl(0.02, 0.09, (0, 0, 0), WOOD, n=5, r2=0.014)
        for (x, y, z, r) in ((0, 0, 0.16, 0.09), (0.05, -0.03, 0.12, 0.065), (-0.05, 0.02, 0.13, 0.065)):
            ell((x, y, z), (r, r, r * 0.8), C(64, 128, 66), seg=7, ring=5)
        for (x, y, z) in ((0.04, -0.075, 0.15), (-0.05, -0.05, 0.12), (0.085, -0.03, 0.1), (0.0, -0.07, 0.2)):
            ell((x, y, z), 0.013, PLUM, seg=5, ring=4)


def conifer(p, s=1.0, rgb=FOREST):
    """Round tiered blob tree on a stubby trunk (the forest tree)."""
    with at(p, s=s * TREE):
        cyl(0.022, 0.05, (0, 0, 0), WOOD_D, n=6)
        ell((0, 0, 0.09), (0.085, 0.085, 0.065), rgb, seg=9, ring=6)
        ell((0, 0, 0.16), (0.064, 0.064, 0.055), FOREST_D if rgb == FOREST else rgb, seg=9, ring=6, rz=20)
        ell((0, 0, 0.215), (0.04, 0.04, 0.04), rgb, seg=8, ring=6)


def broadleaf(p, s=1.0, rgb=C(96, 156, 76)):
    with at(p, s=s * TREE):
        cyl(0.024, 0.06, (0, 0, 0), WOOD, n=6)
        ell((0, 0, 0.13), (0.09, 0.09, 0.08), rgb, seg=9, ring=6)


def bamboo(p, s=1.0, R=None, n=4):
    """A clump of fat bamboo stalks with round leaf puffs."""
    R = R or rng(3)
    with at(p, s=s * TREE):
        for i in range(n):
            a = 2 * math.pi * i / n + R.uniform(0, 0.5)
            d = 0.035 if i else 0.0
            x, y = d * math.cos(a), d * math.sin(a)
            h = R.uniform(0.2, 0.28)
            cyl(0.017, h, (x, y, 0), C(124, 176, 70) if i % 2 else C(150, 190, 80), n=6)
            for z in (h * 0.33, h * 0.66):
                cyl(0.021, 0.012, (x, y, z), C(96, 140, 60), n=6)
            ell((x + 0.02 * math.cos(a), y + 0.02 * math.sin(a), h + 0.01), (0.045, 0.045, 0.03), C(110, 176, 70), seg=7, ring=5)
            ell((x + 0.04 * math.cos(a + 1), y + 0.04 * math.sin(a + 1), h * 0.7), (0.032, 0.032, 0.022), C(130, 190, 80), seg=7, ring=5)


def bush(p, s=1.0, rgb=C(130, 150, 80), flowers=None):
    with at(p, s=s * TREE):
        ell((0, 0, 0.035), (0.06, 0.055, 0.045), rgb, seg=6, ring=4)
        ell((0.04, 0.02, 0.025), (0.04, 0.04, 0.032), rgb, seg=6, ring=4)
        if flowers:
            for (x, y, z) in ((0.01, -0.04, 0.06), (0.05, -0.01, 0.05), (-0.03, -0.03, 0.05)):
                ell((x, y, z), 0.012, flowers, seg=5, ring=4)


def reeds(p, s=1.0):
    with at(p, s=s):
        for i in range(5):
            a = i * 1.3
            x, y = 0.02 * math.cos(a), 0.02 * math.sin(a)
            cyl(0.006, 0.1 + 0.02 * (i % 2), (x, y, 0), C(130, 160, 70), n=4, rx=-y * 400, ry=x * 400)
            ell((x * 3, y * 3, 0.1 + 0.02 * (i % 2)), (0.008, 0.008, 0.02), WOOD, seg=5, ring=4)


def peak(p, r, h, rgb=ROCK, snow=0.0, rz=0.0, n=5):
    """A faceted mountain peak; snow is the fraction of height under a white cap."""
    with at(p, rz=rz):
        lathe([(r, 0), (r * 0.62, h * 0.45), (0, h)], (0, 0, 0), rgb, n=n)
        if snow:
            def r_at(z):
                return r + (r * 0.62 - r) * z / (h * 0.45) if z < h * 0.45 else r * 0.62 * (1 - (z - h * 0.45) / (h * 0.55))
            z0 = h * (1 - snow)
            zs = [z0] + ([h * 0.45] if z0 < h * 0.45 else [])
            prof = [(r_at(z) * 1.05, z) for z in zs] + [(0, h * 1.01)]
            lathe(prof, (0, 0, 0), SNOW, n=n)

# ---------------------------------------------------------------- terrain tiles
# each: fn(H, R, elev) draws the full tile. Water tiles ignore H for the surface.


def t_desert(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        dune((0.3, 0.3, 0), 0.32, 0.14, -10, rgb=SAND_D)
        ell((-0.35, -0.2, 0), (0.22, 0.16, 0.045), SAND_D, seg=7, ring=4)
        bush((-0.3, 0.35, 0), 0.7, C(150, 150, 90))
        rock((0.42, -0.3, 0), 0.08, C(196, 160, 120), rz=20)
        for i, (x, y) in enumerate(scatter(R, 4, 0.7, avoid=[(0.3, 0.25, 0.25)])):
            rock((x, y, 0), 0.03 + 0.01 * (i % 2), C(190, 160, 120), rz=i * 40)


def dune(p, r, h, rz, rgb=C(240, 168, 88), shade=DUNE_D):
    """A crescent dune: a sharp-crested ridge curving round (diamond section, sunk half)."""
    with at(p, rz=rz):
        pts = [(r * math.cos(math.radians(a)) - r * 0.7, r * 0.8 * math.sin(math.radians(a)), 0) for a in (-70, -35, 0, 35, 70)]
        tube(pts, lambda t: (-(0.01 + h * math.sin(math.pi * t) ** 0.7), 0.03 + r * 0.42 * math.sin(math.pi * t)), rgb, rings=9, n=3, side=(0, 0, 1))  # crest-up triangle


def t_dunes(H, R, e):
    hex_tile(H, DUNE, band=C(186, 124, 72))
    with at((0, 0, H)):
        dune((0.15, 0.3, 0), 0.55, 0.3 + 0.06 * (e == "high"), -10)
        dune((-0.2, -0.22, 0), 0.42, 0.22, 15)
        dune((0.5, -0.32, 0), 0.28, 0.14, -25)


def t_steppe(H, R, e):
    hex_tile(H, STEPPE, band=EARTH)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 11, 0.75)):
            tuft((x, y, 0), 0.9 + 0.3 * (i % 3), STEPPE_D if i % 2 else C(150, 160, 80))
        rock((-0.3, 0.35, 0), 0.06, ROCK, rz=20)


def t_grass(H, R, e):
    hex_tile(H, GRASS, band=EARTH)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 8, 0.75)):
            tuft((x, y, 0), 1.0, GRASS_D)
        for i, (x, y) in enumerate(scatter(rng(9), 5, 0.7)):
            ell((x, y, 0.012), 0.016, (C(250, 230, 90), CREAM, C(240, 140, 150))[i % 3], seg=5, ring=4)


def t_hills(H, R, e):
    hex_tile(H, GRASS, band=EARTH)
    with at((0, 0, H)):
        for (x, y, r, h) in ((-0.22, 0.25, 0.42, 0.2), (0.32, -0.05, 0.36, 0.16), (-0.25, -0.38, 0.28, 0.11)):
            ell((x, y, 0), (r, r * 0.85, h + 0.06 * (e == "high")), C(124, 174, 82), seg=8, ring=6)
        for (x, y) in ((0.3, -0.45), (0.5, 0.35), (-0.55, -0.05)):
            tuft((x, y, 0), 1.0, GRASS_D)


def t_oasis(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        cyl(0.48, 0.012, (0.0, 0.05, 0), GRASS, n=9)
        cyl(0.36, 0.02, (0.02, 0.06, 0), WATER, n=8, rz=10)
        palm((-0.36, 0.3, 0), 1.0, (0.04, -0.02))
        palm((0.38, 0.32, 0), 0.85, (-0.03, -0.01))
        palm((-0.2, -0.38, 0), 0.75, (0.02, 0.03))
        reeds((0.32, -0.2, 0.01), 0.9)
        bush((0.45, -0.05, 0.01), 0.7, C(110, 160, 70))


def river(H, edges, ground=GRASS, w=0.24):
    with at((0, 0, H)):
        link(edges, 0.012, w + 0.1, C(214, 196, 140), t=0.022)
        link(edges, 0.016, w, WATER, t=0.02, side=0.1)


def t_river(kind):
    E = {"straight": (1, 4), "bend": (1, 5), "fork": (1, 3, 5)}[kind]

    def f(H, R, e):
        hex_tile(H, GRASS, band=EARTH)
        river(H, E)
        with at((0, 0, H)):
            for i, (x, y) in enumerate(scatter(R, 9, 0.75, avoid=[(*edge_mid(k, d), 0.2) for k in E for d in (0.0, 0.2, 0.4, 0.6, 0.8)])):
                tuft((x, y, 0), 1.0, GRASS_D)
            reeds((0.17, 0.25, 0.0), 0.8)
            reeds((-0.12, -0.42, 0.0), 0.7)
    return f


def coast_split(H, sea_ang=300, c=0.05, land=GRASS, beach=0.2, cliff=False, sea=SEA):
    """Split a hex: land side at H, a low beach step, water side at WATER_Z."""
    nx, ny = math.cos(math.radians(sea_ang)), math.sin(math.radians(sea_ang))
    hx = hexpts()
    seap = clip(hx, -nx, -ny, -c)
    column(seap, WATER_Z, sea, band=EARTH)
    if cliff:
        column(clip(hx, nx, ny, c), H, land, band=ROCKBAND)
    else:
        column(clip(hx, nx, ny, c - beach), H, land, band=EARTH)
        bp = clip(clip(hx, nx, ny, c), -nx, -ny, -(c - beach))
        column(bp, WATER_Z + 0.05, SAND, band=EARTH)
    with at((nx * (c + 0.035), ny * (c + 0.035), WATER_Z)):
        box((0.03, 1.4, 0.012), (0, 0, 0.003), FOAM, rz=sea_ang - 90 + 90)
    return nx, ny


def t_coast(H, R, e):
    nx, ny = coast_split(H, cliff=(e == "high"))
    with at((0, 0, H)):
        palm((-0.35, 0.3, 0), 0.8, (0.03, -0.03)) if e != "high" else rock((-0.3, 0.3, 0), 0.12, ROCK, rz=10)
        for (x, y) in ((-0.5, -0.1), (0.0, 0.5), (-0.2, 0.6)):
            tuft((x, y, 0.01), 1.0, GRASS_D)
    with at((0, 0, WATER_Z)):
        wave((0.45, -0.45, 0), 300)


def wave(p, rz, rgb=FOAM, s=1.0):
    with at(p, rz=rz, s=s * 2.8):
        torus(0.08, 0.012, (0, 0, 0.004), rgb, n=6, k=4, arc=100, rz=40)


def t_sea(H, R, e):
    col = {"low": SHALLOW, "mid": SEA, "high": DEEP}[e]
    column(hexpts(), WATER_Z, col, band=EARTH)
    with at((0, 0, WATER_Z)):
        for i, (x, y) in enumerate(((-0.35, 0.3), (0.3, -0.2), (-0.1, -0.5), (0.4, 0.45))):
            wave((x, y, 0), 300 + i * 10, FOAM if e != "low" else C(250, 250, 240))
            cyl(0.16, 0.006, (x * 0.6 + 0.1, y * 0.6 - 0.1, 0), {"low": C(150, 226, 214), "mid": C(70, 160, 204), "high": C(50, 104, 176)}[e], n=6, rz=i * 20)
        if e == "low":
            ell((0.1, 0.15, -0.01), (0.2, 0.14, 0.03), C(236, 214, 160), seg=7, ring=4)  # sandbar


def t_delta(H, R, e):
    c = 0.3
    H = WATER_Z + 0.06 + (H - ELEV["low"]) * 0.3
    coast_split(H, sea_ang=270, c=c, beach=0.0001)
    with at((0, 0, H)):
        link([1], 0.012, 0.32, C(214, 196, 140), t=0.022, hub=False)
        link([1], 0.016, 0.22, WATER, t=0.02, side=0.1, hub=False)
        cyl(0.17, 0.02, (0, 0, -0.004), WATER, n=8)
        for a in (235, 270, 305):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            L = c / -sa
            box((0.11, L, 0.02), (ca * L / 2, sa * L / 2, 0.006), WATER, rz=a - 90)
            box((0.11, 0.02, H - WATER_Z), (ca * L, sa * L + 0.005, -(H - WATER_Z) / 2 + 0.01), WATER, rz=0)
        for (x, y) in ((-0.16, -0.18), (0.16, -0.18)):
            reeds((x, y, 0.0), 0.9)
        for (x, y) in ((0.45, 0.3), (-0.45, 0.25), (0.5, -0.1)):
            tuft((x, y, 0.0), 1.3, GRASS_D)
    with at((0, 0, WATER_Z)):
        for x in (-0.38, 0.0, 0.38):
            ell((x, -c - 0.12, -0.005), (0.09, 0.06, 0.02), C(222, 206, 150), seg=6, ring=4)  # silt bars


def t_lake(H, R, e):
    hex_tile(H, GRASS if e != "high" else C(150, 170, 120), band=EARTH if e != "high" else ROCKBAND)
    with at((0, 0, H)):
        cyl(0.62, 0.012, (0, 0, 0), C(222, 206, 150), n=9)
        cyl(0.54, 0.02, (0, 0, 0), WATER if e != "high" else C(90, 170, 210), n=9, rz=12)
        reeds((0.45, -0.32, 0.0), 0.9)
        reeds((-0.5, 0.18, 0.0), 0.8)
        if e == "high":
            rock((0.6, 0.4, 0), 0.1, ROCK, rz=10)
            rock((-0.45, 0.55, 0), 0.08, ROCK, rz=50)
        else:
            tuft((0.65, 0.1, 0), 1.0, GRASS_D)
            tuft((-0.2, -0.68, 0), 1.0, GRASS_D)


def t_mountain(H, R, e):
    hex_tile(H, C(170, 156, 128), band=ROCKBAND)
    sn = {"low": 0.0, "mid": 0.3, "high": 0.42}[e]
    k = {"low": 0.75, "mid": 1.0, "high": 1.2}[e]
    with at((0, 0, H)):
        peak((-0.08, 0.12, 0), 0.5, 0.75 * k, ROCK, sn, rz=10)
        peak((0.38, -0.2, 0), 0.34, 0.45 * k, ROCK_D, sn * 0.8, rz=40)
        peak((-0.38, -0.32, 0), 0.28, 0.34 * k, ROCK, sn * 0.6, rz=70)
        if e == "low":
            tuft((0.5, 0.35, 0), 1.0, GRASS_D)
            tuft((0.05, -0.6, 0), 1.0, GRASS_D)


def t_pass(H, R, e):
    hex_tile(H, SNOW, band=ROCKBAND)
    k = {"low": 0.8, "mid": 1.0, "high": 1.15}[e]
    with at((0, 0, H)):
        peak((-0.4, 0.25, 0), 0.42, 0.62 * k, ROCK, 0.6, rz=10)
        peak((0.42, 0.28, 0), 0.4, 0.55 * k, ROCK_D, 0.6, rz=40)
        peak((0.05, 0.6, 0), 0.3, 0.42 * k, ROCK, 0.7, rz=0)
        # the pass trail: flat stones from front to back between the peaks
        for i in range(6):
            t = i / 5
            rock((0.08 * math.sin(t * 5), -0.75 + t * 0.95, 0), 0.05, C(150, 130, 110), rz=i * 33, n=6)
        # cairn
        for i, r in enumerate((0.06, 0.045, 0.032)):
            ell((0.28, -0.35, 0.03 + i * 0.05), (r, r, r * 0.7), ROCK_D, seg=6, ring=4)
        flag((0.28, -0.35, 0.1), C(214, 58, 52), h=0.16, w=0.07, fh=0.045)


def t_salt(H, R, e):
    hex_tile(H, SALT_D, band=C(170, 150, 130))
    with at((0, 0, H)):
        pts = [(0, 0)] + [(0.42 * math.cos(math.radians(a)), 0.42 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
        for i, (x, y) in enumerate(pts):
            cyl(0.21, 0.018, (x, y, -0.005), SALT if i % 2 else C(250, 248, 242), n=6, rz=i * 7 + 30)
        cyl(0.13, 0.024, (0.05, 0.45, -0.005), BRINE, n=7)
        for (x, y, s) in ((-0.38, -0.42, 1.0), (0.5, -0.25, 0.8)):
            cone(0.07 * s, 0.09 * s, (x, y, 0), C(252, 252, 250), n=6)


def t_forest(H, R, e):
    hex_tile(H, C(104, 156, 80), band=EARTH)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 8, 0.66)):
            if e == "low" and i % 2:
                broadleaf((x, y, 0), 0.9 + 0.2 * (i % 3))
            else:
                conifer((x, y, 0), 0.85 + 0.15 * (i % 3), FOREST if i % 3 else C(80, 146, 86))


def t_bamboo(H, R, e):
    hex_tile(H, C(150, 190, 96), band=EARTH)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 5, 0.58)):
            bamboo((x, y, 0), 0.95 + 0.15 * (i % 2), rng(i + 4), n=4 + i % 2)


def t_terraces(H, R, e):
    hex_tile(H, GRASS, band=EARTH)
    with at((0, 0, H)):
        z = 0.0
        for i, (r, dy, h) in enumerate(((0.86, 0.0, 0.06), (0.66, 0.12, 0.07), (0.44, 0.24, 0.07), (0.22, 0.34, 0.07))):
            cyl(r, h, (0, dy, z), C(118, 168, 76), n=6)
            cyl(r - 0.06, 0.006, (0, dy, z + h), C(150, 214, 200), n=6)
            # rows of rice sprouts on the water
            for j in range(-3, 4):
                x = j * r * 0.22
                yy = dy - r * 0.6
                if abs(x) < r * 0.62:
                    cone(0.012, 0.03, (x, yy + (r - 0.12) * 0.2, z + h), C(120, 190, 70), n=4)
            z += h


def mesa(p, r, h, rz=0.0):
    bands = (TERRA, C(232, 150, 92), TERRA_D, C(240, 196, 140), TERRA)
    with at(p, rz=rz):
        z = 0
        for i, c in enumerate(bands):
            hh = h / len(bands)
            rr = r * (1 - 0.06 * i)
            cyl(rr, hh, (0, 0, z), c, n=6, r2=rr * 0.96)
            z += hh


def t_badlands(H, R, e):
    hex_tile(H, C(222, 150, 100), band=TERRA_D)
    k = {"low": 0.7, "mid": 1.0, "high": 1.25}[e]
    with at((0, 0, H)):
        mesa((-0.2, 0.25, 0), 0.34, 0.4 * k, 10)
        mesa((0.38, 0.0, 0), 0.24, 0.28 * k, 40)
        mesa((-0.3, -0.38, 0), 0.18, 0.2 * k, 20)
        rock((0.25, -0.45, 0), 0.06, TERRA_D, rz=30)


TERRAIN = [
    ("desert", t_desert), ("dunes", t_dunes), ("steppe", t_steppe), ("grassland", t_grass),
    ("hills", t_hills), ("oasis", t_oasis), ("river straight", t_river("straight")),
    ("river bend", t_river("bend")), ("river fork", t_river("fork")), ("river delta", t_delta),
    ("lake", t_lake), ("mountain", t_mountain), ("high pass", t_pass), ("salt flat", t_salt),
    ("forest", t_forest), ("bamboo", t_bamboo), ("rice terraces", t_terraces), ("coast", t_coast),
    ("sea", t_sea), ("red badlands", t_badlands),
]
TER = dict(TERRAIN)


def tile(name, e="mid", seed=1):
    """Draw a terrain tile; returns its top height (where decorators sit)."""
    H = ELEV[e]
    TER[name](H, rng(seed), e)
    return WATER_Z if name == "sea" else H


# ---------------------------------------------------------------- decorators
# each sits at (0, 0, 0) = the tile's top centre, and fits inside r ~ 0.7


def d_rocks():
    rock((0, 0, 0), 0.16, ROCK, rz=10)
    rock((0.2, -0.12, 0), 0.1, ROCK_D, rz=40)
    rock((-0.16, -0.14, 0), 0.07, ROCK, rz=70)
    rock((0.12, 0.18, 0), 0.06, ROCK_D, rz=20)


def d_scrub():
    for (x, y, s, f) in ((0, 0, 1.2, None), (0.22, -0.1, 0.9, C(240, 150, 180)), (-0.2, -0.15, 1.0, C(240, 150, 180)), (-0.1, 0.22, 0.8, None), (0.18, 0.2, 0.7, None)):
        bush((x, y, 0), s, C(140, 150, 80), f)
    tuft((0.05, -0.25, 0), 1.0, STEPPE_D)


def d_poplars():
    for i, x in enumerate((-0.26, -0.09, 0.08, 0.25)):
        poplar((x, 0.12 - x * 0.4, 0), 1.0 + 0.12 * (i % 2))


def d_palms():
    palm((0, 0.1, 0), 1.05, (0.04, -0.02))
    palm((0.22, -0.1, 0), 0.85, (-0.03, -0.03), rz=40)
    palm((-0.2, -0.14, 0), 0.75, (0.03, 0.02), rz=80)


def d_mulberry():
    mulberry((-0.15, 0.1, 0), 1.1)
    mulberry((0.17, -0.06, 0), 0.95)
    mulberry((-0.05, -0.22, 0), 0.8)


def yurt(p=(0, 0, 0), s=1.0, rz=0.0, felt=FELT, trim=LAPIS, door=RED):
    with at(p, rz=rz, s=s):
        cyl(0.14, 0.1, (0, 0, 0), felt, n=10)
        cyl(0.142, 0.022, (0, 0, 0.06), trim, n=10)
        lathe([(0.152, 0.1), (0.06, 0.17), (0.035, 0.18)], (0, 0, 0), felt, n=10)
        cyl(0.04, 0.02, (0, 0, 0.17), WOOD_D, n=8)
        box((0.06, 0.02, 0.085), (0, -0.138, 0.043), door, rz=0)
        box((0.07, 0.022, 0.012), (0, -0.14, 0.09), GOLD)


def d_yurts():
    yurt((-0.08, 0.1, 0), 1.0, rz=20)
    yurt((0.2, -0.1, 0), 0.75, rz=-15, trim=RED, door=TURQ)
    # tethering post + campfire
    cyl(0.006, 0.12, (-0.25, -0.18, 0), WOOD_D, n=4)
    for i in range(5):
        rock((0.0 + 0.045 * math.cos(i * 1.26), -0.2 + 0.045 * math.sin(i * 1.26), 0), 0.018, ROCK_D, n=5)
    cone(0.03, 0.06, (0, -0.2, 0), C(250, 150, 50), n=5, emit=1.0)


def well(p=(0, 0, 0), s=1.0):
    with at(p, s=s):
        lathe([(0.1, 0), (0.1, 0.08), (0.07, 0.08), (0.07, 0.01)], (0, 0, 0), C(196, 176, 150), n=8, cap=False)
        cyl(0.1, 0.01, (0, 0, 0), ROCK_D, n=8)
        cyl(0.072, 0.012, (0, 0, 0.055), WATER, n=8)
        for x in (-0.09, 0.09):
            cyl(0.012, 0.2, (x, 0, 0.06), WOOD, n=5)
        # little roof
        slab([(-0.14, 0), (0.14, 0), (0, 0.08)], 0.16, (0, 0, 0.25), TERRA)
        cyl(0.01, 0.2, (-0.1, 0, 0.2), WOOD_D, n=5, ry=90)
        cyl(0.028, 0.04, (0.0, 0, 0.12), WOOD_D, n=6)


def d_well():
    well((0, 0, 0), 1.1)
    for (x, y) in ((0.2, -0.12), (-0.2, -0.1)):
        cyl(0.03, 0.05, (x, y, 0), TERRA, n=7, r2=0.02)  # water jars


def d_ruins():
    for i, (x, y, h) in enumerate(((-0.2, 0.1, 0.28), (-0.06, 0.16, 0.16), (0.1, 0.2, 0.22))):
        cyl(0.035, h, (x, y, 0), C(222, 206, 176), n=6, rz=i * 15)
        box((0.09, 0.09, 0.03), (x, y, 0.015), C(200, 184, 156))
    # broken arch: one pier and a half arch
    box((0.08, 0.08, 0.26), (0.22, -0.08, 0.13), C(214, 196, 166))
    slab([(0.0, 0.0), (0.04, 0.0), (0.04, 0.08), (0.09, 0.12), (0.12, 0.12), (0.12, 0.17), (0.0, 0.17)], 0.08, (0.18, -0.08, 0.17), C(214, 196, 166))
    box((0.12, 0.07, 0.05), (-0.02, -0.18, 0.025), C(200, 184, 156), rz=25, ry=8)
    box((0.06, 0.06, 0.05), (0.1, -0.25, 0.025), C(200, 184, 156), rz=-10)
    cyl(0.035, 0.14, (-0.24, -0.16, 0.035), C(222, 206, 176), n=6, ry=90, rz=30)
    tuft((-0.12, -0.05, 0), 0.8, STEPPE_D)


def d_ripples():
    for i in range(5):
        y = -0.26 + i * 0.13
        with at((0.02 * (i % 2), y, 0), s=(1, 1, 0.4)):
            torus(0.5, 0.025, (0, -0.42, 0), DUNE_D, n=8, k=4, arc=60, rz=60)


def d_bones():
    # a stylised camel skeleton half sunk in sand: spine, ribs and a skull
    tube([(-0.22, 0.04, 0.02), (0, 0, 0.045), (0.22, -0.04, 0.02)], lambda t: 0.012, C(246, 240, 224), rings=5, n=5)
    for i in range(5):
        x = -0.12 + i * 0.06
        with at((x, -0.008 * i, 0.0), rx=90, rz=90):
            torus(0.055, 0.009, (0, 0, 0), C(246, 240, 224), n=6, k=4, arc=180)
    ell((0.28, -0.07, 0.035), (0.05, 0.035, 0.035), C(246, 240, 224), seg=6, ring=4, rz=-15)
    ell((0.34, -0.09, 0.025), (0.035, 0.022, 0.022), C(246, 240, 224), seg=6, ring=4, rz=-15)
    ell((0.0, 0.0, 0.0), (0.3, 0.16, 0.025), SAND_D, seg=8, ring=4)


def signpost(p=(0, 0, 0), s=1.0, arms=((20, RED), (150, TURQ), (260, OCHRE))):
    with at(p, s=s):
        for i, r in enumerate((0.06, 0.045)):
            ell((0, 0, 0.02 + i * 0.035), (r, r, r * 0.7), ROCK_D, seg=6, ring=4)
        cyl(0.014, 0.3, (0, 0, 0), WOOD, n=5)
        for i, (a, c) in enumerate(arms):
            with at((0, 0, 0.27 - i * 0.055), rz=a):
                slab([(0, 0), (0.12, 0), (0.15, 0.02), (0.12, 0.04), (0, 0.04)], 0.012, (0.0, 0.0, -0.02), c)


def d_signpost():
    signpost((0, 0, 0), 1.1)


DECOR = [("rocks", d_rocks, "steppe", 1.8), ("scrub", d_scrub, "desert", 1.7), ("poplars", d_poplars, "grassland", 1.25),
         ("date palms", d_palms, "desert", 1.25), ("mulberry", d_mulberry, "grassland", 1.4), ("dune ripples", d_ripples, "desert", 1.3),
         ("yurts", d_yurts, "steppe", 1.8), ("well", d_well, "desert", 1.8), ("ruins", d_ruins, "desert", 1.8),
         ("bones", d_bones, "desert", 1.8), ("signpost", d_signpost, "steppe", 2.1)]
DEC = {n: (fn, s) for n, fn, _, s in DECOR}


def decor(name, p=(0, 0, 0), s=1.0, rz=0.0):
    fn, k = DEC[name]
    with at(p, s=s * k, rz=rz):
        fn()


def plain(e="low", top=None):
    """A bare tile for showing props: low elevation, no detail."""
    H = ELEV[e]
    hex_tile(H, top or STEPPE)
    return H
