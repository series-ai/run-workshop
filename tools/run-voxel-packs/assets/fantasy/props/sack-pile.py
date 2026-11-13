"""Grain sacks on a pallet in the Pirate Nation style.

Three plump burlap sacks lie stacked on a planked pallet (two below, one
on top across the groove). Each is a soft pillow: a chamfered body that
rounds off at the closed end and gathers at the other end into a red cord
tie with a flared, floppy tuft of cloth (true slopes). A fourth sack
stands open beside the pallet, its rim rolled down over a heap of golden
grain; a scoop leans in a spilled grain heap at the back. Stencilled wheat
marks and weave rows are paint (rule S1). About 36 wide and 20 tall.
"""

import numpy as np

import paint as P
from _life import chamfer_rect, facet_paint
from _props import coords, glyph, glyph_size, plank_box
from pnglyph import stamp
from pnkit import box
from pnshapes import last
from voxgrid import C, Asset, Grid, Part

W, H, D = 37, 21, 27
CORD = ("red", 4)
MARK = ["#.#.#", ".###.", "..#..", "..#.."]  # a small stencilled wheat sheaf


def cloth(g: Grid, mask: np.ndarray, ramp: str, base: int, frame=None, seed: int = 0) -> None:
    """Burlap in big soft strokes: long weave dashes one shade darker every
    fourth row, lit faces that look up (no maze of short marks, rule S3)."""
    U, V = P.uv(g, frame)
    dash = (V % 4 == 0) & (P._hash(U // 5, V, seed=seed) % np.uint64(3) == 0)
    shade = np.where(dash, base - 1, base)
    if frame == "top" or (isinstance(frame, tuple) and frame[1][1] > -0.5):
        shade = shade + 1
    P._paint(g, mask, ramp, np.clip(shade, 1, 7))


def sec(yb: float, cz: float, w: float, h: float, lift: float = 0.0):
    """A chamfered pillow section in (y, z): w across z, h tall from yb + lift."""
    y0 = yb + lift
    return chamfer_rect(y0, cz - w / 2, y0 + h, cz + w / 2, min(w, h) * 0.27)


def lying_sack(g: Grid, x0: float, x1: float, yb: float, cz: float, w: float, h: float, tie: int = 1, ramp: str = "sand", base: int = 5, seed: int = 0) -> np.ndarray:
    """A sack lying along x on y = yb: a closed rounded end, a plump body and,
    at the `tie` end (+1: +x, -1: -x), a gathered neck, a cord and a flared tuft."""
    start = len(g.solids)
    nw, nh = w * 0.3, h * 0.36
    nlift = (h - nh) * 0.55  # the neck sits a little above the middle
    closed = (sec(yb, cz, w * 0.8, h * 0.84), sec(yb, cz, w, h))
    neck = (sec(yb, cz, w, h), sec(yb, cz, nw, nh, nlift))
    if tie < 0:
        xa, xb, xc, xd = x1, x1 - 2.5, x0 + 2.8, x0
    else:
        xa, xb, xc, xd = x0, x0 + 2.5, x1 - 2.8, x1
    lo, hi = sorted((xa, xb))
    g.prism("x", closed[0] if xa < xb else closed[1], lo, hi, C(ramp, base), top=closed[1] if xa < xb else closed[0])
    lo, hi = sorted((xb, xc))
    g.prism("x", sec(yb, cz, w, h), lo, hi, C(ramp, base))
    lo, hi = sorted((xc, xd))
    g.prism("x", neck[0] if xc < xd else neck[1], lo, hi, C(ramp, base), top=neck[1] if xc < xd else neck[0])
    body = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: cloth(gg, mm, ramp, base, frame=fr, seed=seed))
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < yb + 1), ramp, base - 1)  # the soft shadow where it rests
    xm = (x0 + x1) / 2
    P.flat(g, body & (np.abs(X - xm - tie * 2) < 0.6) & (Y > yb + h - 1.5), ramp, base - 1)  # a crease over the top
    # the cord and the flared tuft of gathered cloth
    t0 = xd
    t1 = xd + tie * 1.6
    lo, hi = sorted((t0, t1))
    g.prism("x", sec(yb, cz, nw + 0.8, nh + 0.8, nlift - 0.4), lo, hi, C(*CORD))
    cord = last(g)
    e1 = t1 + tie * 3.4
    lo, hi = sorted((t1, e1))
    small, big = sec(yb, cz, nw * 0.8, nh * 0.8, nlift + nh * 0.1), sec(yb, cz, w * 0.78, h * 0.8, nlift - h * 0.05)
    g.prism("x", small if tie > 0 else big, lo, hi, C(ramp, base + 1), top=big if tie > 0 else small)
    tuft = last(g)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: cloth(gg, mm, ramp, base + 1, frame=fr, seed=seed + 1))
    P.flat(g, tuft & (np.abs(X - e1) < 0.9), ramp, base - 1)  # the frayed mouth edge
    P.flat(g, cord & (Y > yb + nlift + nh), CORD[0], CORD[1] + 1)
    return body | cord | tuft


