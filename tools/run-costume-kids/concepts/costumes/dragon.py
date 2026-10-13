"""Dragon: a teal dragon onesie. The hood encloses the head, the kid's face
in a cream rim; two huge curved cream horns sweep up, out and back from the
hood's top corners (the silhouette), a row of orange spikes runs over the
hood, down the back and along the tail. Wide orange bat wings on teal bones
spread from the back, a cream ridged belly, a long tail curling on the
ground with a spade tip, claw shoes. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

TEAL, TEAL_D, CREAM, CREAM_D = (0.10, 0.70, 0.66), (0.05, 0.50, 0.50), (1.0, 0.90, 0.62), (0.92, 0.76, 0.46)
HORN, HORN_D, SPIKE, MEMB = (1.0, 0.94, 0.80), (0.86, 0.74, 0.56), (1.0, 0.55, 0.12), (1.0, 0.66, 0.24)
HAIR = (0.30, 0.17, 0.09)


def spike(y, z, h, w, tilt=0.0, x=0.0, col=SPIKE):
    """A flat triangle spike standing on (y, z), leaning back by `tilt`."""
    plate([(y - w / 2, z), (y + w / 2, z), (y + tilt, z + h)], "x", x, 0.16, col, taper=[1, 1, 0.4])


def build():
    body(shirt=TEAL, pants=TEAL, leg_colour=TEAL, shoe=TEAL_D, arms=False)
    for s in (-1, 1):  # claw toes
        for k in (-1, 0, 1):
            with part("foot.l" if s > 0 else "foot.r"):
                can(s * TW * 0.24 + k * 0.13, -FOOT * 0.25 - FOOT * 0.6, 0.12, 0.05, 0.16, WHITE, n=4, r2=0.0,
                    rot=(math.radians(90), 0, 0))
    fy = -TD * 0.5
    with part("chest"):  # the belly plate and its stripes
        box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.6, 0.05, TH * 0.8, CREAM, bevel=0.04)
        for z in (HIP + 0.2, HIP + 0.42, HIP + 0.64):
            box(0, fy - 0.04, z, TW * 0.6, 0.03, 0.04, CREAM_D)
    arms(TEAL, full=True)
    # the long tail: out of the back, along the ground, curling round, spade tip
    with part("body"):  # the tail, its spikes and spade tip
        pts = [(0.0, 0.3, HIP + 0.2), (0.15, 0.85, HIP - 0.1), (0.55, 1.35, 0.3), (1.2, 1.55, 0.25), (1.8, 1.25, 0.3),
               (2.05, 0.7, 0.35), (1.85, 0.25, 0.45)]
        chain(pts, 0.26, 0.1, TEAL, n=8)
        tx, ty, tz = pts[-1]
        plate([(ty + 0.1, tz), (ty - 0.15, tz + 0.4), (ty - 0.65, tz + 0.05), (ty - 0.15, tz - 0.3)], "x", tx, 0.14, SPIKE)
        for a, b in zip(pts[1:5], pts[2:6]):
            mx, my, mz = [(p + q) / 2 for p, q in zip(a, b)]
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            o = can(mx, my, mz + 0.18, 0.12, 0.3, SPIKE, n=4, r2=0.0, rot=(0, 0, ang + math.pi / 4))
    # wide bat wings on the back: teal bones, orange membrane with a scalloped edge
    with part("chest"):  # the wings and their mount ride the back
        wy = 0.62
        box(0, 0.45, 1.2, 0.8, 0.4, 0.5, TEAL, bevel=0.12)  # the wing mount on the back
        for s in (-1, 1):
            # the arm bone runs out low under the hood, then up at the elbow: clear of the hood when the head nods
            root_t, elbow, wrist, claw = (s * 0.3, 1.3), (s * 1.5, 1.45), (s * 2.05, 2.82), (s * 2.25, 3.17)
            tips = [(s * 3.25, 2.15), (s * 2.7, 1.1), (s * 1.6, 0.55)]
            dips = [(s * 2.6, 2.0), (s * 1.95, 1.2), (s * 1.0, 0.95)]
            outline = [root_t, elbow, wrist, tips[0], dips[0], tips[1], dips[1], tips[2], dips[2], (s * 0.3, 1.0)]
            plate(outline, "y", wy + 0.06, 0.08, MEMB)
            bar((root_t[0], wy, root_t[1]), (elbow[0], wy, elbow[1]), 0.12, 0.11, TEAL, n=6)
            ball(elbow[0], wy, elbow[1], 0.22, 0.22, 0.22, TEAL, seg=6, ring=4)
            bar((elbow[0], wy, elbow[1]), (wrist[0], wy, wrist[1]), 0.11, 0.1, TEAL, n=6)
            bar((wrist[0], wy, wrist[1]), (claw[0], wy, claw[1]), 0.09, 0.0, HORN, n=6)
            ball(wrist[0], wy, wrist[1], 0.24, 0.24, 0.24, TEAL, seg=6, ring=4)
            for t in tips:
                bar((wrist[0], wy - 0.02, wrist[1]), (t[0], wy - 0.02, t[1]), 0.07, 0.04, TEAL, n=6)
    # the hood with the face in a cream rim
    hd = hood(TEAL, CREAM, w=HEAD * 1.04, h=HEAD * 1.0, zc=HEAD_Z + 0.07, bevel=0.62)
    with part("head"):
        hf, top = hd["front"], hd["top"]
        # little nostril bumps on the brim, blush on the hood cheeks
        for s in (-1, 1):
            ball(s * 0.25, hf - 0.02, hd["oz"] + hd["oh"] * 0.5 + 0.38, 0.2, 0.1, 0.14, TEAL_D, seg=6, ring=4)
        # frilly cheek fins on the hood sides
        for s in (-1, 1):
            x = s * HEAD * 0.52
            plate([(x, HEAD_Z + 0.5), (x + s * 0.7, HEAD_Z + 0.25), (x + s * 0.45, HEAD_Z - 0.05), (x + s * 0.75, HEAD_Z - 0.35),
                   (x + s * 0.4, HEAD_Z - 0.55), (x, HEAD_Z - 0.6)], "y", 0.2, 0.12, SPIKE, taper=[1, 0.4, 1, 0.4, 1, 1])
        # huge curved horns from the hood's top corners: up, out, then back
        for s in (-1, 1):
            pts = [(s * 0.85, -0.1, top - 0.25), (s * 1.15, 0.0, top + 0.45), (s * 1.6, 0.15, top + 1.05),
                   (s * 1.95, 0.45, top + 1.65), (s * 2.0, 0.95, top + 2.05), (s * 1.8, 1.45, top + 2.2)]
            chain(pts, 0.42, 0.05, HORN, n=8, cols=[HORN])
        # spikes over the hood, down the back
        for i, (y, z, h) in enumerate(((-0.75, top - 0.08, 0.55), (-0.15, top - 0.02, 0.75), (0.55, top - 0.08, 0.65))):
            spike(y, z, h, 0.5, tilt=0.15)
        hb = 0.12 + HEAD * 0.51
        for z, h in ((HEAD_Z + 0.4, 0.5), (HEAD_Z - 0.4, 0.45)):
            plate([(hb - 0.05, z + 0.25), (hb - 0.05, z - 0.25), (hb + h - 0.05, z - 0.15)], "x", 0, 0.16, SPIKE, taper=[1, 1, 0.4])


if __name__ == "__main__" or True:
    render_costume("dragon", build, out_dir(), ortho=8.5, target_z=3.0)
