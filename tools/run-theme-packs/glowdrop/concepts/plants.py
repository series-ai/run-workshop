"""Glowing plants and corals: growth stages (seed -> sprout -> bud -> bloom -> seed pod)."""
from common import *  # noqa: F401,F403

STAGES = ["seed", "sprout", "bud", "bloom", "seed pod"]
LEAF, LEAF2, PALE = C(70, 150, 110), C(56, 124, 120), C(226, 220, 250)
WATER, SANDY = C(40, 70, 130), C(120, 110, 140)


def fat_leaves(n, length, w, z=0.07, rgb=LEAF, lift=0.3, phase=0.0):
    """Chunky rounded leaves in a rosette (flattened ellipsoids, not blades)."""
    for x, y, zz, a in ring_of(n, 1.0, 0, phase):
        c = V(x * length * 0.55, y * length * 0.55, z + length * lift * 0.5)
        ell(c, (length * 0.55, w * 0.5, 0.018), rgb, seg=8, ring=4, rz=a, ry=-math.degrees(math.atan2(lift, 1)) * 0.8)


def seed(rgb=C(150, 120, 90), glow=None):
    pad(r=0.26, seed=40)
    ell((0, 0, 0.1), (0.05, 0.05, 0.035), C(90, 70, 60), seg=7, ring=5)  # little dirt bump
    ell((0.0, -0.02, 0.13), (0.035, 0.03, 0.045), rgb, seg=6, ring=5, emit=GLOW if glow else 0.0, ry=20)
    if glow:
        ell((0.0, -0.02, 0.13), (0.037, 0.032, 0.047), glow, seg=6, ring=5, emit=GLOW * 0.6)


def leaves(n, length, w, z=0.07, rgb=LEAF, lift=0.35, phase=0.0, bend=0.03):
    for x, y, zz, a in ring_of(n, 1.0, 0, phase):
        base = V(x * 0.03, y * 0.03, z)
        tip = V(x * length, y * length, z + length * lift)
        blade(base, tip, w, rgb, side=(0, 0, 1), bend=bend)


def stalk(h, r=0.022, rgb=LEAF2, bend=0.0):
    tube([(0, 0, 0.05), (bend, 0, h * 0.55), (bend * 0.4, 0, h)], lambda t: r * (1 - 0.35 * t), rgb, rings=6, n=6)
    return V(bend * 0.4, 0, h)


# ---------------------------------------------------------------- plants

def moonflower(st):
    if st == 0:
        return seed(glow=LAVENDER)
    pad(r=0.26, seed=41)
    h = [0, 0.18, 0.4, 0.5, 0.5][st]
    leaves(2 + min(st, 3), [0.12, 0.2, 0.24, 0.24, 0.22][st], 0.12, phase=0.4)
    top = stalk(h, bend=0.04)
    if st == 2:
        lathe([(0.02, 0), (0.05, 0.05), (0.04, 0.14), (0, 0.2)], top, PALE, n=6, twist=120)
    elif st == 3:
        with at(top, ry=-10):
            lathe([(0.02, 0), (0.05, 0.06), (0.1, 0.13), (0.17, 0.19), (0.19, 0.21)], (0, 0, 0), LAVENDER, n=10, lobes=5, lobe_depth=0.3, emit=0.45)
            lathe([(0.02, 0.06), (0.08, 0.135), (0.0, 0.135)], (0, 0, 0), ICE, n=10, emit=GLOW * 0.7)
            ell((0, 0, 0.12), 0.035, AMBER, seg=6, ring=4, emit=GLOW)
    elif st == 4:
        ell(top + V(0, 0, 0.07), 0.08, C(170, 160, 120), seg=8, ring=6)
        for x, y, z, a in ring_of(7, 0.07, 0):
            cone(0.018, 0.05, top + V(x, y, 0.07 + (0.03 if a % 2 else -0.02)), C(200, 190, 140), n=4, rz=a, ry=80)
        sparkles(top + V(0, 0, 0.12), 6, 0.12, 0.02, ICE, seed=3)


