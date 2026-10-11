"""Low-level helpers for the rural fantasy buildings (import as `_fbld_rural`).

Used by stables, granary and thatched-cottage. These are small parts and
painters only (straw, hay bales, plank walls, Dutch doors, horse heads,
staddle stones). Each building keeps its own massing in its own file.
Every helper fills the grid, paints what it adds and returns its mask
(rule S1: detail is paint). Faces follow pnkit: '-z' is the front.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from pnkit import box, edges
from voxgrid import C, Grid

# Straw tones (ramp, shade), dark to light: a warm golden ramp across
# three palette ramps, in close value steps (rule S3).
STRAW = (("sand", 2), ("gold", 2), ("gold", 3), ("orange", 6), ("gold", 5))


def idx(g: Grid):
    """Integer voxel indices (X, Y, Z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def straw(g: Grid, mask: np.ndarray, frame=None, base: int = 2, tie: int = 9, seed: int = 0) -> None:
    """Thatch or hay (rule S2): long vertical streaks, 1 voxel wide, each a
    run of 4-9 voxels in one tone of STRAW, with a darker tie row every
    `tie` rows that waves a little. `frame`: see paint.uv (pass the slope
    frame (ridge, down-slope) so the streaks run down the roof). `base`
    is the index of the middle tone in STRAW."""
    U, V = P.uv(g, frame)
    run = 4 + (P._hash(U, seed=seed) % np.uint64(6)).astype(np.int64)
    off = (P._hash(U, seed=seed + 1) % np.uint64(9)).astype(np.int64)
    seg = (V + off) // run
    pick = base + np.array([-1, 0, 0, 1, 0, -1, 0, 0])[(P._hash(U, seg, seed=seed + 2) % np.uint64(8)).astype(np.int64)]
    pick = np.clip(pick, 0, len(STRAW) - 1)
    wave = (P._hash(U // 5, seed=seed + 3) % np.uint64(2)).astype(np.int64)
    pick = np.where((V + wave) % tie == 0, 0, pick)
    for k, (ramp, shade) in enumerate(STRAW):
        P.flat(g, mask & (pick == k), ramp, shade)


def hay_bale(g: Grid, x0, y0, z0, sx, sy, sz, seed: int = 0) -> np.ndarray:
    """A square hay bale: straw streaks along x and two dark twine bands."""
    m = box(g, x0, y0, z0, x0 + sx, y0 + sy, z0 + sz, "gold", 3)
    X, Y, Z = idx(g)
    U = np.where(np.abs(Y - (y0 + sy - 1)) < 0.5, Z, Y)  # streaks run along x on the sides and the top
    run = 3 + (P._hash(U, seed=seed) % np.uint64(5)).astype(np.int64)
    seg = (X + (P._hash(U, seed=seed + 1) % np.uint64(7)).astype(np.int64)) // run
    tone = (P._hash(U, seg, seed=seed + 2) % np.uint64(5)).astype(np.int64)
    for k, (ramp, shade) in enumerate((("gold", 3), ("sand", 4), ("gold", 4), ("sand", 3), ("gold", 2))):
        P.flat(g, m & (tone == k), ramp, shade)
    for k in (0.28, 0.72):
        bx = int(x0 + sx * k)
        P.flat(g, m & (X == bx), "darkwood", 3)
    P.flat(g, edges(m), "sand", 2)
    return m


def plank_wall(g: Grid, mask: np.ndarray, ramp: str, base: int, across: str = "x", width: int = 4, frame=None, seed: int = 0) -> None:
    """Board-and-batten wall paint: boards with dark seams and nail dots
    (rule S2) and a dark frame on the outer edges (rule S4)."""
    P.planks(g, mask, ramp, base, width=width, across=across, length=(30, 44), nails=True, frame=frame, seed=seed)
    P.flat(g, edges(mask), "darkwood", 3)


def staddle(g: Grid, cx, cz, h: float, r: float = 4.5) -> np.ndarray:
    """A staddle stone: a tapering stone stem with a wide flat cap on top
    (true slopes), so rats cannot climb into the granary."""
    stem = S.cone(g, "y", cx, cz, r, 0, h - 3, "stone", 4, n=8, r_top=r * 0.55)
    cap = S.cone(g, "y", cx, cz, r * 1.25, h - 3, h, "stone", 5, n=8, r_top=r * 1.45)
    P.stone(g, stem, "stone", 4, block=(5, 3), seed=int(cx + cz))
    _X, Y, _Z = idx(g)
    P.flat(g, cap, "stone", 5)
    P.flat(g, cap & (Y == int(h) - 1), "stone", 6)
    P.flat(g, stem & (Y < 1), "stone", 2)
    return stem | cap


def dutch_door(g: Grid, plane: float, u0: int, u1: int, v0: int, v1: int, split: int, upper: str = "closed",
               leaf=("wood", 5), seed: int = 0) -> dict:
    """A stall door on a '-z' wall at z = plane: a dark frame 2 proud, a
    planked lower leaf with a painted Z brace and iron straps, and an upper
    leaf. upper='closed': the upper leaf is shut. upper='open': the upper
    leaf swings out square to the wall on the u0 side and the opening is a
    dark recess 5 deep (cut into the voxel wall). Returns {'recess': the
    (x0, y0, z0, x1, y1, z1) box of the dark opening or None}."""
    X, Y, Z = idx(g)
    fr = box(g, u0 - 2, v0, plane - 2, u0, v1 + 2, plane, "darkwood", 3)
    fr |= box(g, u1, v0, plane - 2, u1 + 2, v1 + 2, plane, "darkwood", 3)
    fr |= box(g, u0 - 2, v1, plane - 2, u1 + 2, v1 + 3, plane, "darkwood", 3)
    P.planks(g, fr, "darkwood", 3, width=2, across="y", nails=False, seed=seed)
    P.flat(g, edges(fr), "darkwood", 1)

    def leaf_at(x0, y0, z0, x1, y1, z1, across: str, frame: str) -> np.ndarray:
        m = box(g, x0, y0, z0, x1, y1, z1, *leaf)
        P.planks(g, m, leaf[0], leaf[1], width=4, across=across, length=(60, 61), nails=False, frame=frame, seed=seed + 1)
        P.flat(g, edges(m), "darkwood", 3)
        return m

    low = leaf_at(u0, v0, plane - 2, u1, split, plane, "x", "z")
    # the Z brace and the iron straps are paint on the lower leaf
    w, h = u1 - u0, split - v0
    du, dv = X - u0, Y - v0
    P.flat(g, low & (dv >= 2) & (dv < 4), "darkwood", 4)
    P.flat(g, low & (dv >= h - 4) & (dv < h - 2), "darkwood", 4)
    P.flat(g, low & (np.abs(du * (h - 6) / max(1, w) - (dv - 3)) < 1.2) & (dv >= 3) & (dv < h - 3), "darkwood", 4)
    P.flat(g, low & (du < 4) & ((dv == 2) | (dv == h - 3)), "iron", 4)
    recess = None
    if upper == "closed":
        up = leaf_at(u0, split, plane - 2, u1, v1, plane, "x", "z")
        P.flat(g, up & (Y >= v1 - 3) & (Y < v1 - 1) & (X < u0 + 4), "iron", 4)
        P.flat(g, up & (Y == split + 2) & (X < u0 + 4), "iron", 4)
    elif upper == "open":
        g.a[u0:u1, split + 1:v1, int(plane):int(plane) + 5] = 0  # the open half: a recess in the voxel wall
        back = box(g, u0, split + 1, plane + 5, u1, v1, plane + 6, "darkwood", 1)
        P.flat(g, back & (Y > v1 - 4), "darkwood", 0)
        sides = P.region(g, u0 - 1, split, plane, u1 + 1, v1 + 1, plane + 5) & ~fr
        P.flat(g, sides, "darkwood", 2)
        recess = (u0, split + 1, plane, u1, v1, plane + 5)
    else:
        raise ValueError(f"upper must be 'closed' or 'open', got {upper!r}")
    return {"recess": recess}


def horse_head(g: Grid, cx: float, y_sill: float, z_back: float, coat=("wood", 3), mane=("darkwood", 2),
               blaze=("bone", 7), seed: int = 0) -> np.ndarray:
    """A horse head and neck that look out over a half door: side-profile
    prisms across x (6 wide) from inside the stall (z_back) out past the
    door (toward -z), the muzzle a little below the poll. Painted mane,
    ears, eye, nostril and a white blaze. y_sill is the top of the lower
    leaf; nothing goes below it."""
    x0, x1 = cx - 3.5, cx + 3.5
    yb = y_sill + 1
    start = len(g.solids)
    # neck: rises out of the stall (polygon (y, z) for axis 'x')
    g.prism("x", S.quad((yb + 7, z_back), (yb + 13, z_back - 9), 5.0, 4.0), x0, x1, C(*coat))
    # head: from the poll down and forward to the muzzle
    g.prism("x", S.quad((yb + 14, z_back - 10), (yb + 4, z_back - 20), 4.0, 3.0, cap=0.5), x0 + 0.5, x1 - 0.5, C(*coat))
    m = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    X, Y, Z = idx(g)
    P.flat(g, m, *coat)
    # the mane runs down the back (+z, top) edge of the neck
    nk = g.solids[start].mask(g.shape)
    P.flat(g, nk & (Y + 0.5 > yb + 7 + (z_back - (Z + 0.5)) * 0.55 + 3.2), *mane)
    # ears: two little wedges on the poll
    for ex in (x0 + 0.8, x1 - 2.2):
        g.prism("x", [(yb + 16, z_back - 8), (yb + 16, z_back - 12), (yb + 22, z_back - 9)], ex, ex + 1.6, C(*coat))
        P.flat(g, S.last(g), coat[0], max(1, coat[1] - 1))
    hd = g.solids[start + 1].mask(g.shape)
    # the muzzle is darker, the blaze runs down the face front
    P.flat(g, hd & (Y < yb + 7) & (Z < z_back - 17), coat[0], max(1, coat[1] - 2))
    P.flat(g, hd & (np.abs(X + 0.5 - cx) < 1.1) & (Y > yb + 6) & (Y < yb + 15) & (Z < z_back - 12), *blaze)
    for ex in (int(x0) + 1, int(x1) - 1):  # eyes on both sides
        P.flat(g, hd & (X == ex) & (Y >= int(yb + 12)) & (Y < int(yb + 14)) & (Z >= int(z_back - 14)) & (Z < int(z_back - 12)), "darkwood", 0)
    P.flat(g, hd & (Y < yb + 5) & (Z < z_back - 20) & (np.abs(X + 0.5 - cx) > 1.0), "darkwood", 1)  # the nostrils
    return m
