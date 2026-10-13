"""Build the dog-world props: toys, food, beds and bedding, dog things, agility
kit and a few Scandi house pieces.

blender -b -t 1 --factory-startup -P scripts/build_props.py -- <out_dir> [id ...]

Writes <out_dir>/<id>.glb for every prop (or just the listed ids) and
<out_dir>/props.json, the manifest the viewers and the game read.

Conventions (see PROPS.md):
  * metres, real-ish sizes for a medium dog's world; +X is the prop's front
    (the way the dogs face), +Z up, origin on the floor under the middle.
  * one palette material per colour, named (`oak`, `sage`...), so a game can
    recolour by material name. Cloth is double-sided (`linen@2s`).
  * toys a dog can carry have a `socket_grip` node: the point the mouth holds.
    Its axes are the mouth's: +X out of the mouth, +Y across it, +Z up. To hold
    a toy, put socket_grip on the dog's mouth socket.
  * harness add-ons have their origin on the harness socket they hang from.
"""
import json
import math
import os
import sys

from mathutils import Euler, Matrix, Vector

sys.path.append(os.path.dirname(__file__))
from propkit import Prop, export_prop  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
out_dir = args[0]
only = set(args[1:])
os.makedirs(out_dir, exist_ok=True)

PROPS = []   # (id, category, label, builder, attach)


def prop(pid, category, label, attach='floor'):
    def deco(fn):
        PROPS.append((pid, category, label, fn, attach))
        return fn
    return deco


def R(x=0, y=0, z=0):
    """Euler from degrees."""
    return Euler((math.radians(x), math.radians(y), math.radians(z)))


def M(t=(0, 0, 0), r=(0, 0, 0), s=1.0):
    return Matrix.Translation(t) @ R(*r).to_matrix().to_4x4() @ Matrix.Diagonal((s, s, s, 1))


def leg(P, top, bottom, r_top, r_bot, mat='oak', sides=8):
    """Tapered (Scandi peg) leg from the floor point to the attachment point."""
    top, bottom = Vector(top), Vector(bottom)
    P.cyl(r_bot, (top - bottom).length, base=bottom, axis=top - bottom, r_top=r_top, mat=mat, sides=sides)


def splayed_legs(P, w, d, z_top, inset, r_top, r_bot, splay=0.03, mat='oak', sides=8):
    """Four legs under a w x d top, leaning out by `splay` at the floor."""
    for sx in (1, -1):
        for sy in (1, -1):
            top = (sx * (w / 2 - inset), sy * (d / 2 - inset), z_top)
            bot = (sx * (w / 2 - inset + splay), sy * (d / 2 - inset + splay), 0)
            leg(P, top, bot, r_top, r_bot, mat, sides)


def ellipse(rx, ry, n, z=0.0, phase=0.0):
    return [(rx * math.cos(2 * math.pi * k / n + phase), ry * math.sin(2 * math.pi * k / n + phase), z)
            for k in range(n)]


# ==========================================================================
# Toys. Each lies on the floor as it would after being dropped.

@prop('ball_tennis', 'toys', 'Tennis ball')
def ball_tennis(P):
    r = 0.034
    P.sphere(r, (0, 0, r), 'tennis', subdiv=2)
    # Seam: the classic tennis-ball curve, pushed just outside the surface.
    a, b = 0.75, 0.25
    seam = []
    for k in range(32):
        t = 2 * math.pi * k / 32
        p = Vector((a * math.cos(t) + b * math.cos(3 * t), a * math.sin(t) - b * math.sin(3 * t),
                    2 * math.sqrt(a * b) * math.sin(2 * t))).normalized() * r * 1.01
        seam.append(p + Vector((0, 0, r)))
    P.sweep(seam, 0.0025, 'white', sides=4, closed=True)
    P.socket('grip', (0, 0, r))


@prop('ball_rubber', 'toys', 'Rubber ball')
def ball_rubber(P):
    r = 0.045
    m = P.mark()
    P.uvsphere(r, (0, 0, r), 'red', seg=10, rings=8)
    P.paint(P.since(m), lambda c: 'white' if abs(c.z - r) < r * 0.3 else None)
    P.socket('grip', (0, 0, r))


@prop('ball_spiky', 'toys', 'Spiky squeaky ball')
def ball_spiky(P):
    r = 0.04
    vs = P.sphere(r, (0, 0, 0), 'teal', subdiv=2)
    # Push the 12 original icosahedron corners (5 neighbours) out into nubs.
    for v in vs:
        if len(v.link_edges) == 5:
            v.co *= 1.45
    P.transform(vs, Matrix.Translation((0, 0, r * 1.1)))
    P.socket('grip', (0, 0, r * 1.1))


@prop('bone_toy', 'toys', 'Rubber bone')
def bone_toy(P, mat='dusty_blue', length=0.16):
    r = 0.016
    half = length / 2 - r * 1.2
    P.cyl(r, 2 * half, base=(0, -half, r * 1.2), axis=(0, 1, 0), mat=mat, sides=8)
    for sy in (1, -1):
        for sx in (1, -1):
            P.sphere(r * 1.25, (sx * r * 0.95, sy * half, r * 1.2), mat, subdiv=1)
    P.socket('grip', (0, 0, r * 1.2))


@prop('biscuit_bone', 'food', 'Bone biscuit')
def biscuit_bone(P):
    # Flat biscuit bone: a slab with lobed ends.
    t, L, w = 0.012, 0.075, 0.016
    P.box((w * 1.2, L - 2 * w, t), (0, 0, t / 2), 'biscuit', bevel=0.003)
    for sy in (1, -1):
        for sx in (1, -1):
            P.cyl(w * 0.62, t, base=(sx * w * 0.55, sy * (L / 2 - w * 0.75), 0), mat='biscuit', sides=8,
                  bevel=0.002)
    P.socket('grip', (0, 0, t / 2))


