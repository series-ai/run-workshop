"""Jellyfish (polyp -> ephyra -> medusa) and glowing fish built from swappable parts."""
from common import *  # noqa: F401,F403

def chibi_bell(r, h, rgb, z, glow_rgb=None, emit=0.15, n=12, square=False, lobes=0, depth=0.0):
    """A puffy rounded jelly bell (tall dome, scalloped hem) plus a darker underside."""
    prof = [(r * 0.92, 0), (r * 1.04, h * 0.18), (r * 1.0, h * 0.5), (r * 0.78, h * 0.82), (r * 0.42, h * 0.98), (0, h * 1.02)]
    k = dict(lobes=lobes, lobe_depth=depth) if lobes else {}
    lathe(prof, (0, 0, z), rgb, n=4 if square else n, emit=emit, rz=45 if square else 0, **k)
    lathe([(r * 0.9, 0.001), (r * 0.35, h * 0.22), (0, h * 0.25)], (0, 0, z), tuple(c * 0.75 for c in rgb), n=4 if square else n, rz=45 if square else 0)
    if glow_rgb:  # glowing scallop hem
        for x, y, zz, a in ring_of(10, r * 0.98, z + 0.005):
            ell((x, y, zz), (r * 0.16, r * 0.16, r * 0.1), glow_rgb, seg=6, ring=4, emit=GLOW * 0.8)


def fat_tentacle(p, length, rgb, tip=None, ph=0.0, r=0.028, wig=0.035):
    """A chunky wavy tentacle with a glowing ball tip."""
    p = V(p)
    pts = [p + V(wig * math.sin(ph + t * 5), wig * 0.6 * math.cos(ph + t * 4), -length * t) for t in [i / 5 for i in range(6)]]
    with part("tentacles", pivot=(0, 0, p.z)):
        tube(pts, lambda t: r * (1 - 0.45 * t), rgb, rings=10, n=6)
        if tip:
            ell(pts[-1] - V(0, 0, r * 0.3), r * 0.85, tip, seg=7, ring=5, emit=GLOW)


SANDY = C(120, 110, 140)


def bead_eye(p, out, size, shine_dir=(0.3, -0.5, 0.6)):
    """A side-mounted bead eye: dark ball, white shine."""
    p, out = V(p), V(out).normalized()
    ell(p, size, EYE, seg=8, ring=6, rough=0.3)
    ell(p + out * size * 0.7 + V(0, 0, size * 0.35) + V(size * 0.25, 0, 0), size * 0.35, (1, 1, 1), seg=6, ring=4)


def rock(r=0.16):
    lathe([(0.22, 0), (0.2, 0.035), (0.12, 0.05), (0, 0.055)], (0, 0, 0), SANDY, n=9)
    ell((0, 0, 0.05), (r, r * 0.9, r * 0.55), STONE, seg=7, ring=5)


# ---------------------------------------------------------------- jellyfish

def tentacle(p, length, rgb, wiggle=0.03, ph=0.0, r=0.012, emit=0.0, n=4):
    p = V(p)
    pts = [p + V(wiggle * math.sin(ph + t * 7), wiggle * math.cos(ph + t * 5), -length * t) for t in [i / 6 for i in range(7)]]
    with part("tentacles", pivot=(0, 0, p.z)):
        tube(pts, lambda t: r * (1 - 0.6 * t), rgb, rings=10, n=n, emit=emit)


def bell(r, h, rgb, z, n=12, lobes=0, depth=0.0, emit=SOFT, flat=0.0, square=False):
    prof = [(r, 0), (r * 1.02, h * 0.25), (r * 0.9, h * 0.6), (r * 0.55, h * 0.9), (0, h)]
    if flat:
        prof = [(r, 0), (r * 1.0, h * 0.2), (r * 0.8, h * 0.5), (r * 0.4, h * 0.7), (0, h * 0.75)]
    lathe(prof, (0, 0, z), rgb, n=4 if square else n, lobes=lobes, lobe_depth=depth, emit=emit, rz=45 if square else 0)
    lathe([(r * 0.96, 0), (r * 0.4, h * 0.3), (0, h * 0.35)], (0, 0, z - 0.004), tuple(c * 0.7 for c in rgb), n=4 if square else n, rz=45 if square else 0)


def jelly_face(z, r, look=(0.3, -1, 0.1)):
    """Jellies have no eyes: nothing to add."""
    return


def polyp(rgb, glow):
    """A baby polyp: a chubby little stalk with a face and stubby glowing nubs."""
    rock()
    lathe([(0.055, 0), (0.05, 0.08), (0.065, 0.17), (0.07, 0.21), (0.0, 0.215)], (0, 0, 0.08), rgb, n=9, emit=0.1)
    with part("tentacles", pivot=(0, 0, 0.29)):
        for x, y, z, a in ring_of(6, 0.055, 0.29, 0.3):
            ell((x, y, z + 0.015), (0.022, 0.022, 0.03), glow, seg=6, ring=4, emit=GLOW)


def ephyra(rgb, glow):
    """A baby jelly: a chubby eight-armed star with a face."""
    with at((0, 0, 0.18)):
        for x, y, z, a in ring_of(8, 0.075, 0, math.pi / 8):
            ell((x, y, 0), (0.06, 0.035, 0.022), rgb, seg=7, ring=4, rz=a, emit=0.15)
            ell((x * 1.6, y * 1.6, 0.008), 0.02, glow, seg=6, ring=4, emit=GLOW)
        ell((0, 0, 0.012), (0.08, 0.08, 0.045), rgb, seg=9, ring=6, emit=0.15)


