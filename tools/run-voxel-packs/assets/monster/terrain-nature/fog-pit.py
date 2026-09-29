"""Fog pit, in the Pirate Nation haunted style.

A ragged sinkhole: a ring of earth segments whose inner faces slope down
into the pit (true slopes), a dark purple pit floor with a magenta and
toxic glow, broken flagstones tilted toward the hole (prisms at a slant),
bones and a skull on the rim. Out of the dark rise three chunky mist slabs
(swirling faceted bands, pale purple and bone) that swell and turn on idle, each at
its own pace. Parts: pit (root), mist-0, mist-1, mist-2. socket-fog sits
over the glow for the coffin-mist effect. Faces -Z.
"""
import importlib.util
import math
import os

import numpy as np

import paint as P
import pnpaint
import pnshapes
from _kit import keys, pfx, world
from _life import assemble, coords, last, plan
from voxgrid import C, Clip, Grid, Socket

_spec = importlib.util.spec_from_file_location("rvx_monster_dungeon_floor", os.path.join(os.path.dirname(os.path.abspath(__file__)), "dungeon-floor.py"))
_floor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_floor)

S = (56, 30, 56)
CX = CZ = 28.0
N = 12
RI = [10.5, 11.5, 10.0, 12.0, 11.0, 9.8, 11.2, 12.2, 10.4, 11.6, 10.2, 11.0]
RO = [22.0, 23.5, 21.5, 24.0, 22.5, 21.0, 23.0, 24.5, 22.0, 23.0, 21.5, 22.5]
MIST = [  # (y0, y1, outer radius, inner radius, ramp, shade, start angle)
    (5, 8, 14.5, 6.5, "purple", 6, 0.3),
    (10, 13, 11.5, 4.5, "bone", 6, 2.4),
    (15, 17.5, 8.5, 3.0, "purple", 7, 4.4),
]


def ringpt(k, r):
    a = 2 * math.pi * (k % N) / N
    return (CX + r * math.cos(a), CZ + r * math.sin(a))


def tilted_slab(g, a_deg, r, length, width, thick, tilt, y, ramp="stone", base=5):
    """A broken flagstone at angle a_deg around the pit, tilted `tilt`
    degrees so its inner edge dips toward the hole (a slanted prism)."""
    a = math.radians(a_deg)
    cx, cz = CX + r * math.cos(a), CZ + r * math.sin(a)
    if abs(math.cos(a)) >= abs(math.sin(a)):  # radial along x: profile in (x, y), extruded along z
        s = 1 if math.cos(a) > 0 else -1
        rect = [(cx - length / 2, y), (cx + length / 2, y), (cx + length / 2, y + thick), (cx - length / 2, y + thick)]
        pts = pnshapes.rotate(rect, cx, y + thick / 2, s * tilt)
        g.prism("z", pts, cz - width / 2, cz + width / 2, C(ramp, base))
    else:  # radial along z: profile in (y, z), extruded along x
        s = 1 if math.sin(a) > 0 else -1
        rect = [(cz - length / 2, y), (cz + length / 2, y), (cz + length / 2, y + thick), (cz - length / 2, y + thick)]
        rz = pnshapes.rotate(rect, cz, y + thick / 2, s * tilt)
        g.prism("x", [(v, u) for u, v in rz], cx - width / 2, cx + width / 2, C(ramp, base))
    return g.solids[-1]


def wisp(a0, arc, r_out, r_in, n=10):
    """A swirling mist band (x, z): an arc of `arc` radians from a0 whose
    width tapers to a point at its tail, as a simple polygon."""
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n
        a = a0 + arc * t
        ro = r_out * (1.0 - 0.18 * t)
        ri = r_in + (ro - r_in) * t ** 1.6 * 0.95
        outer.append((CX + ro * math.cos(a), CZ + ro * math.sin(a)))
        inner.append((CX + ri * math.cos(a), CZ + ri * math.sin(a)))
    return outer + inner[::-1]


def mist(k) -> Grid:
    """One mist layer: a thick swirling band around the pit's axis (open
    in the middle so the glow shows), with sloped edges (its top is a
    thinner band). Pale top with swirl streaks, magenta-lit underside."""
    y0, y1, r_out, r_in, ramp, shade, a0 = MIST[k]
    g = Grid(*S)
    X, Y, Z = coords(g)
    arc = math.radians(265 - 25 * k)
    plan(g, wisp(a0, arc, r_out, r_in), y0, y1, ramp, shade, top=wisp(a0, arc, r_out - 1.6, r_in + 1.4))
    m = last(g)
    rr = np.hypot(X + 0.5 - CX, Z + 0.5 - CZ)
    ang = np.arctan2(Z + 0.5 - CZ, X + 0.5 - CX)
    streak = m & (np.abs(np.sin(rr * 1.1 - ang * 2)) < 0.3)
    P.flat(g, streak, ramp, min(7, shade + 1))
    P.flat(g, m & (Y >= y1 - 1) & (np.abs(np.sin(rr * 1.1 - ang * 2 + 1.2)) < 0.35), ramp, 7)
    P.flat(g, m & (Y < y0 + 1), "magenta", 6)  # lit from the glow below
    return g


