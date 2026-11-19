"""A salvaged scout drone hovers on two guarded lift rotors. Parts: the
body (root), rotor-l, rotor-r, cannon. Clips: idle, move, attack (charge,
fire, recoil), hit (knocked back and up, wobbles), death (the rotors
sputter, it fights to stay up, then drops with gravity and crashes onto
its side). Faces -Z."""
import numpy as np
import math

import paint as P
import pnpaint as PP
import pnshapes as S
import _big_falls as B
from _big_falls import F, track as T
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from voxgrid import C, Clip, Grid, turn

SIZE = (24, 26, 24)
ORIGIN = (12.0, 0.0, 12.0)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    core = S.disc(g, "z", 12, 13, 5.0, 5, 19, "steel", 5, n=8)
    P.plates(g, core, "steel", 5, size=(5, 4), seed=1)
    P.flat(g, core & (Y < 10), "steel", 5)
    P.flat(g, edges(core), "steel", 4)
    lens = S.disc(g, "z", 12, 14, 3.0, 2, 5, "teal", 6, n=8)
    P.flat(g, lens & (X < 12), "sky", 7)
    for x0 in (3, 17):
        limb(g, (x0, 13, 10), (x0 - 1 if x0 < 12 else x0 + 1, 15, 10), 1.6, 1.2, "rust", 5, n=4)
    for cx in (4,20):
        limb(g,(12,14,10),(cx,20,10),1.3,1.0,"steel",5,n=4)
        for k in range(8):
            a=k*math.tau/8; b=(k+1)*math.tau/8
            limb(g,(cx+3.2*math.cos(a),20,10+3.2*math.sin(a)),(cx+3.2*math.cos(b),20,10+3.2*math.sin(b)),0.6,0.6,"gold",5,n=4)
    for sign in (-1,1):
        limb(g,(12+sign*2,9,14),(12+sign*4,5,14),1,0.8,"steel",5,n=4)
        limb(g,(12+sign*4,5,14),(12+sign*2,4,12),0.8,0.3,"rust",5,n=4)
    # A signal mast and a painted serial mark keep the small body readable.
    S.disc(g, "y", 12, 12, 1.2, 19, 24, "gold", 6, n=6)
    P.flat(g, core & (np.abs(X - 12) < 1) & (Y > 9) & (Y < 12), "red", 5)
    return g


def rotor(side: int) -> Grid:
    g = Grid(*SIZE)
    cx = 4 if side < 0 else 20
    cz = 10
    for a in (0, 90):
        rad = np.deg2rad(a)
        dx, dz = np.cos(rad) * 3.0, np.sin(rad) * 3.0
        limb(g, (cx - dx, 21, cz - dz), (cx + dx, 21, cz + dz), 0.8, 0.8, "teal", 6, n=4)
    return g


def cannon() -> Grid:
    g = Grid(*SIZE)
    tube = S.bar(g, "y", (12, 6), (12, 2), 1.5, 14, 18, "steel", 5)
    P.flat(g, tube & (np.abs(S.coords(g)[0] - 12) < 1), "gold", 6)
    return g


SPIN = 360 / 0.7  # the idle rotor speed, degrees a second


def _rotors(keys, end, rate=None):
    """The rotors spinning through a one-shot (rate(frame) in degrees a
    second, the idle speed by default)."""
    for name, d in (("rotor-l", 1), ("rotor-r", -1)):
        if rate is None:
            keys[name] = {"rot": B.spin(end, "y", d * SPIN)}
        else:
            acc, out = 0.0, []
            for f in range(end + 1):
                out.append((f * F, (0.0, d * acc, 0.0)))
                acc += rate(f) * F
            keys[name] = {"rot": out}
    return keys


