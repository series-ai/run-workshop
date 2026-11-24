"""Glowing mushrooms: 12 species x 5 growth stages, and the swappable parts."""
from common import *  # noqa: F401,F403

STAGES = ["pin", "button", "young", "mature", "spore puff"]
# (size, openness) per stage; the spore-puff stage is mature + drifting spores
G = [(0.4, 0.0), (0.5, 0.2), (0.75, 0.6), (1.0, 1.0), (1.0, 1.0)]


def stem(h, r, rgb=STEM, r2=None, n=7, emit=0.0, bulb=0.0):
    r *= 1.4
    r2 = None if r2 is None else r2 * 1.4
    if bulb:
        ell((0, 0, r * 0.9), (r * (1 + bulb), r * (1 + bulb), r * 1.1), rgb, seg=7, ring=5, emit=emit)
    cyl(r, h, (0, 0, 0.02), rgb, n=n, r2=r * 0.82 if r2 is None else r2, emit=emit)


def cap(prof_closed, prof_open, o, rgb, n=10, emit=0.0, z=0.0, **k):
    lathe(mix(prof_closed, prof_open, o), (0, 0, z), rgb, n=n, emit=emit, **k)


def spots(st, h, r, rgb, n=6, z_off=0.75, size=0.05, seed=3):
    """Glowing dots scattered over a dome cap of radius r whose top sits at h."""
    R = rng(seed)
    for i in range(n):
        a = 2 * math.pi * i / n + R.uniform(-0.3, 0.3)
        f = R.uniform(0.45, 0.8)
        zz = h - r * (1 - math.sqrt(max(0, 1 - f * f))) * z_off - r * 0.08
        ell((r * f * math.cos(a), r * f * math.sin(a), zz), size * R.uniform(0.8, 1.2), rgb, seg=6, ring=4, emit=GLOW)


def puff(st, top, rgb, seed=5, spread=0.24):
    if st == 4:
        sparkles((0, 0, top + 0.05), 9, spread, 0.026, rgb, seed=seed)


# ---------------------------------------------------------------- species

def lantern(st):
    """Lantern cap: a tall bell cap that glows like a paper lantern between dark ribs."""
    s, o = G[st]
    pad(r=0.28, seed=1)
    h = 0.4 * s
    stem(h, 0.06 * s + 0.02, bulb=0.25)
    closed = [(0.12, h - 0.02), (0.15, h + 0.05), (0.13, h + 0.14), (0.07, h + 0.2), (0, h + 0.21)]
    opened = [(0.24, h - 0.06), (0.27, h + 0.08), (0.23, h + 0.24), (0.12, h + 0.34), (0, h + 0.36)]
    sc = lambda p: [(r * s, h + (z - h) * s) for r, z in p]  # noqa: E731
    prof = mix(sc(closed), sc(opened), o)
    lathe(prof, (0, 0, 0), AMBER, n=8, emit=SOFT * (0.4 + 0.6 * o))
    for x, y, z, a in ring_of(8, 1.0, 0, phase=0.0):
        tube([(r * 1.03 * x, r * 1.03 * y, zz) for r, zz in prof[:-1]] + [(0, 0, prof[-1][1] + 0.005)], lambda t: 0.014 * s + 0.004, PLUM, rings=6, n=4)
    cyl(0.05 * s, 0.04 * s, (0, 0, prof[-1][1] - 0.01), PLUM, n=6)
    puff(st, h + 0.38 * s, AMBER, seed=11)


def moon_disc(st):
    """Moon disc: a flat round plate cap with a glowing rim ring."""
    s, o = G[st]
    pad(r=0.28, seed=2)
    h = 0.42 * s
    stem(h, 0.055 * s + 0.02, rgb=C(200, 196, 232))
    closed = [(0.08, h), (0.12, h + 0.05), (0.09, h + 0.11), (0, h + 0.12)]
    opened = [(0.34, h + 0.04), (0.36, h + 0.08), (0.24, h + 0.12), (0, h + 0.13)]
    cap([(r * s, h + (z - h) * s) for r, z in closed], [(r * s, h + (z - h) * s) for r, z in opened], o, LAVENDER, n=12)
    if o > 0.1:
        r = lerp(0.1, 0.355, o) * s
        torus(r, 0.022 * s, (0, 0, h + 0.06 * s), ICE, n=14, k=4, emit=GLOW)
    puff(st, h + 0.14 * s, ICE, seed=12)


