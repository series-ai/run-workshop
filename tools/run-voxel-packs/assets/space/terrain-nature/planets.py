"""Planets, in the Pirate Nation terrain style.

Four display planets resting in low faceted cradles on the ground. Each
planet is a faceted ball (five stacked frustums with flat poles, true
slopes, never a voxel sphere) with painted bands, continents or cracks;
rings are flat faceted bands of segments, tilted. One generator, four
variants:
- a banded ringed gas giant (warm bands, a red storm, a gold and cream ring)
- an ice planet (white caps, teal cracks, a tilted ring of ice shards)
- a lava planet (dark crust with glowing ember cracks, a scorched cradle)
- a terra planet (sea, green continents, cloud bands) with a small moon
Each planet turns on `idle` (rings and moon turn too). Faces -Z.
"""
import math

import numpy as np

from _life import P, Clip, Grid, Rig, asset, coords, flat_ngon, globe, light_top, mask_of, ngon_y, rock, spin, spots
from pnshapes import cone, ngon_radius
from voxgrid import C


def cradle(g: Grid, cx, cz, r, ramp: str, shade: int, seed: int) -> np.ndarray:
    """A low faceted rock ring the planet sits in, with two boulders."""
    m = ngon_y(g, cx, cz, r, 0, 4, ramp, shade, n=9, r_top=r * 0.72)
    P.flat(g, m, ramp, shade)
    P.flat(g, m & (coords(g)[1] > 3), ramp, shade + 1)
    for k, a in enumerate((0.7, 3.6)):
        b = mask_of(g, rock(g, cx + (r - 1) * math.cos(a), cz + (r - 1) * math.sin(a), 1, 3, 5, ramp, shade - 1, n=6, seed=seed + k))
        P.flat(g, b, ramp, shade - 1)
        light_top(g, b, ramp, shade)
    return m


