"""Grey alien: a huge rounded-cube alien mask over the kid's head, swelling
wider and bulging forward towards the top like a giant cranium, with two
giant glossy black almond eyes slanting up on its forehead. The kid's own
full-size face looks out of a big opening below them. A plain grey suit with a darker
belt and a silver chest badge, grey boots, and the kid's mitts: one does a
little wave, the other carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREY, GREY_D, GREY_L, SUIT, SUIT_D = (0.7, 0.76, 0.8), (0.5, 0.55, 0.6), (0.82, 0.84, 0.88), (0.58, 0.6, 0.66), (0.4, 0.42, 0.48)
SILVER, HAIR, GLOSS = (0.88, 0.9, 0.95), (0.3, 0.17, 0.09), (0.04, 0.04, 0.06)
X90 = (math.radians(90), 0, 0)


def wedge(pts_f, pts_b, rgb, bevel=0.0, segs=2):
    """A solid from a front polygon and a back polygon (same vertex count)."""
    import bmesh
    me = bpy.data.meshes.new("w")
    bm = bmesh.new()
    vf = [bm.verts.new(p) for p in pts_f]
    vb = [bm.verts.new(p) for p in pts_b]
    n = len(vf)
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vf[j], vf[i], vb[i], vb[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("w", me)
    bpy.context.scene.collection.objects.link(o)
    finish(o, rgb, bevel, segs)
    if bevel:
        o.modifiers["b"].limit_method = "ANGLE"
    return o


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=SUIT_D, sleeve=SUIT)
    fy = -TD * 0.5
    with part("body"):
        box(0, 0, HIP + 0.22, TW + 0.06, TD + 0.06, 0.13, SUIT_D, bevel=0.03)          # belt
    with part("chest"):
        box(0, fy - 0.03, HIP + 0.58, 0.32, 0.06, 0.26, SILVER, bevel=0.05)              # chest badge
        ball(0, fy - 0.07, HIP + 0.58, 0.16, 0.04, 0.12, (0.4, 0.9, 0.5), seg=8, ring=4)
    lh = hand_points()[-1]
    bucket(lh, full=False, size=0.62)
    with part("head"):
        # the kid's own head at the standard spot
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
        # the grey alien mask: a huge rounded cube that swells wider and bulges
        # forward towards the top (the big cranium), enclosing the kid's head
        z0, z1 = 1.6, 5.15
        wb, wt = 1.42, 2.2                        # half widths at the bottom and top
        yfb, yft, ybb, ybt = -1.27, -1.6, 1.3, 1.75
        front = [(-wb, yfb, z0), (wb, yfb, z0), (wt, yft, z1), (-wt, yft, z1)]
        back = [(-wb, ybb, z0), (wb, ybb, z0), (wt, ybt, z1), (-wt, ybt, z1)]
        mask = wedge(front, back, GREY)
        bv = mask.modifiers.new("b", "BEVEL")
        bv.width, bv.segments, bv.limit_method = 0.75, 4, "ANGLE"
        # the face opening: the kid's whole face looks out of it
        oz, ow, oh = HEAD_Z - 0.32, HEAD * 0.9, 1.5
        cutter = box(0, -2.05, oz, ow, 2.3, oh, GREY_D, bevel=0.5, segs=3)
        m = mask.modifiers.new("cut", "BOOLEAN")
        m.object, m.operation, m.material_mode = cutter, "DIFFERENCE", "TRANSFER"
        cutter.hide_render = True
        # giant glossy black almond eyes, slanting up and out on the cranium's front
        def fy(z):
            return yfb + (yft - yfb) * (z - z0) / (z1 - z0)
        for s in (-1, 1):
            ex, ez = s * 0.95, 4.05
            ball(ex, fy(ez) + 0.06, ez, 1.55, 0.36, 0.86, GLOSS, seg=16, ring=8, rot=(0, s * math.radians(-27), 0))
            ball(ex - s * 0.2, fy(ez) - 0.12, ez + 0.16, 0.36, 0.06, 0.2, WHITE, seg=8, ring=4, rot=(0, s * math.radians(-27), 0))
            ball(ex + s * 0.32, fy(ez) - 0.1, ez - 0.16, 0.12, 0.05, 0.1, WHITE, seg=6, ring=4)
        # a little seam of a mouth line under the opening and two nostril dots above it
        for s in (-1, 1):
            box(s * 0.1, fy(3.45) - 0.02, 3.45, 0.06, 0.04, 0.09, GREY_D)


if __name__ == "__main__" or True:
    run({"alien-grey": build})