def moon_jelly(st):
    rgb, glow = C(170, 150, 240), MAGENTA
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    z = 0.32
    chibi_bell(0.2, 0.2, rgb, z, glow_rgb=LAVENDER)
    for x, y, zz, a in ring_of(4, 0.075, 0, math.pi / 4):  # the four-leaf clover on top
        torus(0.04, 0.014, (x, y, z + 0.17), glow, n=10, k=4, emit=GLOW, rx=0)
    for i, (x, y, zz, a) in enumerate(ring_of(4, 0.06, z, 0.4)):
        fat_tentacle((x, y, zz), 0.16, rgb, tip=MAGENTA, ph=a, r=0.026)
    jelly_face(z + 0.08, 0.2)


def comb_jelly(st):
    rgb = C(200, 220, 255)
    rainbow = [MAGENTA, CORAL, AMBER, LIME, MINT, CYAN, LAVENDER, C(255, 120, 160)]
    if st == 0:
        return polyp(rgb, CYAN)
    if st == 1:
        return ephyra(rgb, CYAN)
    z = 0.32
    ell((0, 0, z + 0.14), (0.13, 0.13, 0.18), C(150, 180, 230), seg=10, ring=8, emit=0.1)
    for i, (x, y, zz, a) in enumerate(ring_of(8, 1.0, 0)):
        pts = [(0.135 * math.sin(t) * x, 0.135 * math.sin(t) * y, z + 0.14 - 0.185 * math.cos(t)) for t in [0.5 + 2.1 * j / 6 for j in range(7)]]
        tube(pts, lambda t: 0.011, rainbow[i], rings=7, n=4, emit=GLOW)
    for s in (-1, 1):
        tentacle((s * 0.05, 0.03, z - 0.02), 0.3, MINT, wiggle=0.05, ph=s, r=0.008, emit=GLOW * 0.6)
    jelly_face(z + 0.16, 0.13)


def box_jelly(st):
    rgb, glow = C(130, 210, 255), CYAN
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    z = 0.3
    box((0.3, 0.3, 0.24), (0, 0, z + 0.12), rgb, bevel=0.07, emit=0.15)
    box((0.26, 0.26, 0.02), (0, 0, z + 0.005), tuple(c * 0.75 for c in rgb))
    for x, y in ((0.12, 0.12), (-0.12, 0.12), (0.12, -0.12), (-0.12, -0.12)):
        ell((x, y, z + 0.02), 0.035, glow, seg=6, ring=4, emit=GLOW)
        fat_tentacle((x, y, z), 0.2, rgb, tip=glow, ph=x * 20 + y * 7, r=0.024)


def lions_mane(st):
    rgb, glow = C(255, 160, 110), AMBER
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    z = 0.32
    chibi_bell(0.21, 0.2, rgb, z, lobes=8, depth=0.1)
    for i, (x, y, zz, a) in enumerate(ring_of(9, 0.17, z)):  # the fluffy mane
        fat_tentacle((x, y, zz), 0.2 + 0.08 * (i % 2), C(255, 130, 100) if i % 2 else C(255, 190, 120), tip=AMBER, ph=a, r=0.028, wig=0.04)
    for x, y, zz, a in ring_of(3, 0.05, z):
        fat_tentacle((x, y, zz), 0.2, C(255, 210, 160), tip=AMBER, ph=a, r=0.03)
    ell((0, 0, z + 0.2), (0.07, 0.07, 0.03), glow, seg=8, ring=4, emit=GLOW)
    jelly_face(z + 0.09, 0.21)


def fried_egg(st):
    rgb, glow = C(245, 238, 226), AMBER
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    z = 0.3
    chibi_bell(0.23, 0.13, rgb, z, emit=0.04)
    ell((0, 0, z + 0.12), (0.12, 0.12, 0.08), glow, seg=10, ring=6, emit=GLOW * 0.8)
    for x, y, zz, a in ring_of(5, 0.07, z):
        fat_tentacle((x, y, zz), 0.14, C(250, 200, 230), tip=MAGENTA, ph=a, r=0.03)
    jelly_face(z + 0.06, 0.23)


def crown_jelly(st):
    rgb, glow = C(170, 80, 170), MAGENTA
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    z = 0.3
    chibi_bell(0.18, 0.24, rgb, z, emit=0.12)
    for x, y, zz, a in ring_of(6, 0.11, z + 0.19):  # a glowing crown on top
        cone(0.035, 0.08, (x, y, zz), AMBER, n=4, emit=GLOW, rz=a)
        ell((x * 1.0, y * 1.0, zz + 0.085), 0.018, AMBER, seg=5, ring=4, emit=GLOW)
    torus(0.12, 0.022, (0, 0, z + 0.19), AMBER, n=12, k=4, emit=GLOW * 0.8)
    for x, y, zz, a in ring_of(5, 0.09, z):
        fat_tentacle((x, y, zz), 0.13, rgb, tip=glow, ph=a, r=0.024)
    jelly_face(z + 0.09, 0.18)


