"""Pizza slice: the kid as a giant slice, point down so the whole wedge
balances on two stub legs. A puffy golden crust bar across the top, a red
sauce edge, gooey cheese with drips, pepperoni and green pepper bits; the
kid's face peeks out a hole in the cheese. Mitts poke out the sides, one
with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
import bmesh  # noqa: E402

CHEESE, CHEESE_D, SAUCE, CRUST, CRUST_D, BREAD = (1.0, 0.84, 0.3), (0.96, 0.66, 0.18), (0.9, 0.2, 0.12), (0.88, 0.58, 0.25), (0.72, 0.42, 0.16), (0.98, 0.82, 0.55)
PEP, PEP_D, GREENP = (0.82, 0.15, 0.12), (0.62, 0.08, 0.08), (0.25, 0.65, 0.2)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
TOPZ, TIPZ, HW = 4.45, 0.8, 1.95


def prism(pts, y0, y1, rgb, bevel=0.0, segs=2):
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


def wedge(inset, tipz=TIPZ):
    return [(-HW + inset, TOPZ), (HW - inset, TOPZ), (0, tipz + inset * 1.9)]


def half_w(z):
    return HW * (z - TIPZ) / (TOPZ - TIPZ)


def build():
    body(leg_colour=(0.95, 0.95, 0.95), shoe=(0.2, 0.55, 0.3), torso=False, arms=False)
    limb((-TW * 0.24, 0.0, HIP - 0.05), (-TW * 0.24, 0.0, 1.5), 0.11, (0.95, 0.95, 0.95))
    limb((TW * 0.24, 0.0, HIP - 0.05), (TW * 0.24, 0.0, 1.5), 0.11, (0.95, 0.95, 0.95))
    # the slice: bread underneath, a sauce edge, the cheese on the front
    prism(wedge(0.0), -0.3, 0.42, BREAD, bevel=0.12)
    prism(wedge(0.06), -0.38, -0.25, SAUCE, bevel=0.03)
    prism(wedge(0.16), -0.46, -0.3, CHEESE, bevel=0.06)
    # cheese drips down the edges and off the tip
    for z, s, h in ((3.4, -1, 0.5), (2.2, 1, 0.42), (3.7, 1, 0.34), (1.6, -1, 0.36)):
        x = s * (half_w(z) - 0.25)
        ball(x, -0.47, z - h * 0.3, 0.26, 0.1, h, CHEESE, seg=8, ring=5)
    ball(0, -0.4, TIPZ + 0.2, 0.22, 0.14, 0.42, CHEESE, seg=8, ring=5)
    # the crust: a puffy golden bar along the top
    box(0, 0.05, TOPZ + 0.1, 4.2, 1.0, 0.62, CRUST, bevel=0.29, segs=3)
    for x in (-1.3, -0.4, 0.5, 1.4):
        box(x, -0.46, TOPZ + 0.12, 0.3, 0.04, 0.08, CRUST_D, rot=(0, 0.3, 0))
    # pepperoni and green pepper bits, clear of the face
    for x, z, r in ((-1.15, 3.9, 0.32), (1.1, 3.85, 0.3), (-0.42, 1.85, 0.24), (0.5, 2.05, 0.22), (0.0, 1.35, 0.16)):
        can(x, -0.5, z, r, 0.08, PEP, n=12, rot=X90)
        can(x - r * 0.3, -0.55, z + r * 0.25, r * 0.18, 0.04, PEP_D, n=6, rot=X90)
        can(x + r * 0.35, -0.55, z - r * 0.2, r * 0.13, 0.04, PEP_D, n=6, rot=X90)
    for x, z, a in ((-1.45, 4.05, 0.4), (0.0, 4.05, -0.3), (1.5, 4.0, 1.0), (-0.95, 2.6, 1.2), (0.95, 2.7, -0.6)):
        box(x, -0.5, z, 0.26, 0.05, 0.08, GREENP, rot=(0, a, 0))
    # the face hole in the cheese
    fz, fy = 3.05, -0.46
    can(0, fy, fz, 0.8, 0.2, CHEESE_D, n=12, rot=X90)
    can(0, fy - 0.05, fz, 0.68, 0.2, SKIN, n=12, rot=X90)
    box(0, fy - 0.16, fz + 0.43, 0.86, 0.1, 0.2, HAIR, bevel=0.04)
    face(0, fz + 0.04, fy - 0.15, 1.36, eye=0.16, gap=0.2)
    # mitts out the sides; the right one holds the bucket
    lh = (-1.5, -0.2, 2.2)
    limb((-0.8, 0, 2.5), lh, 0.12, CRUST)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.55, -0.25, 2.3)
    limb((0.8, 0, 2.55), rh, 0.12, CRUST)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.66)


if __name__ == "__main__" or True:
    run({"pizza-slice": build})
