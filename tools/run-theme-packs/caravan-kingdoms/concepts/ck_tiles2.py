"""Caravan Kingdoms v2: the full strategy-game hex set. Forests, ocean, coast
configurations, every river combination, wild lands, highlands + resources,
farm + oasis variants, and terrain transitions. All on the same radius-1 flat-top hex."""
from ck_units import *  # noqa: F401,F403
from ck_build import field, sheep  # noqa: E402

LOW, MID, HIGH = ELEV["low"], ELEV["mid"], ELEV["high"]

# ---------------------------------------------------------------- region helpers


def edge_polys(edges, depth=0.42, fill=None):
    """Convex pieces covering the band along the given hex edges (trapezoids), plus
    inner sector triangles. fill: 'auto' fills sectors when 3+ edges, all when 4+."""
    V = hexpts()
    f = 1 - depth / APO
    I = [(x * f, y * f) for x, y in V]
    polys = [[V[k], V[(k + 1) % 6], I[(k + 1) % 6], I[k]] for k in edges]
    n = len(edges)
    if fill == "auto":
        if n >= 4:
            ks = range(6)
        elif n == 3 and all(((e + 1) % 6 in edges or (e - 1) % 6 in edges) for e in edges):
            ks = edges
        else:
            ks = []
        polys += [[(0.0, 0.0), I[k], I[(k + 1) % 6]] for k in ks]
    return [ccw(p) for p in polys]


def hex_clip(poly):
    for k in range(6):
        a = math.radians(edge_ang(k))
        poly = clip(poly, math.cos(a), math.sin(a), APO)
        if len(poly) < 3:
            return poly
    return poly


def grow(poly, k=1.18):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return ccw(hex_clip([(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in poly]))


def water_tile(col=SEA):
    column(hexpts(), WATER_Z, col, band=EARTH)


def coast(land_edges, H=LOW, top=GRASS, beach=True, fill="auto", depth=0.5, cliff=False):
    water_tile()
    polys = edge_polys(land_edges, depth, fill)
    if beach:
        for p in polys:
            g = grow(p, 1.22)
            if len(g) >= 3:
                column(g, WATER_Z + 0.05, SAND, band=EARTH, bevel=0.0)
    for p in polys:  # no chamfer on split pieces, so the joins between pieces vanish
        column(p, H, top, band=ROCKBAND if cliff else EARTH, bevel=0.0)
    return polys


def centroid(poly):
    return (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))

# ---------------------------------------------------------------- forests


def pine(p, s=1.0, rgb=C(46, 110, 80), snow=False):
    with at(p, s=s * TREE):
        cyl(0.02, 0.05, (0, 0, 0), WOOD_D, n=6)
        for i, (r, z, h) in enumerate(((0.08, 0.04, 0.11), (0.062, 0.11, 0.1), (0.042, 0.18, 0.09))):
            cone(r, h, (0, 0, z), rgb, n=6, rz=i * 20)
            if snow:
                cone(r * 0.55, h * 0.45, (0, 0, z + h * 0.55 + 0.002), SNOW, n=6, rz=i * 20)


def jungle_tree(p, s=1.0):
    with at(p, s=s * TREE):
        cyl(0.022, 0.16, (0, 0, 0), C(110, 80, 56), n=6)
        for i in range(5):
            a = math.radians(i * 72 + 10)
            ell((math.cos(a) * 0.06, math.sin(a) * 0.06, 0.18), (0.07, 0.05, 0.03), C(40, 140, 70) if i % 2 else C(60, 160, 60), seg=7, ring=4, rz=i * 72)
        ell((0, 0, 0.2), (0.05, 0.05, 0.04), C(50, 150, 66), seg=7, ring=5)


def ft_dense(H, R, e):
    hex_tile(H, C(70, 120, 70))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 13, 0.72)):
            conifer((x, y, 0), 0.8 + 0.2 * (i % 3), FOREST if i % 2 else C(56, 120, 76))


def ft_sparse(H, R, e):
    hex_tile(H, GRASS)
    with at((0, 0, H)):
        for (x, y, s) in ((-0.3, 0.25, 1.0), (0.35, 0.1, 0.85), (0.0, -0.4, 0.8)):
            broadleaf((x, y, 0), s)
        for (x, y) in scatter(R, 6, 0.7):
            tuft((x, y, 0), 1.0, GRASS_D)


def ft_pine(H, R, e):
    hex_tile(H, C(110, 150, 96))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 9, 0.68)):
            pine((x, y, 0), 0.9 + 0.25 * (i % 3))


def ft_jungle(H, R, e):
    hex_tile(H, C(70, 150, 70))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 8, 0.66)):
            jungle_tree((x, y, 0), 0.9 + 0.2 * (i % 2))
        for (x, y) in scatter(rng(5), 6, 0.75):
            bush((x, y, 0), 0.8, C(50, 140, 60), C(240, 90, 120))


