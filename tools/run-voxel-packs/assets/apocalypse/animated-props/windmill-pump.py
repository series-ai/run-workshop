"""Farm windmill water pump, in the Pirate Nation style.

A caricature windpump about 2.6 persons tall: a tapered rust-copper
lattice tower with X braces (true slopes) on concrete feet, a plank work
platform, a gearbox head, an oversized rotor of twelve red and cream
blades between two rims that spins on `spin` (a slow creak on `idle`),
and a long tail boom with a striped vane. A pump rod runs down to a well
head whose spout fills a round stock tank. Rust, planks and water are paint.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, lattice, limb, make, plan
from pnkit import box, edges
from voxgrid import C, Clip, Grid, turn

SZ = (66, 100, 56)
CX, CZ = 24.5, 27.5
Y0, Y1 = 2, 74
HALF0, HALF1 = 10.0, 2.6
HUB = (CX, 80.0, CZ - 6.0)
R_ROT = 17.0


def tower() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    for sx in (-1, 1):
        for sz in (-1, 1):
            foot = plan(g, S.flat_ngon(CX + sx * HALF0, CZ + sz * HALF0, 3.0, 8), 0, Y0 + 1, "sand", 5, top=S.flat_ngon(CX + sx * HALF0, CZ + sz * HALF0, 2.2, 8))
            P.mottle(g, foot, "sand", 5, cell=2, seed=int(sx + 2 * sz + 5))
    mast = lattice(g, CX, CZ, Y0, Y1, HALF0, HALF1, (Y0 + 1, 18, 34, 50, 64, Y1), leg=1.4, brace=0.8, ramp="rust", shade=5)
    P.mottle(g, mast, "rust", 5, cell=6, seed=1)
    P.flat(g, mast & (Y < Y0 + 8), "rust", 4)
    # a plank work platform under the head
    h = HALF1 + 5
    deck = box(g, CX - h, 64, CZ - h, CX + h, 66, CZ + h, "wood", 5)
    P.planks(g, deck, "wood", 5, width=3, across="x", frame="top", seed=3)
    P.flat(g, edges(deck), "darkwood", 5)
    # the gearbox head and the tail boom with a striped vane
    head = box(g, CX - 3, Y1, CZ - 5, CX + 3, Y1 + 9, CZ + 4, "steel", 5)
    P.outline(g, head, "steel", 3)
    cap = plan(g, [(CX - 3.5, CZ - 5.5), (CX + 3.5, CZ - 5.5), (CX + 3.5, CZ + 4.5), (CX - 3.5, CZ + 4.5)], Y1 + 9, Y1 + 12, "red", 4, top=[(CX - 1, CZ - 3), (CX + 1, CZ - 3), (CX + 1, CZ + 2), (CX - 1, CZ + 2)])
    boom = limb(g, (CX, Y1 + 6, CZ + 4), (CX, Y1 + 8, CZ + 20), 1.2, 1.0, "steel", 5, n=4)
    g.prism("x", [(Y1 + 1, CZ + 18), (Y1 + 14, CZ + 18), (Y1 + 17, CZ + 28), (Y1 - 1, CZ + 28)], CX - 1, CX + 1, C("bone", 6))
    fin = g.solids[-1].mask(g.shape)
    P.flat(g, fin, "bone", 6)
    P.flat(g, fin & ((np.floor(Z) // 3) % 2 == 0), "red", 4)
    G.text(g, "+x", CX + 1, int(CZ + 19), int(Y1 + 4), "H2O", "darkwood", 4, gap=0)
    del cap, boom
    # the pump rod down the middle to a well head with a spout
    limb(g, (CX, Y1, CZ), (CX, 8, CZ), 0.8, None, "steel", 6, n=4)
    well = box(g, CX - 3, Y0, CZ - 3, CX + 3, 10, CZ + 3, "steel", 4)
    P.outline(g, well, "steel", 3)
    S.bar(g, "z", (CX + 2, 8), (CX + 10, 6), 2.0, CZ - 1, CZ + 1, "steel", 5)
    # the stock tank: a round steel tub full of water
    tx, tz = CX + 22.0, CZ + 2.0
    tub = S.disc(g, "y", tx, tz, 9.0, 0, 7, "steel", 5, n=12)
    P.flat(g, tub & (np.floor(Y) % 3 == 0), "steel", 4)
    water = tub & (Y > 6) & (S.ngon_radius(g, "y", tx, tz, 12) < 7.8)
    P.flat(g, water, "teal", 5)
    P.flat(g, water & (np.abs(np.hypot(X - tx, Z - tz) - 4) < 0.6), "teal", 7)
    return g


def rotor() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HUB
    m = np.zeros(g.shape, dtype=bool)
    for k in range(12):
        a = 2 * math.pi * k / 12
        c, s = math.cos(a), math.sin(a)
        r0, r1, w0, w1 = 4.0, R_ROT, 1.2, 3.0
        n0, n1 = (-s, c), (-s, c)
        pts = [(hx + c * r0 + n0[0] * w0, hy + s * r0 + n0[1] * w0), (hx + c * r1 + n1[0] * w1, hy + s * r1 + n1[1] * w1),
               (hx + c * r1 - n1[0] * w1, hy + s * r1 - n1[1] * w1), (hx + c * r0 - n0[0] * w0, hy + s * r0 - n0[1] * w0)]
        g.prism("z", pts, hz - 1 - (k % 2) * 0.5, hz + 1 - (k % 2) * 0.5, C("bone", 6))
        blade = g.solids[-1].mask(g.shape)
        P.flat(g, blade, *(("red", 4) if k % 2 else ("bone", 6)))
        m |= blade
    for rr in (R_ROT * 0.55, R_ROT - 2):  # two rims of 12 straight segments
        outer, inner = S.flat_ngon(hx, hy, rr + 0.9, 12), S.flat_ngon(hx, hy, rr - 0.9, 12)
        for k in range(12):
            seg = [outer[k], outer[(k + 1) % 12], inner[(k + 1) % 12], inner[k]]
            g.prism("z", seg, hz + 1, hz + 2, C("rust", 4))
            P.flat(g, g.solids[-1].mask(g.shape), "rust", 4)
    hub = S.disc(g, "z", hx, hy, 3.6, hz - 2, hz + 3, "gold", 5, n=8)
    P.flat(g, hub & (np.hypot(X - hx, Y - hy) < 1.5), "gold", 7)
    return g


def build():
    rig = Rig("windmill-pump", (CX, 0, CZ), tower())
    rig.add("rotor", rotor(), HUB)
    return make("animated-props", "windmill-pump", "Windmill Water Pump", rig.root,
                clips=[Clip("spin", {"rotor": {"rot": turn(1.5, "z", 240)}}), Clip("idle", {"rotor": {"rot": turn(6.0, "z", 60)}})])
