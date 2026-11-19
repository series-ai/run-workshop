"""Tentacle alien, in the Pirate Nation creature style.

A big-brained cephalopod caricature: a huge faceted violet mantle (four
stacked frustums, true slopes) with painted magenta brain folds, one giant
cartoon eye with a toxic iris, magenta gill frills and a gold psionic
crown with teal gems. It stands on six fat teal tentacles that fan out,
taper and curl up at the tips, with pink suckers painted underneath, and
two long grasping arm-tentacles. Clips: idle (sway, ripple), move (a tripod crawl), attack (the
arms rise and slam), hit (recoil), death (collapse). Faces -Z.
"""
import math

import numpy as np

import pnglyph
from _motion import curve
from _trim import squeeze
from _life import P, Clip, Grid, Rig, asset, coords, front, gem, keys, light_top, mask_of, ngon_y, quad, wave
from voxgrid import C

S = (52, 48, 52)
CX, CZ = 26, 26
YH = 10  # hub centre height (the legs' root)
YM = 11  # mantle bottom
SKIN, MANTLE = "teal", "purple"


def hub() -> Grid:
    g = Grid(*S)
    m = ngon_y(g, CX, CZ, 7.5, YH - 3, YH + 4, SKIN, 4, r_top=6)
    P.flat(g, m, SKIN, 4)
    return g