def ft_autumn(H, R, e):
    hex_tile(H, C(170, 170, 90))
    cols = (C(226, 120, 50), C(236, 176, 60), C(196, 70, 50), C(214, 150, 60))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 8, 0.66)):
            broadleaf((x, y, 0), 0.9 + 0.2 * (i % 2), cols[i % 4])
        for (x, y) in scatter(rng(8), 6, 0.75):
            ell((x, y, 0.005), (0.04, 0.03, 0.008), cols[(int(x * 10)) % 4], seg=6, ring=4)


def ft_snowpine(H, R, e):
    hex_tile(H, SNOW, band=ROCKBAND)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 8, 0.66)):
            pine((x, y, 0), 0.9 + 0.2 * (i % 3), C(40, 96, 80), snow=True)
        for (x, y) in scatter(rng(4), 4, 0.7):
            ell((x, y, 0), (0.08, 0.06, 0.03), C(236, 240, 248), seg=7, ring=4)


def ft_hills(H, R, e):
    hex_tile(H, GRASS)
    with at((0, 0, H)):
        for (x, y, r, h) in ((-0.22, 0.25, 0.42, 0.22), (0.32, -0.05, 0.36, 0.18), (-0.25, -0.38, 0.28, 0.12)):
            ell((x, y, 0), (r, r * 0.85, h), C(110, 160, 80), seg=8, ring=6)
            for k in range(3):
                a = k * 2.1 + x
                conifer((x + r * 0.4 * math.cos(a), y + r * 0.35 * math.sin(a), h * 0.6), 0.75)


def ft_bamboo(H, R, e):
    hex_tile(H, C(150, 190, 96))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(((-0.35, 0.3), (0.0, 0.42), (0.38, 0.25), (-0.15, 0.0), (0.25, -0.15), (-0.42, -0.25), (0.05, -0.45))):
            bamboo((x, y, 0), 1.0 + 0.15 * (i % 2), rng(i + 4), n=5)


FORESTS = [("dense forest", ft_dense), ("sparse woods", ft_sparse), ("pine forest", ft_pine), ("jungle", ft_jungle),
           ("autumn forest", ft_autumn), ("snowy pines", ft_snowpine), ("forest hills", ft_hills), ("bamboo grove", ft_bamboo)]

# ---------------------------------------------------------------- ocean


def oc_deep(H, R, e):
    TER["sea"](H, R, "high")


def oc_shallow(H, R, e):
    TER["sea"](H, R, "low")


def oc_reef(H, R, e):
    water_tile(SHALLOW)
    with at((0, 0, WATER_Z)):
        cols = (C(240, 120, 110), C(250, 170, 80), C(230, 90, 150), C(250, 220, 120))
        for i, (x, y) in enumerate(scatter(R, 8, 0.6)):
            ell((x, y, 0.0), (0.11, 0.09, 0.06), cols[i % 4], seg=7, ring=5)
            for k in range(3):
                box((0.03, 0.03, 0.09 + 0.03 * k), (x + 0.04 * math.cos(k * 2.1), y + 0.04 * math.sin(k * 2.1), 0.03), cols[(i + 1) % 4], bevel=0.008)
        wave((0.45, -0.4, 0), 300)


def oc_ice(H, R, e):
    water_tile(DEEP)
    with at((0, 0, WATER_Z)):
        for i, (x, y, r) in enumerate(((-0.3, 0.2, 0.26), (0.25, 0.3, 0.2), (0.15, -0.3, 0.24), (-0.4, -0.35, 0.14))):
            cyl(r, 0.05, (x, y, -0.02), C(240, 248, 252), n=6, rz=i * 17)
            cyl(r * 0.9, 0.012, (x, y, -0.03), C(170, 210, 236), n=6, rz=i * 17)
        frustum(0.12, 0.1, 0.05, 0.05, 0.0, 0.12, C(236, 246, 252), (-0.3, 0.2, 0.03))


def oc_kelp(H, R, e):
    water_tile(C(40, 120, 150))
    with at((0, 0, WATER_Z)):
        for i, (x, y) in enumerate(scatter(R, 7, 0.6)):
            for k in range(4):
                a = k * 1.57 + i
                box((0.13, 0.04, 0.016), (x + 0.06 * math.cos(a), y + 0.06 * math.sin(a), 0.006), C(70, 130, 60) if k % 2 else C(120, 130, 50), rz=math.degrees(a), bevel=0.006)
            cyl(0.035, 0.05, (x, y, 0), C(170, 150, 60), n=6)


def oc_fish(H, R, e):
    water_tile(SEA)
    with at((0, 0, WATER_Z)):
        cyl(0.48, 0.006, (0, 0, 0), C(90, 170, 214), n=8)
        for x, y, z, a in ring_of(7, 0.34, 0.0):
            with at((x, y, 0.02), rz=a + 90):
                box((0.13, 0.05, 0.035), (0, 0, 0), C(206, 220, 232), bevel=0.012)
                slab([(0.06, 0), (0.11, -0.03), (0.11, 0.03)], 0.016, (0, 0, 0.0), C(170, 190, 210), rx=90)
        with at((0.05, -0.05, 0.1), ry=-40):
            box((0.15, 0.05, 0.05), (0, 0, 0), C(226, 234, 242), bevel=0.014)
        torus(0.13, 0.02, (0.05, -0.05, 0.006), FOAM, n=10, k=4)


