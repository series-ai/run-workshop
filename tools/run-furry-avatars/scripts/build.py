"""Build one rigged, recolourable low-poly anthro and export it as a GLB.

    Blender -b --factory-startup -t 1 --python scripts/build.py -- <species> <out.glb> [--variant B] [--render <dir>]

The GLB holds a shared skeleton (`rig`) and separate skinned meshes, so parts
swap and every material is a colour region (see anthro.REGIONS):
  body    torso and legs           arms    arms and mitten paws
  head    head, muzzle, nose       eyes    eyes and lids
  ears, hair, tail, tuft (chest fluff), claws
  top     hoodie                   bottom  cargo shorts

Proportions come from a VARIANT (head size, chest, hips); everything else is
shared, so variants are easy to compare side by side.
"""
import math
import os
import sys

import bpy
from mathutils import Euler

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import anthro as A  # noqa: E402
from anthro import C, V  # noqa: E402

SPECIES = {
    "wolf": dict(
        colours=dict(fur=C(112, 128, 158), fur_light=C(226, 232, 242), fur_dark=C(78, 90, 120), hair=C(52, 168, 150),
                     inner_ear=C(214, 220, 232), nose=C(28, 28, 34), pads=C(58, 60, 76), claws=C(40, 40, 48),
                     eye_white=C(244, 244, 240), iris=C(120, 150, 140), pupil=C(20, 22, 26), shine=C(255, 255, 255),
                     mouth=C(40, 42, 52), cloth_top=C(34, 34, 38), cloth_top_trim=C(44, 44, 50), cloth_bottom=C(46, 46, 52),
                     cloth_bottom_trim=C(56, 56, 62), accessory=C(200, 60, 60), horn=C(232, 222, 196)),
    ),
}

# head: head scale; chest: chest and shoulder breadth; hips: hip and waist width.
VARIANTS = {
    "A": dict(head=1.25, chest=1.1, hips=0.92),
    "B": dict(head=1.42, chest=1.3, hips=0.8),
    "C": dict(head=1.6, chest=1.45, hips=0.72),
}

# Proportion knobs matched to the concept with scripts/overlay.py (silhouette overlays, side and 3/4).
TUNE_OVERRIDE = {k: float(v) for k, v in (kv.split("=") for kv in os.environ.get("TUNE", "").split(",") if kv)}
TUNE = dict(
    hand=1.3,         # hand and finger size
    arm_out=0.1,     # how far the elbows and hands hang out from the body
    shoulder_z=1.395,  # shoulder joint height: lower slopes the shoulders
    torso_depth=1.12,  # chest and belly depth, front and back
    hood=1.15,          # size of the hood bunched behind the neck
    leg_depth=1.22,    # lower leg depth (front to back) and calf
    leg_width=1.08,    # lower leg width
    heel_back=0.075,     # how far behind the knee line the heel sits
    toe_len=1.55,      # toe length (paw length front to back)
    stance=0.105,      # paw x (feet apart)
    tail_r=1.4,        # tail thickness
    tail_drop=0.11,    # how much lower the tail hangs
    head_tilt=3.0,     # degrees nose-up
    jaw=0.72,          # depth under the muzzle and jaw
    hair=1.4,          # hair lock size
    arm_fwd=0.07,      # hands hang this far in front of the hips
    chest_front=0.9,   # forward push of the chest (the hoodie belly carries more of the volume)
    knee_y=0.0,     # knee forward of the hip
    ball_y=-0.1,     # where the toes start
    wrist_z=0.97,      # hand height
    toe_r=1.2,         # toe thickness
    toe_out=10.0,      # paws turned out, degrees
    ear_spread=1.2,    # ears further apart
    knee_z=0.54,       # knee height (a higher knee = a shorter thigh and a longer shin)
    hock_z=0.28,        # heel height (a higher heel = a longer metatarsal)
    thigh=1.0,         # thigh girth
)

TUNE.update(TUNE_OVERRIDE)   # e.g. TUNE=knee_z=0.62,hock_z=0.24 for quick experiments

argv = sys.argv[sys.argv.index("--") + 1:]
species, out = argv[0], argv[1]
variant = argv[argv.index("--variant") + 1] if "--variant" in argv else "B"
render_dir = argv[argv.index("--render") + 1] if "--render" in argv else None
S = SPECIES[species]
P = VARIANTS[variant]
KH, KC, KP = P["head"], P["chest"], P["hips"]

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = A.materials(S["colours"])
FRONT = (0, -1, 0)

# ---------------------------------------------------------------- joints
HC0 = V((0, 0.0, 1.635))          # where the head is authored (at scale 1)
from parts import JAW_PIVOT as P_JAW  # noqa: E402
HP = V((0, 0.0, 1.52))             # the head grows from here: the chin stays put, the head gets bigger upward and forward
HC = HP + (HC0 - HP) * KH         # head centre after scaling


def hs(p):
    """A point authored on the unscaled head, moved onto the scaled, tilted one."""
    from mathutils import Matrix
    return HP + Matrix.Rotation(math.radians(-TUNE["head_tilt"]), 3, "X") @ ((V(p) - HP) * KH)


J = {"pelvis": V((0, 0.0, 0.98)), "spine": V((0, 0.01, 1.12)), "chest": V((0, -0.01, 1.30)), "neck": V((0, 0.02, 1.48)),
     "head": V((0, 0.01, 1.53)), "head_top": hs((0, 0.01, 1.78)),
     "jaw": hs(HC0 + V((0, P_JAW[0], P_JAW[1]))), "jaw_tip": hs(HC0 + V((0, P_JAW[0] - 0.2, P_JAW[1] - 0.01)))}
SH = 0.215 * KC                   # shoulder joint x
for s, sd in (("L", 1), ("R", -1)):
    X = lambda x, y, z: V((sd * x, y, z))  # noqa: E731
    dx = SH - 0.225
    ao = TUNE["arm_out"]
    J.update({f"shoulder.{s}": X(SH, 0.02, TUNE["shoulder_z"]), f"elbow.{s}": X(0.29 + dx + ao * 0.6, 0.05 - TUNE["arm_fwd"] * 0.3, 1.15),
              f"wrist.{s}": X(0.322 + dx + ao, -TUNE["arm_fwd"], TUNE["wrist_z"]),
              f"knuckle.{s}": X(0.336 + dx + ao * 1.1, -0.01 - TUNE["arm_fwd"], TUNE["wrist_z"] - 0.1 * TUNE["hand"]),
              f"fingertip.{s}": X(0.342 + dx + ao * 1.15, -0.02 - TUNE["arm_fwd"], TUNE["wrist_z"] - 0.22 * TUNE["hand"]),
              f"hip.{s}": X(0.1 * KP + 0.01, 0.0, 0.95), f"knee.{s}": X(0.1 * KP + 0.01, TUNE["knee_y"], TUNE["knee_z"]),
              f"hock.{s}": X(TUNE["stance"], TUNE["heel_back"], TUNE["hock_z"]), f"ball.{s}": X(TUNE["stance"], TUNE["ball_y"], 0.065),
              f"toe.{s}": X(TUNE["stance"], TUNE["ball_y"] - 0.12 * TUNE["toe_len"], 0.04),
              f"ear.{s}": hs(HC0 + X(0.058, 0.03, 0.06)), f"ear_tip.{s}": hs(HC0 + X(0.084 * TUNE["ear_spread"], 0.012, 0.29))})
TAIL_CTRL = [(0, 0.12, 0.99), (0, 0.27, 0.93 - TUNE["tail_drop"] * 0.4), (0, 0.42, 0.84 - TUNE["tail_drop"] * 0.8), (0, 0.58, 0.78 - TUNE["tail_drop"]),
             (0, 0.74, 0.77 - TUNE["tail_drop"] * 0.8), (0, 0.88, 0.84 - TUNE["tail_drop"] * 0.5)]