def rope(P, path, r, mats=('linen', 'red'), seg_len=0.035):
    """Two-colour twisted rope: short alternating tube segments along a path."""
    pts = [Vector(p) for p in path]
    dense = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int((b - a).length / (seg_len / 2)))
        dense += [a.lerp(b, (i + 1) / n) for i in range(n)]
    for i in range(0, len(dense) - 1, 2):
        chunk = dense[i:i + 3]
        if len(chunk) >= 2:
            P.sweep(chunk, r, mats[(i // 2) % 2], sides=6, twist=0.6)


@prop('rope_tug', 'toys', 'Rope tug')
def rope_tug(P):
    r = 0.014
    L = 0.3
    rope(P, [(0, -L / 2 + 0.03, r), (0, L / 2 - 0.03, r)], r)
    for s in (1, -1):
        y = s * (L / 2 - 0.03)
        P.sphere(r * 2.1, (0, y, r * 1.6), 'linen', subdiv=1, scale=(1, 1.15, 0.8))
        for k in range(5):
            a = 2 * math.pi * k / 5
            base = Vector((math.cos(a) * r * 0.9, y + s * r * 1.6, r * 1.4 + math.sin(a) * r * 0.6))
            P.cyl(r * 0.45, 0.035, base=base, axis=(math.cos(a) * 0.3, s, -0.25), r_top=r * 0.2, mat='linen',
                  sides=4)
    P.socket('grip', (0, 0, r))


@prop('rope_ring', 'toys', 'Rope ring')
def rope_ring(P):
    R0, r = 0.075, 0.016
    pts = [(R0 * math.cos(2 * math.pi * k / 24), R0 * math.sin(2 * math.pi * k / 24), r) for k in range(25)]
    rope(P, pts, r, ('linen', 'mustard'), seg_len=0.04)
    P.socket('grip', (-R0, 0, r))


@prop('frisbee', 'toys', 'Frisbee')
def frisbee(P):
    R0, h = 0.115, 0.022
    P.lathe([(0, h), (R0 * 0.85, h), (R0, h * 0.7), (R0, h * 0.15), (R0 * 0.92, 0.0), (R0 * 0.88, h * 0.55),
             (0, h * 0.75)], mat='mustard', sides=16, cap_start=False, cap_end=False,
            mats=['mustard', 'orange', 'orange', 'orange', 'mustard', 'mustard'])
    P.cyl(R0 * 0.45, 0.002, base=(0, 0, h), mat='white', sides=16)
    # Held by the rim, the disc sticking out in front of the mouth.
    P.socket('grip', (-R0, 0, h * 0.5))


@prop('stick', 'toys', 'Stick')
def stick(P):
    r = 0.014
    path = [(0.004, -0.2, r), (-0.006, -0.08, r * 1.1), (0.005, 0.05, r), (-0.004, 0.2, r * 0.9)]
    P.sweep(path, [r, r * 1.05, r * 0.95, r * 0.8], 'bark', sides=6)
    P.cyl(r * 0.5, 0.08, base=(0.0, 0.02, r), axis=(1, 0.6, 0.15), r_top=r * 0.3, mat='bark', sides=5)
    # Pale chewed ends.
    for y, rr in ((-0.2, r), (0.2, r * 0.8)):
        P.cyl(rr * 0.85, 0.003, base=(0.004 if y < 0 else -0.004, y - 0.0015 * (1 if y > 0 else -1), r),
              axis=(0, 1 if y > 0 else -1, 0), mat='birch', sides=6)
    P.socket('grip', (0, 0, r))


@prop('kong', 'toys', 'Treat stuffer')
def kong(P):
    # Three stacked bulbs lying on its side, the open end facing +Y.
    prof = [(0.012, 0), (0.035, 0.004), (0.04, 0.022), (0.03, 0.045), (0.033, 0.06), (0.025, 0.08),
            (0.026, 0.09), (0.016, 0.1), (0.008, 0.1)]
    vs = P.lathe(prof, mat='red', sides=10)
    P.transform(vs, M((0, -0.05, 0.038), (-90, 0, 0)))
    P.socket('grip', (0, 0, 0.038))


@prop('chew_ring', 'toys', 'Chew ring')
def chew_ring(P):
    P.torus(0.06, 0.017, center=(0, 0, 0.017), mat='teal', seg=14, sides=6)
    P.socket('grip', (-0.06, 0, 0.017))


@prop('antler', 'toys', 'Antler chew')
def antler(P):
    P.sweep([(0, -0.1, 0.014), (0.005, -0.02, 0.018), (-0.01, 0.06, 0.02), (0, 0.11, 0.03)],
            [0.014, 0.013, 0.012, 0.008], 'linen', sides=6)
    P.sweep([(-0.005, 0.02, 0.018), (0.03, 0.06, 0.03), (0.05, 0.08, 0.05)], [0.01, 0.008, 0.005], 'linen',
            sides=5)
    P.sphere(0.018, (0, -0.1, 0.016), 'oatmeal', subdiv=1, scale=(1, 0.7, 1))
    P.socket('grip', (0, 0, 0.016))


@prop('slipper', 'toys', 'Chewed slipper')
def slipper(P):
    sole = [(0.13 * math.cos(a), 0.045 * math.sin(a) * (1.15 if math.cos(a) > 0 else 0.95), 0)
            for a in (2 * math.pi * k / 12 for k in range(12))]
    P.prism([(x, y) for x, y, _ in sole], 0, 0.015, 'charcoal', axis='z')
    P.sphere(0.05, (0.055, 0, 0.022), 'grey', subdiv=1, scale=(1.4, 1.0, 0.6))
    P.box((0.03, 0.09, 0.012), (0.035, 0, 0.045), 'white', bevel=0.004, rot=(0, 20, 0))   # fluffy cuff
    P.sphere(0.008, (0.11, 0.03, 0.04), 'grey', subdiv=0)                                 # chewed tuft
    P.socket('grip', (0.1, 0, 0.03))


def plush_eyes(P, at, spacing, r=0.005, up=0.0):
    for s in (1, -1):
        P.sphere(r, (at[0], at[1] + s * spacing, at[2] + up), 'ink', subdiv=0)


@prop('plush_duck', 'toys', 'Plush duck')
def plush_duck(P):
    P.sphere(0.055, (0, 0, 0.045), 'mustard', subdiv=1, scale=(1.3, 0.95, 0.8))
    P.sphere(0.035, (0.06, 0, 0.1), 'mustard', subdiv=1)
    P.box((0.035, 0.03, 0.012), (0.1, 0, 0.095), 'orange', bevel=0.004, taper=(0.8, 0.7))
    for s in (1, -1):
        P.sphere(0.03, (-0.005, s * 0.05, 0.05), 'yellow', subdiv=1, scale=(1.3, 0.35, 0.7))
        P.box((0.035, 0.022, 0.006), (0.03, s * 0.03, 0.003), 'orange', bevel=0.002)
    P.box((0.03, 0.03, 0.02), (-0.075, 0, 0.065), 'mustard', bevel=0.006, rot=(0, -35, 0))
    plush_eyes(P, (0.088, 0, 0.11), 0.018)
    P.socket('grip', (0, 0, 0.06))


@prop('plush_fox', 'toys', 'Plush fox')
def plush_fox(P):
    P.sphere(0.06, (0, 0, 0.05), 'orange', subdiv=1, scale=(1.4, 0.8, 0.8))
    P.sphere(0.045, (0.08, 0, 0.1), 'orange', subdiv=1, scale=(1, 1.05, 0.9))
    P.cyl(0.024, 0.045, base=(0.11, 0, 0.09), axis=(1, 0, -0.15), r_top=0.006, mat='white', sides=6)
    P.sphere(0.006, (0.155, 0, 0.087), 'ink', subdiv=0)
    for s in (1, -1):
        P.cyl(0.02, 0.04, base=(0.07, s * 0.025, 0.13), axis=(0, s * 0.35, 1), r_top=0.002, mat='orange', sides=4)
        P.cyl(0.013, 0.04, base=(s * 0.04, s * 0.03, 0.02), axis=(0, 0, -1), mat='ink', sides=5)
    P.sweep([(-0.07, 0, 0.05), (-0.12, 0.02, 0.06), (-0.16, 0.05, 0.05)], [0.022, 0.03, 0.022], 'orange',
            sides=6)
    P.sphere(0.02, (-0.17, 0.055, 0.05), 'white', subdiv=1)
    plush_eyes(P, (0.115, 0, 0.115), 0.02)
    P.socket('grip', (0, 0, 0.07))


@prop('plush_hedgehog', 'toys', 'Plush hedgehog')
def plush_hedgehog(P):
    P.sphere(0.05, (0, 0, 0.04), 'oatmeal', subdiv=1, scale=(1.3, 1.0, 0.85))
    vs = P.sphere(0.056, (0, 0, 0), 'walnut', subdiv=1, scale=(1.25, 1.0, 0.9))
    for v in vs:   # spines on the back half only
        if v.co.x < 0.02 and v.co.z > -0.01 and len(v.link_edges) == 5:
            v.co *= 1.4
    P.transform(vs, M((-0.012, 0, 0.045)))
    P.cyl(0.03, 0.045, base=(0.045, 0, 0.035), axis=(1, 0, 0.05), r_top=0.006, mat='oatmeal', sides=6)
    P.sphere(0.008, (0.092, 0, 0.038), 'ink', subdiv=0)
    plush_eyes(P, (0.06, 0, 0.055), 0.018)
    P.socket('grip', (0, 0, 0.06))


@prop('squeaky_carrot', 'toys', 'Squeaky carrot')
def squeaky_carrot(P):
    P.cyl(0.028, 0.15, base=(0, -0.07, 0.028), axis=(0, 1, 0), r_top=0.006, mat='orange', sides=7)
    for a in (-30, 0, 30):
        P.cyl(0.012, 0.06, base=(0, -0.07, 0.028), axis=(math.sin(math.radians(a)), -1, 0.3), r_top=0.003,
              mat='leaf', sides=4)
    P.socket('grip', (0, 0, 0.028))


# ==========================================================================
# Food & water

def bowl(P, r=0.1, h=0.055, outer='terracotta', inner='white', base=(0, 0, 0)):
    """Stoneware bowl: glazed inside, raw outside, flat foot."""
    P.lathe([(r * 0.68, 0), (r * 0.9, 0.006), (r, h * 0.9), (r * 0.97, h), (r * 0.82, h), (r * 0.66, h * 0.3),
             (0, h * 0.3)], base=base, mat=outer, sides=14,
            mats=[outer, outer, outer, inner, inner, inner], cap_end=False)
    return r * 0.75, h


@prop('bowl_food', 'food', 'Food bowl')
def bowl_food(P):
    bowl(P, outer='sage')


def kibble_mound(P, r, z, height, n=40, seed=3):
    P.lathe([(r, z), (r * 0.7, z + height * 0.7), (0, z + height)], mat='kibble', sides=10, cap_start=False)
    s = seed
    for k in range(n):
        s = (s * 16807) % 2147483647
        a = 2 * math.pi * (s / 2147483647)
        s = (s * 16807) % 2147483647
        d = math.sqrt(s / 2147483647) * r * 0.95
        hz = z + height * (1 - (d / r) ** 2) * 0.95
        mat = 'kibble_light' if k % 3 == 0 else 'kibble'
        P.sphere(0.0085, (d * math.cos(a), d * math.sin(a), hz), mat, subdiv=0, scale=(1.2, 1, 0.75))


@prop('bowl_food_full', 'food', 'Food bowl (full)')
def bowl_food_full(P):
    rin, h = bowl(P, outer='terracotta')
    kibble_mound(P, rin * 1.12, h * 0.8, 0.03)


@prop('bowl_water', 'food', 'Water bowl')
def bowl_water(P):
    rin, h = bowl(P, outer='dusty_blue')
    P.cyl(rin * 1.18, 0.002, base=(0, 0, h * 0.78), mat='water', sides=14)


@prop('bowl_steel', 'food', 'Steel bowl')
def bowl_steel(P):
    r, h = 0.095, 0.05
    P.lathe([(r * 0.8, 0.0), (r * 1.15, 0.004), (r * 1.15, 0.01), (r, h), (r * 0.94, h), (r * 0.6, 0.01),
             (0, 0.01)], mat='steel', sides=14, mats=['charcoal', 'charcoal', 'steel', 'steel', 'steel', 'steel'],
            cap_end=False)


@prop('feeder_raised', 'food', 'Raised feeder')
def feeder_raised(P):
    w, d, z = 0.26, 0.5, 0.2
    P.box((w, d, 0.03), (0, 0, z), 'oak', bevel=0.008)
    splayed_legs(P, w, d, z - 0.015, 0.035, 0.016, 0.012, splay=0.02)
    bowl(P, r=0.085, h=0.05, outer='white', inner='white', base=(0, 0.12, z + 0.006))
    P.cyl(0.085 * 0.88, 0.002, base=(0, 0.12, z + 0.006 + 0.04), mat='water', sides=14)
    bowl(P, r=0.085, h=0.05, outer='white', inner='white', base=(0, -0.12, z + 0.006))
    kibble_mound(P, 0.07, z + 0.045, 0.022, n=25)


@prop('placemat', 'food', 'Bowl mat')
def placemat(P):
    P.pillow(0.32, 0.55, 0.006, center=(0, 0, 0.003), mat='stone', boxy=8, corner=5, nx=4, ny=4)


@prop('treat_jar', 'food', 'Treat jar')
def treat_jar(P):
    P.lathe([(0.06, 0), (0.07, 0.01), (0.07, 0.14), (0.055, 0.16), (0.05, 0.17)], mat='glass', sides=12)
    P.lathe([(0, 0.17), (0.058, 0.17), (0.058, 0.19), (0.04, 0.2), (0, 0.2)], mat='oak', sides=12,
            cap_start=True)
    P.sphere(0.015, (0, 0, 0.21), 'oak', subdiv=1)
    P.cyl(0.0705, 0.045, base=(0, 0, 0.05), mat='linen', sides=12, cap=False)
    # Biscuits showing through the glass, stacked against the front.
    for y, z, rz in ((0, 0.03, 10), (-0.025, 0.07, -20), (0.02, 0.1, 30)):
        P.embed(biscuit_bone, M((0.045, y, z), (0, 90, rz), 0.8))


@prop('kibble_bag', 'food', 'Kibble bag')
def kibble_bag(P):
    P.box((0.16, 0.28, 0.36), (0, 0, 0.18), 'sand', bevel=0.012, taper=(0.7, 1.0))
    P.box((0.07, 0.28, 0.05), (0, 0, 0.385), 'sand', bevel=0.012)          # rolled top
    P.box((0.004, 0.2, 0.12), (0.075, 0, 0.17), 'sage', rot=(0, -3, 0))    # label
    P.embed(biscuit_bone, M((0.08, 0, 0.17), (0, 90, 90), 0.9))


@prop('kibble_pile', 'food', 'Spilled kibble')
def kibble_pile(P):
    kibble_mound(P, 0.08, 0.0, 0.025, n=30, seed=11)
    s = 5
    for k in range(10):
        s = (s * 16807) % 2147483647
        a = 2 * math.pi * s / 2147483647
        d = 0.1 + 0.05 * ((s >> 8) % 100) / 100
        P.sphere(0.0085, (d * math.cos(a), d * math.sin(a), 0.006), 'kibble', subdiv=0, scale=(1.2, 1, 0.75))


@prop('meat_bone', 'food', 'Meaty bone')
def meat_bone(P):
    P.cyl(0.014, 0.2, base=(0, -0.1, 0.03), axis=(0, 1, 0), mat='white', sides=7)
    for s in (1, -1):
        for sx in (1, -1):
            P.sphere(0.02, (sx * 0.013, s * 0.105, 0.03), 'white', subdiv=1)
    P.sphere(0.045, (0, 0.01, 0.033), 'meat', subdiv=1, scale=(0.95, 1.2, 0.75))
    P.sphere(0.02, (0.012, 0.0, 0.055), 'blush', subdiv=0)
    P.socket('grip', (0, -0.06, 0.03))


@prop('treat_stick', 'food', 'Chew stick')
def treat_stick(P):
    P.sweep([(0, -0.07, 0.008), (0, 0.07, 0.008)], (0.008, 0.008), 'rust', sides=4, twist=4.0)
    P.socket('grip', (0, 0, 0.008))


@prop('dental_chew', 'food', 'Dental chew')
def dental_chew(P):
    star = [((1.0 if k % 2 == 0 else 0.6) * math.cos(math.pi * k / 4),
             (1.0 if k % 2 == 0 else 0.6) * math.sin(math.pi * k / 4)) for k in range(8)]
    P.sweep([(0, -0.05, 0.012), (0.006, 0, 0.012), (0, 0.05, 0.012)], 0.012, 'sage', profile=star, twist=2.0)
    P.sphere(0.015, (0, 0.055, 0.013), 'sage', subdiv=1)
    P.socket('grip', (0, 0, 0.012))


@prop('food_can', 'food', 'Food tin (open)')
def food_can(P):
    P.lathe([(0.04, 0), (0.042, 0.004), (0.042, 0.065), (0.04, 0.07), (0.036, 0.07)], mat='steel', sides=12,
            mats=['steel', 'steel', 'steel', 'steel'], cap_end=False)
    P.cyl(0.0425, 0.04, base=(0, 0, 0.015), mat='mustard', sides=12, cap=False)
    P.cyl(0.037, 0.003, base=(0, 0, 0.064), mat='meat', sides=12)
    P.cyl(0.04, 0.002, base=(-0.035, 0, 0.07), axis=(-1, 0, 2.2), mat='steel', sides=12)   # lid, peeled up


@prop('food_scoop', 'food', 'Food scoop')
def food_scoop(P):
    P.lathe([(0.04, 0.0), (0.045, 0.05), (0.042, 0.05), (0.036, 0.005), (0, 0.005)], mat='oak', sides=10,
            base=(0, 0, 0.045), axis=(1, 0, 0), cap_end=False)
    P.cyl(0.012, 0.1, base=(0, 0, 0.045), axis=(-1, 0, 0), r_top=0.01, mat='oak', sides=6)


# ==========================================================================
# Beds & bedding

@prop('bed_donut', 'beds', 'Donut bed')
def bed_donut(P):
    P.torus(0.3, 0.1, center=(0, 0, 0.09), mat='oatmeal', seg=16, sides=8, scale=(1, 1))
    P.pillow(0.5, 0.5, 0.09, center=(0, 0, 0.05), mat='linen', corner=2.0, boxy=2.5, nx=8, ny=8)


@prop('bed_bolster', 'beds', 'Bolster bed')
def bed_bolster(P, mat='sage', cushion='linen'):
    w, d = 0.65, 0.9   # x, y
    P.box((w, d, 0.06), (0, 0, 0.03), mat, bevel=0.02)
    P.pillow(w - 0.12, d - 0.2, 0.09, center=(0.04, 0, 0.08), mat=cushion, boxy=4, nx=6, ny=8)
    r = 0.075
    path = [(w / 2 - r, d / 2 - r, r + 0.03), (-w / 2 + r * 1.6, d / 2 - r, r + 0.03),
            (-w / 2 + r, d / 2 - r * 1.6, r + 0.03), (-w / 2 + r, -d / 2 + r * 1.6, r + 0.03),
            (-w / 2 + r * 1.6, -d / 2 + r, r + 0.03), (w / 2 - r, -d / 2 + r, r + 0.03)]
    P.sweep(path, (r, r * 1.05), mat, sides=8)


@prop('bed_bolster_blue', 'beds', 'Bolster bed (blue)')
def bed_bolster_blue(P):
    bed_bolster(P, 'dusty_blue', 'white')


@prop('bed_pillow', 'beds', 'Pillow bed')
def bed_pillow(P):
    P.pillow(0.7, 0.95, 0.16, center=(0, 0, 0.08), mat='terracotta', boxy=2.6, corner=6, nx=7, ny=9)


@prop('bed_cot', 'beds', 'Raised cot')
def bed_cot(P):
    w, d, z = 0.6, 0.85, 0.16
    for sy in (1, -1):
        P.box((w, 0.035, 0.035), (0, sy * (d / 2 - 0.0175), z), 'oak', bevel=0.006)
    for sx in (1, -1):
        P.box((0.035, d, 0.035), (sx * (w / 2 - 0.0175), 0, z), 'oak', bevel=0.006)
    splayed_legs(P, w, d, z, 0.03, 0.018, 0.014, splay=0.0)
    P.sheet(w - 0.05, d - 0.05, 6, 8, lambda x, y: -0.02 * (1 - (2 * x / w) ** 2) * (1 - (2 * y / d) ** 4),
            center=(0, 0, z + 0.012), mat='sand@2s', thick=0.006)


@prop('bed_cave', 'beds', 'Cave bed')
def bed_cave(P):
    R0 = 0.33
    P.pillow(2 * R0, 2 * R0, 0.1, center=(0, 0, 0.05), mat='white', corner=2.0, boxy=2.5, nx=8, ny=8)
    P.torus(R0, 0.045, center=(0, 0, 0.07), mat='white', seg=16, sides=6)
    # Hood: a dome over the back two thirds, open at the front (+X).
    rings = []
    for i in range(7):
        el = math.radians(8 + 82 * i / 6)
        ring = []
        for k in range(11):
            az = math.radians(70 + 220 * k / 10)
            ring.append((R0 * 1.02 * math.cos(el) * math.cos(az), R0 * 1.02 * math.cos(el) * math.sin(az),
                         0.06 + 0.42 * math.sin(el)))
        rings.append(ring)
    bm = P.bm
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    P._quads(vs, 'oatmeal@2s', closed=False)
    # Piped edge round the opening.
    edge = [r[0] for r in rings] + [rings[-1][k] for k in range(1, 10)] + [r[-1] for r in reversed(rings)]
    P.sweep(edge, 0.018, 'white', sides=5)


@prop('bed_basket', 'beds', 'Wicker basket bed')
def bed_basket(P):
    rx, ry = 0.36, 0.48
    prof = [(1.0, 0.0), (1.04, 0.06), (1.08, 0.12), (1.1, 0.18), (1.08, 0.2), (1.0, 0.2), (1.0, 0.03), (0, 0.03)]
    vs = P.lathe(prof, mat='sand', sides=16, mats=['sand', 'oak', 'sand', 'oak_dark', 'oak_dark', 'sand',
                                                   'sand'], cap_start=True, cap_end=False)
    for v in vs:
        v.co.x *= rx
        v.co.y *= ry
        if v.co.z > 0.08 and v.co.x > 0:   # dip the front rim to step in
            v.co.z -= 0.09 * (v.co.x / (rx * 1.1)) ** 3
    P.pillow(rx * 1.7, ry * 1.7, 0.08, center=(0, 0, 0.06), mat='linen', corner=2.0, boxy=2.5, nx=6, ny=8)


@prop('bed_crate', 'beds', 'Crate bed')
def bed_crate(P):
    w, d, h = 0.6, 0.85, 0.22
    for z in (0.035, 0.11, 0.185):
        for sy in (1, -1):
            P.box((w, 0.025, 0.06), (0, sy * (d / 2 - 0.0125), z), 'oak', bevel=0.005)
        P.box((0.025, d - 0.05, 0.06), (-w / 2 + 0.0125, 0, z), 'oak', bevel=0.005)
        if z < 0.1:
            P.box((0.025, d - 0.05, 0.06), (w / 2 - 0.0125, 0, z), 'oak', bevel=0.005)
    for sy in (1, -1):
        for sx in (1, -1):
            P.box((0.04, 0.04, h), (sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), h / 2), 'oak_dark', bevel=0.005)
    P.box((w - 0.05, d - 0.05, 0.02), (0, 0, 0.012), 'oak')
    P.pillow(w - 0.08, d - 0.08, 0.1, center=(0, 0, 0.07), mat='dusty_blue', boxy=3, nx=6, ny=8)
    P.sheet(0.45, 0.4, 5, 4, lambda x, y: 0.02 * math.sin(x * 20) * math.cos(y * 9) + 0.06 * (x > 0.12),
            center=(0.02, 0.15, 0.125), mat='white@2s', thick=0.008)


def stripes(axis, period, mats, offset=0.0):
    def fn(c):
        k = int(math.floor((c[axis] + offset) / period))
        return mats[k % len(mats)]
    return fn


@prop('blanket_flat', 'bedding', 'Blanket (laid out)')
def blanket_flat(P):
    w, d = 0.9, 1.25
    m = P.mark()
    P.sheet(w, d, 9, 12, lambda x, y: 0.006 * math.sin(x * 9 + y * 4) + 0.004 * math.cos(y * 13),
            center=(0, 0, 0.012), mat='linen@2s', thick=0.01,
            outline=lambda x, y: (x * (1 - 0.02 * math.cos(y * 7)), y))
    P.paint(P.since(m), lambda c: 'sage@2s' if 0.32 < abs(c.y) < 0.46 else None)
    # Turned-back corner.
    P.sheet(0.25, 0.25, 2, 2, lambda x, y: 0.0, center=(0.33, 0.5, 0.024), mat='sage@2s', thick=0.006,
            outline=lambda x, y: (x if x + y < 0.05 else x - (x + y - 0.05) * 0.5, y))


@prop('blanket_rumpled', 'bedding', 'Blanket (rumpled)')
def blanket_rumpled(P):
    w, d = 0.95, 1.1

    def h(x, y):
        bumps = (0.07 * math.exp(-((x - 0.1) ** 2 + (y + 0.15) ** 2) / 0.03)
                 + 0.05 * math.exp(-((x + 0.2) ** 2 + (y - 0.25) ** 2) / 0.02)
                 + 0.035 * math.exp(-((x - 0.25) ** 2 + (y - 0.3) ** 2) / 0.01))
        return bumps + 0.012 * math.sin(x * 14 + y * 6)

    m = P.mark()
    P.sheet(w, d, 10, 12, h, center=(0, 0, 0.012), mat='dusty_blue@2s', thick=0.012,
            outline=lambda x, y: (x * (1 - 0.08 * math.sin(y * 9)), y * (1 - 0.06 * math.cos(x * 8))))
    P.paint(P.since(m), stripes(1, 0.12, ['dusty_blue@2s', 'dusty_blue@2s', 'white@2s'], 0.6))


@prop('blanket_folded', 'bedding', 'Folded blankets')
def blanket_folded(P):
    z = 0
    for mat, t, rot in (('oatmeal', 0.05, 0), ('sage', 0.045, 4), ('white', 0.04, -3)):
        P.pillow(0.42, 0.55, t, center=(0, 0, z + t / 2), mat=mat, boxy=5, corner=8, nx=4, ny=4,
                 rot=(0, 0, rot))
        P.cyl(t / 2, 0.55, base=(0.21, -0.275, z + t / 2), axis=(0, 1, 0), mat=mat, sides=6)   # fold
        z += t


@prop('blanket_knit', 'bedding', 'Chunky knit throw')
def blanket_knit(P):
    w, d = 0.9, 1.2
    # Ribs: grid lines every half rib, alternately raised (36 columns over 0.9 m).
    P.sheet(w, d, 36, 14, lambda x, y: 0.012 * abs(math.sin(x * math.pi / 0.05)) + 0.004 * math.sin(y * 9),
            center=(0, 0, 0.014), mat='white@2s', thick=0.014)


@prop('towel_flat', 'bedding', 'Towel (laid out)')
def towel_flat(P):
    m = P.mark()
    P.sheet(0.55, 1.0, 5, 12, lambda x, y: 0.004 * math.sin(y * 11 + x * 3), center=(0, 0, 0.008),
            mat='white@2s', thick=0.008)
    P.paint(P.since(m), lambda c: 'terracotta@2s' if 0.33 < abs(c.y) < 0.42 else None)


@prop('towel_rolled', 'bedding', 'Towel (rolled)')
def towel_rolled(P):
    r, L = 0.06, 0.4
    P.cyl(r, L, base=(0, -L / 2, r), axis=(0, 1, 0), mat='white', sides=8)
    for s in (1, -1):
        P.cyl(r * 1.005, 0.04, base=(0, s * (L / 2 - 0.08) - 0.02, r), axis=(0, 1, 0), mat='terracotta', sides=8,
              cap=False)
        # Spiral end: a couple of inset rings so the roll reads.
        for k, rr in enumerate((0.7, 0.4)):
            P.cyl(r * rr, 0.004, base=(0, s * L / 2, r), axis=(0, s, 0), mat='linen' if k == 0 else 'white',
                  sides=8)
    P.box((0.01, L, 0.05), (r * 0.95, 0, 0.025), 'white', bevel=0.003)   # loose end


@prop('towel_folded', 'bedding', 'Towels (folded)')
def towel_folded(P):
    z = 0
    for mat in ('white', 'blush', 'white'):
        t = 0.04
        P.pillow(0.3, 0.42, t, center=(0, 0, z + t / 2), mat=mat, boxy=6, corner=8, nx=3, ny=4)
        P.cyl(t / 2, 0.42, base=(0.15, -0.21, z + t / 2), axis=(0, 1, 0), mat=mat, sides=6)
        z += t


@prop('pillow_square', 'bedding', 'Throw pillow')
def pillow_square(P, mat='mustard'):
    P.pillow(0.45, 0.45, 0.14, center=(0, 0, 0.07), mat=mat, boxy=2.4, corner=12, nx=6, ny=6)


@prop('pillow_blush', 'bedding', 'Throw pillow (blush)')
def pillow_blush(P):
    pillow_square(P, 'blush')


@prop('mat_washable', 'bedding', 'Washable mat')
def mat_washable(P):
    m = P.mark()
    P.pillow(0.6, 0.9, 0.02, center=(0, 0, 0.01), mat='grey', boxy=8, corner=8, nx=6, ny=8)
    P.paint(P.since(m), lambda c: 'charcoal' if abs(c.x) > 0.24 or abs(c.y) > 0.39 else None)


# ==========================================================================
# Dog things

@prop('dog_house', 'home', 'Dog house')
def dog_house(P):
    W, D, H, peak, t = 0.72, 0.85, 0.5, 0.82, 0.03
    dw, dh = 0.17, 0.36   # half door width, door height to the top of the arch
    # Front gable wall with an arched door: walk the outline round the opening from the floor.
    front = [(W / 2, 0), (W / 2, H), (0, peak), (-W / 2, H), (-W / 2, 0), (-dw, 0)]
    front += [(-dw * math.cos(a), dh - dw + dw * math.sin(a)) for a in (math.pi * k / 8 for k in range(9))]
    front += [(dw, 0)]
    P.prism(front, D / 2 - t, D / 2, 'sage', axis='x')
    P.prism([(W / 2, 0), (W / 2, H), (0, peak), (-W / 2, H), (-W / 2, 0)], -D / 2, -D / 2 + t, 'sage',
            axis='x')
    for sy in (1, -1):
        P.box((D - 2 * t, t, H), (0, sy * (W / 2 - t / 2), H / 2), 'sage')
        for k in range(4):   # board-and-batten
            P.box((0.025, 0.012, H - 0.02), (-D / 2 + 0.12 + k * (D - 0.24) / 3, sy * (W / 2 + 0.006), H / 2),
                  'sage')
    P.box((D - 2 * t, W - 2 * t, 0.03), (0, 0, 0.015), 'oak_dark')
    # Roof: two slabs with an overhang and a ridge.
    slope = math.atan2(peak - H, W / 2)
    half = math.hypot(W / 2, peak - H) + 0.08
    for sy in (1, -1):
        cy = sy * (half / 2 - 0.02) * math.cos(slope)
        cz = peak - (half / 2 - 0.02) * math.sin(slope) + 0.03
        P.box((D + 0.12, half, 0.035), (0, cy, cz), 'charcoal', bevel=0.006, rot=(-sy * math.degrees(slope), 0, 0))
    P.box((D + 0.14, 0.05, 0.05), (0, 0, peak + 0.045), 'oak', bevel=0.01, rot=(45, 0, 0))
    # Door trim and a name board.
    trim = [(D / 2 + 0.008, -dw - 0.01, 0)] + [(D / 2 + 0.008, (dw + 0.01) * math.cos(math.pi - a),
                                               dh - dw + (dw + 0.01) * math.sin(math.pi - a))
                                              for a in (math.pi * k / 8 for k in range(9))] + [(D / 2 + 0.008, dw + 0.01, 0)]
    P.sweep(trim, (0.012, 0.012), 'white', sides=4)
    P.box((0.015, 0.22, 0.06), (D / 2 + 0.01, 0, dh + 0.07), 'oak', bevel=0.004)
    P.pillow(D - 0.12, W - 0.12, 0.06, center=(0, 0, 0.06), mat='terracotta', boxy=3, nx=5, ny=5)


@prop('toy_basket', 'home', 'Toy basket')
def toy_basket(P):
    r, h = 0.17, 0.2
    prof = [(r * 0.92, 0.0)] + [(r * (0.92 + 0.08 * k / 5), h * k / 5) for k in range(1, 6)] + [(r * 0.95, h),
                                                                                            (0, 0.02)]
    P.lathe(prof, mat='oatmeal', sides=14,
            mats=['oatmeal', 'sand', 'oatmeal', 'sand', 'oatmeal', 'oatmeal', 'oatmeal'], cap_start=True,
            cap_end=False)
    for s in (1, -1):
        P.torus(0.04, 0.008, center=(0, s * r * 1.0, h * 0.85), mat='oak_dark', seg=10, sides=4, axis=(0, 1, 0))
    P.embed(ball_tennis, M((0.06, 0.05, h - 0.03)))
    P.embed(bone_toy, M((-0.03, 0.0, h - 0.01), (60, 0, 30)))
    P.embed(plush_duck, M((0.02, -0.07, h - 0.06), (0, -20, -30)))
    P.embed(rope_tug, M((-0.06, 0.02, h - 0.05), (0, 60, 70)))


@prop('fire_hydrant', 'home', 'Fire hydrant')
def fire_hydrant(P):
    P.lathe([(0.13, 0), (0.13, 0.04), (0.1, 0.05), (0.09, 0.06), (0.09, 0.42), (0.11, 0.43), (0.11, 0.46),
             (0.085, 0.5), (0.04, 0.55), (0, 0.56)], mat='red', sides=10,
            mats=['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'])
    P.cyl(0.025, 0.04, base=(0, 0, 0.54), mat='steel', sides=5)
    for s in (1, -1):
        P.cyl(0.04, 0.07, base=(0, s * 0.08, 0.3), axis=(0, s, 0), mat='red', sides=8)
        P.cyl(0.03, 0.03, base=(0, s * 0.15, 0.3), axis=(0, s, 0), mat='steel', sides=5)
    P.cyl(0.055, 0.06, base=(0.08, 0, 0.27), axis=(1, 0, 0), mat='red', sides=8)
    P.cyl(0.04, 0.03, base=(0.14, 0, 0.27), axis=(1, 0, 0), mat='steel', sides=5)


def leash_strap(P, path, mat='terracotta', w=0.02):
    P.sweep(path, (w / 2, 0.004), mat, profile=[(-1, -1), (1, -1), (1, 1), (-1, 1)])


def leash_clip(P, at, axis=(0, 0, -1)):
    a = Vector(axis).normalized()
    P.torus(0.012, 0.003, center=at, mat='steel', seg=8, sides=4, axis=(0, 1, 0) if abs(a.y) < 0.9 else (1, 0, 0))
    P.cyl(0.006, 0.04, base=Vector(at) + a * 0.012, axis=a, mat='steel', sides=6)
    P.torus(0.01, 0.003, center=Vector(at) + a * 0.06, mat='steel', seg=8, sides=4, axis=(0, 1, 0))


@prop('leash_post', 'home', 'Leash post')
def leash_post(P):
    P.box((0.3, 0.3, 0.03), (0, 0, 0.015), 'stone', bevel=0.008)
    P.box((0.1, 0.1, 0.9), (0, 0, 0.47), 'oak', bevel=0.012)
    P.box((0.13, 0.13, 0.06), (0, 0, 0.95), 'charcoal', bevel=0.01, taper=(0.3, 0.3))
    P.cyl(0.012, 0.03, base=(0.05, 0, 0.78), axis=(1, 0, 0), mat='brass', sides=6)
    P.torus(0.045, 0.007, center=(0.08, 0, 0.74), mat='brass', seg=12, sides=5, axis=(0, 1, 0))
    leash_strap(P, [(0.085, 0, 0.7), (0.1, 0.01, 0.55), (0.11, -0.01, 0.42), (0.1, -0.02, 0.33)])
    leash_clip(P, (0.1, -0.02, 0.31))
    P.socket('leash', (0.08, 0, 0.74))


@prop('leash_hook', 'home', 'Leash hook rack', attach='wall')
def leash_hook(P):
    # Wall rack: origin on the wall at the bottom of the board; +X out of the wall.
    P.box((0.025, 0.5, 0.12), (0.0125, 0, 0.06), 'oak', bevel=0.006)
    for k, y in enumerate((-0.16, 0, 0.16)):
        P.cyl(0.01, 0.07, base=(0.025, y, 0.06), axis=(1, 0, 0.35), mat='brass' if k != 1 else 'oak_dark', sides=6)
    leash_strap(P, [(0.06, 0.16, 0.08)] + [(0.07 + 0.01 * math.sin(a), 0.16 + 0.05 * math.sin(a),
                                            0.08 - 0.25 * (1 - math.cos(a)) / 2)
                                           for a in (math.pi * k / 6 for k in range(1, 13))], 'navy')
    leash_strap(P, [(0.06, -0.16, 0.08), (0.075, -0.165, -0.1), (0.08, -0.15, -0.3)], 'terracotta')
    leash_clip(P, (0.08, -0.15, -0.32))


@prop('leash_coiled', 'home', 'Leash (coiled)')
def leash_coiled(P):
    pts = []
    for k in range(40):
        a = 2 * math.pi * k / 13
        r = 0.09 + 0.004 * k / 3
        pts.append((r * math.cos(a), r * math.sin(a), 0.006 + 0.004 * (k % 13 == 0)))
    leash_strap(P, pts, 'terracotta')
    leash_strap(P, [pts[-1], (0.2, 0.08, 0.006), (0.3, 0.1, 0.006), (0.36, 0.05, 0.006), (0.32, -0.02, 0.006),
                    (0.24, 0.02, 0.006), (0.2, 0.08, 0.008)], 'terracotta')
    leash_clip(P, (pts[0][0], pts[0][1], 0.008), axis=(1, 0, 0))


# ==========================================================================
# Harness add-ons (origin on the harness socket they hang from)

def saddlebag(P, side):
    s = 1 if side == 'L' else -1
    P.box((0.16, 0.05, 0.11), (0, s * 0.03, -0.06), 'mustard', bevel=0.012)
    P.box((0.15, 0.054, 0.04), (0, s * 0.032, -0.018), 'rust', bevel=0.008)        # flap
    P.box((0.03, 0.008, 0.05), (0, s * 0.06, -0.04), 'oak_dark', bevel=0.002)     # strap
    P.cyl(0.006, 0.003, base=(0, s * 0.064, -0.055), axis=(0, s, 0), mat='brass', sides=6)


@prop('saddlebag_L', 'wear', 'Saddlebag (left)', attach='harness.pack_L')
def saddlebag_L(P):
    saddlebag(P, 'L')


@prop('saddlebag_R', 'wear', 'Saddlebag (right)', attach='harness.pack_R')
def saddlebag_R(P):
    saddlebag(P, 'R')


@prop('backpack_mini', 'wear', 'Mini backpack', attach='harness.back')
def backpack_mini(P):
    P.pillow(0.13, 0.11, 0.07, center=(0, 0, 0.035), mat='sage', boxy=4, corner=5, nx=4, ny=4)
    P.box((0.06, 0.1, 0.03), (0.045, 0, 0.04), 'moss', bevel=0.008)
    P.torus(0.02, 0.004, center=(-0.06, 0, 0.06), mat='oak_dark', seg=8, sides=4, axis=(0, 1, 0))


def tag(P, shape, mat):
    """Name tag hanging below a split ring; origin = the ring on the collar."""
    P.torus(0.006, 0.0016, center=(0, 0, -0.006), mat='steel', seg=8, sides=4, axis=(0, 1, 0))
    c = (0.0, 0, -0.024)
    if shape == 'round':
        P.cyl(0.013, 0.003, base=(-0.0015, 0, -0.024), axis=(1, 0, 0), mat=mat, sides=10)
    elif shape == 'heart':
        for s in (1, -1):
            P.cyl(0.008, 0.003, base=(-0.0015, s * 0.0065, -0.02), axis=(1, 0, 0), mat=mat, sides=8)
        P.prism([(-0.0145, -0.022), (0.0145, -0.022), (0, -0.038)], -0.0015, 0.0015, mat, axis='x')
    else:   # bone
        P.box((0.003, 0.02, 0.008), c, mat)
        for sy in (1, -1):
            for sz in (1, -1):
                P.cyl(0.0045, 0.003, base=(-0.0015, sy * 0.011, -0.024 + sz * 0.003), axis=(1, 0, 0), mat=mat,
                      sides=6)


@prop('tag_round', 'wear', 'Tag (round)', attach='collar.tag')
def tag_round(P):
    tag(P, 'round', 'brass')


@prop('tag_bone', 'wear', 'Tag (bone)', attach='collar.tag')
def tag_bone(P):
    tag(P, 'bone', 'steel')


@prop('tag_heart', 'wear', 'Tag (heart)', attach='collar.tag')
def tag_heart(P):
    tag(P, 'heart', 'rose')


# ==========================================================================
# Agility

def striped_bar(P, a, b, r, mats=('white', 'red'), n=6):
    a, b = Vector(a), Vector(b)
    for k in range(n):
        p0 = a.lerp(b, k / n)
        P.cyl(r, (b - a).length / n, base=p0, axis=b - a, mat=mats[k % 2], sides=8)


def upright(P, y, h=0.9, mat='white'):
    P.box((0.05, 0.05, h), (0, y, h / 2), mat, bevel=0.008)
    P.box((0.4, 0.06, 0.03), (0, y, 0.015), mat, bevel=0.008)


@prop('agility_jump', 'agility', 'Bar jump')
def agility_jump(P):
    w = 1.2
    for s in (1, -1):
        upright(P, s * w / 2)
        P.box((0.04, 0.03, 0.03), (0.035, s * (w / 2 - 0.03), 0.4), 'charcoal')
    striped_bar(P, (0.035, -w / 2 + 0.04, 0.43), (0.035, w / 2 - 0.04, 0.43), 0.016, ('white', 'red'))


@prop('agility_tire', 'agility', 'Tire jump')
def agility_tire(P):
    w = 1.2
    for s in (1, -1):
        upright(P, s * w / 2, 1.3, 'mustard')
    P.box((0.05, w, 0.05), (0, 0, 1.28), 'mustard', bevel=0.008)
    c = 0.65
    P.torus(0.3, 0.07, center=(0, 0, c), mat='charcoal', seg=16, sides=6, axis=(1, 0, 0))
    for a in (45, 135, 225, 315):
        d = Vector((0, math.cos(math.radians(a)), math.sin(math.radians(a))))
        p = Vector((0, 0, c)) + d * 0.37
        tgt = Vector((0, math.copysign(w / 2, d.y), 1.28 if d.z > 0 else 0.04)) if d.z > 0 else \
            Vector((0, math.copysign(w / 2, d.y), c - 0.45))
        P.cyl(0.006, (tgt - p).length, base=p, axis=tgt - p, mat='steel', sides=4)


@prop('agility_weave', 'agility', 'Weave poles')
def agility_weave(P):
    n, gap = 6, 0.6
    L = (n - 1) * gap
    P.box((0.06, L + 0.2, 0.025), (0, 0, 0.0125), 'charcoal', bevel=0.006)
    for k in range(n):
        y = -L / 2 + k * gap
        P.box((0.4, 0.05, 0.02), (0, y, 0.01), 'charcoal', bevel=0.005)
        striped_bar(P, (0, y, 0.02), (0, y, 0.95), 0.013, ('white', 'dusty_blue'), n=6)


@prop('agility_tunnel', 'agility', 'Tunnel')
def agility_tunnel(P):
    r, n, sides = 0.3, 14, 10
    arc = math.radians(90)
    Rc = 1.4
    pts = [(Rc * math.sin(arc * k / n) - Rc * math.sin(arc) / 2, Rc * (1 - math.cos(arc * k / n)) - 0.4,
            r + 0.02) for k in range(n + 1)]
    for k in range(n):
        P.sweep(pts[k:k + 2], r * (1.04 if k % 2 == 0 else 1.0), 'dusty_blue@2s' if k % 2 == 0 else 'navy@2s',
                sides=sides, cap=False)
    for k in (0, n):   # ring rims at the ends
        a, b = Vector(pts[max(k - 1, 0)]), Vector(pts[min(k + 1, n)])
        P.torus(r * 1.04, 0.02, center=pts[k], mat='white', seg=sides, sides=4, axis=b - a)


@prop('agility_aframe', 'agility', 'A-frame')
def agility_aframe(P):
    L, w, top = 2.0, 0.9, 1.2
    ang = math.asin(top / L)
    for s in (1, -1):
        cx = s * L / 2 * math.cos(ang)
        P.box((L, w, 0.04), (cx, 0, top / 2), 'mustard', bevel=0.01, rot=(0, s * math.degrees(ang), 0))
        for k in range(1, 8):   # slats
            t = k / 8
            P.box((0.025, w - 0.04, 0.02), (s * L * math.cos(ang) * (1 - t), 0, top * t + 0.03), 'oak',
                  rot=(0, s * math.degrees(ang), 0))
        # Contact zones at the feet.
        P.box((0.45, w + 0.004, 0.044), (s * (L - 0.25) * math.cos(ang), 0, 0.25 * math.sin(ang)), 'red',
              rot=(0, s * math.degrees(ang), 0))


@prop('agility_seesaw', 'agility', 'Seesaw')
def agility_seesaw(P):
    L, tilt = 2.4, 12
    P.prism([(-0.2, 0), (0.2, 0), (0.06, 0.32), (-0.06, 0.32)], -0.3, 0.3, 'charcoal', axis='y')
    P.box((L, 0.3, 0.04), (0, 0, 0.35), 'mustard', bevel=0.01, rot=(0, tilt, 0))
    for s in (1, -1):
        P.box((0.4, 0.304, 0.044), (s * (L / 2 - 0.2) * math.cos(math.radians(tilt)), 0,
                                    0.35 - s * (L / 2 - 0.2) * math.sin(math.radians(tilt))), 'red',
              rot=(0, tilt, 0))


@prop('agility_table', 'agility', 'Pause table')
def agility_table(P):
    P.box((0.9, 0.9, 0.05), (0, 0, 0.4), 'dusty_blue', bevel=0.015)
    splayed_legs(P, 0.9, 0.9, 0.38, 0.06, 0.025, 0.025, splay=0.0, mat='white')


@prop('agility_cone', 'agility', 'Training cone')
def agility_cone(P):
    P.box((0.24, 0.24, 0.025), (0, 0, 0.0125), 'orange', bevel=0.006)
    P.cyl(0.09, 0.3, base=(0, 0, 0.02), r_top=0.015, mat='orange', sides=10)
    P.cyl(0.067, 0.06, base=(0, 0, 0.1), r_top=0.052, mat='white', sides=10, cap=False)


# ==========================================================================
# House: Scandi furniture (light oak, warm whites, muted colour, peg legs)

def sofa(P, seats, fabric, w_seat=0.6, cushion=None):
    """Front +X: seat cushions on a base, arms either side, a full-height back
    panel with the back cushions leaning on it."""
    cushion = cushion or fabric
    D, arm = 0.9, 0.17
    W = seats * w_seat + 2 * arm
    base_z, seat_top = 0.14, 0.32
    for sx in (1, -1):
        for sy in (1, -1):
            leg(P, (sx * (D / 2 - 0.07), sy * (W / 2 - 0.08), base_z),
                (sx * (D / 2 - 0.05), sy * (W / 2 - 0.06), 0), 0.022, 0.015)
    P.box((D, W, seat_top - base_z), (0, 0, (base_z + seat_top) / 2), fabric, bevel=0.025)
    P.box((0.2, W - 0.02, 0.56), (-D / 2 + 0.1, 0, seat_top + 0.24), fabric, bevel=0.035, rot=(0, -5, 0))
    for sy in (1, -1):
        P.box((D, arm, 0.46), (0, sy * (W / 2 - arm / 2), base_z + 0.23), fabric, bevel=0.035)
    sw = (W - 2 * arm) / seats
    for k in range(seats):
        y = -W / 2 + arm + sw * (k + 0.5)
        P.pillow(D - 0.2, sw - 0.01, 0.15, center=(0.1, y, seat_top + 0.06), mat=cushion, boxy=5, corner=7,
                 nx=5, ny=5)
        P.pillow(0.42, sw - 0.02, 0.16, center=(-D / 2 + 0.27, y, seat_top + 0.33), mat=cushion, boxy=4, corner=7,
                 nx=5, ny=5, rot=(0, 78, 0))
    return W, arm


@prop('sofa', 'furniture', 'Sofa')
def sofa_3(P):
    W, arm = sofa(P, 3, 'oatmeal')
    # Throw pillow standing in the right-hand corner against the back cushions.
    P.embed(pillow_square, M((-0.12, W / 2 - arm - 0.2, 0.47), (0, 72, 8), 0.8))


@prop('armchair', 'furniture', 'Armchair')
def armchair(P):
    sofa(P, 1, 'dusty_blue', w_seat=0.62)


@prop('coffee_table', 'furniture', 'Coffee table')
def coffee_table(P):
    R0, z = 0.45, 0.4
    P.lathe([(0, z), (R0 - 0.01, z), (R0, z + 0.012), (R0, z + 0.03), (R0 - 0.01, z + 0.04), (0, z + 0.04)],
            mat='oak', sides=16)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        c, s = math.cos(a), math.sin(a)
        leg(P, (c * 0.27, s * 0.27, z), (c * 0.32, s * 0.32, 0), 0.022, 0.014)


@prop('side_table', 'furniture', 'Side table')
def side_table(P):
    R0, z = 0.22, 0.5
    P.lathe([(0, z), (R0, z), (R0, z + 0.03), (0, z + 0.03)], mat='white', sides=14)
    P.lathe([(0, 0.15), (R0 * 0.8, 0.15), (R0 * 0.8, 0.17), (0, 0.17)], mat='oak', sides=14)
    for k in range(3):
        a = k * 2 * math.pi / 3
        leg(P, (math.cos(a) * 0.14, math.sin(a) * 0.14, z), (math.cos(a) * 0.17, math.sin(a) * 0.17, 0), 0.015,
            0.011)


@prop('dining_table', 'furniture', 'Dining table')
def dining_table(P):
    D, W, z = 0.9, 1.6, 0.72
    P.box((D, W, 0.04), (0, 0, z + 0.02), 'oak', bevel=0.012)
    for sx in (1, -1):
        P.box((0.02, W - 0.3, 0.07), (sx * (D / 2 - 0.08), 0, z - 0.035), 'oak')
    for sy in (1, -1):
        P.box((D - 0.18, 0.02, 0.07), (0, sy * (W / 2 - 0.12), z - 0.035), 'oak')
    splayed_legs(P, D - 0.12, W - 0.2, z, 0.03, 0.03, 0.02, splay=0.03)


def chair(P, wood='oak', seat='oak'):
    S, z = 0.44, 0.45
    P.box((S, S, 0.035), (0, 0, z), seat, bevel=0.01, taper=(1.0, 1.0))
    for sy in (1, -1):
        leg(P, (S / 2 - 0.04, sy * (S / 2 - 0.04), z), (S / 2 - 0.02, sy * (S / 2 - 0.02), 0), 0.017, 0.012,
            mat=wood)
        # Back legs run up into the back posts, raked back.
        P.sweep([(-S / 2 + 0.01, sy * (S / 2 - 0.02), 0), (-S / 2 + 0.04, sy * (S / 2 - 0.04), z),
                 (-S / 2 + 0.0, sy * (S / 2 - 0.05), 0.82)], [0.012, 0.017, 0.013], wood, sides=8)
    rail = [(-S / 2 + 0.0 - 0.03 * math.cos(a), (S / 2 - 0.05) * math.sin(a), 0.8)
            for a in (math.pi * (k / 8 - 0.5) for k in range(9))]
    P.sweep(rail, (0.03, 0.012), wood, sides=4)
    for y in (-0.08, 0, 0.08):
        P.cyl(0.008, 0.3, base=(-S / 2 + 0.035, y, z + 0.02), axis=(-0.12, 0, 1), mat=wood, sides=6)


@prop('dining_chair', 'furniture', 'Dining chair')
def dining_chair(P):
    chair(P)


@prop('dining_chair_sage', 'furniture', 'Dining chair (painted)')
def dining_chair_sage(P):
    chair(P, 'sage', 'white')


@prop('bench', 'furniture', 'Bench')
def bench(P):
    D, W, z = 0.34, 1.3, 0.44
    P.box((D, W, 0.04), (0, 0, z), 'oak', bevel=0.012)
    for sy in (1, -1):
        for sx in (1, -1):
            leg(P, (sx * (D / 2 - 0.05), sy * (W / 2 - 0.12), z), (sx * (D / 2 - 0.02), sy * (W / 2 - 0.08), 0),
                0.02, 0.014)
    P.cyl(0.012, W - 0.2, base=(0, -(W - 0.2) / 2, 0.16), axis=(0, 1, 0), mat='oak', sides=6)


@prop('sideboard', 'furniture', 'Sideboard')
def sideboard(P):
    D, W, H, z0 = 0.42, 1.4, 0.46, 0.2
    P.box((D, W, H), (0, 0, z0 + H / 2), 'white', bevel=0.01)
    P.box((D + 0.02, W + 0.02, 0.03), (0, 0, z0 + H + 0.015), 'oak', bevel=0.008)   # top sits on the body
    for k in range(3):
        y = -W / 3 + k * W / 3
        P.box((0.012, W / 3 - 0.03, H - 0.06), (D / 2 + 0.004, y, z0 + H / 2), 'white' if k != 1 else 'sage',
              bevel=0.004)
        P.box((0.02, 0.06, 0.012), (D / 2 + 0.02, y + (0.1 if k == 0 else -0.1 if k == 2 else 0), z0 + H - 0.07),
              'oak_dark', bevel=0.004)
    splayed_legs(P, D - 0.02, W - 0.08, z0, 0.04, 0.018, 0.012, splay=0.02)


@prop('rug_round', 'furniture', 'Round rug')
def rug_round(P):
    P.lathe([(0, 0.01), (0.35, 0.01), (0.55, 0.01), (0.7, 0.01), (0.8, 0.008), (0.8, 0.0)], mat='oatmeal',
            sides=20, mats=['oatmeal', 'sand', 'oatmeal', 'sand', 'sand'], cap_start=False, cap_end=False)


@prop('rug_runner', 'furniture', 'Striped rug')
def rug_runner(P):
    w, d = 1.2, 1.8
    m = P.mark()
    P.sheet(w, d, 12, 1, lambda x, y: 0.0, center=(0, 0, 0.01), mat='white', thick=0.01)
    P.paint(P.since(m), stripes(0, 0.1, ['white', 'white', 'charcoal', 'white', 'sage'], 0.6))
    for s in (1, -1):
        for k in range(16):
            x = -w / 2 + 0.04 + k * (w - 0.08) / 15
            P.box((0.012, 0.06, 0.003), (x, s * (d / 2 + 0.03), 0.002), 'linen')


@prop('floor_lamp', 'furniture', 'Floor lamp')
def floor_lamp(P):
    top = Vector((0, 0, 1.2))
    for k in range(3):
        a = k * 2 * math.pi / 3 + math.pi / 6
        leg(P, top, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0), 0.016, 0.012)
    P.cyl(0.012, 0.25, base=top, mat='oak', sides=6)
    P.lathe([(0.2, 1.3), (0.17, 1.58)], mat='linen@2s', sides=14, cap_start=False, cap_end=False)
    P.sphere(0.05, (0, 0, 1.42), 'white', subdiv=1)


@prop('plant_pot', 'plants', 'Fiddle-leaf fig')
def plant_pot(P):
    P.lathe([(0.14, 0), (0.17, 0.3), (0.19, 0.31), (0.19, 0.34), (0.16, 0.34), (0.15, 0.31)], mat='terracotta',
            sides=10, cap_end=False)
    P.cyl(0.155, 0.002, base=(0, 0, 0.3), mat='soil', sides=10)
    leaves = [(0, 0.95, 0.0), (72, 0.8, 0.35), (144, 0.9, 0.3), (216, 0.7, 0.4), (288, 0.85, 0.35),
              (30, 0.55, 0.55), (190, 0.6, 0.5), (120, 1.05, 0.15)]
    for k, (az, h, lean) in enumerate(leaves):
        a = math.radians(az)
        d = Vector((math.cos(a) * lean, math.sin(a) * lean, 1)).normalized()
        tip = Vector((0, 0, 0.3)) + d * h
        P.cyl(0.008, h, base=(0, 0, 0.3), axis=d, r_top=0.005, mat='leaf_dark', sides=4)
        vs = P.sphere(1.0, (0, 0, 0), 'leaf' if k % 2 else 'leaf_dark', subdiv=1, scale=(0.13, 0.08, 0.012))
        rot = Vector((1, 0, 0)).rotation_difference(Vector((math.cos(a), math.sin(a), 0.6)).normalized())
        P.transform(vs, Matrix.Translation(tip + Vector((math.cos(a), math.sin(a), 0)) * 0.08) @ rot.to_matrix().to_4x4())


# ==========================================================================
# Plants

def pot(P, r=0.15, h=0.3, mat='terracotta', taper=0.82):
    """Flower pot with a rim and soil; returns the soil height."""
    P.lathe([(r * taper, 0), (r, h), (r * 1.1, h * 1.02), (r * 1.1, h * 1.1), (r * 0.94, h * 1.1),
             (r * 0.9, h * 0.98)], mat=mat, sides=10, cap_end=False)
    P.cyl(r * 0.92, 0.002, base=(0, 0, h * 0.97), mat='soil', sides=10)
    return h * 0.97


def leaf(P, at, direction, size, mat='leaf', up=(0, 0, 1)):
    """Flat faceted leaf (a squashed icosphere) pointing along `direction`."""
    d = Vector(direction).normalized()
    vs = P.sphere(1.0, (0, 0, 0), mat, subdiv=1, scale=(size[0] / 2, size[1] / 2, max(size[1] * 0.08, 0.004)))
    rot = Vector((1, 0, 0)).rotation_difference(d)
    P.transform(vs, Matrix.Translation(Vector(at) + d * size[0] / 2) @ rot.to_matrix().to_4x4())


@prop('plant_monstera', 'plants', 'Monstera')
def plant_monstera(P):
    top = pot(P, 0.17, 0.28, 'white')
    for k, (az, lean, h, s) in enumerate(((0, 0.5, 0.55, 0.32), (70, 0.7, 0.45, 0.3), (140, 0.55, 0.6, 0.34),
                                         (210, 0.75, 0.4, 0.28), (280, 0.6, 0.5, 0.3), (330, 0.3, 0.75, 0.3),
                                         (110, 0.3, 0.8, 0.26))):
        a = math.radians(az)
        out = Vector((math.cos(a), math.sin(a), 0))
        tip = Vector((0, 0, top)) + out * lean * h + Vector((0, 0, h))
        P.sweep([(0, 0, top), (Vector((0, 0, top)) + out * lean * h * 0.3 + Vector((0, 0, h * 0.7)))[:], tip[:]],
                0.007, 'leaf_dark', sides=4)
        leaf(P, tip, out + Vector((0, 0, -0.25)), (s, s * 0.85), 'leaf' if k % 2 else 'leaf_dark')


@prop('plant_snake', 'plants', 'Snake plant')
def plant_snake(P):
    top = pot(P, 0.11, 0.24, 'stone', taper=0.95)
    for k, (az, lean, h) in enumerate(((0, 8, 0.6), (60, 14, 0.5), (130, 6, 0.7), (190, 16, 0.45), (250, 10, 0.62),
                                      (310, 12, 0.55), (95, 4, 0.4))):
        a = math.radians(az)
        x, y = math.cos(a) * 0.04, math.sin(a) * 0.04
        P.box((0.045, 0.012, h), (x, y, top + h / 2), 'leaf_dark' if k % 2 else 'moss', taper=(0.15, 0.6),
              rot=(-lean * math.sin(a), lean * math.cos(a), az))


@prop('plant_olive', 'plants', 'Olive tree')
def plant_olive(P):
    top = pot(P, 0.2, 0.36, 'terracotta')
    P.sweep([(0, 0, top), (0.02, 0.01, top + 0.5), (-0.02, 0, top + 0.95), (0.01, -0.02, top + 1.2)],
            [0.025, 0.02, 0.016, 0.012], 'bark', sides=5)
    for k, (x, y, z, r) in enumerate(((0, 0, 1.45, 0.22), (0.18, 0.06, 1.3, 0.16), (-0.16, -0.05, 1.33, 0.17),
                                      (0.04, -0.17, 1.38, 0.15), (-0.05, 0.16, 1.58, 0.14), (0.12, -0.08, 1.6, 0.12))):
        vs = P.sphere(r, (x, y, top + z - 0.36), 'olive' if k % 2 else 'sage', subdiv=1)
        P.jitter(vs, r * 0.15, seed=k + 3)


@prop('plant_cactus', 'plants', 'Cactus')
def plant_cactus(P):
    top = pot(P, 0.08, 0.14, 'mustard')
    P.cyl(0.04, 0.32, base=(0, 0, top), mat='cactus', sides=8)
    P.sphere(0.04, (0, 0, top + 0.32), 'cactus', subdiv=1, scale=(1, 1, 0.7))
    for s, h, l in ((1, 0.12, 0.08), (-1, 0.18, 0.1)):
        P.cyl(0.024, 0.05, base=(0, s * 0.03, top + h), axis=(0, s, 0), mat='cactus', sides=6)
        P.cyl(0.024, l, base=(0, s * 0.075, top + h), mat='cactus', sides=6)
        P.sphere(0.024, (0, s * 0.075, top + h + l), 'cactus', subdiv=1)
    P.sphere(0.012, (0, 0, top + 0.37), 'rose', subdiv=1)


@prop('plant_succulent', 'plants', 'Succulent bowl')
def plant_succulent(P):
    P.lathe([(0.06, 0), (0.09, 0.05), (0.085, 0.055), (0, 0.045)], mat='white', sides=10, cap_end=True)
    for c, (cx, cy) in enumerate(((0.03, 0.0), (-0.03, 0.03), (-0.02, -0.035))):
        for ring, (n, r, z, tilt) in enumerate(((6, 0.03, 0.05, 50), (5, 0.018, 0.06, 25))):
            for k in range(n):
                a = 2 * math.pi * (k + ring * 0.5) / n
                d = Vector((math.cos(a) * math.cos(math.radians(tilt)), math.sin(a) * math.cos(math.radians(tilt)),
                            math.sin(math.radians(tilt))))
                P.cyl(0.009, r, base=(cx, cy, z), axis=d, r_top=0.002, mat='sage' if c % 2 else 'olive', sides=4)


@prop('plant_trailing', 'plants', 'Trailing pothos')
def plant_trailing(P):
    top = pot(P, 0.09, 0.14, 'oatmeal', taper=0.9)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.3
        out = Vector((math.cos(a), math.sin(a), 0))
        drop = 0.15 + 0.12 * (k % 3)
        path = [Vector((0, 0, top)) + out * 0.02, Vector((0, 0, top + 0.06)) + out * 0.08,
                Vector((0, 0, top + 0.02)) + out * 0.13, Vector((0, 0, top - drop)) + out * 0.15]
        P.sweep(path, 0.003, 'leaf_dark', sides=3)
        for i, (pa, pb) in enumerate(zip(path, path[1:])):
            for t in (0.3, 0.8):
                at = pa.lerp(pb, t)
                leaf(P, at, out + Vector((0, 0, -0.3 if i == 2 else 0.2)) + (pb - pa).normalized() * 0.3,
                     (0.045, 0.035), 'leaf' if (i + k) % 2 else 'leaf_dark')


# ==========================================================================
# Bedroom (beds: +X is the foot end, the headboard is at -X)

def bed(P, W, L=2.05, duvet='white', throw='sage'):
    z0, frame_h = 0.12, 0.2
    for sy in (1, -1):
        P.box((L, 0.05, frame_h), (0, sy * (W / 2 - 0.025), z0 + frame_h / 2), 'oak', bevel=0.008)
    P.box((0.05, W, frame_h), (L / 2 - 0.025, 0, z0 + frame_h / 2), 'oak', bevel=0.008)
    P.box((0.06, W + 0.04, 1.0), (-L / 2 - 0.03, 0, 0.5), 'oak', bevel=0.02)          # headboard
    for sx in (1, -1):
        for sy in (1, -1):
            leg(P, (sx * (L / 2 - 0.06), sy * (W / 2 - 0.06), z0), (sx * (L / 2 - 0.05), sy * (W / 2 - 0.05), 0),
                0.022, 0.017)
    mz = z0 + frame_h - 0.04
    P.pillow(L - 0.08, W - 0.08, 0.22, center=(0, 0, mz + 0.11), mat='white', boxy=8, corner=10, nx=5, ny=5)
    top = mz + 0.22
    # Duvet over the lower two thirds, draping over the sides and foot.
    dl, dw = L * 0.72, W + 0.1

    def drape(x, y):
        over = max(0.0, abs(y) - (W / 2 - 0.06)) * 3.0 + max(0.0, x - (dl / 2 - 0.08)) * 3.0
        return -min(over, 0.22) + 0.02 * math.sin(x * 9 + y * 4)
    P.sheet(dl, dw, 8, 10, drape, center=(L / 2 - dl / 2 + 0.03, 0, top + 0.035), mat=duvet + '@2s', thick=0.04)
    P.cyl(0.035, dw - 0.04, base=(L / 2 - dl + 0.03, -(dw - 0.04) / 2, top + 0.035), axis=(0, 1, 0), mat=duvet,
          sides=6)                                                                   # folded-back top edge
    m = P.mark()
    P.sheet(0.5, dw + 0.02, 3, 10, lambda x, y: drape(x + dl / 2 - 0.25, y) + 0.01,
            center=(L / 2 - 0.25 + 0.04, 0, top + 0.05), mat=throw + '@2s', thick=0.012)
    P.paint(P.since(m), stripes(0, 0.08, [throw + '@2s', 'white@2s'], 0.2))
    n = 2 if W > 1.2 else 1
    for k in range(n):
        y = (k - (n - 1) / 2) * (W / n)
        P.pillow(0.16, W / n - 0.08, 0.38, center=(-L / 2 + 0.16, y, top + 0.17), mat='linen', boxy=3, corner=6,
                 nx=4, ny=5, rot=(0, -20, 0))


@prop('bed_double', 'bedroom', 'Double bed')
def bed_double(P):
    bed(P, 1.6)


@prop('bed_single', 'bedroom', 'Single bed')
def bed_single(P):
    bed(P, 0.95, duvet='dusty_blue', throw='mustard')


@prop('nightstand', 'bedroom', 'Nightstand')
def nightstand(P):
    D, W, z0, H = 0.38, 0.42, 0.18, 0.34
    P.box((D, W, H), (0, 0, z0 + H / 2), 'oak', bevel=0.008)
    P.box((0.01, W - 0.04, H * 0.45), (D / 2 + 0.003, 0, z0 + H * 0.72), 'white', bevel=0.003)   # drawer
    P.sphere(0.012, (D / 2 + 0.015, 0, z0 + H * 0.72), 'oak_dark', subdiv=1)
    P.box((0.012, W - 0.04, H * 0.42), (D / 2 - 0.004, 0, z0 + H * 0.26), 'oak_dark')            # open shelf
    splayed_legs(P, D - 0.02, W - 0.02, z0, 0.03, 0.015, 0.011, splay=0.015)


@prop('table_lamp', 'bedroom', 'Table lamp')
def table_lamp(P):
    P.lathe([(0.07, 0), (0.07, 0.02), (0.02, 0.03), (0.015, 0.25), (0, 0.25)], mat='terracotta', sides=10)
    P.lathe([(0.14, 0.2), (0.1, 0.38)], mat='linen@2s', sides=12, cap_start=False, cap_end=False)
    P.sphere(0.035, (0, 0, 0.27), 'white', subdiv=1)


@prop('wardrobe', 'bedroom', 'Wardrobe')
def wardrobe(P):
    D, W, H, z0 = 0.58, 1.0, 1.9, 0.12
    P.box((D, W, H), (0, 0, z0 + H / 2), 'white', bevel=0.012)
    for sy in (1, -1):
        P.box((0.012, W / 2 - 0.015, H - 0.03), (D / 2 + 0.004, sy * W / 4, z0 + H / 2), 'white', bevel=0.004)
        P.box((0.025, 0.02, 0.25), (D / 2 + 0.02, sy * 0.04, z0 + H * 0.55), 'oak', bevel=0.005)
    P.box((D - 0.04, W - 0.04, z0), (0, 0, z0 / 2), 'oak')
    P.box((D + 0.02, W + 0.02, 0.025), (0, 0, z0 + H + 0.012), 'oak', bevel=0.006)


@prop('dresser', 'bedroom', 'Chest of drawers')
def dresser(P):
    D, W, H, z0 = 0.45, 0.9, 0.62, 0.18
    P.box((D, W, H), (0, 0, z0 + H / 2), 'oak', bevel=0.01)
    for k in range(3):
        z = z0 + H * (k + 0.5) / 3
        P.box((0.012, W - 0.04, H / 3 - 0.025), (D / 2 + 0.003, 0, z), 'white' if k != 1 else 'dusty_blue', bevel=0.003)
        for sy in (1, -1):
            P.sphere(0.013, (D / 2 + 0.017, sy * W * 0.25, z), 'oak_dark', subdiv=1)
    splayed_legs(P, D - 0.02, W - 0.04, z0, 0.03, 0.017, 0.012, splay=0.015)


@prop('desk', 'bedroom', 'Desk')
def desk(P):
    D, W, z = 0.6, 1.2, 0.72
    P.box((D, W, 0.03), (0, 0, z + 0.015), 'oak', bevel=0.008)
    P.box((D - 0.06, 0.4, 0.1), (0, W / 2 - 0.25, z - 0.05), 'white', bevel=0.005)    # drawer box
    P.box((0.02, 0.06, 0.012), (D / 2 - 0.02, W / 2 - 0.25, z - 0.05), 'oak_dark')
    splayed_legs(P, D - 0.04, W - 0.04, z, 0.03, 0.02, 0.014, splay=0.03)
    P.embed(table_lamp, M((-0.18, -0.42, z + 0.03)))
    P.box((0.2, 0.28, 0.012), (0.05, -0.05, z + 0.036), 'white', rot=(0, 0, 8))      # notebook


@prop('mirror_floor', 'bedroom', 'Leaning mirror')
def mirror_floor(P):
    lean = 8
    P.box((0.03, 0.55, 1.6), (0, 0, 0.8), 'oak', bevel=0.008, rot=(0, -lean, 0))
    P.box((0.01, 0.47, 1.52), (0.018, 0, 0.8), 'glass', rot=(0, -lean, 0))
    # pull the bottom forward so it leans on the wall behind it
    P.transform([v for v in P.bm.verts], Matrix.Translation((0.11, 0, 0)))


# ==========================================================================
# Kitchen: 0.6 m modules, 0.62 deep, worktop at 0.9 m. +X is the front.

def base_unit(P, doors='sage', drawers=0):
    D, W, z0, top = 0.6, 0.6, 0.1, 0.87
    P.box((D - 0.06, W, z0), (-0.03, 0, z0 / 2), 'charcoal')                        # recessed plinth
    P.box((D - 0.02, W - 0.004, top - z0), (-0.01, 0, (z0 + top) / 2), 'white')
    P.box((D + 0.02, W, 0.03), (0, 0, top + 0.015), 'oak', bevel=0.004)             # worktop
    if drawers:
        for k in range(drawers):
            h = (top - z0) / drawers
            z = z0 + h * (k + 0.5)
            P.box((0.016, W - 0.01, h - 0.008), (D / 2 - 0.012, 0, z), doors, bevel=0.003)
            P.box((0.02, 0.22, 0.016), (D / 2 + 0.006, 0, z + h * 0.3), 'oak_dark', bevel=0.004)
    else:
        P.box((0.016, W - 0.01, top - z0 - 0.01), (D / 2 - 0.012, 0, (z0 + top) / 2), doors, bevel=0.003)
        P.box((0.02, 0.016, 0.2), (D / 2 + 0.006, -W / 2 + 0.07, top - 0.16), 'oak_dark', bevel=0.004)


@prop('kitchen_base', 'kitchen', 'Kitchen cabinet')
def kitchen_base(P):
    base_unit(P)


@prop('kitchen_drawers', 'kitchen', 'Kitchen drawers')
def kitchen_drawers(P):
    base_unit(P, drawers=3)


@prop('kitchen_sink', 'kitchen', 'Kitchen sink')
def kitchen_sink(P):
    base_unit(P)
    P.box((0.42, 0.46, 0.006), (0.02, 0, 0.902), 'steel')
    P.box((0.34, 0.38, 0.004), (0.02, 0, 0.906), 'grey')                            # basin (reads as a recess)
    P.cyl(0.014, 0.25, base=(-0.24, 0, 0.9), mat='steel', sides=6)
    P.sweep([(-0.24, 0, 1.15), (-0.2, 0, 1.2), (-0.12, 0, 1.18), (-0.1, 0, 1.12)], 0.011, 'steel', sides=6)
    P.cyl(0.008, 0.06, base=(-0.24, 0.06, 0.95), axis=(1, 0, 0.4), mat='steel', sides=5)


@prop('kitchen_stove', 'kitchen', 'Stove & oven')
def kitchen_stove(P):
    D, W, z0, top = 0.6, 0.6, 0.1, 0.87
    P.box((D - 0.06, W, z0), (-0.03, 0, z0 / 2), 'charcoal')
    P.box((D - 0.02, W - 0.004, top - z0), (-0.01, 0, (z0 + top) / 2), 'white', bevel=0.004)
    P.box((0.015, W - 0.06, 0.48), (D / 2 - 0.005, 0, 0.42), 'charcoal', bevel=0.004)  # oven door
    P.box((0.01, W - 0.2, 0.22), (D / 2 + 0.003, 0, 0.44), 'screen')
    P.cyl(0.01, W - 0.14, base=(D / 2 + 0.03, -(W - 0.14) / 2, 0.62), axis=(0, 1, 0), mat='steel', sides=6)
    for k in range(4):
        P.cyl(0.014, 0.02, base=(D / 2, -0.21 + k * 0.14, 0.78), axis=(1, 0, 0), mat='steel', sides=8)
    P.box((D + 0.02, W, 0.03), (0, 0, top + 0.015), 'charcoal', bevel=0.004)         # hob
    for x, y, r in ((0.12, 0.14, 0.08), (0.12, -0.14, 0.06), (-0.14, 0.14, 0.06), (-0.14, -0.14, 0.08)):
        P.torus(r, 0.006, center=(x, y, top + 0.032), mat='grey', seg=12, sides=4)
    P.lathe([(0.1, 0), (0.1, 0.09), (0.095, 0.09), (0, 0.01)], base=(0.12, 0.14, top + 0.03), mat='steel', sides=10,
            cap_end=False)                                                            # a pot on the hob
    P.cyl(0.01, 0.12, base=(0.12, 0.24, top + 0.1), axis=(0, 1, 0), mat='charcoal', sides=5)


@prop('fridge', 'kitchen', 'Fridge')
def fridge(P):
    D, W, H = 0.62, 0.6, 1.85
    P.box((D, W, H), (0, 0, H / 2), 'white', bevel=0.02)
    P.box((0.012, W - 0.02, 0.006), (D / 2 + 0.002, 0, 1.2), 'grey')                 # door gap
    for z, h in ((1.4, 0.3), (0.85, 0.4)):
        P.box((0.025, 0.02, h), (D / 2 + 0.02, -W / 2 + 0.06, z), 'steel', bevel=0.005)
    P.box((0.005, 0.1, 0.13), (D / 2 + 0.003, 0.1, 1.5), 'mustard', rot=(5, 0, 0))   # a drawing on the door
    P.sphere(0.012, (D / 2 + 0.008, 0.1, 1.56), 'red', subdiv=1)


@prop('kitchen_wall_cabinet', 'kitchen', 'Wall cabinet')
def kitchen_wall_cabinet(P):
    D, W, z0, H = 0.34, 0.6, 1.45, 0.7
    P.box((D, W, H), (-0.62 / 2 + D / 2, 0, z0 + H / 2), 'white', bevel=0.006)
    P.box((0.016, W - 0.01, H - 0.01), (-0.31 + D + 0.006, 0, z0 + H / 2), 'white', bevel=0.003)
    P.box((0.02, 0.016, 0.16), (-0.31 + D + 0.02, -W / 2 + 0.07, z0 + 0.12), 'oak_dark', bevel=0.004)


@prop('kitchen_shelf', 'kitchen', 'Open shelf')
def kitchen_shelf(P):
    z = 1.5
    P.box((0.25, 0.9, 0.03), (-0.31 + 0.125, 0, z), 'oak', bevel=0.005)
    for y in (-0.38, 0.38):
        P.box((0.15, 0.025, 0.12), (-0.31 + 0.075, y, z - 0.075), 'oak_dark')
    for k, (y, mat) in enumerate(((-0.3, 'white'), (-0.2, 'sage'), (-0.1, 'white'))):
        mug(P, (-0.2, y, z + 0.015), mat)
    for y, h, mat in ((0.1, 0.16, 'glass'), (0.2, 0.2, 'glass'), (0.3, 0.13, 'glass')):
        P.lathe([(0.04, 0), (0.04, h), (0, h)], base=(-0.2, y, z + 0.015), mat=mat, sides=8)
        P.cyl(0.042, 0.02, base=(-0.2, y, z + 0.015 + h), mat='oak', sides=8)


def mug(P, at, mat='white'):
    P.lathe([(0.035, 0), (0.038, 0.09), (0.03, 0.09), (0.03, 0.01), (0, 0.01)], base=at, mat=mat, sides=8,
            cap_end=False)
    P.torus(0.022, 0.006, center=Vector(at) + Vector((0, 0.045, 0.05)), mat=mat, seg=6, sides=4, axis=(1, 0, 0))


@prop('mugs', 'kitchen', 'Mugs')
def mugs(P):
    mug(P, (0, -0.05, 0), 'white')
    mug(P, (0.03, 0.06, 0), 'terracotta')


@prop('kettle', 'kitchen', 'Kettle')
def kettle(P):
    P.lathe([(0.08, 0), (0.09, 0.04), (0.085, 0.14), (0.05, 0.19), (0.02, 0.2), (0, 0.2)], mat='white', sides=10)
    P.sphere(0.018, (0, 0, 0.21), 'oak', subdiv=1)
    P.sweep([(-0.05, 0, 0.18), (-0.1, 0, 0.2), (-0.13, 0, 0.12), (-0.09, 0, 0.06)], 0.012, 'oak', sides=5)
    P.cyl(0.018, 0.09, base=(0.07, 0, 0.08), axis=(1, 0, 0.9), r_top=0.009, mat='white', sides=6)


@prop('fruit_bowl', 'kitchen', 'Fruit bowl')
def fruit_bowl(P):
    P.lathe([(0.07, 0), (0.15, 0.07), (0.14, 0.075), (0.065, 0.012), (0, 0.012)], mat='oak', sides=12,
            cap_end=False)
    for k, (x, y, z, r, mat) in enumerate(((0.04, 0.03, 0.06, 0.04, 'orange'), (-0.05, 0.02, 0.06, 0.042, 'red'),
                                           (0.0, -0.06, 0.055, 0.04, 'yellow'), (0.0, 0.0, 0.11, 0.04, 'orange'),
                                           (0.06, -0.05, 0.08, 0.035, 'leaf'))):
        P.sphere(r, (x, y, z), mat, subdiv=1)


@prop('bar_stool', 'kitchen', 'Stool')
def bar_stool(P):
    z = 0.62
    P.lathe([(0, z), (0.17, z), (0.17, z + 0.035), (0, z + 0.035)], mat='oak', sides=12)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        leg(P, (math.cos(a) * 0.11, math.sin(a) * 0.11, z), (math.cos(a) * 0.19, math.sin(a) * 0.19, 0), 0.016,
            0.013)
    P.torus(0.16, 0.009, center=(0, 0, 0.24), mat='oak_dark', seg=12, sides=4)


# ==========================================================================
# Bathroom

@prop('bathtub', 'bathroom', 'Bathtub')
def bathtub(P):
    D, W, H, t = 0.75, 1.7, 0.56, 0.08   # D along x (front +X), W along the wall (y)
    P.box((D - 2 * t, W - 2 * t, 0.06), (0, 0, 0.03), 'porcelain')
    for sx in (1, -1):
        P.box((t, W, H), (sx * (D / 2 - t / 2), 0, H / 2), 'porcelain', bevel=0.03)
    for sy in (1, -1):
        P.box((D - 2 * t + 0.02, t, H), (0, sy * (W / 2 - t / 2), H / 2), 'porcelain', bevel=0.03)
    P.box((D - 2 * t, W - 2 * t, 0.004), (0, 0, H * 0.62), 'water')                   # bath water
    P.cyl(0.016, 0.14, base=(0, -W / 2 + t / 2, H), mat='steel', sides=6)
    P.sweep([(0, -W / 2 + t / 2, H + 0.14), (0, -W / 2 + 0.12, H + 0.15), (0, -W / 2 + 0.16, H + 0.1)], 0.012,
            'steel', sides=6)
    for k, y in enumerate((0.1, 0.18, 0.05)):   # bubbles
        P.sphere(0.04 - k * 0.01, (0.05 * (k - 1), y, H * 0.63), 'white', subdiv=1, scale=(1, 1, 0.6))


@prop('toilet', 'bathroom', 'Toilet')
def toilet(P):
    vs = P.lathe([(0.11, 0), (0.12, 0.2), (0.19, 0.38), (0.19, 0.4), (0, 0.4)], mat='porcelain', sides=12)
    for v in vs:
        v.co.x *= 1.25
    P.transform(vs, Matrix.Translation((0.05, 0, 0)))
    P.box((0.17, 0.4, 0.38), (-0.2, 0, 0.6), 'porcelain', bevel=0.02)
    seat = P.torus(0.15, 0.025, center=(0, 0, 0), mat='white', seg=12, sides=4)
    P.transform(seat, Matrix.Translation((0.07, 0, 0.42)) @ Matrix.Diagonal((1.3, 1.0, 0.6, 1)))
    P.cyl(0.02, 0.012, base=(-0.2, 0, 0.79), mat='steel', sides=8)


@prop('bath_vanity', 'bathroom', 'Vanity & basin')
def bath_vanity(P):
    D, W, z0, H = 0.46, 0.8, 0.3, 0.5
    P.box((D, W, H), (0, 0, z0 + H / 2), 'oak', bevel=0.008)
    P.box((0.01, W - 0.03, 0.006), (D / 2 + 0.002, 0, z0 + H / 2), 'oak_dark')
    P.box((0.02, 0.2, 0.012), (D / 2 + 0.01, 0, z0 + H * 0.75), 'oak_dark')
    P.lathe([(0.12, 0), (0.2, 0.13), (0.19, 0.135), (0.11, 0.02), (0, 0.02)], base=(0.02, 0, z0 + H), mat='porcelain',
            sides=12, cap_end=False)
    P.cyl(0.012, 0.2, base=(-0.18, 0, z0 + H), mat='steel', sides=6)
    P.sweep([(-0.18, 0, z0 + H + 0.2), (-0.12, 0, z0 + H + 0.22), (-0.08, 0, z0 + H + 0.18)], 0.01, 'steel', sides=5)
    # Wall cabinet legs: the unit hangs on the wall, so just two slim supports.
    for sy in (1, -1):
        P.box((0.03, 0.03, z0), (-D / 2 + 0.03, sy * (W / 2 - 0.04), z0 / 2), 'oak_dark')


@prop('mirror_round', 'bathroom', 'Round mirror')
def mirror_round(P):
    P.cyl(0.3, 0.025, base=(-0.31 + 0.012, 0, 1.55), axis=(1, 0, 0), mat='oak', sides=16)
    P.cyl(0.27, 0.01, base=(-0.31 + 0.03, 0, 1.55), axis=(1, 0, 0), mat='glass', sides=16)


@prop('towel_ladder', 'bathroom', 'Towel ladder')
def towel_ladder(P):
    lean = 12
    vs = []
    for sy in (1, -1):
        vs += P.box((0.035, 0.035, 1.6), (0, sy * 0.22, 0.8), 'oak', bevel=0.006)
    for k in range(5):
        vs += P.cyl(0.012, 0.44, base=(0, -0.22, 0.3 + k * 0.3), axis=(0, 1, 0), mat='oak', sides=6)
    for k, mat in ((2, 'white'), (3, 'terracotta')):
        z = 0.3 + k * 0.3
        vs += P.box((0.012, 0.3, 0.28), (0.02, 0.0, z - 0.13), mat + '@2s', bevel=0.003)
        vs += P.box((0.012, 0.3, 0.2), (-0.02, 0.0, z - 0.09), mat + '@2s', bevel=0.003)
        vs += P.cyl(0.02, 0.3, base=(0, -0.15, z), axis=(0, 1, 0), mat=mat, sides=6)
    P.transform(vs, Matrix.Translation((0.14, 0, 0)) @ R(0, -lean, 0).to_matrix().to_4x4())


@prop('bath_mat', 'bathroom', 'Bath mat')
def bath_mat(P):
    m = P.mark()
    P.pillow(0.5, 0.8, 0.02, center=(0, 0, 0.01), mat='sage', boxy=8, corner=4, nx=5, ny=8)
    P.paint(P.since(m), stripes(1, 0.1, ['sage', 'white'], 0.4))


@prop('laundry_basket', 'bathroom', 'Laundry basket')
def laundry_basket(P):
    r, h = 0.2, 0.5
    P.lathe([(r * 0.9, 0)] + [(r * (0.9 + 0.1 * k / 5), h * k / 5) for k in range(1, 6)] + [(r * 0.96, h), (0, 0.02)],
            mat='oatmeal', sides=12, mats=['oatmeal', 'sand'] * 3 + ['oatmeal'], cap_end=False)
    P.sheet(0.35, 0.3, 4, 4, lambda x, y: -0.15 * max(0.0, x) ** 0.5 + 0.02 * math.sin(y * 20),
            center=(0.12, 0.03, h + 0.01), mat='white@2s', thick=0.01)


# ==========================================================================
# Living room extras

def books(P, x, y0, y1, z, depth=0.2, seed=1, lean_last=True):
    """A row of books standing on a shelf at height z, from y0 to y1."""
    mats = ['terracotta', 'sage', 'navy', 'mustard', 'white', 'dusty_blue', 'rust', 'linen']
    s, y = seed, y0
    while y < y1 - 0.03:
        s = (s * 16807) % 2147483647
        t = 0.02 + (s % 100) / 100 * 0.025
        h = 0.18 + ((s >> 7) % 100) / 100 * 0.1
        if y + t > y1:
            break
        P.box((depth * (0.85 + ((s >> 3) % 10) / 70), t, h), (x, y + t / 2, z + h / 2), mats[s % len(mats)])
        y += t + 0.002


@prop('bookshelf', 'living', 'Bookshelf')
def bookshelf(P):
    D, W, H = 0.32, 0.9, 1.8
    for sy in (1, -1):
        P.box((D, 0.025, H), (0, sy * (W / 2 - 0.0125), H / 2), 'oak', bevel=0.004)
    P.box((0.012, W, H), (-D / 2 + 0.006, 0, H / 2), 'white')
    for k, z in enumerate((0.05, 0.42, 0.79, 1.16, 1.53, 1.78)):
        P.box((D, W - 0.05, 0.025), (0, 0, z), 'oak', bevel=0.004)
        if k < 5:
            if k == 2:
                books(P, 0, -W / 2 + 0.04, 0.05, z + 0.012, seed=k + 5)
                P.embed(plant_succulent, M((0.0, 0.25, z + 0.012)))
            elif k == 4:
                books(P, 0, 0.0, W / 2 - 0.04, z + 0.012, seed=k + 5)
                P.lathe([(0.05, 0), (0.06, 0.12), (0.03, 0.2), (0.035, 0.22), (0, 0.22)],
                        base=(0, -0.25, z + 0.012), mat='rust', sides=8)
            else:
                books(P, 0, -W / 2 + 0.04, W / 2 - 0.04, z + 0.012, seed=k + 5)


@prop('tv_stand', 'living', 'TV & stand')
def tv_stand(P):
    D, W, z0, H = 0.42, 1.5, 0.15, 0.4
    P.box((D, W, H), (0, 0, z0 + H / 2), 'oak', bevel=0.01)
    for y in (-0.5, 0, 0.5):
        P.box((0.012, 0.46, H - 0.06), (D / 2 + 0.002, y, z0 + H / 2), 'white' if y else 'sage', bevel=0.003)
    splayed_legs(P, D - 0.02, W - 0.06, z0, 0.04, 0.018, 0.013, splay=0.02)
    top = z0 + H
    P.box((0.12, 0.3, 0.02), (-0.05, 0, top + 0.01), 'charcoal')
    P.box((0.03, 0.06, 0.08), (-0.05, 0, top + 0.06), 'charcoal')
    P.box((0.04, 1.1, 0.64), (-0.05, 0, top + 0.42), 'charcoal', bevel=0.008)
    P.box((0.005, 1.06, 0.6), (-0.028, 0, top + 0.42), 'screen')
    P.embed(plant_succulent, M((0.05, -0.62, top)))
    books(P, 0.0, 0.5, 0.7, top, depth=0.25, seed=3)


@prop('wall_shelf', 'living', 'Wall shelf')
def wall_shelf(P):
    z = 1.45
    P.box((0.22, 0.8, 0.03), (-0.31 + 0.11, 0, z), 'oak', bevel=0.005)
    books(P, -0.2, -0.36, -0.05, z + 0.015, depth=0.17, seed=9)
    P.embed(plant_trailing, M((-0.2, 0.22, z + 0.015)))


@prop('pouf', 'living', 'Knitted pouf')
def pouf(P):
    m = P.mark()
    P.lathe([(0, 0), (0.22, 0.0), (0.27, 0.08), (0.28, 0.2), (0.25, 0.32), (0.18, 0.37), (0, 0.38)], mat='mustard',
            sides=14)
    P.paint(P.since(m), lambda c: 'mustard' if int(math.atan2(c.y, c.x) / (2 * math.pi) * 14 + 14) % 2 else 'orange')


@prop('floor_cushion', 'living', 'Floor cushion')
def floor_cushion(P):
    P.pillow(0.6, 0.6, 0.14, center=(0, 0, 0.07), mat='dusty_blue', boxy=3, corner=6, nx=6, ny=6)
    P.sphere(0.015, (0, 0, 0.142), 'navy', subdiv=1)


@prop('pendant_lamp', 'living', 'Pendant lamp')
def pendant_lamp(P):
    ceiling = 2.6
    P.cyl(0.05, 0.02, base=(0, 0, ceiling - 0.02), mat='white', sides=8)
    P.cyl(0.004, 0.8, base=(0, 0, ceiling - 0.82), mat='charcoal', sides=4)
    P.lathe([(0.04, ceiling - 0.82), (0.08, ceiling - 0.86), (0.22, ceiling - 1.02), (0.22, ceiling - 1.04)],
            mat='sage@2s', sides=14, cap_start=True, cap_end=False)
    P.sphere(0.05, (0, 0, ceiling - 0.99), 'white', subdiv=1)


@prop('picture_frame', 'living', 'Framed print')
def picture_frame(P):
    x, z, w, h = -0.31 + 0.015, 1.5, 0.7, 0.5
    P.box((0.03, w, h), (x, 0, z), 'oak', bevel=0.005)
    P.box((0.006, w - 0.06, h - 0.06), (x + 0.016, 0, z), 'linen')
    P.cyl(0.11, 0.004, base=(x + 0.019, -0.12, z + 0.04), axis=(1, 0, 0), mat='terracotta', sides=12)
    P.box((0.004, 0.2, 0.18), (x + 0.02, 0.1, z - 0.07), 'sage')
    P.cyl(0.1, 0.004, base=(x + 0.02, 0.1, z + 0.02), axis=(1, 0, 0), mat='sage', sides=12)


@prop('vase_flowers', 'living', 'Vase & flowers')
def vase_flowers(P):
    P.lathe([(0.05, 0), (0.07, 0.08), (0.04, 0.18), (0.035, 0.2), (0.045, 0.22), (0, 0.22)], mat='dusty_blue',
            sides=10)
    for k, (az, h, mat) in enumerate(((0, 0.42, 'white'), (90, 0.38, 'blush'), (180, 0.45, 'mustard'),
                                      (270, 0.36, 'white'), (45, 0.5, 'leaf'))):
        a = math.radians(az)
        tip = Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, h))
        P.sweep([(0, 0, 0.18), tip[:]], 0.004, 'leaf_dark', sides=3)
        P.sphere(0.03 if mat != 'leaf' else 0.02, tip, mat, subdiv=1)