def oc_rocks(H, R, e):
    water_tile(SEA)
    with at((0, 0, WATER_Z - 0.03)):
        for (x, y, r, h) in ((-0.2, 0.15, 0.13, 0.32), (0.18, 0.25, 0.09, 0.2), (0.25, -0.25, 0.07, 0.14)):
            frustum(r * 2, r * 1.8, r * 1.2, r * 1.1, 0, h, ROCK, (x, y, 0))
            box((r * 1.3, r * 1.2, 0.02), (x, y, h + 0.005), C(120, 170, 90))
            torus(r * 1.1, 0.012, (x, y, 0.03), FOAM, n=8, k=4)


def oc_islet(H, R, e):
    water_tile(SHALLOW)
    with at((0, 0, 0)):
        column(hexpts(0.42), WATER_Z + 0.05, SAND, band=EARTH)
        column(hexpts(0.3), LOW, GRASS, band=EARTH)
    with at((0, 0, LOW)):
        palm((0.0, 0.05, 0), 1.0, (0.03, -0.02))
        bush((-0.12, -0.1, 0), 0.8, C(110, 160, 70))


OCEAN = [("deep ocean", oc_deep), ("open sea", lambda H, R, e: TER["sea"](H, R, "mid")), ("shallows", oc_shallow), ("coral reef", oc_reef),
         ("ice floes", oc_ice), ("kelp beds", oc_kelp), ("fish shoals", oc_fish), ("sea stacks", oc_rocks), ("islet", oc_islet)]

COASTS = [("1 land edge", [1]), ("2 land edges", [1, 2]), ("3 land edges", [0, 1, 2]), ("4 land edges", [0, 1, 2, 3]),
          ("5 land edges (cove)", [5, 0, 1, 2, 3]), ("strait (2 opposite)", [1, 4]), ("3 points", [0, 2, 4]), ("2 apart", [0, 2])]


def coast_tile(edges, e="low"):
    def f(H=None, R=None, ee=None):
        H = ELEV[e]
        polys = coast(edges, H, GRASS if e != "high" else C(150, 170, 110), cliff=(e == "high"))
        big = max(polys, key=lambda p: abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))))
        cx, cy = centroid(big)
        with at((cx, cy, H)):
            if len(edges) >= 3:
                palm((0.0, 0.0, 0), 0.8, (0.03, -0.02))
            else:
                tuft((0.0, 0.0, 0), 1.0, GRASS_D)
        with at((0, 0, WATER_Z)):
            wave((0.35 * math.cos(math.radians(edge_ang((edges[0] + 3) % 6))), 0.35 * math.sin(math.radians(edge_ang((edges[0] + 3) % 6))), 0), 300)
    return f

# ---------------------------------------------------------------- rivers


def r_tile(edges, top=GRASS, extra=None, hub=True):
    def f(H, R, e):
        hex_tile(H, top)
        river(H, edges)
        with at((0, 0, H)):
            av = [(*edge_mid(k, d), 0.2) for k in edges for d in (0.0, 0.2, 0.4, 0.6, 0.8)]
            for (x, y) in scatter(R, 7, 0.75, avoid=av):
                tuft((x, y, 0), 1.0, GRASS_D)
            if extra:
                extra(H, R)
    return f


def _spring(H, R):
    with at((0, 0, H)):
        cyl(0.2, 0.024, (0, 0, -0.002), WATER, n=8)
        for x, y, z, a in ring_of(7, 0.22, 0.0, 0.3):
            rock((x, y, 0), 0.06, ROCK, rz=a)
        cyl(0.03, 0.04, (0, 0, 0.0), FOAM, n=6)


def r_source(H, R, e):
    hex_tile(H, GRASS)
    with at((0, 0, H)):
        link([4], 0.012, 0.34, C(214, 196, 140), t=0.022, hub=False)
        link([4], 0.016, 0.24, WATER, t=0.02, side=0.1, hub=False)
    _spring(H, R)
    with at((0, 0, H)):
        peak((-0.3, 0.4, 0), 0.3, 0.3, ROCK, 0.0, rz=10)
        broadleaf((0.4, 0.3, 0), 0.8)


def r_lakemouth(H, R, e):
    hex_tile(H, GRASS)
    with at((0, 0, H)):
        link([4], 0.012, 0.34, C(214, 196, 140), t=0.022, hub=False)
        link([4], 0.016, 0.24, WATER, t=0.02, side=0.1, hub=False)
        cyl(0.56, 0.012, (0, 0.18, 0), C(222, 206, 150), n=9)
        cyl(0.48, 0.022, (0, 0.18, 0), WATER, n=9, rz=12)
        reeds((0.4, -0.05, 0), 0.9)
        reeds((-0.42, 0.0, 0), 0.8)


