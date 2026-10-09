"""Swamp water, in the Pirate Nation haunted style.

A sunken bog in a ragged earth bank. The water is dark teal, not green:
one calm sheet with a shallow rim, a dark waterline frame and two big
toxic pools that glow out of it, so water and land never read as the same
material. The bank is a ring of earth segments whose inner faces slope
down to the waterline (true slopes); its outer wall is painted in strata
over a dark base course, and its top is calm
moss with three clumps. A mossy fallen log floats clear of the bank with
magenta toadstools on its back, two boulders and a leaning headstone stand
on the rim with a pumpkin on the far side, and a stand of cattails rises
at the back.

Parts: pool (root), log (floating on the water), pad-0 and pad-1 (lily
pads that ride the swell), each turning at its own pace on `idle`.
socket-fume sits over the middle of the water for the bog fume.
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnshapes as S
from _bld import rock
from _kit import keys, pfx, world
from _life import assemble, coords, last, plan
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

SZ = (96, 36, 96)
CX = CZ = 48.0
N = 12
RI = [27.0, 29.5, 26.0, 30.0, 28.0, 25.5, 28.5, 31.0, 27.5, 29.0, 26.5, 28.0]  # waterline
RO = [43.0, 46.0, 42.0, 45.0, 44.0, 41.0, 44.5, 46.5, 43.0, 45.0, 42.0, 44.0]  # outer rim
WATER = 5.0  # the water surface
BANK = 9.0  # the top of the bank
LOG = (28.0, 60.0, 46.0, 9.0, 6.5)  # x0, x1, z, centre y, radius
PADS = ((30.0, 56.0, 5.5, 14.0), (64.0, 60.0, 5.5, -20.0))  # x, z, radius, sway (degrees)
POOLS = ((42.0, 66.0, 9.0), (62.0, 30.0, 7.0))  # x, z, radius
WEED = ((64.0, 44.0, 5.0),)  # the one duckweed mat


def ringpt(k: int, r: float) -> tuple[float, float]:
    a = 2 * math.pi * ((k % N) + 0.5) / N  # no segment edge is axis aligned, so neighbours do not share a voxel row
    return (CX + r * math.cos(a), CZ + r * math.sin(a))


def crest(k: int, t: float = 0.0) -> tuple[float, float]:
    """A point on the middle of the flat top of bank segment k, `t` of a
    segment further round: props stand here and nothing hangs off the rim."""
    r = ((RI[k % N] + 7.0) + (RO[k % N] - 2.0)) / 2
    a = 2 * math.pi * ((k % N) + 0.5 + t) / N
    return (CX + r * math.cos(a), CZ + r * math.sin(a))


def cattail(g: Grid, x: float, z: float, h: int, lean: float, seed: int) -> None:
    """A reed clump: three moss blades with a true-slope lean and one
    chunky dark seed head."""
    _X, Y, _Z = coords(g)
    for k, (dx, dz, hh) in enumerate(((0.0, 0.0, h), (2.0, 1.0, h - 5), (-2.0, 1.5, h - 8))):
        p0 = (x + dx, BANK - 1)
        p1 = (x + dx + lean * hh / h, BANK - 1 + hh)
        m = S.bar(g, "z", p0, p1, 1.8 if k == 0 else 1.3, z + dz - 1, z + dz + 1, "moss", 6 - (k + seed) % 2)
        P.outline(g, m, "moss", 3, normal="z")
        if k == 0:
            head = S.bar(g, "z", (p1[0], p1[1] - 7), p1, 3.0, z + dz - 1.5, z + dz + 1.5, "wood", 4)
            P.flat(g, head, "wood", 4)
            P.flat(g, head & (Y > p1[1] - 4), "wood", 5)
            P.outline(g, head, "wood", 2, normal="z")


def pad(k: int) -> Grid:
    """One lily pad: a notched disc of moss on the water with a dark rolled
    rim, painted veins and a chunky magenta bloom."""
    px, pz, r, _turn = PADS[k]
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    plan(g, S.flat_ngon(px, pz, r, 8), WATER + 1, WATER + 2, "moss", 6)
    m = last(g)
    notch = m & (Z > pz) & (np.abs(X - px) < r * 0.3)
    P.flat(g, m, "moss", 6)
    rad = S.ngon_radius(g, "y", px, pz)
    P.flat(g, m & (rad > r - 2.0), "moss", 4)  # the rolled rim
    P.flat(g, m & (rad > r - 0.9), "moss", 2)  # a dark framing edge all round
    for a in range(6):  # painted veins out of the middle
        ang = a * math.pi / 3 + 0.4
        P.flat(g, m & (np.abs((X - px) * math.sin(ang) - (Z - pz) * math.cos(ang)) < 0.6) & ((X - px) * math.cos(ang) + (Z - pz) * math.sin(ang) > 0) & (rad < r - 2.0), "moss", 7)
    g.carve(notch) if hasattr(g, "carve") else g.where(notch, 0)
    # the bloom: a chunky four-petal flower on a stem, framed dark (rule K3)
    bx, bz = px + r * 0.28, pz - r * 0.36
    stem = box(g, bx + 1, WATER + 2, bz + 1, bx + 3, WATER + 4, bz + 3, "moss", 4)
    P.flat(g, stem, "moss", 3)
    bloom = box(g, bx, WATER + 4, bz, bx + 4, WATER + 7, bz + 4, "magenta", 5)
    P.flat(g, bloom & (Y > WATER + 5), "magenta", 6)
    P.flat(g, bloom & (Y >= WATER + 6), "magenta", 7)
    P.outline(g, bloom, "purple", 1, normal="y")
    P.flat(g, bloom & (Y == WATER + 6) & (np.abs(X - (bx + 2)) < 1.1) & (np.abs(Z - (bz + 2)) < 1.1), "gold", 5)
    return g


def log() -> Grid:
    """A mossy fallen log floating clear of the bank: a faceted trunk with
    painted bark seams, dark bark edges, a broken end with ring grain and
    two chunky toadstools on its back."""
    x0, x1, lz, ly, lr = LOG
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    start = len(g.solids)
    g.prism("x", S.flat_ngon(ly, lz, lr, 8), x0, x1, C("wood", 3))
    trunk = last(g)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 3, width=2, across="x", length=(9, 14), nails=False, frame=fr, seed=1))
    P.flat(g, trunk & (Y < ly - 1.0), "wood", 2)
    P.flat(g, trunk & (Y < WATER + 1), "wood", 1)  # the wet, dark half in the bog
    P.flat(g, trunk & (Y > ly + 2), "wood", 5)
    P.flat(g, trunk & (Y > ly + 4), "wood", 6)
    P.flat(g, trunk & S.seams(g, g.solids[start:], 0.9), "wood", 1)  # dark bark edges down every facet
    pnpaint.blotch(g, trunk & (Y > ly + 3), "moss", 5, cell=3, chance=0.14, seed=2)
    ring = trunk & (X > x1 - 2)
    P.flat(g, ring, "sand", 4)
    P.flat(g, ring & (((np.hypot(Y - ly, Z - lz)).astype(int) % 2) == 0), "sand", 3)
    P.flat(g, ring & (np.hypot(Y - ly, Z - lz) > lr - 1.2), "wood", 1)
    for bx, bz, h, r in ((x0 + 9.0, lz - 1.0, 5, 3.4), (x0 + 21.0, lz + 2.0, 4, 2.6)):
        stem = box(g, bx - 1, ly + lr - 2, bz - 1, bx + 1, ly + lr - 2 + h, bz + 1, "bone", 6)
        P.flat(g, stem & (Y < ly + lr), "bone", 4)
        cap = S.cone(g, "y", bx, bz, r, ly + lr - 2 + h, ly + lr - 2 + h + r * 0.9, "magenta", 5, n=6)
        P.flat(g, cap, "magenta", 5)
        P.flat(g, cap & (Y > ly + lr - 2 + h), "magenta", 7)
        P.outline(g, cap, "purple", 1, normal="y")
    return g


def pool() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    # ---------------------------------------------------------- the water
    water = plan(g, [ringpt(k, RI[k] + 1.0) for k in range(N)], 0, WATER + 1, "teal", 2)
    rr = np.hypot(X - CX, Z - CZ)
    ang = np.arctan2(Z - CZ, X - CX)
    local = np.interp(ang % (2 * math.pi), np.linspace(0, 2 * math.pi, N + 1), RI + [RI[0]])
    surf = water & (Y >= WATER)  # the top voxel row of the sheet
    # one calm dark sheet: three close teal tones, no per-texel noise, so the
    # bog never reads as the same material as the mossy bank (rules S3, C1)
    P.flat(g, surf, "teal", 2)
    P.flat(g, surf & (rr > local * 0.90), "teal", 3)  # the shallows at the rim
    P.flat(g, surf & (rr > local), "purple", 1)  # a dark frame along the waterline
    for px, pz, pr in POOLS:  # two big toxic pools, each with its own dark rim
        d = np.hypot(X - px, Z - pz)
        P.flat(g, surf & (d < pr), "teal", 4)
        P.flat(g, surf & (d < pr * 0.86), "toxic", 2)
        P.flat(g, surf & (d < pr * 0.62), "toxic", 4)
        P.flat(g, surf & (d < pr * 0.30), "toxic", 6)
        P.flat(g, surf & (np.abs(d - pr * 0.74) < 0.8), "toxic", 1)  # ripple rings
        P.flat(g, surf & (np.abs(d - pr * 0.46) < 0.8), "toxic", 2)
        P.flat(g, surf & (np.abs(d - pr * 0.92) < 0.9), "toxic", 1)
        P.flat(g, surf & (np.abs(d - pr * 1.00) < 0.9), "teal", 1)
    for wx, wz, wr in WEED:  # a few big duckweed mats, framed dark (rule S4)
        d = np.hypot(X - wx, Z - wz)
        P.flat(g, surf & (d < wr), "moss", 4)
        P.flat(g, surf & (d < wr * 0.55), "moss", 5)
        P.flat(g, surf & (np.abs(d - wr) < 0.9), "moss", 2)
    P.flat(g, water & (Y <= WATER - 2), "purple", 1)  # the dark water body under the sheet
    # a drowned skull and two ribs breaking the surface
    S.skull(g, 44.0, WATER - 3, 30.0, s=8, ramp="bone", base=6, eyes=("toxic", 6), socket=("purple", 1), seed=5)
    for rx, rz, a in ((34.0, 36.0, 24), (38.0, 32.0, -14)):
        m = S.bar(g, "y", (rx, rz), (rx + 8 * math.cos(math.radians(a)), rz + 8 * math.sin(math.radians(a))), 2.0, WATER, WATER + 2, "bone", 6)
        P.flat(g, m & (Y == WATER), "bone", 3)
    # ---------------------------------------------------------- the bank
    seg = []
    for k in range(N):
        base = [ringpt(k, RI[k]), ringpt(k, RO[k]), ringpt(k + 1, RO[(k + 1) % N]), ringpt(k + 1, RI[(k + 1) % N])]
        top = [ringpt(k, RI[k] + 7.0), ringpt(k, RO[k] - 2.0), ringpt(k + 1, RO[(k + 1) % N] - 2.0), ringpt(k + 1, RI[(k + 1) % N] + 7.0)]
        plan(g, base, 0, BANK, "skindark", 3, top=top)
        seg.append(g.solids[-1])
    earth = np.logical_or.reduce([s.mask(g.shape) for s in seg])
    inner = earth & (rr < local + 8.0)
    outer = earth & ~inner
    # the outer wall: strata over a dark base course and a dark seam
    # between the courses (rules S2, S4). The wall has no painted rock
    # chips: on the side face they looked like loose chips that float.
    P.flat(g, outer, "skindark", 4)
    P.flat(g, outer & (Y < 7), "skindark", 3)
    P.flat(g, outer & (Y < 4), "skindark", 2)
    P.flat(g, outer & (Y < 2), "skindark", 1)
    for yb in (2, 4, 7):
        P.flat(g, outer & (Y == yb), "skindark", 1)
    # the inner slope: wet mud at the waterline, dry mud above, a moss lip
    P.flat(g, inner, "skindark", 3)
    P.flat(g, inner & (Y < WATER + 2), "skindark", 2)
    P.flat(g, inner & (Y < WATER + 1), "skindark", 1)
    P.flat(g, inner & (Y > BANK - 3), "moss", 3)
    # the bank top: calm moss with three deliberate clumps, framed dark
    top_earth = earth & (Y > BANK - 2)
    P.flat(g, top_earth, "moss", 4)
    P.flat(g, top_earth & (Y == BANK - 2), "moss", 3)
    for k, t in ((1, 0.2), (5, -0.1), (8, 0.3)):
        cx, cz = crest(k, t)
        d = np.hypot(X - cx, Z - cz)
        P.flat(g, top_earth & (d < 9.0), "moss", 5)
        P.flat(g, top_earth & (d < 4.5), "moss", 6)
        P.flat(g, top_earth & (np.abs(d - 9.0) < 1.0), "moss", 2)
    # ---------------------------------------------------------- props
    for k, (seg_k, r, h) in enumerate(((1, 6.0, 10.0), (7, 5.0, 8.0))):  # boulders on the flat top
        bx, bz = crest(seg_k)
        m = rock(g, bx, bz, BANK - 1, r, h, n=6, seed=10 + k)
        P.flat(g, m & (Y < BANK + 1), "gray", 2)  # a dark base edge, so each rock sits
    hx, hz = crest(9, 0.0)  # a leaning headstone: the grey and violet of the set
    S.tombstone(g, hx, hz, w=11, h=17, t=5, y0=BANK - 1, lean=-9, ramp="gray", base=4, glyph="cross", ink=("purple", 3), seed=20)
    px, pz = crest(8, 0.3)  # a pumpkin on the far rim: the one warm accent (rule C3)
    S.pumpkin(g, px, BANK - 1, pz, w=12, h=10, ramp="orange", base=3, seed=21)
    for k, (seg_k, t, h, lean) in enumerate(((6, -0.2, 16, 1.5), (6, 0.2, 13, -2.0), (7, 0.0, 18, 2.5), (10, 0.1, 15, -1.8), (10, -0.3, 12, 1.2))):
        rx, rz = crest(seg_k, t)
        cattail(g, rx, rz, h, lean, seed=k)
    for k, (seg_k, t) in enumerate(((2, 0.0), (4, 0.25), (8, -0.2), (11, 0.1))):  # grass tufts
        tx, tz = crest(seg_k, t)
        for dx, dz, th in ((0, 0, 5), (2, 2, 3), (-2, 2, 4)):
            m = box(g, tx + dx, BANK - 2, tz + dz, tx + dx + 1, BANK - 2 + th, tz + dz + 1, "moss", 5 + ((th + k) % 2))
            P.flat(g, m & (Y < BANK), "moss", 2)
    return g


def build():
    parts = {"pool": pool(), "log": log(), "pad-0": pad(0), "pad-1": pad(1)}
    joints = [("pool", None, (CX, 0.0, CZ)), ("log", "pool", ((LOG[0] + LOG[1]) / 2, LOG[3], LOG[2]))]
    for k, (px, pz, _r, _t) in enumerate(PADS):
        joints.append((f"pad-{k}", "pool", (px, WATER, pz)))
    root = assemble(parts, joints)
    T = 6.0
    clip = {
        "log": {"rot": keys((0.0, (0.0, 0.0, 0.0)), (T / 4, (1.6, 0.0, 0.0)), (T / 2, (0.0, 0.0, 0.0)), (3 * T / 4, (-1.6, 0.0, 0.0)), (T, (0.0, 0.0, 0.0))),
                "loc": keys((0.0, (0.0, 0.0, 0.0)), (T / 2, (0.0, 0.7, 0.0)), (T, (0.0, 0.0, 0.0)))},
    }
    for k, (_px, _pz, _r, turn) in enumerate(PADS):
        clip[f"pad-{k}"] = {
            "rot": keys(*[(T * i / 6, (0.0, turn * math.sin(2 * math.pi * i / 6), 0.0)) for i in range(7)]),
            "loc": keys(*[(T * i / 6, (0.0, 0.6 * math.sin(2 * math.pi * i / 6 + k * 1.7), 0.0)) for i in range(7)]),
        }
    return world("swamp-water", "terrain-nature", "Swamp Water", root, clips=[Clip("idle", clip)],
                 sockets=[Socket("socket-fume", at=(0.0, WATER + 2.0, 0.0))],
                 pfx=[pfx("rvx-monster-sewer-fume", "socket-fume", "idle", size=44)])
