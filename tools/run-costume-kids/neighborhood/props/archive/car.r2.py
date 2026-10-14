"""Six cute toy cars from concepts/cars.png: short, tall, rounded bodies on big
round wheels with hubcaps, ball-ish fenders, small thick-framed windows that
glow warm (opaque panels, no glass) and round glowing headlights.

Shared parts (wheel, fender, headlight, window, bumper, grille, cabin) are
built once and reused by all six. Front faces -y.

    Blender -b -t 1 --factory-startup --python neighborhood/props/car.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys
from contextlib import contextmanager

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F403
import kit  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TYRE = (0.24, 0.22, 0.26)
HUB = (0.62, 0.60, 0.63)
CHROME = (0.66, 0.64, 0.66)
RED = (0.80, 0.18, 0.14)
DARK = (0.20, 0.17, 0.18)

AX = (0, math.radians(90), 0)      # a can lying along x (wheels)
AY = (math.radians(90), 0, 0)      # a can lying along y (lights)
WR = 0.95                          # wheel radius


def shade(rgb, k):
    return tuple(min(1.0, c * k) for c in rgb)


def bev(o, w, segs=2, angle=30):
    """Round the hard edges of a piece (angle-limited, so flat facets stay cheap)."""
    b = o.modifiers.new("b", "BEVEL")
    b.width, b.segments = w, segs
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(angle)
    return o


@contextmanager
def placed(m):
    """Every piece made inside the block is moved by matrix m (built at the origin, then placed)."""
    bpy.context.view_layer.update()
    before = set(bpy.data.objects)
    yield
    bpy.context.view_layer.update()
    for o in set(bpy.data.objects) - before:
        o.matrix_world = m @ o.matrix_world


def frame(c, n):
    """Matrix putting local -y on normal n at point c (local z stays as near up as it can)."""
    q = Vector(n).normalized().to_track_quat("-Y", "Z")
    return Matrix.Translation(Vector(c)) @ q.to_matrix().to_4x4()


# ---------------------------------------------------------------- shared parts

def wheel(x, y, sx, hub=HUB, r=WR):
    """A chunky round tyre with a domed hubcap on the outer side (sx = +-1)."""
    bev(can(x, y, r, r, 0.74, TYRE, n=12, rot=AX), 0.17, 1)
    can(x + sx * 0.4, y, r, r * 0.62, 0.1, hub, n=10, r2=r * 0.3, rot=(0, sx * math.radians(90), 0))


def fender(x, y, rgb, r=WR + 0.34, hw=0.5, zc=WR + 0.3, lo=0, stretch=1.0, n=7):
    """A ball-ish fender: the top of a squashed ellipsoid arching over a wheel."""
    pts = []
    for b in (-90, -60, -30, 0, 30, 60, 90):
        k = math.cos(math.radians(b)) ** 0.6
        for i in range(n):
            a = math.radians(lo + (180 - 2 * lo) * i / (n - 1))
            pts.append((x + hw * math.sin(math.radians(b)),
                        y - math.cos(a) * r * stretch * (0.6 + 0.4 * k),
                        zc + math.sin(a) * r * k))
    return hull(pts, rgb)


def headlight(c, n, r, trim, housing=None):
    """A round glowing lamp in a thick ring, optionally in a body-colour pod."""
    with placed(frame(c, n)):
        if housing:
            ball(0, 0.2, 0, r * 2.3, r * 2.0, r * 2.3, housing, seg=8, ring=5)
        can(0, -0.02, 0, r * 1.2, 0.2, trim, n=10, rot=AY)
        with glow():
            ball(0, -0.12, 0, r * 2, 0.2, r * 2, GLOW_RGB, seg=10, ring=4)


def window(c, n, w, h, rim, t=0.16, mull=False, depth=0.16):
    """A warm-lit opaque pane inside a thick frame of body colour (half sunk into the body)."""
    with placed(frame(c, n)):
        with glow():
            box(0, 0.05, 0, w, 0.12, h, GLOW_RGB)
        for s in (-1, 1):
            box(0, 0.0, s * (h + t) / 2, w + 2 * t, depth, t, rim)
            box(s * (w + t) / 2, 0.0, 0, t, depth, h, rim)
        if mull:
            box(0, 0.0, 0, t * 0.7, depth * 0.8, h, rim)


def bumper(y, z, w, rgb, sy=-1, guards=True):
    """A fat rounded bar with two little over-riders."""
    bev(box(0, y, z, w, 0.34, 0.32, rgb), 0.14, 1)
    if guards:
        for sx in (-1, 1):
            box(sx * w * 0.24, y + sy * 0.06, z + 0.2, 0.18, 0.16, 0.5, rgb)


def grille(y, z, w, h, rim, slat, n=5, vertical=True):
    """A framed grille on the nose (vertical or horizontal slats)."""
    bev(box(0, y, z, w, 0.2, h, rim), 0.1, 1)
    box(0, y - 0.06, z, w - 0.22, 0.14, h - 0.22, slat)
    for i in range(n):
        f = (i + 0.5) / n - 0.5
        if vertical:
            box(f * (w - 0.3), y - 0.11, z, 0.09, 0.08, h - 0.24, rim)
        else:
            box(0, y - 0.11, z + f * (h - 0.3), w - 0.24, 0.08, 0.08, rim)


def tail_lights(y, z, x):
    for sx in (-1, 1):
        box(sx * x, y, z, 0.3, 0.3, 0.42, RED)


def mirror(sx, x, y, z, rgb):
    """A little side mirror on a stalk."""
    limb((sx * x, y, z), (sx * (x + 0.3), y - 0.05, z + 0.25), 0.05, rgb, n=4)
    bev(box(sx * (x + 0.32), y - 0.05, z + 0.32, 0.12, 0.14, 0.22, rgb), 0.04, 1)


def handle(x, y, z, sx, rgb=CHROME):
    box(x + sx * 0.03, y, z, 0.08, 0.32, 0.09, rgb)


class Cabin:
    """A rounded frustum cabin (bubble roof via a big bevel) with helpers to put
    things on its four faces. y0/y1 front and back at the base, f/b how far the
    top front / top back lean in, a0/a1 half widths at base and top."""

    def __init__(self, y0, y1, z0, z1, a0, a1, f, b, rgb, r=0.6, segs=3):
        self.__dict__.update(y0=y0, y1=y1, z0=z0, z1=z1, a0=a0, a1=a1, f=f, b=b, r=r)
        pts = [(sx * a0, y, z0) for sx in (-1, 1) for y in (y0, y1)]
        pts += [(sx * a1, y, z1) for sx in (-1, 1) for y in (y0 + f, y1 - b)]
        bev(hull(pts, rgb), r, segs, angle=5)

    def _t(self, z):
        return (z - self.z0) / (self.z1 - self.z0)

    def front(self, x, z, out=0.02):
        h = self.z1 - self.z0
        n = Vector((0, -h, self.f)).normalized()
        return Vector((x, self.y0 + self.f * self._t(z), z)) + n * out, n

    def back(self, x, z, out=0.02):
        h = self.z1 - self.z0
        n = Vector((0, h, self.b)).normalized()
        return Vector((x, self.y1 - self.b * self._t(z), z)) + n * out, n

    def side(self, sx, y, z, out=0.02):
        h = self.z1 - self.z0
        n = Vector((sx * h, 0, self.a0 - self.a1)).normalized()
        return Vector((sx * (self.a0 + (self.a1 - self.a0) * self._t(z)), y, z)) + n * out, n

    # windows laid out to fit the flat part of each face (inside the rounded edges)
    def _half(self, z):
        return self.a0 + (self.a1 - self.a0) * self._t(z) - self.r * 0.5

    def win_front(self, z, h, rim, t=0.16, mull=True, k=1.0, split=False):
        w = (2 * self._half(z + h / 2 + t) - 2 * t) * k
        if split:  # two panes with a body-colour pillar between
            for sx in (-1, 1):
                window(*self.front(sx * (w / 4 + t / 2), z), w / 2 - t, h, rim, t=t)
        else:
            window(*self.front(0, z), w, h, rim, t=t, mull=mull)

    def win_back(self, z, h, rim, t=0.16, k=0.8):
        w = (2 * self._half(z + h / 2 + t) - 2 * t) * k
        window(*self.back(0, z), w, h, rim, t=t)

    def win_side(self, z, h, weights, rim, t=0.16, gap=0.06, lo=None, hi=None, h2=None):
        tt = self._t(z + h / 2 + t)
        m = self.r * 0.5
        yf = self.y0 + self.f * tt + m if lo is None else lo
        yb = self.y1 - self.b * tt - m if hi is None else hi
        n = len(weights)
        glass = (yb - yf) - n * 2 * t - (n - 1) * gap
        y = yf
        out = []
        for wt in weights:
            w = wt * glass / sum(weights)
            c = y + t + w / 2
            for sx in (-1, 1):
                window(*self.side(sx, c, z), w, h, rim, t=t)
            out.append(c)
            y += w + 2 * t + gap
        return out


def four_wheels(wb, track, hub=HUB, yoff=0.0):
    for sx in (-1, 1):
        for wy in (-wb / 2, wb / 2):
            wheel(sx * track, wy + yoff, sx, hub)


def four_fenders(wb, track, rgb, yoff=0.0, **kw):
    for sx in (-1, 1):
        for wy in (-wb / 2, wb / 2):
            fender(sx * track, wy + yoff, rgb, **kw)


# ---------------------------------------------------------------- the six cars

def sedan():
    """Tall rounded vintage sedan: bubble roof, big separate round fenders, tall grille."""
    body = (0.47, 0.42, 0.64)
    rim = shade(body, 0.88)
    wb, tr = 3.9, 1.5
    four_wheels(wb, tr)
    for sx in (-1, 1):
        fender(sx * tr, -wb / 2 - 0.1, body, r=WR + 0.3, hw=0.52, zc=WR + 0.22, stretch=1.2)
        fender(sx * tr, wb / 2 + 0.05, body, r=WR + 0.3, hw=0.52, zc=WR + 0.22, stretch=1.1)
        box(sx * 1.5, 0.0, WR + 0.12, 0.62, wb - 1.6, 0.2, rim)                  # running board
    bev(box(0, -0.1, 1.75, 2.6, 5.4, 1.75, body), 0.55, 3)                      # tub
    cab = Cabin(-0.8, 2.5, 2.4, 5.1, 1.38, 1.1, 0.5, 0.45, body, r=0.62, segs=4)
    cab.win_front(3.7, 1.1, rim)
    cab.win_back(3.75, 0.8, rim)
    cab.win_side(3.7, 1.1, (1.1, 0.9), rim)
    for sx in (-1, 1):
        handle(sx * 1.3, 0.55, 2.35, sx)
        box(sx * 1.31, 0.82, 1.75, 0.04, 0.06, 1.3, rim)                     # door seam
    box(0, -1.55, 2.62, 0.1, 2.2, 0.06, rim)                                  # hood seam
    grille(-2.85, 1.85, 0.95, 1.35, CHROME, DARK, n=4)
    for sx in (-1, 1):
        headlight((sx * 1.02, -2.72, 2.2), (0, -1, 0.12), 0.3, CHROME, housing=body)
    bumper(-3.0, 0.95, 3.1, CHROME)
    bumper(2.8, 0.95, 3.0, CHROME, sy=1)
    tail_lights(2.7, 1.95, 1.0)


def bug():
    """Chubby round bug: a domed body, bulging fenders, lights on the front fenders."""
    body = (0.93, 0.50, 0.17)
    rim = shade(body, 0.86)
    wb, tr = 3.7, 1.42
    four_wheels(wb, tr)
    for sx in (-1, 1):
        fender(sx * tr, -wb / 2, body, r=WR + 0.4, hw=0.6, zc=WR + 0.18, stretch=1.1)
        fender(sx * tr, wb / 2, body, r=WR + 0.42, hw=0.6, zc=WR + 0.2, stretch=1.1)
        box(sx * 1.38, 0.0, WR + 0.1, 0.5, wb - 1.8, 0.2, rim)                  # running board
        handle(sx * 1.33, 0.25, 2.3, sx)
        headlight((sx * 1.4, -2.95, 1.95), (0.1 * sx, -0.8, 0.55), 0.28, CHROME)
    ball(0, 0.0, 1.75, 2.75, 5.5, 2.3, body, seg=16, ring=10)                 # lower shell
    cab = Cabin(-1.05, 2.25, 2.2, 4.4, 1.32, 1.0, 0.65, 0.95, body, r=0.8, segs=4)
    cab.win_front(3.2, 0.75, rim)
    cab.win_back(3.15, 0.5, rim, k=0.75)
    cab.win_side(3.2, 0.75, (1.2, 0.8), rim)
    bumper(-2.75, 0.95, 3.0, CHROME)
    bumper(2.75, 0.95, 3.0, CHROME, sy=1)
    tail_lights(2.5, 1.85, 0.95)


def wagon():
    """Little station wagon: long rounded roof, wood-panelled sides."""
    body = (0.38, 0.62, 0.31)
    rim = shade(body, 0.88)
    wood, wood_lt = (0.52, 0.32, 0.18), (0.76, 0.55, 0.32)
    wb, tr = 3.7, 1.45
    four_wheels(wb, tr)
    four_fenders(wb, tr, body, r=WR + 0.3, hw=0.5, zc=WR + 0.22)
    bev(box(0, 0.0, 1.7, 2.75, 5.3, 1.6, body), 0.5, 3)
    cab = Cabin(-0.6, 2.62, 2.3, 4.7, 1.36, 1.18, 0.55, 0.12, body, r=0.55, segs=3)
    cab.win_front(3.45, 1.0, rim)
    cab.win_back(3.45, 0.9, wood_lt, k=0.9)
    cab.win_side(3.45, 1.0, (1, 1, 0.8), wood_lt)
    for sx in (-1, 1):
        # wood panel on the lower side, framed in light wood
        x = sx * 1.39
        box(x, 0.85, 1.75, 0.08, 3.4, 0.95, wood)
        for z in (1.2, 2.3):
            box(x + sx * 0.03, 0.85, z, 0.1, 3.6, 0.17, wood_lt)
        for y in (-0.85, 0.55, 2.55):
            box(x + sx * 0.03, y, 1.75, 0.1, 0.17, 1.2, wood_lt)
        handle(x, 0.2, 2.05, sx)
    grille(-2.68, 1.6, 0.7, 0.35, CHROME, DARK, n=3, vertical=False)
    for sx in (-1, 1):
        headlight((sx * 0.92, -2.62, 1.95), (0, -1, 0.1), 0.27, CHROME)
        with glow():
            box(sx * 1.05, -2.66, 1.35, 0.2, 0.1, 0.12, GLOW_RGB)               # indicator
    bumper(-2.8, 0.95, 3.0, CHROME, guards=False)
    bumper(2.8, 0.95, 3.0, CHROME, sy=1, guards=False)
    tail_lights(2.65, 1.95, 1.05)


def van():
    """Tiny round camper van: cream top over teal, split screen, V-front."""
    teal, cream = (0.22, 0.56, 0.52), (0.95, 0.91, 0.76)
    rim = shade(cream, 0.88)
    wb, tr = 3.4, 1.42
    four_wheels(wb, tr)
    four_fenders(wb, tr, teal, r=WR + 0.3, hw=0.48, zc=WR + 0.22)
    bev(box(0, 0.0, 1.85, 2.85, 5.0, 1.9, teal), 0.6, 3)
    cab = Cabin(-2.45, 2.45, 2.7, 5.0, 1.42, 1.28, 0.35, 0.2, cream, r=0.7, segs=3)
    cab.win_front(3.7, 0.85, rim, split=True)
    cab.win_back(3.7, 0.7, rim)
    cab.win_side(3.7, 0.85, (0.8, 1.2, 1.0), rim)
    for sx in (-1, 1):
        handle(sx * 1.43, -1.2, 2.45, sx)
    # the cream V on the nose and its round badge
    hull([(sx * 0.95, -2.52, 2.85) for sx in (-1, 1)] + [(0, -2.52, 1.75)]
         + [(sx * 0.95, -2.35, 2.85) for sx in (-1, 1)] + [(0, -2.35, 1.75)], cream)
    can(0, -2.56, 2.15, 0.26, 0.12, CHROME, n=10, rot=AY)
    for sx in (-1, 1):
        headlight((sx * 0.98, -2.5, 1.65), (0, -1, 0.05), 0.27, CHROME)
    bumper(-2.6, 0.95, 3.0, CHROME, guards=False)
    bumper(2.6, 0.95, 3.0, CHROME, sy=1, guards=False)
    tail_lights(2.5, 1.95, 1.05)


def pumpkin(x, y, z, s):
    ball(x, y, z, s, s, s * 0.78, (0.95, 0.55, 0.14), seg=8, ring=5)
    can(x, y, z + s * 0.42, 0.06, 0.2, (0.36, 0.48, 0.20), n=5)


def pickup():
    """Squat vintage pickup: round fenders, horizontal grille, pumpkins in the bed."""
    body = (0.66, 0.28, 0.20)
    rim = shade(body, 0.88)
    wb, tr = 3.9, 1.5
    four_wheels(wb, tr, yoff=0.1)
    for sx in (-1, 1):
        fender(sx * tr, -wb / 2 + 0.1, body, r=WR + 0.3, hw=0.54, zc=WR + 0.22, stretch=1.2)
        fender(sx * tr, wb / 2 + 0.1, body, r=WR + 0.3, hw=0.54, zc=WR + 0.22)
        box(sx * 1.5, 0.15, WR + 0.12, 0.6, wb - 1.7, 0.2, rim)
        handle(sx * 1.32, 0.55, 2.35, sx)
    bev(box(0, -1.4, 1.7, 2.65, 3.0, 1.6, body), 0.5, 3)                      # hood + cab base
    cab = Cabin(-0.5, 0.95, 1.2, 4.4, 1.33, 1.15, 0.35, 0.05, body, r=0.5, segs=3)
    cab.win_front(3.35, 1.0, rim)
    cab.win_back(3.4, 0.7, rim)
    cab.win_side(3.35, 1.0, (1,), rim)
    # the bed: floor and low walls, pumpkins heaped inside
    by0, by1 = 0.95, 3.15
    bev(box(0, (by0 + by1) / 2, 1.3, 2.6, by1 - by0, 0.5, body), 0.15, 1)
    for sx in (-1, 1):
        bev(box(sx * 1.2, (by0 + by1) / 2, 1.75, 0.22, by1 - by0, 0.7, body), 0.08, 1)
    bev(box(0, by1 - 0.1, 1.75, 2.6, 0.22, 0.7, body), 0.08, 1)
    for x, y, z, s in ((-0.5, 1.6, 0, 1.05), (0.5, 1.55, 0, 0.95), (-0.45, 2.6, 0, 0.95),
                       (0.5, 2.6, 0, 1.05), (0.0, 2.1, 0.55, 1.0)):
        pumpkin(x, y, 1.6 + s * 0.39 + z, s)
    box(0, -1.7, 2.52, 0.1, 2.0, 0.06, rim)
    grille(-2.88, 1.7, 1.35, 0.9, CHROME, DARK, n=4, vertical=False)
    for sx in (-1, 1):
        headlight((sx * 1.1, -2.72, 2.0), (0, -1, 0.1), 0.27, CHROME)
    bumper(-3.05, 0.95, 3.15, CHROME, guards=False)
    bumper(3.3, 0.95, 3.0, CHROME, sy=1, guards=False)
    tail_lights(3.27, 1.9, 1.15)


def spooky():
    """Small black vintage car with orange fenders, trim and window frames."""
    body, orange = (0.15, 0.14, 0.17), (0.93, 0.50, 0.15)
    wb, tr = 3.6, 1.45
    four_wheels(wb, tr, hub=orange)
    four_fenders(wb, tr, orange, r=WR + 0.32, hw=0.54, zc=WR + 0.22, stretch=1.1)
    for sx in (-1, 1):
        box(sx * 1.45, 0.0, WR + 0.12, 0.55, wb - 1.6, 0.2, orange)
    bev(box(0, 0.0, 1.75, 2.65, 5.1, 1.75, body), 0.55, 3)
    cab = Cabin(-0.65, 2.25, 2.45, 4.75, 1.32, 1.08, 0.45, 0.35, body, r=0.62, segs=4)
    cab.win_front(3.55, 1.0, orange, t=0.15)
    cab.win_back(3.55, 0.8, orange, t=0.15)
    cab.win_side(3.55, 1.0, (1.1, 0.85), orange, t=0.15)
    for sx in (-1, 1):
        handle(sx * 1.32, 0.5, 2.35, sx, orange)
        box(sx * 1.335, 0.0, 2.2, 0.05, 3.6, 0.08, orange)                    # pin stripe
    box(0, -1.5, 2.62, 0.1, 2.0, 0.06, orange)
    # arched orange grille
    bev(box(0, -2.55, 1.75, 0.85, 0.2, 0.9, orange), 0.08, 1)
    can(0, -2.55, 2.2, 0.43, 0.2, orange, n=10, rot=AY)
    box(0, -2.62, 1.85, 0.6, 0.14, 0.95, DARK)
    for i in range(3):
        box(-0.2 + i * 0.2, -2.68, 1.85, 0.07, 0.06, 0.9, orange)
    for sx in (-1, 1):
        headlight((sx * 0.95, -2.5, 2.15), (0, -1, 0.1), 0.27, orange)
        headlight((sx * 1.05, -2.6, 1.45), (0, -1, 0.0), 0.13, orange)          # fog lamps
    bumper(-2.8, 0.95, 3.0, orange, guards=False)
    bumper(2.8, 0.95, 3.0, orange, sy=1, guards=False)
    tail_lights(2.6, 1.95, 1.0)


CARS = {"car-sedan": sedan, "car-bug": bug, "car-wagon": wagon,
        "car-van": van, "car-pickup": pickup, "car-spooky": spooky}


def main():
    out = out_dir_arg()
    only = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
    entries = []
    for slug, build in CARS.items():
        if only and slug not in only:
            continue
        entries.append(build_and_ship(slug, "car", build, out))
    kit.update_index(entries)


main()
