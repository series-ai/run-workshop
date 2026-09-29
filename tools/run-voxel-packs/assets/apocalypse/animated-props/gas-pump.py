"""Retro gas pump, in the Pirate Nation style.

One iconic shape (rule K3), taller than a person: a red cabinet with
sloped shoulders (true slopes) and a cream waist band, a big glowing OIL
globe on top, four rolling price drums in a dark window, a big GAS label,
and a tilted OUT card hung on the front. The hose and its gold nozzle hang
from the side and sway on `idle`; the price drums roll on `active`. It
stands on a concrete island with hazard stripes. Rust and labels are paint.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, keys, limb, make, slab
from pnkit import box
from voxgrid import C, Clip, Grid, turn

SZ = (40, 52, 26)
CX0, CX1, CZ0, CZ1 = 7, 25, 7, 18  # cabinet
IY = 3  # island top
DIG_Y, DIG_Z = 27.5, 6.5
DIG_X = (11.5, 14.5, 17.5, 20.5)
HOSE = (CX1 + 0.5, 31.0, 12.5)


def cabinet() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    isl = box(g, 1, 0, 3, 33, IY, 23, "sand", 5)
    PP.concrete(g, isl, "sand", 5, size=10, cracks=3, frame="top", seed=1)
    PP.hazard(g, isl & ((Z < 4) | (Z > 22) | (X < 2) | (X > 32)) & (Y < IY - 0.5), period=4, a=("gold", 5), b=("darkwood", 4))
    top = 36
    body = S.bar  # noqa: F841 (keep the kit import local)
    g.prism("z", [(CX0, IY), (CX1, IY), (CX1, top - 4), (CX1 - 4, top), (CX0 + 4, top), (CX0, top - 4)], CZ0, CZ1, C("red", 4))
    cab = g.solids[-1].mask(g.shape)
    P.mottle(g, cab, "red", 4, cell=3, seed=2)
    P.outline(g, cab, "red", 2, normal="z")
    P.flat(g, cab & (Y >= 19) & (Y < 22), "bone", 6)  # the cream waist band
    PP.blotch(g, cab & (Y < IY + 5), "rust", 5, cell=2, chance=0.15, seed=3)
    # a dark window behind the price drums, and a big GAS label
    win = box(g, CX0 + 2, DIG_Y - 4, CZ0 - 1, CX1 - 2, DIG_Y + 4, CZ0, "steel", 2)
    P.outline(g, win, "bone", 6, normal="z")
    G.text(g, "-z", CZ0, CX0 + 1, IY + 2, "GAS", "bone", 7)
    P.flat(g, cab & (Z < CZ0 + 1) & (Y >= IY + 1) & (Y < IY + 10) & (X >= CX0 + 0.5) & (X < CX1 - 0.5) & (g.a == C("red", 4)), "red", 5)
    # the globe on a neck: a cream octagon disc with a red ring and OIL
    neck = box(g, 14, top, 10, 18, top + 2, 15, "steel", 5)
    del neck
    globe = S.disc(g, "z", 16, top + 7.5, 5.5, 9.5, 15.5, "bone", 7, n=8)
    d = S.ngon_radius(g, "z", 16, top + 7.5, 8)
    P.flat(g, globe & (d > 4.4), "red", 4)
    P.flat(g, globe & (np.abs(Y - (top + 7.5)) < 1.2) & (d <= 4.4), "red", 5)  # the logo bar
    P.flat(g, globe & (d <= 4.4) & (Y > top + 9.5), "bone", 7)
    # a hand-written OUT card hanging askew on the front
    card = slab(g, "z", 16, IY + 14.5, 18, 9, CZ0 - 2, CZ0 - 1, -5, "bone", 6)
    G.text(g, "-z", CZ0 - 2, 9, IY + 11, "OUT", "red", 4, gap=1)
    P.outline(g, card, "bone", 4, normal="z")
    # the holster on the +x side
    holster = box(g, CX1, 20, 10, CX1 + 2, 28, 15, "steel", 5)
    del holster
    return g


def digit(x: float) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = S.disc(g, "x", DIG_Y, DIG_Z, 2.8, x - 1.3, x + 1.3, "bone", 6, n=8)
    ang = np.arctan2(Z - DIG_Z, Y - DIG_Y)
    P.flat(g, m & ((np.floor((ang + np.pi) / (np.pi / 4)) % 2) == 0), "bone", 4)
    P.flat(g, m & (np.abs(Y - DIG_Y) < 0.6) & (Z < DIG_Z), "darkwood", 4)  # the number stroke
    return g


def hose() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HOSE
    m = limb(g, (hx, hy, hz), (hx + 5, hy - 5, hz), 1.2, None, "gray", 3, n=6)
    m |= limb(g, (hx + 5, hy - 5, hz), (hx + 7, hy - 20, hz - 1), 1.2, None, "gray", 3, n=6)
    m |= limb(g, (hx + 7, hy - 20, hz - 1), (hx + 4, hy - 26, hz - 1), 1.2, None, "gray", 3, n=6)
    P.flat(g, m & (np.floor(Y) % 6 == 0), "gray", 4)
    noz = box(g, hx + 1, hy - 29, hz - 3, hx + 5, hy - 24, hz + 1, "gold", 5)
    noz |= S.bar(g, "x", (hy - 26, hz - 3), (hy - 29, hz - 8), 1.8, hx + 2, hx + 4, "steel", 6)
    P.outline(g, noz & (g.a == C("gold", 5)), "gold", 3)
    return g


def build():
    rig = Rig("gas-pump", (17, 0, 13), cabinet())
    for k, x in enumerate(DIG_X):
        rig.add(f"digit-{k}", digit(x), (x, DIG_Y, DIG_Z))
    rig.add("hose", hose(), HOSE)
    idle = {"hose": {"rot": keys((0, (0, 0, 0)), (0.8, (4, 0, 5)), (1.6, (0, 0, 0)), (2.4, (-3, 0, -3)), (3.2, (0, 0, 0)))}}
    # whole turns per loop (8, 5, 3, 1), so the counter never snaps back
    active = {f"digit-{k}": {"rot": turn(1.6, "x", -360 * (8, 5, 3, 1)[k] / 1.6)} for k in range(4)}
    active["hose"] = {"rot": keys((0, (0, 0, 0)), (0.4, (2, 0, 3)), (0.8, (0, 0, 0)), (1.2, (-2, 0, -2)), (1.6, (0, 0, 0)))}
    hx, hy, hz = HOSE
    return make("animated-props", "gas-pump", "Retro Gas Pump", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)],
                sockets=[rig.socket("socket-nozzle", (hx + 3, hy - 29.5, hz - 8.5), parent="hose")])
