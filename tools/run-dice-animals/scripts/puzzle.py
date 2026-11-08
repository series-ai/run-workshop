"""Puzzle pieces for the dice animals: buttons, fans, conveyors and friends,
each sized to one die cell (2 x 2 footprint) in the same soft style.

Every piece is a small node hierarchy (root -> parts) with TRS clips. Parts a
game may want to recolour are their own nodes (the button's cap, the flag).

    Blender -b --factory-startup -t 1 --python scripts/puzzle.py -- <out dir> [piece ...]
"""
import math
import os
import sys

os.environ["DICE_NO_MAIN"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dice as D  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

box, ball, can, limb, group = D.box, D.ball, D.can, D.limb, D.group
FPS = 30
GREY, GREY_D, GREY_L, DARKG = (0.66, 0.67, 0.72), (0.5, 0.51, 0.57), (0.84, 0.85, 0.88), (0.3, 0.3, 0.35)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ease_in(t):
    t = min(max(t, 0.0), 1.0)
    return t * t


def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 2


def settle(d, amp, tau=2.6, w=1.0):
    """A hit that overshoots and dies out (d frames after it)."""
    return 0.0 if d < 0 else amp * math.exp(-d / tau) * math.cos(d * w)


def rz(deg):
    return Quaternion((0, 0, 1), math.radians(deg))


def rx(deg):
    return Quaternion((1, 0, 0), math.radians(deg))


def plate(w, d, h, rgb, z0=0.0, bevel=0.08, x=0.0, y=0.0):
    """A rounded slab sitting on z0."""
    return box(x, y, z0 + h / 2, w, d, h, rgb, bevel=bevel, segs=2)


# -------------------------------------------------------------- pieces
# each returns ({node: pivot}, {node: parent}, clips) where clips is a list of
# (name, frames, loop, fn(t) -> {node: (dloc, quat, scale)})
def button():
    RED, RED_D = (0.92, 0.28, 0.3), (0.76, 0.18, 0.22)
    with group("base"):
        plate(2.0, 2.0, 0.22, GREY)
        plate(1.72, 1.72, 0.06, DARKG, z0=0.2, bevel=0.03)  # the well the cap sinks into
    with group("cap"):
        plate(1.5, 1.5, 0.22, RED, z0=0.22, bevel=0.1)
        plate(1.2, 1.2, 0.04, RED_D, z0=0.43, bevel=0.03)
        ball(-0.42, -0.42, 0.45, 0.22, 0.22, 0.05, (1, 0.7, 0.7), seg=10, ring=4)  # a little shine
    piv = {"base": Vector((0, 0, 0)), "cap": Vector((0, 0, 0.22))}
    DOWN = 0.13

    def press(t):
        f = t * 12
        z = -DOWN * ease_in(f / 3) if f < 3 else -DOWN + settle(f - 3, 0.035, tau=2.0, w=1.4)
        sq = 0.0 if f < 3 else settle(f - 3, 0.18, tau=1.8, w=1.3)
        return {"cap": (Vector((0, 0, z)), Quaternion(), Vector((1 + sq * 0.3, 1 + sq * 0.3, 1 - sq)))}

    def release(t):
        f = t * 16
        z = -DOWN * (1 - ease_out(f / 4)) if f < 4 else settle(f - 4, 0.05, tau=2.4, w=1.2)
        return {"cap": (Vector((0, 0, z)), Quaternion(), Vector((1, 1, 1 + (0.15 if 2 < f < 5 else 0.0))))}

    clips = [("idle", 30, True, lambda t: {"cap": (Vector(), Quaternion(), Vector((1, 1, 1)))}),
             ("press", 12, False, press),
             ("held", 30, True, lambda t: {"cap": (Vector((0, 0, -DOWN)), Quaternion(), Vector((1, 1, 1)))}),
             ("release", 16, False, release)]
    return piv, {"cap": "base"}, clips


def fan():
    YEL, WHITE_ = (1.0, 0.82, 0.3), (0.98, 0.99, 1.0)
    with group("housing"):  # a hollow box: a dark floor deep inside, four walls, a grille over the top
        plate(2.0, 2.0, 0.42, GREY_L, bevel=0.14)
        plate(1.6, 1.6, 0.04, DARKG, z0=0.42, bevel=0.02)
        for s_ in (-1, 1):
            box(s_ * 0.9, 0, 0.62, 0.2, 2.0, 0.6, GREY_L, bevel=0.08, segs=2)
            box(0, s_ * 0.9, 0.62, 2.0, 0.2, 0.6, GREY_L, bevel=0.08, segs=2)
        for k in range(3):  # the grille bars
            box(0, -0.5 + 0.5 * k, 0.98, 1.66, 0.08, 0.06, GREY_D, bevel=0.03)
            box(-0.5 + 0.5 * k, 0, 0.98, 0.08, 1.66, 0.06, GREY_D, bevel=0.03)
    with group("blades"):
        ball(0, 0, 0.66, 0.32, 0.32, 0.16, GREY_D, seg=12, ring=6)
        for k in range(4):  # four soft blades
            a = math.radians(90 * k)
            c = Vector((0.42 * math.cos(a), 0.42 * math.sin(a), 0.66))
            box(c.x, c.y, c.z, 0.56, 0.3, 0.05, YEL, bevel=0.12, segs=2, rot=(math.radians(18), 0, a))
    piv = {"housing": Vector((0, 0, 0)), "blades": Vector((0, 0, 0.66))}
    for k in range(3):  # wind puffs that rise from the grille
        p = Vector(((k - 1) * 0.45, 0.25 * (k % 2) - 0.1, 1.1))
        with group(f"puff_{k}"):
            ball(p.x, p.y, p.z, 0.3, 0.3, 0.3, WHITE_, seg=10, ring=7)
        piv[f"puff_{k}"] = p
    LOOP = 12              # frames: three quarter turns per loop (the blades repeat every quarter)
    SPEED = 270 / LOOP     # degrees per frame

    def puffs(t, on=1.0):
        out = {}
        for k in range(3):
            u = (t + k / 3) % 1.0
            s = (math.sin(math.pi * u) * 0.9 + 0.1) * on
            out[f"puff_{k}"] = (Vector((0.08 * math.sin(6 * u + k), 0, 2.2 * u)), Quaternion(), Vector((s, s, s)))
        return out

    def on(t):
        return {"blades": (Vector(), rz(SPEED * LOOP * t), Vector((1, 1, 1))), **puffs(t)}

    RAMP = 32  # frames to reach (or lose) full speed: SPEED * 32 / 2 = 360 degrees, a whole number of quarter turns

    def spin_up(t):  # speeding up evenly from still, so it hands over to the loop at full speed
        f = t * RAMP
        return {"blades": (Vector(), rz(SPEED * f * f / (2 * RAMP)), Vector((1, 1, 1))), **puffs(t * 2.5, on=ease(t))}

    def spin_down(t):
        f = t * RAMP
        return {"blades": (Vector(), rz(SPEED * f - SPEED * f * f / (2 * RAMP)), Vector((1, 1, 1))), **puffs(t * 2.5, on=1 - ease(t))}

    off = lambda t: {"blades": (Vector(), Quaternion(), Vector((1, 1, 1))), **puffs(0, on=0.0)}
    clips = [("off", 30, True, off), ("spin_up", RAMP, False, spin_up), ("on", LOOP, True, on), ("spin_down", RAMP, False, spin_down)]
    parents = {"blades": "housing", **{f"puff_{k}": "housing" for k in range(3)}}
    return piv, parents, clips


def conveyor():
    RUBBER, CHEV, RAIL = (0.24, 0.24, 0.28), (1.0, 0.8, 0.28), (0.98, 0.62, 0.22)
    with group("frame"):
        plate(2.0, 2.0, 0.3, GREY, bevel=0.08)
        plate(1.6, 2.0, 0.08, RUBBER, z0=0.28, bevel=0.03)  # the belt
        for s in (-1, 1):  # the side rails
            box(s * 0.9, 0, 0.36, 0.2, 2.0, 0.16, RAIL, bevel=0.06, segs=2)
            for y in (-0.95, 0.95):  # rollers peeking out at the ends
                can(s * 0.62, y, 0.22, 0.14, 0.2, GREY_D, n=12, rot=(0, math.radians(90), 0))
    piv = {"frame": Vector((0, 0, 0))}
    N, L = 5, 2.0
    for k in range(N):  # chevron arrows riding the belt (pointing forward, -y)
        with group(f"chevron_{k}"):
            for s in (-1, 1):
                box(s * 0.17, 0.07, 0.37, 0.4, 0.1, 0.03, CHEV, bevel=0.02, rot=(0, 0, s * math.radians(-35)))
        piv[f"chevron_{k}"] = Vector((0, 0, 0))
    LOOP = 12

    def run(t):
        out = {}
        for k in range(N):
            y = ((k / N - t) % 1.0) * L - L / 2   # each arrow wraps on its own; the belt moves forward (-y)
            edge = min(1.0, (0.95 - abs(y)) / 0.15)
            s_ = max(edge, 0.001)
            out[f"chevron_{k}"] = (Vector((0, y, 0)), Quaternion(), Vector((s_, s_, s_)))
        return out

    stop = lambda t: run(0.0)
    return piv, {f"chevron_{k}": "frame" for k in range(N)}, [("run", LOOP, True, run), ("stop", 30, True, stop)]


def spring():
    RED, YEL, YEL_D = (0.9, 0.28, 0.3), (1.0, 0.8, 0.26), (0.96, 0.62, 0.2)
    with group("base"):
        plate(2.0, 2.0, 0.2, GREY)
    with group("coil"):
        for k in range(4):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.48, minor_radius=0.07, major_segments=24, minor_segments=8,
                                             location=(0, 0, 0.26 + 0.12 * k))
            D.finish(bpy.context.object, RED)
    with group("top"):
        plate(1.6, 1.6, 0.18, YEL, z0=0.66, bevel=0.08)
        for k in range(5):  # a star on it
            a = math.radians(90 + 72 * k)
            box(0.22 * math.cos(a), 0.22 * math.sin(a), 0.85, 0.12, 0.36, 0.03, YEL_D, bevel=0.02, rot=(0, 0, a - math.pi / 2))
    piv = {"base": Vector((0, 0, 0)), "coil": Vector((0, 0, 0.2)), "top": Vector((0, 0, 0.66))}

    def boing(t):
        f = t * 28
        if f < 5:  # pressed down
            c = 1 - 0.55 * ease(f / 5)
        elif f < 9:  # launch
            c = 0.45 + 1.15 * ease_out((f - 5) / 4)
        else:  # wobble back to rest
            c = 1 + settle(f - 9, 0.6, tau=3.2, w=0.9)
        dz = 0.46 * (c - 1)
        return {"coil": (Vector(), Quaternion(), Vector((1, 1, c))), "top": (Vector((0, 0, dz)), Quaternion(), Vector((1, 1, 1)))}

    idle = lambda t: {"coil": (Vector(), Quaternion(), Vector((1, 1, 1))), "top": (Vector(), Quaternion(), Vector((1, 1, 1)))}
    return piv, {"coil": "base", "top": "base"}, [("idle", 30, True, idle), ("boing", 28, False, boing)]


