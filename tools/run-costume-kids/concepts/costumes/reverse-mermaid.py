"""Reverse mermaid: a regular kid from the bottom (bare stub legs, shorts,
sneakers) and a fish from the hips up. A straight-sided rounded-cube
clownfish body (white bands edged black) that goes right up over the kid's
head, the kid's full face looking out of a black-rimmed opening, a big rounded-cube fish head on top (googly eyes
on the sides, a gaping mouth, a dorsal fin) and the kid's arms ARE the little
pectoral fins. The full bucket hangs off one fin. Pairs with the inflatable
T-rex: same face window, same big head on top."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import _bucket

ORANGE, ORANGE_D, BAND, EDGE = (1.0, 0.47, 0.1), (0.92, 0.36, 0.06), (0.98, 0.98, 0.96), (0.1, 0.08, 0.08)
LIP, MOUTH = (1.0, 0.55, 0.6), (0.4, 0.06, 0.12)
SHORTS, SNEAKER = (0.2, 0.55, 0.9), (0.95, 0.85, 0.15)
WIN, HAIR = (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def hood_face(rim):
    """The kid's full-size face in an opening of the costume that encloses the standard head."""
    fz = HEAD_Z - HEAD * 0.05
    box(0, -0.3, fz, HEAD * 0.98, HEAD * 0.8, HEAD * 0.84, rim, bevel=0.22, segs=2)
    box(0, -0.37, fz - 0.03, HEAD * 0.86, HEAD * 0.76, HEAD * 0.74, SKIN, bevel=0.14, segs=2)
    ffy = -0.37 - HEAD * 0.38
    box(0, ffy + 0.04, fz + HEAD * 0.29, HEAD * 0.86, 0.2, HEAD * 0.16, HAIR, bevel=0.06)  # fringe
    face(0, fz, ffy, HEAD * 0.86)


def slab(x, y, z, w, d, h, r, rgb, n=3):
    """A flat slab, rounded in plan only (corner radius r): a band round a rounded cube."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    m = len(pts)
    verts = [(px, py, -h / 2) for px, py in pts] + [(px, py, h / 2) for px, py in pts]
    faces = [list(range(m))[::-1], list(range(m, 2 * m))] + [[i, (i + 1) % m, m + (i + 1) % m, m + i] for i in range(m)]
    me = bpy.data.meshes.new("slab")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new("slab", me)
    o.location = (x, y, z)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, rgb)


def band(z, w, d, r, h=0.36):
    slab(0, 0, z, w + 0.1, d + 0.1, h + 0.1, r + 0.05, EDGE)
    slab(0, 0, z, w + 0.12, d + 0.12, h, r + 0.06, BAND)


def build():
    body(pants=SHORTS, leg_colour=SKIN, shoe=SNEAKER, torso=False, arms=False)
    # the whole fish is one rigid suit round the kid: body, bands, fins (and the bucket the fin holds), head and tail
    with part("body"):
        box(0, 0, HIP + 0.24, TW + 0.15, TD + 0.1, 0.66, SHORTS, bevel=0.08)  # shorts peeking out under the fish
        # the fish body: one straight-sided rounded cube from the hips up over the kid's head (no waist)
        W, D, R = 2.9, 2.6, 0.6
        bz0, bz1 = HIP + 0.62, HEAD_Z + HEAD * 0.52
        box(0, 0.1, (bz0 + bz1) / 2, W, D, bz1 - bz0, ORANGE, bevel=R, segs=3)
        band(1.32, W, D + 0.2, R, h=0.3)
        with part("head"):  # the kid's face in the hood opening
            hood_face(EDGE)
        # pectoral fins where the arms are: flat rounded paddles, black-tipped, angled down and out
        hx, hy, hz0 = 1.75, -0.12, 1.25
        for s in (-1, 1):
            rot = (0, s * math.radians(35), 0)
            box(s * 1.5, -0.1, hz0 + 0.22, 0.8, 0.22, 0.5, ORANGE_D, bevel=0.1, segs=2, rot=rot)
            box(s * 1.82, -0.1, hz0, 0.3, 0.24, 0.52, EDGE, bevel=0.1, segs=2, rot=rot)
        _bucket((1.85, -0.12, hz0), True, 0.62)  # held by the fin, which is the fish's own: it rides the fish as one block
        # the big fish head on top: a wide rounded cube, a white band under it
        hz, HW, HD = bz1 + 1.05, 3.4, 2.6
        box(0, 0.1, hz, HW, HD, 2.1, ORANGE, bevel=0.65, segs=3)
        band(bz1 + 0.06, W, D + 0.2, R, h=0.42)
        # the gaping fish mouth on the front: big pouty pink lips, wide open round a dark gap
        my, mz = 0.1 - HD / 2, hz - 0.15
        box(0, my - 0.05, mz, 1.1, 0.3, 0.5, MOUTH, bevel=0.14, segs=2)                   # the open mouth
        box(0, my - 0.2, mz + 0.34, 1.45, 0.42, 0.3, LIP, bevel=0.13, segs=2)            # top lip
        box(0, my - 0.2, mz - 0.36, 1.3, 0.42, 0.32, LIP, bevel=0.13, segs=2)            # bottom lip
        box(0, my - 0.12, mz - 0.12, 0.55, 0.2, 0.18, (0.95, 0.4, 0.5), bevel=0.06)      # tongue
        for s in (-1, 1):
            box(s * 1.0, my - 0.01, mz + 0.35, 0.28, 0.04, 0.12, CHEEK)  # blush
            # big googly eyes on the sides of the head, bulging out and forward
            ex, ey, ez = s * 1.6, -0.4, hz + 0.45
            ball(ex, ey, ez, 0.95, 0.95, 0.95, WHITE, seg=10, ring=8)
            ball(ex + s * 0.13, ey - 0.37, ez - 0.02, 0.44, 0.18, 0.46, DARK, seg=8, ring=6)
            ball(ex + s * 0.07, ey - 0.48, ez + 0.08, 0.12, 0.06, 0.12, WHITE, seg=6, ring=4)
        # the dorsal fin: a chunky rounded sail on top, swept back, black-edged
        rx = (math.radians(-22), 0, 0)
        box(0, 0.55, hz + 1.08, 0.3, 1.35, 0.7, EDGE, bevel=0.14, segs=2, rot=rx)
        box(0, 0.48, hz + 1.03, 0.36, 1.2, 0.62, ORANGE_D, bevel=0.14, segs=2, rot=rx)
        # a little tail fin sticking out the back at the waist
        for s in (-1, 1):
            box(s * 0.3, 1.65, 1.0, 0.25, 0.7, 0.55, ORANGE_D, bevel=0.1, segs=2, rot=(0, s * math.radians(30), 0))


if __name__ == "__main__" or True:
    render_costume("reverse-mermaid", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
