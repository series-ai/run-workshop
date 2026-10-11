"""Raider skin: a wasteland raider with a red mohawk, war-paint stripes,
goggles pushed up, a black leather vest over bare arms, a tyre-rubber
shoulder pad with steel spikes, a bullet bandolier, camo cargo pants and
spiked boots."""
import numpy as np

from _kit import PACK, RigBody
from rigkit import PIVOT, dilate, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    skin = C("skindark", 5)
    b.paint(skin, C("iron", 2), skin, C("iron", 1), C("khaki", 3), C("iron", 2), cuff=C("steel", 5))
    g.where(b.region(["Chest"]) & (X >= 23) & (Z >= 36) & (Z < 40), skin)  # open vest
    g.where(b.region(["Chest", "Body"]) & (Y == 17), C("darkwood", 3))
    # camo blotches
    rnd = np.random.default_rng(3).random(g.shape)
    legs = b.region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"])
    g.where(legs & (rnd < 0.25), C("khaki", 2))
    g.where(legs & (rnd > 0.8), C("sand", 3))
    # bandolier across the chest
    band = b.torso_shell(1, 18, 36) & (np.abs((Y - 18) - (Z - 29) * 1.0) <= 1)
    g.where(band, C("darkwood", 3))
    g.where(band & (X >= 24) & (Z % 2 == 0), C("gold", 5))
    # tyre shoulder pad with spikes on the left shoulder
    pad = dilate(b.region(["Arm.L"]) | b.region(["Chest"]), 2) & ~b.body() & (Z >= 22) & (Z < 32) & (Y >= 32)
    g.where(pad, C("gray", 2))
    g.where(pad & ((Z + Y) % 3 == 0), C("gray", 1))
    for sz, sx in ((24, 20), (27, 18), (29, 22)):
        g.box(sx, 38, sz, sx + 1, 42, sz + 1, C("steel", 6))
    # studded wrist bands
    g.where(b.shell(["ForeArm.L", "ForeArm.R"], 1) & ((Z == 17) | (Z == 18) | (Z == 58) | (Z == 59)), C("iron", 2))
    # spiked boot toes
    for z0, z1 in b.legs.values():
        g.box(26, 1, (z0 + z1) // 2, 28, 2, (z0 + z1) // 2 + 1, C("steel", 6))
    # face: war paint, scar, snarl
    b.eyes(C("iron", 0), white=C("bone", 7), y=b.hy0 + 11)
    g.where((X == b.fx) & (Y >= b.hy0 + 9) & (Y < b.hy0 + 15) & (((Z >= 30) & (Z < 32)) | ((Z >= 45) & (Z < 47))), C("red", 4))
    g.where((X == b.fx) & (Y == b.hy0 + 12) & (Z >= 36) & (Z < 40), C("iron", 1))
    b.mouth(C("blood", 1), z0=35, z1=42, y=b.hy0 + 5, h=2)
    g.box(b.fx, b.hy0 + 6, 36, b.fx + 1, b.hy0 + 7, 41, C("bone", 6))
    g.box(b.fx, b.hy0 + 8, 41, b.fx + 1, b.hy0 + 14, 42, C("skindark", 3))  # scar
    # goggles on the forehead
    gog = b.head_shell(1, 16) & (Y < b.hy0 + 19)
    g.where(gog, C("iron", 2))
    g.box(b.fx + 1, b.hy0 + 16, 32, b.fx + 2, b.hy0 + 19, 36, C("orange", 5))
    g.box(b.fx + 1, b.hy0 + 16, 41, b.fx + 2, b.hy0 + 19, 45, C("orange", 5))
    # mohawk: a tall red crest along the top centre, shaved sides
    for x in range(b.hx0 + 1, b.hx1 - 1):
        h = 7 - abs(x - (b.hx0 + b.hx1) / 2) * 0.35
        g.box(x, b.hy1, 36, x + 1, b.hy1 + int(h), 41, C("red", 4 if x % 2 else 5))
        g.box(x, b.hy1 + int(h) - 1, 37, x + 1, b.hy1 + int(h), 40, C("red", 6))
    g.where(b.head_shell(1, 19) & ~gog & ((Z < 36) | (Z >= 41)), C("skindark", 4))  # stubble scalp
    g.speckle(seed=9, amount=0.1)
    return Asset(id=f"{PACK}-characters-skins-raider", pack=PACK, category="characters-skins", name="Raider", root=Part("skin apocalypse-raider", g, pivot=PIVOT))