def r_waterfall(H, R, e):
    hi, lo = max(H, MID) + 0.2, LOW
    hx = hexpts()
    back = clip(hx, 0, -1, -0.05)  # y >= 0.05
    front = clip(hx, 0, 1, 0.05)   # y <= 0.05
    column(front, lo, GRASS)
    column(back, hi, C(150, 170, 110), band=ROCKBAND)
    w = 0.24
    with at((0, 0, hi)):
        box((w + 0.1, APO - 0.05, 0.022), (0, (APO + 0.05) / 2, 0.001), C(214, 196, 140))
        box((w, APO - 0.05, 0.022), (0, (APO + 0.05) / 2, 0.006), WATER)
        box((w, 0.02, 0.1), (0, APO + 0.008, -0.04), WATER)
        peak((-0.45, 0.4, 0), 0.25, 0.25, ROCK, 0.0)
        pine((0.45, 0.35, 0), 0.9)
    box((w, 0.05, hi - lo + 0.02), (0, 0.035, (hi + lo) / 2), C(150, 214, 230))  # the fall
    box((w * 0.6, 0.052, hi - lo), (0, 0.033, (hi + lo) / 2), FOAM)
    with at((0, 0, lo)):
        box((w + 0.1, APO, 0.022), (0, -APO / 2 + 0.02, 0.001), C(214, 196, 140))
        box((w, APO, 0.022), (0, -APO / 2 + 0.02, 0.006), WATER)
        box((w, 0.02, 0.1), (0, -APO - 0.008, -0.04), WATER)
        cyl(0.17, 0.026, (0, -0.06, 0.0), WATER, n=8)
        for x in (-0.07, 0.0, 0.07):
            ell((x, -0.03, 0.03), (0.05, 0.04, 0.025), FOAM, seg=6, ring=4)
        tuft((0.4, -0.3, 0), 1.0, GRASS_D)
        tuft((-0.4, -0.2, 0), 1.0, GRASS_D)


def r_ford(H, R, e):
    hex_tile(H, GRASS)
    river(H, [1, 4])
    with at((0, 0, H)):
        from ck_routes import dirt_road
        dirt_road([0, 3])
        cyl(0.2, 0.024, (0, 0, -0.002), SHALLOW, n=8)
        for t in (-0.12, -0.04, 0.04, 0.12):
            box((0.06, 0.07, 0.03), (t * math.cos(math.radians(30)) * 1.0, t * math.sin(math.radians(30)), 0.02), ROCK, bevel=0.008, rz=30)


RIVERS = [("straight", r_tile([1, 4])), ("bend 120°", r_tile([1, 5])), ("bend 60°", r_tile([1, 2])), ("Y fork", r_tile([1, 3, 5])),
          ("branch left", r_tile([1, 4, 2])), ("branch right", r_tile([1, 4, 0])), ("arrow fork", r_tile([4, 0, 2])), ("crossing (4)", r_tile([0, 1, 3, 4])),
          ("source spring", r_source), ("lake mouth", r_lakemouth), ("waterfall", r_waterfall), ("ford", r_ford), ("delta", TER["river delta"])]

# ---------------------------------------------------------------- wild lands


def w_marsh(H, R, e):
    hex_tile(H, C(110, 150, 90))
    with at((0, 0, H)):
        for i, (x, y, r) in enumerate(((-0.3, 0.2, 0.22), (0.25, 0.3, 0.16), (0.15, -0.25, 0.2), (-0.35, -0.35, 0.13), (0.5, -0.05, 0.11))):
            cyl(r, 0.014, (x, y, -0.002), C(96, 150, 140), n=7, rz=i * 20)
        for (x, y) in ((0.0, 0.05), (-0.1, -0.1), (0.4, 0.15), (-0.5, 0.0), (0.3, -0.45), (-0.1, 0.5)):
            reeds((x, y, 0), 1.0)


def w_flood(H, R, e):
    hex_tile(H, C(150, 196, 90))
    river(H, [1, 4])
    with at((0, 0, H)):
        for (x, y, r) in ((-0.35, 0.15, 0.14), (0.38, -0.2, 0.12), (-0.25, -0.45, 0.09)):
            cyl(r, 0.012, (x, y, -0.002), SHALLOW, n=7)
        for (x, y, rz) in ((0.4, 0.3, 10), (-0.42, -0.1, -20)):
            field((x, y, 0), 0.24, 0.2, 1, rz=rz)
        for (x, y) in ((0.15, 0.3), (-0.15, -0.3)):
            ell((x, y, 0.0), (0.12, 0.06, 0.012), C(200, 186, 140), seg=6, ring=4)  # silt


