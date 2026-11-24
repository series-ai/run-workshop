"""Reverse mermaid: a regular kid from the bottom (bare stub legs, shorts,
sneakers) and a fish from the hips up. A straight-sided rounded-cube
clownfish body (white bands edged black) with the kid's face looking out a
clear window in the middle, a big rounded-cube fish head on top (googly eyes
on the sides, a gaping mouth, a dorsal fin) and the kid's arms ARE the little
pectoral fins. The full bucket hangs off one fin. Pairs with the inflatable
T-rex: same face window, same big head on top."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ORANGE, ORANGE_D, BAND, EDGE = (1.0, 0.47, 0.1), (0.92, 0.36, 0.06), (0.98, 0.98, 0.96), (0.1, 0.08, 0.08)
LIP, MOUTH = (1.0, 0.55, 0.6), (0.4, 0.06, 0.12)
SHORTS, SNEAKER = (0.2, 0.55, 0.9), (0.95, 0.85, 0.15)
WIN, HAIR = (0.72, 0.9, 1.0), (0.3, 0.17, 0.09)


def face_window(cz, fy, frame, w=1.3, h=1.15):
    """The kid's face in a clear rounded-square window on a costume front at y=fy."""
    box(0, fy + 0.02, cz, w + 0.26, 0.2, h + 0.26, frame, bevel=0.2, segs=2)      # the frame
    box(0, fy - 0.04, cz, w, 0.2, h, WIN, bevel=0.16, segs=2)                     # the clear plastic
    box(0, fy - 0.1, cz - 0.04, w * 0.84, 0.2, h * 0.82, SKIN, bevel=0.16, segs=2)  # the kid's face
    box(0, fy - 0.2, cz + h * 0.3, w * 0.78, 0.12, h * 0.2, HAIR, bevel=0.05)      # fringe
    face(0, cz - 0.06, fy - 0.2, 1.4, eye=0.16, gap=0.2)
    box(-w * 0.3, fy - 0.15, cz + h * 0.32, 0.12, 0.04, 0.1, WHITE)               # a glint on the plastic


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
    box(0, 0, HIP + 0.14, TW + 0.15, TD + 0.1, 0.46, SHORTS, bevel=0.08)  # shorts peeking out under the fish
    # the fish body: one straight-sided rounded cube from the hips up (no waist)
    W, D, R = 2.5, 1.9, 0.55
    bz0, bz1 = HIP + 0.42, 3.3
    box(0, 0, (bz0 + bz1) / 2, W, D, bz1 - bz0, ORANGE, bevel=R, segs=3)
    band(1.42, W, D, R)
    fy = -D / 2
    face_window(2.42, fy - 0.02, EDGE)
    # pectoral fins where the arms are: flat rounded paddles, black-tipped, angled down and out
    for s in (-1, 1):
        rot = (0, s * math.radians(35), 0)
        box(s * 1.5, -0.1, 2.1, 0.8, 0.22, 0.5, ORANGE_D, bevel=0.1, segs=2, rot=rot)
        box(s * 1.82, -0.1, 1.88, 0.3, 0.24, 0.52, EDGE, bevel=0.1, segs=2, rot=rot)
    bucket((1.85, -0.12, 1.88), full=True, size=0.62)
    # the big fish head on top: a wide rounded cube, a white band behind the eyes
    hz, HW, HD = bz1 + 1.0, 2.8, 2.1
    box(0, 0, hz, HW, HD, 1.9, ORANGE, bevel=0.62, segs=3)
    band(bz1 + 0.12, W, D, R, h=0.42)
    # the gaping fish mouth on the front: big pouty pink lips, wide open round a dark gap
    my, mz = -HD / 2, hz - 0.22
    box(0, my - 0.05, mz, 1.05, 0.3, 0.5, MOUTH, bevel=0.14, segs=2)                  # the open mouth
    box(0, my - 0.2, mz + 0.34, 1.35, 0.42, 0.3, LIP, bevel=0.13, segs=2)            # top lip
    box(0, my - 0.2, mz - 0.36, 1.2, 0.42, 0.32, LIP, bevel=0.13, segs=2)            # bottom lip
    box(0, my - 0.12, mz - 0.12, 0.55, 0.2, 0.18, (0.95, 0.4, 0.5), bevel=0.06)      # tongue
    for s in (-1, 1):
        box(s * 0.92, my - 0.01, mz + 0.35, 0.28, 0.04, 0.12, CHEEK)  # blush
        # big googly eyes on the sides of the head, bulging out and forward
        ex, ey, ez = s * 1.33, -0.45, hz + 0.45
        ball(ex, ey, ez, 0.85, 0.85, 0.85, WHITE, seg=10, ring=8)
        ball(ex + s * 0.12, ey - 0.33, ez - 0.02, 0.4, 0.18, 0.42, DARK, seg=8, ring=6)
        ball(ex + s * 0.06, ey - 0.43, ez + 0.08, 0.11, 0.06, 0.11, WHITE, seg=6, ring=4)
    # the dorsal fin: a chunky rounded sail on top, swept back, black-edged
    rx = (math.radians(-22), 0, 0)
    box(0, 0.45, hz + 0.95, 0.3, 1.25, 0.62, EDGE, bevel=0.14, segs=2, rot=rx)
    box(0, 0.38, hz + 0.9, 0.36, 1.1, 0.55, ORANGE_D, bevel=0.14, segs=2, rot=rx)

if __name__ == "__main__" or True:
    run({"reverse-mermaid": build})
