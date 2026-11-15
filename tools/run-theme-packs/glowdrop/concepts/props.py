"""Collecting props (nets, jars, tanks, display pieces), collectible FX and habitat pieces."""
import bpy

from common import *  # noqa: F401,F403
import bugs
import sea
import shrooms

WOOD, WOOD2, BRASS, CLOTH = C(170, 120, 80), C(130, 90, 70), C(230, 180, 90), C(230, 220, 200)


def glass(o, tint=(0.8, 0.92, 1.0), alpha=None, glow=0.0):
    """Opaque 'glassy' stand-in: the game can't render transparency, so glass is a
    pale glossy tint (or a glowing tint when something bright is inside)."""
    m = bpy.data.materials.new("glassy")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    lin = tuple(c ** 2.2 for c in tint)
    b.inputs["Base Color"].default_value = (*lin, 1)
    b.inputs["Roughness"].default_value = 0.15
    if glow:
        b.inputs["Emission Color"].default_value = (*lin, 1)
        b.inputs["Emission Strength"].default_value = glow
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def water(o, alpha=0.4):
    return glass(o, (0.25, 0.45, 0.9), alpha)


# ---------------------------------------------------------------- tools

def bug_net():
    with at((0, 0, 0), ry=-25):
        cyl(0.018, 0.75, (0, 0, 0.0), WOOD, n=6)
        torus(0.13, 0.012, (0, 0, 0.88), BRASS, n=12, k=4, rx=80)
        with at((0, 0, 0.88), rx=80):
            o = lathe([(0.13, 0), (0.11, -0.1), (0.06, -0.2), (0, -0.23)], (0, 0, 0), CLOTH, n=10, cap=False)
            for zz, rr in ((-0.06, 0.12), (-0.13, 0.095)):  # net bands
                torus(rr, 0.006, (0, 0, zz), C(180, 180, 200), n=12, k=4)
        glass(o, (0.95, 0.95, 1.0))
        cyl(0.024, 0.12, (0, 0, 0.0), C(80, 120, 160), n=6)


def fishing_rod():
    with at((0, 0, 0), ry=-35):
        cyl(0.02, 0.9, (0, 0, 0), WOOD, n=6, r2=0.01)
        cyl(0.03, 0.18, (0, 0, 0.0), C(80, 120, 160), n=6)
        cyl(0.04, 0.03, (0.035, 0, 0.18), BRASS, n=8, rx=90)
    tip = V(math.sin(math.radians(-35)) * 0.9, 0, math.cos(math.radians(-35)) * 0.9)
    tube([tip, tip + V(-0.05, 0, -0.3), tip + V(-0.04, 0, -0.55)], lambda t: 0.003, ICE, rings=4, n=3)
    b = tip + V(-0.04, 0, -0.6)
    ell(b, 0.04, (1, 1, 1), seg=8, ring=6)
    ell(b + V(0, 0, 0.03), (0.042, 0.042, 0.025), CYAN, seg=8, ring=5, emit=GLOW)


def field_guide():
    box((0.3, 0.22, 0.05), (0, 0, 0.025), C(60, 90, 130), bevel=0.012)
    box((0.29, 0.21, 0.04), (0.006, 0, 0.026), CLOTH)
    box((0.31, 0.04, 0.052), (0, -0.09, 0.026), C(50, 70, 110), bevel=0.01)
    ell((0.02, 0.0, 0.052), (0.05, 0.05, 0.008), CYAN, seg=8, ring=4, emit=GLOW)
    box((0.02, 0.03, 0.002), (0.13, 0.04, 0.06), C(220, 90, 90))


