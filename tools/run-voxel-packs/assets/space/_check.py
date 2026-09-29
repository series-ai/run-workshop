"""Fast local check for space sources without Blender.

    python3 assets/space/_check.py [substring ...]

Runs build(), Asset.validate(), and prints rest bounds, the category budget,
base/centre checks, quad count and an estimated GLB size.
"""
from __future__ import annotations

import glob
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "blender"))
sys.path.insert(1, HERE)

import numpy as np  # noqa: E402

from mesher import greedy_mesh  # noqa: E402
from voxgrid import CATEGORIES  # noqa: E402


def load(src):
    name = "chk_" + os.path.splitext(os.path.basename(src))[0].replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, src)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    r = mod.build()
    return r if isinstance(r, list) else [r]


def bounds(part, acc=(0.0, 0.0, 0.0)):
    here = tuple(acc[i] + part.at[i] for i in range(3))
    lo, hi = [np.inf] * 3, [-np.inf] * 3
    quads = 0
    if part.grid is not None and part.grid.count():
        nz = np.nonzero(part.grid.a)
        for i in range(3):
            lo[i] = min(lo[i], here[i] - part.pivot[i] + nz[i].min())
            hi[i] = max(hi[i], here[i] - part.pivot[i] + nz[i].max() + 1)
        quads += len(greedy_mesh(part.grid.a)[3])
    for ch in part.children:
        clo, chi, cq = bounds(ch, here)
        quads += cq
        for i in range(3):
            lo[i], hi[i] = min(lo[i], clo[i]), max(hi[i], chi[i])
    return lo, hi, quads


def main():
    subs = sys.argv[1:]
    srcs = sorted(p for p in glob.glob(os.path.join(HERE, "*", "*.py")) if not os.path.basename(p).startswith("_"))
    if subs:
        srcs = [p for p in srcs if any(s in p for s in subs)]
    bad = 0
    for src in srcs:
        t0 = time.time()
        try:
            assets = load(src)
        except Exception as e:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            print(f"FAIL {os.path.relpath(src, HERE)}: {e}")
            bad += 1
            continue
        for a in assets:
            flags = []
            try:
                a.validate()
            except Exception as e:  # noqa: BLE001
                flags.append(f"VALIDATE {e}")
            lo, hi, quads = bounds(a.root)
            size = [hi[i] - lo[i] for i in range(3)]
            spec = CATEGORIES["categories"][a.category]
            if spec["space"] == "world":
                largest = max(size)
                blo, bhi = spec["largest"]
                if not blo <= largest <= bhi:
                    flags.append(f"BUDGET {largest} not in {blo}-{bhi}")
                if abs(lo[1]) > 0.5:
                    flags.append(f"MINY {lo[1]}")
                cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
                if abs(cx) > 1 or abs(cz) > 1:
                    flags.append(f"CENTRE ({cx},{cz})")
            est = quads * (260 if a.is_rig else 140) / 1e6
            if est > 1.4:
                flags.append(f"SIZE ~{est:.2f}MB")
            clips = ",".join(c.name for c in a.clips)
            print(f"{'BAD ' if flags else 'ok  '}{a.id:52s} size={[round(s) for s in size]} quads={quads} ~{est:.2f}MB clips=[{clips}] {time.time() - t0:.1f}s {' '.join(flags)}")
            bad += bool(flags)
    print(f"{len(srcs)} sources, {bad} flagged")


if __name__ == "__main__":
    main()