def pit() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the pit floor: dark purple with a magenta and toxic glow
    floor = plan(g, [ringpt(k, RI[k] + 0.2) for k in range(N)], 0, 1, "purple", 2)
    rr = np.hypot(X + 0.5 - CX, Z + 0.5 - CZ)
    ang = np.arctan2(Z + 0.5 - CZ, X + 0.5 - CX)
    P.flat(g, floor & (rr < 7.5), "magenta", 4)
    P.flat(g, floor & (rr < 4.5), "magenta", 6)
    P.flat(g, floor & (np.abs(np.sin(ang * 2 + rr * 0.6)) < 0.2) & (rr < 8.5), "magenta", 5)
    P.flat(g, floor & ((P._hash(X // 2, Z // 2, seed=4) % np.uint64(6)) == 0) & (rr > 3) & (rr < 9), "toxic", 6)
    # the ring of earth: segments whose inner faces slope down into the pit
    seg = []
    for k in range(N):
        base = [ringpt(k, RI[k]), ringpt(k, RO[k]), ringpt(k + 1, RO[(k + 1) % N]), ringpt(k + 1, RI[(k + 1) % N])]
        top = [ringpt(k, RI[k] + 3.0), ringpt(k, RO[k] - 1.2), ringpt(k + 1, RO[(k + 1) % N] - 1.2), ringpt(k + 1, RI[(k + 1) % N] + 3.0)]
        plan(g, base, 0, 3, "skindark", 3, top=top)
        seg.append(g.solids[-1])
    earth = np.logical_or.reduce([s.mask(g.shape) for s in seg])
    P.mottle(g, earth, "skindark", 3, cell=2, seed=5)
    local_ri = np.interp(ang % (2 * math.pi), np.linspace(0, 2 * math.pi, N + 1), RI + [RI[0]])
    inner = earth & (rr < local_ri + 3.4)
    for m, fr in pnshapes.facets(g, seg):
        if fr != "top":
            P.stone(g, m & inner, "stone", 4, block=(5, 2), cracks=0.1, frame=fr, seed=6)
    P.flat(g, inner & (Y == 0), "magenta", 4)  # the glow licks the foot of the slope
    top_earth = earth & ~inner & (Y == 2)
    pnpaint.blotch(g, top_earth, "moss", 5, cell=4, chance=0.3, seed=7)
    pnpaint.blotch(g, top_earth, "moss", 6, cell=2, chance=0.08, seed=10)
    # broken flagstones tilted toward the hole, and bones on the rim
    slabs = []
    for a_deg, r, ln, w, tilt in ((15, 15.5, 7, 6, 18), (75, 16, 6, 7, 14), (140, 15, 7, 5, 22), (200, 16, 6, 6, 12), (255, 15.5, 7, 6, 20), (315, 16.5, 6, 5, 16)):
        slabs.append(tilted_slab(g, a_deg, r, ln, w, 3.0, tilt, 1.6, "stone", 5))
    for m, fr in pnshapes.facets(g, slabs):
        P.stone(g, m, "stone", 6, block=(7, 5), cracks=0.25, frame=fr, seed=8)
    _floor.bone(g, CX + 10, CZ - 16.5, 3, 7, 20)
    _floor.bone(g, CX - 18, CZ + 6, 3, 6, 110)
    pnshapes.skull(g, CX - 12, 3, CZ - 17, s=8, eyes=("magenta", 6), seed=9)
    return g


def build():
    parts = {"pit": pit(), "mist-0": mist(0), "mist-1": mist(1), "mist-2": mist(2)}
    joints = [("pit", None, (CX, 0.0, CZ))]
    for k, (y0, y1, *_rest) in enumerate(MIST):
        joints.append((f"mist-{k}", "pit", (CX, (y0 + y1) / 2, CZ)))
    root = assemble(parts, joints)
    T = 6.0
    clip = {}
    for k, speed in enumerate((1, -1, 2)):
        rot = [(T * i / 8, (0.0, speed * 45.0 * i, 0.0)) for i in range(9)]
        swell = []
        for i in range(9):
            f = math.sin(2 * math.pi * i / 8 + k * 1.3)
            swell.append((T * i / 8, (1.0 + 0.1 * f, 1.0 + 0.22 * f, 1.0 + 0.1 * f)))
        clip[f"mist-{k}"] = {"rot": keys(*rot), "scale": keys(*swell)}
    return world("fog-pit", "terrain-nature", "Fog Pit", root, clips=[Clip("idle", clip)],
                 sockets=[Socket("socket-fog", at=(0.0, 5.0, 0.0))], pfx=[pfx("rvx-monster-grave-mist", "socket-fog", "idle", size=36)])
