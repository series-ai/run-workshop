"""Caravan Kingdoms: palette, hex grid and pack-local primitives on top of kit.py.

Hex spec: flat-top hexes, circumradius HEX_R = 1.0 (grid spacing). Tiles are drawn
at TR = 0.97 so neighbours show a hairline seam. Edge k (0..5) has its midpoint at
angle 30 + 60k degrees (0 = back-right, 1 = back, 2 = back-left, 3 = front-left,
4 = front, 5 = front-right), APO from the centre. Ground of the tile is z = 0,
its top is the elevation height H.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shared"))
import bmesh  # noqa: E402

import kit  # noqa: E402
from kit import *  # noqa: E402,F401,F403
from kit import _bm_obj  # noqa: E402

# ---------------------------------------------------------------- palette
SAND = C(234, 204, 150)
SAND_D = C(214, 178, 120)
DUNE = C(238, 188, 114)
DUNE_D = C(220, 160, 92)
EARTH = C(156, 104, 70)
EARTH_D = C(112, 72, 50)
ROCKBAND = C(140, 126, 118)
STEPPE = C(204, 196, 116)
STEPPE_D = C(170, 168, 88)
GRASS = C(138, 184, 88)
GRASS_D = C(96, 150, 70)
FOREST = C(70, 132, 80)
FOREST_D = C(48, 104, 70)
POPLAR = C(118, 170, 70)
JADE = C(60, 168, 124)
WATER = C(70, 186, 196)
SHALLOW = C(126, 214, 204)
SEA = C(50, 140, 190)
DEEP = C(38, 84, 160)
FOAM = C(220, 244, 240)
ROCK = C(168, 156, 146)
ROCK_D = C(122, 112, 106)
SNOW = C(248, 248, 252)
SALT = C(244, 240, 232)
SALT_D = C(222, 214, 204)
BRINE = C(240, 180, 186)
TERRA = C(198, 96, 62)
TERRA_D = C(160, 70, 50)
OCHRE = C(222, 154, 60)
TURQ = C(46, 182, 178)
LAPIS = C(38, 66, 158)
CREAM = C(244, 232, 206)
PLASTER = C(238, 220, 188)
LIME = C(236, 228, 210)  # Levantine limestone
MUD = C(204, 158, 106)
MUD_D = C(176, 128, 84)
RED = C(196, 46, 44)
RED_D = C(150, 34, 36)
GOLD = C(236, 186, 64)
WOOD = C(146, 94, 58)
WOOD_D = C(98, 62, 40)
TILE_G = C(60, 104, 100)  # Chinese glazed roof tile (dark teal)
TILE_J = C(66, 150, 110)  # jade-green glaze
GREY = C(150, 148, 150)
GREY_L = C(206, 204, 200)
INK = C(52, 44, 52)
SKIN = C(214, 160, 112)
FELT = C(240, 226, 196)
DARK = C(70, 52, 46)
CAMEL = C(208, 160, 96)
CAMEL_B = C(150, 98, 60)  # Bactrian
PALM_T = C(150, 112, 72)
PLUM = C(116, 54, 104)

PLAYER = [("red", C(214, 58, 52)), ("blue", C(52, 104, 210)), ("yellow", C(242, 196, 48)),
          ("green", C(60, 170, 90)), ("purple", C(140, 72, 180)), ("teal", C(40, 190, 196))]

HEX_R = 1.0
TR = 0.97
APO = TR * math.sqrt(3) / 2
SQ3 = math.sqrt(3)
ELEV = {"low": 0.22, "mid": 0.42, "high": 0.66}
WATER_Z = 0.15


def hexpts(r=TR):
    return [(r * math.cos(math.radians(60 * k)), r * math.sin(math.radians(60 * k))) for k in range(6)]


def edge_ang(k):
    return 30 + 60 * k


def edge_mid(k, d=APO):
    a = math.radians(edge_ang(k))
    return (d * math.cos(a), d * math.sin(a))


def axial(q, r):
    """Flat-top axial coords -> world xy for HEX_R."""
    return (1.5 * q * HEX_R, SQ3 * HEX_R * (r + q / 2))


# ---------------------------------------------------------------- polygons

def clip(poly, nx, ny, d):
    """Keep the part of a convex polygon where nx*x + ny*y <= d."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        fa = nx * a[0] + ny * a[1] - d
        fb = nx * b[0] + ny * b[1] - d
        if fa <= 0:
            out.append(a)
        if fa * fb < 0:
            t = fa / (fa - fb)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def inset(poly, d):
    """Offset a convex CCW polygon inward by d."""
    n = len(poly)
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        ex, ey = x1 - x0, y1 - y0
        L = math.hypot(ex, ey) or 1
        nx, ny = -ey / L, ex / L  # inward normal for CCW
        lines.append((x0 + nx * d, y0 + ny * d, ex, ey))
    out = []
    for i in range(n):
        ax, ay, adx, ady = lines[i - 1]
        bx, by, bdx, bdy = lines[i]
        den = adx * bdy - ady * bdx
        if abs(den) < 1e-9:
            out.append((bx, by))
            continue
        t = ((bx - ax) * bdy - (by - ay) * bdx) / den
        out.append((ax + adx * t, ay + ady * t))
    return out