# ==========================================================================
# Hallway

@prop('shoe_bench', 'hall', 'Shoe bench')
def shoe_bench(P):
    D, W, z = 0.34, 1.0, 0.45
    P.box((D, W, 0.035), (0, 0, z), 'oak', bevel=0.008)
    P.box((D - 0.04, W - 0.06, 0.02), (0, 0, 0.12), 'oak')
    splayed_legs(P, D - 0.02, W - 0.04, z, 0.03, 0.02, 0.016, splay=0.0)
    for y, mat in ((-0.3, 'rust'), (-0.08, 'navy'), (0.25, 'white')):
        for dy in (-0.045, 0.045):
            P.sphere(0.05, (0.0, y + dy, 0.16), mat, subdiv=1, scale=(2.2, 0.8, 0.6))
            P.box((0.22, 0.07, 0.012), (0.0, y + dy, 0.134), 'charcoal')
    P.pillow(D - 0.04, 0.45, 0.06, center=(0, 0.2, z + 0.045), mat='sage', boxy=4, nx=4, ny=4)


@prop('coat_rack', 'hall', 'Coat stand')
def coat_rack(P):
    for k in range(3):
        a = k * 2 * math.pi / 3
        leg(P, (0, 0, 0.35), (math.cos(a) * 0.25, math.sin(a) * 0.25, 0), 0.016, 0.012)
    P.cyl(0.02, 1.4, base=(0, 0, 0.3), r_top=0.016, mat='oak', sides=8)
    P.sphere(0.03, (0, 0, 1.72), 'oak', subdiv=1)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        P.cyl(0.01, 0.12, base=(0, 0, 1.6), axis=(math.cos(a), math.sin(a), 0.6), mat='oak_dark', sides=5)
    # A coat and a scarf hanging off the hooks.
    P.cyl(0.18, 0.75, base=(0.13, 0.0, 0.85), r_top=0.07, mat='mustard', sides=8)
    P.box((0.04, 0.12, 0.55), (0.0, 0.1, 1.35), 'terracotta', bevel=0.01, rot=(10, 0, 30))


