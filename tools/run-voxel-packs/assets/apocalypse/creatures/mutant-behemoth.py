"""Mutant behemoth (world boss), in the Pirate Nation creature style.

A colossal caricature after the PN zombie boss (Kevin), 3.4 persons tall
and 4.3 persons wide: a hunched teal brute whose massive faceted torso
(stacked octagon frustums, true slopes) bursts out of denim overalls, a
small head sunk between huge shoulders with one giant eye, one small red
eye, tusks and a bolted skull plate, a chained collar, bone spikes down
the spine and three toxic vents smoking on the back. The left arm ends in
a huge fist; the right arm is a club fused with rebar and a car door.
Stubby legs stand in laced boots. Veins glow toxic green. Clips: idle
(breathe and roar), move (a thundering walk: the body drops hard on each footfall), attack (a long heavy wind-up, then a double-fist ground slam), hit,
death (teeters, topples backwards onto its back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _big_falls as B
from _big_falls import F, Poser, track as T
from _life import Rig, bump, ctr, fx, limb, make, plan, seq, side, skin, wave
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SZ = (172, 132, 96)
CX, CZ = 86.0, 50.0
HIP_Y = 34.0
SKIN = ("teal", 5)
DENIM = ("blue", 5)
NECK = (CX, 94.0, CZ - 18.0)
HIPS = {"leg-l": (CX - 17.0, HIP_Y, CZ + 2), "leg-r": (CX + 17.0, HIP_Y, CZ + 2)}
SHOULDERS = {"arm-l": (CX - 38.0, 88.0, CZ - 4), "arm-r": (CX + 38.0, 88.0, CZ - 4)}


def oval(cx, cz, rx, rz, n=8):
    return [(cx + rx * math.cos(math.pi / n + 2 * math.pi * k / n), cz + rz * math.sin(math.pi / n + 2 * math.pi * k / n)) for k in range(n)]


def veins(g, m, seed=0, n=5):
    """Glowing toxic veins: short branching painted lines."""
    X, Y, Z = ctr(g)
    rng = np.random.default_rng(seed)
    idx = np.argwhere(m)
    if len(idx) == 0:
        return
    for _ in range(n):
        x, y, z = idx[rng.integers(len(idx))] + 0.5
        dx, dy, dz = rng.uniform(-1, 1), rng.uniform(-1.5, -0.5), rng.uniform(-1, 1)
        for _step in range(8):
            P.flat(g, m & (np.abs(X - x) < 1.0) & (np.abs(Y - y) < 1.0) & (np.abs(Z - z) < 1.0), "toxic", 6)
            x, y, z = x + dx * 1.4, y + dy * 1.4, z + dz * 1.4
            dx += rng.uniform(-0.5, 0.5)


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    m = limb(g, (hx, hy + 4, hz), (hx + s * 2, 12, hz - 2), 10.5, 9.0, *DENIM, n=6)
    P.flat(g, m, *DENIM)
    PP.blotch(g, m, DENIM[0], DENIM[1] + 1, cell=5, chance=0.05, seed=1 + s)
    knee = m & (np.abs(Y - 22) < 4) & (Z < hz - 6)
    P.flat(g, knee, "khaki", 5)  # a patched knee
    P.outline(g, knee, "darkwood", 5)
    P.flat(g, m & (Y < 16), DENIM[0], DENIM[1] - 1)  # rolled cuffs
    bx = hx + s * 2
    boot = box(g, bx - 11, 0, hz - 18, bx + 11, 13, hz + 9, "darkwood", 6)
    P.plates(g, boot, "darkwood", 6, size=(8, 5), rivets=False, seed=2 + s)
    P.flat(g, boot & (Y < 3), "darkwood", 4)  # the sole
    cap = boot & (Z < hz - 12) & (Y >= 3)
    P.flat(g, cap, "steel", 6)  # steel toe caps
    for k in range(4):  # laces
        P.flat(g, boot & (np.abs(Y - (6 + k * 2)) < 0.6) & (np.abs(X - bx) < 5) & (Z < hz - 11) & (Z > hz - 13), "bone", 6)
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pelvis = plan(g, oval(CX, CZ + 2, 30, 20), HIP_Y - 6, HIP_Y + 8, *DENIM, top=oval(CX, CZ, 33, 22))
    belly = plan(g, oval(CX, CZ, 33, 22), HIP_Y + 8, 62, *SKIN, top=oval(CX, CZ - 6, 38, 26))
    chest = plan(g, oval(CX, CZ - 6, 38, 26), 62, 90, *SKIN, top=oval(CX, CZ - 12, 30, 20))
    torso = belly | chest
    skin(g, torso, *SKIN, seed=3, cell=8)
    # the overalls: denim below the waist and a bib with straps and gold buttons
    denim = pelvis | (belly & (Y < 48)) | (torso & (Z < CZ - 14) & (np.abs(X - CX) < 16) & (Y < 76))
    straps = torso & (np.abs(np.abs(X - CX) - 13) < 3) & (Y > 70)
    P.flat(g, denim | straps, *DENIM)
    PP.blotch(g, denim, DENIM[0], DENIM[1] + 1, cell=5, chance=0.05, seed=4)
    P.outline(g, denim & (Y > 48), DENIM[0], DENIM[1] - 2)
    for bx in (CX - 13, CX + 13):
        P.flat(g, torso & (np.hypot(X - bx, Y - 73) < 2.5) & (Z < CZ - 12), "gold", 6)
    pocket = torso & (Z < CZ - 20) & (np.abs(X - CX) < 7) & (Y > 58) & (Y < 68)
    P.outline(g, pocket, DENIM[0], DENIM[1] - 2)
    P.flat(g, torso & (np.abs(Y - 48) < 1.2), "darkwood", 5)  # the belt line
    veins(g, torso & ~denim & ~straps, seed=5, n=7)
    # stapled scar across the chest
    scar = torso & (np.abs((X - CX - 22) + (Y - 80) * 0.8) < 1.0) & (Z < CZ - 8) & (Y > 70)
    P.flat(g, scar, "red", 4)
    # bone spikes down the spine
    for k in range(5):
        y0 = 58 + k * 7
        zb = CZ + 25 - k * 2.2
        side(g, [(y0, zb - 3), (y0 + 5, zb - 3), (y0 + 3, zb + 7)], CX - 2, CX + 2, "bone", 6)
    # three toxic vents smoking on the upper back
    for k, (vx, vz) in enumerate(((CX - 16, CZ + 14), (CX, CZ + 17), (CX + 16, CZ + 14))):
        v = S.disc(g, "y", vx, vz, 4.0, 80, 100 - (k == 1) * -4, "steel", 5, n=8)
        rim = S.disc(g, "y", vx, vz, 5.0, 96 - (k == 1) * -4, 99 - (k == 1) * -4, "rust", 4, n=8)
        P.flat(g, v & (Y > 94), "toxic", 6)
        del rim
    # the chained collar round the neck
    for k in range(10):
        a = 2 * math.pi * k / 10
        lx, lz = CX + 20 * math.cos(a), CZ - 10 + 14 * math.sin(a)
        link = box(g, lx - 2.5, 86 + (k % 2), lz - 2.5, lx + 2.5, 91 + (k % 2), lz + 2.5, "steel", 6 - k % 2)
        P.outline(g, link, "steel", 4)
    return g


def head() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    y0 = ny - 6
    fz = nz - 16.0
    poly = [(y0, nz + 8), (y0, fz - 3), (y0 + 9, fz - 3), (y0 + 9, fz), (y0 + 22, fz), (y0 + 26, fz + 5), (y0 + 26, nz + 4), (y0 + 20, nz + 9)]
    m = side(g, poly, CX - 15, CX + 15, *SKIN)
    skin(g, m, *SKIN, seed=6, cell=7)
    # a bolted steel skull plate on the crown
    plate = box(g, CX - 2, y0 + 25, nz - 8, CX + 12, y0 + 27.5, nz + 2, "steel", 5)
    P.outline(g, plate, "steel", 3)
    for bx in (CX, CX + 10):
        P.flat(g, plate & (np.abs(X - bx) < 1) & (Y > y0 + 26.5), "steel", 7)
    # one giant eye and one small red eye under a heavy brow (painted, 2 px per cell)
    legend = {"o": C("teal", 2), "w": C("bone", 7), "p": C("navy", 4), "r": C("red", 6), "b": C("teal", 3)}
    rows = ["bbbbbbb..bbbbb", "owwwwwo.......", "owwwwwo..oooo.", "owwppwo..orro.", "owwppwo..orro.", "owwwwwo..oooo.", "ooooooo......."]
    G.stamp(g, "-z", fz, int(CX - 14), int(y0 + 9), rows, legend, scale=2, depth=2)
    # a wide mouth with chunky teeth on the underbite jaw, two tusks
    mouth = m & (Z < fz - 0.5) & (Y > y0 + 1.5) & (Y < y0 + 8) & (np.abs(X - CX) < 12)
    P.flat(g, mouth, "red", 2)
    P.flat(g, mouth & (Y > y0 + 5.5) & ((np.floor(X) // 3) % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < y0 + 3.5) & ((np.floor(X) // 3) % 3 == 1), "bone", 5)
    for s in (-1, 1):
        tusk = limb(g, (CX + s * 9, y0 + 7, fz - 1.5), (CX + s * 11, y0 + 16, fz - 4), 1.8, 0.4, "bone", 6, n=4)
        del tusk
    # little ears and a stitched cheek
    for s in (-1, 1):
        S.bar(g, "z", (CX + s * 15, y0 + 14), (CX + s * 19, y0 + 19), 4.0, nz - 6, nz, *SKIN)
    P.flat(g, m & (np.abs(X - (CX - 12)) < 0.7) & (Y > y0 + 4) & (Y < y0 + 12) & (Z < fz + 3), "khaki", 4)
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    ex, ey, ez = sx + s * 18, 62.0, sz - 6
    wx, wy, wz = sx + s * 27, 34.0, sz - 14
    delt = plan(g, oval(sx + s * 2, sz, 13, 13, 8), sy - 10, sy + 4, *SKIN, top=oval(sx, sz, 8, 9, 8))
    upper = limb(g, (sx, sy - 2, sz), (ex, ey, ez), 9.5, 8.0, *SKIN, n=6)
    fore = limb(g, (ex, ey, ez), (wx, wy, wz), 8.5 if s < 0 else 10.5, 8.0 if s < 0 else 12.0, *SKIN, n=6)
    fist = box(g, wx - 11, wy - 22, wz - 12, wx + 11, wy + 1, wz + 11, *SKIN)
    skin(g, delt | upper | fore | fist, *SKIN, seed=7 + s, cell=8)
    veins(g, upper | fore, seed=8 + s, n=4)
    # knuckles and yellow nails on the fist
    P.flat(g, fist & (Z < wz - 11) & ((np.floor(X) - int(wx - 11)) % 6 == 0), "teal", 3)
    P.flat(g, fist & (Z < wz - 11) & (Y < wy - 18), "gold", 6)
    if s > 0:  # the club arm: rebar spikes and a car door strapped on as a shield
        for (a, b) in (((wx + 2, wy + 8, wz - 6), (wx + 10, wy + 20, wz - 16)), ((wx - 4, wy - 4, wz - 8), (wx - 10, wy + 2, wz - 22)),
                       ((wx + 6, wy - 10, wz + 4), (wx + 18, wy - 6, wz + 10)), ((wx, wy + 14, wz + 6), (wx - 2, wy + 26, wz + 16))):
            limb(g, a, b, 1.1, 0.9, "rust", 5, n=4)
        door = side(g, [(wy - 12, wz - 18), (wy + 22, wz - 12), (wy + 24, wz + 12), (wy - 10, wz + 10)], wx + 11, wx + 14, "teal", 6)
        P.mottle(g, door, "teal", 6, cell=4, seed=9)
        win = door & (Y > wy + 8) & (Y < wy + 20) & (Z > wz - 8) & (Z < wz + 8)
        P.flat(g, win, "sky", 5)
        P.outline(g, win, "teal", 3, normal="x")
        P.flat(g, door & (np.abs(Y - (wy + 4)) < 2) & (Z > wz + 2) & (Z < wz + 7), "steel", 6)  # the handle
        PP.blotch(g, door, "rust", 5, cell=3, chance=0.06, seed=10)
        for sy2 in (wy - 4, wy + 14):  # steel straps
            strap = box(g, wx + 10, sy2, wz - 13, wx + 15, sy2 + 3, wz + 12, "steel", 5)
            del strap
    return g


HEEL = {"leg-l": (-2.0, -34.0, 9.0), "leg-r": (2.0, -34.0, 9.0)}


def _attack(root):
    """Baked double-fist ground slam: (keys, impact frame)."""
    R = root.name
    # A long, heavy wind-up the eye can read: it first hunches down and
    # drags both arms back low behind it (f0-4, a squash), then hauls them
    # out to the sides and up over its head as the body rises and arches
    # back (f6-14, the club arm a frame behind), and keeps coiling at the
    # top, arching further back and swelling (f14-24, a moving hold). Then
    # both fists drive down in 4 frames, fastest at the ground (impact
    # f28). The fists stay planted while the body crunches on down past
    # the contact, squashed, the arms taking the load; it heaves itself
    # back up past rest and settles.
    I = 28
    up, tuck = 186, 20
    k = {}
    for name, s in (("arm-l", -1), ("arm-r", 1)):
        o = s > 0
        k[name] = {"rot": T((0, (0, 0, 0)), (3 + o, (-24, 0, s * 18)), (6 + o, (-28, 0, s * 20)), (9 + o, (60, 0, s * 72)), (11 + o, (128, -s * 48, s * 24)), (14 + o, (up, 0, s * tuck)),
                            (24, (up + 12 - 2 * o, 0, s * tuck * 1.15)), (I, (24 + 2 * o, 0, s * 2), ">"), (I + 3, (32, 0, -s * 3)), (I + 8, (30, 0, 0)),
                            (I + 15 + o, (-3, 0, 0)), (I + 18, (0, 0, 0))),
                   "scale": T((0, (1, 1, 1)), (I + 18, (1, 1, 1)))}
    k["body"] = {"rot": T((0, (0, 0, 0)), (3, (-8, 0, 0)), (6, (-9, 0, 0)), (14, (10, 0, 0)), (24, (15, 0, 0)), (I, (-22, 0, 0), ">"), (I + 3, (-30, 0, 0)), (I + 8, (-26, 0, 0)),
                          (I + 15, (3, 0, 0)), (I + 18, (0, 0, 0))),
                 "loc": T((0, (0, 0, 0)), (3, (0, -3.0, -0.5)), (6, (0, -3.3, -0.5)), (14, (0, 3.0, 0.3)), (24, (0, 4.0, 0.8)), (I, (0, -7, -4), ">"), (I + 3, (0, -12, -4.8)), (I + 8, (0, -10.4, -4.4)),
                          (I + 15, (0, 0.6, -0.2)), (I + 18, (0, 0, 0))),
                 "scale": T((0, (1, 1, 1)), (3, (1.04, 0.93, 1.04)), (6, (1.04, 0.92, 1.04)), (14, (0.98, 1.05, 0.98)), (24, (0.98, 1.07, 0.98)), (I - 1, (0.97, 1.05, 0.98)), (I + 1, (1.08, 0.85, 1.07)),
                            (I + 2, (1.06, 0.88, 1.05)), (I + 5, (0.99, 1.02, 0.99)), (I + 8, (1, 1, 1)))}
    k["head"] = {"rot": T((0, (0, 0, 0)), (3, (-6, 0, 0)), (7, (-7, 0, 0)), (15, (12, 0, 0)), (24, (18, 0, 0)), (I + 1, (-6, 0, 0)), (I + 4, (-20, 3, 0)), (I + 9, (-10, -2, 0)),
                          (I + 15, (3, 0, 0)), (I + 18, (0, 0, 0)))}
    k[R] = {"rot": T((0, (0, 0, 0)), (I + 18, (0, 0, 0))), "loc": T((0, (0, 0, 0)), (I + 18, (0, 0, 0)))}  # the feet stay planted
    attack = B.bake(k, I + 18)
    # the fists land on the floor and stay there: each arm takes the
    # crunch by shortening (its scale along its length) as the body drops
    for name, x in (("arm-l", SHOULDERS["arm-l"][0] - 27), ("arm-r", SHOULDERS["arm-r"][0] + 27)):
        sx, sy, sz = SHOULDERS[name]
        fist = (x - sx, 12.0 - sy, (sz - 14) - sz)  # the fist's knuckles, from the shoulder
        B.plant(root, attack, name, fist, range(I + 1, I + 10), coord="z", at=I)  # no sliding along the floor
        B.reach(root, attack, name, "y", range(I, I + 10), height=0.0, fade_in=0, fade_out=4, channel="scale", step=0.01, span=0.4)
    return B.fill(root, attack), I


def _move(root, N: int = 48, stance: int = 30, stride: float = 20.0, lift: float = 10.0):
    """A thundering walk, keyed every frame: (keys).

    Each boot plants flat and its contact edge (the toe, or the heel while
    the leg still leans forward) slides back at constant ground speed
    through the stance, so nothing skates; it rolls up onto the toe at
    toe-off. The swing is a slow heavy lift (eased up to `lift` voxels and
    forward), a short hang, then the boot drops in 5 frames, accelerating
    into the floor. Each footfall drives the body down hard (a jolt that
    bottoms out 2 frames after contact, squashed) with a small shake that
    dies out, and the weight swings over onto the new foot (the torso
    shifts and rolls over it); the head nods down and the arms flare a
    frame late, then the body heaves itself slowly up for the next step.
    Loops seamlessly in 1.6 s (left contact f12, right f36). The step keys
    below are authored on a 30-frame step: the jolt keeps its frames, the
    slow heave between jolts is squeezed to fit."""
    poser = Poser(root)
    floor = B.floor_y(poser)
    parts = {p.name: p for p in root.walk()}
    swing = N - stance
    half = N // 2
    edges = {}
    for name in ("leg-l", "leg-r"):
        pts = B.hull_points(parts[name])
        lo = pts[pts[:, 1] < pts[:, 1].min() + 0.6]
        edges[name] = (np.array([lo[:, 0].mean(), lo[:, 1].mean(), lo[:, 2].min()]),  # the toe edge
                       np.array([lo[:, 0].mean(), lo[:, 1].mean(), lo[:, 2].max()]))  # the heel edge
    zero = (0.0, 0.0, 0.0)
    blank = lambda v: [(f * F, v) for f in range(N + 1)]  # noqa: E731
    k = {n: {"rot": blank(zero), "loc": blank(zero)} for n in ("leg-l", "leg-r", "body", "head", "arm-l", "arm-r")}
    k["body"]["scale"] = blank((1.0, 1.0, 1.0))

    def lerp(keys, x):
        """Piecewise linear through (x, value) keys."""
        for (a, va), (b, vb) in zip(keys, keys[1:]):
            if a <= x <= b:
                return va + (vb - va) * (x - a) / (b - a)
        return keys[-1][1]

    def smooth(u):
        u = min(1.0, max(0.0, u))
        return u * u * (3 - 2 * u)

    def foot(f, off):
        """(z offset of the contact edge from rest, lift, lean, stance?) for a
        foot that plants at frame `off`."""
        p = (f - off) % N
        if p < stance:  # planted: constant ground speed, rolling onto the toe at the end
            u = p / stance
            lean = 4.0 - 14.0 * smooth((u - 0.55) / 0.45) - 4.0 * min(1.0, u / 0.25)
            return -stride / 2 + stride * u, 0.0, lean, True
        q = p - stance
        drop = 5
        if q <= swing - drop:  # the slow heavy lift and carry, then a short hang
            u = q / (swing - drop)
            h = lift * smooth(q / (swing - drop - 3)) + 0.4 * max(0.0, (q - (swing - drop - 3)) / 3)
            z = stride / 2 - stride * smooth(q / (swing - drop - 1))
            lean = -14.0 + 22.0 * smooth(u)
        else:  # the drop: gravity, fastest at the floor
            w = (q - (swing - drop)) / drop
            h = (lift + 0.4) * (1 - w * w)
            z = -stride / 2
            lean = 8.0 - 4.0 * w
        return z, h, lean, False

    # the body's height through one step (frames since the last footfall)
    bob = [(0, -1.8), (1, -4.0), (2, -6.6), (3, -5.4), (4, -6.2), (5, -5.7), (6, -5.9), (8, -5.8), (22, 1.5), (26, 1.8), (27, 1.4), (28, 0.75), (29, -0.3), (30, -1.8)]
    shake = [(0, 0.0), (1, 0.0), (2, 2.2), (4, -1.5), (6, 0.7), (8, 0.0), (30, 0.0)]
    nod = [(0, 0.0), (1, 1.5), (3, -10.0), (5, 2.0), (7, -2.5), (10, 0.0), (30, 0.0)]
    flare = [(0, 0.0), (1, -1.5), (3, 9.0), (6, 2.0), (9, 4.0), (13, 0.0), (30, 0.0)]
    pitch = [(0, 0.0), (2, -4.5), (6, -1.8), (20, 1.0), (27, 1.0), (30, 0.0)]
    squash = [(0, 0.0), (1, 0.5), (2, 1.0), (3, 0.5), (5, 0.0), (30, 0.0)]
    # the weight over the stance foot: left from f0, right from f30
    shift = [(0, 0.0), (7, -4.5), (24, -3.6), (30, 0.0), (37, 4.5), (54, 3.6), (60, 0.0)]
    def step(d):  # frames since the footfall -> the authored 30-frame step
        return d if d <= 8 else 8 + (d - 8) * 22 / (half - 8)
    for f in range(N + 1):
        d = step(f % half)
        t = f * F
        sgn = -1 if (f % N) < half else 1  # which foot carries it
        x = lerp(shift, (f % N) * 60 / N)
        sq = lerp(squash, d)
        k["body"]["loc"][f] = (t, (x, lerp(bob, d), 0.0))
        k["body"]["rot"][f] = (t, (lerp(pitch, d), -sgn * 2.0 * min(1.0, d / 6) * (1 - max(0, d - 20) / 10), -0.9 * x + sgn * lerp(shake, d)))
        k["body"]["scale"][f] = (t, (1 + 0.06 * sq, 1 - 0.08 * sq, 1 + 0.06 * sq))
        k["head"]["rot"][f] = (t, (lerp(nod, d), 0.0, 0.6 * x - 0.6 * sgn * lerp(shake, max(0, d - 1))))
        for name, s in (("leg-l", -1), ("leg-r", 1)):
            off = 0 if s < 0 else half
            z, h, lean, planted = foot(f, off)
            other = foot(f, half - off)[0]
            arm = "arm-l" if s < 0 else "arm-r"  # each arm swings with the opposite leg
            roll = k["body"]["rot"][f][1][2]
            k[arm]["rot"][f] = (t, (-0.9 * other, 0.0, s * lerp(flare, d) - roll))  # the arms hang, not roll with the torso
            extra = 0.0
            while poser.chain_low(k, f, arm) < floor + 1.5 and extra < 30:  # a knuckle would drag: swing the arm out
                extra += 0.5
                k[arm]["rot"][f] = (t, (-0.9 * other, 0.0, s * (lerp(flare, d) + extra) - roll))
            k[name]["rot"][f] = (t, (lean, 0.0, 0.0))
            k[name]["loc"][f] = (t, zero)
            toe, heel = edges[name]
            edge = heel if (planted and lean > 0) else toe
            # slide the leg along z so the contact edge is where it should be,
            # then up/down so the boot's lowest point sits at the lift
            p = poser.point(k, f, name, edge)
            dz = edge[2] + B.joint_of(root, name, (0, 0, 0))[2] + z - p[2]
            k[name]["loc"][f] = (t, (0.0, 0.0, dz))
            dy = floor + h - poser.chain_low(k, f, name)
            k[name]["loc"][f] = (t, (0.0, dy, dz))
    # start the loop mid-heave (a quiet frame), not on the footfall, so the
    # seam carries no jolt; the left foot lands on f12, the right on f36
    off = 12
    for chans in k.values():
        for ch, ks in chans.items():
            chans[ch] = [(f * F, ks[(f - off) % N][1]) for f in range(N + 1)]
    return k


def _hit_death(root):
    """Baked hit and death (see _big_falls): (hit, death, death impact frame)."""
    R = root.name
    # hit: the blow lands on frame 0-1: the whole bulk is thrown back and
    # up off its feet (the pop lands f8), twisted round and rolled by it
    # (the torso yaws about 18 degrees and rolls 9, readable from the
    # front), the head snaps aside, the arms fling wide a frame apart. It
    # lands heavily, the body sagging 4 into its legs, drifts back over its
    # planted feet, then heaves forward past rest and steps its feet back
    # under itself, one then the other.
    st = 1.35
    r = lambda k: round(8 + (k - 8) * st) if k > 8 else k  # noqa: E731
    hk = {R: B.react_body(push=5.5, pop=0.0, lean=6, side=0.0, settle=st),
          "body": {"rot": T((0, (0, 0, 0), "<"), (1, (6, 10, -5)), (3, (9, 17, -9)), (6, (10, 19, -10)), (r(11), (6, 12, -6)), (r(17), (-3, -4, 2)), (r(23), (1, 1, 0)), (r(30), (0, 0, 0))),
                   "loc": T((0, (0, 0, 0)), (7, (0, 0.6, 0)), (10, (0, -4.2, 0)), (r(14), (0, -1.2, 0)), (r(18), (0, 0.4, 0)), (r(22), (0, 0, 0))),
                   "scale": T((0, (1, 1, 1)), (1, (0.97, 1.03, 0.97)), (4, (1, 1, 1)), (9, (1, 1, 1)), (10, (1.04, 0.94, 1.04)), (13, (0.99, 1.01, 0.99)), (17, (1, 1, 1)))},
          "head": {"rot": T((0, (0, 0, 0)), (1, (-4, -6, 0)), (3, (22, 30, 12)), (7, (14, 25, 9)), (r(13), (-6, -8, -3)), (r(19), (3, 4, 1)), (r(26), (0, 0, 0)))},
          "arm-l": {"rot": T((0, (0, 0, 0)), (2, (-14, 0, -36)), (5, (-20, 0, -42)), (r(11), (-6, 0, -14)), (r(17), (6, 0, 4)), (r(24), (0, 0, 0)))},
          "arm-r": {"rot": T((0, (0, 0, 0)), (3, (-10, 0, 30)), (6, (-17, 0, 37)), (r(12), (-4, 0, 10)), (r(18), (7, 0, -3)), (r(25), (0, 0, 0)))},
          "leg-l": {"rot": T((0, (0, 0, 0)), (3, (-6, 0, -3)), (8, (0, 0, 0)), (38, (0, 0, 0)))},
          "leg-r": {"rot": T((0, (0, 0, 0)), (3, (-4, 0, 3)), (8, (0, 0, 0)), (38, (0, 0, 0)))}}
    hit = B.bake(hk, 38)
    B.ground(root, hit, R, height=B.arc(0, 8, 3.0), skip=())
    # the feet plant where they land and step home: left, then right
    B.walk_feet(root, hit, {"leg-l": ((-2.0, -34.0, 0.0), [(22, 27, 4.0)]), "leg-r": ((2.0, -34.0, 0.0), [(27, 32, 3.5)])}, R, range(8, 39))
    B.ground(root, hit, R, height=lambda f: 0.0, frames=range(8, 39), skip=())
    # death: a last roar rocking forward (f4), a short teeter back
    # (f4-14), then the whole mass goes over backwards about its heels like
    # a felled block, slow at first, faster and faster (power 3), the hips
    # opening so it lands flat (impact f30: the fastest and lowest frame,
    # flat on its back, squashed hard). The head lags forward through the
    # fall and slams back a frame after the body, the arms slap down out to
    # the sides on the next frame; one tiny heavy bounce and a dead stop.
    # The legs kick once and drop. 1.47 s.
    I = 30
    END = I + 14
    rest = (90.3, 0, 1)
    tip = T((0, (0, 0, 0)), (4, (-5, 0, 0)), (10, (3, 0, 0.5)), (14, (7, 0, 1)), (15, (7.6, 0, 1)))
    d = {R: {"rot": B.Fall(tip, 14, I, (90, 0, 1), T((I, (90, 0, 1)), (I + 2, (89.2, 0, 1)), (I + 4, rest, "0"), (END, rest)), power=3.0)},
         "body": {"rot": T((0, (0, 0, 0)), (4, (-7, 0, 0)), (10, (-10, 1, 0)), (20, (-9, 0, 0)), (I, (2, 0, 0), ">"), (I + 3, (0, 0, 0)), (END, (0, 0, 0))),
                  "scale": T((0, (1, 1, 1)), (I - 1, (0.99, 1.02, 1.02)), (I, (1.12, 1.05, 0.78), ">"), (I + 1, (1.08, 1.03, 0.86)), (I + 3, (0.98, 0.99, 1.04)), (I + 5, (1, 1, 1)),
                             (END, (1, 1, 1)))},
         # the head lags forward through the fall, then is flung back off the
         # top of the shoulders, the thick neck stretching, and slams onto
         # the floor behind them a frame after the body, lolling aside
         "head": {"rot": T((0, (0, 0, 0)), (4, (22, 0, 0)), (10, (10, 4, 0)), (20, (-10, -4, 0)), (I, (-10, 0, 0)), (I + 2, (112, 30, 6), ">"), (I + 4, (106, 34, 6)),
                           (I + 6, (110, 38, 6), ">"), (END, (110, 38, 6))),
                  "loc": T((0, (0, 0, 0)), (I, (0, 0, 0)), (I + 2, (0, 12, 14), ">"), (END, (0, 12, 14)))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):
        o = s > 0  # the right (club) arm swings a little wider, and lands a frame later
        sc = 1.0 if s < 0 else 0.85
        lie = (-26 - 3 * o, 0, s * (70 + 4 * o))
        d[name] = {"rot": T((0, (0, 0, 0)), (4 + o, (24 * sc, 0, s * 40)), (10 + o, (6, 0, s * (54 + 6 * o))), (16 + o, (26 * sc, 0, s * 44)), (I - 3, (12 - 4 * o, 0, s * 56)),
                            (I, (-12 + 6 * o, 0, s * 64)), (I + 1 + o, lie, ">"), (END, lie))}
    for name, s in (("leg-l", -1), ("leg-r", 1)):
        o = s > 0
        lie = (-36 - 2 * o, 0, s * (5 + o))
        hips = B.Fall(T((0, (0, 0, 0)), (14, (0, 0, 0)), (15, (-0.1, 0, 0))), 14, I, lie, T((I, lie), (I + 3 + o, (lie[0] + 12, 0, lie[2])), (I + 6 + o, lie, ">"), (END, lie)), power=2.0)
        d[name] = {"rot": hips}
    death = B.bake(d, END)
    # the squash flattens the torso onto its back, not up off the floor
    sc = death["body"]["scale"]
    death["body"]["loc"] = [(t, (0.0, 0.0, 30.0 * (1 - v[2]))) for t, v in sc]
    lift = B.arc(I, I + 4, 0.8)
    B.ground(root, death, R, height=lift, pin=("leg-l", HEEL["leg-l"], (4, I), "z"))
    # the body rests on the floor; the arms, legs and head come to rest
    # just on it, not hovering over it
    B.ground(root, death, R, height=lambda f: 0.0, frames=range(I + 4, END + 1), skip=("arm-l", "arm-r", "leg-l", "leg-r", "head"))
    for name in ("arm-l", "arm-r", "leg-l", "leg-r"):
        o = name.endswith("r")
        start = I + (1 if name.startswith("arm") else 7) + o
        B.reach(root, death, name, "x", range(start, END + 1), height=0.05, fade_in=1, fade_out=0, span=25)
    return B.fill(root, hit), B.fill(root, death), I


def _build():
    rig = Rig("mutant-behemoth", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body")
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    idle = {"body": {"scale": wave(3.0, (0.015, 0.01, 0.015), base=(1, 1, 1)), "rot": wave(3.0, (2, 0, 1.5))},
            "head": {"rot": seq((0, 0, 0, 0), (1.2, 0, 8, 3), (1.6, 18, 0, 0), (2.1, 18, 0, 0), (2.5, 0, -6, -3), (3.0, 0, 0, 0))},
            "arm-l": {"rot": wave(3.0, (4, 0, -3), phase=0.4)}, "arm-r": {"rot": wave(3.0, (4, 0, 3), phase=2.0)}}
    move = _move(rig.root)
    # attack: both arms swing out to the sides and up together to stand
    # straight over the head (tilted in, so the rest splay does not throw
    # them wide; the car door stays outside and above, the face stays
    # clear), hold, then slam down in front. The keys are mirror pairs
    # (x, y, z) / (x, -y, -z), each step 105 degrees or less, so the
    # quaternion path stays on the intended side.
    attack, imp = _attack(rig.root)
    hit, death, dimp = _hit_death(rig.root)
    fist_x = SHOULDERS["arm-r"][0] + 27
    return make("creatures", "mutant-behemoth", "Mutant Behemoth", rig.root,
                clips=[Clip("idle", idle), Clip("move", move, ease=0, floor=False), Clip("attack", attack, loop=False, impact=imp * F, ease=0), Clip("hit", hit, loop=False, ease=0), Clip("death", death, loop=False, impact=dimp * F, ease=0)],
                # both fists slam: each gets its own socket and dust
                sockets=[rig.socket("socket-fist", (fist_x, 12.0, SHOULDERS["arm-r"][2] - 14), parent="arm-r"),
                         rig.socket("socket-fist-l", (SHOULDERS["arm-l"][0] - 27, 12.0, SHOULDERS["arm-l"][2] - 14), parent="arm-l"),
                         rig.socket("socket-vents", (CX, 106.0, CZ + 17), parent="body"),
                         rig.socket("socket-mouth", (CX, NECK[1] - 1, NECK[2] - 19), parent="head")],
                pfx=[fx("rvx-apocalypse-ground-slam", "socket-fist", "clip:attack", size=90, at=imp * F), fx("rvx-apocalypse-ground-slam", "socket-fist-l", "clip:attack", size=90, at=imp * F), fx("rvx-apocalypse-toxic-vent", "socket-vents", "idle", size=36), fx("rvx-apocalypse-gore-burst", "socket-mouth", "clip:hit", size=44)])


def build():
    return _build()