def inkcap(st):
    """Inkcap: tall shaggy cylinder cap that drips glowing ink at the hem."""
    s, o = G[st]
    pad(r=0.28, seed=3)
    h = 0.2 * s
    stem(h + 0.3 * s, 0.05 * s + 0.015)
    closed = [(0.08, h), (0.1, h + 0.12), (0.09, h + 0.25), (0.05, h + 0.32), (0, h + 0.33)]
    opened = [(0.15, h + 0.02), (0.16, h + 0.22), (0.14, h + 0.42), (0.07, h + 0.53), (0, h + 0.55)]
    sc = lambda p: [(r * s, h + (z - h) * s) for r, z in p]  # noqa: E731
    cap(sc(closed), sc(opened), o, C(120, 110, 180), n=8, lobes=8, lobe_depth=0.18)
    if o > 0.15:
        rr = lerp(0.08, 0.15, o) * s
        torus(rr, 0.02 * s, (0, 0, h + 0.03 * s), MAGENTA, n=10, k=4, emit=GLOW)
        for i, (x, y, z, a) in enumerate(ring_of(8, rr, h + 0.03 * s)):
            ln = (0.08 + 0.05 * (i % 3 == 0)) * s * o
            tube([(x, y, z), (x * 1.04, y * 1.04, z - ln)], lambda t: 0.024 * s * (1 - 0.3 * t), MAGENTA, rings=3, n=5, emit=GLOW)
            ell((x * 1.04, y * 1.04, z - ln - 0.01), 0.026 * s, MAGENTA, seg=6, ring=4, emit=GLOW)
    puff(st, h + 0.55 * s, MAGENTA, seed=13)


def puffball(st):
    """Puffball: a round ball with no stem, freckled with glow; the last stage bursts a spore cloud."""
    s, o = G[st]
    pad(r=0.28, seed=4)
    r = 0.24 * s
    ell((0, 0, r * 0.9), (r, r, r * 0.92), C(220, 214, 240), seg=10, ring=7)
    if st >= 1:
        spots(st, r * 1.82, r, MINT, n=7, z_off=0.9, size=0.03 * s + 0.01, seed=8)
    if st == 4:
        cone(0.06, 0.04, (0, 0, r * 1.75), C(160, 150, 190), n=6)
        sparkles((0, 0, r * 2.0), 14, 0.25, 0.03, MINT, seed=21, lift=0.05)


def coral_fungus(st):
    """Coral fungus: a bunch of stubby branching fingers with glowing tips."""
    s, o = G[st]
    pad(r=0.28, seed=5)
    R = rng(7)
    arms = [(0, 0, 1.0), (0.09, 0.03, 0.8), (-0.08, 0.05, 0.85), (0.03, -0.09, 0.75), (-0.05, -0.07, 0.7), (0.07, 0.09, 0.65)]
    for i, (x, y, k) in enumerate(arms[:2 + st]):
        top = V(x * 1.8, y * 1.8, 0.45 * k) * s
        mid = V(x, y, 0.2 * k) * s
        tube([V(x * 0.4, y * 0.4, 0.04), mid, top], lambda t: 0.045 * s * (1 - 0.45 * t) + 0.01, C(230, 140, 170), rings=6, n=6)
        ell(top + V(0, 0, 0.01), 0.032 * s + 0.008, CORAL, seg=6, ring=4, emit=GLOW)
        if st >= 3 and i < 3:
            side = top.lerp(mid, 0.45) + V(R.uniform(-1, 1), R.uniform(-1, 1), 0).normalized() * 0.07 * s
            tube([top.lerp(mid, 0.5), side + V(0, 0, 0.08 * s)], lambda t: 0.025 * s, C(230, 140, 170), rings=3, n=5)
            ell(side + V(0, 0, 0.09 * s), 0.022 * s, CORAL, seg=6, ring=4, emit=GLOW)
    puff(st, 0.5 * s, CORAL, seed=15)


def pixie_cup(st):
    """Pixie cup: a tiny goblet that holds a pool of light."""
    s, o = G[st]
    pad(r=0.28, seed=6)
    h = 0.18 * s
    stem(h, 0.035 * s + 0.01)
    closed = [(0.03, h), (0.06, h + 0.06), (0.04, h + 0.1), (0.02, h + 0.1)]
    opened = [(0.04, h), (0.14, h + 0.12), (0.2, h + 0.2), (0.17, h + 0.19)]
    cap([(r * s, h + (z - h) * s) for r, z in closed], [(r * s, h + (z - h) * s) for r, z in opened], o, C(120, 190, 120), n=10, cap=False)
    if o > 0.1:
        lathe([(lerp(0.03, 0.165, o) * s, h + lerp(0.09, 0.175, o) * s), (0, h + lerp(0.08, 0.15, o) * s)], (0, 0, 0), LIME, n=10, emit=GLOW)
    puff(st, h + 0.22 * s, LIME, seed=16)


