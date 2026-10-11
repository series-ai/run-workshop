"""Shared tools for the repaired apocalypse creatures (Art Director repair).

- `ground`: rewrite clips so that no part goes below the floor. It samples
  every frame, poses the rig with forward kinematics (the same XYZ euler
  order and parent chain as the exporter) and lifts the root by the depth
  of the lowest point. It replaces the measured table in _death_ground.py
  for the rebuilt models, so the lift follows the new geometry.
- `floor_report`: the lowest point of each clip relative to the rest pose.
- Paint helpers: `hide` (soft hide, no speckle), `pustules` (teal mutation
  boils), `rust_plate` (a riveted rust plate on a true slope).

Command line (no Blender; run in any directory):
    python3 _rep_creatures.py creatures/mutant-cow [creatures/sewer-croc ...]
It builds each source in plain Python and prints the rest bounds and the
floor report. A clip that sinks more than half a voxel makes it exit 1.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint as PP
from _life import last, limb, slab
from voxgrid import PRISM_PLANE, _AXIS_INDEX, C, Asset, Clip, Part

FPS = 30


# ------------------------------------------------------------------ pose
def euler(deg) -> np.ndarray:
    """XYZ euler degrees about glTF axes as a matrix (X first, then Y, then Z)."""
    a, b, c = (math.radians(v) for v in deg)
    rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
    rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return rz @ ry @ rx


def hull_points(part: Part) -> np.ndarray:
    """Points that hold the convex hull of a part, in its pivot space: the
    corners of the lowest and highest plain voxel of each (x, z) column, and
    every prism vertex. The lowest point of a turned part is one of them."""
    g = part.grid
    if g is None:
        return np.zeros((0, 3))
    occ = (g.a > 0) & ~g.solid_mask()
    pts = []
    cols = occ.any(axis=1)
    if cols.any():
        ny = g.shape[1]
        lo = np.argmax(occ, axis=1)
        hi = ny - np.argmax(occ[:, ::-1, :], axis=1)
        xs, zs = np.nonzero(cols)
        for ys in (lo[xs, zs], hi[xs, zs]):
            for dx in (0, 1):
                for dz in (0, 1):
                    pts.append(np.stack([xs + dx, ys, zs + dz], axis=1).astype(float))
    for s in g.solids:
        t = _AXIS_INDEX[s.axis]
        u, v = PRISM_PLANE[s.axis]
        for poly, along in ((s.poly, s.lo), (s.upper, s.hi)):
            for pu, pv in poly:
                p = [0.0, 0.0, 0.0]
                p[u], p[v], p[t] = pu, pv, along
                pts.append(np.array([p]))
    if not pts:
        raise ValueError(f"part {part.name!r} has a grid with no content")
    return np.concatenate(pts) - np.asarray(part.pivot, dtype=float)


def sample(keys, t: float):
    """Linear sample of [(seconds, (x, y, z)), ...] at t (held at the ends)."""
    if t <= keys[0][0]:
        return np.asarray(keys[0][1], dtype=float)
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return np.asarray(v0, dtype=float) + (np.asarray(v1, dtype=float) - np.asarray(v0, dtype=float)) * f
    return np.asarray(keys[-1][1], dtype=float)


def lowest(root: Part, clip: Clip | None, t: float, cache: dict) -> float:
    """The lowest world y of the rig posed by `clip` at time t."""
    best = math.inf

    def visit(part: Part, M: np.ndarray, o: np.ndarray) -> None:
        nonlocal best
        ch = clip.keys.get(part.name, {}) if clip else {}
        loc = np.asarray(part.at, dtype=float) + (sample(ch["loc"], t) if "loc" in ch else 0.0)
        R = euler(part.rot) @ (euler(sample(ch["rot"], t)) if "rot" in ch else np.eye(3))
        if "scale" in ch:
            R = R @ np.diag(sample(ch["scale"], t))
        Mw, ow = M @ R, o + M @ loc
        if part.name not in cache:
            cache[part.name] = hull_points(part)
        pts = cache[part.name]
        if len(pts):
            best = min(best, float((pts @ Mw.T + ow)[:, 1].min()))
        for child in part.children:
            visit(child, Mw, ow)

    visit(root, np.eye(3), np.zeros(3))
    return best


def _duration(clip: Clip) -> float:
    return max(k[-1][0] for ch in clip.keys.values() for k in ch.values())


def _ease(keys, fps: int):
    """Keys on every frame between the given keys, with a smoothstep ease
    (close to the clamped Bezier curves that Blender draws)."""
    out = []
    n = round(keys[-1][0] * fps)
    for k in range(n + 1):
        t = k / fps
        if t <= keys[0][0]:
            out.append((t, tuple(float(c) for c in keys[0][1])))
            continue
        for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
            if t0 <= t <= t1:
                f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
                f = f * f * (3 - 2 * f)
                out.append((t, tuple(a + (b - a) * f for a, b in zip(v0, v1))))
                break
        else:
            out.append((t, tuple(float(c) for c in keys[-1][1])))
    return out


def ground(asset: Asset, names=("death",), fps: int = FPS) -> Asset:
    """Put keys on every frame of the named clips and lift the root so that
    the lowest point never goes under the rest floor. Error if a named clip
    is missing."""
    cache: dict = {}
    floor = lowest(asset.root, None, 0.0, cache)
    root = asset.root.name
    for name in names:
        clip = next((c for c in asset.clips if c.name == name), None)
        if clip is None:
            raise ValueError(f"{asset.id}: ground() needs a clip named {name!r}")
        total = _duration(clip)
        frames = round(total * fps)
        dense = {part: {chan: _ease(keys + ([(total, keys[-1][1])] if keys[-1][0] < total else []), fps) for chan, keys in ch.items()} for part, ch in clip.keys.items()}
        posed = Clip(clip.name, dense, clip.loop)
        base = dense.get(root, {}).get("loc")
        lift = []
        for k in range(frames + 1):
            t = k / fps
            drop = floor - lowest(asset.root, posed, t, cache)
            b = base[k][1] if base else (0.0, 0.0, 0.0)
            lift.append((t, (b[0], b[1] + max(0.0, drop), b[2])))
        dense.setdefault(root, {})["loc"] = lift
        clip.keys = dense
    return asset


def floor_report(asset: Asset, fps: int = FPS) -> dict:
    """{clip: (deepest sink, highest lift)} relative to the rest floor, in
    voxels, sampled every frame with linear keys."""
    cache: dict = {}
    floor = lowest(asset.root, None, 0.0, cache)
    out = {}
    for clip in asset.clips:
        total = _duration(clip)
        lows = [lowest(asset.root, clip, k / fps, cache) - floor for k in range(round(total * fps) + 1)]
        out[clip.name] = (round(min(lows), 2), round(max(lows), 2))
    return out


def rest_bounds(asset: Asset) -> tuple[np.ndarray, np.ndarray]:
    """World min and max of the rest pose (voxels)."""
    pts = []

    def visit(part: Part, M: np.ndarray, o: np.ndarray) -> None:
        Mw, ow = M @ euler(part.rot), o + M @ np.asarray(part.at, dtype=float)
        h = hull_points(part)
        if len(h):
            pts.append(h @ Mw.T + ow)
        for child in part.children:
            visit(child, Mw, ow)

    visit(asset.root, np.eye(3), np.zeros(3))
    allp = np.concatenate(pts)
    return allp.min(axis=0), allp.max(axis=0)


# ------------------------------------------------------------------ shapes
def octo(cu: float, cv: float, ru: float, rv: float, k: float = 0.42):
    """A chamfered octagon (u, v) with half sizes ru and rv. `k` is the
    share of each side that stays flat (the rest is the chamfer)."""
    return [(cu - ru * k, cv - rv), (cu + ru * k, cv - rv), (cu + ru, cv - rv * k), (cu + ru, cv + rv * k),
            (cu + ru * k, cv + rv), (cu - ru * k, cv + rv), (cu - ru, cv + rv * k), (cu - ru, cv - rv * k)]


def tube(g, axis: str, a, b, lo, hi, ramp: str, shade: int, k: float = 0.42) -> np.ndarray:
    """A chamfered octagon frustum along `axis`: section a = (cu, cv, ru, rv)
    at `lo` and section b at `hi` (true slopes on every side)."""
    g.prism(axis, octo(*a, k=k), lo, hi, C(ramp, shade), top=octo(*b, k=k))
    return last(g)


def patches(g, mask, centres, ramp: str, shade: int, seed: int = 0) -> np.ndarray:
    """Irregular round patches (cow spots, mange, mud): each centre
    (x, y, z, r) is a union of three offset balls. Returns the painted mask."""
    rng = np.random.default_rng(seed)
    X, Y, Z = np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")
    hit = np.zeros(g.shape, dtype=bool)
    for x, y, z, r in centres:
        for _ in range(3):
            ox, oy, oz = rng.uniform(-0.6, 0.6, 3) * r
            rr = r * rng.uniform(0.55, 0.8)
            hit |= (X - x - ox) ** 2 + (Y - y - oy) ** 2 + (Z - z - oz) ** 2 < rr * rr
    P.flat(g, mask & hit, ramp, shade)
    return mask & hit


# ------------------------------------------------------------------ paint
def hide(g, mask, ramp: str, base: int, seed: int = 0, cell: int = 5, light: bool = True) -> None:
    """Animal hide: a flat base, big soft patches one shade darker and, with
    `light`, fewer patches one shade lighter. Cells are `cell` voxels wide,
    so there is no per-texel speckle (rule S3)."""
    P.flat(g, mask, ramp, base)
    PP.blotch(g, mask, ramp, max(1, base - 1), cell=cell, chance=0.06, seed=seed + 1)
    if light:
        PP.blotch(g, mask, ramp, min(7, base + 1), cell=max(3, cell - 1), chance=0.04, seed=seed + 2)


def pustules(g, pts, normal=(0.0, 1.0, 0.0), r: float = 1.6, ramp: str = "teal", shade: int = 5, core=("teal", 7)) -> np.ndarray:
    """Teal mutation boils: small faceted domes at surface points (x, y, z)
    that grow out along `normal`, with a glowing core at the tip."""
    m = np.zeros(g.shape, dtype=bool)
    n = np.asarray(normal, dtype=float) / np.linalg.norm(normal)
    X, Y, Z = np.meshgrid(*(np.arange(k) + 0.5 for k in g.shape), indexing="ij")
    for x, y, z in pts:
        p = np.array([x, y, z], dtype=float)
        tip = p + n * r * 1.2
        b = limb(g, tuple(p - n * 0.8), tuple(tip), r, r * 0.45, ramp, shade, n=6)
        m |= b
        P.flat(g, b & ((X - tip[0]) ** 2 + (Y - tip[1]) ** 2 + (Z - tip[2]) ** 2 < (r * 1.1) ** 2), *core)
    return m


def face_spot(g, mask, x: float, y: float, r: float, ramp: str, shade: int, depth: float = 1.5, square: bool = False) -> np.ndarray:
    """Paint a round spot (or, with `square`, a square one) of radius r on
    the front-most surface of `mask` at (x, y), as seen from -Z (eyes,
    nostrils). Error if nothing is there."""
    X, Y, Z = np.meshgrid(*(np.arange(k) + 0.5 for k in g.shape), indexing="ij")
    d = np.maximum(np.abs(X - x), np.abs(Y - y)) if square else np.hypot(X - x, Y - y)
    near = mask & (d < r)
    if not near.any():
        raise ValueError(f"face_spot at ({x}, {y}) finds no surface")
    hit = near & (Z < Z[near].min() + depth)
    P.flat(g, hit, ramp, shade)
    return hit


def rust_plate(g, axis: str, cu, cv, w: float, h: float, lo, hi, angle: float, base: int = 5, seed: int = 0) -> np.ndarray:
    """A scrap armour plate: a tilted steel slab with riveted panels (dark
    seams, rule S4) and big rust patches (rule S2)."""
    m = slab(g, axis, cu, cv, w, h, lo, hi, angle, "steel", base)
    P.plates(g, m, "steel", base, size=(6, 5), seed=seed)
    PP.blotch(g, m, "rust", 5, cell=3, chance=0.1, seed=seed + 7)
    PP.blotch(g, m, "rust", 4, cell=4, chance=0.08, seed=seed + 8)
    return m


# ------------------------------------------------------------------ command line
if __name__ == "__main__":
    import importlib.util
    import os
    import sys

    here = os.path.dirname(os.path.abspath(__file__))
    bad = False
    for arg in sys.argv[1:]:
        path = os.path.join(here, arg + ".py")
        spec = importlib.util.spec_from_file_location("rep_" + os.path.basename(arg).replace("-", "_"), path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        asset = mod.build()
        asset.validate()
        lo, hi = rest_bounds(asset)
        size = hi - lo
        print(f"{asset.id}: size {size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f}  min y {lo[1]:.2f}")
        for name, (sink, lift) in floor_report(asset).items():
            flag = "  SINKS" if sink < -0.5 else ""
            bad |= sink < -0.5
            print(f"  {name:7s} lowest {sink:+.2f}  highest {lift:+.2f}{flag}")
    sys.exit(1 if bad else 0)