def lantern():
    cyl(0.1, 0.03, (0, 0, 0), BRASS, n=8)
    o = cyl(0.085, 0.2, (0, 0, 0.03), ICE, n=8)
    glass(o, (1.0, 0.85, 0.55), glow=0.8)
    ell((0, 0, 0.12), (0.04, 0.04, 0.06), AMBER, seg=8, ring=6, emit=GLOW * 1.4)
    for x, y, z, a in ring_of(4, 0.085, 0.03, math.pi / 8):
        cyl(0.008, 0.2, (x, y, z), BRASS, n=4)
    cone(0.11, 0.08, (0, 0, 0.23), BRASS, n=8)
    torus(0.04, 0.008, (0, 0, 0.34), BRASS, n=8, k=4, rx=90)


def jar(content=None):
    tint, glow = {None: ((0.78, 0.88, 0.98), 0.0), "firefly": (LIME, 0.9), "mushroom": (AMBER, 0.9), "jelly": (CYAN, 0.9)}[content]

    def f():
        o = lathe([(0.0, 0.0), (0.11, 0.0), (0.12, 0.03), (0.12, 0.22), (0.09, 0.26), (0.08, 0.29)], (0, 0, 0), ICE, n=12)
        glass(o, tint, glow=glow)
        tube([(0.07, -0.095, 0.05), (0.07, -0.095, 0.2)], lambda t: 0.012, (1, 1, 1), rings=2, n=4)  # shine stripe
        cyl(0.088, 0.04, (0, 0, 0.28), BRASS, n=12)
        torus(0.088, 0.012, (0, 0, 0.3), WOOD2, n=12, k=4)
        if content:  # a little silhouette of what is inside, pressed to the front
            with at((0.0, -0.105, 0.13), s=0.5):
                ell((0, 0, 0), (0.08, 0.02, 0.06), tuple(c * 0.35 for c in tint), seg=8, ring=5)
            box((0.09, 0.01, 0.05), (0.0, -0.118, 0.06), CLOTH, rx=0)  # paper label
    return f


def terrarium():
    box((0.5, 0.32, 0.04), (0, 0, 0.02), WOOD, bevel=0.01)
    for x in (-0.235, 0.235):
        for y in (-0.145, 0.145):
            box((0.02, 0.02, 0.34), (x, y, 0.21), WOOD)
    box((0.48, 0.02, 0.34), (0, 0.145, 0.21), C(60, 80, 90))  # back panel, front left open
    box((0.46, 0.28, 0.06), (0, 0, 0.07), C(90, 70, 60))
    with at((-0.12, 0.0, 0.07), s=0.42):
        shrooms.moon_disc(3)
    with at((0.1, 0.04, 0.07), s=0.38):
        shrooms.coral_fungus(3)
    with at((0.08, -0.06, 0.1), s=0.9, rz=-30):
        bugs.glowworm(1)
    box((0.5, 0.32, 0.03), (0, 0, 0.39), WOOD, bevel=0.01)


def aquarium(size):
    def f():
        w, d, h = {"small": (0.35, 0.22, 0.25), "medium": (0.6, 0.3, 0.35), "large": (0.95, 0.38, 0.45)}[size]
        box((w + 0.04, d + 0.04, 0.05), (0, 0, 0.025), C(60, 70, 100), bevel=0.012)
        box((w, 0.02, h * 0.85), (0, d / 2, 0.05 + h * 0.425), C(60, 120, 210), emit=0.6)  # glowing water back wall
        for x in (-w / 2, w / 2):
            box((0.02, d, h * 0.85), (x, 0, 0.05 + h * 0.425), C(50, 100, 180), emit=0.15)
            box((0.03, d + 0.03, h), (x, 0, 0.05 + h / 2), C(60, 70, 100))
        box((w, d, 0.04), (0, 0, 0.07), SAND)
        for y in (-d / 2, d / 2):  # open-top rim
            box((w + 0.04, 0.03, 0.03), (0, y, 0.05 + h + 0.015), C(60, 70, 100))
        with at((-w * 0.3, 0, 0.09), s={"small": 0.24, "medium": 0.34, "large": 0.44}[size]):
            from plants import kelp
            kelp(3)
        fish = [sea.guppy] if size == "small" else [sea.lanternfish, sea.guppy] if size == "medium" else [sea.lanternfish, sea.anglerfish, sea.guppy]
        for i, fn in enumerate(fish):
            with at((-w * 0.15 + w * 0.3 * i, -d * 0.1, h * 0.15 + 0.05 * (i % 2)), s={"small": 0.42, "medium": 0.5, "large": 0.6}[size], rz=22):
                fn()
        sparkles((w * 0.35, 0, h * 0.4), 4, 0.04, 0.012, ICE, seed=8)
    return f