@prop('door_mat', 'hall', 'Door mat')
def door_mat(P):
    m = P.mark()
    P.pillow(0.5, 0.8, 0.025, center=(0, 0, 0.0125), mat='coir', boxy=10, corner=12, nx=5, ny=8)
    P.paint(P.since(m), lambda c: 'charcoal' if abs(c.x) > 0.14 or abs(c.y) > 0.28 else None)


# ==========================================================================
# Architecture: 1 m modules on a grid. Walls run along Y (centred on the grid
# line, 0.1 thick, 2.6 tall) with skirting on both faces; floors are 1 x 1 m.

WALL_H, WALL_T = 2.6, 0.1


def skirting(P, y0, y1):
    for sx in (1, -1):
        P.box((0.012, y1 - y0, 0.08), (sx * (WALL_T / 2 + 0.006), (y0 + y1) / 2, 0.04), 'white')


@prop('wall', 'house', 'Wall (1 m)')
def wall(P, length=1.0):
    P.box((WALL_T, length, WALL_H), (0, 0, WALL_H / 2), 'wall')
    skirting(P, -length / 2, length / 2)


@prop('wall_half', 'house', 'Wall (0.5 m)')
def wall_half(P):
    wall(P, 0.5)


def frame_trim(P, y0, y1, z0, z1, mat='oak', w=0.05):
    """Trim round an opening on both faces of the wall."""
    for sx in (1, -1):
        x = sx * (WALL_T / 2 + 0.008)
        P.box((0.016, w, z1 - z0 + w), (x, y0 - w / 2, (z0 + z1 + w) / 2 - w / 2 + (0 if z0 > 0 else w / 2)), mat)
        P.box((0.016, w, z1 - z0 + w), (x, y1 + w / 2, (z0 + z1 + w) / 2 - w / 2 + (0 if z0 > 0 else w / 2)), mat)
        P.box((0.016, y1 - y0 + 2 * w, w), (x, (y0 + y1) / 2, z1 + w / 2), mat)
        if z0 > 0:
            P.box((0.016, y1 - y0 + 2 * w, w), (x, (y0 + y1) / 2, z0 - w / 2), mat)


