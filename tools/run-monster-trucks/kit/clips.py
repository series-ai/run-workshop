"""Vehicle clips, baked per frame from motion functions.

One motion model drives every part, so nothing can disagree:
- heave `o` (voxels, up) and pitch `p` (degrees, + = nose up) move the body
  root on its suspension;
- the body mesh squashes and stretches (`sy` up, `sz` along the length,
  `sx` keeps the volume);
- every wheel module counter-rotates to stay upright, its axle (or track)
  slides by minus the socket's rise so the tyres stay on the ground, and its
  springs stretch by the same amount;
- wheels spin from the ground speed `v` (voxels/s) and their own radius.

Clips: idle (engine rumble loop), move (driving loop), accelerate (launch
from rest into `move`), brake (from `move` to a stop).
Idle and move are pose to pose; accelerate and brake are a spring-damper
simulation (the same springs as the viewer's drop test), because Sterf wants
the shocks to bounce when the vehicle starts and stops. See
.claude/skills/procedural-animation.
"""
from __future__ import annotations

import math

from kit import WB
from voxgrid import CLIPS, Clip, Part

FPS = CLIPS["fps"]
V_MOVE = 70.0  # driving speed, voxels/s (about 3.5 m/s at 20 voxels a metre)
for name in ("accelerate", "brake"):
    if name not in CLIPS["propClips"]:
        CLIPS["propClips"].append(name)