def plinth():
    cyl(0.2, 0.06, (0, 0, 0), C(220, 214, 230), n=8)
    cyl(0.16, 0.3, (0, 0, 0.06), C(236, 232, 244), n=8, r2=0.15)
    cyl(0.2, 0.05, (0, 0, 0.36), C(220, 214, 230), n=8)
    box((0.14, 0.012, 0.05), (0.0, -0.16, 0.14), BRASS, rx=-10)
    with at((0, 0, 0.41), s=0.55):
        shrooms.umbrella(2)


def display_case():
    box((0.5, 0.3, 0.32), (0, 0, 0.16), WOOD2, bevel=0.015)
    box((0.52, 0.32, 0.03), (0, 0, 0.335), WOOD)
    for x in (-0.225, 0.225):
        for y in (-0.125, 0.125):
            box((0.02, 0.02, 0.26), (x, y, 0.48), WOOD)
    box((0.46, 0.02, 0.26), (0, 0.125, 0.48), C(70, 60, 90))
    with at((-0.11, 0, 0.35), s=0.75, rz=-20):
        bugs.moth(2)
    cyl(0.01, 0.12, (0.12, 0.0, 0.35), BRASS, n=5)
    with at((0.12, 0.0, 0.47 - 0.32 * 0.55), s=0.55, rz=-20):
        sea.hatchetfish()
    box((0.5, 0.3, 0.025), (0, 0, 0.62), WOOD, bevel=0.008)


# ---------------------------------------------------------------- collectible FX

def shadow(k):
    def f():
        box((1.3, 0.9, 0.02), (0, 0, -0.01), C(170, 160, 150))
        lathe([(0.1 * k, 0), (0.1 * k, 0.004), (0, 0.004)], (0, 0, 0.001), C(40, 40, 60), n=12, sx=1.7 if k < 5 else 1.2)
        if k == 6:  # the big one gets a fin
            slab([(0, 0), (0.08, 0), (0.02, 0.1)], 0.02, (0.05, 0, 0.0), C(40, 40, 60))
    return f


def spawn_sparkle():
    for x, y, z, a in [(0, 0, 0.18, 0), (0.12, 0.05, 0.1, 30), (-0.1, -0.03, 0.08, 15)]:
        k = 1.0 if x == 0 else 0.55
        pts = []
        for i in range(8):
            r = (0.1 if i % 2 == 0 else 0.03) * k
            t = math.pi * i / 4
            pts.append((r * math.cos(t), r * math.sin(t)))
        slab(pts, 0.02, (x, y, z), ICE, rz=-30, emit=GLOW)


def bubbles():
    R = rng(4)
    for i in range(7):
        p = (R.uniform(-0.05, 0.05), R.uniform(-0.05, 0.05), 0.05 + 0.07 * i)
        o = ell(p, 0.02 + 0.01 * (i % 3), ICE, seg=8, ring=6)
        glass(o, (0.75, 0.88, 1.0))
        ell(V(p) + V(0.008, -0.01, 0.012), 0.006, (1, 1, 1), seg=5, ring=4, emit=1.0)


def ripple():
    lathe([(0.3, 0), (0.3, 0.004), (0, 0.004)], (0, 0, 0), C(40, 70, 130), n=14)
    for k, r in enumerate((0.08, 0.15, 0.22)):
        torus(r, 0.008, (0, 0, 0.008), ICE, n=16, k=4, emit=GLOW * (1 - 0.25 * k))


