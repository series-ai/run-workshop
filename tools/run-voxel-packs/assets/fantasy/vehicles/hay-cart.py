"""Hay wain in the Pirate Nation style.

A four-wheel farm wain: a narrow plank bed on two axles, with slatted hay
racks that lean out over the wheels on both sides (true slopes, rule F2)
and a tall hay ladder at the front. The oversized function prop is the
load (rule F4): a loose golden heap that bulges over the racks and rises
to an uneven crown, painted as straw streaks with darker shadow bands
(rules S1, S3). Tufts of straw hang over the rails. A pitchfork stands in
the heap, a twine-bound bale rides on the tail step, and a lantern on a
post lights the front (PFX). The rear wheels are larger than the front
wheels (rule F4). The wheels turn on `move`, and the body rides the
corners of the wheels so that each wheel touches the ground at each
frame. About 48 wide, 84 long and 52 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import coords, glyph, lamp_lantern, plank_box
from _vehicle_contact import Axle, body_keys, check_rest, spin_keys
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

SZ = (60, 60, 92)
CX = 30.0
FA, FR = 24.0, 9.0  # front axle z and wheel flat radius
RA, RR = 64.0, 11.0  # rear axle z and wheel flat radius (larger, rule F4)
NSIDE = 12  # wheel sides
WHEEL_X = {"l": (CX - 22, CX - 19), "r": (CX + 19, CX + 22)}
BED0, BED1 = 15, 19  # bed bottom and top
BZ0, BZ1 = 12, 78  # bed z extent
LOW, TOP = 12.0, 23.0  # half width of the rack at the bed and at the top rail
RACK_Y = 36  # top rail height
SECONDS = 1.2


def gear(g: Grid) -> None:
    """Axles, bolsters, a reach pole between the axles and the tongue."""
    for az, r in ((FA, FR), (RA, RR)):
        ax = box(g, CX - 19, r - 1, az - 1.5, CX + 19, r + 2, az + 1.5, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False, seed=int(az))
        P.flat(g, ax & (np.abs(coords(g)[0] - CX) > 16), "iron", 4)  # iron axle caps
        bol = plank_box(g, CX - 11, r + 2, az - 3, CX + 11, BED0, az + 3, "darkwood", 4, across="y", width=2, frame=("darkwood", 2), nails=False, seed=int(az) + 1)
    reach = box(g, CX - 1.5, FR + 1, FA, CX + 1.5, FR + 4, RA, "darkwood", 3)
    P.planks(g, reach, "darkwood", 3, width=3, across="x", nails=False, seed=5)
    # a sloped tongue from the front bolster to a crossbar near the ground
    g.prism("x", [(FR + 1, FA - 2), (FR + 4, FA - 2), (5, 3), (2, 3)], CX - 1.5, CX + 1.5, C("darkwood", 4))
    P.planks(g, S.last(g), "darkwood", 4, width=3, across="y", nails=False, seed=6)
    bar = plank_box(g, CX - 9, 2, 1, CX + 9, 5, 4, "darkwood", 3, across="y", seed=7)
    P.flat(g, bar & (np.abs(coords(g)[0] - CX) > 7), "iron", 4)


def bed(g: Grid) -> None:
    """The plank bed: side boards with a red band and a painted wheat sheaf,
    a dark sill and iron corner straps."""
    X, Y, Z = coords(g)
    m = plank_box(g, CX - LOW, BED0, BZ0, CX + LOW, BED1, BZ1, "wood", 5, across="y", width=2, seed=11)
    P.flat(g, m & (Y < BED0 + 1), "darkwood", 3)
    P.flat(g, m & (Y >= BED1 - 1), "darkwood", 4)
    band = m & (Y >= BED0 + 1) & (Y < BED0 + 2)
    P.flat(g, band, "red", 4)
    straps = m & ((Z < BZ0 + 2) | (Z > BZ1 - 2) | (np.abs(Z - 45) < 1)) & (Y < BED1 - 1)
    P.flat(g, straps, "iron", 4)
    P.flat(g, straps & (np.floor(Y).astype(int) % 2 == 0) & (np.abs(X - CX) > LOW - 1), "steel", 6)
    # a tail step for the bale
    step = plank_box(g, CX - 9, BED0, BZ1, CX + 9, BED0 + 2, BZ1 + 9, "wood", 4, across="x", width=3, seed=12)
    for x in (CX - 8, CX + 6):
        g.prism("x", [(BED0, BZ1 + 7), (BED0, BZ1 + 9), (BED0 - 6, BZ1 + 1), (BED0 - 4, BZ1)], x, x + 2, C("darkwood", 3))


def racks(g: Grid) -> None:
    """Two slatted racks that lean out over the wheels (true slopes), with a
    dark bottom rail, a top rail and staves every 7 voxels."""
    for s in (-1, 1):
        x0, x1 = CX + s * LOW, CX + s * TOP
        for z in range(BZ0 + 1, BZ1, 7):
            st = S.bar(g, "z", (x0, BED1 - 1), (x1, RACK_Y + 1), 2.2, z, z + 2, "wood", 5)
            P.planks(g, st, "wood", 5, width=2, across="z", nails=False, seed=z)
            P.flat(g, st & (coords(g)[1] > RACK_Y - 1), "darkwood", 4)
        rail = box(g, min(x1, x1 - s * 2.5), RACK_Y - 1, BZ0, max(x1, x1 - s * 2.5), RACK_Y + 2, BZ1, "darkwood", 4)
        P.planks(g, rail, "darkwood", 4, width=3, across="y", length=(16, 24), nails=True, seed=21 + s)
        mid = S.bar(g, "z", (CX + s * (LOW + 5.5), BED1 + 7), (CX + s * (LOW + 6.5), BED1 + 9), 2.0, BZ0, BZ1, "darkwood", 3)


def ladder(g: Grid) -> None:
    """The front hay ladder: two posts that lean forward with three rungs and
    a driver's board across the foot."""
    X, Y, Z = coords(g)
    for x in (CX - 17, CX + 15):
        post = S.bar(g, "x", (BED0, BZ0 + 2), (50, BZ0 - 3), 2.6, x, x + 2, "darkwood", 4)
        P.planks(g, post, "darkwood", 4, width=2, across="z", nails=False, seed=int(x))
        P.flat(g, post & (Y > 48), "gold", 5)  # gold post caps
    for y in (30, 39, 47):
        z = BZ0 + 2 - (y - BED0) * 5 / (50 - BED0)
        r = box(g, CX - 16, y - 1, z - 1.5, CX + 16, y + 1, z + 1.0, "wood", 5)
        P.planks(g, r, "wood", 5, width=2, across="y", nails=True, seed=y)
        P.flat(g, edges(r), "darkwood", 3)
    seat = plank_box(g, CX - 12, BED1, BZ0 - 6, CX + 12, BED1 + 3, BZ0 + 1, "wood", 6, across="x", width=3, seed=31)
    foot = plank_box(g, CX - 12, BED0 - 2, BZ0 - 6, CX + 12, BED1, BZ0 - 4, "darkwood", 4, across="x", width=3, seed=32)


