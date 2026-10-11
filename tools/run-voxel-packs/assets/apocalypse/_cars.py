"""Road-vehicle helpers for the post-apocalypse pack at the shared world
scale (person = 36 voxels). Import as `_cars`.

Axes follow `_kit`: +Y up, the front faces -Z. The driver sits on the -X
side (the driver's left). Wheel axles run along X. Put wheel centres on
voxel corners (integer y and z) so a wheel stays symmetric when it spins.
"""
from __future__ import annotations

import math

import numpy as np

from _kit import box_mask, coords, drips, rust_patches, sphere_mask
from voxgrid import C, Grid


def big_wheel(g: Grid, cx, cy, cz, r: float, w: int, tire="iron", rim=("steel", 4), hub=("steel", 6), holes: int = 5, knobby: bool = False, rim_frac: float = 0.58):
    """Tyre with tread lugs, a sidewall shoulder, a recessed dished rim with a
    lip, vent holes, a hub cap and lug nuts. Axle along X; (cx, cy, cz) is
    the axle middle. Returns the tyre mask."""
    x, y, z = coords(g.shape)
    t, u, v = x - cx, y - cy, z - cz
    rad = np.sqrt(u * u + v * v)
    ang = np.arctan2(u, v)
    hw = w / 2
    tyre = (np.abs(t) <= hw) & (rad <= r)
    g.where(tyre, C(tire, 2))
    face = tyre & (np.abs(t) > hw - 1)
    g.where(face & (rad > r - 1.2), C(tire, 3))  # worn shoulder
    g.where(face & (rad <= r - 2.2) & (rad > r - 3.0), C(tire, 1))  # sidewall line
    # tread lugs on the rolling surface (staggered across the width)
    n = max(10, int(round(2 * math.pi * r / 3)))
    seg = (ang + math.pi) / (2 * math.pi) * n + np.where(t > 0, 0.5, 0.0)
    groove = tyre & (rad > r - 1.0) & ((seg % 1.0) < 0.38)
    if knobby:
        g.where(groove, 0)
    else:
        g.where(groove, C(tire, 0))
    # rim: outer layer recessed except the lip ring, dish behind it
    rim_r = r * rim_frac
    rim_face = face & (rad <= rim_r)
    dish = tyre & (np.abs(t) > hw - 2) & (np.abs(t) <= hw - 1) & (rad <= rim_r)
    g.where(dish, C(*rim))
    g.where(dish & (rad > rim_r - 1.4), C(rim[0], max(0, rim[1] - 1)))
    g.where(rim_face, 0)
    g.where(rim_face & (rad > rim_r - 1.0), C(rim[0], min(7, rim[1] + 1)))  # lip
    for k in range(holes):  # vent holes in the dish
        a = 2 * math.pi * (k + 0.5) / holes
        hu, hv = math.sin(a) * rim_r * 0.62, math.cos(a) * rim_r * 0.62
        g.where(dish & ((u - hu) ** 2 + (v - hv) ** 2 <= 1.1), C("iron", 0))
    hub_r = max(1.2, r * 0.22)
    g.where(face & (rad <= hub_r), C(*hub))
    g.where(dish & (rad <= hub_r + 1.3), C(hub[0], max(0, hub[1] - 2)))
    for k in range(holes):  # lug nuts
        a = 2 * math.pi * k / holes
        lu, lv = math.sin(a) * (hub_r + 1.0), math.cos(a) * (hub_r + 1.0)
        g.where(face & ((u - lu) ** 2 + (v - lv) ** 2 <= 0.45), C(hub[0], min(7, hub[1] + 1)))
    return tyre


def slope(g: Grid, x0, x1, ya: int, za: int, yb: int, zb: int, t: int, c: int):
    """Stepped slab from (ya, za) up to (yb, zb), `t` voxels thick along z,
    spanning x [x0, x1). Returns its mask."""
    m = np.zeros(g.shape, bool)
    for yy in range(int(ya), int(yb)):
        f = (yy - ya) / max(1, (yb - ya - 1))
        zz = int(round(za + (zb - za) * f))
        m |= box_mask(g.shape, x0, yy, zz, x1, yy + 1, zz + t)
    g.where(m, c)
    return m


def disc_z(g: Grid, cx, cy, zface: int, r: float, c: int, depth: int = 1, ring=None, ring_c=None):
    """Round disc in the x-y plane at z [zface, zface + depth); optional ring
    (inner radius `ring`) in `ring_c`. Returns its mask."""
    x, y, z = coords(g.shape)
    rad2 = (x - cx) ** 2 + (y - cy) ** 2
    m = (rad2 <= r * r) & (z >= zface) & (z < zface + depth)
    g.where(m, c)
    if ring is not None:
        g.where(m & (rad2 > ring * ring), ring_c)
    return m