@prop('wall_door', 'house', 'Wall with doorway')
def wall_door(P):
    o, top = 0.41, 2.1   # half opening, opening height
    for sy in (1, -1):
        P.box((WALL_T, 0.5 - o, WALL_H), (0, sy * (0.5 + o) / 2, WALL_H / 2), 'wall')
        skirting(P, *sorted((sy * o, sy * 0.5)))
    P.box((WALL_T, 2 * o, WALL_H - top), (0, 0, (WALL_H + top) / 2), 'wall')
    P.box((WALL_T, 2 * o, 0.012), (0, 0, 0.006), 'oak_dark')                         # threshold
    frame_trim(P, -o, o, 0, top, 'white')
    P.socket('hinge', (0, -o, 0))


@prop('door', 'house', 'Door')
def door(P):
    # Origin on the hinge at the floor; the leaf runs along +Y, so rotating about Z swings it.
    w, h, t = 0.8, 2.08, 0.04
    P.box((t, w, h), (0, w / 2 + 0.01, h / 2 + 0.01), 'white', bevel=0.006)
    for z in (0.55, 1.45):
        P.box((t + 0.01, w - 0.2, 0.6 if z < 1 else 0.7), (0, w / 2 + 0.01, z), 'white', bevel=0.01)
    for sx in (1, -1):
        P.cyl(0.012, 0.05, base=(sx * t / 2, w - 0.07, 1.0), axis=(sx, 0, 0), mat='brass', sides=6)
        P.cyl(0.01, 0.1, base=(sx * (t / 2 + 0.045), w - 0.07, 1.0), axis=(0, -1, 0), mat='brass', sides=6)