def _one_shots(root):
    """Baked attack, hit and death (see _big_falls)."""
    R = root.name
    # attack: it rises and pulls back as the cannon charges, nose up
    # (f0-5), then dips the nose sharply onto the target (f5-8) and fires
    # (impact f8): the recoil kicks the whole drone back and nose-up and
    # slams the cannon back in its mount; it wobbles in the air, the
    # cannon swinging on, and settles back to hover, a touch past rest.
    I = 8
    k = {R: {"loc": T((0, (0, 0, 0)), (5, (0, 1.6, 1.6)), (6, (0, 1.5, 1.2)), (I, (0, 0.6, -0.9), ">"), (I + 3, (0, 2.6, 5.6)), (I + 7, (0, 1.8, 4.3)), (I + 12, (0, 0.4, 0.9)),
                      (I + 16, (0, -0.3, -0.4)), (I + 21, (0, 0, 0))),
             "rot": T((0, (0, 0, 0)), (5, (8, 0, 0)), (6, (6, 0, 0)), (I, (-12, 0, 0), ">"), (I + 3, (25, 0, -8)), (I + 7, (12, 0, 7)), (I + 11, (-5, 0, -3)), (I + 15, (2, 0, 1.5)),
                      (I + 20, (0, 0, 0)))},
         "cannon": {"loc": T((0, (0, 0, 0)), (6, (0, 0, 0.8)), (I, (0, 0, -0.6), ">"), (I + 2, (0, 0, 3.0)), (I + 6, (0, 0, 2.2)), (I + 12, (0, 0, 0.3)), (I + 18, (0, 0, 0))),
                    "rot": T((0, (0, 0, 0)), (I, (0, 0, 0)), (I + 2, (-16, 0, 0)), (I + 7, (8, 0, 0)), (I + 12, (-4, 0, 0)), (I + 18, (0, 0, 0)))}}
    attack = _rotors(B.bake(k, I + 21), I + 21)
    # hit: knocked back and up on frame 0-1 with a hard tilt (lands back at
    # hover height on f8), the cannon swings late; it drifts back through
    # the beat, wobbles forward past rest and settles. The rotors keep on.
    hk = {R: B.react_body(push=3.4, pop=0.0, lean=16, side=0.9), "cannon": {"rot": B.react_lag((-22, 0, 0))}}
    hit = B.bake(hk, 30)
    poser = B.Poser(root)
    r0 = poser.lowest({}, 0) - B.floor_y(poser)  # the hover height idle starts at
    B.ground(root, hit, R, height=lambda f: r0 + B.arc(0, 8, 2.0)(f))
    hit = _rotors(hit, 30)
    # death: the rotors sputter and it fights to stay up: it jolts up,
    # lurches one way and the other, sags and claws back up (f0-14, about
    # 8 voxels up), spinning a little; the lift dies, it tips over and
    # drops with gravity, faster and faster, onto its side (impact f26,
    # squashed). One small bounce and a hard stop; the rotors spin down,
    # the loose cannon swings on past the landing and flops.
    I = 26
    top = 18
    H = 13.0
    # each jolt up is preceded by a one-frame lurch down as the lift cuts out
    climb = T((0, (0, 0, 0)), (2, (0, 3.6, 0)), (3, (0, 3.3, 0)), (4, (0, 0.9, 0)), (7, (0, 6.8, 0)), (8, (0, 6.5, 0)), (9, (0, 4.0, 0)), (12, (0, 9.8, 0)), (13, (0, 9.5, 0)),
              (14, (0, 7.0, 0)), (top, (0, H, 0)), (top + 1, (0, H, 0)))
    g = 2 * H / (I - top) ** 2  # about 0.4 voxels a frame per frame: it drops like a stone
    poser = B.Poser(root)
    r0 = poser.lowest({}, 0) - B.floor_y(poser)

    def height(f):
        if f < top:
            return r0 + float(climb(f)[1])
        if f < I:
            return H + r0 - 0.5 * g * (f - top) ** 2 * (1 + r0 / H)
        return B.arc(I, I + 4, 1.1)(f)

    lie = (10, 40, 90)
    tilt = T((0, (0, 0, 0)), (3, (5, 6, -12)), (4, (8, 8, -16)), (7, (-7, 14, 14)), (9, (9, 20, -18)), (12, (6, 28, 16)), (14, (9, 31, 20)), (top, (8, 36, 26)), (top + 2, (9, 37, 36)))
    d = {R: {"rot": B.Fall(tilt, top, I, lie, T((I, lie), (I + 2, (10, 40, 86)), (I + 4, (10, 40, 90), "0"), (60, (10, 40, 90))), power=2.0),
             "scale": T((0, (1, 1, 1)), (I - 1, (1, 1, 1)), (I, (0.86, 1.08, 1.06), ">"), (I + 3, (1.04, 0.98, 0.99)), (I + 6, (0.99, 1.01, 1)), (I + 9, (1, 1, 1)))},
         "cannon": {"rot": T((0, (0, 0, 0)), (4, (-15, 0, 0)), (8, (12, 0, 0)), (12, (-20, 0, 0)), (I, (10, 0, 0)), (I + 2, (-28, 0, 0)), (I + 5, (-8, 0, 0)), (I + 8, (-18, 0, 0)), (I + 12, (-14, 0, 0)), (60, (-14, 0, 0)))}}
    death = B.bake(d, 60)
    # it tips about its own middle, not the floor point under it: slide it
    # back so it drifts only a little sideways as it rolls over
    poser = B.Poser(root)
    c0 = poser.world({}, 0)[R][2].mean(0)
    loc = []
    for f in range(61):
        M, o, pts = poser.world(death, f)[R]
        c = (pts @ M.T + o).mean(0)
        drift = 0.8 * (c - c0)
        loc.append((f * F, (-drift[0], 0.0, -drift[2])))
    death[R]["loc"] = loc
    B.ground(root, death, R, height=height)
    sputter = {0: 1.0, 3: 0.3, 4: 0.95, 8: 0.2, 9: 0.8, 13: 0.25, 14: 0.6, 18: 0.15}

    def rate(f):  # the lift stutters, then the rotors spin down after the crash
        ks = sorted(sputter)
        if f <= ks[-1]:
            i = max(j for j in range(len(ks)) if ks[j] <= f)
            a, b_ = ks[i], ks[min(i + 1, len(ks) - 1)]
            u = 0 if b_ == a else (f - a) / (b_ - a)
            return SPIN * (sputter[a] + (sputter[b_] - sputter[a]) * u)
        return SPIN * 0.15 * max(0.0, 1 - (f - 18) / 40)

    death = _rotors(death, 60, rate)
    return B.fill(root, attack), 8, B.fill(root, hit), B.fill(root, death), I


