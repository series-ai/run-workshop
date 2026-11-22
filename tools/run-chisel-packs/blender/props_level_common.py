"""Shared low-poly architectural, terrain-tile, roof, and vehicle helpers for level packs."""

import math
from mathutils import Matrix

import polykit as pk
from polykit import X, Y, Z, V


def tile_base(part, width, depth, height, region='skin', *, bevel=0.0, ao=-0.06):
    """Build a snapped 2m modular ground slab resting cleanly on y=0 with top at `height`."""
    part.box(V(0, height / 2.0, 0), (width, height, depth), region, bevel=bevel, ao=ao)


def gable_roof(part, center_x, eaves_y, center_z, span_x, span_z, ridge_h, region='accent', *, overhang=0.14, along='x', ao=0.06):
    """Triangular prism gable roof spanning along X or Z with crisp eaves overhang."""
    hx = span_x / 2.0 + overhang
    hz = span_z / 2.0 + overhang
    if along == 'x':
        rings = [
            [V(center_x - hx, eaves_y, center_z - hz), V(center_x - hx, eaves_y, center_z + hz), V(center_x - hx, eaves_y + ridge_h, center_z)],
            [V(center_x + hx, eaves_y, center_z - hz), V(center_x + hx, eaves_y, center_z + hz), V(center_x + hx, eaves_y + ridge_h, center_z)],
        ]
    else:
        rings = [
            [V(center_x - hx, eaves_y, center_z - hz), V(center_x + hx, eaves_y, center_z - hz), V(center_x, eaves_y + ridge_h, center_z - hz)],
            [V(center_x - hx, eaves_y, center_z + hz), V(center_x + hx, eaves_y, center_z + hz), V(center_x, eaves_y + ridge_h, center_z + hz)],
        ]
    part.loft(rings, region, cap_start=True, cap_end=True, ao=ao)


def hip_roof(part, center_x, eaves_y, center_z, span_x, span_z, ridge_h, region='accent', *, shrink=0.35, overhang=0.12, ao=0.06):
    """Beveled truncated pyramid roof keeping triangle count low (~10 tris)."""
    w = span_x + overhang * 2.0
    d = span_z + overhang * 2.0
    part.box(V(center_x, eaves_y + ridge_h / 2.0, center_z), (w, ridge_h, d), region, taper=(shrink, shrink), ao=ao)


def wheel_pair(part, z_pos, track_half_x, radius, width, tire_region='secondary', hub_region='metal'):
    """Two faceted octagonal wheels on an axle along X."""
    for sx in (-1.0, 1.0):
        x = sx * track_half_x
        with part.placed(Matrix.Translation(V(x, radius, z_pos)) @ Matrix.Rotation(math.pi / 2.0, 4, 'Z')):
            part.lathe([(radius, -width / 2.0), (radius, width / 2.0)], 8, tire_region, cap_start=True, cap_end=True, ao=-0.06)
            part.lathe([(radius * 0.45, -width * 0.56), (radius * 0.45, width * 0.56)], 6, hub_region, cap_start=True, cap_end=True, ao=0.08)


def window_pane(part, center, normal, up, w, h, frame_region='secondary', glass_region='eye'):
    """Framed faceted window plate anchored cleanly on a building face."""
    part.plate(center, normal, up, w + 0.08, h + 0.08, 0.04, frame_region, shrink=0.92, ao=-0.04)
    part.plate(center + normal * 0.025, normal, up, w, h, 0.02, glass_region, shrink=0.94, ao=0.16)


def door_unit(part, bottom_center, width, height, frame_region='secondary', leaf_region='primary', handle_region='metal'):
    """Recessed/proud framed doorway grounded at bottom_center.y."""
    cx, cy, cz = bottom_center
    part.box(V(cx, cy + height / 2.0, cz + 0.02), (width + 0.14, height + 0.07, 0.08), frame_region, ao=-0.06)
    part.box(V(cx, cy + height / 2.0 - 0.02, cz + 0.04), (width, height - 0.04, 0.06), leaf_region, ao=0.02)
    part.box(V(cx + width * 0.34, cy + height * 0.46, cz + 0.08), (0.06, 0.10, 0.04), handle_region, ao=0.14)


def conifer_tree(part, radius=0.72, height=3.1, trunk_region='secondary', foliage_region='hair'):
    """Crisp 3-tier faceted pine tree."""
    part.lathe([(0.19, 0.0), (0.14, 0.45), (0.10, 1.35)], 6, trunk_region, cap_start=True, ao=-0.06)
    tiers = [
        (0.75, height * 0.46, radius, 0.0),
        (height * 0.40, height * 0.72, radius * 0.78, 0.04),
        (height * 0.64, height, radius * 0.54, 0.08),
    ]
    for y0, y1, r, ao in tiers:
        part.lathe([(r * 0.25, y0), (r, y0 + 0.10)], 6, foliage_region, cap_start=True, tip_end=V(0, y1, 0), ao=ao)


def l_corner_wall(part, arm_len, height, thickness, region='skin', *, cap_region='secondary', ao=0.0):
    """Symmetric 90-degree L-corner wall module snapped cleanly along +X and -Z."""
    half_t = thickness / 2.0
    # Arm along +X and arm along +Z joined cleanly at the [-arm/2+half_t, -arm/2+half_t] corner pier
    cx = -arm_len / 2.0 + half_t
    cz = -arm_len / 2.0 + half_t
    part.box(V(0, height / 2.0, cz), (arm_len, height, thickness), region, ao=ao)
    part.box(V(cx, height / 2.0, 0), (thickness, height, arm_len), region, ao=ao)
    part.box(V(cx, height / 2.0 + 0.02, cz), (thickness + 0.08, height + 0.04, thickness + 0.08), cap_region, ao=0.04)
