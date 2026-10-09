"""A stack of worn tyres with one loose wheel, in the Pirate Nation style."""
import numpy as np

import paint as P
from _props import asset, child, root
from pnshapes import coords, flat_ngon, ngon_radius, wheel
from voxgrid import C, Grid

TH = 6
R = 9.5
INNER = 4.6
BULGE = 1.5


def tyre_ring(g: Grid, cx, cz, y0, k: int) -> np.ndarray:
    """Build an open tyre from eight faceted rubber wedges."""
    mid = y0 + TH / 2
    inner = flat_ngon(cx, cz, INNER, 8)
    lower = flat_ngon(cx, cz, R - BULGE, 8)
    outer = flat_ngon(cx, cz, R, 8)
    mask = np.zeros(g.shape, dtype=bool)
    for i in range(8):
        j = (i + 1) % 8
        for y1, y2, profile0, profile1 in (
            (y0, mid, lower, outer),
            (mid, y0 + TH, outer, lower),
        ):
            poly = [profile0[i], profile0[j], inner[j], inner[i]]
            top = [profile1[i], profile1[j], inner[j], inner[i]]
            g.prism("y", poly, y1, y2, C("iron", 2), top=top)
            mask |= g.solids[-1].mask(g.shape)

    X, Y, Z = coords(g)
    d = ngon_radius(g, "y", cx, cz)
    ang = np.arctan2(Z - cz, X - cx)

    # Deep rubber sidewalls and one clean shoulder line keep the tyre read.
    P.flat(g, mask, "gray", 2)
    sidewall = mask & (d > INNER + 0.7) & (d < R - 1.0)
    P.flat(g, sidewall, "gray", 3)
    P.flat(g, mask & (d > R - 1.1), "gray", 4)

    # Alternating blocks make a clear tread around each outside edge.
    tread = mask & (d > R - 2.1) & (np.abs(Y - mid) < 1.5)
    blocks = (np.floor((ang + np.pi) / (2 * np.pi) * 12).astype(int) % 3) == 0
    P.flat(g, tread & blocks, "gray", 1)
    P.flat(g, mask & (np.abs(Y - mid) < 0.5) & (d > R - 1.2), "gray", 2)

    # A few fixed rust scars break the smooth rubber sidewall.
    rust_scars = np.zeros(g.shape, dtype=bool)
    for scar_angle in (-0.7, 2.5):
        delta = np.angle(np.exp(1j * (ang - scar_angle)))
        rust_scars |= sidewall & (np.abs(delta) < 0.18) & (Y > y0 + 1) & (Y < y0 + TH - 1)
    P.flat(g, rust_scars, "rust", 3)

    # A few worn shoulder marks replace the broad candy-colour bands.
    if k == 1:
        marks = mask & (d > R - 1.8) & (d < R - 0.7) & (np.abs(Y - (mid + 1)) < 0.6)
        for mark_angle in (-0.2, 2.9):
            delta = np.angle(np.exp(1j * (ang - mark_angle)))
            P.flat(g, marks & (np.abs(delta) < 0.16), "gold", 4)
    return mask


def build():
    g = Grid(32, 29, 30)
    # An irregular dusty patch grounds the stack and the loose metal parts.
    pts = [(15 + r * np.cos(a), 15 + r * np.sin(a)) for a, r in zip(
        np.linspace(0, 2 * np.pi, 10)[:-1],
        (14, 12, 13, 11.5, 14.2, 12.5, 11.8, 13.5, 12.1),
    )]
    g.prism("y", pts, 0, 1, C("sand", 5))
    dust = g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    P.flat(g, dust & ((np.floor(X + Z) % 7) == 0), "sand", 4)

    stack = ((14, 15), (15, 14), (14, 14))
    for k, (cx, cz) in enumerate(stack):
        tyre_ring(g, cx, cz, 1 + k * TH, k)

    # A bolted scrap plate closes the top tyre hole.
    cx, cz = stack[-1]
    top_y = 1 + 3 * TH
    g.prism("y", flat_ngon(cx, cz, 5.3, 8), top_y, top_y + 1, C("rust", 4))
    hub = g.solids[-1].mask(g.shape)
    bolts = np.zeros(g.shape, dtype=bool)
    for i in range(8):
        a = i * np.pi / 4
        bx, bz = cx + 4.2 * np.cos(a), cz + 4.2 * np.sin(a)
        bolts |= hub & (np.hypot(X - bx, Z - bz) < 0.8)
    P.flat(g, bolts, "steel", 5)
    g.prism("y", flat_ngon(cx, cz, 2.7, 8), top_y + 1, top_y + 2, C("red", 4))
    g.prism("y", flat_ngon(cx, cz, 1.1, 8), top_y + 2, top_y + 3, C("gold", 5))

    r = root("tire-stack", g)
    # The spare wheel sits beside the stack. Its rubber edge frames the red hub.
    sg = Grid(8, 20, 20)
    wheel(
        sg, "x", 10, 0, 8.5, 1, 7, spokes=5,
        tyre=("gray", 2), rim=("rust", 4), spoke=("red", 5),
        hub=("gold", 6), hub_out=1.0,
    )
    child(r, "spare-wheel", sg, pivot=(1.0, 0.0, 10.0), at_grid=(24.5, 1.0, 14.0))
    return asset("tire-stack", "Tyre Stack", r)
