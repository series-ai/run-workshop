"""Cardboard knight: a homemade knight on a hobby horse. A big cardboard box
helmet with a T-shaped visor cut out (the kid's eyes and grin show through),
foil rivets and a fluffy red feather-duster plume; a cardboard breastplate
with a felt-tip cross over a blue tunic; a painted cardboard shield on one
mitt and a foil-wrapped cardboard sword raised in the other; a sock-puppet
hobby horse on a broomstick between the legs, its tip trailing behind."""
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
    # the hobby horse: a broomstick between the legs, trailing on the ground behind
    limb((0, 1.45, 0.08), (0, -1.15, 1.25), 0.07, STICK, n=6)
    hy, hz = -1.5, 1.45
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
    hw, hd, hh = 2.7, 2.45, 2.5
    hz2 = TOP + 0.15 + hh / 2
    box(0, 0, hz2, hw, hd, hh, CARD, bevel=0.03)
    box(0, 0, hz2 + hh / 2 + 0.01, hw * 0.98, 0.3, 0.04, TAPE)
    hy2 = -hd / 2
    # the T visor: eyes in the slot, the grin in the stem
    ez, mz = hz2 + 0.25, hz2 - 0.45
    box(0, hy2 - 0.005, ez, 2.0, 0.04, 0.68, INK)
    box(0, hy2 - 0.005, mz, 0.86, 0.04, 0.95, INK)
    box(0, hy2 - 0.025, ez, 1.86, 0.04, 0.54, SKIN)
    box(0, hy2 - 0.025, mz + 0.05, 0.72, 0.04, 0.95, SKIN)
    for s in (-1, 1):
        can(s * 0.5, hy2 - 0.05, ez, 0.16, 0.06, DARK, n=10, rot=X90)
        can(s * 0.5 - 0.05, hy2 - 0.08, ez + 0.06, 0.05, 0.04, WHITE, n=6, rot=X90)
        box(s * 0.78, hy2 - 0.05, ez - 0.17, 0.2, 0.03, 0.08, CHEEK)
    my = mz - 0.12
    box(0, hy2 - 0.05, my, 0.2, 0.04, 0.07, DARK)
    for s in (-1, 1):
        box(s * 0.13, hy2 - 0.05, my + 0.04, 0.11, 0.04, 0.07, DARK, rot=(0, s * math.radians(-40), 0))
    # foil rivets round the face, felt-tip breathing holes
    for x, z in ((-1.15, hz2 + 0.95), (1.15, hz2 + 0.95), (-1.15, hz2 - 0.95), (1.15, hz2 - 0.95)):
        can(x, hy2 - 0.03, z, 0.1, 0.06, FOIL, n=8, rot=X90)
    for s in (-1, 1):
        for k in range(3):
            can(s * (0.7 + k * 0.15), hy2 - 0.01, mz - 0.1 - (k % 2) * 0.12, 0.05, 0.03, INK, n=6, rot=X90)
    # a foil band round the bottom and the crest ridge
    box(0, 0, hz2 - hh / 2 + 0.1, hw + 0.04, hd + 0.04, 0.16, FOIL)
    box(0, 0, hz2 + hh / 2 + 0.08, 0.3, hd * 0.9, 0.16, FOIL_D, bevel=0.04)
    # the feather-duster plume
    top = hz2 + hh / 2 + 0.15
    can(0, 0.2, top + 0.1, 0.15, 0.25, GOLD, n=8)
    for i, (dx, dy, dz, r) in enumerate(((0, 0.2, 0.55, 0.42), (-0.32, 0.45, 0.45, 0.32), (0.32, 0.45, 0.45, 0.32),
                                         (0, 0.75, 0.6, 0.36), (0, 1.05, 0.4, 0.3), (-0.2, -0.05, 0.85, 0.3), (0.2, 0.15, 0.95, 0.3))):
        ball(dx, dy, top + dz, r * 2, r * 2, r * 1.8, PLUME if i % 2 == 0 else PLUME_D, seg=8, ring=6)


if __name__ == "__main__" or True:
    run({"knight": build})
