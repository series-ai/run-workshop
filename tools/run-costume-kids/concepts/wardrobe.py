"""The wardrobe: the plain Bobble kid and every piece a regular kid can swap.

A regular kid is the base kid (head, face, skin body) plus one item per slot:
hair, face extra, top, bottoms, shoes and a held prop. Items are drawn over
the base in layers that never touch (bottoms hug the waist, tops sit over
them, outer tops over the overalls' bib), so any top goes with any bottoms.

Every item is painted with up to four channels, main / trim / accent / detail,
that a game can recolour; anything else is a fixed colour. An item's
`build(main, trim, accent, detail)` draws it in the given colours: real ones
for the concept renders and the ready-made kids (costumes/kids.py), stand-in
"channel" colours for the kit export (rig/export_kit.py), which turns them
into channel ids. Exposed skin is always drawn in SKIN.

The costume kids don't use this: a costume is one fixed piece.
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
import props as _props  # noqa: E402

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


HAIR_Y = FY - 0.11  # the front of every fringe: in front of glasses (GY), so hair always covers them


def fringe(pts, rgb, depth=0.59):
    """A shaped fringe piece on the forehead plane (its top tucks into the cap)."""
    return prism(pts, HAIR_Y, HAIR_Y + depth, rgb)


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
    box(-0.35, HAIR_Y + 0.16, CAP_Z - 0.05, 1.7, 0.32, 0.55, hair, bevel=0.14, rot=(0, R(-12), 0))
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
            (-0.3, CAP_Z - 0.25), (-1.3, CAP_Z - 0.2)], hair, depth=0.64)
    fringe([(-0.75, CAP_Z - 0.2), (-0.35, CAP_Z - 0.2), (-0.62, CAP_Z - 0.48)], hair)  # a little flick
    for x, y, z, tx, ty, h in ((-0.6, 0.0, 0.3, -35, 25, 0.8), (0.1, 0.3, 0.35, -20, -10, 0.95), (0.7, 0.1, 0.3, -40, -30, 0.7),
                               (-0.3, 0.8, 0.25, 30, 20, 0.75), (0.5, 0.9, 0.25, 35, -25, 0.8)):  # messy bedhead tufts
        can(x, y, CAP_Z + z + h * 0.35, 0.3, h, hair, n=4, r2=0.0, rot=(R(tx), R(ty), R(45)))
    box(0, 1.05, HEAD_Z + 0.05, W * 1.04, 0.5, 1.8, hair, bevel=0.2, segs=2)  # back, shaggy to the nape
    for x in (-0.85, -0.3, 0.3, 0.85):
        can(x, 1.15, HEAD_Z - 0.95, 0.36, 0.7, hair, n=4, r2=0.0, rot=(R(195), 0, R(45)))
    for s_ in (-1, 1):
        can(s_ * 1.3, 0.45, HEAD_Z - 0.35, 0.3, 0.7, hair, n=4, r2=0.0, rot=(R(180), R(s_ * -12), R(45)))


def digit(x, y, z, n, rgb, sz=0.22, back=False):
    """A chunky seven-segment number on a front (or back) plane."""
    seg = {"a": (0, 1, sz, 0.06), "g": (0, 0, sz, 0.06), "d": (0, -1, sz, 0.06),
           "f": (-1, 0.5, 0.06, sz * 0.9), "b": (1, 0.5, 0.06, sz * 0.9), "e": (-1, -0.5, 0.06, sz * 0.9), "c": (1, -0.5, 0.06, sz * 0.9)}
    on = {"7": "abc", "4": "fgbc", "1": "bc", "2": "abged", "3": "abgcd", "8": "abcdefg"}[n]
    for k in on:
        dx, dz, w, h = seg[k]
        box(x + (-dx if back else dx) * sz * 0.5, y, z + dz * sz * 0.5, w, 0.04, h, rgb)


SLOTS = ("hair", "face", "top", "bottom", "shoes", "prop")
CHANNELS = ("main", "trim", "accent", "detail")
# the stand-in colours the kit export draws each channel in (nothing in the wardrobe uses them)
CHANNEL_RGB = {"main": (0.111, 0.222, 0.333), "trim": (0.333, 0.111, 0.222), "accent": (0.222, 0.333, 0.111), "detail": (0.444, 0.111, 0.333)}

# the colours the builder offers for clothes and props (any colour works; these are the suggestions)
CLOTH = {"red": (0.92, 0.25, 0.25), "tomato": (0.95, 0.42, 0.30), "orange": (0.98, 0.55, 0.20), "gold": (0.98, 0.72, 0.15),
         "yellow": (1.0, 0.82, 0.15), "butter": (0.98, 0.88, 0.35), "lime": (0.62, 0.82, 0.30), "green": (0.30, 0.62, 0.40),
         "mint": (0.55, 0.85, 0.72), "teal": (0.20, 0.70, 0.70), "sky": (0.40, 0.75, 0.95), "blue": (0.28, 0.45, 0.80),
         "navy": (0.20, 0.22, 0.38), "purple": (0.50, 0.28, 0.75), "lilac": (0.75, 0.55, 0.95), "pink": (1.0, 0.40, 0.65),
         "rose": (0.95, 0.45, 0.55), "brown": (0.55, 0.38, 0.24), "tan": (0.85, 0.70, 0.50), "cream": (0.98, 0.95, 0.88),
         "white": (0.97, 0.97, 0.97), "grey": (0.55, 0.60, 0.70), "charcoal": (0.25, 0.27, 0.35), "black": (0.15, 0.15, 0.18)}


def _c(*names):
    return tuple(CLOTH[n] if isinstance(n, str) else n for n in names)


# ---------------------------------------------------------------- the base kid

def base_kid(skin=SKIN):
    """The plain kid every outfit goes over: skin legs, torso and arms, the mitts, the head with
    its face and expressions. No feet: shoes are always worn."""
    for s in (-1, 1):
        fx, side = s * TW * 0.24, "l" if s > 0 else "r"
        with part(f"leg.{side}"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.11, skin)
        sx = s * (TW * 0.5 + 0.08)
        with part(f"arm.{side}"):
            limb((sx, 0, TOP - 0.15), (sx + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, skin)
        with part(f"hand.{side}"):
            hand_mitt(sx + s * 0.18, -0.08, TOP - 0.66, s, MITT, skin)
    with part("body"):
        box(0, 0, HIP + TH * 0.18, TW, TD, TH * 0.36, skin, bevel=0.06)
    with part("chest"):
        box(0, 0, HIP + TH * 0.66, TW, TD, TH * 0.68, skin, bevel=0.08)
    with part("head"):
        head_base(skin)
        can(0, 0.05, TOP + 0.3, 0.42, 0.75, skin, n=8).name = "neck_stub"


# ---------------------------------------------------------------- layers
# Every layer is a fixed size, with a clear gap to the next, so no two surfaces ever meet:
#   the skin body (TW x TD)
#   undertops (TW + UNDER): tees and the like, tucked into the bottoms; their prints and pockets
#     stay within DECO_U, under the overalls' bib
#   bottoms (TW + BOTTOM at the waist): the waistband covers an undertop's hem
#   the overalls' bib, just in front of an undertop's prints
#   outer tops (TW + OUTER): hoodies, cardigans, coats, vests and the big sweater, over the
#     waistband; they hide the overalls' bib
# (sizes are added to the torso's width and depth)

UNDER, BOTTOM, OUTER = 0.04, 0.10, 0.24
FRONT_U = -(TD + UNDER) / 2   # an undertop's front
DECO_U = FRONT_U - 0.015      # the middle of an undertop's prints (0.03 thick at most)
FRONT_B = -(TD + BOTTOM) / 2  # the waistband's front
FRONT_O = -(TD + OUTER) / 2   # an outer top's front
BACK_O = -FRONT_O
BIB_Y = FRONT_U - 0.07        # the middle of the overalls' bib (0.05 thick)
WAIST_Z = SH_Z0 + 0.1         # top of every waistband
TUCK_Z = HIP + 0.12           # bottom of an undertop (inside the bottoms)
HEM_Z = SH_Z0 - 0.15          # bottom of an outer top (over the waistband)


def torso(rgb, z0=TUCK_Z, z1=TOP, grow=UNDER, bevel=0.06):
    band(z0, z1, rgb, grow=grow, bevel=bevel)


def outer(rgb, z0=HEM_Z, z1=TOP - 0.02, bevel=0.08):
    band(z0, z1, rgb, grow=OUTER, bevel=bevel)


def sleeves(rgb, length=1.0, r=0.125):
    """Sleeves over the arms, from the shoulder to `length` of the way to the elbow-wrist (1 is long)."""
    for s in (-1, 1):
        with part("arm.l" if s > 0 else "arm.r"):
            limb(arm_point(s, -0.08), arm_point(s, length), r, rgb)


def waist(rgb, z0=HIP - 0.06):
    with part("body"):
        box(0, 0, (z0 + WAIST_Z) / 2, TW + BOTTOM, TD + BOTTOM, WAIST_Z - z0, rgb, bevel=0.06)


def pant_legs(rgb, r=0.125, z0=FOOT * 0.42):
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, z0), (fx, 0, HIP + 0.02), r, rgb)


def socks(rgb, stripe=None, top=0.48):
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.35), (fx, 0, top), 0.13, rgb)
            if stripe:
                limb((fx, 0, top - 0.07), (fx, 0, top - 0.02), 0.135, stripe)


def each_foot(fn):
    for s in (-1, 1):
        with part("foot.l" if s > 0 else "foot.r"):
            fn(s * TW * 0.24)


def shoe_box(fx, rgb, h=FOOT * 0.44, grow=0.0):
    box(fx, -FOOT * 0.25, h / 2, FOOT * 0.75 + grow, FOOT * 1.15 + grow, h, rgb, bevel=FOOT * 0.14, segs=2)


# ---------------------------------------------------------------- hair (the head part; main is the hair)

def hair_crop(hair, _t=None, _a=None, _d=None):
    """A short tidy crop: the cap and a soft fringe of three chunky locks."""
    cap(hair, lift=0.02)
    for x, h, t in ((-0.75, 0.42, 10), (0.0, 0.5, 0), (0.75, 0.42, -10)):
        lock(x, CAP_Z - 0.05, 0.42, h, hair, tilt=t)


# ---------------------------------------------------------------- face extras (on the face plane)

GY = FY - 0.055  # glasses (0.03 thick) sit between the face and the fringes, so hair falls over them


def face_freckles(main, *_):
    """Freckles across the cheeks and the nose bridge."""
    cz = HEAD_Z - W * 0.05
    for s in (-1, 1):
        for dx, dz in ((0.0, 0.0), (0.16, 0.1), (0.14, -0.1), (0.3, 0.02)):
            box(s * (W * 0.24 + dx), FY - 0.035, cz - W * 0.02 + dz, 0.07, 0.03, 0.07, main, rot=(0, R(45), 0))


def _temples(rgb, z):
    for s in (-1, 1):  # the arms of the glasses run back along the sides of the head
        box(s * (W * 0.5 + 0.02), FY + 0.6, z, 0.06, 1.2, 0.07, rgb)
        box(s * (W * 0.43), GY + 0.03, z, 0.32, 0.06, 0.07, rgb)  # from the frame round the corner of the head


def face_glasses_round(main, *_):
    """Big round frames (no lenses: no glass anywhere)."""
    z = HEAD_Z + 0.01
    for s in (-1, 1):
        stroke(arc(s * W * 0.22, z, 0.34, 0.32, 0, 360, n=17), 0.075, GY, main, depth=0.03)
    stroke([(-W * 0.22 + 0.34, z + 0.06), (W * 0.22 - 0.34, z + 0.06)], 0.06, GY, main, depth=0.03)
    _temples(main, z + 0.08)


def face_glasses_square(main, *_):
    """Chunky square frames."""
    z = HEAD_Z + 0.01
    for s in (-1, 1):
        x, hw, hh = s * W * 0.22, 0.36, 0.27
        stroke([(x - hw, z + hh), (x + hw, z + hh), (x + hw, z - hh), (x - hw, z - hh), (x - hw, z + hh), (x + hw - 0.01, z + hh)],
               0.09, GY, main, depth=0.03)
    stroke([(-W * 0.22 + 0.36, z + 0.1), (W * 0.22 - 0.36, z + 0.1)], 0.07, GY, main, depth=0.03)
    _temples(main, z + 0.12)


def face_plaster(main, trim, *_):
    """A sticking plaster on one cheek, put on crooked."""
    cz = HEAD_Z - W * 0.05 - W * 0.02
    box(-W * 0.3, FY - 0.035, cz, 0.42, 0.04, 0.16, main, rot=(0, R(-18), 0))
    box(-W * 0.3, FY - 0.055, cz, 0.13, 0.03, 0.12, trim, rot=(0, R(-18), 0))


# ---------------------------------------------------------------- tops (chest and arms)
# Undertops (tucked in): tee, stripy, jersey, tube top, band tee.
# Outer tops (over the waistband, outer=True in the catalog): hoodie, cardigan, raincoat,
# sweater vest, puffer, sweater.

def top_tee(main, trim, accent, _d=None):
    """A plain tee: short sleeves, a contrast collar and a chest pocket."""
    with part("chest"):
        torso(main)
        box(0, 0, TOP + 0.02, TW * 0.8, TD * 0.9, 0.1, trim, bevel=0.04)  # crew neck
        box(0.24, DECO_U, SH_Z0 + 0.36, 0.2, 0.03, 0.2, accent, bevel=0.01)  # pocket
    sleeves(main, length=0.45, r=0.135)
    sleeve_rings(trim, ts=(0.42,), r=0.14, half=0.04)


def top_stripy(main, trim, _a=None, _d=None):
    """A long-sleeved striped top."""
    with part("chest"):
        torso(main)
        stripes(WAIST_Z + 0.02, TOP - 0.05, 3, trim, grow=UNDER + 0.025)
    sleeves(main)
    sleeve_rings(trim, r=0.14)


def top_jersey(main, trim, accent, _d=None):
    """A sports jersey with a V-neck and a number front and back."""
    with part("chest"):
        torso(main, z1=TOP - 0.02)
        for s in (-1, 1):  # V-neck trim
            box(s * 0.1, DECO_U, TOP - 0.1, 0.07, 0.03, 0.3, trim, rot=(0, R(s * 35), 0))
        digit(-0.15, DECO_U, SH_Z0 + 0.27, "2", accent, sz=0.2)
        digit(0.17, DECO_U, SH_Z0 + 0.27, "3", accent, sz=0.2)
        digit(-0.15, -DECO_U, SH_Z0 + 0.3, "3", accent, sz=0.24, back=True)
        digit(0.17, -DECO_U, SH_Z0 + 0.3, "2", accent, sz=0.24, back=True)
    sleeves(main)
    sleeve_rings(trim, ts=(0.55,), r=0.14)
    wristbands(trim)


def top_tubetop(main, trim, accent, _d=None):
    """A tube top with a star on the front, bare shoulders and wristbands."""
    with part("chest"):
        torso(main, z1=TOP - 0.17)
        band(TOP - 0.22, TOP - 0.15, WHITE, grow=UNDER + 0.03, bevel=0.02)  # elastic trim
        for i in range(5):
            a = R(90 + 72 * i)
            box(0.09 * math.cos(a), DECO_U, SH_Z0 + 0.28 + 0.09 * math.sin(a), 0.06, 0.03, 0.16, trim, rot=(0, R(-72 * i), 0))
    wristbands(accent, r=0.13)


def top_bandtee(main, trim, accent, _d=None):
    """A long-sleeved band tee with a lightning bolt, and a bandana tied over everything."""
    with part("chest"):
        torso(main, z1=TOP - 0.02)
        pts = ((0.08, 0.34), (-0.1, 0.16), (0.1, 0.16), (-0.08, -0.02))
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):  # flat, so it stays under an overalls bib
            limb((x0, DECO_U, SH_Z0 + 0.18 + z0), (x1, DECO_U, SH_Z0 + 0.18 + z1), 0.045, accent, n=4)
        box(0, 0, TOP + 0.05, TW * 0.8, TD * 0.9, 0.14, trim, bevel=0.05)  # bandana
        can(0, BIB_Y - 0.06, TOP - 0.12, 0.28, 0.04, trim, n=3, rot=(R(90), 0, 0))  # its knot, in front of a bib
        for s in (-1, 1):
            can(s * 0.15, BIB_Y - 0.09, TOP - 0.14, 0.035, 0.02, WHITE, n=6, rot=(R(90), 0, 0))
    sleeves(main)
    wristbands((0.12, 0.12, 0.14))


def top_hoodie(main, trim, accent, _d=None):
    """A hoodie with the hood down, a kangaroo pocket and drawstrings."""
    with part("chest"):
        outer(main)
        band(HEM_Z - 0.05, HEM_Z + 0.07, trim, grow=OUTER + 0.04)  # ribbed hem
        box(0, FRONT_O - 0.03, SH_Z0 + 0.14, TW * 0.62, 0.05, 0.3, trim, bevel=0.02)  # kangaroo pocket
        _hood_down(main, trim)
        for s in (-1, 1):  # drawstrings
            limb((s * 0.15, FRONT_O - 0.03, TOP + 0.02), (s * 0.18, FRONT_O - 0.04, TOP - 0.36), 0.03, accent)
            ball(s * 0.18, FRONT_O - 0.04, TOP - 0.39, 0.08, 0.08, 0.1, accent, seg=6, ring=4)
    sleeves(main)
    cuffs(trim)


def top_cardigan(main, trim, accent, _d=None):
    """An open cardigan over a tucked-in tee, with a pompom brooch."""
    with part("chest"):
        torso(trim)  # the tee underneath
        pw = TW * 0.42
        for s in (-1, 1):  # open-front panels, as wide as any outer top, and their buttons
            box(s * ((TW + OUTER) / 2 - pw / 2), 0, (HEM_Z + TOP) / 2, pw, TD + OUTER, TOP - HEM_Z, main, bevel=0.06)
            for i in range(2):
                can(s * 0.26, FRONT_O - 0.02, SH_Z0 + 0.1 + i * 0.25, 0.05, 0.04, WHITE, n=8, rot=(R(90), 0, 0))
        box(0, BACK_O - 0.04, (HEM_Z + TOP) / 2, TW * 0.5, 0.08, TOP - HEM_Z, main, bevel=0.03)
        box(0, 0, TOP + 0.03, TW * 0.85, TD * 0.92, 0.12, main, bevel=0.05)
        ball(0.3, FRONT_O - 0.04, SH_Z0 + 0.02, 0.12, 0.05, 0.1, accent, seg=6, ring=4)
    sleeves(main)
    cuffs(WHITE)


def top_raincoat(main, trim, accent, _d=None):
    """A long rain jacket with the hood down, toggles and pocket flaps."""
    with part("chest"):
        outer(main, z0=SH_Z0 - 0.3)
        box(0, FRONT_O - 0.02, (SH_Z0 - 0.3 + TOP) / 2, 0.04, 0.04, TOP - SH_Z0 + 0.25, trim)  # placket
        for i in range(3):  # toggles
            box(0.12, FRONT_O - 0.03, SH_Z0 - 0.15 + i * 0.25, 0.14, 0.05, 0.06, (0.25, 0.25, 0.3), bevel=0.02)
        for s in (-1, 1):
            box(s * 0.3, FRONT_O - 0.02, SH_Z0 - 0.12, 0.26, 0.04, 0.05, trim)  # pocket flaps
        _hood_down(main, accent)
    sleeves(main, r=0.13)
    cuffs(trim)


def top_sweatervest(main, trim, accent, detail):
    """An argyle sweater vest over a tucked-in shirt, with a collar and a bow tie."""
    with part("chest"):
        torso(trim)  # the shirt
        outer(main, z1=TOP - 0.12)
        for s in (-1, 1):  # V neck
            box(s * 0.13, FRONT_O - 0.02, TOP - 0.2, 0.18, 0.04, 0.28, trim, rot=(0, R(s * 30), 0))
        for x, z in ((-0.25, 0.1), (0.25, 0.1), (0, -0.03)):  # argyle diamonds
            box(x, FRONT_O - 0.02, SH_Z0 + 0.12 + z, 0.17, 0.04, 0.17, accent, rot=(0, R(45), 0))
        for s in (-1, 1):  # collar points and a bow tie
            box(s * 0.2, FRONT_U - 0.03, TOP - 0.01, 0.26, 0.06, 0.12, WHITE, rot=(0, R(s * -20), 0))
            can(s * 0.14, FRONT_O - 0.05, TOP - 0.1, 0.13, 0.22, detail, n=4, r2=0.02, rot=(0, R(s * -90), 0))
        box(0, FRONT_O - 0.07, TOP - 0.1, 0.08, 0.06, 0.09, detail)
    sleeves(trim)


def top_puffer(main, trim, accent, _d=None):
    """A quilted puffer vest over a tucked-in long-sleeved tee, and a backpack."""
    with part("chest"):
        torso(trim)  # the tee
        for z in (SH_Z0 - 0.04, SH_Z0 + 0.21, SH_Z0 + 0.46):  # quilted puffy bands
            box(0, 0, z, TW + OUTER + 0.02, TD + OUTER + 0.02, 0.27, main, bevel=0.1, segs=2)
        box(0, 0, TOP + 0.02, TW * 0.85, TD * 0.95, 0.2, main, bevel=0.08)  # stand-up collar
        box(0, FRONT_O - 0.03, SH_Z0 + 0.22, 0.04, 0.04, 0.72, (0.85, 0.85, 0.85))  # zip, within the hem
        box(0, BACK_O + 0.22, SH_Z0 + 0.25, TW * 0.8, 0.42, 0.75, accent, bevel=0.12, segs=2)  # backpack
        box(0, BACK_O + 0.44, SH_Z0 + 0.1, TW * 0.55, 0.12, 0.32, (1.0, 0.85, 0.3), bevel=0.06)
        for s in (-1, 1):
            box(s * 0.28, FRONT_O - 0.03, SH_Z0 + 0.35, 0.1, 0.04, 0.5, accent)
    sleeves(trim)


def top_sweater(main, trim, accent, _d=None):
    """An oversized striped sweater with long bunched sleeves, and headphones round the neck."""
    with part("chest"):
        outer(main, z0=SH_Z0 - 0.22, z1=TOP)
        for i in range(3):
            box(0, 0, SH_Z0 - 0.1 + i * 0.22, TW + OUTER + 0.03, TD + OUTER + 0.03, 0.09, trim, bevel=0.02)
        for s in (-1, 1):  # headphones
            can(s * 0.42, -0.1, TOP + 0.12, 0.2, 0.14, accent, n=8, rot=(0, R(90), 0))
            can(s * 0.5, -0.1, TOP + 0.12, 0.13, 0.06, (0.2, 0.2, 0.22), n=8, rot=(0, R(90), 0))
        box(0, 0.2, TOP + 0.08, 0.84, 0.12, 0.1, accent, bevel=0.03)
    sleeves(main, r=0.13)
    sleeve_rings(trim, ts=(0.3, 0.6), r=0.14)
    sleeve_rings(main, ts=(0.95,), r=0.16)


# ---------------------------------------------------------------- bottoms (hips and legs)

def bottom_pants(main, trim, _a=None, _d=None):
    """Plain straight trousers with turn-ups."""
    waist(main)
    pant_legs(main)
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.42), (fx, 0, FOOT * 0.54), 0.14, trim)


def bottom_jeans(main, trim, accent, _d=None):
    """Ripped jeans: a torn knee, patch pockets on the back and a belt."""
    waist(main)
    pant_legs(main)
    with part("leg.r"):
        box(-TW * 0.24 - 0.02, -0.12, 0.42, 0.14, 0.03, 0.08, trim)  # torn knee
    with part("leg.l"):
        box(TW * 0.24 + 0.03, -0.12, 0.33, 0.1, 0.03, 0.07, trim)
    with part("body"):
        for s in (-1, 1):
            box(s * 0.24, -FRONT_B + 0.015, HIP + 0.16, 0.26, 0.03, 0.22, accent, bevel=0.01)
        box(0, 0, WAIST_Z - 0.05, TW + BOTTOM + 0.04, TD + BOTTOM + 0.04, 0.08, accent, bevel=0.02)  # belt


def bottom_joggers(main, trim, _a=None, _d=None):
    """Joggers with side stripes and gathered cuffs."""
    waist(main)
    pant_legs(main, r=0.13)
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, FOOT * 0.56), 0.145, trim)  # cuff
            box(fx + s * 0.125, 0, (FOOT * 0.56 + HIP) / 2, 0.03, 0.07, HIP - FOOT * 0.56, trim)  # side stripe
    with part("body"):
        for s in (-1, 1):
            box(s * ((TW + BOTTOM) / 2 + 0.012), 0, (HIP - 0.06 + WAIST_Z) / 2, 0.025, 0.07, WAIST_Z - HIP + 0.06, trim)


def bottom_shorts(main, trim, accent, detail):
    """Sports shorts with side stripes, and long striped socks."""
    socks(accent, stripe=detail)
    with part("body"):
        box(0, 0, HIP + 0.08, TW + BOTTOM + 0.06, TD + BOTTOM + 0.04, 0.38, main, bevel=0.06)
        for s in (-1, 1):
            box(s * ((TW + BOTTOM + 0.06) / 2 + 0.012), 0, HIP + 0.08, 0.025, TD + BOTTOM + 0.06, 0.38, trim)
    waist(main, z0=HIP + 0.1)


def bottom_skirt(main, trim, accent, _d=None):
    """A flared skirt and knee socks."""
    socks(trim, top=0.5)
    waist(main)
    with part("body"):
        can(0, 0, HIP + 0.15, 0.85, 0.36, main, n=8, r2=0.5, rot=(0, 0, R(22.5)))  # short enough for a lifted foot
        can(0, 0, HIP + 0.0, 0.86, 0.06, accent, n=8, rot=(0, 0, R(22.5)))  # a band round the hem


def bottom_tutu(main, trim, accent, _d=None):
    """A layered tutu over leggings."""
    pant_legs(accent, r=0.12, z0=FOOT * 0.4)
    waist(accent)
    with part("body"):
        for i, (r, r2, z) in enumerate(((0.95, 0.55, HIP + 0.16), (0.85, 0.5, HIP + 0.26))):
            can(0, 0, z, r, 0.2, main if i == 0 else trim, n=12, r2=r2)


def bottom_overalls(main, trim, _a=None, _d=None):
    """Denim overalls with rolled-up legs (the bib is overalls_bib, which outer tops hide)."""
    waist(main)
    for s in (-1, 1):
        fx = s * TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP + 0.02), 0.13, main)
            limb((fx, 0, FOOT * 0.42), (fx, 0, FOOT * 0.56), 0.16, trim)


def overalls_bib(main, trim, accent, _d=None):
    """The overalls' bib, its pocket and the straps with their buttons: over an undertop's prints,
    under its bandana."""
    with part("chest"):
        z0, z1 = WAIST_Z - 0.1, SH_Z0 + 0.46  # from inside the waistband up the chest
        for y in (BIB_Y, -BIB_Y):
            box(0, y, (z0 + z1) / 2, TW * 0.62, 0.05, z1 - z0, main, bevel=0.02)
        box(0, BIB_Y - 0.04, SH_Z0 + 0.24, TW * 0.3, 0.03, 0.2, trim, bevel=0.01)  # bib pocket
        for s in (-1, 1):
            x = s * TW * 0.26
            box(x, 0, TOP + 0.06, 0.16, -2 * BIB_Y + 0.05, 0.06, main)  # over the shoulder
            for y in (BIB_Y, -BIB_Y):
                box(x, y, (z1 + TOP + 0.06) / 2, 0.16, 0.05, TOP + 0.06 - z1, main)
            can(x, BIB_Y - 0.04, z1 - 0.04, 0.06, 0.03, accent, n=8, rot=(R(90), 0, 0))


# ---------------------------------------------------------------- shoes (the feet)

def shoes_sneakers(main, trim, accent, _d=None):
    """Sneakers: laces, a sole and a side flash."""
    def one(fx):
        shoe_box(fx, main)
        box(fx, -FOOT * 0.62, FOOT * 0.36, FOOT * 0.4, 0.12, 0.06, trim, bevel=0.02)  # laces
        box(fx, -FOOT * 0.25, FOOT * 0.02, FOOT * 0.8, FOOT * 1.2, 0.07, trim, bevel=0.02)  # sole
        box(fx + math.copysign(FOOT * 0.38, fx), -FOOT * 0.25, FOOT * 0.24, 0.03, FOOT * 0.5, 0.08, accent, rot=(R(-15), 0, 0))
    each_foot(one)


def shoes_classic(main, trim, _a=None, _d=None):
    """Plain round-toed shoes with a strap."""
    def one(fx):
        shoe_box(fx, main)
        box(fx, -FOOT * 0.3, FOOT * 0.42, FOOT * 0.8, FOOT * 0.16, 0.06, trim, bevel=0.02)  # strap
    each_foot(one)


def shoes_hightops(main, trim, accent, _d=None):
    """High-top trainers: a padded ankle, a toe cap and laces."""
    def one(fx):
        shoe_box(fx, main)
        can(fx, 0.0, FOOT * 0.62, 0.17, 0.3, main, n=8)  # ankle
        can(fx, 0.0, FOOT * 0.62 + 0.15, 0.18, 0.05, trim, n=8)
        box(fx, -FOOT * 0.72, FOOT * 0.14, FOOT * 0.7, 0.12, FOOT * 0.26, trim, bevel=0.04)  # toe cap
        box(fx, -FOOT * 0.25, FOOT * 0.02, FOOT * 0.8, FOOT * 1.2, 0.07, trim, bevel=0.02)  # sole
        for i in range(3):
            box(fx, -0.17, FOOT * 0.38 + i * 0.1, 0.18, 0.05, 0.04, accent)  # laces up the front of the ankle
    each_foot(one)


def shoes_wellies(main, trim, _a=None, _d=None):
    """Rain boots up to the knee."""
    def one(fx):
        shoe_box(fx, main)
        can(fx, 0, 0.42, 0.17, 0.3, main, n=8)
        can(fx, 0, 0.6, 0.19, 0.08, trim, n=8)
    each_foot(one)


def shoes_boots(main, trim, accent, _d=None):
    """Chunky lace-up boots with a thick sole."""
    def one(fx):
        shoe_box(fx, main, grow=0.03)
        can(fx, 0.0, FOOT * 0.6, 0.16, 0.26, main, n=8)
        box(fx, -FOOT * 0.25, FOOT * 0.03, FOOT * 0.82, FOOT * 1.22, 0.1, trim, bevel=0.03)  # sole
        for i in range(3):
            box(fx, -0.16, FOOT * 0.36 + i * 0.1, 0.18, 0.05, 0.04, accent)  # laces up the front of the ankle
    each_foot(one)


# ---------------------------------------------------------------- props (held in the left mitt)

def _held(build, side=1, tilt=(0, 0, 0)):
    return _props.mount(build, hand_points()[side], tilt)


class _bucket_colours:
    """Paint props.bucket in the given colours while it is drawn."""
    def __init__(self, main, trim):
        self.new = {"PUMPKIN": main, "PUMPKIN_D": trim}

    def __enter__(self):
        self.old = {k: getattr(_props, k) for k in self.new}
        for k, v in self.new.items():
            setattr(_props, k, v)

    def __exit__(self, *a):
        for k, v in self.old.items():
            setattr(_props, k, v)


def prop_bucket(main, trim, _a=None, _d=None, side=1, full=False):
    """The jack-o'-lantern candy bucket."""
    with _bucket_colours(main, trim):
        _props.bucket(hand_points()[side], full=full, size=0.6)


