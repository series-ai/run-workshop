"""Props any costume can carry: the pumpkin candy bucket, empty or full.
`bucket(at, full)` draws it hanging from a mitten: `at` is the mitten centre
(see bobble.hand_points); the handle loops over the mitten."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
from bobble import *  # noqa: F401,F403

PUMPKIN, PUMPKIN_D, FACE_IN = (1.0, 0.50, 0.08), (0.85, 0.36, 0.05), (0.18, 0.08, 0.04)
CANDY = [(0.95, 0.25, 0.35), (0.35, 0.75, 0.95), (1.0, 0.85, 0.2), (0.6, 0.35, 0.9), (0.4, 0.85, 0.45), (1.0, 1.0, 1.0)]


def mount(build, at, tilt=(0.0, 0.0, 0.0)):
    """Build a prop around its own grip point (the origin, where the mitten holds
    it), then turn it by `tilt` (degrees about x, y, z) and put the grip at `at`
    (the mitten centre). Returns the prop's objects."""
    from mathutils import Euler, Matrix
    before = set(bpy.data.objects)
    with part("prop"):  # a held prop moves as one piece, from the mitt it is mounted in
        build()
    objs = [o for o in bpy.data.objects if o not in before]
    M = Matrix.Translation(at) @ Euler(tuple(math.radians(a) for a in tilt), "XYZ").to_matrix().to_4x4()
    for o in objs:
        o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()
    return objs


STICK, STRAW, STRAW_D, TIE = (0.55, 0.36, 0.2), (0.98, 0.8, 0.36), (0.86, 0.62, 0.22), (0.86, 0.2, 0.25)


def broom():
    """A straw broom around its grip: the stick runs along +z, the grip a third of
    the way up; the bristles at the bottom, tied with a red band."""
    limb((0, 0, -0.75), (0, 0, 1.55), 0.07, STICK)
    can(0, 0, -1.08, 0.38, 0.66, STRAW, n=8, r2=0.13)
    for k in range(8):
        a = 2 * math.pi * k / 8
        box(0.32 * math.cos(a), 0.32 * math.sin(a), -1.36, 0.06, 0.06, 0.2, STRAW_D, rot=(0, 0, a))
    can(0, 0, -0.8, 0.16, 0.1, TIE, n=8)


def bucket(at, full=False, size=0.9):
    """A jack-o'-lantern bucket hanging from `at` (the mitten centre). It is one held prop."""
    with part("prop"):
        _bucket(at, full, size)


def _bucket(at, full, size):
    before = set(bpy.data.objects)
    _bucket_parts(at, full, size)
    for o in set(bpy.data.objects) - before:
        o["bucket"] = True  # the rig hangs every bucket piece on one switch, so a game can hide it


def _bucket_parts(at, full, size):
    x, y, z = at
    top = z - MITT * 0.62   # the rim, just under the mitten
    h = size * 0.85
    cz = top - h * 0.5
    # a squat pumpkin: two frustums, wide in the middle
    can(x, y, cz - h * 0.22, size * 0.5, h * 0.44, PUMPKIN, n=8, r2=size * 0.6)
    can(x, y, cz + h * 0.2, size * 0.6, h * 0.4, PUMPKIN, n=8, r2=size * 0.5)
    can(x, y, top - 0.02, size * 0.5, 0.06, PUMPKIN_D, n=8)  # the rim
    # the carved face on the front: triangle eyes and a toothy grin
    fy = y - size * 0.6 * math.cos(math.pi / 8) - 0.02
    for s in (-1, 1):
        can(x + s * size * 0.2, fy, cz + h * 0.12, size * 0.12, 0.05, FACE_IN, n=3, rot=(math.radians(90), 0, 0))
    box(x, fy, cz - h * 0.16, size * 0.5, 0.05, size * 0.12, FACE_IN)
    for s in (-1, 1):
        box(x + s * size * 0.1, fy - 0.01, cz - h * 0.12, size * 0.08, 0.05, size * 0.06, PUMPKIN)
    # a short black handle: two uprights from the rim to a bar that sits inside the mitten (the grip)
    hr = 0.05
    for s in (-1, 1):
        limb((x + s * size * 0.42, y, top), (x + s * 0.12, y, z), hr, (0.1, 0.1, 0.1))
    limb((x - 0.12, y, z), (x + 0.12, y, z), hr, (0.1, 0.1, 0.1))
    if full:
        # an abstract mound of candy: a few chunky squashed lumps in candy colours, low over the rim,
        # and one lolly poking out (a handful of pieces instead of a pile of separate sweets)
        lumps = ((0.0, 0.0, 0.62, 0.30), (-0.2, -0.1, 0.42, 0.24), (0.2, 0.08, 0.44, 0.24), (0.04, -0.2, 0.36, 0.22))
        for k, (dx, dy, r, h) in enumerate(lumps):
            ball(x + dx * size, y + dy * size, top + 0.04 + h * size * 0.4, r * size, r * size * 0.95, h * size,
                 CANDY[k % len(CANDY)], seg=8, ring=5)
        limb((x + 0.12 * size, y, top + 0.1), (x + 0.16 * size, y, top + 0.26), 0.025, (1, 1, 1))  # the lolly stick
        can(x + 0.16 * size, y, top + 0.32, 0.12, 0.05, CANDY[-1], n=8, rot=(math.radians(90), 0, 0))
