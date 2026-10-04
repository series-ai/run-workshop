"""Toxic sludge pool, in the Pirate Nation style.

A patch of dusty wasteland on a two-tier sand bed. In it sits a sunken
pool of glowing green sludge: a faceted bank (true slopes) rings it, wet
and crusted with lime scum at the waterline, with cracked dry mud round
it. The liquid glows brightest in the middle, darkens at the shore and
carries ripple rings, an oil sheen and a dead fish. A hazard-yellow drum
with a black band lies half sunk in it, its open end oozing; on the dry
apron a dented red drum with a skull stands beside a toppled yellow one
that leaks a puddle. A diamond radiation sign leans on its post, rusty
rebar sticks out of the bank, and a few rocks and dry tufts finish it.
Three bubbles rise, swell and pop on `idle`; the pool socket drives the
poison cloud. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, blob, bump, ctr, front, fx, keys, limb, make, plan, rock, trefoil_rows, tuft
from voxgrid import C, Clip, Grid

SZ = (90, 34, 74)
CX, CZ = 45.0, 37.0  # the middle of the bed (the root origin)
PX, PZ = 39.0, 39.0  # the middle of the pool
RX, KZ = 21.0, 0.82  # pool radius along x, and the z/x squash
GROUND = 3.0  # top of the upper bed tier
SURF = 3.6  # the sludge surface
BUBBLES = ((33.5, 32.5), (46.5, 36.5), (40.5, 28.5))
SIGN = (27.0, 14.0)
FISH = (48.0, 47.0)  # (x, z) of the sign post


def ell(r: float, a: float):
    """A point on the pool ellipse (x, z) at radius r and angle a."""
    return (PX + r * math.cos(a), PZ + r * KZ * math.sin(a))


def sunk_disc(g: Grid, cy, cz, r, lo, hi, ramp: str, shade: int, floor: float) -> np.ndarray:
    """An octagon drum section across x, cut flat at `floor` (half sunk)."""
    pts = [(max(floor, y), v) for y, v in S.flat_ngon(cy, cz, r, 8, S._DOWN["x"])]
    g.prism("x", pts, lo, hi, C(ramp, shade))
    return g.solids[-1].mask(g.shape)


def paint_rock(g: Grid, m: np.ndarray, seed: int) -> None:
    """Stone blocks on every facet with dark seams (rules S2, S4)."""
    for fm, fr in S.facets(g, [g.solids[-1]]):
        P.stone(g, m & fm, "stone", 5, block=(5, 3), frame=fr, seed=seed)
    P.flat(g, m & S.seams(g, [g.solids[-1]]), "stone", 3)


def pool() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # ---- the two-tier sand bed
    lower = plan(g, blob(CX, CZ, 43.5, 35.5, n=16, jitter=0.03, seed=3, turn=0.1), 0, 1.5, "sand", 3)
    upper = plan(g, blob(CX, CZ, 41.0, 33.0, n=14, jitter=0.05, seed=4, turn=0.3), 1.5, GROUND, "sand", 5)
    bed = lower | upper
    P.mottle(g, bed, "sand", 5, cell=6, seed=5)
    P.flat(g, lower & (Y < 1.5), "sand", 3)
    top = upper & (Y > GROUND - 1)
    P.outline(g, top, "sand", 4, normal="y")
    near = np.hypot(X - PX, (Z - PZ) / KZ)
    # cracked dry mud round the bank: a darker ring split by radial cracks
    mud = top & (near < RX + 10)
    P.flat(g, mud, "sand", 4)
    ang = np.arctan2((Z - PZ) / KZ, X - PX)
    crack = (np.abs(((ang * 9 / math.pi + 0.15 * np.sin(near)) % 2) - 1) > 0.9) | (np.abs(near - (RX + 8)) < 0.5)
    P.flat(g, mud & crack, "sand", 3)
    PP.blotch(g, top & (near >= RX + 10), "sand", 6, cell=6, chance=0.04, seed=7)  # sun-bleached dust
    # ---- the sludge, sunk below the bank
    goo = plan(g, [ell(RX + 2, 2 * math.pi * k / 16) for k in range(16)], 1, SURF, "toxic", 5)
    gd = near / RX
    P.flat(g, goo & (gd > 0.8), "toxic", 4)  # darker at the shore
    P.flat(g, goo & (gd < 0.45), "toxic", 6)  # glowing heart
    P.flat(g, goo & (gd < 0.18), "toxic", 7)
    P.flat(g, goo & (np.abs(gd - 0.62) < 0.04), "toxic", 6)  # ripple rings
    for bx, bz in BUBBLES:
        P.flat(g, goo & (np.abs(np.hypot(X - bx, Z - bz) - 3.5) < 0.6), "toxic", 7)
    P.flat(g, goo & (np.abs(np.sin(X * 0.35 + Z * 0.2) - 0.9) < 0.06) & (gd > 0.5), "teal", 6)  # an oil sheen
    fx_, fz = FISH
    fish = goo & (np.hypot((X - fx_) * 0.55, Z - fz) < 1.6)  # a dead fish, belly up
    P.flat(g, fish, "bone", 6)
    P.flat(g, goo & (np.abs(X - (fx_ + 3.5)) < 0.8) & (np.abs(Z - fz) < 1.6), "bone", 5)  # its tail
    P.flat(g, fish & (np.abs(X - (fx_ - 1.5)) < 0.6), "darkwood", 2)  # its eye
    # ---- the bank: sixteen faceted segments, sloped inside and out
    bank = np.zeros(g.shape, dtype=bool)
    for k in range(16):
        a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
        h = GROUND + 1.8 + 0.8 * math.sin(k * 1.9) + (0.8 if k in (3, 4, 11) else 0.0)
        base = [ell(RX + 5, a0), ell(RX + 5, a1), ell(RX - 1.0, a1), ell(RX - 1.0, a0)]
        crown = [ell(RX + 3, a0), ell(RX + 3, a1), ell(RX + 1.0, a1), ell(RX + 1.0, a0)]
        bank |= plan(g, base, GROUND - 0.5, h, "sand", 5, top=crown)
    P.mottle(g, bank, "sand", 5, cell=4, seed=8)
    inner = bank & (near < RX + 1.8)
    P.flat(g, inner, "moss", 3)  # the wet, stained inner slope frames the liquid
    P.flat(g, inner & (Y < SURF + 1.0), "moss", 2)
    P.flat(g, inner & (Y < SURF + 1.0) & (Y > SURF + 0.3), "toxic", 7)  # lime scum crust at the waterline
    P.flat(g, bank & (near > RX + 3.5), "sand", 4)  # the dry outer foot
    # ---- rocks on the bank and the bed edge (painted stone blocks)
    for k, (a, rx, h) in enumerate(((2.5, 4.5, 6.0), (3.6, 3.2, 4.0), (5.6, 4.0, 5.0))):
        x, z = ell(RX + 3.5, a)
        m = rock(g, x, z, GROUND - 0.5, rx, rx * 0.85, h, ramp="stone", shade=5, shrink=0.55, n=6, seed=20 + k, turn=a)
        paint_rock(g, m, 20 + k)
    for k, (x, z, r) in enumerate(((CX - 34, CZ + 8, 3.0), (CX + 14, CZ + 25, 2.5))):
        m = rock(g, x, z, GROUND - 0.5, r, r * 0.8, r * 1.2, ramp="stone", shade=5, shrink=0.5, n=6, seed=30 + k)
        paint_rock(g, m, 30 + k)
    # ---- the hazard drum lying half sunk in the sludge, oozing from its open end
    lo, cz = PX - 11.0, PZ + 3.0
    d = sunk_disc(g, 3.0, cz, 6.0, lo, lo + 14, "gold", 5, floor=1.0)
    hoops = np.zeros(g.shape, dtype=bool)
    for hh in (lo + 2.5, lo + 9.5):
        hoops |= sunk_disc(g, 3.0, cz, 6.7, hh, hh + 2, "gold", 6, floor=1.0)
    P.mottle(g, d & ~hoops, "gold", 5, cell=4, seed=21)
    P.flat(g, d & ~hoops & (X > lo + 5) & (X < lo + 9), "darkwood", 3)  # black band
    P.outline(g, hoops, "gold", 4, normal="x")
    dr = S.ngon_radius(g, "x", 3.0, cz, 8)
    P.flat(g, d & (X > lo + 13) & (dr < 4.5), "toxic", 7)  # sludge welling out of the open end
    P.flat(g, d & (X > lo + 13) & (dr >= 4.5), "gold", 3)
    PP.blotch(g, d & ~hoops, "rust", 4, cell=3, chance=0.05, seed=22)
    # ---- the dry apron: a red skull drum and a toppled yellow drum with a puddle
    S.drum(g, CX + 27, CZ - 10, GROUND - 0.5, 16, 7.5, ramp="red", base=4, band=("gold", 5), icon="drop", ink=("darkwood", 2), seed=23)
    tx0, tx1, tz, tr = CX + 20, CX + 33, CZ + 10, 5.5
    lying = S.disc(g, "x", GROUND - 0.5 + tr, tz, tr, tx0, tx1, "gold", 5)
    rings = np.zeros(g.shape, dtype=bool)
    for hh in (tx0 + 2.5, tx1 - 4.5):
        rings |= S.disc(g, "x", GROUND - 0.5 + tr, tz, tr + 0.7, hh, hh + 2, "gold", 6)
    P.outline(g, rings, "gold", 4, normal="x")
    P.flat(g, lying & ~rings & (X > tx0 + 6) & (X < tx0 + 9), "darkwood", 3)
    G.stamp(g, "+x", tx1, int(tz - 4.5), int(GROUND - 0.5 + tr - 4.5), trefoil_rows(9), {"#": C("darkwood", 3)})
    open_end = lying & (X < tx0 + 1)
    P.flat(g, open_end, "gold", 3)
    P.flat(g, open_end & (S.ngon_radius(g, "x", GROUND - 0.5 + tr, tz, 8) < tr - 1.5), "toxic", 6)
    PP.blotch(g, lying & ~rings, "rust", 4, cell=3, chance=0.05, seed=24)
    spill = plan(g, blob(tx0 + 5, tz - 8.5, 4.5, 2.5, n=9, jitter=0.15, seed=25), GROUND - 1, GROUND + 0.4, "toxic", 5)
    P.outline(g, spill, "toxic", 3, normal="y")
    # ---- rusty rebar sticking out of the bank
    for k, (a, lean) in enumerate(((0.9, (3, 2)), (1.25, (1, 4)), (4.2, (-3, 2)))):
        x, z = ell(RX + 3.5, a)
        limb(g, (x, GROUND, z), (x + lean[0], GROUND + 9 + k, z + lean[1]), 0.6, None, "rust", 3, n=4)
    # ---- the sign post and dry tufts
    sx, sz = SIGN
    limb(g, (sx, GROUND - 0.5, sz + 2.0), (sx, GROUND + 16, sz + 2.0), 1.0, None, "darkwood", 3, n=4)
    for k, (x, z) in enumerate(((CX - 30.5, CZ - 14.5), (CX + 34.5, CZ + 6.5), (CX - 12.5, CZ + 27.5), (CX + 8.5, CZ - 26.5))):
        tuft(g, x, z, GROUND, 5, blades=4, spread=2.0, ramp="sand", shade=6, seed=40 + k)
    return g


def sign() -> Grid:
    """A diamond radiation warning board, painted flat, tilted by the rig."""
    g = Grid(*SZ)
    sx, sz = SIGN
    cy = GROUND + 13.0
    board = front(g, [(sx, cy - 10), (sx + 10, cy), (sx, cy + 10), (sx - 10, cy)], sz - 1.0, sz + 1.0, "gold", 5)
    X, Y, Z = ctr(g)
    P.flat(g, board & (Z > sz), "steel", 4)  # the bare back plate
    P.outline(g, board & (Z < sz), "darkwood", 2, normal="z")
    P.flat(g, board & (Z < sz) & (np.hypot(X - (sx + 4), Y - (cy - 4)) < 1.6), "rust", 4)  # a rust chip
    G.stamp(g, "-z", sz - 1.0, int(sx - 4.5), int(cy - 4.5), trefoil_rows(9), {"#": C("darkwood", 2)}, depth=1)
    return g


def bubble(k: int) -> Grid:
    g = Grid(*SZ)
    bx, bz = BUBBLES[k]
    bump(g, bx, bz, SURF, 1.8 + 0.4 * k, 2.2 + 0.4 * k, "toxic", 7, n=6)
    return g


def build():
    rig = Rig("toxic-pool", (CX, 0, CZ), pool())
    rig.add("sign", sign(), (SIGN[0], GROUND + 13.0, SIGN[1] + 1.5), rot=(0.0, 0.0, 9.0))
    for k, (bx, bz) in enumerate(BUBBLES):
        rig.add(f"bubble-{k}", bubble(k), (bx, SURF, bz))
    def cyclic(points, period):
        """Keys for a looping curve given (time, value) points that may pass the
        period: times wrap, and the values at 0 and `period` match."""
        pts = sorted(((t % period, v) for t, v in points), key=lambda p: p[0])
        ext = [(t - period, v) for t, v in pts] + pts + [(t + period, v) for t, v in pts]

        def at(t):
            for (t0, v0), (t1, v1) in zip(ext, ext[1:]):
                if t0 <= t <= t1:
                    u = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
                    return tuple(a + (b - a) * u for a, b in zip(v0, v1))
            raise ValueError(f"{t} is outside the curve")

        times = sorted({0.0, period, *(t for t, _ in pts if 0 < t < period)})
        return keys(*[(t, at(t)) for t in times])

    idle = {}
    for k in range(3):
        t0 = 0.6 * k
        idle[f"bubble-{k}"] = {
            "scale": keys((0, (0.3, 0.3, 0.3)), ((t0 + 0.2) % 1.8, (0.3, 0.3, 0.3)), ((t0 + 0.9) % 1.8 or 1.8, (1.25, 1.35, 1.25)), (1.8, (0.3, 0.3, 0.3))) if k == 0 else
            cyclic([(t0, (0.2, 0.2, 0.2)), (t0 + 0.7, (1.3, 1.4, 1.3)), (t0 + 0.8, (0.05, 0.05, 0.05)), (t0 + 1.0, (0.2, 0.2, 0.2))], 1.8),
            "loc": keys((0, (0, 0, 0)), (0.9, (0, 1.0, 0)), (1.8, (0, 0, 0))),
        }
    return make("terrain-nature", "toxic-pool", "Toxic Sludge Pool", rig.root,
                clips=[Clip("idle", idle)],
                sockets=[rig.socket("socket-pool", (PX, SURF + 1, PZ))],
                pfx=[fx("rvx-apocalypse-toxic-pool", "socket-pool", "idle", size=60)])