# ---------------------------------------------------------------- habitat

def pond(size):
    def f():
        r = {"small": 0.4, "medium": 0.6, "large": 0.85}[size]
        R = rng(int(r * 10))
        lathe([(r * 0.98, 0.0), (r, 0.07), (r + 0.1, 0.06), (r + 0.12, 0)], (0, 0, 0), MOSS, n=12, sx=1.2, cap=False)
        lathe([(r, 0.0), (0, 0.0)], (0, 0, 0.0), C(30, 40, 80), n=12, sx=1.2)
        lathe([(r, 0.045), (0, 0.045)], (0, 0, 0.0), C(40, 80, 150), n=12, sx=1.2, emit=0.12)
        for x, y, z, a in ring_of(int(r * 16), r + 0.04, 0.06):
            ell((x * 1.2, y, z), R.uniform(0.05, 0.08), STONE, seg=6, ring=4)
        with at((r * 0.3, -r * 0.1, 0.0), s=0.8):
            from plants import lotus
            lotus(3)
        for i in range(int(r * 6)):
            ell((R.uniform(-r, r) * 0.7, R.uniform(-r, r) * 0.5, 0.075), 0.015, CYAN, seg=5, ring=4, emit=GLOW)
    return f


def shore(kind):
    def f():
        if kind == "straight":
            box((0.6, 0.3, 0.07), (0, 0.15, 0.035), MOSS)
            box((0.6, 0.3, 0.03), (0, -0.15, 0.015), C(40, 80, 150), emit=0.12)
            for i in range(5):
                ell((-0.24 + 0.12 * i, 0.0, 0.06), 0.06, STONE, seg=6, ring=4)
        else:
            slab([(0, 0), (0.6, 0), (0.6, 0.3), (0.3, 0.3), (0.3, 0.6), (0, 0.6)], 0.07, (-0.3, 0, 0.035), MOSS, rx=-90)
            slab([(0.3, 0.3), (0.6, 0.3), (0.6, 0.6), (0.3, 0.6)], 0.03, (-0.3, 0, 0.015), C(40, 80, 150), rx=-90, emit=0.12)
            for x, y in ((0.0, 0.3), (0.0, 0.18), (0.0, 0.06), (0.12, 0.0), (0.24, 0.0)):
                ell((x, -y, 0.06), 0.06, STONE, seg=6, ring=4)
    return f


def mossy_log():
    with at((0, 0, 0.14), ry=90, rz=20):
        cyl(0.14, 0.8, (0, 0, -0.4), BARK, n=8)
        cyl(0.11, 0.81, (0, 0, -0.405), C(190, 150, 110), n=8)
    for x in (-0.25, 0.0, 0.2):
        ell((x * math.cos(0.35), x * math.sin(0.35), 0.25), (0.12, 0.08, 0.04), MOSS, seg=7, ring=4)
    with at((0.05, -0.02, 0.27), s=0.35):
        shrooms.fairy_ring(2)


def stump():
    cyl(0.22, 0.3, (0, 0, 0), BARK, n=8, r2=0.18)
    lathe([(0.17, 0.3), (0, 0.31)], (0, 0, 0), C(200, 160, 120), n=8)
    for k in (0.06, 0.11):
        torus(k, 0.006, (0, 0, 0.31), C(160, 120, 90), n=8, k=3)
    for x, y, z, a in ring_of(4, 0.24, 0.0, 0.4):
        tube([(x * 0.7, y * 0.7, 0.08), (x * 1.3, y * 1.3, 0.0)], lambda t: 0.05 * (1 - 0.5 * t), BARK, rings=3, n=6)
    with at((0.0, -0.18, 0.12), rz=0):
        torus(0.07, 0.015, (0, 0, 0), CYAN, n=10, k=4, arc=180, rz=180, emit=GLOW)