def gate():
    POST, BAR = (0.92, 0.62, 0.3), (0.42, 0.44, 0.5)
    with group("frame"):
        plate(2.0, 2.0, 0.16, GREY)
        plate(1.9, 0.3, 0.04, DARKG, z0=0.15, bevel=0.02)  # the slot the bars sink into
        # the posts stand just outside the cell, so a die (2 wide) fits through when it's open
        for s in (-1, 1):
            box(s * 1.18, 0, 1.25, 0.32, 0.4, 2.5, POST, bevel=0.12, segs=2)
            ball(s * 1.18, 0, 2.56, 0.4, 0.46, 0.34, POST, seg=12, ring=7)
        box(0, 0, 2.42, 2.36, 0.3, 0.22, POST, bevel=0.08, segs=2)
    with group("bars"):
        for k in range(5):
            box(-0.8 + 0.4 * k, 0, 1.14, 0.12, 0.12, 2.1, BAR, bevel=0.05, segs=2)
        box(0, 0, 1.25, 1.8, 0.1, 0.12, BAR, bevel=0.04)
    piv = {"frame": Vector((0, 0, 0)), "bars": Vector((0, 0, 0))}
    DROP = 2.22

    def open_(t):
        f = t * 22
        z = -DROP * ease_in(f / 12) if f < 12 else -DROP + settle(f - 12, 0.08, tau=2.0, w=1.5)
        return {"bars": (Vector((0, 0, z)), Quaternion(), Vector((1, 1, 1)))}

    def close(t):
        f = t * 22
        z = -DROP * (1 - ease_out(f / 10)) if f < 10 else settle(f - 10, 0.06, tau=2.0, w=1.5)
        return {"bars": (Vector((0, 0, z)), Quaternion(), Vector((1, 1, 1)))}

    shut = lambda t: {"bars": (Vector(), Quaternion(), Vector((1, 1, 1)))}
    opened = lambda t: {"bars": (Vector((0, 0, -DROP)), Quaternion(), Vector((1, 1, 1)))}
    return piv, {"bars": "frame"}, [("closed", 30, True, shut), ("open", 22, False, open_), ("opened", 30, True, opened),
                                    ("close", 22, False, close)]


