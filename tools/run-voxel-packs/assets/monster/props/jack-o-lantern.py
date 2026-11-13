"""Giant jack-o'-lantern, in the Pirate Nation style.

After PN jackolanter01a: one iconic shape (rule K3). A blocky pumpkin of
vertical rib slabs with a stepped crown and a hooked stem (true slopes).
The carved face is paint on a broad front rib: slanted glowing eyes, a
nose and a wide toothy grin in candle yellow, each with a dark rim.
"""
from _kit import single
import paint as P
from _pn import pumpkin, stamp
from pnkit import box
from voxgrid import C, Grid

FACE = [
    "rrrrr...rrrrr",
    "ryyyrr.rryyyr",
    "rywyyr.ryywyr",
    "rrrrrr.rrrrrr",
    "......r......",
    ".....ryr.....",
    ".....rrr.....",
    "r...........r",
    "ryrrrrrrrrryr",
    "ryyoyyyyyoyyr",
    "rryyyyoyyyyrr",
    ".rrrrrrrrrrr.",
]


def build():
    g = Grid(22, 22, 22)
    cx, cz = 11, 11
    pumpkin(g, cx, 0, cz, w=20, h=15, ramp="orange", base=4, seed=1)
    # a broad front rib carries the carved face (like PN jackolanter01a)
    panel = box(g, cx - 7, 1, 0, cx + 7, 14, 3, "orange", 4)
    P.planks(g, panel, "orange", 4, width=4, across="x", length=(40, 41), nails=False, seed=2)
    legend = {"r": C("orange", 1), "y": C("gold", 4), "w": C("ember", 7), "o": C("orange", 3)}
    stamp(g, "-z", 0, cx - 6, 2, FACE, legend, depth=3)
    return single("jack-o-lantern", "props", "Giant Jack-o'-Lantern", g)
