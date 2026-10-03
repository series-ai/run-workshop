"""Dev review: avatar-space assets on the PN base body, at rest (T-pose).

    Blender -b --factory-startup --python blender/avatar_sheet.py -- \
        --pn <pn avatar glb> --out sheet.png --mode parts|skins|held [--size 300] files...

parts: every part node of each given parts GLB, one render each, worn over a
       PN base (species 1 + face/eyebrow/hair/tops/bottoms/shoes 1) with the
       PN part of the same slot removed.
skins: each skin GLB alone, next to nothing (compare with PN skins by eye).
held:  each held-item GLB placed at the PN Hand.R joint with the joint's rest
       rotation, on the PN base body: shows grip placement and direction.
Prints `ITEM <index> <label>` so the caller can caption the sheet.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_util import RIG_VIEW, compose_sheet, render_scene  # noqa: E402

BASE = {"species 1", "face 1", "eyebrow 1", "hair 1", "tops 1", "bottoms 1", "shoes 1"}
_B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    opts, files, i = {"size": "300"}, [], 0
    while i < len(argv):
        if argv[i].startswith("--"):
            opts[argv[i][2:]] = argv[i + 1]
            i += 2
        else:
            files.append(argv[i])
            i += 1
    return opts, files


def import_glb(path: str) -> set:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = set(bpy.data.objects) - before
    for o in new:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
        if o.animation_data:
            o.animation_data.action = None
    return new


def pn_base(pn: str, drop_slot: str | None = None, hide: set[str] = frozenset()) -> None:
    for o in import_glb(pn):
        if o.type != "MESH":
            continue
        slot = o.name.split(" ")[0]
        if o.name not in BASE or slot == drop_slot or slot in hide:
            bpy.data.objects.remove(o, do_unlink=True)


def hidden_slots(parts_glb: str, node: str) -> set[str]:
    """Slots a part's rules hide, from the build metadata next to out/jam-stage."""
    asset_id = os.path.splitext(os.path.basename(parts_glb))[0]
    pack = asset_id.split("-")[0]
    meta = os.path.join(os.path.dirname(__file__), "..", "out", "meta", pack, f"{asset_id}.json")
    if not os.path.exists(meta):
        return set()
    part = next((p for p in json.load(open(meta)).get("parts", []) if p["nodeName"] == node), None)
    rules = (part or {}).get("rules", {})
    return {slot for slot, key in (("hair", "hidesHair"), ("eyebrow", "hidesEyebrows"), ("facialhair", "hidesFacialHair")) if rules.get(key)}


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def hand_r_rest() -> Matrix:
    rig = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts", "data", "rig.generated.json")
    m = next(j["worldMatrix"] for j in json.load(open(rig))["joints"] if j["name"] == "Hand.R")
    rot = Matrix(((m[0], m[4], m[8]), (m[1], m[5], m[9]), (m[2], m[6], m[10])))
    out = (_B @ rot @ _B.inverted()).to_4x4()
    out.translation = _B @ Vector((m[12], m[13], m[14]))
    return out


def main() -> None:
    opts, files = args()
    size, mode, pn = int(opts["size"]), opts["mode"], opts["pn"]
    tmp = tempfile.mkdtemp()
    pngs = []

    def shot(label: str) -> None:
        png = os.path.join(tmp, f"{len(pngs)}.png")
        render_scene(png, size, RIG_VIEW)
        print(f"ITEM {len(pngs)} {label}")
        pngs.append(png)

    if mode == "parts":
        for path in files:
            reset()
            names = sorted(o.name for o in import_glb(path) if o.type == "MESH")
            for name in names:
                reset()
                pn_base(pn, drop_slot=name.split(" ")[0], hide=hidden_slots(path, name))
                for o in import_glb(path):
                    if o.type == "MESH" and o.name != name:
                        bpy.data.objects.remove(o, do_unlink=True)
                shot(name)
    elif mode == "skins":
        for path in files:
            reset()
            import_glb(path)
            shot(os.path.basename(path))
    elif mode == "held":
        hand = hand_r_rest()
        for path in files:
            reset()
            pn_base(pn)
            anchor = bpy.data.objects.new("hand", None)
            bpy.context.scene.collection.objects.link(anchor)
            anchor.matrix_world = hand
            for o in import_glb(path):
                if o.parent is None:
                    o.parent = anchor
            shot(os.path.basename(path))
    else:
        raise SystemExit(f"unknown --mode {mode}")
    compose_sheet(pngs, opts["out"], size, cols=6)
    print("SHEET", opts["out"])


main()