def upside_down(st):
    rgb, glow = C(140, 210, 170), LIME
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    lathe([(0.28, 0), (0.26, 0.035), (0.15, 0.05), (0, 0.055)], (0, 0, 0), SANDY, n=9)
    lathe([(0.0, 0.04), (0.2, 0.05), (0.23, 0.1), (0.18, 0.13), (0, 0.13)], (0, 0, 0), rgb, n=12, emit=0.12)  # bell resting upside down
    for i, (x, y, z, a) in enumerate(ring_of(7, 0.11, 0.13)):  # puffy frilly arms like a little bouquet
        ell((x, y, z + 0.05), (0.055, 0.055, 0.06), C(110, 190, 140), seg=7, ring=5)
        ell((x * 1.05, y * 1.05, z + 0.11), 0.028, glow, seg=6, ring=4, emit=GLOW)
    ell((0, 0, 0.2), (0.07, 0.07, 0.07), C(200, 255, 220), seg=8, ring=6, emit=0.3)


def spark_swarm(st):
    rgb, glow = C(170, 190, 255), ICE
    if st == 0:
        return polyp(rgb, glow)
    if st == 1:
        return ephyra(rgb, glow)
    for i, (x, y, z, k) in enumerate([(0, 0, 0.36, 1.0), (0.16, 0.06, 0.48, 0.75), (-0.15, 0.05, 0.46, 0.7), (0.1, -0.1, 0.24, 0.6), (-0.1, -0.08, 0.27, 0.65)]):
        with at((x, y, z), s=k):
            chibi_bell(0.09, 0.1, rgb, 0, emit=0.15)
            ell((0, 0, 0.1), 0.025, glow, seg=6, ring=4, emit=GLOW)
            for xx, yy, zz, a in ring_of(3, 0.04, 0):
                fat_tentacle((xx, yy, 0), 0.06, rgb, tip=glow, ph=a + i, r=0.013, wig=0.01)


# ---------------------------------------------------------------- chibi fish


JELLY = [("Moon jelly", moon_jelly), ("Comb jelly", comb_jelly), ("Box jelly", box_jelly), ("Lion's mane", lions_mane),
         ("Fried-egg jelly", fried_egg), ("Crown jelly", crown_jelly), ("Upside-down jelly", upside_down), ("Spark jelly swarm", spark_swarm)]
JSTAGES = ["polyp", "ephyra", "medusa"]


# ---------------------------------------------------------------- fish

def fish_body(L, H, W, rgb, z, belly=None, shape="round", emit=0.0):
    """A loft along +x (nose at +x). shape: round, slim, tall, long."""
    prof = {
        "round": [0.15, 0.55, 0.9, 1.0, 0.85, 0.5, 0.0],
        "slim": [0.12, 0.45, 0.8, 0.95, 0.9, 0.6, 0.0],
        "tall": [0.1, 0.5, 0.95, 1.0, 0.9, 0.55, 0.0],
        "long": [0.3, 0.6, 0.8, 0.9, 0.9, 0.8, 0.0],
    }[shape]
    rings = []
    for i, k in enumerate(prof):
        x = -L / 2 + L * i / (len(prof) - 1)
        rings.append(((x, 0, z), H / 2 * k, W / 2 * k))
    loft(rings, rgb, n=8, side=(0, 0, 1), emit=emit)
    if belly:
        rings2 = [((x, 0, zz - H * 0.12), a * 0.75, b * 0.92) for (x, _, zz), a, b in rings]
        loft(rings2, belly, n=8, side=(0, 0, 1), emit=emit)


def tail(kind, x, z, H, rgb, emit=0.0):
    with part("tail", pivot=(x, 0, z)):
        _tail(kind, x, z, H, rgb, emit)


def _tail(kind, x, z, H, rgb, emit=0.0):
    if kind == "fan":
        pts = [(0, 0)] + [(-H * 0.75 * math.cos(t), H * 0.6 * math.sin(t)) for t in [-1.0 + 2.0 * i / 6 for i in range(7)]]
    elif kind == "fork":
        pts = [(0, 0), (-H * 0.75, H * 0.6), (-H * 0.45, 0), (-H * 0.75, -H * 0.6)]
    elif kind == "veil":  # long flowing guppy tail
        pts = [(0, 0)] + [(-H * 1.3 * math.cos(t), H * 0.85 * math.sin(t) + 0.06 * math.sin(t * 6)) for t in [-1.1 + 2.2 * i / 9 for i in range(10)]]
    else:  # round paddle
        pts = [(0, 0)] + [(-H * 0.55 * math.cos(t) - 0.02, H * 0.4 * math.sin(t)) for t in [-1.3 + 2.6 * i / 8 for i in range(9)]]
    slab(pts, 0.025, (x, 0, z), rgb, emit=emit)


def dorsal(x0, x1, z, h, rgb, emit=0.0):
    slab([(x0, 0), (x1, 0), (x0 + (x1 - x0) * 0.25, h)], 0.02, (0, 0, z), rgb, emit=emit)


def fins(x, z, H, W, rgb, emit=0.0):
    for s in (-1, 1):
      with part("fin_L" if s > 0 else "fin_R", pivot=(x, s * W * 0.4, z - H * 0.15)):
        blade((x, s * W * 0.4, z - H * 0.15), (x - H * 0.35, s * (W * 0.5 + H * 0.3), z - H * 0.3), H * 0.25, rgb, side=(0, 0, 1), emit=emit)