def ccw(poly):
    s = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if s > 0 else poly[::-1]


def prism(poly, z0, z1, rgb, top=None, **m):
    """Extrude an xy polygon from z0 to z1. top: a second polygon for the top face
    (same vertex count) to make a chamfered frustum."""
    top = top or poly
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in poly]
    hi = [bm.verts.new((x, y, z1)) for x, y in top]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return _bm_obj(bm, "prism", rgb, **m)


def column(poly, H, top_rgb, band=EARTH, cap=0.06, base=0.0, foot=EARTH_D, bevel=0.025):
    """A tile column: dark foot stripe, earthy side band, coloured top cap with a
    chamfered rim. poly must be convex CCW."""
    poly = ccw(poly)
    if base < 0.04:
        prism(poly, base, base + 0.04, foot)
        base += 0.04
    if H - cap > base:
        prism(poly, base, H - cap, band)
    prism(poly, max(base, H - cap), H, top_rgb, top=inset(poly, bevel))


def hex_tile(H, top_rgb, band=EARTH, cap=0.06):
    column(hexpts(), H, top_rgb, band, cap)


def link(edges, z, w, rgb, t=0.02, hub=True, L=None, hub_r=None, side=0.0):
    """Edge-to-centre ribbon segments (roads, rivers, borders): one box per edge,
    plus a round hub so any combination joins cleanly. side > 0 also drops a
    little lip down the tile's side face at each edge (rivers)."""
    L = APO if L is None else L
    for k in edges:
        a = edge_ang(k)
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        box((w, L, t), (ca * L / 2, sa * L / 2, z - t / 2), rgb, rz=a - 90)
        if side:
            box((w, 0.02, side), (ca * (APO + 0.008), sa * (APO + 0.008), z - side / 2), rgb, rz=a - 90)
    if hub and edges:
        cyl(hub_r or w * 0.56, t, (0, 0, z - t), rgb, n=8)


# ---------------------------------------------------------------- small shared props

def rock(p, s, rgb=ROCK, rz=0.0, n=5):
    with at(p, rz=rz):
        lathe([(s, 0), (s * 0.85, s * 0.5), (s * 0.4, s * 0.85), (0, s * 0.9)], (0, 0, 0), rgb, n=n)


def tuft(p, s=1.0, rgb=GRASS_D):
    with at(p, s=s * 1.5):
        for i, (dx, dy, tilt) in enumerate(((0, 0, 0), (0.018, 0.008, 18), (-0.016, 0.01, -18))):
            cone(0.014, 0.06 - 0.012 * (i > 0), (dx, dy, 0), rgb, n=4, ry=tilt)