J["tail"] = [V(p) for p in A.catmull(TAIL_CTRL, 6)]


import parts as P  # noqa: E402

K = P.Kit(H0=HC0, J=J, TUNE=TUNE)


def mirror(fn):
    for s, sd in (("L", 1), ("R", -1)):
        fn(s, sd)


# ---------------------------------------------------------------- torso: a big dog chest over narrow hips
body = A.Mesh("body")
# (z, y, half width, front depth, back depth, which width scale: h hips / w waist / c chest / n none)
TORSO = [(0.85, 0.0, 0.16, 0.09, 0.1, "h"), (0.91, 0.0, 0.18, 0.105, 0.13, "h"), (0.99, 0.0, 0.17, 0.1, 0.12, "h"),
         (1.08, 0.0, 0.14, 0.095, 0.098, "w"), (1.2, -0.008, 0.17, 0.118, 0.11, "c"), (1.3, -0.012, 0.205, 0.13, 0.12, "c"),
         (1.385, -0.006, 0.2, 0.122, 0.125, "c"), (1.43, 0.0, 0.165, 0.108, 0.118, "c"), (1.47, 0.008, 0.145, 0.098, 0.094, "n"),
         (1.51, 0.014, 0.115, 0.092, 0.086, "n"), (1.6, 0.02, 0.095, 0.082, 0.08, "n")]
SCALE = {"h": KP, "w": (KP + KC) / 2 * 0.86, "c": KC, "n": 1.0}
TD = lambda k: TUNE["torso_depth"] if k != "n" else 1.0  # noqa: E731
TORSO = [(z, y * (KC if k == "c" else 1), w * SCALE[k], f * (1 + (KC - 1) * 0.55 if k == "c" else 1) * TD(k) * (TUNE["chest_front"] if k == "c" else 1), b * (1 + (KC - 1) * 0.4 if k == "c" else 1) * TD(k), k)
         for z, y, w, f, b, k in TORSO]
tr = A.catmull([t[:5] for t in TORSO], 18)
body.group("torso").loft([A.ring((0, y, z), (0, 0, 1), w, f, b, n=16, exp=2.9, up=FRONT) for z, y, w, f, b in tr], "fur")   # squarish, like the rest of the shape language
body_surf = A.Surface(body)

# ---------------------------------------------------------------- arms and mitten paws
arms = A.Mesh("arms")
claws = A.Mesh("claws")
ARM_R = [(0.108, 0.104), (0.092, 0.09), (0.074, 0.074), (0.08, 0.082), (0.08, 0.08), (0.068, 0.066)]
ARM_R = [(w * (1 + (KC - 1) * 0.5), d * (1 + (KC - 1) * 0.5)) for w, d in ARM_R]


def finger(mesh, base, down, inward, r, ln, region, claw_group, curl=1.0, knuckly=True):
    """One thick sausage finger or toe: a knuckle bulge at the base, a second
    knuckle halfway, a rounded end, curling toward `inward`. Returns the tip."""
    p0 = base
    p1 = p0 + down * ln * 0.5 + inward * ln * 0.12 * curl
    p2 = p1 + down * ln * 0.38 + inward * ln * 0.3 * curl
    d2 = (p2 - p1).normalized()
    pts = [p0, p0.lerp(p1, 0.5), p1, p1.lerp(p2, 0.55), p2, p2 + d2 * r * 0.55]
    # fingers get two knuckle bulges; toes stay smooth and round (bulges read as ribbing on short toes)
    rad = [r * 1.12, r * 0.94, r * 1.04, r * 0.94, r * 0.86, r * 0.5] if knuckly else [r * 1.0, r * 1.02, r * 1.02, r * 0.98, r * 0.88, r * 0.52]
    rs = [A.ring(p, pts[min(i + 1, 5)] - pts[max(i - 1, 0)], q, q * 0.95, n=8, up=inward) for i, (p, q) in enumerate(zip(pts, rad))]
    mesh.loft(rs, region)
    # a chunky claw out of the end, following the curl
    cdir = (d2 + inward * 0.35 * curl).normalized()
    cb = p2 + d2 * r * 0.25 - inward * r * 0.25
    claws.group(claw_group).loft([A.ring(cb, cdir, r * 0.42, r * 0.32, n=5, up=inward)], "claws", tip1=cb + cdir * r * 0.95 + inward * r * 0.2)
    return p2


def arm(s, sd):
    sh, el, wr = J[f"shoulder.{s}"], J[f"elbow.{s}"], J[f"wrist.{s}"]
    # the deltoid starts low and inside the torso so the shoulder line stays broad but doesn't poke up
    # Separate rigid pieces that overlap and clip into each other when the joint bends (cleaner
    # than skin stretching in a low-poly style): the upper arm starts inside the chest, the
    # forearm starts inside the upper arm.
    ua, fa = (el - sh).normalized(), (wr - el).normalized()
    (w0, d0), (w1, d1), (w2, d2), (w3, d3), (w4, d4), (w5, d5) = ARM_R
    arms.group(f"upperarm.{s}").loft([A.ring(sh - ua * 0.05 + V((-sd * 0.05, 0, 0)), ua, w0 * 0.7, d0 * 0.75, n=10, up=FRONT),
                                      A.ring(sh + V((-sd * 0.01, 0, -0.01)), ua, w0, d0, n=10, up=FRONT), A.ring(sh.lerp(el, 0.5), ua, w1, d1, n=10, up=FRONT),
                                      A.ring(el, ua, w2, d2, n=10, up=FRONT), A.ring(el + ua * 0.035, ua, w2 * 0.75, d2 * 0.75, n=10, up=FRONT)], "fur",
                                     tip1=el + ua * 0.055)
    arms.group(f"forearm.{s}").loft([A.ring(el - fa * 0.03, fa, w2 * 0.85, d2 * 0.85, n=10, up=FRONT), A.ring(el.lerp(wr, 0.35), fa, w3, d3, n=10, up=FRONT),
                                     A.ring(el.lerp(wr, 0.75), fa, w4, d4, n=10, up=FRONT), A.ring(wr, fa, w5, d5, n=10, up=FRONT)], "fur")
    # A big hand like the concept's: a broad palm and four thick, separate
    # fingers with chunky knuckles and claws, plus a thick thumb.
    arms.group(f"hand.{s}")
    down = (J[f"fingertip.{s}"] - wr).normalized()
    inward = V((-sd, 0, 0))
    # palm: (distance down, thickness across, width front-back)
    kh = TUNE["hand"]
    M = [(d * kh, w * kh, h * kh) for d, w, h in ((0.0, 0.06, 0.068), (0.04, 0.064, 0.088), (0.085, 0.058, 0.1), (0.1, 0.05, 0.096))]
    arms.loft([A.ring(wr + down * d, down, w, h, n=10, up=FRONT) for d, w, h in M], "fur_dark")
    for k, (dy, r, ln) in enumerate(((-0.07, 0.03, 0.115), (-0.024, 0.034, 0.13), (0.024, 0.034, 0.128), (0.068, 0.029, 0.108))):
        dy, r, ln = dy * kh, r * kh, ln * kh
        base = wr + down * 0.092 * kh + V((0, dy, 0)) - inward * 0.006
        tip = finger(arms, base, down, inward, r, ln, "fur_dark", f"hand.{s}", curl=0.3 + 0.08 * k)
        bean = tip - down * 0.012 + inward * r * 0.85
        arms.loft([A.ring(bean, inward, r * 0.62, r * 0.55, n=8, up=(0, 0, 1)), A.ring(bean + inward * 0.007, inward, r * 0.45, r * 0.4, n=8, up=(0, 0, 1))],
                  "pads")
    pad = wr + down * 0.05 * kh + inward * 0.058 * kh
    arms.loft([A.ring(pad, inward, 0.038, 0.032, n=10, up=(0, 0, 1)), A.ring(pad + inward * 0.011, inward, 0.028, 0.024, n=10, up=(0, 0, 1))], "pads")
    # thumb: thick, from the front of the palm, angled down toward the body
    tb = wr + down * 0.035 * kh + V((0, -0.072 * kh, 0)) + inward * 0.014
    finger(arms, tb, (down + V((0, -0.5, 0)) + inward * 0.3).normalized(), inward, 0.034 * kh, 0.09 * kh, "fur_dark", f"hand.{s}", curl=0.6)


