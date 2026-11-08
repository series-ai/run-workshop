"""Angel: a long white robe flaring out to the ankles with a gold rope belt
and wide bell sleeves, big fluffy white wings of layered feathers on the
back, and a huge glowing golden halo floating above the head on a thin gold
wire that springs up from a gold headband (so it moves with the head).
Golden curly hair, gold sandals. Carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts/costumes")
from _kit5 import *  # noqa: F401,F403

ROBE, ROBE_D, FEATH, FEATH_D = (0.98, 0.97, 1.0), (0.86, 0.88, 0.96), (1.0, 1.0, 1.0), (0.84, 0.88, 0.98)
GOLD, GOLD_D, HAIR = (1.0, 0.80, 0.22), (0.92, 0.62, 0.12), (0.98, 0.80, 0.36)

WY = 1.52  # the wings sit behind the head, clear of it when it turns


def wing(s):
    """A fluffy wing on side s: a curved top edge from the shoulder blade up
    and out beside the head, rows of fat round-tipped feathers hanging from it."""
    root, mid, tip = (s * 0.4, 1.7), (s * 1.75, 2.9), (s * 2.25, 4.35)

    def arc(t):
        a, b, c = root, mid, tip
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0]
        z = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]
        return x, WY + 0.35 * t, z
    # long feathers hanging from the edge, longest at the tip, fanning out
    n = 7
    for i in range(n):
        t = 0.25 + 0.75 * i / (n - 1)
        x, y, z = arc(t)
        L = 0.8 + 1.5 * t
        ang = s * math.radians(-8 + 26 * t)
        cx, cz = x + math.sin(ang) * L * 0.45, z - math.cos(ang) * L * 0.45
        ball(cx, y + 0.1, cz, 0.62, 0.2, L, FEATH_D if i % 2 else FEATH, seg=10, ring=6, rot=(0, ang, 0))
    # a fluffy row of round coverts along the top edge, a second row below
    for i in range(8):
        t = i / 7
        x, y, z = arc(t)
        r = 0.72 - 0.2 * t
        ball(x, y, z - 0.05, r, 0.34, r * 0.9, FEATH, seg=10, ring=6)
    for i in range(6):
        t = 0.15 + 0.8 * i / 5
        x, y, z = arc(t)
        r = 0.6 - 0.12 * t
        ball(x + s * 0.12, y - 0.04, z - 0.5, r, 0.3, r * 0.85, FEATH, seg=10, ring=6)


def build():
    body(shoe=GOLD_D, legs=False, torso=False, arms=False)
    # the robe: a flared octagon from the shoulders to the ankles, a hem band
    with part("body"):
        # open at the bottom (the feet step up under it), closed at the neck
        lathe([(0.78, 0.24), (0.74, 0.75), (0.68, 1.2), (0.62, TOP - 0.02), (0.4, TOP + 0.08), (0.0, TOP + 0.08)], ROBE, n=10, at=(0, 0.02, 0), sy=0.85,
              rot0=math.pi / 10, cap=False)
        lathe([(0.8, 0.22), (0.8, 0.36)], ROBE_D, n=10, at=(0, 0.02, 0), sy=0.86, rot0=math.pi / 10, cap=False)
        lathe([(0.75, 0.95), (0.73, 1.07)], GOLD, n=10, at=(0, 0.02, 0), sy=0.88, rot0=math.pi / 10)    # rope belt
    # bell sleeves: the right hangs, the left carries the bucket
    hx, hy, hz = HOLD
    with part("arm.l"):
        bar((SX - 0.05, 0, TOP - 0.12), (HANG[0] - 0.02, HANG[1], HANG[2] + 0.22), 0.12, 0.22, ROBE, n=8)
    with part("hand.l"):
        hand_mitt(*HANG, 1, MITT, SKIN)
    with part("arm.r"):
        bar((-SX + 0.05, 0, TOP - 0.12), (hx + 0.25, hy + 0.05, hz + 0.04), 0.12, 0.22, ROBE, n=8)
    with part("hand.r"):
        hand_mitt(hx, hy, hz, -1, MITT, SKIN)
    bucket(HOLD, full=True, size=0.6)
    # fluffy wings on the back, on a little harness
    with part("chest"):
        box(0, (0.4 + WY) / 2, TOP - 0.25, 0.8, WY - 0.35, 0.75, ROBE_D, bevel=0.3, segs=2)  # the wing pack
        for s in (-1, 1):
            wing(s)
    # the kid's own head, golden hair, a gold headband
    kid_head(hair=HAIR)
    with part("head"):
        _halo()


def _halo():
    top = HEAD_Z + HEAD * 0.48
    box(0, 0.1, top + 0.07, HEAD * 0.98, 0.3, 0.14, GOLD, bevel=0.05)
    for s in (-1, 1):
        box(s * HEAD * 0.53, 0.1, HEAD_Z + 0.7, 0.14, 0.3, 1.3, GOLD, bevel=0.05)
    # the wire springing up from the headband to the halo
    hz2, hyy = top + 0.95, 0.2
    ry, rzz = hyy + 1.15 * math.cos(math.radians(22)), hz2 + 1.15 * math.sin(math.radians(22))
    chain([(0, 0.15, top + 0.12), (0, 0.5, top + 0.45), (0, 0.95, top + 0.75), (0, ry, rzz)], 0.045, 0.045, GOLD_D)
    # the big floating halo, glowing, tipped back a little
    bpy.ops.mesh.primitive_torus_add(major_segments=20, minor_segments=6, major_radius=1.15, minor_radius=0.17,
                                     location=(0, hyy, hz2), rotation=(math.radians(22), 0, 0))
    o = finish(bpy.context.object, GOLD)
    m = o.data.materials[0].copy()
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.62, 0.1, 1)
    bsdf.inputs["Emission Strength"].default_value = 0.8
    o.data.materials[0] = m


if __name__ == "__main__" or True:
    render_costume("angel", build, out_dir(), ortho=8.5, target_z=3.0)