def w_tundra(H, R, e):
    hex_tile(H, C(150, 160, 130), band=ROCKBAND)
    with at((0, 0, H)):
        for i, (x, y) in enumerate(scatter(R, 11, 0.72)):
            if i % 3 == 0:
                rock((x, y, 0), 0.09, C(160, 156, 150), rz=i * 40)
            else:
                bush((x, y, 0), 0.9, (C(190, 170, 110), C(120, 140, 100), C(200, 120, 90))[i % 3])
        for (x, y) in ((0.3, 0.3), (-0.4, -0.2)):
            ell((x, y, 0.0), (0.12, 0.08, 0.02), SNOW, seg=7, ring=4)


def w_snow(H, R, e):
    hex_tile(H, C(232, 238, 248), band=ROCKBAND)
    with at((0, 0, H)):
        for (x, y, r, h) in ((-0.25, 0.25, 0.32, 0.14), (0.3, -0.1, 0.26, 0.11), (-0.1, -0.4, 0.2, 0.08)):
            dune((x + 0.15, y, 0), r * 1.3, h, -15, rgb=C(250, 252, 255))
        for (x, y) in ((0.4, 0.35), (-0.5, -0.05)):
            rock((x, y, 0), 0.08, ROCK_D, rz=10)
        for (x, y) in ((0.15, 0.45), (-0.35, -0.5)):
            pine((x, y, 0), 0.7, C(40, 96, 80), snow=True)


def w_glacier(H, R, e):
    hex_tile(H, C(210, 232, 244), band=C(130, 150, 170))
    with at((0, 0, H)):
        for i, (x, y, w, d, h) in enumerate(((-0.25, 0.2, 0.36, 0.3, 0.22), (0.25, 0.25, 0.28, 0.26, 0.16), (0.1, -0.25, 0.4, 0.24, 0.12), (-0.38, -0.3, 0.2, 0.2, 0.09))):
            frustum(w, d, w * 0.8, d * 0.75, 0, h, C(226, 244, 252) if i % 2 else C(196, 226, 244), (x, y, 0))
        for (x, y) in ((0.0, 0.05), (-0.05, -0.05)):
            box((0.5, 0.018, 0.01), (x, y, 0.002), C(90, 150, 200), rz=25)


def w_volcano(H, R, e):
    hex_tile(H, C(80, 70, 70), band=C(70, 56, 56))
    with at((0, 0, H)):
        lathe([(0.7, 0), (0.5, 0.25), (0.24, 0.52), (0.18, 0.55)], (0, 0.05, 0), C(96, 84, 84), n=8)
        cyl(0.17, 0.02, (0, 0.05, 0.53), C(255, 120, 40), n=8, emit=1.4)
        for i in range(3):  # lava runs down the slope
            a = math.radians(-90 + (i - 1) * 32)
            ca, sa = math.cos(a), math.sin(a)
            tube([(0.17 * ca, 0.05 + 0.17 * sa, 0.56), (0.36 * ca, 0.05 + 0.36 * sa, 0.33), (0.6 * ca, 0.05 + 0.6 * sa, 0.08)],
                 lambda t: (0.035 - 0.012 * t, 0.012), C(255, 110, 40), rings=5, n=4, emit=1.3)
        for (x, y, r) in ((0.0, 0.1, 0.07), (0.05, 0.15, 0.06), (-0.03, 0.12, 0.05)):
            ell((x, y, 0.7 + r), r, C(110, 104, 110), seg=6, ring=4)


def w_canyon(H, R, e):
    hex_tile(H, C(214, 140, 96), band=TERRA_D)
    with at((0, 0, H)):
        for sx in (-1, 1):
            poly = hex_clip(ccw([(sx * 0.12, -1.2), (sx * 1.2, -1.2), (sx * 1.2, 1.2), (sx * 0.12, 1.2)]))
            bands = (TERRA, C(232, 150, 92), TERRA_D, C(240, 196, 140))
            z = 0
            for i, c in enumerate(bands):
                prism(ccw(poly), z, z + 0.07, c)
                z += 0.07
        box((0.26, 1.6, 0.03), (0, 0, 0.0), WATER)


def w_mesa(H, R, e):
    hex_tile(H, C(222, 150, 100), band=TERRA_D)
    with at((0, 0, H)):
        mesa((0.0, 0.1, 0), 0.5, 0.55, 15)
        rock((0.45, -0.35, 0), 0.07, TERRA_D, rz=30)
        bush((-0.45, -0.3, 0), 0.8, C(150, 150, 90))


def w_cliffs(H, R, e):
    hx = hexpts()
    hi = H + 0.3
    back = clip(hx, -0.5, -0.866, 0.1)
    front = clip(hx, 0.5, 0.866, -0.1)
    column(front, H, GRASS)
    column(back, hi, C(150, 176, 110), band=ROCKBAND)
    for i in range(5):
        t = -0.7 + i * 0.35
        x, y = t * 0.866 - 0.06 * 0.5, -t * 0.5 - 0.06 * 0.866
        frustum(0.16, 0.08, 0.12, 0.06, 0, hi - H - 0.04 * (i % 2), ROCK if i % 2 else ROCK_D, (x, y, H))
    with at((0, 0, hi)):
        pine((-0.3, 0.45, 0), 0.9)
    with at((0, 0, H)):
        rock((0.3, -0.45, 0), 0.06, ROCK_D)