mirror(arm)

# ---------------------------------------------------------------- digitigrade legs ending in big toes
# (half width, front depth, back depth) at: thigh top, mid thigh, knee, calf, lower shin, heel, ankle, ball.
# Seen from the front the leg reads as shapes, not a column: a big thigh, a narrower knee, a calf, a
# taper to the heel, then the ankle widens again into the paw. The heel sticks out behind as a knob.
# (half width, front depth, back depth) per leg piece. Big rounded fursuit thighs; a shin with
# a calf; a cannon (metatarsal) that tapers to the ankle then widens into the paw.
KT = TUNE["thigh"]
THIGH = [(0.1, 0.11, 0.11), (0.135 * KT, 0.142 * KT, 0.15 * KT), (0.14 * KT, 0.145 * KT, 0.15 * KT), (0.115 * KT, 0.12 * KT, 0.12 * KT), (0.088, 0.092, 0.092)]
SHIN = [(0.08, 0.08, 0.085), (0.092, 0.072, 0.118), (0.08, 0.066, 0.096), (0.074, 0.062, 0.088)]
CANNON = [(0.07, 0.064, 0.07), (0.072, 0.066, 0.066), (0.078, 0.072, 0.062), (0.1, 0.084, 0.064)]


def leg(s, sd):
    h, k, hk, b = J[f"hip.{s}"], J[f"knee.{s}"], J[f"hock.{s}"], J[f"ball.{s}"]
    lw, ld = TUNE["leg_width"], TUNE["leg_depth"]
    th, sh_, mt = (k - h).normalized(), (hk - k).normalized(), (b - hk).normalized()
    R = lambda p, t, r, kw=1.0, kd=1.0: A.ring(p, t, r[0] * kw, r[1] * kd, r[2] * kd, n=10, up=FRONT)  # noqa: E731
    # thigh: from deep inside the hip, a big round fursuit thigh, ending in a rounded knee that overlaps the shin
    top = h + V((-sd * 0.02, 0.0, 0.1))
    body.group(f"thigh.{s}").loft([R(top, th, THIGH[0]), R(h.lerp(k, 0.25) + V((sd * 0.008, 0, 0)), th, THIGH[1]), R(h.lerp(k, 0.55), th, THIGH[2]),
                                   R(h.lerp(k, 0.85), th, THIGH[3]), R(k, th, THIGH[4]), R(k + th * 0.04, th, THIGH[4], 0.7, 0.7)], "fur", tip1=k + th * 0.07)
    # shin: starts inside the knee, a calf bulge behind, a heel knob at the hock
    body.group(f"shin.{s}").loft([R(k - sh_ * 0.05, sh_, SHIN[0], lw, ld), R(k.lerp(hk, 0.3) + V((0, 0.012, 0)), sh_, SHIN[1], lw, ld),
                                  R(k.lerp(hk, 0.75), sh_, SHIN[2], lw, ld), R(hk + V((0, 0.01, 0)), sh_, SHIN[3], lw, ld),
                                  R(hk + sh_ * 0.03, sh_, SHIN[3], 0.7 * lw, 0.7 * ld)], "fur", tip1=hk + sh_ * 0.055)
    # cannon: starts inside the shin above the hock and runs down into the paw
    body.group(f"cannon.{s}").loft([R(hk - mt * 0.045, mt, CANNON[0], lw, ld), R(hk.lerp(b, 0.35), mt, CANNON[1], lw, ld),
                                    R(hk.lerp(b, 0.75), mt, CANNON[2], lw, ld), R(b, mt, CANNON[3], lw, ld), R(b + mt * 0.03, mt, CANNON[3], 0.8 * lw, 0.8 * ld)],
                                   "fur", tip1=b + mt * 0.05)
    # Digitigrade: there is no flat foot. The leg ends in four big toes in an
    # arc, each a fat rounded toe with a knuckle on top and a claw, like the concept.


feet = {k: A.Mesh(f"feet_{k}") for k in P.FEET}
paw_claws = A.Mesh("claws_paws")   # the toe claws belong to the paws only (other feet bring their own)


def paws(s, sd):
    """The default feet: four big toes lying flat on the floor in a gentle arc, each a fat
    sausage with a flat-ish sole, a knuckle hump on top and a claw (claws are their own part)."""
    b = J[f"ball.{s}"]
    m = feet["paws"].group(f"toes.{s}")
    for k, (dx, r, ln, splay, back) in enumerate(((-0.088, 0.05, 0.108, -0.12, 0.022), (-0.031, 0.057, 0.122, -0.03, 0.0), (0.031, 0.057, 0.122, 0.03, 0.0),
                                                 (0.088, 0.05, 0.108, 0.12, 0.022))):
        ln *= TUNE["toe_len"]
        r *= TUNE["toe_r"]
        d = V((sd * (splay + math.tan(math.radians(TUNE["toe_out"]))), -1, 0)).normalized()
        hb = r * 0.8   # the sole is flatter than the top
        base = V((b.x + sd * dx, b.y + 0.02 + back, hb + 0.002))
        pts = [base, base + d * ln * 0.45 + V((0, 0, r * 0.12)), base + d * ln * 0.82, base + d * (ln * 0.82 + r * 0.55)]
        rad = [(r, r * 1.3, hb), (r * 1.04, r * 1.4, hb), (r * 0.94, r * 1.15, hb * 0.92), (r * 0.55, r * 0.6, hb * 0.5)]   # domed tops
        rs = []
        for i, (p, (w, ht, hb_)) in enumerate(zip(pts, rad)):
            p = V((p.x, p.y, max(p.z, hb_ + 0.002)))
            rs.append(A.ring(p, pts[min(i + 1, 3)] - pts[max(i - 1, 0)], w, ht, hb_, n=10, exp=2.4, up=(0, 0, 1)))
        m.loft(rs, "fur")
        tipc = pts[2] + d * r * 0.6 + V((0, 0, r * 0.1))
        paw_claws.group(f"toes.{s}").loft([A.ring(tipc, d + V((0, 0, -0.35)), r * 0.42, r * 0.3, n=5, up=(0, 0, 1))], "claws",
                                         tip1=tipc + (d + V((0, 0, -0.3))).normalized() * r * 0.75)
        bean = pts[1] + V((0, 0, -hb * 0.82))   # a toe bean under each toe, tucked under the sole (seen when the paw lifts)
        m.loft([A.ring(bean, (0, 0, -1), r * 0.5, r * 0.45, n=8, up=(0, -1, 0)), A.ring(bean + V((0, 0, -0.004)), (0, 0, -1), r * 0.38, r * 0.34, n=8, up=(0, -1, 0))],
               "pads")
    for kind in P.FEET[1:]:
        P.build_feet(K, feet[kind].group(f"toes.{s}"), kind, s, sd)


mirror(leg)
mirror(paws)

for s, sd in (("L", 1), ("R", -1)):   # two round butt cheeks behind the hips (the tail sits between them)
    c0 = V((sd * 0.07 * KP, 0.07, 0.95))
    body.group("glutes").loft([A.ring(c0 + V((0, -0.08, 0.01)), (0, 1, 0), 0.1, 0.13, n=10, up=(0, 0, 1)), A.ring(c0, (0, 1, 0), 0.13, 0.145, n=10, up=(0, 0, 1)),
                               A.ring(c0 + V((0, 0.06, -0.015)), (0, 1, 0), 0.105, 0.115, n=10, up=(0, 0, 1))], "fur", tip1=c0 + V((0, 0.095, -0.02)))


