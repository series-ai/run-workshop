"""Alien grunt, in the Pirate Nation creature style.

A chunky caricature trooper (PN totem scale): a huge lime head with a
domed, faceted skull, three big goofy eyes (one on top), a wide toothy
grin and swept ear fins; a barrel chest in a dented purple armour vest
with orange shoulder pads and a gold star badge; stubby legs in steel
boots. The left arm ends in a big three-finger hand; the right forearm is
a fused plasma blaster with copper coils and a teal muzzle. Limbs, fins,
pads and skull are true-slope prisms; the face and armour are painted.
Clips: idle (breathe, glance), move (a stubby toy waddle), attack (brace, raise and fire with a
recoil kick), hit, death.
Faces -Z.
"""
import numpy as np

from _motion import DEATH_FLOOR, curve, topple
from _life import P, Clip, Grid, Rig, asset, band, box, cartoon_eye, coords, edges, front, keys, light_top, octo, plan, quad, side, wave
from _trim import squeeze
from pnshapes import disc

S = (44, 44, 40)
CX, CZ = 22, 20
SKIN, ARMOR = "lime", "purple"
HIP = (CX, 11.0, CZ)
WAIST = (CX, 14.0, CZ)
NECK = (CX, 26.0, CZ)
SHOULDER = {"arm-l": (CX + 10.0, 24.0, CZ), "arm-r": (CX - 10.0, 24.0, CZ)}


def pelvis() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pelvis = box(g, CX - 7, 9, CZ - 4, CX + 7, 15, CZ + 4, ARMOR, 3)
    P.flat(g, pelvis, ARMOR, 3)
    band(g, pelvis, 1, 13, 15, "steel", 4)  # belt
    P.flat(g, pelvis & (np.abs(X - CX) < 1.6) & (Y > 13) & (Z < CZ - 3), "gold", 6)  # buckle
    return g


# The stubby legs are their own parts (for the move clip): a rigid leg from
# the hip and a steel boot on an ankle pivot, so the boot can stay flat on
# the floor while the leg swings. At rest they sit exactly where the one-piece
# legs did, so every other clip is unchanged.
LEG_HIP = {1: (CX + 4.5, 11.0, CZ), -1: (CX - 4.5, 11.0, CZ)}
ANKLE = {1: (CX + 5.0, 3.5, CZ), -1: (CX - 5.0, 3.5, CZ)}


def leg(s: int) -> Grid:
    g = Grid(*S)
    skin = front(g, quad((CX + s * 4, 11), (CX + s * 5, 4), 2.8, 2.6), CZ - 2.5, CZ + 2.5, SKIN, 5)
    P.flat(g, skin, SKIN, 5)
    return g


def boot(s: int) -> Grid:
    g = Grid(*S)
    boots = box(g, CX + s * 5 - 3.5, 0, CZ - 6, CX + s * 5 + 3.5, 5, CZ + 3, "steel", 5)
    boots |= side(g, [(0, CZ - 6), (5, CZ - 6), (3, CZ - 8), (0, CZ - 8)], CX + s * 5 - 3.5, CX + s * 5 + 3.5, "steel", 5)
    P.flat(g, boots, "steel", 5)
    band(g, boots, 1, 3, 5, "orange", 6)
    light_top(g, boots, "steel", 6)
    return g