def open_sack(g: Grid, cx: float, cz: float, w: float, d: float, h: float, ramp: str = "wood", base: int = 6, seed: int = 0) -> np.ndarray:
    """A sack standing open and slumped: a wide soft foot, a body that
    narrows and leans, the mouth rolled down into a flared darker lip and a
    mound of grain inside."""
    start = len(g.solids)
    r = lambda k, dx=0.0: chamfer_rect(cx + dx - w * k / 2, cz - d * k / 2, cx + dx + w * k / 2, cz + d * k / 2, min(w, d) * k * 0.3)  # noqa: E731
    g.prism("y", r(0.92), 0, 1.5, C(ramp, base), top=r(1.08))
    g.prism("y", r(1.08), 1.5, h * 0.55, C(ramp, base), top=r(0.98, 0.4))
    g.prism("y", r(0.98, 0.4), h * 0.55, h - 2.2, C(ramp, base), top=r(0.7, 0.9))
    body = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])
    facet_paint(g, g.solids[start:], lambda gg, mm, fr: cloth(gg, mm, ramp, base, frame=fr, seed=seed))
    g.prism("y", r(0.7, 0.9), h - 2.2, h, C(ramp, base - 1), top=r(0.9, 1.0))
    lip = last(g)
    X, Y, Z = coords(g)
    P.flat(g, lip & (Y > h - 0.9), ramp, base + 1)
    g.prism("y", r(0.72, 1.0), h, h + 1.6, C("gold", 6), top=r(0.3, 1.1))
    grain = last(g)
    P.mottle(g, grain, "gold", 6, cell=2, seed=seed + 3)
    P.flat(g, body & (Y < 1), ramp, base - 1)
    return body | lip | grain


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    pal = plank_box(g, 1, 0, 3, 27, 3, 24, "wood", 4, across="y", width=3, seed=1)
    P.flat(g, pal & (Y < 2) & ((np.floor(X) % 8) > 1) & ((Z < 4) | (Z > 22)), "darkwood", 2)  # gaps between the blocks
    # two sacks below, one on top across the groove (the top one tied to the left)
    a = lying_sack(g, 2, 18, 3, 8.5, 11, 8, tie=1, ramp="sand", base=4, seed=2)
    lying_sack(g, 3, 19, 3, 18.8, 11, 8.5, tie=1, ramp="wood", base=6, seed=3)
    c = lying_sack(g, 9, 25, 9.6, 13.6, 10.5, 8, tie=-1, ramp="sand", base=4, seed=4)
    # stencilled wheat marks on the front sack and on the top sack
    mw, mh = glyph_size("wheat")
    stamp(g, "-z", 3.0, 7, 4, MARK, {"#": C("red", 3)}, reach=3)
    stamp(g, "-z", 8.35, 14, 10, MARK, {"#": C("blue", 4)}, reach=3)
    # an open sack of grain standing beside the pallet
    open_sack(g, 31.0, 8.0, 9, 8.5, 11, ramp="sand", base=4, seed=5)
    glyph(g, "-z", 3.5, int(31.0 - mw / 2), 2, "wheat", "red", 3, reach=3)
    # spilled grain at the back right: a low faceted heap with a scoop in it
    g.prism("y", [(27, 14), (35, 15), (36, 24), (28, 25)], 0, 2.5, C("gold", 6), top=[(30, 18), (33, 18), (33, 21), (30, 21)])
    heap = last(g)
    P.mottle(g, heap, "gold", 6, cell=2, seed=6)
    P.flat(g, heap & (Y < 1), "gold", 5)
    for gx, gz in ((26, 12), (35, 11), (28, 26)):
        box(g, gx, 0, gz, gx + 1, 1, gz + 1, "gold", 6)
    s = box(g, 30, 2, 18, 33, 4, 21, "wood", 6)
    P.flat(g, s & (Y > 3), "gold", 5)
    box(g, 33, 3, 19, 36, 4, 20, "wood", 4)
    _ = c
    root = Part("sack-pile", g)
    return Asset(id="fantasy-props-sack-pile", pack="fantasy", category="props", name="Grain Sacks", root=root)