def goal_flag():
    LIGHT, DARK_T, POLE, FLAG, STAR = (0.97, 0.96, 0.92), (0.36, 0.36, 0.4), (0.86, 0.86, 0.9), (0.92, 0.28, 0.32), (1.0, 0.84, 0.3)
    with group("tile"):
        for i in range(4):  # a checker tile
            for j in range(4):
                box(-0.75 + 0.5 * i, -0.75 + 0.5 * j, 0.09, 0.5, 0.5, 0.18, LIGHT if (i + j) % 2 else DARK_T, bevel=0.03)
        can(0.55, 0.55, 1.1, 0.06, 1.95, POLE, n=10)
        ball(0.55, 0.55, 2.12, 0.22, 0.22, 0.22, STAR, seg=10, ring=7)
    piv = {"tile": Vector((0, 0, 0))}
    SEG = 4
    for k in range(SEG):  # the flag in segments so it can wave
        with group(f"flag_{k}"):
            box(0.55 - 0.16 - 0.32 * k, 0.55, 1.7, 0.33, 0.04, 0.5 - 0.06 * k, FLAG, bevel=0.015)
        piv[f"flag_{k}"] = Vector((0.55 - 0.32 * k, 0.55, 1.7))
    parents = {"flag_0": "tile", **{f"flag_{k}": f"flag_{k - 1}" for k in range(1, SEG)}}

    def wave(t):
        return {f"flag_{k}": (Vector(), rz(14 * math.sin(2 * math.pi * t - 0.9 * k)), Vector((1, 1, 1))) for k in range(SEG)}
    return piv, parents, [("wave", 40, True, wave)]


