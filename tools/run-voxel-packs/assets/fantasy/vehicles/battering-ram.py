"""Battering ram in the Pirate Nation style.

A siege shed on four heavy wheels. A steep gable roof of stitched hides
(rule F4: the roof is two thirds of the height) comes down low over the
wheels on oak posts and sills; lashings cross the ridge and the hides carry
a painted red-and-gold war band (rules S1, C3). Under the ridge beam two
iron chains carry the ram: a long iron-banded oak log that runs out 26
voxels past the front of the shed and ends in a big iron ram's head with
curled gold horns and red eyes (the function prop, rule F6). A painted
war shield closes the top of the front gable, and a plank panel closes the
top of the back gable.

On `idle` the log swings a little on its chains. On `attack` it draws back
and up on the chains, then swings forward and strikes (PFX at the head).
The chains turn on their hinges and the log stays level, like a real
pendulum ram. About 53 wide, 70 tall and 102 long. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _bld import icon_on
from _props import coords, plank_box
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket

SZ = (64, 72, 112)
CX = 32.0
WR, NSIDE = 10.0, 10  # wheel flat radius and sides
WHEEL_Z = (42.0, 86.0)
WHEEL_X = {"l": (CX - 23, CX - 19), "r": (CX + 19, CX + 23)}
SILL0, SILL1 = 12, 17  # sill bottom and top
FZ, BZ = 30, 98  # front and back of the shed frame
EAVE = (25.5, 22.0)  # roof eave: half width and height of the roof centre line
RIDGE = 65.0  # roof centre line at the ridge
RT = 3.0  # roof thickness
BEAM0 = 56.0  # bottom of the ridge beam (the chain hinges)
LOG_Y, LOG_R = 32.0, 5.0  # log centre height and radius
LOG_Z0, LOG_Z1 = 16.0, 94.0  # log front (behind the ram's head) and back
CHAIN_Z = (46.0, 82.0)
L = BEAM0 - LOG_Y  # pendulum length


def hide(g: Grid, m: np.ndarray, frame, seed: int) -> None:
    """Stitched hides: patches 11 x 8 in three close warm tones (rule S3),
    a dark seam round each patch and dashed stitches on the seams."""
    U, V = P.uv(g, frame)
    off = (U // 11) % 2 * 4
    pu, pv = U // 11, (V + off) // 8
    tone = (P._hash(pu, pv, seed=seed) % np.uint64(3)).astype(np.int64)
    seam = (U % 11 == 0) | ((V + off) % 8 == 0)
    stitch = seam & (((U % 11 == 0) & (V % 2 == 0)) | (((V + off) % 8 == 0) & (U % 2 == 0)))
    P._paint(g, m & (tone == 0), "wood", np.full(g.shape, 5))
    P._paint(g, m & (tone == 1), "wood", np.full(g.shape, 6))
    P._paint(g, m & (tone == 2), "sand", np.full(g.shape, 4))
    P.flat(g, m & seam, "wood", 4)
    P.flat(g, m & stitch, "darkwood", 3)


def wheels(g: Grid) -> None:
    for z in WHEEL_Z:
        for side in ("l", "r"):
            x0, x1 = WHEEL_X[side]
            S.wheel(g, "x", z, 0, WR, int(x0), int(x1), n=NSIDE, spokes=5, gaps=True, tyre=("iron", 4), rim=("darkwood", 4),
                    spoke=("wood", 4), hub=("gold", 5), rim_w=2.6, hub_r=2.6, hub_out=0.8)
        ax = box(g, CX - 19, WR - 1.5, z - 1.5, CX + 19, WR + 1.5, z + 1.5, "darkwood", 3)
        P.planks(g, ax, "darkwood", 3, width=3, across="y", nails=False, seed=int(z))


def frame(g: Grid) -> None:
    """Sills, cross beams, posts, braces and the ridge beam (rule F3)."""
    X, Y, Z = coords(g)
    for s in (-1, 1):
        sill = plank_box(g, CX + s * 16 - 2.5, SILL0, FZ, CX + s * 16 + 2.5, SILL1, BZ, "darkwood", 4, across="y", width=2, seed=11 + s)
        P.flat(g, sill & ((np.floor(Z).astype(int) - FZ) % 17 == 2) & (Y > SILL0 + 1) & (Y < SILL1 - 1), "iron", 5)  # bolt heads
        for z in (FZ + 1.0, (FZ + BZ) / 2, BZ - 4.0):
            post = plank_box(g, CX + s * 16 - 1.5, SILL1, z, CX + s * 16 + 1.5, 36, z + 3, "wood", 4, across="x", width=3, frame=("darkwood", 3), nails=False, seed=int(z))
        # a long diagonal brace on each side, between the posts (true slope)
        for (za, zb) in ((FZ + 4.0, (FZ + BZ) / 2 - 1), ((FZ + BZ) / 2 + 3, BZ - 5.0)):
            br = S.bar(g, "x", (SILL1 + 1, za), (34.0, zb), 2.6, CX + s * 16 - 1.0, CX + s * 16 + 1.0, "wood", 5)
            P.flat(g, br & (Y > 32), "wood", 6)
    for z0 in (FZ, BZ - 4):
        cross = plank_box(g, CX - 14, SILL0 + 1, z0, CX + 14, SILL1 - 1, z0 + 4, "darkwood", 3, across="y", width=2, seed=z0)
    ridge = plank_box(g, CX - 2, BEAM0, FZ - 1, CX + 2, BEAM0 + 5, BZ + 1, "darkwood", 4, across="y", width=2, seed=21)
    # collar beams that carry the gable panels, above the swing of the log
    for z0 in (FZ - 1, BZ - 1):
        y0 = 43
        half = EAVE[0] - (y0 - EAVE[1]) * EAVE[0] / (RIDGE - EAVE[1]) - 1.0
        plank_box(g, CX - half, y0, z0, CX + half, y0 + 3, z0 + 3, "darkwood", 4, across="y", width=3, seed=z0 + 1)


def roof(g: Grid) -> None:
    """Two steep hide slabs on the frame, lashings over the ridge, a ridge
    cap and a painted war band along both slopes."""
    X, Y, Z = coords(g)
    start = len(g.solids)
    z0, z1 = FZ - 3, BZ + 3
    for s in (-1, 1):
        S.bar(g, "z", (CX + s * EAVE[0], EAVE[1]), (CX - s * 1.0, RIDGE + 0.6), RT, z0, z1, "sand", 4)
    solids = g.solids[start:]
    slab = np.logical_or.reduce([sd.mask(g.shape) for sd in solids])
    for k, (fm, fr) in enumerate(S.facets(g, solids)):
        hide(g, fm, fr, 31 + k)
    # the hide edges: a dark lower hem with lacing and dark gable edges (rule S4)
    P.flat(g, slab & (Y < EAVE[1] + 2.5), "darkwood", 3)
    P.flat(g, slab & (Y < EAVE[1] + 2.5) & (np.floor(Z).astype(int) % 3 == 0), "sand", 6)
    P.flat(g, slab & ((Z < z0 + 1) | (Z > z1 - 1)), "darkwood", 4)
    # a red war band with gold rims along both slopes, and gold studs on it
    band = slab & (Y > 38) & (Y < 44)
    P.flat(g, band, "red", 4)
    P.flat(g, band & ((Y < 39) | (Y > 43)), "gold", 5)
    P.flat(g, band & (Y > 40) & (Y < 42) & (np.floor(Z).astype(int) % 6 == 0), "gold", 6)
    # the ridge cap and rope lashings that cross the ridge
    cap = box(g, CX - 2.5, RIDGE - 1, z0 - 1, CX + 2.5, RIDGE + 2.5, z1 + 1, "darkwood", 4)
    P.planks(g, cap, "darkwood", 4, width=3, across="y", length=(30, 40), nails=True, seed=41)
    P.flat(g, edges(cap), "darkwood", 2)
    for z in range(int(z0) + 8, int(z1) - 4, 14):
        for s in (-1, 1):
            S.bar(g, "z", (CX + s * 2.5, RIDGE - 1.4), (CX + s * 10.0, RIDGE - 13.7), 1.2, z, z + 1.5, "sand", 3)


def gables(g: Grid) -> None:
    """A war shield on the front gable panel and a plank back gable."""
    X, Y, Z = coords(g)
    y0 = 46.0
    half = EAVE[0] - (y0 - EAVE[1]) * EAVE[0] / (RIDGE - EAVE[1])
    tri = [(CX - half + 0.5, y0), (CX + half - 0.5, y0), (CX, RIDGE - 1.0)]
    panels = []
    for z in (FZ - 1.0, BZ):
        g.prism("z", tri, z, z + 2, C("wood", 5))
        m = S.last(g)
        panels.append(m)
        P.planks(g, m, "wood", 5, width=3, across="x", nails=True, seed=int(z))
        P.flat(g, m & (Y < y0 + 1), "darkwood", 3)
    # the war shield painted on the front gable (red field, gold rim, gold crown)
    face = panels[0] & (Z < FZ) & (Y > y0 + 1) & (Y < RIDGE - 3) & (np.abs(X - CX) < 6.5)
    shape = face & (np.abs(X - CX) < 6.5 - np.maximum(0, (y0 + 6 - Y)) * 0.9)
    P.flat(g, shape, "gold", 5)
    inner = shape & (np.abs(X - CX) < 5.0 - np.maximum(0, (y0 + 7 - Y)) * 0.9) & (Y > y0 + 2.5) & (Y < RIDGE - 5)
    P.flat(g, inner, "red", 4)
    icon_on(g, inner, np.floor(X).astype(int), np.floor(Y).astype(int), int(CX) - 3, int(y0) + 6, "crown", "gold", 6, flip=True)


def ram() -> tuple[Grid, tuple]:
    """The log, its iron bands and chain rings, and the iron ram's head."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    g.prism("z", S.flat_ngon(CX, LOG_Y, LOG_R, 8, facing=-math.pi / 2), LOG_Z0, LOG_Z1, C("wood", 4))
    log = S.last(g)
    for k, (fm, fr) in enumerate(S.facets(g, [g.solids[-1]])):
        P.planks(g, fm, "wood", 4, width=3, across="y", length=(20, 30), nails=False, frame=fr, seed=50 + k)
    rr = S.radial(g, "z", CX, LOG_Y)
    end = log & (Z > LOG_Z1 - 1)
    P.flat(g, end, "wood", 6)  # the sawn end with growth rings
    P.flat(g, end & ((np.floor(rr * 1.4).astype(int) % 2) == 0), "wood", 5)
    P.flat(g, end & (rr < 1.2), "darkwood", 4)
    for zb in (LOG_Z0 + 6, CHAIN_Z[0] - 1.5, (CHAIN_Z[0] + CHAIN_Z[1]) / 2, CHAIN_Z[1] - 1.5, LOG_Z1 - 4):
        band = S.disc(g, "z", CX, LOG_Y, LOG_R + 0.6, zb, zb + 3, "steel", 3, n=8)
        P.flat(g, band & (np.floor(X + Y).astype(int) % 3 == 0), "steel", 5)
    for zc in CHAIN_Z:  # the chain rings on top of the log
        box(g, CX - 1, LOG_Y + LOG_R, zc - 1, CX + 1, LOG_Y + LOG_R + 2, zc + 1, "iron", 5)
    # the ram's head: a tapered iron skull with a blunt brow plate
    hz0 = LOG_Z0 + 0.5
    g.prism("z", S.flat_ngon(CX, LOG_Y + 0.5, 4.6, 8, facing=-math.pi / 2), 4.0, hz0, C("steel", 3),
            top=S.flat_ngon(CX, LOG_Y, LOG_R + 1.6, 8, facing=-math.pi / 2))
    head = S.last(g)
    for k, (fm, fr) in enumerate(S.facets(g, [g.solids[-1]])):
        P.plates(g, fm, "steel", 3, size=(5, 4), frame=fr, seed=60 + k)
    brow = box(g, CX - 4, LOG_Y - 3, 2, CX + 4, LOG_Y + 5, 4, "steel", 4)
    P.flat(g, edges(brow), "steel", 2)
    P.flat(g, brow & (np.abs(X - CX) < 2) & (Y > LOG_Y), "steel", 5)
    # red glowing eyes on both cheeks
    for s in (-1, 1):
        eye = head & (np.abs(X - (CX + s * 3.6)) < 1.2) & (np.abs(Y - (LOG_Y + 2.2)) < 0.9) & (np.abs(Z - 9.5) < 1.2)
        P.flat(g, eye, "red", 6)
    # curled gold horns: short true-slope segments that spiral in on each side
    for s in (-1, 1):
        x0 = CX + s * 5.5
        pts = []
        for k in range(9):
            a = math.radians(100 - k * 46)
            rad = 6.6 - k * 0.5
            pts.append((LOG_Y + 1.5 + rad * math.sin(a), 12.0 + rad * math.cos(a)))
        for k, (p0, p1) in enumerate(zip(pts, pts[1:])):
            th = 3.4 - k * 0.25
            lo, hi = (x0, x0 + s * 3.0) if s > 0 else (x0 + s * 3.0, x0)
            hm = S.bar(g, "x", p0, p1, th, lo, hi, "gold", 4 + (k % 2))
            P.flat(g, hm & (np.floor(Y + Z).astype(int) % 3 == 0), "gold", 3)
    tip = (CX, LOG_Y, 2.0)
    return g, tip


