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

Round 5 follows concepts/cars-kitbash-b.png: taller, boxier cabs (rounded only
on top), the bug's upright back, a tall arched van and a long toothy sedan.
Round 6: every cab squashed ~14% lower (SQUASH), and the van lower and rounder
again: a bulbous bus with a round nose, tail and roof on a raked split screen.
Round 7: wagon and spooky untouched; sedan cab wider and further forward; bug cab
near full body width with tucked-in fenders and a shorter hood; pickup cab ~15%
lower; van back toward the round-5 box (moderate rounding) and the biggest
vehicle (longer and wider, wider track).

Round 8 (polish): z-fighting fixes. The sedan's toothy grille sat in the body's front
face (mouth and teeth coplanar with it): pulled forward in proud layers. Wagon wood
uprights stand proud of the rails; pickup bed walls stop short of the tailgate's
back; grille bars run past the mouth's sides; headlight pods clear the grille's
back; the van's V badge strokes no longer share a face.

(Previous versions: archive/car.r1.py ... archive/car.r8.py.)

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
SQUASH = 0.86                      # round 6: cabs 14% lower above the body seam


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


def running_gear(wb, rgb, yoff=0.0, hub=HUB, wall=WHITE, fenders=True, tr=TR, fx=0.06, **kw):
    for sx in (-1, 1):
        for wy in (-wb / 2 + yoff, wb / 2 + yoff):
            wheel(sx * tr, wy, sx, hub, wall)
            if fenders:
                arch(sx * (tr + fx), wy, rgb, **kw)


def running_board(wb, rgb, yoff=0.0, z=0.78):
    for sx in (-1, 1):
        rbox(sx * 1.5, yoff, z, 0.62, wb - 1.7, 0.2, rgb, 0.07, 1)


def headlight(x, y, z, r=0.3, rim=CHROME, pod=None):
    """A round glowing lamp in a thick chrome ring, optionally in a body-colour bucket."""
    if pod:
        can(x, y + 0.03, z, r * 1.55, 0.32, pod, n=10, rot=AY)   # back clear of the grille's back face
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
            box(0, y - 0.08, z + f * (ih - 0.08), iw + 0.04, 0.08, 0.08, bar)   # ends past the inset's sides


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

    def __init__(self, zs, z1, yf0, yf1, yb1, yb0, w, rgb, r=0.32, segs=2, roof=None, roof_z=None,
                 squash=SQUASH):
        # squash the cab down: the roof drops along the same raked front/back lines,
        # window tops drop with it (self.drop) so panes shrink to fit
        k = squash
        self.drop = (1 - k) * (z1 - zs)
        z1, yf1, yb1 = zs + k * (z1 - zs), yf0 + k * (yf1 - yf0), yb0 + k * (yb1 - yb0)
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
        zb -= self.drop
        hw = self.w / 2 - self.r - m
        pane([(sx * hw, self.yf(z), z) for sx in (-1, 1) for z in (za, zb)],
             (0, -(self.z1 - self.zs), self.yf1 - self.yf0))

    def rear_window(self, za, zb, m=0.1, k=1.0):
        zb -= self.drop
        hw = (self.w / 2 - self.r - m) * k
        pane([(sx * hw, self.yb(z), z) for sx in (-1, 1) for z in (za, zb)],
             (0, self.z1 - self.zs, self.yb0 - self.yb1))

    def side_windows(self, za, zb, pillars=(), m=0.12, gap=0.24):
        """Side panes between the raked front and back edges, split by vertical pillars at y."""
        zb -= self.drop
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
# Round 5 (concepts/cars-kitbash-b.png): every cab taller and boxier.

def tooth(x, y, z, w, h, rgb=WHITE, t=0.06):
    """A flat triangular tooth on a front face: base w wide at z, tip h away (h < 0 points down)."""
    return hull([(x + dx, yy, z) for dx in (-w / 2, w / 2) for yy in (y, y + t)]
                + [(x, yy, z + h) for yy in (y, y + t)], rgb)