def headlight(g: Grid, cx, cy, zface: int, r: float = 3.0, lens=("gold", 6), bezel=("steel", 6)):
    """Round headlight on a front (-z) face: chrome bezel, lens, glint."""
    disc_z(g, cx, cy, zface, r, C(*lens), 1, ring=r - 1.0, ring_c=C(*bezel))
    g.set(math.floor(cx) - 1, math.floor(cy) + 1, zface, C(lens[0], min(7, lens[1] + 1)))
    return g


def arch(g: Grid, cx, cy, cz, r: float, x0, x1, keep=None):
    """Carve a wheel arch (a disc along x) out of the body."""
    x, y, z = coords(g.shape)
    m = ((y - cy) ** 2 + (z - cz) ** 2 <= r * r) & (x >= x0) & (x < x1)
    if keep is not None:
        m &= ~keep
    g.where(m, 0)
    return m


def flare(g: Grid, cx, cy, cz, r_in: float, r_out: float, x0, x1, c: int, y_min=None):
    """Fender flare: a half ring over a wheel arch, x [x0, x1)."""
    x, y, z = coords(g.shape)
    rad2 = (y - cy) ** 2 + (z - cz) ** 2
    m = (rad2 > r_in * r_in) & (rad2 <= r_out * r_out) & (x >= x0) & (x < x1) & (y >= (cy - 1 if y_min is None else y_min))
    g.where(m, c)
    return m


def rivet_row(g: Grid, xs, ys, zs, c: int):
    for xx in xs:
        for yy in ys:
            for zz in zs:
                g.set(xx, yy, zz, c)
    return g


def weather(g: Grid, seed: int, ramps, rust: int = 14, drip: int = 16, rmax: float = 2.2):
    """Rust blotches and rust drips on painted metal (no random speckle)."""
    rust_patches(g, seed, rust, from_ramps=tuple(ramps), rmax=rmax)
    drips(g, seed + 1, drip, from_ramps=tuple(ramps), lmin=2, lmax=6)
    return g


