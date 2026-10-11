"""Low-level helpers for four fantasy civic buildings (import as `_fbld_civic`).

The market hall, the guard barracks, the mage academy and the alchemist
shop use these small painters. Each building keeps its own
massing and silhouette; only these low-level pieces are shared. Every
helper fills the grid, paints what it adds and returns the mask it added
(rule S1: detail is paint). Conventions as pnkit: +y up, the front is -z.
"""
from __future__ import annotations

import numpy as np

import paint as P
from pnkit import box, edges
from voxgrid import Grid


def idx(g: Grid):
    """Integer voxel indices (X, Y, Z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def plaster(g: Grid, mask: np.ndarray, ramp: str = "sand", base: int = 6, seed: int = 0) -> None:
    """Soft lime plaster: large +-1 patches (rule S3), no per-texel speckle."""
    P.mottle(g, mask, ramp, base, cell=5, seed=seed)


def plinth(g: Grid, x0, z0, x1, z1, y1: int = 4, ramp: str = "stone", base: int = 5, seed: int = 0) -> np.ndarray:
    """A coursed stone plinth with a darker foot course and dark edges (S4)."""
    m = box(g, x0, 0, z0, x1, y1, z1, ramp, base)
    P.stone(g, m, ramp, base, block=(9, 4), seed=seed)
    Y = idx(g)[1]
    P.flat(g, m & (Y < 1), ramp, base - 2)
    P.flat(g, edges(m), ramp, base - 1)
    return m
