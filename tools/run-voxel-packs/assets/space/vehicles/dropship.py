"""Troop dropship, in the Pirate Nation mecha style.

A blunt armoured lander: a faceted white hull body (true slopes both ways,
F2) over a plated steel belly, a wide short cockpit with a glowing teal
canopy (F4), hazard chevrons on the nose, a chin sensor pod and two stub
wings carrying oversized tilting engine nacelles with glowing nozzles. A
blast ramp drops at the tail; four steel skids hold it off the pad. On
`move` the nacelles tilt back and the ship leans; `open` and `close` work
the ramp; `idle` hovers. Faces -Z.
"""
import numpy as np

import math

from _life import P, Clip, Grid, Rig, asset, edges, front, hazard, keys, light_top, loft, mask_of, ngon_y, plan, plate_facets, plated, section8, side, spin, wave
from _life import box as _box, coords as _coords
from pnshapes import bar, disc, facets, ngon_radius as _ngon_radius
import pnglyph
from voxgrid import C

# The model is authored in design units and built at K voxels per unit, so
# that a troop carrier is larger than the one-seat star-fighter (Art
# Director repair: about 108 long and 57 high). Paint patterns stay at one
# texel per voxel; only the shapes and paint masks scale.
K = 1.23


class _KGrid(Grid):
    """A grid that takes prism coordinates in design units."""

    def __init__(self, sx, sy, sz):
        super().__init__(math.ceil(sx * K), math.ceil(sy * K), math.ceil(sz * K))

    def prism(self, axis, poly, lo, hi, c, top=None):
        poly = [(u * K, v * K) for u, v in poly]
        top = None if top is None else [(u * K, v * K) for u, v in top]
        return super().prism(axis, poly, lo * K, hi * K, c, top)


def box(g, x0, y0, z0, x1, y1, z1, ramp, base=4):
    return _box(g, x0 * K, y0 * K, z0 * K, x1 * K, y1 * K, z1 * K, ramp, base)


def coords(g):
    return tuple(a / K for a in _coords(g))


def ngon_radius(g, axis, cu, cv, n=8):
    return _ngon_radius(g, axis, cu * K, cv * K, n) / K


def _k(p):
    return tuple(c * K for c in p)


S = (82, 50, 122)  # z leaves room for the tail ramp leaf, hinged at 90
CX, CZ = 41, 50
HY = 23  # hull centre height
NX = 30  # nacelle offset in x
NZ = 56  # nacelle centre in z
# The rear rings are tall, so the tail hold opening is 29 units (36 voxels) high.
RINGS = [(10, 9, 6, 22), (20, 14, 9, 22), (34, 17, 12, 23), (64, 17, 14.5, 23), (80, 15, 14.5, 23), (92, 13.5, 14.5, 23)]


