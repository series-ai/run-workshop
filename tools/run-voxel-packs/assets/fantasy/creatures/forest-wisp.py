"""Forest wisp in the Pirate Nation creature style.

A floating spirit of the woods: a big faceted glowing orb (a gem-cut ball
of three frustums) in warm firefly ember, with a painted face (huge dark eyes with
glints, a small smile, rosy cheeks) and a crown of three big sloped leaves
with a sprout. Two leaf wings stand up and out from its sides and a
flame-like ember tail with a cyan tip curls
down behind it. All true slopes; the glow,
leaf veins and flame bands are painted. The root is an empty pivot on the
ground; the orb floats above it. Clips: idle (bob, look, flap), attack
(darts forward and flares), hit (jolts), death (spins, rises and shrinks
away). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _life import asset, chamfer_rect, coords, facet_paint, front, keys, ngon, pfx, plan, rig, side
from voxgrid import C, Clip, Grid, Socket

SH = (26, 26, 28)
CX, CZ = 13.0, 10.0
CY = 11.0  # the orb centre
R = 6.2  # the orb radius
ORB = "ember"  # the warm glowing orb (a firefly spirit)
FLAME = "ember"  # the spirit tail (same warm ramp, fading to deep orange)
TIP = "cyan"  # the only cool accent: the tail tip


def core() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    st = len(g.solids)
    belt = chamfer_rect(CX - R, CZ - R, CX + R, CZ + R, R * 0.4)
    cap = chamfer_rect(CX - R * 0.55, CZ - R * 0.55, CX + R * 0.55, CZ + R * 0.55, R * 0.2)
    orb = plan(g, cap, CY - R, CY - R * 0.35, ORB, 5, top=belt)
    orb |= plan(g, belt, CY - R * 0.35, CY + R * 0.35, ORB, 5)
    orb |= plan(g, belt, CY + R * 0.35, CY + R, ORB, 5, top=cap)
    # a radial glow: white-hot at the upper front, deep at the rim; lit facets
    # saturated ember tones read as glow under the dim world light (pale tints
    # turn khaki): a yellow-orange hot core, orange body, deep orange rim
    hot = np.sqrt((X - CX + 1) ** 2 + (Y - CY - 1.5) ** 2 + (Z - CZ + 3.5) ** 2)
    P.flat(g, orb, ORB, 3)
    P.flat(g, orb & (hot < R * 0.95), ORB, 4)
    P.flat(g, orb & (Y > CY + R - 1), ORB, 4)
    P.flat(g, orb & S.seams(g, g.solids[st:], 0.6) & (Y > CY - R * 0.4) & (hot >= R * 0.95), ORB, 4)  # lit facet edges
    P.flat(g, orb & (hot > R * 1.25), ORB, 2)  # the deep far rim
    P.flat(g, orb & (Y < CY - R + 1.2), ORB, 2)
    # a bright glint high on the upper-left front: the hot centre shows through
    P.flat(g, orb & (Z < CZ - R + 1.2) & (np.abs(X - CX + 3.5) < 1.2) & (np.abs(Y - CY - 3.2) < 1.2), "gold", 7)
    # the face on the front facet (rows read as seen from the front)
    face = {"k": C("navy", 1), "w": C("bone", 7), "m": C("navy", 2), "p": C("pink", 5)}
    rows = [
        "wk...wk",
        "kk...kk",
        "kk...kk",
        ".......",
        "p.mmm.p",
    ]
    pnglyph.stamp(g, "-z", CZ - R, int(CX - 3.5), int(CY - 3), rows, face, depth=2, reach=3)
    # a crown of three big sloped leaves and a sprout
    st = len(g.solids)
    leaves = np.zeros(g.shape, dtype=bool)
    for dx, tip_x, tip_z, zc in ((-2.5, -6.5, 1.5, CZ + 0.5), (2.5, 6.0, 0.5, CZ + 0.5)):
        leaves |= front(g, [(CX + dx * 0.4, CY + R - 0.8), (CX + dx + math.copysign(1.5, dx), CY + R + 2.5), (CX + tip_x, CY + R + 5.5), (CX + dx * 0.6, CY + R + 3.5)], zc - 1, zc + 1, "leaf", 5)
    leaves |= side(g, [(CY + R - 0.8, CZ - 1), (CY + R + 3, CZ - 2.5), (CY + R + 7, CZ + 1), (CY + R + 3.5, CZ + 1.8)], CX - 1.2, CX + 1.2, "leaf", 5)
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.flat(gg, mm, "leaf", 6 if fr == "top" else 5))
    P.flat(g, leaves & (Y < CY + R + 0.8), "leaf", 3)
    P.flat(g, leaves & (np.abs(X - CX) < 0.6) & (Y > CY + R + 5), "leaf", 7)  # a lit vein on the middle leaf
    sprout = plan(g, ngon(CX + 0.5, CZ + 0.5, 0.9, 4, 0.8), CY + R - 1, CY + R + 3.5, "forest", 5)
    P.flat(g, sprout & (Y > CY + R + 2.5), "lime", 6)
    return g


def wing(s: int) -> Grid:
    """A big leaf standing up and out from the side, a vein down its middle."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    bx = CX + s * (R - 1.5)
    pts = [(bx, CY - 1.5), (bx + s * 4.5, CY - 0.5), (bx + s * 6, CY + 3.5), (bx + s * 6.8, CY + 9.5), (bx + s * 3, CY + 6.5), (bx + s * 0.5, CY + 2.5)]
    st = len(g.solids)
    m = front(g, pts, CZ + 1, CZ + 2.6, "leaf", 5)
    facet_paint(g, g.solids[st:], lambda gg, mm, fr: P.flat(gg, mm, "leaf", 6 if fr == "top" else 5))
    # the vein from the base to the tip, side veins, a darker rim and a glowing tip
    along = (Y - (CY - 1)) - (X - bx) * s * 1.1
    P.flat(g, m & (np.abs(along) < 0.8), "lime", 6)
    P.flat(g, m & (np.abs(along - ((X - bx) * s) * 0.6) < 0.6) & ((np.floor((X - bx) * s) % 3) == 1) & ((X - bx) * s > 2), "leaf", 6)
    P.flat(g, m & (Y > CY + 7.8), "gold", 7)
    return g


