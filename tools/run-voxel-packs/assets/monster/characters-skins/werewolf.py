"""Werewolf skin: PN body proportions under a grey wolf pelt: a long
snarling muzzle, tall ears, a shaggy mane, pale chest, clawed hands and
paws, torn trousers with a rope belt and a bushy tail."""

from _kit import C, FACE_X, HEAD, Part, paint_body, rig_canvas, scatter, speck, xyz
from rigkit import PIVOT, leg_z_ranges, region, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    fur, fur_l, fur_d = C("stone", 4), C("stone", 5), C("stone", 3)
    paint_body(g, fur, fur, fur, C("stone", 3), C("navy", 2), C("stone", 3))
    g.where(region(["Chest"]) & (x >= 22), C("bone", 4))  # pale chest
    g.where(region(["Body"]) & (y == 17), C("sand", 4))  # rope belt
    g.where(shell(["Leg.L", "Leg.R"], 1) & (y >= 9) & (((x + z) % 3) != 0), C("navy", 2))  # ragged trouser cuffs
    # mane: thick fur collar
    mane = shell(["Chest"], 2) & (y >= 30) & (y < 37)
    g.where(mane, fur_l)
    g.where(mane & (((x + y + z) % 3) == 0), fur_d)
    # head: fur, muzzle, ears, eyes
    h = HEAD
    g.where(region(["Head"]) & (y >= 54), fur_l)
    g.box(FACE_X + 1, 39, 33, FACE_X + 7, 46, 43, fur_l)  # muzzle
    g.box(FACE_X + 1, 39, 34, FACE_X + 7, 42, 42, C("bone", 4))  # lower jaw
    g.box(FACE_X + 5, 44, 36, FACE_X + 8, 47, 40, C("iron", 1))  # nose
    g.box(FACE_X + 1, 42, 34, FACE_X + 7, 43, 42, C("blood", 2))  # snarl line
    for zz in (35, 41):
        g.box(FACE_X + 4, 41, zz, FACE_X + 5, 43, zz + 1, C("bone", 7))  # fangs
    for z0 in (32, 42):
        g.box(FACE_X, 48, z0, FACE_X + 1, 50, z0 + 3, C("ember", 6))  # eyes
        g.box(FACE_X, 50, z0 - 1, FACE_X + 1, 51, z0 + 4, fur_d)  # scowl
    for s, zc in ((-1, 30), (1, 45)):  # tall ears
        for k in range(8):
            w = max(1, 3 - k // 3)
            g.box(18, 59 + k, zc - w, 23, 60 + k, zc + w, fur_d if k > 4 else fur)
        g.box(21, 60, zc - 1, 23, 64, zc + 1, C("pink", 2))
    for zz in (27, 48):  # cheek tufts
        g.box(22, 40, zz - (1 if zz < 38 else 0), 28, 46, zz + (1 if zz > 38 else 0) + 0, fur_l)
    # claws on hands, paws on feet
    for zc in (10, 66):
        for k in range(3):
            g.box(23, 29 + k * 2, zc - (1 if zc < 38 else 0), 25, 30 + k * 2, zc + (1 if zc > 38 else 0), C("bone", 6))
    for (z0, z1) in leg_z_ranges().values():
        g.box(15, 0, z0 - 1, 27, 4, z1 + 1, fur_d)
        for zz in range(z0, z1, 3):
            g.box(27, 0, zz, 29, 2, zz + 1, C("bone", 6))  # toe claws
    # bushy tail behind
    for k in range(9):
        g.box(12 - k // 2, 14 - k, 36, 16 - k // 2, 17 - k, 41, fur if k % 3 else fur_l)
    scatter(g, 501, (g.a == fur) | (g.a == fur_l), 0.1, [fur_d])
    speck(g, 502, 0.04)
    return Asset(id="monster-characters-skins-werewolf", pack="monster", category="characters-skins", name="Werewolf",
                 root=Part("skin monster-werewolf", g, pivot=PIVOT))
