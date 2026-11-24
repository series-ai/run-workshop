"""Export the avatar kit: the regular kids' wardrobe (concepts/wardrobe.py) as separate pieces on
one shared skeleton, so a game can mix and recolour them (kit/kidkit.js).

    Blender -b --factory-startup --python export_kit.py -- <out dir>

Writes, into <out dir>:
- base.glb: the skeleton, every clip, and the plain kid (head, face and expressions, skin body);
- <slot>-<item>.glb: one per wardrobe item, skinned to the same skeleton (no clips), plus
  bottom-overalls-bib.glb, the bib that outer tops hide;
- kit.json: the slots, items, channel names, colourways, colour suggestions and the ten
  ready-made looks.

Every piece is one mesh with one material. Its vertex colour is what a plain glTF loader shows
(the item in its first colourway, skin in the default tone); its first UV set's u is the
piece's paint channel: 0 a fixed colour, 1 skin, 2-5 the item's main, trim, accent and detail.

The clips are baked once, on a stand-in kid wearing the longest hair, the widest skirt, the
longest coat and the full bucket at the same time, so the floor guard and the gait keep every
combination clear of the floor and the legs inside every skirt.
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys

KIT_DIR = sys.argv[sys.argv.index("--") + 1]
sys.argv = [sys.argv[0], "--", KIT_DIR]
_src = open(_PKG + "/rig/export_glb.py").read().split("\nslugs = ONLY or")[0]
exec(compile(_src, "export_glb.py", "exec"))  # toyanim's rig and clips, skeleton, pack, bake_clips ...

import json  # noqa: E402
import os  # noqa: E402

import wardrobe as WD  # noqa: E402  (rig_all put concepts/ on the path)

CODES = {"skin": 1, "main": 2, "trim": 3, "accent": 4, "detail": 5}
SENTINEL = {tuple(round(c, 3) for c in rgb): ch for ch, rgb in WD.CHANNEL_RGB.items()}
SKIN_KEY = tuple(round(c, 3) for c in B.SKIN)
DEFAULT_TONE = B.SKIN_TONES[1]


BUILDS["kit-proxy"] = WD.kit_proxy


def hexcol(rgb):
    return "#" + "".join(f"{round(max(0, min(1, c)) * 255):02x}" for c in rgb)


def chan_uv(code):
    def extra(o):
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
        uv = o.data.uv_layers.new(name="chan")
        for d in uv.data:
            d.uv = (code, 0.0)
    return extra


def anchor_of(o, tags):
    if "expr" in o:
        return "expr." + o["expr"]
    a = tags.get(o)
    if a is None:
        raise RuntimeError(f"untagged piece {o.name}")
    return ANCHOR[a]


def export_piece(arm, mat, objs, name, default=None, animations=False):
    """Pack the objects just built into one piece and write <name>.glb."""
    tags = tagged_parts(objs)
    pieces = {o: anchor_of(o, tags) for o in objs}

    def paint(o):
        col = tuple(round(c, 3) for c in o.active_material.diffuse_color[:3])
        if col == SKIN_KEY:
            return (*[c ** 2.2 for c in DEFAULT_TONE], 1.0), mat, chan_uv(CODES["skin"])
        ch = SENTINEL.get(col)
        if ch:
            rgb = default[WD.CHANNELS.index(ch)]
            return (*[c ** 2.2 for c in rgb], 1.0), mat, chan_uv(CODES[ch])
        return (*[c ** 2.2 for c in o.active_material.diffuse_color[:3]], 1.0), mat, chan_uv(0)
    body = pack(pieces, arm, name, paint)
    path = os.path.join(KIT_DIR, f"{name}.glb")
    export_skinned(arm, body, path, animations=animations)
    if animations:
        hide_rest_expressions(path)
    bpy.data.objects.remove(body, do_unlink=True)
    print("KIT", name, len(pieces), "pieces", flush=True)


def built(fn):
    """Run fn and return the mesh objects it made."""
    before = set(bpy.data.objects)
    fn()
    bpy.context.view_layer.update()
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


def main():
    os.makedirs(KIT_DIR, exist_ok=True)
    parts, rest = build_rig("kit-proxy")
    arm, order = skeleton(parts, rest)
    bake_clips(arm, parts, rest, order)
    # the stand-in's pieces go; the part empties stay (the clips are on the bones now)
    for e in parts.values():
        e.location, e.rotation_euler, e.scale = rest[e.name], (0, 0, 0), (1, 1, 1)
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    mat = kit_material("KIT")
    sentinel = tuple(WD.CHANNEL_RGB[c] for c in WD.CHANNELS)
    export_piece(arm, mat, built(WD.base_kid), "base", animations=True)
    catalog = {"slots": list(WD.SLOTS), "channels": list(WD.CHANNELS), "items": {}}
    for slot in WD.SLOTS:
        catalog["items"][slot] = {}
        for name, it in WD.ITEMS[slot].items():
            ways = {k: [hexcol(c) for c in WD.colours(slot, name, k)][:max(1, len(it["channels"]))] for k in it["ways"]}
            entry = {"channels": it["channels"], "ways": ways}
            if it.get("outer"):
                entry["outer"] = True
            if it["build"] is not None:
                default = WD.colours(slot, name, next(iter(it["ways"])))
                export_piece(arm, mat, built(lambda: WD.draw(slot, name, sentinel)), f"{slot}-{name}", default)
                entry["file"] = f"{slot}-{name}.glb"
                if it.get("bib"):
                    export_piece(arm, mat, built(lambda: it["bib"](*sentinel)), f"{slot}-{name}-bib", default)
                    entry["bib"] = f"{slot}-{name}-bib.glb"
            catalog["items"][slot][name] = entry
    import kids as K  # the ten ready-made looks (importing it registers them with BUILDS too)
    catalog["looks"] = {}
    for slug, (tone, look) in K.LOOKS.items():
        L = {"skin": tone}
        for slot in WD.SLOTS:
            name, way = look[slot]
            cs = WD.colours(slot, name, way)
            L[slot] = {"item": name, "colours": [hexcol(c) for c in cs][:max(1, len(WD.ITEMS[slot][name]["channels"]))]}
        catalog["looks"][slug] = L
    catalog["skinTones"] = [hexcol(t) for t in B.SKIN_TONES]
    catalog["suggest"] = {"cloth": {k: hexcol(v) for k, v in WD.CLOTH.items()}, "hair": {k: hexcol(v) for k, v in WD.HAIR.items()}}
    catalog["clips"] = [label for label, *_ in CLIPS]
    json.dump(catalog, open(os.path.join(KIT_DIR, "kit.json"), "w"), indent=1)
    print("KIT DONE", flush=True)


main()
