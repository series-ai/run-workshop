"""Castle tower in the Pirate Nation style.

A fairy-tale round tower: a battered octagonal stone foot, a tall drum
with a lighter string course, a corbelled parapet ring with glowing arched
windows and a steep royal-blue cone roof (true slopes, tile rows down every
facet, gold hips) that leans a little (F5). A wide arched door with a
stone surround, a hanging royal banner with a gold crown and crates and a
barrel at the foot. The red pennant on the spire waves on `idle`. Faces -Z.
"""

import paint as P
import pnshapes as S
from _bld import arch_door, arch_window, cone_roof, drum, flag_grid, idx, pole, round_window, sandstone_painter, shield, wave
from pnkit import barrel, box, crate, face_prism
from voxgrid import C, Asset, Clip, Grid, Part, Socket

W, H, D = 64, 170, 64
CX, CZ = 32, 32
R = 18  # drum flat radius
FOOT, BODY, CORBEL, PARA = 8, 74, 82, 96
ROOF_H = 50
TIP = (2.0, 1.0)  # the cone leans a little (F5)
POLE_TOP = PARA - 2 + ROOF_H + 12


def tower() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    drum(g, CX, CZ, 0, FOOT, R + 4, "sand", 3, r_top=R + 1, painter=sandstone_painter(3, (9, 4), 0.0, seed=1))
    drum(g, CX, CZ, FOOT, BODY, R, "sand", 4, painter=sandstone_painter(seed=2))  # warm sandstone
    drum(g, CX, CZ, 40, 44, R + 1, "stone", 5, block=(10, 4), seed=3)  # string course
    drum(g, CX, CZ, BODY - 2, BODY, R + 1, "stone", 5, block=(10, 2), seed=3)
    # a timber hoarding on dark brackets under the roof (PN wood, rule F3)
    boards = lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="x", length=(40, 41), nails=True, frame=fr, seed=4)  # noqa: E731
    brackets = lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="x", length=(40, 41), nails=False, frame=fr, seed=4)  # noqa: E731
    drum(g, CX, CZ, BODY, CORBEL, R, "darkwood", 4, r_top=R + 4, painter=brackets)
    hoard = drum(g, CX, CZ, CORBEL, PARA, R + 4, "wood", 5, painter=boards)
    P.flat(g, hoard & (S.seams(g, [g.solids[-1]], 1.6) | (Y < CORBEL + 2) | (Y >= PARA - 3)), "darkwood", 3)
    drum(g, CX, CZ, PARA - 2, PARA, R + 5, "darkwood", 3, block=(10, 2), seed=6)  # eave beam
    cone_roof(g, CX, CZ, PARA, R + 8, ROOF_H, "blue", 4, lean=TIP, seed=7)
    pole(g, CX + TIP[0], CZ + TIP[1], PARA + ROOF_H - 4, POLE_TOP)
    P.grime(g, (g.a > 0) & (Y < 14), height=5, seed=8)
    # front: a wide, short arched door (F4), steps, a window and the royal banner
    front = CZ - R
    arch_door(g, "-z", front, CX - 8, CX + 8, FOOT, FOOT + 28, seed=10)
    steps = box(g, CX - 11, 0, front - 10, CX + 11, 3, front - 3, "stone", 5) | box(g, CX - 9, 3, front - 7, CX + 9, FOOT, front - 3, "stone", 5)
    P.stone(g, steps, "stone", 5, block=(6, 3), seed=11)
    for u in (CX - 9, CX + 1):
        round_window(g, "-z", CZ - R - 4, u + 4, 89, 3.5, glass=("gold", 6), frame=("darkwood", 3), spokes=True)
    for face, plane in (("-x", CX - R), ("+x", CX + R)):
        arch_window(g, face, plane, CZ - 4, CZ + 4, 20, 36)
        arch_window(g, face, plane, CZ - 4, CZ + 4, 50, 66)
        round_window(g, face, (CX - R - 4) if face == "-x" else (CX + R + 4), CZ, 89, 3.5, glass=("gold", 6), frame=("darkwood", 3), spokes=True)
    arch_window(g, "+z", CZ + R, CX - 4, CX + 4, 48, 64)
    # the royal banner under the corbel: a hanging cloth with a notched foot
    bz = front - 1
    pts = [(CX - 8, 72), (CX + 8, 72), (CX + 8, 44), (CX, 49), (CX - 8, 44)]
    ban = face_prism(g, "-z", front, pts, 0, 1, C("blue", 4))
    P.mottle(g, ban, "blue", 4, cell=3, seed=9)
    P.outline(g, ban, "gold", 5, normal="z")
    box(g, CX - 10, 71, bz - 2, CX + 10, 73, bz, "darkwood", 3)  # rod
    shield(g, "-z", bz, CX, 53, w=12, h=14, field=("red", 4), charge="crown", depth=1)
    # props at the foot (K1)
    barrel(g, CX + 18, front - 3, 0, 14, 5)
    crate(g, CX - 26, 0, front - 6, 10, seed=12)
    crate(g, CX - 24, 10, front - 4, 7, seed=13)
    return g


def build() -> Asset:
    g = tower()
    px, pz = CX + TIP[0], CZ + TIP[1]
    flag = flag_grid((W, H, D), px + 1, POLE_TOP - 1, pz, 18, 10, "red", 4, charge=None)
    root = Part("castle-tower", g)
    root.add(Part("pennant", flag, pivot=(px, POLE_TOP - 6, pz), at=(px, POLE_TOP - 6, pz)))
    idle = {"pennant": {"rot": wave(2.0, "y", 16)}}
    return Asset(
        id="fantasy-buildings-castle-tower", pack="fantasy", category="buildings", name="Castle Tower", root=root,
        clips=[Clip("idle", idle)], sockets=[Socket("socket-door", at=(CX, FOOT, CZ - R - 6))],
    )
