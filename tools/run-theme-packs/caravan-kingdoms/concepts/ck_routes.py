"""Caravan Kingdoms: route pieces. Roads are edge-to-centre connector segments
(one per hex edge, plus a hub) so any combination of edges builds a junction."""
from ck_units import *  # noqa: F401,F403

DIRT = C(190, 140, 92)
DIRT_D = C(150, 104, 66)
STONE = C(196, 190, 182)
STONE_D = C(150, 144, 140)


def dirt_road(edges, z=0.0):
    with at((0, 0, z)):
        link(edges, 0.012, 0.26, DIRT, t=0.02, hub_r=0.15)
        for k in edges:  # wheel ruts
            a = edge_ang(k)
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            for o in (-0.045, 0.045):
                L = APO - 0.12
                cx, cy = ca * (0.12 + L / 2) - sa * o, sa * (0.12 + L / 2) + ca * o
                box((0.018, L, 0.006), (cx, cy, 0.014), DIRT_D, rz=a - 90)
        if len(edges) == 1:
            signpost((0.0, 0.0, 0.01), 1.1, arms=((edge_ang(edges[0]) + 180, RED),))


def stone_road(edges, z=0.0):
    with at((0, 0, z)):
        link(edges, 0.012, 0.28, STONE_D, t=0.022, hub_r=0.16)
        link(edges, 0.02, 0.22, STONE, t=0.016, hub_r=0.13)
        for k in edges:  # paving slabs
            a = edge_ang(k)
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            for i in range(4):
                d = 0.2 + i * 0.16
                o = 0.05 if i % 2 else -0.05
                box((0.09, 0.1, 0.008), (ca * d - sa * o, sa * d + ca * o, 0.024), C(214, 208, 200), rz=a - 90, bevel=0.003)
        if len(edges) == 1:
            cyl(0.05, 0.12, (0, 0, 0.02), STONE_D, n=6, r2=0.04)
            ell((0, 0, 0.15), 0.035, GOLD, seg=6, ring=4)


ROAD_SETS = [("end", [4]), ("straight", [1, 4]), ("bend", [2, 5]), ("sharp bend", [4, 5]), ("fork", [1, 3, 5]), ("cross", [0, 1, 3, 4]), ("hub", [0, 1, 2, 3, 4, 5])]


def road_tile(kind, edges):
    def f():
        H = plain("low", STEPPE)
        with at((0, 0, H)):
            (dirt_road if kind == "dirt" else stone_road)(edges)
    return f


def wood_bridge():
    """Plank bridge over a straight river (river runs edge 1 -> 4, bridge along x)."""
    with at((0, 0, 0)):
        rings = []
        for i in range(7):
            t = i / 6
            x = -0.32 + t * 0.64
            z = 0.02 + 0.07 * math.sin(math.pi * t)
            rings.append((x, z))
        for (x0, z0), (x1, z1) in zip(rings, rings[1:]):
            L = math.hypot(x1 - x0, z1 - z0)
            box((L + 0.01, 0.2, 0.025), ((x0 + x1) / 2, 0, (z0 + z1) / 2), WOOD, ry=-math.degrees(math.atan2(z1 - z0, x1 - x0)), bevel=0.004)
            for sy in (-1, 1):
                cyl(0.012, 0.07, (x0, sy * 0.1, z0), WOOD_D, n=5)
                box((L + 0.01, 0.014, 0.014), ((x0 + x1) / 2, sy * 0.1, (z0 + z1) / 2 + 0.065), WOOD_D, ry=-math.degrees(math.atan2(z1 - z0, x1 - x0)))


def stone_bridge():
    with at((0, 0, -0.05)):
        slab([(-0.4, 0.0), (-0.16, 0.0), (-0.15, 0.06), (-0.1, 0.1), (0.0, 0.115), (0.1, 0.1), (0.15, 0.06), (0.16, 0.0), (0.4, 0.0),
              (0.4, 0.1), (0.2, 0.15), (0.0, 0.17), (-0.2, 0.15), (-0.4, 0.1)], 0.24, (0, 0, 0), STONE)
        for sy in (-1, 1):
            slab([(-0.4, 0.1), (-0.2, 0.15), (0.0, 0.17), (0.2, 0.15), (0.4, 0.1), (0.4, 0.14), (0.2, 0.19), (0.0, 0.21), (-0.2, 0.19), (-0.4, 0.14)], 0.03, (0, sy * 0.11, 0), STONE_D)


