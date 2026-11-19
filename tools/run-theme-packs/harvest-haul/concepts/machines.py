"""Hand tools, the modular tractor and farm machinery. Chunky toy style shared
with Bolt-On Racers: the wheels come straight from its rk.wheel builder.

Scale: a farmer kid is about 1.35 tall; a crop mound is 0.94 wide."""
import math
import os
import sys

from hh import *  # noqa: F401,F403
import crops
import gourds
import props

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "bolt-on-racers", "concepts"))
import rk  # noqa: E402

GL = dict(rough=0.42)
MT = dict(metal=0.35, rough=0.35)
STEEL = C(170, 178, 186)
CHARC = C(62, 60, 66)
TYRE = C(44, 42, 48)
WIN = C(150, 200, 226)   # opaque window panel (no glass)
GREEN_T = C(70, 150, 80)
BLUE_T = C(60, 120, 200)
YEL_T = C(250, 196, 50)
HANDLE = C(206, 160, 104)


# ================================================================ hand tools (standing head-down, as if stuck in the ground)

def handle(h, r=0.035, col=HANDLE, grip=None):
    cyl(r, h, (0, 0, 0), col, n=6)
    if grip:
        cyl(r * 1.35, 0.14, (0, 0, h - 0.14), grip, n=6)
        ell((0, 0, h), r * 1.4, grip, seg=6, ring=4)