def jelly_ear(st):
    """Jelly ear: wobbly translucent ear shapes on a little twig, glowing all over."""
    s, o = G[st]
    tube([(-0.3, 0.05, 0.06), (0, 0, 0.08), (0.3, -0.04, 0.07)], lambda t: 0.06, BARK, rings=4, n=6)
    spots_at = [(-0.12, 0.0, 1.0, -20), (0.1, -0.02, 0.85, 25), (0.0, 0.03, 0.7, 0)]
    for i, (x, y, k, rz) in enumerate(spots_at[:1 + min(st, 2)]):
        kk = k * s
        with at((x, y - 0.04, 0.12), rz=rz, rx=-15):
            lathe([(0.0, 0), (0.12 * kk, 0.02), (0.15 * kk, 0.1 * kk), (0.1 * kk, 0.18 * kk), (0.03 * kk, 0.2 * kk)], (0, 0, 0), ROSE, n=9, sx=1.0, sy=0.45,
                  emit=SOFT * 0.6, cap=False, lobes=3, lobe_depth=0.15)
    puff(st, 0.35 * s, MAGENTA, seed=17)


def shelf(st):
    """Shelf fungus: stacked half-moon brackets on a bark slab, for walls and logs."""
    s, o = G[st]
    box((0.5, 0.12, 0.7), (0, 0.12, 0.35), BARK, bevel=0.03)
    for i, (z, k) in enumerate([(0.22, 1.0), (0.4, 0.8), (0.55, 0.6)][:1 + min(st, 2)]):
        kk = k * (0.5 + 0.5 * s)
        with at((0, 0.06, z)):
            lathe([(0.0, 0), (0.18 * kk, 0.0), (0.2 * kk, 0.03), (0.15 * kk, 0.06), (0, 0.065)], (0, 0, 0), C(120, 110, 170), n=10, sy=0.65,
                  rz=0)
            torus(0.19 * kk, 0.012, (0, 0, 0.012), CYAN, n=10, k=4, arc=180, rz=180, emit=GLOW)
    puff(st, 0.65, CYAN, seed=18, spread=0.25)


def morel(st):
    """Glow morel: a honeycomb cone cap with glowing pits between the ridges."""
    s, o = G[st]
    pad(r=0.28, seed=9)
    h = 0.22 * s
    stem(h, 0.06 * s + 0.015, rgb=C(222, 214, 200))
    prof = [(0.1, h), (0.12, h + 0.12), (0.1, h + 0.25), (0.06, h + 0.36), (0, h + 0.4)]
    sc = [(r * (0.6 + 0.4 * s) * s, h + (z - h) * s) for r, z in prof]
    lathe(sc, (0, 0, 0), C(190, 150, 90), n=8, lobes=8, lobe_depth=0.12)
    if st >= 1:
        R = rng(4)
        for k in range(6 + 3 * st):
            a = R.uniform(0, 2 * math.pi)
            t = R.uniform(0.1, 0.8)
            z = h + 0.38 * s * t
            r = (0.12 - 0.07 * t * t) * (0.6 + 0.4 * s) * s
            ell((r * math.cos(a), r * math.sin(a), z), 0.022 * s + 0.004, AMBER, seg=5, ring=4, emit=GLOW)
    puff(st, h + 0.4 * s, AMBER, seed=19)


