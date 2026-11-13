"""Morning-star flail with a wrapped haft, interlocking chain and forged head.

The haft runs along +X in the PN held-item frame.
"""
import numpy as np

from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(40, 16, 15)
    cy, cz = 11, 7

    # Darkwood haft with a rust-leather wrap and a shaped end cap.
    g.box(0, cy - 1, cz - 1, 18, cy + 1, cz + 1, C("wood", 4))
    g.box(0, cy - 2, cz - 2, 2, cy + 2, cz + 2, C("steel", 4))
    g.box(0, cy - 1, cz - 1, 2, cy + 1, cz + 1, C("gold", 5))
    for x in (3, 14, 16):
        g.box(x, cy - 2, cz - 2, x + 1, cy + 2, cz + 2, C("steel", 4))
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 1, C("gold", 5))
    g.box(4, cy - 1, cz - 1, 13, cy + 1, cz + 1, C("rust", 3))
    # Dark bands cross every side of the leather, like a tight spiral wrap.
    for x in (5, 8, 11):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 1, C("rust", 1))
    g.box(16, cy - 1, cz - 1, 18, cy + 1, cz + 1, C("steel", 4))

    # Wide square links have large openings and alternate their plane.
    # Their centers follow one short droop from the haft to the head.
    def link(cx, yy, plane):
        x0, y0 = round(cx), round(yy)
        if plane == "xy":
            g.box(x0 - 1, y0 - 2, cz, x0 + 2, y0 - 1, cz + 1, C("steel", 4))
            g.box(x0 - 1, y0 + 2, cz, x0 + 2, y0 + 3, cz + 1, C("steel", 6))
            g.box(x0 - 1, y0 - 1, cz, x0, y0 + 2, cz + 1, C("steel", 4))
            g.box(x0 + 1, y0 - 1, cz, x0 + 2, y0 + 2, cz + 1, C("steel", 6))
        else:
            g.box(x0 - 1, y0, cz - 2, x0 + 2, y0 + 1, cz - 1, C("steel", 4))
            g.box(x0 - 1, y0, cz + 2, x0 + 2, y0 + 1, cz + 3, C("steel", 6))
            g.box(x0 - 1, y0, cz - 1, x0, y0 + 1, cz + 2, C("steel", 4))
            g.box(x0 + 1, y0, cz - 1, x0 + 2, y0 + 1, cz + 2, C("steel", 6))

    for i in range(5):
        t = i / 4
        link(19 + i * 2.1, 10.5 - t * 1.5, "xy" if i % 2 == 0 else "xz")

    # A bright steel body sits inside a continuous dark iron rim.
    bx, by = 32, 7
    x, y, z = np.meshgrid(np.arange(40) + 0.5, np.arange(16) + 0.5,
                          np.arange(15) + 0.5, indexing="ij")
    dx, dy, dz = x - bx, y - by, z - cz
    radius = np.sqrt(dx * dx + dy * dy + dz * dz)
    shell = radius <= 4.5
    g.where(shell, C("steel", 4))
    core = radius <= 3.8
    g.where(shell & ((dy > 0.7) | (dz > 0.7)), C("steel", 5))
    g.where(shell & (dy > 1.2) & (dz > 1.0), C("steel", 6))
    # Broad plate seams and rivets divide the shell into forged panels.
    seam = shell & (radius > 3.7) & ((np.abs(dx) < 0.55) | (np.abs(dz) < 0.55))
    g.where(seam, C("iron", 3))
    rivets = shell & (radius > 3.9) & (np.abs(dy) > 2.6) & (np.abs(dz) > 2.6)
    g.where(rivets, C("gold", 4))

    # A gold and cyan maker's mark is painted on both broad cheeks.
    for sign in (-1, 1):
        cheek = shell & (sign * dz > 2.1)
        mark_r = dx * dx + dy * dy
        g.where(cheek & (mark_r < 6.25), C("gold", 4))
        g.where(cheek & (mark_r < 3.2), C("blue", 4))
        g.where(cheek & (mark_r < 0.8), C("cyan", 6))
        g.where(cheek & (mark_r < 0.3), C("gold", 7))

    # Four short spikes taper from broad bases into one-voxel tips.
    g.box(bx - 1, by + 3, cz - 1, bx + 2, by + 5, cz + 2, C("steel", 4))
    g.box(bx, by + 5, cz, bx + 1, by + 6, cz + 1, C("steel", 5))
    g.box(bx - 1, by - 5, cz - 1, bx + 2, by - 3, cz + 2, C("steel", 4))
    g.box(bx, by - 6, cz, bx + 1, by - 5, cz + 1, C("steel", 5))
    g.box(bx - 1, by - 1, cz + 3, bx + 2, by + 2, cz + 5, C("steel", 4))
    g.box(bx, by, cz + 5, bx + 1, by + 1, cz + 6, C("steel", 5))
    g.box(bx - 1, by - 1, cz - 5, bx + 2, by + 2, cz - 3, C("steel", 4))
    g.box(bx, by, cz - 6, bx + 1, by + 1, cz - 5, C("steel", 5))

    return held("flail", "Morning-Star Flail", g, (6.5, cy, cz),
                {"socket-ball": (bx, by, cz)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-ball",
                  "trigger": "manual", "size": 0.3}])