def prop_bucket_full(main, trim, _a=None, _d=None, side=1):
    """The bucket, piled with candy."""
    prop_bucket(main, trim, side=side, full=True)


def prop_sack(main, trim, accent, _d=None, side=1):
    """A pillowcase candy sack, gathered and tied at the top where the mitt holds it."""
    def build():
        can(0, 0, -0.06, 0.12, 0.2, main, n=8, r2=0.09)  # gathered neck
        can(0, 0, -0.12, 0.15, 0.07, trim, n=8)  # tie
        ball(0, 0, -0.43, 0.72, 0.58, 0.58, main, seg=8, ring=6)  # no deeper than the full bucket
        box(0, -0.28, -0.45, 0.28, 0.04, 0.28, accent, rot=(0, R(45), 0))  # a sticker
    _held(build, side)


def prop_flashlight(main, trim, _a=None, _d=None, side=1):
    """A torch, pointing ahead."""
    def build():
        can(0, -0.1, 0, 0.09, 0.55, main, n=8, rot=(R(90), 0, 0))
        can(0, -0.45, 0, 0.15, 0.22, trim, n=8, r2=0.1, rot=(R(-90), 0, 0))
        can(0, -0.57, 0, 0.13, 0.03, (1.0, 0.95, 0.6), n=8, rot=(R(90), 0, 0))  # the lamp face (opaque)
        box(0, -0.05, 0.09, 0.06, 0.12, 0.04, trim)  # switch
    _held(build, side)