def leg() -> Grid:
    """One tentacle along +x from the hub, in the x-y plane."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    segs = [((CX + 3, YH + 1), (CX + 11, 4), 3.4, 2.7, 3.0), ((CX + 11, 4), (CX + 18, 2), 2.7, 1.9, 2.5), ((CX + 18, 2), (CX + 21.5, 6.5), 1.9, 0.9, 1.8)]
    m = np.zeros(g.shape, dtype=bool)
    for p0, p1, r0, r1, t in segs:
        m |= front(g, quad(p0, p1, r0, r1, cap=0.5), CZ - t, CZ + t, SKIN, 5)
    P.flat(g, m, SKIN, 5)
    light_top(g, m, SKIN, 6)
    under = m & (Y < 4.5) & (X > CX + 8)
    P.flat(g, under & (np.floor(X) % 3 == 0), "pink", 5)  # suckers
    P.flat(g, m & (X > CX + 19), SKIN, 6)
    return g


def mantle() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = gem(g, CX, CZ + 1, YM, 10.5, 25, MANTLE, 5, n=8, waist=0.42, cap=0.55)
    m = mask_of(g, solids)
    P.flat(g, m, MANTLE, 5)
    light_top(g, m, MANTLE, 6)
    # brain folds: wavy magenta ridges on the upper half
    upper = m & (Y > YM + 15)
    P.flat(g, upper & (np.abs(X - CX) < 0.6), MANTLE, 3)  # the fissure
    P.flat(g, upper & (np.abs(X - CX) >= 0.6), "magenta", 5)
    P.flat(g, m & (np.abs(Y - (YM + 15.5)) < 0.6), MANTLE, 4)
    P.flat(g, m & (Y < YM + 3), MANTLE, 4)
    # one giant cartoon eye on the front facet
    zf = CZ + 1 - 10.5
    rows = ["...oooo...", ".oowwwwoo.", "owwwwwwwwo", "owwwggggwo", "owwggppggo", "o+wggppggo", "owwwggggwo", "owwwwwwwwo", ".oowwwwoo.", "...oooo..."]
    legend = {"o": C(MANTLE, 2), "w": C("bone", 7), "g": C("toxic", 5), "p": C("navy", 1), "+": C("bone", 6)}
    pnglyph.stamp(g, "-z", zf, CX - 5, YM + 8, rows, legend, reach=3)
    # a small grim mouth under the eye
    P.flat(g, m & (Z < zf + 1.5) & (np.abs(X - CX) < 2.5) & (np.abs(Y - (YM + 5.5)) < 0.6), MANTLE, 2)
    # gill frills on both sides
    frills = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        for k, (y0, dz) in enumerate(((YM + 9, 0), (YM + 13, 1))):
            frills |= front(g, [(CX + s * 9.5, y0), (CX + s * 15, y0 + 3 + k), (CX + s * 13.5, y0 - 1), (CX + s * 15, y0 - 4), (CX + s * 9.5, y0 - 3)], CZ + dz - 1, CZ + dz + 2, "magenta", 5)
    P.flat(g, frills, "magenta", 5)
    P.flat(g, frills & (np.abs(X - CX) > 13.5), "magenta", 6)
    # the psionic crown: a gold band with three spikes and teal gems
    top = YM + 25
    band = ngon_y(g, CX, CZ + 1, 6.5, top - 3, top - 1, "gold", 6, r_top=6.8)
    light_top(g, band, "gold", 7)
    for dx in (-4, 0, 4):
        h = 5 if dx == 0 else 3.5
        front(g, [(CX + dx - 1.6, top - 1), (CX + dx + 1.6, top - 1), (CX + dx, top - 1 + h)], CZ - 6.2, CZ - 4.2, "gold", 6)
        P.flat(g, band & (np.abs(X - (CX + dx)) < 0.9) & (Z < CZ - 4), "cyan", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 8.5
    segs = [((sx, YM + 9), (sx + s * 7, YM + 5), 2.4, 2.0, 2.2), ((sx + s * 7, YM + 5), (sx + s * 9, YM - 5), 2.0, 1.5, 2.0),
            ((sx + s * 9, YM - 5), (sx + s * 6, YM - 8), 1.5, 0.8, 1.6)]
    m = np.zeros(g.shape, dtype=bool)
    for p0, p1, r0, r1, t in segs:
        m |= front(g, quad(p0, p1, r0, r1, cap=0.5), CZ - 4 - t, CZ - 4 + t, SKIN, 5)
    P.flat(g, m, SKIN, 5)
    light_top(g, m, SKIN, 6)
    P.flat(g, m & (Y < YM - 3), "pink", 5)
    return g


def crawl(T: int = 30, stride: float = 5.0, lift: float = 4.0) -> dict:
    """The move clip: a tripod crawl on the six tentacles, keyed every frame.

    Tentacles 0, 2, 4 plant together on frame 0 and 1, 3, 5 on frame 15.
    Each tentacle is solved (a yaw about the hub, a tilt along its length and
    a stretch along it) so the sucker pad under it stays on the floor and
    slides straight back at a constant ground speed through the stance;
    the swing group peels up in 2 frames, reaches forward and slaps down in
    3 frames, accelerating. The hub drops onto every plant and the heavy
    mantle follows a frame late, swaying over the planted tripod; the arms
    swing a beat behind. Loops seamlessly."""
    def ry(a, v):
        c, sn = math.cos(a), math.sin(a)
        return (v[0] * c + v[2] * sn, v[1], -v[0] * sn + v[2] * c)

    def rz(a, v):
        c, sn = math.cos(a), math.sin(a)
        return (v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2])

    pad = (18.0, 0.1 - YH, 0.0)  # the sucker pad under a tentacle, from the hub
    sink = 0.2  # the built mesh sits this much above the pad estimate (measured with clip_probe)

    def tip(k, b, a, sx):
        return ry(math.radians(30 + 60 * k), rz(a, ry(b, (pad[0] * sx, pad[1], pad[2]))))

    def solve(k, target):
        u = np.array([0.0, 0.0, 1.0])
        for _ in range(60):
            p = np.array(tip(k, *u))
            e = p - np.array(target)
            if np.abs(e).sum() < 1e-10:
                break
            jac = np.zeros((3, 3))
            for j in range(3):
                du = u.copy()
                du[j] += 1e-6
                jac[:, j] = (np.array(tip(k, *du)) - p) / 1e-6
            u -= np.linalg.solve(jac, e)
        return u

    bob = {0: 0.0, 1: -0.8, 2: -1.2, 3: -1.0, 4: -0.7, 5: -0.4, 6: -0.15}
    half = T // 2
    v = stride / half
    rows = []
    for f in range(T):
        group, q = (0 if f < half else 1), f % half
        y = 1.6 + bob.get(q, 0.0)
        legs = {}
        for k in range(6):
            rest = tip(k, 0.0, 0.0, 1.0)
            if k % 2 == group:
                target = (rest[0], rest[1] - y - sink, rest[2] - stride / 2 + v * q)
            else:
                if q <= 2:
                    zz, up = rest[2] + stride / 2 + v * q * 0.5, lift * q / 2
                elif q <= half - 3:
                    zz, up = rest[2] + stride / 2 + v - (stride + v) * (q - 2) / (half - 5), lift
                else:
                    w = (q - (half - 3)) / 3
                    zz, up = rest[2] - stride / 2, lift * (1 - w * w)
                target = (rest[0], rest[1] - y - sink + up, zz)
            legs[k] = solve(k, target)
        rows.append((y, group, legs))
    out = {f"leg-{k}": {"rot": [], "scale": []} for k in range(6)}
    out["tentacle-alien"] = {"loc": []}
    out["mantle"] = {"loc": [], "rot": []}
    out["arm-l"] = {"rot": []}
    out["arm-r"] = {"rot": []}
    sway = [(3.0 if g == 0 else -3.0) * min(1.0, (f % half) / 3) + (-3.0 if g == 0 else 3.0) * max(0.0, 1 - (f % half) / 3)
            for f, (_, g, _) in enumerate(rows)]
    for f in range(T + 1):
        t = f / 30
        g = f + 10  # the loop point falls mid-stance, between plants
        y, group, legs = rows[g % T]
        y1 = rows[(g - 1) % T][0]
        out["tentacle-alien"]["loc"].append((t, (0.0, y, 0.0)))
        for k, (b, a, sx) in legs.items():
            out[f"leg-{k}"]["rot"].append((t, (0.0, math.degrees(b), math.degrees(a))))
            out[f"leg-{k}"]["scale"].append((t, (sx, 1.0, 1.0)))
        sw1 = sway[(g - 1) % T]
        out["mantle"]["loc"].append((t, (0.0, 0.7 * (y1 - y), 0.0)))
        out["mantle"]["rot"].append((t, (-5.0 + 1.5 * (y1 - 1.6), 0.0, sw1)))
        sw2 = sway[(g - 2) % T]
        out["arm-l"]["rot"].append((t, (3.0 * sw2, 0.0, 0.0)))
        out["arm-r"]["rot"].append((t, (-3.0 * sw2, 0.0, 0.0)))
    return out


def build():
    rig = Rig()
    rig.add("tentacle-alien", hub(), (CX, YH, CZ))
    for k in range(6):
        rig.add(f"leg-{k}", leg(), (CX, YH, CZ), "tentacle-alien", rot=(0.0, 30.0 + 60.0 * k, 0.0))
    rig.add("mantle", mantle(), (CX, YM + 2, CZ), "tentacle-alien")
    rig.add("arm-l", arm(1), (CX + 8.5, YM + 9, CZ - 4), "mantle")
    rig.add("arm-r", arm(-1), (CX - 8.5, YM + 9, CZ - 4), "mantle")
    z = (0.0, 0.0, 0.0)
    idle = {"mantle": {"rot": wave(3.0, "z", 5)}, "arm-l": {"rot": wave(3.0, "z", 8, phase=1.0)}, "arm-r": {"rot": wave(3.0, "z", 8, phase=2.2)}}
    for k in range(6):
        idle[f"leg-{k}"] = {"rot": wave(1.5, "z", 7, phase=k * math.pi / 3)}
    # The curling legs dip their tips: the body rides high enough that they brush the floor.
    idle["tentacle-alien"] = {"loc": [(0.0, (0.0, 1.6, 0.0)), (3.0, (0.0, 1.6, 0.0))]}
    # Double slam: the alien rears back and stretches tall, both arms rising
    # high over the crown (0-0.43 s), hangs, then in 2 frames lunges and
    # whips both arms down onto the target in front (impact 0.5 s), the
    # mantle squashing into the blow; it holds, the tentacles brace and
    # ripple, then it recovers.
    F = 1 / 30
    hit_t = 15 * F
    one = (1.0, 1.0, 1.0)
    attack = {"arm-l": {"rot": keys((0, z), (6 * F, (70, 0, 20)), (11 * F, (150, 0, 24)), (13 * F, (156, 0, 26)), (hit_t, (20, 0, 0)), (17 * F, (8, 0, -4)),
                                    (22 * F, (16, 0, 0)), (34 * F, z))},
              "arm-r": {"rot": keys((0, z), (6 * F, (70, 0, -20)), (11 * F, (150, 0, -24)), (13 * F, (156, 0, -26)), (hit_t, (20, 0, 0)), (17 * F, (8, 0, 4)),
                                    (22 * F, (16, 0, 0)), (34 * F, z))},
              "mantle": {"rot": keys((0, z), (11 * F, (18, 0, 0)), (13 * F, (20, 0, 0)), (hit_t, (-18, 0, 0)), (17 * F, (-22, 0, 0)), (22 * F, (-14, 0, 0)), (34 * F, z)),
                         "loc": keys((0, z), (11 * F, (0, 2, 2)), (13 * F, (0, 2.2, 2.2)), (hit_t, (0, -1, -4)), (17 * F, (0, -1.5, -5)), (22 * F, (0, -1, -3.5)),
                                     (34 * F, z)),
                         "scale": keys((0, one), (11 * F, (0.92, 1.1, 0.92)), (13 * F, (0.9, 1.12, 0.9)), (hit_t, (1.12, 0.86, 1.12)), (19 * F, (0.97, 1.03, 0.97)),
                                       (26 * F, one), (34 * F, one))},
              "tentacle-alien": {"loc": keys((0, z), (11 * F, (0, 0, 1.5)), (hit_t, (0, 0, -3)), (18 * F, (0, 0, -3.5)), (24 * F, (0, 0, -2)), (34 * F, z))}}
    for k in range(6):
        lag = k % 2
        attack[f"leg-{k}"] = {"rot": keys((0, z), ((11 + lag) * F, (0, 0, -3)), ((15 + lag) * F, (0, 0, 10)), ((20 + lag) * F, (0, 0, -3)), (28 * F, z), (34 * F, z))}
    # Knockback: the blow pops the alien up and back, the mantle squashes
    # and tips back, the arms fling and the tentacles flick; it lands, holds
    # a beat and wobbles back.
    hit = {"tentacle-alien": {"loc": keys((0, z), (2 * F, (0, 1.2, 2.0)), (5 * F, (0, 2.0, 3.4)), (9 * F, (0, 0, 3.2)), (16 * F, (0, 0, 2.8)),
                                          (23 * F, (0, 0, 0.3)), (28 * F, z))},
           "mantle": {"rot": keys((0, z), (2 * F, (12, 0, -6)), (5 * F, (18, 0, -8)), (10 * F, (-8, 0, 2)), (16 * F, (4, 0, 0)), (22 * F, (-2, 0, 0)), (28 * F, z)),
                      "scale": keys((0, one), (2 * F, (1.1, 0.88, 1.1)), (6 * F, (0.94, 1.08, 0.94)), (11 * F, (1.05, 0.95, 1.05)), (17 * F, (0.99, 1.01, 0.99)),
                                    (24 * F, one), (28 * F, one))},
           "arm-l": {"rot": keys((0, z), (3 * F, (40, 0, 30)), (6 * F, (50, 0, 36)), (11 * F, (-14, 0, -6)), (17 * F, (6, 0, 2)), (28 * F, z))},
           "arm-r": {"rot": keys((0, z), (3 * F, (40, 0, -30)), (6 * F, (50, 0, -36)), (11 * F, (-14, 0, 6)), (17 * F, (6, 0, -2)), (28 * F, z))},
           **{f"leg-{k}": {"rot": keys((0, z), ((4 + k % 2) * F, (0, 0, 14)), ((9 + k % 2) * F, (0, 0, -8)), ((14 + k % 2) * F, (0, 0, 3)), (22 * F, z), (28 * F, z))}
              for k in range(6)}}
    # Collapse onto its back: the alien recoils, rocks forward against it
    # and gasps up tall (stretch, anticipation), then the tentacles splay
    # flat and the heavy mantle falls over backwards into the ground
    # (impact 0.867 s, squash), one small rebound and still; the arms are
    # flung up and slap down two frames late, the tentacles curl last.
    # Still by 1.27 s (Sterf: tiny bounce, no wobble, no lingering).
    die_t = 26 * F
    end = 38
    death = {"mantle": {"rot": keys((0, z), (5 * F, (10, 0, -6)), (11 * F, (-10, 0, 4)), (15 * F, (-8, 0, 3)), (die_t, (70, 0, 10)), (28 * F, (65, 0, 9.5)),
                                    (31 * F, (70, 0, 10)), (end * F, (70, 0, 10))),
                        "loc": keys((0, z), (5 * F, (0, 0, 1)), (15 * F, (0, 2, 0)), (die_t, (0, 2, 4)), (28 * F, (0, 2.8, 3.8)), (31 * F, (0, 2, 4)),
                                    (end * F, (0, 2, 4))),
                        "scale": keys((0, one), (5 * F, (1.06, 0.94, 1.06)), (11 * F, (0.94, 1.06, 0.94)), (15 * F, (0.88, 1.16, 0.88)),
                                      (die_t, (1.18, 0.8, 1.0)), (28 * F, (0.98, 1.03, 1.0)), (31 * F, (1.09, 0.91, 1.0)), (34 * F, (1.06, 0.94, 1.0)),
                                      (end * F, (1.06, 0.94, 1.0)))},
             "tentacle-alien": {"loc": curve((0, z), (5, (0, 1.6, 0)), (11, (0, 2.8, 0)), (15, (0, 2.4, 0)), (20, (0, -1.4, 0)), (23, (0, -5.0, 0)),
                                             (26, (0, -8.0, 0)), (end, (0, -8.0, 0)))},
             "arm-l": {"rot": keys((0, z), (5 * F, (0, 0, 70)), (11 * F, (-30, 0, 40)), (15 * F, (-30, 0, 60)), (25 * F, (60, 0, 40)), (28 * F, (-20, 0, 30)),
                                   (31 * F, (-8, 0, 34)), (34 * F, (-14, 0, 32)), (end * F, (-14, 0, 32)))},
             "arm-r": {"rot": keys((0, z), (5 * F, (0, 0, -70)), (11 * F, (-30, 0, -40)), (15 * F, (-30, 0, -60)), (25 * F, (60, 0, -40)), (29 * F, (-20, 0, -30)),
                                   (32 * F, (-8, 0, -34)), (35 * F, (-14, 0, -32)), (end * F, (-14, 0, -32)))}}
    for k in range(6):
        lag = k % 3
        death[f"leg-{k}"] = {"rot": curve((0, z), (5, (0, 0, -6)), (11, (0, 0, -10)), (15, (0, 0, -8)), (20, (0, 0, 4)), (23, (0, 0, 14)), (26, (0, 0, 22)),
                                          (29 + lag, (0, 0, 28)), (33 + lag, (0, 0, 23)), (end, (0, 0, 23)))}
    # Sterf's rules: a hit is over in 0.6 s; the blow keeps its timing, the
    # recovery is shortened.
    hit = squeeze(hit, keep=9, old_end=28, new_end=18)
    return asset("creatures", "tentacle-alien", "Tentacle Alien", rig.root,
                 clips=[Clip("idle", idle), Clip("move", crawl(), ease=0, floor=False), Clip("attack", attack, loop=False, impact=hit_t, floor=True), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t)])
