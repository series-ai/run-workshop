"""Six chunky 1950s toy cars in the kids' shape language.

Each car is a rounded-cube lower body with a cab SUNK into it: the cab is built
as a bevelled solid whose bottom is buried in the body and cut off, so the
cab walls meet the body top in a crisp right-angle seam and only the roof
edges are rounded. Cab fronts are raked (a sloped windscreen face) and some
backs slope too (fastback, hardtop). Over each wheel sits a chunky rounded
arch fender; wheels have whitewalls and domed hubcaps; chrome grilles,
bumpers, side spears, tail lights. Windows are flat glowing panels laid on the
cab faces (one full windscreen, except the van's split screen). The van stays
a long two-tone rounded cube. Front faces -y.

(Previous versions: archive/car.r1.py, archive/car.r2.py, archive/car.r3.py.)

    Blender -b -t 1 --factory-startup --python neighborhood/props/car.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F403
import kit  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

TYRE = (0.24, 0.22, 0.26)
HUB = (0.74, 0.73, 0.76)
CHROME = (0.74, 0.73, 0.76)
WHITE = (0.95, 0.93, 0.88)
DARK = (0.22, 0.19, 0.21)
RED = (0.84, 0.20, 0.16)
ORANGE = (0.95, 0.50, 0.14)

AX = (0, math.radians(90), 0)      # a can lying along x (wheels)
AY = (math.radians(90), 0, 0)      # a can lying along y, narrow end to -y
AYB = (math.radians(-90), 0, 0)    # a can lying along y, narrow end to +y
WR = 0.82                          # wheel radius
WW = 0.62                          # wheel width
TR = 1.38                          # wheel track (half)
SINK = 0.08                        # panels sink this far into a face
PROUD = 0.025                      # ... and stand this far proud of it


def rbox(x, y, z0, w, d, h, rgb, r, segs=2):
    """A rounded cube standing on z0 (r = bevel radius)."""
    return box(x, y, z0 + h / 2, w, d, h, rgb, bevel=r, segs=segs)


def bev(o, w, segs=1, angle=40):
    b = o.modifiers.new("b", "BEVEL")
    b.width, b.segments, b.limit_method = w, segs, "ANGLE"
    b.angle_limit = math.radians(angle)
    return o


def cut(o, z, keep_above):
    """Apply o's modifiers and cut it at height z, keeping one side (no cap)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    bm = bmesh.new()
    bm.from_mesh(me)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                           clear_inner=keep_above, clear_outer=not keep_above)
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    for m in o.data.materials:
        me.materials.append(m)
    o.data = me
    return o


def slab(pts, n, rgb):
    """A thin panel on a face: the face polygon pts (convex), normal n."""
    n = Vector(n).normalized()
    return hull([Vector(p) + n * PROUD for p in pts] + [Vector(p) - n * SINK for p in pts], rgb)


def pane(pts, n):
    with glow():
        slab(pts, n, GLOW_RGB)


# ---------------------------------------------------------------- shared parts

def wheel(x, y, sx, hub=HUB, wall=WHITE):
    """A fat tyre, a whitewall disc and a domed hubcap on the outer face (sx = +-1)."""
    bev(can(x, y, WR, WR, WW, TYRE, n=10, rot=AX), 0.15, 1, 50)
    o = x + sx * WW / 2
    can(o, y, WR, WR * 0.66, 0.06, wall, n=10, rot=AX)
    can(o + sx * 0.07, y, WR, WR * 0.46, 0.14, hub, n=8, r2=WR * 0.24, rot=(0, sx * math.radians(90), 0))


def arch(x, y, rgb, rin=WR + 0.08, rout=WR + 0.46, w=0.86, a0=-14, n=8, zc=WR):
    """A chunky rounded fender arching over a wheel: a thick half ring along y."""
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        a = math.radians(a0 + (180 - 2 * a0) * i / n)
        ring = []
        for r, xs in ((rout, -1), (rout, 1), (rin, 1), (rin, -1)):
            ring.append(bm.verts.new((x + xs * w / 2, y - math.cos(a) * r, zc + math.sin(a) * r)))
        rings.append(ring)
    for i in range(n):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("arch")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("arch", me)
    bpy.context.scene.collection.objects.link(o)
    finish(o, rgb)
    return bev(o, 0.12, 1, 35)


