"""Gel slime in the Pirate Nation creature style.

One big chunky drop of magic-cyan jelly: a chamfered octagon body that
flares into a wet skirt at the foot and rises to a bevelled top with a
leaning curl (all true slopes, no stairs). Painted: a light-to-deep
vertical ramp, a big glossy highlight, a few bubbles and a cheerful face
with huge glinting eyes. A
flat puddle stays on the ground as the root. Clips: idle (squash and
stretch), attack (hops forward), hit (jiggles), death (melts into the
puddle). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _life import asset, chamfer_rect, coords, facet_paint, keys, ngon, pfx, plan, rig
from voxgrid import C, Clip, Grid, Socket

SH = (26, 22, 26)
CX, CZ = 13.0, 13.0
GEL = "cyan"
TOP_Y = 14.0


def gel(g: Grid, m: np.ndarray, frame=None) -> None:
    """The jelly ramp: deep at the foot, light at the top (smooth bands in
    y, no speckle), lit top faces."""
    _X, Y, _Z = coords(g)
    # cyan 4 is the brightest shade that stays clearly cyan (5+ turn pale)
    base = np.where(Y < 2.5, 3, np.where(Y > 10, 5, 4)).astype(np.int64)
    if frame == "top":
        base = np.maximum(base, 5)
    P._paint(g, m, GEL, np.clip(base, 2, 7))


def puddle() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    m = plan(g, ngon(CX, CZ + 0.5, 11.5, 8, 0.2, jitter=[1.0, 0.85, 1.05, 0.9, 1.0, 0.8, 1.05, 0.95]), 0, 1, GEL, 5)
    P.flat(g, m & (np.hypot(X - CX, Z - CZ) > 9.5), GEL, 4)
    P.flat(g, m & (np.hypot(X - CX + 3, Z - CZ + 7) < 1.2), GEL, 7)  # a wet glint
    return g


def body() -> Grid:
    g = Grid(*SH)
    X, Y, Z = coords(g)
    st = len(g.solids)
    skirt = chamfer_rect(CX - 10.5, CZ - 10, CX + 10.5, CZ + 10, 4)
    foot = chamfer_rect(CX - 9, CZ - 8.5, CX + 9, CZ + 8.5, 2.5)
    belly = chamfer_rect(CX - 9.5, CZ - 9, CX + 9.5, CZ + 9, 2.5)
    shoulder = chamfer_rect(CX - 7.5, CZ - 7, CX + 7.5, CZ + 7, 2.5)
    crown = chamfer_rect(CX - 4, CZ - 3.5, CX + 4, CZ + 4, 2)
    m = plan(g, skirt, 0.5, 2, GEL, 5, top=foot)
    m |= plan(g, foot, 2, 6.5, GEL, 5, top=belly)
    m |= plan(g, belly, 6.5, 11, GEL, 5, top=shoulder)
    m |= plan(g, shoulder, 11, TOP_Y, GEL, 5, top=crown)
    # a drip curl on top, leaning back and to the right
    m |= plan(g, ngon(CX + 0.5, CZ + 0.5, 3.0, 6, 0.3), TOP_Y, TOP_Y + 2.5, GEL, 6, top=ngon(CX + 1.8, CZ + 2, 0.9, 6, 0.3))
    facet_paint(g, g.solids[st:], gel)
    # a few big bubbles (2×2) and a wet dark rim at the foot
    for bx, by, bz in ((CX - 7.5, 8, CZ + 3), (CX + 3, 10, CZ + 7.5), (CX - 4, 5, CZ + 8.5)):
        P.flat(g, m & (np.abs(X - bx) < 1.1) & (np.abs(Y - by) < 1.1) & (np.abs(Z - bz) < 1.6), GEL, 6)
    P.flat(g, m & (Y < 1.5), GEL, 4)
    # a big glossy highlight on the upper left front, a lit rim on the curl
    gloss = m & (Z < CZ - 3) & (X < CX - 3) & (Y > 10) & (Y < 13.6) & (X > CX - 7.2)
    P.flat(g, gloss, GEL, 6)
    P.flat(g, gloss & (Y > 11) & (Y < 12.6) & (X < CX - 4), "bone", 7)  # a white specular streak
    P.flat(g, m & (Z < CZ - 5) & (X < CX - 5) & (Y > 7) & (Y < 9.5) & (X > CX - 8.4), GEL, 7)
    # the smug face: huge eyes with glints, a wide grin with one fang
    face = {"k": C("navy", 1), "w": C("bone", 7), "m": C("navy", 2), "p": C("pink", 4)}
    rows = [
        "wwk...wwk",
        "wkk...wkk",
        "kkk...kkk",
        "kkk...kkk",
        ".k.....k.",
        ".........",
        ".mmmmmmm.",
        "..mpppm..",
        "...mmm...",
    ]
    pnglyph.stamp(g, "-z", CZ - 9, int(CX - 4.5), 3, rows, face, depth=3, reach=5)
    return g


def build():
    root, to_root = rig([
        ("slime", puddle(), None, None),
        ("body", body(), (CX, 0.0, CZ), None),
    ])
    idle = {"body": {"scale": keys((0, 1, 1, 1), (0.4, 1.08, 0.88, 1.08), (0.8, 0.95, 1.08, 0.95), (1.2, 1, 1, 1))}}
    attack = {"body": {"scale": keys((0, 1, 1, 1), (0.15, 1.18, 0.72, 1.18), (0.3, 0.88, 1.2, 0.88), (0.55, 1.15, 0.8, 1.15), (0.7, 1, 1, 1)),
                       "loc": keys((0, 0, 0, 0), (0.15, 0, 0, 0), (0.35, 0, 9, -6), (0.55, 0, 0, -10), (0.9, 0, 0, 0))}}
    hit = {"body": {"scale": keys((0, 1, 1, 1), (0.08, 0.85, 1.15, 0.85), (0.16, 1.12, 0.9, 1.12), (0.24, 0.95, 1.05, 0.95), (0.35, 1, 1, 1)),
                    "rot": keys((0, 0, 0, 0), (0.08, 10, 0, 0), (0.2, -5, 0, 0), (0.35, 0, 0, 0))}}
    death = {"body": {"scale": keys((0, 1, 1, 1), (0.2, 0.9, 1.15, 0.9), (0.8, 1.35, 0.1, 1.35), (1.0, 1.3, 0.06, 1.3))},
             "slime": {"scale": keys((0, 1, 1, 1), (0.8, 1.2, 1, 1.2))}}
    top = (CX, TOP_Y + 3, CZ)
    return asset("creatures", "slime", "Gel Slime", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-top", at=to_root(top), parent="body")],
                 fx=[pfx("rvx-fantasy-slime-splat", "socket-top", "clip:death", size=26, at=0.2)])