def tail() -> Grid:
    """A flame-like spirit tail curling down and back (true slopes)."""
    g = Grid(*SH)
    X, Y, Z = coords(g)
    st = len(g.solids)
    # a thick root that thins into a flick curling up at the end
    m = side(g, [(CY + 1.5, CZ + 3), (CY - 2, CZ + 6.5), (CY - 4, CZ + 9.5), (CY - 4.5, CZ + 12), (CY - 7.5, CZ + 9), (CY - 5.5, CZ + 4.5), (CY - 2.5, CZ + 1.5)], CX - 2.2, CX + 2.2, ORB, 5)
    m |= side(g, [(CY - 4.2, CZ + 9.8), (CY - 1, CZ + 14.5), (CY - 3.5, CZ + 12)], CX - 1.2, CX + 1.2, ORB, 5)
    d = np.hypot(Y - CY, Z - CZ)
    P.flat(g, m, FLAME, 5)
    P.flat(g, m & (d > 5.5), FLAME, 4)
    P.flat(g, m & (d > 8), FLAME, 3)
    P.flat(g, m & (d > 10.5), TIP, 6)
    P.flat(g, m & (d > 12.5), TIP, 7)
    return g


def build():
    root, to_root = rig([
        ("wisp", None, None, None),
        ("core", core(), (CX, CY, CZ), None),
        ("wing-l", wing(-1), (CX - R + 1.5, CY, CZ + 1.8), "core"),
        ("wing-r", wing(1), (CX + R - 1.5, CY, CZ + 1.8), "core"),
        ("tail", tail(), (CX, CY - 2, CZ + 3), "core"),
    ])
    bob = [(0.3 * k, (0, 1.5 * math.sin(math.pi * k / 4), 0)) for k in range(9)]
    flap_l = keys((0, 0, 30, 0), (0.15, 0, -20, -10), (0.3, 0, 30, 0))
    flap_r = keys((0, 0, -30, 0), (0.15, 0, 20, 10), (0.3, 0, -30, 0))
    idle = {"core": {"loc": bob, "rot": keys((0, 0, 0, 0), (0.6, 0, 20, 0), (1.2, 0, 0, 0), (1.8, 0, -20, 0), (2.4, 0, 0, 0))},
            "wing-l": {"rot": [(t + 0.3 * k, v) for k in range(8) for t, v in flap_l[:-1]] + [(2.4, flap_l[0][1])]},
            "wing-r": {"rot": [(t + 0.3 * k, v) for k in range(8) for t, v in flap_r[:-1]] + [(2.4, flap_r[0][1])]},
            "tail": {"rot": keys((0, 0, -15, 0), (1.2, 0, 15, 0), (2.4, 0, -15, 0))}}
    attack = {"core": {"loc": keys((0, 0, 0, 0), (0.15, 0, 1, 3), (0.3, 0, -1, -9), (0.6, 0, 0, 0)),
                       "scale": keys((0, 1, 1, 1), (0.3, 1.3, 1.3, 1.3), (0.6, 1, 1, 1)),
                       "rot": keys((0, 0, 0, 0), (0.15, 12, 0, 0), (0.3, -15, 0, 0), (0.6, 0, 0, 0))},
              "wing-l": {"rot": keys((0, 0, 0, 0), (0.15, 0, 40, 0), (0.3, 0, -30, -20), (0.6, 0, 0, 0))},
              "wing-r": {"rot": keys((0, 0, 0, 0), (0.15, 0, -40, 0), (0.3, 0, 30, 20), (0.6, 0, 0, 0))}}
    hit = {"core": {"loc": keys((0, 0, 0, 0), (0.1, 0, 1, 3), (0.4, 0, 0, 0)), "rot": keys((0, 0, 0, 0), (0.1, 25, 0, 15), (0.4, 0, 0, 0))},
           "wing-l": {"rot": keys((0, 0, 0, 0), (0.1, 0, 0, 35), (0.4, 0, 0, 0))},
           "wing-r": {"rot": keys((0, 0, 0, 0), (0.1, 0, 0, -35), (0.4, 0, 0, 0))}}
    spin = [(0.8 * k / 8, (0, 45 * k, 0)) for k in range(9)]
    death = {"core": {"loc": keys((0, 0, 0, 0), (0.8, 0, 6, 0)), "scale": keys((0, 1, 1, 1), (0.2, 1.3, 1.3, 1.3), (0.8, 0.05, 0.05, 0.05)), "rot": spin},
             "wing-l": {"rot": keys((0, 0, 0, 0), (0.4, 0, 0, -40))}, "wing-r": {"rot": keys((0, 0, 0, 0), (0.4, 0, 0, 40))}}
    return asset("creatures", "forest-wisp", "Forest Wisp", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-core", at=to_root((CX, CY, CZ)), parent="core")],
                 fx=[pfx("rvx-fantasy-fairy-motes", "socket-core", "idle", size=18)])
