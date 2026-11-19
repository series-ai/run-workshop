"""Boxy-tall mix-and-match kit: exports every part as its own GLB.

    Blender -b --factory-startup --python boxykit.py -- <out dir> [part ...]

Parts (all fit the same boxy-tall body, so they stack at the origin):
    base                body + chunky limbs           materials body, arms, hands, legs, feet, seam
    face-<kind>         art-toy face marks            mark, hole
    screen              gadget screen + bezel         bezel, screen (emissive map = LED face mask)
    top-<kind>          hoodie, puffer, tee ...       top, belt, print + fixed details (zip, gold, string, stripe)
    top-<kind>-screen   hooded tops cut around the screen instead of the face
    head-<kind>         bucket, beanie                hat
    extra-<kind>        scarf, backpack               scarf / pack, strap
LED face masks go to <out>/faces/led-*.png; kit.json lists everything.
Recolour by material name; the screen face swaps by emissive map.
"""
import json
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "beankit5.py")).read()
exec(compile(_src[: _src.rindex("\nmain5()")], "beankit5.py", "exec"))

import bpy  # noqa: E402

ART = ["x", "dots", "slits", "holes", "stitch", "cyclops-dot", "bones", "tired", "drip", "glyph"]
LED = ["led-x", "led-dots", "led-slits", "led-glyph", "led-tired", "led-bones", "led-drip", "led-smirk",
       "happy", "angry", "love", "dizzy", "cool", "sleepy"]
TOPS = ["hoodie", "vest", "coveralls"]   # puffer vest + hoodie: the keepers (2026-10-17); coveralls added
HOODED = ["hoodie"]
HEADS = ["bucket", "beanie"]
EXTRAS = []                       # nothing that only sits over clothes
TOPPER_KINDS = list(TOPPERS)        # head ornaments, worn when there is no hat or hood
WEAPON_KINDS = ["blaster", "raygun", "revolver", "smg", "rifle", "sniper", "shotgun", "launcher", "bazooka",
                "minigun", "soaker", "plasma"]   # rig/weapons.py WEAPONS: prop-<kind>.glb on grip.R

BASE_NAMES = ("body", "arms", "hands", "legs", "feet", "seam")
FACE_NAMES = ("mark", "hole")
SCREEN_NAMES = ("bezel", "screen")

DEFAULTS = {"body": (0.9, 0.87, 0.8), "arms": (0.9, 0.87, 0.8), "hands": (0.9, 0.87, 0.8), "legs": (0.12, 0.12, 0.13),
            "feet": (0.9, 0.87, 0.8), "mark": (0.1, 0.09, 0.11), "top": (0.12, 0.12, 0.13), "hat": (0.4, 0.43, 0.3),
            "extra": (1.0, 0.45, 0.15), "bezel": (0.1, 0.1, 0.11), "led": (0.35, 1.0, 1.0), "number": (0.95, 0.94, 0.92),
            "topper": (0.45, 0.8, 0.35), "weapon": (0.95, 0.42, 0.15), "weapon_trim": (0.95, 0.93, 0.88),
            "weapon_dark": (0.12, 0.12, 0.13)}


