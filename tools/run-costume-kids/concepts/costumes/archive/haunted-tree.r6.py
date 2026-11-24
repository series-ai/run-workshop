"""Haunted tree: the kid inside a fat tree-trunk suit, head and all, with
bark ridges and the kid's standard face looking out of a big knot-hole
opening. Above it two carved spooky-cute eye-holes with bark brows make the
tree's own face; out of the top a huge crown of crooked bare branches
spreads way past the head, with twigs, a few autumn leaves and a little owl
perched on top. Branch arms with the kid's mitts at the ends (the left
dangles the full bucket), chunky roots round the shoes."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

BARK, BARK_D, BARK_L, HOLE = (0.56, 0.37, 0.22), (0.40, 0.25, 0.14), (0.70, 0.50, 0.32), (0.16, 0.09, 0.06)
LEAF = [(1.0, 0.52, 0.10), (0.92, 0.25, 0.15), (1.0, 0.78, 0.18)]
OWL, OWL_BELLY, OWL_EYE, BEAK = (0.62, 0.48, 0.38), (0.94, 0.86, 0.70), (1.0, 0.82, 0.2), (1.0, 0.6, 0.12)
HAIR = (0.3, 0.17, 0.09)


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.88, h=HEAD * 0.8, back=-0.6, front=-3.0, bevel=0.55):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def disc(x, y, z, w, h, d, rgb, n=16):
    """A flat oval disc facing -y: w wide, h tall, d deep."""
    o = can(x, y, z, 0.5, d, rgb, n=n, rot=(math.radians(90), 0, 0))
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.scale = (w, 1, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def leaf(x, y, z, k, a=0.0):
    box(x, y, z, 0.46, 0.08, 0.3, LEAF[k % 3], bevel=0.04, rot=(math.radians(20), a, math.radians(30 * k)))


def branch(pts, r0, r1):
    """A crooked branch through pts, tapering from r0 to r1, knuckles at the bends."""
    n = len(pts) - 1
    for i in range(n):
        ra = r0 + (r1 - r0) * i / n
        rb = r0 + (r1 - r0) * (i + 1) / n
        bar(pts[i], pts[i + 1], ra, rb, BARK, n=6)
        if i + 1 < n:
            ball(*pts[i + 1], rb * 2.1, rb * 2.1, rb * 2.1, BARK, seg=6, ring=4)


def owl(x, y, z):
    """A little owl perched at (x, y, z) (its feet)."""
    ball(x, y, z + 0.32, 0.6, 0.52, 0.66, OWL, seg=8, ring=6)
    ball(x, y - 0.2, z + 0.26, 0.38, 0.16, 0.44, OWL_BELLY, seg=8, ring=5)
    box(x, y - 0.02, z + 0.78, 0.6, 0.5, 0.44, OWL, bevel=0.14, segs=2)
    for s in (-1, 1):
        can(x + s * 0.14, y - 0.27, z + 0.8, 0.13, 0.05, OWL_EYE, n=10, rot=(math.radians(90), 0, 0))
        can(x + s * 0.14, y - 0.3, z + 0.8, 0.07, 0.04, DARK, n=8, rot=(math.radians(90), 0, 0))
        can(x + s * 0.12, y - 0.33, z + 0.83, 0.025, 0.03, WHITE, n=6, rot=(math.radians(90), 0, 0))
        can(x + s * 0.22, y, z + 1.05, 0.09, 0.22, OWL, n=4, r2=0.0, rot=(0, s * math.radians(-20), math.radians(45)))
        box(x + s * 0.3, y + 0.02, z + 0.3, 0.12, 0.36, 0.42, (0.5, 0.38, 0.3), bevel=0.05)  # wings
        box(x + s * 0.09, y - 0.12, z + 0.02, 0.1, 0.16, 0.05, BEAK)                          # feet
    can(x, y - 0.3, z + 0.68, 0.06, 0.14, BEAK, n=4, r2=0.0, rot=(math.radians(180), 0, 0))


def build():
    body(pants=BARK_D, leg_colour=BARK_D, shoe=(0.30, 0.55, 0.25), torso=False, arms=False)
    kid_head(hair=HAIR)
    # the trunk, head and all, with the knot-hole face opening
    R, z0, z1 = 1.84, 0.55, 4.95
    rz = math.radians(22.5)
    cut(can(0, 0.1, (z0 + z1) / 2, R, z1 - z0, BARK, n=8, rot=(0, 0, rz)), opening())
    can(0, 0, z0 + 0.12, R + 0.08, 0.24, BARK_D, n=8, rot=(0, 0, rz))
    fy = 0.1 - R * math.cos(rz)
    fz = HEAD_Z - HEAD * 0.06
    rim = disc(0, fy + 0.3, fz, HEAD * 0.88 + 0.55, HEAD * 0.8 + 0.5, 0.75, BARK_L, n=16)
    cut(rim, opening(back=0.5))
    box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.72, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
    # bark ridges on the faces (skipping the front where the face is)
    for k in range(8):
        a = math.radians(-90 + 45 * k)
        ap = R * math.cos(rz)
        for j, dx in enumerate((-0.35, 0.3)):
            if k == 0:
                dx = dx * 4.2
            x = ap * math.cos(a) - dx * math.sin(a)
            y = ap * math.sin(a) + dx * math.cos(a)
            hz = 1.6 + 0.6 * ((k + j) % 3)
            box(x, y, z0 + 0.25 + hz / 2, 0.14, 0.14, hz, BARK_D, rot=(0, 0, a + math.pi / 2))
    # roots spreading over the ground around the shoes
    for a in (-150, -30, 30, 90, 150, 210):
        r = math.radians(a)
        bar((R * 0.8 * math.cos(r), R * 0.8 * math.sin(r), z0 + 0.25), (2.25 * math.cos(r), 2.25 * math.sin(r), 0.1), 0.36, 0.14, BARK, n=6)
        ball(2.25 * math.cos(r), 2.25 * math.sin(r), 0.1, 0.3, 0.3, 0.2, BARK, seg=6, ring=4)
    # the tree's own spooky-cute face above the kid's: carved eye-holes and bark brows
    ez = 4.47
    for s in (-1, 1):
        disc(s * 0.62, fy - 0.03, ez, 0.46, 0.48, 0.1, BARK_D, n=10)
        disc(s * 0.62, fy - 0.06, ez - 0.02, 0.34, 0.36, 0.1, HOLE, n=10)
        disc(s * 0.56, fy - 0.1, ez + 0.05, 0.1, 0.1, 0.04, WHITE, n=6)
        box(s * 0.64, fy - 0.04, ez + 0.3, 0.5, 0.1, 0.12, BARK_D, rot=(0, s * math.radians(-16), 0))
    # the broken top: a dark hollow ringed by bark spikes
    can(0, 0, z1 - 0.02, R * 0.85, 0.06, HOLE, n=8, rot=(0, 0, rz))
    for k, h in enumerate((0.55, 0.3, 0.7, 0.35, 0.5, 0.28, 0.62, 0.4)):
        a = 2 * math.pi * k / 8
        can(R * 0.9 * math.cos(a), R * 0.9 * math.sin(a), z1 + h / 2 - 0.02, 0.3, h, BARK, n=4, r2=0.0, rot=(0, 0, a))
    # the huge crown of crooked bare branches
    crown = [
        [(-1.1, 0.2, z1 - 0.3), (-2.0, 0.1, z1 + 0.29), (-2.35, 0.0, z1 + 0.98), (-3.05, -0.1, z1 + 1.27)],
        [(1.1, 0.2, z1 - 0.3), (2.0, 0.15, z1 + 0.20), (2.55, 0.05, z1 + 0.78), (3.2, 0.0, z1 + 0.86)],
        [(-0.5, 0.3, z1), (-0.85, 0.3, z1 + 0.74), (-0.6, 0.25, z1 + 1.35), (-1.0, 0.2, z1 + 1.60)],
        [(0.6, 0.4, z1), (1.05, 0.4, z1 + 0.70), (1.6, 0.35, z1 + 1.27), (1.45, 0.3, z1 + 1.60)],
    ]
    for pts in crown:
        branch(pts, 0.36, 0.1)
    twigs = [((-2.35, 0.0, z1 + 0.98), (-2.2, 0.0, z1 + 1.52)), ((-2.0, 0.1, z1 + 0.29), (-2.8, 0.0, z1 + 0.37)),
             ((2.55, 0.05, z1 + 0.78), (2.65, 0.0, z1 + 1.31)), ((2.0, 0.15, z1 + 0.20), (2.75, 0.1, z1 + 0.00)),
             ((-0.6, 0.25, z1 + 1.35), (-0.2, 0.25, z1 + 1.60)), ((1.6, 0.35, z1 + 1.27), (2.05, 0.3, z1 + 1.52))]
    for a, b in twigs:
        bar(a, b, 0.09, 0.03, BARK)
    for k, (x, y, z) in enumerate(((-3.05, -0.15, z1 + 1.31), (-2.2, -0.05, z1 + 1.56), (2.7, -0.05, z1 + 1.35), (3.2, -0.05, z1 + 0.90),
                                   (-1.0, 0.15, z1 + 1.64), (2.05, 0.25, z1 + 1.56), (2.8, 0.05, z1 + 0.00))):
        leaf(x, y, z, k)
    owl(0.0, -0.3, z1)
    # branch arms with twigs and leaves, the kid's mitts at the tips
    rpts = [(1.6, -0.2, 1.8), (2.2, -0.3, 1.95), (2.45, -0.35, 2.55)]
    branch(rpts, 0.24, 0.14)
    bar((2.2, -0.3, 1.95), (2.7, -0.3, 2.15), 0.07, 0.03, BARK)
    leaf(2.7, -0.3, 2.18, 1)
    hand_mitt(2.48, -0.37, 2.75, 1, MITT, SKIN)
    lpts = [(-1.6, -0.2, 1.8), (-2.15, -0.3, 1.75), (-2.35, -0.42, 1.45)]
    branch(lpts, 0.24, 0.14)
    bar((-2.15, -0.3, 1.75), (-2.45, -0.25, 2.25), 0.07, 0.03, BARK)
    leaf(-2.46, -0.25, 2.3, 2)
    hand_mitt(-2.38, -0.45, 1.3, -1, MITT, SKIN)
    bucket((-2.38, -0.45, 1.3), full=True, size=0.6)
    # a couple of leaves stuck on the trunk
    leaf(1.3, fy + 0.45, 3.9, 0)
    leaf(-1.25, fy + 0.45, 1.3, 1)


if __name__ == "__main__" or True:
    render_costume("haunted-tree", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
