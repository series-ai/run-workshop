"""Authoring helpers for rig-space assets (avatar parts, skins).

All masks are boolean arrays on the shared rig grid (rigspace.RIG_SHAPE,
pivot RIG_PIVOT, 0.01 units per voxel, character facing +X). The body
reference comes from `npm run body-ref` (PN species voxelized); it guides
fitting and never ships.
"""
from __future__ import annotations

import os

import numpy as np

from rigspace import RIG_PIVOT, RIG_SHAPE, cell_center_gl, rule_bone
from voxgrid import Grid

_TOOL_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REF_PATH = os.environ.get("RVX_BODY_REF", os.path.join(_TOOL_ROOT, "out", "cache", "pn-body-ref.npz"))
_REF = None


def _ref():
    global _REF
    if _REF is None:
        if not os.path.exists(REF_PATH):
            raise FileNotFoundError(f"{REF_PATH} is missing; run `npm run body-ref`")
        data = np.load(REF_PATH)
        _REF = {k: data[k] for k in data.files}
    return _REF


def body(name: str = "species_1") -> np.ndarray:
    return _ref()[f"{name}_occ"].astype(bool)


_LABELS: dict[str, np.ndarray] = {}


def bone_labels(name: str = "species_1") -> np.ndarray:
    """Bone name per body voxel by the joint rule ('' outside the body)."""
    if name not in _LABELS:
        occ = body(name)
        labels = np.full(occ.shape, "", dtype=object)
        for i, j, k in zip(*np.nonzero(occ)):
            labels[i, j, k] = rule_bone(cell_center_gl(i, j, k))
        _LABELS[name] = labels
    return _LABELS[name]


def region(bones: list[str], name: str = "species_1") -> np.ndarray:
    return np.isin(bone_labels(name), bones)


def dilate(mask: np.ndarray, n: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(n):
        grown = out.copy()
        for axis in range(3):
            for step in (1, -1):
                shifted = np.roll(out, step, axis=axis)
                # np.roll wraps; clear the wrapped slab
                idx = [slice(None)] * 3
                idx[axis] = slice(0, 1) if step == 1 else slice(-1, None)
                shifted[tuple(idx)] = False
                grown |= shifted
        out = grown
    return out


def shell(bones: list[str], thickness: int = 1, name: str = "species_1") -> np.ndarray:
    """Voxels within `thickness` of the bones' body region, outside the body."""
    return dilate(region(bones, name), thickness) & ~body(name)


def bbox(mask: np.ndarray) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    """(min, max-exclusive) voxel indices of a mask."""
    idx = np.nonzero(mask)
    if len(idx[0]) == 0:
        raise ValueError("empty mask has no bounding box")
    return tuple(int(i.min()) for i in idx), tuple(int(i.max()) + 1 for i in idx)  # type: ignore[return-value]


def rig_grid() -> Grid:
    return Grid(*RIG_SHAPE)


def y_band(lo: int, hi: int) -> np.ndarray:
    m = np.zeros(RIG_SHAPE, bool)
    m[:, lo:hi, :] = True
    return m


def front(x_min: int) -> np.ndarray:
    """Voxels at or in front of rig index x_min (the character faces +X)."""
    m = np.zeros(RIG_SHAPE, bool)
    m[x_min:, :, :] = True
    return m


PIVOT = RIG_PIVOT


def part_rules(hides_hair=False, hides_eyebrows=False, hides_facial_hair=False) -> dict:
    """AvatarPartRules for a part's meta (pack-qualified, never index-keyed)."""
    return {"hidesHair": hides_hair, "hidesEyebrows": hides_eyebrows, "hidesFacialHair": hides_facial_hair}


def leg_z_ranges(name: str = "species_1") -> dict[str, tuple[int, int]]:
    """Rig z-index span of each leg, from the body reference."""
    out = {}
    for side in ("L", "R"):
        lo, hi = bbox(region([f"Leg.{side}", f"LowerLeg.{side}"], name))
        out[side] = (lo[2], hi[2])
    return out
