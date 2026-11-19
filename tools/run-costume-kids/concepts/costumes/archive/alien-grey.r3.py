"""Grey alien: a huge bulb-head mask: a wide domed cranium tapering to a
narrow chin, with two giant glossy black almond eyes slanting up. The kid's
face peeks out of a round hole at the chin. A plain grey suit with a darker
belt and a silver chest badge, grey boots, and the kid's mitts: one does a
little wave, the other carries the empty bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GREY, GREY_D, GREY_L, SUIT, SUIT_D = (0.7, 0.76, 0.8), (0.5, 0.55, 0.6), (0.82, 0.84, 0.88), (0.58, 0.6, 0.66), (0.4, 0.42, 0.48)
SILVER, HAIR, GLOSS = (0.88, 0.9, 0.95), (0.3, 0.17, 0.09), (0.04, 0.04, 0.06)
X90 = (math.radians(90), 0, 0)


def build():
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=SUIT_D, sleeve=SUIT)
    fy = -TD * 0.5
    box(0, 0, HIP + 0.22, TW + 0.06, TD + 0.06, 0.13, SUIT_D, bevel=0.03)          # belt
    box(0, fy - 0.03, HIP + 0.58, 0.32, 0.06, 0.26, SILVER, bevel=0.05)              # chest badge
    ball(0, fy - 0.07, HIP + 0.58, 0.16, 0.04, 0.12, (0.4, 0.9, 0.5), seg=8, ring=4)
    lh = hand_points()[-1]
    bucket(lh, full=False, size=0.62)
    # the bulb-head mask: a wide rounded-cube cranium on a tapering rounded jaw
    z0, z1 = TOP + 0.1, 3.35
    jaw = can(0, 0, (z0 + z1) / 2, 1.0, z1 - z0, GREY, n=4, r2=2.05, rot=(0, 0, math.radians(45)))
    bpy.ops.object.select_all(action="DESELECT")
    jaw.select_set(True)
    bpy.context.view_layer.objects.active = jaw
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    jaw.scale = (1.0, 0.72, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bv = jaw.modifiers.new("b", "BEVEL")
    bv.width, bv.segments, bv.limit_method = 0.3, 3, "ANGLE"
    hz = 3.95
    box(0, 0.05, hz, 3.4, 2.5, 1.95, GREY, bevel=0.75, segs=3)                      # cranium
    # the jaw's sloping front: y and tilt at a height
    hd0, hd1 = 1.0 * 0.72 * math.sqrt(0.5), 2.05 * 0.72 * math.sqrt(0.5)
    tilt = math.atan2(hd1 - hd0, z1 - z0)
    def front(z):
        return -(hd0 + (z - z0) / (z1 - z0) * (hd1 - hd0))
    # the hole at the chin with the kid's face peeking out
    cz = TOP + 0.85
    cy = front(cz)
    rx = (math.radians(90) + tilt, 0, 0)
    can(0, cy + 0.02, cz, 0.72, 0.2, GREY_D, n=18, rot=rx)
    can(0, cy - 0.04, cz, 0.62, 0.2, SKIN, n=18, rot=rx)
    box(0, cy - 0.04, cz + 0.4, 0.86, 0.14, 0.16, HAIR, bevel=0.05, rot=(tilt, 0, 0))
    face(0, cz - 0.03, cy - 0.16, 1.1, eye=0.16, gap=0.2)
    # giant glossy black almond eyes slanting up and out, on the cranium's front
    ey = -1.2 + 0.05
    for s in (-1, 1):
        ex, ez = s * 0.78, 3.35
        ball(ex, ey, ez, 1.35, 0.44, 0.7, GLOSS, seg=14, ring=8, rot=(0, s * math.radians(-28), 0))
        ball(ex - s * 0.12 - 0.1, ey - 0.22, ez + 0.12, 0.3, 0.06, 0.16, WHITE, seg=8, ring=4, rot=(0, s * math.radians(-28), 0))
        ball(ex + s * 0.3, ey - 0.2, ez - 0.14, 0.1, 0.05, 0.08, WHITE, seg=6, ring=4)
    for s in (-1, 1):  # tiny nostril slits
        box(s * 0.09, front(2.85) - 0.02, 2.85, 0.05, 0.04, 0.1, GREY_D)

if __name__ == "__main__" or True:
    run({"alien-grey": build})