def w_cave(H, R, e):
    hex_tile(H, C(176, 162, 136), band=ROCKBAND)
    with at((0, 0, H)):
        lathe([(0.6, 0), (0.48, 0.22), (0.26, 0.4), (0, 0.45)], (0, 0.15, 0), ROCK, n=7)
        arch((0, -0.33, 0.0), 0.3, 0.32, INK)
        for sx in (-1, 1):
            frustum(0.1, 0.1, 0.06, 0.06, 0, 0.34, ROCK_D, (sx * 0.19, -0.31, 0))
        cone(0.03, 0.06, (0.22, -0.45, 0), C(250, 150, 50), n=5, emit=1.0)
        for i in range(3):
            rock((-0.3 + i * 0.07, -0.5, 0), 0.04, ROCK_D, rz=i * 40)


def w_ruins(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H), s=1.7):
        DEC["ruins"][0]()
    with at((0, 0, H)):
        for i in range(4):
            box((0.2, 0.06, 0.08 - 0.015 * i), (-0.45 + i * 0.22, 0.45, 0.04 - 0.008 * i), C(214, 196, 166), rz=-20)


WILD = [("marsh", w_marsh), ("floodplain", w_flood), ("tundra", w_tundra), ("snowfield", w_snow), ("glacier", w_glacier), ("volcano", w_volcano),
        ("canyon", w_canyon), ("mesa", w_mesa), ("cliffs", w_cliffs), ("cave entrance", w_cave), ("ruins", w_ruins), ("red badlands", TER["red badlands"])]

# ---------------------------------------------------------------- highlands + resources


def h_range(n):
    def f(H, R, e):
        hex_tile(H, C(170, 156, 128), band=ROCKBAND)
        spots = {1: [(0.0, 0.08, 0.62, 1.0)], 2: [(-0.22, 0.15, 0.48, 0.95), (0.3, -0.12, 0.4, 0.75)],
                 3: [(-0.05, 0.25, 0.46, 1.0), (-0.38, -0.2, 0.34, 0.7), (0.36, -0.15, 0.36, 0.78)]}[n]
        with at((0, 0, H)):
            for i, (x, y, r, k) in enumerate(spots):
                peak((x, y, 0), r, 0.95 * k, ROCK if i % 2 == 0 else ROCK_D, 0.4, rz=i * 30 + 10)
    return f


def ore(p, rgb, s=1.0):
    with at(p, s=s):
        rock((0, 0, 0), 0.09, ROCK_D, rz=10, n=6)
        for k in range(4):
            a = k * 1.6
            box((0.035, 0.035, 0.03), (0.06 * math.cos(a), 0.06 * math.sin(a), 0.05 + 0.02 * (k % 2)), rgb, rz=k * 30, rx=20, metal=0.3, rough=0.4)


def h_iron(H, R, e):
    TER["hills"](H, R, e)
    with at((0, 0, H)):
        for (x, y) in ((0.1, -0.35), (0.45, 0.2), (-0.45, -0.1)):
            ore((x, y, 0.0), C(170, 80, 50), 2.2)


def h_gems(H, R, e):
    h_range(2)(H, R, e)
    with at((0, 0, H)):
        for i, (x, y, c, k) in enumerate(((0.05, -0.42, C(220, 50, 90), 1.0), (-0.15, -0.48, C(60, 120, 230), 0.8), (0.24, -0.45, C(80, 200, 120), 0.75), (-0.32, -0.35, C(160, 80, 220), 0.6))):
            with at((x, y, 0), s=k * 2.0, ry=(i - 1.5) * 10):
                cyl(0.04, 0.1, (0, 0, 0), c, n=6, rough=0.15)
                cone(0.04, 0.05, (0, 0, 0.1), c, n=6, rough=0.15)


def h_gold(H, R, e):
    TER["hills"](H, R, e)
    with at((0, 0, H)):
        for (x, y) in ((0.1, -0.35), (0.45, 0.2)):
            ore((x, y, 0.0), GOLD, 2.2)
        cyl(0.12, 0.012, (-0.4, -0.25, 0), WATER, n=7)


def h_marble(H, R, e):
    hex_tile(H, C(220, 214, 200), band=ROCKBAND)
    with at((0, 0, H)):
        for i, (x, y, w, h) in enumerate(((-0.1, 0.2, 0.5, 0.3), (0.3, 0.05, 0.3, 0.18), (-0.35, -0.2, 0.24, 0.12))):
            frustum(w, w * 0.8, w * 0.75, w * 0.6, 0, h, C(246, 244, 238) if i % 2 == 0 else C(226, 222, 214), (x, y, 0))
        for i in range(3):
            box((0.08, 0.06, 0.05), (0.25 + i * 0.09, -0.35, 0.025), C(246, 244, 238), bevel=0.006)