def waddle(T: int = 30, stride: float = 6.0, roll: float = 7.0) -> dict:
    """The move clip: a stubby-legged toy waddle, keyed every frame.

    The legs are rigid (hip to ankle) and the boots stay flat. In stance
    the ankle slides back at a constant ground speed and the pelvis height
    follows from the leg angle, so it drops onto each plant (down at
    contact, up at passing). Right after a plant the pelvis rolls over the
    new stance foot in 2 frames, hiking the other hip so the swing boot
    clears the floor; at the end of the swing the roll falls back level,
    accelerating, which drops the swing boot onto the floor on the next
    plant. Arms swing against the legs a frame late; the torso jolts down
    on each plant and the head nods after it. Loops seamlessly."""
    import math
    LH, AY, hipx = 11.0, 3.5, 4.5
    LL = LH - AY
    half = T // 2
    v = stride / half
    lead = 2  # frames the old stance boot keeps sliding back before it swings
    rows = []
    for f in range(T):
        st = 1 if f < half else -1  # +1: the left (+x) leg plants on frame 0
        q = f % half
        z_st = -stride / 2 + v * q
        th_st = math.asin(-z_st / LL)
        hip = AY + LL * math.cos(th_st)
        r = (0.0, 0.6, 1.0)[q] if q < 3 else (1.0 if q < half - 4 else 1 - ((q - (half - 4)) / 4) ** 2)
        rr = -st * roll * r
        d = hip - LH - st * hipx * math.sin(math.radians(rr))
        if q < lead:
            z_sw = stride / 2 + v * q
        else:
            z0 = stride / 2 + v * lead
            z_sw = z0 + (-stride / 2 - z0) * (q - lead) / (half - lead)
        th_sw = math.asin(-z_sw / LL)
        th = {st: math.degrees(th_st), -st: math.degrees(th_sw)}
        rows.append((d, rr, th[1], th[-1]))
    z = (0.0, 0.0, 0.0)
    keys_ = {n: {"rot": []} for n in ("leg-l", "leg-r", "boot-l", "boot-r", "arm-l", "arm-r", "head")}
    keys_["grunt"] = {"loc": [], "rot": []}
    keys_["body"] = {"loc": [], "rot": []}
    jolt = {0: -0.2, 1: -0.6, 2: -0.3}
    for f in range(T + 1):
        t = f / 30
        g = (f + 7) % T  # the loop point falls mid-stance, between plants
        d, rr, th_l, th_r = rows[g]
        keys_["grunt"]["loc"].append((t, (0.0, d, 0.0)))
        keys_["grunt"]["rot"].append((t, (0.0, 0.0, rr)))
        for name, th in (("l", th_l), ("r", th_r)):
            keys_[f"leg-{name}"]["rot"].append((t, (th, 0.0, -rr)))
            keys_[f"boot-{name}"]["rot"].append((t, (-th, 0.0, 0.0)))
        pd, prr, pth_l, pth_r = rows[(g - 1) % T]  # a frame late
        q = g % half
        keys_["body"]["loc"].append((t, (0.0, jolt.get(q, 0.0), 0.0)))
        keys_["body"]["rot"].append((t, (-5.0, 0.0, -0.45 * prr)))
        keys_["head"]["rot"].append((t, ({0: 1.0, 1: 3.0, 2: 3.5, 3: 2.0, 4: 0.8}.get(q, 0.0), 0.0, -0.3 * prr)))
        keys_["arm-l"]["rot"].append((t, (0.9 * pth_r, 0.0, 0.0)))
        keys_["arm-r"]["rot"].append((t, (0.35 * pth_l, 0.0, 0.0)))
    return keys_


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    chest = side(g, [(14, CZ - 5), (14, CZ + 5), (27, CZ + 6), (27, CZ - 5), (22, CZ - 7)], CX - 9, CX + 9, ARMOR, 4)
    P.mottle(g, chest, ARMOR, 4, cell=3, seed=1)
    belly = chest & (Y < 17) & (Z < CZ - 3)
    P.flat(g, belly, SKIN, 5)
    P.flat(g, chest & (np.abs(Y - 17.5) < 0.6), ARMOR, 2)  # the vest hem
    # dents and scratches painted on the vest
    for dx, dy in ((-5, 22), (4, 19), (6, 24)):
        P.flat(g, chest & (Z < CZ - 3) & (np.abs(X - (CX + dx)) < 1.1) & (np.abs(Y - dy) < 0.6), ARMOR, 6)
    # a gold star badge
    P.flat(g, chest & (Z < CZ - 4) & (np.abs(X - (CX - 4)) + np.abs(Y - 22) < 2.2), "gold", 6)
    P.flat(g, chest & (Z < CZ - 4) & (np.abs(X - (CX - 4)) + np.abs(Y - 22) < 0.8), "gold", 7)
    pads = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pads |= front(g, [(CX + s * 7, 27.5), (CX + s * 12.5, 26), (CX + s * 13, 22), (CX + s * 8, 23)], CZ - 5, CZ + 5, "orange", 6)
    P.flat(g, pads, "orange", 6)
    light_top(g, pads, "orange", 7)
    P.outline(g, pads, "orange", 4, normal="z")
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    face = plan(g, octo(CX, CZ - 1, 8.5, 7, 1.5), 26, 35, SKIN, 5)
    dome = plan(g, octo(CX, CZ - 1, 8.5, 7, 1.5), 35, 42, SKIN, 5, top=octo(CX, CZ, 4.5, 3.5, 1.2))
    m = face | dome
    P.mottle(g, m, SKIN, 5, cell=3, seed=2)
    light_top(g, dome, SKIN, 6)
    fins = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        fins |= front(g, [(CX + s * 8, 36), (CX + s * 14, 41), (CX + s * 11, 33), (CX + s * 8, 30)], CZ - 1, CZ + 2, ARMOR, 5)
    P.flat(g, fins, ARMOR, 5)
    P.flat(g, fins & (np.abs(X - CX) > 10.5), "magenta", 5)
    zf = CZ - 8
    front_face = m & (Z < zf + 1.2)
    # three goofy eyes: two big ones and one on the forehead
    cartoon_eye(g, "-z", zf, CX - 7, 29, 6, outline=(SKIN, 2))
    cartoon_eye(g, "-z", zf, CX + 1, 29, 6, outline=(SKIN, 2), mirror=True)
    cartoon_eye(g, "-z", zf, CX - 2, 35, 4, outline=(SKIN, 2), white=("gold", 7), pupil=("red", 3))
    # a wide toothy grin
    grin = front_face & (np.abs(X - CX) < 5.5 - (28.5 - Y) * 0.8) & (Y > 26) & (Y < 29)
    P.flat(g, grin, "red", 3)
    P.flat(g, grin & (Y > 28), "bone", 7)
    P.flat(g, grin & (Y > 28) & (np.floor(X) % 2 == 0), "bone", 5)
    return g