def socks(c, n, r):
    if r == "fur" and c.z < 0.4:
        return "fur_dark"


def gloves(c, n, r):
    if r == "fur" and c.z < 1.0:
        return "fur_dark"


def blaze(c, n, r):
    """The white throat, chest and belly."""
    if r == "fur" and 1.36 < c.z < 1.66 and n.y < -0.25 and abs(c.x) < 0.08 + (c.z - 1.36) * 0.1:
        return "fur_light"
    if r == "fur" and 1.0 < c.z <= 1.36 and n.y < -0.45 and abs(c.x) < (0.06 + (c.z - 1.0) * 0.15) * KC:
        return "fur_light"


body.paint(socks, only=["shin.L", "shin.R", "cannon.L", "cannon.R"])   # the toes keep the lighter fur, like the concept
body.paint(blaze, only=["torso"])
arms.paint(gloves)

# chest fluff: a chunky bib of big tufts from the throat down over the collar
tuft = A.Mesh("tuft").group("torso")
for x, z, ln, w in ((0.0, 1.4, 0.18, 0.1), (-0.07, 1.43, 0.14, 0.085), (0.07, 1.43, 0.14, 0.085)):
    hit = body_surf.hit(V((x * KC, -0.5, z)), V((0, 1, 0)))
    b0 = hit[0] + V((0, 0.012, 0))
    tip = b0 + V((x * 0.6, -0.09, -ln)).normalized() * ln
    tuft.loft([A.ring(b0, tip - b0, w, w * 0.55, n=6, up=FRONT, roll=0), A.ring(b0.lerp(tip, 0.5), tip - b0, w * 0.82, w * 0.45, n=6, up=FRONT)], "fur_light",
              tip1=tip)

# ---------------------------------------------------------------- head (authored at scale 1, scaled about HP at the end)
H0 = HC0
bare = A.Mesh("skull_tmp")   # the bare shared skull: eyes and hairstyles are fitted to it, so they fit every head
P.build_skull(K, bare)
surf = A.Surface(bare)
heads = {}
snout_surfs = {}   # snout profile -> a head surface with that snout (skull + snout), for fitting teeth
for sp, R_ in P.SPECIES.items():
    hm = A.Mesh(f"head_{sp}")
    P.build_skull(K, hm)
    f0 = len(hm.bm.faces)
    rows = P.build_snout(K, hm, R_["snout"])
    P.face_paint(K, hm, R_["mask"], f0)
    hs_ = A.Surface(hm)
    P.face_marks(K, hm, R_["mask"], hs_, rows)
    snout_surfs.setdefault(R_["snout"], hs_)
    P.build_nose(K, hm, R_["snout"], rows, hs_)
    P.build_mouth(K, hm, R_["snout"], rows, hs_)
    P.build_extras(K, hm, R_["extras"], hs_)
    P.split_jaw(K, hm, R_["snout"])
    heads[sp] = hm

# cheek tufts: a swappable part on the shared skull
cheek_meshes = {}
for st in P.CHEEKS:
    cm = A.Mesh(f"cheeks_{st}")
    P.build_cheeks(K, cm, st)
    cheek_meshes[st] = cm

# teeth: every style fitted to every snout profile; the editor shows teeth_<style>__<snout of the chosen head>
teeth_meshes = {}
for snout, hs_ in snout_surfs.items():
    for st in P.TEETH:
        tm = A.Mesh(f"teeth_{st}__{snout}")
        P.build_teeth(K, tm, st, snout, hs_)
        teeth_meshes[f"{st}__{snout}"] = tm

EYE_STYLES = ["almond", "round", "sharp", "sleepy", "happy", "slit", "dot"]
eye_meshes = {st: A.Mesh(f"eyes_{st}") for st in EYE_STYLES}


def eye(s, sd):
    centre = H0 + V((sd * 0.15, -0.19, 0.035))
    toward = V((-sd * 0.62, 0.78, -0.03))
    p_c, n_c = surf.hit(centre, toward)
    up = (V((0, 0, 1)) - n_c * n_c.z).normalized()
    side = -(up.cross(n_c)).normalized()
    outer = 1 if side.x * sd > 0 else -1   # which local x is the outer corner
    at = lambda pts: [p_c + n_c * 0.03 + side * x + up * y for x, y in pts]  # noqa: E731
    D = lambda m, pts, region, lift: A.decal(m, surf, centre, toward, pts, region, lift=lift)  # noqa: E731
    L = lambda m, pts, w, region, lift=0.0068: A.strip(m, surf, at(pts), lambda p: -n_c, w, region, lift=lift)  # noqa: E731
    sh = lambda pts, dx, dy: [(x + dx, y + dy) for x, y in pts]  # noqa: E731
    tilt = outer * math.radians(10)
    # almond: calm and serious (the concept's)
    m = eye_meshes["almond"]
    D(m, A.almond(0.0442, 0.0234, n=12, tilt=tilt), "eye_white", 0.003)
    D(m, sh(A.disc(0.0175, 10, 0.0202), -outer * 0.008, -0.002), "iris", 0.0045)
    D(m, sh(A.disc(0.0097, 8, 0.0123), -outer * 0.008, -0.002), "pupil", 0.006)
    D(m, sh(A.disc(0.0059, 6), 0, 0.005), "shine", 0.0072)
    L(m, sorted((x, y + 0.0015) for x, y in A.almond(0.0442, 0.0234, n=12, tilt=tilt) if y > 0), 0.012, "mouth")
    # round: big and friendly, two shines
    m = eye_meshes["round"]
    D(m, A.disc(0.0312, 14, 0.0338), "eye_white", 0.003)
    D(m, sh(A.disc(0.0221, 12, 0.0247), -outer * 0.004, -0.002), "iris", 0.0045)
    D(m, sh(A.disc(0.0117, 10, 0.0143), -outer * 0.004, -0.002), "pupil", 0.006)
    D(m, sh(A.disc(0.0065, 8), outer * 0.004, 0.008), "shine", 0.0072)
    D(m, sh(A.disc(0.0033, 6), -outer * 0.008, -0.008), "shine", 0.0072)
    L(m, sorted((x, y + 0.001) for x, y in A.disc(0.0325, 14, 0.0351) if y > 0.008), 0.012, "mouth")
    # sharp: narrow, angled up at the outer corner, a small iris
    m = eye_meshes["sharp"]
    t2 = outer * math.radians(20)
    D(m, A.almond(0.0468, 0.0156, n=12, tilt=t2), "eye_white", 0.003)
    D(m, sh(A.disc(0.0137, 10, 0.0143), -outer * 0.005, 0), "iris", 0.0045)
    D(m, sh(A.disc(0.0065, 8, 0.0104), -outer * 0.005, 0), "pupil", 0.006)
    L(m, sorted((x, y + 0.003) for x, y in A.almond(0.0481, 0.0163, n=12, tilt=t2) if y > 0), 0.013, "mouth")
    # sleepy: half-lidded, the lid a band of fur over the top of the eye
    m = eye_meshes["sleepy"]
    D(m, A.almond(0.0442, 0.0234, n=12, tilt=tilt), "eye_white", 0.003)
    D(m, sh(A.disc(0.0175, 10, 0.0202), -outer * 0.005, -0.004), "iris", 0.0045)
    D(m, sh(A.disc(0.0097, 8, 0.0123), -outer * 0.005, -0.004), "pupil", 0.006)
    lid = [(x, max(y, -0.001)) for x, y in A.almond(0.0468, 0.0260, n=12, tilt=tilt)]
    D(m, lid, "fur", 0.0075)
    L(m, [(x, -0.001 + 0.0015 * math.sin(math.pi * (x + 0.03) / 0.06)) for x in (-0.034, -0.017, 0.0, 0.017, 0.034)], 0.008, "mouth", 0.0082)
    # happy: closed, a little upturned arc
    m = eye_meshes["happy"]
    L(m, [(x, 0.007 - 0.0012 * (x / 0.005) ** 2) for x in (-0.028, -0.014, 0.0, 0.014, 0.028)], 0.01, "mouth", 0.004)
    # slit: the whole eye coloured, a vertical slit pupil (dragons, cats)
    m = eye_meshes["slit"]
    D(m, A.almond(0.0442, 0.0234, n=12, tilt=tilt), "iris", 0.003)
    D(m, sh(A.disc(0.0059, 8, 0.0208), -outer * 0.003, 0), "pupil", 0.0045)
    D(m, sh(A.disc(0.0059, 6), outer * 0.009, 0.006), "shine", 0.006)
    L(m, sorted((x, y + 0.003) for x, y in A.almond(0.0442, 0.0234, n=12, tilt=tilt) if y > 0), 0.012, "mouth")
    # dot: simple toony dots
    m = eye_meshes["dot"]
    D(m, A.disc(0.0182, 10, 0.0247), "pupil", 0.003)
    D(m, sh(A.disc(0.0065, 6), outer * 0.004, 0.006), "shine", 0.0045)
    # the brow stays on the head for every style
    brow = [p_c + n_c * 0.03 + side * (outer * x) + up * (0.034 + 0.008 * (x / 0.04)) for x in (-0.04, -0.012, 0.016, 0.046)]
    for m in eye_meshes.values():
        A.strip(m, surf, brow, lambda p: -n_c, 0.03, "fur_dark", lift=0.006)


