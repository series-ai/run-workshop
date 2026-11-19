"""Toy-style animation test: our own Bobble rig and clips made for it.

Every concept piece is anchored to a part of a simple rig (root, hips,
chest, head, arms, mitts, legs, feet) with the rules from rig_all.py, and
each clip is a function of time that poses those parts: whole-body bounce,
squash and stretch on the root, head tilts and counter-sway, quick waddles
and hops. Loops are sums of whole-cycle sines, so they close by construction.

    Blender -b --factory-startup --python toyanim.py -- <out dir> <slug> [<slug> ...]
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import math
import os
import sys

_args = sys.argv[sys.argv.index("--") + 1:]
OUT, SLUGS = _args[0], _args[1:]
sys.argv = [sys.argv[0], "--", OUT, "x"]
_src = open(_PKG + "/rig/rig_all.py").read()
exec(compile(_src.split("# matched clips for the side-by-side")[0], "rig_all.py", "exec"))  # BUILDS, B, classify_all, centre ...
OUT, SLUGS = _args[0], _args[1:]  # the exec above set its own OUT and SLUGS

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

R = math.radians
TAU = 2 * math.pi

# -- the rig: one empty per part, at its pivot, world-aligned (front -y, left +x, up z) --
SHZ = B.TOP - 0.15
PIVOTS = {
    "root": (0, 0, 0), "hips": (0, 0, B.HIP), "chest": (0, 0, B.HIP + B.TH * 0.36), "head": (0, 0, B.TOP),
    "arm.l": (SH_X, 0, SHZ), "arm.r": (-SH_X, 0, SHZ),
    "hand.l": B.hand_points()[1], "hand.r": B.hand_points()[-1],
    "leg.l": (LEG_X, 0, B.HIP), "leg.r": (-LEG_X, 0, B.HIP),
    "foot.l": (LEG_X, 0, B.FOOT * 0.4), "foot.r": (-LEG_X, 0, B.FOOT * 0.4),
}
SUIT = {"on": False}
SKIRT = {"on": False}
WINDOW = {"on": False}
FORCE_WINDOW = {"wizard"}  # the beard covers the body: head, chest and hips move as one block  # the face looks out of a window in the costume: the head never moves on its own
PARENT = {"prop.l": "hand.l", "prop.r": "hand.r", "hips": "root", "chest": "hips", "head": "chest", "arm.l": "chest", "arm.r": "chest", "hand.l": "arm.l", "hand.r": "arm.r",
          "leg.l": "root", "leg.r": "root", "foot.l": "leg.l", "foot.r": "leg.r"}
ANCHOR = {"Prop.L": "prop.l", "Prop.R": "prop.r", "Root": "root", "Body": "hips", "Chest": "chest", "Head": "head", "Arm.L": "arm.l", "Arm.R": "arm.r", "Hand.L": "hand.l",
          "Hand.R": "hand.r", "Leg.L": "leg.l", "Leg.R": "leg.r", "LowerLeg.L": "leg.l", "LowerLeg.R": "leg.r", "Foot.L": "foot.l", "Foot.R": "foot.r"}


TAG_ANCHOR = {"root": "Root", "body": "Body", "hips": "Body", "chest": "Chest", "head": "Head"}


def tagged_parts(objs):
    """The rig part each tagged piece rides on (the costume said so with `with part(...)`).
    Sideless arm/hand/prop/leg/foot tags take a side: a whole block (one part_id) picks the
    side of the mitt nearest its middle, so a held prop is never split."""
    out, groups = {}, {}
    for o in objs:
        if "part" in o:
            groups.setdefault((o["part"], o.get("part_id", id(o))), []).append(o)
    mitts = {s: Vector(B.hand_points()[s]) for s in (1, -1)}
    for (tag, _), ms in groups.items():
        base, _, side = tag.partition(".")
        if base in TAG_ANCHOR:
            name = TAG_ANCHOR[base]
        else:
            if not side:
                mid = sum(((bounds(o)[0]) for o in ms), Vector()) / len(ms)
                side = "l" if (mid - mitts[1]).length <= (mid - mitts[-1]).length else "r"
            name = {"arm": "Arm", "hand": "Hand", "prop": "Prop", "leg": "Leg", "foot": "Foot"}[base] + "." + side.upper()
        for o in ms:
            out[o] = name
    return out


def settle_fit(objs):
    """settle_arms, but a long posed arm (raised, pointing) also shortens to the
    standard reach: the arm pieces squash along the arm and the hand moves in,
    so the mitt lands where a hanging mitt sits instead of under the floor."""
    chains = find_arms(objs)
    skin = tuple(round(c, 3) for c in B.SKIN)
    tags = tagged_parts(objs)
    for s in (1, -1):  # tagged arms: the costume says exactly which pieces are the arm, the mitt and what it holds
        sd = "L" if s > 0 else "R"
        arm = [o for o in objs if tags.get(o) == f"Arm.{sd}"]
        hand = [o for o in objs if tags.get(o) in (f"Hand.{sd}", f"Prop.{sd}")]
        mitts = [o for o in hand if tags[o] == f"Hand.{sd}" and _colour(o) == skin]
        if arm and mitts:
            chains[s] = (arm, hand, bounds(max(mitts, key=lambda o: bounds(o)[1].length))[0])
    for s, (arm, hand, far) in chains.items():
        if any(o.name in BUCKET for o in hand):  # the bucket moves whole: candy that didn't touch the hand too
            hand.extend(o for o in objs if o.name in BUCKET and o not in hand and o not in arm)
        shoulder = Vector((s * SH_X, 0.0, SHZ))
        mitt = Vector(B.hand_points()[s])
        if (far - mitt).length < 0.45:
            continue
        q = (far - shoulder).normalized().rotation_difference((mitt - shoulder).normalized())
        Rm = Matrix.Translation(shoulder) @ q.to_matrix().to_4x4() @ Matrix.Translation(-shoulder)
        k = min(1.0, (mitt - shoulder).length / max(1e-6, (far - shoulder).length))
        d = (mitt - shoulder).normalized()
        S3 = Matrix.Identity(3) + (k - 1.0) * Matrix(((d.x * d.x, d.x * d.y, d.x * d.z), (d.y * d.x, d.y * d.y, d.y * d.z), (d.z * d.x, d.z * d.y, d.z * d.z)))
        Sm = Matrix.Translation(shoulder) @ S3.to_4x4() @ Matrix.Translation(-shoulder)
        rot_far = Rm @ far
        new_far = shoulder + (rot_far - shoulder) * k
        shift = Matrix.Translation(new_far - rot_far)
        undo = Matrix.Translation(new_far) @ q.to_matrix().to_4x4().inverted() @ Matrix.Translation(-new_far)
        for o in arm:
            o.matrix_world = Sm @ Rm @ o.matrix_world
        for o in hand:
            o.matrix_world = shift @ Rm @ o.matrix_world
            if _colour(o) != skin:
                o.matrix_world = undo @ o.matrix_world  # a held prop keeps its orientation
    bpy.context.view_layer.update()
    return chains


def fix_anchors(slug, meshes, anchors):
    """Clean-up rules on top of classify_all, from the in-motion review."""
    skin = tuple(round(c, 3) for c in B.SKIN)
    info = {o: bounds(o) for o in meshes}
    def lohi(o):
        c, z = info[o]
        return c - z / 2, c + z / 2
    # anything that sits entirely inside the standard head box (the head cube, the face, a hood's lining)
    # follows the head, whatever shell it is inside: the face never slides off the head
    hz_lo = Vector((-B.HEAD / 2 - 0.25, -B.HEAD * 0.46 - 0.3, B.HEAD_Z - B.HEAD * 0.45 - 0.2))
    hz_hi = Vector((B.HEAD / 2 + 0.25, B.HEAD * 0.46 + 0.25, B.HEAD_Z + B.HEAD * 0.45 + 0.25))
    for o in meshes:
        lo, hi = lohi(o)
        if o.name in BUCKET or anchors[o].startswith(("Hand.", "Arm.")):
            continue
        if all(hz_lo[i] <= lo[i] and hi[i] <= hz_hi[i] for i in range(3)):
            anchors[o] = "Head"
    for o in meshes:
        a = anchors[o]
        c, z = info[o]
        lo, hi = lohi(o)
        side = "L" if c.x > 0 else "R"
        if o.name in BUCKET:
            continue
        # a thin upright piece in a leg column that starts below the hips is a leg (tights up under a costume)
        if a.startswith(("Arm.", "Hand.")) and abs(abs(c.x) - LEG_X) < 0.15 and lo.z < B.HIP and z.z > 2 * max(z.x, z.y):
            anchors[o] = f"Leg.{side}"
        # a piece on the middle line is never a leg (apron pockets, a buckle)
        elif a.startswith(("Leg.", "Foot.", "LowerLeg.")) and abs(c.x) < 0.12:
            anchors[o] = "Body"
        # arm pieces low against the torso are costume (straps, a sash), not the arm
        elif a.startswith("Arm.") and abs(c.x) < B.TW * 0.5 and c.z < SHZ - 0.5 and _colour(o) != skin:
            anchors[o] = "Body"
    # a head piece far below the head (a peel tip in hair brown) stays on the head only if a chain of
    # touching head pieces links it up to the head; otherwise it joins what it touches
    def gap(a, b):
        (al, ah), (bl, bh) = lohi(a), lohi(b)
        return max(max(bl[i] - ah[i], al[i] - bh[i]) for i in range(3))
    head_bottom = B.HEAD_Z - B.HEAD * 0.45
    heads = [o for o in meshes if anchors[o] == "Head"]
    linked = {o for o in heads if lohi(o)[1].z >= head_bottom}
    grew = True
    while grew:
        grew = False
        for o in heads:
            if o not in linked and any(gap(o, q) < 0.1 for q in linked):
                linked.add(o)
                grew = True
    for o in heads:
        if o not in linked:
            near = [q for q in meshes if anchors[q] != "Head" and gap(o, q) < 0.1]
            anchors[o] = anchors[max(near, key=lambda q: info[q][1].length)] if near else "Body"
    # a head piece well below the shoulders that isn't hair (a tail, a cape, a robe back) is the body's
    tops = [o for o in meshes if lohi(o)[0].z > B.HEAD_Z and _colour(o) != skin]
    hair_rgb = _colour(max(tops, key=lambda o: info[o][1].length)) if tops else None
    for o in meshes:
        if anchors[o] == "Head" and info[o][0].z < head_bottom - 0.4 and _colour(o) != hair_rgb and o.name not in BUCKET:
            near = [q for q in meshes if anchors[q] != "Head" and gap(o, q) < 0.1]
            anchors[o] = anchors[max(near, key=lambda q: info[q][1].length)] if near else "Body"
    # a mitten's thumb caught by the head rule (a cactus arm up beside the head) goes back to its hand
    for o in meshes:
        c, z = info[o]
        if anchors[o] == "Head" and _colour(o) == skin and z.length < 0.4 and abs(c.x) > B.HEAD * 0.55:
            anchors[o] = "Hand.L" if c.x > 0 else "Hand.R"
    # a held thing that stands on the ground (a cart, a hose run) stays on the ground: it goes to the root,
    # except the bit inside the mitt
    for sd in ("L", "R"):
        held = [o for o in meshes if anchors[o] == f"Hand.{sd}" and _colour(o) != skin and o.name not in BUCKET]
        mitts = [o for o in meshes if anchors[o] == f"Hand.{sd}" and _colour(o) == skin]
        if not held or not mitts:
            continue
        mc = info[max(mitts, key=lambda o: info[o][1].length)][0]
        if min(lohi(o)[0].z for o in held) < 0.2 and max(lohi(o)[1].z for o in held) - min(lohi(o)[0].z for o in held) > 0.9:
            for o in held:
                if (info[o][0] - mc).length > 0.45:
                    anchors[o] = "Root"
    # pieces inside the shoulder line that ended up on an arm (overall straps, shirt panels) are clothing
    for o in meshes:
        c, z = info[o]
        if anchors[o].startswith("Arm.") and abs(c.x) < SH_X - 0.05 and _colour(o) != skin:
            anchors[o] = "Body"
    # decorations (stripes, buttons, nubs, trims) follow the smallest piece they sit on or in
    vol = {o: info[o][1].x * info[o][1].y * info[o][1].z for o in meshes}
    for o in meshes:
        c, z = info[o]
        if o.name in BUCKET or _colour(o) == skin or z.length > 0.8:
            continue
        hosts = []
        for q in meshes:
            if q is o or q.name in BUCKET or info[q][1].length < z.length * 1.5:
                continue
            ql, qh = lohi(q)
            if all(ql[i] - 0.04 <= c[i] <= qh[i] + 0.04 for i in range(3)):
                hosts.append(q)
        if hosts:
            host = anchors[min(hosts, key=lambda q: vol[q])]
            legs = ("Leg.", "LowerLeg.", "Foot.")
            if anchors[o].startswith(legs) and not host.startswith(legs):
                continue  # a shoe or a sock is never re-homed into a costume around it
            if host == "Head" and c.z < B.HEAD_Z - B.HEAD * 0.45 - 0.3:
                continue  # nothing near the floor joins the head because long hair surrounds it
            anchors[o] = host
    # orphans: a piece that touches only pieces of other body parts slides off them when they move;
    # it joins what it is attached to (the largest piece it touches). Mitts, the bucket and the
    # standard limbs keep their part.
    def fam(a):
        if a.startswith(("Arm.", "Hand.")):
            return "arm" + a[-1]
        if a.startswith(("Leg.", "LowerLeg.", "Foot.")):
            return "leg" + a[-1]
        return a  # hips and chest twist apart, so they count as different parts here
    def gap(a, b):
        (al, ah), (bl, bh) = lohi(a), lohi(b)
        return max(max(bl[i] - ah[i], al[i] - bh[i]) for i in range(3))
    touch = {o: [q for q in meshes if q is not o and gap(o, q) < 0.04] for o in meshes}
    for _ in range(4):
        changed = False
        for o in meshes:
            if o.name in BUCKET or _colour(o) == skin or not touch[o]:
                continue
            if any(fam(anchors[q]) == fam(anchors[o]) for q in touch[o]):
                continue
            big = max(touch[o], key=lambda q: info[q][1].length)
            if anchors[big] != anchors[o]:
                anchors[o] = anchors[big]
                changed = True
        if not changed:
            break
    # a loose piece touching nothing (a sparkle by a wand, a seed) goes with the nearest piece
    for o in meshes:
        if o.name in BUCKET or touch[o]:
            continue
        near = min((q for q in meshes if q is not o), key=lambda q: gap(o, q))
        anchors[o] = anchors[near]
    for o in meshes:  # the head box wins over the decoration and orphan rules: the face stays on the head
        lo, hi = lohi(o)
        if o.name not in BUCKET and not anchors[o].startswith(("Hand.", "Arm.")) and all(hz_lo[i] <= lo[i] and hi[i] <= hz_hi[i] for i in range(3)):
            anchors[o] = "Head"
    for o in meshes:
        r = OVERRIDE.get(slug)
        if r:
            new = r(o, anchors[o], info[o][0], info[o][1], _colour(o))
            if new:
                anchors[o] = new
    return anchors


# per-costume fixes: (piece, anchor, centre, size, colour) -> new anchor or None
def _skin(col):
    return col == tuple(round(v, 3) for v in B.SKIN)


OVERRIDE = {
    # the rider's fake legs and the mount's head belong to the mount's body; the lasso arm grows from the head side, so the lasso rides the head
    "cowboy-horse": lambda o, a, c, z, col: "Head" if col == (0.9, 0.78, 0.48)
        else ("Body" if a == "Head" and (c.y < -1.3 or c.z < B.HEAD_Z - B.HEAD * 0.45) else None),
    # the ostrich's neck and head belong to the ostrich body
    "ostrich-rider": lambda o, a, c, z, col: "Body" if (a == "Head" and (c.x < -1.15 or c.y < -1.3 or c.z < B.HEAD_Z - B.HEAD * 0.45)) or col == (1.0, 0.55, 0.72) else None,
    # the vendor's tray hangs from his neck: bolted to the chest
    "hot-dog-vendor": lambda o, a, c, z, col: "Chest" if a.startswith("Hand.") and not _skin(col) and o.name not in BUCKET else None,
    # every tentacle (and the octopus skirt) is the body; only the hood and face ride the head
    "octopus": lambda o, a, c, z, col: "Body" if col in ((0.86, 0.36, 0.66), (1.0, 0.8, 0.86)) and c.z < B.HEAD_Z - B.HEAD * 0.45 and o.name not in BUCKET else None,
    # the snake crown and the headdress side flaps are the headdress
    "cleopatra": lambda o, a, c, z, col: None if a.startswith("Hand.") else ("Head" if col == (0.3, 0.68, 0.3) or (c.z > B.TOP + 0.3 and abs(c.x) > 0.9 and col in ((0.14, 0.3, 0.78), (1.0, 0.78, 0.18))) else None),
    # the tail is the hood's green, but it is the suit's tail
    "inflatable-trex": lambda o, a, c, z, col: "Body" if a == "Head" and c.z < B.HEAD_Z - B.HEAD * 0.45 else None,
    # the cape hangs from the shoulders
    "superhero": lambda o, a, c, z, col: "Chest" if col == (0.92, 0.14, 0.18) and c.y > 0.3 and c.z < B.HEAD_Z - B.HEAD * 0.45 else None,
    # the tentacle ribbons hang from the bell hat
    "jellyfish": lambda o, a, c, z, col: "Head" if a in ("Body", "Chest") and c.z + z.z / 2 > B.HEAD_Z - B.HEAD * 0.45 else None,
    # the ginger beard spills from under the helmet: it rides the helmet
    "ned-kelly": lambda o, a, c, z, col: "Head" if col == (0.85, 0.4, 0.12) else None,
    # swords on the back ride the chest; the red belt tails are the body
    "ninja": lambda o, a, c, z, col: "Chest" if c.y > 0.9 else ("Body" if a.startswith(("Leg.", "Foot.")) and col in ((0.68, 0.08, 0.1), (0.92, 0.14, 0.16)) else None),
    # the spider's extra legs move as one with its hood
    "spider": lambda o, a, c, z, col: "Head" if abs(c.x) > 1.6 and a in ("Chest", "Body", "Root") else None,
    # the tentacles and the creature's own arms are the costume, not things in the hands
    "octopus": lambda o, a, c, z, col: "Body" if a.startswith("Hand.") and col != tuple(round(v, 3) for v in B.SKIN) and o.name not in BUCKET else None,
    "alien-blob": lambda o, a, c, z, col: "Body" if a.startswith("Hand.") and col != tuple(round(v, 3) for v in B.SKIN) and o.name not in BUCKET else None,
    # the carried kid's dangling legs ride on the alien's body
    "alien-carry": lambda o, a, c, z, col: "Body" if a.startswith(("Hand.", "Arm.", "Foot.", "Leg.")) and col in ((0.25, 0.42, 0.78), (0.95, 0.25, 0.3)) else None,
}


def build_rig(slug):
    BUCKET.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    B._mats.clear()
    BUILDS[slug]()
    BUCKET.update(o.name for o in bpy.data.objects if o.get("bucket"))  # buckets built any way count
    bpy.context.view_layer.update()
    # boolean cuts (face openings) are baked into their meshes and the hidden cutters removed,
    # so no cutter gets anchored, exported or counted by the rules below
    dg = bpy.context.evaluated_depsgraph_get()
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "BOOLEAN" for m in o.modifiers)]:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear()
        o.data = me
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH" and o.hide_render and "expr" not in o]:
        bpy.data.objects.remove(o, do_unlink=True)  # boolean cutters (expression pieces are hidden in renders too)
    for o in bpy.context.scene.objects:
        if "expr" in o:
            o.hide_render = False
    bpy.context.view_layer.update()
    if "neck_stub" not in bpy.data.objects:  # a costume whose kid isn't skin (a ghost) makes its own, in its colour
        B.can(0, 0.05, B.TOP + 0.3, 0.42, 0.75, B.SKIN, n=8).name = "neck_stub"  # a neck stub inside the head's overhang
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    settle_fit(meshes)  # custom-posed arms (raised, holding a wand) swing down to the hanging pose
    anchors = fix_anchors(slug, meshes, classify_all(meshes))
    tags = tagged_parts(meshes)
    anchors.update(tags)  # what the costume tagged is never guessed
    import collections
    print("ANCHORS", slug, dict(collections.Counter(ANCHOR[a] for a in anchors.values())), flush=True)
    # arms that come out of a costume far from the shoulder (a full-body suit) pivot where they leave
    # the costume: the inner edge of their mitten, so they flap like flippers instead of sinking into it
    pivots = dict(PIVOTS)
    for side, sg in (("l", 1), ("r", -1)):
        mitts = [o for o in meshes if anchors[o] == ("Hand.L" if sg > 0 else "Hand.R") and _colour(o) == tuple(round(c, 3) for c in B.SKIN)]
        if not mitts:
            continue
        c, size = bounds(max(mitts, key=lambda o: bounds(o)[1].length))
        if abs(c.x) > SH_X + 0.9:
            pivots[f"arm.{side}"] = (c.x - sg * (size.x / 2 + 0.1), c.y, c.z + size.z / 2)
            print("FLIPPER", slug, side, tuple(round(v, 2) for v in pivots[f"arm.{side}"]), flush=True)
    # a held prop hangs from a grip point at the top of its mitten and swings a beat behind the hand
    skin = tuple(round(c, 3) for c in B.SKIN)
    for side, sg in (("l", 1), ("r", -1)):
        mitts = [o for o in meshes if anchors[o] == ("Hand.L" if sg > 0 else "Hand.R") and _colour(o) == skin]
        if mitts:
            c, size = bounds(max(mitts, key=lambda o: bounds(o)[1].length))
            pivots[f"prop.{side}"] = (c.x, c.y, c.z)  # the grip: the middle of the mitten
        else:
            pivots[f"prop.{side}"] = pivots[f"hand.{side}"]
    # a skirt, robe or suit round the legs: the gait keeps the knees low so legs never push through it
    SKIRT["on"] = any(anchors[o] in ("Body", "Chest", "Root") and bounds(o)[1].x > 1.2
                      and bounds(o)[0].z - bounds(o)[1].z / 2 < B.HIP + 0.35  # within reach of a lifted foot
                      and bounds(o)[0].x - bounds(o)[1].x / 2 < -LEG_X and bounds(o)[0].x + bounds(o)[1].x / 2 > LEG_X
                      for o in meshes)
    print("SKIRT", slug, SKIRT["on"], flush=True)
    SUIT["on"] = any(anchors[o] == "Body" and bounds(o)[1].length > 2.5 and bounds(o)[0].z + bounds(o)[1].z / 2 > B.TOP + 1.0 for o in meshes)
    print("SUIT", slug, SUIT["on"], flush=True)
    heads = [o for o in meshes if anchors[o] == "Head" and _colour(o) == skin]
    # no head cube on the head (the face plate belongs to the costume): the features must not wander off it
    WINDOW["on"] = not any(bounds(o)[1].x > 1.6 for o in meshes if anchors[o] == "Head")
    if heads:
        hc = bounds(max(heads, key=lambda o: bounds(o)[1].length))[0]
        for o in meshes:
            if anchors[o] in ("Body", "Chest", "Root"):
                c, z = bounds(o)
                lo, hi = c - z / 2, c + z / 2
                if z.x > 1.5 and lo.x < hc.x < hi.x and lo.z < hc.z < hi.z and lo.y < hc.y + 0.3 and hi.y > hc.y:
                    WINDOW["on"] = True
                    break
    WINDOW["on"] = WINDOW["on"] or slug in FORCE_WINDOW
    if not WINDOW["on"]:  # costume pieces high above the head centre (stars on a hat) ride the head
        for o in meshes:
            c, z = bounds(o)
            if anchors[o] in ("Body", "Chest") and c.z - z.z / 2 > B.HEAD_Z and o not in tags:
                anchors[o] = "Head"
    print("WINDOW", slug, WINDOW["on"], flush=True)
    parts = {}
    for name in ["root", "hips", "chest", "head", "arm.l", "arm.r", "hand.l", "hand.r", "prop.l", "prop.r", "leg.l", "leg.r", "foot.l", "foot.r"]:
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = pivots[name]
        parts[name] = e
    bpy.context.view_layer.update()
    for child, parent in PARENT.items():
        c = parts[child]
        mw = c.matrix_world.copy()
        c.parent = parts[parent]
        c.matrix_world = mw
    bpy.context.view_layer.update()
    for o in meshes:
        a = ANCHOR[anchors[o]]
        if a.startswith("hand.") and _colour(o) != skin and o not in tags:
            a = "prop." + a[-1]  # held props hang from the grip
        e = parts[a]
        mw = o.matrix_world.copy()
        o.parent = e
        o.matrix_world = mw
    # the trick-or-treat bucket hangs from its own switch under whatever part carries it, so a game
    # can hide it (scale the "bucket" bone to zero); it isn't animated, it just rides its parent
    bk = [o for o in meshes if o.get("bucket")]
    if bk:
        host = bk[0].parent
        e = bpy.data.objects.new("bucket", None)
        bpy.context.scene.collection.objects.link(e)
        e.location = Vector(max((bounds(o)[0] for o in bk), key=lambda c: c.z))  # the top: the handle in the mitt
        bpy.context.view_layer.update()
        mw = e.matrix_world.copy()
        e.parent = host
        e.matrix_world = mw
        bpy.context.view_layer.update()
        for o in bk:
            om = o.matrix_world.copy()
            o.parent = e
            o.matrix_world = om
        parts["bucket"] = e
    # expressions: each swappable mouth or brow pair (blockout.expressions) hangs from its own
    # switch under the part the face rides; a switch is shown at scale 1 and hidden at scale 0
    groups = {}
    for o in meshes:
        if "expr" in o:
            groups.setdefault(o["expr"], []).append(o)
    for name, ms in groups.items():
        host = ms[0].parent
        e = bpy.data.objects.new("expr." + name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = sum((bounds(o)[0] for o in ms), Vector()) / len(ms)
        bpy.context.view_layer.update()
        mw = e.matrix_world.copy()
        e.parent = host
        e.matrix_world = mw
        bpy.context.view_layer.update()
        for o in ms:
            om = o.matrix_world.copy()
            o.parent = e
            o.matrix_world = om
        parts[e.name] = e
    bpy.context.view_layer.update()
    # a tall held prop (staff, broom, sword) leans with the arm so it never sweeps across the face;
    # a short one (bucket, ball, wand) hangs upright under the mitt
    for side in ("l", "r"):
        ms = [o for o in parts[f"prop.{side}"].children if o.type == "MESH"]
        h = max((bounds(o)[0].z + bounds(o)[1].z / 2 for o in ms), default=0) - min((bounds(o)[0].z - bounds(o)[1].z / 2 for o in ms), default=0)
        span = max(h, max(((bounds(o)[0] - parts[f"prop.{side}"].location).length for o in ms), default=0) * 2)
        PROP_CANCEL[side] = 0.5 if span > 1.6 else 0.92
        PROP_SPAN[side] = span if ms else 0.0
    FREE["side"] = "l" if PROP_SPAN["l"] < PROP_SPAN["r"] else "r"  # the emptier mitt waves and eats
    rest = {n: e.location.copy() for n, e in parts.items()}
    apply_face(parts, {})
    return parts, rest


PROP_CANCEL = {"l": 0.92, "r": 0.92}
PROP_SPAN = {"l": 0.0, "r": 0.0}
FREE = {"side": "r"}


def one_arm(side, rot_r):
    """A one-armed move written for the right arm, put on `side` (the left mirrors y and z)."""
    x, y, z = rot_r
    return ((0, 0, 0), (x, y, z) if side == "r" else (x, -y, -z), None)


FACE_REST = {"mouth": "smile", "brow": None, "eyes": "open"}


def apply_face(parts, p):
    """Show the clip's expression: one mouth, at most one brow pair (p["face"]); the rest hidden."""
    f = {**FACE_REST, **p.get("face", {})}
    for name, e in parts.items():
        if name.startswith("expr."):
            kind, _, which = name[5:].partition(".")
            e.rotation_euler = (0, 0, 0)
            e.scale = (1, 1, 1) if f.get(kind) == which else (0, 0, 0)