def umbrella(st):
    """Giant umbrella cap: tree-sized, with a skirt ring and hanging glow drops."""
    s, o = G[st]
    pad(r=0.5, seed=10, dots=4)
    h = 1.6 * s
    stem(h, 0.1 * s + 0.02, rgb=C(206, 200, 230), r2=0.07 * s + 0.02, bulb=0.3)
    torus(0.1 * s + 0.03, 0.025 * s, (0, 0, h * 0.7), C(230, 226, 250), n=10, k=4)
    closed = [(0.1, h - 0.05), (0.16, h + 0.05), (0.12, h + 0.17), (0, h + 0.2)]
    opened = [(0.85, h - 0.06), (0.88, h + 0.02), (0.55, h + 0.2), (0, h + 0.26)]
    cap([(r * s, h + (z - h) * s) for r, z in closed], [(r * s, h + (z - h) * s) for r, z in opened], o, TEAL, n=12)
    if o > 0.3:
        for x, y, z, a in ring_of(10, 0.65 * s * o, h - 0.02 * s):
            tube([(x, y, z), (x, y, z - 0.22 * s)], lambda t: 0.012 * s, ICE, rings=2, n=4)
            ell((x, y, z - 0.26 * s), 0.07 * s, CYAN, seg=7, ring=5, emit=GLOW)
        spots(st, h + 0.26 * s, 0.85 * s, CYAN, n=9, z_off=0.35, size=0.11 * s, seed=22)
        torus(0.86 * s * o, 0.03 * s, (0, 0, h - 0.04 * s), CYAN, n=14, k=4, emit=GLOW)
    puff(st, h + 0.3 * s, CYAN, seed=20, spread=0.7)


def fairy_ring(st):
    """Fairy ring: a circle of little round caps that fills in as it grows."""
    s, o = G[st]
    pad(r=0.48, seed=11, rgb=C(56, 104, 82))
    n = [3, 5, 7, 9, 9][st]
    for i, (x, y, z, a) in enumerate(ring_of(9, 0.32, 0.06)):
        if i >= n:
            continue
        k = (0.55 + 0.45 * ((i * 37) % 10) / 10) * (0.5 + 0.5 * s)
        with at((x, y, z), s=k):
            cyl(0.03, 0.1, (0, 0, 0), STEM, n=6)
            lathe([(0.08, 0.09), (0.085, 0.12), (0.05, 0.16), (0, 0.17)], (0, 0, 0), C(255, 220, 160) if i % 2 else C(190, 230, 255), n=8,
                  emit=GLOW * 0.8)
    if st == 4:
        sparkles((0, 0, 0.2), 12, 0.35, 0.022, AMBER, seed=23)


def veil(st):
    """Veil cap: a dark dome that drops a glowing lace skirt as it matures."""
    s, o = G[st]
    pad(r=0.28, seed=12)
    h = 0.5 * s
    stem(h, 0.06 * s + 0.015, rgb=C(200, 210, 230))
    closed = [(0.1, h - 0.02), (0.13, h + 0.06), (0.09, h + 0.15), (0, h + 0.17)]
    opened = [(0.16, h - 0.02), (0.18, h + 0.06), (0.12, h + 0.17), (0, h + 0.2)]
    sc = lambda p: [(r * s, h + (z - h) * s) for r, z in p]  # noqa: E731
    cap(sc(closed), sc(opened), o, C(70, 60, 110), n=9)
    if o > 0.15:
        L = 0.38 * s * o
        rr = 0.15 * s
        for x, y, z, a in ring_of(10, rr, h - 0.01):
            tube([(x, y, z), (x * 1.35, y * 1.35, z - L)], lambda t: 0.008, MINT, rings=2, n=4, emit=GLOW)
        for k in (0.35, 0.7, 1.0):
            torus(rr * (1 + 0.35 * k), 0.008, (0, 0, h - 0.01 - L * k), MINT, n=12, k=4, emit=GLOW)
    puff(st, h + 0.2 * s, MINT, seed=24)


SPECIES = [("Lantern cap", lantern), ("Moon disc", moon_disc), ("Inkcap", inkcap), ("Puffball", puffball), ("Coral fungus", coral_fungus),
           ("Pixie cup", pixie_cup), ("Jelly ear", jelly_ear), ("Shelf fungus", shelf), ("Glow morel", morel), ("Giant umbrella", umbrella),
           ("Fairy ring", fairy_ring), ("Veil cap", veil)]


def rows(lo, hi):
    return [(name, [(STAGES[i], (lambda f=f, i=i: f(i))) for i in range(5)]) for name, f in SPECIES[lo:hi]]


# ---------------------------------------------------------------- mix-and-match parts

CAP_SHAPES = {
    "bell": [(0.26, 0.37), (0.29, 0.51), (0.24, 0.67), (0.12, 0.77), (0, 0.79)],
    "dome": [(0.28, 0.42), (0.3, 0.48), (0.22, 0.62), (0.1, 0.68), (0, 0.69)],
    "disc": [(0.34, 0.46), (0.36, 0.5), (0.26, 0.54), (0.1, 0.555), (0, 0.56)],
    "cone": [(0.22, 0.4), (0.24, 0.45), (0.15, 0.6), (0.06, 0.72), (0, 0.78)],
    "wavy": [(0.32, 0.44), (0.34, 0.5), (0.22, 0.58), (0.09, 0.62), (0, 0.63)],
}