mirror(eye)

ear_meshes = {}
for name in P.EARS:
    if P.EARS[name] is None:
        continue
    em = A.Mesh(f"ears_{name}")
    P.build_ears(K, em, name)
    ear_meshes[name] = em

hair_meshes = {st: A.Mesh(f"hair_{st}") for st in P.HAIRS if st != "none"}
hair = None


def skull(yaw, pitch, lift):
    """A point on the head surface at (yaw, pitch) degrees seen from the head centre
    (yaw 0 = straight ahead, + = the character's left; pitch + = up), lifted off it."""
    yw, pt = math.radians(yaw), math.radians(pitch)
    d = V((math.sin(yw) * math.cos(pt), -math.cos(yw) * math.cos(pt), math.sin(pt)))
    hit = surf.hit(H0 + d * 0.6, -d)
    return (hit[0] + hit[1] * lift) if hit else H0 + d * 0.12


def lock(path, width, thick=0.022):
    """A big lock of hair lying along the skull: path = [(yaw, pitch, lift), ...];
    the last point is the tip, lifted off the head."""
    pts = [skull(*p) for p in path]
    rings = []
    for i, p in enumerate(pts[:-1]):
        t = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        out = (p - H0).normalized()
        k = 1.0 - 0.25 * i / max(1, len(pts) - 2)
        rings.append(A.ring(p, t, width * k, thick, n=6, up=out, roll=0))
    hair.loft(rings, "hair", tip1=pts[-1])


kh = TUNE["hair"] ** 0.5
hair = hair_meshes["crest"]   # the concept's: a forelock swept over the brow, crown spikes, a mane down the back
for dy, w in ((-8, 0.08), (20, 0.07)):
    lock([(dy + 8, 84, 0.0), (dy, 66, 0.022), (dy - 6, 52, 0.048), (dy - 14, 40, 0.09)], w * kh, thick=0.04)
for yw, top in ((-10, 88), (14, 86)):
    lock([(yw, top, 0.0), (yw * 0.8, 74, 0.04), (yw * 0.6, 62, 0.11)], 0.075 * kh, thick=0.042)
for yw, top, drop in ((180, 82, 74), (150, 74, 56), (-150, 74, 56)):
    lock([(yw, top, 0.0), (yw, top - drop * 0.4, 0.02), (yw, top - drop * 0.72, 0.045), (yw, top - drop, 0.09)], 0.075 * kh, thick=0.04)
hair = hair_meshes["mohawk"]   # a row of big spikes front to back
for k, pitch in enumerate((80, 95, 110, 125, 140)):
    yw = 0 if pitch <= 90 else 180
    pp = pitch if pitch <= 90 else 180 - pitch
    lock([(yw, pp, 0.0), (yw, pp + (4 if yw == 0 else -4), 0.06), (yw, pp + (8 if yw == 0 else -8), 0.13)], 0.06, thick=0.05)
hair = hair_meshes["swoop"]   # one big side-swept lock over the brow and a soft back
for dy, w, end in ((-20, 0.085, 34), (2, 0.08, 38), (24, 0.07, 44)):
    lock([(dy + 20, 86, 0.0), (dy, 66, 0.02), (dy - 16, 50, 0.04), (dy - 32, end, 0.07)], w, thick=0.045)
for yw in (180, 140, -140):
    lock([(yw, 80, 0.0), (yw, 50, 0.02), (yw, 25, 0.05)], 0.08, thick=0.04)
hair = hair_meshes["long"]   # a fringe and long hair down the back
for dy in (-14, 14):
    lock([(dy, 86, 0.0), (dy, 66, 0.02), (dy * 1.2, 46, 0.045), (dy * 1.4, 34, 0.07)], 0.075, thick=0.04)
for yw in (180, 150, -150, 120, -120):
    lock([(yw, 82, 0.0), (yw, 40, 0.025), (yw, 0, 0.05), (yw, -40, 0.08), (yw, -70, 0.11)], 0.08, thick=0.042)

from mathutils import Matrix  # noqa: E402
TILT = Matrix.Rotation(math.radians(-TUNE["head_tilt"]), 3, "X")   # nose up
for m in list(heads.values()) + list(ear_meshes.values()) + list(hair_meshes.values()) + list(eye_meshes.values()) + list(teeth_meshes.values()) + list(cheek_meshes.values()):
    for v in m.bm.verts:   # grow the head, then tilt it about the jaw hinge
        v.co = HP + TILT @ ((v.co - HP) * KH)

# ---------------------------------------------------------------- tail
tails = {}
for name in P.TAILS:
    if P.TAILS[name] is None:
        continue
    tm = A.Mesh(f"tail_{name}")
    P.build_tail(K, tm, name)
    tails[name] = tm

# ---------------------------------------------------------------- clothes: hoodie and cargo shorts
top = A.Mesh("top").group("torso")
ht = [r for r in tr if 0.9 <= r[0] <= 1.56]   # up the slope of the shoulders to the neck, so the hoodie has no shelf


def hoodie_gap(z):
    """The hoodie is outerwear: it stays outside the shorts (+0.03) wherever they overlap.
    Over the shoulders it hugs closer, up to a snug neckline."""
    if z < 1.12:
        return 0.055
    if z < 1.42:
        return 0.03 + 0.02 * math.sin(math.pi * (z - 0.9) / 0.6)
    return 0.045 - (z - 1.42) * 0.18


rings = [A.ring((0, y, z), (0, 0, 1), w + hoodie_gap(z), f + hoodie_gap(z), b + max(0.028, hoodie_gap(z) - 0.01), n=16, exp=2.8, up=FRONT)
         for z, y, w, f, b in ht]
rings[0] = A.ring((0, ht[0][1], 0.9), (0, 0, 1), ht[0][2] + 0.058, ht[0][3] + 0.058, ht[0][4] + 0.05, n=16, exp=2.8, up=FRONT)
top.loft(rings, "cloth_top", cap1=True, cap0=False)   # the cap hides the neck join; the neck passes through it
hw = ht[0][2] + 0.064
top.loft([A.ring((0, 0, z), (0, 0, 1), hw, ht[0][3] + 0.064, ht[0][4] + 0.056, n=16, exp=2.8, up=FRONT) for z in (0.89, 0.935)], "cloth_top_trim",
         cap0=False, cap1=False)
