"""Art-director repair models (group: nature).

This module builds the rebuilt terrain models of the monster pack. Each
model has its own massing, so no two of them share a template:

- tar-pit: an irregular black pool with a raised tar lip, bubbles and a
  sinking carcass (a femur and ribs). It has no stone ring.
- ectoplasm-pool: a glowing pool that breaks through a floor of flagstones,
  with heaved slabs, drips over the broken edges and rising wisps.
- crooked-path: a tile with a band of round cobbles in moss. The band
  enters at the centre of the -Z edge and leaves at the centre of the +X
  edge, with a bend in the middle.
- web-thicket: dead saplings and shrubs in sheet webs and web tents, with
  an egg sac and a spider that hides in a tent.
- cliff-crags: a cliff wall with a vertical face, ledges and a scree slope
  at the +X side.
- gnarled-roots: a broken stump with arched roots and bark plates.
- dungeon-floor: the old floor, with flagstones that run to the tile edge.
- iron-fence: one stone post per segment and a straight footing.

The helpers in _double_nature.py stay unchanged, because original models
use them. This module copies or calls them and does not edit them.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import Socket, pfx, single
from _life import moss_top, plan
from _pn import coords as icoords
from _pn import last
from pnkit import box
from voxgrid import C, Grid

import _double_nature as DN

REBUILT = ("tar-pit", "ectoplasm-pool", "crooked-path", "web-thicket", "cliff-crags", "gnarled-roots", "dungeon-floor", "iron-fence")


def build(category, slug):
    if category != "terrain-nature":
        raise KeyError(f"_rep_nature builds terrain-nature models only, not {category}/{slug}")
    if slug not in REBUILT:
        from _double import legacy_world
        return legacy_world(category, slug)
    return {
        "tar-pit": tar_pit,
        "ectoplasm-pool": ectoplasm_pool,
        "crooked-path": crooked_path,
        "web-thicket": web_thicket,
        "cliff-crags": cliff_crags,
        "gnarled-roots": gnarled_roots,
        "dungeon-floor": dungeon_floor,
        "iron-fence": iron_fence,
    }[slug]()


# ------------------------------------------------------------------ helpers
def wave(X, Z, seed=0.0, f=1.0):
    """Smooth value in -1..1 from four crossed sine waves. Use it for soft
    organic patches (rule S3) in place of per-texel noise."""
    return (np.sin(X * 0.23 * f + seed) + np.sin(Z * 0.19 * f + seed * 1.7 + 1.0)
            + np.sin((X + Z) * 0.13 * f + seed * 0.6 + 2.0) + np.sin((X - Z) * 0.16 * f + seed * 2.3)) / 4.0


def blob(cx, cz, rx, rz, n, seed, amp=0.1, phase=0.0):
    """An irregular closed outline (x, z) with n points: an ellipse with
    deterministic bumps."""
    pts = []
    for k in range(n):
        a = phase + 2 * math.pi * k / n
        f = 1.0 + amp * (math.sin(3 * a + seed) * 0.6 + math.sin(5 * a + seed * 2.1) * 0.4)
        pts.append((cx + rx * f * math.cos(a), cz + rz * f * math.sin(a)))
    return pts


def scaled(pts, cx, cz, k):
    return [(cx + (x - cx) * k, cz + (z - cz) * k) for x, z in pts]


def inside(poly, x, z):
    """True when the point (x, z) is inside the polygon."""
    hit = False
    n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0):
            hit = not hit
    return hit


def inside_mask(poly, X, Z):
    from voxgrid import _inside_polygon
    return _inside_polygon(X, Z, poly)


def soil(g, poly, y1, seed, top=("moss", 4), side=("skindark", 3), accent=None):
    """A ground slab from y 0 to y1 with soft paint: dark strata on the
    sides, a top in three close tones (smooth patches, not speckle) and a
    darker rim along the top edge (rule S4)."""
    m = plan(g, poly, 0, y1, side[0], side[1])
    X, Y, Z = S.coords(g)
    P.flat(g, m & (Y < 1), side[0], side[1] - 1)
    P.flat(g, m & (Y > 1) & (Y < y1 - 1), side[0], side[1] + 1)
    cap = m & (Y > y1 - 1)
    n = wave(X, Z, seed)
    P.flat(g, cap, top[0], top[1])
    P.flat(g, cap & (n > 0.38), top[0], top[1] + 1)
    P.flat(g, cap & (n < -0.42), top[0], top[1] - 1)
    if accent is not None:
        n2 = wave(Z, X, seed + 4.0, 1.3)
        P.flat(g, cap & (n2 > 0.55), *accent)
    P.outline(g, cap, top[0], top[1] - 2, normal="y")
    return m


def rocklet(g, x, z, y0, r, h, seed, ramp="stone", base=4, n=6):
    """A small faceted rock: an n-gon frustum with a turned, smaller top,
    a light top and a dark foot."""
    rng = np.random.default_rng(seed)
    a0 = rng.uniform(0, 2 * math.pi)
    rad = [r * rng.uniform(0.8, 1.0) for _ in range(n)]
    low = [(x + rad[k] * math.cos(a0 + 2 * math.pi * k / n), z + rad[k] * math.sin(a0 + 2 * math.pi * k / n)) for k in range(n)]
    up = [(x + 0.5 * rad[k] * math.cos(a0 + 0.35 + 2 * math.pi * k / n), z + 0.5 * rad[k] * math.sin(a0 + 0.35 + 2 * math.pi * k / n)) for k in range(n)]
    g.prism("y", low, y0, y0 + h, C(ramp, base), top=up)
    m = last(g)
    X, Y, Z = S.coords(g)
    P.flat(g, m & (Y > y0 + h * 0.6), ramp, base + 1)
    P.flat(g, m & (Y < y0 + 1), ramp, base - 1)
    P.flat(g, m & S.seams(g, [g.solids[-1]], 0.7), ramp, base - 1)
    return m


def chain_bars(g, axis, pts, radii, lo, hi, ramp, base):
    """Thick segments through pts (in the plane across `axis`) with pointed
    joints, extruded over [lo, hi). Returns the mask."""
    m = np.zeros(g.shape, dtype=bool)
    for k, (p0, p1) in enumerate(zip(pts, pts[1:])):
        g.prism(axis, S.quad(p0, p1, radii[k], radii[k + 1], cap=0.6), lo, hi, C(ramp, base))
        m |= last(g)
    return m


def tuft(g, x, z, y0, k, ramp="moss"):
    """A grass tuft of three thin blades."""
    m = np.zeros(g.shape, dtype=bool)
    for dx, dz, th in ((0, 0, 4), (1, 1, 3), (-1, 1, 2)):
        m |= box(g, x + dx, y0, z + dz, x + dx + 1, y0 + th + k % 2, z + dz + 1, ramp, 5 + (th + k) % 2)
    X, Y, Z = S.coords(g)
    P.flat(g, m & (Y < y0 + 1), ramp, 3)
    return m


# ------------------------------------------------------------------ tar pit
def tar_pit():
    W, H, D = 48, 20, 46
    cx, cz = 24.0, 23.0
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    # scorched dry ground: brown earth with dead olive grass patches
    ground = soil(g, blob(cx, cz, 22.6, 21.6, 16, 1.0, 0.05), 3, 2.0, top=("skindark", 4), side=("skindark", 2), accent=("moss", 3))
    # the tar: an irregular blob, not an octagon
    tar_out = blob(cx + 0.5, cz - 0.5, 12.5, 11.0, 14, 3.0, 0.16, 0.2)
    radii = [math.hypot(x - cx - 0.5, z - cz + 0.5) for x, z in tar_out]
    tar = plan(g, scaled(tar_out, cx + 0.5, cz - 0.5, 1.06), 1, 4, "iron", 4)
    # the raised tar lip: one sloped segment per outline edge
    n = len(tar_out)
    crest = [6.5, 7.5, 8.0, 7.0, 6.5, 7.5, 8.5, 7.5, 6.5, 7.0, 8.0, 7.0, 6.5, 7.5]
    rim = np.zeros(g.shape, dtype=bool)
    rim_solids = []

    def at(k, extra):
        x, z = tar_out[k % n]
        r = radii[k % n]
        return (cx + 0.5 + (x - cx - 0.5) * (r + extra) / r, cz - 0.5 + (z - cz + 0.5) * (r + extra) / r)

    for k in range(n):
        out_k, out_k1 = 5.0 + (k % 3) * 0.8, 5.0 + ((k + 1) % 3) * 0.8
        base = [at(k, 0.0), at(k, out_k), at(k + 1, out_k1), at(k + 1, 0.0)]
        top = [at(k, 0.9), at(k, 2.6), at(k + 1, 2.6), at(k + 1, 0.9)]
        g.prism("y", base, 2, crest[k], C("iron", 4), top=top)
        rim_solids.append(g.solids[-1])
        rim |= last(g)
    # tongues of tar that ran over the lip onto the ground
    for k in (1, 5, 9, 12):
        a, b = at(k, 3.5), at(k + 1, 3.5)
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        tip = at(k, 0.0)
        tx, tz = tip[0] * 0.5 + at(k + 1, 0.0)[0] * 0.5, tip[1] * 0.5 + at(k + 1, 0.0)[1] * 0.5
        d = math.hypot(mid[0] - tx, mid[1] - tz)
        far = (mid[0] + (mid[0] - tx) / d * 5.5, mid[1] + (mid[1] - tz) / d * 5.5)
        lx, lz = (mid[0] + far[0]) / 2, (mid[1] + far[1]) / 2
        lob = blob(lx, lz, 3.4, 3.4, 8, k, 0.15)
        g.prism("y", lob, 2, 4.6, C("iron", 4), top=scaled(lob, lx, lz, 0.5))
        rim |= last(g)
    # tar paint: a dark body, soft gloss bands and bright glints at the crest
    surf = tar & (Y > 3)
    sheen = wave(X, Z, 3.0, 1.5)
    P.flat(g, surf, "iron", 4)
    P.flat(g, surf & (sheen > 0.3), "iron", 5)
    P.flat(g, surf & (sheen > 0.62), "iron", 6)
    P.flat(g, surf & (np.abs(sheen - 0.8) < 0.04), "steel", 2)
    P.flat(g, rim, "iron", 4)
    P.flat(g, rim & (Y < 4), "iron", 3)
    ang = np.arctan2(Z - cz, X - cx)
    drip = ((np.floor((ang + math.pi) / 0.21).astype(int) % 3) == 0)
    P.flat(g, rim & drip & (Y > 3), "iron", 5)  # vertical gloss runs down the lip
    for k, s in enumerate(rim_solids):
        P.flat(g, rim & (Y > crest[k] - 1.6) & s.mask(g.shape), "iron", 5)
    P.flat(g, rim & S.seams(g, rim_solids, 0.8) & (Y > 5), "steel", 2)  # the glossy crest line
    # a tar stain on the ground round the lip
    stain = ground & (Y > 2) & ~rim & inside_mask(scaled(tar_out, cx + 0.5, cz - 0.5, 1.75), X, Z)
    P.flat(g, stain, "skindark", 1)
    # bubbles: domes with a light cap and a ripple ring; one has burst
    for k, (bx, bz, r, burst) in enumerate(((19.0, 18.5, 3.2, False), (29.5, 26.0, 2.3, False), (26.5, 16.0, 1.7, False), (18.5, 27.5, 2.6, True), (31.0, 19.0, 1.5, False))):
        d = np.hypot(X - bx, Z - bz)
        P.flat(g, surf & (np.abs(d - r - 1.4) < 0.6), "iron", 4)
        dome = S.cone(g, "y", bx, bz, r, 3, 4 + r * (0.45 if burst else 0.8), "iron", 3, n=8, r_top=r * (0.7 if burst else 0.45))
        P.flat(g, dome & (Y > 4 + r * 0.3), "iron", 5)
        if burst:
            P.flat(g, dome & (Y > 4) & (d < r * 0.55), "iron", 1)
        else:
            P.flat(g, dome & (Y > 4 + r * 0.6) & (X < bx) & (Z < bz), "steel", 3)
    # the sinking carcass: a big femur and three ribs that rise out of the tar
    fem = S.bar(g, "z", (13.5, 2.0), (20.5, 13.0), 3.0, 27.0, 30.0, "bone", 5)
    knob = S.disc(g, "z", 20.0, 13.4, 2.1, 26.4, 30.6, "bone", 6, n=6)
    knob2 = S.disc(g, "z", 21.9, 12.0, 1.7, 26.8, 30.2, "bone", 6, n=6)
    bone = fem | knob | knob2
    for k, rz in enumerate((15.0, 18.5, 22.0)):
        pts = [(28.0 + k * 0.5, 2.5), (29.6 + k * 0.4, 8.5 - k * 0.6), (32.0, 11.0 - k * 0.8), (34.2, 9.6 - k * 0.8)]
        bone |= chain_bars(g, "z", pts, [1.3, 1.2, 1.0, 0.8], rz - 0.8, rz + 0.8, "bone", 6)
    P.flat(g, bone & (Y > 9) & (X < 22), "bone", 7)
    P.outline(g, bone, "bone", 3, normal="z")
    P.flat(g, bone & (Y < 5.5), "iron", 3)  # the tar coat at the waterline
    P.flat(g, bone & (Y >= 5.5) & (Y < 7.5) & ((np.floor(X).astype(int) % 3) == 0), "iron", 4)  # runs of tar
    # two dead reeds in the lip and dry tufts on the ground
    for k, (x, z, h, lean) in enumerate(((36.5, 30.0, 13, 2.0), (34.0, 33.0, 10, -1.5))):
        m = S.bar(g, "z", (x, 4.0), (x + lean, 4.0 + h), 1.4, z - 0.7, z + 0.7, "khaki", 3)
        P.flat(g, m & (Y > 3.0 + h * 0.7), "khaki", 4)
    for k, (x, z) in enumerate(((6, 14), (40, 10), (9, 34), (41, 36))):
        tuft(g, x, z, 3, k, "khaki")
    return single("tar-pit", "terrain-nature", "Tar Pit", g, sockets=[Socket("socket-pool", at=(0, 7, 0))],
                  pfx=[pfx("rvx-monster-sewer-fume", "socket-pool", "idle", size=30)])


# ------------------------------------------------------------------ ectoplasm pool
def ectoplasm_pool():
    W, H, D = 46, 30, 42
    cx, cz = 23.0, 21.0
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    outline = [(4, 0.5), (20, 1.5), (34, 0.5), (45.5, 5), (44.5, 22), (45.5, 37), (36, 41.5), (18, 40.5), (6, 41.5), (0.5, 33), (1.5, 18), (0.5, 7)]
    ground = soil(g, outline, 2, 7.0, top=("skindark", 2), side=("skindark", 2), accent=("moss", 3))
    pool_out = blob(cx + 0.5, cz + 0.5, 11.0, 9.0, 13, 5.0, 0.18, 0.4)
    pool = plan(g, pool_out, 1, 3, "toxic", 4)
    dp = np.hypot((X - cx - 0.5) / 11.0, (Z - cz - 0.5) / 9.0)
    # ectoplasm seeps up through the joints near the pool
    gaps = ground & (Y > 1)
    P.flat(g, gaps & (dp < 1.75), "toxic", 2)
    P.flat(g, gaps & (dp < 1.35), "toxic", 3)
    # flagstones: an irregular paving on a jittered grid with shared corners
    nx, nz = 6, 5
    x0, z0, sx, sz = 1.0, 1.0, 44.0 / nx, 40.0 / nz
    rng = np.random.default_rng(11)
    jit = rng.uniform(-1.4, 1.4, size=(nx + 1, nz + 1, 2))
    jit[0, :, 0] = jit[nx, :, 0] = 0.0
    jit[:, 0, 1] = jit[:, nz, 1] = 0.0

    def corner(i, j):
        return (x0 + i * sx + jit[i, j, 0], z0 + j * sz + jit[i, j, 1])

    flags = np.zeros(g.shape, dtype=bool)
    heave = {(3, 4): "z", (0, 2): "x"}  # these slabs tip into the pool
    missing = {(5, 0), (0, 4), (5, 4)}
    for i in range(nx):
        for j in range(nz):
            if (i, j) in missing or (i, j) in heave:
                continue
            q = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]
            fx, fz = sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4
            if inside(scaled(pool_out, cx + 0.5, cz + 0.5, 1.12), fx, fz):
                continue
            q = [(fx + (x - fx) * 0.86, fz + (z - fz) * 0.86) for x, z in q]
            # a corner over the pool is broken off: pull it back to the slab
            q = [(fx + (x - fx) * 0.4, fz + (z - fz) * 0.4) if inside(pool_out, x, z) else (x, z) for x, z in q]
            top = 3.5 + ((i * 3 + j * 5) % 3) * 0.5
            m = plan(g, q, 1, top, "stone", 5)
            shade = (5, 6, 5, 4, 6, 5)[(i * 2 + j * 3) % 6]
            P.flat(g, m, "stone", shade)
            cap = m & (Y > top - 1)
            P.outline(g, cap, "stone", shade - 2, normal="y")
            P.flat(g, m & (Y < top - 1), "stone", shade - 1)
            if (i + j) % 3 == 0:  # a painted crack across the slab
                P.flat(g, cap & (np.abs((X - fx) * 0.7 - (Z - fz) + 0.8 * np.sin(X)) < 0.55), "stone", shade - 2)
            flags |= m
    # ectoplasm stain on the slab edges next to the pool
    P.flat(g, flags & (Y > 2) & (dp < 1.3), "toxic", 3)
    P.flat(g, flags & (Y > 2) & (dp < 1.15), "toxic", 4)
    # heaved slabs: broken plates that tip down into the pool
    heaved = np.zeros(g.shape, dtype=bool)
    for (i, j), axis in heave.items():
        q = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]
        xa, xb = min(p[0] for p in q) + 0.6, max(p[0] for p in q) - 0.6
        za, zb = min(p[1] for p in q) + 0.6, max(p[1] for p in q) - 0.6
        if axis == "z":  # the slab north of the pool: its -z edge dips into the pool
            sec = [(0.8, za), (3.0, za), (7.6, zb), (5.4, zb)]  # (y, z)
            g.prism("x", sec, xa, xb, C("stone", 5))
        else:  # the slab west of the pool: its +x edge dips into the pool
            sec = [(xb, 0.8), (xb, 3.0), (xa, 7.6), (xa, 5.4)]  # (x, y)
            g.prism("z", sec, za, zb, C("stone", 5))
        m = last(g)
        heaved |= m
        P.flat(g, m, "stone", 5)
        P.flat(g, m & S.seams(g, [g.solids[-1]], 0.8), "stone", 3)
        # ectoplasm runs down the slab face in three streaks
        if axis == "z":
            run = (np.floor(X).astype(int) % 4 == 1)
        else:
            run = (np.floor(Z).astype(int) % 4 == 1)
        P.flat(g, m & run & (Y < 6.5), "toxic", 5)
        P.flat(g, m & run & (Y < 3.5), "toxic", 6)
    # slime tongues over the broken edges, with drips that hang into the pool
    drips = np.zeros(g.shape, dtype=bool)
    for k in range(0, len(pool_out), 3):
        px, pz = pool_out[k]
        ox, oz = cx + 0.5 + (px - cx - 0.5) * 1.22, cz + 0.5 + (pz - cz - 0.5) * 1.22
        if not flags[int(ox), 2, int(oz)]:
            continue
        lob = blob(ox, oz, 2.4, 2.4, 6, k, 0.2)
        drips |= plan(g, lob, 3, 4.6, "toxic", 5, top=scaled(lob, ox, oz, 0.6))
        drips |= S.cone(g, "y", (ox + px) / 2, (oz + pz) / 2, 1.4, 1.5, 4.6, "toxic", 5, n=6, tip="lo")
    P.flat(g, drips & (Y > 3.5), "toxic", 6)
    # pool paint: a bright core, ripple rings and a dark lip line
    surf = pool & (Y > 2)
    P.flat(g, surf, "toxic", 4)
    P.flat(g, surf & (dp < 0.75), "toxic", 5)
    P.flat(g, surf & (dp < 0.42), "toxic", 6)
    P.flat(g, surf & (dp < 0.18), "toxic", 7)
    P.flat(g, surf & (np.abs(dp - 0.58) < 0.05), "toxic", 6)
    P.flat(g, surf & (np.abs(dp - 0.9) < 0.05), "toxic", 3)
    # rising wisps: slender ghost tendrils with a head and two dark eyes
    wisps = np.zeros(g.shape, dtype=bool)
    heads = []
    for k, (wx, wz, h, sway, axis) in enumerate(((18.5, 20.0, 22.0, 2.4, "z"), (28.0, 24.5, 17.0, -2.0, "z"), (25.0, 16.5, 12.0, 1.6, "x"))):
        pts = [(0.0, 2.0), (sway, h * 0.35), (-sway * 0.6, h * 0.68), (sway * 0.4, h)]
        if axis == "z":
            pts = [(wx + u, y) for u, y in pts]
            wisps |= chain_bars(g, "z", pts, [1.6, 1.4, 1.2, 1.1], wz - 1.2, wz + 1.2, "toxic", 6)
            hx, hz = pts[-1][0], wz
        else:
            pts = [(y, wz + u) for u, y in pts]  # (y, z)
            wisps |= chain_bars(g, "x", pts, [1.6, 1.4, 1.2, 1.1], wx - 1.2, wx + 1.2, "toxic", 6)
            hx, hz = wx, pts[-1][1]
        ht = h + 0.5
        head = S.cone(g, "y", hx, hz, 2.6, ht - 1.5, ht + 2.5, "bone", 7, n=7, r_top=1.9)
        head |= S.cone(g, "y", hx, hz, 1.9, ht + 2.5, ht + 5.0, "bone", 7, n=7)
        heads.append((head, hx, hz, ht))
        wisps |= head
    P.flat(g, wisps & (Y < 6), "toxic", 5)
    P.flat(g, wisps & (Y >= 6) & (Y < 11), "toxic", 6)
    P.flat(g, wisps & (Y >= 11), "toxic", 7)
    for head, hx, hz, ht in heads:
        P.flat(g, head, "bone", 7)
        face = head & (Z < hz - 0.6) & (np.abs(Y - ht - 1.5) < 0.6)
        P.flat(g, face & (np.abs(np.abs(X - hx) - 0.9) < 0.55), "purple", 1)
    return single("ectoplasm-pool", "terrain-nature", "Ectoplasm Pool", g, sockets=[Socket("socket-pool", at=(0, 7, 0))],
                  pfx=[pfx("rvx-monster-ghost-wisps", "socket-pool", "idle", size=30)])


# ------------------------------------------------------------------ crooked path
PATH = [(24.0, -6.0), (24.0, 10.0), (25.0, 18.0), (29.0, 24.0), (36.0, 25.5), (54.0, 24.0)]


def seg_dist(X, Z, pts):
    """Distance of every (X, Z) to a polyline."""
    best = np.full(X.shape, np.inf)
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        dx, dz = bx - ax, bz - az
        t = np.clip(((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz), 0.0, 1.0)
        best = np.minimum(best, np.hypot(X - ax - t * dx, Z - az - t * dz))
    return best


def crooked_path():
    W = 48
    g = Grid(W, 9, W)
    X, Y, Z = S.coords(g)
    base = plan(g, [(0, 0), (W, 0), (W, W), (0, W)], 0, 2, "skindark", 3)
    dist = seg_dist(X, Z, PATH)
    cap = base & (Y > 1)
    n = wave(X, Z, 9.0)
    # dirt off the path, soft moss in the band between the stones
    P.flat(g, base & (Y < 1), "skindark", 2)
    P.flat(g, cap, "skindark", 4)
    P.flat(g, cap & (n > 0.4), "skindark", 5)
    P.flat(g, cap & (n < -0.45), "skindark", 3)
    P.flat(g, cap & (dist < 8.6 + 0.8 * n), "moss", 4)
    P.flat(g, cap & (dist < 7.2), "moss", 5)
    P.flat(g, cap & (dist < 7.2) & (n > 0.25), "moss", 6)
    # round cobbles: rejection samples along the band (half width 7)
    rng = np.random.default_rng(23)
    stones = []
    cand = [(x + rng.uniform(-0.6, 0.6), z + rng.uniform(-0.6, 0.6)) for x in np.arange(1.0, 48.0, 2.0) for z in np.arange(1.0, 48.0, 2.0)]
    rng.shuffle(cand)
    # seed stones on the two tile edges first, so the band reaches both
    edge = [(18.6, 1.4), (23.4, 1.8), (28.4, 1.4), (46.6, 19.0), (46.2, 23.8), (46.6, 28.8)]
    # two passes: big cobbles first, then small ones fill the holes, so
    # only thin moss joints stay between them
    for lo, hi, pool in ((2.6, 3.5, edge + cand), (1.3, 2.1, cand)):
        for x, z in pool:
            r = lo + rng.uniform(0.0, hi - lo)
            d = float(seg_dist(np.array([x]), np.array([z]), PATH)[0])
            if d > 6.6 - r * 0.3:
                continue
            if any(math.hypot(x - sx, z - sz) < r + sr + 0.4 for sx, sz, sr in stones):
                continue
            stones.append((x, z, r))
    for k, (x, z, r) in enumerate(stones):
        nn = 7
        a0 = rng.uniform(0, math.pi)
        rad = [r * rng.uniform(0.85, 1.0) for _ in range(nn)]
        low = [(min(W - 0.1, max(0.1, x + rad[i] * math.cos(a0 + 2 * math.pi * i / nn))), min(W - 0.1, max(0.1, z + rad[i] * 0.9 * math.sin(a0 + 2 * math.pi * i / nn)))) for i in range(nn)]
        up = [(min(W - 0.1, max(0.1, x + 0.84 * rad[i] * math.cos(a0 + 2 * math.pi * i / nn))), min(W - 0.1, max(0.1, z + 0.78 * rad[i] * math.sin(a0 + 2 * math.pi * i / nn)))) for i in range(nn)]
        top = 3.0 + (k % 3) * 0.4
        g.prism("y", low, 1, top, C("gray", 5), top=up)
        m = last(g)
        shade = (6, 5, 6, 5, 7)[k % 5]
        P.flat(g, m, "gray", shade)
        P.flat(g, m & (Y > top - 1), "gray", shade + 1)
        P.outline(g, m & (Y > top - 1), "gray", shade - 1, normal="y")
        P.flat(g, m & (Y < 2.6), "gray", shade - 2)  # the wet foot in the moss
        if k % 5 == 2:  # a moss cushion on a few stones
            P.flat(g, m & (Y > top - 1) & (X < x) & (Z > z - 0.5), "moss", 5)
    # grass tufts and two toadstools along the band edges
    for k, (x, z) in enumerate(((12, 8), (34, 13), (40, 36), (14, 30), (8, 42), (33, 6))):
        tuft(g, x, z, 2, k)
    for x, z in ((37.0, 15.5), (18.0, 26.0)):
        stem = box(g, x, 2, z, x + 1, 4, z + 1, "bone", 6)
        capm = S.cone(g, "y", x + 0.5, z + 0.5, 1.9, 4, 5.6, "magenta", 5, n=6)
        P.flat(g, capm & (Y > 4.5), "magenta", 6)
    return single("crooked-path", "terrain-nature", "Crooked Path", g, sockets=[Socket("socket-nature", at=(0, 6, 0))],
                  pfx=[pfx("rvx-monster-spore-glow", "socket-nature", "idle", size=24)])


# ------------------------------------------------------------------ web thicket
def silk(g, m, base=6):
    """Silk paint: a pale sheet with crossed thread lines and a light rim."""
    Xi, Yi, Zi = icoords(g)
    P.flat(g, m, "bone", base)
    P.flat(g, m & (((Xi + Yi + Zi) % 4) == 0), "bone", base - 2)
    P.flat(g, m & (((Xi - Yi + Zi) % 4) == 0), "bone", base - 2)


def web_thicket():
    W, H, D = 50, 46, 44
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    soil(g, [(6, 0.5), (44, 0.5), (49.5, 6), (49.5, 38), (44, 43.5), (6, 43.5), (0.5, 38), (0.5, 6)], 3, 5.0, top=("skindark", 4), side=("skindark", 2), accent=("rust", 3))
    wood = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    # dead saplings: thin leaning trunks with forked twigs
    saplings = {"A": (10.0, 23.0, 36.0, -2.5, 1.0), "B": (19.0, 32.0, 42.0, 1.0, 2.0), "C": (33.0, 31.0, 37.0, 2.5, 1.5),
                "D": (41.0, 17.0, 31.0, 2.0, -1.5), "E": (26.0, 13.0, 27.0, -1.0, -2.0), "F": (5.0, 33.0, 25.0, -1.0, 2.0),
                "G": (46.0, 27.0, 27.0, 1.5, 1.0), "H": (29.0, 22.0, 33.0, 0.5, 0.5)}
    top = {}
    for k, (name, (x, z, h, dx, dz)) in enumerate(saplings.items()):
        pts = [(x, 3.0, z), (x + dx * 0.3, h * 0.4, z + dz * 0.3), (x + dx * 0.7, h * 0.75, z + dz * 0.7), (x + dx, h, z + dz)]
        DN.branch(g, pts, 2.0, "purple", 3)
        top[name] = pts[-1]
        for j, (t, ang, ln) in enumerate(((0.55, 0.6 + k, 8.0), (0.78, 2.6 + k, 7.0))):
            ox, oy, oz = x + dx * t, h * t, z + dz * t
            tip = (max(2.0, min(W - 2.0, ox + math.cos(ang) * ln * 0.8)), min(H - 2.0, oy + ln * 0.75), max(2.0, min(D - 2.0, oz + math.sin(ang) * ln * 0.6)))
            DN.branch(g, [(ox, oy, oz), tip], 1.3, "purple", 3)
    # low dead shrubs: twigs that fan out of one root
    shrubs = [(14.0, 11.0), (39.0, 34.0), (8.0, 35.0), (44.0, 7.0), (29.0, 38.0)]
    for k, (x, z) in enumerate(shrubs):
        for j in range(5):
            a = j * 2 * math.pi / 5 + k * 0.7
            h = 9.0 + (j + k) % 3 * 1.5
            tip = (max(1.5, min(W - 1.5, x + math.cos(a) * 6.0)), 3.0 + h, max(1.5, min(D - 1.5, z + math.sin(a) * 5.0)))
            DN.branch(g, [(x, 3.0, z), (x + math.cos(a) * 2.0, 3.0 + h * 0.5, z + math.sin(a) * 1.6), tip], 1.2, "wood", 3)
    for s in g.solids[start:]:
        wood |= s.mask(g.shape)
    P.flat(g, wood, "purple", 3)
    P.flat(g, wood & (Y > 14), "purple", 4)
    P.flat(g, wood & S.seams(g, g.solids[start:], 0.7), "purple", 2)
    P.flat(g, wood & (Y < 5), "purple", 2)
    # web tents: silk cones that wrap the shrub crowns; twig tips poke out
    webs = np.zeros(g.shape, dtype=bool)
    for k, ((x, z), r, h) in enumerate(zip(shrubs, (7.5, 6.5, 6.0, 5.0, 5.5), (12.5, 11.5, 10.5, 9.5, 10.0))):
        base_p = blob(x, z, r, r * 0.85, 7, k + 1.0, 0.12)
        base_p = [(min(W - 0.5, max(0.5, px)), min(D - 0.5, max(0.5, pz))) for px, pz in base_p]
        g.prism("y", base_p, 2.5, h, C("bone", 6), top=blob(x + 0.5, z + 0.3, 1.4, 1.2, 7, k + 1.0, 0.1))
        m = last(g)
        silk(g, m)
        P.flat(g, m & S.seams(g, [g.solids[-1]], 0.7), "bone", 4)
        P.flat(g, m & (Y < 4), "bone", 4)
        webs |= m
    # sheet webs stretched between the saplings (ruled sheets)
    for a, b, (ya0, ya1), (yb0, yb1) in (("A", "B", (10.0, 30.0), (26.0, 27.6)), ("B", "C", (20.0, 38.0), (30.0, 31.6)),
                                         ("E", "D", (6.0, 22.0), (24.0, 25.6)), ("A", "E", (5.0, 24.0), (18.0, 19.6)),
                                         ("F", "A", (8.0, 21.0), (22.0, 23.6)), ("H", "C", (12.0, 30.0), (28.0, 29.6)),
                                         ("G", "D", (10.0, 24.0), (20.0, 21.6))):
        (xa, za, ha, dxa, dza), (xb, zb, hb, dxb, dzb) = saplings[a], saplings[b]
        if xa > xb:
            (xa, za, dxa, dza, ya0, ya1), (xb, zb, dxb, dzb, yb0, yb1) = (xb, zb, dxb, dzb, yb0, yb1), (xa, za, dxa, dza, ya0, ya1)
        za_m = za + dza * 0.5
        zb_m = zb + dzb * 0.5
        sec_a = [(ya0, za_m - 0.8), (ya1, za_m - 0.8), (ya1, za_m + 0.8), (ya0, za_m + 0.8)]
        sec_b = [(yb0, zb_m - 0.8), (yb1, zb_m - 0.8), (yb1, zb_m + 0.8), (yb0, zb_m + 0.8)]
        g.prism("x", sec_a, xa + dxa * 0.5, xb + dxb * 0.5, C("bone", 6), top=sec_b)
        m = last(g)
        silk(g, m, 7)
        webs |= m
    # a level sheet web (a sheet-weaver's hammock) between B, C and D
    hp = [(19.5, 32.5), (27.0, 36.0), (34.0, 31.8), (41.5, 17.5), (30.0, 22.0)]
    g.prism("y", hp, 24.0, 25.5, C("bone", 6))
    m = last(g)
    silk(g, m, 7)
    P.outline(g, m, "bone", 5, normal="y")
    webs |= m
    # an egg sac that hangs on a thread from sapling C
    ex, ez = 35.5, 30.0
    thread = box(g, ex, 17.0, ez, ex + 1, 24.0, ez + 1, "bone", 6)
    sac = S.cone(g, "y", ex + 0.5, ez + 0.5, 3.0, 11.5, 15.0, "bone", 7, n=7, r_top=2.4, tip="lo")
    g_top = S.cone(g, "y", ex + 0.5, ez + 0.5, 2.4, 15.0, 17.5, "bone", 7, n=7, r_top=0.8)
    sac |= g_top
    P.flat(g, sac & ((np.floor(Y + np.arctan2(Z - ez, X - ex) * 1.3).astype(int) % 3) == 0), "bone", 5)
    P.flat(g, sac & (np.abs(Y - 13.5) < 0.6) & (np.abs(X - ex - 0.5) < 1.2), "magenta", 5)
    # the spider: it hides in the big front tent and shows its face and legs
    sx, sz = 14.0, 4.0
    body = S.cone(g, "y", sx, sz + 1.0, 3.0, 3.5, 8.5, "purple", 2, n=8, r_top=2.0)
    for side in (-1, 1):
        for k, (dz, reach) in enumerate(((0.0, 8.5), (2.2, 9.5))):
            lz = sz + dz
            pts = [(sx + side * 2.0, 6.0), (sx + side * (reach - 3.0), 10.5 - k), (sx + side * reach, 3.0)]
            body |= chain_bars(g, "z", pts, [0.9, 0.8, 0.5], lz - 0.6, lz + 0.6, "purple", 2)
    P.flat(g, body & S.seams(g, None, 0.5), "purple", 1)
    face = body & (Z < sz - 1.0) & (np.abs(X - sx) < 2.6) & (Y > 4.5) & (Y < 8.5)
    P.flat(g, face & (np.abs(Y - 7.0) < 0.6) & (np.abs(np.abs(X - sx) - 1.0) < 0.55), "toxic", 6)
    P.flat(g, face & (np.abs(Y - 6.0) < 0.6) & (np.abs(np.abs(X - sx) - 2.0) < 0.55), "toxic", 5)
    P.flat(g, face & (np.abs(Y - 5.0) < 0.6) & (np.abs(X - sx) < 0.6), "bone", 6)  # a fang
    return single("web-thicket", "terrain-nature", "Web Thicket", g, sockets=[Socket("socket-nature", at=(0, 18, 0))],
                  pfx=[pfx("rvx-monster-spore-glow", "socket-nature", "idle", size=24)])


# ------------------------------------------------------------------ cliff crags
def cliff_crags():
    W, H, D = 62, 50, 40
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    soil(g, [(0.5, 2), (20, 0.5), (46, 1.5), (61.5, 4), (61, 26), (58, 39.5), (30, 38.5), (2, 39.5), (0.5, 30)], 2, 3.0,
         top=("stone", 4), side=("skindark", 2), accent=("moss", 4))
    # the wall: four segments along x, each a side profile (y, z) with a
    # near-vertical front face, a flat crown and a back slope
    segs = [(2.0, 15.5, 12.0, 34.0, 0.0), (15.5, 27.5, 8.5, 46.0, 2.0), (27.5, 38.5, 11.0, 41.0, 1.0), (38.5, 48.0, 13.5, 30.0, 3.0)]
    rock = np.zeros(g.shape, dtype=bool)
    solids = []
    for k, (x0, x1, zf, h, off) in enumerate(segs):
        prof = [(1.0, zf), (h * 0.55, zf - 0.6), (h, zf + 1.2), (h + 2.5, zf + 4.5), (h, zf + 8.0), (h - 1.0, zf + 11.0), (h - 5.0, 27.0), (1.0, 36.0)]
        twist = [(y + (0.8 if j in (2, 3, 4) else 0.0) * (1 if k % 2 else -1), z + (0.7 if j < 3 else 0.0) * (1 if k % 2 else -1)) for j, (y, z) in enumerate(prof)]
        g.prism("x", prof, x0, x1, C("stone", 5), top=twist)
        solids.append(g.solids[-1])
        rock |= last(g)
    # ledges: shelves on the face with a chamfered underside
    ledges = [(3.5, 14.5, 12.0, 15.0), (16.5, 26.5, 8.5, 27.0), (28.5, 37.5, 11.0, 19.0), (17.0, 24.0, 8.5, 12.0), (39.5, 47.0, 13.5, 11.0)]
    ledge = np.zeros(g.shape, dtype=bool)
    for x0, x1, zf, y in ledges:
        g.prism("x", [(y - 2.5, zf - 5.0), (y, zf - 5.0), (y, zf + 1.0), (y - 6.0, zf + 1.0)], x0, x1, C("stone", 5))
        solids.append(g.solids[-1])
        ledge |= last(g)
    rock |= ledge
    # strata: soft bands of 3 close tones with a dark bedding line (S3)
    band = np.floor((Y + 0.4 * np.sin(X * 0.2)) / 5.0).astype(int)
    tones = np.array([6, 5, 6, 7, 5, 6, 7, 6, 5, 6, 7])
    for b in range(len(tones)):
        P.flat(g, rock & (band == b), "stone", int(tones[b]))
    bed = (np.abs(((Y + 0.4 * np.sin(X * 0.2)) % 5.0) - 0.5) < 0.5)
    P.flat(g, rock & bed & ((band % 2) == 1), "stone", 4)
    # cracks: zigzag dark lines down the face with a light lip beside them
    for xc, y0, y1 in ((9.0, 4.0, 30.0), (21.5, 14.0, 44.0), (33.0, 3.0, 26.0), (43.5, 6.0, 24.0), (25.0, 3.0, 11.0)):
        line = xc + 1.3 * np.sin(Y * 0.55 + xc)
        span = (Y > y0) & (Y < y1)
        P.flat(g, rock & span & (np.abs(X - line - 1.0) < 0.5), "stone", 7)
        P.flat(g, rock & span & (np.abs(X - line) < 0.55), "stone", 2)
    # dark outlines at the corners of every segment and ledge (S4)
    P.flat(g, rock & S.seams(g, solids, 0.8), "stone", 3)
    # the scree slope at the +X side: a fan that leans on the cliff
    fan = [(44.0, 8.0), (53.0, 5.0), (61.0, 12.0), (61.0, 30.0), (53.0, 36.5), (44.5, 34.0)]
    crown = [(45.0, 15.0), (47.0, 14.5), (48.5, 17.0), (48.5, 25.0), (47.0, 27.0), (45.0, 25.0)]
    scree = plan(g, fan, 1, 23.0, "stone", 4, top=crown)
    sn = wave(X + Y, Z - Y, 1.0, 2.2)
    P.flat(g, scree, "stone", 4)
    P.flat(g, scree & (sn > 0.3), "stone", 5)
    P.flat(g, scree & (sn < -0.35), "stone", 3)
    P.flat(g, scree & S.seams(g, [g.solids[-1]], 0.8), "stone", 3)
    # fallen blocks at the toe of the scree and at the foot of the face
    for k, (x, z, r, h) in enumerate(((56.0, 7.0, 3.2, 4.0), (59.0, 19.0, 2.4, 3.0), (51.0, 3.5, 2.2, 3.0), (10.0, 6.5, 3.0, 4.0), (30.5, 5.0, 2.4, 3.0), (20.0, 4.0, 1.8, 2.0))):
        rocklet(g, x, z, 1.5, r, h, 40 + k, "stone", 4)
    # moss on the crowns and the ledges, a dead shrub and tufts on top
    for k, (x0, x1, zf, h, off) in enumerate(segs):
        crown = rock & (X > x0) & (X < x1) & (Y > h - 1.5) & (Z > zf + 2.0)
        P.flat(g, crown, "moss", 4)
        P.flat(g, crown & (wave(X, Z, k, 1.8) > 0.3), "moss", 5)
        P.flat(g, rock & (X > x0) & (X < x1) & (Y > h - 2.5) & (Y < h - 1.5) & (Z > zf + 2.0) & (Z < zf + 3.0), "moss", 3)  # a lip of moss over the edge
    for x0, x1, zf, y in ledges:
        shelf = ledge & (X > x0) & (X < x1) & (Y > y - 1.0) & (Z < zf + 1.0)
        P.flat(g, shelf, "moss", 4)
        P.flat(g, shelf & (wave(X, Z, y, 2.0) > 0.4), "moss", 5)
    for j in range(4):
        a = j * math.pi / 2 + 0.4
        DN.branch(g, [(21.0, 45.0, 15.0), (21.0 + math.cos(a) * 3.0, 47.5, 15.0 + math.sin(a) * 2.5), (21.0 + math.cos(a) * 5.0, 49.0, 15.0 + math.sin(a) * 4.0)], 1.2, "purple", 3)
    for k, (x, z, y) in enumerate(((8.0, 21.0, 33), (33.0, 20.0, 40), (42.0, 22.5, 29))):
        tuft(g, x, z, y, k)
    return single("cliff-crags", "terrain-nature", "Cliff Crags", g, sockets=[Socket("socket-nature", at=(-9.5, 29.0, -14.0))],
                  pfx=[pfx("rvx-monster-spore-glow", "socket-nature", "idle", size=24)])


# ------------------------------------------------------------------ gnarled roots
def bark_paint(g, solids, along_y):
    """Bark plates with dark seams (S2, S3): strips along each root or up
    the stump, plates 4-8 long, one shade up or down per plate."""
    across = "x" if along_y else "y"
    S.paint_facets(g, solids, lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=3, across=across, length=(4, 8), nails=False, grain=False, frame=fr, seed=7))


def gnarled_roots():
    W, H, D = 54, 32, 44
    cx, cz = 27.0, 22.0
    g = Grid(W, H, D)
    X, Y, Z = S.coords(g)
    soil(g, blob(cx, cz, 25.0, 20.5, 14, 6.0, 0.06), 3, 8.0, top=("moss", 4), side=("skindark", 3))
    # the stump: a flared foot, a leaning trunk and a broken, jagged crown
    first = len(g.solids)
    g.prism("y", S.flat_ngon(cx, cz, 9.0, 8), 2, 7, C("wood", 4), top=S.flat_ngon(cx + 0.3, cz, 6.4, 8))
    g.prism("y", S.flat_ngon(cx + 0.3, cz, 6.4, 8), 7, 19, C("wood", 4), top=S.flat_ngon(cx + 1.0, cz - 0.4, 5.6, 8))
    stump_solids = g.solids[first:]
    bark_paint(g, stump_solids, True)
    stump = np.logical_or.reduce([s.mask(g.shape) for s in stump_solids])
    spikes = np.zeros(g.shape, dtype=bool)
    for k, (a, h) in enumerate(((0.3, 6.0), (2.2, 4.0), (4.1, 5.0))):
        px, pz = cx + 1.0 + math.cos(a) * 3.6, cz - 0.4 + math.sin(a) * 3.0
        spikes |= S.cone(g, "y", px, pz, 1.8, 18.5, 18.5 + h, "wood", 4, n=4, r_top=0.3)
    P.flat(g, spikes, "wood", 5)
    P.flat(g, spikes & S.seams(g, g.solids[-3:], 0.6), "wood", 2)
    # growth rings on the cut top
    cut = stump & (Y > 18)
    rr = np.hypot(X - cx - 1.0, Z - cz + 0.4)
    P.flat(g, cut, "sand", 3)
    P.flat(g, cut & ((np.floor(rr).astype(int) % 2) == 0), "sand", 2)
    P.flat(g, cut & (rr < 1.2), "wood", 2)
    P.flat(g, cut & (rr > 4.6), "wood", 2)
    # roots: seven thick roots in arches, three dive and come up again
    first = len(g.solids)
    for i in range(7):
        t = i * math.tau / 7 + 0.2
        c, s = math.cos(t), math.sin(t)
        pts = [(cx + c * 4, 14.0, cz + s * 3.5), (cx + c * 10, 10.5, cz + s * 8), (cx + c * 15.5, 7.0, cz + s * 12), (cx + c * 20, 4.0, cz + s * 15)]
        DN.branch(g, pts, 3.3, "wood", 4)
        if i % 2 == 0:  # a root that dives into the ground and arches up again
            tip = (max(3.0, min(W - 3.0, cx + c * 24.5)), 3.0, max(3.0, min(D - 3.0, cz + s * 18.5)))
            DN.branch(g, [pts[-1], ((pts[-1][0] + tip[0]) / 2, 7.5, (pts[-1][2] + tip[2]) / 2), tip], 1.8, "wood", 4)
        a = pts[2]
        side = (max(3.0, min(W - 3.0, a[0] + math.cos(t + 1) * 7)), 3.5, max(3.0, min(D - 3.0, a[2] + math.sin(t + 1) * 6)))
        DN.branch(g, [a, ((a[0] + side[0]) / 2, 5.0, (a[2] + side[2]) / 2), side], 1.5, "wood", 4)
    root_solids = g.solids[first:]
    bark_paint(g, root_solids, False)
    roots = np.logical_or.reduce([s.mask(g.shape) for s in root_solids])
    wood = (stump | roots)
    # light on the upper faces, dark seams at every facet corner (S4)
    P.flat(g, roots & S.seams(g, root_solids, 0.45), "wood", 2)
    P.flat(g, stump & S.seams(g, stump_solids, 0.6) & (Y < 18), "wood", 2)
    P.flat(g, wood & (Y < 3.6), "wood", 2)
    # moss on the root tops near the ground, and two toadstools
    up = roots & (Y < 9) & (Y > 4) & ~np.roll(g.a > 0, -1, axis=1)
    P.flat(g, up & (wave(X, Z, 2.0, 1.6) > 0.1), "moss", 5)
    for x, z in ((cx + 9.5, cz - 7.5), (cx - 12.0, cz + 6.0)):
        stem = box(g, x, 3, z, x + 1, 6, z + 1, "bone", 6)
        capm = S.cone(g, "y", x + 0.5, z + 0.5, 2.2, 6, 8, "magenta", 5, n=6)
        P.flat(g, capm & (Y > 7), "magenta", 6)
    return single("gnarled-roots", "terrain-nature", "Gnarled Roots", g, sockets=[Socket("socket-nature", at=(0, 21, 0))],
                  pfx=[pfx("rvx-monster-spore-glow", "socket-nature", "idle", size=24)])


# ------------------------------------------------------------------ dungeon floor (N7)
def dungeon_floor():
    """The old dungeon floor, with flagstones that run to the tile edge and
    a stone bed in place of the dirt border, so tiled floors join."""
    w, h, d = 48, 12, 48
    g = Grid(w, h, d)
    X, Y, Z = icoords(g)
    bed = box(g, 0, 0, 0, w, 3, d, "gray", 2)
    P.stone(g, bed, "gray", 3, block=(8, 3), cracks=0.0, seed=2)
    P.flat(g, bed & (Y == 2), "gray", 2)  # the dark mortar bed between the slabs
    cell = w / 5
    for row in range(5):
        for col in range(5):
            x, z = col * cell + 0.4, row * cell + 0.4
            s = cell - 1.0
            pts = [(x + s / 8, z), (x + s * 7 / 8, z), (x + s, z + s / 4), (x + s * 7 / 8, z + s * 7 / 8), (x, z + s), (x, z + s / 4)]
            g.prism("y", pts, 3, 5 + (row + col) % 2, C("gray", 4 + (row + col) % 2))
            m = last(g)
            P.mottle(g, m, "gray", 4 + (row + col) % 2, cell=3, seed=row * 5 + col)
            P.flat(g, m & (Y >= 4) & (((X + Z + col) % 17) == 0), "purple", 3)
    for i, (x, z) in enumerate(((5, 28), (39, 9), (35, 40), (8, 7))):
        DN.rock(g, x, z, 2.5, 2.4, 3, 2, i, "moss")
    return single("dungeon-floor", "terrain-nature", "Dungeon Floor", g)


# ------------------------------------------------------------------ iron fence (N8)
def iron_fence():
    """One fence segment, two tiles long: one stone post at the -X end only
    and a straight stone footing from end to end, so segments in a row
    share one post at each joint and show no gap under it."""
    w, h, d = 32, 30, 12
    g = Grid(w, h, d)
    X, Y, Z = S.coords(g)
    foot = box(g, 0, 0, 3, w, 3, 9, "stone", 4)
    P.stone(g, foot, "stone", 4, block=(6, 3), cracks=0.08, seed=3)
    P.flat(g, foot & (Y > 2), "stone", 5)
    P.flat(g, foot & (Y < 1), "stone", 2)
    px = 4.0
    for k, (low, high, width) in enumerate(((3, 8, 7), (8, 14, 5), (14, 20, 6), (20, 24, 7))):
        post = box(g, px - width / 2, low, 2, px + width / 2, high, 10, "stone", 5)
        P.stone(g, post, "stone", 5, block=(4, 3), cracks=0.1, seed=10 + k)
        P.flat(g, post & (Y < low + 1), "stone", 3)
    S.spire(g, px, 6, 24, 3, 4, "purple", 4, tiles=False)
    P.flat(g, last(g) & (Y > 26), "purple", 5)
    xs = [9.9, 14.3, 18.7, 23.1, 27.5]
    for x in xs:
        box(g, x, 3, 5, x + 1.5, 23, 7, "iron", 4)
        g.prism("z", [(x - 1, 22), (x + 2.5, 22), (x + 0.75, 27)], 5, 7, C("iron", 4))
    for yy in (9, 18):
        rail = box(g, 7, yy, 5, w, yy + 2, 7, "iron", 4)
        P.flat(g, rail & (Y > yy + 1), "iron", 4)
    for x in xs:
        box(g, x, 18, 4, x + 1.5, 20, 5, "gold", 5)
    return single("iron-fence", "terrain-nature", "Iron Fence", g)