@prop('front_door', 'house', 'Front door')
def front_door(P):
    w, h, t = 0.8, 2.08, 0.05
    P.box((t, w, h), (0, w / 2 + 0.01, h / 2 + 0.01), 'moss', bevel=0.006)
    for k in range(4):
        P.box((t + 0.012, 0.012, h - 0.3), (0, 0.15 + k * 0.17, h / 2 - 0.1), 'leaf_dark')
    P.box((t + 0.01, w - 0.2, 0.25), (0, w / 2 + 0.01, h - 0.2), 'glass')
    for sx in (1, -1):
        P.cyl(0.015, 0.12, base=(sx * (t / 2 + 0.04), w - 0.08, 0.95), mat='brass', sides=6)
        P.cyl(0.008, 0.04, base=(sx * t / 2, w - 0.08, 1.0), axis=(sx, 0, 0), mat='brass', sides=5)


@prop('wall_window', 'house', 'Wall with window')
def wall_window(P):
    o, sill, top = 0.36, 0.95, 2.05
    for sy in (1, -1):
        P.box((WALL_T, 0.5 - o, WALL_H), (0, sy * (0.5 + o) / 2, WALL_H / 2), 'wall')
    P.box((WALL_T, 2 * o, sill), (0, 0, sill / 2), 'wall')
    P.box((WALL_T, 2 * o, WALL_H - top), (0, 0, (WALL_H + top) / 2), 'wall')
    skirting(P, -0.5, 0.5)
    frame_trim(P, -o, o, sill, top, 'white', w=0.045)
    # Casement: frame, glass, a mullion and transom; deep oak sill inside (+X).
    P.box((0.05, 2 * o, 0.04), (0, 0, sill + 0.02), 'white')
    P.box((0.05, 2 * o, 0.04), (0, 0, top - 0.02), 'white')
    for y in (-o + 0.02, 0, o - 0.02):
        P.box((0.05, 0.04, top - sill), (0, y, (sill + top) / 2), 'white')
    P.box((0.05, 2 * o, 0.03), (0, 0, sill + (top - sill) * 0.7), 'white')
    P.box((0.01, 2 * o - 0.04, top - sill - 0.06), (0, 0, (sill + top) / 2), 'glass')
    P.box((0.16, 2 * o + 0.1, 0.03), (WALL_T / 2 + 0.05, 0, sill - 0.015), 'oak', bevel=0.005)


