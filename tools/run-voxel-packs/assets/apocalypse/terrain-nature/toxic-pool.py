"""Toxic sludge pool, in the Pirate Nation style.

A glowing green pool inside a crusted rock rim (a ring of faceted rocks,
true slopes), with ripple rings, scum and a dead fish painted on the
surface. Leaking yellow drums at real drum size lie half sunk in it, one
more stands crushed on the rim, and dead reeds stand in the shallows.
Three bubbles rise, swell and pop on `idle`; the pool socket drives the
poison cloud. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, blob, bump, ctr, fx, keys, limb, make, plan, rock
from voxgrid import C, Clip, Grid

SZ = (70, 26, 60)
CX, CZ = 35.0, 30.0
SURF = 2.0
BUBBLES = ((28.5, 25.5), (41.5, 33.5), (33.5, 39.5))


def sunk_disc(g: Grid, axis: str, cy, cv, r, lo, hi, ramp: str, shade: int) -> np.ndarray:
    """An octagon drum section whose part below the pool floor is cut flat
    (a drum half sunk in the goo)."""
    pts = [(max(0.0, y), v) for y, v in S.flat_ngon(cy, cv, r, 8, S._DOWN[axis])] if axis == "x" else [(u, max(0.0, y)) for u, y in S.flat_ngon(cv, cy, r, 8, S._DOWN[axis])]
    g.prism(axis, pts, lo, hi, C(ramp, shade))
    return g.solids[-1].mask(g.shape)


def pool() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    goo = plan(g, blob(CX, CZ, 25, 20, n=12, jitter=0.1, seed=1), 0, SURF, "toxic", 6)
    r = np.hypot(X - CX, (Z - CZ) * 1.2)
    P.flat(g, goo & (np.abs(r - 8) < 0.6), "toxic", 7)
    P.flat(g, goo & (np.abs(r - 15) < 0.6), "toxic", 7)
    PP.blotch(g, goo, "lime", 5, cell=3, chance=0.06, seed=2)  # floating scum
    # a dead fish belly-up on the surface
    fish = goo & (np.hypot((X - 25) * 0.6, Z - 33) < 1.6)
    P.flat(g, fish, "bone", 6)
    P.flat(g, goo & (np.abs(X - 28) < 0.8) & (np.abs(Z - 33) < 1.6), "bone", 5)
    # the crusted rock rim: a ring of faceted rocks
    for k in range(14):
        a = 2 * math.pi * k / 14 + 0.15 * (k % 3)
        rx, rz = CX + 25.5 * math.cos(a), CZ + 21 * math.sin(a)
        h = 4 + (k * 7) % 4
        m = rock(g, rx, rz, 0, 5.0, 4.2, h, ramp="stone", shade=5, shrink=0.55, n=6, seed=10 + k, turn=a)
        P.mottle(g, m, "stone", 5, cell=3, seed=k)
        P.flat(g, m & (Y < 2.5) & (np.hypot(X - CX, (Z - CZ) * 1.2) < 25), "toxic", 4)  # stained where it meets the goo
        P.flat(g, m & (Y > h - 1.5), "khaki", 5)  # crust
    # a drum lying half sunk in the pool (the oil drum's size: r 7.5, 19 long)
    cx, cz, lo = CX - 7, CZ - 6, CX - 16.5
    d = sunk_disc(g, "x", 1.5, cz, 7.5, lo, lo + 19, "gold", 5)
    hoops = np.zeros(g.shape, dtype=bool)
    for hh in (lo + 4, lo + 13):
        hoops |= sunk_disc(g, "x", 1.5, cz, 8.2, hh, hh + 2, "steel", 6)
    P.flat(g, d & ~hoops, "gold", 5)
    P.flat(g, d & ~hoops & (X > lo + 7) & (X < lo + 12) & (Y > 5), "darkwood", 4)  # a black hazard band
    PP.blotch(g, d, "rust", 5, cell=3, chance=0.06, seed=22)
    P.flat(g, d & (X < lo + 1) & (S.ngon_radius(g, "x", 1.5, cz, 8) < 5.5), "toxic", 6)  # sludge in the open end
    # a crushed drum standing on the rim
    crush = plan(g, S.flat_ngon(CX + 20, CZ - 17, 6.5, 8), 0, 11, "red", 4, top=S.flat_ngon(CX + 21.5, CZ - 16, 5.5, 8))
    P.flat(g, crush & (Y > 10), "red", 3)
    P.flat(g, crush & ((np.abs(Y - 3) < 1) | (np.abs(Y - 8) < 1)), "red", 5)
    P.flat(g, crush & (np.abs(X - (CX + 16)) < 1.2) & (Y < 9) & (Z < CZ - 14), "toxic", 6)  # a leak running down
    # dead reeds in the shallows
    for k, (rx, rz) in enumerate(((CX - 18, CZ + 8), (CX - 16, CZ + 11), (CX - 20, CZ + 12), (CX + 17, CZ - 6), (CX + 19, CZ - 3))):
        top = (rx + (k % 2) * 2 - 1, 11 + (k * 3) % 5, rz + (k % 3) - 1)
        limb(g, (rx + 0.5, 1.0, rz + 0.5), top, 0.7, 0.5, "sand", 4, n=4)
        limb(g, top, (top[0], top[1] + 3, top[2]), 1.0, 0.9, "rust", 4, n=4)
    return g


def bubble(k: int) -> Grid:
    g = Grid(*SZ)
    bx, bz = BUBBLES[k]
    bump(g, bx, bz, SURF, 1.8 + 0.4 * k, 2.2 + 0.4 * k, "toxic", 7, n=6)
    return g


def build():
    rig = Rig("toxic-pool", (CX, 0, CZ), pool())
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
                sockets=[rig.socket("socket-pool", (CX, SURF + 1, CZ))],
                pfx=[fx("rvx-apocalypse-toxic-pool", "socket-pool", "idle", size=60)])