def glowbulb(st):
    if st == 0:
        return seed(glow=CYAN)
    pad(r=0.26, seed=42)
    fat_leaves(4 + min(st, 2), [0.12, 0.17, 0.2, 0.2, 0.19][st], 0.13, phase=0.3)
    if st == 1:
        return
    h = [0, 0, 0.26, 0.36, 0.36][st]
    tube([(0, 0, 0.05), (-0.03, 0, h * 0.6), (0, 0, h)], lambda t: 0.034 * (1 - 0.3 * t), LEAF2, rings=6, n=6)
    top = V(0, 0, h)
    if st == 2:
        ell(top + V(0, 0, 0.05), (0.07, 0.07, 0.08), LEAF, seg=8, ring=6)
        ell(top + V(0, 0, 0.11), 0.02, CYAN, seg=6, ring=4, emit=GLOW)
    elif st == 3:
        for x, y, z, a in ring_of(5, 0.07, 0, 0.2):  # leafy collar
            ell(top + V(x, y, 0.03), (0.07, 0.04, 0.02), LEAF, seg=7, ring=4, rz=a, ry=-30)
        ell(top + V(0, 0, 0.13), (0.14, 0.14, 0.14), CYAN, seg=10, ring=8, emit=SOFT * 1.6)
        ell(top + V(0, 0, 0.13), 0.07, ICE, seg=8, ring=6, emit=GLOW)
    else:
        ell(top + V(0, 0, 0.09), (0.1, 0.1, 0.08), C(120, 170, 190), seg=9, ring=6)
        for x, y, z, a in ring_of(4, 0.08, 0):
            tube([top + V(x * 0.8, y * 0.8, 0.05), top + V(x * 1.3, y * 1.3, -0.04)], lambda t: 0.008, LEAF2, rings=2, n=4)
            ell(top + V(x * 1.3, y * 1.3, -0.07), 0.03, CYAN, seg=7, ring=5, emit=GLOW)


def fiddlehead(st):
    if st == 0:
        return seed(glow=MINT)
    pad(r=0.26, seed=43)

    def frond(a, h, curl, lean, pads):
        d = V(math.cos(a), math.sin(a), 0)
        base = V(0, 0, 0.05)
        top = d * lean + V(0, 0, h)
        tube([base, d * lean * 0.3 + V(0, 0, h * 0.6), top], lambda t: 0.035 * (1 - 0.25 * t), LEAF, rings=6, n=6)
        side = d.cross(V(0, 0, 1)).normalized()
        for k in range(pads):  # round leaf pads along the frond
            t = 0.35 + 0.55 * k / max(1, pads - 1)
            p = base.lerp(top, t) + d * 0.01
            for s in (-1, 1):
                ell(p + side * s * 0.06, (0.05, 0.035, 0.016), LEAF2 if k % 2 else LEAF, seg=7, ring=4, rz=math.degrees(a) + s * 70, ry=-15)
                if st == 4:
                    ell(p + side * s * 0.06 + V(0, 0, 0.018), 0.014, MINT, seg=5, ring=4, emit=GLOW)
        # the curl on top: a fat glowing spiral knob
        tube([top, top + d * 0.05 + V(0, 0, 0.05), top + d * 0.08 + V(0, 0, 0.0)], lambda t: 0.032 - 0.01 * t, LEAF, rings=5, n=6)
        ell(top + d * 0.055 + V(0, 0, 0.01), curl, MINT, seg=8, ring=6, emit=GLOW)

    if st in (1, 2):
        for i in range(1 if st == 1 else 3):
            frond(i * 2.1 + 0.3, 0.1 if st == 1 else 0.18, 0.04, 0.02, 0)
        return
    for i in range(3):
        frond(i * 2.1 + 0.3, 0.3, 0.05, 0.12, 3)


def lantern_vine(st):
    if st == 0:
        return seed(glow=AMBER)
    pad(r=0.26, seed=44)
    cyl(0.045, 0.5, (0.0, 0.0, 0.05), C(170, 130, 95), n=7)  # chunky little post
    ell((0, 0, 0.56), (0.055, 0.055, 0.03), C(170, 130, 95), seg=7, ring=4)
    h = [0, 0.14, 0.32, 0.48, 0.48][st]
    pts = [(0.07 * math.cos(t * 4.5), 0.07 * math.sin(t * 4.5), 0.06 + h * t) for t in [i / 9 for i in range(10)]]
    tube(pts, lambda t: 0.024, LEAF2, rings=14, n=6)
    for i, p in enumerate(pts[2::2]):
        p = V(p)
        out = V(p.x, p.y, 0).normalized()
        ell(p + out * 0.05, (0.05, 0.035, 0.016), LEAF, seg=7, ring=4, rz=math.degrees(math.atan2(out.y, out.x)), ry=-20)
        if st >= 2 and i % 2 == 0:
            q = p + out * 0.06
            k = {2: 0.5, 3: 1.4, 4: 1.25}[st]
            tube([p, q - V(0, 0, 0.03)], lambda t: 0.008, LEAF2, rings=2, n=4)
            rgb, em = (AMBER, SOFT * 1.6) if st == 3 else ((C(150, 190, 110), 0) if st == 2 else (C(200, 160, 110), 0))
            lathe([(0, 0), (0.04 * k, -0.02 * k), (0.05 * k, -0.06 * k), (0.035 * k, -0.1 * k), (0, -0.11 * k)], q - V(0, 0, 0.03), rgb, n=8,
                  lobes=6, lobe_depth=0.15, emit=em)
            cyl(0.015 * k, 0.012, q - V(0, 0, 0.03 + 0.012), C(120, 90, 70), n=6)
            if st == 4:
                sparkles(q - V(0, 0, 0.1), 3, 0.05, 0.016, AMBER, seed=i)