def tool(kind):
    with at((0, 0, 0), rz=25):
        if kind == "hoe":
            with at((0, 0, 0.12)):
                handle(1.2, grip=RED)
            box((0.26, 0.04, 0.14), (0, -0.03, 0.07), STEEL, bevel=0.012, **MT)
            box((0.05, 0.1, 0.05), (0, -0.0, 0.16), STEEL, **MT)
        elif kind == "rake":
            with at((0, 0, 0.14)):
                handle(1.2, grip=GREEN_T)
            box((0.42, 0.06, 0.05), (0, 0, 0.14), STEEL, bevel=0.012, **MT)
            for i in range(7):
                cone(0.018, 0.12, (-0.18 + i * 0.06, -0.01, 0.12), STEEL, n=4, rx=180, **MT)
        elif kind == "shovel":
            with at((0, 0, 0.36)):
                handle(0.9)
                torus(0.07, 0.02, (0, 0, 0.95), CHARC, n=8, k=4, rx=90)
            slab([(-0.13, 0.36), (0.13, 0.36), (0.14, 0.12), (0, 0.0), (-0.14, 0.12)], 0.035, (0, 0, 0), STEEL, bevel=0.01, **MT)
            cyl(0.045, 0.1, (0, 0, 0.32), STEEL, n=6, **MT)
        elif kind == "pitchfork":
            with at((0, 0, 0.38)):
                handle(1.0, grip=CHARC)
            box((0.3, 0.04, 0.05), (0, 0, 0.38), STEEL, bevel=0.01, **MT)
            for x in (-0.13, -0.045, 0.045, 0.13):
                cyl(0.018, 0.34, (x, 0, 0.04), STEEL, n=5, **MT)
                cone(0.018, 0.05, (x, 0, 0.04), STEEL, n=5, rx=180, **MT)
        elif kind == "sickle":
            with at((0, 0, 0.0)):
                cyl(0.04, 0.22, (0, 0, 0), C(150, 100, 64), n=6)
            pts = [(0.0, 0, 0.22)] + [(0.18 * math.sin(a) + 0.0, 0, 0.22 + 0.2 * (1 - math.cos(a)) * 0.9) for a in (0.6, 1.2, 1.8, 2.4, 2.9)]
            tube(pts, lambda t: (0.04 * (1 - 0.7 * t) + 0.006, 0.012), STEEL, rings=12, n=4, side=(0, 1, 0), **MT)
        elif kind == "scythe":
            stalk([(0, 0, 0.0), (0.04, 0, 0.6), (0.0, 0, 1.25)], 0.035, 0.03, HANDLE)
            for z in (0.5, 0.9):
                tube([(0.02, 0, z), (-0.1, -0.02, z + 0.02)], lambda t: 0.022, HANDLE, rings=2, n=5)
            pts = [(0.0, 0, 1.22), (0.2, 0, 1.24), (0.4, 0, 1.2), (0.55, 0, 1.08)]
            tube(pts, lambda t: (0.06 * (1 - 0.8 * t) + 0.008, 0.012), STEEL, rings=10, n=4, side=(0, 1, 0), **MT)
        elif kind == "shears":
            for s in (-1, 1):
                with at((0, 0, 0.0), ry=s * 8):
                    cyl(0.03, 0.3, (s * 0.04, 0, 0.0), RED, n=6)
                    slab([(-0.025, 0), (0.025, 0), (0.01, 0.26), (-0.01, 0.24)], 0.02, (s * 0.02, s * 0.01, 0.3), STEEL, **MT)
            cyl(0.03, 0.03, (0, -0.02, 0.3), CHARC, n=6, rx=90)
        elif kind == "can-metal":
            with at((0, 0, 0), s=1.0):
                lathe([(0, 0), (0.19, 0), (0.2, 0.03), (0.17, 0.32), (0.12, 0.36), (0, 0.36)], (0, 0, 0), STEEL, n=10, **MT)
                for z in (0.08, 0.26):
                    torus(0.195 - z * 0.08, 0.014, (0, 0, z), C(140, 148, 156), n=10, k=4, **MT)
                tube([(0.14, 0, 0.06), (0.3, 0, 0.2), (0.38, 0, 0.38)], lambda t: 0.04 - 0.012 * t, STEEL, rings=6, n=6, **MT)
                with oriented((0.38, 0, 0.38), (0.6, 0, 0.8)):
                    lathe([(0.03, 0), (0.07, 0.05), (0, 0.06)], (0, 0, 0), C(140, 148, 156), n=8)
                torus(0.16, 0.025, (0, 0, 0.42), C(140, 148, 156), n=10, k=4, rx=90, arc=180)
        elif kind == "can-toy":
            lathe([(0, 0), (0.17, 0), (0.18, 0.03), (0.18, 0.2), (0.12, 0.26), (0, 0.26)], (0, 0, 0), C(250, 130, 160), n=10, **GL)
            tube([(0.14, 0, 0.06), (0.26, 0, 0.18), (0.3, 0, 0.3)], lambda t: 0.04, C(250, 130, 160), rings=5, n=6)
            with oriented((0.3, 0, 0.3), (0.5, 0, 0.8)):
                lathe([(0.03, 0), (0.08, 0.05), (0, 0.06)], (0, 0, 0), YEL_T, n=8)
            tube([(-0.16, 0, 0.08), (-0.26, 0, 0.18), (-0.18, 0, 0.32), (0.0, 0, 0.3)], lambda t: 0.035, YEL_T, rings=8, n=6)
            for a in (40, 160, 280):
                ell((0.17 * math.cos(math.radians(a)), 0.17 * math.sin(math.radians(a)), 0.14), (0.04, 0.04, 0.04), CREAM, seg=6, ring=4)
        elif kind == "can-sage":
            props.watering_can()
        elif kind.startswith("seeds-"):
            seed_bag(kind[6:])
        elif kind == "sack-grain":
            sack(BURLAP_C, 0.42)
        elif kind == "sack-flour":
            sack(CREAM, 0.38, band=RED)
        elif kind == "bucket-metal":
            bucket(STEEL, metal=True)
        elif kind == "bucket-wood":
            bucket(WOOD, metal=False)
        elif kind == "rototiller":
            rototiller()


BURLAP_C = C(214, 184, 138)


def seed_bag(crop):
    col = {"pumpkin": ORANGE, "carrot": C(250, 122, 32), "tomato": TOMATO, "corn": YEL_T, "flower": C(250, 130, 170)}[crop]
    with at((0, 0, 0)):
        box((0.26, 0.1, 0.34), (0, 0, 0.17), CREAM, bevel=0.03)
        box((0.27, 0.08, 0.06), (0, 0, 0.34), C(230, 216, 190), bevel=0.01)
        for z in (0.31, 0.37):
            box((0.28, 0.02, 0.012), (0, -0.04, z), C(200, 186, 160))
        # front label: a picture of the crop
        box((0.2, 0.012, 0.18), (0, -0.054, 0.16), col, bevel=0.01)
        if crop == "pumpkin":
            with at((0, -0.08, 0.1), rx=90 * 0):
                gourds.gourd("round", "orange", "stub", s=0.13, rz=0)
        elif crop == "carrot":
            crops.carrot_root((0, -0.08, 0.22), L=0.12, r=0.03, d=(0, -0.2, -1))
            leaf((0, -0.08, 0.22), 90, 0.06, 0.05, 70, LEAF, shape=ROUND)
        elif crop == "tomato":
            crops.tomato_fruit((0, -0.08, 0.15), 0.05)
        elif crop == "corn":
            crops.cob((0, -0.08, 0.07), (0, -0.1, 1), L=0.16, peeled=0.6, silk=None)
        else:
            with oriented((0, -0.07, 0.16), (0, -1, 0)):
                for i in range(5):
                    leaf((0, 0, 0), i * 72, 0.05, 0.045, 5, (1, 1, 1), shape=ROUND, t=0.01)
                ell((0, 0, 0.01), 0.02, MUSTARD, seg=6, ring=4)