def h_incense(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        for (x, y, s) in ((-0.3, 0.2, 1.0), (0.3, 0.25, 0.85), (0.0, -0.3, 0.9)):
            with at((x, y, 0), s=s * TREE * 1.7):
                tube([(0, 0, 0), (0.02, 0, 0.07), (0.06, 0.01, 0.12)], lambda t: 0.018 - 0.006 * t, C(170, 140, 110), rings=4, n=5)
                tube([(0, 0, 0.05), (-0.05, 0.0, 0.11)], lambda t: 0.012, C(170, 140, 110), rings=3, n=5)
                for (dx, dz) in ((0.06, 0.14), (-0.05, 0.12)):
                    ell((dx, 0.01, dz), (0.05, 0.05, 0.028), C(130, 160, 90), seg=7, ring=4)
                ell((0.02, -0.02, 0.06), 0.012, C(240, 190, 80), seg=5, ring=4)


def h_horses(H, R, e):
    hex_tile(H, STEPPE)
    with at((0, 0, H)):
        for i, (x, y, rz, c) in enumerate(((-0.2, 0.1, 60, C(150, 96, 60)), (0.2, 0.2, 40, C(214, 170, 120)), (0.05, -0.3, 80, C(90, 70, 60)))):
            with at((x, y, 0), rz=rz, s=1.3):
                horse(c)
        for (x, y) in scatter(R, 6, 0.75, avoid=[(-0.2, 0.1, 0.2), (0.2, 0.2, 0.2), (0.05, -0.3, 0.2)]):
            tuft((x, y, 0), 1.0, STEPPE_D)


def h_tea(H, R, e):
    hex_tile(H, C(120, 170, 90))
    with at((0, 0, H)):
        z = 0.0
        for i, (r, dy, h) in enumerate(((0.86, 0.0, 0.07), (0.6, 0.14, 0.08), (0.34, 0.26, 0.08))):
            cyl(r, h, (0, dy, z), C(150, 120, 80), n=6)
            for j in range(-3, 4):
                x = j * r * 0.24
                if abs(x) < r * 0.7:
                    box((0.1, 0.05, 0.04), (x, dy - r * 0.62, z + h + 0.02), C(60, 140, 70), bevel=0.012)
            z += h


HIGHLANDS = [("range: 1 peak", h_range(1)), ("range: 2 peaks", h_range(2)), ("range: 3 peaks", h_range(3)), ("high pass", TER["high pass"]),
             ("iron hills", h_iron), ("gem mountain", h_gems), ("gold hills", h_gold), ("marble crags", h_marble),
             ("incense groves", h_incense), ("wild horses", h_horses), ("tea hills", h_tea), ("salt flat", TER["salt flat"])]

# ---------------------------------------------------------------- farm + oasis


def fo_farmland(H, R, e):
    hex_tile(H, GRASS)
    with at((0, 0, H)):
        for (x, y, w, d, st, rz, c) in ((-0.3, 0.25, 0.4, 0.32, 2, 10, None), (0.28, 0.15, 0.34, 0.4, 1, -30, None), (-0.05, -0.35, 0.5, 0.26, 2, -5, C(226, 170, 70)), (0.45, -0.3, 0.2, 0.2, 0, 20, None)):
            field((x, y, 0), w, d, st, rz=rz, crop=c)
        box((0.06, 1.4, 0.02), (0.06, 0.0, 0.008), C(140, 190, 220), rz=-25)  # irrigation ditch


def fo_pasture(H, R, e):
    hex_tile(H, C(150, 190, 96))
    with at((0, 0, H)):
        for i, (x, y) in enumerate(((-0.2, 0.0), (0.1, -0.2), (0.25, 0.2), (-0.35, 0.3), (0.4, -0.25))):
            sheep((x, y, 0), i * 50, C(248, 244, 232) if i % 3 else C(90, 70, 60))
        for k in range(6):
            cyl(0.012, 0.07, (-0.6 + k * 0.12, -0.45 + k * 0.02, 0), WOOD, n=5)
        box((0.62, 0.012, 0.012), (-0.3, -0.4, 0.05), WOOD, rz=9.5)


def fo_vineyard(H, R, e):
    hex_tile(H, C(170, 170, 100))
    with at((0, 0, H)):
        z = 0.0
        for i, (r, dy, h) in enumerate(((0.86, 0.0, 0.07), (0.62, 0.14, 0.08), (0.38, 0.26, 0.08))):
            cyl(r, h, (0, dy, z), C(190, 150, 100), n=6)
            for j in range(-3, 4):
                x = j * r * 0.24
                if abs(x) < r * 0.7:
                    cyl(0.008, 0.06, (x, dy - r * 0.6, z + h), WOOD_D, n=4)
                    box((0.07, 0.035, 0.05), (x, dy - r * 0.6, z + h + 0.07), C(90, 140, 60), bevel=0.01)
                    ell((x + 0.02, dy - r * 0.6 - 0.02, z + h + 0.045), 0.016, PLUM, seg=5, ring=4)
            z += h


def fo_oasis_pool(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        cyl(0.3, 0.012, (0.05, 0.1, 0), GRASS, n=8)
        cyl(0.2, 0.022, (0.05, 0.1, 0), WATER, n=8)
        palm((-0.2, 0.3, 0), 0.9, (0.03, -0.02))
        dune((0.35, -0.3, 0), 0.3, 0.12, -10)
        rock((-0.4, -0.35, 0), 0.06, C(196, 160, 120))


def fo_oasis_grove(H, R, e):
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        cyl(0.66, 0.012, (0, 0, 0), C(120, 176, 80), n=10)
        cyl(0.18, 0.022, (0, -0.05, 0), WATER, n=8)
        for i, (x, y) in enumerate(scatter(R, 9, 0.6, rmin=0.25)):
            palm((x, y, 0), 0.8 + 0.15 * (i % 3), (0.02 * ((i % 3) - 1), 0.02))


def fo_oasis_qanat(H, R, e):
    """Oasis fed by a qanat: a line of well shafts across the sand to a pool + garden."""
    hex_tile(H, SAND, band=C(178, 128, 86))
    with at((0, 0, H)):
        for i in range(4):
            x, y = -0.55 + i * 0.16, 0.45 - i * 0.12
            cyl(0.05, 0.03, (x, y, 0), C(200, 170, 120), n=8)
            cyl(0.03, 0.032, (x, y, 0), INK, n=8)
        cyl(0.22, 0.022, (0.15, -0.1, 0), WATER, n=8)
        field((0.3, -0.45, 0), 0.3, 0.16, 1, rz=-20)
        palm((0.45, 0.1, 0), 0.9, (-0.02, -0.02))
        palm((-0.1, -0.35, 0), 0.8, (0.02, 0.02))


FARMS = [("farmland", fo_farmland), ("pasture", fo_pasture), ("vineyard terraces", fo_vineyard), ("rice terraces", TER["rice terraces"]),
         ("tea hills", h_tea), ("oasis pool", fo_oasis_pool), ("oasis grove", fo_oasis_grove), ("qanat oasis", fo_oasis_qanat)]

# ---------------------------------------------------------------- transitions


def blend(base_top, over_top, edges, H, band=EARTH, deco=None):
    """Base terrain with another terrain creeping in along the given edges, its
    edge broken up by blobs so the join reads as a soft blend."""
    hex_tile(H, base_top, band=band)
    with at((0, 0, H)):
        for p in edge_polys(edges, 0.5, "auto"):
            prism(p, -0.002, 0.008, over_top)
        f = 1 - 0.5 / APO
        V = hexpts()
        for k in edges:
            a0 = (V[k][0] * f, V[k][1] * f)
            a1 = (V[(k + 1) % 6][0] * f, V[(k + 1) % 6][1] * f)
            for t in (0.15, 0.5, 0.85):
                x, y = a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t
                cyl(0.1, 0.01, (x, y, -0.002), over_top, n=7, rz=t * 90)
        # a little life on each side: tufts on the base side, pebbles / dots on the incoming side
        k0 = edges[len(edges) // 2]
        a = math.radians(edge_ang(k0))
        ca, sa = math.cos(a), math.sin(a)
        for d, o in ((-0.45, 0.2), (-0.35, -0.3), (-0.1, 0.45)):
            x, y = ca * d - sa * o, sa * d + ca * o
            if base_top in (GRASS, STEPPE):
                tuft((x, y, 0.0), 1.1, GRASS_D if base_top == GRASS else STEPPE_D)
            else:
                rock((x, y, 0.0), 0.05, C(196, 170, 130), rz=d * 90)
        for o in (-0.25, 0.25):
            x, y = ca * 0.62 - sa * o, sa * 0.62 + ca * o
            rock((x, y, 0.006), 0.045, tuple(c * 0.85 for c in over_top), rz=o * 100)
        if deco:
            deco()


def tr(base, over, edges, band=EARTH, deco=None):
    return lambda H, R, e: blend(base, over, edges, H, band, deco)


TRANSITIONS = [("grass > desert, 1 edge", tr(GRASS, SAND, [4])), ("grass > desert, 2 edges", tr(GRASS, SAND, [4, 5])),
               ("grass > desert, 3 edges", tr(GRASS, SAND, [3, 4, 5])), ("steppe > desert, 3 edges", tr(STEPPE, SAND, [0, 1, 2])),
               ("grass > steppe, 2 edges", tr(GRASS, STEPPE, [1, 2])), ("grass > snow, 2 edges", tr(GRASS, SNOW, [0, 1])),
               ("desert > salt, 2 edges", tr(SAND, SALT, [4, 5])), ("steppe > badlands, 1 edge", tr(STEPPE, C(222, 150, 100), [1]))]


def cell(fn, e="mid", seed=3):
    """Board cell: a tile function (H, R, e) at the given elevation."""
    return lambda: fn(ELEV[e], rng(seed), e)
