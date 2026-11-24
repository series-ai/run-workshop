"""Vampire Lord (boss), in the Pirate Nation world-boss style.

A towering chunky caricature in the family of the werewolf and PN
Kevin (the zombie world boss): a huge square head (a third of his height)
with slicked violet hair and a widow's peak, pointed ears, angry brow slabs
over glowing red eyes, a wide grin with two long fangs; a tall stand-up
collar that fans out behind the head, purple outside and crimson inside; a
broad V-shaped coat with gold trims, spiked gold pauldrons, a red vest,
a white cravat and a big gold medallion with a blood-red gem; a heavy
cape falling to the ground behind him; long arms
ending in oversized clawed hands; short legs in pointed boots under a
flared coat skirt; and two vast bat wings spreading from his back, lined
in crimson toward the front. Every volume is a true-slope prism; the
cloth, trims, skin and membranes are paint. Wingspan about 170, height
about 118 (PN world bosses: 180–270 long, 80–130 tall).
Clips: idle (wings breathe, head turns), move (a menacing stride),
attack (wings flare, a one-two claw swipe), hit, death (stumbles back two steps, falls on his back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _hitq import quick_hit
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, limb, octo, plan, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (184, 124, 70)
CX, CZ = 92, 32
COAT, LINING, TRIM, SKIN = "purple", "blood", "gold", "bone"
HIP = (CX, 30.0, CZ)
NECK = (CX, 74.0, CZ - 1.0)
SHOULDER = {"arm-l": (CX - 24.0, 68.0, CZ), "arm-r": (CX + 24.0, 68.0, CZ)}
LEGROOT = {"leg-l": (CX - 9.0, 30.0, CZ), "leg-r": (CX + 9.0, 30.0, CZ)}
WINGROOT = {"wing-l": (CX - 12.0, 70.0, CZ + 17.0), "wing-r": (CX + 12.0, 70.0, CZ + 17.0)}


def cloth(g: Grid, m: np.ndarray, ramp: str, base: int, seed: int) -> None:
    """Heavy coat cloth: soft 3D mottling and a dark 1-voxel hem on the
    lowest row (rule S3)."""
    P.mottle(g, m, ramp, base, cell=4, seed=seed)


def leg(s: int) -> Grid:
    """One leg and pointed boot (its own part, pivoting at the hip, so the
    move clip can walk; the other clips leave it at rest under the coat)."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    lx = CX + s * 9
    legs = plan(g, octo(lx, CZ, 7, 7, 2), 9, 34, COAT, 2, top=octo(lx, CZ, 8, 8, 2.5))
    boots = plan(g, octo(lx, CZ - 1, 8.5, 9, 2.5), 0, 11, COAT, 3, top=octo(lx, CZ, 7.5, 7.5, 2.5))
    boots |= side(g, [(0, CZ - 9), (0, CZ - 19), (3, CZ - 19.5), (7, CZ - 9)], lx - 6, lx + 6, COAT, 3)  # pointed toe
    cloth(g, legs, COAT, 2, seed=1)
    P.mottle(g, boots, COAT, 3, cell=2, seed=2)
    P.flat(g, boots & (Y >= 9) & (Y < 11), TRIM, 4)  # gold boot cuffs
    return g


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # a flared coat skirt and the broad V-shaped coat (true slopes)
    skirt = plan(g, octo(CX, CZ + 1, 23, 18.5, 6), 18, 42, COAT, 5, top=octo(CX, CZ, 18, 14.5, 5))
    coat = plan(g, octo(CX, CZ, 18, 14.5, 5), 42, 72, COAT, 5, top=octo(CX, CZ, 26, 16, 6))
    cloth(g, skirt | coat, COAT, 5, seed=3)
    P.flat(g, skirt & (Y < 19), COAT, 2)
    P.flat(g, skirt & (Y >= 19) & (Y < 21), TRIM, 5)  # gold hem band
    # front: an open coat over a red vest and a white cravat, with gold trims
    front_z = Z < CZ - 11
    vest = (skirt | coat) & front_z & (np.abs(X + 0.5 - CX) < 7 + (Y - 30) * 0.06) & (Y >= 30)
    P.flat(g, vest, "red", 4)
    P.flat(g, vest & ((Y % 6) == 0), "red", 3)
    P.flat(g, vest & (np.abs(X + 0.5 - CX) < 0.8) & ((Y % 5) == 2) & (Y < 56), TRIM, 6)  # buttons
    P.flat(g, (skirt | coat) & front_z & (np.abs(np.abs(X + 0.5 - CX) - (7.5 + (Y - 30) * 0.06)) < 1.1) & (Y >= 21), TRIM, 5)  # lapel trims
    cravat = coat & front_z & (np.abs(X + 0.5 - CX) < 5) & (Y >= 62)
    P.flat(g, cravat, "bone", 7)
    P.flat(g, cravat & (Y == 62), "bone", 5)
    P.flat(g, coat & (Y >= 44) & (Y < 47), TRIM, 4)  # belt
    P.flat(g, coat & (Y >= 44) & (Y < 47) & front_z & (np.abs(X + 0.5 - CX) < 3), TRIM, 6)
    # the big gold medallion with a blood-red gem (the socket-chest aura)
    med = front(g, octo(CX, 55, 6.5, 6.5, 2), CZ - 17.5, CZ - 13, TRIM, 5)
    P.outline(g, med, TRIM, 3, normal="z")
    P.flat(g, med & (np.abs(X + 0.5 - CX) < 3) & (np.abs(Y + 0.5 - 55) < 3), "red", 5)
    P.flat(g, med & (np.abs(X + 0.5 - CX) < 1.2) & (np.abs(Y + 0.5 - 56) < 1.2), "ember", 7)
    # spiked gold-rimmed pauldrons
    pads = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        px = CX + s * 24
        pads |= chunk(g, px, CZ, 63, 75, 9.5, 12, 3.5, COAT, 4, taper=3)
        claw(g, "z", (px + s * 1, 73), (px + s * 4, 84), 2.4, CZ - 2, CZ + 2, TRIM, 5)  # a gold spike
    cloth(g, pads, COAT, 4, seed=4)
    P.flat(g, pads & (Y < 66), TRIM, 5)
    # a heavy cape falling from the shoulders to the ground behind him
    cape = plan(g, octo(CX, CZ + 21, 27, 7.5, 3), 1, 72, COAT, 4, top=octo(CX, CZ + 13.5, 20, 3.5, 1.5))
    P.planks(g, cape, COAT, 4, width=5, across="x", length=(80, 81), nails=False, seed=14)  # long folds
    P.flat(g, cape & (Y < 4), "red", 4)  # the crimson lining shows at the hem
    P.flat(g, cape & (Y >= 4) & (Y < 6), TRIM, 5)
    # the tall stand-up collar fanning out behind the head: crimson inside
    collar = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pts = [(CX + s * 4, 68), (CX + s * 20, 70), (CX + s * 30, 104), (CX + s * 20, 100), (CX + s * 10, 92)]
        collar |= front(g, pts, CZ + 10, CZ + 14, COAT, 4)
    P.flat(g, collar, COAT, 4)
    P.flat(g, collar & (Z < CZ + 11.5), LINING, 4)
    P.outline(g, collar, TRIM, 5, normal="z")
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, CZ - 1, 73, 102, 16, 15, 4.5, SKIN, 6, taper=2.5)
    jaw = chunk(g, CX, CZ - 3, 70, 75, 12, 12, 3, SKIN, 6, taper=-1.0)
    P.mottle(g, skull | jaw, SKIN, 6, cell=4, seed=5)
    # slicked-back hair: a side profile that rises over the brow and sweeps back and down
    hair = side(g, [(95, CZ - 15.5), (103, CZ - 13), (106.5, CZ - 2), (104, CZ + 10), (96, CZ + 17), (82, CZ + 17.5), (82, CZ + 9), (95, CZ + 6)], CX - 15.5, CX + 15.5, COAT, 3)
    P.planks(g, hair, COAT, 3, width=3, across="x", length=(40, 41), nails=False, seed=6)  # combed strands
    P.flat(g, hair & (Y >= 105), COAT, 5)
    # widow's peak: the hair dips to a point on the forehead
    peak = skull & (Z < CZ - 12) & (Y >= 96 - np.maximum(0, 6 - np.abs(X + 0.5 - CX))) & (Y < 100)
    P.flat(g, peak, COAT, 3)
    P.flat(g, skull & (Y >= 96), COAT, 3)
    ears = np.zeros(g.shape, dtype=bool)
    brow = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 15.5, 82), (CX + s * 15.5, 92), (CX + s * 25, 98)], CZ - 3, CZ + 3, SKIN, 6)
        brow |= front(g, [(CX + s * 1, 87.5), (CX + s * 14, 91.5), (CX + s * 14, 97), (CX + s * 1, 92.5)], CZ - 19, CZ - 13, COAT, 4)
    P.flat(g, ears & (np.abs(X + 0.5 - CX) > 17.5) & (np.abs(X + 0.5 - CX) < 21.5) & (Y < 92), "pink", 3)
    P.mottle(g, brow, COAT, 4, cell=2, seed=13)
    P.outline(g, brow, COAT, 2, normal="z")
    nose = side(g, [(80, CZ - 16), (88, CZ - 16), (80, CZ - 21)], CX - 2.5, CX + 2.5, SKIN, 6)
    P.flat(g, nose & (Y < 81), SKIN, 5)
    # glowing red eyes, shadowed cheeks and a wide fanged grin (paint)
    face = {"k": C(COAT, 2), "r": C("red", 5), "w": C("ember", 7), "o": C("red", 6), "s": C("purple", 6), "m": C(LINING, 2), "t": C("bone", 7)}
    rows = [
        ".kkkkkkkk.....kkkkkkkk.",
        "kwwoorrrk.....kwwoorrrk",
        "kworrrrrk.....kworrrrrk",
        "korrrrrrk.....korrrrrrk",
        ".kkkkkkk.......kkkkkkk.",
        ".......................",
        "sss.................sss",
        ".sss...............sss.",
        ".......................",
        "..mmmmmmmmmmmmmmmmmmm..",
        "..mmtmmmmmmmmmmmmmtmm..",
        "...mmmmmmmmmmmmmmmmm...",
    ]
    pnglyph.stamp(g, "-z", CZ - 16, CX - 11, 74, rows, face, depth=2, reach=4)
    for s in (-1, 1):
        claw(g, "z", (CX + s * 7, 77.5), (CX + s * 6.5, 70.5), 1.7, CZ - 18.0, CZ - 15.0, "bone", 7)  # long fangs
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 24
    upper = limb(g, "z", (sx, 70), (sx + s * 10, 50), 6.5, 5.8, CZ - 6.5, CZ + 6.5, COAT, 5, cap=0.4)
    fore = limb(g, "z", (sx + s * 10, 51), (sx + s * 16, 34), 5.8, 5.0, CZ - 6, CZ + 6, COAT, 5, cap=0.4)
    cloth(g, upper | fore, COAT, 5, seed=7 + s)
    hx = sx + s * 17
    cuff = plan(g, octo(hx, CZ, 7.5, 7.5, 2), 31, 37, "red", 4, top=octo(hx, CZ, 8.5, 8.5, 2.5))
    P.flat(g, cuff & (Y >= 36), TRIM, 5)
    hand = chunk(g, hx, CZ - 1, 20, 31, 7.5, 7, 2.2, SKIN, 6, taper=-0.8)
    P.mottle(g, hand, SKIN, 6, cell=3, seed=9 + s)
    P.flat(g, hand & (Y >= 28) & (Y < 30) & (np.abs(X + 0.5 - (hx - s * 3)) < 1.2), TRIM, 6)  # a gold ring
    for k in range(4):  # four long claws, down and forward, blood-tipped
        cxk = hx - 6 + k * 3.6
        claw(g, "x", (21.5, CZ - 6), (7.5, CZ - 11), 1.8, cxk, cxk + 2.0, "bone", 6)
    P.flat(g, (g.a > 0) & (Y < 10.5) & (np.abs(X + 0.5 - hx) < 8), "red", 4)
    return g