def side_eyes(x, z, W, size):
    for s in (-1, 1):
        bead_eye((x - 0.025, s * W * 0.3, z), (0, s, 0), size)


def dots(x0, x1, z, W, n, rgb, size=0.016):
    for i in range(n):
        x = x0 + (x1 - x0) * i / max(1, n - 1)
        for s in (-1, 1):
            ell((x, s * W * 0.43, z), size, rgb, seg=5, ring=4, emit=GLOW)


def swim(fn):
    """Fish float: lift them off the floor and add a little shadow puddle below."""
    def f():
        lathe([(0.12, 0), (0.12, 0.006), (0, 0.006)], (0, 0, 0), C(30, 34, 64), n=10, sx=1.6)
        with at((0, 0, 0), rz=22):
            fn()
    return f


def anglerfish():
    z, L, H, W = 0.35, 0.42, 0.34, 0.32
    fish_body(L, H, W, C(80, 70, 120), z, belly=C(120, 110, 160))
    tail("fan", -L / 2, z, H * 0.6, C(70, 60, 110))
    fins(0.0, z, H, W, C(70, 60, 110))
    for i in range(5):  # teeth
        cone(0.012, -0.04, (L / 2 - 0.02 - 0.02 * abs(i - 2), -0.08 + 0.04 * i, z + 0.0), (1, 1, 1), n=4)
    with part("lure", pivot=(0.08, 0, z + H / 2 - 0.02)):
        tube([(0.08, 0, z + H / 2 - 0.02), (0.12, 0, z + H / 2 + 0.14), (0.26, 0, z + H / 2 + 0.12), (0.3, 0, z + H / 2 + 0.04)], lambda t: 0.012, C(80, 70, 120), rings=8, n=5)
        ell((0.3, 0, z + H / 2 + 0.02), 0.045, CYAN, seg=8, ring=6, emit=GLOW * 1.3)
    side_eyes(0.12, z + 0.07, W, 0.035)


def lanternfish():
    """Big blunt head, huge eye, long tapering body with a runway of lights."""
    z = 0.3
    fish_body(0.46, 0.15, 0.12, C(70, 110, 190), z, belly=C(200, 215, 240), shape="slim")
    ell((0.15, 0, z + 0.005), (0.1, 0.075, 0.095), C(70, 110, 190), seg=10, ring=7)
    tail("fork", -0.23, z, 0.15, C(70, 110, 190))
    slab([(-0.05, 0), (0.05, 0), (-0.02, 0.07)], 0.02, (0, 0, z + 0.06), C(70, 110, 190))
    fins(0.06, z, 0.15, 0.12, C(70, 110, 190))
    for i in range(7):
        x = -0.17 + 0.045 * i
        for s in (-1, 1):
            ell((x, s * 0.055, z - 0.045), 0.016, CYAN, seg=6, ring=4, emit=GLOW)
    for s in (-1, 1):
        bead_eye((0.19, s * 0.06, z + 0.025), (0, s, 0), 0.04)
        ell((0.23, s * 0.045, z - 0.02), 0.02, CYAN, seg=6, ring=4, emit=GLOW * 1.2)


def hatchetfish():
    """A deep silver axe-blade body, tiny tail stalk, tube eyes staring upward."""
    z = 0.32
    blade_pts = [(0.15, 0.04), (0.11, 0.1), (-0.04, 0.09), (-0.12, 0.035), (-0.12, 0.0), (-0.05, -0.07), (0.01, -0.22), (0.07, -0.19), (0.12, -0.07)]
    slab(blade_pts, 0.075, (0, 0, z), C(200, 210, 232), bevel=0.018, metal=0.4, rough=0.35)
    with part("tail", pivot=(-0.12, 0, z + 0.018)):
        slab([(0, 0), (-0.09, 0.07), (-0.07, 0), (-0.09, -0.07)], 0.02, (-0.12, 0, z + 0.018), C(170, 180, 210))
    slab([(-0.02, 0), (0.05, 0), (0.0, 0.08)], 0.015, (0, 0, z + 0.085), C(170, 180, 210))
    for i, (x, zz) in enumerate([(-0.04, -0.08), (-0.01, -0.13), (0.015, -0.18), (0.05, -0.17), (0.08, -0.13), (0.1, -0.09)]):
        for s in (-1, 1):
            ell((x, s * 0.046, z + zz), 0.017, CYAN, seg=6, ring=4, emit=GLOW)
    for s in (-1, 1):  # telescope eyes pointing up
        cyl(0.03, 0.06, (0.08, s * 0.03, z + 0.06), C(200, 210, 232), n=8)
        ell((0.08, s * 0.03, z + 0.125), 0.032, EYE, seg=8, ring=6, rough=0.3)
        ell((0.088, s * 0.035, z + 0.15), 0.011, (1, 1, 1), seg=5, ring=4)


def flashlight():
    """A blunt bullet of a fish wearing two huge headlamps."""
    z = 0.3
    fish_body(0.3, 0.2, 0.18, C(60, 60, 130), z, belly=C(110, 110, 190))
    ell((0.1, 0, z), (0.09, 0.09, 0.1), C(60, 60, 130), seg=10, ring=7)
    tail("fork", -0.15, z, 0.2, C(60, 60, 130))
    slab([(-0.08, 0), (0.0, 0), (-0.06, 0.09)], 0.02, (0, 0, z + 0.08), C(60, 60, 130))
    for s in (-1, 1):
        ell((0.13, s * 0.075, z - 0.04), (0.065, 0.03, 0.035), ICE, seg=10, ring=6, emit=GLOW * 1.5)
        bead_eye((0.15, s * 0.065, z + 0.04), (0, s, 0), 0.03)


