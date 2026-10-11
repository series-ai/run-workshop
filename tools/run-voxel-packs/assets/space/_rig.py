"""Space pack rig helpers (avatar parts and skins on the PN rig grid).

Rig space: 40 x 92 x 76 voxels, pivot (20, 0, 38), the character faces +X,
+Y is up, the right arm runs along +Z. PN head box x13-28, y36-58, z27-48
(face plate at x = 28); torso x16-23, y16-35, z29-46; arms y29-34.
"""
from __future__ import annotations

import numpy as np

from rigkit import PIVOT, bbox, body, dilate, leg_z_ranges, part_rules, region, rig_grid, shell  # noqa: F401
from voxgrid import C, Grid, Part  # noqa: F401

HEAD = ["Head"]
TORSO = ["Chest", "Body"]
ARMS = ["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]
UPPER_ARMS = ["Arm.L", "Arm.R"]
HANDS = ["Hand.L", "Hand.R"]
LEGS = ["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]
FEET = ["Foot.L", "Foot.R"]

_HB = None


def head_box():
    """((x0, y0, z0), (x1, y1, z1)) of the PN head, max exclusive."""
    global _HB
    if _HB is None:
        _HB = bbox(region(HEAD))
    return _HB


def rxyz():
    sx, sy, sz = 40, 92, 76
    return np.arange(sx)[:, None, None], np.arange(sy)[None, :, None], np.arange(sz)[None, None, :]


def full(m):
    return np.broadcast_to(m, (40, 92, 76))


def rpart(name: str, grid: Grid, display: str, **rules) -> Part:
    return Part(name, grid, pivot=PIVOT, meta={"name": display, "rules": part_rules(**rules)})


def fill(g: Grid, mask, c: int) -> Grid:
    g.a[full(mask)] = c
    return g


def paint(g: Grid, mask, c: int) -> Grid:
    m = full(mask) & (g.a != 0)
    g.a[m] = c
    return g


FACE_X = 28  # the head's front plate (last head voxel along +X)
EYE_Y = 47
EYE_Z = ((33, 35), (42, 44))  # left eye z span, right eye z span
MOUTH_Y = 42


def face(g: Grid, x: int = FACE_X, eye=None, pupil=None, mouth=None, brow=None, eye_h: int = 2, big: bool = False) -> Grid:
    """Paint a simple PN-style face on plane `x`."""
    eye = eye if eye is not None else C("navy", 1)
    for z0, z1 in EYE_Z:
        if big:  # big almond alien eyes
            g.box(x, EYE_Y - 2, z0 - 2, x + 1, EYE_Y + 2, z1 + 1, eye)
            g.box(x, EYE_Y + 2, z0 - 1, x + 1, EYE_Y + 3, z1, eye)
            g.set(x, EYE_Y + 1, z0 - 1, C("gray", 7))
        else:
            g.box(x, EYE_Y, z0, x + 1, EYE_Y + eye_h, z1, eye)
            if pupil is not None:
                g.set(x, EYE_Y + 1, z0, pupil)
    if mouth is not None:
        g.box(x, MOUTH_Y, 36, x + 1, MOUTH_Y + 1, 40, mouth)
    if brow is not None:
        for z0, z1 in EYE_Z:
            g.box(x, EYE_Y + eye_h + 1, z0 - 1, x + 1, EYE_Y + eye_h + 2, z1 + 1, brow)
    return g


def base_body(g: Grid, skin: int, top: int, sleeve: int | None = None, hand: int | None = None, legs: int | None = None) -> Grid:
    fill(g, region(HEAD), skin)
    fill(g, region(TORSO), top)
    fill(g, region(ARMS), sleeve if sleeve is not None else top)
    fill(g, region(HANDS), hand if hand is not None else skin)
    fill(g, region(LEGS), legs if legs is not None else top)
    fill(g, region(FEET), legs if legs is not None else top)
    return g


def boots(g: Grid, c: int, cuff: int, sole: int, height: int = 7, pad: int = 0) -> Grid:
    for z0, z1 in leg_z_ranges().values():
        g.box(15 - pad, 0, z0 - pad, 27 + pad, height, z1 + pad, c)
        g.box(15 - pad, height - 1, z0 - pad, 26 + pad, height, z1 + pad, cuff)
        g.box(15 - pad, 0, z0 - pad, 27 + pad, 1, z1 + pad, sole)
        g.box(25 + pad, 0, z0, 28 + pad, 2, z1, cuff)  # toe cap
    return g


def gloves(g: Grid, c: int, cuff: int | None = None, grow: int = 1) -> Grid:
    m = dilate(region(HANDS), grow) & ~body() | region(HANDS)
    fill(g, m, c)
    if cuff is not None:
        _, y, z = rxyz()
        fill(g, dilate(region(["ForeArm.L", "ForeArm.R"]), 1) & ((z <= 15) | (z >= 60)) & ~region(HANDS) & (dilate(region(HANDS), 2)), cuff)
    return g


def speck_rig(g: Grid, seed: int, amount: float = 0.1, ramps=None) -> Grid:
    from _kit import speck

    return speck(g, seed, amount, ramps=ramps)