def sedan():
    """Long purple two-tone sedan: tall boxy cab, lavender doors, toothy zig-zag grille."""
    body, lav, lav2 = (0.42, 0.33, 0.60), (0.68, 0.57, 0.82), (0.58, 0.47, 0.74)
    wb = 4.9
    running_gear(wb, body, yoff=-0.05)
    rbox(0, 0, 0.8, 3.0, 7.6, 1.4, body, 0.3)
    cab = Cab(2.2, 4.3, -1.1, -0.3, 1.7, 2.2, 2.82, body)
    cab.windscreen(2.5, 3.85)
    cab.rear_window(2.5, 3.75)
    cab.side_windows(2.55, 3.85, pillars=(0.6,))
    for sx in (-1, 1):                                                # two-tone doors
        x = sx * 1.5
        slab([(x, y, z) for y in (-1.2, 0.57) for z in (1.0, 2.14)], (sx, 0, 0), lav)
        slab([(x, y, z) for y in (0.63, 1.7) for z in (1.0, 2.14)], (sx, 0, 0), lav2)
        for yh in (0.25, 1.35):
            box(x + sx * 0.03, yh, 1.9, 0.06, 0.32, 0.08, CHROME)       # door handles
    rbox(0, -2.45, 2.15, 0.9, 2.4, 0.1, (0.47, 0.37, 0.65), 0.04, 1)   # hood bulge
    # toothy grille: chrome frame, dark mouth, a white zig-zag of interlocking teeth
    # (round 8: the grille sat in the body's front face, mouth and teeth coplanar with it;
    # now the frame stands 0.1 proud, the mouth 0.03 proud of the frame, the teeth 0.03 proud of the mouth)
    grille(-3.85, 1.42, 1.6, 0.7, bars=0)
    zt, zb, n = 1.69, 1.15, 4
    tw = 1.24 / n
    for i in range(n):
        tooth(-0.62 + tw * (i + 0.5), -3.96, zt, tw, -0.38)
    for i in range(n - 1):
        tooth(-0.62 + tw * (i + 1), -3.96, zb, tw, 0.38)
    headlights(1.1, -3.7, 1.7, pod=body)
    for sx in (-1, 1):
        rbox(sx * 1.1, -3.82, 1.12, 0.26, 0.1, 0.14, ORANGE, 0.03, 1)  # parking lamps
    bumper(-3.85, 0.95, 3.3, bullets=0.75)
    bumper(3.85, 0.95, 3.3, sy=1)
    tail_lights(3.72, 1.9, 1.12)


def bug():
    """Orange bug: round chubby body, tall cab with an upright back, round fenders, nose strip."""
    body = (0.93, 0.50, 0.17)
    ridge = (0.86, 0.44, 0.13)
    wb = 3.3
    running_gear(wb, body, rin=WR + 0.05, rout=WR + 0.3, w=0.68, fx=0.0)
    running_board(wb, body)
    rbox(0, 0.1, 0.78, 3.0, 5.0, 1.35, body, 0.5, 3)                  # hood 0.2 shorter
    cab = Cab(2.1, 4.0, -1.05, -0.5, 1.3, 1.5, 2.84, body, r=0.6, segs=3)
    cab.windscreen(2.4, 3.45, m=-0.15)
    cab.rear_window(2.45, 3.3, m=0.0, k=0.85)
    cab.side_windows(2.45, 3.45, pillars=(0.4,), m=0.02)
    for sx in (-1, 1):                                                # lamps on the front fenders
        headlight(sx * TR, -2.25, 1.7, r=0.26, pod=body)
        can(sx * 0.95, -2.42, 1.12, 0.1, 0.1, ORANGE, n=6, rot=AY)    # indicators
    hull([(sx * w, y, z) for sx in (-1, 1) for w, y, z in (            # nose strip
        (0.3, -1.1, 2.2), (0.3, -1.9, 2.18), (0.3, -2.25, 1.95), (0.26, -2.48, 1.3),
        (0.3, -1.1, 2.0), (0.3, -2.1, 1.3))], ridge, bevel=0.06)
    for i in range(4):                                                # engine louvres
        box(0, 2.6, 1.25 + i * 0.15, 1.0, 0.1, 0.07, DARK)
    bumper(-2.55, 0.92, 3.2, bullets=0.8)
    bumper(2.75, 0.92, 3.2, sy=1)
    tail_lights(2.57, 1.9, 1.0, w=0.32, h=0.42)


