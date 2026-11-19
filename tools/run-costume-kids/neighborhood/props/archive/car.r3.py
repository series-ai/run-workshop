"""Six toy cars in the kids' shape language: a few big rounded cubes and
nothing fiddly. Each car is a rounded-cube lower body, a squarer rounded-cube
cab set back on it (nearly as wide as the body), four chunky wheels with a
simple hub, two round glowing headlights and a bumper bar. Windows are flat
glowing panels half sunk into the cab's faces. The van is one long two-tone
rounded cube. Front faces -y.

(Previous versions: archive/car.r1.py, archive/car.r2.py.)

    Blender -b -t 1 --factory-startup --python neighborhood/props/car.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F403
import kit  # noqa: E402

TYRE = (0.24, 0.22, 0.26)
HUB = (0.66, 0.64, 0.67)
CHROME = (0.70, 0.68, 0.70)
DARK = (0.22, 0.19, 0.21)
ORANGE = (0.95, 0.50, 0.14)

AX = (0, math.radians(90), 0)      # a can lying along x (wheels)
AY = (math.radians(90), 0, 0)      # a can lying along y (headlights)
WR = 0.82                          # wheel radius
WW = 0.62                          # wheel width
T = 0.1                            # window panel thickness
SINK = 0.03                        # panels stand only 0.02 proud of the face


def rbox(x, y, z0, w, d, h, rgb, r, segs=2):
    """A rounded cube standing on z0 (r = bevel radius)."""
    return box(x, y, z0 + h / 2, w, d, h, rgb, bevel=r, segs=segs)


def wheels(track, wb, yoff=0.0, hub=HUB, r=WR):
    """Four short fat tyres with a flat round hub on the outer face."""
    for sx in (-1, 1):
        for wy in (-wb / 2 + yoff, wb / 2 + yoff):
            t = can(sx * track, wy, r, r, WW, TYRE, n=10, rot=AX)
            b = t.modifiers.new("b", "BEVEL")
            b.width, b.segments, b.limit_method = 0.16, 1, "ANGLE"
            b.angle_limit = math.radians(50)
            can(sx * (track + WW / 2), wy, r, r * 0.5, 0.12, hub, n=8, rot=AX)


def headlights(y, z, x, r=0.3, rim=CHROME):
    """Two round lamps: a glowing disc in a thick ring on the face at y."""
    for sx in (-1, 1):
        can(sx * x, y, z, r * 1.3, 0.14, rim, n=10, rot=AY)
        with glow():
            can(sx * x, y - 0.08, z, r, 0.1, GLOW_RGB, n=10, rot=AY)


def bumper(y, z, w, rgb=CHROME):
    rbox(0, y, z - 0.18, w, 0.36, 0.36, rgb, 0.12, 1)


class Cab:
    """A rounded-cube cab (centre x = 0) with flat glowing windows on its faces."""

    def __init__(self, y0, y1, z0, z1, w, rgb, r, segs=2):
        self.y0, self.y1, self.z0, self.z1, self.w, self.r = y0, y1, z0, z1, w, r
        rbox(0, (y0 + y1) / 2, z0, w, y1 - y0, z1 - z0, rgb, r, segs)

    def windows(self, z, h, split=False, sides=1, back=True, m=0.12, gap=0.2):
        """Windscreen (one or two panes), `sides` panes per side, a back pane.
        Panes sit inside the flat part of each face (clear of the bevel)."""
        e = self.r + m
        zc = z + h / 2
        with glow():
            fw = self.w - 2 * e
            if split:
                pw = (fw - gap) / 2
                for sx in (-1, 1):
                    box(sx * (pw + gap) / 2, self.y0 + SINK, zc, pw, T, h, GLOW_RGB)
            else:
                box(0, self.y0 + SINK, zc, fw, T, h, GLOW_RGB)
            if back:
                box(0, self.y1 - SINK, zc, fw, T, h, GLOW_RGB)
            span = (self.y1 - self.y0) - 2 * e
            pd = (span - (sides - 1) * gap) / sides
            for i in range(sides):
                yc = self.y0 + e + pd / 2 + i * (pd + gap)
                for sx in (-1, 1):
                    box(sx * (self.w / 2 - SINK), yc, zc, T, pd, h, GLOW_RGB)


# ---------------------------------------------------------------- the six cars
# Shared layout: body 3.0 wide, wheels on a 1.32 track (they peek out of the sides).

def sedan():
    """Purple sedan: long low body, square cab, a tall flat grille block."""
    body = (0.47, 0.42, 0.66)
    wheels(1.32, 3.5)
    rbox(0, 0, 0.8, 3.0, 5.6, 1.5, body, 0.32)
    cab = Cab(-0.85, 1.95, 2.2, 4.1, 2.7, body, 0.32)
    cab.windows(2.85, 0.95, split=True)
    rbox(0, -2.8, 1.0, 1.0, 0.3, 1.25, CHROME, 0.1, 1)               # grille block
    box(0, -2.92, 1.62, 0.66, 0.1, 0.95, DARK)
    headlights(-2.8, 1.75, 1.02)
    bumper(-2.9, 0.95, 3.2)
    bumper(2.9, 0.95, 3.2)


def bug():
    """Orange bug: shorter, squatter, softer; the cab a squashed rounded cube."""
    body = (0.93, 0.50, 0.17)
    wheels(1.3, 3.1)
    rbox(0, 0, 0.75, 3.0, 4.7, 1.45, body, 0.6, 3)
    cab = Cab(-0.9, 1.5, 2.0, 3.75, 2.65, body, 0.48, 3)
    cab.windows(2.52, 0.72, split=True, m=0.02)
    headlights(-2.35, 1.6, 0.95)
    bumper(-2.45, 0.9, 3.1)
    bumper(2.45, 0.9, 3.1)


def wagon():
    """Green station wagon: long cab to the tail, a wood band down each side."""
    body = (0.38, 0.62, 0.31)
    wood = (0.62, 0.40, 0.22)
    wheels(1.32, 3.6)
    rbox(0, 0, 0.8, 3.0, 5.6, 1.5, body, 0.32)
    cab = Cab(-0.9, 2.65, 2.2, 4.0, 2.75, body, 0.32)
    cab.windows(2.8, 0.9, sides=2)
    for sx in (-1, 1):                                                # wood side band
        rbox(sx * 1.47, 0.15, 1.25, 0.12, 4.6, 0.75, wood, 0.05, 1)
    headlights(-2.8, 1.7, 0.98)
    bumper(-2.9, 0.95, 3.2)
    bumper(2.9, 0.95, 3.2)


def _bisect_keep(o, z, keep_above):
    """Apply o's modifiers and cut it at height z, keeping one side (no cap)."""
    import bmesh
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


