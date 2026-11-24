"""Forest wisp in the Pirate Nation creature style.

A floating spirit of the woods: a big faceted glowing orb (a gem-cut ball
of three frustums) in warm firefly ember, with a painted face (huge dark eyes with
glints, a small smile, rosy cheeks) and a crown of three big sloped leaves
with a sprout. Two leaf wings stand up and out from its sides and a
flame-like ember tail with a cyan tip curls
down behind it. All true slopes; the glow,
leaf veins and flame bands are painted. The root is an empty pivot on the
ground; the orb floats above it. Clips: idle (bob, look, flap), attack
(draws back, darts at you and flares), hit (knocked back, floats
home), death (spins, rises and shrinks away). Faces -Z.
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
    f = 1 / 30

    def fk(*rows):
        return [(fr * f, tuple(v)) for fr, *v in rows]

    # attack: it draws back and up, squashed and leaning back with the
    # wings cocked (f0-9), a shiver of held charge, then darts at you in 4
    # frames, stretched long (impact f16), flares up big on the hit, recoils
    # and floats back home with a bob; the wings and the tail trail it.
    IMP = 16 * f
    attack = {"core": {"loc": fk((0, 0, 0, 0), (9, 0, 1.5, 4.0), (12, 0, 1.7, 4.4), (14, 0, 1.2, -5.0), (16, 0, 1.8, -11.0), (18, 0, 2.0, -13.5),
                                 (20, 0, 1.8, -12.0), (24, 0, 0.8, -6.0), (30, 0, 0.8, -0.5), (35, 0, 0, 1.5), (40, 0, 0, -0.2), (44, 0, 0, 0)),
                       "scale": fk((0, 1, 1, 1), (9, 1.15, 0.86, 1.1), (12, 1.18, 0.84, 1.12), (14, 0.86, 0.9, 1.35), (16, 1.42, 1.38, 1.2), (18, 1.52, 1.48, 1.3),
                                   (24, 0.94, 1.06, 0.96), (30, 1.03, 0.98, 1.02), (36, 1, 1, 1), (42, 1, 1, 1)),
                       "rot": fk((0, 0, 0, 0), (9, 18, 0, 0), (10.5, 18, 0, 3), (12, 19, 0, -3), (16, -22, 0, 0), (19, -16, 0, 0), (24, 10, 0, 0), (32, -3, 0, 0), (40, 0, 0, 0))},
              "wing-l": {"rot": fk((0, 0, 0, 0), (9, 0, 45, 0), (12, 0, 48, 0), (16, 0, -34, -22), (20, 0, -20, -10), (26, 0, 30, 0), (32, 0, -16, 0), (40, 0, 0, 0))},
              "wing-r": {"rot": fk((0, 0, 0, 0), (9, 0, -45, 0), (12, 0, -48, 0), (16, 0, 34, 22), (20, 0, 20, 10), (26, 0, -30, 0), (32, 0, 16, 0), (40, 0, 0, 0))},
              "tail": {"rot": fk((0, 0, 0, 0), (10, -20, 0, 0), (16, 10, 0, 0), (20, 4, 0, 0), (28, -14, 0, 0), (36, 6, 0, 0), (44, 0, 0, 0))}}
    # hit: knocked back and up, squashed flat by the blow on frame 1, it
    # tumbles back with the wings flung, a dazed dip and a beat, then floats
    # back home with a bob and settles; the tail settles last.
    hit = {"core": {"loc": fk((0, 0, 0, 0), (1, 0, 1.6, 2.6), (4, 0, 3.0, 5.0), (8, 0, 0, 6.0), (12, 0, 0.3, 6.5), (16, 0, 0.6, 3.5), (21, 0, 0, -1.0), (27, 0, 0, 0.2),
                             (31, 0, 0, 0)),
                    "rot": fk((0, 0, 0, 0), (1, 15, 0, 9), (5, 24, 0, 15), (9, 10, 0, 6), (13, 12, 0, 6), (20, -6, 0, -2), (26, 3, 0, 0), (31, 0, 0, 0)),
                    "scale": fk((0, 1, 1, 1), (1, 1.14, 1.08, 0.76), (4, 0.94, 1.04, 1.08), (8, 1.04, 0.97, 0.98), (11, 1, 1, 1), (31, 1, 1, 1))},
           "wing-l": {"rot": fk((0, 0, 0, 0), (2, 0, 0, 35), (6, 0, 0, 44), (10, 0, 0, 16), (14, 0, 30, 0), (19, 0, -20, 0), (24, 0, 14, 0), (30, 0, 0, 0))},
           "wing-r": {"rot": fk((0, 0, 0, 0), (2, 0, 0, -35), (6, 0, 0, -44), (10, 0, 0, -16), (14, 0, -30, 0), (19, 0, 20, 0), (24, 0, -14, 0), (30, 0, 0, 0))},
           "tail": {"rot": fk((0, 0, 0, 0), (3, -24, 0, 0), (8, -10, 0, 6), (15, -18, 0, -2), (23, -4, 0, 0), (36, 0, 0, 0))}}
    # death: a startled swell (f0-4, lifting so the tail stays off the
    # floor), a two-frame hang, then the vanish: it shrinks, rises and spins
    # up, slowly at first and ever FASTER, gone at f16 (one key a frame, so
    # the acceleration is exact)
    G0, G1 = 6, 16

    def vanish(fr):
        if fr <= 4:
            u = 1 - (1 - fr / 4) ** 2  # the swell snaps out
            return 1 + 0.3 * u, 2.6 * u, 20 * u
        if fr <= G0:
            return 1.3, 2.6, 20 + 4 * (fr - 4)
        u = min(1.0, (fr - G0) / (G1 - G0))
        return 1.3 - 1.29 * u ** 2.5, 2.6 + 7.0 * u ** 2, 28 + 400 * u ** 2
    vs = [vanish(fr) for fr in range(G1 + 1)]
    death = {"core": {"scale": [(fr * f, (k, k, k)) for fr, (k, _, _) in enumerate(vs)],
                      "loc": [(fr * f, (0, y, 0)) for fr, (_, y, _) in enumerate(vs)],
                      "rot": [(fr * f, (0, r, 0)) for fr, (_, _, r) in enumerate(vs)]},
             "wing-l": {"rot": keys((0, 0, 0, 0), (4 * f, 0, 0, -40), (G1 * f, 0, 0, -40))},
             "wing-r": {"rot": keys((0, 0, 0, 0), (4 * f, 0, 0, 40), (G1 * f, 0, 0, 40))}}
    # move: it glides forward in 1.2 s, keyed a frame at a time: tipped
    # forward into the travel, it bobs once per loop on a slow swell (rising
    # on the wing beats, sinking between), the leaf wings beat three times
    # (a quick downstroke, a slower recovery), the orb pitching up a little
    # on each beat, and the ember tail streams out behind, rippling a few
    # frames after the bob. Lifted clear of the floor the whole loop.
    MN = 36

    def mv(fr):
        ph = 2 * math.pi * fr / MN
        beat = (fr * 3 / MN + 0.6) % 1.0  # three wing beats a loop (no beat turns on the seam)
        down = beat < 0.35  # the downstroke: fast
        wing = 28.0 * (1 - 2 * (beat / 0.35)) if down else -28.0 + 56.0 * ((beat - 0.35) / 0.65) ** 1.5
        kick = math.sin(math.pi * beat / 0.35) if down else 0.0  # the lift from each downstroke
        y = 2.2 + 1.2 * math.sin(ph) + 0.35 * kick
        return y, -13.0 + 2.5 * math.sin(ph - 0.6) + 2.0 * kick, wing, -22.0 + 8.0 * math.sin(ph - 1.6), 6.0 * math.sin(ph - 1.0)
    mvs = [mv(fr % MN) for fr in range(MN + 1)]
    move = {"core": {"loc": [(fr * f, (0, y, 0)) for fr, (y, _, _, _, _) in enumerate(mvs)],
                     "rot": [(fr * f, (tilt, 0, 1.5 * math.sin(2 * math.pi * fr / MN))) for fr, (_, tilt, _, _, _) in enumerate(mvs)]},
            "wing-l": {"rot": [(fr * f, (0, w, 0)) for fr, (_, _, w, _, _) in enumerate(mvs)]},
            "wing-r": {"rot": [(fr * f, (0, -w, 0)) for fr, (_, _, w, _, _) in enumerate(mvs)]},
            "tail": {"rot": [(fr * f, (tx, ty, 0)) for fr, (_, _, _, tx, ty) in enumerate(mvs)]}}
    return asset("creatures", "forest-wisp", "Forest Wisp", root,
                 clips=[Clip("idle", idle), Clip("move", move, ease=0, floor=False), Clip("attack", attack, loop=False, impact=IMP), Clip("hit", hit, loop=False),
                        Clip("death", death, loop=False, ease=0, floor=False)],
                 sockets=[Socket("socket-core", at=to_root((CX, CY, CZ)), parent="core")],
                 fx=[pfx("rvx-fantasy-fairy-motes", "socket-core", "idle", size=18)])