def wagon():
    """Green woody wagon: tall boxy cab to the tail, wood sides, roof rack, bar grille."""
    body = (0.38, 0.62, 0.31)
    wood, wood_lt = (0.60, 0.38, 0.20), (0.82, 0.62, 0.38)
    wb = 4.0
    running_gear(wb, body)
    running_board(wb, CHROME)
    rbox(0, 0, 0.8, 3.0, 6.0, 1.4, body, 0.3)
    cab = Cab(2.2, 4.5, -1.0, -0.35, 2.6, 2.68, 2.7, body)
    cab.windscreen(2.5, 3.95)
    cab.rear_window(2.55, 3.9)
    cab.side_windows(2.6, 3.95, pillars=(0.55, 1.6))
    for sx in (-1, 1):                                                # wood side panel
        x = sx * 1.5
        box(x, 0.45, 1.62, 0.08, 4.6, 0.75, wood)
        for z in (1.25, 2.0):
            box(x + sx * 0.03, 0.45, z, 0.08, 4.7, 0.13, wood_lt)
        for yb in (-0.95, 0.85, 2.6):                                 # uprights: proud of the rails, tucked under them
            box(x + sx * 0.05, yb, 1.62, 0.08, 0.13, 0.7, wood_lt)
        rbox(sx * 1.05, 0.9, 4.46 - cab.drop, 0.12, 3.2, 0.14, CHROME, 0.04, 1)    # roof rails
    for yb in (-0.4, 2.2):
        box(0, yb, 4.64 - cab.drop, 2.3, 0.12, 0.08, CHROME)
    grille(-3.02, 1.55, 1.3, 0.62, bars=3, vertical=False)
    headlights(1.05, -3.0, 1.62)
    bumper(-3.15, 0.95, 3.2, bullets=0.85)
    bumper(3.15, 0.95, 3.2, sy=1)
    tail_lights(3.02, 1.85, 1.15, w=0.3, h=0.5)


def van_profile(L, z0, z1, zw, zr, rr, rb):
    """Side profile (y, z) of the bus, nose at -L: a rounded bottom corner (rb),
    a vertical lower nose up to zw, a gently raked windscreen face up to zr,
    then a big round into the roof at z1 (rr). Mirrored for the tail. Every
    turn stays under 50 degrees so only the side edges get bevelled."""
    lean = 0.3
    nose = [(-L + rb, z0), (-L + rb * 0.3, z0 + rb * 0.3), (-L, z0 + rb),
            (-L, zw), (-L + lean, zr),
            (-L + lean + (rr - lean) * 0.38, zr + (z1 - zr) * 0.62),
            (-L + rr, z1)]
    return nose + [(-y, z) for y, z in nose]


def van():
    """Teal and cream bus, the biggest vehicle: a rounded box (moderate rounding, between
    round 5's box and round 6's blob), split screen on a raked nose, cream V and badge."""
    teal, cream = (0.22, 0.58, 0.54), (0.96, 0.92, 0.76)
    hw, L, z0, z1, band = 1.65, 3.7, 0.72, 4.35, 2.5
    zw, zr, lean = 2.85, 3.85, 0.3
    running_gear(4.6, teal, tr=1.53, rout=WR + 0.36, w=0.6)
    prof = van_profile(L, z0, z1, zw, zr, rr=0.85, rb=0.4)
    pts = [(sx * hw, y, z) for sx in (-1, 1) for y, z in prof]
    for rgb, above in ((teal, False), (cream, True)):
        cut(bev(hull(pts, rgb), 0.45, 2, 50), band, keep_above=above)

    def rake_y(z):                                                   # nose face y at height z
        return -L + lean * (z - zw) / (zr - zw)
    za, zb = 2.95, 3.7
    for sx in (-1, 1):                                                # split windscreen
        pane([(sx * x, rake_y(z), z) for x in (0.08, 0.92) for z in (za, zb)], (0, -1, lean / (zr - zw)))
    pane([(x, -rake_y(z), z) for x in (-0.92, 0.92) for z in (za, zb)], (0, 1, lean / (zr - zw)))
    for yc in (-1.86, -0.62, 0.62, 1.86):                        # side row
        for sx in (-1, 1):
            pane([(sx * hw, yc + dy, z) for dy in (-0.52, 0.52) for z in (2.85, 3.65)], (sx, 0, 0))
    # the big cream V on the teal nose with a teal V badge in it
    slab([(sx * 1.1, -L, band) for sx in (-1, 1)] + [(0, -L, 1.3)], (0, -1, 0), cream)
    for sx in (-1, 1):
        yi, yo = (-L - 0.01, -L - 0.07) if sx < 0 else (-L + 0.02, -L - 0.1)   # one stroke 0.03 prouder where they cross
        hull([(sx * 0.3 + d, y, 2.25) for d in (-0.08, 0.08) for y in (yi, yo)]
             + [(d, y, 1.68 if sx < 0 else 1.65) for d in (-0.06, 0.06) for y in (yi, yo)], teal)
    spear(-2.85, 2.85, band, x=hw - 0.01)
    headlights(1.05, -L + 0.03, 1.62)
    for sx in (-1, 1):
        can(sx * 1.0, -L - 0.03, 2.15, 0.1, 0.1, ORANGE, n=6, rot=AY)  # indicators
    bumper(-L - 0.1, 0.95, 3.5, bullets=0.8)
    bumper(L + 0.1, 0.95, 3.5, sy=1)
    tail_lights(L - 0.02, 1.85, 1.05, w=0.34, h=0.5)


