"""Shared frame, contract and palette for the Trainspotter railway kit.

Built on the RUN voxel pack pipeline (tools/run-voxel-packs/blender): voxel
grids with true-slope prisms, painted into a pixel atlas at 1 texel per voxel.
Axes are glTF: +Y up, vehicles face -Z, and +X is on the right when you look
along -Z. 1 voxel = 1 world unit; a person is 36 voxels tall.

Interchange contract (every number in voxels):

Track
- A track piece's origin is its connector `a`: on the centre line, at
  ground level (y = 0). The track leaves `a` toward -Z.
- A connector is a position and an outward heading (`yaw`, degrees about +Y,
  0 = -Z, 90 = -X, 180 = +Z, 270 = +X). Two connectors mate when their
  positions match and their headings are opposite. Every connector sits on a
  LATTICE grid in x/z and every heading is a multiple of 45 degrees.
- Section: ballast 0..3, sleepers 3..5, rails 5..RAIL_TOP. Rail centres at
  x = +/-RAIL_X; a rail head is 2 wide.

Rolling stock
- A vehicle's origin is on its centre line, in the rail-head plane, midway
  between its two guide points (bogie pivots, or the outer axles of rigid
  stock). It sits on track at y = RAIL_TOP.
- `socket-coupler-f` / `socket-coupler-r` at (0, COUPLER_Y, -/+L/2), where
  L is the length between coupler faces. Coupled vehicles put these sockets
  on the same point, whichever way round each vehicle runs.
- Floors are FLOOR_Y above the rail, which is level with a platform top.
- Wheel radii come from WHEEL_RADII only, so every wheel turns a whole
  number of times in one `move` loop (MOVE_SECONDS over MOVE_DISTANCE).
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RVX = os.path.normpath(os.path.join(HERE, "..", "..", "run-voxel-packs"))
_BLENDER = os.path.join(RVX, "blender")
if _BLENDER not in sys.path:
    sys.path.insert(0, _BLENDER)

import paint as P  # noqa: E402,F401
import pnpaint  # noqa: E402,F401
from voxgrid import CLIPS, PACKS, PALETTE, RAMP_SHADES, THEMES, Asset, C, Clip, Grid, Part, Socket, palette_colors, ramp_of  # noqa: E402,F401

PACK = "trains"
PACK_DIR = "run-trainspotter"
LABEL = "Trainspotter"

# ---------------------------------------------------------------- track
UNIT = 64  # track unit: one straight-1
LATTICE = 32  # connector positions are multiples of this
RAIL_X = 15  # rail centres at +/-RAIL_X
RAIL_HALF = 1.0  # rail head half-width
BALLAST_TOP, SLEEPER_TOP, RAIL_TOP = 3, 5, 8
BALLAST_HALF_BASE, BALLAST_HALF_TOP = 26, 23
SLEEPER_HALF, SLEEPER_DEPTH, SLEEPER_PITCH = 20, 5, 8

# ---------------------------------------------------------------- rolling stock
COUPLER_Y = 10  # above the rail
FLOOR_Y = 16  # above the rail
SHELL_HALF = 22  # body shells stay inside |x| <= SHELL_HALF ...
GAUGE_HALF = 24  # ... and nothing (cylinders, rods, steps) goes past this
GAUGE_TOP = 72  # above the rail, pantographs down
PLATFORM_TOP = RAIL_TOP + FLOOR_Y  # above ground
PLATFORM_EDGE = 25  # from the track centre line
LENGTHS = {"XS": 64, "S": 96, "M": 128, "L": 160}  # between coupler faces
WHEEL_RADII = (6, 9, 12, 18)
MOVE_SECONDS = 3.0
MOVE_DISTANCE = 72 * math.pi  # every radius above divides it into whole turns
MOVE_SPEED = MOVE_DISTANCE / MOVE_SECONDS

SNAP = 1 / 64  # geometry snaps to this, the grid finalize quantizes to


def snap(v: float) -> float:
    return round(v / SNAP) * SNAP


# ---------------------------------------------------------------- palette
# The shared palette, cleaned up for liveries. Ramps keep their shared names;
# a few are re-anchored (see roster.py for which are swappable paints).
_THEME = {
    "arcane": {"dark": "#141518", "mid": "#3b3e45", "light": "#9aa0aa"},  # locomotive black
    "magenta": {"dark": "#2a0d14", "mid": "#7c2436", "light": "#d98a98"},  # maroon
    "khaki": {"dark": "#3a3f44", "mid": "#a9b1b8", "light": "#f1f4f6"},  # silver
    "skin": {"dark": "#6c6e70", "mid": "#d9dbdc", "light": "#ffffff"},  # white
}
PACKS["packs"][PACK] = {"dir": PACK_DIR, "worldTheme": "vehicles-racing", "label": LABEL, "clipRange": [0, 0]}
THEMES["packs"][PACK] = {"source": "trainspotter kit", "ramps": _THEME}

# Ramps that only ever mean one thing, so a livery swap never touches them.
FIXED_RAMPS = ("gray", "stone", "wood", "darkwood", "sand", "rust", "steel", "iron", "navy", "plasma", "toxic", "ember", "cyan")
# Ramps a vehicle's paint, trim and accent roles can be swapped between.
SWATCHES = ("red", "blood", "magenta", "orange", "gold", "bone", "lime", "leaf", "forest", "teal", "sky", "blue", "purple", "pink", "arcane", "khaki", "skin")


def ramp_colors(names) -> dict:
    colors = palette_colors(PACK)
    return {r: colors[PALETTE["ramps"][r] * RAMP_SHADES : (PALETTE["ramps"][r] + 1) * RAMP_SHADES] for r in names}


def coords(g: Grid):
    return np.indices(g.shape)


def ramps_used(g: Grid) -> set[str]:
    return {ramp_of(int(v))[0] for v in np.unique(g.a) if v}
