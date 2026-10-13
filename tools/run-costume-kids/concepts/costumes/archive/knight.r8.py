"""Cardboard knight: a homemade knight on a hobby horse. A big cardboard box
helmet with a T-shaped visor cut out (the kid's eyes and grin show through),
foil rivets and a huge red feather-duster mohawk crest from the brow
over the top and down the back; a cardboard breastplate
with a felt-tip cross over a blue tunic; a painted cardboard shield on one
mitt and a foil-wrapped cardboard sword raised in the other; a sock-puppet
hobby horse on a short broomstick between the legs, strapped to a red belt."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

CARD, CARD_D, TAPE, INK = (0.80, 0.58, 0.34), (0.62, 0.42, 0.22), (0.92, 0.85, 0.62), (0.15, 0.12, 0.12)
FOIL, FOIL_D, PLUME, PLUME_D = (0.84, 0.86, 0.9), (0.62, 0.65, 0.7), (0.95, 0.2, 0.25), (0.78, 0.12, 0.18)
TUNIC, TIGHTS, BOOT, PAINT, GOLD = (0.22, 0.45, 0.9), (0.55, 0.56, 0.62), (0.45, 0.28, 0.14), (0.2, 0.42, 0.88), (1.0, 0.82, 0.15)
SOCK, SOCK_D, STICK, REIN, HAIR = (0.62, 0.38, 0.2), (0.25, 0.14, 0.08), (0.72, 0.5, 0.28), (0.9, 0.2, 0.25), (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def bar(p0, p1, w, d, rgb):
    """A flat rounded bar from p0 to p1 (w across, d thick)."""
    from mathutils import Vector as V
    p0, p1 = V(p0), V(p1)
    o = box(0, 0, 0, w, d, (p1 - p0).length, rgb, bevel=0.02)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = (p1 - p0).to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def build():
    body(shirt=TUNIC, pants=TUNIC, leg_colour=TIGHTS, shoe=BOOT, arms=False)
    fy = -TD * 0.5
    # the cardboard breastplate with a felt-tip cross, string ties at the shoulders
    box(0, -0.02, HIP + TH * 0.62, TW + 0.15, TD + 0.12, TH * 0.72, CARD, bevel=0.03)
    box(0, fy - 0.07, HIP + TH * 0.62, 0.14, 0.03, TH * 0.55, PLUME)
    box(0, fy - 0.07, HIP + TH * 0.72, 0.5, 0.03, 0.14, PLUME)
    # the hobby horse: a short broomstick between the legs, strapped to a red belt
    # so it rides along with the kid; its capped end sticks out behind, clear of the floor
    limb((0, 0.8, 0.3), (0, -1.3, 1.0), 0.07, STICK, n=6)
    ball(0, 0.8, 0.3, 0.2, 0.2, 0.2, REIN, seg=6, ring=4)
    box(0, 0, HIP + 0.08, TW + 0.2, TD + 0.2, 0.12, REIN, bevel=0.03)            # the belt
    for y, z in ((-0.42, 0.66), (0.42, 0.38)):                                      # straps down to the stick
        limb((0, y * 0.85, HIP + 0.05), (0, y, z), 0.045, REIN, n=6)
    hy, hz = -1.65, 1.15
    box(0, hy, hz, 0.85, 0.85, 0.8, SOCK, bevel=0.22, segs=2, rot=(math.radians(-15), 0, 0))
    box(0, hy - 0.55, hz - 0.1, 0.7, 0.7, 0.55, (0.98, 0.88, 0.74), bevel=0.18, segs=2)
    box(0, hy - 0.4, hz - 0.1, 0.74, 0.1, 0.57, REIN, bevel=0.03)  # the bridle
    for s in (-1, 1):
        ball(s * 0.25, hy - 0.4, hz + 0.2, 0.24, 0.1, 0.28, DARK, seg=8, ring=5)  # button eyes
        ball(s * 0.25 - 0.04, hy - 0.46, hz + 0.27, 0.06, 0.03, 0.06, WHITE, seg=6, ring=4)
        ball(s * 0.14, hy - 0.91, hz - 0.05, 0.1, 0.04, 0.08, INK, seg=6, ring=4)       # nostrils
        can(s * 0.24, hy + 0.1, hz + 0.5, 0.12, 0.3, SOCK, n=4, r2=0.01, rot=(0, s * math.radians(15), 0))  # ears
    for k in range(4):  # a yarn mane down the back of the head and the stick
        box(0, hy + 0.3 + k * 0.17, hz + 0.32 - k * 0.15, 0.2, 0.18, 0.24, SOCK_D, bevel=0.05)
    box(0, hy - 0.9, hz - 0.24, 0.3, 0.04, 0.05, INK)  # a stitched grin
    # the left mitt holds the painted cardboard shield
    lh = (-1.35, -0.35, 1.0)
    limb((-(TW * 0.5 + 0.08), 0, TOP - 0.15), lh, 0.11, TUNIC)
    hand_mitt(*lh, -1, MITT, SKIN)
    sx, sy, sz = -1.55, -0.62, 1.15
    rz = (0, 0, math.radians(-25))
    box(sx, sy, sz + 0.2, 1.15, 0.1, 1.0, CARD, bevel=0.03, rot=rz)
    can(sx, sy, sz - 0.3, 0.8, 0.1, CARD, n=4, r2=0.0, rot=(math.radians(90), 0, math.radians(-25)))
    # the painted face: a blue field, a yellow crayon star
    import mathutils
    d = mathutils.Matrix.Rotation(math.radians(-25), 3, "Z") @ mathutils.Vector((0, -0.07, 0))
    box(sx + d.x, sy + d.y, sz + 0.2, 0.95, 0.04, 0.82, PAINT, rot=rz)
    can(sx + d.x * 1.3, sy + d.y * 1.3, sz + 0.2, 0.3, 0.04, GOLD, n=5, rot=(math.radians(90), 0, math.radians(-25)))
    # the right mitt raises the foil cardboard sword
    rh = (1.68, -0.5, 1.3)
    limb(((TW * 0.5 + 0.08), 0, TOP - 0.15), rh, 0.11, TUNIC)
    hand_mitt(*rh, 1, MITT, SKIN)
    import mathutils as mu
    g = mu.Vector(rh) + mu.Vector((0.0, -0.05, 0.0))
    dvec = mu.Vector((0.12, -0.2, 1.0)).normalized()
    bar(g - dvec * 0.3, g + dvec * 0.25, 0.14, 0.14, TAPE)                     # taped grip
    q = dvec.to_track_quat("Z", "Y")
    o = box(0, 0, 0, 0.8, 0.16, 0.16, CARD_D, bevel=0.03)                     # crossguard
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = q
    o.location = g + dvec * 0.3
    bar(g + dvec * 0.35, g + dvec * 2.2, 0.36, 0.08, FOIL)
    bar(g + dvec * 0.45, g + dvec * 2.0, 0.06, 0.1, FOIL_D)                    # the fuller line                    # the blade
    o = can(0, 0, 0, 0.255, 0.3, FOIL, n=4, r2=0.0, rot=(0, 0, math.radians(45)))  # the point
    o.scale = (1, 0.3, 1)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = q
    o.location = g + dvec * 2.35
    # the box helmet
    hw, hd, hh = HEAD * 1.1, HEAD * 1.0, HEAD * 1.04
    hz2 = HEAD_Z
    box(0, 0, hz2, hw, hd, hh, CARD, bevel=0.03)
    box(0, 0, hz2 + hh / 2 + 0.01, hw * 0.98, 0.3, 0.04, TAPE)
    hy2 = -hd / 2
    # the T visor: eyes in the slot, the grin in the stem
    ez, mz = HEAD_Z + 0.05, HEAD_Z - 0.62
    box(0, hy2 - 0.005, ez, 2.2, 0.04, 0.72, INK)
    box(0, hy2 - 0.005, mz, 0.86, 0.04, 0.95, INK)
    box(0, hy2 - 0.025, ez, 2.06, 0.04, 0.58, SKIN)
    box(0, hy2 - 0.025, mz + 0.05, 0.72, 0.04, 0.95, SKIN)
    for s in (-1, 1):
        can(s * HEAD * 0.22, hy2 - 0.05, ez, 0.2, 0.06, DARK, n=10, rot=X90)
        can(s * HEAD * 0.22 - 0.07, hy2 - 0.08, ez + 0.08, 0.065, 0.04, WHITE, n=6, rot=X90)
        box(s * 0.78, hy2 - 0.05, ez - 0.17, 0.2, 0.03, 0.08, CHEEK)
    my = mz - 0.12
    box(0, hy2 - 0.05, my, 0.2, 0.04, 0.07, DARK)
    for s in (-1, 1):
        box(s * 0.13, hy2 - 0.05, my + 0.04, 0.11, 0.04, 0.07, DARK, rot=(0, s * math.radians(-40), 0))
    # foil rivets round the face, felt-tip breathing holes
    for x, z in ((-1.2, hz2 + 0.98), (1.2, hz2 + 0.98), (-1.2, hz2 - 1.0), (1.2, hz2 - 1.0)):
        can(x, hy2 - 0.03, z, 0.1, 0.06, FOIL, n=8, rot=X90)
    for s in (-1, 1):
        for k in range(3):
            can(s * (0.7 + k * 0.15), hy2 - 0.01, mz - 0.1 - (k % 2) * 0.12, 0.05, 0.03, INK, n=6, rot=X90)
    # a foil band round the bottom and the crest ridge
    box(0, 0, hz2 - hh / 2 + 0.1, hw + 0.04, hd + 0.04, 0.16, FOIL)
    box(0, 0, hz2 + hh / 2 + 0.08, 0.3, hd * 0.9, 0.16, FOIL_D, bevel=0.04)
    # a huge red feather-duster crest, a mohawk from the brow over the top and
    # down the back: fat bristles fanning out from the helmet's middle
    from mathutils import Vector as V
    top = hz2 + hh / 2 + 0.15
    box(0, 0.1, top + 0.05, 0.4, hd * 0.98, 0.3, GOLD, bevel=0.06)               # the holder ridge
    box(0, hd / 2 + 0.08, top - 0.6, 0.4, 0.3, 1.2, GOLD, bevel=0.06)
    c = V((0, 0.15, top - 1.0))
    base = [V((0, y, top + 0.1)) for y in (-1.15, -0.85, -0.55, -0.25, 0.05, 0.35, 0.65, 0.95, 1.2)]
    base += [V((0, hd / 2 + 0.15, z)) for z in (top - 0.3, top - 0.7, top - 1.1)]
    for i, p0 in enumerate(base):
        d = (p0 - c).normalized()
        L = 2.1 - abs(i - 4.5) * 0.12
        col = PLUME if i % 2 == 0 else PLUME_D
        bar(p0 - d * 0.2, p0 + d * L, 0.95, 0.5, col)
        tip = p0 + d * L
        ball(tip.x, tip.y, tip.z, 0.95, 0.6, 0.6, col, seg=8, ring=5)

if __name__ == "__main__" or True:
    render_costume("knight", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
