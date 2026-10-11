"""Crystal cave mouth in the Pirate Nation style.

A rock hill with a tall arched cave mouth that a person walks into. The
hill is one rock mass: three profile slabs (true slopes on the shoulders,
rule F2) whose arch notch steps in at each slab, so the mouth reads as a
recess and not as a lid on banks. The tunnel darkens with depth to a
near-black back wall, where four crystals glow in cyan, violet and plasma
blue and light the wall and floor round them (rule C3: the glow is the
magic). Crystal clusters flank the mouth outside; boulders brace the
flanks and crags with a moss blanket crown the top. The floor is a painted
earth path that runs from the turf into the dark. Detail is paint (S1).
The arch is 23 wide and 47 high at the crown (at least 40 clear over its
middle 12), so a 36-voxel person passes. About 72 wide and 64 tall.
Faces -Z.
"""
import math

import numpy as np

import paint as P
from _fterrain import ground, moss_drape, noise, outline, rock, rock_world, rounded_rock
from _kit import prop
from _life import coords, crystal, front, grass, glow
from voxgrid import Grid

SZ = (78, 70, 66)
AX = 39.0  # the arch centre (x)
G = 2  # the turf top and the cave floor
Z_FRONT, Z_MID, Z_BACK, Z_END = 10.0, 20.0, 41.0, 55.0
# (half width, jamb height, crown height) of the notch in each slab
ARCH_FRONT = (11.5, 28.0, 50.0)
ARCH_MID = (10.0, 27.0, 47.0)


def arch_y(dx, arch) -> np.ndarray:
    """Height of the notch top at x offset dx (an elliptic arch on jambs)."""
    hw, jamb, crown = arch
    t = np.clip(np.abs(dx) / hw, 0.0, 1.0)
    return jamb + (crown - jamb) * np.sqrt(1.0 - t * t)


def notch(arch, n: int = 12) -> list[tuple[float, float]]:
    """The notch outline from the right foot, over the arch, to the left foot."""
    hw, jamb, crown = arch
    pts = [(AX + hw, 0.0), (AX + hw, jamb)]
    for k in range(1, n):
        a = math.pi * k / n
        pts.append((AX + hw * math.cos(a), jamb + (crown - jamb) * math.sin(a)))
    return pts + [(AX - hw, jamb), (AX - hw, 0.0)]


def hill(profile, arch) -> list[tuple[float, float]]:
    """A front profile (x, y): the hill line from the left foot to the right
    foot, then the arch notch cut up from the ground when `arch` is set."""
    pts = list(profile)
    if arch is None:
        return pts
    return pts + notch(arch)


FRONT_LINE = [(4, 0), (5, 10), (8, 19), (11, 26), (13, 35), (18, 41), (21, 49), (27, 52), (32, 57), (38, 56), (44, 58), (50, 53),
              (55, 50), (58, 43), (63, 38), (66, 29), (70, 21), (72, 10), (74, 0)]
MID_LINE = [(2, 0), (2, 12), (5, 22), (7, 31), (11, 38), (14, 46), (20, 51), (25, 58), (33, 61), (41, 64), (48, 61), (54, 57),
            (59, 51), (63, 45), (67, 37), (71, 27), (74, 17), (76, 6), (76, 0)]
BACK_LINE = [(6, 0), (6, 12), (9, 24), (13, 34), (19, 44), (26, 50), (33, 55), (42, 57), (50, 53), (57, 46), (63, 37), (67, 27),
             (70, 15), (72, 0)]
