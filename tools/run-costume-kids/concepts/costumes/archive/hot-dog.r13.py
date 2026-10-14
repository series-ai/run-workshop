"""Hot dog suit: a giant fat sausage standing up the middle and rising way
past the head, the kid's whole head inside it and the kid's standard face
looking out of a big opening in the front; two big tan bun halves hug it
from the sides; a yellow mustard zigzag squiggles up the sausage over the
face to the tied end. Stub legs, shoes and mitts poke out below; the right
mitt carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SAUSAGE, SAUSAGE_D, BUN, CRUST = (0.86, 0.32, 0.22), (0.66, 0.2, 0.14), (1.0, 0.78, 0.45), (0.82, 0.5, 0.22)
MUSTARD, HAIR = (1.0, 0.85, 0.1), (0.3, 0.17, 0.09)
N = 12
ROT = (0, 0, math.pi / N)    # a flat face toward the camera


def cut(obj, cutter):
    """Boolean `cutter` out of `obj` (the cutter is hidden)."""
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation = cutter, "DIFFERENCE"
    cutter.hide_render = True
    return obj


def opening(w=HEAD * 0.86, h=HEAD * 0.78, back=-0.6, front=-3.0, bevel=0.45):
    """A cutter for the face opening round the standard face."""
    return box(0, (back + front) / 2, HEAD_Z - HEAD * 0.06, w, back - front, h, WHITE, bevel=bevel, segs=3)


def build():
    body(shirt=SAUSAGE, pants=(0.95, 0.95, 0.92), shoe=(0.95, 0.85, 0.15), torso=False, arms=False)
    kid_head(hair=HAIR)
    with part("body"):
        # the sausage: a fat upright capsule round the head, the face opening cut in
        r, z0, z1 = 1.55, 1.0, 5.4
        fy = -r * math.cos(math.pi / N)
        cut(can(0, 0, (z0 + z1) / 2, r, z1 - z0, SAUSAGE, n=N, rot=ROT), opening())
        ball(0, 0, z1, r * 2, r * 2, 2.3, SAUSAGE, seg=N, ring=8)
        ball(0, 0, z0, r * 2, r * 2, 1.2, SAUSAGE, seg=N, ring=8)
        can(0, 0, z1 + 1.18, 0.2, 0.3, SAUSAGE_D, n=6)  # the tied end
        can(0, 0, z1 + 1.36, 0.12, 0.12, SAUSAGE_D, n=6, r2=0.2)
        rim = box(0, fy + 0.25, HEAD_Z - HEAD * 0.06, HEAD * 0.86 + 0.34, 0.6, HEAD * 0.78 + 0.34, SAUSAGE_D, bevel=0.29, segs=3)
        cut(rim, opening(back=0.5))
    with part("head"):
        box(0, -HEAD * 0.46 - 0.02, HEAD_Z + HEAD * 0.26, HEAD * 0.7, 0.1, 0.3, HAIR, bevel=0.08)   # the fringe
    with part("body"):
        # the bun halves, one on each side, crust on the outside
        for s in (-1, 1):
            box(s * 1.62, 0, 2.75, 0.95, 2.9, 4.3, BUN, bevel=0.45, segs=3)
            box(s * 1.92, 0, 2.77, 0.6, 3.0, 4.4, CRUST, bevel=0.29, segs=3)
        # mustard zigzag from above the face to the top
        zs, ze, n = 4.35, z1 + 0.75, 6
        pts = []
        for k in range(n + 1):
            z = zs + (ze - zs) * k / n
            w = 0.75 * (1 - 0.45 * k / n)
            x = -w if k % 2 else w
            y = -math.sqrt(max(0.0, r * r - x * x)) * 0.98 if z <= z1 else -math.sqrt(max(0.0, r * r - x * x)) * math.sqrt(max(0.0, 1 - ((z - z1) / 1.15) ** 2)) * 0.98
            pts.append((x, y - 0.05, z))
        for a, b in zip(pts, pts[1:]):
            limb(a, b, 0.13, MUSTARD)
        for p in pts:
            ball(*p, 0.26, 0.26, 0.26, MUSTARD, seg=6, ring=4)
    # the mitts poke out under the bun; the right one holds the bucket
    with part("hand.r"):
        lh = (-2.6, -1.0, 1.0)
        limb((-1.4, -0.9, 1.15), lh, 0.11, SAUSAGE)
        hand_mitt(*lh, -1, MITT, SKIN)
    with part("hand.l"):
        rh = (2.65, -1.05, 1.3)
        limb((1.4, -0.9, 1.3), rh, 0.11, SAUSAGE)
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.7)


if __name__ == "__main__" or True:
    render_costume("hot-dog", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