def sack(col, h, band=None):
    lathe([(0, 0), (0.16, 0), (0.2, 0.06), (0.2, h * 0.7), (0.14, h * 0.88), (0.08, h * 0.92), (0.11, h * 1.02), (0, h * 1.04)], (0, 0, 0), col, n=10)
    torus(0.085, 0.018, (0, 0, h * 0.9), TWINE, n=8, k=4)
    if band:
        lathe([(0.205, h * 0.3), (0.205, h * 0.42)], (0, 0, 0), band, n=10, cap=False)
    else:
        with at((0, 0, 0), rz=25):
            box((0.12, 0.02, 0.1), (0, -0.2, h * 0.4), C(180, 140, 96), bevel=0.01)


def bucket(col, metal=True):
    m = MT if metal else {}
    lathe([(0.14, 0), (0.19, 0.3), (0.17, 0.3), (0.12, 0.03), (0, 0.03)], (0, 0, 0), col, n=10, **m)
    for z in ((0.04, 0.26) if metal else (0.06, 0.24)):
        torus(0.14 + z * 0.17, 0.016, (0, 0, z), C(140, 148, 156) if metal else C(120, 120, 126), n=10, k=4, **MT)
    torus(0.19, 0.012, (0, 0, 0.26), CHARC, n=12, k=4, rx=80, arc=180)
    if not metal:
        ell((0, 0, 0.28), (0.15, 0.15, 0.015), C(120, 176, 210), seg=10, ring=4, rough=0.15)


def rototiller():
    with at((0, 0, 0), rz=-10):
        # tines drum
        for x in (-0.18, 0.18):
            with at((x, -0.25, 0.14)):
                for k in range(6):
                    with at((0, 0, 0), rx=k * 60):
                        box((0.03, 0.02, 0.26), (0, 0, 0), STEEL, **MT)
        cyl(0.03, 0.5, (-0.25, -0.25, 0.14), STEEL, n=6, ry=90)
        box((0.5, 0.24, 0.08), (0, -0.25, 0.3), RED, bevel=0.03, **GL)  # tine guard
        # engine block
        box((0.32, 0.3, 0.24), (0, 0.02, 0.42), RED, bevel=0.05, **GL)
        box((0.26, 0.22, 0.12), (0, 0.02, 0.6), CHARC, bevel=0.03)
        cyl(0.07, 0.06, (0.12, -0.08, 0.66), STEEL, n=8, **MT)
        # wheel + handles
        with at((0, 0.22, 0.12)):
            rk.wheel("knobbly", 0.12, 0.1, acc=YEL_T, side=1, centred=True)
        for s in (-1, 1):
            tube([(s * 0.1, 0.12, 0.5), (s * 0.18, 0.5, 0.8), (s * 0.24, 0.72, 0.95)], lambda t: 0.025, CHARC, rings=6, n=5)
            cyl(0.035, 0.12, (s * 0.24, 0.72, 0.95), BLACK_G, n=6, ry=s * 90)
        tube([(-0.16, 0.6, 0.88), (0.16, 0.6, 0.88)], lambda t: 0.02, CHARC, rings=2, n=5)


BLACK_G = C(40, 40, 46)

TOOLS = [("hoe", "hoe"), ("rake", "rake"), ("shovel", "shovel"), ("pitchfork", "pitchfork"), ("sickle", "sickle"), ("scythe", "scythe"),
         ("shears", "shears"), ("rototiller", "rototiller")]
CONTAINERS = [("watering can, sage", "can-sage"), ("watering can, metal", "can-metal"), ("watering can, toy", "can-toy"),
              ("bucket, metal", "bucket-metal"), ("bucket, wood", "bucket-wood"), ("grain sack", "sack-grain"), ("flour sack", "sack-flour")]
