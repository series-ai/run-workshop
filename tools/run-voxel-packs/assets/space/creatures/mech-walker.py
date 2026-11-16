"""Mech walker, in the Pirate Nation mecha style.

A two-person-tall combat walker, chunky and toy-like: a boxy white hull
with a sloped nose (true slopes), orange stripes, hazard chevrons, a big
teal canopy with the pilot's orange helmet behind it and a whip antenna;
two orange rocket pods on the shoulders with painted warheads; two long
arm cannons with copper coils. It stands on reverse-jointed legs: white
thighs that angle forward, steel shins with copper pistons that angle
back, and big clawed feet (all true-slope prisms). Clips: idle (hum),
move (stomp), attack (brace, both cannons fire together and the
recoil kicks the whole walker back; muzzle flash and explosion PFX),
hit (rock), death (sputter, collapse and nose-dive). Faces -Z.
"""
import numpy as np

from _motion import DEATH_FLOOR, curve, topple
from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, light_top, quad, side, wave
from pnshapes import disc

S = (60, 76, 56)
CX, CZ = 30, 28
HIP = (39.0, CZ)  # (y, z)
KNEE = (22.0, CZ - 8)
ANKLE = (7.0, CZ + 3)
YH = 42  # hull bottom (the hull joint)
LEG_X = 14  # leg centre offset from CX
GUN_LIE = 80.0  # death: the cannons swing down along the floor
LIE, THIGH, SHIN, SPLAY = 92.0, -40.0, 86.0, 15.0,  # death: the lying angle and the flopped legs
GUN = (16, 48)  # cannon x offset and axis height


def pelvis() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    p = box(g, CX - 9, 35, CZ - 6, CX + 9, YH, CZ + 6, "steel", 5)
    P.plates(g, p, "steel", 5, size=(6, 4), seed=1)
    P.flat(g, edges(p), "steel", 3)
    for s in (-1, 1):
        hub = disc(g, "x", HIP[0], HIP[1], 4.5, CX + (9 if s > 0 else -11), CX + (11 if s > 0 else -9), "steel", 4)
        P.flat(g, hub & (np.hypot(Y - HIP[0], Z - HIP[1]) < 2), "gold", 6)
    return g