def guppy():
    """A tiny body pulling an enormous glowing veil tail and flag fin."""
    z = 0.3
    fish_body(0.2, 0.1, 0.08, C(140, 200, 220), z, belly=C(230, 240, 255))
    with at((-0.09, 0, z), s=1.7):
        tail("veil", 0, 0.0, 0.13, MAGENTA, emit=SOFT)
    slab([(-0.06, 0), (0.02, 0), (-0.1, 0.13)], 0.015, (0, 0, z + 0.04), LAVENDER, emit=SOFT)
    fins(0.04, z, 0.1, 0.08, LAVENDER, emit=SOFT)
    for s in (-1, 1):
        bead_eye((0.07, s * 0.03, z + 0.015), (0, s, 0), 0.02)


def ribbon_eel():
    """A long flat ribbon with a crest fin down its back and flared leaf nostrils."""
    pts = [(-0.34 + 0.62 * t, 0.06 * math.sin(t * 7.5), 0.24 + 0.04 * math.sin(t * 5)) for t in [i / 12 for i in range(13)]]
    prof = lambda t: (0.05 * (0.4 + 0.6 * min(1, t * 3)), 0.024)  # noqa: E731
    with part("rear", pivot=pts[6]):
        tube(pts[:7], lambda t: prof(t * 0.5), C(50, 70, 200), rings=10, n=6, side=(0, 0, 1))
        tube([(x, y, z - 0.03) for x, y, z in pts[2:7]], lambda t: 0.009, MINT, rings=8, n=4, emit=GLOW)
        for p in pts[1:6]:
            p = V(p)
            slab([(-0.03, 0), (0.03, 0), (0.0, 0.05)], 0.01, (p.x, p.y, p.z + 0.035), LIME, emit=SOFT * 1.4)
    tube(pts[6:], lambda t: prof(0.5 + t * 0.5), C(50, 70, 200), rings=10, n=6, side=(0, 0, 1))
    tube([(x, y, z - 0.03) for x, y, z in pts[6:-1]], lambda t: 0.009, MINT, rings=8, n=4, emit=GLOW)
    for p in pts[6:-1]:  # crest fin segments
        p = V(p)
        slab([(-0.03, 0), (0.03, 0), (0.0, 0.05)], 0.01, (p.x, p.y, p.z + 0.035), LIME, emit=SOFT * 1.4)
    head = V(pts[-1])
    cone(0.03, 0.08, head, C(50, 70, 200), n=6, ry=90)
    for s in (-1, 1):  # the famous flared nostrils
        blade(head + V(0.07, s * 0.012, 0.01), head + V(0.11, s * 0.04, 0.05), 0.05, LIME, side=(0, 0, 1), emit=GLOW)
        bead_eye(head + V(0.025, s * 0.022, 0.015), (0, s, 0), 0.013)


def firefly_squid():
    """A torpedo mantle with arrowhead fins at the back, short arms swept forward."""
    z = 0.28
    with at((0, 0, z), ry=-90):
        lathe([(0.0, -0.2), (0.04, -0.17), (0.06, -0.05), (0.065, 0.05), (0.058, 0.1), (0.0, 0.1)], (0, 0, 0), C(70, 90, 200), n=10)
    with part("fins", pivot=(-0.2, 0, z)):
        slab([(0, 0), (0.06, 0.07), (0.1, 0), (0.06, -0.07)], 0.015, (-0.2, 0, z), C(90, 110, 220), rx=90)
    ell((-0.1 + 0.0, 0, z), (0.07, 0.075, 0.07), C(80, 100, 210), seg=9, ring=7)
    for s in (-1, 1):
        bead_eye((-0.09, s * 0.06, z + 0.015), (0, s, 0), 0.026)
    R = rng(4)
    for i in range(14):
        a = R.uniform(0, 2 * math.pi)
        x = R.uniform(-0.15, 0.08)
        ell((x + 0.05, 0.062 * math.cos(a), z + 0.062 * math.sin(a)), 0.012, CYAN, seg=5, ring=4, emit=GLOW)
    arms = part("arms", pivot=(-0.16, 0, z))
    arms.__enter__()
    for k, (dy, dz) in enumerate([(0.03, 0.03), (-0.03, 0.03), (0.04, -0.01), (-0.04, -0.01), (0.02, -0.035), (-0.02, -0.035)]):
        tube([(-0.16, dy * 0.6, z + dz * 0.6), (-0.24, dy, z + dz), (-0.29, dy * 1.2, z + dz * 1.3)], lambda t: 0.016 * (1 - 0.5 * t), C(70, 90, 200), rings=4, n=5)
    for s in (-1, 1):  # two long glowing feeding arms
        tube([(-0.16, s * 0.01, z), (-0.27, s * 0.02, z - 0.02), (-0.36, s * 0.03, z + 0.0)], lambda t: 0.011, C(70, 90, 200), rings=5, n=4)
        ell((-0.37, s * 0.03, z), 0.022, CYAN, seg=6, ring=4, emit=GLOW * 1.3)
    arms.__exit__(None, None, None)


