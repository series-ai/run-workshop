"""Enchanted anvil in the Pirate Nation style.

A rune-forged anvil on a carved rune stone. The stone is a chamfered
block of grey-blue coursed stone with a dark mortar line, a paved top and
glowing cyan runes cut into its front and sides. On it stands a riveted
steel anvil: a gold-banded foot, a tapered waist with cyan runes, a thick
face with a polished top and a bright edge highlight, a long horn and a
square heel (rule F2: true slopes). A cyan rune circle glows on the face.
Above it the enchanted hammer floats level, held by the magic: a steel
head with gold bands, a cyan rune and a glowing cyan collar, and an oak
handle with a red leather grip (rules K3 and C3). Detail is paint (rule
S1). About 30 long, 30 tall and 16 deep. Faces -Z.
Clips: idle (the hammer bobs and turns a little in the air), active (the
hammer rises, strikes the face and floats back up).
Effects: the metal clang at socket-function when the hammer strikes.
"""
import math

import numpy as np

import paint as P
import pnshapes as S_
from _fanimated import ring
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from _props import glyph
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket, sway

S = (34, 34, 18)
CX, CZ = 16.0, 9.0
STONE = 8  # the rune stone top
FOOT, WAIST, FACE = 10, 15, 20  # the anvil foot, waist top and face top
HY = 24.0  # the underside of the floating hammer head
HX = 15.0  # the hammer head centre x


def anvil() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))

    # the rune stone: a chamfered block of coursed stone with a paved top
    start = len(g.solids)
    st = plan(g, [(7, 1), (25, 1), (27, 3), (27, 15), (25, 17), (7, 17), (5, 15), (5, 3)], 0, STONE, "stone", 4,
              top=[(8, 2), (24, 2), (26, 4), (26, 14), (24, 16), (8, 16), (6, 14), (6, 4)])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(6, 3), cracks=0.06, frame=fr, seed=1))
    P.flat(g, st & (Yi == STONE - 1), "stone", 5)
    P.stone(g, st & (Yi == STONE - 1), "stone", 5, block=(5, 5), frame="top", seed=2)
    P.flat(g, st & S_.seams(g, g.solids[start:], 0.7), "steel", 2)  # the dark arris (rule S4)
    P.flat(g, st & (Yi == 0), "steel", 2)
    # glowing cyan runes cut into the front, the back and the sides
    for face, plane, u0, name in (("-z", 1.0, 10, "rune-a"), ("-z", 1.0, 19, "rune-c"), ("+z", 17.0, 10, "rune-b"),
                                  ("+z", 17.0, 19, "rune-e")):
        glyph(g, face, plane, u0, 2, name, "cyan", 6)
    for face, plane, name in (("-x", 5.0, "rune-d"), ("+x", 27.0, "rune-b")):
        glyph(g, face, plane, 7, 2, name, "cyan", 6)

    # the anvil: a foot, a tapered waist and a thick face (true slopes)
    body = plan(g, [(CX - 7, CZ - 5), (CX + 7, CZ - 5), (CX + 7, CZ + 5), (CX - 7, CZ + 5)], STONE, FOOT, "steel", 4,
                top=[(CX - 6, CZ - 4), (CX + 6, CZ - 4), (CX + 6, CZ + 4), (CX - 6, CZ + 4)])
    foot = body.copy()
    body |= plan(g, [(CX - 6, CZ - 4), (CX + 6, CZ - 4), (CX + 6, CZ + 4), (CX - 6, CZ + 4)], FOOT, WAIST, "steel", 4,
                 top=[(CX - 3.5, CZ - 2.5), (CX + 3.5, CZ - 2.5), (CX + 3.5, CZ + 2.5), (CX - 3.5, CZ + 2.5)])
    waist = body & ~foot
    face = box(g, CX - 7, WAIST, CZ - 3, CX + 9, FACE, CZ + 3, "steel", 4)
    # the horn: a frustum that narrows to a blunt point toward -x
    g.prism("x", [(FACE - 1.5, CZ - 0.7), (FACE, CZ - 0.7), (FACE, CZ + 0.7), (FACE - 1.5, CZ + 0.7)], CX - 15, CX - 7, C("steel", 4),
            top=[(WAIST, CZ - 3), (FACE, CZ - 3), (FACE, CZ + 3), (WAIST, CZ + 3)])
    horn = S_.last(g)
    # the heel: a short square block that steps down at +x
    heel = box(g, CX + 9, WAIST + 1, CZ - 2, CX + 12, FACE, CZ + 2, "steel", 4)
    steel = body | face | horn | heel
    P.plates(g, steel, "steel", 4, size=(5, 4), rivets=True, seed=3)
    P.flat(g, foot, "steel", 3)
    P.flat(g, foot & (Yi == FOOT - 1), "gold", 5)  # a gold band round the foot
    P.flat(g, foot & (Yi == FOOT - 1) & (((Xi + Zi) % 3) == 0), "gold", 3)
    P.flat(g, horn, "steel", 4)
    P.flat(g, horn & (Z < CZ - 1.5), "steel", 3)
    # the polished top and a bright highlight on every top edge
    P.flat(g, (face | horn | heel) & (Yi == FACE - 1), "steel", 6)
    P.flat(g, (face | heel) & edges(face | heel) & (Yi == FACE - 1), "steel", 7)
    P.flat(g, face & (Yi == FACE - 2) & ((Zi == int(CZ) - 3) | (Zi == int(CZ) + 2)), "steel", 5)
    P.flat(g, horn & (Y > FACE - 1) & (np.abs(Z - CZ) > 1.5), "steel", 7)
    P.flat(g, face & edges(face) & (Yi < FACE - 1), "steel", 2)  # the dark lower frame
    P.flat(g, face & (Yi == WAIST), "steel", 2)
    P.flat(g, heel & (Yi == FACE - 1) & (np.abs(X - CX - 10.5) < 0.6) & (np.abs(Z - CZ) < 0.6), "steel", 1)  # the hardy hole
    # a cyan rune circle on the face, under the floating hammer
    rr = np.hypot(X - HX, Z - CZ)
    top = face & (Yi == FACE - 1)
    P.flat(g, top & (np.abs(rr - 2.4) < 0.6), "cyan", 6)
    P.flat(g, top & (rr < 0.9), "cyan", 7)
    # glowing cyan runes on the front and back of the waist
    P.flat(g, waist & (np.abs(Z - CZ) > 2.4) & (np.abs(X - CX) < 1.6) & (Yi >= FOOT + 1) & (Yi <= WAIST - 2), "cyan", 5)
    P.flat(g, waist & (np.abs(Z - CZ) > 2.4) & (np.abs(X - CX) < 0.6) & (Yi >= FOOT + 1) & (Yi <= WAIST - 2), "cyan", 7)
    P.flat(g, waist & (np.abs(X - CX) > 3.4) & (Yi == FOOT + 2), "cyan", 5)
    # a front rune band along the face
    P.flat(g, face & (Zi == int(CZ) - 3) & (Yi == FACE - 3) & ((Xi % 3) != 0) & (X > CX - 5) & (X < CX + 7), "cyan", 6)
    return g


