"""Rebel jacket: a 90s-movie anarchist parody. A red leather jacket (big
collar, silver zips, shoulder seams) open over a loud yellow printed shirt
with blue and pink blobs, black jeans and boots, slicked-back messy blond
hair with a few spikes, little dark shades and a smirk. A bar of pink soap
held up in the right mitten; the empty bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46          # the face's front plane
CAP_Z = HEAD_Z + HEAD * 0.3
FRONT = -TD * 0.5
SX = TW * 0.5 + 0.08       # shoulder x


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def prism(pts, y0, y1, rgb, bevel=0.04):
    """A flat polygon (x, z points) extruded along y from y0 to y1."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    me = bpy.data.meshes.new("prism")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("prism", me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return finish(o, rgb, bevel)


def arm(s, hand, rgb, r=0.11, mitt=True):
    """An arm from the shoulder on side s to a mitten centred at `hand`."""
    x, y, z = hand
    limb((s * SX, 0, TOP - 0.15), (x - s * 0.02, y + 0.05, z + 0.12), r, rgb)
    if mitt:
        hand_mitt(x, y, z, s, MITT, SKIN)


def head_skin():
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)


def cap(hair, lift=0.0, back=0.0):
    box(0, HEAD * 0.05 + back * 0.5, CAP_Z + lift, HEAD * 1.04, HEAD * 0.98 + back, HEAD * 0.36, hair, bevel=HEAD * 0.14, segs=2)


def shades(rgb=DARK, lens=None, frame=None, w=0.62, h=0.42, y=FY - 0.06, z=HEAD_Z + 0.02, round_=False):
    """Sunglasses over the eyes (they hide the eyes)."""
    for s in (-1, 1):
        if round_:
            can(s * 0.55, y, z, w * 0.5, 0.08, lens or rgb, n=12, rot=(R(90), 0, 0))
        else:
            box(s * 0.55, y, z, w, 0.1, h, lens or rgb, bevel=0.1, segs=2)
    box(0, y, z + 0.08, 0.5, 0.08, 0.08, frame or rgb)
    for s in (-1, 1):
        box(s * 1.2, y + 0.4, z + 0.08, 0.08, 0.9, 0.08, frame or rgb)

JACKET, JACKET_D, SHIRT, PRINT1, PRINT2, PRINT3 = (0.82, 0.12, 0.12), (0.58, 0.06, 0.08), (1.0, 0.86, 0.22), (0.20, 0.45, 0.95), (1.0, 0.40, 0.65), (0.12, 0.12, 0.14)
JEANS, BOOT, ZIP, HAIR, HAIR_D = (0.14, 0.14, 0.18), (0.10, 0.08, 0.08), (0.80, 0.82, 0.86), (0.98, 0.84, 0.42), (0.85, 0.66, 0.28)
SOAP, SOAP_L = (1.0, 0.55, 0.72), (1.0, 0.78, 0.86)