def pumpkin(x, y, z0, s):
    ball(x, y, z0 + s * 0.38, s, s, s * 0.76, ORANGE, seg=8, ring=5)
    can(x, y, z0 + s * 0.8, 0.07, 0.22, (0.36, 0.48, 0.20), n=5)


def pickup():
    """Red pickup: tall boxy cab up front, chrome bar grille, pumpkins in the bed."""
    body = (0.78, 0.22, 0.18)
    wb = 4.0
    running_gear(wb, body, yoff=0.1)
    running_board(wb, CHROME, yoff=0.1)
    rbox(0, 0, 0.8, 3.0, 6.2, 1.3, body, 0.3)
    cab = Cab(2.1, 4.65, -1.15, -0.75, 0.75, 0.8, 2.7, body, squash=SQUASH * 0.85)  # squat work truck
    cab.windscreen(2.45, 4.15)
    cab.rear_window(2.6, 4.0, k=0.85)
    cab.side_windows(2.5, 4.15)
    # the bed: two side walls and a tailgate on the deck, behind the cab
    bz, bh, by0, by1 = 2.0, 0.65, 0.95, 3.05
    for sx in (-1, 1):
        rbox(sx * 1.3, (by0 + by1) / 2 - 0.05, bz - 0.1, 0.4, by1 - by0 - 0.1, bh, body, 0.15, 1)   # ends 0.1 in from the tailgate's back
        box(sx * 1.51, (by0 + by1) / 2, bz + 0.25, 0.04, by1 - by0 - 0.3, 0.1, CHROME)
    rbox(0, by1 - 0.2, bz - 0.14, 2.94, 0.4, bh + 0.02, body, 0.15, 1)   # tailgate: top and sides just inside the walls
    # a low mound of smaller pumpkins: three on the bed floor, one nestled on top,
    # tops a little above the bed walls and well under the cab roof
    for x, y, s in ((-0.5, 1.5, 0.95), (0.55, 1.5, 0.95), (-0.35, 2.3, 0.95)):
        pumpkin(x, y, bz + 0.1, s)
    pumpkin(0.5, 2.15, bz + 0.45, 0.95)              # rear corner, rides up so it shows in 3/4
    grille(-3.12, 1.48, 1.35, 0.78, bars=4, vertical=False)
    headlights(1.1, -3.1, 1.6)
    bumper(-3.25, 0.92, 3.3, bullets=0.8)
    bumper(3.25, 0.92, 3.3, sy=1)
    tail_lights(3.12, 1.75, 1.15, w=0.3, h=0.42)


def spooky():
    """Black hardtop with bat fins, orange trim and a fanged grille."""
    body = (0.16, 0.15, 0.18)
    wb = 4.1
    running_gear(wb, body, hub=ORANGE, wall=ORANGE)
    rbox(0, 0, 0.78, 3.0, 6.5, 1.27, body, 0.3)
    cab = Cab(2.05, 4.05, -0.6, 0.15, 1.3, 2.0, 2.6, body)
    cab.windscreen(2.35, 3.6)
    cab.rear_window(2.35, 3.5)
    cab.side_windows(2.4, 3.6, pillars=(0.85,))
    spear(-3.05, 2.6, 1.85, ORANGE)
    for sx in (-1, 1):                                                # tail fins
        x = sx * 1.3
        hull([(x + d, y, z) for d in (-0.2, 0.2)
              for y, z in ((0.9, 1.95), (3.2, 1.95), (3.45, 3.5 - cab.drop), (3.0, 3.5 - cab.drop))], body, bevel=0.1)
        can(x, 3.36, 2.5 - cab.drop / 2, 0.2, 0.3, RED, n=8, r2=0.12, rot=AYB)
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
