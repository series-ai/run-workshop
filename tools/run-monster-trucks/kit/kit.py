"""Shared frame, palette and helpers for the wasteland vehicle kit.

Built on the RUN voxel pack pipeline (tools/run-voxel-packs/blender): voxel
grids with true-slope prisms, painted into a pixel atlas at 1 texel per
voxel. Axes are glTF: +Y up, the front faces -Z, +X is the vehicle's left.

Interchange contract (voxels, 1 voxel = 1 world unit, person = 36):
- A BODY's origin is its mount point: x = 0 on the centre line, y = 0 on the
  underside (the mount plane), z = 0 halfway between its axles. Its front
  axle sits at z = -WB/2, its rear at z = +WB/2 for its wheelbase class.
- A GEAR (wheels, treads, ...) is built per wheelbase class with the ground
  at y = 0, centred on the wheelbase; its `socket-mount` empty is where a
  body's origin goes. Nothing in a gear rises above the mount plane inside
  |x| < BODY_HALF, so any body fits any gear of its class.
"""
from __future__ import annotations

import math
import os
import random
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RVX = os.path.normpath(os.path.join(HERE, "..", "..", "run-voxel-packs"))
for p in (os.path.join(RVX, "blender"), os.path.join(RVX, "assets", "apocalypse")):
    if p not in sys.path:
        sys.path.insert(0, p)

import paint as P  # noqa: E402
import pnpaint  # noqa: E402
from pnkit import box  # noqa: E402
from pnshapes import bar, disc, gear_poly, last, radial  # noqa: E402
from voxgrid import CATEGORIES, PACKS, THEMES, C, Grid, Part, ramp_of  # noqa: E402
import _kit as AK  # noqa: E402  (apocalypse weathering helpers)

PACK = "trucks"
WB = {"S": 36, "M": 44, "L": 64, "B": 38, "T": 26}  # B: motorcycles, T: tiny bikes (scooter, minibike); drawn at twice the size, built at half (bikes.py)  # wheelbase per class
BODY_HALF = 22  # bodies stay inside |x| < 22 below the mount plane
TX = 30  # wheel centre half-track for the standard gears

# Kit palette: the post-apocalypse theme plus the faded paints from the
# concepts. Ramp names are the shared palette's; these remap a few.
MINT, PINK, CREAM, CHALK, PAINT_ORANGE, LILAC = "lime", "pink", "bone", "sky", "orange", "purple"
_THEME = {
    **THEMES["packs"]["apocalypse"]["ramps"],
    "lime": {"dark": "#24503f", "mid": "#7fc6a4", "light": "#dcf5e6"},
    "pink": {"dark": "#5e2a3a", "mid": "#d98ba0", "light": "#fbe0e6"},
    "bone": {"dark": "#5f523c", "mid": "#d9cba6", "light": "#fbf4e2"},
    "sky": {"dark": "#2c3f52", "mid": "#86a9c2", "light": "#e0eef5"},
    "orange": {"dark": "#4a1c08", "mid": "#c45f26", "light": "#f5b27a"},
    "purple": {"dark": "#3a2c55", "mid": "#a596cf", "light": "#ece6fb"},
    "navy": {"dark": "#0f1520", "mid": "#26324a", "light": "#7d8fb0"},
    "iron": {"dark": "#141414", "mid": "#38383a", "light": "#8a8a8c"},
    # raider colours (concepts/raiders/base): peach skin, a warm-grey tee, leather brown
    "skin": {"dark": "#7a3f33", "mid": "#eba98a", "light": "#ffe0cc"},
    "skindark": {"dark": "#3d2218", "mid": "#a8694a", "light": "#e0a985"},
    "arcane": {"dark": "#4f4840", "mid": "#a89c8c", "light": "#e6ddcf"},
    "ember": {"dark": "#3a2116", "mid": "#8a5435", "light": "#d39a6c"},
}
TEE, LEATHER = "arcane", "ember"
PACKS["packs"][PACK] = {"dir": "run-wasteland-wheels", "worldTheme": "vehicles", "label": "Wasteland Wheels", "clipRange": [0, 0]}
THEMES["packs"][PACK] = {"source": "wasteland kit", "ramps": _THEME}


def coords(g: Grid):
    return np.indices(g.shape)


def surface(g: Grid) -> np.ndarray:
    return AK.surface(g)


def grunge(g: Grid, seed: int, rust: int = 10, drips: int = 14, dust_h: int = 6, keep=None) -> None:
    """Wear on painted metal: rust blooms, rust drips, dusty lower edge."""
    paints = ("red", "blue", "sky", "gold", "orange", "teal", "lime", "pink", "bone", "purple", "khaki", "steel")
    AK.rust_patches(g, seed, rust, from_ramps=paints, rmin=1.0, rmax=2.8)
    AK.drips(g, seed + 1, drips, from_ramps=paints, lmin=2, lmax=6)
    if dust_h:
        X, Y, Z = coords(g)
        surf = surface(g)
        rng = np.random.default_rng(seed + 2)
        noise = rng.random(g.shape)
        dusty = surf & (Y < dust_h + (noise * 3).astype(int)) & (g.a > 0)
        if keep is not None:
            dusty &= ~keep
        for idx in np.argwhere(dusty):
            x, y, z = idx
            g.a[x, y, z] = C("sand", 3 if (x + y + z) % 3 else 2)


def rivets(g: Grid, mask: np.ndarray, ramp: str, shade: int, step: int = 4, axis: str = "z") -> None:
    X, Y, Z = coords(g)
    along = {"x": X, "y": Y, "z": Z}[axis]
    P.flat(g, mask & (along % step == 1), ramp, shade)


def patch(g: Grid, mask: np.ndarray, ramp: str, shade: int, seed: int) -> None:
    """A welded scrap patch panel: flat tone, darker 1px border, corner rivets."""
    P.flat(g, mask, ramp, shade)
    edges = mask & ~_eroded(mask)
    P.flat(g, edges, ramp, max(0, shade - 2))


def _eroded(m: np.ndarray) -> np.ndarray:
    out = m.copy()
    for ax in range(3):
        if m.shape[ax] < 3:
            continue
        lo = np.roll(m, 1, ax)
        hi = np.roll(m, -1, ax)
        out &= lo | ~m
        out &= hi | ~m
    # only erode within the visible plane: keep voxels whose neighbours along
    # the thin axis are empty (faces), else this eats whole slabs
    return out


def tyre_profile(r: float, lugs: int, depth: float, turn: float = 0.0):
    return gear_poly(0.0, 0.0, r - depth, lugs, depth, turn)


def ngon(cu, cv, r, n, turn=0.0):
    return [(cu + r * math.cos(turn + 2 * math.pi * k / n), cv + r * math.sin(turn + 2 * math.pi * k / n)) for k in range(n)]