def turntable():
    TOP_C, ARROW = (0.42, 0.7, 0.95), (0.98, 0.98, 1.0)
    with group("base"):
        plate(2.0, 2.0, 0.16, GREY)
    with group("platter"):
        can(0, 0, 0.24, 0.94, 0.16, TOP_C, n=40)
        can(0, 0, 0.33, 0.8, 0.02, (0.36, 0.62, 0.88), n=40)
        for k in range(2):  # two curved arrows
            a0 = math.radians(180 * k)
            pts = [Vector((0.6 * math.cos(a0 + math.radians(15 * i)), 0.6 * math.sin(a0 + math.radians(15 * i)), 0.35)) for i in range(8)]
            for p0, p1 in zip(pts, pts[1:]):
                limb(p0, p1, 0.04, ARROW, n=8)
            tip = pts[-1]
            ang = a0 + math.radians(105) + math.pi / 2
            can(tip.x, tip.y, tip.z, 0.1, 0.03, ARROW, n=3, rot=(0, 0, ang))
    piv = {"base": Vector((0, 0, 0)), "platter": Vector((0, 0, 0.16))}

    def turn(sign):
        def fn(t):
            f = t * 26
            a = 90 * ease(f / 16) if f < 16 else 90 + settle(f - 16, 6, tau=2.2, w=1.2)
            return {"platter": (Vector(), rz(sign * a), Vector((1, 1, 1)))}
        return fn

    idle = lambda t: {"platter": (Vector(), Quaternion(), Vector((1, 1, 1)))}
    return piv, {"platter": "base"}, [("idle", 30, True, idle), ("turn_left", 26, False, turn(1)), ("turn_right", 26, False, turn(-1))]