def hull() -> Grid:
    g = _KGrid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    solids = loft(g, CX, RINGS, "bone", 6, k=0.40)
    body = mask_of(g, solids)
    plate_facets(g, solids, "bone", 6, size=(13, 10), seed=1)
    # the deck is lit, then given straight panel lines: light_top alone wiped
    # every seam there, and the loft's short facets turn plates into speckle.
    deck = light_top(g, body, "bone", 7)
    P.flat(g, deck & ((np.abs(X - (CX - 9)) < 0.6) | (np.abs(X - (CX + 9)) < 0.6)), "bone", 4)
    P.flat(g, deck & (np.floor(Z) % 14 == 0), "bone", 4)
    P.flat(g, deck & (np.floor(Z) % 14 == 1) & (np.abs(X - CX) > 10), "bone", 5)
    P.flat(g, edges(body), "bone", 4)
    # plated steel belly and a dark keel band
    belly = body & (Y < HY - 4)
    plated(g, belly, "steel", 5, size=(11, 7), edge=False, seed=2)
    P.flat(g, body & (Y < HY - 9), "steel", 3)
    P.flat(g, body & (np.abs(Y - (HY - 4)) < 0.7), "iron", 4)
    # hazard chevrons and a painted number on the nose
    nose = body & (Z < 24)
    hazard(g, nose & (Y > HY - 4) & (Y < HY + 1), period=5, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, body & (Z < 12), "orange", 5)
    P.flat(g, body & (Z < 11) & (Y > HY), "orange", 6)
    # a painted chevron on each flank (text breaks up on the faceted hull)
    for s_ in (-1, 1):
        flank = body & (np.abs(X - CX) > 13)
        P.flat(g, flank & (np.abs((Z - 44) - 1.8 * np.abs(Y - (HY + 7))) < 1.6) & (np.abs(Y - (HY + 7)) < 6), "orange", 6)
        del s_
    P.flat(g, deck & (np.abs(X - CX) < 3) & (Z > 44) & (Z < 86), "orange", 5)
    P.flat(g, deck & (np.abs(X - CX) < 1.2) & (Z > 44) & (Z < 86), "orange", 6)
    P.flat(g, deck & (Z > 16) & (Z < 26) & (np.abs(X - CX) < 9), "iron", 4)
    # side service hatches and a long orange flank stripe
    stripe = body & (np.abs(Y - (HY + 4)) < 1.2) & (Z > 26) & (Z < 84)
    P.flat(g, stripe, "orange", 5)
    for zc in (36, 50, 64):
        hatch = body & (np.abs(X - CX) > 14) & (np.abs(Z - zc) < 5) & (Y > HY - 3) & (Y < HY + 2)
        P.flat(g, hatch, "bone", 4)
        P.flat(g, hatch & (np.abs(Z - zc) < 4) & (Y > HY - 2) & (Y < HY + 1), "cyan", 6)
    # cockpit: a chamfered canopy block with a sloped teal windscreen
    n1 = len(g.solids)
    cab = side(g, [(HY + 8, 14), (HY + 8, 40), (HY + 16, 36), (HY + 16, 24)], CX - 13, CX + 13, "bone", 6)
    plate_facets(g, g.solids[n1:], "bone", 6, size=(11, 8), seed=3)
    P.flat(g, edges(cab), "bone", 4)
    zf = 14 + (Y - (HY + 8)) * 10 / 8
    glass = cab & (Z < zf + 2.5) & (Y > HY + 9) & (X > CX - 12) & (X < CX + 12)
    P.flat(g, glass, "cyan", 6)
    P.flat(g, glass & (Y > HY + 13), "cyan", 7)
    P.flat(g, glass & (np.abs(X - CX) < 0.7), "bone", 4)
    P.flat(g, glass & (np.abs(X - (CX - 9)) < 0.7), "bone", 4)
    P.flat(g, glass & (np.abs(X - (CX + 9)) < 0.7), "bone", 4)
    P.flat(g, cab & (Y > HY + 15), "bone", 7)
    for s in (-1, 1):  # canopy flank windows and running lamps
        sidew = cab & (np.abs(X - (CX + s * 12.5)) < 1.2) & (Z > 26) & (Z < 36) & (Y > HY + 10) & (Y < HY + 15)
        P.flat(g, sidew, "cyan", 5)
        lmp = box(g, CX + s * 17 - 2, HY + 5, 16, CX + s * 17 + 2, HY + 8, 20, "iron", 4)
        P.flat(g, lmp, "iron", 4)
        P.flat(g, lmp & (Z < 17), "gold", 7)
    # the chin sensor pod under the nose
    pod = ngon_y(g, CX, 20, 5.5, HY - 14, HY - 8, "steel", 5, n=8, r_top=4.0)
    P.flat(g, pod, "steel", 5)
    P.flat(g, pod & (Y < HY - 12.5), "cyan", 6)
    P.flat(g, pod & (Y < HY - 13), "cyan", 7)
    # the dorsal fin and tail lamps
    fin = side(g, [(HY + 11, 72), (HY + 11, 90), (HY + 22, 90), (HY + 20, 80)], CX - 2, CX + 2, "orange", 5)
    P.flat(g, fin, "orange", 5)
    P.flat(g, edges(fin), "orange", 3)
    P.flat(g, fin & (np.abs(Y - (HY + 16)) < 1.2), "bone", 6)
    P.flat(g, body & (Z > 89) & (np.abs(X - CX) > 5) & (Y > HY) & (Y < HY + 4), "red", 5)
    # The troop hold mouth on the tail face, behind the ramp.
    hold = body & (Z > 91) & (np.abs(X - CX) < 11) & (Y > 9) & (Y < 36)
    P.flat(g, hold, "iron", 4)
    P.flat(g, hold & (Y > 33), "cyan", 6)
    P.flat(g, hold & (np.abs(X - CX) > 9.5), "orange", 5)
    P.flat(g, hold & (np.abs(Y - 22) < 0.6), "iron", 5)
    wings(g)
    skids(g)
    return g


