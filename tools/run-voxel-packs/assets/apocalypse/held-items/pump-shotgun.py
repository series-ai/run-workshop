"""Pump-action shotgun: walnut stock with a rubber butt pad, blued receiver
with a brass shell showing, long barrel over the magazine tube, a ribbed
pump slide and a taped-on flashlight. Muzzle points +X."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(56, 12, 5)
    cz = 2
    # stock (x 0..16) tapering up to the wrist
    for x in range(0, 16):
        top = 7 if x < 12 else 7 + (x - 12) // 2
        bot = 1 + x // 5
        g.box(x, bot, cz - 1, x + 1, min(top, 9), cz + 2, C("wood", 4 if x % 5 else 3))
    g.box(0, 1, cz - 1, 2, 7, cz + 2, C("iron", 1))  # butt pad
    g.box(12, 4, cz - 1, 17, 7, cz + 2, C("darkwood", 3))  # wrist/grip
    # receiver
    g.box(17, 4, cz - 1, 27, 10, cz + 2, C("iron", 3))
    g.box(17, 9, cz - 1, 27, 10, cz + 2, C("iron", 4))
    g.box(20, 6, cz + 2, 24, 8, cz + 3, C("iron", 1))  # ejection port (+z side)
    g.box(21, 6, cz + 2, 23, 7, cz + 3, C("red", 4))  # shell
    g.set(20, 6, cz + 2, C("gold", 5))
    g.box(19, 2, cz, 23, 4, cz + 1, C("iron", 2))  # trigger guard
    g.set(21, 3, cz, C("steel", 6))
    # barrel + magazine tube
    g.box(27, 8, cz - 1, 56, 10, cz + 1, C("iron", 2))
    g.box(27, 9, cz - 1, 56, 10, cz + 1, C("iron", 3))
    g.box(27, 6, cz - 1, 50, 8, cz + 1, C("iron", 3))
    g.box(54, 10, cz - 1, 55, 11, cz, C("gold", 6))  # bead
    # pump slide
    g.box(32, 5, cz - 2, 44, 9, cz + 2, C("wood", 5))
    for x in range(33, 44, 2):
        g.box(x, 5, cz - 2, x + 1, 9, cz + 2, C("wood", 3))
    # taped flashlight under the barrel
    g.box(44, 3, cz - 1, 52, 6, cz + 2, C("iron", 1))
    g.box(52, 3, cz - 1, 53, 6, cz + 2, C("gold", 7))
    g.box(46, 3, cz - 2, 48, 7, cz + 3, C("khaki", 5))
    return held_asset("pump-shotgun", "Pump Shotgun", g, grip=(14.5, 5.5, cz + 0.5),
                      sockets=[("socket-muzzle", (56, 9, cz), FWD), ("socket-light", (53, 4.5, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-shotgun-blast", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [0.0, 0.0, 1.0]}])