def prop_lollipop(main, trim, _a=None, _d=None, side=1):
    """A swirly lollipop held out to the side: anything pointing up from a mitt hits the big head when the arm comes forward."""
    def build():
        limb((0, 0, -0.15), (0, 0, 0.4), 0.04, WHITE)
        can(0, 0, 0.58, 0.24, 0.12, main, n=12, rot=(R(90), 0, 0))
        pts = [(0.2 * (k / 22) * math.cos(k * 0.75), 0.58 + 0.2 * (k / 22) * math.sin(k * 0.75)) for k in range(4, 23)]
        for y, flip in ((-0.065, False), (0.065, True)):
            stroke([(-x if flip else x, z) for x, z in pts], 0.06, y, trim, depth=0.02)
    _held(build, side, tilt=(0, side * 75, 0))


def prop_wand(main, trim, _a=None, _d=None, side=1):
    """A short star wand held out to the side, clear of the head."""
    def build():
        limb((0, 0, -0.15), (0, 0, 0.5), 0.045, main)
        star = [(0.24 * (1 if i % 2 == 0 else 0.45) * math.cos(R(90 + 36 * i)), 0.7 + 0.24 * (1 if i % 2 == 0 else 0.45) * math.sin(R(90 + 36 * i)))
                for i in range(10)]
        slab(star, 0, trim, depth=0.1)
    _held(build, side, tilt=(0, side * 75, 0))