def tilt(objs, at, deg):
    """Turn objs about the y axis through `at` (positive leans their tops towards +x)."""
    from mathutils import Matrix
    M = Matrix.Translation(at) @ Matrix.Rotation(math.radians(deg), 4, "Y") @ Matrix.Translation([-v for v in at])
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def build():
    body(shirt=SHIRT, pants=JEANS, shoe=BOOT, arms=False)
    fy = FRONT - 0.02
    with part("chest"):  # the printed shirt and the whole jacket on it
        # the loud printed shirt: blobs on the front panel
        for x, z, c, r in ((0.0, TOP - 0.2, PRINT1, 0.1), (-0.05, HIP + 0.45, PRINT2, 0.11), (0.08, HIP + 0.65, PRINT3, 0.06), (0.1, TOP - 0.42, PRINT2, 0.07), (-0.08, HIP + 0.28, PRINT1, 0.07)):
            ball(x, fy - 0.01, z, r * 2, 0.05, r * 2, c, seg=6, ring=4)
        # shirt collar points
        for s in (-1, 1):
            prism([(s * 0.04, TOP + 0.02), (s * 0.24, TOP + 0.02), (s * 0.16, TOP - 0.2)], fy - 0.06, fy + 0.04, SHIRT, bevel=0.01)
        # the red leather jacket: back and sides, open front panels, a big collar
        cz = HIP + TH * 0.6
        box(0, 0.07, cz, TW + 0.12, TD, TH * 0.86, JACKET, bevel=0.08)
        for s in (-1, 1):
            box(s * (TW * 0.5 - 0.1), fy - 0.03, cz, 0.3, 0.14, TH * 0.86, JACKET, bevel=0.04)
            box(s * (TW * 0.5 - 0.22), fy - 0.11, cz - 0.05, 0.03, 0.03, TH * 0.6, ZIP)  # zip tracks
            box(s * 0.32, fy - 0.05, TOP - 0.12, 0.26, 0.1, 0.5, JACKET_D, bevel=0.03, rot=(0, s * R(-28), 0))  # lapels
            box(s * 0.3, fy - 0.12, HIP + 0.55, 0.2, 0.03, 0.03, ZIP)  # a chest zip pocket
        box(0, 0.25, TOP + 0.1, TW * 0.9, 0.3, 0.3, JACKET_D, bevel=0.06)  # the collar up at the back
        box(0, 0, HIP + 0.14, TW + 0.14, TD + 0.08, 0.14, JACKET_D, bevel=0.03)  # the waistband
    # right arm: the pink soap bar held up proudly
    rh = (1.3, -0.4, TOP + 0.05)
    with part("arm.l"):
        limb((SX, 0, TOP - 0.15), (rh[0] - 0.1, rh[1] + 0.06, rh[2] - 0.05), 0.13, JACKET)
        bar((rh[0] - 0.3, rh[1] + 0.06, rh[2] - 0.04), (rh[0] - 0.14, rh[1] + 0.03, rh[2] - 0.02), 0.16, 0.16, JACKET_D)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    before = set(bpy.data.objects)
    with part("prop.l"):  # the soap bar, its shine and the suds on it
        box(rh[0] + 0.02, rh[1] - 0.2, rh[2] + 0.32, 0.62, 0.34, 0.34, SOAP, bevel=0.12, segs=2)
        box(rh[0] - 0.1, rh[1] - 0.38, rh[2] + 0.38, 0.18, 0.02, 0.06, SOAP_L)
        for x, z, sz in ((rh[0] + 0.18, rh[2] + 0.55, 0.2), (rh[0] - 0.12, rh[2] + 0.54, 0.16), (rh[0] + 0.04, rh[2] + 0.66, 0.15)):
            ball(x, rh[1] - 0.2, z, sz, sz, sz, (0.88, 0.95, 1.0), seg=8, ring=5)  # suds sitting on the soap (nothing floats)
    tilt(set(bpy.data.objects) - before, rh, 80)  # the soap tips out, clear of the head
    # left arm: the empty bucket
    lh = (-1.15, -0.3, TOP - 0.2)
    with part("arm.r"):
        limb((-SX, 0, TOP - 0.15), (lh[0] + 0.12, lh[1], lh[2] + 0.05), 0.13, JACKET)
        bar((lh[0] + 0.3, lh[1] + 0.03, lh[2] + 0.05), (lh[0] + 0.15, lh[1], lh[2] + 0.05), 0.16, 0.16, JACKET_D)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=False, size=0.6)
    with part("head"):  # the head, its face, shades and all the hair
        # the head: slicked-back messy blond hair, shades, a smirk
        head_skin()
        face(0, HEAD_Z - HEAD * 0.05, FY, HEAD, smile=False)
        my = HEAD_Z - HEAD * 0.05 - HEAD * 0.14
        box(0.05, FY - 0.02, my, HEAD * 0.13, 0.04, HEAD * 0.035, DARK, rot=(0, R(-12), 0))
        box(0.24, FY - 0.02, my + 0.06, HEAD * 0.05, 0.04, HEAD * 0.035, DARK, rot=(0, R(-50), 0))
        shades(PRINT3, w=0.56, h=0.3, z=HEAD_Z + 0.03)
        cap(HAIR, lift=0.12, back=0.15)
        box(0, -0.15, CAP_Z + 0.5, HEAD * 0.9, HEAD * 0.75, 0.35, HAIR, bevel=0.15, segs=2)  # the slicked-back pompadour
        for x, y, h, tx, ty in ((-0.5, 0.0, 0.7, -35, 20), (0.1, 0.2, 0.85, -40, -5), (0.6, 0.05, 0.65, -30, -25), (-0.1, 0.8, 0.6, -60, 10)):
            can(x, y, CAP_Z + 0.75, 0.24, h, HAIR, n=4, r2=0.0, rot=(R(tx), R(ty), R(45)))
        for x in (-0.6, 0.0, 0.6):  # comb lines
            box(x, -0.3, CAP_Z + 0.68, 0.06, HEAD * 0.6, 0.04, HAIR_D)
        prism([(0.25, CAP_Z + 0.1), (0.75, CAP_Z + 0.1), (0.66, CAP_Z - 0.4)], FY - 0.1, FY + 0.5, HAIR)  # one loose strand flicking off the hairline, above the shades


if __name__ == "__main__" or True:
    run({"rebel-jacket": build})