def bpy_last():
    import bpy
    o = bpy.context.scene.collection.objects[-1]
    o.location = (0, 0, 0.32)
    return o


def sea_angel():
    """Clione: a see-through-looking angel with wing flaps, horn nubs and a glowing heart."""
    z = 0.18
    lathe([(0.0, 0.0), (0.03, 0.03), (0.055, 0.12), (0.05, 0.2), (0.0, 0.22)], (0, 0, z), C(170, 180, 250), n=8, emit=0.1)
    ell((0, 0, z + 0.26), (0.05, 0.05, 0.05), C(180, 190, 255), seg=8, ring=6, emit=0.1)
    for s in (-1, 1):
        cone(0.016, 0.05, (s * 0.025, 0, z + 0.29), C(180, 190, 255), n=5, ry=s * 20)
        with part("wing_L" if s > 0 else "wing_R", pivot=(s * 0.04, 0, z + 0.17)):
            ell((s * 0.11, 0, z + 0.17), (0.08, 0.016, 0.05), C(160, 170, 250), seg=9, ring=5, ry=s * -25, emit=0.1)
    ell((0.01, -0.035, z + 0.12), (0.03, 0.025, 0.05), CORAL, seg=7, ring=5, emit=GLOW * 1.4)
    ell((0.01, -0.035, z + 0.25), 0.02, AMBER, seg=6, ring=4, emit=GLOW)


def glow_shrimp():
    """A long arched body, fan tail, stalk eyes and sweeping antennae twice its length."""
    z = 0.2
    pts = [(-0.18 + 0.32 * t, 0, z + 0.1 * math.sin(math.pi * t) - 0.06 * t) for t in [i / 7 for i in range(8)]]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        a, b = V(a), V(b)
        k = 0.6 + 0.4 * i / 6
        ell(a.lerp(b, 0.5), (0.03, 0.035 * k, 0.04 * k), C(255, 130, 120), seg=8, ring=6)
        ell(a.lerp(b, 0.5) + V(0, 0, 0.04 * k), 0.012, CORAL, seg=5, ring=4, emit=GLOW)
    tail("fan", -0.18, z - 0.0, 0.09, C(255, 130, 120))
    head = V(pts[-1]) + V(0.05, 0, 0.0)
    ell(head, (0.06, 0.045, 0.045), C(255, 140, 130), seg=9, ring=6)
    cone(0.015, 0.07, head + V(0.04, 0, 0.02), C(255, 140, 130), n=4, ry=80)
    for s in (-1, 1):
        tube([head + V(0.02, s * 0.025, 0.035), head + V(0.03, s * 0.04, 0.06)], lambda t: 0.007, C(255, 140, 130), rings=2, n=4)
        ell(head + V(0.03, s * 0.042, 0.065), 0.014, EYE, seg=6, ring=4)
        with part("lure", pivot=head + V(0.04, 0, 0)):
            tube([head + V(0.04, s * 0.02, 0.0), head + V(0.12, s * 0.08, 0.08), head + V(-0.05, s * 0.14, 0.2), head + V(-0.3, s * 0.12, 0.16)],
                 lambda t: 0.007 * (1 - 0.5 * t), CORAL, rings=10, n=4, emit=GLOW * 0.7)
    for i in range(5):
        x = -0.08 + 0.04 * i
        tube([(x, 0, z - 0.02), (x + 0.01, 0, z - 0.07)], lambda t: 0.007, C(255, 130, 120), rings=2, n=4)


def dumbo():
    z = 0.32
    lathe([(0.0, -0.04), (0.11, 0.0), (0.12, 0.08), (0.08, 0.15), (0, 0.17)], (0, 0, z - 0.06), C(255, 170, 190), n=10, emit=0.15)
    for s in (-1, 1):
      with part("wing_L" if s > 0 else "wing_R", pivot=(s * 0.1, 0, z + 0.06)):
        with at((s * 0.11, 0, z + 0.06), ry=s * -30):
            ell((s * 0.04, 0, 0), (0.06, 0.02, 0.045), C(255, 140, 170), seg=7, ring=5)
            ell((s * 0.04, -0.02, 0), (0.03, 0.01, 0.02), MAGENTA, seg=6, ring=4, emit=GLOW)
    arms = part("arms", pivot=(0, 0, z - 0.08))
    arms.__enter__()
    for x, y, zz, a in ring_of(8, 0.08, z - 0.08):
        tube([(x, y, zz + 0.02), (x * 1.6, y * 1.6, zz - 0.04), (x * 1.9, y * 1.9, zz - 0.02)], lambda t: 0.022 * (1 - 0.6 * t), C(255, 170, 190), rings=5, n=5)
        ell((x * 1.9, y * 1.9, zz - 0.02), 0.013, MAGENTA, seg=5, ring=4, emit=GLOW)
    arms.__exit__(None, None, None)
    critter_eyes((0.04, -0.11, z + 0.02), (0.35, -1, 0.05), size=0.022, gap=1.7)


