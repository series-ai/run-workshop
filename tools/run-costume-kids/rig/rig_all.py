"""Put every Bobble concept (kids and costumes) on the Pirate Nation skeleton
and render PN clips.

The PN skeleton is copied with every joint name and rest orientation kept,
and its joints are moved to the Bobble proportions (short legs, a big head),
so PN's rotation clips play unchanged. Each concept piece is bound rigidly to
a bone chosen by where it sits; arm pieces are first swung up into the PN
T-pose about the shoulder.

    Blender -b --factory-startup --python rig_all.py -- <out dir> <mode> <slug> [<slug> ...]

mode "grid": frames of 05_Run and 20_Dance_1 per character.
mode "samples": frames of many clips per character.
mode "glb": also export <slug>.glb with every PN clip.
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import glob
import importlib.util
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, MODE, SLUGS = ARGS[0], ARGS[1], ARGS[2:]
os.makedirs(OUT, exist_ok=True)
JAM = os.path.expanduser(os.environ.get("JAM_ASSETS_DIR", "~/Documents/GitHub/jam-ready-assets"))  # the Pirate Nation and KayKit rigs
PN = JAM + "/proofofplay-pirate-nation/3D/pirate/characters-skins/characters-skins-avatar-animation-all-023.glb"

sys.argv = [sys.argv[0], "--", OUT]  # the concept modules read their out dir after "--"
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
import bobble  # noqa: E402

import props as _props  # noqa: E402  the pumpkin bucket: tag its pieces so they always follow the hand

BUCKET = set()
_bucket = _props.bucket


def _tagged_bucket(*a, **k):
    before = set(bpy.data.objects)
    r = _bucket(*a, **k)
    BUCKET.update(o.name for o in set(bpy.data.objects) - before)
    return r


_props.bucket = _tagged_bucket
BUILDS = {}
bobble.run = lambda costumes: BUILDS.update(costumes)
bobble.render_costume = lambda slug, build, *a, **k: BUILDS.update({slug: build})
for path in sorted(glob.glob(_PKG + "/concepts/costumes/*.py")):
    mod = os.path.basename(path)[:-3]
    if mod in ("props", "gallery", "lineup", "fitcheck", "mannequin_cams") or "." in mod or mod.startswith("_"):
        continue  # tools, helpers and old versions (witch.v1) are not costumes
    spec = importlib.util.spec_from_file_location("c_" + mod.replace("-", "_"), path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m
    spec.loader.exec_module(m)

B = bobble
S = 0.142  # metres per concept unit (the Bobble kid is ~0.59 m tall, like PN)
SH_X = B.TW * 0.5 + 0.08
SHOULDER = (SH_X, 0.0, B.TOP - 0.15)
LEG_X = B.TW * 0.24
# Bobble joint positions in concept units (front -y, left +x); arms in the T-pose
JOINTS = {
    "Root": ((0, 0, 0), (0, 0, B.HIP)),
    "Body": ((0, 0, B.HIP), (0, 0, B.HIP + B.TH * 0.36)),
    "Chest": ((0, 0, B.HIP + B.TH * 0.36), (0, 0, B.TOP)),
    "Head": ((0, 0, B.TOP), (0, 0, B.TOP + B.HEAD)),
}
for s, side in ((1, "L"), (-1, "R")):
    sx, sz = s * SH_X, SHOULDER[2]
    JOINTS[f"Arm.{side}"] = ((sx, 0, sz), (sx + s * 0.2, 0, sz))
    JOINTS[f"ForeArm.{side}"] = ((sx + s * 0.2, 0, sz), (sx + s * 0.38, 0, sz))
    JOINTS[f"Hand.{side}"] = ((sx + s * 0.38, 0, sz), (sx + s * 0.8, 0, sz))
    lx = s * LEG_X
    JOINTS[f"Leg.{side}"] = ((lx, 0, B.HIP), (lx, 0, B.HIP * 0.66))
    JOINTS[f"LowerLeg.{side}"] = ((lx, 0, B.HIP * 0.66), (lx, 0, B.FOOT * 0.4))
    JOINTS[f"Foot.{side}"] = ((lx, 0, B.FOOT * 0.4), (lx, 0, 0.0))
M = Matrix.Scale(S, 4) @ Matrix.Rotation(math.radians(90), 4, "Z")  # concept -> rig (front +X, left +Y)


KK_DIR = JAM + "/kaykit-character-animations/3D/characters/Animations/gltf/Rig_Medium"
KK_FILES = ["General", "MovementBasic", "Simulation", "Tools"]
KS = 0.52  # metres per concept unit on the KayKit rig (the kid is about as tall as the KayKit mannequin)
KK_BONE = {"Root": "root", "Body": "hips", "Chest": "chest", "Head": "head"}
for _s in "LR":
    _k = _s.lower()
    KK_BONE.update({f"Arm.{_s}": f"upperarm.{_k}", f"ForeArm.{_s}": f"lowerarm.{_k}", f"Hand.{_s}": f"hand.{_k}",
                    f"Leg.{_s}": f"upperleg.{_k}", f"LowerLeg.{_s}": f"lowerleg.{_k}", f"Foot.{_s}": f"foot.{_k}"})
KK_JOINTS = {  # bone head and length in concept units; the bone keeps KayKit's direction
    "root": ((0, 0, 0), B.HIP), "hips": ((0, 0, B.HIP), B.TH * 0.3), "spine": ((0, 0, B.HIP + B.TH * 0.3), B.TH * 0.35),
    "chest": ((0, 0, B.HIP + B.TH * 0.65), B.TOP - B.HIP - B.TH * 0.65), "head": ((0, 0, B.TOP), B.HEAD),
}
for _sg, _k in ((1, "l"), (-1, "r")):
    _sx, _sz, _lx = _sg * SH_X, SHOULDER[2], _sg * LEG_X
    KK_JOINTS.update({
        f"upperarm.{_k}": ((_sx, 0, _sz), 0.2), f"lowerarm.{_k}": ((_sx + _sg * 0.2, 0, _sz), 0.18),
        f"wrist.{_k}": ((_sx + _sg * 0.38, 0, _sz), 0.07), f"hand.{_k}": ((_sx + _sg * 0.45, 0, _sz), 0.35),
        f"handslot.{_k}": ((_sx + _sg * 0.6, 0, _sz - 0.1), 0.2),
        f"upperleg.{_k}": ((_lx, 0, B.HIP), B.HIP * 0.34), f"lowerleg.{_k}": ((_lx, 0, B.HIP * 0.66), B.HIP * 0.66 - B.FOOT * 0.4),
        f"foot.{_k}": ((_lx, 0, B.FOOT * 0.4), 0.25), f"toes.{_k}": ((_lx, -0.25, 0.05), 0.3),
    })


def load_kaykit():
    """The KayKit Rig_Medium armature with the clips of several KayKit files; every mesh dropped."""
    arm = None
    for name in KK_FILES:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=f"{KK_DIR}/Rig_Medium_{name}.glb")
        for o in set(bpy.data.objects) - before:
            if arm is None and o.type == "ARMATURE":
                arm = o
                continue
            bpy.data.objects.remove(o, do_unlink=True)
    return arm


def bounds(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, hi - lo


def _colour(o):
    m = o.active_material
    return tuple(round(c, 3) for c in m.diffuse_color[:3]) if m else None


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def _aabb_dist(p, lo, hi):
    """Distance from a point to an axis-aligned box (0 inside)."""
    d = Vector((max(lo.x - p.x, 0, p.x - hi.x), max(lo.y - p.y, 0, p.y - hi.y), max(lo.z - p.z, 0, p.z - hi.z)))
    return d.length


def _box_gap(a_lo, a_hi, b_lo, b_hi):
    d = Vector((max(a_lo[i] - b_hi[i], 0, b_lo[i] - a_hi[i]) for i in range(3)))
    return d.length


def find_arms(objs):
    """Arm chains, including custom-posed arms (raised, holding a wand): pieces
    that start at a shoulder and reach outward, the hand at their far end, and
    everything touching the hand that is small enough to be held (a wand, a
    broom, the bucket). Returns {side: (arm pieces, hand pieces, hand point)}."""
    info = {o: bounds(o) for o in objs}
    skin_rgb = tuple(round(c, 3) for c in B.SKIN)
    tops = [o for o, (c, size) in info.items() if c.z - size.z / 2 > B.HEAD_Z and _colour(o) != skin_rgb]
    hair_rgb = _colour(max(tops, key=lambda o: info[o][1].length)) if tops else None

    def hairy(o, c):  # hair hanging beside the head (long hair tips) is never part of a hand
        return hair_rgb is not None and c.z > B.TOP and _colour(o) == hair_rgb

    out = {}
    for s in (1, -1):
        shoulder = Vector((s * SH_X, 0.0, B.TOP - 0.15))
        arm = []
        for o, (c, size) in info.items():
            lo, hi = c - size / 2, c + size / 2
            if size.length < 2.4 and s * c.x > SH_X - 0.25 and _aabb_dist(shoulder, lo, hi) < 0.22 and hi.z < B.TOP + 1.6:
                arm.append(o)
        if not arm:
            continue
        # the hand: the arm pieces' bounding-box corner farthest from the shoulder
        corners = [o.matrix_world @ Vector(cn) for o in arm for cn in o.bound_box]
        far = max(corners, key=lambda p: (p - shoulder).length)
        hand = []
        for o, (c, size) in info.items():
            if o in arm:
                continue
            lo, hi = c - size / 2, c + size / 2
            centred = abs(c.x) < B.TW / 2 + 0.05  # the torso, the shorts, the legs: never part of a hand
            if size.length < 1.8 and _aabb_dist(far, lo, hi) < 0.35 and not centred and not hairy(o, c):
                hand.append(o)
        # what the hand holds: small pieces touching the hand, a few links out (a wand, a broom, the bucket and its candy)
        for _ in range(4):
            added = False
            for o, (c, size) in info.items():
                dims = sorted(size)
                thin = dims[0] < 0.35 and dims[1] < 0.35 and size.length < 4.5  # a sword, a staff, a scythe pole
                thumb = _colour(o) == skin_rgb and size.length < 0.45          # a mitten's thumb, even near the middle
                if o in arm or o in hand or (size.length > 2.6 and not thin) or (abs(c.x) < B.TW / 2 + 0.05 and not thumb) or hairy(o, c):
                    continue
                in_leg = abs(abs(c.x) - LEG_X) < 0.35 and c.z < B.HIP + 0.1 and size.x < 0.8
                if in_leg or (c - far).length > 1.8:
                    continue  # never the legs or shoes, and nothing far from the hand
                embedded = any(q is not o and info[q][1].length > 1.0 and abs(info[q][0].x) < B.TW
                               and all(info[q][0][i] - info[q][1][i] / 2 - 0.05 <= c[i] <= info[q][0][i] + info[q][1][i] / 2 + 0.05 for i in range(3))
                               for q in info if q not in arm and q not in hand)
                if embedded:
                    continue  # a decoration set into a costume piece (dots on a skirt)
                lo, hi = c - size / 2, c + size / 2
                if any(_box_gap(lo, hi, info[h][0] - info[h][1] / 2, info[h][0] + info[h][1] / 2) < 0.06 for h in hand):
                    hand.append(o)
                    added = True
            if not added:
                break
        out[s] = (arm, hand, far)
    return out


def settle_arms(objs):
    """Swing custom-posed arms down into the standard hanging pose about the
    shoulder, so every clip moves every arm the same way. Held props swing
    with the hand but keep their own orientation (a wand stays upright)."""
    chains = find_arms(objs)
    for s, (arm, hand, far) in chains.items():
        shoulder = Vector((s * SH_X, 0.0, B.TOP - 0.15))
        mitt = Vector(B.hand_points()[s])
        if (far - mitt).length < 0.45:
            continue  # already hanging
        q = (far - shoulder).normalized().rotation_difference((mitt - shoulder).normalized())
        Rm = Matrix.Translation(shoulder) @ q.to_matrix().to_4x4() @ Matrix.Translation(-shoulder)
        new_far = Rm @ far
        undo = Matrix.Translation(new_far) @ q.to_matrix().to_4x4().inverted() @ Matrix.Translation(-new_far)
        mitt_rgb = tuple(round(c, 3) for c in B.SKIN)
        for o in arm + hand:
            o.matrix_world = Rm @ o.matrix_world
            held = o in hand and _colour(o) != mitt_rgb
            if held:
                o.matrix_world = undo @ o.matrix_world  # keep the prop's orientation; it only moves with the hand
    bpy.context.view_layer.update()
    return chains


def classify_all(objs):
    """Anchor every piece to a body part. Rules (from the art lead):
    - anything on the head (hats, hair, things above the head) follows the head;
      so does any piece in the hair's colour near the head (braids, pigtails);
    - only pieces on the hanging arm line follow the arm, the mitten and what
      hangs under it (the bucket) follow the hand;
    - only pieces in the leg columns follow the legs and feet;
    - every other low or loose piece (hems, tentacles, tails, roots, flames)
      follows the root, so nothing flies around;
    - a full-body suit (one big shell from the hips to above the head) moves as
      one block with everything inside it, on the hips."""
    info = {}
    for o in objs:
        c, size = bounds(o)
        info[o] = (c, size, c - size / 2, c + size / 2)
    suit = None
    for o, (c, size, lo, hi) in info.items():
        if lo.z < B.HIP + 0.3 and hi.z > B.TOP + 1.2 and size.x > B.TW * 1.1 and (suit is None or size.length > info[suit][1].length):
            suit = o
    sh = {s: Vector((s * SH_X, 0, B.TOP - 0.15)) for s in (-1, 1)}
    mitt = {s: Vector(B.hand_points()[s]) for s in (-1, 1)}
    out = {}
    chains = find_arms(objs)
    for s_, (arm_p, hand_p, _) in chains.items():
        sd = "L" if s_ > 0 else "R"
        for o in arm_p:
            out[o] = f"Arm.{sd}"
        for o in hand_p:
            c_, sz_ = info[o][0], info[o][1]
            if not (abs(abs(c_.x) - LEG_X) < 0.32 and c_.z < B.HIP + 0.05 and sz_.x < 0.75):
                out[o] = f"Hand.{sd}"
    for o, (c, size, lo, hi) in info.items():
        if o in out:
            continue
        s = 1 if c.x > 0 else -1
        side = "L" if s > 0 else "R"
        d_arm, t = _seg_dist(c, sh[s], mitt[s])
        in_leg = abs(c.x - s * LEG_X) < 0.32 and abs(c.y + 0.1) < 0.75 and size.x < 0.75 and c.z < B.HIP + 0.2
        below_mitt = (mitt[s].z - 1.4 < c.z < mitt[s].z + 0.1) and abs(c.x - mitt[s].x) < 0.4 and abs(c.y - mitt[s].y) < 0.8 \
            and size.length < 1.6 and abs(c.x) > B.TW / 2 + 0.05
        if in_leg:  # the legs and shoes always follow the legs
            out[o] = f"Foot.{side}" if c.z < B.FOOT * 0.5 else f"Leg.{side}"
        elif hi.z > B.TOP + 0.35 and lo.z > B.TOP - 0.7:
            out[o] = "Head"
        elif d_arm < 0.42 and size.length < 1.6:
            out[o] = f"Hand.{side}" if t > 0.75 else f"Arm.{side}"
        elif in_leg:
            out[o] = f"Foot.{side}" if c.z < B.FOOT * 0.5 else f"Leg.{side}"
        elif c.z < B.HIP and abs(c.x) < B.HEAD / 2:
            out[o] = "Body"  # skirts, hems and bases follow the hips
        elif c.z < B.HIP:
            out[o] = "Root"
        elif c.z < B.HIP + B.TH * 0.36:
            out[o] = "Body"
        elif c.z < B.TOP + 0.05:
            out[o] = "Chest"
        else:
            out[o] = "Head"
    # hair: pieces in a head piece's colour, near the head, follow the head (braids, pigtails, long hair)
    hair = {_colour(o) for o, b in out.items() if b == "Head" and info[o][2].z > B.TOP + 1.0}  # learnt from pieces high on the head only
    hair.discard(tuple(round(c, 3) for c in B.SKIN))  # a face high in a costume is not hair
    for o, b in out.items():
        c = info[o][0]
        if b in ("Chest", "Body", "Root") or b.startswith(("Arm", "Hand")):
            beside_or_behind = abs(c.x) > B.TW / 2 + 0.15 or c.y > B.TD / 2
            if _colour(o) in hair and beside_or_behind and abs(c.x) < B.HEAD / 2 + 1.2 and c.z > B.HIP * 0.5:
                out[o] = "Head"
    # mittens, wherever a costume posed them: the skin-coloured mitt block, outside the torso column
    skin = tuple(round(c, 3) for c in B.SKIN)
    for o, (c, size, lo, hi) in info.items():
        if _colour(o) == skin and abs(c.x) > B.TW / 2 + 0.05 and abs(size.x - 0.8 * B.MITT) < 0.08 and abs(size.z - 1.1 * B.MITT) < 0.1:
            out[o] = "Hand.L" if c.x > 0 else "Hand.R"
    # held props: anything touching a hand (transitively), outside the torso column, small, not up in a hat,
    # follows that hand (the bucket and its candy, a broom and its straws, a sleeve)
    for side in ("L", "R"):
        held = {o for o, b in out.items() if b == f"Hand.{side}"}
        grew = True
        while grew:
            grew = False
            for o, b in out.items():
                if o in held or b.startswith(("Leg", "Foot", "Hand")):
                    continue
                c, size, lo, hi = info[o]
                if size.length > 2.6 or abs(c.x) < B.TW / 2 + 0.05 or (c.x > 0) != (side == "L"):
                    continue
                if b == "Head" and (size.length > 1.0 or lo.z > B.TOP + 0.6):
                    continue
                # a decoration set into a costume piece (dots on a skirt) belongs to that piece, not to a hand
                if any(q is not o and out[q] in ("Root", "Body", "Chest") and info[q][1].length > 1.0
                       and all(info[q][2][i] - 0.05 <= c[i] <= info[q][3][i] + 0.05 for i in range(3)) for q in out):
                    continue
                if any(_box_gap(lo, hi, info[h][2], info[h][3]) < 0.12 for h in held):
                    out[o] = f"Hand.{side}"
                    held.add(o)
                    grew = True
    # a full-body suit (big pieces wrapping the torso and rising well above the shoulders, like a bun and
    # a sausage) moves as one block with everything inside it, on the hips; the kid's own head starts above
    # the shoulders, so it never counts
    shells = [o for o, (c, size, lo, hi) in info.items()
              if size.length > 2.5 and lo.z < B.TOP and hi.z > B.TOP + 1.0 and abs(c.x) < B.HEAD / 2 + 0.5]
    if shells:
        slo = Vector((min(info[o][2][i] for o in shells) for i in range(3)))
        shi = Vector((max(info[o][3][i] for o in shells) for i in range(3)))
        for o, b in out.items():
            c = info[o][0]
            inside = all(slo[i] - 0.15 <= c[i] <= (shi[i] + 0.15 if i < 2 else 1e9) for i in range(3))
            if inside and not b.startswith(("Arm", "Hand", "Leg", "Foot")):
                out[o] = "Body"
    for o, (c, size, lo, hi) in info.items():
        if o.name in BUCKET:
            out[o] = "Hand.L" if c.x > 0 else "Hand.R"
            continue
        if out[o].startswith(("Hand", "Arm")) and size.length < 0.6 and _colour(o) != tuple(round(v, 3) for v in B.SKIN):
            for q, (qc, qs, qlo, qhi) in info.items():
                if q is o or q.name in BUCKET or qs.length < 1.5 or abs(qc.x) > B.TW or out[q] not in ("Root", "Body", "Chest"):
                    continue
                if all(qlo[i] - 0.05 <= c[i] <= qhi[i] + 0.05 for i in range(3)):
                    out[o] = out[q]
                    break
    return out


def classify(o):
    return classify_all([o])[o]


def rig(slug, kind="pn"):
    BUCKET.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    B._mats.clear()
    BUILDS[slug]()
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    anchors = classify_all(meshes)
    parts = [(o, anchors[o]) for o in meshes]
    # swing arm pieces up into the T-pose about the shoulder
    for o, bone in parts:
        if bone.startswith(("Arm.", "Hand.")):
            s = 1 if bone.endswith("L") else -1
            pivot = Vector((s * SHOULDER[0], SHOULDER[1], SHOULDER[2]))
            R = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-90 * s), 4, "Y") @ Matrix.Translation(-pivot)
            o.matrix_world = R @ o.matrix_world
    if kind == "kaykit":
        for o, _ in parts:
            o.matrix_world = Matrix.Scale(KS, 4) @ o.matrix_world  # KayKit faces -y and has left at +x, like the concepts
        arm = load_kaykit()
        joints = {b: (Matrix.Scale(KS, 4) @ Vector(h), l * KS) for b, (h, l) in KK_JOINTS.items()}
        bone_of = KK_BONE
    else:
        for o, _ in parts:
            o.matrix_world = M @ o.matrix_world
        bpy.ops.import_scene.gltf(filepath=PN)
        arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
        for o in list(bpy.context.scene.objects):
            if o.type == "MESH" and (o.parent is arm or o.name == "Icosphere"):
                bpy.data.objects.remove(o, do_unlink=True)
        joints = {b: (M @ Vector(h), (M @ Vector(t) - M @ Vector(h)).length) for b, (h, t) in JOINTS.items()}
        bone_of = {k: k for k in JOINTS}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.parent is not None and o.parent.type == "ARMATURE":
            bpy.data.objects.remove(o, do_unlink=True)
    if arm.animation_data:
        arm.animation_data.action = None
        for t in arm.animation_data.nla_tracks:
            t.mute = True
    else:
        arm.animation_data_create()
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        if eb.name not in joints:
            continue
        head, length = joints[eb.name]
        roll, direction = eb.roll, (eb.tail - eb.head).normalized()
        eb.use_connect = False
        eb.head = head
        eb.tail = head + direction * max(length, 0.01)  # keep the rig's own direction: its clips stay valid
        eb.roll = roll
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    for o, bone in parts:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        arm.data.bones.active = arm.data.bones[bone_of[bone]]
        bpy.ops.object.parent_set(type="BONE", keep_transform=True)
    arm.data.pose_position = "POSE"
    return arm


def centre(scene):
    pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2


def setup_render(scene, size, scale=1.0):
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.3
    sun.rotation_euler = (math.radians(40), math.radians(-18), math.radians(120))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 1.2 * scale  # the same for everyone, so sizes compare
    scene.collection.objects.link(cam)
    c = centre(scene)
    target = Vector((c.x, c.y, 0.42 * scale))
    front = Vector((1.0, -0.62, 0.35)) if scale == 1.0 else Vector((0.62, -1.0, 0.35))  # PN faces +X, KayKit faces -Y
    cam.location = target + front.normalized() * 8 * scale
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 50 * scale
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.fps = 30


def render_clip(scene, arm, slug, clip, frames):
    act = bpy.data.actions[clip]
    ad = arm.animation_data
    ad.action = act
    if act.slots:
        ad.action_slot = act.slots[0]
    a, b = act.frame_range
    for k in range(frames):
        scene.frame_set(int(round(a + (b - a) * k / frames)))
        scene.render.filepath = os.path.join(OUT, slug, f"{clip}-{k:03d}.png")
        bpy.ops.render.render(write_still=True)


# matched clips for the side-by-side: (label, PN clip, KayKit clip, frames)
PAIRS = [("idle", "01_Idle_1", "Idle_A", 16), ("run", "05_Run", "Running_A", 12), ("jump", "07_Jump_Stand", "Jump_Full_Short", 16),
         ("pick up", "11_Action_Two-Handed_Low", "PickUp", 16), ("celebrate", "18_Success_Celebration", "Cheering", 16),
         ("wave", "15_Waving_Right", "Waving", 16)]
GRID_PAIRS = [p for p in PAIRS if p[0] in ("run", "celebrate")]

for slug in SLUGS:
    for kind in ("pn", "kaykit"):
        arm = rig(slug, kind)
        scene = bpy.context.scene
        setup_render(scene, 240 if MODE == "grid" else 300, 1.0 if kind == "pn" else KS / S)
        for label, pn_clip, kk_clip, frames in (GRID_PAIRS if MODE == "grid" else PAIRS):
            clip = pn_clip if kind == "pn" else kk_clip
            act = bpy.data.actions[clip]
            ad = arm.animation_data
            ad.action = act
            if act.slots:
                ad.action_slot = act.slots[0]
            a, b = act.frame_range
            for k in range(frames):
                scene.frame_set(int(round(a + (b - a) * k / frames)))
                scene.render.filepath = os.path.join(OUT, slug, kind, f"{label.replace(' ', '-')}-{k:03d}.png")
                bpy.ops.render.render(write_still=True)
        print("DONE", slug, kind, flush=True)
