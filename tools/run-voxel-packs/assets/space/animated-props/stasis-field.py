"""Stasis field, in the Pirate Nation mecha style.

A hold ring that freezes what it carries: a hazard plinth under a plated
steel console with a sloped teal screen, and two thick copper arms that
lean in (true slopes, F2) to carry the oversized function prop — a big
faceted ring standing on edge, built of eight copper segments with gold
bolts and four cyan emitter pads that look inward (F4). Inside it floats
the specimen: a chunky white hull pod with frost bands and a glowing cyan
core. On `idle` the pod bobs and turns and the ring creeps; on `active`
the ring spins and the pod rises. The field binds at the pod. Faces -Z.
"""
import numpy as np

from _life import C, P, Clip, Grid, Rig, asset, band, box, coords, edges, flat_ngon, front, hazard, keys, last, light_top, mask_of, ngon_y, octo, plan, plate_facets, plated, side, spin, wave

S = (44, 54, 30)
CX, CZ = 22, 15
YB = 4     # plinth top
YC = 16    # console top
YR = 34    # the ring centre
R_OUT, R_IN = 14.0, 10.5


def console() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pl = plan(g, octo(CX, CZ, 18, 11, 5), 0, YB, "iron", 5)
    hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    light_top(g, pl, "steel", 4)
    n0 = len(g.solids)
    body = plan(g, octo(CX, CZ, 15, 9, 4), YB, YC, "steel", 5, top=octo(CX, CZ, 13, 8, 3))
    plate_facets(g, g.solids[n0:], "steel", 5, size=(10, 7), seed=1)
    P.flat(g, edges(body), "steel", 3)
    band(g, body, 1, YB, YB + 2, "iron", 4)
    P.flat(g, body & (np.abs(Y - 11) < 1.1), "orange", 5)
    light_top(g, body, "steel", 6)
    # the sloped screen and two dials on the front
    con = side(g, [(YC - 6, CZ - 11), (YC - 6, CZ - 6), (YC, CZ - 7), (YC, CZ - 11)], CX - 8, CX + 8, "steel", 4)
    P.flat(g, con, "steel", 4)
    P.flat(g, edges(con), "steel", 2)
    scr = con & (Y > YC - 1.6)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & (np.abs(X - CX) < 5), "cyan", 6)
    P.flat(g, scr & (np.abs(X - CX) < 1.5), "cyan", 7)
    for bx, ink in ((CX - 6, "gold"), (CX + 6, "orange")):
        P.flat(g, con & (Z < CZ - 10.4) & (np.abs(X - bx) < 1.5) & (np.abs(Y - (YC - 4)) < 1.5), ink, 6)
    # the two copper arms that lean in to the ring
    for s in (-1, 1):
        x0 = CX + s * 17
        pts = [(x0 - s * 4, YC - 2), (x0 + s * 1, YC - 2), (x0 + s * 5, YR - 7), (x0 + s * 1, YR - 5), (x0 - s * 5, YC + 6)]
        if s < 0:
            pts = pts[::-1]
        arm = front(g, pts, CZ - 4, CZ + 4, "rust", 5)
        plated(g, arm, "rust", 5, size=(6, 5), seed=2 + (s > 0))
        P.flat(g, edges(arm), "rust", 3)
        P.flat(g, arm & (np.floor(Y) % 6 == 1), "rust", 3)
        P.flat(g, arm & (Y < YC + 1), "iron", 4)
        P.flat(g, arm & (Y > YR - 9) & (np.abs(Z - CZ) < 1.4), "cyan", 6)
    return g


def ring() -> Grid:
    """Eight copper segments standing on edge, with gold bolts and four
    cyan emitter pads looking inward."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    n = 8
    outer, inner = flat_ngon(CX, YR, R_OUT, n), flat_ngon(CX, YR, R_IN, n)
    start = len(g.solids)
    for k in range(n):
        g.prism("z", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], CZ - 4, CZ + 4, C("rust", 5))
    m = mask_of(g, g.solids[start:])
    plated(g, m, "rust", 5, size=(6, 4), seed=4)
    P.flat(g, edges(m), "rust", 3)
    rad = np.hypot(X - CX, Y - YR)
    P.flat(g, m & (rad > R_OUT - 1.4), "rust", 6)
    P.flat(g, m & (rad > R_OUT - 1.4) & (np.floor(X + Y) % 5 == 0), "gold", 6)
    # four emitter pads looking in at the specimen
    for ax, ay in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        px, py = CX + ax * (R_IN + 1.0), YR + ay * (R_IN + 1.0)
        pad = m & (np.abs(X - px) < 3.0) & (np.abs(Y - py) < 3.0)
        P.flat(g, pad, "iron", 4)
        P.flat(g, pad & (rad < R_IN + 1.6), "cyan", 6)
        P.flat(g, pad & (rad < R_IN + 0.9), "cyan", 7)
    return g


def pod() -> Grid:
    """The specimen: a chunky white hull pod with frost bands and a core."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    shell = plan(g, octo(CX, CZ, 7, 5, 2), YR - 7, YR + 7, "bone", 6, top=octo(CX, CZ, 5, 4, 2))
    plate_facets(g, g.solids[n0:], "bone", 6, size=(8, 7), seed=5)
    P.flat(g, edges(shell), "bone", 4)
    for yy in (YR - 4, YR + 2):
        P.flat(g, shell & (np.abs(Y - yy) < 1.1), "cyan", 5)
    P.flat(g, shell & (Y > YR + 5.4), "bone", 7)
    # the glowing core, on the front face
    core = shell & (Z < CZ - 4.4) & (np.abs(X - CX) < 3.5) & (np.abs(Y - YR) < 4.5)
    P.flat(g, core, "cyan", 6)
    P.flat(g, core & (np.abs(X - CX) < 1.6) & (np.abs(Y - YR) < 2.4), "cyan", 7)
    P.outline(g, core, "steel", 3, normal="z")
    # a copper collar top and bottom
    for y0, y1 in ((YR - 9, YR - 6), (YR + 6, YR + 9)):
        col = ngon_y(g, CX, CZ, 4, y0, y1, "rust", 5, n=8)
        P.flat(g, col, "rust", 5)
        P.flat(g, edges(col), "rust", 3)
    return g


def build():
    rig = Rig()
    rig.add("stasis", console(), (CX, 0, CZ))
    rig.add("ring", ring(), (CX, YR, CZ), "stasis")
    rig.add("pod", pod(), (CX, YR, CZ), "stasis")
    z = (0.0, 0.0, 0.0)
    idle = {"ring": {"rot": spin(14.0, "z", 360)},
            "pod": {"loc": wave(5.0, "y", 1.2), "rot": wave(5.0, "y", 10.0, phase=0.8)}}
    active = {"ring": {"rot": spin(2.0, "z", 720)},
              "pod": {"loc": keys((0, z), (1.0, (0, 3.5, 0)), (2.0, z)), "rot": spin(2.0, "y", 360)}}
    field = rig.sock("socket-field", (CX, YR, CZ), parent="pod")
    return asset("animated-props", "stasis-field", "Stasis Field", rig.root,
                 clips=[Clip("idle", idle), Clip("active", active)],
                 sockets=[field],
                 pfx=[{"effectId": "rvx-space-shield-dome", "socket": "socket-field", "trigger": "idle", "size": 24}])
