"""Crystal pylon in the Pirate Nation style.

A tall magic beacon: a stepped sandstone plinth and an octagonal sandstone
shaft with royal blue rune panels (glowing cyan runes, one per side), a
flared cornice with a gold rim, and four big gold prongs (true diagonal
segments) with cyan tips. Over them floats an oversized faceted cyan
crystal (a hexagonal bipyramid: true slopes, light and dark facets, bright
edges), circled by two small shards. On `idle` the crystal turns and bobs
and the shards orbit; on `active` (a frost nova) the crystal spins, rises
and swells while the shards whirl out and back. About 32 wide and 72 tall.
Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnglyph import stamp
from pnshapes import flat_ngon, quad, seams
from voxgrid import C, Clip, Grid, Socket, bob, turn

S = (44, 80, 44)
CX = CZ = 22.0
SHAFT = (8, 24)
R_SHAFT = 8.0
CORNICE = 27
HUB = (CX, 50.0, CZ)  # crystal centre (its widest band)
ORBIT_R = 13.0
RUNES = ["#.#", ".#.", "#.#", "...", "###", "#.#", "###", "...", ".#.", "###", ".#."]


def gem(g: Grid, cx, cz, y0, y1, y2, y3, r, n: int = 6, ramp: str = "cyan", base: int = 5, turn_: float = 0.0):
    """A hexagonal bipyramid gem: a point at y0, widest (flat radius r)
    from y1 to y2 (a slight taper), a point at y3. Facets alternate light
    and dark; the edges are bright. Returns the mask."""
    ring = flat_ngon(cx, cz, r, n, -math.pi / 2 + turn_)
    ring2 = flat_ngon(cx, cz, r * 0.9, n, -math.pi / 2 + turn_)
    start = len(g.solids)
    m = plan(g, [(cx, cz)] * n, y0, y1, ramp, base, top=ring)
    m |= plan(g, ring, y1, y2, ramp, base, top=ring2)
    m |= plan(g, ring2, y2, y3, ramp, base, top=[(cx, cz)] * n)
    solids = g.solids[start:]
    k = [0]

    def painter(gg, mm, fr):
        k[0] += 1
        P.flat(gg, mm, ramp, max(1, min(7, base + (1 if k[0] % 2 else -1))))

    facet_paint(g, solids, painter)
    P.flat(g, m & seams(g, solids, 0.6), ramp, min(7, base + 2))
    return m


def plinth() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    ang = np.arctan2(Z - CZ, X - CX)
    # two stone steps (octagon frustums), big blocks
    for (y0, y1, r0, r1, sh, seed) in ((0, 4, 15.0, 14.0, 3, 1), (4, SHAFT[0], 12.0, 11.0, 3, 2)):
        step = plan(g, flat_ngon(CX, CZ, r0, 8), y0, y1, "sand", sh, top=flat_ngon(CX, CZ, r1, 8))
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr, sh=sh, seed=seed: P.stone(gg, mm, "sand", sh + (1 if fr == "top" else 0), block=(6, 4), frame=fr, seed=seed))
        P.flat(g, step & seams(g, [g.solids[-1]], 0.5) & (Y > y1 - 1), "sand", 5)
        P.flat(g, step & (Y < y0 + 1), "sand", 2)
    # the octagonal sandstone shaft
    shaft = plan(g, flat_ngon(CX, CZ, R_SHAFT, 8), SHAFT[0], SHAFT[1], "sand", 5)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "sand", 4, block=(7, 4), frame=fr, seed=3))
    P.flat(g, shaft & seams(g, [g.solids[-1]], 0.6), "sand", 5)
    # royal blue rune panels on the four main faces with glowing cyan runes
    for face in ("-z", "+z", "-x", "+x"):
        plane = {"-z": CZ - R_SHAFT, "+z": CZ + R_SHAFT, "-x": CX - R_SHAFT, "+x": CX + R_SHAFT}[face]
        if face in ("-z", "+z"):
            panel = shaft & (np.abs(X - CX) < 2.6) & (np.abs(Z - plane) < 1.0)
        else:
            panel = shaft & (np.abs(Z - CZ) < 2.6) & (np.abs(X - plane) < 1.0)
        panel &= (Y > SHAFT[0] + 1.5) & (Y < SHAFT[1] - 1.5)
        P.flat(g, panel, "blue", 3)
        stamp(g, face, plane, int(CX) - 1, SHAFT[0] + 3, RUNES, {"#": C("cyan", 7)})
    # the flared cornice with a gold rim and a gold cap ring
    start = len(g.solids)
    corn = plan(g, flat_ngon(CX, CZ, R_SHAFT, 8), SHAFT[1], CORNICE - 1, "sand", 6, top=flat_ngon(CX, CZ, 10.0, 8))
    corn |= plan(g, flat_ngon(CX, CZ, 10.0, 8), CORNICE - 1, CORNICE, "gold", 5)
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "sand", 6))
    P.flat(g, corn & (Y > CORNICE - 1), "gold", 5)
    P.flat(g, corn & (Y > CORNICE - 1) & ((np.floor((ang + math.pi) / (math.pi / 8)) % 2) == 0), "gold", 6)
    P.flat(g, corn & (Y < SHAFT[1] + 1), "gold", 4)
    # a cyan socket on the cornice top (where the crystal's light falls)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, corn & (Y > CORNICE - 1) & (rr < 5.5), "blue", 4)
    P.flat(g, corn & (Y > CORNICE - 1) & (np.abs(rr - 3.5) < 0.8), "cyan", 6)
    # four gold prongs: two true diagonal segments each, cyan tips
    prongs = np.zeros(S, dtype=bool)
    for s in (-1, 1):
        for axis in ("z", "x"):
            segs = [((CORNICE - 0.5, 6.5), (37.0, 10.5), 1.6, 1.3, 0.0), ((37.0, 10.5), (45.0, 8.8), 1.3, 0.9, 1.4)]
            for (y0, r0), (y1, r1), w0, w1, cap in segs:
                if axis == "z":  # prism plane (x, y)
                    g.prism("z", quad((CX + s * r0, y0), (CX + s * r1, y1), w0, w1, cap=cap), CZ - 1.2, CZ + 1.2, C("gold", 5))
                else:  # prism plane (y, z)
                    g.prism("x", quad((y0, CZ + s * r0), (y1, CZ + s * r1), w0, w1, cap=cap), CX - 1.2, CX + 1.2, C("gold", 5))
                prongs |= g.solids[-1].mask(S)
    P.flat(g, prongs & (Y > 36) & (Y < 38), "gold", 7)
    P.flat(g, prongs & (Y > 42.5), "cyan", 6)
    P.flat(g, prongs & (Y > 44), "cyan", 7)
    return g


def crystal() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    cy = HUB[1]
    m = gem(g, CX, CZ, cy - 13, cy - 3, cy + 4, cy + 21, 7.0, ramp="cyan", base=4)
    # a light frosty tip, a royal blue root and a glint
    P.flat(g, m & (Y > cy + 15), "cyan", 6)
    P.flat(g, m & (Y < cy - 8), "blue", 5)
    P.flat(g, m & (np.abs(X - (CX - 3)) < 1.2) & (np.abs(Y - (cy + 7)) < 2.2) & (Z < CZ - 2), "bone", 7)
    return g


def shard(a: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx, sz = CX + ORBIT_R * math.cos(a), CZ + ORBIT_R * math.sin(a)
    cy = HUB[1] + 2
    m = gem(g, sx, sz, cy - 5, cy - 1, cy + 1, cy + 6, 2.2, ramp="cyan", base=4, turn_=a)
    P.flat(g, m & (Y > cy + 3), "cyan", 6)
    return g


def build():
    root, to_root = rig([
        ("crystal-pylon", plinth(), None, None),
        ("crystal", crystal(), HUB, None),
        ("orbit", None, HUB, None),
        ("shard-a", shard(0.4), HUB, "orbit"),
        ("shard-b", shard(0.4 + math.pi), HUB, "orbit"),
    ])
    idle = {"crystal": {"rot": turn(8.0, "y", 45), "loc": bob(8.0, "y", 1.5)},
            "orbit": {"rot": turn(8.0, "y", -90), "loc": bob(8.0, "y", 1.0, phase=1.5)}}
    active = {"crystal": {"rot": turn(1.2, "y", 600),
                          "loc": keys((0, 0, 0, 0), (0.3, 0, 3.5, 0), (0.9, 0, 3.0, 0), (1.2, 0, 0, 0)),
                          "scale": keys((0, 1, 1, 1), (0.3, 1.18, 1.18, 1.18), (0.45, 1.1, 1.1, 1.1), (1.2, 1, 1, 1))},
              "orbit": {"rot": turn(1.2, "y", -600),
                        "scale": keys((0, 1, 1, 1), (0.3, 1.45, 1, 1.45), (0.9, 1.3, 1, 1.3), (1.2, 1, 1, 1))}}
    return asset("animated-props", "crystal-pylon", "Crystal Pylon", root,
                 clips=[Clip("idle", idle), Clip("active", active, loop=False)],
                 sockets=[Socket("socket-crystal", at=to_root(HUB), parent="crystal")],
                 fx=[pfx("rvx-fantasy-frost-nova", "socket-crystal", "clip:active", size=36)])