def running_gear(wb, rgb, yoff=0.0, hub=HUB, wall=WHITE, fenders=True, **kw):
    for sx in (-1, 1):
        for wy in (-wb / 2 + yoff, wb / 2 + yoff):
            wheel(sx * TR, wy, sx, hub, wall)
            if fenders:
                arch(sx * (TR + 0.06), wy, rgb, **kw)


def running_board(wb, rgb, yoff=0.0, z=0.78):
    for sx in (-1, 1):
        rbox(sx * 1.5, yoff, z, 0.62, wb - 1.7, 0.2, rgb, 0.07, 1)


def headlight(x, y, z, r=0.3, rim=CHROME, pod=None):
    """A round glowing lamp in a thick chrome ring, optionally in a body-colour bucket."""
    if pod:
        can(x, y + 0.05, z, r * 1.55, 0.36, pod, n=10, rot=AY)
    can(x, y - 0.12, z, r * 1.25, 0.16, rim, n=10, rot=AY)
    with glow():
        can(x, y - 0.21, z, r, 0.06, GLOW_RGB, n=10, r2=r * 0.8, rot=AY)


def headlights(x, y, z, **kw):
    for sx in (-1, 1):
        headlight(sx * x, y, z, **kw)


def bumper(y, z, w, sy=-1, rgb=CHROME, bullets=0.0):
    """A fat rounded bar; `bullets` > 0 puts two bullet over-riders that far out."""
    rbox(0, y, z - 0.18, w, 0.38, 0.36, rgb, 0.13, 1)
    if bullets:
        for sx in (-1, 1):
            can(sx * bullets, y + sy * 0.3, z + 0.02, 0.17, 0.32, rgb, n=8, r2=0.06,
                rot=AY if sy < 0 else AYB)


def grille(y, z, w, h, bars=5, vertical=True, rim=CHROME, slat=DARK, bar=CHROME):
    """A chrome-framed grille: rounded frame, dark inset, chrome bars."""
    rbox(0, y + 0.1, z - h / 2, w, 0.3, h, rim, 0.1, 1)
    iw, ih = w - 0.26, h - 0.26
    box(0, y - 0.03, z, iw, 0.1, ih, slat)
    for i in range(bars):
        f = (i + 0.5) / bars - 0.5
        if vertical:
            box(f * (iw - 0.1), y - 0.08, z, 0.09, 0.08, ih, bar)
        else:
            box(0, y - 0.08, z + f * (ih - 0.08), iw, 0.08, 0.08, bar)


def tail_lights(y, z, x, sy=1, w=0.42, h=0.36):
    for sx in (-1, 1):
        rbox(sx * x, y, z - h / 2, w, 0.2, h, RED, 0.06, 1)


def spear(y0, y1, z, rgb=CHROME, x=1.5, t=0.12):
    """A chrome side strip along both body sides."""
    for sx in (-1, 1):
        box(sx * (x + 0.01), (y0 + y1) / 2, z, 0.06, y1 - y0, t, rgb)


