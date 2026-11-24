"""Napoleon: the kid in a enormous black bicorne (wider than the kid is tall) worn sideways (gold
edging, a tricolour cockade), a blue coat with red lapels, gold epaulettes
with fringes, a white waistcoat and breeches, a red waist sash with gold
tassels and tall black boots. The right hand is tucked into the coat; the
left holds up the full bucket."""
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

COAT, LAPEL, GOLD = (0.14, 0.24, 0.66), (0.88, 0.14, 0.18), (1.0, 0.78, 0.18)
CREAM, BOOT, HAT, HAIR = (0.98, 0.97, 0.92), (0.09, 0.08, 0.10), (0.10, 0.09, 0.12), (0.18, 0.11, 0.07)
BLUE_C = (0.15, 0.30, 0.80)


def bicorne(base, r=3.3, h=2.3, tip=0.6):
    """A huge sideways bicorne: a crescent with upturned tips, wide in x."""
    pts = []
    n = 14
    for i in range(n + 1):
        t = math.pi * i / n
        pts.append((r * math.cos(t), base + tip + h * math.sin(t) ** 0.8))
    for i in range(1, n):
        x = -r + 2 * r * i / n
        pts.append((x, base + tip * (x / r) ** 2))
    prism(pts, -0.55, 0.55, HAT, bevel=0.1)
    # the gold edging: a slightly bigger, thinner copy behind
    big = [(x * 1.04, base + (z - base) * 1.04 - 0.03) for x, z in pts]
    prism(big, -0.42, 0.42, GOLD, bevel=0.03)
    # the cockade on the front, off to one side
    cx, cz = -1.25, base + 1.55
    for rr, c, dy in ((0.56, BLUE_C, 0.0), (0.38, WHITE, -0.04), (0.2, LAPEL, -0.08)):
        can(cx, -0.58 + dy, cz, rr, 0.06, c, n=12, rot=(R(90), 0, 0))
    box(cx, -0.57, cz - 0.85, 0.16, 0.05, 1.1, GOLD)  # a gold loop up to the cockade


def build():
    body(shirt=CREAM, pants=CREAM, leg_colour=BOOT, shoe=BOOT, arms=False, torso=False)
    # boot tops
    for s in (-1, 1):
        with part("leg.l" if s > 0 else "leg.r"):
            can(s * TW * 0.24, 0, HIP - 0.06, 0.16, 0.14, BOOT, n=8)
    # breeches and the coat
    with part("body"):
        box(0, 0, HIP + TH * 0.18, TW, TD, TH * 0.36, CREAM, bevel=0.06)
    with part("chest"):
        cz = HIP + TH * 0.62
        box(0, 0.06, cz, TW + 0.1, TD - 0.02, TH * 0.82, COAT, bevel=0.08)
        box(0, FRONT - 0.03, cz + 0.04, 0.42, 0.06, TH * 0.72, CREAM, bevel=0.02)  # the waistcoat
        for s in (-1, 1):  # red lapels flaring out at the chest
            box(s * 0.31, FRONT - 0.06, cz + 0.12, 0.2, 0.06, TH * 0.58, LAPEL, bevel=0.02, rot=(0, s * R(-10), 0))
            for z in (cz - 0.05, cz + 0.12, cz + 0.29):
                ball(s * 0.31, FRONT - 0.1, z, 0.08, 0.05, 0.08, GOLD, seg=6, ring=4)
            # the coat tails behind
            with part("body"):
                box(s * 0.22, TD * 0.5 + 0.06, HIP - 0.05, 0.38, 0.1, 0.62, COAT, bevel=0.03, rot=(R(10), 0, 0))
    with part("body"):
        # the red waist sash with gold tassels on the left hip
        box(0, 0, HIP + 0.3, TW + 0.16, TD + 0.12, 0.2, LAPEL, bevel=0.05)
        box(-0.45, FRONT - 0.04, HIP + 0.26, 0.24, 0.12, 0.22, LAPEL, bevel=0.06)
        for dx in (-0.06, 0.08):
            bar((-0.45 + dx, FRONT - 0.08, HIP + 0.2), (-0.47 + dx * 1.6, FRONT - 0.1, HIP - 0.12), 0.04, 0.09, GOLD)
    with part("chest"):
        # the stand-up collar
        can(0, 0, TOP + 0.04, 0.44, 0.2, COAT, n=8)
        box(0, FRONT - 0.02, TOP + 0.02, 0.2, 0.08, 0.18, CREAM)
        # epaulettes: gold pads with a fringe
        for s in (-1, 1):
            x = s * (SX + 0.02)
            can(x, 0, TOP + 0.02, 0.24, 0.1, GOLD, n=8)
            for k in range(8):
                a = 2 * math.pi * k / 8
                limb((x + 0.22 * math.cos(a), 0.22 * math.sin(a), TOP - 0.02), (x + 0.24 * math.cos(a), 0.24 * math.sin(a), TOP - 0.22), 0.04, GOLD)
    with part("chest"):
        # the right hand tucked into the coat (half the mitt hidden), a lapel over it: it is
        # part of the coat, so it never swings out of it
        limb((SX, 0, TOP - 0.15), (0.42, FRONT - 0.15, TOP - 0.42), 0.12, COAT)
        can(0.42, FRONT - 0.12, TOP - 0.42, 0.16, 0.12, CREAM, n=6, rot=(0, R(90), R(20)))  # the cuff
        box(0.17, FRONT - 0.02, TOP - 0.42, 0.36, 0.22, 0.32, SKIN, bevel=0.08, segs=2)
        box(0.04, FRONT - 0.1, TOP - 0.42, 0.14, 0.1, 0.42, COAT, bevel=0.02)  # the coat edge over the fingers
    # the left arm holds up the full bucket
    hand = (-1.15, -0.3, TOP - 0.2)
    with part("arm.r"):
        limb((-SX, 0, TOP - 0.15), (hand[0] + 0.12, hand[1], hand[2] + 0.05), 0.12, COAT)
        bar((hand[0] + 0.3, hand[1], hand[2] + 0.05), (hand[0] + 0.15, hand[1], hand[2] + 0.05), 0.17, 0.17, CREAM)
    with part("hand.r"):
        hand_mitt(*hand, -1, MITT, SKIN)
    bucket(hand, full=True, size=0.6)
    with part("head"):
        # the head: dark hair, a forelock curl, and the huge hat
        kid_head(hair=HAIR)
        bicorne(CAP_Z - 0.2)


if __name__ == "__main__" or True:
    render_costume("napoleon", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