top.loft([A.ring((0, 0.015, z), (0, 0, 1), w, f, b, n=14, up=FRONT) for z, w, f, b in ((1.52, 0.13, 0.112, 0.112), (1.565, 0.115, 0.1, 0.1))],
         "cloth_top", cap0=False, cap1=False)
kd = TUNE["hood"]   # the hood bunched behind the neck
top.loft([A.ring((0, 0.03 + (y - 0.03) * kd, z), (0, 0.4, 1), w * (1 + (kd - 1) * 0.5), f * kd, b * kd, n=12, up=(0, 1, 0)) for y, z, w, f, b in
          ((0.09, 1.48, 0.13, 0.05, 0.02), (0.12, 1.59, 0.13, 0.05, 0.03), (0.115, 1.67, 0.1, 0.04, 0.03))], "cloth_top", tip1=V((0, 0.1, 1.72)))
pz = ht[0][3] + 0.062
top.loft([A.ring((0, -pz, z), (0, 0, 1), 0.1, 0.01, 0.008, n=8, exp=4, up=FRONT) for z in (0.96, 1.06)], "cloth_top_trim")


def sleeve(s, sd):
    """Sleeves in two rigid pieces like the arm under them: they clip at the elbow instead of pinching."""
    sh, el, wr = J[f"shoulder.{s}"], J[f"elbow.{s}"], J[f"wrist.{s}"]
    ua, fa = (el - sh).normalized(), (wr - el).normalized()
    g = 0.03
    (w0, d0), (w1, d1), (w2, d2), (w3, d3), (w4, d4), _ = ARM_R
    top.group(f"upperarm.{s}").loft([A.ring(sh - ua * 0.05 + V((-sd * 0.05, 0, 0)), ua, w0 * 0.7 + g, d0 * 0.75 + g, n=10, up=FRONT),
                                     A.ring(sh + V((-sd * 0.01, 0, -0.01)), ua, w0 + g, d0 + g, n=10, up=FRONT),
                                     A.ring(sh.lerp(el, 0.5), ua, w1 + g, d1 + g, n=10, up=FRONT), A.ring(el + ua * 0.03, ua, w2 + g, d2 + g, n=10, up=FRONT)],
                                    "cloth_top", cap0=False, tip1=el + ua * 0.07)
    end = el.lerp(wr, 0.78)
    top.group(f"forearm.{s}").loft([A.ring(el - fa * 0.04, fa, w2 + g * 0.8, d2 + g * 0.8, n=10, up=FRONT), A.ring(el.lerp(wr, 0.35), fa, w3 + g, d3 + g, n=10, up=FRONT),
                                    A.ring(end, fa, w4 + 0.034, d4 + 0.034, n=10, up=FRONT)], "cloth_top", cap1=False)
    top.loft([A.ring(end, fa, w4 + 0.022, d4 + 0.022, n=10, up=FRONT), A.ring(end.lerp(wr, 0.6), fa, w4 + 0.016, d4 + 0.016, n=10, up=FRONT)],
             "cloth_top_trim", cap0=False, cap1=False)


mirror(sleeve)

# a V-neck like the concept's: open the hoodie front so the white chest and the tuft show
import bmesh  # noqa: E402
bmesh.ops.recalc_face_normals(top.bm, faces=top.bm.faces)
vcut = [f for f in top.bm.faces if (lambda c: c.z > 1.3 and f.normal.y < -0.35 and abs(c.x) < 0.02 + (c.z - 1.3) * 0.9)(f.calc_center_median())]
bmesh.ops.delete(top.bm, geom=vcut, context="FACES")

bottom = A.Mesh("bottom").group("torso")
bt = [r for r in tr if 0.88 <= r[0] <= 1.04]
crotch = A.ring((0, 0.0, 0.8), (0, 0, 1), 0.13, 0.1, 0.11, n=16, exp=2.8, up=FRONT)
bottom.loft([crotch] + [A.ring((0, y, z), (0, 0, 1), w + 0.03, f + 0.045, b + 0.03, n=16, exp=2.8, up=FRONT) for z, y, w, f, b in bt], "cloth_bottom",
            cap1=False)


def short_leg(s, sd):
    """Shorts legs are rigid to the thigh, like the thigh piece under them."""
    h, k = J[f"hip.{s}"], J[f"knee.{s}"]
    th = (k - h).normalized()
    g = 0.03
    bottom.group(f"thigh.{s}").loft([A.ring(h + V((-sd * 0.02, 0.0, 0.08)), th, THIGH[1][0] + g, THIGH[1][1] + g, THIGH[1][2] + g, n=10, up=FRONT),
                                     A.ring(h.lerp(k, 0.4), th, THIGH[2][0] + g, THIGH[2][1] + g, THIGH[2][2] + g, n=10, up=FRONT),
                                     A.ring(h.lerp(k, 0.82), th, THIGH[3][0] + g + 0.01, THIGH[3][1] + g + 0.01, THIGH[3][2] + g + 0.01, n=10, up=FRONT)],
                                    "cloth_bottom", cap0=False, cap1=False)
    c = h.lerp(k, 0.45) + V((sd * (THIGH[2][0] + 0.035), -0.01, 0.0))
    bottom.loft([A.ring(c + V((0, 0, dz)), (0, 0, 1), 0.012, 0.06, 0.05, n=6, exp=4, up=FRONT) for dz in (-0.07, 0.06)], "cloth_bottom_trim")
    # the seat: a shell over each butt cheek
    c0 = V((sd * 0.07 * KP, 0.07, 0.95))
    bottom.group("glutes").loft([A.ring(c0 + V((0, -0.08, 0.01)), (0, 1, 0), 0.128, 0.158, n=10, up=(0, 0, 1)), A.ring(c0, (0, 1, 0), 0.158, 0.172, n=10, up=(0, 0, 1)),
                                 A.ring(c0 + V((0, 0.065, -0.015)), (0, 1, 0), 0.13, 0.14, n=10, up=(0, 0, 1))], "cloth_bottom", tip1=c0 + V((0, 0.12, -0.02)))


mirror(short_leg)

# ---------------------------------------------------------------- rig and skin
arm_obj, SEG = A.build_rig(J)
side = lambda b: [f"{b}.L", f"{b}.R"]  # noqa: E731
LIMBS = {"torso": ["hips", "spine", "chest", "neck", "head"] + side("shoulder"), "glutes": ["hips"]}
for s in ("L", "R"):
    # limb pieces are rigid to one bone each (they clip at the joints instead of pinching); hands blend
    LIMBS.update({f"upperarm.{s}": [f"upper_arm.{s}"], f"forearm.{s}": [f"forearm.{s}"],
                  f"hand.{s}": [f"forearm.{s}", f"hand.{s}", f"fingers.{s}"],
                  f"thigh.{s}": [f"thigh.{s}"], f"shin.{s}": [f"shin.{s}"], f"cannon.{s}": [f"foot.{s}"], f"toes.{s}": [f"toes.{s}"],
                  f"arm.{s}": [f"upper_arm.{s}", f"forearm.{s}"], f"leg.{s}": [f"thigh.{s}"]})