SEEDS = [(f"seed bag: {c}", f"seeds-{c}") for c in ("pumpkin", "carrot", "tomato", "corn", "flower")]


# ================================================================ the modular tractor
# Chassis (engine, frame, hitch) + body (open / cab / canopy / vintage) + wheel set + paint
# + front attachment. Built facing -y; the board turns it to the 3/4 view.

PAINT = {"red": (RED, CREAM), "green": (GREEN_T, YEL_T), "blue": (BLUE_T, CREAM), "orange": (ORANGE, CHARC), "yellow": (YEL_T, GREEN_T)}
RW = dict(r=0.5, w=0.3, x=0.42, y=0.38)     # rear wheels
FW = dict(r=0.27, w=0.18, x=0.36, y=-0.66)  # front wheels


def wheels(front="knobbly", rear="knobbly", acc=YEL_T, rr=RW, fr=FW):
    for s in (-1, 1):
        with at((s * rr["x"], rr["y"], rr["r"])):
            rk.wheel(rear, rr["r"], rr["w"], acc=acc, side=s, centred=True)
        with at((s * fr["x"], fr["y"], fr["r"])):
            rk.wheel(front, fr["r"], fr["w"], acc=acc, side=s, centred=True)


def chassis(main, acc, vintage=False):
    box((0.36, 1.45, 0.18), (0, -0.15, 0.42), CHARC, bevel=0.03)
    cyl(0.05, 0.84, (-0.42, FW["y"], FW["r"]), CHARC, n=6, ry=90)  # front axle
    if vintage:
        lathe([(0.0, 0), (0.2, 0.0), (0.24, 0.2), (0.22, 0.62), (0.0, 0.66)], (0, -0.38, 0.58), main, n=10, rx=90, sx=1.0, sy=0.9, **GL)
        lathe([(0, 0), (0.17, 0.0), (0.18, 0.04), (0, 0.05)], (0, -1.04, 0.58), CHARC, n=10, rx=90)
        for s in (-1, 1):
            cyl(0.07, 0.05, (s * 0.15, -1.02, 0.86), CHROME_C, n=10, rx=90, **MT)
        cyl(0.04, 0.5, (0, -0.75, 0.75), CHARC, n=6)
        cyl(0.06, 0.06, (0, -0.75, 1.25), CHARC, n=6)
    else:
        box((0.5, 0.78, 0.44), (0, -0.62, 0.74), main, bevel=0.1, **GL)  # bonnet
        box((0.44, 0.04, 0.34), (0, -1.01, 0.72), CHARC, bevel=0.02)  # grille
        for i in range(4):
            box((0.05, 0.02, 0.28), (-0.15 + i * 0.1, -1.03, 0.72), BLACK_G)
        for s in (-1, 1):
            cyl(0.06, 0.04, (s * 0.16, -1.02, 0.92), C(255, 244, 190), n=8, rx=90, emit=0.2)
            for i in range(3):
                box((0.012, 0.16, 0.035), (s * 0.255, -0.75 + i * 0.12, 0.8), BLACK_G)
        cyl(0.045, 0.62, (0.15, -0.5, 0.92), CHARC, n=6)  # exhaust stack
        cyl(0.06, 0.05, (0.15, -0.5, 1.54), STEEL, n=8, **MT)
    box((0.22, 0.12, 0.12), (0, 0.66, 0.42), CHARC, bevel=0.02)  # hitch
    torus(0.05, 0.018, (0, 0.74, 0.42), STEEL, n=8, k=4, **MT)
    # rear fenders over the big wheels
    for s in (-1, 1):
        with at((s * RW["x"], RW["y"], RW["r"])):
            _fender(RW["r"] + 0.04, RW["w"] * 1.1, main)
    # seat + wheel + platform
    box((0.66, 0.5, 0.06), (0, 0.32, 0.6), CHARC, bevel=0.02)
    box((0.3, 0.26, 0.08), (0, 0.32, 0.78), BLACK_G, bevel=0.03)
    box((0.3, 0.08, 0.24), (0, 0.46, 0.92), BLACK_G, bevel=0.03)
    cyl(0.04, 0.3, (0, 0.33, 0.6), CHARC, n=6)
    box((0.2, 0.12, 0.2), (0, -0.1, 0.9), main, bevel=0.03, **GL)  # dash
    with oriented((0, 0.0, 1.0), (0, 0.6, 1)):
        cyl(0.018, 0.12, (0, 0, 0), STEEL, n=5, **MT)
        torus(0.1, 0.022, (0, 0, 0.12), CHARC, n=10, k=4)