def prop_teddy(main, trim, accent, _d=None, side=1):
    """A teddy bear carried by the arm, dangling."""
    def build():
        cz = -0.48
        ball(0, 0, cz, 0.42, 0.34, 0.5, main, seg=8, ring=6)  # body
        ball(0, -0.15, cz - 0.02, 0.24, 0.06, 0.28, trim, seg=8, ring=4)  # tummy
        ball(0, 0, cz + 0.38, 0.38, 0.34, 0.34, main, seg=8, ring=6)  # head
        ball(0, -0.17, cz + 0.34, 0.15, 0.08, 0.11, trim, seg=6, ring=4)  # muzzle
        ball(0, -0.21, cz + 0.37, 0.05, 0.03, 0.04, DARK, seg=6, ring=4)
        for s in (-1, 1):
            ball(s * 0.15, 0, cz + 0.55, 0.13, 0.08, 0.13, main, seg=6, ring=4)  # ears
            ball(s * 0.08, -0.17, cz + 0.43, 0.04, 0.02, 0.05, DARK, seg=6, ring=4)  # eyes
            ball(s * 0.12, -0.02, cz - 0.27, 0.15, 0.16, 0.12, main, seg=6, ring=4)  # feet
            limb((s * 0.18, 0, cz + 0.1), (s * 0.26, -0.04, cz - 0.08), 0.06, main)  # arms
        limb((0.18, 0, cz + 0.1), (0.05, 0, 0.0), 0.06, main)  # the arm the kid holds it by
        for s in (-1, 1):
            can(s * 0.07, -0.12, cz + 0.2, 0.06, 0.1, accent, n=4, r2=0.01, rot=(0, R(s * -90), 0))  # a bow tie
    _held(build, side)