def arm_l() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + 10
    arm = front(g, quad((sx, 24), (sx + 3, 14), 2.6, 2.3), CZ - 2.5, CZ + 2.5, SKIN, 5)
    P.flat(g, arm, SKIN, 5)
    hand = box(g, sx - 1, 8, CZ - 4, sx + 6, 14, CZ + 3, SKIN, 5)
    P.flat(g, hand, SKIN, 5)
    fingers = np.zeros(g.shape, dtype=bool)
    for k, fz in enumerate((CZ - 4, CZ - 1, CZ + 2)):
        fingers |= box(g, sx - 1, 5, fz, sx + 6, 8, fz + 2, SKIN, 4)
    P.flat(g, fingers, SKIN, 4)
    light_top(g, hand, SKIN, 6)
    cuff = box(g, sx - 1, 14, CZ - 3, sx + 5, 16, CZ + 3, "orange", 6)
    P.flat(g, edges(cuff), "orange", 4)
    return g


def arm_r() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX - 10
    upper = front(g, quad((sx, 24), (sx - 2, 17), 2.6, 2.4), CZ - 2.5, CZ + 2.5, SKIN, 5)
    P.flat(g, upper, SKIN, 5)
    # the fused blaster: a chunky gun along -z with copper coils and a teal muzzle
    gun = box(g, sx - 6, 14, CZ - 8, sx + 2, 20, CZ + 4, "steel", 5)
    P.flat(g, edges(gun), "steel", 3)
    light_top(g, gun, "steel", 6)
    P.flat(g, gun & (np.abs(X - (sx - 2)) < 2.5) & (Y > 19) & (Z > CZ - 6) & (Z < CZ + 2), "orange", 6)  # top stripe
    barrel = disc(g, "z", sx - 2, 17, 2.4, CZ - 16, CZ - 8, "steel", 6)
    for z0 in (CZ - 14, CZ - 11):
        P.flat(g, disc(g, "z", sx - 2, 17, 3.0, z0, z0 + 2, "rust", 6), "rust", 6)
    muzzle = disc(g, "z", sx - 2, 17, 2.8, CZ - 18, CZ - 16, "steel", 4)
    P.flat(g, muzzle & (Z < CZ - 17) & (np.hypot(X - (sx - 2), Y - 17) < 1.8), "cyan", 7)
    P.flat(g, gun & (X < sx - 5.5) & (Y > 15) & (Y < 19) & (Z < CZ + 2) & (Z > CZ - 6), "cyan", 6)  # charge window
    del barrel
    return g


LIE, ARM_L, ARM_R, HEAD = 81.0, -7.0, 2.0, -36.0  # death: lying angle, arm and head rest


def curve_rot(*pairs):
    return {"rot": curve(*pairs)}