CHROME_C = C(212, 216, 224)


def _fender(R, w, col):
    """Half-round mudguard over a wheel turning about x."""
    verts, faces = [], []
    n = 10
    for i in range(n + 1):
        a = math.radians(15 + 150 * i / n)
        for x in (-w / 2, w / 2):
            for rr in (R, R + 0.05):
                verts.append((x, rr * math.cos(a), rr * math.sin(a)))
    for i in range(n):
        b0, b1 = i * 4, (i + 1) * 4
        faces += [(b0, b1, b1 + 1, b0 + 1), (b0 + 2, b0 + 3, b1 + 3, b1 + 2), (b0, b0 + 2, b1 + 2, b1), (b0 + 1, b1 + 1, b1 + 3, b0 + 3)]
    faces += [(0, 1, 3, 2), (n * 4, n * 4 + 2, n * 4 + 3, n * 4 + 1)]
    import bpy
    me = bpy.data.meshes.new("fender")
    me.from_pydata(verts, [], faces)
    return kit._obj("fender", me, col, **GL)


def body(kind, main, acc):
    if kind == "open":
        for s in (-1, 1):
            cyl(0.055, 1.05, (s * 0.3, 0.62, 0.62), acc, n=6)
        tube([(-0.3, 0.62, 1.66), (-0.25, 0.62, 1.74), (0.25, 0.62, 1.74), (0.3, 0.62, 1.66)], lambda t: 0.055, acc, rings=6, n=6)
    elif kind == "cab":
        z0, z1 = 0.66, 1.62
        for x in (-0.33, 0.33):
            for y in (-0.08, 0.66):
                box((0.07, 0.07, z1 - z0), (x, y, (z0 + z1) / 2), main, bevel=0.015, **GL)
        # opaque window panels on all four sides
        box((0.6, 0.03, 0.6), (0, -0.08, 1.24), WIN, rough=0.2)
        box((0.6, 0.03, 0.6), (0, 0.66, 1.24), WIN, rough=0.2)
        for x in (-0.33, 0.33):
            box((0.03, 0.66, 0.5), (x, 0.29, 1.3), WIN, rough=0.2)
        box((0.86, 0.94, 0.12), (0, 0.29, z1 + 0.04), acc, bevel=0.04, **GL)
        box((0.6, 0.68, 0.08), (0, 0.29, z1 + 0.12), main, bevel=0.03, **GL)
        cyl(0.07, 0.1, (0.22, 0.5, z1 + 0.16), ORANGE, n=8, emit=0.3)
        for s in (-1, 1):
            box((0.05, 0.1, 0.03), (s * 0.4, -0.12, 1.5), CHARC)  # mirrors
            box((0.03, 0.05, 0.1), (s * 0.44, -0.12, 1.5), CHARC)
    elif kind == "canopy":
        for x in (-0.3, 0.3):
            for y in (0.0, 0.62):
                cyl(0.03, 1.0, (x, y, 0.66), acc, n=6)
        for i in range(6):
            box((0.86 / 6, 0.86, 0.05), (-0.43 + (i + 0.5) * 0.86 / 6, 0.31, 1.68), main if i % 2 == 0 else CREAM, rx=-4)
        for i in range(6):
            with at((-0.43 + (i + 0.5) * 0.86 / 6, -0.13, 1.66)):
                slab([(-0.07, 0.0), (0.07, 0.0), (0.05, -0.07), (0, -0.09), (-0.05, -0.07)], 0.02, (0, 0, 0), main if i % 2 == 0 else CREAM)
    elif kind == "vintage":
        box((0.06, 0.4, 0.04), (0, 0.32, 0.62), CHARC)


def front_loader(main, acc):
    for s in (-1, 1):
        tube([(s * 0.32, 0.0, 0.85), (s * 0.34, -0.6, 0.78), (s * 0.34, -1.05, 0.42), (s * 0.34, -1.25, 0.25)], lambda t: 0.04, acc, rings=8, n=6)
    with at((0, -1.38, 0.08)):
        box((0.92, 0.36, 0.04), (0, 0.0, 0.0), acc, bevel=0.01)
        box((0.92, 0.04, 0.34), (0, 0.17, 0.17), acc, bevel=0.01)
        for x in (-0.46, 0.46):
            box((0.04, 0.38, 0.3), (x, 0.0, 0.14), acc, bevel=0.01)


