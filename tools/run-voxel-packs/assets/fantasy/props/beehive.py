"""Straw skep beehive in the Pirate Nation style.

One iconic shape (rule K3): a big coiled straw skep, built as four
octagonal frustums that narrow to a knot (true slopes), painted as rows of
rope coil with stitch dashes and a dark arched doorway with a landing
board. It stands on a planked bench on four stout legs. Four thick corner
posts rise from the bench top, clear of the dome, and carry a steep
rust-tiled hip roof with a dark trimmed eave and a stone weight on the
ridge (rules F3, F4). A second small skep, a sealed honey crock with a
gold band and a copper smoker with a red leather bellows stand at the
foot, on a low earth-and-grass pad with chunky clover tufts at every leg.
Bees leave the doorway (PFX). Detail is paint (rule S1). About 32 wide
and 37 tall. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _life import chamfer_rect, plan
from _props import coords, plank_box
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 36, 40, 34
CX, CZ = 18.0, 17.0
PAD = 2  # the earth-and-grass pad the whole prop stands on
BENCH = 11  # the bench top
SKEP = 26  # the skep knot
EAVE = 28  # the roof eave, above the knot
RIDGE = 9  # the roof rise (a tall PN roof, rule F4)


def _mask(g: Grid, start: int) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def skep(g: Grid, cx: float, cz: float, y0: float, h: float, r: float, seed: int = 0, door: bool = True) -> np.ndarray:
    """A coiled straw skep: stacked octagonal frustums painted as rows of
    rope with stitch dashes, a lit crown and a dark arched doorway."""
    X, Y, Z = coords(g)
    ng = lambda rad: S.flat_ngon(cx, cz, rad, 8)  # noqa: E731
    start = len(g.solids)
    g.prism("y", ng(r), y0, y0 + h * 0.30, C("gold", 5), top=ng(r * 0.98))
    g.prism("y", ng(r * 0.98), y0 + h * 0.30, y0 + h * 0.58, C("gold", 5), top=ng(r * 0.82))
    g.prism("y", ng(r * 0.82), y0 + h * 0.58, y0 + h * 0.82, C("gold", 5), top=ng(r * 0.52))
    g.prism("y", ng(r * 0.52), y0 + h * 0.82, y0 + h, C("gold", 5), top=ng(r * 0.16))
    m = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    Yi = np.floor(Y).astype(np.int64)
    coil = (Yi - int(y0)) % 3
    P.flat(g, m & (coil == 0), "gold", 4)  # the dark seam between coils
    P.flat(g, m & (coil == 2), "gold", 6)  # the lit top of each coil
    along = np.floor(X).astype(np.int64) + np.floor(Z).astype(np.int64)
    stitch = m & (coil == 1) & (((along + ((Yi - int(y0)) // 3 + seed) * 2) % 7) == 0)
    P.flat(g, stitch, "gold", 3)  # the rope stitches that hold the coils, in regular runs
    P.flat(g, m & (Y > y0 + h - 2.0), "gold", 7)  # the lit knot
    P.flat(g, m & (Y < y0 + 1.0), "gold", 3)
    if door:
        dz = cz - r
        half = r * 0.42
        door_m = m & (Z < dz + 2.2) & (np.abs(X - cx) < half) & (Y > y0 + 0.5) & (Y < y0 + 1.2 + 2.2 * r * 0.42 - np.abs(X - cx) * 0.9)
        P.flat(g, door_m, "darkwood", 1)
        P.flat(g, door_m & (Y > y0 + 1.2 + 2.0 * r * 0.42 - np.abs(X - cx) * 0.9), "gold", 3)  # the shadowed lintel
        P.flat(g, door_m & (Y < y0 + 1.6) & (np.abs(X - cx) < half - 0.8), "darkwood", 3)  # the worn sill
        board = g.box(int(cx - half - 1.5), int(y0) - 1, int(dz) - 3, int(cx + half + 1.5), int(y0), int(dz) + 1, C("wood", 6))
        bm = (g.a > 0) & (np.abs(Y - y0 + 0.5) < 0.6) & (Z < dz + 1) & (Z > dz - 3.5) & (np.abs(X - cx) < half + 1.6)
        P.flat(g, bm, "wood", 6)
        P.flat(g, bm & (Z < dz - 2.5), "darkwood", 3)  # the dark lip of the landing board
        _ = board
    return m


def pad(g: Grid) -> None:
    """The low earth pad the whole prop stands on: a dark soil rim under a
    grass top, so the hive, the props and the greenery share one base."""
    _X, Y, _Z = coords(g)
    start = len(g.solids)
    plan(g, chamfer_rect(CX - 15, CZ - 13, CX + 15, CZ + 13, 5), 0, PAD, "wood", 3,
         top=chamfer_rect(CX - 14.2, CZ - 12.2, CX + 14.2, CZ + 12.2, 5))
    m = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "wood", 3, block=(6, 2), cracks=0.0, frame=fr, seed=11))
    P.flat(g, m & (Y < 1), "wood", 1)  # the dark soil rim
    P.flat(g, m & (Y >= PAD - 1), "leaf", 3)  # the turf
    P.mottle(g, m & (Y >= PAD - 1), "leaf", 3, cell=4, seed=12)
    P.flat(g, m & (Y >= PAD - 1) & (np.hypot(_X - CX, _Z - CZ) > 12.0), "moss", 5)  # a lit grass lip


def clover(g: Grid, cx: int, cz: int, flower: str, seed: int = 0) -> None:
    """A chunky clover tuft: a 2-wide clump of blades with a flower head,
    standing on the pad (not a single floating stick)."""
    for dx, dz, th in ((0, 0, 4), (1, 0, 3), (0, 1, 3), (1, 1, 2), (-1, 1, 2), (2, 1, 2)):
        shade = 3 + (dx + dz + seed) % 2
        g.box(cx + dx, PAD, cz + dz, cx + dx + 1, PAD + th, cz + dz + 1, C("leaf", shade))
    g.box(cx, PAD + 4, cz, cx + 1, PAD + 5, cz + 1, C(flower, 6))
    g.box(cx + 1, PAD + 3, cz, cx + 2, PAD + 4, cz + 1, C(flower, 5))
    g.box(cx, PAD + 1, cz + 1, cx + 1, PAD + 2, cz + 2, C("forest", 4))


def smoker(g: Grid, sx: float, sz: float) -> None:
    """A copper bee smoker: a banded rust drum with a dark outline, a
    conical lid, a bent spout that looks away from the hive and a red
    leather bellows on dark boards (rules K3, S4)."""
    X, Y, Z = coords(g)
    drum = S.disc(g, "y", sx, sz, 3.2, PAD, PAD + 7, "rust", 7, n=8)
    P.flat(g, drum & (np.abs(Y - PAD - 3.5) < 0.6), "gold", 5)  # one brass band, not a stripe field
    P.flat(g, drum & (X > sx + 1.6), "rust", 6)  # the turned side of the copper
    P.flat(g, drum & (Y < PAD + 1), "darkwood", 2)  # the dark foot
    P.flat(g, drum & (Y > PAD + 6), "darkwood", 2)  # the dark collar under the lid
    start = len(g.solids)
    lid = plan(g, S.flat_ngon(sx, sz, 3.4, 8), PAD + 7, PAD + 11, "rust", 5, top=S.flat_ngon(sx + 0.5, sz - 0.5, 1.2, 8))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "rust", 6 if fr == "top" else 5))
    P.flat(g, lid & (Y < PAD + 8), "darkwood", 2)  # the dark lid rim
    # the bent spout: a short nozzle that looks out, away from the hive
    spout = plan(g, S.flat_ngon(sx - 0.6, sz - 3.8, 1.5, 6), PAD + 10, PAD + 13, "iron", 5, top=S.flat_ngon(sx - 1.4, sz - 5.2, 1.1, 6))
    P.flat(g, spout & (Y > PAD + 12), "iron", 1)  # the sooty mouth
    P.flat(g, spout & (Y < PAD + 11), "iron", 6)
    # the bellows: two dark boards with a red leather pleat between them
    bl = box(g, int(sx) + 2, PAD + 1, int(sz) - 2, int(sx) + 8, PAD + 5, int(sz) + 2, "darkwood", 3)
    P.flat(g, bl & (np.abs(Y - PAD - 3.0) < 1.1), "red", 4)  # the leather fold
    P.flat(g, bl & (np.abs(Y - PAD - 3.0) < 1.1) & ((np.floor(X).astype(np.int64) % 2) == 0), "red", 3)  # its pleats
    P.flat(g, edges(bl), "darkwood", 1)
    P.flat(g, bl & (X > sx + 6.4) & (Y > PAD + 3.4), "gold", 5)  # the brass nose


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    pad(g)
    # the bench: four stout legs, a dark rail and a planked top
    for lx, lz in ((CX - 7.5, CZ - 6.0), (CX + 7.5, CZ - 6.0), (CX - 7.5, CZ + 6.0), (CX + 7.5, CZ + 6.0)):
        lg = box(g, lx - 1.5, PAD - 1, lz - 1.5, lx + 1.5, BENCH - 2, lz + 1.5, "darkwood", 4)
        P.planks(g, lg, "darkwood", 4, width=3, across="x", nails=False, seed=1)
        P.flat(g, lg & (Y < PAD), "darkwood", 2)
    rail = box(g, CX - 9, BENCH - 3, CZ - 8, CX + 9, BENCH - 2, CZ + 8, "darkwood", 3)
    P.flat(g, edges(rail), "darkwood", 2)
    top = plank_box(g, CX - 10, BENCH - 2, CZ - 9, CX + 10, BENCH, CZ + 9, "wood", 6, across="x", width=4, frame=("darkwood", 3), nails=True, seed=2)
    P.planks(g, top & (Y >= BENCH - 1), "wood", 6, width=4, across="x", length=(18, 22), frame="top", nails=False, seed=3)
    # the big skep on the bench
    skep(g, CX, CZ, BENCH, SKEP - BENCH, 8.0, seed=4)
    # four thick corner posts from the bench top to the eave, clear of the
    # dome, each with a dark bracket where it carries the plate (rule F3)
    for px, pz in ((CX - 8.5, CZ - 7.5), (CX + 8.5, CZ - 7.5), (CX - 8.5, CZ + 7.5), (CX + 8.5, CZ + 7.5)):
        po = box(g, px - 1, BENCH, pz - 1, px + 1, EAVE, pz + 1, "darkwood", 4)
        P.planks(g, po, "darkwood", 4, width=2, across="x", nails=False, seed=14)
        P.flat(g, po & (Y < BENCH + 1), "darkwood", 2)  # the foot block on the bench
        P.flat(g, po & (Y > EAVE - 2), "darkwood", 2)  # the head under the plate
    for a0, a1, b, axis in ((CX - 9.5, CX + 9.5, CZ - 8.5, "x"), (CX - 9.5, CX + 9.5, CZ + 8.5, "x"),
                            (CZ - 8.5, CZ + 8.5, CX - 9.5, "z"), (CZ - 8.5, CZ + 8.5, CX + 9.5, "z")):
        pl = box(g, a0, EAVE - 2, b - 1, a1, EAVE, b + 1, "darkwood", 3) if axis == "x" else \
            box(g, b - 1, EAVE - 2, a0, b + 1, EAVE, a1, "darkwood", 3)
        P.flat(g, edges(pl), "darkwood", 1)  # the wall plate the roof sits on
    # a steep rust-tiled hip roof with a dark trimmed eave (rules F2, F4)
    S.hip_roof(g, CX - 12, CZ - 11, CX + 12, CZ + 11, EAVE, RIDGE, ramp="red", base=4, ridge="x", inset=5.0, trim=("darkwood", 2), seed=15)
    # the stone weight that holds the roof down on the ridge (rule F5)
    start = len(g.solids)
    plan(g, S.flat_ngon(CX + 2.5, CZ + 0.5, 2.6, 6), EAVE + RIDGE - 1, EAVE + RIDGE + 2, "stone", 4, top=S.flat_ngon(CX + 3.0, CZ + 0.9, 1.7, 6))
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "stone", 4, block=(4, 3), frame=fr, seed=6))
    P.flat(g, _mask(g, start) & (Y > EAVE + RIDGE + 1), "stone", 6)
    P.flat(g, _mask(g, start) & (Y < EAVE + RIDGE), "stone", 2)
    # a second small skep on the pad, turned a little (rule F5)
    skep(g, CX + 10.5, CZ + 6.5, PAD, 9.0, 4.0, seed=7)
    # a sealed honey crock with a gold band and a cloth cap
    hx, hz = CX - 11.5, CZ - 5.5
    start = len(g.solids)
    g.prism("y", S.flat_ngon(hx, hz, 2.0, 8), PAD, PAD + 2, C("orange", 3), top=S.flat_ngon(hx, hz, 3.0, 8))
    g.prism("y", S.flat_ngon(hx, hz, 3.0, 8), PAD + 2, PAD + 6, C("orange", 3), top=S.flat_ngon(hx, hz, 2.2, 8))
    crock = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "orange", 4 if fr == "top" else 3))
    P.flat(g, crock & (X < hx - 1.4) & (Z < hz - 0.4), "orange", 6)  # a glaze highlight
    P.flat(g, crock & (Y > PAD + 4.6), "orange", 5)
    P.flat(g, crock & (np.abs(Y - PAD - 4.0) < 0.7), "gold", 6)  # the gold band
    cap = box(g, hx - 2.5, PAD + 6, hz - 2.5, hx + 2.5, PAD + 8, hz + 2.5, "bone", 7)
    P.flat(g, cap & (Y > PAD + 7), "bone", 6)
    P.flat(g, cap & (np.abs(Y - PAD - 6.5) < 0.6), "red", 4)  # the tie
    smoker(g, CX - 10.5, CZ + 7.5)
    # chunky clover tufts gathered at the four legs (no loose single sticks)
    for cx_, cz_, flower, seed in ((CX - 11, CZ - 9, "gold", 0), (CX + 9, CZ - 10, "magenta", 1),
                                   (CX - 13, CZ + 2, "bone", 2), (CX + 12, CZ - 2, "gold", 3),
                                   (CX - 4, CZ + 10, "magenta", 4), (CX + 4, CZ + 11, "gold", 5)):
        clover(g, int(cx_), int(cz_), flower, seed)
    door = (CX, BENCH + 2.5, CZ - 9.5)
    return Asset(id="fantasy-props-beehive", pack="fantasy", category="props", name="Beehive", root=Part("beehive", g),
                 sockets=[Socket("socket-bees", at=door)],
                 pfx=[{"effectId": "rvx-fantasy-bee-swarm", "socket": "socket-bees", "trigger": "idle", "size": 14}])