def portal():
    """A standing doorway: a thick upright ring on a little base, a glowing swirl
    spinning inside it, sparkles drifting off. A die rolls through it."""
    BASE, RING, RING_D, CORE, SWIRL_A, SWIRL_B, SPARK = (0.4, 0.34, 0.56), (0.66, 0.46, 0.98), (0.5, 0.34, 0.82), \
        (0.3, 0.2, 0.5), (0.46, 0.92, 1.0), (1.0, 0.56, 0.92), (1.0, 0.96, 0.62)
    CZ_ = 1.1
    with group("frame"):
        plate(2.0, 0.9, 0.22, BASE, bevel=0.08)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.82, minor_radius=0.15, major_segments=40, minor_segments=10,
                                         location=(0, 0, CZ_), rotation=(math.radians(90), 0, 0))
        D.finish(bpy.context.object, RING)
        for a in range(0, 360, 45):  # little studs round the ring
            r = math.radians(a)
            ball(0.82 * math.cos(r), -0.14, CZ_ + 0.82 * math.sin(r), 0.14, 0.1, 0.14, RING_D, seg=8, ring=6)
        can(0, 0.02, CZ_, 0.7, 0.04, CORE, n=40, rot=(math.radians(90), 0, 0))  # the dark middle
    with group("swirl"):  # two spiral arms in the ring's plane
        for k, col in ((0, SWIRL_A), (1, SWIRL_B)):
            pts = [Vector(((0.06 + 0.6 * i / 14) * math.cos(math.pi * k + i * 0.42), -0.02,
                           CZ_ + (0.06 + 0.6 * i / 14) * math.sin(math.pi * k + i * 0.42))) for i in range(15)]
            for p0, p1 in zip(pts, pts[1:]):
                limb(p0, p1, 0.06, col, n=8)
        ball(0, -0.03, CZ_, 0.22, 0.06, 0.22, (1, 1, 1), seg=12, ring=6)
    piv = {"frame": Vector((0, 0, 0)), "swirl": Vector((0, 0, CZ_))}
    for k in range(4):
        a = math.radians(90 * k + 30)
        p = Vector((0.82 * math.cos(a), -0.2, CZ_ + 0.82 * math.sin(a)))
        with group(f"spark_{k}"):
            box(p.x, p.y, p.z, 0.13, 0.13, 0.13, SPARK, bevel=0.04, rot=(math.radians(45), math.radians(35), 0))
        piv[f"spark_{k}"] = p

    def swirl(t):
        out = {"swirl": (Vector(), Quaternion((0, 1, 0), math.radians(-180 * t)), Vector((1, 1, 1)))}  # half a turn: two arms repeat
        for k in range(4):
            u = (t + k / 4) % 1.0
            s_ = math.sin(math.pi * u)
            a = math.radians(90 * k + 30)
            out[f"spark_{k}"] = (Vector((0.35 * u * math.cos(a), -0.5 * u, 0.35 * u * math.sin(a))), rz(360 * u), Vector((s_, s_, s_)))
        return out
    return piv, {"swirl": "frame", **{f"spark_{k}": "frame" for k in range(4)}}, [("swirl", 36, True, swirl)]