# ---------------------------------------------------------------- the catalog

def item(build, channels, ways, **extra):
    """An item: its builder, what its channels are called (the ones it uses), and its colourways
    (name -> colours, in channel order)."""
    return {"build": build, "channels": channels, "ways": {k: _c(*v) for k, v in ways.items()}, **extra}


HAIRWAYS = {k: (v, CLOTH["pink"], CLOTH["butter"]) for k, v in HAIR.items()}

ITEMS = {
    "hair": {
        "crop": item(hair_crop, {"main": "Hair"}, {k: (v,) for k, v in HAIR.items()}),
        "anime": item(lambda m, *_: hair_anime(m), {"main": "Hair"}, {k: (v,) for k, v in HAIR.items()}),
        "swoop": item(lambda m, *_: hair_swoop(m), {"main": "Hair"}, {k: (v,) for k, v in HAIR.items()}),
        "quiff": item(lambda m, *_: hair_quiff(m), {"main": "Hair"}, {k: (v,) for k, v in HAIR.items()}),
        "mohawk": item(lambda m, t, *_: hair_mohawk(m, t), {"main": "Hair", "trim": "Shaved sides"},
                       {"punk": (HAIR["pink"], HAIR["black"]), "lime": ("lime", HAIR["dark"]), "blue": (HAIR["blue"], HAIR["blonde"]),
                        "natural": (HAIR["brown"], HAIR["dark"])}),
        "afro": item(lambda m, t, *_: hair_afro(m, t), {"main": "Hair", "trim": "Comb"}, {k: (v, (0.95, 0.35, 0.45)) for k, v in HAIR.items()}),
        "cloud": item(lambda m, *_: hair_cloud(m), {"main": "Hair"}, {k: (v,) for k, v in HAIR.items()}),
        "puffs": item(lambda m, t, *_: hair_puffs(m, t), {"main": "Hair", "trim": "Ties"}, HAIRWAYS),
        "braids": item(lambda m, t, *_: hair_braids(m, t), {"main": "Hair", "trim": "Bows"}, {k: (v, (0.35, 0.75, 0.55)) for k, v in HAIR.items()}),
        "ponytail": item(lambda m, t, *_: hair_fountain(m, t), {"main": "Hair", "trim": "Scrunchie"}, {k: (v, (0.3, 0.7, 0.95)) for k, v in HAIR.items()}),
        "long": item(lambda m, t, *_: hair_cape(m, t), {"main": "Hair", "trim": "Flower"}, {k: (v, WHITE) for k, v in HAIR.items()}),
    },
    "face": {
        "none": item(None, {}, {"-": ()}),
        "freckles": item(face_freckles, {"main": "Freckles"}, {"brown": ((0.68, 0.40, 0.26),), "dark": ((0.40, 0.24, 0.16),)}),
        "round-glasses": item(face_glasses_round, {"main": "Frames"}, {"black": ("black",), "red": ("red",), "tortoise": ("brown",), "teal": ("teal",)}),
        "square-glasses": item(face_glasses_square, {"main": "Frames"}, {"black": ("black",), "blue": ("blue",), "pink": ("pink",), "gold": ("gold",)}),
        "plaster": item(face_plaster, {"main": "Plaster", "trim": "Pad"}, {"plain": ("tan", "cream"), "stars": ("sky", "yellow"), "pink": ("pink", "white")}),
    },
    "top": {
        "tee": item(top_tee, {"main": "Tee", "trim": "Collar", "accent": "Pocket"},
                    {"white": ("white", "red", "sky"), "green": ("green", "cream", "butter"), "black": ("black", "pink", "pink"), "yellow": ("yellow", "navy", "navy")}),
        "stripy": item(top_stripy, {"main": "Top", "trim": "Stripes"},
                       {"sailor": ("cream", (0.95, 0.35, 0.35)), "navy": ("navy", "white"), "bee": ("yellow", "black"), "mint": ("mint", "lilac")}),
        "hoodie": item(top_hoodie, {"main": "Hoodie", "trim": "Trim", "accent": "Strings"},
                       {"red": ("red", "butter", "white"), "grey": ("grey", "charcoal", "white"), "lilac": ("lilac", "mint", "white"), "green": ("green", "orange", "cream")}, outer=True),
        "jersey": item(top_jersey, {"main": "Jersey", "trim": "Trim", "accent": "Number"},
                       {"gold": ("gold", "purple", "purple"), "red": ("red", "white", "white"), "teal": ("teal", "black", "white"), "blue": ("blue", "orange", "white")}),
        "cardigan": item(top_cardigan, {"main": "Cardigan", "trim": "Tee", "accent": "Pompom"},
                         {"mint": ("mint", (0.98, 0.95, 0.90), (1.0, 0.6, 0.7)), "mustard": ("gold", "cream", "red"), "rose": ("rose", "white", "sky"), "navy": ("navy", "butter", "white")}, outer=True),
        "tube-top": item(top_tubetop, {"main": "Top", "trim": "Star", "accent": "Wristbands"},
                         {"pink": ("pink", (1.0, 0.9, 0.3), (1.0, 0.85, 0.3)), "sky": ("sky", "white", "pink"), "lime": ("lime", "purple", "purple"), "black": ("black", "gold", "gold")}),
        "raincoat": item(top_raincoat, {"main": "Coat", "trim": "Trim", "accent": "Lining"},
                         {"yellow": ("yellow", (0.85, 0.6, 0.1), (0.3, 0.6, 0.9)), "red": ("red", "navy", "butter"), "green": ("green", "yellow", "orange"), "sky": ("sky", "white", "pink")}, outer=True),
        "band-tee": item(top_bandtee, {"main": "Tee", "trim": "Bandana", "accent": "Bolt"},
                         {"rock": ((0.16, 0.16, 0.20), (0.9, 0.2, 0.25), (1.0, 0.85, 0.2)), "white": ("white", "navy", "red"), "purple": ("purple", "black", "lime"), "red": ("red", "black", "white")}),
        "sweater-vest": item(top_sweatervest, {"main": "Vest", "trim": "Shirt", "accent": "Diamonds", "detail": "Bow tie"},
                             {"green": ((0.30, 0.55, 0.45), (0.98, 0.97, 0.95), (0.98, 0.80, 0.35), (0.9, 0.2, 0.25)), "navy": ("navy", "white", "red", "red"),
                              "brown": ("brown", "sky", "cream", "navy"), "plum": ("purple", "cream", "pink", "gold")}, outer=True),
        "puffer": item(top_puffer, {"main": "Vest", "trim": "Top", "accent": "Backpack"},
                       {"teal": ("teal", (0.98, 0.55, 0.20), (0.9, 0.3, 0.3)), "black": ("black", "red", "yellow"), "pink": ("pink", "navy", "mint"), "orange": ("orange", "grey", "blue")}, outer=True),
        "sweater": item(top_sweater, {"main": "Sweater", "trim": "Stripes", "accent": "Headphones"},
                        {"midnight": ("navy", (0.98, 0.97, 0.94), (0.4, 0.85, 0.95)), "cream": ("cream", "red", "black"), "forest": ("green", "butter", "white"), "lilac": ("lilac", "white", "pink")}, outer=True),
    },
    "bottom": {
        "pants": item(bottom_pants, {"main": "Trousers", "trim": "Turn-ups"},
                      {"charcoal": ((0.25, 0.27, 0.35), (0.25, 0.27, 0.35)), "khaki": ("tan", "tan"), "brown": ((0.40, 0.32, 0.25), (0.40, 0.32, 0.25)),
                       "grey": ("grey", "grey"), "yellow": ("yellow", "yellow"), "red": ("red", "red")}),
        "jeans": item(bottom_jeans, {"main": "Denim", "trim": "Rips", "accent": "Pockets and belt"},
                      {"light": ((0.45, 0.6, 0.85), (0.95, 0.92, 0.85), (0.38, 0.52, 0.78)), "dark": ("navy", "sky", "brown"), "black": ("black", "grey", "charcoal")}),
        "joggers": item(bottom_joggers, {"main": "Joggers", "trim": "Stripes and cuffs"},
                        {"grey": ("grey", "white"), "navy": ("navy", "red"), "black": ("black", "white"), "pink": ("pink", "white")}),
        "shorts": item(bottom_shorts, {"main": "Shorts", "trim": "Stripes", "accent": "Socks", "detail": "Sock stripes"},
                       {"purple": ("purple", "gold", "white", "purple"), "khaki": ((0.55, 0.42, 0.30), (0.55, 0.42, 0.30), (0.9, 0.9, 0.9), (0.30, 0.55, 0.45)),
                        "red": ("red", "white", "white", "red"), "denim": ("blue", "blue", "white", "sky")}),
        "skirt": item(bottom_skirt, {"main": "Skirt", "trim": "Socks", "accent": "Hem"},
                      {"rose": ((0.95, 0.45, 0.55), "white", (0.95, 0.45, 0.55)), "navy": ("navy", "white", "white"), "tartan": ("red", "black", "gold"), "denim": ("blue", "white", "sky")}),
        "tutu": item(bottom_tutu, {"main": "Tutu", "trim": "Top layer", "accent": "Leggings"},
                     {"lilac": ("lilac", (1.0, 0.82, 0.92), (0.35, 0.28, 0.55)), "mint": ("mint", "white", "teal"), "gold": ("gold", "butter", "black"), "pink": ("pink", "rose", "navy")}),
        "overalls": item(bottom_overalls, {"main": "Denim", "trim": "Turn-ups", "accent": "Buttons"},
                         {"denim": ((0.28, 0.45, 0.80), (0.55, 0.7, 0.9), (0.98, 0.78, 0.25)), "red": ("red", "cream", "white"), "yellow": ("yellow", "white", "blue"),
                          "brown": ("brown", "tan", "gold")}, bib=overalls_bib),
    },
    "shoes": {
        "sneakers": item(shoes_sneakers, {"main": "Shoe", "trim": "Laces and sole", "accent": "Flash"},
                         {"white": ("white", (0.9, 0.2, 0.2), "white"), "black": ("black", "white", "white"), "blue": ((0.3, 0.6, 0.95), "white", "white"), "red": ("red", "white", "yellow")}),
        "classic": item(shoes_classic, {"main": "Shoe", "trim": "Strap"},
                        {"red": ((0.85, 0.2, 0.3), (0.85, 0.2, 0.3)), "yellow": ((0.98, 0.85, 0.30), (0.98, 0.85, 0.30)), "brown": ((0.45, 0.25, 0.12), (0.45, 0.25, 0.12)),
                         "gold": ((0.95, 0.75, 0.25), (0.95, 0.75, 0.25)), "black": ("black", "black")}),
        "high-tops": item(shoes_hightops, {"main": "Shoe", "trim": "Toe and sole", "accent": "Laces"},
                          {"red": ("red", "white", "white"), "black": ("black", "white", "white"), "purple": ("purple", "white", "lime"), "teal": ("teal", "cream", "orange")}),
        "wellies": item(shoes_wellies, {"main": "Boot", "trim": "Rim"},
                        {"red": ((0.92, 0.22, 0.25), WHITE), "yellow": ("yellow", "white"), "green": ("green", "yellow"), "navy": ("navy", "red")}),
        "boots": item(shoes_boots, {"main": "Boot", "trim": "Sole", "accent": "Laces"},
                      {"brown": ("brown", "charcoal", "tan"), "black": ("black", "charcoal", "red"), "tan": ("tan", "brown", "red")}),
    },
    "prop": {
        "none": item(None, {}, {"-": ()}),
        "bucket": item(prop_bucket, {"main": "Bucket", "trim": "Rim"},
                       {"pumpkin": (_props.PUMPKIN, _props.PUMPKIN_D), "ghost": ("white", "grey"), "purple": ("purple", "lilac"), "green": ("lime", "green")}),
        "bucket-full": item(prop_bucket_full, {"main": "Bucket", "trim": "Rim"},
                            {"pumpkin": (_props.PUMPKIN, _props.PUMPKIN_D), "ghost": ("white", "grey"), "purple": ("purple", "lilac"), "green": ("lime", "green")}),
        "sack": item(prop_sack, {"main": "Sack", "trim": "Tie", "accent": "Sticker"},
                     {"white": ("white", "orange", "purple"), "striped": ("sky", "red", "yellow"), "black": ("charcoal", "orange", "lime")}),
        "flashlight": item(prop_flashlight, {"main": "Body", "trim": "Head"}, {"red": ("red", "charcoal"), "yellow": ("yellow", "black"), "blue": ("blue", "grey")}),
        "lollipop": item(prop_lollipop, {"main": "Candy", "trim": "Swirl"}, {"strawberry": ("pink", "white"), "lemon": ("yellow", "orange"), "rainbow": ("sky", "lilac")}),
        "wand": item(prop_wand, {"main": "Stick", "trim": "Star"}, {"gold": ("purple", "gold"), "pink": ("white", "pink"), "silver": ("navy", (0.85, 0.87, 0.9))}),
        "teddy": item(prop_teddy, {"main": "Fur", "trim": "Tummy", "accent": "Bow"}, {"brown": ("brown", "tan", "red"), "honey": ("gold", "cream", "sky"), "pink": ("rose", "white", "purple")}),
    },
}


