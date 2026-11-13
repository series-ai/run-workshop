"""Street lantern in the Pirate Nation style.

A chunky planked post on a stone plinth carries a gallows arm with a true
diagonal brace. From the arm hangs a lantern sized to the PN lamp family
(about 8 wide and 16 tall, like the PN lamp's): glowing panes with a
painted flame, a dark frame and a steep tiled pyramid cap. The lantern
hangs at a slight tilt (rule F5). About 52 tall (PN lamps are 44–60).
"""

import math


import paint as P
from _props import brace, coords, lamp_lantern, stone_box, tufts
from pnkit import box
from voxgrid import Asset, Clip, Grid, Part, Socket, sway

W, H, D = 32, 56, 16
PX, PZ = 8, 8  # post centre
S = 4  # post thickness
TOP = 50  # top of the post
ARM_Y, ARM_X = 44, 25  # arm bottom and its far end
LX = 21  # lantern centre x (under the arm)
TILT = 6.0  # the lantern hangs a little crooked (degrees about z)


def post() -> Grid:
    g = Grid(W, H, D)
    plinth = stone_box(g, PX - 5, 0, PZ - 5, PX + 5, 3, PZ + 5, "stone", 4, block=(5, 3), seed=1)
    step = stone_box(g, PX - 4, 3, PZ - 4, PX + 4, 5, PZ + 4, "stone", 5, block=(4, 2), seed=2)
    P.grime(g, plinth, height=2, seed=2)
    h = S // 2
    shaft = box(g, PX - h, 5, PZ - h, PX + h, TOP, PZ + h, "wood", 5)
    P.planks(g, shaft, "wood", 5, width=2, across="x", nails=False, seed=3)
    X, Y, Z = coords(g)
    for y0 in (12, 34):  # iron bands
        P.flat(g, shaft & (Y >= y0) & (Y < y0 + 2), "darkwood", 2)
    capm = box(g, PX - h - 1, TOP, PZ - h - 1, PX + h + 1, TOP + 2, PZ + h + 1, "darkwood", 3)
    knob = box(g, PX - 1, TOP + 2, PZ - 1, PX + 1, TOP + 4, PZ + 1, "gold", 5)
    P.flat(g, knob & (Y > TOP + 3), "gold", 7)
    # the arm, with a planked finish and a proud end block
    arm = box(g, PX + h, ARM_Y, PZ - 2, ARM_X, ARM_Y + 3, PZ + 2, "wood", 4)
    P.planks(g, arm, "wood", 4, width=3, across="y", seed=4)
    P.planks(g, capm, "darkwood", 4, width=3, across="y", seed=5)
    box(g, ARM_X - 1, ARM_Y - 1, PZ - 2, ARM_X + 1, ARM_Y + 4, PZ + 2, "darkwood", 3)
    # a true 45° brace under the arm
    x0 = PX + h
    brace(g, "z", (x0, ARM_Y - 8), (x0 + 8, ARM_Y + 0.5), 2.2, PZ - 1, PZ + 1, "wood", 3)
    tufts(g, [(PX - 7, PZ - 3), (PX + 5, PZ - 7)], flowers=[("gold", 6)])
    # the hook drops from the arm to the lantern ring
    box(g, LX - 1, ARM_Y - 2, PZ - 1, LX + 1, ARM_Y, PZ + 1, "stone", 3)
    return g


def build() -> Asset:
    g = post()
    root = Part("lantern-post", g)
    lg = Grid(12, 20, 12)
    info = lamp_lantern(lg, 6, 0, 6, s=6, body=7, seed=10)
    hang = (6.0, float(info["top"]), 6.0)  # top of the ring
    at = (float(LX), float(ARM_Y - 2), float(PZ))
    root.add(Part("lantern", lg, pivot=hang, at=at, rot=(0.0, 0.0, TILT)))
    gx, gy, gz = info["glow"]
    dx, dy = gx - hang[0], gy - hang[1]
    t = math.radians(TILT)
    glow = (at[0] + dx * math.cos(t) - dy * math.sin(t), at[1] + dx * math.sin(t) + dy * math.cos(t), at[2] + gz - hang[2])
    return Asset(
        id="fantasy-props-lantern-post", pack="fantasy", category="props", name="Street Lantern", root=root,
        sockets=[Socket("socket-light", at=glow, parent="lantern")],
        # the lantern sways a little on its hook
        clips=[Clip("idle", {"lantern": {"rot": sway(3.0, amp=(2.5, 0.0, 4.0), phase=(math.pi / 2, 0.0, 0.0))}})],
    )