def scatter(R, n, rmax, rmin=0.0, avoid=()):
    """n random points inside a disc, kept apart from `avoid` [(x, y, r)]."""
    pts, tries = [], 0
    while len(pts) < n and tries < 400:
        tries += 1
        a = R.uniform(0, 2 * math.pi)
        d = math.sqrt(R.uniform((rmin / rmax) ** 2, 1)) * rmax
        x, y = d * math.cos(a), d * math.sin(a)
        if any((x - ax) ** 2 + (y - ay) ** 2 < ar ** 2 for ax, ay, ar in avoid):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < 0.012 for px, py in pts):
            continue
        pts.append((x, y))
    return pts


def arch_poly(w, h, pointed=False, seg=6):
    """Outline of an arched opening (xz), base at z = 0, width w, total height h."""
    r = w / 2
    spring = h - (r * 1.25 if pointed else r)
    pts = [(-r, 0), (r, 0), (r, spring)]
    for i in range(1, seg):
        t = i / seg
        x = r * math.cos(math.pi * t)
        if pointed:  # two arcs meeting at a point
            z = (h - spring) * (1 - abs(1 - 2 * t) ** 1.6)
        else:
            z = r * math.sin(math.pi * t)
        pts.append((x, spring + z))
    pts.append((-r, spring))
    return pts


def arch(loc, w, h, rgb, depth=0.01, pointed=False, rz=0.0):
    """A flat arched panel (dark doorway / window) facing -y at loc (its base centre)."""
    return slab(arch_poly(w, h, pointed), depth, loc, rgb, rz=rz)


# ---------------------------------------------------------------- team colour slot
# Every flag, banner, pennant and team stripe uses team() and is marked with a
# material named "team", so a game can recolour one slot per player.
_TEAM = [PLAYER[0][1]]


def team():
    return _TEAM[0]


def set_team(rgb):
    _TEAM[0] = rgb


def tm(o):
    """Mark an object's material as the team slot."""
    m = o.data.materials[0]
    if not m.name.startswith("team"):
        m.name = "team"
    return o


def tbox(size, loc, **k):
    """A box in the team colour."""
    return tm(box(size, loc, team(), **k))


def pennant(p, w=0.09, fh=0.05, rz=0.0):
    """A triangular team pennant hanging off a pole at p (its top)."""
    with at(p, rz=rz):
        tm(slab([(0, 0), (w, fh * 0.5), (0, fh)], 0.012, (0.006, 0, -fh), team()))


def flag(p, rgb=None, h=0.32, w=0.13, fh=0.08, swallow=False, rz=0.0, pole=WOOD_D):
    rgb = rgb or team()
    with at(p, rz=rz):
        cyl(0.012, h, (0, 0, 0), pole, n=6)
        ell((0, 0, h), 0.02, GOLD, seg=6, ring=4)
        if swallow:
            poly = [(0, 0), (w, 0), (w * 0.75, fh / 2), (w, fh), (0, fh)]
        else:
            poly = [(0, 0), (w, fh * 0.12), (w, fh * 0.88), (0, fh)]
        o = slab(poly, 0.014, (0.01, 0, h - fh - 0.012), rgb)
        if rgb == team():
            tm(o)


def banner(p, h=0.34, w=0.09, fh=0.14, rz=0.0):
    """Tall hanging team banner on a crossbar (cities, wonders)."""
    with at(p, rz=rz):
        cyl(0.012, h, (0, 0, 0), WOOD_D, n=6)
        box((w + 0.03, 0.014, 0.014), (0, 0, h - 0.01), WOOD_D)
        ell((0, 0, h + 0.012), 0.02, GOLD, seg=6, ring=4)
        tm(slab([(-w / 2, 0), (0, fh * 0.2), (w / 2, 0), (w / 2, fh), (-w / 2, fh)], 0.012, (0, -0.012, h - 0.02 - fh), team()))