def chain(zc: float) -> Grid:
    """A chain of iron links from the ridge beam down to the log ring."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    top, bottom = BEAM0, LOG_Y + LOG_R + 1.0
    m = box(g, CX - 0.8, bottom, zc - 0.8, CX + 0.8, top, zc + 0.8, "iron", 5)
    links = np.floor(Y).astype(int) % 4
    P.flat(g, m & (links == 0), "iron", 3)
    P.flat(g, m & (links == 2), "steel", 4)
    hook = box(g, CX - 1.5, top - 1, zc - 1.5, CX + 1.5, top, zc + 1.5, "iron", 4)
    return g


def swing(phi_keys, seconds: float):
    """Per-frame pendulum keys for the log ('loc') and the chains ('rot')
    from (t, degrees) keys, eased between keys."""
    frames = round(seconds * 30)
    log, chains = [], []
    for i in range(frames + 1):
        t = seconds * i / frames
        for (t0, a0), (t1, a1) in zip(phi_keys, phi_keys[1:]):
            if t0 <= t <= t1:
                f = (t - t0) / (t1 - t0)
                f = f * f * (3 - 2 * f)
                phi = a0 + (a1 - a0) * f
                break
        else:
            raise ValueError(f"swing: no key span covers t={t}")
        r = math.radians(phi)
        log.append((t, (0.0, L * (1 - math.cos(r)), -L * math.sin(r))))
        chains.append((t, (phi, 0.0, 0.0)))
    return log, chains


def build() -> Asset:
    g = Grid(*SZ)
    wheels(g)
    frame(g)
    roof(g)
    gables(g)
    rg, tip = ram()
    chains = {f"chain-{'f' if zc < 60 else 'b'}": chain(zc) for zc in CHAIN_Z}
    occ = (g.a > 0) | (rg.a > 0)
    for cg in chains.values():
        occ |= cg.a > 0
    xs, ys, zs = np.nonzero(occ)
    pivot = ((xs.min() + xs.max() + 1) / 2, float(ys.min()), (zs.min() + zs.max() + 1) / 2)
    if pivot[1] != 0.0:
        raise ValueError(f"battering-ram: lowest voxel is at y={pivot[1]}, the wheels must stand on y = 0")

    def rel(p, base=pivot):
        return (p[0] - base[0], p[1] - base[1], p[2] - base[2])

    root = Part("ram-bed", g, pivot=pivot)
    head_pivot = (CX, LOG_Y, (CHAIN_Z[0] + CHAIN_Z[1]) / 2)
    root.add(Part("ram-head", rg, pivot=head_pivot, at=rel(head_pivot)))
    for name, cg in chains.items():
        hinge = (CX, BEAM0, CHAIN_Z[0] if name.endswith("f") else CHAIN_Z[1])
        root.add(Part(name, cg, pivot=hinge, at=rel(hinge)))
    idle_log, idle_ch = swing([(0.0, 0.0), (1.0, 2.0), (2.0, 0.0), (3.0, -2.0), (4.0, 0.0)], 4.0)
    att_log, att_ch = swing([(0.0, 0.0), (0.22, -25.0), (0.42, 16.0), (0.6, 6.0), (0.9, 0.0)], 0.9)
    idle = {"ram-head": {"loc": idle_log}, "chain-f": {"rot": idle_ch}, "chain-b": {"rot": idle_ch}}
    attack = {"ram-head": {"loc": att_log}, "chain-f": {"rot": att_ch}, "chain-b": {"rot": att_ch}}
    return Asset(id="fantasy-vehicles-battering-ram", pack="fantasy", category="vehicles", name="Battering Ram", root=root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False)],
                 sockets=[Socket("socket-function", at=rel(tip), parent="ram-head")],
                 pfx=[{"effectId": "rvx-fantasy-dust-slam", "socket": "socket-function", "trigger": "clip:attack", "size": 30, "at": 0.42}])
