"""Hot dog vendor: the kid in a red-and-white striped paper hat, a red shirt
with a bow tie and a white apron (a ketchup splat on it), carrying a yellow
vendor tray on a red neck strap in front of his belly: three hot dogs with
mustard and a mustard bottle. Both mitts grip the tray handles (no bucket)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

RED, WHITE_P, APRON, KETCHUP, MUSTARD = (0.88, 0.18, 0.18), (0.97, 0.97, 0.95), (0.98, 0.98, 0.96), (0.85, 0.1, 0.1), (1.0, 0.85, 0.1)
CART, CART_D, STEEL, TYRE = (1.0, 0.8, 0.2), (0.9, 0.62, 0.1), (0.78, 0.8, 0.84), (0.15, 0.15, 0.17)
SAUSAGE, BUN, BUN_D = (0.86, 0.32, 0.22), (1.0, 0.78, 0.45), (0.82, 0.5, 0.22)
X90 = (math.radians(90), 0, 0)


def tri(a, b, c, rgb):
    me = bpy.data.meshes.new("t")
    me.from_pydata([a, b, c], [], [(0, 1, 2)])
    o = bpy.data.objects.new("t", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat(rgb))
    s = o.modifiers.new("s", "SOLIDIFY")
    s.thickness = 0.06
    return o


def build():
    body(shirt=RED, pants=(0.2, 0.25, 0.45), shoe=(0.2, 0.2, 0.22))
    kid_head()
    with part("chest"):
        # the apron and a bow tie
        box(0, -0.37, HIP + 0.4, TW * 0.82, 0.06, TH * 0.95, APRON, bevel=0.03)
        box(0.12, -0.41, HIP + 0.55, 0.22, 0.03, 0.16, KETCHUP, rot=(0, 0.4, 0))
        ball(0.22, -0.41, HIP + 0.42, 0.1, 0.03, 0.1, KETCHUP, seg=6, ring=4)
        box(0, -0.43, HIP + 0.2, 0.5, 0.06, 0.2, APRON, bevel=0.03)        # the pocket
        for s in (-1, 1):
            can(s * 0.14, -0.4, TOP - 0.06, 0.13, 0.1, RED, n=3, rot=(math.radians(90), 0, math.radians(90 + s * 90)))
        box(0, -0.42, TOP - 0.06, 0.09, 0.08, 0.09, (0.6, 0.1, 0.1))
    with part("head"):
        # the paper hat: a long boat-shaped cap with red stripes
        hz = HEAD_Z + HEAD * 0.48
        box(0, 0.05, hz + 0.22, 2.0, 0.85, 0.5, WHITE_P, bevel=0.1)
        box(0, 0.05, hz + 0.5, 1.8, 0.5, 0.18, WHITE_P, bevel=0.06)
        for k in range(5):
            box(-0.72 + k * 0.36, 0.05, hz + 0.25, 0.12, 0.88, 0.52, RED)
    with part("chest"):  # the tray hangs from the neck strap: bolted to the chest
        # the vendor tray: an open yellow box on a red neck strap, in front of the
        # belly; both mitts grip short handles on its sides
        tz, tw, td, th = 0.82, 1.3, 0.78, 0.34
        ty = -0.37 - td / 2
        box(0, ty, tz, tw, td, th, CART, bevel=0.06)
        box(0, ty, tz + th / 2 - 0.02, tw - 0.14, td - 0.14, 0.06, CART_D)   # the inside, shown as a darker floor
        box(0, ty - td / 2 - 0.01, tz - 0.02, tw - 0.22, 0.04, th - 0.14, RED, bevel=0.03)
        can(0, ty - td / 2 - 0.04, tz - 0.02, 0.12, 0.04, MUSTARD, n=10, rot=X90)
        box(0, ty, tz + th / 2 + 0.01, tw + 0.04, td + 0.04, 0.04, STEEL)     # the steel rim
        for s in (-1, 1):
            hp = hand_points()[s]
            limb((s * tw / 2 - s * 0.05, ty + 0.1, tz), (hp[0], hp[1], hp[2] + 0.02), 0.055, STEEL)   # handle into the mitt
            limb((s * tw / 2, ty + td / 2 - 0.02, tz + th / 2), (s * 0.34, -0.3, TOP - 0.02), 0.05, RED)      # the neck strap
        # three hot dogs in a row, with mustard zigzags, and a mustard bottle
        lz = tz + th / 2 + 0.04
        for i, x in enumerate((-0.38, 0.0, 0.38)):
            box(x, ty, lz + 0.1, 0.3, 0.62, 0.2, BUN, bevel=0.09, segs=2)
            limb((x, ty - 0.36, lz + 0.22), (x, ty + 0.36, lz + 0.22), 0.09, SAUSAGE, n=8)
            for e in (-1, 1):
                ball(x, ty + e * 0.36, lz + 0.22, 0.18, 0.18, 0.18, SAUSAGE, seg=8, ring=6)
            for k in range(3):
                y0 = ty - 0.27 + k * 0.18
                limb((x + (0.07 if k % 2 else -0.07), y0, lz + 0.31), (x + (-0.07 if k % 2 else 0.07), y0 + 0.18, lz + 0.31), 0.03, MUSTARD, n=4)
        can(0.52, ty + 0.25, lz + 0.22, 0.09, 0.44, MUSTARD, n=8)
        can(0.52, ty + 0.25, lz + 0.5, 0.04, 0.14, MUSTARD, n=6, r2=0.01)


if __name__ == "__main__" or True:
    run({"hot-dog-vendor": build})
