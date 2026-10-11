"""Small helpers for the monster creatures."""
from __future__ import annotations

import numpy as np


def front_z(g, x: int, y: int) -> int:
    """Lowest filled z (the -Z face) in column (x, y). Raises if the column is empty."""
    col = np.nonzero(g.a[int(x), int(y), :])[0]
    if len(col) == 0:
        raise ValueError(f"column ({x}, {y}) is empty")
    return int(col.min())


def on_face(g, x: int, y: int, c: int, out: int = 0) -> int:
    """Paint voxel c on the -Z face of column (x, y); `out` > 0 puts it that
    many voxels in front of the face. Returns the z used."""
    z = front_z(g, x, y) - out
    g.set(x, y, z, c)
    return z