def tractor(kind="open", paint="red", loader=False, rear="knobbly", front="knobbly", load=None):
    main, acc = PAINT[paint]
    with at((0, 0, 0), rz=-35):
        chassis(main, acc, vintage=kind == "vintage")
        body(kind, main, acc)
        wheels(front, rear, acc=acc if paint != "yellow" else CREAM)
        if loader:
            front_loader(main, acc)
        if load:
            load()


def tractor_parts(part):
    with at((0, 0, 0), rz=-35):
        if part == "chassis":
            chassis(RED, CREAM)
        elif part == "chassis-vintage":
            chassis(GREEN_T, YEL_T, vintage=True)
        elif part == "rear wheels":
            for s in (-1, 1):
                with at((s * RW["x"], 0, RW["r"])):
                    rk.wheel("knobbly", RW["r"], RW["w"], acc=YEL_T, side=s, centred=True)
        elif part == "front wheels":
            for s in (-1, 1):
                with at((s * FW["x"], 0, FW["r"])):
                    rk.wheel("knobbly", FW["r"], FW["w"], acc=YEL_T, side=s, centred=True)
        elif part == "turf wheels":
            for s in (-1, 1):
                with at((s * RW["x"], 0, RW["r"])):
                    rk.wheel("slick", RW["r"], RW["w"], acc=CREAM, side=s, centred=True)
        elif part in ("open", "cab", "canopy"):
            with at((0, 0, -0.55)):
                body(part, RED, CREAM)
        elif part == "loader":
            with at((0, 0, 0)):
                front_loader(RED, CREAM)


# ================================================================ implements + vehicles

def _wheelpair(x, y, r, w, acc=YEL_T, kind="knobbly"):
    for s in (-1, 1):
        with at((s * x, y, r)):
            rk.wheel(kind, r, w, acc=acc, side=s, centred=True)


def _drawbar(y0, y1, z=0.38):
    tube([(0, y0, z), (0, y1, z)], lambda t: 0.035, CHARC, rings=2, n=6)
    torus(0.05, 0.016, (0, y1, z), STEEL, n=8, k=4, **MT)


def plough():
    with at((0, 0, 0), rz=-75):
        box((0.16, 1.2, 0.14), (0, 0.0, 0.5), RED, bevel=0.03, **GL)
        _drawbar(-0.6, -0.95, 0.5)
        for k in range(3):
            y = -0.3 + k * 0.32
            x = -0.1 + k * 0.08
            box((0.06, 0.06, 0.4), (x, y, 0.32), CHARC)
            with at((x - 0.06, y, 0.06), rz=-20):
                slab([(0, 0), (0.28, 0.0), (0.32, 0.12), (0.2, 0.3), (0.02, 0.26)], 0.05, (0, 0, 0), STEEL, ry=0, bevel=0.01, **MT)
        with at((0.24, 0.45, 0.2)):
            rk.wheel("spoke", 0.2, 0.08, acc=RED, side=1, centred=True)
        box((0.32, 0.05, 0.05), (0.12, 0.45, 0.2), CHARC)


def seeder():
    with at((0, 0, 0), rz=-75):
        box((1.2, 0.5, 0.1), (0, 0, 0.32), CHARC, bevel=0.02)
        box((1.0, 0.42, 0.36), (0, 0, 0.55), YEL_T, bevel=0.06, **GL)
        box((1.08, 0.4, 0.06), (0, 0, 0.74), GREEN_T, bevel=0.02, **GL)
        for i in range(4):
            x = -0.42 + i * 0.28
            cyl(0.03, 0.25, (x, 0.0, 0.1), CHARC, n=5)
            with at((x, -0.18, 0.12)):
                rk.wheel("slick", 0.1, 0.05, acc=YEL_T, side=1, centred=True)
        _wheelpair(0.68, 0.1, 0.24, 0.12)
        _drawbar(-0.25, -0.75, 0.32)


