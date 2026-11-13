"""Bubbling cauldron in the Pirate Nation style.

One iconic shape (rule K3): a fat, pot-bellied iron cauldron (faceted
octagon frustums, true slopes) with a gold lip, gold bands and glowing
cyan runes on the belly, standing on three stubby legs over a log fire in
a round red-brick hearth. The brew is a glowing magic-cyan mound; a big
wooden ladle leans in it and three chunky bubbles rise from it. On `idle`
the ladle stirs and the bubbles rise and pop; on `active` the brew heaves
and boils up, the ladle stirs fast and the bubbles jump. About 28 wide and
30 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnglyph import stamp
from pnshapes import flat_ngon, quad, seams
from voxgrid import C, Clip, Grid, Socket

S = (34, 34, 34)
CX = CZ = 17.0
Y_POT = 5  # pot bottom
BELLY = (9, 14)  # the upright belly band
SHOULDER = 17  # top of the pot body
R_BELLY = 10.5
R_NECK = 8.0
BREW = 17.3  # brew surface
BUBBLES = [(-3.5, 1.5), (1.5, -3.5), (3.0, 3.0)]  # (dx, dz) on the brew

# runes (5 tall), one per side of the belly, read from outside; the front one is a healing star
RUNES = {
    "-z": ["..#..", ".###.", "#####", ".###.", "..#.."],
    "+x": [".#.", "#.#", "#.#", "#.#", ".#."],
    "+z": ["###", "#..", "##.", "#..", "#.."],
    "-x": ["#..", "#..", "###", "..#", "###"],
}


def ring_segments(g: Grid, ro: float, ri: float, y0: float, y1: float, ramp: str, shade: int, n: int = 8):
    """A thick octagon ring (flat sides to the axes) of n trapezoid prisms
    between flat radii ri and ro. Returns (mask, solids)."""
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    co, ci = ro / math.cos(math.pi / n), ri / math.cos(math.pi / n)
    for k in range(n):
        a0 = -math.pi / 2 + math.pi / n + 2 * math.pi * k / n
        a1 = a0 + 2 * math.pi / n
        pts = [(CX + co * math.cos(a0), CZ + co * math.sin(a0)), (CX + co * math.cos(a1), CZ + co * math.sin(a1)),
               (CX + ci * math.cos(a1), CZ + ci * math.sin(a1)), (CX + ci * math.cos(a0), CZ + ci * math.sin(a0))]
        m |= plan(g, pts, y0, y1, ramp, shade)
    return m, g.solids[start:]


def pot() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    rr = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)
    # a round red-brick hearth with a glowing ember bed
    hearth, hs = ring_segments(g, 14.0, 9.0, 0, 3, "red", 4)
    facet_paint(g, hs, lambda gg, mm, fr: P.stone(gg, mm, "red", 5 if fr == "top" else 4, block=(4, 2) if fr != "top" else (5, 3), frame=fr, seed=1))
    P.flat(g, hearth & (Y < 1), "red", 3)
    P.flat(g, hearth & seams(g, hs, 0.5) & (Y > 2), "red", 6)
    bed = plan(g, flat_ngon(CX, CZ, 9.2, 8), 0, 1.5, "ember", 3)
    P.flat(g, bed & (rr < 6), "ember", 5)
    # two crossed logs with light cut ends
    logs = np.zeros(S, dtype=bool)
    g.prism("x", flat_ngon(2.9, CZ - 1.5, 1.4, 6, math.pi), CX - 10, CX + 10, C("wood", 4))
    logs |= g.solids[-1].mask(S)
    g.prism("z", flat_ngon(CX + 1.5, 3.9, 1.4, 6, -math.pi / 2), CZ - 10, CZ + 10, C("darkwood", 5))
    logs |= g.solids[-1].mask(S)
    P.flat(g, logs & ((np.abs(X - CX) > 9) | (np.abs(Z - CZ) > 9)), "wood", 7)
    # stubby legs
    for k in range(3):
        a = math.pi / 2 + 2 * math.pi * k / 3
        lx, lz = CX + 5.5 * math.cos(a), CZ + 5.5 * math.sin(a)
        plan(g, flat_ngon(lx, lz, 1.8, 4, 0), 1.5, Y_POT + 1, "steel", 2, top=flat_ngon(lx, lz, 1.3, 4, 0))
    # chunky flame tongues licking the belly: red foot, orange body, gold tip
    flames = np.zeros(S, dtype=bool)
    for a, h, r in ((-1.2, 9.0, 2.6), (-1.95, 7.5, 2.2), (-0.35, 7.5, 2.2), (0.9, 6.5, 2.0), (2.2, 7.0, 2.0), (3.0, 6.0, 2.0)):
        bx, bz = CX + 8.0 * math.cos(a), CZ + 8.0 * math.sin(a)
        tx, tz = CX + 10.0 * math.cos(a), CZ + 10.0 * math.sin(a)
        plan(g, flat_ngon(bx, bz, r, 4, a), 1.5, 1.5 + h, "orange", 5, top=flat_ngon(tx, tz, 0.5, 4, a))
        flames |= g.solids[-1].mask(S)
    P.flat(g, flames & (Y > 4.5), "orange", 6)
    P.flat(g, flames & (Y > 7.0), "gold", 6)
    P.flat(g, flames & (Y < 3.0), "red", 5)
    # the pot: a narrow foot, a fat upright belly and an inward shoulder
    start = len(g.solids)
    body = plan(g, flat_ngon(CX, CZ, 6.5, 8), Y_POT, BELLY[0], "steel", 3, top=flat_ngon(CX, CZ, R_BELLY, 8))
    body |= plan(g, flat_ngon(CX, CZ, R_BELLY, 8), BELLY[0], BELLY[1], "steel", 3)
    body |= plan(g, flat_ngon(CX, CZ, R_BELLY, 8), BELLY[1], SHOULDER, "steel", 3, top=flat_ngon(CX, CZ, R_NECK, 8))
    solids = g.solids[start:]
    k = [0]

    def metal(gg, mm, fr):
        # soft facet shading: alternate facets a half-step apart (cells, no rivet noise)
        k[0] += 1
        P.mottle(gg, mm, "steel", 3, cell=3, seed=5 + k[0])

    facet_paint(g, solids, metal)
    P.flat(g, body & seams(g, solids, 0.6), "steel", 4)
    P.flat(g, body & (Y < Y_POT + 1), "steel", 2)
    # gold bands on the foot and the shoulder, cyan runes glowing on the belly
    P.flat(g, body & (np.abs(Y - (BELLY[0] - 0.5)) < 0.6), "gold", 5)
    P.flat(g, body & (np.abs(Y - (BELLY[1] + 0.5)) < 0.6), "gold", 5)
    P.flat(g, body & (np.abs(Y - (BELLY[1] + 0.5)) < 0.6) & ((np.floor((ang + math.pi) / (math.pi / 8)) % 2) == 0), "gold", 6)
    rune = {"#": C("cyan", 7)}
    for face, rows in RUNES.items():
        plane = {"-z": CZ - R_BELLY, "+z": CZ + R_BELLY, "-x": CX - R_BELLY, "+x": CX + R_BELLY}[face]
        w = len(rows[0])
        u0 = int(CX) - w // 2 if face in ("-z", "+z") else int(CZ) - w // 2
        glyph = stamp(g, face, plane, u0, BELLY[0], rows, rune, depth=2)  # the face sits on a half voxel
        # a soft cyan halo cell around each rune
        halo = body & (np.abs(Y - (BELLY[0] + 2.5)) < 2.6)
        if face in ("-z", "+z"):
            halo &= (np.abs(X - (u0 + w / 2)) < w / 2 + 1.1) & (np.abs(Z - plane) < 1.2)
        else:
            halo &= (np.abs(Z - (u0 + w / 2)) < w / 2 + 1.1) & (np.abs(X - plane) < 1.2)
        P.flat(g, halo & ~glyph, "sky", 4)
    # the thick gold lip ring
    lip, ls = ring_segments(g, R_NECK + 1.6, R_NECK - 1.0, SHOULDER - 1, SHOULDER + 1.5, "gold", 5)
    facet_paint(g, ls, lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    P.flat(g, lip & (Y < SHOULDER - 0.2), "gold", 4)
    P.flat(g, lip & seams(g, ls, 0.5) & (Y > SHOULDER + 0.5), "gold", 7)
    # gold lugs on both sides of the belly, each with a dark ring hole
    for s in (-1, 1):
        x0, x1 = (CX + R_BELLY, CX + R_BELLY + 2) if s > 0 else (CX - R_BELLY - 2, CX - R_BELLY)
        g.box(x0, BELLY[1] - 4, CZ - 2, x1, BELLY[1], CZ + 2, C("gold", 5))
        lug = P.region(g, x0, BELLY[1] - 4, CZ - 2, x1, BELLY[1], CZ + 2)
        P.flat(g, lug & (Y > BELLY[1] - 1), "gold", 7)
        P.flat(g, lug & (np.abs(Y - (BELLY[1] - 2)) < 0.6) & (np.abs(Z - CZ) < 0.6), "darkwood", 2)
    return g


def brew() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = plan(g, flat_ngon(CX, CZ, 8.2, 8), SHOULDER - 2, BREW, "cyan", 5)
    m |= plan(g, flat_ngon(CX, CZ, 7.0, 8), BREW, BREW + 1.2, "cyan", 5, top=flat_ngon(CX, CZ, 4.5, 8))
    rr = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)
    swirl = np.floor((ang + rr * 0.35) / (math.pi / 3)).astype(int) % 2
    P._paint(g, m, "cyan", 5 + swirl)
    P.flat(g, m & (rr < 3.0), "cyan", 7)
    P.flat(g, m & (rr > 7.0), "plasma", 4)
    return g


def bubble(dx: float, dz: float, r: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    bx, bz, by = CX + dx, CZ + dz, BREW + 0.6
    m = plan(g, [(bx, bz)] * 6, by - r, by, "cyan", 6, top=flat_ngon(bx, bz, r, 6))
    m |= plan(g, flat_ngon(bx, bz, r, 6), by, by + r * 0.8, "cyan", 6)
    m |= plan(g, flat_ngon(bx, bz, r, 6), by + r * 0.8, by + r * 1.6, "cyan", 6, top=[(bx, bz)] * 6)
    P.flat(g, m & (Y > by + r * 0.8), "cyan", 7)
    P.flat(g, m & (Y > by + r * 0.8) & (X < bx) & (Z < bz), "bone", 7)
    return g


def ladle() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the bowl (hidden in the brew) and a thick handle leaning out over the lip
    g.box(CX + 1, BREW - 2, CZ - 2, CX + 5, BREW, CZ + 2, C("wood", 4))
    handle = quad((CX + 3.0, BREW - 1), (CX + 9.0, BREW + 12), 1.3, 1.1)
    g.prism("z", handle, CZ - 1.2, CZ + 1.2, C("wood", 5))
    m = g.solids[-1].mask(S)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=2, across="x", nails=False, frame=fr, seed=8))
    P.flat(g, m & (Y > BREW + 9.5), "darkwood", 5)
    P.flat(g, m & (Y > BREW + 9.5) & (Y < BREW + 10.5), "gold", 6)
    P.flat(g, m & (Y < BREW + 2.5), "cyan", 5)
    return g


def build():
    pivot = (CX, BREW, CZ)
    parts = [("cauldron", pot(), None, None), ("brew", brew(), pivot, None), ("ladle", ladle(), pivot, None)]
    for i, (dx, dz) in enumerate(BUBBLES):
        parts.append((f"bubble-{i}", bubble(dx, dz, 1.8 - 0.3 * (i % 2)), (CX + dx, BREW + 0.6, CZ + dz), None))
    root, to_root = rig(parts)
    idle = {"ladle": {"rot": [(t * 0.5, (0.0, -45.0 * t, 0.0)) for t in range(9)]},
            "brew": {"scale": keys((0, 1, 1, 1), (1.0, 1, 1.12, 1), (2.0, 1, 1, 1), (3.0, 1, 1.1, 1), (4.0, 1, 1, 1))}}
    for i in range(3):
        o = i * 1.2
        idle[f"bubble-{i}"] = {
            "loc": keys((0, 0, -1.5, 0), (o, 0, -1.5, 0), (o + 1.0, 0, 4.5, 0), (o + 1.05, 0, -1.5, 0), (4.0, 0, -1.5, 0)),
            "scale": keys((0, 1, 1, 1), (o, 1, 1, 1), (o + 0.9, 1.4, 1.4, 1.4), (o + 1.0, 1.6, 0.6, 1.6), (o + 1.05, 0.2, 0.2, 0.2), (o + 1.4, 1, 1, 1), (4.0, 1, 1, 1)),
        }
    active = {"ladle": {"rot": [(t * 0.25, (0.0, -90.0 * t, 0.0)) for t in range(9)]},
              "brew": {"scale": keys((0, 1, 1, 1), (0.25, 1.06, 1.6, 1.06), (0.5, 1, 1.1, 1), (0.75, 1.06, 1.7, 1.06), (1.0, 1, 1.1, 1), (1.25, 1.06, 1.6, 1.06), (1.5, 1, 1.1, 1), (2.0, 1, 1, 1))}}
    for i in range(3):
        t = 0.3 + i * 0.2
        active[f"bubble-{i}"] = {"loc": keys((0, 0, 0, 0), (t, 0, 8, 0), (t + 0.05, 0, -1, 0), (t + 0.8, 0, 7, 0), (t + 0.85, 0, -1, 0), (2.0, 0, 0, 0)),
                                 "scale": keys((0, 1, 1, 1), (t, 1.8, 1.8, 1.8), (t + 0.05, 0.4, 0.4, 0.4), (t + 0.8, 1.6, 1.6, 1.6), (t + 0.85, 0.4, 0.4, 0.4), (2.0, 1, 1, 1))}
    return asset("animated-props", "bubbling-cauldron", "Bubbling Cauldron", root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[Socket("socket-brew", at=to_root((CX, BREW + 2, CZ)), parent="brew")],
                 fx=[pfx("rvx-fantasy-cauldron-brew", "socket-brew", "idle", size=22)])
