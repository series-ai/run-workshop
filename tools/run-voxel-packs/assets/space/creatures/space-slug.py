"""Space slug, in the Pirate Nation creature style.

A fat, goofy cosmic slug, longer than a hover bike, with a caricature
face and a lumpy silhouette: a big bulbous head, a thin neck, a tall hump
that grows a cluster of glowing cyan crystals, then a tail that tapers
and curls up. Six faceted segments (octagonal frustums along the body,
true slopes both ways) in a magenta hide with a ribbed pink belly and
glowing lime spots. The head has a huge open mouth with thick pink lips
and a ring of bone teeth, and two long eye stalks (one taller, leaning
apart) with big goggle eyes that look at the viewer. A flat glossy lime
slime trail lies under it. Clips: idle (the segments ripple), attack
(rear up and lunge), hit (flinch), death (deflate). Faces -Z.
"""
import math

import numpy as np

from _life import P, Clip, Grid, Rig, asset, coords, gem, keys, light_top, mask_of, plan, quad, side, wave

S = (46, 72, 112)
CX = 23
Y0 = 1  # belly bottom (on the slime)
# (z, half width, height, lift) at the segment boundaries, head first
PROF = [(4, 18, 34, 0), (20, 19, 35, 0), (32, 11, 20, 0), (52, 15, 32, 0), (70, 13, 24, 0), (88, 9, 15, 3), (106, 3.5, 6, 9)]
HIDE, BELLY = "magenta", "pink"


def section(w: float, h: float, lift: float = 0.0):
    y = Y0 + lift
    return [(CX - w * 0.7, y), (CX + w * 0.7, y), (CX + w, y + h * 0.35), (CX + w * 0.8, y + h * 0.8), (CX + w * 0.3, y + h),
            (CX - w * 0.3, y + h), (CX - w * 0.8, y + h * 0.8), (CX - w, y + h * 0.35)]