def straw_face(g: Grid, m: np.ndarray, frame, base: int, seed: int) -> None:
    """Loose straw on one face: long strands of +-1 shade that run down the
    face (5 voxels long), and a few dark gaps between the clumps. Most of
    the face keeps the base shade, so it never reads as speckle (rule S3)."""
    U, V = P.uv(g, frame)
    h = P._hash(U, V // 5, seed=seed)
    shade = np.full(g.shape, base, dtype=np.int64)
    shade = np.where(h % np.uint64(6) == 0, base - 1, shade)
    shade = np.where(h % np.uint64(6) == 1, base + 1, shade)
    gap = P._hash(U // 2, V // 3, seed=seed + 1) % np.uint64(19) == 0
    shade = np.where(gap, base - 2, shade)
    P._paint(g, m, "gold", shade)


def straw(g: Grid, solids) -> None:
    """Paint every facet of the heap: lit tops and gentle slopes, mid-tone
    steep sides, and a shadow low in the rack (rule S3, gold 3 to 6)."""
    X, Y, Z = coords(g)
    for k, (m, fr) in enumerate(S.facets(g, solids)):
        gentle = fr == "top" or fr[1][1] > -0.55
        straw_face(g, m, fr, 6 if gentle else 5, 41 + k)
        straw_face(g, m & (Y < BED1 + 7), fr, 4, 41 + k)
        straw_face(g, m & (Y < BED1 + 3), fr, 3, 41 + k)


def load(g: Grid) -> None:
    """The heap: stacked frustums that bulge out over the racks and close to
    an uneven crown, lumps of loose hay on top, and straw tufts that hang
    over the top rails."""
    start = len(g.solids)
    z0, z1 = BZ0 + 1, BZ1 - 1
    g.prism("y", [(CX - LOW + 1.5, z0), (CX + LOW - 1.5, z0), (CX + LOW - 1.5, z1), (CX - LOW + 1.5, z1)], BED1, RACK_Y - 1, C("gold", 4),
            top=[(CX - TOP + 2.5, z0), (CX + TOP - 2.5, z0), (CX + TOP - 2.5, z1 + 2), (CX - TOP + 2.5, z1 + 2)])
    base8 = [(CX - TOP + 2.5, z0), (CX - 6, z0), (CX + 7, z0), (CX + TOP - 2.5, z0),
             (CX + TOP - 2.5, z1 + 2), (CX + 5, z1 + 2), (CX - 8, z1 + 2), (CX - TOP + 2.5, z1 + 2)]
    mid = [(CX - TOP + 0.5, z0 + 3), (CX - 6, z0 - 1), (CX + 7, z0), (CX + TOP - 0.5, z0 + 4),
           (CX + TOP, z1 - 3), (CX + 5, z1 + 4), (CX - 8, z1 + 3.5), (CX - TOP, z1 - 1)]
    g.prism("y", base8, RACK_Y - 1, RACK_Y + 4, C("gold", 5), top=mid)
    crown = [(CX - 14, z0 + 8), (CX - 3, z0 + 4), (CX + 10, z0 + 7), (CX + 15, z0 + 17),
             (CX + 13, z1 - 9), (CX + 2, z1 - 4), (CX - 10, z1 - 8), (CX - 16, z1 - 20)]
    g.prism("y", mid, RACK_Y + 4, RACK_Y + 10, C("gold", 5), top=crown)
    ridge = [(CX - 6, z0 + 16), (CX + 1, z0 + 13), (CX + 7, z0 + 20), (CX + 6, z1 - 22),
             (CX - 1, z1 - 14), (CX - 8, z1 - 24)]
    g.prism("y", [(CX - 12, z0 + 12), (CX + 1, z0 + 8), (CX + 12, z0 + 16), (CX + 11, z1 - 15), (CX - 1, z1 - 8), (CX - 13, z1 - 20)],
            RACK_Y + 9.5, RACK_Y + 14, C("gold", 6), top=ridge)
    # lumps of loose hay on the shoulders and the crown
    for cx, cz, y0, r, h in ((CX - 12, z0 + 14, RACK_Y + 6, 5.5, 5), (CX + 11, z0 + 27, RACK_Y + 6, 6.0, 5.5),
                             (CX - 9, z1 - 16, RACK_Y + 6, 6.0, 5), (CX + 9, z1 - 12, RACK_Y + 5, 5.0, 4.5),
                             (CX - 2, z0 + 30, RACK_Y + 12, 5.0, 4.0), (CX + 2, z1 - 24, RACK_Y + 12, 4.5, 3.5)):
        g.prism("y", S.flat_ngon(cx, cz, r, 7, facing=0.3 * cz), y0, y0 + h, C("gold", 5), top=S.flat_ngon(cx + 0.7, cz - 0.5, r * 0.45, 7, facing=0.3 * cz + 0.4))
    # straw tufts that droop over the top rails (true wedges)
    for s in (-1, 1):
        for k, z in enumerate((BZ0 + 8, BZ0 + 22, BZ0 + 37, BZ0 + 52)):
            w = 5 + (k * 3 + (s > 0) * 2) % 4
            g.prism("z", [(CX + s * (TOP - 4), RACK_Y + 4), (CX + s * (TOP + 1.8), RACK_Y + 0.5),
                          (CX + s * (TOP + 1.0), RACK_Y - 6 - k % 2), (CX + s * (TOP - 0.5), RACK_Y + 1)], z, z + w - 2, C("gold", 5))
    straw(g, g.solids[start:])


def bale(g: Grid) -> None:
    """A square bale on the tail step: a chamfered block with straw strands
    along its length, two red twine bands and cut ends with a stubble face."""
    x0, x1, y0, z0 = CX - 7, CX + 7, BED0 + 2, BZ1 + 1
    prof = [(y0, z0 + 1.2), (y0, z0 + 6.8), (y0 + 1.2, z0 + 8), (y0 + 6.8, z0 + 8), (y0 + 8, z0 + 6.8),
            (y0 + 8, z0 + 1.2), (y0 + 6.8, z0), (y0 + 1.2, z0)]
    g.prism("x", prof, x0, x1, C("gold", 5))
    m = S.last(g)
    X, Y, Z = coords(g)
    for k, (fm, fr) in enumerate(S.facets(g, [g.solids[-1]])):
        if fr != "top" and abs(fr[0][0]) < 0.5:  # the cut ends (faces along x): stubble
            P.thatch(g, fm, "gold", 4, band=9, frame=fr, seed=52)
        else:
            Uf, Vf = P.uv(g, fr)
            hh = P._hash(Vf, Uf // 6, seed=53 + k)
            shade = np.where(hh % np.uint64(5) == 0, 4, np.where(hh % np.uint64(5) == 1, 6, 5))
            P._paint(g, fm, "gold", shade)
    twine = m & ((np.abs(X - (x0 + 3.5)) < 0.6) | (np.abs(X - (x1 - 3.5)) < 0.6))
    P.flat(g, twine, "red", 3)
    P.flat(g, twine & (np.floor(Y + Z).astype(int) % 3 == 0), "red", 5)


def pitchfork(g: Grid) -> None:
    """A pitchfork stuck in the heap, its iron head in the air."""
    x = CX + 7
    shaft = S.bar(g, "x", (RACK_Y + 8, BZ1 - 20), (49.0, BZ1 - 8), 1.6, x, x + 1.6, "wood", 6)
    P.flat(g, shaft & (np.floor(coords(g)[1]).astype(int) % 5 == 0), "wood", 4)
    S.bar(g, "x", (48.0, BZ1 - 9.5), (50.0, BZ1 - 7.0), 2.2, x - 3.4, x + 5.0, "iron", 5)
    for dx in (-3.4, 0.0, 3.4):
        tine = S.bar(g, "x", (49.6, BZ1 - 7.6), (54.5, BZ1 - 2.6), 1.2, x + dx + 0.2, x + dx + 1.4, "steel", 6)
        P.flat(g, tine & (coords(g)[1] > 53.5), "steel", 7)


def lantern_post(g: Grid) -> dict:
    """A lantern on a post at the front left corner of the driver's board."""
    px, pz = int(CX - 10), int(BZ0 - 4)
    post = plank_box(g, px - 1, BED1 + 3, pz - 1, px + 1, BED1 + 10, pz + 1, "darkwood", 3, across="x", width=2, frame=None, nails=False, seed=61)
    return lamp_lantern(g, px, BED1 + 10, pz, s=6, body=7, roof="red", seed=62)


def wheel_grid(side: str, az: float, r: float) -> tuple[Grid, tuple]:
    g = Grid(*SZ)
    x0, x1 = WHEEL_X[side]
    info = S.wheel(g, "x", az, 0, r, int(x0), int(x1), n=NSIDE, spokes=8, gaps=True, tyre=("iron", 4), rim=("wood", 4),
                   spoke=("wood", 5), hub=("gold", 5), rim_w=2.2, hub_r=2.4, hub_out=1.0)
    return g, info["centre"]


def build() -> Asset:
    g = Grid(*SZ)
    gear(g)
    bed(g)
    racks(g)
    ladder(g)
    load(g)
    bale(g)
    pitchfork(g)
    lamp = lantern_post(g)
    glyph(g, "-x", CX - LOW - 0.5, 48, BED0 + 1, "wheat", "gold", 6, reach=2)
    wheels = {f"wheel-{side}{end}": wheel_grid(side, az, r) for side in ("l", "r") for end, az, r in (("f", FA, FR), ("b", RA, RR))}
    occ = g.a > 0
    for wg, _ in wheels.values():
        occ |= wg.a > 0
    xs, ys, zs = np.nonzero(occ)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)
    if pivot[1] != 0.0:
        raise ValueError(f"hay-cart: lowest voxel is at y={pivot[1]}, the wheels must stand on y = 0")

    def rel(p):
        return (p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])

    root = Part("hay-cart", g, pivot=pivot)
    clips = {}
    # Both wheel pairs turn once in the clip, 10 deg per frame (like the
    # covered wagon, the smaller front wheels do not turn faster). 10 deg
    # divides the 30 deg side angle, so a frame falls on each moment when a
    # flat side is down, and the contact stays within 0.05 between frames.
    rates = {"f": -360.0 / SECONDS, "b": -360.0 / SECONDS}
    for name, (wg, hub) in wheels.items():
        root.add(Part(name, wg, pivot=hub, at=rel(hub)))
        clips[name] = {"rot": spin_keys(SECONDS, lambda t, w=rates[name[-1]]: w * t)}
    axles = [Axle(FR, FA - pivot[2], FR, NSIDE), Axle(RR, RA - pivot[2], RR, NSIDE)]
    check_rest(axles)
    loc, rot = body_keys(axles, lambda t: [rates["f"] * t, rates["b"] * t], SECONDS)
    clips["hay-cart"] = {"loc": loc, "rot": rot}
    return Asset(id="fantasy-vehicles-hay-cart", pack="fantasy", category="vehicles", name="Hay Cart", root=root,
                 clips=[Clip("move", clips)],
                 sockets=[Socket("socket-function", at=rel(lamp["glow"]))],
                 pfx=[{"effectId": "rvx-fantasy-lantern-glow", "socket": "socket-function", "trigger": "idle", "size": 18}])