def thigh(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = CX + s * LEG_X - 3.5, CX + s * LEG_X + 3.5
    t = side(g, quad(HIP, KNEE, 5.0, 4.0, cap=0.4), x0, x1, "bone", 6)
    P.flat(g, t, "bone", 6)
    P.flat(g, t & (np.abs(X - (CX + s * LEG_X)) > 2.6), "bone", 5)
    P.flat(g, t & (np.abs(Y - 31) < 1.5), "orange", 6)
    knee = disc(g, "x", KNEE[0], KNEE[1], 4.0, x0 - 1, x1 + 1, "steel", 4)
    P.flat(g, knee & (np.hypot(Y - KNEE[0], Z - KNEE[1]) < 1.6), "gold", 6)
    return g


def shin(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    xc = CX + s * LEG_X
    sh = side(g, quad(KNEE, ANKLE, 3.6, 3.0, cap=0.3), xc - 3, xc + 3, "steel", 5)
    P.flat(g, sh, "steel", 5)
    P.flat(g, sh & (np.abs(X - xc) > 2.1), "steel", 4)
    P.flat(g, sh & (np.abs(Y - 14) < 1), "orange", 6)
    # a copper piston behind the shin
    pis = side(g, quad((KNEE[0] - 1, KNEE[1] + 4), (ANKLE[0] + 3, ANKLE[1] + 5), 1.1), xc - 1, xc + 1, "rust", 6)
    P.flat(g, pis, "rust", 6)
    P.flat(g, pis & (Y > 15), "steel", 6)
    # the big clawed foot
    foot = box(g, xc - 4.5, 2, CZ - 7, xc + 4.5, 7, CZ + 8, "steel", 4)
    P.flat(g, foot, "steel", 4)
    light_top(g, foot, "steel", 6)
    hazard(g, foot & (Y < 4.5) & (Y > 2), period=4, frame="wall")
    for k in (-1, 0, 1):  # three front toes, hooked down (true slopes)
        side(g, [(2, CZ - 7), (6, CZ - 7), (3, CZ - 12), (0, CZ - 12.5)], xc + k * 3 - 1.2, xc + k * 3 + 1.2, "steel", 5)
    side(g, [(2, CZ + 8), (5, CZ + 8), (0, CZ + 12)], xc - 1.2, xc + 1.2, "steel", 5)  # back spur
    toes = (Z < CZ - 7) | (Z > CZ + 8)
    P.flat(g, g.a.astype(bool) & toes & (Y < 7), "steel", 5)
    P.flat(g, g.a.astype(bool) & (Z < CZ - 11), "bone", 6)  # pale claw tips
    return g


def hull() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    prof = [(YH, CZ - 9), (YH, CZ + 10), (61, CZ + 10), (64, CZ + 5), (64, CZ - 3), (57, CZ - 13), (48, CZ - 13)]
    h = side(g, prof, CX - 12, CX + 12, "bone", 6)
    P.plates(g, h, "bone", 6, size=(8, 7), rivets=False, seed=4)
    P.flat(g, h & ((X < CX - 11) | (X > CX + 11)) & (Y > 50) & (Y < 53), "orange", 6)  # side stripes
    P.flat(g, h & (Y < YH + 1.5), "bone", 4)
    light_top(g, h & (Y > 63), "bone", 7)
    # hazard chevrons on the chin
    chin = h & (Z < CZ - 9) & (Y < 48)
    hazard(g, chin, period=6, a=("orange", 6), b=("steel", 4), frame="z")
    # the big canopy on the sloped nose, with the pilot behind it
    slope_z = CZ - 13 + (Y - 57) * (10 / 7)
    canopy = h & (Y > 56.5) & (Y < 63) & (np.abs(X - CX) < 8) & (Z < slope_z + 2.2)
    P.flat(g, canopy, "cyan", 6)
    P.flat(g, canopy & (Y > 61), "cyan", 7)
    P.flat(g, canopy & (np.abs(X - CX + 3) < 2.4) & (Y > 57) & (Y < 61), "orange", 6)  # the pilot's helmet
    P.flat(g, canopy & (np.abs(X - CX + 3) < 1.6) & (Y > 58) & (Y < 59.5), "navy", 5)  # visor
    P.flat(g, canopy & ((np.abs(X - CX) > 7) | (Y < 57.5)), "steel", 4)  # canopy frame
    face = h & (Z < CZ - 12) & (Y > 48) & (Y < 56)
    P.flat(g, face & (np.abs(X - CX) < 7) & (np.floor(Y) % 2 == 0), "steel", 4)  # grille
    # antenna
    box(g, CX + 8, 64, CZ + 6, CX + 9, 72, CZ + 7, "steel", 5)
    box(g, CX + 7.5, 72, CZ + 5.5, CX + 9.5, 74, CZ + 7.5, "red", 6)
    # shoulder mounts for the cannons
    for s in (-1, 1):
        m = box(g, CX + s * 12 - (0 if s > 0 else 3), GUN[1] - 4, CZ - 4, CX + s * 12 + (3 if s > 0 else 0), GUN[1] + 4, CZ + 5, "steel", 4)
        P.flat(g, edges(m), "steel", 3)
    return g


def pod(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = (CX + 8, CX + 19) if s > 0 else (CX - 19, CX - 8)
    p = box(g, x0, 60, CZ - 7, x1, 69, CZ + 7, "orange", 6)
    P.flat(g, p, "orange", 6)
    P.flat(g, edges(p), "orange", 4)
    light_top(g, p, "orange", 7)
    face = p & (Z < CZ - 6.5)
    P.flat(g, face, "steel", 4)
    for cx in (x0 + 2.5, x0 + 5.5, x0 + 8.5):
        for cy in (62.5, 66.5):
            P.flat(g, face & (np.hypot(X - cx, Y - cy) < 1.3), "red", 6)
            P.flat(g, face & (np.hypot(X - cx + 0.4, Y - cy - 0.4) < 0.6), "bone", 7)
    P.flat(g, p & (Z > CZ + 3) & (Y > 61) & (Y < 63), "steel", 4)
    return g


def cannon(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * (GUN[0] + 2)
    body = disc(g, "z", x, GUN[1], 3.4, CZ - 10, CZ + 6, "steel", 5)
    P.flat(g, body, "steel", 5)
    light_top(g, body, "steel", 6)
    barrel = disc(g, "z", x, GUN[1], 2.2, CZ - 24, CZ - 10, "steel", 6)
    for z0 in (CZ - 20, CZ - 16, CZ - 12):
        P.flat(g, disc(g, "z", x, GUN[1], 2.8, z0, z0 + 2, "rust", 6), "rust", 6)
    tip = disc(g, "z", x, GUN[1], 2.8, CZ - 26, CZ - 24, "steel", 4)
    P.flat(g, tip & (Z < CZ - 25) & (np.hypot(X - x, Y - GUN[1]) < 1.6), "orange", 7)
    P.flat(g, body & (Y > GUN[1] + 2) & (Z > CZ - 8) & (Z < CZ + 2), "orange", 6)
    del barrel
    return g


def _stomp_cycle(T: int = 36, stance: int = 20, stride: float = 11.1, crouch: float = 0.5, lift: float = 5.0, fwd: float = -2.5) -> dict:
    """A robotic stomp, keyed every frame: each foot is solved (2-bone IK,
    the foot rigid on the shin) so its lowest edge stays on the floor and
    slides back at constant ground speed through the stance (heel strike
    to toe-off); the swing foot lifts straight up in 2 frames, swings
    forward level and drops hard onto the floor in 3 frames, accelerating.
    Each plant jolts the hull down and snaps its roll over the new stance
    foot, and the cannons dip a frame late. Loops seamlessly."""
    import math
    hip, knee, ankle = HIP, KNEE, ANKLE
    k0 = (knee[0] - hip[0], knee[1] - hip[1])
    s0 = (ankle[0] - knee[0], ankle[1] - knee[1])
    corners = ((-7.0, -15.5), (-7.0, 9.0))  # the sole's toe and heel edges (from the ankle)

    def rot(v, a):
        a = math.radians(a)
        return (v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a))

    def fk(t, sh):
        k, a = rot(k0, t), rot(s0, t + sh)
        return (k[0] + a[0], k[1] + a[1])

    def ik(dy, dz, t=0.0, sh=0.0):
        for _ in range(50):
            p = fk(t, sh)
            ey, ez = p[0] - dy, p[1] - dz
            if abs(ey) + abs(ez) < 1e-6:
                break
            h = 1e-4
            pa, pb = fk(t + h, sh), fk(t, sh + h)
            a, c = (pa[0] - p[0]) / h, (pb[0] - p[0]) / h
            b, d = (pa[1] - p[1]) / h, (pb[1] - p[1]) / h
            det = a * d - b * c
            t -= (d * ey - c * ez) / det
            sh -= (-b * ey + a * ez) / det
        return t, sh

    def planted(dz):
        """Leg angles with the sole's lowest edge on the floor and `dz` along
        from rest (the heel edge moves at constant speed, the toe only
        carries the weight once the foot rolls flat past it); returns
        (thigh, shin, ankle height, ankle shift)."""
        ay, az = ankle[0], 0.0
        t = sh = 0.0
        for _ in range(30):
            t, sh = ik(ay - crouch - hip[0], ankle[1] - hip[1] + dz + az, t, sh)
            pts = [rot(c, t + sh) for c in corners]
            low = min(pts, key=lambda p: p[0])
            ay = -low[0]
            az = corners[pts.index(low)][1] - low[1]  # keep the contact edge where it was keyed
        return t, sh, ay, az

    swing = T - stance
    legs = {}
    for name, off in (("l", 0), ("r", T // 2)):
        th, sn = [], []
        for f in range(T + 1):
            p = (f - off) % T
            if p < stance:
                t, sh, _, _ = planted(fwd - stride / 2 + stride * p / stance)
            else:
                q = p - stance
                if q <= 2:
                    dz, up = fwd + stride / 2, lift * q / 2
                elif q <= swing - 3:
                    dz, up = fwd + stride / 2 - stride * (q - 2) / (swing - 5), lift
                else:
                    dz, up = fwd - stride / 2, lift * (1 - ((q - (swing - 3)) / 3) ** 2)
                _, _, ay, az = planted(dz)
                t, sh = ik(ay + up - crouch - hip[0], ankle[1] - hip[1] + dz + az)
            th.append((f, (t, 0, 0)))
            sn.append((f, (sh, 0, 0)))
        legs[f"thigh-{name}"] = {"rot": curve(*th)}
        legs[f"shin-{name}"] = {"rot": curve(*sn)}
    z = (0.0, 0.0, 0.0)
    jolt = {0: -1.4, 1: -0.6, 2: -0.1}
    half = T // 2
    hull_loc, hull_rot, gun_rot = [], [], []
    for f in range(T + 1):
        d = f % half  # frames since the last plant (left at 0, right at T/2)
        roll_to = 3.0 if f % T < half else -3.0  # roll over the planted foot
        roll = -roll_to + 2 * roll_to * d / 2 if d < 2 else roll_to
        hull_loc.append((f, (0, jolt.get(d, 0.0), 0)))
        hull_rot.append((f, (0, 0, roll)))
        gun_rot.append((f, (3.0 if d == 1 else 0.0, 0, 0)))
    legs["mech-walker"] = {"loc": curve((0, (0, crouch, 0)), (T, (0, crouch, 0)))}
    legs["hull"] = {"loc": curve(*hull_loc), "rot": curve(*hull_rot)}
    legs["cannon-l"] = {"rot": curve(*gun_rot)}
    legs["cannon-r"] = {"rot": curve(*gun_rot)}
    return legs


def build():
    rig = Rig()
    rig.add("mech-walker", pelvis(), (CX, HIP[0], HIP[1]))
    for s, name in ((1, "l"), (-1, "r")):
        rig.add(f"thigh-{name}", thigh(s), (CX + s * LEG_X, HIP[0], HIP[1]), "mech-walker")
        rig.add(f"shin-{name}", shin(s), (CX + s * LEG_X, KNEE[0], KNEE[1]), f"thigh-{name}")
    rig.add("hull", hull(), (CX, YH, CZ), "mech-walker")
    rig.add("pod-l", pod(1), (CX + 13, 60, CZ), "hull")
    rig.add("pod-r", pod(-1), (CX - 13, 60, CZ), "hull")
    rig.add("cannon-l", cannon(1), (CX + GUN[0] + 2, GUN[1], CZ), "hull")
    rig.add("cannon-r", cannon(-1), (CX - GUN[0] - 2, GUN[1], CZ), "hull")
    socks = [rig.sock("socket-cannon-l", (CX + GUN[0] + 2, GUN[1], CZ - 26), "cannon-l"),
             rig.sock("socket-cannon-r", (CX - GUN[0] - 2, GUN[1], CZ - 26), "cannon-r")]
    z = (0.0, 0.0, 0.0)
    F = 1 / 30

    def hold(*poses):
        """Robotic keys: each (frame_in, frame_out, value) arrives at
        frame_in and stays locked until frame_out."""
        out = []
        for f0, f1, v in poses:
            out.append((f0, v))
            if f1 > f0:
                out.append((f1, v))
        return curve(*out)

    # Idle: a sentry scan. The hull turns in 4-frame moves and locks (left,
    # right, home), each stop settling on its hydraulics; the pods ratchet.
    idle = {"hull": {"rot": hold((0, 6, z), (10, 36, (0, 12, 0)), (40, 70, (0, -12, 0)), (74, 90, z)),
                     "loc": hold((0, 0, z), (10, 10, (0, -0.6, 0)), (12, 40, z), (40, 40, z), (42, 42, (0, -0.6, 0)), (44, 74, z), (76, 76, (0, -0.6, 0)), (78, 90, z))},
            "pod-l": {"rot": hold((0, 12, z), (14, 44, (6, 0, 0)), (46, 78, (-4, 0, 0)), (80, 90, z))},
            "pod-r": {"rot": hold((0, 14, z), (16, 46, (6, 0, 0)), (48, 80, (-4, 0, 0)), (82, 90, z))}}
    move = _stomp_cycle()
    # Double cannon blast, robotic: the hull drops into a brace and locks
    # with the cannons drawn back and level (hold), both fire at 0.4 s and in
    # one frame the barrels slam back, the muzzles kick up, the hull is
    # thrown nose-up and the whole walker skids back 6; it locks in the
    # recoil while the pods rattle, then resets in two locked steps.
    fire_f = 12
    fire_t = fire_f * F
    gun = {"rot": hold((0, 0, z), (4, 11, (-6, 0, 0)), (fire_f, 13, (28, 0, 0)), (15, 20, (22, 0, 0)), (23, 25, (6, 0, 0)), (28, 30, z)),
           "loc": hold((0, 0, z), (4, 11, (0, 0, 2.0)), (fire_f, 13, (0, 0, 9.0)), (15, 20, (0, 0, 7.0)), (23, 25, (0, 0, 2.0)), (28, 30, z))}
    attack = {"cannon-l": gun, "cannon-r": gun,
              "hull": {"rot": hold((0, 0, z), (4, 11, (-9, 0, 0)), (fire_f, 13, (17, 0, 0)), (15, 20, (13, 0, 0)), (23, 25, (3, 0, 0)), (28, 30, z)),
                       "loc": hold((0, 0, z), (4, 11, (0, -3, -1.5)), (fire_f, 13, (0, 0.5, 3.0)), (15, 20, (0, -0.5, 2.4)), (23, 25, (0, -0.8, 0.5)), (28, 30, z))},
              "mech-walker": {"loc": hold((0, 11, z), (fire_f + 1, 14, (0, 0, 5.0)), (16, 20, (0, 0, 6.0)), (23, 25, (0, 0, 2.5)), (28, 30, z))},
              "pod-l": {"rot": hold((0, 12, z), (14, 15, (22, 0, 0)), (17, 18, (-8, 0, 0)), (20, 30, z))},
              "pod-r": {"rot": hold((0, 13, z), (15, 16, (22, 0, 0)), (18, 19, (-8, 0, 0)), (21, 30, z))}}
    # Hit from the front, robotic: frames 0-2 the hull jolts back nose-up and
    # the walker skids back 4, cannons and pods kicked up a frame later; it
    # locks, snaps forward with a heavy sag and locks again, then resets.
    hit = {"mech-walker": {"loc": hold((0, 0, z), (2, 6, (0, 0, 4.0)), (9, 12, (0, 0, 2.5)), (15, 16, z))},
           "hull": {"rot": hold((0, 0, z), (2, 6, (12, 0, 4)), (9, 12, (-5, 0, 0)), (15, 16, z)),
                    "loc": hold((0, 0, z), (2, 6, (0, 0.5, 0.5)), (9, 12, (0, -2.5, 0)), (15, 16, z))},
           "cannon-l": {"rot": hold((0, 0, z), (3, 6, (18, 0, 0)), (9, 12, (-8, 0, 0)), (15, 16, z))},
           "cannon-r": {"rot": hold((0, 0, z), (3, 6, (16, 0, 0)), (9, 12, (-7, 0, 0)), (15, 16, z))},
           "pod-l": {"rot": hold((0, 0, z), (3, 6, (14, 0, 0)), (9, 12, (-6, 0, 0)), (15, 16, z))},
           "pod-r": {"rot": hold((0, 1, z), (4, 6, (14, 0, 0)), (10, 12, (-6, 0, 0)), (15, 16, z))}}
    # Systems failure, onto its back, robotic: the blow jolts the walker
    # back (skid) and it locks; it stamps its right foot back a step and
    # locks; one more jolt back, then it goes over backwards stiff,
    # hinging on its heels, slow at first and fastest at the floor, into a
    # huge thud flat on its back (impact 0.9 s) with a squash and a tiny
    # bounce. The cannons slam down flat and the pods rattle two frames
    # later, the legs flop last.
    f_hit = 27
    end = f_hit + 12
    rot, loc, die_t = topple((-39.0, 12.02), beats=[(0, 0.0), (2, 5.0), (6, 5.0), (9, 3.0), (12, 3.0), (14, 9.0)], f_hit=f_hit, lie=LIE, lead=0.15,
                             power=2.6, bounce_up=0.25, bounce_deg=0.3, end=end)

    def slide(f):
        pts = [(0, 0.0), (2, 3.0), (6, 3.0), (9, 6.0), (12, 6.0), (14, 7.0)]
        for (f0, a0), (f1, a1) in zip(pts, pts[1:]):
            if f <= f1:
                return a0 + (a1 - a0) * (f - f0) / (f1 - f0)
        return pts[-1][1]
    loc = [(t, (x, y, zz + slide(t / F))) for t, (x, y, zz) in loc]
    one = (1.0, 1.0, 1.0)
    death = {"mech-walker": {"rot": rot, "loc": loc},
             "hull": {"rot": hold((0, 0, z), (2, 6, (6, 6, 0)), (9, 12, (-3, -6, 0)), (14, f_hit - 1, (4, 0, 0)), (f_hit, end, z)),
                      "scale": curve((0, one), (f_hit - 1, one), (f_hit, (1.14, 0.86, 1.0)), (f_hit + 2, (0.97, 1.03, 1.0)), (f_hit + 4, one), (end, one))},
             "cannon-l": {"rot": hold((0, 0, z), (3, 6, (14, 0, 0)), (9, 12, (-6, 0, 0)), (15, 20, (20, 0, 0)), (f_hit - 2, f_hit - 2, (30, 0, 0)),
                                      (f_hit + 2, f_hit + 2, (GUN_LIE + 6, 0, 0)), (f_hit + 4, end, (GUN_LIE, 0, 0)))},
             "cannon-r": {"rot": hold((0, 0, z), (3, 6, (10, 0, 0)), (9, 12, (-8, 0, 0)), (15, 20, (24, 0, 0)), (f_hit - 2, f_hit - 2, (32, 0, 0)),
                                      (f_hit + 3, f_hit + 3, (GUN_LIE + 6, 0, 0)), (f_hit + 5, end, (GUN_LIE, 0, 0)))},
             "pod-l": {"rot": hold((0, f_hit, z), (f_hit + 2, f_hit + 3, (12, 0, 0)), (f_hit + 5, f_hit + 6, (-5, 0, 0)), (f_hit + 8, end, z))},
             "pod-r": {"rot": hold((0, f_hit, z), (f_hit + 3, f_hit + 4, (11, 0, 0)), (f_hit + 6, f_hit + 7, (-5, 0, 0)), (f_hit + 9, end, z))}}
    # The legs stay locked (the right one stamps back a step) while it
    # hinges on its heels, then the knees fold and the thighs flop and
    # splay onto the floor after the thud.
    for name, s in (("l", 1), ("r", -1)):
        lag = 0 if s > 0 else 1
        step = [(6, 6, z), (7, 7, (-12, 0, 0)), (9, f_hit + 2 + lag, z)] if name == "r" else [(0, f_hit + 2 + lag, z)]
        shin_step = [(6, 6, z), (7, 7, (20, 0, 0)), (9, f_hit + lag, z)] if name == "r" else [(0, f_hit + lag, z)]
        death[f"thigh-{name}"] = {"rot": hold((0, 0, z), *step, (f_hit + 5 + lag, f_hit + 5 + lag, (THIGH * 1.05, 0, s * SPLAY * 1.05)),
                                               (f_hit + 7 + lag, end, (THIGH, 0, s * SPLAY)))}
        death[f"shin-{name}"] = {"rot": hold((0, 0, z), *shin_step, (f_hit + 3 + lag, f_hit + 3 + lag, (SHIN * 1.06, 0, 0)),
                                              (f_hit + 5 + lag, end, (SHIN, 0, 0)))}
    return asset("creatures", "mech-walker", "Mech Walker", rig.root,
                 clips=[Clip("idle", idle, ease=0), Clip("move", move, ease=0, floor=False), Clip("attack", attack, loop=False, impact=fire_t, floor=True, ease=0),
                        Clip("hit", hit, loop=False, floor=True, ease=0), Clip("death", death, loop=False, impact=die_t, floor=DEATH_FLOOR, ease=0)],
                 sockets=socks,
                 pfx=[{"effectId": "rvx-space-cannon-blast", "socket": "socket-cannon-l", "trigger": "clip:attack", "size": 24, "aim": [0.0, 0.0, -1.0], "at": round(fire_t, 3)},
                      {"effectId": "rvx-space-cannon-blast", "socket": "socket-cannon-r", "trigger": "clip:attack", "size": 24, "aim": [0.0, 0.0, -1.0], "at": round(fire_t, 3)}])