TAIL_BONES = [f"tail.{i}" for i in range(len(J["tail"]) - 1)]
objs = {
    "body": A.skin(body.obj(MATS), arm_obj, SEG, LIMBS),
    "arms": A.skin(arms.obj(MATS), arm_obj, SEG, LIMBS),
    "claws": A.skin(claws.obj(MATS), arm_obj, SEG, LIMBS, keep=2),
    "claws_paws": A.skin(paw_claws.obj(MATS), arm_obj, SEG, LIMBS),
    "tuft": A.skin(tuft.obj(MATS), arm_obj, SEG, {"torso": ["chest", "neck"]}),
    **{f"head_{sp}": A.rigid_parts(m.obj(MATS), arm_obj, {"main": "head", "jaw": "jaw"}) for sp, m in heads.items()},
    **{f"eyes_{st}": A.rigid(m.obj(MATS), arm_obj, "head") for st, m in eye_meshes.items()},
    **{f"ears_{nm}": A.skin(m.obj(MATS), arm_obj, SEG, ["head"] + side("ear"), keep=1) for nm, m in ear_meshes.items()},
    **{f"hair_{st}": A.rigid(m.obj(MATS), arm_obj, "head") for st, m in hair_meshes.items()},
    **{f"teeth_{k}": A.rigid(m.obj(MATS), arm_obj, "jaw" if k.startswith("tusks") else "head") for k, m in teeth_meshes.items()},
    **{f"cheeks_{k}": A.rigid(m.obj(MATS), arm_obj, "head") for k, m in cheek_meshes.items()},
    **{f"tail_{nm}": (A.skin_path(m.obj(MATS), arm_obj, m.tail_path, m.tail_i0, TAIL_BONES, "hips") if getattr(m, "tail_path", None)
                      else A.skin(m.obj(MATS), arm_obj, SEG, ["hips"] + TAIL_BONES)) for nm, m in tails.items()},
    **{f"feet_{nm}": A.skin(m.obj(MATS), arm_obj, SEG, LIMBS) for nm, m in feet.items()},
    "top": A.skin(top.obj(MATS), arm_obj, SEG, LIMBS),
    "bottom": A.skin(bottom.obj(MATS), arm_obj, SEG, LIMBS),
}
print("TRIS", {k: sum(len(p.vertices) - 2 for p in o.data.polygons) for k, o in objs.items()})
bare.bm.free()
# The kit carries every part; a character shows one of each kind (its recipe). Renders show the wolf.
KINDS = ("head_", "ears_", "hair_", "tail_", "feet_", "eyes_", "teeth_", "cheeks_")
SHOW = {"head_wolf", "ears_wolf", "hair_crest", "tail_wolf", "feet_paws", "eyes_almond", "cheeks_spiky"}


def recipe_parts(sp):
    R_ = P.SPECIES[sp]
    return {f"head_{sp}", f"ears_{R_['ears']}", f"hair_{R_['hair']}", f"tail_{R_['tail']}", f"feet_{R_['feet']}", f"eyes_{R_['eyes']}",
            f"teeth_{R_['teeth']}__{R_['snout']}", f"cheeks_{R_['cheeks']}"} | ({"tuft"} if R_["tuft"] else set())


def hidden_by_default(k, show=None):
    show = SHOW if show is None else show
    if k == "claws_paws":   # toe claws only with paws
        return "feet_paws" not in show
    if k == "tuft" and show is not SHOW:   # recipes say whether a species has a chest tuft
        return k not in show
    return k.startswith(KINDS) and k not in show


for k, o in objs.items():
    o.hide_render = hidden_by_default(k)

# the editor's catalogue: every part per kind, and each species' recipe and colours
import json  # noqa: E402
catalogue = {kind.rstrip("_"): sorted(k[len(kind):] for k in objs if k.startswith(kind)) for kind in KINDS}
catalogue["hair"].append("none")
catalogue["teeth"] = P.TEETH + ["none"]
catalogue["cheeks"].append("none")
json.dump({"parts": catalogue, "species": {sp: {**{k: v for k, v in R_.items() if k in ("ears", "tail", "feet", "hair", "eyes", "teeth", "snout", "tuft", "cheeks")}, "head": sp,
                                               "colours": {k: "#%02x%02x%02x" % tuple(int(c * 255) for c in v) for k, v in R_["colours"].items()}}
                                          for sp, R_ in P.SPECIES.items()}},
          open(os.path.join(os.path.dirname(os.path.abspath(out)), "species.json"), "w"), indent=1)

import gait  # noqa: E402
CLIPS = gait.bake_all(arm_obj, J, plot=os.path.join(render_dir, f"{species}-{variant}-{{name}}-gait.json") if render_dir else None)
import actions  # noqa: E402
_cat_path = os.path.join(os.path.dirname(os.path.abspath(out)), "species.json")
_cat = json.load(open(_cat_path))
_cat["trails"] = actions.TRAILS   # swing-trail windows per clip (seconds, which paw)
_cat["loops"] = sorted(n for n, a in CLIPS.items() if a.get("loop", n in gait.GAITS or n == "idle"))
json.dump(_cat, open(_cat_path, "w"), indent=1)

if os.environ.get("GAIT_DUMP"):   # per-frame world positions of the leg joints and body, for scripts/gaitcheck.py
    import json as _json
    dump = {}
    sc_ = bpy.context.scene
    for clip in ("walk", "trot", "sprint", "gallop"):
        arm_obj.animation_data.action = CLIPS[clip]
        n_ = gait.GAITS[clip]["frames"]
        rows_ = []
        for f in range(n_ + 1):
            sc_.frame_set(f)
            pbs = arm_obj.pose.bones
            w = lambda v: list(arm_obj.matrix_world @ v)  # noqa: E731
            row = {"root": w(pbs["root"].head), "hips": w(pbs["hips"].head), "chest": w(pbs["chest"].head), "head": w(pbs["head"].head)}
            for s_ in ("L", "R"):
                row.update({f"hip.{s_}": w(pbs[f"thigh.{s_}"].head), f"knee.{s_}": w(pbs[f"shin.{s_}"].head), f"hock.{s_}": w(pbs[f"foot.{s_}"].head),
                            f"ball.{s_}": w(pbs[f"toes.{s_}"].head), f"toe.{s_}": w(pbs[f"toes.{s_}"].tail)})
            rows_.append(row)
        dump[clip] = dict(frames=n_, stance=gait.GAITS[clip]["stance"], stances=gait.STANCES.get(clip), offset=gait.GAITS[clip].get("offset", 0.5), fps=gait.FPS, rows=rows_)
    _json.dump(dump, open(os.environ["GAIT_DUMP"], "w"))
    print("GAIT_DUMP", os.environ["GAIT_DUMP"])

if os.environ.get("JITTER_DUMP"):
    # every clip, every frame: world positions of the paws, fingertips and head (scripts/jitter.py analyses them)
    import json as _json
    sc_ = bpy.context.scene
    dump = {}
    for clip, act in sorted(CLIPS.items()):
        arm_obj.animation_data.action = act
        f0, f1 = (int(x) for x in act.frame_range)
        tr = {k: [] for k in ("hand.L", "hand.R", "fingers.L", "fingers.R", "head", "jaw")}
        for f in range(f0, f1 + 1):
            sc_.frame_set(f)
            for k in tr:
                tr[k].append(list(arm_obj.matrix_world @ arm_obj.pose.bones[k].tail))
        dump[clip] = dict(loop=bool(act.get("loop", clip in gait.GAITS or clip == "idle")), tracks=tr)
    _json.dump(dump, open(os.environ["JITTER_DUMP"], "w"))
    print("JITTER_DUMP", os.environ["JITTER_DUMP"])

