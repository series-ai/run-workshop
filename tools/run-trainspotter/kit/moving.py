"""Moving parts shared by several families: a single-arm pantograph and
sliding doors, each with `open` / `close` clip keys.

Both return (parts, clips): `parts` go in Stock.extra_parts (their `.at` is in
body-grid coordinates) and `clips` in Stock.extra_clips. Merge several with
merge_clips(). Keys are relative to the rest pose (pantograph down, doors shut).
"""
from __future__ import annotations

import math

from railkit import C, Grid, Part

FPS = 30


def _ramp(t0: float, t1: float, v0, v1, steps: int = 12, ease: bool = True):
    out = []
    for k in range(steps + 1):
        f = k / steps
        if ease:
            f = f * f * (3 - 2 * f)
        out.append((t0 + (t1 - t0) * k / steps, tuple(a + (b - a) * f for a, b in zip(v0, v1))))
    return out


def merge_clips(*clip_sets: dict) -> dict:
    out: dict = {}
    for cs in clip_sets:
        for name, parts in cs.items():
            out.setdefault(name, {}).update(parts)
    return out


def pantograph(x: float, y: float, z: float, prefix: str = "panto", arm: float = 14, width: int = 22, ramp=("iron", 4)) -> tuple[list[Part], dict]:
    """A single-arm pantograph whose hinge base stands on the roof at (x, y, z)
    (body-grid coords). Down at rest; `open` raises the head about 17 voxels,
    `close` lowers it. Parts: <prefix>-base > <prefix>-lower > <prefix>-upper > <prefix>-head."""
    base = Grid(width, 3, 10)
    base.box(0, 0, 0, width, 1, 10, C(ramp[0], ramp[1] - 1))
    for bx in (1, width - 3):  # insulators
        base.box(bx, 0, 3, bx + 2, 3, 7, C("sand", 7))
    lower = Grid(4, 2, arm + 2)
    lower.box(0, 0, 0, 4, 2, arm + 2, C(*ramp))
    upper = Grid(2, 2, arm + 2)
    upper.box(0, 0, 0, 2, 2, arm + 2, C(*ramp))
    head = Grid(width + 6, 2, 3)
    head.box(0, 0, 0, width + 6, 2, 3, C("steel", 6))
    head.box(2, 0, 0, width + 4, 1, 3, C("iron", 2))
    down1, down2 = math.radians(6), math.radians(4)  # rest: nearly flat
    up1, up2 = math.radians(36), math.radians(42)
    # lower arm points back (+z) from the hinge; a negative x-rotation lifts its far end
    b = Part(f"{prefix}-base", base, pivot=(width / 2, 0, 5), at=(x, y, z))
    lo = Part(f"{prefix}-lower", lower, pivot=(2, 1, 1), at=(0, 3, 0), rot=(-math.degrees(down1), 0, 0))
    # upper arm folds forward (-z) from the knee
    up = Part(f"{prefix}-upper", upper, pivot=(1, 1, arm + 1), at=(0, 0, arm), rot=(math.degrees(down1 + down2), 0, 0))
    hd = Part(f"{prefix}-head", head, pivot=((width + 6) / 2, 0, 1.5), at=(0, 1, -arm), rot=(-math.degrees(down2), 0, 0))
    b.add(lo)
    lo.add(up)
    up.add(hd)
    d_lower = -math.degrees(up1 - down1)
    d_upper = math.degrees((up1 + up2) - (down1 + down2))
    d_head = -math.degrees(up2 - down2)
    raise_keys = {f"{prefix}-lower": {"rot": _ramp(0, 1.2, (0, 0, 0), (d_lower, 0, 0))},
                  f"{prefix}-upper": {"rot": _ramp(0, 1.2, (0, 0, 0), (d_upper, 0, 0))},
                  f"{prefix}-head": {"rot": _ramp(0, 1.2, (0, 0, 0), (d_head, 0, 0))}}
    lower_keys = {k: {"rot": [(t, v) for (t, _), (_, v) in zip(ch["rot"], reversed(ch["rot"]))]} for k, ch in raise_keys.items()}
    return [b], {"open": raise_keys, "close": lower_keys}


def sliding_doors(doors, plane_x: dict, ramp=("skin", 5), glass_rows: tuple[int, int] | None = None) -> tuple[list[Part], dict]:
    """Sliding plug doors on the body sides. doors: [(name, side '-x'|'+x', z0, z1, y0, y1, slide)],
    body-grid coords; `slide` is how far (signed, along z) the leaf moves to open.
    plane_x: {'-x': x of the left side face, '+x': x of the right side face}.
    Each leaf is 1 voxel proud of the side; `open` slides it, `close` slides it back."""
    parts, opening, closing = [], {}, {}
    for name, side, z0, z1, y0, y1, slide in doors:
        g = Grid(1, y1 - y0, z1 - z0)
        g.box(0, 0, 0, 1, y1 - y0, z1 - z0, C(*ramp))
        g.box(0, 0, 0, 1, 1, z1 - z0, C(ramp[0], max(0, ramp[1] - 2)))
        if glass_rows:
            g.box(0, glass_rows[0] - y0, 1, 1, glass_rows[1] - y0, z1 - z0 - 1, C("navy", 3))
        x = plane_x[side] - 1 if side == "-x" else plane_x[side]
        parts.append(Part(name, g, pivot=(0, 0, 0), at=(x, y0, z0)))
        opening[name] = {"loc": _ramp(0, 0.8, (0, 0, 0), (0, 0, slide), steps=8)}
        closing[name] = {"loc": _ramp(0, 0.8, (0, 0, slide), (0, 0, 0), steps=8)}
    return parts, {"open": opening, "close": closing}