@prop('floor_wood', 'house', 'Floor: oak boards (1 m)')
def floor_wood(P):
    for k in range(6):
        y = -0.5 + (k + 0.5) / 6
        # Staggered board ends so tiles don't read as a grid.
        split = 0.15 + 0.13 * ((k * 3) % 5)
        for x0, x1 in ((-0.5, -0.5 + split), (-0.5 + split, 0.5)):
            P.box((x1 - x0 - 0.004, 1 / 6 - 0.004, 0.02), ((x0 + x1) / 2, y, 0.01),
                  'floor_oak' if (k + (x0 > -0.5)) % 2 else 'floor_oak2')


@prop('floor_tile', 'house', 'Floor: tiles (1 m)')
def floor_tile(P):
    P.box((1.0, 1.0, 0.014), (0, 0, 0.007), 'grout')
    n = 5
    for i in range(n):
        for j in range(n):
            P.box((1 / n - 0.008, 1 / n - 0.008, 0.008), (-0.5 + (i + 0.5) / n, -0.5 + (j + 0.5) / n, 0.018),
                  'tile' if (i + j) % 2 else 'white')



# ==========================================================================
# Yard: fences and gates on the same 1 m grid as the walls. A fence piece runs
# along Y from -0.5 to 0.5 with its post at the -Y end only, so pieces tile
# without doubled posts; close a run with a `fence_post`.

def fence_post(P, h=1.05, mat='white', cap='oak'):
    P.box((0.09, 0.09, h), (0, -0.5, h / 2), mat, bevel=0.01)
    P.box((0.12, 0.12, 0.03), (0, -0.5, h + 0.015), cap, bevel=0.006)
    P.box((0.11, 0.11, 0.04), (0, -0.5, h + 0.05), cap, taper=(0.2, 0.2))


@prop('fence_post', 'yard', 'Fence post')
def fence_post_only(P):
    fence_post(P)
    P.transform(P.bm.verts[:], Matrix.Translation((0, 0.5, 0)))


@prop('fence_picket', 'yard', 'Picket fence (1 m)')
def fence_picket(P, h=0.95, mat='white'):
    fence_post(P, h + 0.1, mat)
    for z in (0.22, h - 0.25):
        P.box((0.025, 1.0, 0.06), (-0.035, 0, z), mat)
    n = 8
    for k in range(n):
        y = -0.5 + (k + 0.75) / n
        P.box((0.02, 0.07, h - 0.08), (0.0, y, (h - 0.08) / 2 + 0.03), mat)
        P.prism([(y - 0.035, h - 0.05), (y + 0.035, h - 0.05), (y, h + 0.01)], -0.01, 0.01, mat, axis='x')


@prop('fence_low', 'yard', 'Low border fence (1 m)')
def fence_low(P):
    P.box((0.05, 0.05, 0.42), (0, -0.5, 0.21), 'oak', bevel=0.006)
    P.box((0.02, 1.0, 0.04), (0.0, 0, 0.32), 'oak')
    for k in range(10):
        y = -0.5 + (k + 0.5) / 10
        P.box((0.016, 0.05, 0.35), (0.018, y, 0.175), 'oak')


@prop('fence_slat', 'yard', 'Slatted fence (1 m)')
def fence_slat(P):
    h = 1.1
    P.box((0.09, 0.09, h + 0.05), (0, -0.5, (h + 0.05) / 2), 'oak_dark', bevel=0.01)
    for k in range(7):
        z = 0.1 + k * (h - 0.12) / 6.6
        P.box((0.025, 0.995, 0.11), (0.03, 0, z + 0.055), 'oak' if k % 2 else 'oak_dark', bevel=0.004)


@prop('fence_gate', 'yard', 'Garden gate')
def fence_gate(P):
    # Origin on the hinge at the ground; the leaf runs along +Y (0.9 m), so it
    # swings by rotating about Z. Put it on a fence post: hinge at y = -0.45.
    w, h = 0.88, 0.95
    for y in (0.03, w - 0.03):
        P.box((0.04, 0.05, h), (0, y, h / 2 + 0.04), 'white', bevel=0.006)
    for z in (0.22, h - 0.15):
        P.box((0.04, w, 0.06), (0, w / 2, z), 'white')
    # Diagonal brace, then pickets with an arched top.
    d = Vector((0, w - 0.1, h - 0.35))
    P.box((0.035, d.length, 0.05), (-0.01, w / 2, 0.22 + d.z / 2), 'white',
          rot=(math.degrees(math.atan2(d.z, d.y)), 0, 0))
    for k in range(7):
        y = 0.1 + k * (w - 0.2) / 6
        top = h + 0.12 * math.sin(math.pi * (y / w)) + 0.02
        P.box((0.02, 0.06, top - 0.05), (0.025, y, (top - 0.05) / 2 + 0.04), 'white')
        P.prism([(y - 0.03, top - 0.01), (y + 0.03, top - 0.01), (y, top + 0.04)], 0.015, 0.035, 'white', axis='x')
    P.torus(0.035, 0.008, center=(0.05, w - 0.07, h * 0.6), mat='brass', seg=8, sides=4, axis=(1, 0, 0))
    for z in (0.2, h - 0.2):
        P.box((0.05, 0.08, 0.025), (0, 0.0, z), 'charcoal')     # hinges


@prop('gate_arch', 'yard', 'Gate arch')
def gate_arch(P):
    # Arbour over a 1 m gate opening (centred on the opening, posts at y = +-0.55).
    for sy in (1, -1):
        for sx in (1, -1):
            P.box((0.07, 0.07, 2.05), (sx * 0.15, sy * 0.55, 1.025), 'white', bevel=0.008)
        for z in (0.6, 1.2, 1.8):
            P.box((0.3, 0.03, 0.03), (0, sy * 0.55, z), 'white')
    path = [(0, 0.55 * math.cos(a), 2.05 + 0.3 * math.sin(a)) for a in (math.pi * k / 8 for k in range(9))]
    for sx in (1, -1):
        P.sweep([(sx * 0.15, y, z) for _, y, z in path], (0.035, 0.035), 'white', sides=4)
    for k in range(5):
        a = math.pi * (k + 0.5) / 5
        P.box((0.38, 0.03, 0.03), (0, 0.55 * math.cos(a), 2.05 + 0.3 * math.sin(a)), 'white')
    # A climbing rose along one side.
    for k, z in enumerate((0.4, 0.8, 1.2, 1.6, 2.0, 2.25)):
        P.sphere(0.12, (0.17, 0.55 - (0.05 if z > 2 else 0), z), 'leaf' if k % 2 else 'leaf_dark', subdiv=1)
        P.sphere(0.035, (0.26, 0.5, z + 0.05), 'rose', subdiv=1)


# ==========================================================================
# Garden: bushes (good for sniffing and peeing on), trees, rocks, flowers.

def blob(P, at, r, mat, seed=1, squash=1.0, jitter=0.18):
    vs = P.sphere(r, at, mat, subdiv=1, scale=(1, 1, squash))
    P.jitter(vs, r * jitter, seed)
    return vs


