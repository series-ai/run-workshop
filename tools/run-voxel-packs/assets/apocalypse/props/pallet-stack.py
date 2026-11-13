"""Three tidy salvage pallets with a worn tarp and a red crowbar."""
import numpy as np

import paint as P
from _props import asset, child, root
from pnkit import box
from pnshapes import bar, coords
from voxgrid import C, Grid

PW = 24


def one_pallet() -> Grid:
    """Build one pallet from long boards with clear fork runners."""
    g = Grid(PW, 4, PW)
    X, Y, Z = coords(g)

    # Three dark runners support five long deck boards.
    runners = np.zeros(g.shape, dtype=bool)
    for z in (2, 10, 18):
        runners |= box(g, 0, 0, z, PW, 2, z + 4, "darkwood", 4)
    P.planks(g, runners, "darkwood", 4, width=2, across="y", nails=False, seed=1)
    P.flat(g, runners & (Y < 1) & ((X < 1) | (X > PW - 2)), "wood", 5)

    deck = np.zeros(g.shape, dtype=bool)
    for i, z in enumerate((0, 5, 10, 15, 20)):
        plank = box(g, 0, 2, z, PW, 4, z + 4, "sand", 5)
        deck |= plank
        P.planks(g, plank, "sand", 5, width=3, across="z", length=(18, 24),
                 nails=False, seed=2, frame="top")
        # Restrained worn patches sit near board ends.
        if i in (1, 3):
            P.flat(g, plank & (Y > 3) & (X > 17) & (X < 21), "wood", 5)

    # Small nail heads sit in pairs at the ends of each other deck board.
    nail = deck & (Y > 3) & ((X < 1.5) | (X > PW - 2.5)) & (np.floor(Z) % 5 < 1)
    P.flat(g, nail, "steel", 4)
    return g


def tarp() -> Grid:
    """Lay a thin cover over the stack and drape it down the right side."""
    g = Grid(28, 14, PW)
    X, Y, Z = coords(g)

    # The sheet rests on the pallet tops. Its side panel hangs outside them.
    top = box(g, 2, 12, 2, 26, 13, 22, "teal", 4)
    panel = np.zeros(g.shape, dtype=bool)
    # Small offsets make folds in the hanging cloth. Each strip overlaps its
    # neighbor and the top sheet, so the tarp stays one connected piece.
    for z0, z1, hem, x0 in ((2, 7, 1, 24), (7, 12, 4, 25),
                            (12, 18, 0, 24), (18, 23, 3, 25)):
        panel |= box(g, x0, hem, z0, x0 + 2, 13, z1, "teal", 4)
    mask = top | panel
    P.flat(g, mask, "teal", 4)

    # Dark folds and faded repair patches follow the hanging cloth.
    folds = mask & np.isin(np.floor(Z).astype(int), (6, 15, 20))
    P.flat(g, folds, "teal", 3)
    fold_lights = mask & np.isin(np.floor(Z).astype(int), (5, 14, 19))
    P.flat(g, fold_lights, "teal", 5)
    worn = panel & (Y < 5) & ((np.floor(Z) % 8 == 2) | (np.floor(Z) % 8 == 3))
    P.flat(g, worn, "sand", 4)
    patch = top & (X > 5) & (X < 10) & (Z > 15) & (Z < 19)
    P.flat(g, patch, "teal", 6)
    P.outline(g, patch, "teal", 3, normal="y")

    # A painted yellow strap wraps over the top edge and down the tarp.
    strap = mask & (Z >= 12) & (Z < 14) & (
        ((X < 26) & (Y > 12)) | ((X >= 24) & (Y < 13))
    )
    P.flat(g, strap, "gold", 5)
    P.flat(g, strap & (np.floor(Z) == 12), "darkwood", 3)
    return g


def crowbar() -> Grid:
    """Make a thick red pry bar with a rusted hook and hazard mark."""
    g = Grid(28, 6, 4)
    X, Y, Z = coords(g)
    shaft = bar(g, "z", (4, 2), (25, 2.8), 1.2, 0, 3, "red", 5)
    hook_a = bar(g, "z", (4, 2), (2, 3.5), 1.1, 0, 3, "rust", 4)
    hook_b = bar(g, "z", (2, 3.5), (1, 4.5), 1.1, 0, 3, "rust", 4)
    hook_c = bar(g, "z", (1, 4.5), (3, 4.5), 1.1, 0, 3, "rust", 4)
    mask = shaft | hook_a | hook_b | hook_c
    P.flat(g, mask & (X > 23), "rust", 4)
    P.flat(g, mask & (X > 13) & (X < 16), "gold", 5)
    P.flat(g, mask & (Z < 1) & (X < 2), "steel", 5)
    return g


def build():
    g = one_pallet()
    r = root("pallet-stack", g)

    # The close alignment keeps each pallet readable as a separate layer.
    for i, (y, dx, dz) in enumerate(((4, 0.5, 0.0), (8, 0.0, 0.5)), start=2):
        child(r, f"pallet-{i}", one_pallet(), pivot=(PW / 2, 0.0, PW / 2),
              at_grid=(PW / 2 + dx, y, PW / 2 + dz))

    child(r, "tarp", tarp(), pivot=(0.0, 0.0, 0.0), at_grid=(0.0, 0.0, 0.0))
    child(r, "crowbar", crowbar(), pivot=(0.0, 0.0, 0.0), at_grid=(0.0, 13, 9.0))
    return asset("pallet-stack", "Pallet Stack", r)
