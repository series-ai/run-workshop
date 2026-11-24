"""Glowdrop clips: node TRS animation on the parts tagged with common.part().

A clip is {"name", "dur", "loop", "f"}; f(t) -> {part: {"loc", "rot", "scale"}} in the
CREATURE frame (x forward / nose, y left, z up; rot = roll, pitch, yaw in degrees).
Part "" is the asset root. Parts a creature doesn't have are skipped, so one clip
can serve a family.

Planned per the procedural-animation skill: actions are pose to pose (strike + hold),
pulses contract fast and relax slow, hops are ballistic with G = 30, and only
breathing-size drift (1-3%) uses plain sines. Cycles (swim, flap, crawl) are gaits.
"""
import math

from curves import G, ballistic, flight, loop_pulse, pulse, strike, wave

FPS = 30


def sharp(s, k=1.8):
    """A sine with harder turnarounds (a soft square wave): snappier beats for gait
    cycles, but with a finite slope through zero so nothing pops between frames."""
    return math.tanh(k * s) / math.tanh(k)


# ---------------------------------------------------------------- shared one-shots

def caught(lift=0.06, shake=18.0):
    """Startled flail when caught: a fast lift, three hard yaw shakes, settle, hold."""
    def f(t):
        up = strike(t, [(0.0, 0.0), (0.1, lift), (0.55, lift * 0.4), (0.72, 0.0)], dur=0.1, over=0.15)
        yaw = strike(t, [(0.0, 0.0), (0.13, shake), (0.23, -shake), (0.33, shake * 0.7), (0.43, -shake * 0.4), (0.55, 0.0)], dur=0.1, over=0.08)
        sq = 1 + 0.12 * pulse(t, 0.72, 0.1)  # landing squash
        return {"": {"loc": (0, 0, up), "rot": (0, -8 * pulse(t, 0.1, 0.3), yaw), "scale": (1 + 0.04 * (sq - 1), 1 + 0.04 * (sq - 1), 2 - sq)},
                "tail": {"rot": (0, 0, 30 * math.sin(t * 2 * math.pi / 0.2) * (1 - min(1, t / 0.6)))}}
    return {"name": "caught", "dur": 0.9, "loop": False, "f": f}


# ---------------------------------------------------------------- fish and sea critters

def swim(T=0.8, tail=26.0, body=6.0, bob=0.012):
    """Tail beat with body counter-yaw; two beats per bob so the loop closes."""
    def f(t):
        s = sharp(wave(t, T))
        return {"": {"loc": (0, 0, bob * wave(t, 2 * T)), "rot": (0, 0, -body * sharp(wave(t, T, -0.1)))},
                "tail": {"rot": (0, 0, tail * s)}, "rear": {"rot": (0, 0, tail * 1.2 * s)},
                "fin_L": {"rot": (25 * max(0, wave(t, T)), 0, 0)}, "fin_R": {"rot": (-25 * max(0, wave(t, T)), 0, 0)},
                "lure": {"rot": (0, 8 * wave(t, T, 0.2), 0)}}
    return {"name": "swim", "dur": 2 * T, "loop": True, "f": f}