@prop('bush_round', 'garden', 'Round bush')
def bush_round(P, r=0.4, seed=1, flowers=None):
    parts = [(0, 0, 0.75, 1.0), (0.45, 0.2, 0.55, 0.7), (-0.4, 0.25, 0.6, 0.75), (0.1, -0.45, 0.6, 0.72),
             (-0.2, -0.3, 0.5, 0.6), (0.3, 0.45, 0.45, 0.55)]
    for k, (x, y, z, s) in enumerate(parts):
        blob(P, (x * r, y * r, z * r), r * s, 'leaf' if k % 2 else 'leaf_dark', seed + k, squash=0.85)
    if flowers:
        s = seed
        for k in range(14):
            s = (s * 16807) % 2147483647
            a = 2 * math.pi * (s % 1000) / 1000
            el = 0.2 + 0.9 * ((s >> 10) % 100) / 100
            d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
            P.sphere(r * 0.09, Vector((0, 0, r * 0.6)) + d * r * 1.02, flowers[k % len(flowers)], subdiv=1)


@prop('bush_small', 'garden', 'Small bush')
def bush_small(P):
    bush_round(P, r=0.22, seed=7)


@prop('bush_flowering', 'garden', 'Flowering bush')
def bush_flowering(P):
    bush_round(P, r=0.38, seed=4, flowers=['blush', 'white', 'rose'])


@prop('bush_lavender', 'garden', 'Lavender')
def bush_lavender(P):
    for k in range(14):
        a = 2 * math.pi * k / 14 + (k % 3) * 0.3
        lean = 0.15 + 0.15 * (k % 2)
        d = Vector((math.cos(a) * lean, math.sin(a) * lean, 1)).normalized()
        h = 0.4 + 0.08 * (k % 3)
        P.cyl(0.006, h, base=(math.cos(a) * 0.04, math.sin(a) * 0.04, 0), axis=d, mat='sage', sides=3)
        P.cyl(0.018, 0.09, base=Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0)) + d * h, axis=d, r_top=0.008,
              mat='lilac', sides=4)
    blob(P, (0, 0, 0.1), 0.2, 'sage', 2, squash=0.6)


@prop('hedge', 'garden', 'Hedge (1 m)')
def hedge(P):
    for k, y in enumerate((-0.35, 0.0, 0.35)):
        blob(P, (0, y, 0.45), 0.42, 'leaf_dark' if k % 2 else 'moss', k + 2, jitter=0.1)
    # Squash the blobs into a clipped-box hedge 0.6 wide, 0.9 tall.
    for v in P.bm.verts:
        v.co.x = max(-0.3, min(0.3, v.co.x * 1.0))
        v.co.y = max(-0.52, min(0.52, v.co.y))
        v.co.z = max(0.0, min(0.9, v.co.z))


@prop('shrub_cone', 'garden', 'Evergreen shrub')
def shrub_cone(P):
    P.cyl(0.04, 0.12, mat='bark', sides=5)
    for k, (z, r, h) in enumerate(((0.1, 0.32, 0.55), (0.4, 0.26, 0.5), (0.68, 0.18, 0.45))):
        P.cyl(r, h, base=(0, 0, z), r_top=0.02, mat='leaf_dark' if k % 2 else 'moss', sides=8)


@prop('tree_birch', 'garden', 'Birch tree')
def tree_birch(P):
    m = P.mark()
    P.sweep([(0, 0, 0), (0.03, 0.01, 1.2), (-0.02, 0, 2.4), (0.02, -0.02, 3.0)], [0.08, 0.065, 0.05, 0.035], 'white',
            sides=6)
    # Birch bark: dark dashes.
    P.paint(P.since(m), lambda c: 'charcoal' if int(c.z * 11) % 4 == 0 and (c.x + c.y) > 0 else None)
    P.sweep([(0.0, 0.0, 1.6), (0.35, 0.1, 2.1), (0.5, 0.15, 2.4)], [0.035, 0.025, 0.015], 'white', sides=5)
    P.sweep([(0.0, 0.0, 2.0), (-0.3, -0.1, 2.4), (-0.4, -0.2, 2.7)], [0.03, 0.02, 0.012], 'white', sides=5)
    for k, (x, y, z, r) in enumerate(((0, 0, 3.0, 0.6), (0.45, 0.15, 2.55, 0.45), (-0.4, -0.2, 2.75, 0.45),
                                      (0.1, -0.35, 2.6, 0.4), (-0.1, 0.35, 2.85, 0.4))):
        blob(P, (x, y, z), r, 'leaf' if k % 2 else 'olive', k + 11, squash=0.8)


@prop('tree_pine', 'garden', 'Pine tree')
def tree_pine(P):
    P.cyl(0.08, 0.6, mat='bark', sides=6, r_top=0.06)
    for k, (z, r, h) in enumerate(((0.45, 0.9, 1.1), (1.1, 0.72, 1.0), (1.7, 0.52, 0.9), (2.25, 0.32, 0.75))):
        P.cyl(r, h, base=(0, 0, z), r_top=0.03, mat='leaf_dark' if k % 2 else 'moss', sides=9)


@prop('tree_apple', 'garden', 'Apple tree')
def tree_apple(P):
    P.sweep([(0, 0, 0), (0.05, 0, 0.8), (0, 0.03, 1.4)], [0.1, 0.08, 0.06], 'bark', sides=6)
    for sx in (1, -1):
        P.sweep([(0, 0, 1.2), (sx * 0.4, 0.1, 1.6)], [0.05, 0.03], 'bark', sides=5)
    s = 9
    for k, (x, y, z, r) in enumerate(((0, 0, 1.95, 0.75), (0.55, 0.15, 1.7, 0.5), (-0.55, -0.1, 1.75, 0.5),
                                      (0.1, 0.5, 1.7, 0.45), (-0.1, -0.5, 1.8, 0.45))):
        blob(P, (x, y, z), r, 'leaf' if k % 2 else 'leaf_dark', k + 21, squash=0.85)
    for k in range(12):
        s = (s * 16807) % 2147483647
        a = 2 * math.pi * (s % 1000) / 1000
        el = -0.3 + 1.0 * ((s >> 10) % 100) / 100
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        P.sphere(0.05, Vector((0, 0, 1.85)) + d * 0.88, 'red', subdiv=1)
    for x, y in ((0.6, 0.3), (-0.4, 0.7)):   # windfalls to sniff
        P.sphere(0.045, (x, y, 0.045), 'red', subdiv=1)


@prop('tree_swing', 'garden', 'Tree with rope tug')
def tree_swing(P):
    tree_apple(P)
    P.sweep([(0.45, 0.12, 1.55), (0.62, 0.12, 0.9)], 0.01, 'linen', sides=4)
    P.embed(rope_tug, M((0.62, 0.12, 0.62), (90, 0, 0), 1.0))


@prop('stump', 'garden', 'Tree stump')
def stump(P):
    P.cyl(0.22, 0.32, mat='bark', sides=8, r_top=0.19)
    P.cyl(0.18, 0.004, base=(0, 0, 0.32), mat='sand', sides=8)
    P.cyl(0.09, 0.006, base=(0, 0, 0.322), mat='oak', sides=8)
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        P.cyl(0.07, 0.25, base=(math.cos(a) * 0.15, math.sin(a) * 0.15, 0.05),
              axis=(math.cos(a), math.sin(a), -0.6), r_top=0.03, mat='bark', sides=5)


@prop('log', 'garden', 'Fallen log')
def log(P):
    P.cyl(0.14, 1.2, base=(0, -0.6, 0.13), axis=(0, 1, 0), mat='bark', sides=7)
    for y in (-0.6, 0.6):
        P.cyl(0.12, 0.004, base=(0, y + (0.002 if y > 0 else -0.006), 0.13), axis=(0, 1, 0), mat='sand', sides=7)
    P.cyl(0.04, 0.2, base=(0, 0.1, 0.24), axis=(0.3, 0.2, 1), r_top=0.02, mat='bark', sides=5)
    blob(P, (0.1, -0.3, 0.22), 0.07, 'moss', 3, squash=0.5)


@prop('rock_big', 'garden', 'Boulder')
def rock_big(P):
    vs = blob(P, (0, 0, 0.18), 0.35, 'stone', 5, squash=0.6, jitter=0.25)
    for v in vs:
        v.co.z = max(0.0, v.co.z)
    blob(P, (0.3, 0.2, 0.08), 0.15, 'grey', 6, squash=0.6, jitter=0.25)


@prop('rock_small', 'garden', 'Stones')
def rock_small(P):
    for k, (x, y, r) in enumerate(((0, 0, 0.12), (0.18, 0.05, 0.08), (-0.1, 0.15, 0.07))):
        vs = blob(P, (x, y, r * 0.5), r, 'stone' if k % 2 else 'grey', k + 8, squash=0.6, jitter=0.25)
        for v in vs:
            v.co.z = max(0.0, v.co.z)


@prop('grass_tuft', 'garden', 'Grass tuft')
def grass_tuft(P):
    for k in range(9):
        a = 2 * math.pi * k / 9
        lean = 0.3 + 0.2 * (k % 2)
        P.cyl(0.018, 0.16 + 0.05 * (k % 3), base=(math.cos(a) * 0.03, math.sin(a) * 0.03, 0),
              axis=(math.cos(a) * lean, math.sin(a) * lean, 1), r_top=0.002, mat='moss' if k % 2 else 'leaf',
              sides=3)


@prop('flower_patch', 'garden', 'Wildflowers')
def flower_patch(P):
    s = 13
    for k in range(16):
        s = (s * 16807) % 2147483647
        x, y = ((s % 1000) / 1000 - 0.5) * 0.5, (((s >> 10) % 1000) / 1000 - 0.5) * 0.5
        h = 0.18 + 0.15 * ((s >> 4) % 10) / 10
        P.cyl(0.004, h, base=(x, y, 0), axis=(x, y, 1), mat='leaf_dark', sides=3)
        top = Vector((x, y, 0)) + Vector((x, y, 1)).normalized() * h
        P.sphere(0.022, top, ['white', 'mustard', 'lilac', 'blush'][k % 4], subdiv=1, scale=(1, 1, 0.6))
    P.embed(grass_tuft, M((0.0, 0.0, 0)))


# ==========================================================================
# Yard: ground tiles, a paddling pool, a dig pit, a bench.

@prop('ground_grass', 'yard', 'Ground: grass (1 m)')
def ground_grass(P):
    P.box((1.0, 1.0, 0.02), (0, 0, 0.01), 'leaf')
    for k, (x, y) in enumerate(((-0.3, -0.2), (0.25, 0.3), (0.1, -0.35))):
        for j in range(3):
            a = 2 * math.pi * j / 3 + k
            P.cyl(0.015, 0.07, base=(x + math.cos(a) * 0.02, y + math.sin(a) * 0.02, 0.02),
                  axis=(math.cos(a) * 0.4, math.sin(a) * 0.4, 1), r_top=0.002, mat='moss', sides=3)


@prop('ground_path', 'yard', 'Ground: stone path (1 m)')
def ground_path(P):
    P.box((1.0, 1.0, 0.02), (0, 0, 0.01), 'sand')
    for k, (x, y, r) in enumerate(((-0.22, -0.2, 0.2), (0.22, 0.22, 0.2), (0.25, -0.25, 0.15), (-0.25, 0.27, 0.15))):
        vs = P.cyl(r, 0.03, base=(x, y, 0.005), mat='stone' if k % 2 else 'grey', sides=7, bevel=0.006)
        P.jitter(vs, 0.012, k + 1)


@prop('ground_deck', 'yard', 'Ground: deck (1 m)')
def ground_deck(P):
    P.box((0.96, 0.96, 0.06), (0, 0, 0.03), 'oak_dark')
    for k in range(7):
        P.box((1.0, 1 / 7 - 0.012, 0.025), (0, -0.5 + (k + 0.5) / 7, 0.0725), 'oak' if k % 2 else 'birch')


@prop('paddling_pool', 'yard', 'Paddling pool')
def paddling_pool(P):
    R0 = 0.65
    P.torus(R0, 0.09, center=(0, 0, 0.12), mat='dusty_blue', seg=16, sides=6, scale=(1, 1))
    P.torus(R0, 0.08, center=(0, 0, 0.0), mat='white', seg=16, sides=6)
    P.cyl(R0, 0.02, base=(0, 0, 0.0), mat='dusty_blue', sides=16)
    P.cyl(R0 - 0.02, 0.003, base=(0, 0, 0.13), mat='water', sides=16)
    P.embed(ball_rubber, M((0.2, 0.15, 0.1)))
    P.embed(rope_ring, M((-0.25, -0.1, 0.12)))


@prop('dig_pit', 'yard', 'Dig pit')
def dig_pit(P):
    w = 1.2
    for sy in (1, -1):
        P.box((w, 0.08, 0.2), (0, sy * (w / 2 - 0.04), 0.1), 'oak', bevel=0.008)
        P.box((0.08, w - 0.16, 0.2), (sy * (w / 2 - 0.04), 0, 0.1), 'oak', bevel=0.008)
    P.sheet(w - 0.16, w - 0.16, 6, 6, lambda x, y: 0.02 * math.sin(x * 11) * math.cos(y * 9)
            + 0.07 * math.exp(-((x + 0.2) ** 2 + (y - 0.15) ** 2) / 0.02)
            - 0.05 * math.exp(-((x - 0.15) ** 2 + (y + 0.1) ** 2) / 0.02),
            center=(0, 0, 0.15), mat='sand', thick=0.14)
    P.embed(bone_toy, M((-0.2, 0.15, 0.2), (0, -35, 30)))
    P.embed(ball_tennis, M((0.3, 0.3, 0.14)))


@prop('garden_bench', 'yard', 'Garden bench')
def garden_bench(P):
    D, W, z = 0.45, 1.4, 0.44
    for k in range(4):
        P.box((D / 4 - 0.01, W, 0.03), (-D / 2 + (k + 0.5) * D / 4, 0, z), 'oak', bevel=0.004)
    for k in range(3):
        P.box((0.025, W, 0.08), (-D / 2 - 0.04, 0, z + 0.15 + k * 0.12), 'oak', bevel=0.004, rot=(0, -12, 0))
    for sy in (1, -1):
        P.box((D, 0.05, 0.05), (0, sy * (W / 2 - 0.1), z - 0.03), 'oak_dark')
        for sx in (1, -1):
            P.box((0.05, 0.05, z), (sx * (D / 2 - 0.05), sy * (W / 2 - 0.1), z / 2), 'oak_dark')
        P.box((0.05, 0.05, 0.5), (-D / 2 - 0.02, sy * (W / 2 - 0.1), z + 0.2), 'oak_dark', rot=(0, -12, 0))


@prop('garden_tap', 'yard', 'Garden tap & hose')
def garden_tap(P):
    P.box((0.06, 0.06, 0.7), (0, 0, 0.35), 'oak_dark', bevel=0.006)
    P.cyl(0.015, 0.06, base=(0.03, 0, 0.6), axis=(1, 0, 0), mat='brass', sides=6)
    P.cyl(0.025, 0.01, base=(0.06, 0, 0.62), mat='red', sides=6)
    pts = [(0.09, 0, 0.58), (0.12, 0, 0.3), (0.15, 0.05, 0.03)]
    pts += [(0.3 + 0.15 * math.cos(a), 0.15 * math.sin(a), 0.03 + 0.01 * k)
            for k, a in enumerate(2 * math.pi * j / 10 for j in range(21))]
    P.sweep(pts, 0.012, 'leaf_dark', sides=4)



# ==========================================================================

manifest = []
manifest_path = os.path.join(out_dir, 'props.json')
if only and os.path.exists(manifest_path):
    manifest = [e for e in json.load(open(manifest_path)) if e['id'] not in only]
for pid, category, label, fn, attach in PROPS:
    if only and pid not in only:
        continue
    P = Prop(pid)
    fn(P)
    holdable = 'grip' in P.sockets
    tris, lo, hi = export_prop(P, os.path.join(out_dir, f'{pid}.glb'),
                               extras={'category': category, 'attach': attach})
    entry = dict(id=pid, label=label, category=category, attach=attach, tris=tris,
                 size=[round(hi[a] - lo[a], 3) for a in range(3)], holdable=holdable,
                 materials=sorted({m.split('@')[0] for m in P.mats}))
    manifest.append(entry)
    print('PROP', pid, tris, 'tris', entry['size'])

order = {pid: i for i, (pid, *_rest) in enumerate(PROPS)}
manifest.sort(key=lambda e: order.get(e['id'], 1e9))
with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=1)
print('PROPS', len(manifest), 'in manifest')
