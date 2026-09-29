"""Dragon hoard in the Pirate Nation style.

A faceted heap of gold coins (three stacked frustums, true slopes) painted
as overlapping rows of round coins, each with a bright glint and a dark
lower rim, studded with big cut gems in red, cyan, blue and green. A big
royal crown sits on the top at a jaunty lean: a flared gold band set with
red and blue jewels, eight pointed tines tipped with gold balls and a red
velvet cap with a gold orb. Stacks of coins stand on the slopes and at the
foot, a sword is thrust into the pile (rule F5) and loose coins lie round
it. The coin sparkle PFX plays on socket-glint. About 36 wide and 28 tall.
"""
import math

import numpy as np

import paint as P
from _life import facet_paint
from _props import coords, gem, sword
from pnshapes import disc, facets, flat_ngon, last
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 38, 30, 34
CX, CZ = 19, 17
CROWN = (CX + 0.5, 11.0, CZ - 0.5)  # crown base centre (x, y, z)


def coins(g: Grid, mask: np.ndarray, frame=None, base: int = 6, seed: int = 0) -> None:
    """Round coins in overlapping rows along a face: each coin 4 wide and 3
    tall with a bright glint on top and a dark lower rim (a row of scales),
    alternate rows shifted by half a coin."""
    U, V = P.uv(g, frame)
    row = V // 3
    uu = U + (row % 2) * 2
    lu, lv = uu % 4, V % 3
    shade = np.full(g.shape, base)
    shade = np.where(lv == 2, base - 1, shade)  # the lower half of the coin in shade
    shade = np.where((lv == 0) & ((lu == 1) | (lu == 2)), base + 1, shade)  # the glint on top
    shade = np.where((lv == 2) & (lu == 0), base - 2, shade)  # the dark gap between two coins
    odd = (P._hash(uu // 4, row, seed=seed) % np.uint64(7)) == 0  # a few coins turned (darker)
    shade = np.where(odd & (lv < 2), base - 1, shade)
    P._paint(g, mask, "gold", np.clip(shade, 1, 7))


def stack(g: Grid, x: float, y0: float, z: float, n: int, r: float = 2.2, lean: float = 0.0) -> np.ndarray:
    """A stack of n coins (1 tall each), shifted a little per coin."""
    m = np.zeros(g.shape, dtype=bool)
    for k in range(n):
        dx = lean * k + (0.3 if k % 2 else -0.2)
        g.prism("y", flat_ngon(x + dx, z, r, 8), y0 + k, y0 + k + 1, C("gold", 6 if k % 2 == 0 else 5))
        m |= last(g)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > y0 + n - 1), "gold", 7)
    return m