def kit_fig(face="blank", screen=False, items=()):
    """Build the figure with slot-named materials; returns the screen flag's hole."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    globals()["HAT_LIFT"] = 0.31 if screen else 0.18           # hats clear the screen bezel, or sit just over the eyes
    spec = dict(BODIES["boxy-tall"])
    body = Body(spec)
    body.z0 = FEET_Z0["chunky"]
    root = bpy.data.objects.new("fig", None)
    bpy.context.scene.collection.objects.link(root)
    mats = {k: finish_mat(k, DEFAULTS[k], "matte") for k in ("body", "arms", "hands", "legs", "feet")}
    mats["body_top"] = mats["body_bottom"] = mats["body"]
    mats["mark"] = plastic("mark", DEFAULTS["mark"], rough=0.4, coat=0.2)
    mats["hole"] = plastic("hole", (0.02, 0.02, 0.025), rough=0.9, coat=0.0)
    mats["seam"] = plastic("seam", (0.0, 0.0, 0.0), rough=0.8, coat=0.0)
    mats.update(top=finish_mat("top", DEFAULTS["top"], "matte"), hat=finish_mat("hat", DEFAULTS["hat"], "matte"),
                pack=finish_mat("pack", DEFAULTS["extra"], "matte"), scarf=finish_mat("scarf", DEFAULTS["extra"], "matte"),
                print=plastic("print", DEFAULTS["extra"], rough=0.6, coat=0.0),
                belt=finish_mat("belt", DEFAULTS["top"], "satin"),
                string=plastic("string", (0.92, 0.9, 0.85), rough=0.6, coat=0.0),
                zip=finish_mat("zip", (0.8, 0.8, 0.82), "chrome"), gold=finish_mat("gold", (1.0, 0.78, 0.35), "chrome"),
                stripe=plastic("stripe", (0.95, 0.94, 0.9), rough=0.5), strap=finish_mat("strap", (0.15, 0.15, 0.16), "matte"),
                topper=plastic("topper", DEFAULTS["topper"], rough=0.35, coat=0.4))
    mats["pantleg"] = mats["top"]
    _mesh("body", body.build(groove=0.012, inset=0.015), [mats["body"], mats["body"]], root)
    P = Parts()
    if screen:
        mats["bezel"] = finish_mat("bezel", DEFAULTS["bezel"], "satin")
        mats["screen"] = screen_mat("led-x", DEFAULTS["led"], for_export=True)
        build_screen(body, mats, root)
        cz = body.z0 + spec["screen"][0] * spec["h"]
        ax, az = spec["screen"][1] + 0.18, spec["screen"][1] * 0.72 + 0.17
        hole = lambda c: c.y < 0 and (c.x / ax) ** 4 + ((c.z - cz) / az) ** 4 < 1
    else:
        face4(body, face, P)
        ex, ez = eye_pos(body)
        hole = lambda c: c.y < 0 and (c.x / (ex + 0.24)) ** 2 + ((c.z - (ez - 0.04)) / 0.32) ** 2 < 1
    for kind in items:
        outfit(body, kind, P, mats, root, hole)
    limbs4(body, "chunky", "chunky", P)
    for k, bm in P.bms.items():
        _mesh(k, bm, [mats[k]], root)
    return root


def export(path, pick):
    bpy.ops.object.select_all(action="DESELECT")
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type in ("MESH", "CURVE") and pick(ob.name.split(".")[0]):
            ob.select_set(True)
            n += 1
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True)
    print("WROTE", os.path.basename(path), n, "objects")


def build_part(part, out):
    gl = os.path.join(out, "glb")
    os.makedirs(gl, exist_ok=True)
    f = os.path.join(gl, f"{part}.glb")
    if part == "base":
        kit_fig()
        export(f, lambda n: n in BASE_NAMES)
    elif part.startswith("face-"):
        kit_fig(face=part[5:])
        export(f, lambda n: n in FACE_NAMES)
    elif part == "screen":
        kit_fig(screen=True)
        export(f, lambda n: n in SCREEN_NAMES)
    else:
        slot, kind = part.split("-", 1)
        screen = kind.endswith("-screen")
        kind = kind[:-7] if screen else kind
        kit_fig(screen=screen, items=[kind])
        export(f, lambda n: n not in BASE_NAMES + FACE_NAMES + SCREEN_NAMES)


def all_parts():
    return (["base", "screen"] + [f"face-{k}" for k in ART] + [f"top-{k}" for k in TOPS] +
            [f"top-{k}-screen" for k in HOODED] + [f"head-{k}" for k in HEADS] + [f"head-{k}-screen" for k in HEADS] +
            [f"extra-{k}" for k in EXTRAS] + [f"topper-{k}" for k in TOPPER_KINDS])


def manifest(out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for n in LED:
        face_image(n)
    kit = {"body": "boxy-tall", "art_faces": ART, "led_faces": LED, "tops": TOPS, "hooded": HOODED, "heads": HEADS,
           "extras": EXTRAS, "toppers": TOPPER_KINDS, "weapons": WEAPON_KINDS, "defaults": {k: "#%02x%02x%02x" % tuple(round(c * 255) for c in v) for k, v in DEFAULTS.items()},
           "slots": {"body": ["body"], "arms": ["arms"], "hands": ["hands"], "legs": ["legs"], "feet": ["feet"],
                     "mark": ["mark"], "top": ["top", "belt"], "hat": ["hat"], "extra": ["scarf", "pack", "print"],
                     "bezel": ["bezel"], "number": ["num", "numL", "numR"], "topper": ["topper"],
                     "weapon": ["weapon"], "weapon_trim": ["weapon-trim"], "weapon_dark": ["weapon-dark"]},
           # chest numbers on the bare body only: part num-<1|2>-body (shown when no top is worn); each slot's texture is
           # numbers/num-<digit>.png (white glyph, dark outline, alpha): swap the map, tint by material colour
           "numbers": {"surface": {"none": "body"},
                       "slots": {"1": ["num"], "2": ["numL", "numR"]}}}
    with open(os.path.join(out, "kit.json"), "w") as fh:
        json.dump(kit, fh, indent=2)
    print("WROTE kit.json")


def main_kit():
    argv = sys.argv[sys.argv.index("--") + 1:]
    out = os.path.abspath(argv[0])
    globals()["OUT"] = out
    os.makedirs(out, exist_ok=True)
    for p in argv[1:] or ["manifest"] + all_parts():
        if p == "manifest":
            manifest(out)
        elif p == "list":
            print("PARTS", " ".join(all_parts()))
        else:
            build_part(p, out)


main_kit()
