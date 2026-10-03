"""Fresh grave mound, in the Pirate Nation haunted style.

A body-length heap of fresh earth (two stacked chamfered frustums, true
slopes) painted with clods, pebbles and moss at its foot. At the head end
(+Z) a big round-topped headstone on a plinth, carved with a big cross, with a moss
wreath and a red bow leaning on it and two lit candles. A chunky zombie
hand with toxic-green skin and a torn purple cuff claws up out of the
dirt, and a shovel is stuck in the heap at an angle. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnglyph
import pnshapes
from _kit import single
from _life import candle, chunk, claw, coords, front, limb, plan, quad, side
from pnkit import box
from voxgrid import C, Grid

S = (40, 34, 60)
CX = 20.0
MZ0, MZ1 = 5.0, 45.0  # the mound's length along z
HZ = 50.0  # the headstone's centre


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the mound: a wide low frustum and a narrower crown, both chamfered
    mc = (MZ0 + MZ1) / 2
    lower = chunk(g, CX, mc, 0, 4, 11.0, 21.0, 5.0, "skindark", 4, taper=2.5)
    upper = chunk(g, CX + 0.5, mc - 0.5, 4, 7, 8.5, 18.0, 4.0, "skindark", 4, taper=3.0, lean=(0.3, 0.0))
    heap = lower | upper
    # fresh earth: soft +-1 clods, spade rows across the heap, pale pebbles
    P.mottle(g, heap, "skindark", 4, cell=2, seed=1)
    P.flat(g, heap & (((Z + (X // 5)) % 5) == 0) & (Y >= 2), "skindark", 3)
    pnpaint.blotch(g, heap, "skindark", 5, cell=2, chance=0.08, seed=2)
    peb = heap & ((P._hash(X, Z, Y, seed=3) % np.uint64(29)) == 0)
    P.flat(g, peb, "gray", 6)
    P.flat(g, heap & (Y == 0) & ((P._hash(X // 2, Z // 2, seed=4) % np.uint64(2)) == 0), "moss", 5)

    # the plinth and the headstone at the head end, facing -z
    plinth = box(g, CX - 11, 0, HZ - 6, CX + 11, 3, HZ + 5, "gray", 4)
    P.stone(g, plinth, "gray", 4, block=(6, 3), seed=5)
    P.flat(g, plinth & (Y == 2), "gray", 5)
    stone = pnshapes.tombstone(g, CX, HZ, w=18, h=28, t=6, y0=3, lean=-3.0, ramp="gray", base=6, glyph=None, seed=6)
    # a big carved cross (2 voxels deep so the slanted rim keeps it)
    iw, ih = pnglyph.icon_size("cross", scale=2)
    pnglyph.icon(g, "-z", HZ - 3, int(round(CX - iw / 2)), 8, "cross", "purple", 3, scale=2, depth=2, reach=3)

    # the wreath: eight chunky leaf segments in a ring, leaning on the stone
    wz0 = HZ - 3
    ring = []
    cxw, cyw, R = CX + 7.5, 7.5, 3.6
    for k in range(8):
        a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
        p0 = (cxw + R * math.cos(a0), cyw + R * math.sin(a0))
        p1 = (cxw + R * math.cos(a1), cyw + R * math.sin(a1))
        ring.append(front(g, quad(p0, p1, 1.4, 1.4, cap=0.5), wz0 - 2, wz0, "moss", 5))
    wreath = np.logical_or.reduce(ring)
    pnpaint.blotch(g, wreath, "moss", 6, cell=1, chance=0.3, seed=7)
    P.flat(g, wreath & ((P._hash(X, Y, seed=8) % np.uint64(7)) == 0), "red", 4)  # berries
    front(g, [(cxw - 2.5, cyw - 5.2), (cxw, cyw - 3.6), (cxw + 2.5, cyw - 5.2), (cxw + 2.5, cyw - 2.2), (cxw, cyw - 3.0), (cxw - 2.5, cyw - 2.2)], wz0 - 2.5, wz0 - 1, "red", 5)  # the bow

    # two lit candles on the plinth
    candle(g, int(CX - 9), 3, int(HZ - 4), h=6, w=2)
    candle(g, int(CX - 6), 3, int(HZ - 4.5), h=4, w=2)

    # the zombie hand: a forearm out of the dirt, a big palm, clawed fingers
    hx, hz = CX - 3.0, 20.0
    arm = limb(g, "z", (hx, 5.0), (hx - 2.5, 14.0), 2.2, 1.9, hz - 2, hz + 2, "toxic", 4)
    cuff = limb(g, "z", (hx - 0.3, 6.0), (hx - 0.9, 9.0), 2.9, 2.9, hz - 2.6, hz + 2.6, "purple", 4)
    palm = chunk(g, hx - 3.0, hz, 13.0, 17.5, 3.0, 2.2, 1.0, "toxic", 5, taper=0.3)
    skin = arm | palm
    fingers = np.zeros(g.shape, dtype=bool)
    for k, (fx, top, tilt) in enumerate(((-2.2, 23.0, -2.0), (-0.7, 24.5, -0.8), (0.8, 24.0, 0.6), (2.2, 22.0, 1.8))):
        bx = hx - 3.0 + fx
        fingers |= limb(g, "z", (bx, 17.0), (bx + tilt, top - 2.5), 0.9, 0.8, hz - 1, hz + 1, "toxic", 5)
        fingers |= claw(g, "z", (bx + tilt, top - 3.0), (bx + tilt * 1.5 + 0.6, top), 0.8, hz - 1, hz + 1, "bone", 6)
    fingers |= limb(g, "z", (hx - 6.0, 14.0), (hx - 8.0, 17.5), 0.9, 0.8, hz - 1, hz + 1, "toxic", 5)  # thumb
    P.flat(g, skin & (Y < 12) & ((P._hash(X, Y, seed=9) % np.uint64(5)) == 0), "toxic", 3)  # rot spots
    P.flat(g, cuff & ((X + Y) % 3 == 0), "purple", 3)
    # dirt thrown up around the wrist
    plan(g, [(hx - 5, hz - 4), (hx + 3, hz - 4), (hx + 4, hz + 3), (hx - 4, hz + 4)], 6, 8, "skindark", 3, top=[(hx - 2.5, hz - 1.5), (hx + 1, hz - 1.5), (hx + 1.5, hz + 1.5), (hx - 2, hz + 1.5)])

    # the shovel stuck in the heap at an angle (true slopes)
    sx, sz = CX + 5.0, 13.0
    tilt = -20.0
    blade = pnshapes.rotate([(sx - 3, 3), (sx + 3, 3), (sx + 3, 9), (sx + 1, 10.5), (sx - 1, 10.5), (sx - 3, 9)], sx, 6, tilt)
    bl = front(g, blade, sz - 1, sz + 1, "steel", 5)
    P.outline(g, bl, "steel", 3, normal="z")
    shaft = pnshapes.rotate([(sx - 1, 10), (sx + 1, 10), (sx + 1, 27), (sx - 1, 27)], sx, 6, tilt)
    front(g, shaft, sz - 1, sz + 1, "wood", 5)
    grip = pnshapes.rotate([(sx - 3, 27), (sx + 3, 27), (sx + 3, 29), (sx - 3, 29)], sx, 6, tilt)
    front(g, grip, sz - 1.5, sz + 1.5, "wood", 4)
    return single("grave-mound", "terrain-nature", "Fresh Grave Mound", g)