def cattail(st):
    if st == 0:
        return seed(glow=LIME)
    pad(r=0.26, seed=45)
    hs = [0, 0.16, 0.32, 0.42, 0.42][st]
    for i, (x, y, z, a) in enumerate(ring_of(5, 0.05, 0.05, 0.3)):
        hh = hs * (0.75 + 0.25 * (i % 2))
        blade((x, y, 0.05), (x * 2.0, y * 2.0, 0.05 + hh), 0.09, LEAF, side=(x, y, 0), bend=0.02, t=0.02)
    if st >= 2:
        for i, (dx, hh) in enumerate([(-0.025, 0.5), (0.05, 0.42)][: 1 if st == 2 else 2]):
            h = hh * (0.75 if st == 2 else 1.0)
            tube([(dx, 0, 0.05), (dx, 0, h)], lambda t: 0.018, LEAF2, rings=2, n=6)
            if st == 2:
                ell((dx, 0, h), (0.035, 0.035, 0.06), LEAF, seg=7, ring=5)
            elif st == 3:
                lathe([(0.05, -0.08), (0.06, -0.04), (0.06, 0.05), (0.045, 0.09), (0, 0.1)], (dx, 0, h), LIME, n=8, emit=SOFT * 1.6)
                cone(0.012, 0.05, (dx, 0, h + 0.09), LEAF2, n=5)
            else:
                for k in range(5):
                    ell((dx + 0.03 * math.cos(k * 1.3), 0.03 * math.sin(k * 1.3), h + 0.02 * k - 0.02), 0.045, C(240, 236, 228), seg=7, ring=5)
                sparkles((dx, 0, h + 0.1), 4, 0.07, 0.018, LIME, seed=i)


def lotus(st):
    lathe([(0.3, 0), (0.3, 0.04), (0, 0.04)], (0, 0, 0), WATER, n=12)
    if st == 0:
        ell((0, 0, 0.05), (0.05, 0.05, 0.025), C(90, 120, 90), seg=7, ring=4)
        ell((0, 0, 0.07), 0.025, MAGENTA, seg=6, ring=4, emit=GLOW)
        return
    k = [0, 0.6, 0.85, 1.0, 1.0][st]
    with at((0.1, 0.08, 0.045), rz=30):
        lathe([(0.16 * k, 0), (0.16 * k, 0.018), (0, 0.018)], (0, 0, 0), LEAF, n=12)
    if st == 1:
        return
    c = V(-0.05, -0.04, 0.05)
    if st == 2:
        lathe([(0.0, 0), (0.06, 0.04), (0.06, 0.1), (0.03, 0.15), (0, 0.17)], c, C(240, 140, 210), n=7, emit=0.3)
    elif st == 3:
        for ring, (n, ln, tilt, rgb) in enumerate([(8, 0.11, 25, C(240, 140, 210)), (6, 0.08, 50, MAGENTA)]):
            for x, y, z, a in ring_of(n, 1.0, 0, phase=ring * 0.4):
                ell(c + V(x * ln, y * ln, 0.03 + ring * 0.02), (0.06, 0.035, 0.022), rgb, seg=8, ring=5, rz=a, ry=-tilt, emit=GLOW * (0.35 + 0.4 * ring))
        cyl(0.04, 0.05, c + V(0, 0, 0.02), AMBER, n=8, emit=GLOW)
    else:
        tube([c, c + V(0, 0, 0.12)], lambda t: 0.016, LEAF2, rings=2, n=5)
        lathe([(0.04, 0), (0.07, 0.04), (0.075, 0.06), (0, 0.065)], c + V(0, 0, 0.1), C(150, 170, 110), n=9)
        for x, y, z, a in ring_of(5, 0.04, 0):
            ell(c + V(x, y, 0.17), 0.016, MAGENTA, seg=5, ring=4, emit=GLOW)