class Cab:
    """A cab sunk into the body top (seam at zs): straight walls, crisp seam,
    rounded roof edges only. The front face rakes from yf0 (at the seam) to
    yf1 (at the roof z1); the back from yb0 to yb1. Optional two-tone roof
    above roof_z."""

    def __init__(self, zs, z1, yf0, yf1, yb1, yb0, w, rgb, r=0.32, segs=2, roof=None, roof_z=None):
        self.__dict__.update(zs=zs, z1=z1, yf0=yf0, yf1=yf1, yb0=yb0, yb1=yb1, w=w, r=r)
        bot = zs - r - 0.12
        pts = []
        for sx in (-1, 1):
            pts += [(sx * w / 2, self.yf(bot), bot), (sx * w / 2, self.yb(bot), bot),
                    (sx * w / 2, yf1, z1), (sx * w / 2, yb1, z1)]
        lo = hull(pts, rgb, bevel=r, segs=segs)
        if roof:
            hi = hull(pts, roof, bevel=r, segs=segs)
            cut(hi, roof_z, True)
            cut(lo, roof_z, False)
        cut(lo, zs - 0.06, True)

    def yf(self, z):
        return self.yf0 + (self.yf1 - self.yf0) * (z - self.zs) / (self.z1 - self.zs)

    def yb(self, z):
        return self.yb0 + (self.yb1 - self.yb0) * (z - self.zs) / (self.z1 - self.zs)

    def windscreen(self, za, zb, m=0.1):
        hw = self.w / 2 - self.r - m
        pane([(sx * hw, self.yf(z), z) for sx in (-1, 1) for z in (za, zb)],
             (0, -(self.z1 - self.zs), self.yf1 - self.yf0))

    def rear_window(self, za, zb, m=0.1, k=1.0):
        hw = (self.w / 2 - self.r - m) * k
        pane([(sx * hw, self.yb(z), z) for sx in (-1, 1) for z in (za, zb)],
             (0, self.z1 - self.zs, self.yb0 - self.yb1))

    def side_windows(self, za, zb, pillars=(), m=0.12, gap=0.24):
        """Side panes between the raked front and back edges, split by vertical pillars at y."""
        e = self.r + m
        edges = [None] + list(pillars) + [None]
        for i in range(len(edges) - 1):
            def left(z, c=edges[i]):
                return self.yf(z) + e * 0.9 if c is None else c + gap / 2

            def right(z, c=edges[i + 1]):
                return self.yb(z) - e * 0.9 if c is None else c - gap / 2
            for sx in (-1, 1):
                x = sx * self.w / 2
                pane([(x, left(za), za), (x, right(za), za), (x, right(zb), zb), (x, left(zb), zb)],
                     (sx, 0, 0))


# ---------------------------------------------------------------- the six cars
# Shared layout: body 3.0 wide; wheels on a 1.38 track under chunky arch fenders.

def sedan():
    """Purple and cream two-tone sedan: long hood, raked screen and back, toothy grille."""
    body, cream = (0.47, 0.42, 0.66), (0.95, 0.91, 0.78)
    wb = 4.1
    running_gear(wb, body, yoff=-0.1)
    running_board(wb, CHROME, yoff=-0.1)
    rbox(0, 0, 0.8, 3.0, 6.4, 1.4, body, 0.3)
    cab = Cab(2.2, 3.95, -0.45, 0.35, 1.5, 2.3, 2.6, body, roof=cream, roof_z=3.5)
    cab.windscreen(2.5, 3.35)
    cab.rear_window(2.5, 3.3)
    cab.side_windows(2.55, 3.35, pillars=(0.95,))
    spear(-3.0, 3.0, 1.95)
    # wide toothy grille between bucket headlights, bullet over-riders, hood ornament
    grille(-3.22, 1.5, 1.5, 0.62, bars=6)
    headlights(1.08, -3.2, 1.78, pod=body)
    bumper(-3.35, 0.95, 3.3, bullets=0.55)
    bumper(3.35, 0.95, 3.3, sy=1)
    hull([(0, -3.05, 2.2), (0, -2.35, 2.2), (-0.09, -2.4, 2.2), (0.09, -2.4, 2.2),
          (0, -2.45, 2.48)], CHROME)
    tail_lights(3.22, 1.9, 1.12)


def bug():
    """Orange bug: short, round fastback cab sloping to the tail, lamps up on the front arches."""
    body = (0.93, 0.50, 0.17)
    wb = 3.3
    running_gear(wb, body, rout=WR + 0.42, w=0.8)
    running_board(wb, body)
    rbox(0, 0, 0.78, 3.0, 5.2, 1.3, body, 0.6, 3)
    cab = Cab(2.08, 3.6, -0.9, -0.2, 0.2, 1.95, 2.5, body, r=0.66, segs=3)
    cab.windscreen(2.35, 2.98, m=-0.28)
    cab.rear_window(2.35, 2.75, m=-0.2, k=0.85)
    cab.side_windows(2.38, 2.98, pillars=(0.25,), m=-0.22)
    for sx in (-1, 1):                                                # lamps on the arches
        headlight(sx * (TR + 0.06), -2.45, 1.72, r=0.27, pod=body)
    box(0, -2.62, 1.5, 0.1, 0.1, 0.9, CHROME)                         # nose strip
    rbox(0, -2.35, 2.03, 0.5, 0.25, 0.14, CHROME, 0.05, 1)            # hood handle
    for i in range(4):                                                # engine louvres
        box(0, 2.62, 1.5 + i * 0.16, 1.1, 0.1, 0.07, DARK)
    bumper(-2.7, 0.92, 3.1)
    bumper(2.7, 0.92, 3.1, sy=1)
    tail_lights(2.57, 1.9, 1.0, w=0.32, h=0.42)