os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=False, export_skins=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_frame_range=False, export_force_sampling=True)
if render_dir and "--walk" in argv:   # a filmstrip of the walk, straight from Blender (legs only: no clothes or tail)
    clip = argv[argv.index("--walk") + 1] if len(argv) > argv.index("--walk") + 1 and not argv[argv.index("--walk") + 1].startswith("-") else "walk"
    arm_obj.animation_data.action = CLIPS[clip]
    for k in os.environ.get("STRIPHIDE", "top,bottom,tail").split(","):
        for name, o in objs.items():
            if name == k or name.startswith(k + "_"):
                o.hide_render = True
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 440, 820
    sc.render.film_transparent = True
    w = bpy.data.worlds.new("ww")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    sc.world = w
    sun = bpy.data.objects.new("wsun", bpy.data.lights.new("wsun", "SUN"))
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(50), math.radians(40), math.radians(60))
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("wcam", bpy.data.cameras.new("wcam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.2
    sc.collection.objects.link(cam)
    view = V(tuple(float(x) for x in os.environ.get("STRIPVIEW", "1,0,0").split(",")))
    sun.rotation_euler = (-view.normalized() + V((0.3, 0.2, -0.8))).to_track_quat("-Z", "Y").to_euler()   # lit from the camera side
    cam.location = V((0, 0, 1.0)) + view.normalized() * 30
    cam.rotation_euler = (V((0, 0, 1.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    n = gait.GAITS[clip]["frames"] if clip in gait.GAITS else 24
    for k in range(10):
        sc.frame_set(round(k * n / 10))
        sc.render.filepath = os.path.join(render_dir, f"{clip}-{k}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(sun)
    for k, o in objs.items():
        o.hide_render = hidden_by_default(k)
arm_obj.animation_data.action = None   # review stills below are of the rest pose
for b in arm_obj.pose.bones:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)
bpy.context.view_layer.update()
print("WROTE", out)


# ---------------------------------------------------------------- review renders
def setup_render(res):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    sc.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.2
    sun.rotation_euler = (math.radians(42), math.radians(-12), math.radians(-30))
    sc.collection.objects.link(sun)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = True
    return sc


def shoot(sc, path, target, view, ortho):
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho
    sc.collection.objects.link(cam)
    cam.location = V(target) + V(view).normalized() * 30
    cam.rotation_euler = (V(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 100
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def pose(rot):
    arm_obj.animation_data.action = None
    for b in arm_obj.pose.bones:
        b.location = (0, 0, 0)
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
    for name, (x, y, z) in rot.items():
        arm_obj.pose.bones[name].rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))
    bpy.context.view_layer.update()


def visible(names):
    for k, o in objs.items():
        o.hide_render = k not in names or hidden_by_default(k)


if render_dir:
    os.makedirs(render_dir, exist_ok=True)
    tag = f"{species}-{variant}"
    sc = setup_render((900, 1200))
    for k, v in {"34": tuple(float(x) for x in os.environ.get("VIEW34", "-0.6,-1.0,0.12").split(",")), "side": (1, 0, 0.05), "front": (0, -1, 0.05),
                    "back": (0.4, 1, 0.1)}.items():
        shoot(sc, os.path.join(render_dir, f"{tag}-{k}.png"), (0, 0, 1.02), v, 2.3)
    visible(set(objs) - {"top", "bottom"})
    shoot(sc, os.path.join(render_dir, f"{tag}-bare34.png"), (0, 0, 1.02), (-0.75, -1.0, 0.12), 2.3)
    shoot(sc, os.path.join(render_dir, f"{tag}-bareside.png"), (0, 0, 1.02), (1, 0, 0.05), 2.3)
    sc.render.resolution_x, sc.render.resolution_y = (900, 900)
    shoot(sc, os.path.join(render_dir, f"{tag}-hand.png"), J["knuckle.L"], (0.9, -1.0, 0.12), 0.42)
    shoot(sc, os.path.join(render_dir, f"{tag}-foot.png"), (J["ball.L"] + J["ball.R"]) * 0.5 + V((0, -0.05, 0.08)), (-0.75, -1.0, 0.12), 0.75)
    shoot(sc, os.path.join(render_dir, f"{tag}-footside.png"), J["ball.L"] + V((0, -0.02, 0.12)), (1, 0, 0.05), 0.6)
    visible(set(objs))
    shoot(sc, os.path.join(render_dir, f"{tag}-head34.png"), HC + V((0, -0.05, 0.0)), (-0.75, -1.0, 0.1), 0.62 * KH)
    shoot(sc, os.path.join(render_dir, f"{tag}-headside.png"), HC + V((0, -0.06, -0.02)), (1, 0, 0.03), 0.62 * KH)
    for st in EYE_STYLES:   # one head shot per eye style
        for k, o in objs.items():
            if k.startswith("eyes_"):
                o.hide_render = k != f"eyes_{st}"
        shoot(sc, os.path.join(render_dir, f"{tag}-eyes-{st}.png"), HC + V((0, -0.12, 0.0)), (-0.6, -1.0, 0.05), 0.42 * KH)
    for k, o in objs.items():
        if k.startswith("eyes_"):
            o.hide_render = hidden_by_default(k)


def set_colours(cols):
    """Recolour the shared materials (the kit's default colours, with a species' on top)."""
    for name, m in MATS.items():
        rgb = cols.get(name, S["colours"].get(name))
        if rgb is None:
            continue
        m.diffuse_color = (*rgb, 1)
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1)


if render_dir and "--lineup" in argv:   # every species, head and body, in its own colours
    sc = setup_render((700, 1000))
    arm_obj.animation_data.action = CLIPS["idle"]
    sc.frame_set(0)
    for sp in P.SPECIES:
        set_colours(P.SPECIES[sp]["colours"])
        show = recipe_parts(sp)
        for k, o in objs.items():
            o.hide_render = hidden_by_default(k, show) or k in ("top", "bottom")
        shoot(sc, os.path.join(render_dir, f"species-{sp}-body.png"), (0, 0, 1.0), (-0.75, -1.0, 0.12), 2.4)
        sc.render.resolution_x, sc.render.resolution_y = 700, 700
        shoot(sc, os.path.join(render_dir, f"species-{sp}-head.png"), HC + V((0, -0.08, 0.04)), (-0.75, -1.0, 0.08), 0.8 * KH)
        shoot(sc, os.path.join(render_dir, f"species-{sp}-headside.png"), HC + V((0, -0.08, 0.04)), (1, 0, 0.03), 0.8 * KH)
        sc.render.resolution_x, sc.render.resolution_y = 700, 1000
        print("LINEUP", sp)


if "--pack" in argv:   # the asset-library export: kit/base + one GLB per part, and characters/<species> ready-made
    pack_dir = os.path.abspath(argv[argv.index("--pack") + 1])
    os.makedirs(os.path.join(pack_dir, "kit"), exist_ok=True)
    os.makedirs(os.path.join(pack_dir, "characters"), exist_ok=True)
    GLTF = dict(export_format="GLB", export_apply=False, export_skins=True, use_selection=True)

    def export(path, names, anims):
        bpy.ops.object.select_all(action="DESELECT")
        arm_obj.select_set(True)
        for n in names:
            objs[n].select_set(True)
        if anims:
            bpy.ops.export_scene.gltf(filepath=path, export_animations=True, export_animation_mode="ACTIONS", export_frame_range=False,
                                      export_force_sampling=True, **GLTF)
        else:   # parts: geometry and skin only, bound in the rest pose (the helper binds them to base.glb's skeleton)
            bpy.ops.export_scene.gltf(filepath=path, export_animations=False, **GLTF)

    def rest_pose():
        arm_obj.animation_data.action = None
        for b in arm_obj.pose.bones:
            b.location, b.rotation_euler, b.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
        bpy.context.view_layer.update()

    BASE = ["body", "arms"]
    set_colours({})
    export(os.path.join(pack_dir, "kit", "base.glb"), BASE, True)
    rest_pose()
    n = 1
    for name in sorted(objs):
        if name in BASE:
            continue
        export(os.path.join(pack_dir, "kit", name.replace("_", "-", 1) + ".glb"), [name], False)
        n += 1
    for sp, R_ in P.SPECIES.items():
        set_colours(R_["colours"])
        names = BASE + sorted(recipe_parts(sp) & set(objs)) + ["claws"] + (["claws_paws"] if R_["feet"] == "paws" else [])
        export(os.path.join(pack_dir, "characters", sp + ".glb"), names, True)
        rest_pose()
        n += 1
    set_colours({})
    print("PACK", n, "GLBs ->", pack_dir)
