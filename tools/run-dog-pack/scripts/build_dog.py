"""Build a low-poly dog body for one build (body type).

blender -b -t 1 --factory-startup -P scripts/build_dog.py -- <build> <out.glb>

The torso+head is one tube of rings swept along a spine curve; legs are tubes
tucked into it; eyes and nose are small pieces. Ring and side counts are fixed,
so every build has identical topology (same vertex and face order) and only
proportions change. That's what lets every breed share one rig, one UV layout
and one set of pattern masks.

Ears and tails are separate parts (see build_parts.py). Each body exports
empty nodes they attach to: socket_head and socket_tail. Heads are their own
parts too (build_heads.py), so any head goes on any body; ears attach to the
head, and socket_head carries the build's ear scale in its extras.
Socket extras carry `uv2`, the dog-space projection at that point, so a part
can take its colour from the region patterns where it attaches.

Faces are tagged in COLOR_0: R = nose, G = eyes.
UV sets: TEXCOORD_0 is an even-density unwrap for tiling surface patterns
(spots, merle, brindle); TEXCOORD_1 is the baked dog-space side projection for
region patterns (saddle, tuxedo, points, face mask, piebald).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(__file__))
from dogkit import UV_TILE, Builder, even_uvs, export, ring_points, split_jaw  # noqa: E402
import anims  # noqa: E402
import rig  # noqa: E402

# --------------------------------------------------------------------------
# Builds (body types, see BREEDS.md). Units are metres-ish for a mid-size dog;
# the export is normalised to body length 1 and breeds set their own size.
BASE = dict(
    body_len=0.55,        # rump to front of chest
    leg=0.36,             # ground to bottom of chest
    chest=(0.115, 0.15),  # half-width, half-depth at the chest
    tuck=0.75,            # waist depth relative to chest (lower = more tucked up)
    rump=0.85,            # rump size relative to chest
    slope=0.0,            # rump height offset (negative = sloped back)
    neck_len=0.2, neck_angle=50, neck_r=(0.07, 0.08),
    head=(0.08, 0.075), skull_len=0.13, stop=0.02,
    snout_len=0.12, snout=(0.04, 0.04),
    leg_r=0.04, thigh=0.07, paw=0.04,
    eye=0.24,             # eye radius relative to head height
    keel=1.0,             # how pointed the underside of the chest is
    stance=1.0,           # how far apart the front legs stand
    ear_scale=1.0,        # ear socket scale relative to head height
    tail_len=0.33,        # tail socket scale
)
BUILDS = {
    # German Shepherd, Malinois, collies, Aussie, Cattle Dog...
    # Deep chest, tucked waist, hips lower than the shoulders (sloped back), strong thighs.
    'shepherd': dict(chest=(0.125, 0.162), tuck=0.7, rump=0.85, slope=-0.04, keel=0.35,
                     neck_r=(0.075, 0.088), leg_r=0.042, thigh=0.085),
    # Labrador, Golden, setters, Toller...
    'gundog': dict(chest=(0.125, 0.155), tuck=0.85, rump=0.9, head=(0.085, 0.078), snout=(0.045, 0.045),
                   ear_scale=1.0),
    # Husky, Shiba, Akita, Samoyed, Pomeranian...
    # Thick neck ruff, round chest, sturdy legs: reads fluffy before coats exist.
    'spitz': dict(body_len=0.4, leg=0.27, chest=(0.135, 0.145), tuck=0.95, rump=0.95,
                  neck_len=0.12, neck_angle=55, neck_r=(0.105, 0.105), head=(0.092, 0.08), skull_len=0.1,
                  stop=0.015, snout_len=0.085, snout=(0.035, 0.035),
                  leg_r=0.045, thigh=0.075, paw=0.042, tail_len=0.3),
    # Jack Russell, Fox Terrier, Airedale, Schnauzers...
    'terrier': dict(body_len=0.36, leg=0.27, chest=(0.085, 0.11), tuck=0.8, rump=0.9,
                    neck_len=0.15, neck_angle=60, neck_r=(0.055, 0.06), head=(0.06, 0.065), skull_len=0.12,
                    stop=0.005, snout_len=0.1, snout=(0.035, 0.042),
                    leg_r=0.03, thigh=0.05, paw=0.03, ear_scale=0.9, tail_len=0.2),
    # Pug, French Bulldog, Boston Terrier...
    'brachy': dict(body_len=0.3, leg=0.15, chest=(0.11, 0.11), tuck=0.85, rump=0.85,
                   neck_len=0.07, neck_angle=35, neck_r=(0.08, 0.08), head=(0.095, 0.09), skull_len=0.1,
                   stop=0.005, snout_len=0.03, snout=(0.065, 0.05),
                   leg_r=0.032, thigh=0.05, paw=0.033, eye=0.26, ear_scale=0.8, tail_len=0.18),
    # Chihuahua, Papillon, Chinese Crested...
    'toy': dict(body_len=0.22, leg=0.14, chest=(0.06, 0.07), tuck=0.75, rump=0.85,
                neck_len=0.07, neck_angle=55, neck_r=(0.035, 0.04), head=(0.065, 0.062), skull_len=0.065,
                stop=0.025, snout_len=0.035, snout=(0.022, 0.022),
                leg_r=0.015, thigh=0.026, paw=0.016, eye=0.33, ear_scale=1.1, tail_len=0.14),
    # Pembroke, Cardigan, Vallhund, Lancashire Heeler
    # Shorter loaf with a big round rump and full chest (papercraft concept).
    'corgi': dict(body_len=0.44, leg=0.13, chest=(0.12, 0.14), tuck=0.92, rump=1.02, keel=0.5,
                  neck_len=0.1, neck_angle=52, head=(0.095, 0.083), skull_len=0.1, stop=0.022, snout_len=0.06,
                  snout=(0.046, 0.036), leg_r=0.036, thigh=0.06, paw=0.036, ear_scale=0.88, tail_len=0.22),
    # Doberman, Min Pin, Dalmatian, pointers, Weimaraner, Great Dane, Basenji...
    'lean': dict(body_len=0.5, leg=0.45, chest=(0.1, 0.15), tuck=0.6, rump=0.85,
                 neck_len=0.24, neck_angle=55, neck_r=(0.06, 0.07), head=(0.065, 0.07), skull_len=0.13,
                 stop=0.012, snout_len=0.13, snout=(0.035, 0.04),
                 leg_r=0.034, thigh=0.06, paw=0.034, tail_len=0.4),
    # ---- first-pass builds, not yet tuned by eye ----
    # Greyhound, Whippet, Saluki, Borzoi...
    'sighthound': dict(body_len=0.5, leg=0.5, chest=(0.085, 0.16), tuck=0.45, rump=0.8,
                       neck_len=0.26, neck_angle=50, neck_r=(0.045, 0.055), head=(0.05, 0.055), skull_len=0.14,
                       stop=0.0, snout_len=0.16, snout=(0.025, 0.03),
                       leg_r=0.025, thigh=0.055, paw=0.028, ear_scale=0.9, tail_len=0.45),
    # Beagle, Foxhound, Bloodhound, Coonhounds...
    'scenthound': dict(body_len=0.5, leg=0.3, chest=(0.11, 0.14), tuck=0.8, rump=0.9,
                       neck_len=0.16, neck_angle=45, head=(0.07, 0.07), skull_len=0.13, stop=0.015,
                       snout_len=0.12, snout=(0.045, 0.05), leg_r=0.036, thigh=0.06, paw=0.036, tail_len=0.3),
    # Bernese, Rottweiler, Newfoundland, Pyrenees...
    'mountain': dict(body_len=0.6, leg=0.38, chest=(0.168, 0.2), tuck=0.9, rump=0.95, keel=0.5,
                     neck_len=0.17, neck_angle=45, neck_r=(0.1, 0.1), head=(0.1, 0.09), skull_len=0.14, stop=0.02,
                     snout_len=0.11, snout=(0.055, 0.055), leg_r=0.05, thigh=0.085, paw=0.05, tail_len=0.38),
    # Mastiff, Cane Corso, Dogue de Bordeaux, Saint Bernard...
    'mastiff': dict(body_len=0.6, leg=0.36, chest=(0.17, 0.19), tuck=0.92, rump=0.9,
                    neck_len=0.14, neck_angle=40, neck_r=(0.11, 0.11), head=(0.12, 0.11), skull_len=0.13,
                    stop=0.03, snout_len=0.07, snout=(0.075, 0.07), leg_r=0.055, thigh=0.09, paw=0.055,
                    ear_scale=0.8, tail_len=0.35),
    # Pit Bull, Staffy, American Bulldog, Boxer: wide chest and front stance, thick
    # short neck, broad cheeks, tucked waist (the bully V).
    'bully': dict(body_len=0.4, leg=0.27, chest=(0.15, 0.14), tuck=0.72, rump=0.8, keel=0.4, stance=1.25,
                  neck_len=0.09, neck_angle=38, neck_r=(0.1, 0.1), head=(0.11, 0.085), skull_len=0.09,
                  stop=0.025, snout_len=0.065, snout=(0.065, 0.052), leg_r=0.046, thigh=0.08, paw=0.042,
                  tail_len=0.25),
    # Cocker, Springer, Cavalier, Brittany...
    'spaniel': dict(body_len=0.38, leg=0.22, chest=(0.1, 0.12), tuck=0.85, rump=0.9,
                    neck_len=0.13, neck_angle=50, head=(0.07, 0.075), skull_len=0.1, stop=0.03,
                    snout_len=0.08, snout=(0.04, 0.045), leg_r=0.032, thigh=0.055, paw=0.035, tail_len=0.2),
    # Poodles, water dogs, Lagotto, Bedlington...
    'poodle': dict(body_len=0.42, leg=0.4, chest=(0.09, 0.13), tuck=0.7, rump=0.85,
                   neck_len=0.22, neck_angle=62, neck_r=(0.05, 0.06), head=(0.06, 0.065), skull_len=0.11,
                   stop=0.01, snout_len=0.12, snout=(0.03, 0.035), leg_r=0.03, thigh=0.055, paw=0.03, tail_len=0.25),
    # Old English Sheepdog, Puli, Komondor, Bouvier: barrel body for a big coat.
    'shaggy': dict(body_len=0.5, leg=0.25, chest=(0.15, 0.17), tuck=0.95, rump=1.0,
                   neck_len=0.12, neck_angle=45, neck_r=(0.11, 0.11), head=(0.1, 0.1), skull_len=0.1, stop=0.01,
                   snout_len=0.08, snout=(0.06, 0.06), leg_r=0.055, thigh=0.08, paw=0.055, tail_len=0.15),
    # Shih Tzu, Maltese, Yorkie, Havanese, Bichon, Pekingese: low, coat to the floor.
    'toylong': dict(body_len=0.26, leg=0.08, chest=(0.075, 0.08), tuck=0.95, rump=0.88,
                    neck_len=0.06, neck_angle=45, neck_r=(0.05, 0.055), head=(0.07, 0.068), skull_len=0.06,
                    stop=0.015, snout_len=0.03, snout=(0.03, 0.028), leg_r=0.022, thigh=0.032, paw=0.024,
                    eye=0.3, tail_len=0.14),
    # Scottie, Westie, Cairn, Skye...
    'lowterrier': dict(body_len=0.32, leg=0.12, chest=(0.08, 0.1), tuck=0.9, rump=0.9,
                       neck_len=0.1, neck_angle=55, neck_r=(0.05, 0.055), head=(0.055, 0.06), skull_len=0.1,
                       stop=0.005, snout_len=0.08, snout=(0.035, 0.04), leg_r=0.028, thigh=0.045, paw=0.03,
                       tail_len=0.15),
    # Dachshund, Basset, PBGV...
    'longlow': dict(body_len=0.55, leg=0.09, chest=(0.09, 0.11), tuck=0.9, rump=0.85,
                    neck_len=0.14, neck_angle=40, neck_r=(0.05, 0.06), head=(0.06, 0.06), skull_len=0.11,
                    stop=0.01, snout_len=0.12, snout=(0.03, 0.035), leg_r=0.03, thigh=0.045, paw=0.035, tail_len=0.25),
    # English Bulldog: wide front, narrow rump, flat face.
    'bulldog': dict(body_len=0.36, leg=0.16, chest=(0.15, 0.13), tuck=0.8, rump=0.75,
                    neck_len=0.06, neck_angle=25, neck_r=(0.1, 0.1), head=(0.12, 0.1), skull_len=0.1, stop=0.03,
                    snout_len=0.02, snout=(0.08, 0.06), leg_r=0.045, thigh=0.055, paw=0.045, eye=0.22,
                    ear_scale=0.8, tail_len=0.1),
    # Bull Terrier: egg head, no stop (negative stop gives the Roman profile).
    'bullterrier': dict(body_len=0.42, leg=0.28, chest=(0.12, 0.14), tuck=0.78, rump=0.9,
                        neck_len=0.14, neck_angle=45, neck_r=(0.075, 0.08), head=(0.07, 0.085), skull_len=0.1,
                        stop=-0.01, snout_len=0.14, snout=(0.05, 0.06), leg_r=0.04, thigh=0.068, paw=0.038,
                        eye=0.18, tail_len=0.25),
}

SIDES = 10        # torso/head ring sides
LIMB_SIDES = 6    # leg ring sides

args = sys.argv[sys.argv.index('--') + 1:]
build_name, dst = args[:2]
# --legacy rebuilds the previous revision (head built into the body tube, ears
# on the body) so it can be compared side by side with the head parts.
LEGACY = '--legacy' in args
P = {**BASE, **BUILDS[build_name]}

# Papercraft style layer (the art direction chosen from the concepts): cute,
# slightly exaggerated proportions applied on top of every build. Bigger head
# and ears, head carried high, a full forechest, compact body, straighter column
# legs with chunky paws, less hind angulation and small eyes.
# head_exp > 2 squares the head rings off (flat forehead, flat sides, block
# muzzle like the papercraft concepts); cheeks widens the skull below the ears.
STYLE = dict(head=1.25, skull=1.08, snout=0.9, ears=1.3, neck_lift=20, neck=1.3, body=0.82,
             head_exp=5.0, cheeks=1.1,
             legs=1.15, thigh=1.08, paws=1.25, eyes=0.7, nose=0.75, forechest=1.5, angulation=0.7)
P['head'] = (P['head'][0] * STYLE['head'], P['head'][1] * STYLE['head'])
P['skull_len'] *= STYLE['skull']
P['snout_len'] *= STYLE['snout']
P['ear_scale'] *= STYLE['ears']
P['neck_angle'] = min(P['neck_angle'] + STYLE['neck_lift'], 78)
P['neck_r'] = (P['neck_r'][0] * STYLE['neck'], P['neck_r'][1] * STYLE['neck'])
P['body_len'] *= STYLE['body']
P['leg_r'] *= STYLE['legs']
P['thigh'] *= STYLE['thigh']
P['paw'] *= STYLE['paws']
P['eye'] *= STYLE['eyes']

bpy.ops.wm.read_factory_settings(use_empty=True)
B = Builder()


def catmull(points, samples_per_seg):
    """Catmull-Rom through control points (each a tuple of floats)."""
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            out.append(tuple(
                0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)
                for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(points[-1])
    return out


# --------------------------------------------------------------------------
# Torso + neck, one swept tube ending at the top of the neck, where the head
# part attaches. Control points: (x, z, half-w, half-h, keel)
half = P['body_len'] / 2
cw, ch = P['chest']
zc = P['leg'] + ch
na = math.radians(P['neck_angle'])
fc = STYLE['forechest']   # pushes the brisket forward into a full, rounded chest
neck_base = Vector((half + 0.03 + ch * 0.22 * fc, 0, zc + ch * 0.35))
neck_dir = Vector((math.cos(na), 0, math.sin(na)))
head_back = neck_base + neck_dir * P['neck_len']
hw, hh = P['head']
r = P['rump']
sl = P['slope']
ctrl = [
    (-half - 0.04, zc + ch * 0.1 + sl, cw * r * 0.55, ch * r * 0.55, 0.0),   # tail end of rump
    (-half + 0.02, zc + ch * 0.05 + sl, cw * r, ch * r * 0.95, 0.0),         # rump
    (-half * 0.4, zc + ch * (1 - P['tuck']) * 0.6 + sl * 0.5, cw * 0.88, ch * P['tuck'], 0.0),  # loin
    (half * 0.25, zc, cw * 0.98, ch, 0.15 * P['keel']),                      # ribs
    (half, zc - ch * 0.02, cw, ch * 0.98, 0.2 * P['keel']),                  # chest
    (neck_base.x, neck_base.z, max(P['neck_r'][0] * 1.25, cw * 0.82 * fc), ch * 0.75 * (1 + 0.18 * fc),
     0.1 * P['keel']),                                                        # base of neck / brisket
    (*(neck_base + neck_dir * P['neck_len'] * 0.55).xz, *P['neck_r'], 0.0),
    (head_back.x, head_back.z, P['neck_r'][0] * 0.92, P['neck_r'][1] * 0.95, 0.0),  # top of neck (inside the head)
]
if LEGACY:
    head_mid = head_back + Vector((P['skull_len'] * 0.45, 0, 0.012))
    head_front = head_back + Vector((P['skull_len'], 0, -0.005))
    snout_mid = head_front + Vector((P['snout_len'] * 0.5, 0, -P['stop'] - hh * 0.25))
    snout_tip = head_front + Vector((P['snout_len'], 0, -P['stop'] - hh * 0.3))
    sw, sh = P['snout']
    ctrl[-1:] = [
        (head_back.x, head_back.z, hw * 0.9, hh * 0.95, 0.0),
        (head_mid.x, head_mid.z - hh * 0.08, hw * 1.1, hh, 0.0),
        (head_front.x, head_front.z - P['stop'] * 0.5, hw * 0.78, hh * 0.72, 0.0),
        (snout_mid.x, snout_mid.z, sw, sh, 0.0),
        (snout_tip.x, snout_tip.z, sw * 0.9, sh * 0.85, 0.0),
    ]
samples = catmull(ctrl, 2)
centers = [Vector((s[0], 0, s[1])) for s in samples]
rings = []
for i, s in enumerate(samples):
    a = centers[max(i - 1, 0)]
    b = centers[min(i + 1, len(centers) - 1)]
    exp = 5.0 if LEGACY and i >= 14 else 2.4   # legacy: squared-off head rings
    rings.append(ring_points(centers[i], b - a, s[2], s[3], SIDES, exp=exp, keel=s[4]))
torso_vs = B.tube(rings)


# --------------------------------------------------------------------------
# Legs: tubes from inside the body to the paw.
leg_vs = []   # vertex rings per leg, in creation order: front L, rear L, front R, rear R


def leg(points, radii):
    rings = []
    for i, (c, (w, d)) in enumerate(zip(points, radii)):
        t = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        if i >= len(points) - 2:      # paw rings face forward-down so the foot reads
            t = Vector((0.3, 0, -1)) if i == len(points) - 2 else Vector((1, 0, -0.2))
        rings.append(ring_points(c, t, w, d, LIMB_SIDES, exp=2.0))
    leg_vs.append(B.tube(rings))
    return points, rings


L, lr, th, pw = P['leg'], P['leg_r'], P['thigh'], P['paw']
ang = STYLE['angulation']
front_legs, rear_legs = [], []
for side in (1, -1):
    # Front: shoulder, elbow, forearm, wrist, then the paw; the forearm stays near vertical.
    y = side * cw * 0.55 * P['stance']
    fx = half - 0.03
    front_legs.append(leg(
        [Vector((fx, y, zc - ch * 0.1)), Vector((fx - 0.015, y, L * 0.95)), Vector((fx - 0.02, y, L * 0.5)),
         Vector((fx, y, L * 0.14)), Vector((fx + pw * 0.4, y, pw * 0.55)), Vector((fx + pw * 1.1, y, pw * 0.35))],
        [(lr * 1.5, lr * 1.8), (lr * 1.15, lr * 1.3), (lr, lr * 1.05), (lr * 0.8, lr * 0.85),
         (pw, pw * 0.7), (pw * 0.75, pw * 0.4)]))
    # Rear, like a real hind leg: hip, thigh, a high knee (stifle) forward, the hock
    # back, then the cannon dropping almost straight to the paw.
    y = side * cw * 0.55 * r
    bx = -half + 0.04
    hip_z = zc + sl
    rear_legs.append(leg(
        [Vector((bx, y, hip_z)), Vector((bx + L * 0.08, y, (hip_z + L * 0.66) / 2)),
         Vector((bx + L * 0.16 * ang, y, L * 0.66)), Vector((bx - L * 0.1 * ang, y, L * 0.27)),
         Vector((bx - L * 0.09 * ang, y, pw * 0.6)), Vector((bx - L * 0.09 * ang + pw * 0.9, y, pw * 0.35))],
        [(th * 0.9, th * 1.5), (th * 0.85, th * 1.3), (th * 0.6, th * 0.85), (lr * 0.75, lr * 0.85),
         (pw, pw * 0.7), (pw * 0.75, pw * 0.4)]))

if LEGACY:   # eyes and nose on the attached head
    for side in (1, -1):
        res = bmesh.ops.create_uvsphere(B.bm, u_segments=6, v_segments=4, radius=hh * P['eye'])
        bmesh.ops.translate(B.bm, vec=head_front + Vector((-0.004, side * hw * 0.84, hh * 0.3 - P['stop'] * 0.3)),
                            verts=res['verts'])
        B.tag_new(res['verts'], 'eye')
    res = bmesh.ops.create_cube(B.bm, size=1.0)
    nv = res['verts']
    nk = STYLE['nose']
    bmesh.ops.scale(B.bm, vec=(0.03 * hh / 0.075 * nk, min(sw * 1.2, hw * 0.6) * nk, min(sh * 0.8, hh * 0.45) * nk),
                    verts=nv)
    for v in nv:
        if v.co.x > 0:
            v.co.y *= 0.75
            v.co.z *= 0.8
        if v.co.z < 0:
            v.co.x -= 0.006 * hh / 0.075
    bmesh.ops.translate(B.bm, vec=snout_tip + Vector((0.004, 0, sh * 0.35)), verts=nv)
    B.tag_new(nv, 'nose')

# Sockets for parts, in build units: (name, position, scale).
sockets = [
    # Head parts are authored with skull height 1, so the socket scale is the head height.
    *([('socket_ear_L', head_back + Vector((P['skull_len'] * 0.22, hw * 0.6, hh * 0.86)), hh * P['ear_scale']),
       ('socket_ear_R', head_back + Vector((P['skull_len'] * 0.22, -hw * 0.6, hh * 0.86)), hh * P['ear_scale'])]
      if LEGACY else [('socket_head', head_back, hh * 2)]),
    ('socket_tail', Vector((-half - 0.03, 0, zc + ch * 0.25 + sl)), P['tail_len']),
]

# --------------------------------------------------------------------------
# Coat shells: fur volumes built from the body's own rings, so they fit every
# build and share one topology. Alternating vertices are pushed out more, which
# gives jagged, faceted fur. Torso ring index = 2 x torso control point
# (7-8 chest, 10 base of neck, 14 back of skull, 18 stop/eyes).
def fluff(ring, center, f, phase, spike=0.09, drop=0.0, floor=0.0, back=0.0):
    """Inflate a ring around its centre. `drop` drapes the lower half toward the
    floor (skirts, fringes); `back` pushes the rear-facing half backwards."""
    out = []
    for k, p in enumerate(ring):
        d = p - center
        jag = 1 + spike if (k + phase) % 2 == 0 else 1 - spike * 0.45
        q = center + d * f * jag
        if drop and d.z < 0:
            q.z = max(q.z - drop * (0.75 if (k + phase) % 2 else 1.0) * min(1.0, -d.z / max(abs(d.z), 1e-6)), floor)
        if back and d.x < 0:
            q.x -= back * (0.7 if (k + phase) % 2 else 1.0)
        out.append(q)
    return out


def shell(src_rings, src_centers, first, profile, **kw):
    """Fluffed copies of consecutive rings. Profile entries are an inflate factor
    or (factor, drop, back) to vary the drape/feathering along the tube."""
    out = []
    for i, f in enumerate(profile):
        f, drop, back = f if isinstance(f, tuple) else (f, kw.get('drop', 0.0), kw.get('back', 0.0))
        out.append(fluff(src_rings[first + i], src_centers[first + i], f, i, kw.get('spike', 0.09),
                         drop, kw.get('floor', 0.0), back))
    return out


def tube(rings_, cap=False):
    return ('tube', rings_, cap)


def ball(center, radius):
    return ('ball', center, radius)


floor_z = pw * 0.5
legs_all = front_legs + rear_legs
COATS = {
    # Mane from the chest up behind the head, plus trousers on the back thighs.
    'ruff': [tube(shell(rings, centers, 7, [1.15, 1.35, 1.55, 1.6, 1.55, 1.45, 1.3, 1.12], spike=0.14))]
            + [tube(shell(lr_, pts, 0, [1.35, 1.4, 1.2], spike=0.14)) for pts, lr_ in rear_legs],
    # Ball over the whole torso and neck; head, legs and tail poke out.
    'puff': [tube(shell(rings, centers, 0, [1.2, 1.35, 1.45, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.45, 1.4, 1.3, 1.15],
                        spike=0.14), cap=True)],
    # Spaniels, setters, Golden: belly and chest fringe, feathering down the back of the legs.
    'feathered': [tube(shell(rings, centers, 4, [(1.04, ch * x, 0) for x in (0.25, 0.45, 0.55, 0.6, 0.6, 0.55,
                                                                            0.5, 0.45, 0.35)], spike=0.05))]
                 + [tube(shell(lr_, pts, 0, [(1.05, 0, lr * x) for x in (0.6, 1.1, 1.1, 0.7)], spike=0.05))
                    for pts, lr_ in front_legs]
                 + [tube(shell(lr_, pts, 0, [(1.05, 0, th * x) for x in (0.5, 0.6, 0.4)], spike=0.05))
                    for pts, lr_ in rear_legs],
    # Doodles, water dogs, Lagotto: looser, fluffier all over with a full chest.
    'curly': [tube(shell(rings, centers, 0, [1.12, 1.2, 1.22, 1.22, 1.22, 1.24, 1.26, 1.3, 1.32, 1.3, 1.25, 1.2,
                                             1.15, 1.1], spike=0.07), cap=True)]
             + [tube(shell(lr_, pts, 0, [1.25, 1.3, 1.3, 1.25], spike=0.07)) for pts, lr_ in legs_all],
    # Old English Sheepdog, Beardie, Shih Tzu: coat draped toward the floor (the
    # fringe over the eyes is on the head part).
    'shaggy': [tube(shell(rings, centers, 0, [1.25] + [1.32] * 12 + [1.25], drop=ch * 0.9, floor=floor_z,
                          spike=0.16), cap=True)]
              + [tube(shell(lr_, pts, 0, [1.3, 1.3, 1.25, 1.2], spike=0.16)) for pts, lr_ in front_legs],
    # Standard Poodle continental clip: lion mane, topknot, bracelets, hip rosettes.
    'poodleclip': [tube(shell(rings, centers, 7, [1.25, 1.55, 1.8, 1.9, 1.85, 1.7, 1.4], spike=0.1))]   # topknot is on the head
                  + [ball(pts[3], lr * 2.1) for pts, _ in front_legs]
                  + [ball((pts[3] + pts[4]) / 2, lr * 2.1) for pts, _ in rear_legs]
                  + [ball(pts[0] + Vector((0, math.copysign(th * 0.6, pts[0].y), 0)), th * 1.0)
                     for pts, _ in rear_legs],
}

# --------------------------------------------------------------------------
# Normalise to dog space: nose toward +X, body length 1, feet at 0, centred.
lo_x = min(v.co.x for v in B.bm.verts)
hi_x = max(v.co.x for v in B.bm.verts)
lo_z = min(v.co.z for v in B.bm.verts)
real_length = hi_x - lo_x


def norm(co):
    return Vector(((co.x - (lo_x + hi_x) / 2) / real_length, co.y / real_length, (co.z - lo_z) / real_length))


# --------------------------------------------------------------------------
# Skeleton joints (build units) and skin weights, decided from the rings each
# vertex belongs to. Vertex indices are taken before the bmesh is written out.
loin = Vector((-half * 0.4, 0, zc + ch * (1 - P['tuck']) * 0.6 + sl * 0.5))
rump = Vector((-half + 0.02, 0, zc + ch * 0.05 + sl))
ribs = Vector((half * 0.25, 0, zc))
chest_front = Vector((half, 0, zc - ch * 0.02))
tail_base = Vector((-half - 0.03, 0, zc + ch * 0.25 + sl))
TORSO_SEGMENTS = [('pelvis', loin, rump), ('spine', loin, ribs), ('chest', ribs, chest_front),
                  ('neck', neck_base, head_back)]
# Per leg ring (shoulder/hip → toe): {bone: weight}. Front: upperarm p0→p1,
# forearm p1→p3, wrist p3→p4, paw p4→p5. Rear: thigh p0→p2, shin p2→p3,
# hock p3→p4, hind_paw p4→p5.
FRONT_RINGS = [{'chest': .4, 'upperarm': .6}, {'upperarm': .5, 'forearm': .5}, {'forearm': 1},
               {'forearm': .5, 'wrist': .5}, {'wrist': .4, 'paw': .6}, {'paw': 1}]
REAR_RINGS = [{'pelvis': .4, 'thigh': .6}, {'thigh': 1}, {'thigh': .5, 'shin': .5},
              {'shin': .5, 'hock': .5}, {'hock': .4, 'hind_paw': .6}, {'hind_paw': 1}]
B.bm.verts.index_update()
weights = {}
if not LEGACY:
    for ring_v, c in zip(torso_vs, centers):
        w = rig.segment_weights(c, TORSO_SEGMENTS)
        for v in ring_v:
            weights[v.index] = w
    for li, vs in enumerate(leg_vs):
        side = 'L' if li < 2 else 'R'
        table = FRONT_RINGS if li % 2 == 0 else REAR_RINGS
        for ring_v, rw in zip(vs, table):
            w = {(b if b in ('chest', 'pelvis') else f'{b}.{side}'): x for b, x in rw.items()}
            for v in ring_v:
                weights[v.index] = w

for v in B.bm.verts:
    v.co = norm(v.co)
dog = B.to_object('dog')
me = dog.data
tris = len(me.polygons)

even_uvs(dog, UV_TILE)

# UV2: dog-space side projection for region patterns, baked from the rest pose
# so it sticks to the mesh when animated. The body (rump to top of neck) takes
# u 0..BODY_U and heads take the face window BODY_U..1 (build_heads.py), which is
# how the region masks are drawn. v: floor (0) to top of the body (1).
BODY_U = 1.0 if LEGACY else 0.76
height = max(v.co.z for v in me.vertices)


def add_projection(obj):
    m = obj.data
    proj = m.uv_layers.new(name='Projection')
    for loop in m.loops:
        co = m.vertices[loop.vertex_index].co
        proj.data[loop.index].uv = ((co.x + 0.5) * BODY_U, co.z / height)
    m.uv_layers.active = m.uv_layers['UVMap']


add_projection(dog)
mat = bpy.data.materials.new('dog')
me.materials.append(mat)

# Coat shells as separate meshes in the same file; a breed shows one or none.
for coat, tubes in COATS.items():
    S = Builder()
    for kind, *spec in tubes:
        if kind == 'tube':
            tube_rings, cap = spec
            S.tube([[norm(p) for p in ring] for ring in tube_rings], cap_start=cap, cap_end=False)
        else:
            center, radius = spec
            res = bmesh.ops.create_icosphere(S.bm, subdivisions=2, radius=radius / real_length)
            bmesh.ops.translate(S.bm, vec=norm(center), verts=res['verts'])
    obj = S.to_object(f'coat_{coat}')
    even_uvs(obj, UV_TILE)
    add_projection(obj)
    obj.data.materials.append(mat)
    print('COAT', coat, len(obj.data.polygons), 'tris')

for name, pos, scale in sockets:
    e = bpy.data.objects.new(name, None)
    e.location = norm(pos)
    e.scale = (scale / real_length,) * 3
    # Same convention as TEXCOORD_1 in the exported glTF (V is flipped on export).
    e['uv2'] = [(e.location.x + 0.5) * BODY_U, 1 - e.location.z / height]
    if name == 'socket_head':
        e['ear_scale'] = P['ear_scale']   # ears attach to the head; this keeps per-build ear size
    bpy.context.scene.collection.objects.link(e)

# Skeleton, skinning, and sockets riding on their bones.
if not LEGACY:
    bones = [('root', norm(Vector((loin.x, 0, 0))), norm(Vector((loin.x, 0, zc * 0.3))), None),
             ('spine', norm(loin), norm(ribs), 'root'),
             ('pelvis', norm(loin), norm(rump), 'spine'),
             ('chest', norm(ribs), norm(chest_front), 'spine'),
             ('neck', norm(neck_base), norm(head_back), 'chest'),
             ('head', norm(head_back), norm(head_back + Vector((hh * 1.5, 0, 0))), 'neck'),
             ('tail', norm(tail_base), norm(tail_base + Vector((-P['tail_len'] * 0.3, 0, P['tail_len'] * 0.1))), 'pelvis'),
             # Prop protocol bones (no skin): `jaw` rotation opens the head part's
             # jaw; `grip` scale 1/0 = toy held / let go.
             ('jaw', norm(head_back + Vector((P['skull_len'], 0, -hh * 0.4))),
              norm(head_back + Vector((P['skull_len'] + P['snout_len'], 0, -hh * 0.5))), 'head'),
             ('grip', norm(Vector((loin.x, 0, 0))), norm(Vector((loin.x, 0, zc * 0.15))), 'root')]
    for side, (fpts, _), (rpts, _) in zip('LR', front_legs, rear_legs):
        f = [norm(p) for p in fpts]
        r = [norm(p) for p in rpts]
        bones += [(f'upperarm.{side}', f[0], f[1], 'chest'), (f'forearm.{side}', f[1], f[3], f'upperarm.{side}'),
                  (f'wrist.{side}', f[3], f[4], f'forearm.{side}'), (f'paw.{side}', f[4], f[5], f'wrist.{side}'),
                  (f'thigh.{side}', r[0], r[2], 'pelvis'), (f'shin.{side}', r[2], r[3], f'thigh.{side}'),
                  (f'hock.{side}', r[3], r[4], f'shin.{side}'), (f'hind_paw.{side}', r[4], r[5], f'hock.{side}')]
    arm = rig.build_armature(bones)
    rig.skin(dog, arm, weights)
    for o in list(bpy.context.scene.objects):
        if o.name.startswith('coat_'):
            rig.copy_weights(o, dog)
            rig.attach(o, arm)
    rig.parent_to_bone(bpy.data.objects['socket_head'], arm, 'head')
    rig.parent_to_bone(bpy.data.objects['socket_tail'], arm, 'tail')
    print('RIG', len(bones), 'bones', len(weights), 'weighted verts of', len(me.vertices))
    # Debug: --pose-test <out.png> renders a test pose to check rotation signs.
    if '--pose-test' in args:
        out = os.path.abspath(args[args.index('--pose-test') + 1])
        for pname, pose in anims.POSES.items():
            anims.render_pose(arm, [dog], pose, out.replace('.png', f'-{pname}.png'))
        sys.exit(0)
    anims.HEAD_H = hh * 2 / real_length
    # Debug: --probe sit,lie prints where the solver put the body for those poses.
    if '--probe' in args:
        import solver
        solver.init(arm, anims.apply_pose)
        anims.apply_pose(arm, {})
        bpy.context.view_layer.update()
        solver.INFO['floor'] = anims.lowest_point([dog])
        import clips_more
        names = args[args.index('--probe') + 1].split(',')
        for pname in names:
            pose = anims.POSES.get(pname) or getattr(anims, pname, None) or getattr(clips_more, pname)
            anims.resolve_state(arm, dog, pose)
            solver.probe(arm, dog, f'{build_name}:{pname}')
        sys.exit(0)
    # --only a,b bakes just those clips (fast iteration; rebuild fully before committing).
    only = args[args.index('--only') + 1].split(',') if '--only' in args else None
    anims.bake_all(arm, dog, only)
    arm['looping_clips'] = anims.LOOPING

export(dst)
print('DOG', build_name, tris, 'tris', len(me.vertices), 'verts', f'length {real_length:.2f}')

# --------------------------------------------------------------------------
# Classic head: the previous revision's head (squared-off rings swept from the
# skull to the nose, sized by this build's head settings) exported as a head
# part, so it keeps the old look but stays swappable like the other heads.
# Head-part space: origin at socket_head, units of 2 x head half-height.
if not LEGACY:
    head_mid = head_back + Vector((P['skull_len'] * 0.45, 0, 0.012))
    head_front = head_back + Vector((P['skull_len'], 0, -0.005))
    snout_mid = head_front + Vector((P['snout_len'] * 0.5, 0, -P['stop'] - hh * 0.25))
    snout_tip = head_front + Vector((P['snout_len'], 0, -P['stop'] - hh * 0.3))
    sw, sh = P['snout']
    hctrl = [
        (head_back.x - hh * 0.25, head_back.z - hh * 0.1, hw * 0.75, hh * 0.8, 0.0),   # tucks into the neck
        (head_back.x, head_back.z, hw * 0.9, hh * 0.95, 0.0),
        (head_mid.x, head_mid.z - hh * 0.08, hw * 1.1, hh, 0.0),
        (head_front.x, head_front.z - P['stop'] * 0.5, hw * 0.78, hh * 0.72, 0.0),
        (snout_mid.x, snout_mid.z, sw, sh, 0.0),
        (snout_tip.x, snout_tip.z, sw * 0.9, sh * 0.85, 0.0),
    ]
    hs = catmull(hctrl, 2)
    hc = [Vector((x[0], 0, x[1])) for x in hs]
    unit = hh * 2

    def to_head(p):
        return (p - head_back) / unit

    H = Builder()
    H.tube([[to_head(p) for p in ring_points(hc[i], hc[min(i + 1, len(hc) - 1)] - hc[max(i - 1, 0)],
                                               x[2], x[3], SIDES, exp=5.0)] for i, x in enumerate(hs)])
    for side in (1, -1):
        res = bmesh.ops.create_uvsphere(H.bm, u_segments=6, v_segments=4, radius=hh * P['eye'] / unit)
        bmesh.ops.translate(H.bm, vec=to_head(head_front + Vector((-0.004, side * hw * 0.84, hh * 0.3 - P['stop'] * 0.3))),
                            verts=res['verts'])
        H.tag_new(res['verts'], 'eye')
    res = bmesh.ops.create_cube(H.bm, size=1.0)
    nv = res['verts']
    nk = STYLE['nose']
    bmesh.ops.scale(H.bm, vec=(0.03 * hh / 0.075 * nk / unit, min(sw * 1.2, hw * 0.6) * nk / unit,
                               min(sh * 0.8, hh * 0.45) * nk / unit), verts=nv)
    for v in nv:
        if v.co.x > 0:
            v.co.y *= 0.75
            v.co.z *= 0.8
    bmesh.ops.translate(H.bm, vec=to_head(snout_tip + Vector((0.004, 0, sh * 0.35))), verts=nv)
    H.tag_new(nv, 'nose')

    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    # Lower jaw: muzzle faces below the muzzle's centre line, hinged at the stop.
    m_mid, m_tip = to_head(snout_mid), to_head(snout_tip)
    hinge = Vector((to_head(head_front).x, 0, m_mid.z))

    def below_muzzle_line(c):
        t = max(0.0, min(1.0, (c.x - m_mid.x) / max(m_tip.x - m_mid.x, 1e-6)))
        return c.x > hinge.x - 0.02 and c.z < m_mid.z + (m_tip.z - m_mid.z) * t - 0.01

    jaw = split_jaw(H, below_muzzle_line, hinge)
    head = H.to_object('head')
    jaw.parent = head
    even_uvs(head, 2 * UV_TILE)
    # Face window of the region masks (same mapping as build_heads.py): the stop
    # lands on u = 0.87 so face masks cover the muzzle and eyes.
    hm = head.data
    xs = [v.co.x for v in hm.vertices]
    zs = [v.co.z for v in hm.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    x_stop = to_head(head_front).x - 0.03

    def face_uv(co):
        u = (0.76 + 0.11 * (co.x - x0) / (x_stop - x0) if co.x < x_stop
             else 0.87 + 0.13 * (co.x - x_stop) / (x1 - x_stop))
        return (u, 0.45 + 0.55 * (co.z - z0) / (z1 - z0))

    proj = hm.uv_layers.new(name='Projection')
    for loop in hm.loops:
        proj.data[loop.index].uv = face_uv(hm.vertices[loop.vertex_index].co)
    hm.uv_layers.active = hm.uv_layers['UVMap']
    hmat = bpy.data.materials.new('dog')
    hm.materials.append(hmat)
    even_uvs(jaw, 2 * UV_TILE)
    jm = jaw.data   # stored relative to the hinge
    jproj = jm.uv_layers.new(name='Projection')
    for loop in jm.loops:
        jproj.data[loop.index].uv = face_uv(jm.vertices[loop.vertex_index].co + jaw.location)
    jm.uv_layers.active = jm.uv_layers['UVMap']
    jm.materials.append(hmat)
    for side, nm in ((1, 'socket_ear_L'), (-1, 'socket_ear_R')):
        e = bpy.data.objects.new(nm, None)
        e.location = to_head(head_back + Vector((P['skull_len'] * 0.22, side * hw * 0.6, hh * 0.86)))
        e.scale = (0.5,) * 3          # x the build's ear_scale and head size in the viewer = hh * ear_scale
        u, v = face_uv(e.location)
        e['uv2'] = [u, 1 - v]
        bpy.context.scene.collection.objects.link(e)
    for nm, pos in (('socket_mouth', snout_mid + Vector((P['snout_len'] * 0.2, 0, -sh * 0.9))),
                    ('socket_nose', snout_mid + Vector((0, 0, sh * 1.05)))):
        e = bpy.data.objects.new(nm, None)
        e.location = to_head(pos)
        bpy.context.scene.collection.objects.link(e)
    head_dst = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(dst))), 'heads', f'classic-{build_name}.glb')
    export(head_dst)
    print('HEAD classic', build_name, len(hm.polygons), 'tris')