def wagon():
    """Green woody wagon: long roof to the tail, wood sides, roof rack, bar grille."""
    body = (0.38, 0.62, 0.31)
    wood, wood_lt = (0.60, 0.38, 0.20), (0.82, 0.62, 0.38)
    wb = 4.0
    running_gear(wb, body)
    running_board(wb, CHROME)
    rbox(0, 0, 0.8, 3.0, 6.0, 1.4, body, 0.3)
    cab = Cab(2.2, 4.0, -1.0, -0.2, 2.55, 2.68, 2.66, body)
    cab.windscreen(2.5, 3.4)
    cab.rear_window(2.55, 3.4)
    cab.side_windows(2.6, 3.45, pillars=(0.6, 1.65))
    for sx in (-1, 1):                                                # wood side panel
        x = sx * 1.5
        box(x, 0.25, 1.62, 0.08, 5.0, 0.75, wood)
        for z in (1.25, 2.0):
            box(x + sx * 0.03, 0.25, z, 0.08, 5.1, 0.13, wood_lt)
        for yb in (-1.0, 0.75, 2.55):
            box(x + sx * 0.03, yb, 1.62, 0.08, 0.13, 0.75, wood_lt)
        rbox(sx * 1.05, 0.9, 3.96, 0.12, 3.0, 0.14, CHROME, 0.04, 1)    # roof rails
    for yb in (0.0, 1.8):
        box(0, yb, 4.14, 2.2, 0.12, 0.08, CHROME)
    grille(-3.02, 1.55, 1.3, 0.62, bars=3, vertical=False)
    headlights(1.05, -3.0, 1.62)
    bumper(-3.15, 0.95, 3.2, bullets=0.85)
    bumper(3.15, 0.95, 3.2, sy=1)
    tail_lights(3.02, 1.85, 1.15, w=0.3, h=0.5)


def van():
    """Teal and cream bus: ONE long rounded cube, split screen, V nose and emblem."""
    teal, cream = (0.22, 0.56, 0.52), (0.95, 0.91, 0.76)
    running_gear(3.6, teal, fenders=False)
    z0, h, band = 0.75, 3.65, 2.55
    lo = rbox(0, 0, z0, 3.0, 5.8, h, teal, 0.5)
    hi = rbox(0, 0, z0, 3.0, 5.8, h, cream, 0.5)
    cut(lo, band, keep_above=False)
    cut(hi, band, keep_above=True)
    T = 0.1
    with glow():
        for sx in (-1, 1):                                            # split windscreen
            box(sx * 0.68, -2.87, 3.3, 1.15, T, 0.9, GLOW_RGB)
        box(0, 2.87, 3.3, 2.0, T, 0.9, GLOW_RGB)                      # back
        for yc in (-1.65, -0.3, 1.05, 2.15):                          # side row
            for sx in (-1, 1):
                box(sx * 1.47, yc, 3.3, T, 1.0 if yc < 2 else 0.8, 0.9, GLOW_RGB)
    # the cream V on the nose with a big chrome emblem in it
    slab([(sx * 1.05, -2.9, 2.62) for sx in (-1, 1)] + [(0, -2.9, 1.6)], (0, -1, 0), cream)
    can(0, -2.95, 2.0, 0.34, 0.14, CHROME, n=12, rot=AY)
    can(0, -3.03, 2.0, 0.2, 0.06, teal, n=10, rot=AY)
    spear(-2.3, 2.3, band, x=1.49)
    headlights(1.0, -2.88, 1.65)
    bumper(-3.0, 0.95, 3.15, bullets=0.7)
    bumper(3.0, 0.95, 3.15, sy=1)
    tail_lights(2.9, 1.85, 1.1, w=0.32, h=0.5)


