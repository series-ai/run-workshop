"""Cow abduction: a two-person cow costume caught by a flying saucer. The
front kid wears a big white cow head with black patches, a pink snout, little
horns and floppy ears, the kid's whole face showing in the hood opening; the mitts poke out under
the head with the full bucket. Behind, the cow's long patched body hides a
second kid: only their sneakers, a swishing tail and a pink udder show. A
little silver saucer (a green alien pilot sitting up out of it, waving; no
dome, no glass) bobs over the back half on a springy wire bolted to the
cow's back, as if lifting the cow away. No beam: nothing see-through."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

COW, PATCH, SNOUT, SNOUT_D = (0.98, 0.98, 0.96), (0.12, 0.11, 0.12), (1.0, 0.62, 0.7), (0.8, 0.38, 0.48)
HORN, SNEAK, HAIR = (0.98, 0.9, 0.62), (0.2, 0.62, 0.98), (0.3, 0.17, 0.09)
UFO, UFO_D, DOME, LIGHT = (0.78, 0.8, 0.86), (0.52, 0.55, 0.62), (0.62, 0.9, 1.0), (1.0, 0.9, 0.25)
ALIEN, BEAM = (0.45, 0.88, 0.32), (1.0, 0.95, 0.55)
X90 = (math.radians(90), 0, 0)


def shoe_pair(y, x0=0.0):
    for s in (-1, 1):
        fx = x0 + s * TW * 0.24
        box(fx, y - FOOT * 0.25, FOOT * 0.22, FOOT * 0.75, FOOT * 1.15, FOOT * 0.44, SNEAK, bevel=FOOT * 0.14, segs=2)
        limb((fx, y, FOOT * 0.4), (fx, y, 0.9), 0.11, COW)


def build():
    body(pants=COW, leg_colour=COW, shoe=SNEAK, torso=False, arms=False)
    # the cow's long body behind the head, hiding the second kid
    by0, by1, bz0, bz1 = 0.2, 3.3, 0.8, 2.45
    byc, bzc = (by0 + by1) / 2, (bz0 + bz1) / 2
    box(0, byc, bzc, 2.3, by1 - by0, bz1 - bz0, COW, bevel=0.5, segs=3)
    for s in (-1, 1):  # patches on the flanks
        box(s * 1.16, 1.3 + (0.25 if s > 0 else 0), 1.9, 0.06, 0.9, 0.6, PATCH, bevel=0.03)
        box(s * 1.16, 2.65 - (0.3 if s > 0 else 0), 1.25, 0.06, 0.7, 0.5, PATCH, bevel=0.03)
    box(0.35, 1.0, bz1 + 0.01, 0.8, 0.7, 0.06, PATCH, bevel=0.03)
    box(-0.4, 2.9, bz1 + 0.01, 0.7, 0.5, 0.06, PATCH, bevel=0.03)
    # the second kid's sneakers under the back half
    shoe_pair(2.6)
    # a pink udder with four teats
    uy = 1.75
    ball(0, uy, bz0 - 0.02, 0.8, 0.7, 0.5, SNOUT, seg=10, ring=6)
    for dx in (-0.18, 0.18):
        for dy in (-0.15, 0.15):
            can(dx, uy + dy, bz0 - 0.3, 0.06, 0.2, SNOUT_D, n=6)
    # the tail, flicking out, with a black tuft
    limb((0, by1 - 0.05, bz1 - 0.25), (0.35, by1 + 0.45, 1.3), 0.06, COW)
    ball(0.38, by1 + 0.5, 1.15, 0.3, 0.3, 0.42, PATCH, seg=8, ring=6)
    # the front kid's mitts poke out under the cow head; the right holds the bucket
    lh = (-1.5, -0.55, 1.35)
    limb((-0.7, -0.3, 1.6), lh, 0.11, COW)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.55, -0.6, 1.45)
    limb((0.7, -0.3, 1.6), rh, 0.11, COW)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.62)
    # the cow hood: a big white rounded block enclosing the kid's head, patches,
    # the kid's full face in the opening, the cow's face (eyes, pink muzzle) above it
    hz, hh = HEAD_Z + 0.25, HEAD * 1.06 + 0.5
    hy, hd = 0.1, HEAD * 1.06
    box(0, hy, hz, HEAD * 1.14, hd, hh, COW, bevel=0.5, segs=2)
    hf = hy - hd / 2                     # hood front
    htop = hz + hh / 2
    box(-HEAD * 0.57, 0.35, hz - 0.2, 0.08, 1.0, 0.8, PATCH, bevel=0.03)
    box(HEAD * 0.57, 0.6, hz + 0.5, 0.08, 0.9, 0.7, PATCH, bevel=0.03)
    box(0.55, 0.5, htop, 1.0, 1.1, 0.08, PATCH, bevel=0.03)
    box(-HEAD * 0.42, hf - 0.01, hz + 1.1, 0.7, 0.06, 0.6, PATCH, bevel=0.03)
    fz = HEAD_Z - HEAD * 0.05
    box(0, -0.3, fz, HEAD * 0.98, HEAD * 0.8, HEAD * 0.84, PATCH, bevel=0.22, segs=2)
    box(0, -0.37, fz - 0.03, HEAD * 0.86, HEAD * 0.76, HEAD * 0.74, SKIN, bevel=0.14, segs=2)
    ffy = -0.37 - HEAD * 0.38
    box(0, ffy + 0.04, fz + HEAD * 0.29, HEAD * 0.86, 0.2, HEAD * 0.16, HAIR, bevel=0.06)  # fringe
    face(0, fz, ffy, HEAD * 0.86)
    # the cow's own face over the opening: a big pink muzzle brim with nostrils, eyes above
    sz = fz + HEAD * 0.42 + 0.22
    box(0, hf - 0.2, sz, HEAD * 0.92, 0.7, 0.62, SNOUT, bevel=0.22, segs=2)
    for s in (-1, 1):
        ball(s * 0.45, hf - 0.56, sz + 0.02, 0.36, 0.08, 0.24, SNOUT_D, seg=8, ring=5)
        ex, ez = s * 0.72, sz + 0.62
        ball(ex, hf - 0.02, ez, 0.48, 0.16, 0.48, DARK, seg=10, ring=6)
        ball(ex - 0.08, hf - 0.09, ez + 0.09, 0.14, 0.06, 0.14, WHITE, seg=6, ring=4)
    # big horns and wide floppy ears
    for s in (-1, 1):
        can(s * 0.95, hy - 0.1, htop + 0.4, 0.26, 0.9, HORN, n=8, r2=0.06, rot=(0, s * math.radians(28), 0))
        ear = (0, s * math.radians(-28), 0)
        box(s * (HEAD * 0.57 + 0.5), -0.1, hz + 0.6, 0.95, 0.26, 0.5, COW, bevel=0.12, segs=2, rot=ear)
        box(s * (HEAD * 0.57 + 0.55), -0.24, hz + 0.58, 0.62, 0.06, 0.28, SNOUT, bevel=0.04, rot=ear)
    # the flying saucer over the back half, part of the costume: it rides a
    # springy wire (a coiled spring) bolted to a plate on the cow's back
    ux, uy, uz = 0.0, 2.3, 5.2
    can(ux, uy, bz1 + 0.04, 0.38, 0.1, UFO_D, n=12)                          # the mounting plate
    n, r = 36, 0.17
    pts = [(ux + r * math.cos(k * 0.8), uy + r * math.sin(k * 0.8), bz1 + 0.08 + (uz - 0.3 - bz1 - 0.08) * k / n) for k in range(n + 1)]
    for a, b in zip(pts, pts[1:]):
        limb(a, b, 0.055, UFO_D, n=6)
    can(ux, uy, uz - 0.18, 0.75, 0.22, UFO_D, n=16, r2=1.35)
    can(ux, uy, uz + 0.04, 1.35, 0.22, UFO, n=16, r2=1.0)
    can(ux, uy, uz + 0.2, 0.62, 0.12, UFO_D, n=16)                          # the cockpit rim the alien sits in
    for i in range(10):
        a = 2 * math.pi * i / 10
        ball(ux + 1.3 * math.cos(a), uy + 1.3 * math.sin(a), uz - 0.04, 0.2, 0.2, 0.16, LIGHT, seg=6, ring=4)
    # a tiny alien pilot sitting up out of the cockpit, waving
    ball(ux, uy, uz + 0.45, 0.6, 0.55, 0.62, ALIEN, seg=10, ring=7)
    for s in (-1, 1):
        ball(ux + s * 0.13, uy - 0.25, uz + 0.48, 0.17, 0.08, 0.22, DARK, seg=8, ring=5)
        limb((ux + s * 0.12, uy, uz + 0.7), (ux + s * 0.2, uy, uz + 0.9), 0.025, ALIEN)
        ball(ux + s * 0.2, uy, uz + 0.92, 0.08, 0.08, 0.08, LIGHT, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("cow-abduction", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
