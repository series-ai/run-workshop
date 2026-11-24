"""Gel slime in the Pirate Nation creature style.

One big chunky drop of magic-cyan jelly: a chamfered octagon body that
flares into a wet skirt at the foot and rises to a bevelled top with a
leaning curl (all true slopes, no stairs). Painted: a light-to-deep
vertical ramp, a big glossy highlight, a few bubbles and a cheerful face
with huge glinting eyes. A
flat puddle part stays on the ground under it. Clips: idle (a bouncy
squash-and-stretch hop), attack (squashes, leaps forward, splats and hops
back), hit (wobbles), death (slaps flat into the puddle). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _life import asset, chamfer_rect, coords, facet_paint, keys, ngon, pfx, plan, rig
from voxgrid import C, Clip, Grid, Socket

from _quad_falls import _soles, per_frame
from _move_gaits import World, turn_loop


def _curve(u: float, kind: str) -> float:
    """lin; snap (fast out, settles into the key); acc (gravity: starts
    slow, arrives at twice the mean speed); melt (starts slower still and
    arrives at three times the mean speed)."""
    if kind == "snap":
        return 1 - (1 - u) ** 2
    if kind == "acc":
        return u * u
    if kind == "melt":
        return u ** 3
    return u


def run(rows, last: int) -> list:
    """Per-frame values 0..last from [(frame, value[, curve into it])]."""
    out = []
    for fr in range(last + 1):
        for a, b in zip(rows, rows[1:]):
            if a[0] <= fr <= b[0]:
                u = _curve((fr - a[0]) / max(1, b[0] - a[0]), b[2] if len(b) > 2 else "lin")
                out.append(np.array(a[1], float) + (np.array(b[1], float) - np.array(a[1], float)) * u)
                break
        else:
            out.append(np.array(rows[-1][1], float))
    return out


def hops(seq: list, arcs) -> list:
    """Add ballistic height arcs: (take-off frame, landing frame, y0, y1,
    peak) — constant gravity, so it leaves and lands at full speed."""
    for f0, f1, _y0, _y1, h in arcs:
        for fr in range(f0, f1 + 1):
            u = (fr - f0) / (f1 - f0)
            seq[fr] = seq[fr] + np.array((0, 4 * h * u * (1 - u), 0))
    return seq

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
        ("slime", None, None, None),
        ("puddle", puddle(), (CX, 0.0, CZ), None),  # its own part, so it can move and spread without shearing the body
        ("body", body(), (CX, 0.0, CZ), None),
    ])
    f = 1 / 30
    # Volume stays about constant: x and z grow when y squashes.
    # idle: a bouncy jiggle-hop on the spot: squash, stretch up off the
    # puddle, a small airborne beat, splat down and wobble back.
    idle = {"body": {"scale": keys((0, 1, 1, 1), (8 * f, 1.16, 0.76, 1.16), (13 * f, 0.86, 1.28, 0.86), (19 * f, 0.96, 1.07, 0.96), (24 * f, 1.2, 0.72, 1.2),
                                   (28 * f, 0.92, 1.12, 0.92), (32 * f, 1.05, 0.93, 1.05), (36 * f, 1, 1, 1)),
                     "loc": keys((0, 0, 0, 0), (8 * f, 0, 0, 0), (13 * f, 0, 1.2, 0), (19 * f, 0, 3.0, 0), (24 * f, 0, 0, 0), (36 * f, 0, 0, 0))}}
    # attack: a quick squash and lean back (f0-3, the anticipation), it
    # shoots up stretched and leaning in, flies forward on a ballistic arc,
    # splats down at full speed (impact f10) flattened wide, rebounds tall,
    # holds a wet beat, then hops home and lands with a small squash.
    attack = per_frame({
        "body": {"scale": run([(0, (1, 1, 1)), (3, (1.32, 0.58, 1.32), "snap"), (5, (0.78, 1.42, 0.78)), (7, (0.9, 1.16, 0.9)),
                               (10, (1.42, 0.52, 1.42), "acc"), (12, (0.84, 1.28, 0.84), "snap"), (15, (1.08, 0.9, 1.08), "snap"),
                               (18, (1, 1, 1), "snap"), (24, (1, 1, 1)), (26, (1.16, 0.8, 1.16), "snap"), (28, (0.88, 1.22, 0.88)),
                               (29, (0.95, 1.08, 0.95)), (31, (1.16, 0.84, 1.16), "acc"), (33, (0.96, 1.05, 0.96), "snap"), (35, (1, 1, 1), "snap")], 36),
                 "loc": hops(run([(0, (0, 0, 0)), (3, (0, 0, 1.0), "snap"), (5, (0, 0, -2.0)), (10, (0, 0, -11.0)), (26, (0, 0, -11.0)),
                                  (28, (0, 0, -9.5)), (31, (0, 0, 0)), (35, (0, 0, 0))], 36), [(5, 10, 0.0, 0.0, 6.0), (28, 31, 0.0, 0.0, 2.6)]),
                 "rot": run([(0, (0, 0, 0)), (3, (4, 0, 0), "snap"), (5, (-14, 0, 0)), (7, (-8, 0, 0)), (10, (2, 0, 0), "acc"), (12, (-4, 0, 0), "snap"),
                             (15, (1, 0, 0), "snap"), (18, (0, 0, 0), "snap"), (26, (-2, 0, 0), "snap"), (28, (9, 0, 0)), (31, (-1, 0, 0), "acc"),
                             (33, (0.5, 0, 0), "snap"), (35, (0, 0, 0), "snap")], 36)},
        # the puddle is drawn up into the jelly as it leaps, slides along
        # under it and spreads again where it lands, so no flat sheet is
        # left behind; only the puddle part is moved and scaled
        "puddle": {"loc": run([(0, (0, 0, 0)), (4, (0, 0, 0)), (9, (0, 0, -11.0)), (28, (0, 0, -11.0)), (30, (0, 0, 0)), (35, (0, 0, 0))], 36),
                   "scale": run([(0, (1, 1, 1)), (3, (1, 1, 1)), (5, (0.001, 0.001, 0.001), "acc"), (9, (0.001, 0.001, 0.001)), (10, (1.3, 1, 1.3)),
                                 (13, (1, 1, 1), "snap"), (26, (1, 1, 1)), (28, (0.001, 0.001, 0.001), "acc"), (30, (0.001, 0.001, 0.001)),
                                 (31, (1.15, 1, 1.15)), (34, (1, 1, 1), "snap"), (35, (1, 1, 1))], 36)}})
    # hit: the blow knocks it back and up in a short arc, stretched tall
    # (up by f4, down by f8), it lands in a wide splat still sliding back,
    # wobbles through a beat and oozes home with a last jiggle
    hit = {"body": {"scale": keys((0, 1, 1, 1), (2 * f, 0.82, 1.24, 0.82), (4 * f, 0.8, 1.28, 0.8), (6 * f, 0.9, 1.12, 0.9), (8 * f, 1.3, 0.68, 1.3),
                                  (11 * f, 0.88, 1.16, 0.88), (14 * f, 1.1, 0.9, 1.1), (18 * f, 0.96, 1.05, 0.96), (23 * f, 1.02, 0.98, 1.02), (28 * f, 1, 1, 1)),
                    "rot": keys((0, 0, 0, 0), (2 * f, 10, 0, -5), (4 * f, 12, 0, -5), (8 * f, -1, 0, 1.0), (11 * f, 3, 0, -1.2), (14 * f, -2, 0, 0.6),
                                (18 * f, 1, 0, 0), (23 * f, -0.5, 0, 0), (28 * f, 0, 0, 0)),
                    "loc": keys((0, 0, 0, 0), (2 * f, 0, 1.4, 1.8), (4 * f, 0, 2.0, 3.0), (6 * f, 0, 1.2, 3.6), (8 * f, 0, 0, 4.0), (11 * f, 0, 0, 4.3),
                                (14 * f, 0, 0, 4.0), (18 * f, 0, 0, 2.4), (23 * f, 0, 0, 0.5), (28 * f, 0, 0, 0))}}
    # death: a stretched gasp (f0-5), then the jelly gives way: it sags
    # slowly at first and the melt SPEEDS UP all the way down, slapping
    # flat at full speed (impact f17); one small slosh, then it lies there
    # spread into the puddle
    DIE = 17 * f
    death = per_frame({
        "body": {"scale": run([(0, (1, 1, 1)), (3, (0.86, 1.22, 0.86), "snap"), (5, (0.82, 1.28, 0.82), "snap"), (17, (1.5, 0.16, 1.5), "melt"),
                               (20, (1.4, 0.26, 1.4), "snap"), (23, (1.5, 0.1, 1.5), "acc"), (26, (1.5, 0.07, 1.5), "snap"), (30, (1.5, 0.07, 1.5))], 30),
                 "rot": run([(0, (0, 0, 0)), (3, (6, 0, 3), "snap"), (5, (8, 0, 4), "snap"), (9, (6, 0, 3)), (17, (0, 0, 0), "melt"), (30, (0, 0, 0))], 30)},
        "puddle": {"scale": run([(0, (1, 1, 1)), (16, (1, 1, 1)), (18, (1.28, 1, 1.28), "snap"), (22, (1.18, 1, 1.18), "snap"), (26, (1.22, 1, 1.22), "snap"),
                                 (30, (1.22, 1, 1.22))], 30)}})
    # move: an oozing hop forward on the spot, 16 frames a hop with no dead
    # frames on the ground: it splats down flat at full speed (f0), the
    # jelly keeps sloshing forward over its foot (leaning in), loads into a
    # deeper squash (f4), springs up stretched tall and tipped forward
    # (take-off f6, 2 frames of push), flies a ballistic arc (peak f11) and
    # lands again; the puddle shrinks in under it in the air and splashes
    # wide on each landing
    MT = 16
    msmp = {
        "body": {"scale": run([(0, (1.34, 0.6, 1.34)), (2, (1.18, 0.8, 1.18), "snap"), (4, (1.28, 0.66, 1.28), "snap"), (6, (0.8, 1.36, 0.8), "acc"),
                               (8, (0.9, 1.16, 0.9), "snap"), (11, (1.0, 1.0, 1.0)), (14, (0.9, 1.14, 0.9)), (MT, (1.34, 0.6, 1.34), "acc")], MT),
                 "loc": hops(run([(0, (0, 0, 0)), (MT, (0, 0, 0))], MT), [(6, MT, 0.0, 0.0, 5.0)]),
                 "rot": run([(0, (-4, 0, 0)), (2, (-9, 0, 0), "snap"), (4, (2, 0, 0), "snap"), (6, (-12, 0, 0), "acc"), (9, (-6, 0, 0), "snap"),
                             (13, (2, 0, 0)), (MT, (-4, 0, 0), "acc")], MT)},
        "puddle": {"scale": run([(0, (1.25, 1, 1.25)), (3, (1.1, 1, 1.1), "snap"), (6, (1, 1, 1)), (8, (0.55, 1, 0.55), "snap"), (14, (0.6, 1, 0.6)),
                                 (MT, (1.25, 1, 1.25), "acc")], MT)}}
    # the lean tips the jelly's rim into the floor and the squash lifts it:
    # set the skirt's lowest point back on the floor every frame (on top of
    # the hop arc), so it neither sinks nor floats while it is down
    world = World(root)
    pts = _soles(world.parts["body"])
    arc = [v.copy() for v in msmp["body"]["loc"]]
    for fr in range(MT + 1):
        msmp["body"]["loc"][fr] = np.zeros(3)
        msmp["body"]["loc"][fr] = arc[fr] + np.array((0.0, -world.low(msmp, fr, "body", pts), 0.0))
    msmp, _ = turn_loop(msmp, MT)
    move = per_frame(msmp)
    top = (CX, TOP_Y + 3, CZ)
    return asset("creatures", "slime", "Gel Slime", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False, ease=0.0), Clip("hit", hit, loop=False), Clip("death", death, loop=False, ease=0.0),
                        Clip("move", move, ease=0.0, floor=False)],
                 sockets=[Socket("socket-top", at=to_root(top), parent="body")],
                 fx=[pfx("rvx-fantasy-slime-splat", "socket-top", "clip:death", size=26, at=DIE)])