def wings(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        n0 = len(g.solids)
        plan(g, [(CX + s * 15, 40), (CX + s * 38, 50), (CX + s * 38, 66), (CX + s * 15, 74)], HY - 3, HY + 3, "bone", 6)
        plate_facets(g, g.solids[n0:], "bone", 6, size=(10, 8), seed=4)
        w = g.solids[-1].mask(g.shape)
        P.flat(g, edges(w), "bone", 4)
        light_top(g, w, "bone", 7)
        P.plates(g, w & (Y > HY + 1), "bone", 7, size=(10, 8), frame="top", seed=4)
        P.flat(g, w & (np.abs(X - (CX + s * 30)) < 6) & (Y < HY - 1.5), "steel", 4)
        P.flat(g, w & (Z > 70), "orange", 5)  # trailing edge
        P.flat(g, w & (np.abs(X - (CX + s * 36)) < 1.6) & (Z > 52) & (Z < 60), "cyan", 7)  # tip lamp
        # a copper feed line from the hull to the pylon
        bar(g, "y", (CX + s * 16, 52), (CX + s * 27, 56), 2.6, HY + 2, HY + 5, "rust", 5)
        pyl = box(g, CX + min(s * 27, s * 33), HY - 5, 48, CX + max(s * 27, s * 33), HY + 4, 66, "steel", 5)
        plated(g, pyl, "steel", 5, size=(7, 6), seed=5)
        P.flat(g, edges(pyl), "steel", 3)
        # a painted unit roundel on the flat wing deck (the lofted hull deck
        # is faceted, where a glyph would break up)
        iw, ih = pnglyph.icon_size("star")
        pnglyph.icon(g, "top", (HY + 3) * K, int((CX + s * 21) * K - iw // 2), int(54 * K) - ih // 2, "star", "orange", 5,
                     depth=2, inks={"-": ("iron", 3), "+": ("orange", 6)})


def skids(g: Grid) -> None:
    X, Y, Z = coords(g)
    for s in (-1, 1):
        for zc in (30, 76):
            leg = side(g, [(HY - 10, zc - 3), (HY - 10, zc + 3), (4, zc + 5), (4, zc - 5)], CX + s * 14 - 2, CX + s * 14 + 2, "iron", 5)
            P.flat(g, leg, "iron", 5)
            P.flat(g, leg & (np.abs(Y - 9) < 0.9), "rust", 5)
        pad = box(g, CX + s * 14 - 4, 0, 24, CX + s * 14 + 4, 4, 82, "steel", 4)
        plated(g, pad, "steel", 4, size=(8, 4), seed=6)
        P.flat(g, edges(pad), "steel", 2)
        hazard(g, pad & (Y > 2.5), period=5, a=("orange", 5), b=("iron", 3), frame="top")


def nacelle(s: int) -> Grid:
    """An oversized engine pod with a glowing nozzle and a copper collar."""
    g = _KGrid(*S)
    X, Y, Z = coords(g)
    cx = CX + s * NX
    n0 = len(g.solids)
    pod = disc(g, "z", cx, HY, 8, NZ - 16, NZ + 12, "bone", 6, n=10)
    plate_facets(g, g.solids[n0:], "bone", 6, size=(10, 10), seed=7)
    P.flat(g, edges(pod), "bone", 4)
    intake = disc(g, "z", cx, HY, 9, NZ - 19, NZ - 15, "rust", 5, n=10)
    P.flat(g, intake, "rust", 5)
    P.flat(g, intake & (np.abs(Z - (NZ - 17)) < 1.2), "rust", 6)
    d = ngon_radius(g, "z", cx, HY, 10)
    P.flat(g, intake & (d < 6.5) & (Z < NZ - 18), "iron", 3)
    P.flat(g, intake & (d < 3.0) & (Z < NZ - 18), "cyan", 5)
    P.flat(g, pod & (np.abs(Z - (NZ - 8)) < 1.4), "rust", 5)  # copper collar
    P.flat(g, pod & (np.abs(Z - (NZ + 4)) < 1.4), "rust", 5)
    P.flat(g, pod & (Y > HY + 5), "bone", 7)
    P.flat(g, pod & (Y < HY - 5), "steel", 4)
    P.flat(g, pod & (np.abs(Y - HY) < 1.4) & (Z > NZ - 14) & (Z < NZ + 2), "orange", 5)
    n1 = len(g.solids)
    noz = disc(g, "z", cx, HY, 7, NZ + 12, NZ + 19, "steel", 5, n=10)
    plate_facets(g, g.solids[n1:], "steel", 5, size=(6, 6), seed=8)
    P.flat(g, noz & (np.abs(Z - (NZ + 13)) < 1.2), "orange", 5)
    P.flat(g, noz & (Z > NZ + 17), "iron", 3)
    P.flat(g, noz & (Z > NZ + 17) & (d < 5.2), "cyan", 5)
    P.flat(g, noz & (Z > NZ + 17) & (d < 3.4), "cyan", 6)
    P.flat(g, noz & (Z > NZ + 17) & (d < 1.8), "cyan", 7)
    # the downward VTOL vent on the pod belly
    vent = box(g, cx - 5, HY - 9, NZ - 10, cx + 5, HY - 7, NZ + 4, "iron", 4)
    P.flat(g, vent, "iron", 4)
    P.flat(g, vent & (Y < HY - 8) & (np.floor(Z) % 3 != 0), "orange", 6)
    P.flat(g, vent & (Y < HY - 8) & (np.floor(Z) % 3 == 0), "iron", 4)
    return g


def ramp() -> Grid:
    """The tail blast ramp: a plated leaf with hazard treads and a rail."""
    g = _KGrid(*S)
    X, Y, Z = coords(g)
    m = box(g, CX - 13, 7, 90, CX + 13, 11, 119, "steel", 5)
    plated(g, m, "steel", 5, size=(9, 7), seed=9)
    P.flat(g, edges(m), "steel", 3)
    top = m & (Y > 9.5)
    P.flat(g, top, "steel", 6)
    P.flat(g, top & (np.floor(Z) % 4 == 0), "steel", 3)
    hazard(g, m & (Z > 115), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    for s in (-1, 1):
        rail = box(g, CX + s * 12 - 1, 11, 92, CX + s * 12 + 1, 14, 117, "orange", 5)
        P.flat(g, rail, "orange", 5)
        P.flat(g, edges(rail), "orange", 3)
    return g


def build():
    rig = Rig()
    rig.add("dropship", hull(), _k((CX, 0, CZ)))
    for s, name in ((-1, "nacelle-l"), (1, "nacelle-r")):
        rig.add(name, nacelle(s), _k((CX + s * NX, HY, NZ)), "dropship")
    rig.add("ramp", ramp(), _k((CX, 9, 90)), "dropship", rot=(-78.0, 0.0, 0.0))
    z = (0.0, 0.0, 0.0)
    idle = {
        "dropship": {"loc": wave(3.2, "y", 0.8, base=(0, 1.6, 0)), "rot": wave(3.2, "z", 1.2, phase=1.0)},
        "nacelle-l": {"rot": wave(3.2, "x", 3, phase=0.5)},
        "nacelle-r": {"rot": wave(3.2, "x", 3, phase=2.1)},
    }
    move = {
        "dropship": {"rot": keys((0, (-6, 0, 0)), (1.2, (-6, 0, 2)), (2.4, (-6, 0, -2)), (3.6, (-6, 0, 0))),
                     "loc": wave(3.6, "y", 0.5, base=(0, 6.0, 0))},
        "nacelle-l": {"rot": keys((0, z), (0.8, (-24, 0, 0)), (2.8, (-24, 0, 0)), (3.6, z))},
        "nacelle-r": {"rot": keys((0, z), (0.8, (-24, 0, 0)), (2.8, (-24, 0, 0)), (3.6, z))},
    }
    # Clip rotation 0 stows the ramp. Rotation 88 lowers it to the pad.
    open_ = {"ramp": {"rot": keys((0, z), (0.3, (-8, 0, 0)), (1.2, (88, 0, 0)), (1.5, (88, 0, 0)))}}
    close_ = {"ramp": {"rot": keys((0, (88, 0, 0)), (0.3, (88, 0, 0)), (1.2, (-8, 0, 0)), (1.5, z))}}
    socks = []
    pfx = []
    for s, name in ((-1, "l"), (1, "r")):
        socks.append(rig.sock(f"socket-engine-{name}", _k((CX + s * NX, HY, NZ + 20)), parent=f"nacelle-{'l' if s < 0 else 'r'}"))
        socks.append(rig.sock(f"socket-thrust-{name}", _k((CX + s * NX, HY - 10, NZ - 3)), parent=f"nacelle-{'l' if s < 0 else 'r'}"))
        pfx.append({"effectId": "rvx-space-engine-exhaust", "socket": f"socket-engine-{name}", "trigger": "clip:move", "size": 30, "aim": [0.0, 0.0, 1.0]})
        pfx.append({"effectId": "rvx-space-hover-thrust", "socket": f"socket-thrust-{name}", "trigger": "idle", "size": 20, "aim": [0.0, -1.0, 0.0]})
    return asset(
        "vehicles", "dropship", "Troop Dropship", rig.root,
        clips=[Clip("move", move), Clip("open", open_, loop=False), Clip("close", close_, loop=False), Clip("idle", idle)],
        sockets=socks, pfx=pfx,
    )