def ring_band(g: Grid, cx, cy, cz, r0, r1, n: int, inner, outer) -> np.ndarray:
    """A flat ring of n segments (1.5 thick) between flat radii r0 and r1."""
    o, i = flat_ngon(cx, cz, r1, n), flat_ngon(cx, cz, r0, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("y", [o[k], o[(k + 1) % n], i[(k + 1) % n], i[k]], cy - 1, cy + 1, C(*inner))
    m = mask_of(g, g.solids[start:])
    d = ngon_radius(g, "y", cx, cz, n)
    P.flat(g, m, *inner)
    P.flat(g, m & (d > (r0 + r1) / 2), *outer)
    return m


def planet_asset(slug: str, name: str, r: float, paint, base, extra=None):
    size = int(2 * r + 36)
    S = (size, int(2 * r + 12), size)
    cx = cz = size / 2
    cy = r + 1.5
    root_g = Grid(*S)
    cradle(root_g, cx, cz, r * 0.8, *base)
    body = Grid(*S)
    solids = globe(body, cx, cy, cz, r, "bone", 5)
    paint(body, mask_of(body, solids), cx, cy, cz, r)
    rig = Rig()
    rig.add(f"{slug}-base", root_g, (cx, 0, cz))
    rig.add(slug, body, (cx, cy, cz), f"{slug}-base")
    clips = {slug: {"rot": spin(8.0, "y", 360)}}
    if extra:
        extra(rig, S, cx, cy, cz, r, clips)
    return asset("terrain-nature", slug, name, rig.root, clips=[Clip("idle", clips)])


# ------------------------------------------------------------ painters
def paint_gas(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    bands = [("rust", 5), ("orange", 6), ("gold", 6), ("bone", 6), ("orange", 5), ("gold", 7), ("orange", 6), ("rust", 5), ("orange", 5)]
    step = 2 * r / len(bands)
    for k, (ramp, sh) in enumerate(bands):
        hi = cy - r + (k + 1) * step + (1.0 if k == len(bands) - 1 else 0.0)
        P.flat(g, m & (Y >= cy - r + k * step - (1.0 if k == 0 else 0.0)) & (Y < hi), ramp, sh)
    storm = m & (np.hypot((X - (cx + r * 0.35)) * 0.6, Y - (cy - r * 0.2)) < r * 0.2) & (Z < cz)
    P.flat(g, storm, "red", 5)
    P.flat(g, storm & (np.hypot((X - (cx + r * 0.35)) * 0.6, Y - (cy - r * 0.2)) < r * 0.1), "red", 6)


def paint_ice(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    P.flat(g, m, "cyan", 6)
    P.flat(g, m & (np.abs(Y - cy) > r * 0.55), "bone", 7)  # polar caps
    crack = m & (np.abs(np.sin((X - cx) * 0.5 + (Z - cz) * 0.3) * 2.5 - (Y - cy)) < 0.6) & (np.abs(Y - cy) < r * 0.55)
    P.flat(g, crack, "cyan", 4)
    spots(g, m & (np.abs(Y - cy) <= r * 0.55), "bone", 7, cell=6, r=1.4, chance=3, seed=5)


def paint_lava(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    P.flat(g, m, "steel", 3)
    P.flat(g, m & (Y > cy + r * 0.6), "steel", 4)
    cracks = m & ((np.abs(np.sin((X - cx) * 0.7) * 2 + (Y - cy) * 0.8 - (Z - cz) * 0.3) < 0.7) | (np.abs((X - cx) * 0.5 - np.sin(Y * 0.6) * 2.5 + (Z - cz) * 0.4) < 0.6))
    P.flat(g, cracks, "orange", 6)
    spots(g, m, "red", 5, cell=7, r=2.4, chance=2, seed=8)  # lava pools
    spots(g, m, "orange", 7, cell=7, r=1.6, chance=2, seed=8)
    spots(g, m, "gold", 7, cell=7, r=0.8, chance=2, seed=8)


def paint_terra(g, m, cx, cy, cz, r):
    X, Y, Z = coords(g)
    P.flat(g, m, "sky", 4)
    spots(g, m, "leaf", 5, cell=8, r=3.4, chance=1, seed=3)
    spots(g, m, "leaf", 6, cell=8, r=1.8, chance=1, seed=3)
    P.flat(g, m & (np.abs(Y - cy) > r * 0.9), "bone", 7)  # ice caps
    clouds = m & (np.abs(Y - cy - np.sin((X + Z) * 0.35) * 2 - r * 0.3) < 0.8)
    P.flat(g, clouds, "bone", 7)


# ------------------------------------------------------------ extras
def gas_rings(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    ring_band(g, cx, cy, cz, r * 1.3, r * 1.75, 14, ("gold", 6), ("bone", 6))
    rig.add("gas-giant-rings", g, (cx, cy, cz), "gas-giant-base", rot=(16.0, 0.0, -10.0))
    clips["gas-giant-rings"] = {"rot": spin(16.0, "y", 360)}


def ice_rings(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    ring_band(g, cx, cy, cz, r * 1.3, r * 1.62, 12, ("cyan", 5), ("cyan", 7))
    for k in range(6):  # ice shards on the ring
        a = 2 * math.pi * k / 6 + 0.3
        rr = r * 1.46
        c = cone(g, "y", cx + rr * math.cos(a), cz + rr * math.sin(a), 1.4, cy + 1, cy + 5, "bone", 7, n=6)
        P.flat(g, c, "bone", 7)
    rig.add("ice-planet-rings", g, (cx, cy, cz), "ice-planet-base", rot=(-14.0, 0.0, 12.0))
    clips["ice-planet-rings"] = {"rot": spin(12.0, "y", -360)}


def terra_moon(rig, S, cx, cy, cz, r, clips):
    g = Grid(*S)
    mx = cx + r + 7
    m = mask_of(g, globe(g, mx, cy + r * 0.5, cz, 3.5, "gray", 6, n=8))
    P.flat(g, m, "gray", 6)
    spots(g, m, "gray", 4, cell=3, r=0.8, chance=2, seed=2)
    rig.add("terra-planet-moon", g, (cx, cy, cz), "terra-planet-base", rot=(0.0, 0.0, -8.0))
    clips["terra-planet-moon"] = {"rot": spin(6.0, "y", 360)}


def build():
    return [
        planet_asset("gas-giant", "Ringed Gas Giant", 15, paint_gas, ("sand", 5, 1), gas_rings),
        planet_asset("ice-planet", "Ice Planet", 12, paint_ice, ("bone", 6, 2), ice_rings),
        planet_asset("lava-planet", "Lava Planet", 10, paint_lava, ("steel", 4, 3)),
        planet_asset("terra-planet", "Terra Planet with Moon", 12, paint_terra, ("leaf", 5, 4), terra_moon),
    ]