def van():
    """Teal and cream bus: ONE long rounded cube on four wheels, a row of windows."""
    teal, cream = (0.22, 0.56, 0.52), (0.95, 0.91, 0.76)
    wheels(1.32, 3.6)
    z0, h, band = 0.75, 3.65, 2.55
    lo = rbox(0, 0, z0, 3.0, 5.8, h, teal, 0.5)
    hi = rbox(0, 0, z0, 3.0, 5.8, h, cream, 0.5)
    _bisect_keep(lo, band, keep_above=False)
    _bisect_keep(hi, band, keep_above=True)
    with glow():
        for sx in (-1, 1):                                            # windscreen
            box(sx * 0.68, -2.87, 3.3, 1.15, T, 0.9, GLOW_RGB)
        box(0, 2.87, 3.3, 2.0, T, 0.9, GLOW_RGB)                      # back
        for yc in (-1.65, -0.3, 1.05, 2.15):                          # side row
            for sx in (-1, 1):
                box(sx * 1.47, yc, 3.3, T, 1.0 if yc < 2 else 0.8, 0.9, GLOW_RGB)
    headlights(-2.9, 1.65, 0.95)


def pumpkin(x, y, z0, s):
    ball(x, y, z0 + s * 0.38, s, s, s * 0.76, ORANGE, seg=8, ring=5)
    can(x, y, z0 + s * 0.8, 0.07, 0.22, (0.36, 0.48, 0.20), n=5)


def pickup():
    """Brick-red pickup: square cab up front, an open rounded-cube bed of pumpkins."""
    body = (0.70, 0.28, 0.20)
    wheels(1.32, 3.7, yoff=0.1)
    rbox(0, 0, 0.8, 3.0, 5.9, 1.3, body, 0.3)
    cab = Cab(-1.05, 0.75, 2.0, 3.95, 2.75, body, 0.32)
    cab.windows(2.7, 0.95, sides=1)
    # the bed: two side walls and a tailgate on the body deck, behind the cab
    bz, bh, by0, by1 = 2.0, 0.6, 0.85, 2.95
    for sx in (-1, 1):
        rbox(sx * 1.3, (by0 + by1) / 2, bz - 0.1, 0.4, by1 - by0, bh, body, 0.15, 1)
    rbox(0, by1 - 0.2, bz - 0.1, 3.0, 0.4, bh, body, 0.15, 1)
    for x, y, s in ((-0.5, 1.45, 1.15), (0.5, 1.5, 1.05), (-0.45, 2.3, 1.05), (0.5, 2.3, 1.15)):
        pumpkin(x, y, bz - 0.05, s)
    headlights(-2.95, 1.55, 1.0)
    bumper(-3.05, 0.95, 3.2)
    bumper(3.05, 0.95, 3.2)


def spooky():
    """Black car with orange wheel hubs and an orange stripe."""
    body = (0.16, 0.15, 0.18)
    wheels(1.32, 3.5, hub=ORANGE)
    rbox(0, 0, 0.8, 3.0, 5.5, 1.5, body, 0.35)
    cab = Cab(-0.7, 2.0, 2.2, 4.1, 2.7, body, 0.35)
    cab.windows(2.85, 0.95, split=True)
    for sx in (-1, 1):                                                # stripe
        box(sx * 1.47, 0, 1.75, 0.1, 4.7, 0.32, ORANGE)
    headlights(-2.75, 1.75, 0.98, rim=ORANGE)
    bumper(-2.85, 0.95, 3.2)
    bumper(2.85, 0.95, 3.2)


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
