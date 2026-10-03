"""UFO drone, in the Pirate Nation mecha style.

A small flying saucer, a toy caricature: two faceted frustums (true
slopes) of riveted silver meet at a thick rim ringed with chasing lights
(gold, magenta, teal); a big teal glass dome shows a tiny lime pilot with
huge eyes; a glowing tractor-beam emitter hangs underneath. Clips: idle
(hover, the saucer spins), attack (tilt and zap from the beam socket,
plasma impact PFX), hit (wobble), death (drop and flip). Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, coords, facet_paint, keys, light_top, ngon_y, spin, wave
from pnshapes import ngon_radius, seams

S = (26, 16, 26)
CX, CZ = 13, 13
YR = 5  # rim bottom


def core() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    emitter = ngon_y(g, CX, CZ, 2.5, 0, YR - 1, "steel", 4, r_top=3.5)
    P.flat(g, emitter & (Y < 1), "toxic", 6)
    P.flat(g, emitter & (Y < 2) & (Y >= 1), "toxic", 5)
    dome = ngon_y(g, CX, CZ, 4.5, YR + 3, YR + 8, "cyan", 6, r_top=2.2)
    P.flat(g, dome, "cyan", 6)
    P.flat(g, dome & (Y > YR + 6.5), "cyan", 7)
    # the tiny pilot behind the glass: a lime head with two big eyes
    face = dome & (Z < CZ - 1.5) & (np.abs(X - CX) < 2.2) & (Y > YR + 3.5) & (Y < YR + 6.5)
    P.flat(g, face, "lime", 5)
    for ex in (CX - 1.5, CX + 0.5):
        P.flat(g, face & (X >= ex) & (X < ex + 1) & (Y > YR + 4.5) & (Y < YR + 6), "navy", 2)
    return g


def saucer() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    low = ngon_y(g, CX, CZ, 5, YR - 2, YR, "steel", 6, n=10, r_top=11.5)
    P.flat(g, low, "steel", 6)
    P.flat(g, low & seams(g, [g.solids[-1]], 0.6), "steel", 4)
    rim = ngon_y(g, CX, CZ, 11.5, YR, YR + 2, "steel", 3, n=10)
    top = ngon_y(g, CX, CZ, 11.5, YR + 2, YR + 4, "bone", 6, n=10, r_top=5)
    P.flat(g, top, "bone", 6)
    P.flat(g, top & seams(g, [g.solids[-1]], 0.6), "bone", 4)
    ang = np.arctan2(Z - CZ, X - CX)
    k = np.floor((ang + np.pi) / (2 * np.pi) * 10).astype(int)
    cols = [("gold", 7), ("magenta", 6), ("cyan", 7)]
    for i, (ramp, sh) in enumerate(cols):
        P.flat(g, rim & (k % 3 == i) & (np.abs(((ang + np.pi) / (2 * np.pi) * 10) % 1 - 0.5) < 0.32), ramp, sh)
    d = ngon_radius(g, "y", CX, CZ, 10)
    P.flat(g, top & (d > 8.6), "orange", 6)
    light_top(g, top & (d < 6), "bone", 7)
    return g


def build():
    rig = Rig()
    rig.add("ufo-drone", core(), (CX, 0, CZ))
    rig.add("saucer", saucer(), (CX, YR, CZ), "ufo-drone")
    beam = rig.sock("socket-beam", (CX, 0, CZ), "ufo-drone")
    z = (0.0, 0.0, 0.0)
    idle = {"ufo-drone": {"loc": wave(2.0, "y", 1.2), "rot": wave(2.0, "z", 4, phase=0.7)}, "saucer": {"rot": spin(2.0, "y", 360)}}
    attack = {"ufo-drone": {"rot": keys((0, z), (0.2, (-18, 0, 0)), (0.6, (-18, 0, 0)), (0.9, z)), "loc": keys((0, z), (0.2, (0, 1, 0)), (0.9, z))},
              "saucer": {"rot": spin(0.9, "y", 720)}}
    hit = {"ufo-drone": {"rot": keys((0, z), (0.08, (0, 0, 18)), (0.2, (0, 0, -12)), (0.34, (0, 0, 6)), (0.5, z)), "loc": keys((0, z), (0.08, (1.5, 0, 1.5)), (0.5, z))}}
    death = {"ufo-drone": {"rot": keys((0, z), (0.3, (0, 0, 30)), (0.7, (0, 90, 150)), (1.0, (0, 120, 175))),
                           "loc": keys((0, z), (0.3, (0, 1, 0)), (0.7, (0, -2, 0)), (1.0, (0, 2, 0)))},
             "saucer": {"rot": spin(1.0, "y", 360)}}
    return asset("creatures", "ufo-drone", "UFO Drone", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[beam], pfx=[{"effectId": "rvx-space-ray-zap", "socket": "socket-beam", "trigger": "clip:attack", "size": 16, "aim": [0.0, -1.0, 0.0], "at": 0.36}])
