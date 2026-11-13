"""Bio scanner: a handheld tricorder with a sand-coloured shell, a green
waveform screen, coloured keys and a flip-up sensor antenna with a red
lamp. Held-item frame: sensor end along +X."""
from _kit import C, Grid, cbox, held, light


def build():
    g = Grid(20, 12, 7)
    cy, cz = 5, 3
    cbox(g, 0, 2, 0, 15, 8, 7, C("sand", 5), r=1)
    g.box(6, 8, 1, 14, 9, 6, C("iron", 1))  # screen on the back of hand side (+y)
    for xx in range(7, 13):
        g.set(xx, 8, 3 + (1 if xx % 3 == 0 else 0), C("toxic", 7))
    for xx, col in ((2, "red"), (3, "gold"), (4, "plasma")):
        g.set(xx, 8, 2, C(col, 6)).set(xx, 8, 4, C(col, 5))
    g.box(15, 4, 2, 17, 6, 5, C("steel", 4))  # sensor head
    g.line((16, 5, 3.5), (20, 10, 3.5), 0.5, C("steel", 6))
    g.set(19, 10, 3, C("red", 7))
    g.box(0, 0, 2, 5, 2, 5, C("sand", 3))
    light(g)
    return held("scanner", "Bio Scanner", g, grip=(4, cy, cz + 0.5), sockets={"socket-sensor": (17, 5.5, 3.5)},
                pfx=[{"effectId": "rvx-space-holo-scan", "socket": "socket-sensor", "trigger": "manual", "size": 0.28}])