def sprayer():
    with at((0, 0, 0), rz=-75):
        box((0.7, 1.0, 0.1), (0, 0, 0.45), CHARC, bevel=0.02)
        with at((0, 0.0, 0.85), rx=90):
            lathe([(0, -0.42), (0.28, -0.4), (0.34, -0.3), (0.34, 0.3), (0.28, 0.4), (0, 0.42)], (0, 0, 0), C(246, 244, 238), n=12, **GL)
        cyl(0.1, 0.08, (0, -0.1, 1.17), YEL_T, n=8)
        for s in (-1, 1):
            tube([(s * 0.3, 0.5, 0.6), (s * 0.8, 0.5, 0.6), (s * 1.3, 0.5, 0.62)], lambda t: 0.025, YEL_T, rings=4, n=5)
            for k in range(5):
                cone(0.03, 0.06, (s * (0.4 + 0.2 * k), 0.5, 0.58), CHARC, n=5, rx=180)
        _wheelpair(0.44, 0.15, 0.3, 0.14)
        _drawbar(-0.5, -0.85, 0.45)


def baler(with_bale=True):
    with at((0, 0, 0), rz=-75):
        box((0.55, 1.3, 0.55), (0, 0.1, 0.75), RED, bevel=0.06, **GL)
        box((0.5, 0.3, 0.4), (-0.5, -0.25, 0.5), RED, bevel=0.05, **GL)  # pickup housing
        cyl(0.13, 0.7, (-0.85, -0.25, 0.22), CHARC, n=8, ry=90)  # pickup reel
        for k in range(8):
            with at((-0.5, -0.25, 0.22), rx=k * 45):
                box((0.68, 0.02, 0.05), (0, 0, 0.15), STEEL, **MT)
        box((0.4, 0.1, 0.3), (0, 0.8, 0.72), CHARC)
        for i in range(3):
            box((0.12, 0.02, 0.6), (0.15, -0.3 + 0.35 * i, 0.75), CREAM)
        _wheelpair(0.36, 0.2, 0.28, 0.14)
        _drawbar(-0.6, -1.0, 0.45)
        if with_bale:
            with at((0, 1.15, 0.0), rz=90, s=0.7):
                props.hay("square")


def wagon(load=None):
    with at((0, 0, 0), rz=-75):
        box((0.9, 1.4, 0.1), (0, 0, 0.5), WOOD, bevel=0.03)
        for x in (-0.45, 0.45):
            for i in range(2):
                box((0.04, 1.4, 0.1), (x, 0, 0.62 + i * 0.14), WOOD_D if i else WOOD, bevel=0.015)
            for y in (-0.6, 0.0, 0.6):
                box((0.06, 0.06, 0.35), (x, y, 0.68), RED, bevel=0.01)
        for y in (-0.7, 0.7):
            box((0.9, 0.04, 0.3), (0, y, 0.68), RED, bevel=0.015)
        _wheelpair(0.42, -0.42, 0.26, 0.12, acc=RED, kind="spoke")
        _wheelpair(0.42, 0.42, 0.26, 0.12, acc=RED, kind="spoke")
        _drawbar(-0.7, -1.15, 0.45)
        if load == "hay":
            for k, (x, y, z) in enumerate(((-0.2, -0.32, 0.55), (0.2, -0.32, 0.55), (-0.2, 0.32, 0.55), (0.2, 0.32, 0.55), (0, 0, 0.97))):
                with at((x, y, z), rz=90, s=0.5):
                    props.hay("square")
        elif load == "pumpkins":
            for x, y, s in ((-0.2, -0.3, 0.4), (0.2, -0.25, 0.45), (-0.15, 0.3, 0.42), (0.2, 0.3, 0.38), (0.0, 0.0, 0.5)):
                with at((x, y, 0.53)):
                    gourds.gourd("round", "orange", "stub", s=s)