# ---------------------------------------------------------------- motions: t -> (o, p, sy, sz, v)
def idle(t: float):
    """Engine rumble: a 3-frame (10 Hz) shudder, plus a slow lope on every
    second beat so it isn't a buzz."""
    f = round(t * FPS)
    shake = (0.0, 0.35, 0.12)[f % 3]
    lope = 0.25 if (f // 5) % 2 == 0 else 0.0
    return shake + lope, 0.25 * (shake - 0.15), 1.0, 1.0, 0.0


def move(t: float):
    """Driving: two road bumps per loop, each a quick kick up and a firm
    landing; the nose bobs a little after each."""
    bump = 0.0
    for at in (0.1, 0.6):
        u = t - at
        if 0 <= u < 0.3:
            bump += 1.4 * math.sin(math.pi * u / 0.3) * math.exp(-4 * u)
    pitch = 0.0
    for at, s in ((0.18, 1.0), (0.68, -1.0)):
        u = t - at
        if 0 <= u < 0.3:
            pitch += s * 1.2 * math.sin(math.pi * u / 0.3)
    return bump, pitch, 1.0 - 0.02 * bump, 1.0, V_MOVE


# Accelerate and brake are a spring-damper simulation, the same springs as the
# viewer's "Drop it": the drive force pushes the body toward a squat / dive
# target and the suspension bounces it there and back. Heave ~1.5 Hz, pitch
# ~1.9 Hz, the length squash ~2.3 Hz, all lightly damped (zeta ~0.3).
K_H, C_H = 90.0, 5.0    # heave spring, damper (per unit mass)
K_P, C_P = 140.0, 7.0   # pitch
K_S, C_S = 200.0, 9.0   # body length squash/stretch
SUB = 8                 # sim steps per frame


def accel_force(t: float):
    """Launch at 0.1 s after a 3-frame rev crouch: the push fades as the
    speed reaches cruising. -> (heave target, pitch target deg, length target, speed)."""
    if t < 0.1:
        return -1.6 * min(1.0, t / 0.06), -1.0 * min(1.0, t / 0.06), 0.97, 0.0
    a = 1.0 if t < 0.34 else math.exp(-(t - 0.34) / 0.05)  # full push, then let go at speed
    v = V_MOVE * (1 - math.exp(-(t - 0.1) / 0.16))
    return -0.8 * a, 11.0 * a, 1 + 0.16 * a, v * (1 + 0.6 * a)  # wheelspin while pushing hard


def brake_force(t: float):
    """Wheels lock at once and the van stops at 0.18 s; then no force."""
    stop = 0.18
    a = 1.0 if t < stop else 0.0
    return -2.2 * a, -11.0 * a, 1 - 0.18 * a, V_MOVE * max(0.0, 1 - t / stop) ** 1.2


def simulate(force, T: float):
    """Per-frame (heave, pitch, sy, sz, speed) from a spring-damper chasing
    the force's targets. Body volume is kept: sy rises as sz shrinks."""
    h = hv = p = pv = 0.0
    s, sv = 1.0, 0.0
    dt = 1 / (FPS * SUB)
    out = []
    for f in range(round(T * FPS) + 1):
        th, tp, ts, v = force(f / FPS)
        out.append((h, p, 1 / math.sqrt(s) * (1 - 0.004 * hv), s, v))
        for k in range(SUB):
            th, tp, ts, _ = force((f * SUB + k) * dt)
            hv += (K_H * (th - h) - C_H * hv) * dt
            h += hv * dt
            pv += (K_P * (tp - p) - C_P * pv) * dt
            p += pv * dt
            sv += (K_S * (ts - s) - C_S * sv) * dt
            s += sv * dt
    return out


ACC_T, BRK_T = 1.8, 1.8
_SIM = {}


def _sampled(name, force, T):
    if name not in _SIM:
        _SIM[name] = simulate(force, T)
    frames = _SIM[name]

    def fn(t):
        x = min(max(t * FPS, 0.0), len(frames) - 1.0)
        i = min(int(x), len(frames) - 2)
        u = x - i
        return tuple(a + (b - a) * u for a, b in zip(frames[i], frames[i + 1]))

    return fn


accelerate = _sampled("accelerate", accel_force, ACC_T)
brake = _sampled("brake", brake_force, BRK_T)


MOTIONS = {"idle": (idle, 1.0, True), "move": (move, 1.0, True), "accelerate": (accelerate, ACC_T, False), "brake": (brake, BRK_T, False)}


# ---------------------------------------------------------------- baking onto a vehicle's parts
def _wheels(part: Part):
    return [p for p in part.walk() if p.name.startswith("wheel-")]


def vehicle_clips(root: Part, info: dict) -> list[Clip]:
    body_root = root.children[0]
    body = next(p for p in body_root.children if p.name == "body")
    cls = info["class"]
    rest_pitch = math.radians(info["pitch"])
    mods = info["modules"]
    sockets = {"f": -WB[cls] / 2, "r": WB[cls] / 2, "belly": 0.0, **info.get("z", {})}
    out = []
    for name, (fn, T, loop) in MOTIONS.items():
        n = round(T * FPS)
        keys: dict[str, dict[str, list]] = {}

        def key(part: str, ch: str, t: float, v):
            keys.setdefault(part, {}).setdefault(ch, []).append((t, tuple(float(c) for c in v)))

        def slip(t):  # wheels spin faster than the ground at launch, settling to grip
            return 1 + 0.7 * math.exp(-(t - 0.1) / 0.15) if name == "accelerate" and t > 0.1 else 1.0

        dist = 0.0  # distance rolled at the tyre surface
        rolled = [fn(f / FPS)[4] * slip(f / FPS) for f in range(n + 1)]
        for f in range(n + 1):
            t = f / FPS
            o, p, sy, sz, v = fn(t)
            if f:
                dist += (rolled[f - 1] + rolled[f]) / 2 / FPS
            key(body_root.name, "loc", t, (0, o, 0))
            key(body_root.name, "rot", t, (p, 0, 0))
            sx = 1 / math.sqrt(sy * sz)
            key(body.name, "scale", t, (sx, sy, sz))
            for tag, m in mods.items():
                z = sockets[tag]
                rise = o - z * (math.sin(rest_pitch + math.radians(p)) - math.sin(rest_pitch))
                key(m.root.name, "rot", t, (-p, 0, 0))
                ground = [c for c in m.root.children if c.name.startswith(("axle-", "track-"))]
                for g in ground:
                    key(g.name, "loc", t, (0, -rise, 0))
                if m.spring:
                    for s in (c for c in m.root.children if c.name.startswith("spring-")):
                        key(s.name, "scale", t, (1, (m.spring + rise) / m.spring, 1))
                for w in _wheels(m.root):
                    r = w.meta.get("radius", m.radius)
                    if loop and name == "move":
                        turns = max(1, round(V_MOVE * T / (2 * math.pi * r)))
                        ang = -360.0 * turns * t / T
                    else:
                        ang = -math.degrees(dist / r)
                    key(w.name, "rot", t, (ang, 0, 0))
        out.append(Clip(name, keys, loop=loop))
    return out
