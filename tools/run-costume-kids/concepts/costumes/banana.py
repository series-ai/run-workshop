"""Peeled banana: the kid's whole head is inside a fat cream banana that
rises out of a yellow peel cup round the body and curves up and over to
one side in a tall ridged tip with a brown end. The kid's standard face
looks out of a big opening in the banana; four big yellow peel flaps flop
down and out from the cup, curling at the ends with brown tips. Yellow
sleeves, mitts out between the flaps, the right one with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

FLESH, FLESH_D = (1.0, 0.94, 0.66), (0.92, 0.8, 0.45)
PEEL, PEEL_D, PEEL_IN, TIPC = (1.0, 0.84, 0.12), (0.88, 0.66, 0.06), (1.0, 0.95, 0.8), (0.4, 0.25, 0.1)
HAIR = (0.3, 0.17, 0.09)


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.86, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def flap(a, hz, hr, w=1.0, L=1.5, t=math.radians(28), t2=math.radians(70), L2=0.6):
    """A peel flap hinged at radius hr, height hz, flopping down and out toward angle a."""
    out = (math.cos(a), math.sin(a))
    h = (hr * out[0], hr * out[1], hz)
    d1 = (out[0] * math.sin(t), out[1] * math.sin(t), -math.cos(t))
    c1 = tuple(h[i] + d1[i] * L / 2 for i in range(3))
    box(*c1, w, 0.18, L, PEEL, bevel=0.07, rot=(t, 0, a - math.pi / 2))
    ci = tuple(c1[i] - (out[0], out[1], 0)[i] * 0.08 * math.cos(t) for i in range(3))
    box(ci[0], ci[1], ci[2] - 0.02, w * 0.84, 0.06, L * 0.9, PEEL_IN, rot=(t, 0, a - math.pi / 2))
    e1 = tuple(h[i] + d1[i] * L for i in range(3))
    d2 = (out[0] * math.sin(t2), out[1] * math.sin(t2), -math.cos(t2))
    c2 = tuple(e1[i] + d2[i] * L2 / 2 for i in range(3))
    box(*c2, w * 0.9, 0.18, L2 + 0.1, PEEL, bevel=0.07, rot=(t2, 0, a - math.pi / 2))
    e2 = tuple(e1[i] + d2[i] * (L2 + 0.05) for i in range(3))
    box(*e2, w * 0.7, 0.2, 0.18, TIPC, bevel=0.04, rot=(t2, 0, a - math.pi / 2))


def build():
    body(shirt=PEEL, pants=PEEL, leg_colour=PEEL_D, shoe=(0.45, 0.28, 0.14), arms=False)
    kid_head(hair=HAIR)
    with part("body"):
        # the unpeeled bottom: a yellow peel cup round the body
        box(0, 0.05, 1.15, 2.4, 2.3, 1.4, PEEL, bevel=0.5, segs=3)
        box(0, 0.05, 1.82, 2.3, 2.2, 0.16, PEEL_D, bevel=0.06)   # the torn rim
    with part("head"):
        # the banana round the head: a fat rounded block with the face opening
        hood = box(0, 0.12, HEAD_Z + 0.1, HEAD * 1.18, HEAD * 1.16, HEAD * 1.12, FLESH, bevel=0.62, segs=3)
        cut(hood, opening())
        rim = box(0, -1.25, HEAD_Z - HEAD * 0.06, HEAD * 0.86 + 0.3, 0.6, HEAD * 0.78 + 0.3, FLESH_D, bevel=0.29, segs=3)
        cut(rim, opening(back=0.5))
        box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
        # the tall tip: a ridged column of frustums curving over to the right
        n = 8
        pts = []
        for i in range(n + 1):
            t = i / n
            pts.append((1.5 * t ** 2.0, HEAD_Z + 1.0 + 3.2 * t - 0.4 * t ** 3, 1.35 - 1.0 * t ** 1.3))
        for (x0, z0, r0), (x1, z1, r1) in zip(pts, pts[1:]):
            dx, dz = x1 - x0, z1 - z0
            L = math.hypot(dx, dz)
            can((x0 + x1) / 2, 0.08, (z0 + z1) / 2, r0, L + 0.06, FLESH, n=8, r2=r1, rot=(0, math.atan2(dx, dz), math.radians(22.5)))
        xe, ze, re = pts[-1]
        can(xe + 0.12, 0.08, ze + 0.06, re, 0.24, FLESH, n=8, r2=re * 0.6, rot=(0, 0.75, math.radians(22.5)))
        can(xe + 0.27, 0.08, ze + 0.18, re * 0.62, 0.22, TIPC, n=8, r2=re * 0.4, rot=(0, 0.75, math.radians(22.5)))
    # every peel flap and its brown tip rides the root, so they never dip into the floor
    with part("root"):
        # four big peel flaps flopping down, front and back, leaving the sides free for the arms
        for deg in (-50, -130, 55, 125):
            flap(math.radians(deg), 1.8, 1.1, w=1.3, L=1.6, t=math.radians(34), L2=0.6)
    # arms out the sides between the flaps: the yellow sleeves are the peel cup's (they ride the
    # hips with it), the mitts flap at their ends; the right mitt holds the bucket
    lh = (-1.75, -0.2, 1.05)
    with part("body"):
        limb((-0.9, 0, 1.3), lh, 0.12, PEEL)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.8, -0.25, 1.15)
    with part("body"):
        limb((0.9, 0, 1.35), rh, 0.12, PEEL)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)

if __name__ == "__main__" or True:
    render_costume("banana", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
