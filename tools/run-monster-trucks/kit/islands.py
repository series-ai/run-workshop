"""Lint: report floating voxel islands in every body and gear part grid."""
from __future__ import annotations

import sys
from collections import deque

import numpy as np

import kit  # noqa: F401
from bodies import BODIES
from accessories import ACCESSORIES
from modules import AXLE_KINDS, axle_module, tread_module


def islands(a: np.ndarray, small: int = 400):
    occ = a > 0
    lab = np.zeros(occ.shape, np.int32)
    out, n = [], 0
    for p in map(tuple, np.argwhere(occ)):
        if lab[p]:
            continue
        n += 1
        q, lab[p], c = deque([p]), n, 0
        while q:
            x, y, z = q.popleft()
            c += 1
            for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                b = (x + d[0], y + d[1], z + d[2])
                if all(0 <= b[i] < occ.shape[i] for i in range(3)) and occ[b] and not lab[b]:
                    lab[b] = n
                    q.append(b)
        out.append((c, p))
    out.sort(reverse=True)
    return [o for o in out[1:] if o[0] < small], len(out)


if __name__ == "__main__":
    bad = 0
    for key, f in BODIES.items():
        root, _, _ = f()
        for part in root.walk():
            if part.grid is not None:
                small, n = islands(part.grid.a)
                if small:
                    bad += 1
                    print(f"{key}/{part.name}: {n} pieces, small islands {[(c, tuple(int(v) for v in p)) for c, p in small]}")
    roots = [axle_module(k, "f").root for k in AXLE_KINDS] + [tread_module("M").root]
    roots += [f() for items in ACCESSORIES.values() for f in items.values()]
    for root in roots:
        gname = root.name
        for part in root.walk():
            if part.grid is not None:
                small, n = islands(part.grid.a, small=60)
                if small:
                    print(f"{gname}/{part.name}: {n} pieces, small islands {[(c, tuple(int(v) for v in p)) for c, p in small][:6]}")
    sys.exit(1 if bad else 0)
