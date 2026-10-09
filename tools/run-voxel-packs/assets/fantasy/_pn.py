"""Fantasy pack helpers in the Pirate Nation style (import as `_pn`).

Shared by the fantasy assets so they read as one family: the same oversized
lantern hangs on the lantern post and on the covered wagon. Everything
fills a grid and paints it; the atlas turns colours into texture (rule S1).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from pnkit import box, edges, ngon
from voxgrid import C, Grid


def _coords(g: Grid):
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def flame(g: Grid, mask: np.ndarray, cx: float, cz: float, v0: float, height: float, width: float, outer=("orange", 5), inner=("gold", 7), rim=("red", 4)) -> None:
    """Paint a teardrop flame glyph on every vertical face of a box mask:
    a round belly at the bottom that tapers to a point at the top."""
    X, Y, Z = _coords(g)
    zface = mask & ((np.roll(mask, 1, axis=2) == 0) | (np.roll(mask, -1, axis=2) == 0))
    du = np.where(zface, np.abs(X - cx), np.abs(Z - cz))
    v = (Y - v0) / height  # 0 at the bottom of the flame, 1 at its tip
    belly = 0.38
    r = np.where(v < belly, np.sqrt(np.clip(1 - ((v - belly) / belly) ** 2, 0, 1)), np.clip((1 - v) / (1 - belly), 0, 1) ** 1.3)
    shape = mask & (v >= 0) & (v <= 1) & (du <= r * width / 2)
    P.flat(g, shape, *outer)
    P.flat(g, shape & (v > 0.72), *rim)  # a red tip
    core = mask & (v >= 0.1) & (v <= 0.45) & (du <= r * width / 2 - 2.2)
    P.flat(g, core, *inner)


def lantern(g: Grid, cx: int, y0: int, cz: int, s: int = 10, body: int = 13, glass: str = "gold", roof: str = "red", seed: int = 0) -> dict:
    """An oversized square lantern (rule K3): a tapered dark base (true
    slopes), tall amber panes with a painted flame glyph inside a thick dark
    frame, and a steep tiled gable cap with the gable to the front, like
    the tavern roof. (cx, cz) is the centre; y0 the bottom. Returns the glow
    centre, the top of the hanging ring and how far the cap reaches out."""
    h = s // 2
    g.prism("z", [(cx - 2, y0), (cx + 2, y0), (cx + h + 1, y0 + 3), (cx - h - 1, y0 + 3)], cz - h - 1, cz + h + 1, C("darkwood", 4))
    plate = g.solids[-1].mask(g.shape)
    P.planks(g, plate, "darkwood", 4, width=2, across="y", nails=False, seed=seed)
    yb0, yb1 = y0 + 3, y0 + 3 + body
    panes = box(g, cx - h, yb0, cz - h, cx + h, yb1, cz + h, glass, 6)
    flame(g, panes, cx, cz, yb0 + 1.2, body - 2.4, s * 0.8)
    X, Y, Z = _coords(g)
    frame = edges(panes) | (panes & (Y < yb0 + 1.0)) | (panes & (Y > yb1 - 1.0))
    P.flat(g, frame, "darkwood", 3)
    eave = box(g, cx - h - 1, yb1, cz - h - 1, cx + h + 1, yb1 + 2, cz + h + 1, "darkwood", 4)
    P.planks(g, eave, "darkwood", 4, width=2, across="y", nails=False, seed=seed + 1)
    rise = s
    g.prism("z", [(cx - h - 2, yb1 + 2), (cx + h + 2, yb1 + 2), (cx, yb1 + 2 + rise)], cz - h - 2, cz + h + 2, C(roof, 4))
    cap = g.solids[-1].mask(g.shape)
    P.tiles(g, cap, roof, 4, row=3, width=4, along="z", seed=seed + 2)
    ring_y = yb1 + 2 + rise - 2
    ring = box(g, cx - 1, ring_y, cz - 2, cx + 1, ring_y + 3, cz + 2, "gold", 4)
    return {"glow": (cx, yb0 + body / 2, cz), "top": ring_y + 3, "reach": h + 2, "panes": panes, "ring": ring}


def arch(cx: float, y0: float, half: float, top: float, bulge: float = 1.0) -> list[tuple[float, float]]:
    """A bulging canvas-hood section (x, y), bottom at y0, crown at `top`:
    six true facets, wider at the shoulders than at the rail."""
    hgt = top - y0
    return [
        (cx - half, y0),
        (cx + half, y0),
        (cx + half + 2 * bulge, y0 + 0.42 * hgt),
        (cx + half * 0.72, y0 + 0.84 * hgt),
        (cx + half * 0.28, top),
        (cx - half * 0.28, top),
        (cx - half * 0.72, y0 + 0.84 * hgt),
        (cx - half - 2 * bulge, y0 + 0.42 * hgt),
    ]


def wheel(g: Grid, x0: int, x1: int, cy: float, cz: float, r: float, spokes: int = 8, rim: float = 3.0, hub: float = 3.0, seed: int = 0) -> None:
    """An octagonal spoked wheel in the y/z plane (axle along x): eight rim
    segments (true facets) with an iron tyre painted on the outer edge,
    `spokes` flat bars and an octagonal hub that stands proud on both sides."""
    outer = ngon(cy, cz, r, 8)
    inner = ngon(cy, cz, r - rim, 8)
    for k in range(8):
        a, b = outer[k], outer[(k + 1) % 8]
        c, d = inner[(k + 1) % 8], inner[k]
        g.prism("x", [(a[0], a[1]), (b[0], b[1]), (c[0], c[1]), (d[0], d[1])], x0, x1, C("darkwood", 3 + (k % 2)))
    X, Y, Z = _coords(g)
    ring = ((Y - cy) ** 2 + (Z - cz) ** 2 >= (r * math.cos(math.pi / 8) - 1.2) ** 2) & (X >= x0) & (X < x1)
    P.flat(g, ring & (g.a > 0), "stone", 2)
    for k in range(spokes):
        t = 2 * math.pi * k / spokes + math.pi / 8
        dy, dz = math.sin(t), math.cos(t)
        py, pz = -dz * 0.9, dy * 0.9  # half width across the spoke
        r0, r1 = hub - 0.5, r - rim + 0.6
        pts = [(cy + dy * r0 + py, cz + dz * r0 + pz), (cy + dy * r1 + py, cz + dz * r1 + pz), (cy + dy * r1 - py, cz + dz * r1 - pz), (cy + dy * r0 - py, cz + dz * r0 - pz)]
        g.prism("x", pts, x0 + 0.5, x1 - 0.5, C("wood", 5 if k % 2 else 4))
    g.prism("x", ngon(cy, cz, hub, 8), x0 - 1, x1 + 1, C("gold", 4))
    hubm = g.solids[-1].mask(g.shape)
    P.flat(g, hubm & ((Y - cy) ** 2 + (Z - cz) ** 2 < 1.6 ** 2), "gold", 6)