def ramp():
    """A gentle wedge two cells long (y from -3 to 1) rising to one die's height
    (2) over its back cell, for rolling dice up onto stacks: about 27 degrees."""
    import bmesh
    H = 2.0
    v = [(-1, -3, 0), (1, -3, 0), (1, 1, 0), (-1, 1, 0), (-1, 1, H), (1, 1, H)]
    f = [(0, 1, 2, 3), (0, 3, 4), (1, 5, 2), (3, 2, 5, 4), (0, 4, 5, 1)]
    me = bpy.data.meshes.new("ramp")
    me.from_pydata(v, [], f)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    with group("ramp"):
        o = bpy.data.objects.new("ramp", me)
        bpy.context.scene.collection.objects.link(o)
        D.finish(o, GREY_L, bevel=0.1, segs=3)
        sl = math.atan2(H, 4.0)
        for k in range(5):  # grip strips up the slope
            y = -2.4 + 0.75 * k
            z = (y + 3) * H / 4.0
            nrm = Vector((0, -math.sin(sl), math.cos(sl)))
            p = Vector((0, y, z)) + nrm * 0.02
            box(p.x, p.y, p.z, 1.7, 0.12, 0.06, GREY_D, bevel=0.025, rot=(sl, 0, 0))
    return {"ramp": Vector((0, 0, 0))}, {}, []


PIECES = {"button": button, "fan": fan, "conveyor": conveyor, "spring": spring, "gate": gate, "goal_flag": goal_flag,
          "turntable": turntable, "portal": portal, "ramp": ramp}


# -------------------------------------------------------------- build, bake, export
RECOLOUR = ("cap", "platter")  # parts a game recolours keep a material per colour


def build(name):
    D._parts.clear()
    piv, parents, clips = PIECES[name]()
    root = bpy.data.objects.new("root", None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_mode = "QUATERNION"
    nodes, rest = {"root": root}, {}
    for n, p in piv.items():
        if D._parts.get(n):
            nodes[n] = D.join(D._parts[n], n, p, bake=n not in RECOLOUR)
    for n, o in nodes.items():
        if n == "root":
            continue
        par = parents.get(n, "root")
        o.parent = nodes[par]
        o.matrix_parent_inverse = Matrix()
        rest[n] = piv[n] - (piv[par] if par != "root" else Vector())
        o.location = rest[n]
    return nodes, rest, clips


def bake(nodes, rest, clips):
    for name, n, loop, fn in clips:
        action = bpy.data.actions.new(name)
        for f in range(n + 1):
            pose = fn(f / n)
            for k, o in nodes.items():
                if k == "root":
                    continue
                dl, q, sc = pose.get(k, (Vector(), Quaternion(), Vector((1, 1, 1))))
                ad = o.animation_data or o.animation_data_create()
                ad.action = action
                o.location, o.rotation_quaternion, o.scale = rest[k] + dl, q, sc
                for path in ("location", "rotation_quaternion", "scale"):
                    o.keyframe_insert(path, frame=f)
        for k, o in nodes.items():
            if k == "root" or not o.animation_data:
                continue
            ad = o.animation_data
            for layer in action.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(ad.action_slot)
                    if bag:
                        for fc in bag.fcurves:
                            for kp in fc.keyframe_points:
                                kp.interpolation = "LINEAR"
            track = ad.nla_tracks.new()
            track.name = name
            st = track.strips.new(name, 0, action)
            st.action_slot = ad.action_slot
            track.mute = True
            ad.action = None
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, n
        action.use_cyclic = loop
    if clips:  # leave the rest pose as the first clip's first frame
        pose = clips[0][3](0.0)
        for k, o in nodes.items():
            if k != "root":
                dl, q, sc = pose.get(k, (Vector(), Quaternion(), Vector((1, 1, 1))))
                o.location, o.rotation_quaternion, o.scale = rest[k] + dl, q, sc


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out, names = args[0], args[1:] or list(PIECES)
    os.makedirs(out, exist_ok=True)
    for name in names:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        D.bobble._mats.clear()
        bpy.context.scene.render.fps = FPS
        nodes, rest, clips = build(name)
        bake(nodes, rest, clips)
        D.still(os.path.join(out, f"{name}-34.png"))
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{name}.glb"), export_format="GLB", export_yup=True,
                                  export_apply=False, export_animations=bool(clips), export_animation_mode="ACTIONS",
                                  export_merge_animation="ACTION", export_force_sampling=True,
                                  export_optimize_animation_size=True, export_optimize_animation_keep_anim_object=True,
                                  export_texcoords=False, export_skins=False, export_morph=False,
                                  export_cameras=False, export_lights=False, export_extras=False)
        print("WROTE", name)


main()
