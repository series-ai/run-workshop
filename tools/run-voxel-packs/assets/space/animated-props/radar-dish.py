"""Tracking radar, in the Pirate Nation mecha style.

A riveted steel equipment hut with a hazard foot, a door and a vent,
carries a mast and a turning yoke. On the yoke sits an oversized white
dish (a faceted frustum, true slopes) tilted to the sky, with an orange
rim, painted rings that read as a bowl, three struts and a feed horn with
a red tip lamp. The yoke and dish sweep round on `spin` and scan back
and forth on `idle`. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, box, coords, edges, hazard, light_top, ngon_y, plated, spin, wave
from pnshapes import bar, cone, ngon_radius

S = (40, 40, 40)
CX, CZ = 20, 20
YH = 12  # hut roof
YM = 17  # mast top (the yoke turns here)
YD = 26  # dish centre
TILT = 28.0


def hut() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = box(g, CX - 9, 0, CZ - 7, CX + 9, YH, CZ + 7, "steel", 5)
    plated(g, body, "steel", 5, size=(9, 6), seed=1)
    hazard(g, body & (Y < 2.5), period=4, frame="wall")
    roof = box(g, CX - 10, YH, CZ - 8, CX + 10, YH + 2, CZ + 8, "orange", 6)
    P.flat(g, edges(roof), "orange", 4)
    light_top(g, roof, "orange", 7)
    door = box(g, CX + 1, 2, CZ - 8, CX + 7, 10, CZ - 7, "steel", 4)
    P.outline(g, door, "steel", 3, normal="z")
    P.flat(g, door & (np.abs(Y - 6) < 0.6) & (X > CX + 5), "gold", 6)
    vent = body & (Z < CZ - 6.5) & (X > CX - 7) & (X < CX - 1) & (Y > 5) & (Y < 10)
    P.flat(g, vent, "steel", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "steel", 6)
    mast = ngon_y(g, CX, CZ, 2.5, YH + 2, YM, "steel", 4)
    del mast
    return g


def yoke() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    ring = ngon_y(g, CX, CZ, 4, YM, YM + 2, "steel", 3)
    light_top(g, ring, "steel", 5)
    post = box(g, CX - 2, YM + 2, CZ - 1, CX + 2, YD - 1, CZ + 3, "orange", 6)
    P.flat(g, edges(post), "orange", 4)
    return g


def bowl() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    zf = CZ - 5  # the dish face
    m = cone(g, "z", CX, YD, 12, zf, zf + 5, "bone", 6, n=10, r_top=4.5, tip="hi")
    d = ngon_radius(g, "z", CX, YD, 10)
    face = m & (Z < zf + 1)
    P.flat(g, m, "bone", 5)
    P.flat(g, face, "bone", 6)
    for r0, r1, sh in ((2.5, 4.0, 4), (6.5, 8.0, 5)):
        P.flat(g, face & (d > r0) & (d <= r1), "bone", sh)
    P.flat(g, face & (d > 9.6), "orange", 6)
    P.flat(g, m & (Z > zf + 1) & (d > 9.0), "orange", 5)
    hub = box(g, CX - 2, YD - 2, zf + 4, CX + 2, YD + 2, zf + 8, "steel", 4)
    del hub
    # three struts to the feed horn, and the horn with a red tip lamp
    tip_z = zf - 8
    bar(g, "x", (YD + 10.5, zf), (YD + 1, tip_z), 1.6, CX - 0.8, CX + 0.8, "steel", 5)
    for s in (-1, 1):
        bar(g, "y", (CX + s * 10.5, zf), (CX + s * 1, tip_z), 1.6, YD - 0.8, YD + 0.8, "steel", 5)
    horn = box(g, CX - 1.5, YD - 1.5, tip_z - 3, CX + 1.5, YD + 1.5, tip_z + 1, "steel", 5)
    P.flat(g, horn & (Z < tip_z - 2), "red", 6)
    return g


def build():
    rig = Rig()
    rig.add("radar", hut(), (CX, 0, CZ))
    rig.add("dish", yoke(), (CX, YM, CZ), "radar")
    rig.add("bowl", bowl(), (CX, YD, CZ), "dish", rot=(TILT, 0.0, 0.0))
    spin_ = {"dish": {"rot": spin(3.0, "y", 360)}}
    idle = {"dish": {"rot": wave(5.0, "y", 45)}, "bowl": {"rot": wave(5.0, "x", 6, phase=1.0)}}
    return asset("animated-props", "radar-dish", "Tracking Radar", rig.root, clips=[Clip("spin", spin_), Clip("idle", idle)])