def wing(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    u = lambda v: CX + s * v  # noqa: E731
    z0, z1 = CZ + 15, CZ + 19
    pts = [(u(12), 66), (u(30), 98), (u(55), 116), (u(87), 106), (u(80), 78), (u(70), 88), (u(61), 58), (u(48), 72), (u(37), 44), (u(25), 56), (u(14), 48)]
    m = front(g, pts, z0, z1, COAT, 4)
    P.mottle(g, m, COAT, 4, cell=5, seed=11 + s)
    P.flat(g, m & (Z < z0 + 2), "red", 4)  # crimson lining toward the front
    pnpaint.blotch(g, m & (Z < z0 + 2), "red", 3, cell=4, chance=0.05, seed=12)
    bones = limb(g, "z", (u(12), 68), (u(55), 116), 3.0, 2.3, z0 - 0.5, z1 + 0.5, COAT, 2, cap=0.3)
    bones |= limb(g, "z", (u(55), 116), (u(87), 106), 2.3, 1.6, z0 - 0.5, z1 + 0.5, COAT, 2, cap=0.3)
    U = np.abs(X + 0.5 - CX)
    for (u1, v1) in ((80, 78), (61, 58), (37, 44)):
        u0, v0 = 55.0, 115.0
        d = np.abs((v1 - v0) * (U - u0) - (u1 - u0) * (Y + 0.5 - v0)) / np.hypot(v1 - v0, u1 - u0)
        seg = (U >= min(u0, u1) - 1) & (U <= max(u0, u1) + 1)
        P.flat(g, m & (d < 1.3) & seg, COAT, 2)
    P.flat(g, bones, COAT, 2)
    P.flat(g, bones & ((X + Y) % 7 == 0), COAT, 3)
    claw(g, "z", (u(55), 117), (u(53), 123), 1.6, z0, z1, TRIM, 5)  # a gold thumb claw
    return g


# ------------------------------------------------------------------ move


def _rmat(deg) -> np.ndarray:
    """Rotation matrix of XYZ euler degrees in the voxel frame (Rz @ Ry @ Rx)."""
    x, y, z = (math.radians(a) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _euler(M: np.ndarray) -> tuple[float, float, float]:
    """XYZ euler degrees of a rotation matrix (inverse of _rmat)."""
    y = math.asin(max(-1.0, min(1.0, -M[2, 0])))
    return (math.degrees(math.atan2(M[2, 1], M[2, 2])), math.degrees(y), math.degrees(math.atan2(M[1, 0], M[0, 0])))


def _move() -> dict:
    """Move: a menacing stride, 1.47 s (44 frames, two steps), keyed once a
    frame (play with ease=0). Straight legs from the hips: the heel strikes,
    the boot plants and slides back at a steady ground speed while the other
    leg swings through, rolling up onto the pointed toe before it lifts.
    The boss drops onto every footfall (the coat sinks over the planted
    boot), leans into the walk, rolls a little over the stance leg and
    turns his shoulders against it; the claws swing against the legs, the
    head nods a beat after each footfall and the vast wings sway and
    settle with each step. The legs are solved in world space, so the
    body's roll and turn never drag a planted boot."""
    P, ST, H, R, LIFT = 44, 26, 30.0, 5.0, 3.0
    sole = [(-30.0, -19.5), (-30.0, 8.0)]  # (dy, dz) from the hip: the toe tip and the heel
    v = 2 * R / ST  # ground speed per frame
    legs = {"leg-l": 0, "leg-r": P // 2}  # touch-down frames

    def low(th):
        c, s = math.cos(th), math.sin(th)
        return min(dy * c - dz * s for dy, dz in sole)

    def herm(w, a, b, m):
        return ((2 * w ** 3 - 3 * w ** 2 + 1) * a + (w ** 3 - 2 * w ** 2 + w) * m
                + (-2 * w ** 3 + 3 * w ** 2) * b + (w ** 3 - w ** 2) * m)

    frames = []
    for f in range(P):
        st, sw = {}, {}
        for name, t0 in legs.items():
            p = (f - t0) % P
            if p <= ST:
                th = math.asin((R - v * p) / H)
                st[name] = (th, -H - low(th), p)
            else:
                w = (p - ST) / (P - ST)
                th = math.asin(herm(w, -R, R, -v * (P - ST)) / H)
                sw[name] = (th, w, -H - low(th))
        lead = min(st.values(), key=lambda q: q[2])  # the foot that touched down last carries the body
        y_all = max(q[1] for q in st.values())
        y = lead[1] + (y_all - lead[1]) * max(0.0, 1.0 - lead[2] / 2.0)
        frames.append((st, sw, y))

    def acc(f, shape):
        return sum(shape[(f - t0) % P] if (f - t0) % P < len(shape) else 0.0 for t0 in legs.values())

    cyc = lambda f, lag=0.0: math.cos(2 * math.pi * (f - lag) / P)  # noqa: E731  1 with the left boot forward
    dip = [0.0, -0.7, -1.2, -1.0, -0.6, -0.25]
    nod = [0.0, 0.0, 0.5, 1.0, 0.8, 0.4, 0.15]
    out = {"body": {"loc": [], "rot": []}, "leg-l": {"loc": [], "rot": []}, "leg-r": {"loc": [], "rot": []}}
    for f in range(P + 1):
        st, sw, root_y = frames[f % P]
        by = max(-0.6, root_y + acc(f % P, dip))
        brot = (-3.0 - 1.5 * acc(f % P, nod), 3.0 * cyc(f, 3), -1.5 * cyc(f, ST / 2 + 2))  # pitch, turn, roll over the stance leg
        Rb = _rmat(brot)
        t = fr(f)
        out["body"]["loc"].append((t, (0.0, by, 0.0)))
        out["body"]["rot"].append((t, brot))
        for name in legs:
            if name in st:
                th, need, _ = st[name]
                up = max(0.0, need - root_y)
            else:
                th, w, need = sw[name]
                up = max(LIFT * math.sin(math.pi * w) ** (0.4 if w < 0.5 else 1.0), need - root_y + 0.4)
            hip = np.array([LEGROOT[name][0] - HIP[0], 0.0, 0.0])
            world = hip + np.array([0.0, up + root_y - by, 0.0])  # where the hip must sit, relative to the body pivot
            out[name]["loc"].append((t, tuple(float(c) for c in Rb.T @ world - hip)))
            out[name]["rot"].append((t, _euler(Rb.T @ _rmat((math.degrees(th), 0.0, 0.0)))))
    pf = lambda fn: [(fr(f), tuple(float(c) for c in fn(f))) for f in range(P + 1)]  # noqa: E731
    out["head"] = {"rot": pf(lambda f: (2.0 - 3.0 * acc(f % P, [0, 0, 0, 0.5, 1.0, 0.8, 0.4, 0.15]), -2.4 * cyc(f, 5), 0.0))}
    out["arm-l"] = {"rot": pf(lambda f: (-9.0 * cyc(f, 3) - 2.0 * acc(f % P, nod), 0.0, -2.0))}
    out["arm-r"] = {"rot": pf(lambda f: (9.0 * cyc(f, 3) - 2.0 * acc(f % P, nod), 0.0, 2.0))}
    flap = lambda f: 4.0 * acc(f % P, [0, 0, 0.4, 0.9, 1.0, 0.8, 0.5, 0.25, 0.1])  # noqa: E731  the wings dip on each footfall
    out["wing-l"] = {"rot": pf(lambda f: (0.0, -5.0 + 5.0 * cyc(f, 6), -2.0 + flap(f)))}
    out["wing-r"] = {"rot": pf(lambda f: (0.0, 5.0 + 5.0 * cyc(f, 6), 2.0 - flap(f)))}
    return out


def build():
    parts = {"body": body(), "leg-l": leg(-1), "leg-r": leg(1), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "wing-l": wing(-1), "wing-r": wing(1)}
    root = assemble(parts, [
        ("body", None, HIP),
        ("leg-l", "body", LEGROOT["leg-l"]),
        ("leg-r", "body", LEGROOT["leg-r"]),
        ("head", "body", NECK),
        ("arm-l", "body", SHOULDER["arm-l"]),
        ("arm-r", "body", SHOULDER["arm-r"]),
        ("wing-l", "body", WINGROOT["wing-l"]),
        ("wing-r", "body", WINGROOT["wing-r"]),
    ])
    idle = {"wing-l": {"rot": keys((0, (0, -8, 0)), (2.0, (0, -22, -6)), (4.0, (0, -8, 0)))},
            "wing-r": {"rot": keys((0, (0, 8, 0)), (2.0, (0, 22, 6)), (4.0, (0, 8, 0)))},
            "head": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 12, 0)), (2.0, (0, 0, 0)), (3.0, (0, -12, 0)), (4.0, (0, 0, 0)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (2.0, (-6, 0, -4)), (4.0, (0, 0, 0)))},
            "arm-r": {"rot": keys((0, (0, 0, 0)), (2.0, (-6, 0, 4)), (4.0, (0, 0, 0)))},
            "body": {"loc": keys((0, (0, 0, 0)), (2.0, (0, 1.5, 0)), (4.0, (0, 0, 0)))}}
    # Attack, a one-two claw swipe (Sterf 2026-11-15b): he draws himself up
    # and back with the vast wings flared and the right claw cocked high
    # (frames 0-12), rakes it over and down through the target in 3 frames
    # to the first blow on frame 15 as the wings snap open and the left
    # claw rears up, then the body twists back and the left claw rakes down
    # on frame 21; he follows through low, holds a menacing beat and draws
    # back to rest by frame 35.
    attack = {"body": {"rot": keys((0, Z3), (fr(6), (8, -13, 0)), (fr(12), (10, -16, 0)), (fr(15), (-10, 14, 0)), (fr(17), (-12, 18, 0)),
                                   (fr(21), (-14, -12, 0)), (fr(23), (-15, -16, 0)), (fr(26), (-13, -14, 0)), (fr(31), (-2, 0, 0)), (fr(35), Z3)),
                       "loc": keys((0, Z3), (fr(6), (0, 0.4, 3.4)), (fr(12), (0, 0.6, 4)), (fr(15), (0, 0.6, -8)), (fr(17), (0, 0.7, -10)),
                                   (fr(21), (0, 0.5, -13)), (fr(23), (0, 0.4, -14)), (fr(26), (0, 0.4, -13.6)), (fr(32), (0, 0.1, -2)), (fr(35), Z3))},
              "wing-l": {"rot": keys((0, Z3), (fr(6), (0, 30, 21)), (fr(12), (0, 34, 24)), (fr(16), (0, -6, 8)), (fr(19), (0, 4, 14)),
                                     (fr(22), (0, -12, 10)), (fr(26), (0, -8, 7)), (fr(31), (0, 6, 4)), (fr(35), Z3))},
              "wing-r": {"rot": keys((0, Z3), (fr(6), (0, -30, -21)), (fr(12), (0, -34, -24)), (fr(16), (0, 6, -8)), (fr(19), (0, -4, -14)),
                                     (fr(22), (0, 12, -10)), (fr(26), (0, 8, -7)), (fr(31), (0, -6, -4)), (fr(35), Z3))},
              # the right claw: cocked high, then over, forward and down through the target
              "arm-r": {"rot": keys((0, Z3), (fr(4), (80, 0, 18)), (fr(7), (145, 0, 30)), (fr(11), (150, 0, 32)), (fr(12), (152, 0, 33)), (fr(13), (128, 0, 26)),
                                    (fr(14), (100, 0, 18)), (fr(15), (68, 0, 8)), (fr(17), (34, 0, -4)), (fr(19), (22, 0, -12)),
                                    (fr(24), (18, 0, -12)), (fr(29), (-6, 0, 2)), (fr(33), Z3))},
              # the left claw rears up as the right one lands, then rakes down on 21
              "arm-l": {"rot": keys((0, Z3), (fr(5), (40, 0, -16)), (fr(11), (54, 0, -19)), (fr(15), (140, 0, -30)), (fr(17), (148, 0, -32)),
                                    (fr(18), (132, 0, -26)), (fr(19), (104, 0, -16)), (fr(20), (74, 0, -6)), (fr(21), (48, 0, 4)),
                                    (fr(23), (26, 0, 12)), (fr(26), (22, 0, 10)), (fr(31), (-4, 0, -2)), (fr(35), Z3))},
              "head": {"rot": keys((0, Z3), (fr(7), (15, 13, 0)), (fr(13), (18, 16, 0)), (fr(16), (-10, -14, 0)), (fr(19), (-8, -4, 0)),
                                   (fr(22), (-14, 12, 0)), (fr(26), (-12, 9, 0)), (fr(32), (3, 0, 0)), (fr(35), Z3))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail; over in 0.6 s. See _hitq.quick_hit.
    # The boss is thrown 11 voxels back onto his toes (a pop of 2) with the
    # chest pushed back and the vast wings flung forward.
    hit, hit_hit = quick_hit("body", foot=(-30, 18.0, -18.5), sway=0.08, push=11.0, pop=2.0, tilt=9, k=1.15, head=("head", 24), arms={"arm-l": (34, -1), "arm-r": (34, 1)},
                            extra={"wing-l": lambda t: keys((0, Z3), (fr(5), (0, -30, -12)), (fr(11), (0, -12, -4)), (fr(t["O"]), (0, 8, 4)), (fr(t["E"]), Z3)),
                                   "wing-r": lambda t: keys((0, Z3), (fr(5), (0, 30, 12)), (fr(11), (0, 12, 4)), (fr(t["O"]), (0, -8, -4)), (fr(t["E"]), Z3))})
    # Death (Sterf 2026-11-15b: more epic): the killing blow rocks him back
    # (frames 0-2), he stumbles backwards two heavy steps, the body dipping
    # onto each foot and rolling with the weight (2-14), teeters on his
    # heels with the claws windmilling and the wings flared wide (14-17),
    # then the boss goes over backwards about his heels like a felled
    # tower, faster and faster (keyed a frame at a time) flat onto his back
    # on frame 30: a heavy squashed slam, one small bounce, dead still. The
    # vast wings crash flat out to the sides with the body, the arms and
    # the head slam down a frame later. 1.23 s.
    def piv(th: float, e=(-30.0, 9.0)) -> tuple[float, float]:
        """(dy, dz) that keep the heel edge `e` (y, z from the hip) in place
        while the body tips back by `th` degrees."""
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        return e[0] - (e[0] * c - e[1] * s), e[1] - (e[0] * s + e[1] * c)

    I, R, T0 = 30, 86.0, 17
    LIE = (1.4, 20.0)  # the published lying offset (y, z) at R
    # frame, tilt, y, z (stumble), roll
    # each step is a fast lurch back (2-3 frames) onto a planted foot, then a beat
    steps = [(0, 0.0, 0.0, 0.0, 0.0), (1, 4.0, 0.0, 1.6, 0.0), (2, 6.0, 0.0, 3.0, 0.0), (4, 7.0, -1.8, 7.6, -3.5), (5, 7.5, -0.4, 8.8, -4.0),
             (8, 8.0, 0.0, 9.4, -3.2), (10, 11.0, -2.0, 14.2, 3.0), (11, 12.0, -0.5, 15.4, 4.0), (14, 13.5, 0.0, 16.0, 3.2), (T0, 18.0, 0.0, 16.6, 1.5)]
    pose = [(f, a, y + piv(a)[0], z + piv(a)[1], r) for f, a, y, z, r in steps]
    end_y = LIE[0] - 2.6  # on the floor once flat (the cape and wings take the weight)
    for k in range(1, I - T0 + 1):  # the fall: accelerating; the pivot track blends into the published lying offset
        u = k / (I - T0)
        a = 18.0 + (R - 18.0) * (0.04 * u + 0.96 * u ** 2.5)
        w = ((a - 18.0) / (R - 18.0)) ** 2
        py, pz = piv(a)
        pose.append((T0 + k, a, (1 - w) * py + w * end_y, pz + 16.6 + 0.8 * u, 1.5 + 2.5 * u))
    end_z = piv(R)[1] + 17.4
    pose += [(I + 1, R - 2.5, end_y + 1.6, end_z + 0.2, 4.0), (I + 2, R, end_y, end_z + 0.3, 4.0), (I + 7, R, end_y, end_z + 0.3, 4.0)]
    death = {"body": {"rot": keys(*[(fr(f), (a, 0, r)) for f, a, _, _, r in pose]),
                      "loc": keys(*[(fr(f), (0, y, z)) for f, _, y, z, _ in pose]),
                      "scale": keys((0, (1, 1, 1)), (fr(I - 1), (1, 1, 1)), (fr(I), (1.07, 1.04, 0.88)), (fr(I + 2), (0.98, 0.99, 1.03)), (fr(I + 4), (1, 1, 1)))},
             "head": {"rot": keys((0, Z3), (fr(2), (18, 0, 0)), (fr(4), (22, 0, 3)), (fr(8), (18, 0, 2)), (fr(11), (8, 0, -3)), (fr(14), (12, 0, 0)), (fr(T0), (24, 0, 5)),
                                  (fr(I - 2), (40, 0, 10)), (fr(I), (82, 0, 20)), (fr(I + 2), (90, 0, 20)), (fr(I + 7), (90, 0, 20)))}}
    for name, s, fin in (("arm-l", -1, (-30, 0, -40)), ("arm-r", 1, (-42, 0, 40))):  # flung back by the blow, windmilling, slammed out flat
        death[name] = {"rot": keys((0, Z3), (fr(2), (-30, 0, s * 10)), (fr(5), (20, 0, -s * 15)), (fr(8), (26, 0, -s * 17)), (fr(11), (60, 0, -s * 25)),
                                   (fr(14), (64, 0, -s * 27)), (fr(T0), (75, 0, -s * 32)),
                                   (fr(I - 1), (fin[0] + 25, 0, fin[2])), (fr(I + 1), (fin[0] + 8, 0, fin[2])), (fr(I + 2), fin), (fr(I + 7), fin))}
    for name, s, WY in (("wing-l", 1, 5.0), ("wing-r", -1, 15.0)):  # flared wide, then crashed flat out to the sides
        WZ = 40.0
        death[name] = {"rot": keys((0, Z3), (fr(2), (0, -s * 20, -s * 15)), (fr(5), (0, s * 10, s * 10)), (fr(8), (0, s * 12, s * 11)), (fr(11), (0, s * 25, s * 22)),
                                   (fr(14), (0, s * 26, s * 23)),
                                   (fr(T0), (0, s * 28, s * 24)), (fr(I - 2), (0, s * 15, s * 20)), (fr(I), (0, s * (WY - 12), s * (WZ + 12))),
                                   (fr(I + 2), (0, s * WY, s * WZ)), (fr(I + 7), (0, s * WY, s * WZ)))}
    chest = (0.0, 55.0 - HIP[1], CZ - 18.0 - HIP[2])
    claw_r = (CX + 41.0 - HIP[0], 8.0 - HIP[1], CZ - 11.0 - HIP[2])
    mouth = (0.0, 75.0 - HIP[1], CZ - 17.0 - HIP[2])
    return world("vampire-lord", "creatures", "Vampire Lord", root,
                 clips=[Clip("move", _move(), ease=0), Clip("attack", attack, loop=False, impact=fr(15)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=fr(I), ease=0), Clip("idle", idle)],
                 sockets=[Socket("socket-chest", at=chest, parent="body"), Socket("socket-claw-r", at=claw_r, parent="arm-r"), Socket("socket-mouth", at=mouth, parent="head")],
                 pfx=[pfx("rvx-monster-blood-moon-aura", "socket-chest", "idle", size=110), pfx("rvx-monster-bat-burst", "socket-chest", "clip:attack", size=100, offset=(0.0, 0.0, -20.0), at=fr(15)), pfx("rvx-monster-blood-splat", "socket-mouth", "clip:hit", size=90)])
