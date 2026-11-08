"""Hot dog vendor: the kid in a red-and-white striped paper hat, a red shirt
with a bow tie and a white apron (a ketchup splat on it), pushing a little
yellow hot dog cart: red wheels, a giant hot dog with mustard on the lid and
a striped umbrella on a pole. The right mitt grips the cart handle, the left
holds the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

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
    # the apron and a bow tie
    box(0, -0.37, HIP + 0.4, TW * 0.82, 0.06, TH * 0.95, APRON, bevel=0.03)
    box(0.12, -0.41, HIP + 0.55, 0.22, 0.03, 0.16, KETCHUP, rot=(0, 0.4, 0))
    ball(0.22, -0.41, HIP + 0.42, 0.1, 0.03, 0.1, KETCHUP, seg=6, ring=4)
    box(0, -0.43, HIP + 0.2, 0.5, 0.06, 0.2, APRON, bevel=0.03)        # the pocket
    for s in (-1, 1):
        can(s * 0.14, -0.4, TOP - 0.06, 0.13, 0.1, RED, n=3, rot=(math.radians(90), 0, math.radians(90 + s * 90)))
    box(0, -0.42, TOP - 0.06, 0.09, 0.08, 0.09, (0.6, 0.1, 0.1))
    # the paper hat: a long boat-shaped cap with red stripes
    hz = HEAD_Z + HEAD * 0.48
    box(0, 0.05, hz + 0.22, 2.0, 0.85, 0.5, WHITE_P, bevel=0.1)
    box(0, 0.05, hz + 0.5, 1.8, 0.5, 0.18, WHITE_P, bevel=0.06)
    for k in range(5):
        box(-0.72 + k * 0.36, 0.05, hz + 0.25, 0.12, 0.88, 0.52, RED)
    # the cart, to the kid's right
    cx, cz = 1.6, 1.05
    cw, cd, ch = 1.25, 1.0, 0.8
    box(cx, 0, cz, cw, cd, ch, CART, bevel=0.08)
    box(cx, -cd / 2 - 0.01, cz, cw - 0.2, 0.04, ch - 0.25, RED, bevel=0.04)
    can(cx, -cd / 2 - 0.04, cz, 0.18, 0.04, MUSTARD, n=10, rot=X90)
    box(cx, 0, cz + ch / 2 + 0.03, cw + 0.08, cd + 0.08, 0.08, STEEL)
    for wx in (cx - 0.38, cx + 0.38):
        for wy in (-cd / 2 - 0.05, cd / 2 + 0.05):
            can(wx, wy, 0.3, 0.3, 0.12, TYRE, n=10, rot=X90)
            can(wx, wy - 0.04 * (1 if wy < 0 else -1), 0.3, 0.12, 0.08, RED, n=8, rot=X90)
    # the handle the kid grips
    hp = hand_points()[1]
    limb((hp[0], -0.4, hp[2] + 0.03), (hp[0], 0.4, hp[2] + 0.03), 0.05, STEEL)
    for y in (-0.4, 0.4):
        limb((hp[0], y, hp[2] + 0.03), (cx - cw / 2, y, cz - 0.1), 0.05, STEEL)
    # a giant hot dog on the lid
    lz = cz + ch / 2 + 0.07
    box(cx, 0, lz + 0.15, 1.05, 0.5, 0.3, BUN, bevel=0.13, segs=2)
    limb((cx - 0.6, 0, lz + 0.33), (cx + 0.6, 0, lz + 0.33), 0.15, SAUSAGE, n=8)
    for s in (-1, 1):
        ball(cx + s * 0.6, 0, lz + 0.33, 0.3, 0.3, 0.3, SAUSAGE, seg=8, ring=6)
    for k in range(5):
        x0 = cx - 0.45 + k * 0.2
        limb((x0, -0.05 + (0.1 if k % 2 else -0.1), lz + 0.48), (x0 + 0.2, -0.05 + (-0.1 if k % 2 else 0.1), lz + 0.48), 0.04, MUSTARD, n=4)
    # the striped umbrella on a pole
    px, py = cx + 0.1, 0.35
    zt, zr, R = 5.4, 5.0, 0.95
    limb((px, py, cz), (px, py, zt), 0.04, STEEL)
    n = 10
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        tri((px, py, zt), (px + R * math.cos(a0), py + R * math.sin(a0), zr), (px + R * math.cos(a1), py + R * math.sin(a1), zr), RED if k % 2 else WHITE_P)
        ball(px + R * math.cos(a0), py + R * math.sin(a0), zr - 0.02, 0.1, 0.1, 0.1, RED, seg=6, ring=4)
    ball(px, py, zt + 0.06, 0.16, 0.16, 0.16, RED, seg=6, ring=4)
    # the left mitt holds the bucket
    bucket(hand_points()[-1], full=True, size=0.7)


if __name__ == "__main__" or True:
    run({"hot-dog-vendor": build})