def colours(slot, name, way):
    """An item's colours, in channel order, from a colourway name or a tuple of colours. A colourway
    may name fewer channels than the item has; the missing ones repeat the last."""
    it = ITEMS[slot][name]
    cs = it["ways"][way] if isinstance(way, str) else _c(*way)
    cs = tuple(cs) or (WHITE,)
    return cs + (cs[-1],) * (4 - len(cs))


def draw(slot, name, cs, side=1):
    """Draw one item in the colours cs (four, channel order)."""
    it = ITEMS[slot][name]
    if it["build"] is None:
        return
    if slot == "prop":
        it["build"](*cs, side=side)
    elif slot in ("hair", "face"):
        with part("head"):
            it["build"](*cs)
    else:
        it["build"](*cs)


def dress(look, skin=SKIN):
    """Draw a whole kid: the base and one item per slot. `look` is {slot: (item, colourway)} with
    optional "side" (the mitt holding the prop: 1 left, -1 right)."""
    base_kid(skin)
    side = look.get("side", 1)
    for slot in SLOTS:
        name, way = look[slot]
        cs = colours(slot, name, way)
        draw(slot, name, cs, side)
        if slot == "bottom" and ITEMS[slot][name].get("bib") and not ITEMS["top"][look["top"][0]].get("outer"):
            ITEMS[slot][name]["bib"](*cs)


def kit_proxy():
    """The stand-in the kit's clips are baked on (rig/export_kit.py): the base kid and the pieces
    that reach furthest (every big hairstyle, the widest skirts, the longest coat and the puffer's
    backpack, wellies, the full bucket) all at once, so the floor guard and the gait suit every
    combination (a kid with small hair lies a little higher in the death clip)."""
    base_kid()
    for slot, name in [("hair", h) for h in ("braids", "long", "ponytail", "anime", "swoop", "cloud", "mohawk", "afro", "quiff")] + [
            ("top", "raincoat"), ("top", "puffer"), ("bottom", "tutu"), ("bottom", "skirt"), ("shoes", "wellies"), ("prop", "bucket-full")]:
        draw(slot, name, colours(slot, name, next(iter(ITEMS[slot][name]["ways"]))))
    for o in bpy.data.objects:
        if "bucket" in o:  # in the kit the prop is its own piece: no bucket switch
            del o["bucket"]