def rocks():
    for (x, y, r, h) in ((0, 0, 0.18, 0.2), (0.2, 0.08, 0.12, 0.14), (-0.16, 0.1, 0.1, 0.1), (0.1, -0.15, 0.08, 0.07)):
        ell((x, y, h * 0.6), (r, r * 0.9, h), STONE, seg=6, ring=4)
    for x, y in ((0.05, -0.05), (0.18, 0.0), (-0.1, 0.02)):
        ell((x, y, 0.26 if x == 0.05 else 0.18), 0.02, MINT, seg=5, ring=4, emit=GLOW)


def stalagmites():
    lathe([(0.35, 0), (0.33, 0.04), (0, 0.05)], (0, 0, 0), STONE, n=9)
    for (x, y, r, h) in ((0, 0, 0.09, 0.6), (0.15, 0.06, 0.06, 0.35), (-0.14, 0.08, 0.07, 0.42), (0.06, -0.15, 0.05, 0.25)):
        lathe([(r, 0), (r * 0.7, h * 0.5), (r * 0.25, h * 0.9), (0, h)], (x, y, 0.04), C(130, 130, 170), n=6)
        ell((x, y, h + 0.04), 0.015, CYAN, seg=5, ring=4, emit=GLOW)


def driftwood():
    tube([(-0.35, 0.0, 0.05), (-0.1, 0.05, 0.08), (0.15, -0.02, 0.06), (0.35, 0.05, 0.1)], lambda t: 0.06 * (1 - 0.5 * t), C(200, 190, 180), rings=8, n=6)
    tube([(0.0, 0.04, 0.08), (0.08, 0.15, 0.18)], lambda t: 0.03 * (1 - 0.6 * t), C(200, 190, 180), rings=3, n=5)
    for x in (-0.2, 0.05):
        ell((x, 0.0, 0.12), 0.018, LIME, seg=5, ring=4, emit=GLOW)


def tide_pool():
    lathe([(0.42, 0), (0.4, 0.08), (0.3, 0.1), (0, 0.1)], (0, 0, 0), STONE, n=10, sx=1.2)
    lathe([(0.3, 0.06), (0, 0.06)], (0, 0, 0.04), C(40, 80, 150), n=10, sx=1.2, emit=0.12)
    with at((0.1, 0.0, 0.08), s=0.45):
        sea.upside_down(2)
    with at((-0.15, 0.05, 0.06), s=0.4):
        from plants import coral
        coral("fan")(3)


D = dict(dark=True, shared=False)
BOARDS = [
    ("13-collecting", "Collecting props: catch it, keep it, show it off", D, [
        ("Tools", [("bug net", bug_net), ("fishing rod", fishing_rod), ("field guide", field_guide), ("lantern", lantern)]),
        ("Jars", [("empty", jar()), ("firefly", jar("firefly")), ("mushroom", jar("mushroom")), ("jelly", jar("jelly"))]),
        ("Display", [("terrarium", terrarium), ("museum plinth", plinth), ("display case", display_case)]),
        ("Aquariums", [("small", aquarium("small")), ("medium", aquarium("medium")), ("large", aquarium("large"))]),
    ]),
    ("14-fx-habitat", "Collectible FX and habitat pieces", D, [
        ("Ground shadows, sizes 1 to 6 (shared scale)", [(f"size {k}", shadow(k)) for k in range(1, 7)], {"shared": True}),
        ("FX", [("spawn sparkle", spawn_sparkle), ("bubbles", bubbles), ("ripple ring", ripple)]),
        ("Water", [("pond S", pond("small")), ("pond M", pond("medium")), ("pond L", pond("large")), ("shore straight", shore("straight")),
                   ("shore corner", shore("corner")), ("tide pool", tide_pool)]),
        ("Ground", [("mossy log", mossy_log), ("stump", stump), ("rock cluster", rocks), ("stalagmites", stalagmites), ("driftwood", driftwood)]),
    ]),
]