def build():
    rig = Rig()
    rig.add("grunt", pelvis(), HIP)
    for s, n in ((1, "l"), (-1, "r")):
        rig.add(f"leg-{n}", leg(s), LEG_HIP[s], "grunt")
        rig.add(f"boot-{n}", boot(s), ANKLE[s], f"leg-{n}")
    rig.add("body", body(), WAIST, "grunt")
    rig.add("head", head(), NECK, "body")
    rig.add("arm-l", arm_l(), SHOULDER["arm-l"], "body")
    rig.add("arm-r", arm_r(), SHOULDER["arm-r"], "body")
    muzzle = rig.sock("socket-muzzle", (CX - 12, 17, CZ - 18), "arm-r")
    z = (0.0, 0.0, 0.0)
    idle = {"body": {"rot": wave(2.4, "x", 3)},
            "head": {"rot": keys((0, z), (0.6, (0, 14, 0)), (1.2, z), (1.8, (0, -14, 0)), (2.4, z))},
            "arm-l": {"rot": wave(2.4, "x", 5, phase=1.0)}, "arm-r": {"rot": wave(2.4, "x", 3, phase=2.0)}}
    # Raise, brace and fire: the grunt hunches into a brace, swings the
    # blaster up level and draws it back (0-0.37 s), fires at 0.4 s with a
    # short forward punch, and the recoil kicks the blaster up and rocks the
    # whole trooper back in one frame before it settles on aim and lowers.
    F = 1 / 30
    fire_t = 12 * F
    # Raise, brace and fire: the grunt hunches into a brace, swings the
    # blaster up level and draws it back, fires at 0.4 s, and the recoil
    # kicks the blaster up and pushes the trooper back over 3 frames; it
    # brings the blaster back onto the target, holds, then lowers it.
    attack = {"arm-r": {"rot": curve((0, z), (6, (8, 0, 0)), (8, (10, 0, 0)), (10, (9, 0, 0.5)), (12, (10, 0, 0)), (13, (16, 0, 0)), (15, (24, 0, 0)),
                                     (18, (14, 0, 0)), (20, (9, 0, 0)), (22, (11, 0, 0.5)), (24, (9.5, 0, -0.5)), (26, (10, 0, 0)), (31, (-3, 0, 0)), (34, z)),
                        "loc": curve((0, z), (10, (0, 0, 1.2)), (12, (0, 0, -1.2)), (14, (0, 0.4, 2.2)), (17, (0, 0, 1.4)), (21, z), (34, z))},
              "body": {"rot": curve((0, z), (8, (-8, 12, 0)), (12, (-8, 12, 0)), (14, (2, 10, 0)), (16, (5, 9, 0)), (19, (-2, 11, 0)), (23, (-1, 10, 0)),
                                    (27, (-2, 10, 0)), (31, (1, 2, 0)), (34, z)),
                       "loc": curve((0, z), (8, (0, -1.0, 0)), (12, (0, -1.0, 0)), (15, (0, -0.3, 0)), (19, (0, -0.8, 0)), (27, (0, -0.6, 0)), (34, z))},
              "grunt": {"loc": curve((0, z), (8, (0, 0, -0.8)), (12, (0, 0, -1.0)), (14, (0, 0, 0.8)), (16, (0, 0, 1.8)), (20, (0, 0, 1.4)), (27, (0, 0, 0.9)),
                                     (34, z)),
                        "rot": curve((0, z), (8, (-3, 0, 0)), (12, (-3, 0, 0)), (14, (1, 0, 0)), (16, (2, 0, 0)), (20, (-1, 0, 0)), (26, (0, 0, 0)), (34, z))},
              "head": curve_rot((0, z), (8, (6, 8, 0)), (13, (4, 8, 0)), (15, (-8, 4, 0)), (18, (2, 6, 0)), (22, (4, 8, 0)), (27, (3, 7, 0)), (34, z)),
              "arm-l": curve_rot((0, z), (8, (-12, 0, 0)), (14, (-26, 0, 0)), (18, (-14, 0, 0)), (23, (-18, 0, 0)), (34, z))}
    # Knockback: the hit pops the grunt up and back, the head and arms lag
    # then whip, it lands with its weight dropping forward, holds a beat and
    # recovers a touch past rest.
    hit = {"grunt": {"rot": keys((0, z), (2 * F, (8, 0, 0)), (5 * F, (12, 0, 0)), (9 * F, (3, 0, 0)), (12 * F, (5, 0, 0)), (16 * F, (4, 0, 0)),
                                 (22 * F, (-2, 0, 0)), (28 * F, z)),
                     "loc": keys((0, z), (2 * F, (0, 1.4, 1.8)), (5 * F, (0, 2.2, 3.2)), (9 * F, (0, 0, 3.0)), (16 * F, (0, 0, 2.6)), (23 * F, (0, 0, 0.3)),
                                 (28 * F, z))},
           "body": {"rot": keys((0, z), (2 * F, (6, 0, 6)), (6 * F, (10, 0, 8)), (10 * F, (-8, 0, 2)), (16 * F, (-4, 0, 0)), (22 * F, (2, 0, 0)), (28 * F, z)),
                    "loc": keys((0, z), (8 * F, z), (10 * F, (0, -1.0, 0)), (15 * F, (0, -0.5, 0)), (22 * F, z), (28 * F, z))},
           "head": {"rot": keys((0, z), (2 * F, (-12, 10, 0)), (5 * F, (20, 14, 0)), (10 * F, (-12, 4, 0)), (16 * F, (5, 2, 0)), (28 * F, z))},
           "arm-l": {"rot": keys((0, z), (3 * F, (34, 0, 14)), (6 * F, (40, 0, 20)), (11 * F, (-12, 0, 4)), (17 * F, (6, 0, 2)), (28 * F, z))},
           "arm-r": {"rot": keys((0, z), (3 * F, (24, 0, -8)), (6 * F, (30, 0, -12)), (11 * F, (-8, 0, -3)), (17 * F, (4, 0, -1)), (28 * F, z))}}
    # Shot down, onto its back: the blast rocks the grunt back, it sways
    # forward against it, then with no pause tips over backwards hinging on
    # its heels, speeding up into a heavy thud on its back (impact 0.833 s)
    # with a squash, one small bounce and a hard settle; both arms are flung
    # up and slam down flat two frames late (the blaster along the floor), the head knocks back last.
    f_hit = 25
    rot, loc, die_t = topple((-11.01, 3.0), beats=[(0, 0.0), (4, 8.0), (10, -5.0)], f_hit=f_hit, lie=LIE, lead=0.24, power=2.5,
                             bounce_up=0.9, bounce_deg=1.4, end=50, roll=4)
    one = (1.0, 1.0, 1.0)
    death = {"grunt": {"rot": rot, "loc": loc},
             "body": {"rot": curve((0, z), (4, (6, 0, 0)), (10, (-8, 0, 2)), (15, (-3, 0, -3)), (20, (3, 0, 2)), (f_hit, z), (50, z)),
                      "scale": curve((0, one), (f_hit - 1, one), (f_hit, (1.12, 0.9, 1.0)), (f_hit + 2, (0.96, 1.04, 1.0)), (f_hit + 4, (1.03, 0.98, 1.0)),
                                     (f_hit + 7, one), (50, one))},
             "head": curve_rot((0, z), (3, (-14, 10, 0)), (10, (12, -6, 0)), (16, (2, 4, 0)), (21, (-14, 4, 0)), (f_hit, (-20, 4, 0)),
                               (f_hit + 2, (HEAD, 14, 0)), (f_hit + 5, (HEAD - 10, 22, 0)), (f_hit + 9, (HEAD, 25, 0)), (50, (HEAD, 25, 0))),
             "arm-l": curve_rot((0, z), (4, (-30, 0, 14)), (10, (14, 0, 8)), (16, (34, 0, 20)), (21, (70, 0, 32)), (f_hit + 2, (ARM_L, 0, 56)),
                                (f_hit + 5, (ARM_L + 5, 0, 52)), (f_hit + 8, (ARM_L, 0, 55)), (50, (ARM_L, 0, 55))),
             "arm-r": curve_rot((0, z), (4, (-24, 0, -10)), (10, (10, 0, -6)), (16, (30, 0, -16)), (21, (62, 0, -28)), (f_hit + 3, (-90, -80, ARM_R)),
                                (f_hit + 6, (-90, -80, ARM_R + 8)), (f_hit + 9, (-90, -80, ARM_R)), (50, (-90, -80, ARM_R)))}
    # Sterf's rules: a hit is over in 0.6 s, a death is still a few frames
    # after its last flop. The blow and the fall keep their timing; only the
    # recovery / the still tail is shortened.
    hit = squeeze(hit, keep=9, old_end=28, new_end=18)
    death = squeeze(death, keep=f_hit + 9, old_end=50, new_end=f_hit + 12)
    return asset("creatures", "alien-grunt", "Alien Grunt", rig.root,
                 clips=[Clip("idle", idle), Clip("move", waddle(), ease=0, floor=False), Clip("attack", attack, loop=False, impact=fire_t, floor=True), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t, floor=DEATH_FLOOR)],
                 sockets=[muzzle], pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 14, "aim": [0.0, 0.0, -1.0], "at": round(fire_t, 3)}])