def bridge_tile(fn):
    def f():
        H = tile("river straight", "low", 4)
        with at((0, 0, H)):
            dirt_road([0, 3]) if fn is wood_bridge else stone_road([0, 3])
            with at((0, 0, 0.0), rz=30):
                fn()
    return f


def route_flag(rgb, name=""):
    for i, r in enumerate((0.07, 0.055, 0.04)):
        ell((0, 0, 0.025 + i * 0.045), (r, r, r * 0.7), ROCK if i % 2 else ROCK_D, seg=7, ring=5)
    flag((0, 0, 0.1), rgb, h=0.3, w=0.15, fh=0.09)


def city_banner(rgb):
    cyl(0.055, 0.04, (0, 0, 0), STONE_D, n=8)
    cyl(0.012, 0.5, (0, 0, 0.04), WOOD_D, n=6)
    box((0.2, 0.014, 0.014), (0, 0, 0.5), WOOD_D)
    for sx in (-1, 1):
        ell((sx * 0.1, 0, 0.5), 0.018, GOLD, seg=6, ring=4)
    ell((0, 0, 0.555), 0.024, GOLD, seg=6, ring=4)
    slab([(-0.08, 0.0), (0.0, 0.05), (0.08, 0.0), (0.08, 0.3), (-0.08, 0.3)], 0.012, (0, -0.012, 0.19), rgb)
    # geometric emblem: a cream lozenge with a gold dot (no symbols)
    slab([(0, 0), (0.045, 0.055), (0, 0.11), (-0.045, 0.055)], 0.008, (0, -0.022, 0.32), CREAM)
    ell((0, -0.03, 0.375), 0.014, GOLD, seg=6, ring=4)
    box((0.17, 0.014, 0.025), (0, -0.014, 0.48), tuple(c * 0.7 for c in rgb))


def border_post(rgb):
    cyl(0.04, 0.16, (0, 0, 0), STONE, n=6, r2=0.032)
    cyl(0.042, 0.035, (0, 0, 0.1), rgb, n=6)
    cone(0.036, 0.05, (0, 0, 0.16), rgb, n=6)


def border_edges(edges, rgb, H):
    """Territory border: a coloured strip just inside the given hex edges, posts at corners."""
    with at((0, 0, H)):
        for k in edges:
            a = math.radians(edge_ang(k))
            d = APO - 0.05
            cx, cy = d * math.cos(a), d * math.sin(a)
            box((TR * 0.92, 0.09, 0.024), (cx, cy, 0.012), rgb, rz=edge_ang(k) + 90, bevel=0.006)
            for c in (k, k + 1):
                b = math.radians(60 * c)
                with at(((TR - 0.1) * math.cos(b), (TR - 0.1) * math.sin(b), 0), s=1.3):
                    border_post(rgb)


def route_dots(p0, p1, z, rgb=GOLD, step=0.16, arrows=True):
    """Trade-route marker: a dotted line of fat beads with chevrons, p0 -> p1."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    a = math.degrees(math.atan2(dy, dx))
    n = int(L / step)
    for i in range(n + 1):
        t = i / max(1, n)
        x, y = p0[0] + dx * t, p0[1] + dy * t
        if arrows and i % 4 == 2:
            with at((x, y, z), rz=a - 90):
                slab([(-0.05, 0), (0.0, 0.05), (0.05, 0), (0.05, 0.025), (0.0, 0.075), (-0.05, 0.025)], 0.02, (0, 0.0, 0.0), rgb, rx=90, emit=0.3)
        else:
            ell((x, y, z + 0.018), (0.028, 0.028, 0.018), rgb, seg=8, ring=4, emit=0.3)


def route_strip():
    cells = [((0, 0), "desert"), ((1, 0), "steppe"), ((2, -1), "desert")]
    for (q, r), t in cells:
        x, y = axial(q, r)
        with at((x, y, 0)):
            plain("low", SAND if t == "desert" else STEPPE)
    H = ELEV["low"]
    a, b, c = axial(0, 0), axial(1, 0), axial(2, -1)
    route_dots(a, b, H + 0.01)
    route_dots(b, c, H + 0.01)
    with at((a[0], a[1], H), s=1.3):
        route_flag(PLAYER[0][1])
    with at((c[0], c[1], H), rz=SIDE, s=1.1):
        camel(True, "silk")


def border_tile():
    H = plain("low", GRASS)
    border_edges([3, 4, 5], PLAYER[1][1], H)
    with at((0, 0.1, H)):
        decor("poplars", s=0.8)
