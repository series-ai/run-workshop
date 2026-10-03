"""Castle keep in the Pirate Nation style.

The royal hall of the castle family: a great square sandstone keep on a
battered foot, a timber hoarding under a steep royal-blue hip roof (true
slopes, gold hips), and four round corner turrets with tall leaning cone
roofs. The oversized function prop is the royal crest over the grand
arched gate: a giant blue shield with a gold crown, flanked by red
banners. Arched windows glow on both storeys; steps, barrels and crates
sit at the foot. The red pennants on the two front turrets wave on
`idle`. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import (arch_door, arch_window, cone_roof, drum, flag_grid, icon, icon_size, idx, pole, round_window, sandstone,
                  sandstone_painter, shield, wave)
from pnkit import barrel, box, crate, edges, face_prism
from voxgrid import C, Asset, Clip, Grid, Part

W, H, D = 150, 150, 132
X0, X1, Z0, Z1 = 32, 118, 34, 100  # keep walls; the front is z = Z0
WALL, HOARD = 70, 80
ROOF_H = 40
TR = 12  # turret flat radius
TTOP = 92
TROOF = 36
TURRETS = [(X0, Z0), (X1, Z0), (X0, Z1), (X1, Z1)]
LEANS = [(-1.5, -1.0), (1.5, -1.0), (-1.0, 1.0), (1.0, 1.5)]


def keep() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    g.prism("y", [(X0 - 4, Z0 - 4), (X1 + 4, Z0 - 4), (X1 + 4, Z1 + 4), (X0 - 4, Z1 + 4)], 0, 8, C("sand", 3),
            top=[(X0, Z0), (X1, Z0), (X1, Z1), (X0, Z1)])
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: sandstone(gg, mm, 3, block=(9, 4), honey=0.0, frame=fr, seed=1))
    body = box(g, X0, 8, Z0, X1, WALL, Z1, "sand", 4)
    sandstone(g, body, 4, block=(9, 5), seed=2)
    course = box(g, X0 - 1, 38, Z0 - 1, X1 + 1, 41, Z1 + 1, "stone", 6)
    P.stone(g, course, "stone", 6, block=(12, 3), seed=3)
    # timber hoarding on dark brackets, then the steep hip roof
    for k in range(X0, X1, 6):
        for z, s in ((Z0, -1), (Z1, 1)):
            g.prism("x", [(WALL - 6, z), (WALL, z), (WALL, z + 3 * s)], k, k + 2, C("darkwood", 3))
    hoard = box(g, X0 - 3, WALL, Z0 - 3, X1 + 3, HOARD, Z1 + 3, "wood", 5)
    P.planks(g, hoard, "wood", 5, width=3, across="x", length=(40, 41), seed=4)
    P.flat(g, hoard & ((Y < WALL + 2) | (Y >= HOARD - 2)), "darkwood", 3)
    P.flat(g, hoard & ((X - X0) % 18 < 2), "darkwood", 3)
    S.hip_roof(g, X0 - 7, Z0 - 7, X1 + 7, Z1 + 7, HOARD, ROOF_H, "blue", 4, ridge="x", inset=26, trim=("gold", 4), seed=5)
    ridge = box(g, X0 + 19, HOARD + ROOF_H - 1, (Z0 + Z1) // 2 - 2, X1 - 19, HOARD + ROOF_H + 2, (Z0 + Z1) // 2 + 2, "gold", 4)
    P.flat(g, edges(ridge), "gold", 3)
    # dormers with glowing round windows on the front slope
    for cu in (X0 + 22, X1 - 22):
        dz = Z0 - 1
        g.prism("x", [(HOARD, dz), (HOARD + 16, dz), (HOARD + 16, dz + 16), (HOARD, dz + 16)], cu - 7, cu + 7, C("wood", 5))
        dm = g.solids[-1].mask(g.shape)
        P.planks(g, dm, "wood", 5, width=3, across="x", length=(40, 41), seed=cu)
        P.flat(g, edges(dm), "darkwood", 3)
        g.prism("z", [(cu - 9, HOARD + 16), (cu + 9, HOARD + 16), (cu, HOARD + 25)], dz - 2, dz + 18, C("blue", 4))
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "blue", 4, row=3, width=4, frame=fr, seed=cu))
        round_window(g, "-z", dz, cu, HOARD + 8, 4, glass=("gold", 6), frame=("darkwood", 3))
    # the grand gate, the royal crest over it and banners
    cx = (X0 + X1) // 2
    arch_door(g, "-z", Z0, cx - 13, cx + 13, 8, 42, seed=6)
    steps = box(g, cx - 18, 0, Z0 - 16, cx + 18, 3, Z0 - 4, "sand", 3) | box(g, cx - 16, 3, Z0 - 12, cx + 16, 6, Z0 - 4, "sand", 3) | box(g, cx - 16, 6, Z0 - 8, cx + 16, 8, Z0 - 4, "sand", 3)
    P.stone(g, steps, "sand", 3, block=(7, 3), frame="top", seed=7)
    shield(g, "-z", Z0, cx, 43, w=30, h=33, field=("blue", 4), rim=("gold", 5), charge=None, depth=3)
    iw, ih = icon_size("crown", 3)
    icon(g, "-z", Z0 - 3, cx - iw // 2, 55, "crown", "gold", 6, scale=3)
    for bu in (cx - 29, cx + 29):
        pts = [(bu - 7, 66), (bu + 7, 66), (bu + 7, 34), (bu, 39), (bu - 7, 34)]
        rb = face_prism(g, "-z", Z0, pts, 0, 1, C("red", 4))
        P.mottle(g, rb, "red", 4, cell=3, seed=bu)
        P.outline(g, rb, "gold", 5, normal="z")
        P.flat(g, rb & (np.abs(X + 0.5 - bu) < 1.1) & (Y > 42) & (Y < 62), "gold", 6)
        P.flat(g, rb & (np.abs(Y - 55) < 1.1) & (np.abs(X + 0.5 - bu) < 4.5), "gold", 6)
        box(g, bu - 9, 65, Z0 - 3, bu + 9, 67, Z0, "darkwood", 3)
    for wu in (X0 + 14, X1 - 22):
        arch_window(g, "-z", Z0, wu, wu + 8, 14, 32)
    for face, plane in (("-x", X0), ("+x", X1)):
        for wz in (Z0 + 18, Z1 - 26):
            arch_window(g, face, plane, wz, wz + 8, 14, 32)
            arch_window(g, face, plane, wz, wz + 8, 46, 64)
    for wu in (cx - 20, cx - 4, cx + 12):
        arch_window(g, "+z", Z1, wu, wu + 8, 46, 64)
    # corner turrets
    for (tx, tz), lean in zip(TURRETS, LEANS):
        drum(g, tx, tz, 0, 10, TR + 4, "sand", 3, r_top=TR + 1, painter=sandstone_painter(3, (8, 4), 0.0, seed=tx + tz))
        drum(g, tx, tz, 10, TTOP, TR, "sand", 4, painter=sandstone_painter(seed=tx + tz + 1))
        drum(g, tx, tz, TTOP - 4, TTOP, TR + 2, "darkwood", 3, painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=2, across="y", nails=False, frame=fr))
        cone_roof(g, tx, tz, TTOP, TR + 5, TROOF, "blue", 4, lean=lean, seed=tx + tz + 2)
        face = "-z" if tz == Z0 else "+z"
        round_window(g, face, tz - TR if tz == Z0 else tz + TR, tx, TTOP - 12, 3.5, glass=("gold", 6), frame=("stone", 6))
    # props at the foot (K1)
    barrel(g, X0 + 14, Z0 - 10, 0, 14, 5.5)
    barrel(g, X0 + 25, Z0 - 8, 0, 12, 4.8)
    crate(g, X1 - 24, 0, Z0 - 17, 11, seed=8)
    crate(g, X1 - 22, 11, Z0 - 15, 8, seed=9)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=10)
    return g


def build() -> Asset:
    g = keep()
    root = Part("castle-keep", g)
    idle = {}
    for i, ((tx, tz), lean) in enumerate(zip(TURRETS[:2], LEANS[:2])):
        px, pz = round(tx + lean[0]), round(tz + lean[1])
        top = TTOP + TROOF + 9
        pole(g, px, pz, TTOP + TROOF - 4, top)
        fly = "x" if i == 1 else "-x"
        flag = flag_grid((W, H, D), px + (1 if i == 1 else -1), top - 1, pz, 16, 9, "red", 4, fly=fly)
        name = f"pennant-{i}"
        root.add(Part(name, flag, pivot=(px, top - 5, pz), at=(px, top - 5, pz)))
        idle[name] = {"rot": wave(2.4, "y", 16, phase=i * 1.3)}
    return Asset(id="fantasy-buildings-castle-keep", pack="fantasy", category="buildings", name="Castle Keep", root=root, clips=[Clip("idle", idle)])
