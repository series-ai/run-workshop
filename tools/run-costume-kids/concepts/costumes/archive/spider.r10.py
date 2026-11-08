"""Spider: a black fuzzy spider suit. The hood encloses the head, the face in
a purple rim, a cluster of six shiny pink spider eyes above it, a fuzzy crest
of tufts over the top and two little white fangs under the chin. A big round
spider bottom on the back (a purple hourglass on it) carries four huge
bendy legs, two each side, arching out and down with purple knee bands.
Purple striped sleeves. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

BLK, BLK_L, PURP, PURP_D = (0.17, 0.15, 0.22), (0.28, 0.25, 0.36), (0.66, 0.36, 0.95), (0.48, 0.22, 0.75)
EYE, FANG = (1.0, 0.30, 0.55), (1.0, 1.0, 0.96)


def tuft(x, y, z, h, rx=0.0, ry=0.0, r=0.13, col=BLK):
    can(x, y, z + h * 0.4, r, h, col, n=5, r2=0.0, rot=(rx, ry, 0))


def build():
    body(shirt=BLK, pants=BLK, leg_colour=BLK, shoe=PURP_D, arms=False)
    fy = -TD * 0.5
    with part("chest"):
        box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.5, 0.04, TH * 0.6, BLK_L, bevel=0.03)  # fuzzy belly
    arms(BLK, full=True, cuff=PURP)
    with part("arm.l"):
        can(SX + 0.09, -0.03, TOP - 0.3, 0.13, 0.08, PURP, n=6)   # sleeve stripe
    with part("head"):  # the spider bottom, its hourglass and fuzz: the legs grow out of it and ride the hood, so it does too
        # the round spider bottom on the back, a purple hourglass on it
        ay, az = 1.08, 1.15  # just behind the back, clear of the swinging bucket
        ball(0, ay, az, 1.75, 1.5, 1.45, BLK, seg=12, ring=8)
        plate([(-0.24, az + 0.4), (0.24, az + 0.4), (0.04, az), (0.24, az - 0.4), (-0.24, az - 0.4), (-0.04, az)], "y", ay + 0.72, 0.08, PURP)
        for k in range(10):  # fuzz on the bottom
            a = 2 * math.pi * k / 10
            tuft(0.85 * math.cos(a), ay + 0.75 * math.sin(a) * 0.9, az + 0.62, 0.32, rx=math.sin(a) * 0.5, ry=math.cos(a) * 0.5, r=0.1)
    with part("head"):  # the extra legs move as one with the hood (art lead)
        # four big bendy legs: out of the bottom's sides, up to a knee, down to a foot
        for s in (-1, 1):
            for k, (y0, z0, ky, kz, fy2) in enumerate(((0.55, 1.55, 0.2, 3.45, -0.25), (1.25, 1.1, 1.55, 2.95, 1.85))):
                p0 = (s * 0.7, ay + (y0 - 0.95), z0)
                knee = (s * 2.3, ky, kz)
                mid = (s * 1.45, (p0[1] + ky) / 2, (z0 + kz) / 2 + 0.35)
                foot = (s * 2.9, fy2, 0.3)
                shin = (s * 2.75, (ky + fy2) / 2, 1.7)
                chain([p0, mid, knee, shin, foot], 0.22, 0.1, BLK, n=6)
                ball(*knee, 0.44, 0.44, 0.44, PURP, seg=8, ring=6)
                ball(*mid, 0.3, 0.3, 0.3, BLK, seg=6, ring=4)
                bar(shin, (shin[0] + s * 0.02, shin[1], shin[2] - 0.12), 0.15, 0.15, PURP, n=6)
                for t, h in ((0.3, 0.26), (0.65, 0.24)):  # leg fuzz
                    px = mid[0] + (knee[0] - mid[0]) * t
                    py = mid[1] + (knee[1] - mid[1]) * t
                    pz = mid[2] + (knee[2] - mid[2]) * t
                    tuft(px, py, pz + 0.05, h, ry=s * 0.4, r=0.08)
    with part("head"):  # the hood, its eyes, fangs and crest
        # the hood, taller than the head, the face in a purple rim
        hd = hood(BLK, PURP, h=HEAD * 1.14, zc=HEAD_Z + 0.275)  # same top; the hem no lower than the base head, so waving mitts clear it
        hf, top = hd["front"], hd["top"]
        # six shiny spider eyes above the opening: two big, four small
        ez = hd["oz"] + hd["oh"] * 0.5 + hd["rt"] + 0.3
        for x, z, r in ((-0.38, ez, 0.42), (0.38, ez, 0.42), (-1.0, ez + 0.05, 0.28), (1.0, ez + 0.05, 0.28), (-0.68, ez + 0.4, 0.24), (0.68, ez + 0.4, 0.24)):
            ball(x, hf - 0.02, z, r, 0.2, r, EYE, seg=8, ring=6)
            ball(x - r * 0.18, hf - 0.1, z + r * 0.18, r * 0.3, 0.06, r * 0.3, WHITE, seg=6, ring=4)
        # two little fangs under the chin
        for s in (-1, 1):
            can(s * 0.3, hf - 0.02, hd["oz"] - hd["oh"] * 0.5 - hd["rt"] - 0.08, 0.1, 0.3, FANG, n=4, r2=0.0, rot=(math.pi, 0, 0))
        # a fuzzy crest of tufts over the top of the hood
        for i in range(7):
            y = -0.95 + i * 0.36
            h = 1.15 - abs(i - 2.5) * 0.16
            tuft(0, y, top - 0.15, h, rx=math.radians(-8 + 6 * i), r=0.26, col=BLK if i % 2 else PURP_D)
            for s in (-1, 1):
                tuft(s * 0.5, y + 0.1, top - 0.18, h * 0.6, ry=s * 0.45, r=0.18)


if __name__ == "__main__" or True:
    render_costume("spider", build, out_dir(), ortho=8.5, target_z=3.0)
