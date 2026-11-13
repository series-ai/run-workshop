"""Art-director repair models (group: props).

These props stand on the floor or on a thin dirt patch. They do not use the
old purple display puck (base() in _double_props.py). The brain tank and the
eyeball jar have tinted glass with a highlight. The specimen is paint on the
glass, because the glass is opaque (rule S1). Every surface uses soft ramps
(rule S3) with contrast at edges and seams.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from pnpaint import blotch
from _kit import C, Grid, Clip, Socket, keys, pfx, single, world
from _pn import assemble
from _props import idx, union, tufts
from pnkit import box, edges
from _double_nature import branch, rock


# ---------------------------------------------------------------- helpers
def ring(g, axis, cu, cv, r, thickness, lo, hi, ramp, shade, start=0, end=math.tau, n=16):
    """A ring or an arc of quads in the plane across `axis`."""
    for i in range(n):
        a = start + (end - start) * i / n
        b = start + (end - start) * (i + 1) / n
        pts = [(cu + math.cos(a) * r, cv + math.sin(a) * r), (cu + math.cos(b) * r, cv + math.sin(b) * r),
               (cu + math.cos(b) * (r - thickness), cv + math.sin(b) * (r - thickness)),
               (cu + math.cos(a) * (r - thickness), cv + math.sin(a) * (r - thickness))]
        g.prism(axis, pts, lo, hi, C(ramp, shade))


def patch(g, cx, cz, rx, rz, h=1, ramp="wood", base=3, moss=0.3, seed=0, n=11, jitter=0.2):
    """A thin irregular dirt patch with moss on top, like the original
    props. It is 1 or 2 voxels high and has no regular outline."""
    jit = [1.0 - jitter + jitter * (((k * 7 + seed * 3) % 5) / 4.0) for k in range(n)]
    pts = [(cx + math.cos(0.3 + k * math.tau / n) * rx * jit[k],
            cz + math.sin(0.3 + k * math.tau / n) * rz * jit[k]) for k in range(n)]
    g.prism("y", pts, 0, h, C(ramp, base))
    m = g.solids[-1].mask(g.shape)
    X, Y, Z = idx(g)
    P.mottle(g, m, ramp, base, cell=3, seed=seed)
    P.flat(g, m & ((P._hash(X // 2, Z // 2, seed=seed + 1) % np.uint64(9)) == 0), ramp, base - 1)
    P.outline(g, m & (Y == h - 1), ramp, base - 1, normal="y")
    blotch(g, m & (Y == h - 1), "moss", 4, cell=2, chance=moss, seed=seed + 2)
    return m


def seg_mask(U, V, pts, width=0.55):
    """Voxels near a polyline in the (U, V) plane: a painted line."""
    m = np.zeros(U.shape, dtype=bool)
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        du, dv = a1 - a0, b1 - b0
        t = np.clip(((U + 0.5 - a0) * du + (V + 0.5 - b0) * dv) / (du * du + dv * dv), 0, 1)
        m |= np.hypot(U + 0.5 - (a0 + t * du), V + 0.5 - (b0 + t * dv)) < width
    return m


def glass(g, m, solids, cx, cz, r, y0, y1, level, liquid):
    """Paint a solid vessel as tinted glass: the liquid tint gets darker
    toward the bottom, a light meniscus line sits at the liquid level, and
    pale glass shows above it. The pane edges are dark. Returns the angle
    and the side offset of each voxel for the specimen painters."""
    X, Y, Z = idx(g)
    lr, ls = liquid
    P.flat(g, m, lr, ls)
    P.flat(g, m & (Y < y0 + (level - y0) * 0.35), lr, ls - 1)
    P.flat(g, m & (Y == level - 1), lr, ls + 2)
    air = m & (Y >= level)
    P.flat(g, air, "teal", 6)
    P.flat(g, air & (Y == y1 - 1), "teal", 5)
    P.flat(g, m & S.seams(g, solids, 0.8) & (Y < level), lr, ls - 2)
    P.flat(g, air & S.seams(g, solids, 0.8), "teal", 4)
    dx, dz = X + 0.5 - cx, Z + 0.5 - cz
    ang = np.arctan2(dz, dx)
    side = np.where(np.abs(dz) > np.abs(dx), np.abs(dx), np.abs(dz))
    return ang, side


def highlight(g, m, ang, r, y0, y1, angles=(-1.9, 1.25)):
    """Vertical glass highlights: a white streak with a pale band beside it."""
    _X, Y, _Z = idx(g)
    for a0 in angles:
        d = np.abs(np.angle(np.exp(1j * (ang - a0)))) * r
        span = (Y >= y0 + 1) & (Y < y1 - 1)
        P.flat(g, m & span & (d < 1.6), "teal", 7)
        P.flat(g, m & span & (d < 0.7), "bone", 7)


# ---------------------------------------------------------------- jars
def brain_tank():
    """The tall specimen tank: an iron foot, a green-lit glass cylinder with
    a floating brain, brass rings, an iron lid and two electrodes."""
    W = D = 26
    cx = cz = 13.0
    g = Grid(W, 36, D)
    X, Y, Z = idx(g)
    r, y0, y1, level = 7.0, 3, 24, 19
    # The iron foot: a chamfered octagon with large plates and rivets.
    start = len(g.solids)
    S.disc(g, "y", cx, cz, 8.4, 0, 2, "iron", 5)
    g.prism("y", S.flat_ngon(cx, cz, 8.4, 8, -math.pi / 2), 2, 3, C("iron", 6), top=S.flat_ngon(cx, cz, 7.6, 8, -math.pi / 2))
    foot = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "iron", 6, size=(8, 3), frame=fr, seed=1))
    P.flat(g, foot & (Y == 0), "iron", 3)
    blotch(g, foot & (Y == 0), "rust", 3, cell=2, chance=0.15, seed=2)
    # The glass cylinder, painted as liquid and glass.
    start = len(g.solids)
    S.disc(g, "y", cx, cz, r, y0, y1, "teal", 5)
    gl = union(g, start)
    ang, side = glass(g, gl, g.solids[start:], cx, cz, r, y0, y1, level, ("toxic", 4))
    # The brain: an oval of pink folds with a dark stem under it.
    bc, bh, bw = 12.5, 5.0, 4.6
    yy = Y + 0.5 - bc
    oval = (side / bw) ** 2 + (yy / bh) ** 2
    brain = gl & (oval < 1.0)
    P.flat(g, brain, "pink", 5)
    P.flat(g, brain & (yy < -bh * 0.3), "pink", 4)
    P.flat(g, brain & (yy > bh * 0.5), "pink", 6)
    wave = np.abs(((Y + 0.5 + 1.2 * np.sin(side * 1.4)) % 3.0) - 1.5) < 0.45
    P.flat(g, brain & wave & (oval < 0.8), "pink", 3)
    P.flat(g, brain & (side < 0.6) & (yy > -bh * 0.5), "pink", 2)  # the split between the halves
    P.flat(g, brain & (oval > 0.7), "pink", 3)
    stem = gl & (side < 1.2) & (Y >= y0 + 1) & (Y + 0.5 < bc - bh + 1)
    P.flat(g, stem, "pink", 3)
    # Bubbles rise up one side.
    for a0, ys in ((-1.2, (5, 8, 16, 18)), (2.0, (6, 15, 17))):
        d = np.abs(np.angle(np.exp(1j * (ang - a0)))) * r
        for k, yb in enumerate(ys):
            P.flat(g, gl & (d < 0.7) & (Y == yb), "toxic", 7)
    highlight(g, gl, ang, r, y0, y1)
    # Brass rings at the foot and the top of the glass.
    for lo, hi in ((y0, y0 + 1.6), (y1 - 1.6, y1)):
        S.disc(g, "y", cx, cz, r + 0.6, lo, hi, "gold", 4)
        rg = g.solids[-1].mask(g.shape)
        P.flat(g, rg & (Y == int(lo)), "gold", 3)
        P.flat(g, rg & ~gl & ((X + Z) % 5 == 0), "gold", 6)
    # The iron lid with a low stepped cap.
    start = len(g.solids)
    S.disc(g, "y", cx, cz, 8.0, y1, y1 + 2, "iron", 5)
    g.prism("y", S.flat_ngon(cx, cz, 8.0, 8, -math.pi / 2), y1 + 2, y1 + 3, C("iron", 6), top=S.flat_ngon(cx, cz, 5.5, 8, -math.pi / 2))
    lid = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "iron", 6, size=(8, 3), frame=fr, seed=3))
    P.flat(g, lid & (Y == y1), "iron", 3)
    # Two electrodes with gold caps and a thick purple cable between them.
    for ex in (cx - 3.5, cx + 3.5):
        S.disc(g, "y", ex, cz, 1.3, y1 + 3, y1 + 6, "iron", 6, n=6)
        S.disc(g, "y", ex, cz, 1.8, y1 + 6, y1 + 7, "gold", 5, n=6)
        P.flat(g, g.solids[-1].mask(g.shape) & (Y == y1 + 6), "gold", 6)
    pts = [(cx - 3.5, y1 + 6.5), (cx - 2.0, y1 + 9.0), (cx + 2.0, y1 + 9.0), (cx + 3.5, y1 + 6.5)]
    cable = np.zeros(g.shape, dtype=bool)
    for p0, p1 in zip(pts, pts[1:]):
        cable |= S.bar(g, "z", p0, p1, 1.6, cz - 0.8, cz + 0.8, "purple", 4)
    P.flat(g, cable & (Y >= y1 + 9), "purple", 5)
    socks = [Socket("socket-sample", at=(cx - W / 2, bc, cz - D / 2))]
    return single("brain-jar", "props", "Brain Jar", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-sample", "idle", size=14)])


def eye_jar():
    """A short wide pickling jar on a plank board: amber brine, eyeballs that
    float at different heights, a cork, a string and a paper label."""
    W, D = 24, 20
    cx, cz = 12.0, 10.0
    g = Grid(W, 22, D)
    X, Y, Z = idx(g)
    # The plank board.
    board = box(g, 1, 0, 2, 23, 2, 18, "wood", 4)
    P.planks(g, board, "wood", 4, width=3, across="z", nails=True, seed=5)
    P.flat(g, edges(board), "wood", 2)
    P.flat(g, board & (Y == 0), "darkwood", 4)
    r, y0, y1, level = 7.0, 2, 12, 10
    start = len(g.solids)
    S.disc(g, "y", cx, cz, r, y0, y1, "khaki", 5)
    gl = union(g, start)
    ang, side = glass(g, gl, g.solids[start:], cx, cz, r, y0, y1, level, ("khaki", 5))
    # The eyeballs: each one sits at its own angle and height.
    eyes = ((-1.05, 5.8, 3.0, "toxic"), (-2.45, 7.0, 2.8, "orange"), (0.15, 6.6, 3.0, "teal"),
            (1.35, 5.6, 2.9, "toxic"), (2.6, 7.2, 2.7, "orange"))
    for k, (a0, ey, er, iris) in enumerate(eyes):
        du = np.angle(np.exp(1j * (ang - a0))) * r
        dv = Y + 0.5 - ey
        d = np.hypot(du, dv)
        ball = gl & (d < er)
        P.flat(g, ball, "bone", 7)
        P.flat(g, ball & (dv < -er * 0.35), "bone", 6)
        P.flat(g, ball & (d > er - 0.6), "bone", 5)
        look = (0.5 if k % 2 else -0.5, 0.3 if k % 3 else -0.3)
        di = np.hypot(du - look[0], dv - look[1])
        P.flat(g, ball & (di < er * 0.55), iris, 5)
        P.flat(g, ball & (di < er * 0.5) & (dv - look[1] > 0.4), iris, 6)
        P.flat(g, ball & (di < er * 0.22), "purple", 1)
        P.flat(g, ball & (np.abs(dv + 0.3) < 0.5) & (du > er * 0.5) & (d > er - 1.1), "blood", 4)  # a red vein
    highlight(g, gl, ang, r, y0, y1)
    # The shoulder, the neck, a purple string and the cork.
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, r, 8, -math.pi / 2), y1, y1 + 2, C("teal", 6), top=S.flat_ngon(cx, cz, 4.4, 8, -math.pi / 2))
    S.disc(g, "y", cx, cz, 4.2, y1 + 2, y1 + 3, "teal", 6)
    neck = union(g, start)
    P.flat(g, neck & S.seams(g, g.solids[start:], 0.8), "teal", 4)
    P.flat(g, neck & (Y == y1 + 2), "purple", 4)
    S.cone(g, "y", cx, cz, 4.6, y1 + 3, y1 + 6, "sand", 3, r_top=3.8)
    cork = g.solids[-1].mask(g.shape)
    P.mottle(g, cork, "sand", 3, cell=2, seed=6)
    P.flat(g, cork & ((P._hash(X, Y, Z, seed=7) % np.uint64(7)) == 0), "sand", 1)
    P.flat(g, cork & (Y == y1 + 5), "sand", 4)
    P.outline(g, cork & (Y == y1 + 5), "sand", 2, normal="y")
    # A paper label on the front with an eye drawn on it.
    import pnglyph
    fz = int(cz - r)
    lab = gl & (np.abs(X + 0.5 - cx) < 3.6) & (Y >= 3) & (Y < 9) & (Z <= fz + 1)
    P.flat(g, lab, "sand", 6)
    P.outline(g, lab, "sand", 3, normal="z")
    pnglyph.stamp(g, "-z", fz, int(cx) - 2, 4, [".###.", "#.+.#", ".###."],
                  {"#": C("darkwood", 3), "+": C("blood", 4)})
    # One eyeball has rolled out onto the board.
    S.disc(g, "y", 19.5, 4.5, 2.0, 2, 5, "bone", 6, n=8)
    loose = g.solids[-1].mask(g.shape)
    P.flat(g, loose & (Y == 2), "bone", 4)
    P.flat(g, loose & (Y == 4), "bone", 7)
    front = loose & (Z == int(4.5 - 2.0))
    P.flat(g, front & (np.abs(X + 0.5 - 19.5) < 1.1) & (Y >= 3), "toxic", 5)
    P.flat(g, front & (X == 19) & (Y == 3), "purple", 1)
    socks = [Socket("socket-sample", at=(cx - W / 2, 7.0, cz - D / 2))]
    return single("eyeball-jar", "props", "Eyeball Jar", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-sample", "idle", size=14)])


# ---------------------------------------------------------------- trap
TRAP_R, TRAP_HY = 8.0, 4.0  # the jaw radius and the hinge height
TRAP_OPEN = 60.0             # each jaw opens 60 degrees from closed


def trap_jaw(g, cx, cz, sign):
    """One half-ring jaw, modelled closed: it stands in the x-y plane and
    its teeth point at the other jaw (sign -1: the front jaw, +1: the back
    jaw). The rest rotation of the part opens it."""
    X, Y, Z = idx(g)
    z0, z1 = (cz - 3.4, cz - 1.8) if sign < 0 else (cz + 1.8, cz + 3.4)
    start = len(g.solids)
    ring(g, "z", cx, TRAP_HY, TRAP_R, 1.8, z0, z1, "iron", 6, start=0, end=math.pi, n=10)
    band = union(g, start)
    P.plates(g, band, "iron", 6, size=(6, 2), frame="z", seed=8 if sign < 0 else 9)
    P.flat(g, band & S.seams(g, g.solids[start:], 0.6), "iron", 4)
    blotch(g, band, "rust", 3, cell=2, chance=0.12, seed=10 if sign < 0 else 11)
    teeth = np.zeros(g.shape, dtype=bool)
    count = 7 if sign < 0 else 6
    for k in range(count):
        t = math.pi * (2 * k + (1 if sign < 0 else 2)) / 14
        tx, ty = cx + math.cos(t) * (TRAP_R - 0.9), TRAP_HY + math.sin(t) * (TRAP_R - 0.9)
        if sign < 0:
            S.cone(g, "z", tx, ty, 1.3, z1, cz - 0.05, "gray", 5, n=4, tip="hi")
        else:
            S.cone(g, "z", tx, ty, 1.3, cz + 0.05, z0, "gray", 5, n=4, tip="lo")
        teeth |= g.solids[-1].mask(g.shape)
    P.flat(g, teeth, "gray", 5)
    P.flat(g, teeth & (np.abs(Z + 0.5 - cz) < 1.0), "gray", 7)
    P.flat(g, teeth & (np.abs(Z + 0.5 - cz) >= 1.5), "gray", 4)
    return band | teeth


def trap():
    cx = cz = 14.0
    hy = TRAP_HY
    baseg = Grid(30, 18, 30)
    X, Y, Z = idx(baseg)
    patch(baseg, cx, cz + 0.5, 12.3, 11.8, h=1, ramp="wood", base=3, moss=0.35, seed=12, n=14, jitter=0.04)
    # The hinge bar along x, with a lug at each jaw end.
    bar = box(baseg, cx - 10, 1, cz - 1.5, cx + 10, 3, cz + 1.5, "iron", 4)
    P.plates(baseg, bar, "iron", 4, size=(5, 2), seed=13)
    P.flat(baseg, edges(bar), "iron", 2)
    for s in (-1, 1):
        x0 = cx + s * TRAP_R if s > 0 else cx - TRAP_R - 2
        lug = box(baseg, x0, 1, cz - 3.6, x0 + 2, hy + 2, cz + 3.6, "iron", 5)
        P.plates(baseg, lug, "iron", 5, size=(3, 3), seed=14)
        P.flat(baseg, edges(lug), "iron", 3)
        P.flat(baseg, lug & (np.abs(Y + 0.5 - hy) < 0.8) & (np.abs(Z + 0.5 - cz) < 0.8), "gold", 5)  # the hinge pin
        # A coil spring on the end of the bar.
        sx0 = cx + TRAP_R + 2 if s > 0 else cx - TRAP_R - 4
        S.disc(baseg, "x", 3.0, cz, 2.0, sx0, sx0 + 2, "gray", 4, n=8)
        coil = baseg.solids[-1].mask(baseg.shape)
        P.flat(baseg, coil & (X % 2 == 0), "gray", 2)
        P.flat(baseg, coil & (X % 2 == 1) & (Y >= 4), "gray", 6)
    # The round pressure plate in the middle, with a painted paw.
    S.disc(baseg, "y", cx, cz, 4.2, 3, 4, "rust", 4)
    plate = baseg.solids[-1].mask(baseg.shape)
    rad = np.hypot(X + 0.5 - cx, Z + 0.5 - cz)
    P.flat(baseg, plate & (rad > 3.2), "iron", 4)
    P.flat(baseg, plate & (rad < 1.6), "rust", 2)
    for a in (-2.3, -1.57, -0.84):
        P.flat(baseg, plate & (np.hypot(X + 0.5 - (cx + math.cos(a) * 2.4), Z + 0.5 - (cz + math.sin(a) * 2.4)) < 0.75), "rust", 2)
    # A short chain to an iron stake.
    links = [(cx + 10.5, cz + 2.2), (cx + 9.5, cz + 4.2), (cx + 8.5, cz + 6.2), (cx + 7.5, cz + 7.6)]
    for k, (lx, lz) in enumerate(links):
        if k % 2 == 0:
            m = box(baseg, lx - 1, 1, lz - 1.5, lx + 1, 2, lz + 1.5, "iron", 5)
            P.flat(baseg, m & (np.abs(X + 0.5 - lx) < 0.6) & (np.abs(Z + 0.5 - lz) < 0.6), "iron", 2)
        else:
            m = box(baseg, lx - 0.5, 1, lz - 1.5, lx + 0.5, 3, lz + 1.5, "iron", 6)
            P.flat(baseg, m & (Y == 1), "iron", 3)  # the low link rests on the patch
        blotch(baseg, m, "rust", 4, cell=2, chance=0.3, seed=15 + k)
    S.disc(baseg, "y", cx + 6.5, cz + 9.0, 1.4, 0.3, 6, "iron", 4, n=6)  # driven into the patch
    stake = baseg.solids[-1].mask(baseg.shape)
    P.flat(baseg, stake & (Y < 3), "iron", 3)
    blotch(baseg, stake, "rust", 4, cell=2, chance=0.3, seed=19)
    S.disc(baseg, "y", cx + 6.5, cz + 9.0, 2.0, 6, 7, "iron", 5, n=6)
    P.flat(baseg, baseg.solids[-1].mask(baseg.shape), "iron", 6)
    eye = box(baseg, cx + 6.0, 3, cz + 7.1, cx + 7.0, 5, cz + 8.1, "iron", 6)  # the ring on the stake
    P.flat(baseg, eye & (Y == 3), "iron", 3)
    front, back = Grid(30, 18, 30), Grid(30, 18, 30)
    trap_jaw(front, cx, cz, -1)
    trap_jaw(back, cx, cz, 1)
    root = assemble({"base": baseg, "jaw": front, "jaw-back": back},
                    [("base", None, (cx, 0, cz)), ("jaw", "base", (cx, hy, cz)), ("jaw-back", "base", (cx, hy, cz))])
    for part in root.children:
        part.rot = (-TRAP_OPEN, 0.0, 0.0) if part.name == "jaw" else (TRAP_OPEN, 0.0, 0.0)
    o = TRAP_OPEN
    close = Clip("close", {"jaw": {"rot": keys((0, (0, 0, 0)), (.5, (o, 0, 0)), (.8, (o, 0, 0)))},
                           "jaw-back": {"rot": keys((0, (0, 0, 0)), (.5, (-o, 0, 0)), (.8, (-o, 0, 0)))}}, loop=False)
    open_ = Clip("open", {"jaw": {"rot": keys((0, (o, 0, 0)), (.7, (0, 0, 0)))},
                          "jaw-back": {"rot": keys((0, (-o, 0, 0)), (.7, (0, 0, 0)))}}, loop=False)
    idle = Clip("idle", {"jaw": {"rot": keys((0, (0, 0, 0)), (1, (2, 0, 0)), (2, (0, 0, 0)))},
                         "jaw-back": {"rot": keys((0, (0, 0, 0)), (1, (-2, 0, 0)), (2, (0, 0, 0)))}})
    return world("werewolf-trap", "props", "Werewolf Trap", root, clips=[open_, close, idle],
                 sockets=[Socket("socket-teeth", at=(0, hy + 4.0, 0), parent="base")],
                 pfx=[pfx("rvx-monster-blood-splat", "socket-teeth", "clip:close", size=18, at=.42)])


# ---------------------------------------------------------------- slab
def mortuary_slab():
    """A stone slab on four stone legs with a covered body, a gutter, a toe
    tag and a bucket under the drain."""
    W, D = 38, 46
    g = Grid(W, 26, D)
    X, Y, Z = idx(g)
    for x in (7, 26):
        for z in (10, 32):
            leg = box(g, x, 0, z, x + 5, 11, z + 5, "stone", 4)
            P.stone(g, leg, "stone", 4, block=(5, 3), seed=x + z)
            P.flat(g, edges(leg), "stone", 3)
            P.flat(g, leg & (Y == 0), "stone", 2)
            blotch(g, leg & (Y < 3), "moss", 4, cell=2, chance=0.2, seed=x * z)
    top = box(g, 4, 11, 5, 34, 14, 42, "stone", 5)
    P.stone(g, top, "stone", 5, block=(8, 5), seed=2)
    P.flat(g, edges(top), "stone", 3)
    P.flat(g, top & (Y == 11), "stone", 3)
    # A gutter runs round the top and ends in a drain at the foot.
    gut = top & (Y == 13) & (((X == 5) | (X == 32)) & (Z > 5) & (Z < 41) | ((Z == 6) | (Z == 40)) & (X > 4) & (X < 33))
    P.flat(g, gut, "stone", 2)
    P.flat(g, gut & (Z > 34), "blood", 3)
    P.flat(g, top & (Z == 41) & (np.abs(X + 0.5 - 19) < 1.2) & (Y > 11), "blood", 3)
    # The sheet over the body: shoulders, torso and feet.
    start = len(g.solids)
    for pts, z0, z1 in (([(10, 14), (28, 14), (26, 19), (23, 21), (15, 21), (12, 19)], 14, 23),
                        ([(12, 14), (26, 14), (25, 19), (20, 21), (14, 18)], 23, 32),
                        ([(14, 14), (25, 14), (24, 18), (17, 18)], 32, 39)):
        g.prism("z", pts, z0, z1, C("bone", 5))
    g.ellipsoid(19, 18, 11, 5, 4, 4, C("bone", 5))
    sheet = union(g, start) | ((g.a > 0) & (np.hypot(X + 0.5 - 19, Z + 0.5 - 11) < 5.5) & (Y >= 14))
    P.flat(g, sheet, "bone", 5)
    P.flat(g, sheet & (Y >= 19), "bone", 6)
    P.flat(g, sheet & (Y == 14), "bone", 3)
    P.flat(g, sheet & S.seams(g, g.solids[start:start + 3], 0.8), "bone", 4)
    P.flat(g, sheet & ((Z % 5) == 0) & (Y < 19), "bone", 4)  # folds hang down the sides
    P.flat(g, sheet & (np.abs(X + 0.5 - 21) < 1.5) & (Z > 24) & (Z < 29) & (Y >= 18), "blood", 4)
    # Leather straps with iron buckles.
    for z in (19, 29):
        for b in (box(g, 8, 14, z, 30, 15, z + 2, "darkwood", 3), box(g, 10, 15, z, 13, 20, z + 2, "darkwood", 3),
                  box(g, 25, 15, z, 28, 20, z + 2, "darkwood", 3), box(g, 12, 20, z, 26, 21, z + 2, "darkwood", 3)):
            P.flat(g, b & (Y == 20), "darkwood", 5)
        P.flat(g, (g.a > 0) & (np.abs(X + 0.5 - 24) < 1.0) & (Y == 20) & (Z >= z) & (Z < z + 2), "gray", 6)
    # The toe tag hangs from the feet on a string.
    box(g, 22, 15, 39, 23, 18, 40, "sand", 3)
    tag = box(g, 21, 12, 40, 25, 15, 41, "sand", 6)
    P.outline(g, tag, "sand", 3, normal="z")
    P.flat(g, tag & (Y == 13) & (X > 21) & (X < 24), "blood", 3)
    # An iron bucket under the drain catches the drips.
    S.cone(g, "y", 19, 42.5, 2.4, 0, 4, "iron", 4, r_top=2.9)
    bk = g.solids[-1].mask(g.shape)
    P.plates(g, bk, "iron", 4, size=(4, 2), seed=20)
    P.flat(g, bk & (Y == 3), "iron", 6)
    P.flat(g, bk & (Y == 3) & (np.hypot(X + 0.5 - 19, Z + 0.5 - 42.5) < 1.8), "blood", 3)
    socks = [Socket("socket-detail", at=(19 - W / 2, 16.0, 30 - D / 2))]
    return single("mortuary-slab", "props", "Mortuary Slab", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-detail", "idle", size=12)])


# ---------------------------------------------------------------- scrolls
def scroll(g, y, z, x0, x1, r, seed):
    """One rolled scroll along x: cream paper with a darker edge tone, a
    spiral line on the ends, a purple tie and wooden end knobs."""
    X, Y, Z = idx(g)
    S.disc(g, "x", y, z, r, x0, x1, "sand", 5, n=8)
    paper = g.solids[-1].mask(g.shape)
    P.flat(g, paper, "sand", 5)
    P.flat(g, paper & (Y + 0.5 > y + r * 0.4), "sand", 6)
    P.flat(g, paper & (Y + 0.5 < y - r * 0.5), "sand", 4)
    P.flat(g, paper & ((X == int(x0)) | (X == int(x1) - 1)), "sand", 3)
    ends = paper & ((X == int(x0)) | (X == int(x1) - 1))
    rad = np.hypot(Y + 0.5 - y, Z + 0.5 - z)
    P.flat(g, ends & (np.abs(rad - r * 0.55) < 0.45), "sand", 2)
    P.flat(g, paper & (np.abs(X + 0.5 - (x0 + x1) / 2 - (seed % 3 - 1) * 2) < 1.0), "purple", 4)
    for kx in (x0 - 1.0, x1):
        S.disc(g, "x", y, z, 1.3, kx, kx + 1.0, "darkwood", 5, n=6)
        S.disc(g, "x", y, z, 0.9, kx - 0.6 if kx < x0 else kx + 1.0, kx if kx < x0 else kx + 1.6, "wood", 5, n=6)
    return paper


def scroll_pile():
    """Rolled scrolls on a dirt patch, one open sheet with glyphs and a wax
    seal, a quill, and a short candle."""
    W, D = 36, 32
    g = Grid(W, 24, D)
    X, Y, Z = idx(g)
    patch(g, 18, 16, 16, 14, h=1, ramp="wood", base=3, moss=0.25, seed=21)
    scroll(g, 3.8, 9.0, 6, 26, 2.8, 1)
    scroll(g, 3.4, 25.0, 9, 27, 2.4, 2)
    scroll(g, 8.6, 9.6, 9, 24, 2.3, 3)   # it rests on the first scroll
    # The open sheet, flat on the patch, with a roll at each end.
    sheet = box(g, 7, 1, 13, 29, 2, 22, "sand", 6)
    P.flat(g, sheet & ((X == 7) | (X == 28) | (Z == 13) | (Z == 21)), "sand", 4)
    # Lines of purple writing, and a big sigil ring at the left.
    for row, lz in enumerate((14, 16, 18, 20)):
        x = 17 + row % 2
        for k in range(5):
            n = 2 + (row * 3 + k * 5) % 3
            if x + n > 27:
                break
            P.flat(g, sheet & (Y == 1) & (Z == lz) & (X >= x) & (X < x + n), "purple", 2)
            x += n + 1
    rad = np.hypot(X + 0.5 - 12.0, Z + 0.5 - 17.5)
    P.flat(g, sheet & (Y == 1) & (np.abs(rad - 2.9) < 0.5), "magenta", 4)
    P.flat(g, sheet & (Y == 1) & (rad < 1.2), "magenta", 5)
    S.disc(g, "y", 25.5, 19.0, 1.8, 2, 2.9, "blood", 4, n=8)  # the wax seal
    seal = g.solids[-1].mask(g.shape)
    P.outline(g, seal, "blood", 2, normal="y")
    P.flat(g, seal & (np.hypot(X + 0.5 - 25.5, Z + 0.5 - 19.0) < 0.8), "blood", 6)
    S.disc(g, "z", 7.0, 2.2, 1.3, 12.5, 22.5, "sand", 5, n=8)
    P.flat(g, g.solids[-1].mask(g.shape) & (Y == 3), "sand", 6)
    S.disc(g, "z", 29.0, 2.2, 1.3, 12.5, 22.5, "sand", 5, n=8)
    P.flat(g, g.solids[-1].mask(g.shape) & (Y == 3), "sand", 6)
    # A quill lies across the sheet: a white vane on a thin shaft.
    S.bar(g, "y", (15, 21), (22, 15.5), 0.9, 2, 2.9, "darkwood", 4)
    g.prism("y", [(17.5, 18.4), (20.5, 15.6), (22.3, 15.2), (19.0, 19.6)], 2, 3, C("bone", 7))
    P.flat(g, g.solids[-1].mask(g.shape) & (np.abs((X + 0.5 - 17.5) * 0.8 + (Z + 0.5 - 18.4)) < 0.6), "bone", 5)
    # A short candle in a gold dish at the back.
    S.disc(g, "y", 30.0, 8.0, 2.6, 0.1, 2, "gold", 4, n=8)
    P.outline(g, g.solids[-1].mask(g.shape), "gold", 2, normal="y")
    wax = box(g, 29, 2, 7, 31.4, 8, 9.4, "purple", 5)
    P.flat(g, wax & (Y == 7), "bone", 6)
    P.flat(g, wax & (X == 29) & (Y > 4), "bone", 6)
    P.flat(g, edges(wax), "purple", 3)
    g.box(30, 8, 8, 31, 9, 9, C("iron", 2))
    from _props import pn_flame, TOXIC
    pn_flame(g, 30.2, 8.2, 9, 3.2, 5.0, kind="small", colors=TOXIC)
    tufts(g, [(8, 11), (28, 22), (10, 24)], y0=1)
    socks = [Socket("socket-detail", at=(30.2 - W / 2, 11.0, 8.2 - D / 2))]
    return single("spell-scroll-pile", "props", "Spell Scroll Pile", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-detail", "idle", size=12)])


# ---------------------------------------------------------------- egg sac
def egg_sac():
    """Three silk egg sacs on a web over a mossy patch. Silk strands wrap
    every sac; one sac has split and glows toxic green inside."""
    W, D = 38, 34
    g = Grid(W, 26, D)
    X, Y, Z = idx(g)
    patch(g, 19, 17, 17, 15, h=1, ramp="wood", base=3, moss=0.4, seed=22)
    sacs = ((10, 10, 5), (26, 12, 6), (17, 24, 6))
    split = None
    for i, (x, z, r) in enumerate(sacs):
        y = 1 + r * 1.5
        start = len(g.solids)
        g.prism("y", S.flat_ngon(x, z, 1.2, 8), 1, y, C("bone", 5), top=S.flat_ngon(x, z, r, 8))
        g.prism("y", S.flat_ngon(x, z, r, 8), y, y + r * 0.9, C("bone", 5), top=S.flat_ngon(x, z, r * 0.65, 8))
        g.prism("y", S.flat_ngon(x, z, r * 0.65, 8), y + r * 0.9, y + r * 1.5, C("bone", 5), top=S.flat_ngon(x, z, 0.8, 8))
        m = union(g, start)
        # Soft ramp: dark at the foot, light at the crown.
        P.flat(g, m, "bone", 5)
        P.flat(g, m & (Y < y - r * 0.6), "bone", 4)
        P.flat(g, m & (Y > y + r * 0.5), "bone", 6)
        P.flat(g, m & S.seams(g, g.solids[start:], 0.7), "bone", 4)
        # Two silk strands wrap round the sac as clean rings.
        for yb in (int(y - r * 0.3), int(y + r * 0.45)):
            P.flat(g, m & (Y == yb), "bone", 7)
            P.flat(g, m & (Y == yb - 1), "bone", 4)
        if i == 1:
            split = (x, y, z, r)
            slit = m & (np.abs(X + 0.5 - x - (Y + 0.5 - y) * 0.25) < 1.1) & (np.abs(Y + 0.5 - y) < r * 0.8) & (Z + 0.5 < z - r * 0.4)
            P.flat(g, slit, "toxic", 6)
            P.flat(g, slit & (np.abs(Y + 0.5 - y) < r * 0.4), "toxic", 7)
    # The web on the ground: two rings of strands and three spokes. They
    # lie in the patch and start 0.3 above the floor, so their bottoms are
    # not in the plane of the patch bottom.
    def shrink(pt):  # keep every strand on the patch
        return (19 + (pt[0] - 19) * 0.7, 17 + (pt[1] - 17) * 0.7)
    web = [shrink(p) for p in ((5, 7), (18, 5), (32, 9), (30, 23), (19, 30), (7, 25))]
    for k in range(2):
        pts = [(19 + (x - 19) * (1 - k * .2), 17 + (z - 17) * (1 - k * .2)) for x, z in web]
        for i, a in enumerate(pts):
            S.bar(g, "y", a, pts[(i + 1) % 6], 1.0, 0.3, 1.9, "bone", 6 + k)
    for a, b in ((web[0], web[3]), (web[1], web[4]), (web[2], web[5])):
        S.bar(g, "y", a, b, 1.0, 0.3, 1.9, "bone", 6)
    # Sagging strands join the sacs into one nest.
    S.bar(g, "z", (10, 9), (18, 6), 1.0, 9, 10, "bone", 6)
    S.bar(g, "z", (18, 6), (26, 10), 1.0, 9, 10, "bone", 6)
    S.bar(g, "x", (9, 12), (6, 18), 1.0, 14, 15, "bone", 6)
    S.bar(g, "x", (6, 18), (10, 23), 1.0, 14, 15, "bone", 6)
    x, y, z, r = split
    socks = [Socket("socket-detail", at=(x - W / 2, y, z - r - D / 2))]
    return single("spider-egg-sac", "props", "Spider Egg Sac", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-detail", "idle", size=12)])


# ---------------------------------------------------------------- statue
def statue():
    """A hooded skull figure in grey stone on a broken flagstone. The right
    shoulder is broken off; the arm lies at the foot. Painted cracks run
    over the robe, and moss grows in the low folds."""
    W, D = 36, 32
    g = Grid(W, 50, D)
    X, Y, Z = idx(g)
    # A broken flagstone, two voxels thick, with an irregular outline.
    g.prism("y", [(5, 5), (17, 3), (31, 6), (32, 18), (29, 28), (16, 29), (6, 26), (3, 15)], 0, 2, C("stone", 5))
    flag = g.solids[-1].mask(g.shape)
    P.stone(g, flag, "stone", 4, block=(7, 5), cracks=0.15, seed=23)
    P.flat(g, edges(flag) & (Y == 1), "stone", 4)
    blotch(g, flag & (Y == 1), "moss", 4, cell=2, chance=0.25, seed=24)
    # The robe: one faceted prism with a fractured right shoulder.
    start = len(g.solids)
    dy = -2
    g.prism("z", [(8, 5 + dy), (29, 5 + dy), (25, 20 + dy), (27, 30 + dy), (22, 34 + dy), (21, 29 + dy),
                  (18, 33 + dy), (12, 34 + dy), (9, 29 + dy)], 11, 22, C("stone", 6))
    for x in (12, 18, 24):
        g.prism("z", [(x - 2, 6 + dy), (x + 2, 6 + dy), (x + 1, 24 + dy), (x, 29 + dy)], 9, 12, C("stone", 5))
    robe = union(g, start)
    robe_solids = g.solids[start:]
    P.flat(g, robe, "stone", 6)
    P.flat(g, robe & (Y < 10), "stone", 5)
    P.flat(g, robe & (Y > 25), "stone", 7)
    P.flat(g, robe & (Z < 11) & (Y <= 25), "stone", 5)  # the pleats sit in shade
    P.flat(g, robe & S.seams(g, robe_solids, 0.8), "stone", 4)
    # The skull head.
    start = len(g.solids)
    S.skull(g, 17, 34 + dy, 15, s=11, ramp="stone", base=6, eyes=("purple", 2), socket=("purple", 2))
    head = union(g, start)
    stone_shades = np.isin(g.a, [C("stone", s) for s in range(8)])
    P.flat(g, head & stone_shades, "stone", 6)
    P.flat(g, head & stone_shades & (Y > 39 + dy), "stone", 7)
    P.flat(g, head & stone_shades & (Y < 36 + dy), "stone", 5)
    P.flat(g, head & S.seams(g, g.solids[start:], 0.7) & stone_shades, "stone", 4)
    # The left arm holds the robe; the broken right arm lies at the foot.
    branch(g, [(11, 31 + dy, 16), (6, 24 + dy, 15), (8, 19 + dy, 12)], 2.7, "stone", 6)
    arm = (g.a > 0) & ~robe & ~head & ~flag & (Y >= 15) & (X < 12)
    P.flat(g, arm, "stone", 6)
    P.flat(g, arm & (Y < 20), "stone", 5)
    rk = rock(g, 28, 23, 4, 3, 2, 4, 1, "stone")
    P.flat(g, rk, "stone", 5)
    P.flat(g, rk & (Y == 5), "stone", 6)
    P.flat(g, rk & (X > 30), "stone", 4)
    # The fracture face on the right shoulder is pale, fresh stone.
    P.flat(g, robe & (X > 22) & (Y > 26 + dy) & (Y < 33 + dy) & (X < 27), "stone", 7)
    # Painted cracks: dark lines with a pale lip on one side (front, back
    # and side faces).
    cracks_xy = ([(20, 31), (18, 26), (21, 21), (19, 16), (22, 11)], [(11, 27), (13, 22), (11, 17)],
                 [(25, 9), (23, 6), (26, 3)])
    for pts in cracks_xy:
        line = seg_mask(X, Y, [(u, v + dy) for u, v in pts])
        lip = seg_mask(X - 1, Y, [(u, v + dy) for u, v in pts])
        P.flat(g, (robe | head) & lip & ~line, "stone", 7)
        P.flat(g, (robe | head) & line, "stone", 2)
    for pts in ([(13, 30), (16, 24), (14, 18), (17, 12)], [(18, 40), (16, 37)]):
        line = seg_mask(Z, Y, [(u, v + dy) for u, v in pts])
        P.flat(g, (robe | head) & line, "stone", 2)
    P.flat(g, head & seg_mask(X, Y, [(15, 43 + dy), (17, 40 + dy), (16, 38 + dy)]) & (Z < 15), "stone", 2)
    # Moss in the low folds and in the crack ends.
    blotch(g, robe & (Y < 9), "moss", 4, cell=2, chance=0.28, seed=25)
    P.flat(g, robe & seg_mask(X, Y, [(25, 7), (23, 4), (26, 1)], 0.9), "moss", 5)
    socks = [Socket("socket-detail", at=(17 - W / 2, 38.0 + dy, 9 - D / 2))]
    return single("cracked-statue", "props", "Cracked Statue", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-detail", "idle", size=12)])


# ---------------------------------------------------------------- wheel
def wagon_wheel():
    """A broken wagon wheel stands on a dirt patch against a rock. Planked
    felloes, an iron tyre with rivets, wooden spokes and an iron-banded
    hub; one arc of the wheel is missing and a spoke lies in the grass."""
    W, D = 38, 28
    g = Grid(W, 34, D)
    X, Y, Z = idx(g)
    patch(g, 19, 14, 17, 12, h=1, ramp="wood", base=3, moss=0.35, seed=26)
    cu, cv = 17.0, 15.0
    z0, z1 = 10, 13
    a0, a1 = 0.95, 6.0
    start = len(g.solids)
    ring(g, "z", cu, cv, 14, 3, z0, z1, "wood", 5, start=a0, end=a1, n=17)
    rim = union(g, start)
    start = len(g.solids)
    ring(g, "z", cu, cv, 14.7, 1, z0, z1, "iron", 4, start=a0, end=a1, n=17)
    tyre = union(g, start)
    ang = np.mod(np.arctan2(Y + 0.5 - cv, X + 0.5 - cu), math.tau)
    rad = np.hypot(X + 0.5 - cu, Y + 0.5 - cv)
    rim &= ~tyre
    P.flat(g, rim, "wood", 5)
    P.flat(g, rim & (rad < 12.0), "wood", 4)
    P.flat(g, rim & ((Z == z0) | (Z == z1 - 1)) & (np.abs(rad - 12.8) < 0.5), "wood", 3)
    for k in range(6):  # felloe joints with a nail at each side
        aj = a0 + 0.4 + k * 0.85
        d = np.abs(ang - aj) * rad
        P.flat(g, rim & (d < 0.6), "wood", 2)
        P.flat(g, rim & (np.abs(d - 1.4) < 0.5) & (np.abs(rad - 12.6) < 0.6) & (Z == z0), "iron", 6)
    P.flat(g, tyre, "iron", 5)
    P.flat(g, tyre & ((Z == z0) | (Z == z1 - 1)), "iron", 3)
    for k in range(12):
        ar = a0 + 0.2 + k * 0.42
        P.flat(g, tyre & (np.abs(ang - ar) * rad < 0.6) & (Z == z0 + 1), "iron", 7)
    blotch(g, tyre, "rust", 3, cell=3, chance=0.1, seed=27)
    for k, a in enumerate((1.2, 1.95, 2.7, 3.45, 4.2, 4.95, 5.7)):
        end = (cu + math.cos(a) * 11.5, cv + math.sin(a) * 11.5)
        sp = S.bar(g, "z", (cu, cv), end, 1.6, z0 + 0.5, z1 - 0.5, "wood", 5)
        sp &= ~rim
        P.flat(g, sp, "wood", 5)
        P.flat(g, sp & ((Z == z0) | (Z == z1 - 1)), "wood", 4)
        P.flat(g, sp & (np.abs(rad - 4.5 - k % 3 * 2) < 0.5), "wood", 3)  # a grain knot
    sp = S.bar(g, "z", (cu, cv), (cu + 6, cv + 4), 1.6, z0 + 0.5, z1 - 0.5, "wood", 4)  # the broken spoke
    P.flat(g, sp & (rad > 6.0), "wood", 6)
    # The hub: a short wooden drum with two iron bands and a gold axle cap.
    S.disc(g, "z", cu, cv, 3.4, z0 - 2, z1 + 2, "wood", 4, n=8)
    hub = g.solids[-1].mask(g.shape)
    P.flat(g, hub, "wood", 4)
    P.flat(g, hub & ((Z == z0 - 2) | (Z == z1 + 1) | (Z == z0) | (Z == z1 - 1)), "iron", 4)
    P.flat(g, hub & (rad < 1.4), "gold", 5)
    P.flat(g, hub & (rad < 0.7), "gold", 3)
    rk = rock(g, 25, 18, 5, 5, 1, 8, 2)
    P.flat(g, rk & (Y < 3), "gray", 3)
    branch(g, [(24.0, 2.2, 5.5), (29.0, 2.4, 8.5)], 1.1, "wood", 5)  # a loose spoke in the grass
    tufts(g, [(8, 9), (29, 20), (10, 19), (28, 10)], y0=1)
    socks = [Socket("socket-detail", at=(cu - W / 2, cv, z0 - 2 - D / 2))]
    return single("broken-wagon-wheel", "props", "Broken Wagon Wheel", g, sockets=socks,
                  pfx=[pfx("rvx-monster-spore-glow", "socket-detail", "idle", size=12)])


BUILDERS = {
    "brain-jar": brain_tank,
    "eyeball-jar": eye_jar,
    "werewolf-trap": trap,
    "mortuary-slab": mortuary_slab,
    "spell-scroll-pile": scroll_pile,
    "spider-egg-sac": egg_sac,
    "cracked-statue": statue,
    "broken-wagon-wheel": wagon_wheel,
}


def build(category, slug):
    if category != "props":
        raise KeyError(f"_rep_props builds props only, not {category}/{slug}")
    try:
        builder = BUILDERS[slug]
    except KeyError as exc:
        raise KeyError(f"_rep_props has no builder for props/{slug}") from exc
    return builder()