def crown(g: Grid) -> np.ndarray:
    """A royal crown: a flared band, eight tines with balls, a velvet cap and an orb."""
    x, y, z = CROWN
    lean = 0.9  # the whole crown leans to +x
    band_h, tine_h = 4.0, 3.5
    r0, r1 = 4.4, 5.4
    start = len(g.solids)
    g.prism("y", flat_ngon(x, z, r0, 8), y, y + band_h, C("gold", 6), top=flat_ngon(x + lean * 0.5, z, r1, 8))
    band = last(g)
    k = [0]

    def band_paint(gg, mm, fr):
        if fr == "top":
            P.flat(gg, mm, "gold", 7)
        else:
            k[0] += 1
            P.flat(gg, mm, "gold", 6 if k[0] % 2 else 5)

    facet_paint(g, g.solids[start:], band_paint)
    X, Y, Z = coords(g)
    P.flat(g, band & (Y < y + 1), "gold", 4)  # the lower rim
    P.flat(g, band & (Y > y + band_h - 1), "gold", 7)  # the upper rim
    # jewels round the band: red and blue by turns, one on every face
    ang = np.arctan2(Z - z, X - x)
    face = np.floor((ang + math.pi) / (2 * math.pi) * 8 + 0.5).astype(int) % 8
    centre = np.abs(((ang + math.pi) / (2 * math.pi) * 8 + 0.5) % 1 - 0.5) < 0.2
    jewel = band & centre & (Y > y + 1.2) & (Y < y + 3.0)
    P.flat(g, jewel & (face % 2 == 0), "red", 5)
    P.flat(g, jewel & (face % 2 == 1), "blue", 5)
    # a red velvet cap rising inside the band, a gold orb on top
    top = y + band_h
    g.prism("y", flat_ngon(x + lean * 0.5, z, r1 - 1.2, 8), top - 1, top + 2.5, C("red", 4), top=flat_ngon(x + lean * 0.8, z, 2.2, 8))
    cap = last(g)
    P.flat(g, cap & (Y > top + 1.5), "red", 5)
    g.prism("y", flat_ngon(x + lean * 0.85, z, 1.4, 6), top + 2.5, top + 4.5, C("gold", 7))
    orb = last(g)
    g.box(int(x + lean * 0.85), int(top + 4.5), int(z), int(x + lean * 0.85) + 1, int(top + 6.5), int(z) + 1, C("gold", 6))
    # eight tines: pointed pyramids on the band corners, each with a ball
    tines = np.zeros(g.shape, dtype=bool)
    for i, (px, pz) in enumerate(flat_ngon(x + lean * 0.5, z, r1, 8)):
        px, pz = x + lean * 0.5 + (px - x - lean * 0.5) * 0.88, z + (pz - z) * 0.88
        tall = tine_h + (0.8 if i % 2 == 0 else 0.0)
        g.prism("y", flat_ngon(px, pz, 1.35, 4), top, top + tall, C("gold", 6), top=[(px + lean * 0.3, pz)] * 4)
        tines |= last(g)
        g.box(int(round(px + lean * 0.3 - 0.5)), int(top + tall), int(round(pz - 0.5)), int(round(px + lean * 0.3 - 0.5)) + 1, int(top + tall) + 1, int(round(pz - 0.5)) + 1, C("gold", 7))
    P.flat(g, tines & (Y > top + 2), "gold", 7)
    return band | cap | orb | tines


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    base = [(CX - 14, CZ - 4), (CX - 7, CZ - 11), (CX + 5, CZ - 12), (CX + 14, CZ - 5), (CX + 13, CZ + 7), (CX + 4, CZ + 12), (CX - 8, CZ + 11), (CX - 14, CZ + 5)]
    mid = [(x * 0.84 + CX * 0.16 + 0.3, z * 0.84 + CZ * 0.16) for x, z in base]
    upper = [(x * 0.58 + (CX + 0.5) * 0.42, z * 0.58 + CZ * 0.42) for x, z in base]
    top = [(x * 0.3 + (CX + 0.5) * 0.7, z * 0.3 + (CZ - 0.5) * 0.7) for x, z in base]
    start = len(g.solids)
    g.prism("y", base, 0, 4, C("gold", 5), top=mid)
    g.prism("y", mid, 4, 8, C("gold", 5), top=upper)
    g.prism("y", upper, 8, 12, C("gold", 5), top=top)
    heap = g.a > 0
    for k, (m, fr) in enumerate(facets(g, g.solids[start:])):
        coins(g, m, frame=fr, base=6 if fr != "top" else 6, seed=3 + k)
    P.flat(g, heap & (Y < 1), "gold", 4)  # the foot in shadow
    # gems studded on the slopes
    for gx, gy, gz, ramp in ((CX - 8, 4, CZ - 7, "red"), (CX + 6, 5, CZ - 8, "cyan"), (CX + 10, 3, CZ + 2, "blue"), (CX - 5, 8, CZ - 2, "leaf"), (CX - 10, 3, CZ + 5, "cyan"), (CX + 4, 8, CZ + 5, "red")):
        gem(g, gx, gy, gz, r=2.0, h=3.2, ramp=ramp, shade=5)
    crown(g)
    # a goblet lying on the heap
    disc(g, "x", 9, CZ + 6, 1.8, CX - 12, CX - 7, "gold", 6, n=6)
    # coin stacks on the slopes and at the foot
    stack(g, CX - 3, 5.5, CZ - 8, 4, lean=0.15)
    stack(g, CX + 12, 2, CZ - 7, 5, r=2.0, lean=-0.1)
    stack(g, CX - 13, 0, CZ - 9, 3)
    stack(g, CX + 9, 4, CZ + 7, 3)
    # the sword thrust into the pile, leaning
    sword(g, CX + 7, 6, CZ + 1, 22, t=1, tilt=-14.0)
    # spilled coins at the foot
    for sx, sz in ((CX - 16, CZ - 2), (CX + 15, CZ + 9), (CX - 3, CZ - 15), (CX + 7, CZ - 15), (CX - 9, CZ + 14)):
        m = disc(g, "y", sx, sz, 1.8, 0, 1, "gold", 6, n=8)
        P.flat(g, m & (np.abs(X - sx) < 0.6) & (np.abs(Z - sz) < 0.6), "gold", 7)
    root = Part("treasure-pile", g)
    return Asset(id="fantasy-props-treasure-pile", pack="fantasy", category="props", name="Dragon Hoard", root=root,
                 sockets=[Socket("socket-glint", at=(CX, 17, CZ))],
                 pfx=[{"effectId": "rvx-fantasy-treasure-glint", "socket": "socket-glint", "trigger": "idle", "size": 40}])