def segment(k: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    (z0, w0, h0, l0), (z1, w1, h1, l1) = PROF[k], PROF[k + 1]
    g.prism("z", section(w0, h0, l0), z0, z1 + (0.6 if k < 5 else 0), 0, top=section(w1, h1, l1))
    m = g.solids[-1].mask(g.shape)
    t = np.clip((Z - z0) / (z1 - z0), 0, 1)
    hgt = h0 + (h1 - h0) * t
    base = Y0 + l0 + (l1 - l0) * t
    P.flat(g, m, HIDE, 5)
    P.flat(g, m & (Y > base + hgt * 0.78), HIDE, 6)
    P.flat(g, m & (Y > base + hgt * 0.93), HIDE, 7)
    P.flat(g, m & (Y < base + hgt * 0.3), BELLY, 5)
    P.flat(g, m & (Y < base + hgt * 0.3) & (np.floor(Z) % 3 == 0), BELLY, 4)  # belly ribs
    P.flat(g, m & (Z > z1 - 1), HIDE, 4)  # the fold between segments
    # glowing lime spots along each flank, big and small
    for s in (-1, 1):
        for j, zc in enumerate(np.arange(z0 + 4, z1 - 2, 7)):
            frac = (zc - z0) / (z1 - z0)
            w = w0 + (w1 - w0) * frac
            h = h0 + (h1 - h0) * frac
            yc = Y0 + l0 + (l1 - l0) * frac + h * (0.55 if j % 2 else 0.45)
            rr = 2.6 if (j + k) % 2 == 0 else 1.7
            spot = m & (np.hypot(Z - zc, Y - yc) < rr) & ((X - CX) * s > w * 0.5)
            P.flat(g, spot, "toxic", 6)
            P.flat(g, spot & (np.hypot(Z - zc, Y - yc) < rr * 0.5), "toxic", 7)
    if k in (3, 4):  # purple dorsal fins on the back half
        zm = (z0 + z1) / 2
        hm = (h0 + h1) / 2 + (l0 + l1) / 2
        fin = side(g, [(Y0 + hm - 3, zm - 7), (Y0 + hm - 3, zm + 7), (Y0 + hm + 6, zm + 5)], CX - 1.5, CX + 1.5, "purple", 6)
        P.flat(g, fin, "purple", 6)
        light_top(g, fin, "purple", 7)
    if k == 2:
        crystals(g)
    if k == 0:
        head(g, m)
    return g


def crystals(g: Grid) -> None:
    """A cluster of glowing cyan crystals growing out of the hump."""
    X, Y, Z = coords(g)
    top = Y0 + PROF[3][2]
    for (x, z, r, h, lx, lz) in ((CX, 50, 4.2, 18, 0, 2), (CX - 6, 45, 3.2, 12, -5, -2), (CX + 6, 55, 3.4, 13, 5, 3), (CX + 2, 42, 2.4, 8, 2, -4)):
        n0 = len(g.solids)
        g.prism("y", [(x + r * math.cos(a), z + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 7)[:-1]], top - 5, top + h * 0.7, 0,
                top=[(x + lx * 0.7 + r * 0.8 * math.cos(a), z + lz * 0.7 + r * 0.8 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 7)[:-1]])
        g.prism("y", [(x + lx * 0.7 + r * 0.8 * math.cos(a), z + lz * 0.7 + r * 0.8 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 7)[:-1]], top + h * 0.7, top + h, 0,
                top=[(x + lx, z + lz)] * 6)
        m = mask_of(g, g.solids[n0:])
        P.flat(g, m, "cyan", 6)
        P.flat(g, m & (X < x), "cyan", 5)
        P.flat(g, m & (Y > top + h * 0.6), "cyan", 7)


def head(g: Grid, m) -> None:
    X, Y, Z = coords(g)
    z0, w0, h0, _l = PROF[0]
    cy = Y0 + h0 * 0.36
    face = m & (Z < z0 + 1)
    # a huge open mouth: thick pink lips, a ring of bone teeth, a dark maw and a tongue
    rr = np.hypot((X - CX) / 14.0, (Y - cy) / 9.5)
    P.flat(g, face & (rr < 1.0), BELLY, 4)  # lips
    P.flat(g, face & (rr < 1.0) & (Y > cy + 6), BELLY, 6)
    P.flat(g, face & (rr < 0.82), "bone", 7)  # teeth ring
    tooth = np.floor((np.arctan2(Y - cy, X - CX) / (2 * math.pi)) * 14) % 2 == 0
    P.flat(g, face & (rr < 0.82) & tooth, "bone", 5)
    P.flat(g, face & (rr < 0.62), "red", 2)  # the maw
    P.flat(g, face & (rr < 0.62) & (Y < cy - 1) & (np.abs(X - CX) < 6), "pink", 5)  # tongue
    P.flat(g, face & (rr < 0.3) & (Y >= cy - 1), "blood", 1)
    # nostril dots and a lit brow
    for s in (-1, 1):
        P.flat(g, face & (np.hypot(X - (CX + s * 4), Y - (cy + 13)) < 1.3), HIDE, 3)
    # two long eye stalks leaning apart, with big goggle eyes
    for s, tall, lean in ((-1, 17, 3), (1, 13, 5)):
        x = CX + s * 7
        yb = Y0 + h0 - 2
        top = (yb + tall, z0 + 3)
        side(g, quad((yb, z0 + 12), top, 2.2, 1.7), x - 1.7, x + 1.7, HIDE, 5)
        yc = top[0] + 6.5
        xe = x + s * lean * 0.4
        solids = gem(g, xe, top[1] + 0.5, top[0], 7.0, 13, "bone", 7, n=8)
        ball = mask_of(g, solids)
        P.flat(g, ball, "bone", 7)
        P.flat(g, ball & (Y < top[0] + 2.5), "bone", 5)
        zf = top[1] + 0.5 - 7.0
        near = ball & (Z < zf + 3.2)
        px = xe + 1.2  # both look a little to the viewer's side (+x)
        P.flat(g, near & (np.hypot(X - px, Y - yc) < 4.4), "toxic", 6)
        P.flat(g, near & (np.hypot(X - px, Y - yc) < 2.6), "navy", 1)
        P.flat(g, near & (np.hypot(X - px + 1.2, Y - yc - 1.2) < 0.9), "bone", 7)
        # a droopy lid
        P.flat(g, ball & (Y > yc + 4.2) & (Z < zf + 4), HIDE, 5)


def slime() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pts = [(CX - 12, 6), (CX + 12, 6), (CX + 18, 30), (CX + 17, 70), (CX + 10, 106), (CX - 9, 107), (CX - 17, 72), (CX - 18, 32)]
    m = plan(g, pts, 0, 1, "lime", 6)
    P.flat(g, m, "lime", 6)
    P.flat(g, m & ((np.floor(X * 0.5 + Z * 0.8) % 9) == 0), "lime", 7)  # glossy glints
    P.outline(g, m, "lime", 4, normal="y")
    return g


def build():
    rig = Rig()
    rig.group("space-slug", (CX, 0, PROF[3][0]))
    rig.add("slime", slime(), (CX, 0, PROF[3][0]), "space-slug")
    rig.add("seg-2", segment(2), (CX, Y0, PROF[2][0] + 8), "space-slug")
    rig.add("seg-1", segment(1), (CX, Y0, PROF[2][0]), "seg-2")
    rig.add("seg-0", segment(0), (CX, Y0, PROF[1][0]), "seg-1")
    rig.add("seg-3", segment(3), (CX, Y0, PROF[3][0]), "seg-2")
    rig.add("seg-4", segment(4), (CX, Y0, PROF[4][0]), "seg-3")
    rig.add("seg-5", segment(5), (CX, Y0, PROF[5][0]), "seg-4")
    z = (0.0, 0.0, 0.0)
    idle = {f"seg-{k}": {"rot": wave(2.0, "x", 2.5, phase=k * 1.0)} for k in range(6)}
    idle["seg-0"]["rot"] = wave(2.0, "y", 7)
    idle["seg-5"]["rot"] = wave(2.0, "x", 6, phase=5.0)
    attack = {"seg-1": {"rot": keys((0, z), (0.4, (18, 0, 0)), (0.6, (-6, 0, 0)), (1.1, z))},
              "seg-0": {"rot": keys((0, z), (0.4, (14, 0, 0)), (0.6, (-12, 0, 0)), (1.1, z))},
              "seg-2": {"loc": keys((0, z), (0.4, (0, 0, 3)), (0.6, (0, 0, -5)), (1.1, z))},
              "seg-5": {"rot": keys((0, z), (0.4, (-12, 0, 0)), (0.6, (6, 0, 0)), (1.1, z))}}
    hit = {"seg-0": {"rot": keys((0, z), (0.1, (8, 15, 0)), (0.45, z))}, "seg-1": {"rot": keys((0, z), (0.1, (4, 8, 0)), (0.45, z))}}
    flat = (1.15, 0.45, 1.0)
    one = (1.0, 1.0, 1.0)
    death = {f"seg-{k}": {"scale": keys((0, one), (0.3 + 0.1 * k, (1.05, 0.9, 1.0)), (1.2, flat))} for k in range(6)}
    death["seg-0"]["rot"] = keys((0, z), (1.2, (-8, 20, 0)))
    return asset("creatures", "space-slug", "Space Slug", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)])
