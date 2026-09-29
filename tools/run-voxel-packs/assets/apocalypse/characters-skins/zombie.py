"""Zombie skin: grey-green rotting skin, a torn white shirt with blood and
an exposed rib cage, ripped jeans, a lolling mismatched stare, a gaping
toothy mouth, a brain wound and scraggly hair; one bare foot."""
import random

import numpy as np

from _kit import PACK, RigBody, splat
from rigkit import PIVOT, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    rng = random.Random(3)
    g = rig_grid()
    b = RigBody(g)
    skin = C("moss", 5)
    b.paint(skin, C("gray", 6), C("gray", 6), skin, C("blue", 3), C("darkwood", 2))
    X, Y, Z = b.X, b.Y, b.Z
    # torn shirt: holes show skin and ribs, sleeves ragged
    torso = b.region(["Chest", "Body"])
    g.where(torso & (X >= 23) & (Y >= 22) & (Y < 30) & (Z >= 31) & (Z < 37), skin)
    for yy in (23, 25, 27):
        g.where(torso & (X >= 23) & (Y == yy) & (Z >= 32) & (Z < 36), C("bone", 6))
    g.where(torso & (X >= 23) & (Y == 24) & (Z >= 32) & (Z < 36), C("blood", 2))
    g.where(b.region(["ForeArm.L", "ForeArm.R"]) & ((Z < 20) | (Z > 56)), skin)
    g.where(b.region(["ForeArm.L", "ForeArm.R"]) & ((Z == 20) | (Z == 56)) & (Y % 2 == 0), C("gray", 5))
    splat(g, "+x", 40, 26, 2.6, C("blood", 4), seed=1)
    splat(g, "+x", 44, 19, 1.6, C("blood", 3), seed=2)
    g.where(torso & (Y == 17), C("iron", 2))  # belt
    g.where(b.region(["Leg.R", "LowerLeg.R"]) & (X >= 23) & (Y >= 10) & (Y < 13), skin)  # knee rip
    # bare right foot
    z0, z1 = b.legs["R"]
    g.box(15, 0, z0, 27, 6, z1, 0)
    g.box(16, 0, z0 + 1, 25, 5, z1 - 1, skin)
    g.box(24, 0, z0 + 1, 26, 1, z1 - 1, C("moss", 4))
    # face
    b.eyes(C("iron", 0), white=None, left=(32, 36), right=(40, 44), h=3)
    g.box(b.fx, b.hy0 + 12, 33, b.fx + 1, b.hy0 + 13, 35, C("red", 6))
    g.box(b.fx, b.hy0 + 11, 41, b.fx + 1, b.hy0 + 14, 43, C("bone", 7))
    b.mouth(C("blood", 1), z0=34, z1=43, y=b.hy0 + 3, h=4)
    for z in range(34, 43, 2):
        g.set(b.fx, b.hy0 + 6, z, C("bone", 6)).set(b.fx, b.hy0 + 3, z + 1, C("bone", 5))
    g.box(b.fx, b.hy0 + 15, 32, b.fx + 1, b.hy0 + 16, 37, C("moss", 3))
    # brain wound on top-right
    top = b.head_shell(1, 21) & (Z > 38) & (X > 17) & (X < 25)
    g.where(top, C("pink", 4))
    g.where(top & ((X + Z) % 3 == 0), C("blood", 4))
    hair = b.head_shell(1, 18) & ~top
    rnd = np.random.default_rng(4).random(g.shape) < 0.45
    g.where(hair & rnd, C("darkwood", 2))
    g.where(b.shell(["Head"], 1) & (X < b.hx0 + 3) & (Y >= b.hy0 + 8) & rnd, C("darkwood", 2))
    g.speckle(seed=5, amount=0.12)
    return Asset(id=f"{PACK}-characters-skins-zombie", pack=PACK, category="characters-skins", name="Zombie", root=Part("skin apocalypse-zombie", g, pivot=PIVOT))