def seahorse():
    """A deep S curve: crowned head, long tube snout, pot belly, tight curled tail."""
    z = 0.04
    tail_pts = [(0.05, 0, z + 0.06), (0.09, 0, z + 0.01), (0.06, 0, z - 0.02), (0.02, 0, z + 0.01), (0.02, 0, z + 0.07), (-0.02, 0, z + 0.14)]
    tube(tail_pts, lambda t: 0.012 + 0.03 * t, C(255, 120, 160), rings=14, n=6)
    ell((-0.02, 0, z + 0.22), (0.06, 0.055, 0.09), C(255, 120, 160), seg=9, ring=7)
    ell((0.02, 0, z + 0.21), (0.04, 0.045, 0.07), C(255, 190, 200), seg=8, ring=6)
    tube([(-0.02, 0, z + 0.3), (-0.03, 0, z + 0.36)], lambda t: 0.04, C(255, 120, 160), rings=2, n=6)
    head = V(-0.01, 0, z + 0.39)
    ell(head, (0.06, 0.05, 0.055), C(255, 120, 160), seg=9, ring=7)
    tube([head + V(0.04, 0, -0.01), head + V(0.15, 0, -0.04)], lambda t: 0.018, C(255, 120, 160), rings=2, n=6)
    for k in (-0.03, 0.0, 0.03):
        cone(0.014, 0.05, head + V(k, 0, 0.045), AMBER, n=4, emit=GLOW)
    for h in (0.12, 0.17, 0.22, 0.27, 0.32):
        cone(0.012, 0.03, (-0.07, 0, z + h), C(255, 150, 180), n=4, ry=-70)
        ell((-0.065, 0, z + h), 0.012, AMBER, seg=5, ring=4, emit=GLOW)
    with part("tail", pivot=(-0.06, 0, z + 0.22)):
        slab([(0, 0), (-0.07, 0.05), (-0.07, -0.03)], 0.015, (-0.06, 0, z + 0.22), LAVENDER, emit=SOFT)
    head_eyes(head, 0.05, fwd=(1, 0, 0), size=0.014, up=0.2, spread=0.95)


def sea_pickle():
    """A pyrosome: a long knobbly glowing tube, open at one end."""
    z = 0.2
    with at((0, 0, z), ry=-80):
        lathe([(0.0, -0.22), (0.05, -0.2), (0.075, -0.1), (0.085, 0.05), (0.09, 0.18), (0.075, 0.2)], (0, 0, 0), C(240, 140, 200), n=10, emit=0.08)
        lathe([(0.075, 0.2), (0.06, 0.12), (0.0, 0.1)], (0, 0, 0), C(150, 60, 120), n=10)
        R = rng(5)
        for i in range(24):
            a = R.uniform(0, 2 * math.pi)
            h = R.uniform(-0.18, 0.17)
            r = 0.05 + 0.04 * min(1, (h + 0.2) / 0.2)
            cone(0.018, 0.03, (r * math.cos(a), r * math.sin(a), h), ICE, n=4, rz=math.degrees(a), ry=90, emit=GLOW)


FISH = [("anglerfish", anglerfish), ("lanternfish", lanternfish), ("hatchetfish", hatchetfish), ("flashlight fish", flashlight),
        ("glow guppy", guppy), ("ribbon eel", ribbon_eel), ("firefly squid", firefly_squid), ("sea angel", sea_angel),
        ("glow shrimp", glow_shrimp), ("dumbo octopus", dumbo), ("glow seahorse", seahorse), ("sea pickle", sea_pickle)]


def sized(fn, k, shiny=False):
    def f():
        lathe([(0.12 * k, 0), (0.12 * k, 0.006), (0, 0.006)], (0, 0, 0), C(30, 34, 64), n=10, sx=1.6)
        with at((0, 0, 0.32 * (k - 1)), rz=22, s=k):
            if shiny:
                with recolour(C(255, 215, 120)):
                    fn()
            else:
                fn()
    return f


class recolour:
    """Temporarily swap every non-glowing material colour for a gold 'shiny' variant."""
    def __init__(self, rgb):
        self.rgb = rgb

    def __enter__(self):
        import kit
        self.orig = kit.mat

        def gold(rgb, rough=0.8, emit=0.0, metal=0.0):
            if emit:
                return self.orig(rgb, rough, emit, metal)
            lum = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]
            if lum < 0.15:
                return self.orig(rgb, rough, emit, metal)
            return self.orig(tuple(c * (0.6 + 0.6 * lum) for c in self.rgb), 0.35, 0.0, 0.5)
        kit.mat = gold

    def __exit__(self, *a):
        import kit
        kit.mat = self.orig


# ---------------------------------------------------------------- fish parts (one body, swapped pieces)