def star_moss(st):
    pad(r=0.26, seed=46, rgb=C(70, 80, 100))
    if st == 0:
        ell((0, 0, 0.09), 0.025, MINT, seg=6, ring=4, emit=GLOW)
        return
    n = [0, 2, 4, 7, 7][st]
    spots = [(0, 0, 1.0), (0.09, 0.03, 0.8), (-0.08, 0.05, 0.85), (0.03, -0.09, 0.75), (-0.06, -0.07, 0.7), (0.1, -0.06, 0.6), (-0.1, -0.02, 0.65)]
    for i, (x, y, k) in enumerate(spots[:n]):
        r = 0.07 * k
        ell((x, y, 0.07), (r, r, r * 0.75), C(90, 190, 120) if i % 2 else C(70, 165, 105), seg=8, ring=5)
        if st >= 3:
            for xx, yy, zz, a in ring_of(3, r * 0.5, 0, i):
                cyl(0.008, 0.05, (x + xx, y + yy, 0.07 + r * 0.6), LEAF2, n=4)
                ell((x + xx, y + yy, 0.07 + r * 0.6 + 0.06), 0.022, MINT if st == 3 else LAVENDER, seg=6, ring=4, emit=GLOW)
    if st == 4:
        sparkles((0, 0, 0.2), 6, 0.12, 0.018, LAVENDER, seed=7)


def kelp(st):
    lathe([(0.26, 0), (0.24, 0.04), (0.15, 0.06), (0, 0.065)], (0, 0, 0), SANDY, n=9)
    ell((0.0, 0.02, 0.07), (0.1, 0.08, 0.07), STONE, seg=7, ring=5)
    if st == 0:
        ell((0.02, -0.05, 0.12), 0.02, LIME, seg=6, ring=4, emit=GLOW)
        return
    H = [0, 0.2, 0.45, 0.8, 0.8][st]
    for i, (dx, k, ph) in enumerate([(0.0, 1.0, 0), (0.05, 0.75, 1.3), (-0.05, 0.6, 2.4)][: 1 + min(st, 2)]):
        h = H * k
        pts = [(dx + 0.04 * math.sin(ph + t * 6), 0.03 * math.cos(ph + t * 5), 0.1 + h * t) for t in [j / 8 for j in range(9)]]
        tube(pts, lambda t: (0.04 * (1 - 0.5 * t) + 0.01, 0.008), C(110, 150, 70), rings=12, n=6, side=(1, 0, 0))
        if st >= 3:
            for j, p in enumerate(pts[2::2]):
                ell(V(p) + V(0.03, -0.01, 0), 0.025, LIME, seg=6, ring=4, emit=GLOW if st == 3 else GLOW * 0.5)
    if st == 4:
        sparkles((0, 0, H * 0.7), 8, 0.2, 0.016, LIME, seed=11)


def grass(st):
    if st == 0:
        return seed(glow=MAGENTA)
    pad(r=0.26, seed=47)
    H = [0, 0.1, 0.18, 0.24, 0.26][st]
    for i, (x, y, z, a) in enumerate(ring_of(7, 0.06, 0.05, 0.2)):
        h = H * (0.8 + 0.2 * (i % 3) / 2)
        tip = V(x * 2.0, y * 2.0, 0.05 + h)
        blade((x, y, 0.05), tip, 0.07, C(100, 150, 180), side=(x, y, 0), bend=0.015, t=0.02)
        if st == 3 and i % 2 == 0:
            ell(tip + V(0, 0, 0.01), 0.026, LAVENDER, seg=6, ring=4, emit=GLOW)
        if st == 4 and i % 2 == 0:
            tube([tip, tip + V(0, 0, 0.06)], lambda t: 0.008, C(210, 200, 170), rings=2, n=4)
            ell(tip + V(0, 0, 0.09), (0.028, 0.028, 0.04), MAGENTA, seg=7, ring=5, emit=GLOW)


CORAL_STAGES = ["polyp", "bud", "young", "full", "spawning"]


