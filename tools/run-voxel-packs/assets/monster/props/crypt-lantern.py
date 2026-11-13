"""Crypt lantern, in the Pirate Nation haunted style.

One oversized function prop (rule K3, F4): a tall gothic lantern on a
stout iron column over a chamfered grey plinth. Toxic-green panes with a
painted flame inside a thick iron frame, a steep violet tiled cap, a gold
hanging ring and a short chain, gold skull bosses on the column and moss
at the foot. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, single
from _props import chain, idx, plinth, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 20, 38, 20
CX = CZ = 10.0
POST0, POST1 = 4, 10


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the plinth: two true-chamfered grey stone steps
    plinth(g, CX - 8, CZ - 8, CX + 8, CZ + 8, 0, 3, "gray", 5, bevel=1.4, seed=1)
    plinth(g, CX - 6, CZ - 6, CX + 6, CZ + 6, 3, 2, "gray", 6, bevel=1.0, seed=2)

    # ---- the iron column with painted bands and two gold skull bosses
    post = box(g, CX - 3, POST0, CZ - 3, CX + 3, POST1 + 1, CZ + 3, "steel", 5)
    P.plates(g, post, "steel", 5, size=(5, 4), rivets=True, seed=3)
    P.flat(g, edges(post), "steel", 3)
    for yb in (POST0 + 1, POST1 - 1):
        P.flat(g, post & (Y == yb), "gold", 4)
    for face, pl in (("-z", CZ - 3), ("+z", CZ + 2)):
        import pnglyph
        pnglyph.icon(g, face, pl, int(CX - 2), POST0 + 3, "skull", "gold", 5, depth=2)

    # ---- the lantern itself
    lan = S.lantern(g, int(CX), POST1, int(CZ), s=10, body=10, glass="toxic", roof="purple", frame="iron", seed=4)
    # repaint the kit's warm flame as witch-fire, so the panes read in one hue
    for old, new in ((C("orange", 5), C("toxic", 7)), (C("gold", 7), C("lime", 7)), (C("red", 4), C("toxic", 4))):
        g.a[(g.a == old) & lan["panes"]] = new
    P.flat(g, lan["panes"] & (Y == POST1 + 3), "iron", 3)
    # a gold ring and a short chain over the cap
    P.flat(g, lan["ring"], "gold", 5)
    chain(g, CX, CZ, lan["top"] + 4, 2, ramp="iron", base=6)

    # ---- moss and a fallen gold ring at the foot
    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=2, chance=0.10, seed=5)
    ring = S.disc(g, "y", CX + 5.5, CZ - 5.0, 2.2, 5, 6, "gold", 4, n=8)
    P.flat(g, ring & (S.radial(g, "y", CX + 5.5, CZ - 5.0) < 1.2), "gray", 5)

    glow = lan["glow"]
    return single("crypt-lantern", "props", "Crypt Lantern", g,
                  sockets=[Socket("socket-flame", at=(float(glow[0] - W / 2), float(glow[1]), float(glow[2] - D / 2)))],
                  pfx=[pfx("rvx-monster-ghost-lantern", "socket-flame", "idle", size=18)])
