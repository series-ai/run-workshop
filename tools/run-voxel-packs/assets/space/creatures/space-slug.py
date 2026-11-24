"""Space slug, in the Pirate Nation creature style.

A fat, goofy cosmic slug, longer than a hover bike, with a caricature
face and a lumpy silhouette: a big bulbous head, a thin neck, a tall hump
that grows a cluster of glowing cyan crystals, then a tail that tapers
and curls up. Six faceted segments (octagonal frustums along the body,
true slopes both ways) in a magenta hide with a ribbed pink belly and
glowing lime spots. The head has a huge open mouth with thick pink lips
and a ring of bone teeth, and two long eye stalks (one taller, leaning
apart) with big goggle eyes that look at the viewer. A flat glossy lime
slime trail lies under it. Clips: idle (the segments ripple), move (a muscle wave runs
tail to head), attack
(rear up and lunge), hit (flinch), death (deflate). Faces -Z.
"""
import math

import numpy as np

from _motion import curve
from _trim import squeeze
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


def ooze(T: int = 36, reach: float = 1.2, hump: float = 2.8, swing: int = 12, lag: int = 3) -> dict:
    """The move clip: a slug's muscle wave, keyed every frame.

    A hump runs from the tail to the head once a loop (3 frames a
    segment). Each segment is planted on its belly and slides back at a
    constant ground speed until the wave reaches it; then it lifts into the
    hump and surges forward (12 frames) and sets down again. The head
    stretches forward and nods as the wave arrives, the eye stalks riding
    with it, and the tail tip flicks as the wave leaves it. Loops seamlessly."""
    parent = {0: 1, 1: 2, 2: None, 3: 2, 4: 3, 5: 4}

    def world(k, f):
        p = (f - (5 - k) * lag) % T
        if p < swing:
            u = p / swing
            e = (1 - math.cos(math.pi * u)) / 2
            return (0.0, hump * math.sin(math.pi * u), reach - 2 * reach * e)
        return (0.0, 0.0, -reach + 2 * reach * (p - swing) / (T - swing))

    out = {f"seg-{k}": {"loc": []} for k in range(6)}
    out["seg-0"]["rot"], out["seg-0"]["scale"], out["seg-5"]["rot"] = [], [], []
    for f in range(T + 1):
        t = f / 30
        g = f + 30  # the loop point falls where every segment is planted
        for k in range(6):
            w = world(k, g)
            if parent[k] is not None:
                pw = world(parent[k], g)
                w = (w[0] - pw[0], w[1] - pw[1], w[2] - pw[2])
            out[f"seg-{k}"]["loc"].append((t, w))
        p0 = (g - 5 * lag) % T  # the head's wave phase
        surge = math.sin(math.pi * p0 / swing) if p0 < swing else 0.0
        out["seg-0"]["rot"].append((t, (5.0 + 6.0 * surge, 0.0, 0.0)))  # held a touch raised (as in idle), nods up with the surge
        out["seg-0"]["scale"].append((t, (1.0 - 0.03 * surge, 1.0 - 0.03 * surge, 1.0 + 0.1 * surge)))
        p5 = (g - 2) % T  # the tail flicks just after its own lift
        flick = math.sin(math.pi * p5 / swing) if p5 < swing else 0.0
        out["seg-5"]["rot"].append((t, (-14.0 * flick, 0.0, 0.0)))
    return out


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
    idle["seg-0"]["rot"] = wave(2.0, "y", 5, base=(5.0, 0, 0))  # the head sways a touch raised, so it never digs in
    idle["seg-5"]["rot"] = wave(2.0, "x", 6, phase=5.0)
    # Lunge bite: the slug rears its head up high and draws its body back
    # (stretch, 0-0.47 s), hangs, then in 2 frames slams the head forward and
    # down onto the target with a chomp (impact 0.533 s, squash), the body
    # surging after it in a ripple and the tail whipping; it worries the bite
    # on the floor (chomping squashes, the head shaking) and slides back.
    F = 1 / 30
    bite_t = 16 * F
    attack = {"seg-1": {"rot": keys((0, z), (6 * F, (14, 0, 0)), (12 * F, (30, 0, 0)), (14 * F, (32, 0, 0)), (bite_t, (0.5, 0, 0)), (18 * F, (1.0, 0, 0)),
                                    (21 * F, (2, 0, 0)), (24 * F, (0, 0, 0)), (28 * F, (4, 0, 0)), (32 * F, z))},
              "seg-0": {"rot": keys((0, z), (6 * F, (10, 0, 0)), (12 * F, (24, 0, 0)), (14 * F, (26, 0, 0)), (bite_t, (-1.0, 0, 0)), (18 * F, (-0.5, 0, 3)),
                                    (21 * F, (1, 0, -3)), (24 * F, (-1.5, 0, 2)), (28 * F, (3, 0, 0)), (32 * F, z)),
                        "scale": keys((0, (1, 1, 1)), (12 * F, (0.92, 1.12, 1.04)), (bite_t, (1.14, 0.86, 1.0)), (19 * F, (1.06, 0.94, 1.0)), (22 * F, (1.11, 0.89, 1.0)), (26 * F, (0.97, 1.03, 1.0)), (29 * F, (1, 1, 1)),
                                      (32 * F, (1, 1, 1)))},
              "seg-2": {"loc": keys((0, z), (12 * F, (0, 0, 4)), (bite_t, (0, 0, -8)), (18 * F, (0, 0, -9)), (23 * F, (0, 0, -7)), (32 * F, z))},
              "seg-3": {"rot": keys((0, z), (12 * F, (-6, 0, 0)), (17 * F, (1.5, 0, 0)), (21 * F, (-3, 0, 0)), (28 * F, z), (32 * F, z)),
                        "scale": keys((0, (1, 1, 1)), (12 * F, (0.96, 1.06, 1.0)), (18 * F, (1.08, 0.94, 1.0)), (24 * F, (1, 1, 1)), (32 * F, (1, 1, 1)))},
              "seg-4": {"rot": keys((0, z), (14 * F, (-4, 0, 0)), (19 * F, (1, 0, 0)), (23 * F, (-3, 0, 0)), (30 * F, z), (32 * F, z))},
              "seg-5": {"rot": keys((0, z), (12 * F, (-14, 0, 0)), (17 * F, (2, 0, 6)), (20 * F, (-10, 0, -6)), (25 * F, (2, 0, 2)), (32 * F, z))}}
    # Knockback: the blow shoves the slug back with a little hop, the head
    # snaps up and back and the body ripples, the tail whips; it lands,
    # holds a beat and settles.
    hit = {"space-slug": {"loc": keys((0, z), (2 * F, (0, 1.0, 2.0)), (5 * F, (0, 1.6, 3.2)), (9 * F, (0, 0, 3.0)), (16 * F, (0, 0, 2.6)), (23 * F, (0, 0, 0.3)),
                                      (28 * F, z))},
           "seg-0": {"rot": keys((0, z), (2 * F, (14, 10, 0)), (5 * F, (20, 14, 0)), (10 * F, (-6, 4, 0)), (16 * F, (4, 0, 0)), (28 * F, z)),
                     "scale": keys((0, (1, 1, 1)), (3 * F, (1.12, 0.86, 1.0)), (7 * F, (0.94, 1.08, 1.0)), (12 * F, (1.04, 0.96, 1.0)), (20 * F, (1, 1, 1)),
                                   (28 * F, (1, 1, 1)))},
           "seg-1": {"rot": keys((0, z), (2 * F, (8, 4, 0)), (6 * F, (12, 6, 0)), (11 * F, (-4, 0, 0)), (17 * F, (2, 0, 0)), (28 * F, z))},
           **{f"seg-{k}": {"scale": keys((0, (1, 1, 1)), ((2 + k) * F, (1.06, 0.92, 1.0)), ((7 + k) * F, (0.97, 1.04, 1.0)), ((13 + k) * F, (1, 1, 1)),
                                         (28 * F, (1, 1, 1)))} for k in (2, 3, 4)},
           "seg-5": {"rot": keys((0, z), (4 * F, (-14, 0, 0)), (9 * F, (10, 0, 0)), (15 * F, (-4, 0, 0)), (22 * F, z), (28 * F, z))}}
    flat = (1.15, 0.45, 1.0)
    one = (1.0, 1.0, 1.0)
    # Death throe: the slug shudders, rears its head up tall (stretch,
    # anticipation), then slams it down (impact 0.667 s, squash) and
    # deflates in a fast wave from head to tail (2 frames a segment), each
    # segment slapping flat past its rest, one rebound and still; the tail
    # flops down last. Still by 1.27 s (Sterf: no wobble, no lingering).
    die_t = 20 * F
    end = 40
    death = {}
    for k in range(6):
        t0 = 20 + 2 * k
        death[f"seg-{k}"] = {"scale": keys((0, one), (2 * F, (1.06, 0.94, 1.0)), (4 * F, (0.96, 1.05, 1.0)), (6 * F, (1.04, 0.96, 1.0)),
                                           (max(14, t0 - 4) * F, (0.97, 1.04, 1.0)), (t0 * F, (1.24, 0.42, 1.0)), ((t0 + 3) * F, (1.12, 0.52, 1.0)),
                                           ((t0 + 6) * F, (1.15, 0.48, 1.0)), (end * F, (1.15, 0.48, 1.0)))}
    death["seg-0"]["scale"] = keys((0, one), (2 * F, (1.06, 0.94, 1.0)), (6 * F, (0.96, 1.05, 1.0)), (14 * F, (0.92, 1.12, 1.04)),
                                   (die_t, (1.26, 0.5, 1.0)), (23 * F, (1.10, 0.62, 1.0)), (27 * F, (1.16, 0.54, 1.0)), (end * F, (1.16, 0.54, 1.0)))
    death["seg-0"]["rot"] = keys((0, z), (4 * F, (-4, 8, 0)), (14 * F, (18, 10, 0)), (die_t, (6, 14, 0)), (23 * F, (12, 17, 0)),
                                 (27 * F, (6, 20, 0)), (31 * F, (7, 20, 0)), (end * F, (7, 20, 0)))
    death["seg-1"]["rot"] = keys((0, z), (14 * F, (24, 0, 0)), (die_t, (0, 0, 0)), (24 * F, (6, 0, 0)), (28 * F, (2, 0, 0)), (end * F, (2, 0, 0)))
    death["seg-5"]["rot"] = keys((0, z), (14 * F, (-14, 0, 0)), (die_t, (-8, 0, 0)), (30 * F, (-10, 0, 4)), (34 * F, (6, 0, -2)),
                                 (37 * F, (4, 0, 0)), (end * F, (4, 0, 0)))
    # Key the root at rest so these one-shots never inherit a lift from another clip.
    attack["space-slug"] = {"loc": keys((0, z), (32 * F, z))}
    death["space-slug"] = {"loc": keys((0, z), (end * F, z))}
    # Sterf's rules: a hit is over in 0.6 s; the blow keeps its timing, the
    # recovery is shortened.
    hit = squeeze(hit, keep=9, old_end=28, new_end=18)
    return asset("creatures", "space-slug", "Space Slug", rig.root,
                 clips=[Clip("idle", idle), Clip("move", ooze(), ease=0, floor=False), Clip("attack", attack, loop=False, impact=bite_t, floor=True), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t)])