def wave(t, period, cycles=1, phase=0.0):
    return math.sin(TAU * cycles * t / period + phase)


def hop(t, period, cycles=1, phase=0.0):
    """|sin|: a bounce that touches the ground twice per sine cycle."""
    return abs(math.sin(math.pi * cycles * t / period + phase))


def ease(a, b, x):
    x = max(0.0, min(1.0, x))
    x = x * x * (3 - 2 * x)
    return a + (b - a) * x


def keys(t, ks):
    """Piecewise eased value from [(time, value), ...] (value a float or a tuple)."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1:
            x = (t - t0) / (t1 - t0)
            if isinstance(v0, tuple):
                return tuple(ease(a, b, x) for a, b in zip(v0, v1))
            return ease(v0, v1, x)
    return ks[-1][1]


# -- clips: pose(t) -> {part: (loc offset, rot degrees xyz, scale)}. Rotation signs (world axes):
#    x>0 tips the top forward (a nod; a hanging limb swings back), x<0 swings a hanging limb forward;
#    y>0 tilts the top toward the kid's left; z turns left. --

def crouch(d):
    """A crouch of depth d (concept units): the hips sink by d and both legs
    move down with them and shorten, so the soles stay on the ground."""
    k = max(0.3, (B.HIP - d) / B.HIP)
    return {"hips": (0, 0, -d), "leg": ((0, 0, -d), k)}


def merge(base, c):
    """Add a crouch into a pose."""
    hl, hr, hs = base.get("hips", ((0, 0, 0), (0, 0, 0), None))
    base["hips"] = (tuple(a + b for a, b in zip(hl, c["hips"])), hr, hs)
    for leg in ("leg.l", "leg.r"):
        ll, lr, _ = base.get(leg, ((0, 0, 0), (0, 0, 0), None))
        base[leg] = (tuple(a + b for a, b in zip(ll, c["leg"][0])), lr, (1, 1, c["leg"][1]))
    return base


def step(u, stride, lift):
    """One foot's step over a cycle u in [0, 1): swing (lift, carry forward) in the
    first half, stance (planted, sliding back under the body) in the second.
    Returns (y offset, z offset); forward is -y."""
    y = stride * math.cos(TAU * u)            # back (+) -> front (-) in the swing, front -> back in the stance
    z = lift * max(0.0, math.sin(TAU * u))     # lifted only in the swing
    return y, z


def idle(t):
    # feet planted; the body shifts its weight side to side with little knee dips, breathes,
    # tilts and turns the head to look around, arms swaying
    T = 2.4
    w = wave(t, T, 1)
    p = {
        "hips": ((0.05 * w, 0, 0), (0, 5 * w, 0), None),
        "chest": ((0, 0, 0), (3 * wave(t, T, 2, 1.0), -2 * w, 0), (1 + 0.03 * wave(t, T, 2), 1 + 0.03 * wave(t, T, 2), 1 - 0.02 * wave(t, T, 2))),
        "head": ((0, 0, 0), (5 * wave(t, T, 2, 0.6), -8 * w, 16 * wave(t, T, 1, 0.9)), None),
        "arm.l": ((0, 0, 0), (-10 * w, -6 - 5 * wave(t, T, 2), 0), None),
        "arm.r": ((0, 0, 0), (10 * w, 6 + 5 * wave(t, T, 2), 0), None),
        "face": {"eyes": blink(t, (1.3,))},
    }
    return merge(p, crouch(0.05 * (1 + wave(t, T, 2, -math.pi / 2))))


def gait(t, T, stride, lift, bob, sway, arm, lean, turn):
    """A grounded toy gait: each foot steps while the other is planted; the body
    above the legs bobs (lowest at each footfall), shifts over the planted foot,
    turns with the arm swing, and the head counters it."""
    u = (t % T) / T
    yl, zl = step(u, stride, lift)
    yr, zr = step((u + 0.5) % 1.0, stride, lift)
    c = math.cos(TAU * u)
    sn = math.sin(TAU * u)
    down = math.cos(2 * TAU * u)   # 1 at each footfall (u = 0, 0.5), -1 between
    return {
        "leg.l": ((0, yl, zl), (-10 * max(0.0, sn), 0, 0), None),   # the swinging leg reaches forward; the planted one stays flat
        "leg.r": ((0, yr, zr), (-10 * max(0.0, -sn), 0, 0), None),
        "foot.l": ((0, 0, 0), (-14 * max(0.0, sn), 0, 0), None),   # toe lifts as the foot swings
        "foot.r": ((0, 0, 0), (14 * min(0.0, sn), 0, 0), None),
        "hips": ((-sway * 0.012 * sn, 0, 0), ((lean * 0.3 if SUIT["on"] else lean), -sway * sn, 0), None),
        "chest": ((0, 0, 0), (0, 0, -turn * c), None),
        "head": ((0, 0, 0), (-2 * down, sway * 0.6 * sn, turn * 0.6 * c), None),
        "arm.l": ((0, 0, 0), (-arm * c - (lean * 0.6), -6, 0), None),
        "arm.r": ((0, 0, 0), (arm * c - (lean * 0.6), 6, 0), None),
        "root": ((0, 0, 0), (0, sway * 0.8 * sn, 0), None),          # the whole toy rocks over the planted foot
    }


def walk(t):
    T = 0.8
    p = gait(t, T, stride=0.22, lift=0.07 if SKIRT["on"] else 0.2, bob=0.0, sway=9.0, arm=34.0, lean=3.0, turn=9.0)
    u = (t % T) / T
    return merge(p, crouch(0.07 * (1 + math.cos(2 * TAU * u)) / 2))   # dip onto each footfall


def run(t):
    """A happy toy run: knees drive up and heels kick back, a springy airborne bounce
    between footfalls (squash on landing, stretch at the top), big arm pumps, the
    body leaning into it while the head stays up looking ahead."""
    T = 0.5
    u = (t % T) / T

    k = 0.25 if SKIRT["on"] else 1.0  # under a skirt or suit the legs swing small: knees low, feet flat

    def leg(p):
        if p < 0.5:  # swing: lift and carry the foot forward, knee driving up
            sw = p / 0.5
            return (0.0, 0.2 * math.cos(math.pi * sw), 0.3 * k * math.sin(math.pi * sw)), (k * (22 * math.cos(math.pi * sw) - 18 * math.sin(math.pi * sw)), 0, 0)
        st = (p - 0.5) / 0.5  # stance: the foot pushes back under the body
        return (0.0, -0.2 + 0.4 * st, 0.0), (k * (-22 + 44 * st), 0, 0)

    (yl, rl), (yr, rr) = leg(u), leg((u + 0.5) % 1.0)
    f = (2 * u) % 1.0                       # 0 = a footfall
    air = math.sin(math.pi * f)             # up between footfalls
    contact = max(0.0, 1 - f / 0.18) + max(0.0, (f - 0.88) / 0.12)
    sz = 1 + 0.07 * air - 0.09 * contact
    sxy = 1 / math.sqrt(sz)
    c = math.cos(TAU * u)
    return {
        "root": ((0, 0, 0.26 * air), (0, 4 * math.sin(TAU * u), 0), (sxy, sxy, sz)),
        "hips": ((0, 0, 0), (4 if SUIT["on"] or SKIRT["on"] else 13, 7 * math.sin(TAU * u) if SUIT["on"] else 0, 0), None),
        "chest": ((0, 0, 0), (0, 0, -9 * c), None),
        "head": ((0, 0, 0), ((-4 if SUIT["on"] else -16) + 6 * contact, 0, 6 * c), None),   # keeps the face up against the lean
        "leg.l": (yl, rl, None),
        "leg.r": (yr, rr, None),
        "foot.l": ((0, 0, 0), (-18 * k * max(0.0, math.sin(TAU * u)), 0, 0), None),
        "foot.r": ((0, 0, 0), (-18 * k * max(0.0, -math.sin(TAU * u)), 0, 0), None),
        "arm.l": ((0, 0, 0), (-12 + 58 * c, -14, 0), None),
        "arm.r": ((0, 0, 0), (-12 - 58 * c, 14, 0), None),
    }


def jump(t):
    # crouch on the legs (anticipation), launch stretch, air with the legs tucked and arms up wide,
    # land and absorb on the legs, recover
    z = keys(t, [(0, 0.0), (0.27, 0.0), (0.34, 0.15), (0.56, 1.6), (0.78, 0.0), (1.2, 0.0)])
    d = keys(t, [(0, 0.0), (0.24, 0.26), (0.32, 0.0), (0.78, 0.0), (0.86, 0.28), (1.05, 0.0), (1.2, 0.0)])
    stretch = keys(t, [(0, 1.0), (0.3, 1.0), (0.36, 1.08), (0.5, 1.0), (1.2, 1.0)])
    arms = keys(t, [(0, 0.0), (0.24, 35.0), (0.38, -25.0), (0.72, -20.0), (0.86, 10.0), (1.2, 0.0)])
    spread = keys(t, [(0, 6.0), (0.24, 6.0), (0.38, 88.0), (0.72, 78.0), (0.86, 15.0), (1.2, 6.0)])  # arms flung out wide
    tk = 0.3 if SKIRT["on"] else 1.0  # under a skirt or suit the legs barely tuck
    tuck = keys(t, [(0, 0.0), (0.36, 0.0), (0.48, 0.12 * tk), (0.7, 0.08 * tk), (0.78, 0.0)])
    head = keys(t, [(0, 0.0), (0.24, 10.0), (0.38, -10.0), (0.86, 9.0), (1.2, 0.0)])
    sxy = 1 / math.sqrt(stretch)
    p = {
        "root": ((0, 0, z), (0, 0, 0), (sxy, sxy, stretch)),
        "head": ((0, 0, 0), (head, 0, 0), None),
        "arm.l": ((0, 0, 0), (arms, -spread, 0), None),
        "arm.r": ((0, 0, 0), (arms, spread, 0), None),
        "leg.l": ((0, -0.04, tuck), (-10 * tuck / 0.12, 0, 0), None),
        "leg.r": ((0, -0.04, tuck), (-10 * tuck / 0.12, 0, 0), None),
        "face": {"mouth": "o" if 0.3 < t < 0.42 else ("grin" if 0.42 <= t < 0.82 else "smile")},
    }
    return merge(p, crouch(d))


def pickup(t):
    # spot it, dip and turn to the side, reach out and down with the near (left) arm where the camera
    # sees it, grab, rise and swing it up and out to show it off with a hop, then settle
    d = keys(t, [(0, 0.0), (0.3, 0.2), (0.6, 0.2), (0.85, 0.0), (1.8, 0.0)])
    z = keys(t, [(0, 0.0), (0.9, 0.0), (1.0, 0.32), (1.12, 0.0), (1.8, 0.0)])
    twist = keys(t, [(0, 0.0), (0.3, -24.0), (0.6, -24.0), (0.9, -8.0), (1.5, -8.0), (1.8, 0.0)])  # the reaching shoulder comes forward
    tilt = keys(t, [(0, 0.0), (0.3, 12.0), (0.6, 12.0), (0.9, -4.0), (1.5, -3.0), (1.8, 0.0)])
    look = keys(t, [(0, 0.0), (0.2, 30.0), (0.6, 36.0), (0.9, 26.0), (1.5, 20.0), (1.8, 0.0)])
    nod = keys(t, [(0, 0.0), (0.3, 8.0), (0.6, 8.0), (0.9, -10.0), (1.5, -6.0), (1.8, 0.0)])
    reach_out = keys(t, [(0, 0.0), (0.3, 38.0), (0.6, 40.0), (0.9, 105.0), (1.5, 100.0), (1.8, 0.0)])
    reach_fwd = keys(t, [(0, 0.0), (0.3, -40.0), (0.6, -40.0), (0.9, -30.0), (1.5, -30.0), (1.8, 0.0)])
    balance = keys(t, [(0, 0.0), (0.3, 30.0), (0.6, 30.0), (0.9, 20.0), (1.5, 15.0), (1.8, 0.0)])
    p = {
        "root": ((0, 0, z), (0, 0, 0), None),
        "hips": ((0, 0, 0), (4, tilt, 0), None),
        "chest": ((0, 0, 0), (0, 0, twist), None),
        "head": ((0, 0, 0), (nod, 0, look), None),
        "arm.l": ((0, 0, 0), (reach_fwd, -reach_out, 0), None),
        "arm.r": ((0, 0, 0), (-10, balance, 0), None),
    }
    return merge(p, crouch(d))


def celebrate(t):
    # two hops, the arms flung out wide to the sides and flapping, the head rocking
    T = 1.0
    u = (t % T) / T
    ph = (u * 2) % 1.0
    air = max(0.0, math.sin(math.pi * min(1.0, ph / 0.6)))
    land = max(0.0, math.sin(math.pi * max(0.0, (ph - 0.6) / 0.4)))
    side = math.sin(TAU * u)
    flap = 70 + 24 * air - 10 * land
    p = {
        "root": ((0, 0, 0.45 * air), (0, 0, 0), None),
        "head": ((0, 0, 0), (-8 * air + 6 * land, 10 * side, 6 * side), None),
        "chest": ((0, 0, 0), (0, 5 * side, 0), None),
        "arm.l": ((0, 0, 0), (-25, -flap, 0), None),
        "arm.r": ((0, 0, 0), (-25, flap, 0), None),
        "leg.l": ((0, 0, 0.06 * air), (-12 * air, 0, 0), None),
        "leg.r": ((0, 0, 0.06 * air), (-12 * air, 0, 0), None),
        "face": {"mouth": "grin"},
    }
    return merge(p, crouch(0.2 * land))


def scared(t):
    """A startle: a sharp little hop with the arms flung up and out and the head thrown back,
    mouth an O and brows worried; land into a cower (crouched, arms pulled in, shaking), then
    shake it off and settle."""
    z = keys(t, [(0, 0.0), (0.1, 0.0), (0.24, 0.55), (0.4, 0.0), (1.5, 0.0)])
    d = keys(t, [(0, 0.0), (0.08, 0.12), (0.14, 0.0), (0.4, 0.0), (0.5, 0.3), (1.1, 0.26), (1.35, 0.0), (1.5, 0.0)])
    fling = keys(t, [(0, 0.0), (0.1, 0.0), (0.24, 1.0), (0.38, 0.8), (0.5, 0.0), (1.5, 0.0)])
    cower = keys(t, [(0, 0.0), (0.42, 0.0), (0.52, 1.0), (1.1, 1.0), (1.35, 0.0), (1.5, 0.0)])
    shake = cower * math.sin(TAU * 9 * t) * (1 if 0.5 < t < 1.15 else 0)
    lean = keys(t, [(0, 0.0), (0.12, 0.0), (0.22, -10.0), (0.42, 6.0), (1.1, 6.0), (1.35, 0.0), (1.5, 0.0)])
    head = keys(t, [(0, 0.0), (0.12, 0.0), (0.22, -14.0), (0.42, 10.0), (1.1, 10.0), (1.35, 0.0), (1.5, 0.0)])
    p = {
        "root": ((0.03 * shake, 0, z), (0, 0, 0), None),
        "hips": ((0, 0, 0), (lean, 0, 0), None),
        "head": ((0, 0, 0), (head, 3 * shake, 0), None),
        # flung: arms out and up to the sides; cower: arms in front, mitts up by the chest
        "arm.l": ((0, 0, 0), (-20 * fling - 55 * cower, -80 * fling + 10 * cower, 0), None),
        "arm.r": ((0, 0, 0), (-20 * fling - 55 * cower, 80 * fling - 10 * cower, 0), None),
        "face": {"mouth": "o" if 0.12 < t < 1.25 else "smile", "brow": "worried" if 0.12 < t < 1.3 else None},
    }
    return merge(p, crouch(d))


def attack(t):
    """Hold your ground and swing: feet planted, a wind-up (lean back, the right arm out and up
    behind, brows angry), a lunging swing forward and across with a grin, a brace, then reset."""
    wind = keys(t, [(0, 0.0), (0.3, 1.0), (0.42, 1.0), (0.55, 0.0), (1.2, 0.0)])
    strike = keys(t, [(0, 0.0), (0.42, 0.0), (0.56, 1.0), (0.8, 0.85), (1.05, 0.0), (1.2, 0.0)])
    d = keys(t, [(0, 0.0), (0.3, 0.1), (0.56, 0.22), (0.85, 0.18), (1.1, 0.0), (1.2, 0.0)])
    lunge = keys(t, [(0, 0.0), (0.3, -0.12), (0.56, 0.2), (0.85, 0.15), (1.1, 0.0), (1.2, 0.0)])
    p = {
        "root": ((0, -0.15 * max(0.0, lunge), 0), (0, 0, 0), None),
        "hips": ((0, 0, 0), (25 * lunge, 0, 0), None),
        "chest": ((0, 0, 0), (0, 0, 22 * wind - 26 * strike), None),
        "head": ((0, 0, 0), (-18 * lunge, 0, -10 * wind + 12 * strike), None),
        "arm.r": ((0, 0, 0), (30 * wind - 80 * strike, 75 * wind + 40 * strike, 0), None),
        "arm.l": ((0, 0, 0), (-25 * wind + 15 * strike, -35 * wind - 20 * strike, 0), None),
        "face": {"mouth": "grin" if 0.45 < t < 0.95 else ("frown" if 0.1 < t < 1.1 else "smile"),
                 "brow": "angry" if 0.08 < t < 1.12 else None},
    }
    return merge(p, crouch(d))


def blink(t, at, dur=0.1):
    """Eyes closed for a moment at each time in `at`."""
    return "closed" if any(a <= t < a + dur for a in at) else "open"


def hold_in_out(t, T, a=0.25, b=0.25):
    """0 -> 1 -> 0 over a clip of length T: eases in over `a`, holds, eases out over the last `b`."""
    return min(keys(t, [(0, 0.0), (a, 1.0)]), keys(t, [(T - b, 1.0), (T, 0.0)]))


def trick_or_treat(t):
    """Hop up and hold the bucket out with a grin, eager little bounces while it fills, then a
    happy wiggle, and back. Both arms come forward, so whichever mitt has the bucket offers it."""
    T = 2.0
    z = keys(t, [(0, 0.0), (0.16, 0.0), (0.3, 0.32), (0.44, 0.0), (2.0, 0.0)])
    d = keys(t, [(0, 0.0), (0.14, 0.14), (0.24, 0.0), (0.44, 0.0), (0.5, 0.1), (0.6, 0.0), (2.0, 0.0)])
    offer = keys(t, [(0, 0.0), (0.18, 0.0), (0.32, 1.0), (1.55, 1.0), (1.85, 0.0), (2.0, 0.0)])
    wig = keys(t, [(0, 0.0), (0.95, 0.0), (1.05, 1.0), (1.55, 1.0), (1.7, 0.0), (2.0, 0.0)])
    eager = 0.05 * hop(t, 0.18) * (1 if 0.5 < t < 0.95 else 0)
    w = math.sin(TAU * 4 * t)
    p = {
        "root": ((0.04 * wig * w, 0, z + eager), (0, 0, 0), None),
        "hips": ((0, 0, 0), (0, 8 * wig * w, 0), None),
        "chest": ((0, 0, 0), (-5 * offer, 0, 10 * wig * w), None),
        "head": ((0, 0, 0), (-6 * offer, -6 * wig * w, 8 * wig * w), None),
        "arm.l": ((0, 0, 0), (-70 * offer, -12 * offer, 0), None),
        "arm.r": ((0, 0, 0), (-70 * offer, 12 * offer, 0), None),
        "face": {"mouth": "grin" if 0.24 < t < 1.75 else "smile"},
    }
    return merge(p, crouch(d))


def wave_hello(t):
    """Raise the emptier mitt out to the side and wave it, head tilted, smiling."""
    T = 1.6
    up = hold_in_out(t, T, 0.28, 0.3)
    wv = math.sin(TAU * 3 * t / T) * up
    return {
        "arm." + FREE["side"]: one_arm(FREE["side"], (-15 * up, 92 * up + 14 * wv, 0)),
        "arm." + ("l" if FREE["side"] == "r" else "r"): one_arm("l" if FREE["side"] == "r" else "r", (0, 6, 0)),
        "chest": ((0, 0, 0), (0, (4 if FREE["side"] == "r" else -4) * up, 0), None),
        "head": ((0, 0, 0), (0, (-10 if FREE["side"] == "r" else 10) * up, (-8 if FREE["side"] == "r" else 8) * up), None),
        "hips": ((0, 0, 0), (0, (-3 if FREE["side"] == "r" else 3) * up, 0), None),
        "face": {"mouth": "grin" if 0.2 < t < 1.35 else "smile"},
    }


def hit(t):
    """A bonk: knocked back a step, head snapping back, arms flung, O mouth and worried brows, a
    dizzy wobble, then shake it off."""
    T = 1.0
    knock = keys(t, [(0, 0.0), (0.06, 1.0), (0.22, 0.75), (0.7, 0.2), (1.0, 0.0)])
    dizzy = keys(t, [(0, 0.0), (0.15, 1.0), (0.75, 0.3), (0.95, 0.0), (1.0, 0.0)]) * math.sin(TAU * 3 * t)
    d = keys(t, [(0, 0.0), (0.08, 0.16), (0.3, 0.06), (0.8, 0.0), (1.0, 0.0)])
    return merge({
        "root": ((0, 0.22 * knock, 0), (0, 0, 0), None),
        "hips": ((0, 0, 0), (-12 * knock, 6 * dizzy, 0), None),
        "head": ((0, 0, 0), (-18 * knock, 10 * dizzy, 12 * dizzy), None),
        "arm.l": ((0, 0, 0), (-35 * knock, -40 * knock, 0), None),
        "arm.r": ((0, 0, 0), (-35 * knock, 40 * knock, 0), None),
        "face": {"mouth": "o" if 0.03 < t < 0.85 else "smile", "brow": "worried" if 0.03 < t < 0.9 else None,
                 "eyes": "closed" if 0.04 < t < 0.14 else "open"},
    }, crouch(d))


def sad(t):
    """Disappointed: head hung, shoulders slumped, a slow heavy sway and a sigh, frowning."""
    T = 2.4
    sw = math.sin(TAU * t / T)
    sigh = math.sin(TAU * t / T * 2)
    return merge({
        "hips": ((0, 0, 0), (6, 3 * sw, 0), None),
        "chest": ((0, 0, 0), (8 + 2 * sigh, 0, 0), (1 + 0.02 * sigh, 1 + 0.02 * sigh, 1 - 0.015 * sigh)),
        "head": ((0, 0, 0), (16 + 2 * sigh, -4 * sw, 5 * sw), None),
        "arm.l": ((0, 0, 0), (-4 + 4 * sw, -3, 0), None),
        "arm.r": ((0, 0, 0), (-4 - 4 * sw, 3, 0), None),
        "face": {"mouth": "frown", "brow": "worried", "eyes": blink(t, (1.6,), 0.12)},
    }, crouch(0.08 + 0.02 * sigh))


def sneak(t):
    """A sneaky tiptoe: crouched low, leaning in, high careful steps, mitts up in front, the head
    glancing side to side, a sly look (smile and angry brows)."""
    T = 1.2
    p = gait(t, T, stride=0.16, lift=0.08 if SKIRT["on"] else 0.24, bob=0.0, sway=5.0, arm=10.0, lean=10.0, turn=4.0)
    u = (t % T) / T
    look = 18 * math.sin(TAU * u)
    p["arm.l"] = ((0, 0, 0), (-40 + 8 * math.cos(TAU * u), -22, 0), None)
    p["arm.r"] = ((0, 0, 0), (-40 - 8 * math.cos(TAU * u), 22, 0), None)
    hl, hr, hs = p["head"]
    p["head"] = (hl, (hr[0] - 6, hr[1], look), hs)
    p["face"] = {"mouth": "smile", "brow": "angry"}
    ck = 0.35 if SKIRT["on"] else 1.0  # a skirt or suit can't crouch down over the feet
    return merge(p, crouch(ck * (0.14 + 0.03 * (1 + math.cos(2 * TAU * u)) / 2)))


def spin(t):
    """A show-off twirl: a little crouch, one full turn on the spot with a hop and the arms out,
    a grin, and a settle."""
    T = 1.4
    turn = keys(t, [(0, 0.0), (0.2, 0.0), (0.95, 360.0), (1.4, 360.0)])
    z = keys(t, [(0, 0.0), (0.22, 0.0), (0.55, 0.2), (0.9, 0.0), (1.4, 0.0)])
    arms = keys(t, [(0, 0.0), (0.2, 0.0), (0.4, 1.0), (0.9, 1.0), (1.15, 0.0), (1.4, 0.0)])
    d = keys(t, [(0, 0.0), (0.12, 0.12), (0.24, 0.0), (0.92, 0.0), (1.0, 0.1), (1.12, 0.0), (1.4, 0.0)])
    return merge({
        "root": ((0, 0, z), (0, 0, turn % 360.0), None),
        "arm.l": ((0, 0, 0), (-10 * arms, -60 * arms, 0), None),
        "arm.r": ((0, 0, 0), (-10 * arms, 60 * arms, 0), None),
        "head": ((0, 0, 0), (-6 * arms, 0, 0), None),
        "face": {"mouth": "grin" if 0.18 < t < 1.2 else "smile"},
    }, crouch(d))


def idle_peek(t):
    """Idle variant: bring the mitts up in front and peek down at the haul, then look up delighted."""
    T = 3.0
    up = keys(t, [(0, 0.0), (0.4, 1.0), (2.1, 1.0), (2.6, 0.0), (3.0, 0.0)])
    peek = keys(t, [(0, 0.0), (0.5, 0.0), (0.8, 1.0), (1.5, 1.0), (1.8, 0.0), (3.0, 0.0)])
    return merge({
        "arm.l": ((0, 0, 0), (-42 * up, -8, 0), None),
        "arm.r": ((0, 0, 0), (-42 * up, 8, 0), None),
        "chest": ((0, 0, 0), (6 * peek, 0, 0), None),
        "head": ((0, 0, 0), (22 * peek - 6 * up * (1 - peek), 0, 6 * math.sin(TAU * t / T)), None),
        "face": {"mouth": "o" if 0.8 < t < 1.5 else ("grin" if 1.6 < t < 2.5 else "smile"),
                 "eyes": blink(t, (0.3, 2.7))},
    }, crouch(0.04 * peek))


def idle_yawn(t):
    """Idle variant: a big stretch and yawn (arms out wide, head back, mouth an O, eyes shut), then a
    sleepy settle and a blink."""
    T = 3.0
    st = keys(t, [(0, 0.0), (0.5, 1.0), (1.5, 1.0), (2.1, 0.0), (3.0, 0.0)])
    return merge({
        "arm.l": ((0, 0, 0), (-12 * st, -72 * st, 0), None),
        "arm.r": ((0, 0, 0), (-12 * st, 72 * st, 0), None),
        "chest": ((0, 0, 0), (-8 * st, 0, 0), (1 + 0.04 * st, 1 + 0.04 * st, 1 + 0.03 * st)),
        "head": ((0, 0, 0), (-12 * st, 0, 0), None),
        "hips": ((0, 0, 0), (-3 * st, 0, 0), None),
        "face": {"mouth": "o" if 0.4 < t < 1.7 else "smile", "eyes": "closed" if 0.45 < t < 1.65 or 2.5 <= t < 2.62 else "open"},
    }, crouch(0.0))


def idle_look(t):
    """Idle variant: look around: turn to one side and hold, then the other, then back, the body
    following a little, with a blink."""
    T = 3.0
    look = keys(t, [(0, 0.0), (0.35, 34.0), (1.1, 34.0), (1.5, -34.0), (2.3, -34.0), (2.7, 0.0), (3.0, 0.0)])
    return merge({
        "chest": ((0, 0, 0), (0, 0, 0.3 * look), None),
        "head": ((0, 0, 0), (2, -0.1 * look, 0.7 * look), None),
        "hips": ((0, 0, 0), (0, 0.05 * look, 0), None),
        "arm.l": ((0, 0, 0), (0, -6, 0), None),
        "arm.r": ((0, 0, 0), (0, 6, 0), None),
        "face": {"eyes": blink(t, (0.9, 2.0))},
    }, crouch(0.03 * abs(math.sin(TAU * t / T))))


def dance_wiggle(t):
    """A toy dance: hips wiggling side to side, bounces on the beat, arms pumping in turn, head
    bopping, grinning."""
    T = 1.0
    u = (t % T) / T
    b = math.sin(TAU * 2 * u)
    s1 = math.sin(TAU * u)
    return merge({
        "root": ((0.08 * s1, 0, 0), (0, 0, 0), None),
        "hips": ((0, 0, 0), (0, 12 * s1, 0), None),
        "chest": ((0, 0, 0), (0, -6 * s1, 8 * s1), None),
        "head": ((0, 0, 0), (4 * b, 8 * s1, 0), None),
        "arm.l": ((0, 0, 0), (-45 + 35 * s1, -30, 0), None),
        "arm.r": ((0, 0, 0), (-45 - 35 * s1, 30, 0), None),
        "face": {"mouth": "grin"},
    }, crouch(0.05 * (1 + b) / 2 + 0.02))


def dance_robot(t):
    """A robot dance: stiff snaps between held poses on the beat (arms forward, out, up-bent), the
    head clicking side to side, a straight face."""
    T = 2.0
    beats = [(-80, 10, -10, 80, 20, 0), (-10, 80, -80, 10, -20, 15), (-80, 70, -80, 70, 0, -15), (-10, 10, -10, 10, 0, 0)]

    def snap(v0, v1, x):
        x = max(0.0, min(1.0, x / 0.18))  # fast snap at the start of each beat, then hold
        return v0 + (v1 - v0) * (x * x * (3 - 2 * x))

    k = int((t % T) / (T / 4))  # the beat
    x = t % (T / 4)  # seconds into it
    a, b = beats[k - 1], beats[k]
    v = [snap(a[i], b[i], x) for i in range(6)]
    return merge({
        "arm.l": ((0, 0, 0), (v[0], -v[1], 0), None),
        "arm.r": ((0, 0, 0), (v[2], v[3], 0), None),
        "head": ((0, 0, 0), (0, 0, v[4]), None),
        "chest": ((0, 0, 0), (0, 0, v[5]), None),
        "face": {"mouth": "o" if k == 2 else "smile"},
    }, crouch(0.04 if k % 2 else 0.0))


def run_jump(t):
    """A jump out of a run: a quick crouch, a leap with the legs split (one forward, one back) and
    the arms reaching forward and up, a grin in the air, and a landing that rolls back into the run."""
    T = 0.8
    z = keys(t, [(0, 0.0), (0.1, 0.0), (0.38, 0.7), (0.66, 0.0), (0.8, 0.0)])
    split = keys(t, [(0, 0.0), (0.12, 0.0), (0.3, 1.0), (0.55, 1.0), (0.68, 0.0), (0.8, 0.0)])
    ls = 0.3 if SKIRT["on"] else 1.0  # under a skirt or suit the legs barely split
    dk = 0.4 if SKIRT["on"] else 1.0
    d = keys(t, [(0, 0.0), (0.08, 0.16 * dk), (0.16, 0.0), (0.64, 0.0), (0.7, 0.18 * dk), (0.8, 0.0)])
    return merge({
        "root": ((0, 0, z), (0, 0, 0), None),
        "hips": ((0, 0, 0), (10 * split, 0, 0), None),
        "head": ((0, 0, 0), (-12 * split, 0, 0), None),
        "leg.l": ((0, -0.16 * split * ls, 0.08 * split * ls), (-24 * split * ls, 0, 0), None),
        "leg.r": ((0, 0.16 * split * ls, 0.04 * split * ls), (20 * split * ls, 0, 0), None),
        "arm.l": ((0, 0, 0), (-60 * split, -30 * split, 0), None),
        "arm.r": ((0, 0, 0), (40 * split, 25 * split, 0), None),
        "face": {"mouth": "grin" if 0.15 < t < 0.65 else "smile"},
    }, crouch(d))


def eat_candy(t):
    """Pop a candy in: the emptier mitt comes up in front of the mouth, head dips to meet it, chomp chomp
    (the mouth opening and closing), then a happy grin and wiggle."""
    T = 2.2
    up = keys(t, [(0, 0.0), (0.35, 1.0), (0.6, 1.0), (0.85, 0.0), (2.2, 0.0)])
    chomp = 0.65 < t < 1.45
    happy = keys(t, [(0, 0.0), (1.45, 0.0), (1.6, 1.0), (2.0, 1.0), (2.2, 0.0)])
    w = math.sin(TAU * 4 * t)
    return merge({
        "arm." + FREE["side"]: one_arm(FREE["side"], (-95 * up, -18 * up, 0)),
        "arm." + ("l" if FREE["side"] == "r" else "r"): one_arm("l" if FREE["side"] == "r" else "r", (0, 6, 0)),
        "head": ((0, 0, 0), (10 * up + (3 * math.sin(TAU * 6 * t) if chomp else 0), 6 * happy * w, 0), None),
        "chest": ((0, 0, 0), (0, 0, 8 * happy * w), None),
        "hips": ((0, 0, 0), (0, 5 * happy * w, 0), None),
        "face": {"mouth": ("o" if int(t * 6) % 2 == 0 else "smile") if chomp else ("o" if 0.35 < t <= 0.65 else ("grin" if happy > 0.2 else "smile")),
                 "eyes": "closed" if 1.5 < t < 1.95 else "open"},
    }, crouch(0.04 * happy * (1 + w) / 2))


def death(t):
    """Knocked out (a one-shot, it ends lying down): a stagger back with X eyes and an O mouth, a
    woozy wobble with the head circling, then a topple onto the back with a little bounce, arms
    flopping out, and still."""
    T = 2.2
    stag = keys(t, [(0, 0.0), (0.08, 1.0), (0.3, 0.6), (0.9, 0.4), (1.0, 0.0), (2.2, 0.0)])
    woozy = keys(t, [(0, 0.0), (0.3, 1.0), (0.8, 1.0), (1.0, 0.0), (2.2, 0.0)])
    # a rock forward onto the toes, then the topple accelerates hard all the way into the floor (no
    # easing before the hit): a slam at 1.12, a real bounce off the floor, a smaller one, and down
    if t < 0.9:
        fall = 0.0
    elif t < 1.12:
        fall = ((t - 0.9) / 0.22) ** 2.8
    else:
        b1 = 0.16 * max(0.0, math.sin(math.pi * min(1.0, (t - 1.12) / 0.2)))
        b2 = 0.05 * max(0.0, math.sin(math.pi * min(1.0, max(0.0, t - 1.32) / 0.12)))
        fall = 1.0 - b1 - b2
    rock = keys(t, [(0, 0.0), (0.72, 0.0), (0.84, 1.0), (0.92, 0.0), (2.2, 0.0)])  # the wind-up before the drop
    slam = max(0.0, 1.0 - abs(t - 1.13) / 0.1) if t > 1.03 else 0.0  # squash on the hit
    slam2 = max(0.0, 1.0 - abs(t - 1.33) / 0.06) if t > 1.27 else 0.0  # and a little one on the second landing
    d = keys(t, [(0, 0.0), (0.1, 0.12), (0.4, 0.04), (0.6, 0.14), (0.85, 0.1), (1.0, 0.0), (2.2, 0.0)])
    # the woozy head roll: one smooth circle and a bit (a "whoa"), slow, the body swaying the other
    # way a beat behind, so it reads as a wobble rather than a shake
    ph = TAU * 1.3 * max(0.0, t - 0.12)
    c1, s1 = math.cos(ph), math.sin(ph)
    c2, s2 = math.cos(ph - 0.9), math.sin(ph - 0.9)
    flop = keys(t, [(0, 0.0), (1.06, 0.0), (1.16, 1.5), (1.3, 0.9), (1.42, 1.05), (1.55, 1.0), (2.2, 1.0)])  # limbs flung on the hit
    return merge({
        # tip over backwards about the heels; the lift keeps the back of the head on the floor
        "root": ((0, 0.12 * stag + 0.5 * fall - 0.08 * rock, 1.2 * fall ** 1.6), (-90 * fall + 8 * rock, 0, 0),
                 (1 + 0.14 * slam + 0.04 * slam2, 1 - 0.28 * slam - 0.08 * slam2, 1 + 0.08 * slam)),  # flattened on the hit
        "hips": ((0, 0, 0), (-8 * stag - 4 * woozy * s2, -6 * woozy * c2, 0), None),
        "chest": ((0, 0, 0), (-3 * woozy * s2, -4 * woozy * c2, 0), None),
        "head": ((0, 0, 0), (-10 * stag + 12 * woozy * s1 - 26 * slam - 8 * slam2 + 6 * rock, 16 * woozy * c1, 0), None),  # rolls, then whips back on the hit
        "arm.l": ((0, 0, 0), (-30 * stag - 20 * flop, -30 * stag - 10 * woozy * (1 + s1) - 60 * flop, 0), None),
        "arm.r": ((0, 0, 0), (-30 * stag - 20 * flop, 30 * stag + 10 * woozy * (1 - s1) + 60 * flop, 0), None),
        "leg.l": ((0, 0, 0), (-12 * flop, 0, 0), None),
        "leg.r": ((0, 0, 0), (-4 * flop, 0, 0), None),
        "face": {"eyes": "dizzy" if t > 0.06 else "open", "mouth": "o" if t > 0.06 else "smile"},
    }, crouch(d))


ONESHOT = {"death"}  # clips that end in a different pose (they don't loop)


CLIPS = [("idle", idle, 2.4, 24), ("walk", walk, 0.8, 24), ("run", run, 0.5, 20), ("jump", jump, 1.2, 36), ("pick-up", pickup, 1.8, 54), ("celebrate", celebrate, 1.0, 30),
         ("scared", scared, 1.5, 45), ("attack", attack, 1.2, 36),
         ("trick-or-treat", trick_or_treat, 2.0, 60), ("wave", wave_hello, 1.6, 48), ("hit", hit, 1.0, 30), ("sad", sad, 2.4, 72),
         ("sneak", sneak, 1.2, 36), ("spin", spin, 1.4, 42), ("idle-peek", idle_peek, 3.0, 90), ("idle-yawn", idle_yawn, 3.0, 90),
         ("idle-look", idle_look, 3.0, 90), ("dance-wiggle", dance_wiggle, 1.0, 30), ("dance-robot", dance_robot, 2.0, 60),
         ("run-jump", run_jump, 0.8, 24), ("eat-candy", eat_candy, 2.2, 66), ("death", death, 2.2, 66)]


def pose(parts, rest, clip, t):
    p = clip(t)
    lag = clip(max(0.0, t - 0.12)) if t >= 0.12 else clip(t)
    for side in ("l", "r"):
        ar = lag.get(f"arm.{side}", ((0, 0, 0), (0, 0, 0), None))[1]
        now = p.get(f"arm.{side}", ((0, 0, 0), (0, 0, 0), None))[1]
        # the prop hangs: it cancels nearly all of the arm's swing (a bucket stays upright), a beat late
        c = PROP_CANCEL[side]
        # forward/back: a tall prop leans with the arm (c < 1); sideways: every prop stays upright,
        # so nothing tips in toward the head when the arms fling out
        p[f"prop.{side}"] = ((0, 0, 0), (-c * ar[0] + 0.25 * (ar[0] - now[0]), -0.92 * now[1], 0), None)
    if WINDOW["on"]:  # a suit around the head: head and chest stay with the hips, the costume moves as one
        p.pop("head", None)
        p.pop("chest", None)
    for name, e in parts.items():
        if name.startswith("expr.") or name == "bucket":
            continue
        loc, rot, scl = p.get(name, ((0, 0, 0), (0, 0, 0), None))
        e.location = rest[name] + Vector(loc)
        e.rotation_euler = Euler((R(rot[0]), R(rot[1]), R(rot[2])), "XYZ")
        e.scale = scl or (1, 1, 1)
    apply_face(parts, p)


def setup(scene):
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.3
    sun.data.angle = R(12)
    sun.rotation_euler = (R(40), R(18), R(35))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 12.0
    scene.collection.objects.link(cam)
    target = Vector((0, 0, 4.6))
    cam.location = target + Vector((0.62, -1.0, 0.42)).normalized() * 40
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 200
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = 420
    scene.render.film_transparent = True


def foot_floor(parts):
    """Lowest point of the pieces on each foot and leg (concept units): 0 = on the ground."""
    out = {}
    for side in ("l", "r"):
        zs = []
        for name in (f"foot.{side}", f"leg.{side}"):
            for o in parts[name].children_recursive:
                if o.type == "MESH":
                    zs += [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
        out[side] = min(zs) if zs else None
    return out


for slug in SLUGS:
    parts, rest = build_rig(slug)
    scene = bpy.context.scene
    setup(scene)
    for label, clip, period, n in CLIPS:
        for k in range(n):
            pose(parts, rest, clip, period * k / n)
            bpy.context.view_layer.update()
            ff = foot_floor(parts)
            print("FOOT", slug, label, k, *(f"{ff[s]:.3f}" if ff[s] is not None else "-" for s in ("l", "r")), f"root={parts['root'].location.z:.3f}", flush=True)
            scene.render.filepath = os.path.join(OUT, slug, f"{label}-{k:03d}.png")
            bpy.ops.render.render(write_still=True)
    print("DONE", slug, flush=True)
