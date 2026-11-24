"""Pizza slice: the kid's whole head inside a giant slice standing on its
crust, the point shooting way up over the head. A puffy golden crust bar
across the bottom like a big collar, a red sauce edge, gooey cheese with
drips off the sides, pepperoni and green pepper bits; the kid's standard
face looks out of a big opening in the cheese. Mitts poke out under the
crust, the right one with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import _bucket
import bmesh  # noqa: E402

CHEESE, CHEESE_D, SAUCE, CRUST, CRUST_D, BREAD = (1.0, 0.84, 0.3), (0.96, 0.66, 0.18), (0.9, 0.2, 0.12), (0.88, 0.58, 0.25), (0.72, 0.42, 0.16), (0.92, 0.66, 0.36)
PEP, PEP_D, GREENP = (0.82, 0.15, 0.12), (0.62, 0.08, 0.08), (0.25, 0.65, 0.2)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)
BASEZ, TIPZ, HW = 1.55, 7.0, 2.7


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


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.86, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def wedge(inset):
    return [(-HW + inset, BASEZ), (HW - inset, BASEZ), (0, TIPZ - inset * 2.1)]


def half_w(z):
    return HW * (TIPZ - z) / (TIPZ - BASEZ)


def build():
    body(shirt=SAUCE, pants=SAUCE, leg_colour=(0.95, 0.95, 0.95), shoe=(0.2, 0.55, 0.3), arms=False)
    kid_head(hair=HAIR)
    # the slice is the costume body round the head: every layer, drip, topping and the crust move as one
    with part("body"):
        # the slice: bread behind, a sauce edge, the cheese on the front, all with the face opening
        for o in (prism(wedge(0.0), -1.25, 1.7, BREAD, bevel=0.14),
                  prism(wedge(0.08), -1.36, -1.2, SAUCE, bevel=0.04),
                  prism(wedge(0.2), -1.46, -1.3, CHEESE, bevel=0.06)):
            cut(o, opening())
        rim = box(0, -1.2, HEAD_Z - HEAD * 0.06, HEAD * 0.86 + 0.3, 0.6, HEAD * 0.78 + 0.3, CHEESE_D, bevel=0.29, segs=3)
        cut(rim, opening(back=0.5))
        with part("head"):
            box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
        # cheese drips off the sloped edges
        for z, s, h in ((5.2, -1, 0.7), (4.4, 1, 0.6), (5.8, 1, 0.45), (3.3, -1, 0.5), (2.6, 1, 0.55)):
            x = s * (half_w(z) - 0.12)
            ball(x, -1.4, z - h * 0.35, 0.36, 0.16, h, CHEESE, seg=6, ring=4)
            ball(x, -1.4, z - h * 0.8, 0.3, 0.16, 0.3, CHEESE, seg=6, ring=4)
        # the crust: a puffy golden bar along the bottom
        box(0, 0.2, BASEZ - 0.05, HW * 2 + 0.5, 3.2, 0.8, CRUST, bevel=0.38, segs=3)
        for x in (-1.8, -0.9, 0.0, 0.9, 1.8):
            box(x, -1.4, BASEZ - 0.02, 0.36, 0.05, 0.09, CRUST_D, rot=(0, 0.3, 0))
        # pepperoni and green pepper bits, clear of the face
        for x, z, r in ((0.0, 5.75, 0.38), (-0.55, 4.6, 0.3), (0.62, 4.75, 0.33), (-1.85, 2.1, 0.3), (1.85, 2.15, 0.32), (0.05, 6.55, 0.2)):
            can(x, -1.5, z, r, 0.08, PEP, n=10, rot=X90)
            can(x - r * 0.3, -1.55, z + r * 0.25, r * 0.18, 0.04, PEP_D, n=6, rot=X90)
            can(x + r * 0.35, -1.55, z - r * 0.2, r * 0.13, 0.04, PEP_D, n=6, rot=X90)
        for x, z, a in ((-0.35, 5.4, 0.4), (0.4, 6.15, -0.3), (0.05, 4.35, 1.0), (-1.55, 2.85, 1.2), (1.5, 2.9, -0.6)):
            box(x, -1.5, z, 0.32, 0.05, 0.1, GREENP, rot=(0, a, 0))
    # mitts out under the crust; the right one holds the bucket. The crust is right over them, so
    # the arms, mitts and bucket ride the slice as one rigid block (a swinging arm would go up through the crust)
    with part("body"):
        lh = (-1.9, -0.9, 0.85)
        limb((-0.6, -0.3, 1.1), lh, 0.12, SAUCE)
        hand_mitt(*lh, -1, MITT, SKIN)
        rh = (1.95, -0.95, 0.95)
        limb((0.6, -0.3, 1.1), rh, 0.12, SAUCE)
        hand_mitt(*rh, 1, MITT, SKIN)
        _bucket(rh, True, 0.66)

if __name__ == "__main__" or True:
    render_costume("pizza-slice", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