def fish_part(body="round", tail_k="fork", pattern=None, lure=None, rgb=C(80, 100, 150)):
    def f():
        z, L, H, W = 0.3, 0.4, {"round": 0.22, "slim": 0.15, "tall": 0.28, "long": 0.12}[body], 0.14
        L = 0.55 if body == "long" else L
        fish_body(L, H, W, rgb, z, belly=SILVER, shape=body)
        tail(tail_k, -L / 2, z, max(H, 0.16), rgb, emit=SOFT if tail_k == "veil" else 0.0)
        dorsal(-0.06, 0.06, z + H * 0.4, 0.06, rgb)
        fins(0.06, z, H, W, rgb)
        side_eyes(L / 2 - 0.07, z + H * 0.12, W, 0.028)
        if pattern == "dots":
            dots(-L / 2 + 0.08, L / 2 - 0.1, z - H * 0.22, W, 6, CYAN)
        elif pattern == "stripe":
            for s in (-1, 1):
                tube([(-L / 2 + 0.06, s * W * 0.42, z + 0.0), (L / 2 - 0.12, s * W * 0.46, z + 0.01)], lambda t: 0.012, MINT, rings=2, n=4, emit=GLOW)
        elif pattern == "belly":
            loft([((-L / 2 + 0.05 + (L - 0.1) * i / 4, 0, z - H * 0.3), 0.02, W * 0.3 * (1 - abs(i - 2) / 3)) for i in range(5)], MAGENTA, n=6, side=(0, 0, 1),
                 emit=GLOW)
        elif pattern == "patch":
            for s in (-1, 1):
                ell((L / 2 - 0.09, s * W * 0.45, z - 0.035), (0.03, 0.01, 0.02), ICE, seg=6, ring=4, emit=GLOW * 1.3)
        elif pattern == "spots":
            R = rng(3)
            for i in range(8):
                x = R.uniform(-L / 2 + 0.08, L / 2 - 0.1)
                zz = R.uniform(-H * 0.25, H * 0.3)
                for s in (-1, 1):
                    ell((x, s * W * 0.45, z + zz), 0.014, AMBER, seg=5, ring=4, emit=GLOW)
        if lure == "bulb":
            tube([(L / 2 - 0.12, 0, z + H / 2), (L / 2 - 0.05, 0, z + H / 2 + 0.12), (L / 2 + 0.05, 0, z + H / 2 + 0.1)], lambda t: 0.009, rgb, rings=6, n=4)
            ell((L / 2 + 0.06, 0, z + H / 2 + 0.08), 0.03, CYAN, seg=7, ring=5, emit=GLOW * 1.3)
        elif lure == "chin":
            tube([(L / 2 - 0.04, 0, z - H / 2 + 0.02), (L / 2 + 0.0, 0, z - H / 2 - 0.08)], lambda t: 0.007, rgb, rings=2, n=4)
            ell((L / 2 + 0.0, 0, z - H / 2 - 0.1), 0.022, MAGENTA, seg=6, ring=4, emit=GLOW * 1.3)
        elif lure == "twin":
            for s in (-1, 1):
                tube([(L / 2 - 0.12, s * 0.02, z + H / 2), (L / 2 - 0.08, s * 0.08, z + H / 2 + 0.1)], lambda t: 0.007, rgb, rings=2, n=4)
                ell((L / 2 - 0.08, s * 0.08, z + H / 2 + 0.11), 0.022, LIME, seg=6, ring=4, emit=GLOW * 1.3)
    return swim(f)


D = {"dark": True}
FS = dict(D, shared=False)
BOARDS = [
    ("06-jellyfish", "Jellyfish: real life cycle as growth stages (polyp, ephyra, medusa)", D,
     [(n, [(JSTAGES[i], (lambda f=f, i=i: f(i))) for i in range(3)]) for n, f in JELLY[:4]]),
    ("07-jellyfish-b", "Jellyfish (2/2)", D, [(n, [(JSTAGES[i], (lambda f=f, i=i: f(i))) for i in range(3)]) for n, f in JELLY[4:]]),
    ("08-fish", "Glowing fish and sea critters", FS, [("Species (1/2)", [(n, swim(f)) for n, f in FISH[:6]]), ("Species (2/2)", [(n, swim(f)) for n, f in FISH[6:]])]),
    ("09-fish-sizes", "Collectible sizes and the rare shiny variant (same model, scaled; shiny swaps the palette)", D, [
        ("Lanternfish", [(lab, sized(lanternfish, k)) for lab, k in (("tiny", 0.6), ("small", 0.8), ("medium", 1.0), ("large", 1.3), ("huge", 1.7))]
         + [("shiny", sized(lanternfish, 1.0, True))]),
        ("Anglerfish", [(lab, sized(anglerfish, k)) for lab, k in (("tiny", 0.6), ("small", 0.8), ("medium", 1.0), ("large", 1.3), ("huge", 1.7))]
         + [("shiny", sized(anglerfish, 1.0, True))]),
    ]),
    ("10-fish-parts", "Fish parts: bodies, tails, lights and lures swap on one rig", FS, [
        ("Bodies", [(b, fish_part(body=b)) for b in ("round", "slim", "tall", "long")]),
        ("Tails", [(t, fish_part(tail_k=t)) for t in ("fork", "fan", "veil", "paddle")]),
        ("Light patterns", [(p, fish_part(pattern=p)) for p in ("dots", "stripe", "belly", "patch", "spots")]),
        ("Lures", [(l, fish_part(body="round", lure=l, rgb=C(80, 70, 120))) for l in ("bulb", "chin", "twin")]),
        ("Mixed from the parts above", [
            ("tall+veil+spots", fish_part("tall", "veil", "spots", rgb=C(150, 70, 140))),
            ("long+paddle+stripe", fish_part("long", "paddle", "stripe", rgb=C(40, 60, 140))),
            ("round+fan+belly+bulb", fish_part("round", "fan", "belly", "bulb", rgb=C(70, 60, 110))),
            ("slim+fork+patch+twin", fish_part("slim", "fork", "patch", "twin", rgb=C(50, 110, 120))),
        ]),
    ]),
]
