"""The base kids: the same Bobble body for everyone, each with a personality
from an outfit, a hairstyle and a skin tone. Outfits are colour blocks and
add-on shapes on the shared body; hair is free to be big (the costumes
remove it), and the face stays clear: no bars across the forehead."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

R = math.radians
W = HEAD
FY = -W * 0.46            # the face's front plane
CAP_Z = HEAD_Z + W * 0.3  # the default hair cap centre
SH_Z0 = HIP + TH * 0.32   # bottom of the shirt block
FRONT = -TD * 0.5         # torso front plane
BACK = TD * 0.5

HAIR = {"black": (0.10, 0.08, 0.07), "dark": (0.25, 0.15, 0.09), "brown": (0.48, 0.30, 0.16), "chestnut": (0.42, 0.20, 0.10),
        "ginger": (0.90, 0.42, 0.14), "copper": (0.80, 0.33, 0.12), "blonde": (0.98, 0.80, 0.36), "platinum": (0.96, 0.94, 0.84),
        "pink": (1.00, 0.45, 0.70), "blue": (0.22, 0.30, 0.62)}


# ---------------------------------------------------------------- helpers

def band(z0, z1, rgb, grow=0.04, bevel=0.06):
    """A block wrapped round the torso between two heights."""
    return box(0, 0, (z0 + z1) / 2, TW + grow, TD + grow, z1 - z0, rgb, bevel=bevel)


def stripes(z0, z1, n, rgb, grow=0.03):
    step = (z1 - z0) / (2 * n)
    for i in range(n):
        za = z0 + step * (2 * i + 0.5)
        box(0, 0, za + step * 0.5, TW + grow, TD + grow, step, rgb, bevel=0.02)


def arm_point(s, t):
    sx = s * (TW * 0.5 + 0.08)
    p0, p1 = (sx, 0, TOP - 0.15), (sx + s * 0.16, -0.05, TOP - ARM_DROP)
    return [p0[i] + (p1[i] - p0[i]) * t for i in range(3)]


def sleeve_rings(rgb, ts=(0.35, 0.7), r=0.125, half=0.06):
    for s in (-1, 1):
        for t in ts:
            with part("arm.l" if s > 0 else "arm.r"):
                limb(arm_point(s, t - half), arm_point(s, t + half), r, rgb)


def cuffs(rgb):
    sleeve_rings(rgb, ts=(0.9,), r=0.135)


def hood_down(rgb, lining=None):
    """A hood folded down behind the neck, with a collar ring at the front."""
    with part("chest"):
        _hood_down(rgb, lining)


def _hood_down(rgb, lining):
    box(0, BACK - 0.02, TOP + 0.12, TW * 0.95, 0.5, 0.55, rgb, bevel=0.18, segs=2, rot=(R(-20), 0, 0))
    if lining:
        box(0, BACK - 0.2, TOP + 0.2, TW * 0.7, 0.2, 0.32, lining, bevel=0.08, rot=(R(-20), 0, 0))
    box(0, 0, TOP + 0.04, TW * 0.82, TD * 0.92, 0.16, rgb, bevel=0.06)  # collar


def drawstrings(rgb=WHITE, tip=(0.9, 0.9, 0.9)):
    for s in (-1, 1):
        with part("chest"):
            limb((s * 0.15, FRONT - 0.05, TOP + 0.02), (s * 0.18, FRONT - 0.06, TOP - 0.36), 0.03, rgb)
            ball(s * 0.18, FRONT - 0.06, TOP - 0.39, 0.08, 0.08, 0.1, tip, seg=6, ring=4)


def legs_with_socks(skin, sock, stripe=None, top=0.42):
    """Bare stub legs with socks."""
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.115, skin)
            limb((fx, 0, FOOT * 0.35), (fx, 0, top), 0.13, sock)
            if stripe:
                limb((fx, 0, top - 0.07), (fx, 0, top - 0.02), 0.135, stripe)


def laces(rgb=WHITE):
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("foot.l" if s > 0 else "foot.r"):
            box(fx, -FOOT * 0.62, FOOT * 0.36, FOOT * 0.4, 0.12, 0.06, rgb, bevel=0.02)
            box(fx, -FOOT * 0.25, FOOT * 0.02, FOOT * 0.8, FOOT * 1.2, 0.07, rgb, bevel=0.02)  # sole


def wristbands(rgb, r=0.14):
    sleeve_rings(rgb, ts=(1.05,), r=r, half=0.08)


def head_base(skin):
    box(0, 0, HEAD_Z, W, W * 0.92, W * 0.9, skin, bevel=W * 0.14, segs=2)
    face(0, HEAD_Z - W * 0.05, FY, W)


def cap(hair, lift=0.0, back=0.0):
    box(0, W * 0.05 + back * 0.5, CAP_Z + lift, W * 1.04, W * 0.98 + back, W * 0.36, hair, bevel=W * 0.14, segs=2)


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


def fringe(pts, rgb, depth=0.55):
    """A shaped fringe piece on the forehead plane (its top tucks into the cap)."""
    return prism(pts, FY - 0.07, FY - 0.07 + depth, rgb)


def lock(x, z, w, h, rgb, tilt=0.0, y=FY - 0.02, d=0.3):
    """A downward-pointing lock: a triangle with its base at z (in the cap) and its tip h below."""
    tx = x + math.sin(R(tilt)) * h
    top = CAP_Z + 0.38  # runs up over the cap's rounded front edge so it reads as one piece of hair
    fringe([(x - w, top), (x + w, top), (x + w, z), (tx, z - h), (x - w, z)], rgb, depth=0.55)


# ---------------------------------------------------------------- hair

def hair_anime(hair):
    """A spiky anime crest swept up and back."""
    cap(hair, lift=0.05)
    spikes = ((-0.85, -0.2, 0.9, 25, 35), (-0.3, -0.35, 1.25, 30, 12), (0.3, -0.35, 1.35, 30, -10), (0.85, -0.2, 0.95, 25, -35),
              (-0.55, 0.45, 1.1, -10, 30), (0.0, 0.3, 1.5, 5, 0), (0.55, 0.45, 1.1, -10, -30), (0.0, 0.95, 1.0, -45, 0))
    for x, y, h, tx, ty in spikes:
        can(x, y, CAP_Z + 0.35 + h * 0.4, 0.42, h, hair, n=4, r2=0.0, rot=(R(-tx), R(-ty), R(45)))
    for x, h, t in ((-0.9, 0.5, 15), (-0.3, 0.42, 5), (0.15, 0.6, -6), (0.85, 0.48, -18)):  # pointy bangs between the eyes
        lock(x, CAP_Z - 0.05, 0.32, h, hair, tilt=t)
    for s in (-1, 1):  # sideburn spikes
        can(s * 1.3, -0.2, HEAD_Z + 0.15, 0.22, 0.75, hair, n=4, r2=0.0, rot=(R(180), R(s * -10), R(45)))


def hair_braids(hair, tie):
    """Middle part, two long braids hanging over the shoulders to the shoes."""
    cap(hair, lift=0.02)
    for s in (-1, 1):  # middle part: two curtains sweeping out to the temples
        fringe([(0, CAP_Z + 0.38), (s * 1.3, CAP_Z + 0.38), (s * 1.3, CAP_Z - 0.75), (s * 0.15, CAP_Z - 0.3)][::s], hair)
    for s in (-1, 1):
        x = s * 1.32
        ball(x, -0.05, HEAD_Z - 0.15, 0.6, 0.7, 0.7, hair, seg=8, ring=6)
        z = HEAD_Z - 0.6
        for i in range(6):
            ball(x + s * 0.02 * i, -0.15, z, 0.5 - i * 0.02, 0.5 - i * 0.02, 0.42, hair, seg=8, ring=5, rot=(0, R(s * (18 if i % 2 else -18)), 0))
            z -= 0.32
        can(x + s * 0.12, -0.15, z + 0.12, 0.17, 0.16, tie, n=8)
        for t in (-1, 1):  # a little bow
            can(x + s * 0.12 + t * 0.2, -0.17, z + 0.12, 0.14, 0.25, tie, n=4, r2=0.02, rot=(0, R(t * 90), 0))
        can(x + s * 0.12, -0.15, z - 0.12, 0.2, 0.3, hair, n=6, r2=0.04, rot=(R(180), 0, 0))


def hair_afro(hair, pick=None):
    cap(hair)
    box(0, W * 0.08, CAP_Z + 0.35, W * 1.35, W * 1.2, W * 0.75, hair, bevel=W * 0.25, segs=3)
    if pick:  # a comb poking out the top
        box(0.95, -0.3, CAP_Z + 1.45, 0.55, 0.12, 0.32, pick, bevel=0.05, rot=(0, R(-20), 0))
        ball(0.95, -0.37, CAP_Z + 1.47, 0.22, 0.06, 0.22, (1.0, 0.85, 0.3), seg=6, ring=4)


def hair_cape(hair, clip):
    """Long hair from a soft side part, falling down the back and sides to the
    shoulders and flicking out at the ends; it hangs from the head, clear of
    the body, so the legs and arms show and nothing swings into the torso."""
    cap(hair, lift=0.04, back=0.1)
    # a side-swept fringe: one big wedge swooping from the part down to the temple, clear of the eyes
    box(-0.35, FY + 0.14, CAP_Z - 0.05, 1.7, 0.32, 0.55, hair, bevel=0.14, rot=(0, R(-12), 0))
    lock(0.98, CAP_Z - 0.2, 0.3, 0.85, hair, tilt=-8)
    for s in (-1, 1):  # side curtains framing the face down to the shoulders, flicking out at the tips
        box(s * 1.33, -0.25, HEAD_Z - 0.35, 0.36, 1.6, 2.2, hair, bevel=0.14)
        box(s * 1.42, -0.15, HEAD_Z - 1.38, 0.5, 1.5, 0.32, hair, bevel=0.14, rot=(0, R(s * 18), 0))
    # the long back: a sheet down the back of the head to the shoulders, a flicked-out hem
    z0 = TOP + 0.12
    box(0, 0.95, (HEAD_Z + 1.2 + z0) / 2, W * 1.08, 0.6, HEAD_Z + 1.2 - z0, hair, bevel=0.2, segs=2)
    box(0, 1.08, z0 + 0.12, W * 1.16, 0.78, 0.36, hair, bevel=0.16, segs=2)
    for i in range(5):  # a flower clip at the part
        a = 2 * math.pi * i / 5
        ball(-1.0 + 0.17 * math.cos(a), FY + 0.0, CAP_Z + 0.1 + 0.17 * math.sin(a), 0.2, 0.12, 0.2, clip, seg=6, ring=4)
    ball(-1.0, FY - 0.06, CAP_Z + 0.1, 0.14, 0.1, 0.14, (1.0, 0.85, 0.3), seg=6, ring=4)


def hair_puffs(hair, tie=None):
    cap(hair)
    for s in (-1, 1):
        ball(s * 0.75, 0.1, CAP_Z + 0.55, 1.1, 1.1, 1.0, hair, seg=10, ring=7)
        if tie:
            can(s * 0.72, 0.1, CAP_Z + 0.12, 0.42, 0.14, tie, n=8)


def hair_fountain(hair, scrunchie):
    """A giant high ponytail that sprouts from the crown and arcs back."""
    cap(hair, lift=0.02)
    for x, h, t in ((-0.9, 0.55, 12), (-0.05, 0.6, 0), (0.85, 0.5, -12)):  # chunky short locks, clear of the eyes
        lock(x, CAP_Z - 0.1, 0.4, h, hair, tilt=t)
    can(0, 0.35, CAP_Z + 0.6, 0.38, 0.3, scrunchie, n=8)
    pts = ((0, 0.35, CAP_Z + 0.75, 0.7), (0, 0.6, CAP_Z + 1.25, 1.0), (0, 1.2, CAP_Z + 1.45, 1.1), (0, 1.75, CAP_Z + 1.1, 1.0),
           (0, 2.0, CAP_Z + 0.45, 0.85), (0, 2.05, CAP_Z - 0.25, 0.65), (0, 2.0, CAP_Z - 0.85, 0.45))
    for (x, y, z, r), (x1, y1, z1, r1) in zip(pts, pts[1:]):
        limb((x, y, z), (x1, y1, z1), (r + r1) * 0.25, hair, n=8)
    for x, y, z, r in pts:
        ball(x, y, z, r * 0.55, r * 0.5, r * 0.5, hair, seg=8, ring=6)
    for dx, t in ((-0.12, -15), (0.12, 15)):  # a forked flicky tip
        can(dx, 2.0, CAP_Z - 1.15, 0.16, 0.5, hair, n=6, r2=0.0, rot=(R(170), R(t), 0))


def hair_mohawk(hair, sides):
    """Shaved sides and a tall bright fin of spikes front to back."""
    box(0, W * 0.04, HEAD_Z + W * 0.36, W * 1.02, W * 0.96, W * 0.22, sides, bevel=W * 0.12, segs=2)
    for i, (y, h) in enumerate(((-1.0, 0.9), (-0.45, 1.35), (0.15, 1.5), (0.7, 1.3), (1.15, 0.9))):
        can(0, y + 0.1, CAP_Z + 0.25 + h * 0.45, 0.42, h, hair, n=4, r2=0.0, rot=(R(-12 - 8 * i), 0, 0))
    box(0, 0.05, CAP_Z + 0.4, 0.42, W * 0.92, 0.5, hair, bevel=0.1)


def hair_quiff(hair):
    """A big pompadour: a tall wave rolling up and forward over the forehead."""
    cap(hair)
    box(0, -0.2, CAP_Z + 0.55, W * 0.9, 1.6, 0.9, hair, bevel=0.35, segs=2, rot=(R(-12), 0, 0))
    box(0.1, -0.85, CAP_Z + 0.85, W * 0.75, 0.9, 0.75, hair, bevel=0.3, segs=2, rot=(R(-30), 0, R(-6)))
    can(-0.55, -1.3, CAP_Z + 0.75, 0.3, 0.55, hair, n=4, r2=0.0, rot=(R(130), 0, R(45)))  # a curl tipping forward


def hair_cloud(hair):
    """A giant curly cloud spilling over the head and down the back."""
    cap(hair)
    blobs = []
    for i in range(10):
        a = 2 * math.pi * i / 10
        blobs.append((1.35 * math.cos(a), 0.2 + 1.2 * math.sin(a), CAP_Z + 0.25, 0.95))
    for i in range(6):
        a = 2 * math.pi * (i + 0.5) / 6
        blobs.append((0.7 * math.cos(a), 0.2 + 0.65 * math.sin(a), CAP_Z + 0.85, 1.0))
    blobs += [(0, 0.2, CAP_Z + 1.15, 1.0)]
    for s in (-1, 1):  # down the sides and back to the shoulders
        blobs += [(s * 1.45, 0.3, HEAD_Z - 0.3, 0.9), (s * 1.4, 0.4, HEAD_Z - 1.05, 0.8), (s * 0.7, 1.1, HEAD_Z - 0.8, 0.9)]
    blobs += [(0, 1.25, HEAD_Z - 0.2, 1.0), (0, 1.2, HEAD_Z - 1.1, 0.85)]
    for x, y, z, r in blobs:
        ball(x, y, z, r, r, r * 0.9, hair, seg=7, ring=5)
    for x in (-0.8, -0.2, 0.5, 1.0):  # springy curls at the hairline, high
        ball(x, FY - 0.05, CAP_Z - 0.1, 0.48, 0.42, 0.45, hair, seg=6, ring=4)


def hair_swoop(hair):
    """A big side-swept fringe sweeping from one side, tips down past the temple; shaggy at the back."""
    cap(hair, lift=0.04, back=0.1)
    # one big swoop from the left part sweeping down to the right temple, stopping just above the eye
    fringe([(-1.3, CAP_Z + 0.38), (1.3, CAP_Z + 0.38), (1.35, HEAD_Z - 0.55), (1.0, HEAD_Z - 0.2), (0.6, CAP_Z - 0.45),
            (-0.3, CAP_Z - 0.25), (-1.3, CAP_Z - 0.2)], hair, depth=0.6)
    fringe([(-0.75, CAP_Z - 0.2), (-0.35, CAP_Z - 0.2), (-0.62, CAP_Z - 0.48)], hair)  # a little flick
    for x, y, z, tx, ty, h in ((-0.6, 0.0, 0.3, -35, 25, 0.8), (0.1, 0.3, 0.35, -20, -10, 0.95), (0.7, 0.1, 0.3, -40, -30, 0.7),
                               (-0.3, 0.8, 0.25, 30, 20, 0.75), (0.5, 0.9, 0.25, 35, -25, 0.8)):  # messy bedhead tufts
        can(x, y, CAP_Z + z + h * 0.35, 0.3, h, hair, n=4, r2=0.0, rot=(R(tx), R(ty), R(45)))
    box(0, 1.05, HEAD_Z + 0.05, W * 1.04, 0.5, 1.8, hair, bevel=0.2, segs=2)  # back, shaggy to the nape
    for x in (-0.85, -0.3, 0.3, 0.85):
        can(x, 1.15, HEAD_Z - 0.95, 0.36, 0.7, hair, n=4, r2=0.0, rot=(R(195), 0, R(45)))
    for s_ in (-1, 1):
        can(s_ * 1.3, 0.45, HEAD_Z - 0.35, 0.3, 0.7, hair, n=4, r2=0.0, rot=(R(180), R(s_ * -12), R(45)))


# ---------------------------------------------------------------- outfits (drawn over body())

def outfit_hoodie(main, trim, pants, skin):
    body(skin=skin, shirt=main, pants=pants, shoe=(0.95, 0.95, 0.95))
    with part("chest"):
        band(SH_Z0 - 0.15, TOP - 0.02, main)
        band(SH_Z0 - 0.2, SH_Z0 - 0.08, trim, grow=0.07)  # ribbed hem
        box(0, FRONT - 0.04, SH_Z0 + 0.14, TW * 0.62, 0.06, 0.3, trim, bevel=0.03)  # kangaroo pocket
    hood_down(main, lining=trim)
    drawstrings()
    cuffs(trim)
    laces((0.9, 0.2, 0.2))


def outfit_overalls(denim, tee, stripe, skin, shoe):
    body(skin=skin, shirt=tee, pants=denim, shoe=shoe, legs=False)
    with part("chest"):
        stripes(SH_Z0, TOP - 0.05, 3, stripe)
    sleeve_rings(stripe)
    for s in (-1, 1):  # rolled-up jean legs
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.13, denim)
            limb((fx, 0, FOOT * 0.42), (fx, 0, FOOT * 0.56), 0.16, (0.55, 0.7, 0.9))
    with part("body"):
        box(0, 0, HIP + 0.15, TW + 0.05, TD + 0.05, 0.32, denim, bevel=0.06)
    with part("chest"):  # the bib, its pocket and the straps with their buttons
        box(0, FRONT - 0.02, SH_Z0 + 0.2, TW * 0.62, 0.08, 0.48, denim, bevel=0.04)  # bib
        box(0, BACK + 0.02, SH_Z0 + 0.2, TW * 0.62, 0.08, 0.48, denim, bevel=0.04)
        box(0, FRONT - 0.07, SH_Z0 + 0.2, TW * 0.3, 0.04, 0.2, (0.3, 0.45, 0.75), bevel=0.02)  # bib pocket
        for s in (-1, 1):
            box(s * TW * 0.26, 0, TOP + 0.02, 0.16, TD + 0.1, 0.06, denim)
            box(s * TW * 0.26, FRONT - 0.04, TOP - 0.15, 0.16, 0.06, 0.32, denim)
            box(s * TW * 0.26, BACK + 0.04, TOP - 0.15, 0.16, 0.06, 0.32, denim)
            can(s * TW * 0.26, FRONT - 0.09, SH_Z0 + 0.42, 0.06, 0.05, (0.98, 0.78, 0.25), n=8, rot=(R(90), 0, 0))


def digit(x, y, z, n, rgb, sz=0.22, back=False):
    """A chunky seven-segment number on a front (or back) plane."""
    seg = {"a": (0, 1, sz, 0.06), "g": (0, 0, sz, 0.06), "d": (0, -1, sz, 0.06),
           "f": (-1, 0.5, 0.06, sz * 0.9), "b": (1, 0.5, 0.06, sz * 0.9), "e": (-1, -0.5, 0.06, sz * 0.9), "c": (1, -0.5, 0.06, sz * 0.9)}
    on = {"7": "abc", "4": "fgbc", "1": "bc", "2": "abged", "3": "abgcd", "8": "abcdefg"}[n]
    for k in on:
        dx, dz, w, h = seg[k]
        box(x + (-dx if back else dx) * sz * 0.5, y, z + dz * sz * 0.5, w, 0.04, h, rgb)


def outfit_jersey(main, trim, num, skin):
    body(skin=skin, shirt=main, pants=main, shoe=(0.95, 0.95, 0.95), legs=False)
    legs_with_socks(skin, WHITE, stripe=trim, top=0.48)
    with part("body"):  # the shorts and their side stripes
        box(0, 0, HIP + 0.08, TW + 0.12, TD + 0.1, 0.38, trim, bevel=0.06)  # shorts
        for s in (-1, 1):
            box(s * (TW * 0.5 + 0.07), 0, HIP + 0.08, 0.04, TD + 0.12, 0.38, main)
    with part("chest"):  # the jersey, its V-neck and numbers
        band(SH_Z0 - 0.08, TOP - 0.02, main)
        for s in (-1, 1):  # V-neck trim
            box(s * 0.1, FRONT - 0.04, TOP - 0.1, 0.07, 0.04, 0.3, trim, rot=(0, R(s * 35), 0))
        digit(-0.15, FRONT - 0.05, SH_Z0 + 0.25, "2", num, sz=0.2)
        digit(0.17, FRONT - 0.05, SH_Z0 + 0.25, "3", num, sz=0.2)
        digit(-0.15, BACK + 0.05, SH_Z0 + 0.3, "3", num, sz=0.24, back=True)
        digit(0.17, BACK + 0.05, SH_Z0 + 0.3, "2", num, sz=0.24, back=True)
    sleeve_rings(trim, ts=(0.55,))
    laces(trim)
    wristbands(trim)


def outfit_cardigan(card, tee, skirt, skin):
    body(skin=skin, shirt=tee, pants=skirt, shoe=(0.85, 0.2, 0.3), sleeve=card, legs=False)
    legs_with_socks(skin, WHITE, top=0.5)
    with part("body"):
        can(0, 0, HIP + 0.12, 0.85, 0.42, skirt, n=8, r2=0.5, rot=(0, 0, R(22.5)))  # skirt flare
    with part("chest"):  # the cardigan, its buttons, collar and hem, and a pink pompom
        for s in (-1, 1):  # open-front cardigan panels
            box(s * TW * 0.31, 0, SH_Z0 + 0.22, TW * 0.42, TD + 0.06, 0.78, card, bevel=0.06)
            for i in range(2):
                can(s * 0.1, FRONT - 0.06, SH_Z0 + 0.1 + i * 0.25, 0.05, 0.04, WHITE, n=8, rot=(R(90), 0, 0))
        box(0, BACK, SH_Z0 + 0.22, TW * 0.4, 0.08, 0.78, card, bevel=0.03)
        box(0, 0, TOP + 0.03, TW * 0.85, TD * 0.92, 0.12, card, bevel=0.05)
        band(SH_Z0 - 0.17, SH_Z0 - 0.05, card, grow=0.07)
        ball(0.28, FRONT - 0.07, SH_Z0, 0.12, 0.05, 0.1, (1.0, 0.6, 0.7), seg=6, ring=4)
    cuffs(WHITE)


def outfit_tubetop(top, tutu, legging, skin, shoe):
    body(skin=skin, shirt=skin, pants=legging, shoe=shoe, sleeve=skin, legs=False)
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.12, legging)
    with part("chest"):
        band(SH_Z0 - 0.04, TOP - 0.17, top, grow=0.06)
        band(TOP - 0.22, TOP - 0.15, WHITE, grow=0.08, bevel=0.02)  # elastic trim
    with part("body"):
        for i, (r, r2, z) in enumerate(((0.95, 0.55, HIP + 0.16), (0.85, 0.5, HIP + 0.26))):  # layered tutu
            can(0, 0, z, r, 0.2, tutu if i == 0 else (1.0, 0.82, 0.92), n=12, r2=r2)
    wristbands((1.0, 0.85, 0.3), r=0.13)
    for i in range(5):  # a star on the top
        a = R(90 + 72 * i)
        with part("chest"):
            box(0.09 * math.cos(a), FRONT - 0.06, SH_Z0 + 0.2 + 0.09 * math.sin(a), 0.06, 0.03, 0.16, (1.0, 0.9, 0.3), rot=(0, R(-72 * i), 0))


def outfit_raincoat(coat, boot, skin):
    body(skin=skin, shirt=coat, pants=coat, shoe=boot)
    for s in (-1, 1):  # wellies up to the knee
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            can(fx, 0, 0.42, 0.17, 0.3, boot, n=8)
            can(fx, 0, 0.6, 0.19, 0.08, WHITE, n=8)
    with part("chest"):  # the coat with its placket, toggles and pocket flaps
        box(0, 0, (SH_Z0 - 0.3 + TOP) / 2, TW + 0.12, TD + 0.1, TOP - SH_Z0 + 0.3, coat, bevel=0.08)  # long coat
        box(0, FRONT - 0.07, (SH_Z0 - 0.3 + TOP) / 2, 0.04, 0.04, TOP - SH_Z0 + 0.25, (0.85, 0.6, 0.1))  # placket
        for i in range(3):  # toggles
            box(0.12, FRONT - 0.09, SH_Z0 - 0.15 + i * 0.25, 0.14, 0.05, 0.06, (0.25, 0.25, 0.3), bevel=0.02)
        for s in (-1, 1):
            box(s * 0.3, FRONT - 0.06, SH_Z0 - 0.12, 0.26, 0.05, 0.05, (0.85, 0.6, 0.1))  # pocket flaps
    hood_down(coat, lining=(0.3, 0.6, 0.9))
    cuffs((0.85, 0.6, 0.1))


def outfit_bandtee(tee, bolt, jeans, scarf, skin):
    body(skin=skin, shirt=tee, pants=jeans, shoe=(0.15, 0.15, 0.18), legs=False)
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.12, jeans)
    with part("leg.r"):
        box(-TW * 0.24 - 0.02, -0.11, 0.42, 0.14, 0.03, 0.08, (0.95, 0.92, 0.85))  # torn knee
    laces()
    with part("chest"):  # the tee, its lightning bolt and the bandana
        band(SH_Z0 - 0.06, TOP - 0.02, tee, grow=0.04)
        pts = ((0.1, 0.42), (-0.12, 0.2), (0.12, 0.2), (-0.1, -0.02))  # a lightning bolt
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            limb((x0, FRONT - 0.05, SH_Z0 + 0.1 + z0), (x1, FRONT - 0.05, SH_Z0 + 0.1 + z1), 0.06, bolt, n=4)
        box(0, 0, TOP + 0.05, TW * 0.8, TD * 0.9, 0.14, scarf, bevel=0.05)  # bandana round the neck
        can(0, FRONT - 0.05, TOP - 0.12, 0.28, 0.06, scarf, n=3, rot=(R(90), 0, 0))
        for s in (-1, 1):
            can(s * 0.15, FRONT - 0.07, TOP - 0.14, 0.035, 0.03, WHITE, n=6, rot=(R(90), 0, 0))
    wristbands((0.12, 0.12, 0.14))


def outfit_sweatervest(shirt, vest, diamond, shorts, tie, skin):
    body(skin=skin, shirt=shirt, pants=shorts, shoe=(0.45, 0.25, 0.12), legs=False)
    legs_with_socks(skin, (0.9, 0.9, 0.9), stripe=vest, top=0.5)
    with part("body"):
        box(0, 0, HIP + 0.08, TW + 0.08, TD + 0.06, 0.36, shorts, bevel=0.06)
    with part("chest"):  # the vest, its V neck and diamonds, the collar and bow tie
        band(SH_Z0 - 0.1, TOP - 0.12, vest, grow=0.06)
        for s in (-1, 1):  # V neck
            box(s * 0.13, FRONT - 0.05, TOP - 0.2, 0.18, 0.05, 0.28, shirt, rot=(0, R(s * 30), 0))
        for x, z in ((-0.25, 0.08), (0.25, 0.08), (0, -0.05)):  # argyle diamonds
            box(x, FRONT - 0.06, SH_Z0 + 0.12 + z, 0.17, 0.04, 0.17, diamond, rot=(0, R(45), 0))
        for s in (-1, 1):  # collar points and a bow tie
            box(s * 0.2, FRONT - 0.03, TOP - 0.01, 0.26, 0.06, 0.12, WHITE, rot=(0, R(s * -20), 0))
            can(s * 0.14, FRONT - 0.1, TOP - 0.1, 0.13, 0.22, tie, n=4, r2=0.02, rot=(0, R(s * -90), 0))
        box(0, FRONT - 0.12, TOP - 0.1, 0.08, 0.06, 0.09, tie)


def outfit_puffer(vest, tee, pants, pack, skin):
    body(skin=skin, shirt=tee, pants=pants, shoe=(0.3, 0.6, 0.95))
    laces()
    with part("chest"):  # the vest, its collar and zip, the backpack and its straps
        for z in (SH_Z0 - 0.05, SH_Z0 + 0.2, SH_Z0 + 0.45):  # quilted puffy bands
            box(0, 0, z, TW + 0.16, TD + 0.14, 0.27, vest, bevel=0.1, segs=2)
        box(0, 0, TOP + 0.02, TW * 0.85, TD * 0.95, 0.2, vest, bevel=0.08)  # stand-up collar
        box(0, FRONT - 0.09, SH_Z0 + 0.2, 0.04, 0.04, 0.8, (0.85, 0.85, 0.85))  # zip
        box(0, BACK + 0.28, SH_Z0 + 0.25, TW * 0.8, 0.42, 0.75, pack, bevel=0.12, segs=2)  # backpack
        box(0, BACK + 0.5, SH_Z0 + 0.1, TW * 0.55, 0.12, 0.32, (1.0, 0.85, 0.3), bevel=0.06)
        for s in (-1, 1):
            box(s * 0.28, FRONT - 0.09, SH_Z0 + 0.35, 0.1, 0.04, 0.5, pack)


def outfit_sweater(main, stripe, pants, phones, skin):
    body(skin=skin, shirt=main, pants=pants, shoe=(0.95, 0.95, 0.95))
    laces((0.15, 0.15, 0.18))
    with part("chest"):  # the oversized sweater and its stripes
        box(0, 0, (SH_Z0 - 0.22 + TOP) / 2, TW + 0.1, TD + 0.08, TOP - SH_Z0 + 0.22, main, bevel=0.08)  # oversized
        for i in range(3):
            box(0, 0, SH_Z0 - 0.1 + i * 0.22, TW + 0.13, TD + 0.11, 0.09, stripe, bevel=0.02)
    sleeve_rings(stripe, ts=(0.3, 0.6))
    sleeve_rings(main, ts=(0.95,), r=0.16)  # long sleeves bunched at the wrist
    with part("chest"):  # headphones round the neck
        for s in (-1, 1):
            can(s * 0.42, -0.1, TOP + 0.12, 0.2, 0.14, phones, n=8, rot=(0, R(90), 0))
            can(s * 0.5, -0.1, TOP + 0.12, 0.13, 0.06, (0.2, 0.2, 0.22), n=8, rot=(0, R(90), 0))
        box(0, 0.2, TOP + 0.08, 0.84, 0.12, 0.1, phones, bevel=0.03)


# ---------------------------------------------------------------- the kids

T = SKIN_TONES


def make(outfit, hair_fn, skin):
    def build():
        outfit(skin)
        with part("head"):  # the head and every hairstyle ride the head
            head_base(skin)
            hair_fn()
    return build


KIDS = {
    # Anime kid: red hoodie, hood down, drawstrings; spiky blue-black crest
    "kid-spiky": make(lambda s: outfit_hoodie((0.92, 0.25, 0.25), (0.98, 0.88, 0.35), (0.25, 0.27, 0.35), s),
                      lambda: hair_anime(HAIR["blue"]), T[1]),
    # Farm kid: denim overalls on a striped tee; long ginger braids with bows
    "kid-pigtails": make(lambda s: outfit_overalls((0.28, 0.45, 0.80), (0.98, 0.95, 0.88), (0.95, 0.35, 0.35), s, (0.95, 0.75, 0.25)),
                         lambda: hair_braids(HAIR["ginger"], (0.35, 0.75, 0.55)), T[0]),
    # Sporty: gold and purple basketball jersey; the afro with a comb
    "kid-afro": make(lambda s: outfit_jersey((0.98, 0.72, 0.15), (0.50, 0.28, 0.75), (0.50, 0.28, 0.75), s),
                     lambda: hair_afro(HAIR["black"], (0.95, 0.35, 0.45)), T[5]),
    # Dreamy: mint cardigan, skirt; long chestnut hair to the shoulders with a flower
    "kid-bob": make(lambda s: outfit_cardigan((0.55, 0.85, 0.72), (0.98, 0.95, 0.90), (0.95, 0.45, 0.55), s),
                    lambda: hair_cape(HAIR["chestnut"], WHITE), T[2]),
    # Sparkly: pink tube top with a star, tutu; the space buns
    "kid-puffs": make(lambda s: outfit_tubetop((1.0, 0.40, 0.65), (0.75, 0.55, 0.95), (0.35, 0.28, 0.55), s, (0.98, 0.85, 0.30)),
                      lambda: hair_puffs(HAIR["dark"], (1.0, 0.40, 0.65)), T[4]),
    # Puddle jumper: yellow rain jacket, red wellies; giant fountain ponytail
    "kid-ponytail": make(lambda s: outfit_raincoat((1.0, 0.82, 0.15), (0.92, 0.22, 0.25), s),
                         lambda: hair_fountain(HAIR["brown"], (0.3, 0.7, 0.95)), T[3]),
    # Rocker: black lightning tee, ripped jeans, bandana; hot pink mohawk
    "kid-buzz": make(lambda s: outfit_bandtee((0.16, 0.16, 0.20), (1.0, 0.85, 0.2), (0.45, 0.6, 0.85), (0.9, 0.2, 0.25), s),
                     lambda: hair_mohawk(HAIR["pink"], HAIR["black"]), T[4]),
    # Little professor: argyle sweater vest, bow tie, shorts; blonde pompadour
    "kid-bun": make(lambda s: outfit_sweatervest((0.98, 0.97, 0.95), (0.30, 0.55, 0.45), (0.98, 0.80, 0.35), (0.55, 0.42, 0.30), (0.9, 0.2, 0.25), s),
                    lambda: hair_quiff(HAIR["blonde"]), T[1]),
    # Explorer: teal puffer vest, backpack; giant copper curly cloud
    "kid-curly": make(lambda s: outfit_puffer((0.20, 0.70, 0.70), (0.98, 0.55, 0.20), (0.40, 0.32, 0.25), (0.9, 0.3, 0.3), s),
                      lambda: hair_cloud(HAIR["copper"]), T[3]),
    # Cool kid: oversized striped sweater, headphones; platinum side swoop
    "kid-platinum": make(lambda s: outfit_sweater((0.20, 0.22, 0.30), (0.98, 0.97, 0.94), (0.55, 0.60, 0.70), (0.4, 0.85, 0.95), s),
                         lambda: hair_swoop(HAIR["platinum"]), T[0]),
}

if __name__ == "__main__" or True:
    run(KIDS)
