"""Shark: a grey-and-white shark hood with the kid's whole face in the open
jaws (a pink mouth rim ringed with chunky white triangle teeth), a rounded
snout with little shark eyes on top, a towering swept-back dorsal fin (the
silhouette), gill stripes, a white belly suit, fin arms and a crescent tail
fin. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

GREY, GREY_D, BELLY = (0.47, 0.60, 0.74), (0.33, 0.44, 0.58), (0.97, 0.97, 0.94)
MOUTH, TOOTH, SHOE_C = (0.94, 0.42, 0.50), (1.0, 1.0, 0.98), (0.26, 0.34, 0.46)


def tooth(x, y, z, down, w=0.3, h=0.34):
    """A flat chunky triangle tooth facing the camera, tip pointing down or up."""
    s = -1 if down else 1
    plate([(x - w / 2, z), (x + w / 2, z), (x, z + s * h)], "y", y, 0.12, TOOTH, bevel=0.03)


def build():
    body(shirt=GREY, pants=GREY, leg_colour=GREY, shoe=SHOE_C, arms=False)
    fy = -TD * 0.5
    with part("chest"):  # the white belly on the onesie front
        box(0, fy - 0.01, HIP + TH * 0.45, TW * 0.62, 0.05, TH * 0.78, BELLY, bevel=0.04)
    # fin arms: the right hangs, the left holds the bucket; a fin on each upper arm
    arms(GREY, full=True)
    for s, z0 in ((1, TOP - 0.2), (-1, TOP - 0.2)):
        x0 = s * (SX + 0.05)
        with part("arm.l" if s > 0 else "arm.r"):  # a fin on each upper arm
            plate([(x0, z0 + 0.04), (x0 + s * 0.3, z0 - 0.08), (x0 + s * 0.42, z0 - 0.38), (x0 + s * 0.18, z0 - 0.22), (x0, z0 - 0.2)],  # small, so a raised arm keeps it out of the hood
                  "y", 0.12, 0.12, GREY_D, taper=[1, 0.8, 0.4, 0.8, 1])
    with part("body"):  # the tail and its crescent fin
        # the tail: out of the back, rising a little, ending in a big crescent fin
        pts = [(0, 0.3, HIP + 0.25), (0.25, 0.75, HIP + 0.2), (0.6, 1.1, HIP + 0.3)]
        chain(pts, 0.24, 0.14, GREY)
        plate([(1.05, HIP + 0.34), (1.6, HIP + 1.45), (1.85, HIP + 1.5), (1.55, HIP + 0.45), (1.75, HIP - 0.3), (1.55, HIP - 0.28), (1.05, HIP + 0.18)],
              "x", 0.62, 0.24, GREY, taper=[1, 0.4, 0.3, 1, 0.3, 0.4, 1])
    with part("head"):  # the shark hood: chin, snout, eyes, teeth, gills and the dorsal fin
        # the hood: grey on top, white chin, the face in the open pink jaws
        hd = hood(GREY, MOUTH, w=HEAD * 1.22, d=HEAD * 1.04, h=2.85, y=0.12, zc=3.18, ow=HEAD * 0.92, oh=HEAD * 0.72, rt=0.16)
        hf, top, oz = hd["front"], hd["top"], hd["oz"]
        box(0, hf + 0.7, 2.0, HEAD * 1.2, 1.5, 0.38, BELLY, bevel=0.18, segs=2)    # white chin (the hood's hem kept above the shoulders, so waving arms clear it)
        # rounded snout over the mouth, eyes and nostrils on it
        sz = oz + hd["oh"] * 0.5 + 0.48
        box(0, hf + 0.35, sz, HEAD * 1.18, 1.3, 0.95, GREY, bevel=0.42, segs=2)
        sf = hf + 0.35 - 0.65
        for s in (-1, 1):
            ex, ez = s * 1.05, sz + 0.25
            ball(ex, sf + 0.12, ez, 0.36, 0.3, 0.4, DARK, seg=6, ring=4)
            box(ex - 0.06, sf - 0.02, ez + 0.08, 0.1, 0.06, 0.1, WHITE)
        # chunky teeth all round the opening
        ty = hf - 0.14
        ow, oh = hd["ow"], hd["oh"]
        n = 7
        for i in range(n):
            x = -ow * 0.42 + i * (ow * 0.84) / (n - 1)
            tooth(x, ty, oz + oh * 0.5 + 0.02, down=True)
        for i in range(n - 1):
            x = -ow * 0.36 + i * (ow * 0.72) / (n - 2)
            tooth(x, ty, oz - oh * 0.5 - 0.02, down=False, w=0.28, h=0.3)
        # side teeth near the corners, pointing in
        for s in (-1, 1):
            for z in (oz + 0.35, oz - 0.45):
                x = s * (ow * 0.5 + 0.02)
                plate([(x, z - 0.14), (x, z + 0.14), (x - s * 0.26, z)], "y", ty, 0.12, TOOTH, bevel=0.03)
        # gill stripes on the hood sides
        for s in (-1, 1):
            for k in range(3):
                box(s * HEAD * 0.61, 0.15 + k * 0.32, HEAD_Z - 0.25, 0.06, 0.1, 0.8, GREY_D)
        # the towering dorsal fin, swept back
        fin = [(-0.55, top - 0.25), (-0.25, top + 0.9), (0.2, top + 1.55), (0.85, top + 2.05), (1.25, top + 2.15),
               (1.05, top + 1.45), (1.15, top + 0.6), (1.4, top - 0.25)]
        plate(fin, "x", 0, 0.66, GREY, taper=[1, 0.9, 0.7, 0.45, 0.3, 0.6, 0.9, 1])


if __name__ == "__main__" or True:
    render_costume("shark", build, out_dir(), ortho=8.5, target_z=3.0)
