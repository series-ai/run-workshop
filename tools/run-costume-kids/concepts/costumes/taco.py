"""Taco: the kid zipped into a giant crunchy taco shell standing on its fold,
the big U seen from the front, fat enough to swallow the kid's whole head.
The kid's standard face (fringe and all) looks out of a big opening in the
front shell; lettuce frills, tomato cubes, cheese shreds and a meat mound
burst out of the top as a wild crown. Mitts out the sides, the right one
with the full bucket, tiny shoes underneath."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
import bmesh  # noqa: E402

SHELL, SHELL_D, SHELL_IN, TOAST = (1.0, 0.8, 0.3), (0.86, 0.6, 0.18), (0.96, 0.7, 0.25), (0.8, 0.5, 0.15)
LETTUCE, LETTUCE_D, TOMATO, CHEESE, MEAT = (0.5, 0.85, 0.25), (0.35, 0.7, 0.18), (0.92, 0.18, 0.15), (1.0, 0.68, 0.1), (0.5, 0.28, 0.15)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
ZT, RX, RZ = 4.6, 2.55, 4.2
YF, YB = -1.45, 1.4          # the front and back of the shell


def prism(pts, y0, y1, rgb, bevel=0.0, segs=2):
    """Extrude a convex outline [(x, z)] between y0 and y1."""
    me = bpy.data.meshes.new("p")
    n = len(pts)
    v = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me.from_pydata(v, [], f)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("p", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat(rgb))
    if bevel:
        b = o.modifiers.new("b", "BEVEL")
        b.width, b.segments, b.limit_method = bevel, segs, "ANGLE"
        b.use_clamp_overlap = False
    return o


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


OPEN_DROP = 0.1  # the opening's floor sits this far below the head's flat bottom (not on it: that flickered)


def opening(grow=0.0, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face, `grow` bigger all round."""
    w, h = HEAD * 0.86 + 2 * grow, HEAD * 0.78 + OPEN_DROP + 2 * grow
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06 - OPEN_DROP / 2, w, back - front, h, WHITE, bevel=bevel, segs=3)


def half_moon(rx, rz, zt, n=16):
    return [(rx * math.cos(math.pi * k / n), zt - rz * math.sin(math.pi * k / n)) for k in range(n + 1)]


def build():
    body(leg_colour=(0.2, 0.3, 0.6), shoe=(0.9, 0.2, 0.2), torso=False, arms=False)
    kid_head(hair=HAIR)
    with part("head"):
        box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
    with part("body"):  # the shell and its filling are one rigid suit
        shell_and_filling()
    # mitts out the sides of the shell; the right one holds the bucket
    lh = (-2.35, -0.6, 1.3)
    with part("hand.r"):  # the sleeve stub and mitt flap together from the shell
        limb((-1.6, -0.4, 1.4), lh, 0.12, SHELL_D)
        hand_mitt(*lh, -1, MITT, SKIN)
    rh = (2.4, -0.65, 1.45)
    with part("hand.l"):
        limb((1.6, -0.4, 1.5), rh, 0.12, SHELL_D)
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


def shell_and_filling():
    rnd = random.Random(3)
    # the shell: one fat U, the front with the face opening, a darker lip round it
    shell = prism(half_moon(RX, RZ, ZT), YF, YB, SHELL, bevel=0.12)
    # the shell's hole is a little bigger than the lip's, so the walls of the
    # opening are the lip's alone (the same cutter twice made coplanar walls
    # that flickered round the face); the lip runs right back to the pocket's
    # back wall so none of the shell's own wall shows behind it
    cut(shell, opening(grow=0.05))
    lip = box(0, (YF - 0.13 - 0.64) / 2, HEAD_Z - HEAD * 0.06, HEAD * 0.86 + 0.36, -0.64 - (YF - 0.13), HEAD * 0.78 + 0.36, SHELL_D, bevel=0.29, segs=2)
    cut(lip, opening(back=0.0))
    # the inside of the fold shows at the top as a darker strip
    box(0, 0, ZT - 0.02, RX * 2 - 0.3, YB - YF - 0.3, 0.1, SHELL_IN)
    # toasty spots on the front shell, clear of the face
    for x, z in ((-1.75, 4.25), (1.7, 4.1), (-1.6, 1.55), (1.45, 1.35), (0.2, 0.75), (-0.6, 1.0), (2.05, 3.0), (-2.1, 3.05), (0.9, 4.35)):
        can(x, YF - 0.02, z, rnd.uniform(0.1, 0.16), 0.04, TOAST, n=6, rot=X90)
    # the filling bursting out of the top: meat mound, lettuce frills, tomato, cheese
    dome = lambda x: max(0.0, 1 - (x / 2.5) ** 2)
    for i in range(9):
        x = -2.0 + i * 0.5
        ball(x, rnd.uniform(-0.3, 0.3), ZT + 0.12 + dome(x) * 0.5, 0.85, 1.7, 0.7 + dome(x) * 0.9, MEAT, seg=6, ring=4)
    for y in (YF + 0.3, YB - 0.3, -0.45, 0.45):
        for i in range(11):
            x = -2.35 + i * 0.47
            c = LETTUCE if (i + (y > 0)) % 2 else LETTUCE_D
            h = 0.6 + 0.25 * ((i * 7) % 3) / 2 + dome(x) * (1.0 if abs(y) < 0.5 else 0.5)
            box(x, y, ZT + 0.2 + h * 0.4, 0.62, 0.32, h, c, rot=(rnd.uniform(-0.45, 0.45), rnd.uniform(-0.5, 0.5), 0))
    # big lettuce leaves flopping out over the sides
    for s in (-1, 1):
        for k, (z, a) in enumerate(((ZT + 0.35, 55), (ZT + 0.75, 35))):
            box(s * (RX + 0.05 + 0.15 * k), -0.2 + 0.5 * k, z, 0.95, 0.35, 0.55, LETTUCE if k else LETTUCE_D, bevel=0.12, rot=(0, s * math.radians(a), 0))
    for i in range(9):
        x = -2.0 + i * 0.5 + rnd.uniform(-0.1, 0.1)
        box(x, rnd.uniform(-0.9, 0.7), ZT + 0.75 + dome(x) * 1.1, 0.46, 0.46, 0.34, TOMATO, rot=(0, 0, rnd.uniform(0, 1.5)))
    for i in range(18):
        x = rnd.uniform(-2.2, 2.2)
        box(x, rnd.uniform(-0.9, 0.9), ZT + 0.75 + dome(x) * 1.05 + rnd.uniform(0, 0.12), 0.55, 0.11, 0.11, CHEESE, rot=(0, rnd.uniform(-0.4, 0.4), rnd.uniform(0, 3.1)))


if __name__ == "__main__" or True:
    render_costume("taco", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