# a boulder profile that stays broad over the top (no cone tip)
BROAD = ((0.0, 0.9), (0.3, 1.0), (0.65, 0.86), (0.88, 0.6), (1.0, 0.35))


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    pad, turf = ground(g, outline(AX, 32.0, 34.0, 28.0, 16, seed=61, wobble=0.06, turn=0.2), AX, 32.0, seed=61, top_y=G, cell=7.0)

    # the hill: one rock mass from three profile slabs
    start = len(g.solids)
    front(g, hill(FRONT_LINE, ARCH_FRONT), Z_FRONT, Z_MID, "stone", 3)
    front(g, hill(MID_LINE, ARCH_MID), Z_MID, Z_BACK, "stone", 3)
    front(g, hill(BACK_LINE, None), Z_BACK, Z_END, "stone", 3)
    mass = np.zeros(g.shape, dtype=bool)
    for solid in g.solids[start:]:
        mass |= solid.mask(g.shape)
    rock_world(g, mass, seed=62, base=3, strata=6)  # the slabs are concave: paint in world space

    # crags on the crown, and boulders that hug the shoulders and the back
    for k, (cx, cz, y0, r, h, sq) in enumerate(((30, 30, 50, 10.5, 12, (1.2, 0.9)), (50, 34, 46, 9.0, 11, (1.0, 1.1)),
                                                 (40, 53, 40, 12.0, 15, (1.3, 0.7)), (13, 31, 0, 11.0, 36, (0.8, 1.45)),
                                                 (66, 33, 0, 11.0, 32, (0.8, 1.45)), (10, 12, 0, 7.5, 17, (1.1, 0.9)),
                                                 (68, 13, 0, 7.0, 14, (1.1, 0.9)), (40, 57, 0, 13.0, 16, (1.6, 0.5)))):
        cm, cs = rounded_rock(g, cx, cz, y0, r, h, n=9, seed=64 + k, squash=sq, profile=BROAD)
        rock(g, cs, seed=64 + k, base=3, top_ramp=("stone", 4), strata=5)
        mass |= cm
    moss_drape(g, mass, 52.0, seed=72, cx=AX, cz=32.0, tongue=7.0)

    # the arch rim on the front face: a lit lip and a dark inner border
    on_front = mass & (Z < Z_FRONT + 1.0)
    dx = X - AX
    ring = on_front & (np.abs(dx) < ARCH_FRONT[0] + 3.0) & (Y < arch_y(dx, (ARCH_FRONT[0] + 3.0, ARCH_FRONT[1], ARCH_FRONT[2] + 3.0)))
    P.flat(g, ring, "stone", 5)
    P.flat(g, ring & ((np.floor(np.arctan2(Y - ARCH_FRONT[1], dx) * 7).astype(int) % 2) == 0), "stone", 4)
    P.flat(g, ring & (np.abs(dx) < ARCH_FRONT[0] + 1.0) & (Y < arch_y(dx, (ARCH_FRONT[0] + 1.0, ARCH_FRONT[1], ARCH_FRONT[2] + 1.0))), "steel", 2)
    # moss that hangs from the brow over the mouth
    brow = on_front & (np.abs(dx) < 9) & (Y > ARCH_FRONT[2] - 1) & (Y < ARCH_FRONT[2] + 5)
    drip = (P._hash(np.floor(X).astype(int), seed=73) % np.uint64(4)).astype(float)
    P.flat(g, brow & (Y > ARCH_FRONT[2] + 1 - drip * 1.2), "moss", 4)

    # the tunnel: walls and roof darken with depth to a near-black back wall
    inside = mass & (Z > Z_FRONT + 0.5) & (Z < Z_BACK + 1.0) & (np.abs(dx) < ARCH_FRONT[0] + 0.5) & (Y < arch_y(dx, ARCH_FRONT) + 1.5)
    depth = (Z - Z_FRONT) / (Z_BACK - Z_FRONT)
    P.flat(g, inside & (depth < 0.2), "stone", 2)
    P.flat(g, inside & (depth >= 0.2) & (depth < 0.45), "stone", 1)
    P.flat(g, inside & (depth >= 0.45) & (depth < 0.75), "iron", 2)
    P.flat(g, inside & (depth >= 0.75), "iron", 1)
    P.flat(g, inside & (depth >= 0.75) & (noise(X, Y, 3.0, 74) > 0.62), "navy", 2)
    # the floor: an earth path that runs into the dark
    floor = turf & (np.abs(dx) < 10.5 + (Z_FRONT - Z).clip(0, 9) * 0.4) & (Z < Z_BACK)
    P.flat(g, floor, "wood", 4)
    P.flat(g, floor & (noise(X, Z, 3.0, 75) > 0.6), "wood", 5)
    P.flat(g, floor & ((P._hash(np.floor(X).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=76) % np.uint64(9)) == 0), "stone", 4)
    P.flat(g, floor & (Z > Z_MID), "wood", 2)
    P.flat(g, floor & (Z > Z_MID + 8), "iron", 2)

    # crystals inside, and the glow they throw on the wall and floor
    lit = (inside | floor) & (Z > Z_MID + 4)
    for cx, cz, h, r, ramp, lean in ((AX - 5, 35, 15, 2.8, "arcane", (-1.5, 0.5)), (AX + 4, 37, 20, 3.4, "cyan", (1.0, 0.5)),
                                     (AX - 0.5, 38.5, 11, 2.4, "plasma", (0, 0)), (AX + 7.5, 31, 8, 2.0, "cyan", (1.5, 0))):
        halo = lit & (np.hypot(X - cx, (Y - G - h * 0.45) * 0.6) < 5.5) & (np.abs(Z - cz) < 6)
        glow(g, halo, (cx, G + h * 0.45, cz + 2), 5.5, "arcane" if ramp == "arcane" else "plasma", inner=3, outer=0)
        crystal(g, cx, cz, G - 1, r, h, r * 1.8, ramp, 5, n=6, lean=lean, turn=0.3)
    # crystal clusters flanking the mouth outside
    for cx, cz, h, r, ramp, lean in ((AX - 16, 6.5, 16, 3.4, "cyan", (-2.5, -1)), (AX - 20.5, 9, 10, 2.6, "arcane", (-2, 0)),
                                     (AX - 14, 3.5, 7, 2.0, "plasma", (0, -1.5)), (AX + 16, 7, 13, 3.0, "cyan", (2.5, -1)),
                                     (AX + 20, 5, 8, 2.2, "blue", (1.5, -1.5))):
        crystal(g, cx, cz, G - 1, r, h, r * 1.8, ramp, 5, n=6, lean=lean, turn=0.5)
    grass(g, [(8, G, 32), (70, G, 34), (24, G, 4), (57, G, 3), (30, G, 59), (52, G, 60)], "leaf", 5)
    return prop("fantasy-terrain-nature-crystal-cave-mouth", "Crystal Cave Mouth", g,
                sockets_at={"socket-function": (AX, 42.0, Z_FRONT + 3.0)},
                pfx=[{"effectId": "rvx-fantasy-arcane-orbit", "socket": "socket-function", "trigger": "idle", "size": 16}])