def pumpkin(x, y, z0, s):
    ball(x, y, z0 + s * 0.38, s, s, s * 0.76, ORANGE, seg=8, ring=5)
    can(x, y, z0 + s * 0.8, 0.07, 0.22, (0.36, 0.48, 0.20), n=5)


def pickup():
    """Brick-red pickup: raked cab up front, tall bar grille, pumpkins in the bed."""
    body = (0.70, 0.28, 0.20)
    wb = 4.0
    running_gear(wb, body, yoff=0.1)
    running_board(wb, CHROME, yoff=0.1)
    rbox(0, 0, 0.8, 3.0, 6.2, 1.3, body, 0.3)
    cab = Cab(2.1, 4.0, -1.05, -0.4, 0.7, 0.78, 2.66, body)
    cab.windscreen(2.45, 3.4)
    cab.rear_window(2.6, 3.35, k=0.85)
    cab.side_windows(2.5, 3.4)
    # the bed: two side walls and a tailgate on the deck, behind the cab
    bz, bh, by0, by1 = 2.0, 0.6, 0.95, 3.05
    for sx in (-1, 1):
        rbox(sx * 1.3, (by0 + by1) / 2, bz - 0.1, 0.4, by1 - by0, bh, body, 0.15, 1)
        box(sx * 1.51, (by0 + by1) / 2, bz + 0.25, 0.04, by1 - by0 - 0.3, 0.1, CHROME)
    rbox(0, by1 - 0.2, bz - 0.1, 3.0, 0.4, bh, body, 0.15, 1)
    for x, y, s in ((-0.5, 1.55, 1.15), (0.5, 1.6, 1.05), (-0.45, 2.4, 1.05), (0.5, 2.4, 1.15)):
        pumpkin(x, y, bz - 0.05, s)
    grille(-3.12, 1.55, 1.1, 1.0, bars=5)
    headlights(1.08, -3.1, 1.75, pod=body)
    bumper(-3.25, 0.95, 3.3)
    bumper(3.25, 0.95, 3.3, sy=1)
    tail_lights(3.12, 1.75, 1.15, w=0.3, h=0.42)


def spooky():
    """Black hardtop with tail fins, orange trim and a fanged grille."""
    body = (0.16, 0.15, 0.18)
    wb = 4.1
    running_gear(wb, body, hub=ORANGE, wall=ORANGE)
    rbox(0, 0, 0.78, 3.0, 6.5, 1.27, body, 0.3)
    cab = Cab(2.05, 3.6, -0.6, 0.4, 1.3, 2.05, 2.6, body)
    cab.windscreen(2.35, 3.15)
    cab.rear_window(2.35, 3.1)
    cab.side_windows(2.4, 3.15, pillars=(0.9,))
    spear(-3.05, 2.6, 1.85, ORANGE)
    for sx in (-1, 1):                                                # tail fins
        x = sx * 1.3
        hull([(x + d, y, z) for d in (-0.2, 0.2)
              for y, z in ((0.9, 1.95), (3.2, 1.95), (3.45, 3.2), (3.05, 3.2))], body, bevel=0.1)
        can(x, 3.36, 2.5, 0.2, 0.3, RED, n=8, r2=0.12, rot=AYB)
        box(x + sx * 0.21, 2.5, 2.35, 0.04, 1.2, 0.08, ORANGE)        # fin flash
    # fanged grille: orange frame, dark mouth, two white fangs
    grille(-3.27, 1.45, 1.5, 0.6, bars=0, rim=ORANGE)
    for sx in (-1, 1):
        hull([(sx * 0.42 + d, -3.36, 1.68) for d in (-0.14, 0.14)]
             + [(sx * 0.42 + d, -3.30, 1.68) for d in (-0.14, 0.14)]
             + [(sx * 0.42, -3.36, 1.3), (sx * 0.42, -3.30, 1.3)], WHITE)
    headlights(1.08, -3.25, 1.75, rim=ORANGE, pod=body)
    bumper(-3.4, 0.92, 3.3, rgb=ORANGE, bullets=0.95)
    bumper(3.4, 0.92, 3.3, sy=1, rgb=ORANGE)


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
