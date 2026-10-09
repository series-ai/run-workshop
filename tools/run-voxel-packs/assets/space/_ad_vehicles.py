"""Space tug, rebuilt at a size a pilot fits in (Art Director repair).

A short, tall tow ship: a low plated chassis on two landing skids, a tall
cab pod at the bow with a wraparound canopy (22-28 high, so a seated
36-voxel pilot fits), an engine block with two big thrusters at the stern,
two side fuel tanks and two tow claws at the bow. About 60 wide, 52 high
and 88 long. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
from _life import Clip, Grid, Rig, asset, box, coords, edges, facet_paint, light_top, loft, mask_of, plan, side, wave
from pnshapes import cone, disc

Z0 = (0.0, 0.0, 0.0)


def space_tug() -> object:
    S = (66, 58, 92)
    cx = 33
    X, Y, Z = None, None, None

    def body_grid() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # Two landing skids with struts.
        for s in (-1, 1):
            skid = box(g, cx + s * 18 - 3, 0, 14, cx + s * 18 + 3, 3, 80, "steel", 4)
            P.plates(g, skid, "steel", 4, size=(8, 3), seed=1)
            P.flat(g, edges(skid), "steel", 2)
            P.flat(g, skid & (Z < 20), "orange", 5)
            for zc in (24, 66):
                strut = side(g, [(3, zc - 3), (3, zc + 3), (9, zc + 2), (9, zc - 2)], cx + s * 18 - 2, cx + s * 18 + 2, "iron", 4)
                P.flat(g, strut, "iron", 4)
        # A low plated chassis (true slopes on every side).
        chassis = loft(g, cx, [(10, 17, 7, 15), (24, 22, 9, 16), (68, 22, 9, 16), (84, 17, 7, 16)], "bone", 6, k=0.4)
        cm = mask_of(g, chassis)
        facet_paint(g, chassis, lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(10, 8), frame=fr, seed=2))
        P.flat(g, cm & (Y < 11), "steel", 4)
        P.flat(g, cm & (np.abs(Y - 13) < 0.8), "orange", 5)
        P.flat(g, cm & (np.abs(Y - 13) < 0.8) & (np.floor(Z) % 6 < 2), "iron", 4)
        # The tall cab pod with a wraparound canopy.
        cab = loft(g, cx, [(9, 11, 10, 35), (16, 14, 13, 37), (36, 14, 13, 37), (44, 11, 10, 36)], "bone", 6, k=0.42)
        km = mask_of(g, cab)
        facet_paint(g, cab, lambda gg, mm, fr: P.plates(gg, mm, "bone", 6, size=(9, 8), frame=fr, seed=3))
        glass = km & (Y > 26) & (Y < 48) & ((Z < 22) | ((np.abs(X - cx) > 11) & (Z < 32)))
        P.flat(g, glass, "cyan", 6)
        P.flat(g, glass & (Y > 42), "cyan", 7)
        P.flat(g, glass & ((np.abs(X - cx) < 0.7) | (np.abs(Y - 37) < 0.6)), "bone", 4)
        P.flat(g, km & (np.abs(Y - 25.5) < 1.2), "orange", 5)
        P.flat(g, km & (Y > 48), "bone", 7)
        # An antenna and a beacon on the cab roof.
        mast = box(g, cx + 5, 48, 34, cx + 7, 52, 36, "iron", 4)
        P.flat(g, mast, "iron", 4)
        lamp = box(g, cx + 4, 52, 33, cx + 8, 55, 37, "orange", 6)
        P.flat(g, lamp, "orange", 7)
        # The engine block and two big thrusters at the stern.
        eng = box(g, cx - 15, 14, 52, cx + 15, 34, 80, "steel", 5)
        P.plates(g, eng, "steel", 5, size=(8, 6), seed=4)
        P.flat(g, edges(eng), "steel", 3)
        P.plates(g, eng & (Y > 33), "steel", 6, size=(8, 6), frame="top", seed=5)
        P.flat(g, eng & (Y > 33) & (np.abs(X - cx) < 1.5), "orange", 5)
        P.flat(g, eng & (np.abs(Y - 30) < 1) & (np.floor(X) % 4 < 2), "orange", 5)
        for s in (-1, 1):
            noz = disc(g, "z", cx + s * 8, 24, 7, 80, 87, "rust", 5, n=10)
            P.flat(g, noz, "rust", 5)
            P.flat(g, noz & (np.abs(Z - 81) < 1), "rust", 6)
            glow = disc(g, "z", cx + s * 8, 24, 4.5, 86, 89, "cyan", 6, n=10)
            P.flat(g, glow, "cyan", 7)
            # Side fuel tanks along the chassis.
            tank = disc(g, "z", cx + s * 25, 15, 6, 34, 74, "orange", 5, n=8)
            P.flat(g, tank, "orange", 5)
            P.flat(g, tank & ((np.abs(Z - 44) < 1.2) | (np.abs(Z - 64) < 1.2)), "iron", 4)
            P.flat(g, tank & (Y > 19), "orange", 6)
            cone(g, "z", cx + s * 25, 15, 6, 28, 34, "steel", 5, n=8, r_top=3, tip="lo")
            box(g, cx + s * 19 - 1, 12, 46, cx + s * 19 + 1, 17, 62, "iron", 4)
        # The bow clamp emitter and its mount.
        em = box(g, cx - 6, 9, 3, cx + 6, 19, 11, "rust", 5)
        P.flat(g, edges(em), "rust", 3)
        P.flat(g, em & (Z < 4), "lime", 7)
        P.flat(g, em & (Z < 4) & (np.abs(X - cx) < 2) & (np.abs(Y - 14) < 2), "lime", 6)
        for s in (-1, 1):
            hub = disc(g, "y", cx + s * 19, 18, 4, 9, 19, "steel", 5, n=8)
            P.flat(g, hub, "steel", 5)
            P.flat(g, hub & (Y > 17), "orange", 6)
        return g

    def claw(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        pts = [(cx + s * 18, 24), (cx + s * 27, 19), (cx + s * 26, 4), (cx + s * 14, 0.5), (cx + s * 12, 4), (cx + s * 20, 8), (cx + s * 16, 17)]
        if s < 0:
            pts = pts[::-1]
        m = plan(g, pts, 9, 18, "orange", 5)
        P.flat(g, m, "orange", 5)
        light_top(g, m, "orange", 6)
        P.flat(g, m & (Z < 6), "steel", 5)
        P.flat(g, m & (np.abs(Y - 13.5) < 0.6), "iron", 4)
        P.flat(g, edges(m) & (Y > 17), "orange", 4)
        return g

    rig = Rig()
    rig.add("body", body_grid(), (cx, 0, 46))
    for s in (-1, 1):
        rig.add(f"tow-arm-{s}", claw(s), (cx + s * 19, 14, 18), "body")
    clips = [Clip("idle", {"body": {"loc": wave(2.6, "y", 0.6, base=(0, 0.8, 0))}}),
             Clip("move", {"body": {"rot": wave(1.3, "z", 4), "loc": wave(1.3, "y", 0.6, base=(0, 3.0, 0))},
                           "tow-arm-1": {"rot": wave(1.3, "y", 3)}, "tow-arm--1": {"rot": wave(1.3, "y", -3)}}),
             Clip("active", {"tow-arm-1": {"rot": [(0, Z0), (0.3, (0, 22, 0)), (0.65, (0, -10, 0)), (1, Z0)]},
                             "tow-arm--1": {"rot": [(0, Z0), (0.3, (0, -22, 0)), (0.65, (0, 10, 0)), (1, Z0)]}}, loop=False)]
    sockets = [rig.sock("socket-tow", (cx, 14, 2), parent="body"), rig.sock("socket-engine", (cx + 8, 24, 89), parent="body")]
    pfx = [{"effectId": "rvx-space-tractor-beam", "socket": "socket-tow", "trigger": "clip:active", "size": 24, "aim": [0, 0, -1], "at": 0.5},
           {"effectId": "rvx-space-engine-exhaust", "socket": "socket-engine", "trigger": "clip:move", "size": 14, "aim": [0, 0, 1]}]
    return asset("vehicles", "space-tug", "Space Tug", rig.root, clips=clips, sockets=sockets, pfx=pfx)
