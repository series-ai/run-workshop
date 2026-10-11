"""Tentacle alien, in the Pirate Nation creature style.

A big-brained cephalopod caricature: a huge faceted violet mantle (four
stacked frustums, true slopes) with painted magenta brain folds, one giant
cartoon eye with a toxic iris, magenta gill frills and a gold psionic
crown with teal gems. It stands on six fat teal tentacles that fan out,
taper and curl up at the tips, with pink suckers painted underneath, and
two long grasping arm-tentacles. Clips: idle (sway, ripple), attack (the
arms rise and slam), hit (recoil), death (collapse). Faces -Z.
"""
import math

import numpy as np

import pnglyph
from _life import P, Clip, Grid, Rig, asset, coords, front, gem, keys, light_top, mask_of, ngon_y, quad, wave
from voxgrid import C

S = (52, 48, 52)
CX, CZ = 26, 26
YH = 10  # hub centre height (the legs' root)
YM = 11  # mantle bottom
SKIN, MANTLE = "teal", "purple"


def hub() -> Grid:
    g = Grid(*S)
    m = ngon_y(g, CX, CZ, 7.5, YH - 3, YH + 4, SKIN, 4, r_top=6)
    P.flat(g, m, SKIN, 4)
    return g


def leg() -> Grid:
    """One tentacle along +x from the hub, in the x-y plane."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    segs = [((CX + 3, YH + 1), (CX + 11, 4), 3.4, 2.7, 3.0), ((CX + 11, 4), (CX + 18, 2), 2.7, 1.9, 2.5), ((CX + 18, 2), (CX + 21.5, 6.5), 1.9, 0.9, 1.8)]
    m = np.zeros(g.shape, dtype=bool)
    for p0, p1, r0, r1, t in segs:
        m |= front(g, quad(p0, p1, r0, r1, cap=0.5), CZ - t, CZ + t, SKIN, 5)
    P.flat(g, m, SKIN, 5)
    light_top(g, m, SKIN, 6)
    under = m & (Y < 4.5) & (X > CX + 8)
    P.flat(g, under & (np.floor(X) % 3 == 0), "pink", 5)  # suckers
    P.flat(g, m & (X > CX + 19), SKIN, 6)
    return g


def mantle() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = gem(g, CX, CZ + 1, YM, 10.5, 25, MANTLE, 5, n=8, waist=0.42, cap=0.55)
    m = mask_of(g, solids)
    P.flat(g, m, MANTLE, 5)
    light_top(g, m, MANTLE, 6)
    # brain folds: wavy magenta ridges on the upper half
    upper = m & (Y > YM + 15)
    P.flat(g, upper & (np.abs(X - CX) < 0.6), MANTLE, 3)  # the fissure
    P.flat(g, upper & (np.abs(X - CX) >= 0.6), "magenta", 5)
    P.flat(g, m & (np.abs(Y - (YM + 15.5)) < 0.6), MANTLE, 4)
    P.flat(g, m & (Y < YM + 3), MANTLE, 4)
    # one giant cartoon eye on the front facet
    zf = CZ + 1 - 10.5
    rows = ["...oooo...", ".oowwwwoo.", "owwwwwwwwo", "owwwggggwo", "owwggppggo", "o+wggppggo", "owwwggggwo", "owwwwwwwwo", ".oowwwwoo.", "...oooo..."]
    legend = {"o": C(MANTLE, 2), "w": C("bone", 7), "g": C("toxic", 5), "p": C("navy", 1), "+": C("bone", 6)}
    pnglyph.stamp(g, "-z", zf, CX - 5, YM + 8, rows, legend, reach=3)
    # a small grim mouth under the eye
    P.flat(g, m & (Z < zf + 1.5) & (np.abs(X - CX) < 2.5) & (np.abs(Y - (YM + 5.5)) < 0.6), MANTLE, 2)
    # gill frills on both sides
    frills = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        for k, (y0, dz) in enumerate(((YM + 9, 0), (YM + 13, 1))):
            frills |= front(g, [(CX + s * 9.5, y0), (CX + s * 15, y0 + 3 + k), (CX + s * 13.5, y0 - 1), (CX + s * 15, y0 - 4), (CX + s * 9.5, y0 - 3)], CZ + dz - 1, CZ + dz + 2, "magenta", 5)
    P.flat(g, frills, "magenta", 5)
    P.flat(g, frills & (np.abs(X - CX) > 13.5), "magenta", 6)
    # the psionic crown: a gold band with three spikes and teal gems
    top = YM + 25
    band = ngon_y(g, CX, CZ + 1, 6.5, top - 3, top - 1, "gold", 6, r_top=6.8)
    light_top(g, band, "gold", 7)
    for dx in (-4, 0, 4):
        h = 5 if dx == 0 else 3.5
        front(g, [(CX + dx - 1.6, top - 1), (CX + dx + 1.6, top - 1), (CX + dx, top - 1 + h)], CZ - 6.2, CZ - 4.2, "gold", 6)
        P.flat(g, band & (np.abs(X - (CX + dx)) < 0.9) & (Z < CZ - 4), "cyan", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 8.5
    segs = [((sx, YM + 9), (sx + s * 7, YM + 5), 2.4, 2.0, 2.2), ((sx + s * 7, YM + 5), (sx + s * 9, YM - 5), 2.0, 1.5, 2.0),
            ((sx + s * 9, YM - 5), (sx + s * 6, YM - 8), 1.5, 0.8, 1.6)]
    m = np.zeros(g.shape, dtype=bool)
    for p0, p1, r0, r1, t in segs:
        m |= front(g, quad(p0, p1, r0, r1, cap=0.5), CZ - 4 - t, CZ - 4 + t, SKIN, 5)
    P.flat(g, m, SKIN, 5)
    light_top(g, m, SKIN, 6)
    P.flat(g, m & (Y < YM - 3), "pink", 5)
    return g


def build():
    rig = Rig()
    rig.add("tentacle-alien", hub(), (CX, YH, CZ))
    for k in range(6):
        rig.add(f"leg-{k}", leg(), (CX, YH, CZ), "tentacle-alien", rot=(0.0, 30.0 + 60.0 * k, 0.0))
    rig.add("mantle", mantle(), (CX, YM + 2, CZ), "tentacle-alien")
    rig.add("arm-l", arm(1), (CX + 8.5, YM + 9, CZ - 4), "mantle")
    rig.add("arm-r", arm(-1), (CX - 8.5, YM + 9, CZ - 4), "mantle")
    z = (0.0, 0.0, 0.0)
    idle = {"mantle": {"rot": wave(3.0, "z", 5)}, "arm-l": {"rot": wave(3.0, "z", 8, phase=1.0)}, "arm-r": {"rot": wave(3.0, "z", 8, phase=2.2)}}
    for k in range(6):
        idle[f"leg-{k}"] = {"rot": wave(1.5, "z", 7, phase=k * math.pi / 3)}
    attack = {"arm-l": {"rot": keys((0, z), (0.35, (130, 0, 15)), (0.55, (35, 0, 0)), (1.0, z))},
              "arm-r": {"rot": keys((0, z), (0.35, (130, 0, -15)), (0.55, (35, 0, 0)), (1.0, z))},
              "mantle": {"rot": keys((0, z), (0.35, (12, 0, 0)), (0.55, (-14, 0, 0)), (1.0, z))}}
    hit = {"mantle": {"rot": keys((0, z), (0.1, (16, 0, -8)), (0.45, z))},
           "tentacle-alien": {"loc": keys((0, z), (0.1, (0, 0, 2)), (0.45, z))}}
    death = {"mantle": {"rot": keys((0, z), (0.4, (-15, 0, 10)), (1.0, (-70, 0, 20))), "loc": keys((0, z), (1.0, (0, -8, -4)))},
             "arm-l": {"rot": keys((0, z), (1.0, (-20, 0, 60)))}, "arm-r": {"rot": keys((0, z), (1.0, (-20, 0, -60)))}}
    for k in range(6):
        death[f"leg-{k}"] = {"rot": keys((0, z), (1.0, (0, 0, -12)))}
    return asset("creatures", "tentacle-alien", "Tentacle Alien", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)])