def hammer() -> Grid:
    """The floating hammer: a steel head (its long axis down at the face)
    and a level oak handle toward +x, with a cyan collar and rune."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(v).astype(np.int64) for v in (X, Y, Z))
    head = box(g, HX - 2.5, HY, CZ - 2.5, HX + 2.5, HY + 7, CZ + 2.5, "steel", 4)
    P.plates(g, head, "steel", 4, size=(5, 7), rivets=False, seed=5)
    P.flat(g, head & (Yi == int(HY)), "steel", 6)  # the striking face
    P.flat(g, head & (Yi == int(HY) + 6), "steel", 6)
    P.flat(g, head & edges(head), "steel", 2)
    for by in (int(HY) + 1, int(HY) + 5):
        P.flat(g, head & (Yi == by), "gold", 5)  # the gold bands
    P.flat(g, head & (Zi == int(CZ) - 3) & (np.abs(X - HX) < 1.1) & (Yi >= int(HY) + 2) & (Yi <= int(HY) + 4), "cyan", 6)
    P.flat(g, head & (Zi == int(CZ) + 2) & (np.abs(X - HX) < 1.1) & (Yi >= int(HY) + 2) & (Yi <= int(HY) + 4), "cyan", 6)
    # a glowing cyan collar round the middle of the head: the magic that holds it
    col, _solids = ring(g, "y", HX, CZ, 4.4, 2.4, HY + 2.5, HY + 3.5, "cyan", 6, n=8)
    P.flat(g, col, "cyan", 6)
    P.flat(g, col & (np.hypot(X - HX, Z - CZ) > 3.6), "cyan", 7)
    # the handle: a level oak bar out of the head toward +x, a red grip and a gold pommel
    hd = box(g, HX + 2.5, HY + 2, CZ - 1, HX + 15, HY + 4, CZ + 1, "wood", 5)
    P.planks(g, hd, "wood", 5, width=2, across="y", frame="z", nails=False, seed=6)
    P.flat(g, hd & (Yi == int(HY) + 3), "wood", 6)
    P.flat(g, hd & (X > HX + 9), "red", 4)  # the leather grip
    P.flat(g, hd & (X > HX + 9) & ((Xi % 2) == 0), "red", 3)
    pm = box(g, HX + 15, HY + 1.5, CZ - 1.5, HX + 17, HY + 4.5, CZ + 1.5, "gold", 5)
    P.flat(g, pm, "gold", 5)
    P.flat(g, pm & (Yi == int(HY) + 3), "gold", 6)
    return g


def build():
    a, h = anvil(), hammer()
    pivot = (HX, HY + 3.5, CZ)
    root, to_root = rig([("enchanted-anvil", a, None, None), ("hammer", h, pivot, None)])
    # idle: the hammer bobs in the air and turns a little
    idle = {"hammer": {"loc": sway(2.4, amp=(0.0, 0.8, 0.0)), "rot": sway(2.4, amp=(0.0, 6.0, 2.0), phase=(0.0, 0.0, math.pi / 2))}}
    # active: it rises and tips back, strikes the face at 0.35 s, then floats back up
    drop = HY - FACE  # the gap between the head and the face
    active = {"hammer": {"loc": keys((0.0, 0, 0, 0), (0.2, 0, 4.0, 0), (0.35, 0, -drop, 0), (0.45, 0, -drop + 0.6, 0), (0.8, 0, 0, 0)),
                         "rot": keys((0.0, 0, 0, 0), (0.2, 0, 0, -20.0), (0.35, 0, 0, 0), (0.8, 0, 0, 0))}}
    return asset("animated-props", "enchanted-anvil", "Enchanted Anvil", root,
                 clips=[Clip("idle", idle), Clip("active", active, loop=False)],
                 sockets=[Socket("socket-function", at=to_root((HX, HY, CZ)), parent="hammer")],
                 fx=[pfx("rvx-fantasy-metal-clang", "socket-function", "clip:active", size=14, at=0.35)])