def jerry_can(g: Grid, x0, y0, z0, ramp="red", shade=4, along="z"):
    """Jerry can 4 wide, 9 tall, 7 deep (along `along`) with an X emboss,
    a three-bar handle and a spout."""
    if along == "z":
        w, d = 4, 7
    else:
        w, d = 7, 4
    g.box(x0, y0, z0, x0 + w, y0 + 8, z0 + d, C(ramp, shade))
    g.box(x0, y0 + 7, z0, x0 + w, y0 + 8, z0 + d, C(ramp, shade + 1))
    # X emboss on the long faces
    for k in range(6):
        if along == "z":
            for xx in (x0, x0 + w - 1):
                g.set(xx, y0 + 1 + k, z0 + 1 + k * (d - 3) // 5, C(ramp, shade - 1))
                g.set(xx, y0 + 1 + k, z0 + d - 2 - k * (d - 3) // 5, C(ramp, shade - 1))
        else:
            for zz in (z0, z0 + d - 1):
                g.set(x0 + 1 + k * (w - 3) // 5, y0 + 1 + k, zz, C(ramp, shade - 1))
                g.set(x0 + w - 2 - k * (w - 3) // 5, y0 + 1 + k, zz, C(ramp, shade - 1))
    if along == "z":
        g.box(x0 + 1, y0 + 8, z0 + 1, x0 + 3, y0 + 9, z0 + 2, C(ramp, shade - 1))
        g.box(x0 + 1, y0 + 8, z0 + 3, x0 + 3, y0 + 9, z0 + 4, C(ramp, shade - 1))
        g.box(x0 + 1, y0 + 8, z0 + 5, x0 + 3, y0 + 9, z0 + 6, C(ramp, shade - 1))
        g.box(x0 + 1, y0 + 8, z0 + d - 1, x0 + 3, y0 + 10, z0 + d, C("steel", 5))  # spout
    else:
        for k in (1, 3, 5):
            g.box(x0 + k, y0 + 8, z0 + 1, x0 + k + 1, y0 + 9, z0 + 3, C(ramp, shade - 1))
        g.box(x0 + w - 1, y0 + 8, z0 + 1, x0 + w, y0 + 10, z0 + 3, C("steel", 5))
    return g


def spare_tyre_flat(g: Grid, cx, y0, cz, r: float, h: int = 4, tire="gray", rim=("steel", 4)):
    """Tyre lying flat (axle along y) with a dished rim and a hub."""
    x, y, z = coords(g.shape)
    rad = np.sqrt((x - cx) ** 2 + (z - cz) ** 2)
    band = (y >= y0) & (y < y0 + h)
    g.where(band & (rad <= r), C(tire, 2))
    g.where(band & (rad <= r) & (y >= y0 + h - 1) & (rad > r - 1.2), C(tire, 3))
    g.where(band & (rad <= r * 0.55), C(*rim))
    g.where(band & (rad <= r * 0.55) & (y >= y0 + h - 1), 0)
    g.where((y >= y0 + h - 2) & (y < y0 + h - 1) & (rad <= r * 0.55), C(rim[0], rim[1] - 1))
    g.where((y >= y0 + h - 2) & (y < y0 + h) & (rad <= 1.3), C(rim[0], rim[1] + 2))
    for k in range(10):
        a = 2 * math.pi * k / 10
        g.where(band & (y >= y0 + h - 1) & ((x - cx - math.cos(a) * (r - 0.6)) ** 2 + (z - cz - math.sin(a) * (r - 0.6)) ** 2 <= 0.5), C(tire, 1))
    return g


def glass_pane(g: Grid, mask, seed: int = 0, base=("navy", 1), glint=("sky", 4), period: int = 15):
    """Paint glass with a few thin diagonal glint streaks."""
    idx = np.indices(g.shape)
    s = (idx[0] + idx[1] + seed) % period
    g.where(mask, C(*base))
    g.where(mask & (s == 0), C(*glint))
    g.where(mask & (s == 1), C(glint[0], max(0, glint[1] - 1)))
    g.where(mask & (s == 4), C(base[0], min(7, base[1] + 1)))
    return g


def wheel_z(g: Grid, cx, cy, z0: int, r: float, w: int, tire="gray", rim=("steel", 4)):
    """Spare wheel with its axle along z, from z0 to z0 + w (rim toward +z)."""
    x, y, z = coords(g.shape)
    rad = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    band = (z >= z0) & (z < z0 + w)
    face = (z >= z0 + w - 1) & (z < z0 + w)
    g.where(band & (rad <= r), C(tire, 2))
    g.where(face & (rad <= r) & (rad > r - 1.2), C(tire, 3))
    n = max(10, int(round(2 * math.pi * r / 3)))
    ang = np.arctan2(y - cy, x - cx)
    g.where(band & (rad <= r) & (rad > r - 1.0) & ((((ang + math.pi) / (2 * math.pi) * n) % 1.0) < 0.38), C(tire, 1 if tire == "gray" else 0))
    g.where(face & (rad <= r * 0.58), 0)
    g.where((z >= z0 + w - 2) & (z < z0 + w - 1) & (rad <= r * 0.58), C(*rim))
    g.where(face & (rad <= r * 0.58) & (rad > r * 0.58 - 1.0), C(rim[0], min(7, rim[1] + 1)))
    g.where(face & (rad <= 1.6), C(rim[0], min(7, rim[1] + 2)))
    return g


def steering_wheel(g: Grid, cx, cy, zface: int, r: float = 3.6, c=None):
    """Steering wheel ring with a cross spoke in the x-y plane at z = zface."""
    c = c if c is not None else C("iron", 1)
    x, y, z = coords(g.shape)
    rad2 = (x - cx) ** 2 + (y - cy) ** 2
    plane = (z >= zface) & (z < zface + 1)
    g.where(plane & (rad2 <= r * r) & (rad2 > (r - 1.1) ** 2), c)
    g.where(plane & (rad2 <= r * r) & (np.abs(y - cy) < 0.6), c)
    return g


def sedan_xl(g: Grid, ox: int, oy: int, oz: int, paint=("sky", 4), seed: int = 0, glass: bool = True, roof=("gray", 6)):
    """Boxy 70s four-door sedan at world scale: 40 wide (x), 92 long (z,
    front at low z), about 32 tall, from corner (ox, oy, oz). Wheels are
    drawn in place (R 8, 16 across). The cabin is hollow with a bench seat,
    a dash and a steering wheel. Returns the wheel centres."""
    ramp, sh = paint
    W, L = 40, 92
    x0, x1 = ox, ox + W
    z0, z1 = oz, oz + L
    R = 8
    body = C(ramp, sh)
    dark = C(ramp, max(0, sh - 1))
    lite = C(ramp, min(7, sh + 1))
    # chassis
    g.box(x0 + 7, oy + 5, z0 + 6, x0 + 11, oy + 8, z1 - 6, C("iron", 2))
    g.box(x1 - 11, oy + 5, z0 + 6, x1 - 7, oy + 8, z1 - 6, C("iron", 2))
    # lower body (hood deck to trunk deck)
    g.box(x0, oy + 7, z0 + 2, x1, oy + 19, z1 - 2, body)
    g.box(x0, oy + 7, z0 + 2, x1, oy + 9, z1 - 2, dark)  # rocker
    g.box(x0, oy + 18, z0 + 2, x1, oy + 19, z1 - 2, lite)  # shoulder line
    g.box(x0 + 1, oy + 19, z0 + 3, x1 - 1, oy + 20, z0 + 30, lite)  # hood top
    g.box(x0 + 1, oy + 19, z1 - 22, x1 - 1, oy + 20, z1 - 3, lite)  # trunk top
    for xx in (x0 + 5, x1 - 6):  # hood and trunk seams
        g.box(xx, oy + 19, z0 + 3, xx + 1, oy + 20, z0 + 30, dark)
        g.box(xx, oy + 19, z1 - 22, xx + 1, oy + 20, z1 - 3, dark)
    g.box(x0 + 1, oy + 19, z0 + 29, x1 - 1, oy + 20, z0 + 30, dark)
    g.box(x0 + 19, oy + 20, z0 + 3, x0 + 21, oy + 22, z0 + 5, C("steel", 6))  # hood ornament
    g.box(x0 + 17, oy + 20, z0 + 5, x0 + 23, oy + 21, z0 + 29, lite)  # hood crease
    g.box(x0 + 1, oy + 19, z1 - 22, x1 - 1, oy + 20, z1 - 21, dark)
    # chrome side strip, door seams and handles
    g.box(x0 - 1, oy + 13, z0 + 4, x0, oy + 14, z1 - 4, C("steel", 6))
    g.box(x1, oy + 13, z0 + 4, x1 + 1, oy + 14, z1 - 4, C("steel", 6))
    for xx, hx in ((x0, x0 - 1), (x1 - 1, x1)):
        for sz in (z0 + 31, z0 + 51, z0 + 69):
            g.box(xx, oy + 9, sz, xx + 1, oy + 30, sz + 1, dark)
        for hz in (z0 + 47, z0 + 65):
            g.box(hx, oy + 16, hz, hx + 1, oy + 17, hz + 3, C("steel", 6))
    # cabin (greenhouse), hollow
    cab = box_mask(g.shape, x0 + 2, oy + 19, z0 + 34, x1 - 2, oy + 31, z0 + 72)
    g.where(cab, body)
    g.box(x0 + 3, oy + 30, z0 + 38, x1 - 3, oy + 32, z0 + 70, lite)  # roof
    g.box(x0 + 2, oy + 31, z0 + 38, x0 + 3, oy + 32, z0 + 70, C("steel", 5))  # drip rails
    g.box(x1 - 3, oy + 31, z0 + 38, x1 - 2, oy + 32, z0 + 70, C("steel", 5))
    g.box(x0 + 3, oy + 31, z0 + 39, x1 - 3, oy + 32, z0 + 69, C(*roof))  # vinyl top
    for rz in range(z0 + 45, z0 + 69, 8):
        g.box(x0 + 3, oy + 31, rz, x1 - 3, oy + 32, rz + 1, C(roof[0], max(1, roof[1] - 1)))
    g.box(x0 + 1, oy + 9, z0 + 32, x1 - 1, oy + 30, z0 + 72, 0)  # hollow
    g.box(x0 + 1, oy + 9, z0 + 32, x1 - 1, oy + 10, z0 + 72, C("iron", 2))  # floor
    # slanted windscreen and rear window (pillars at the sides)
    ws = slope(g, x0 + 3, x1 - 3, oy + 19, z0 + 31, oy + 31, z0 + 38, 1, C("navy", 1))
    rw = slope(g, x0 + 3, x1 - 3, oy + 19, z0 + 75, oy + 31, z0 + 70, 1, C("navy", 1))
    slope(g, x0 + 2, x0 + 3, oy + 19, z0 + 31, oy + 31, z0 + 38, 2, body)
    slope(g, x1 - 3, x1 - 2, oy + 19, z0 + 31, oy + 31, z0 + 38, 2, body)
    slope(g, x0 + 2, x0 + 3, oy + 19, z0 + 74, oy + 31, z0 + 69, 2, body)
    slope(g, x1 - 3, x1 - 2, oy + 19, z0 + 74, oy + 31, z0 + 69, 2, body)
    if glass:
        glass_pane(g, ws, seed)
        glass_pane(g, rw, seed + 3)
    # side windows (frames), glass optional
    for xx in (x0 + 2, x1 - 3):
        for wz0, wz1 in ((z0 + 38, z0 + 51), (z0 + 52, z0 + 68)):
            g.box(xx, oy + 20, wz0, xx + 1, oy + 30, wz1, C("steel", 5))
            pane = box_mask(g.shape, xx, oy + 21, wz0 + 1, xx + 1, oy + 29, wz1 - 1)
            g.where(pane, 0)
            if glass:
                glass_pane(g, pane, seed + xx)
    # bench seats, dash and steering wheel (driver on -x)
    for sz in (z0 + 45, z0 + 62):
        g.box(x0 + 3, oy + 10, sz, x1 - 3, oy + 15, sz + 7, C("red", 2))
        g.box(x0 + 3, oy + 14, sz, x1 - 3, oy + 15, sz + 7, C("red", 3))
        g.box(x0 + 3, oy + 15, sz + 6, x1 - 3, oy + 26, sz + 8, C("red", 2))
        for sx in range(x0 + 6, x1 - 4, 5):
            g.box(sx, oy + 15, sz + 6, sx + 1, oy + 26, sz + 7, C("red", 1))
    g.box(x0 + 2, oy + 16, z0 + 32, x1 - 2, oy + 21, z0 + 37, C("iron", 2))  # dash
    g.box(x0 + 8, oy + 19, z0 + 37, x0 + 16, oy + 20, z0 + 38, C("gold", 5))  # gauges
    steering_wheel(g, x0 + 12, oy + 22, z0 + 40, 3.6)
    g.box(x0 + 11, oy + 19, z0 + 37, x0 + 13, oy + 21, z0 + 40, C("iron", 1))  # column
    # front: grille, headlights, bumper, plate
    g.box(x0 + 1, oy + 9, z0 + 1, x1 - 1, oy + 18, z0 + 2, dark)
    g.box(x0 + 9, oy + 10, z0 + 1, x1 - 9, oy + 17, z0 + 2, C("steel", 6))
    g.box(x0 + 10, oy + 11, z0 + 1, x1 - 10, oy + 16, z0 + 2, C("iron", 1))
    for gx in range(x0 + 11, x1 - 10, 2):
        g.box(gx, oy + 11, z0 + 1, gx + 1, oy + 16, z0 + 2, C("steel", 5))
    for hx in (x0 + 5, x1 - 5):
        headlight(g, hx, oy + 14, z0 + 1, 3.0)
    g.box(x0 - 1, oy + 6, z0 - 1, x1 + 1, oy + 9, z0 + 2, C("steel", 5))  # bumper
    g.box(x0 - 1, oy + 8, z0 - 1, x1 + 1, oy + 9, z0 + 2, C("steel", 6))
    g.box(x0 + 15, oy + 5, z0 - 2, x1 - 15, oy + 9, z0 - 1, C("gray", 6))  # plate
    g.box(x0 + 16, oy + 6, z0 - 2, x1 - 16, oy + 8, z0 - 1, C("navy", 3))
    # rear: tail lights, bumper, trunk lock
    g.box(x0 + 1, oy + 9, z1 - 2, x1 - 1, oy + 18, z1 - 1, dark)
    for tx in (x0 + 2, x1 - 9):
        g.box(tx, oy + 12, z1 - 2, tx + 7, oy + 17, z1 - 1, C("red", 5))
        g.box(tx + 1, oy + 13, z1 - 2, tx + 3, oy + 16, z1 - 1, C("orange", 5))
    g.box(x0 + 19, oy + 15, z1 - 2, x0 + 21, oy + 17, z1 - 1, C("steel", 6))
    g.box(x0 - 1, oy + 6, z1 - 2, x1 + 1, oy + 9, z1 + 1, C("steel", 5))
    g.box(x0 + 15, oy + 9, z1 - 1, x1 - 15, oy + 12, z1, C("gray", 6))
    # wheels, arches
    wheels = []
    for wz in (z0 + 17, z1 - 19):
        for wx in (x0 + 3, x1 - 3):
            wheels.append((wx, oy + R, wz))
    for (wx, wy, wz) in wheels:
        arch(g, wx, wy, wz, R + 1.5, wx - 4, wx + 4)
        flare(g, wx, wy, wz, R + 1.5, R + 2.5, wx - 4, wx + 4, dark)
    for (wx, wy, wz) in wheels:
        big_wheel(g, wx, wy, wz, R, 6, rim=("steel", 5), holes=5)
    return wheels