def coral(kind):
    def f(st):
        lathe([(0.26, 0), (0.24, 0.04), (0.15, 0.06), (0, 0.065)], (0, 0, 0), SANDY, n=9)
        k = [0.3, 0.5, 0.72, 1.0, 1.0][st]
        glow = {"branch": MAGENTA, "fan": CYAN, "brain": LIME, "bubble": LAVENDER}[kind]
        if kind == "branch":  # chubby finger coral: a little hand of fat glowing-tipped fingers
            fingers = [(0, 0, 1.0), (0.07, 0.02, 0.8), (-0.06, 0.04, 0.85), (0.03, -0.07, 0.7), (-0.05, -0.05, 0.65)]
            for i, (x, y, h) in enumerate(fingers[:[1, 2, 3, 5, 5][st]]):
                top = V(x * 1.4, y * 1.4, 0.06 + 0.3 * h * k)
                tube([V(x * 0.5, y * 0.5, 0.05), V(x, y, 0.06 + 0.15 * h * k), top], lambda t: 0.042 * (0.6 + 0.4 * k), C(240, 120, 170), rings=6, n=7)
                ell(top, 0.045 * (0.6 + 0.4 * k), glow, seg=8, ring=6, emit=GLOW)
        elif kind == "fan":  # a puffy scallop fan with a glowing frilled rim
            with at((0, 0, 0.06), s=k, rz=15):
                for i in range(7):
                    t = -1.0 + 2.0 * i / 6
                    tip = V(0.17 * math.sin(t), 0, 0.28 * math.cos(t * 0.8))
                    tube([(0, 0, 0.0), tip * 0.55 + V(0, 0, 0.04), tip], lambda u: 0.035, C(120, 100, 210), rings=5, n=6)
                    ell(tip, 0.04, glow, seg=7, ring=5, emit=GLOW)
                ell((0, 0, 0.13), (0.15, 0.03, 0.12), C(130, 110, 220), seg=10, ring=6)
        elif kind == "brain":  # a squishy round dome with fat glowing grooves
            r = 0.17 * k + 0.03
            lathe([(r, 0.0), (r * 1.05, r * 0.4), (r * 0.82, r * 0.82), (r * 0.42, r * 1.02), (0, r * 1.06)], (0, 0, 0.05), C(230, 170, 110), n=12)
            for i in range(3):
                zz = 0.05 + r * (0.45 + 0.25 * i)
                rr = r * (1.0 - 0.28 * i) * (1.02 if i == 0 else 0.95)
                torus(rr, 0.018 * (0.6 + 0.4 * k), (0, 0, zz), glow, n=14, k=5, emit=GLOW, rz=i * 20)
        else:  # bubble coral: a cluster of glowing grape bubbles
            spots = [(0, 0, 0.1, 1.0), (0.07, 0.03, 0.08, 0.8), (-0.06, 0.05, 0.08, 0.8), (0.02, -0.07, 0.07, 0.75), (-0.04, -0.04, 0.16, 0.7),
                     (0.05, -0.02, 0.17, 0.65), (0.0, 0.05, 0.19, 0.6)]
            for i, (x, y, z, kk) in enumerate(spots[:[1, 2, 4, 7, 7][st]]):
                ell((x, y, 0.05 + z * k), 0.06 * kk * (0.6 + 0.4 * k), C(170, 130, 255), seg=8, ring=6, emit=0.3)
                ell((x + 0.015, y - 0.02, 0.05 + z * k + 0.025), 0.012, (1, 1, 1), seg=5, ring=4, emit=1.0)
        if st == 4:
            sparkles((0, 0, 0.36), 7, 0.16, 0.02, glow, seed=4)
    return f


PLANTS = [("Moonflower", moonflower), ("Glow bulb", glowbulb), ("Fiddlehead fern", fiddlehead), ("Lantern-pod vine", lantern_vine),
          ("Glow cattail", cattail), ("Glow lotus + lily pad", lotus), ("Star moss", star_moss), ("Glow kelp", kelp), ("Glow grass", grass)]


def rows(lst):
    return [(name, [(STAGES[i], (lambda f=f, i=i: f(i))) for i in range(5)]) for name, f in lst]


CORALS = [(f"Glow coral: {k}", [(CORAL_STAGES[i], (lambda f=coral(k), i=i: f(i))) for i in range(5)]) for k in ("branch", "fan", "brain", "bubble")]

D = {"dark": True}
BOARDS = [
    ("04-plants-a", "Glowing plants: growth stages (1/2)", D, rows(PLANTS[:6])),
    ("05-plants-b", "Glowing plants and corals: growth stages (2/2)", D, rows(PLANTS[6:]) + CORALS),
]