def part_cap(shape, rgb=INDIGO, glow=None):
    def f():
        k = dict(lobes=7, lobe_depth=0.1) if shape == "wavy" else {}
        k = dict(lobes=6, lobe_depth=0.28) if shape == "wavy" else k
        lathe(CAP_SHAPES[shape], (0, 0, 0), rgb, n=11, **k)
        if glow:
            glow(shape)
    return f


def part_stem(kind):
    def f():
        pad(r=0.28, seed=30)
        if kind == "slim":
            stem(0.45, 0.045)
        elif kind == "stout":
            stem(0.4, 0.09, r2=0.08)
        elif kind == "bulb":
            stem(0.42, 0.06, bulb=0.5)
        elif kind == "ringed":
            stem(0.45, 0.06)
            torus(0.08, 0.018, (0, 0, 0.32), C(236, 232, 250), n=10, k=4)
        elif kind == "curved":
            tube([(0, 0, 0.02), (0.06, 0, 0.2), (0.02, 0, 0.42)], lambda t: 0.055 - 0.015 * t, STEM, rings=6, n=7)
    return f


def glow_spots(shape):
    top = CAP_SHAPES[shape][-1][1]
    spots(3, top, CAP_SHAPES[shape][0][0], CYAN, n=7, z_off=0.6, size=0.04, seed=31)


def glow_rim(shape):
    r, z = CAP_SHAPES[shape][1]
    torus(r, 0.02, (0, 0, z - 0.02), MAGENTA, n=14, k=4, emit=GLOW)


def glow_gills(shape):
    """A glowing frill of gill slats peeking out under the rim."""
    r, z = CAP_SHAPES[shape][0]
    for x, y, zz, a in ring_of(16, r * 0.62, z - 0.02):
        box((r * 0.75, 0.018, 0.06), (x, y, zz), AMBER, rz=a, emit=GLOW)


def glow_cap(shape):
    lathe([(r * 1.01, z) for r, z in CAP_SHAPES[shape]], (0, 0, 0), C(140, 220, 80), n=11, emit=SOFT)


def glow_stripes(shape):
    prof = CAP_SHAPES[shape]
    for x, y, z, a in ring_of(6, 1.0, 0):
        pts = [(r * 1.02 * x, r * 1.02 * y, zz) for r, zz in prof[1:]]
        tube(pts, lambda t: 0.014 * (1 - 0.6 * t), MINT, rings=5, n=4, emit=GLOW)


def combo(shape, stem_kind, body, glow_fn):
    def f():
        part_stem(stem_kind)()
        dz = {"slim": 0.08, "stout": 0.03, "bulb": 0.05, "ringed": 0.08, "curved": 0.06}[stem_kind]
        with at((0.02 if stem_kind == "curved" else 0, 0, dz)):
            part_cap(shape, body, glow_fn)()
    return f


def faced(fn):
    def f():
        fn()
        critter_eyes((0.04, -0.115, 0.27), (0.35, -1, 0.0), size=0.026, gap=1.5, smile=True)
    return f


PARTS = [
    ("Cap shapes", [(k, part_cap(k)) for k in CAP_SHAPES]),
    ("Stems", [(k, part_stem(k)) for k in ("slim", "stout", "bulb", "ringed", "curved")]),
    ("Glow patterns (on one dome cap)", [(n, part_cap("dome", INDIGO, g)) for n, g in
                                         (("spots", glow_spots), ("rim", glow_rim), ("gills", glow_gills), ("whole cap", glow_cap), ("stripes", glow_stripes))]),
    ("Mixed from the parts above", [
        ("bell+bulb+gills", combo("bell", "bulb", PLUM, glow_gills)),
        ("disc+ringed+rim", combo("disc", "ringed", TEAL, glow_rim)),
        ("cone+slim+stripes", combo("cone", "slim", INDIGO, glow_stripes)),
        ("wavy+stout+spots", combo("wavy", "stout", C(150, 70, 90), glow_spots)),
        ("dome+curved+cap", combo("dome", "curved", MOSS, glow_cap)),
    ]),
]