def _build():
    rig = Rig("scavenger-drone", ORIGIN, body())
    rig.add("rotor-l", rotor(-1), (4, 21, 10))
    rig.add("rotor-r", rotor(1), (20, 21, 10))
    rig.add("cannon", cannon(), (12, 14, 6))
    idle = {"rotor-l": {"rot": turn(0.7, "y", 360 / 0.7)}, "rotor-r": {"rot": turn(0.7, "y", -360 / 0.7)}}
    move = {"rotor-l": {"rot": turn(0.45, "y", 800)}, "rotor-r": {"rot": turn(0.45, "y", -800)},
            "scavenger-drone": {"loc": keys((0, (0, 0, 0)), (0.22, (0, 1.3, 0)), (0.44, (0, 0, 0)))}}
    attack, imp, hit, death, dimp = _one_shots(rig.root)
    return make("creatures", "scavenger-drone", "Scavenger Drone", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp * F, ease=0), Clip("hit", hit, loop=False, ease=0), Clip("death", death, loop=False, impact=dimp * F, ease=0)],
                sockets=[rig.socket("socket-muzzle", (12, 15, 2), parent="cannon")],
                pfx=[fx("rvx-apocalypse-pistol-shot", "socket-muzzle", "clip:attack", at=imp * F, size=7, aim=(0, 0, -1))])


def build():
    return _build()
