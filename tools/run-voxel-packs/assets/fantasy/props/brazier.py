"""Stone brazier in the Pirate Nation style.

A wide octagonal stone bowl (a frustum, true slopes) with a framed gold rim
sits on three splayed wooden legs (true diagonals). Coal chunks and three
stepped flame tongues fill it; the fire PFX plays on socket-fire above the
flames. About 20 wide and 24 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords
from pnkit import box, edges
from pnshapes import flat_ngon, last, radial
from voxgrid import C, Asset, Grid, Part, Socket

W, H = 20, 26
CX = CZ = 10.0
B0, B1 = 9, 14  # bowl bottom and rim


def stepped_flame(g: Grid, cx, y0, cz, profile) -> np.ndarray:
    """Build one painted, stepped fire lick from voxel-sized layers.

    Each profile row is (height, x shift, z shift, width, depth). The uneven
    shifts make the flame lean and break its outline into small licks.
    """
    X, Y, Z = coords(g)
    mask = np.zeros(g.shape, dtype=bool)
    for dy, sx, sz, width, depth in profile:
        x0 = int(np.floor(cx + sx - width / 2))
        z0 = int(np.floor(cz + sz - depth / 2))
        layer = box(g, x0, y0 + dy, z0, x0 + width, y0 + dy + 1, z0 + depth, "orange", 5)
        mask |= layer
        P.flat(g, layer, "orange", 5 if dy < len(profile) - 2 else 4)
        # The hot core sits low. The upper layers keep a broken orange edge.
        core = layer & (np.floor(X) == np.floor(cx + sx)) & (np.floor(Z) == np.floor(cz + sz)) & (dy <= 1)
        P.flat(g, core, "gold", 7)
        P.flat(g, core & (dy == 0), "bone", 7)
        P.flat(g, layer & (dy >= len(profile) - 2), "red", 5)
    return mask


def build() -> Asset:
    g = Grid(W, H, W)
    X, Y, Z = coords(g)
    # Three stout, splayed wooden legs. Gold collars join them to the bowl.
    leg_masks = []
    for dx, dz in ((-1, -1), (1, -1), (0, 1)):
        if dz < 0:
            leg = brace(g, "z", (CX + dx * 7.5, 1.3), (CX + dx * 3.5, B0 + 1), 3.2, CZ + dz * 5 - 1.5, CZ + dz * 5 + 1.5, "darkwood", 4)
        else:
            leg = brace(g, "x", (1.3, CZ + 7.5), (B0 + 1, CZ + 3.5), 3.2, CX - 1.5, CX + 1.5, "darkwood", 4)
        leg_masks.append(leg)
    for leg in leg_masks:
        P.planks(g, leg, "darkwood", 4, width=3, across="x", nails=False, seed=4)
        P.flat(g, leg & (Y >= B0 - 1) & (Y < B0), "gold", 4)
        P.flat(g, leg & (Y >= B0 - 0.5) & (Y < B0), "gold", 6)
    for fx, fz in ((CX - 9.5, CZ - 6), (CX + 7, CZ - 6), (CX - 1, CZ + 7)):
        foot = box(g, fx, 0, fz, fx + 3, 2, fz + 3, "darkwood", 4)
        P.flat(g, foot & (Y > 0), "wood", 6)
        P.flat(g, foot & (Y < 1), "gold", 5)
    # the bowl: a stone frustum with a gold rim and a stone foot
    g.prism("y", flat_ngon(CX, CZ, 4.5, 8), B0 - 3, B0, C("stone", 4), top=flat_ngon(CX, CZ, 5.0, 8))
    foot = last(g)
    g.prism("y", flat_ngon(CX, CZ, 5.0, 8), B0, B1, C("stone", 5), top=flat_ngon(CX, CZ, 8.0, 8))
    bowl = last(g)
    P.stone(g, bowl | foot, "stone", 5, block=(4, 3), seed=2)
    P.flat(g, edges(bowl | foot), "stone", 2)
    P.flat(g, bowl & (Y > B1 - 1.5), "gold", 5)
    # A dark inner lip separates the fire bed from the orange outer rim.
    rim_top = bowl & (Y > B1 - 1.5)
    P.flat(g, rim_top & (radial(g, "y", CX, CZ) < 6.8), "darkwood", 2)
    # Charred coal chunks frame a compact, bright ember core.
    for x0, z0, width, depth in ((7, 8, 2, 2), (12, 7, 2, 3), (12, 12, 3, 2), (7, 12, 2, 2)):
        coal = box(g, x0, B1, z0, x0 + width, B1 + 1, z0 + depth, "darkwood", 2)
        P.flat(g, coal & (X == x0 + 0.5) & (Z == z0 + 0.5), "orange", 5)
        P.flat(g, coal & (X == x0 + 1.5) & (Z == z0 + 1.5), "red", 4)
    core = box(g, CX - 2, B1, CZ - 2, CX + 2, B1 + 1, CZ + 2, "gold", 7)
    P.flat(g, core & (Y > B1), "bone", 7)
    # Layered licks have hot roots, orange bodies and red, uneven tips.
    stepped_flame(g, CX - 1, B1 + 1, CZ - 1, [
        (0, 0, 0, 4, 3), (1, 0, 0, 4, 3), (2, -1, 0, 3, 3),
        (3, -1, 1, 3, 2), (4, 0, 1, 2, 2), (5, 1, 1, 2, 1),
        (6, 1, 0, 2, 2), (7, 0, -1, 2, 2), (8, 0, -1, 1, 1),
    ])
    stepped_flame(g, CX + 3, B1 + 1, CZ + 1, [
        (0, 0, 0, 3, 2), (1, 0, 0, 3, 2), (2, 1, 0, 2, 2),
        (3, 1, -1, 2, 1), (4, 1, -1, 1, 1), (5, 1, -1, 1, 1),
    ])
    stepped_flame(g, CX - 4, B1 + 1, CZ + 2, [
        (0, 0, 0, 3, 2), (1, 0, 0, 3, 2), (2, -1, 0, 2, 2),
        (3, -1, 1, 1, 1), (4, -1, 1, 1, 1),
    ])
    root = Part("brazier", g)
    return Asset(id="fantasy-props-brazier", pack="fantasy", category="props", name="Stone Brazier", root=root,
                 sockets=[Socket("socket-fire", at=(CX - 1, B1 + 7, CZ))],
                 pfx=[{"effectId": "rvx-fantasy-hearth-fire", "socket": "socket-fire", "trigger": "idle", "size": 16}])