def hover(T=2.4, tail=8.0, bob=0.012):
    def f(t):
        return {"": {"loc": (0, 0, bob * wave(t, T)), "rot": (0, 2 * wave(t, T, 0.25), 0)},
                "tail": {"rot": (0, 0, tail * wave(t, T / 2))}, "rear": {"rot": (0, 0, tail * wave(t, T / 2))},
                "lure": {"rot": (0, 10 * wave(t, T, 0.1), 0)}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def jet(T=1.2):
    """Squid jet: arms snap shut and the body surges, then arms flare open and coast."""
    def f(t):
        u = t % T
        close = strike(u, [(0.0, 0.0), (0.12, 1.0), (0.5, 0.0)], dur=0.1, over=0.1)
        surge = 0.06 * (pulse(u, 0.14, 0.5) + pulse(u - T, 0.14, 0.5))
        return {"": {"loc": (surge, 0, 0)}, "arms": {"scale": (1 + 0.25 * close, 1 - 0.35 * close, 1 - 0.35 * close)},
                "fins": {"rot": (20 * wave(t, T / 2), 0, 0)}}
    return {"name": "swim", "dur": T, "loop": True, "f": f}


def flap(T=0.7, amp=35.0, axis=0, bob=0.015, name="swim"):
    """Wing/ear-fin flaps: fast downstroke, slower recovery; body lifts on each stroke."""
    def f(t):
        u = (t % T) / T
        down = math.sin(math.pi * min(1, u / 0.35)) if u < 0.35 else -0.5 * math.sin(math.pi * (u - 0.35) / 0.65)
        r = [0, 0, 0]
        r[axis] = amp * down
        l = list(r)
        l[axis] = -amp * down
        return {"": {"loc": (0, 0, bob * wave(t, T, 0.15))}, "wing_L": {"rot": tuple(l)}, "wing_R": {"rot": tuple(r)},
                "arms": {"scale": (1, 1, 1 + 0.1 * down)}}
    return {"name": name, "dur": T, "loop": True, "f": f}


FISH_CLIPS = {
    "anglerfish": lambda: [swim(1.0, 22, 5), hover(), caught()],
    "lanternfish": lambda: [swim(0.6, 28, 6), hover(), caught()],
    "hatchetfish": lambda: [swim(0.5, 30, 4), hover(), caught()],
    "flashlight fish": lambda: [swim(0.6, 26, 6), hover(), caught()],
    "glow guppy": lambda: [swim(0.5, 22, 7), hover(1.6, 12), caught()],
    "ribbon eel": lambda: [swim(1.0, 30, 12, 0.008), hover(2.4, 12), caught()],
    "firefly squid": lambda: [jet(), hover(2.0, 0), caught()],
    "sea angel": lambda: [flap(0.7, 40, 1), hover(2.4, 0), caught()],
    "glow shrimp": lambda: [swim(0.45, 20, 3), hover(2.0, 6), caught()],
    "dumbo octopus": lambda: [flap(0.9, 30, 1, 0.02), hover(2.4, 0), caught()],
    "glow seahorse": lambda: [swim(0.3, 25, 1, 0.006), hover(2.8, 0, 0.01), caught()],
    "sea pickle": lambda: [hover(3.2, 0, 0.012), caught(0.04, 10)],
}


def fish_clips(name):
    return FISH_CLIPS.get(name, lambda: [hover(), caught()])()


# ---------------------------------------------------------------- jellies

def jelly_pulse(T=1.4, rise=0.05):
    """Bell contracts hard (4 frames), relaxes slowly; the body rises on the stroke and
    sinks while relaxed. Tentacles lag the bell by 2 frames and stream on the stroke."""
    def f(t):
        c = loop_pulse(t, T, 0.12, 0.6, 2.5)          # 0..1 contraction
        c2 = loop_pulse(t - 2 / FPS, T, 0.12, 0.6, 2.5)
        up = rise * (0.5 + 0.5 * wave(t, T, -0.15))
        return {"": {"loc": (0, 0, up), "scale": (1 - 0.14 * c, 1 - 0.14 * c, 1 + 0.12 * c)},
                "tentacles": {"scale": (1 - 0.2 * c2, 1 - 0.2 * c2, 1 + 0.25 * c2)}}
    return {"name": "pulse", "dur": T, "loop": True, "f": f}


def polyp_sway(T=2.8):
    def f(t):
        return {"": {"rot": (3 * wave(t, T), 2 * wave(t, T, 0.25), 0), "scale": (1, 1, 1 + 0.03 * wave(t, T / 2))},
                "tentacles": {"scale": (1 + 0.15 * wave(t, T / 2), 1 + 0.15 * wave(t, T / 2), 1)}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def jelly_clips(stage, grounded=False):
    if stage == 0:
        return [polyp_sway()]
    if grounded:  # the upside-down jelly pulses its bell where it lies
        return [jelly_pulse(1.6, rise=0.0), caught(0.03, 8)]
    return [jelly_pulse(1.0 if stage == 1 else 1.4), caught(0.05, 12)]


# ---------------------------------------------------------------- bugs

def crawl(T=1.0, n=9, lift=0.035, push=0.012):
    """Caterpillar wave: each segment lifts in turn, front to back, one wave per loop."""
    def f(t):
        out = {}
        for i in range(n):
            ph = (t / T + i / n) % 1.0
            h = max(0.0, math.sin(2 * math.pi * ph)) ** 1.5
            out[f"seg{i}"] = {"loc": (push * math.cos(2 * math.pi * ph), 0, lift * h)}
        out["head"] = {"loc": (push * math.cos(2 * math.pi * (t / T + 1)), 0, 0.01 * wave(t, T)), "rot": (0, -6 * wave(t, T), 4 * wave(t, 2 * T))}
        return out
    return {"name": "crawl", "dur": T, "loop": True, "f": f}


def wriggle(T=2.4):
    """A cocoon/pupa: still, then two quick twists, then still (pose to pose, holds)."""
    def f(t):
        r = strike(t, [(0.0, 0), (0.9, 12), (1.05, -10), (1.2, 4), (1.4, 0)], dur=0.1, over=0.12, loop=T)
        return {"": {"rot": (r, 0, 0)}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def blink(T=2.0):
    """Firefly glow: snaps on (2 frames), holds, fades out over 0.6 s, stays dark, twice per loop."""
    def f(t):
        g = loop_pulse(t, T / 2, 0.2, 0.5, 1.8)
        return {"glow": {"scale": (0.75 + 0.35 * g,) * 3}, "": {"loc": (0, 0, 0.004 * wave(t, T))},
                "antennae": {"rot": (0, -8 * pulse(t % (T / 2), 0.15, 0.2), 0)}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def fly(T=0.12 * 3, open_deg=40.0, hover_h=0.18):
    """Hovering flight: shells held open, wings buzzing (3-frame period, no faster),
    body lifted and bobbing, glow blinking."""
    def f(t):
        w = math.sin(2 * math.pi * t / (3 / FPS))
        g = loop_pulse(t, 1.2, 0.2, 0.4, 1.8)
        return {"": {"loc": (0, 0, hover_h + 0.01 * wave(t, 1.2)), "rot": (0, -10, 0)},
                "shell_L": {"rot": (-open_deg, 0, 0)}, "shell_R": {"rot": (open_deg, 0, 0)},
                "wing_L": {"rot": (-30 * w, 0, 0)}, "wing_R": {"rot": (30 * w, 0, 0)},
                "glow": {"scale": (0.8 + 0.3 * g,) * 3}}
    return {"name": "fly", "dur": 1.2, "loop": True, "f": f}


def moth_fly(T=0.5):
    def f(t):
        u = (t % T) / T
        down = math.sin(math.pi * min(1, u / 0.4)) if u < 0.4 else -0.6 * math.sin(math.pi * (u - 0.4) / 0.6)
        return {"": {"loc": (0, 0, 0.2 + 0.02 * down)}, "wing_L": {"rot": (-45 * down, 0, 0)}, "wing_R": {"rot": (45 * down, 0, 0)}}
    return {"name": "fly", "dur": T * 2, "loop": True, "f": f}


def rest_fan(T=3.0):
    """Resting moth: wings slowly open and close, a breathing-size move."""
    def f(t):
        return {"wing_L": {"rot": (-12 - 10 * wave(t, T), 0, 0)}, "wing_R": {"rot": (12 + 10 * wave(t, T), 0, 0)}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def hop(h=0.12, T=1.0, flip=False, name="hop"):
    """A real jump: 3-frame crouch, 2-frame push with feet planted, ballistic arc at G,
    land with a 2-frame squash and rebound, then hold until the loop ends."""
    v, air = flight(h)
    t0 = 0.17  # lift-off
    def f(t):
        u = t % T
        crouch = strike(u, [(0.0, 0.0), (0.1, 1.0), (t0, -0.3), (t0 + 0.05, 0.0)], dur=0.1, over=0.05)
        z = ballistic(u, t0, h)
        land = pulse(u, t0 + air, 0.12, 2.5)
        sq = 0.18 * max(0, crouch) + 0.16 * land
        pitch = -360 * min(1, max(0, (u - t0) / air)) if flip else -12 * (z / h if h else 0)
        return {"": {"loc": (0, 0, z), "rot": (0, pitch, 0), "scale": (1 + sq * 0.5, 1 + sq * 0.5, 1 - sq)},
                "legs": {"rot": (0, 35 * max(0, -crouch) + 30 * (z / h if h else 0), 0)}}
    return {"name": name, "dur": T, "loop": True, "f": f}


def chirp(T=1.6):
    """Cricket: holds still, then rubs its wings in a 0.3 s burst (3-frame period)."""
    def f(t):
        u = t % T
        on = 1.0 if 0.5 < u < 0.8 else 0.0
        w = math.sin(2 * math.pi * t / (3 / FPS)) * on
        return {"wing_L": {"rot": (-6 * w, 0, 0)}, "wing_R": {"rot": (6 * w, 0, 0)}, "antennae": {"rot": (0, 0, 6 * wave(t, T))}}
    return {"name": "idle", "dur": T, "loop": True, "f": f}


def snail_glide(T=2.0):
    """Snail foot stretches forward and gathers; shell bobs a beat behind; eyestalks sway."""
    def f(t):
        s = 0.5 + 0.5 * wave(t, T)
        return {"foot": {"scale": (1 + 0.1 * s, 1, 1 - 0.05 * s)}, "shell": {"loc": (0.01 * wave(t, T, -0.08), 0, 0.006 * wave(t, T, -0.08))},
                "eyes": {"rot": (0, -8 * wave(t, T, 0.2), 6 * wave(t, T / 2))}}
    return {"name": "crawl", "dur": T, "loop": True, "f": f}


def bug_clips(name, stage, n):
    last = stage == n - 1
    grubs = {("Firefly", 0), ("Glowworm", 0), ("Glowworm", 1), ("Click beetle", 0), ("Glow moth", 0), ("Railroad worm", 0), ("Railroad worm", 1),
             ("Glow millipede", 0), ("Glow millipede", 1)}
    if (name, stage) in grubs:
        segs = {("Firefly", 0): 7, ("Glowworm", 0): 8, ("Glowworm", 1): 9, ("Click beetle", 0): 7, ("Glow moth", 0): 6,
                ("Railroad worm", 0): 6, ("Railroad worm", 1): 9, ("Glow millipede", 0): 5, ("Glow millipede", 1): 8}[(name, stage)]
        return [crawl(1.0, segs), caught(0.03, 10)]
    if (name, stage) in {("Firefly", 1), ("Glow moth", 1)}:
        return [wriggle()]
    if name == "Firefly":
        return [blink(), fly(), caught()]
    if name == "Click beetle":
        return [blink(2.4), hop(0.25, 1.4, flip=True, name="click"), caught()]
    if name == "Glow moth":
        return [rest_fan(), moth_fly(), caught()]
    if name == "Cave gnat":
        return [fly(open_deg=0, hover_h=0.15), caught()] if last else []
    if name == "Glow springtail":
        return [hop(0.18, 1.0), caught()]
    if name == "Glow cricket":
        return [chirp(), hop(0.14, 1.1), caught()]
    if name == "Glow snail":
        return [snail_glide(), caught(0.03, 8)]
    return [caught()]


# ---------------------------------------------------------------- FX

def fx_clips(kind):
    if kind == "sparkle":
        def f(t):  # pops in with overshoot, twinkles, holds
            s = strike(t, [(0.0, 0.0), (0.1, 1.0), (0.8, 1.0), (0.95, 0.0)], dur=0.1, over=0.2)
            return {"": {"scale": (max(s, 0.001),) * 3, "rot": (0, 0, 90 * t)}}
        return [{"name": "pop", "dur": 1.0, "loop": False, "f": f}]
    if kind == "bubbles":
        def f(t):  # wobble in place; the game moves the column up
            return {"": {"loc": (0.01 * wave(t, 1.0), 0.006 * wave(t, 2.0, 0.25), 0), "scale": (1 + 0.04 * wave(t, 0.5), 1 + 0.04 * wave(t, 0.5), 1 - 0.03 * wave(t, 0.5))}}
        return [{"name": "wobble", "dur": 2.0, "loop": True, "f": f}]
    if kind == "ripple":
        def f(t):  # one ripple: spreads fast then slows; spawn one per splash
            k = 0.3 + 1.2 * (1 - (1 - min(t, 1.2) / 1.2) ** 2)
            return {"": {"scale": (k, k, 1)}}
        return [{"name": "spread", "dur": 1.2, "loop": False, "f": f}]
    return []


# ---------------------------------------------------------------- bake into Blender

def bake(clip, nodes, fps, turn=0.0):
    import bpy
    from mathutils import Euler, Matrix, Quaternion, Vector
    R = Matrix.Rotation(math.radians(turn), 3, "Z")
    Ri = R.inverted()
    n = max(1, round(clip["dur"] * fps))
    action = bpy.data.actions.new(clip["name"])
    rest = {p: (o.location.copy(), o.rotation_quaternion.copy(), o.scale.copy()) for p, o in nodes.items()}
    used = set()
    last_q = {}
    for fr in range(n + 1):
        t = min(fr / fps, clip["dur"])
        if clip["loop"] and fr == n:
            t = 0.0  # exact loop closure
        vals = clip["f"](t)
        for p, ch in vals.items():
            if p not in nodes:
                continue
            o = nodes[p]
            anim = o.animation_data or o.animation_data_create()
            if anim.action is not action:
                anim.action = action
            used.add(p)
            l0, q0, s0 = rest[p]
            loc = Vector(ch.get("loc", (0, 0, 0)))
            o.location = l0 + R @ loc
            rot = ch.get("rot", (0, 0, 0))
            m = R @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix() @ Ri
            q = q0 @ m.to_quaternion()
            prev = last_q.get(p)
            if prev is not None and prev.dot(q) < 0:  # keep keys sign-continuous (no q/-q flips on spins)
                q.negate()
            last_q[p] = q.copy()
            o.rotation_quaternion = q
            sc = ch.get("scale", (1, 1, 1))
            sm = R @ Matrix.Diagonal(Vector(sc)) @ Ri  # scale along creature axes
            o.scale = Vector((abs(sm[0][0]), abs(sm[1][1]), abs(sm[2][2]))) * 1.0
            o.scale = Vector((s0.x * o.scale.x, s0.y * o.scale.y, s0.z * o.scale.z))
            o.keyframe_insert("location", frame=fr)
            o.keyframe_insert("rotation_quaternion", frame=fr)
            o.keyframe_insert("scale", frame=fr)
    for p in used:  # park each object's keys on an NLA track named after the clip
        o = nodes[p]
        anim = o.animation_data
        slot = anim.action_slot
        track = anim.nla_tracks.new()
        track.name = clip["name"]
        strip = track.strips.new(clip["name"], 0, action)
        strip.action_slot = slot
        track.mute = True
        anim.action = None
        o.location, o.rotation_quaternion, o.scale = rest[p]
    return sorted(used)