def combine():
    main = GREEN_T
    with at((0, 0, 0), rz=-35):
        box((1.0, 1.9, 0.9), (0, 0.15, 1.05), main, bevel=0.12, **GL)
        box((0.9, 0.7, 0.3), (0, 0.6, 1.6), YEL_T, bevel=0.08, **GL)  # grain tank lid
        # cab
        box((0.62, 0.6, 0.62), (0, -0.55, 1.75), main, bevel=0.06, **GL)
        box((0.56, 0.03, 0.46), (0, -0.86, 1.78), WIN, rough=0.2)
        for x in (-0.315, 0.315):
            box((0.03, 0.5, 0.42), (x, -0.55, 1.78), WIN, rough=0.2)
        box((0.7, 0.68, 0.08), (0, -0.55, 2.1), YEL_T, bevel=0.03, **GL)
        cyl(0.06, 0.08, (0.2, -0.4, 2.14), ORANGE, n=8, emit=0.3)
        # header + reel
        box((2.0, 0.5, 0.28), (0, -1.15, 0.38), YEL_T, bevel=0.05, **GL)
        box((2.0, 0.08, 0.12), (0, -1.4, 0.22), CHARC)
        for k in range(9):
            cone(0.04, 0.16, (-0.9 + k * 0.225, -1.48, 0.22), STEEL, n=4, rx=90, **MT)
        cyl(0.18, 1.9, (-0.95, -1.2, 0.72), C(220, 60, 50), n=8, ry=90)
        for k in range(6):
            with at((0, -1.2, 0.72), rx=k * 60):
                box((1.9, 0.04, 0.06), (0, 0, 0.2), C(220, 60, 50))
        for s in (-1, 1):
            box((0.06, 0.6, 0.5), (s * 1.0, -1.15, 0.5), YEL_T, bevel=0.02)
        # unloading auger
        tube([(0.5, 0.8, 1.6), (0.9, 0.8, 1.9), (1.4, 0.4, 2.0)], lambda t: 0.08, main, rings=6, n=8)
        cyl(0.06, 0.4, (0, 0.8, 1.7), CHARC, n=6)
        _wheelpair(0.6, -0.35, 0.58, 0.34)
        _wheelpair(0.48, 0.85, 0.34, 0.2)


def pickup(paint=C(90, 150, 200), load=True):
    with at((0, 0, 0), rz=-35):
        box((0.92, 2.0, 0.42), (0, 0, 0.62), paint, bevel=0.12, **GL)  # lower body
        box((0.84, 0.75, 0.5), (0, -0.2, 1.05), paint, bevel=0.1, **GL)  # cab
        box((0.76, 0.03, 0.34), (0, -0.585, 1.08), WIN, rough=0.2, rx=-12)
        for x in (-0.425, 0.425):
            box((0.03, 0.56, 0.3), (x, -0.2, 1.1), WIN, rough=0.2)
        box((0.86, 0.1, 0.14), (0, -1.02, 0.52), CREAM, bevel=0.04)  # bumper
        for s in (-1, 1):
            cyl(0.07, 0.04, (s * 0.3, -1.0, 0.68), C(255, 244, 190), n=8, rx=90, emit=0.2)
        box((0.8, 0.84, 0.06), (0, 0.55, 0.85), CHARC)  # bed floor
        for x in (-0.44, 0.44):
            box((0.05, 0.84, 0.2), (x, 0.55, 0.93), paint, bevel=0.02)
        box((0.9, 0.05, 0.22), (0, 0.98, 0.93), paint, bevel=0.02)
        _wheelpair(0.46, -0.6, 0.27, 0.2, acc=CREAM)
        _wheelpair(0.46, 0.6, 0.27, 0.2, acc=CREAM)
        if load:
            with at((-0.15, 0.55, 0.88), s=0.55):
                props.crate("pumpkins")
            with at((0.22, 0.5, 0.88), s=0.55):
                props.hay("square")


def quad(paint=RED):
    with at((0, 0, 0), rz=-35):
        box((0.5, 1.0, 0.25), (0, 0, 0.45), paint, bevel=0.08, **GL)
        for y in (-0.42, 0.42):
            box((0.86, 0.36, 0.08), (0, y, 0.62), paint, bevel=0.03, **GL)  # mudguards
            box((0.7, 0.26, 0.05), (0, y, 0.7), CHARC, bevel=0.015)  # racks
        box((0.3, 0.5, 0.14), (0, 0.08, 0.66), BLACK_G, bevel=0.05)  # seat
        tube([(0, -0.28, 0.6), (0, -0.36, 0.86)], lambda t: 0.03, CHARC, rings=2, n=6)
        tube([(-0.28, -0.4, 0.88), (0.28, -0.4, 0.88)], lambda t: 0.025, CHARC, rings=2, n=6)
        for s in (-1, 1):
            cyl(0.035, 0.1, (s * 0.28, -0.4, 0.88), BLACK_G, n=6, ry=90)
        box((0.3, 0.06, 0.12), (0, -0.52, 0.52), CHARC)
        for s in (-1, 1):
            cyl(0.05, 0.04, (s * 0.12, -0.53, 0.56), C(255, 244, 190), n=8, rx=90, emit=0.2)
        _wheelpair(0.38, -0.42, 0.22, 0.2, acc=CREAM, kind="knobbly")
        _wheelpair(0.38, 0.42, 0.22, 0.2, acc=CREAM, kind="knobbly")
