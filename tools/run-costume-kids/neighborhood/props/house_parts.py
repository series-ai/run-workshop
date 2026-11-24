"""Ship the Victorian house kit as parts, for assembling houses in-game.

Every part in house.PART_DEFS is exported as its own small GLB into
previewer/house-parts/<part>-<width>.glb (the balcony parts are shared by every
width), already in place in house space: a house is the union of the parts
house.parts_for(spec) lists, merged into one mesh per material. Nothing is
recentred. Sided extras (wing, bay, chimney, turret) are built on the right and
the right porch is the left one: their left/right twins are the same file
mirrored at assembly (x -> -x, triangle winding flipped). To match a baked house GLB, shift the merged mesh so its bounding
box's base centre sits on the origin (finish_prop's pivot rule).

Parts are coloured by role, not by palette: each one is built with KEY (body,
trim, roof and porch woodwork in distinct key colours), so a vertex colour is a role key or a
shade of one (shade(body, 0.86) -> body x 0.86). manifest.json's role table maps
key colours to (role, factor); colour = min(1, palette[role] * factor) in sRGB.
Colours that match no key (deck, bricks, dark glass, flowers...) are the same in
every palette. The GLOW material stays its own material.

    Blender -b -t 1 --factory-startup --python neighborhood/props/house_parts.py -- --export
    Blender ... --python neighborhood/props/house_parts.py -- --review <friezes|round5> neighborhood/renders   # review tiles
"""
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
import house as H  # noqa: E402
import bpy  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "..", "previewer", "house-parts"))
KEY = dict(body=(0.80, 0.05, 0.80), trim=(0.05, 0.80, 0.80), roof=(0.60, 0.60, 0.05), porch=(0.10, 0.10, 0.85))


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit._mats.clear()


def piece_colours():
    out = set()
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o.data.materials and not o.get("glow"):
            out.add(tuple(round(c, 4) for c in o.data.materials[0].diffuse_color[:3]))
    return out


def role_of(rgb):
    """(role, factor) if rgb is a shade of a key colour, else None."""
    for role, key in KEY.items():
        i = max(range(3), key=lambda j: key[j])
        k = rgb[i] / key[i]
        if all(abs(key[j] * k - rgb[j]) < 2e-3 for j in range(3)):
            return role, round(k, 3)
    return None


def hexc(rgb):
    return "#" + "".join(f"{round(c * 255):02x}" for c in rgb)


def export_part(name, path):
    """kit.export_prop without UVs (the kit is all vertex colour): smaller parts."""
    ob = bpy.data.objects[name]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_vertex_color="ACTIVE", export_texcoords=False,
                              export_lights=False, export_cameras=False)


def export_parts():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".glb"):
            os.remove(os.path.join(OUT, f))
    parts, colours = [], set()
    for p in H.PART_DEFS:
        for width in ([None] if p["shared"] else sorted(H.WIDTHS)):
            name = H.part_file(p, width or "medium")
            fresh()
            p["build"](KEY, width or "medium")
            colours |= piece_colours()
            glow = any(o.get("glow") for o in bpy.context.scene.objects)
            tris = kit.finish_prop(name, recentre=False)
            path = os.path.join(OUT, f"{name}.glb")
            export_part(name, path)
            parts.append(dict(file=f"{name}.glb", part=p["name"], slot=p["slot"], option=p["option"], width=width,
                              tris=tris, bytes=os.path.getsize(path), glow=glow, when=p["when"],
                              mirrorable=p["when_mirror"] is not None, when_mirror=p["when_mirror"]))
            print(f"PART {name}: {tris} tris")
    return parts, colours


def recipes(parts):
    """The sixteen named houses as explicit specs, with the parts and triangles they assemble from
    (shedding extras over budget, the way house.ship() does)."""
    by_file = {p["file"]: p for p in parts}
    out = []
    for slug, spec in H.all_specs().items():
        while True:
            use = [dict(file=H.part_file(p, spec["width"]) + ".glb", mirror=m) for p, m in H.parts_for(spec)]
            tris = sum(by_file[u["file"]]["tris"] for u in use)
            if tris <= H.BUDGET:
                break
            k = next(k for k in H.DROP_ORDER if H.on(spec, k))
            spec = dict(spec, **{k: "none" if k in H.SIDED else False})
        spec = dict(spec, colours={r: H.rgbhex(v) for r, v in H.colours(spec).items()})
        out.append(dict(slug=slug, spec=spec, parts=use, tris=tris))
    return out


def manifest(parts, colours):
    table, fixed = [], []
    for rgb in sorted(colours):
        r = role_of(rgb)
        if r:
            table.append(dict(key=hexc(rgb), srgb=list(rgb), role=r[0], k=r[1]))
        else:
            fixed.append(hexc(rgb))
    rec = recipes(parts)
    baked = {e["slug"]: e["tris"] for e in json.load(open(os.path.join(kit.GLB_DIR, "index.json")))}
    for r in rec:
        flag = "ok" if baked.get(r["slug"]) == r["tris"] else f"MISMATCH baked {baked.get(r['slug'])}"
        print(f"RECIPE {r['slug']}: {len(r['parts'])} parts, {r['tris']} tris ({flag})  [{H.describe(r['spec'])}]")

    def door_x(w, k):
        return -H.porch_frame(H.WIDTHS[w], H.LAYOUT[w], "left")["door_x"] if k == "right" else \
            H.porch_frame(H.WIDTHS[w], H.LAYOUT[w], k)["door_x"]
    kid = {w: {k: [door_x(w, k), H.Y0 - 1.5, H.F] for k in H.PORCHES} for w in sorted(H.WIDTHS)}
    m = dict(
        about="Victorian house kit parts (neighborhood/props/house_parts.py). Blender z-up house space, exported y-up.",
        assembly=("Take every part whose width is the spec's (or null) and whose `when` matches the spec (any condition; "
                  "each condition: every key's value is in its list); a mirrorable part whose `when_mirror` matches is "
                  "used (again) mirrored: scale x by -1 and flip each triangle's winding. Merge per material (PALETTE, "
                  "GLOW). To match the baked GLBs, move the merged mesh so its bounding box's base centre is the origin."),
        options=dict(width=sorted(H.WIDTHS), roof=list(H.ROOFS), gingerbread=list(H.GINGERBREAD), porch=list(H.PORCHES),
                     rail=list(H.RAILS), frieze=list(H.FRIEZES), siding=list(H.SIDINGS), gable_window=list(H.GABLE_WINDOWS),
                     cross_style=list(H.CROSS_STYLES), palette=list(H.PALETTES), extras=list(H.EXTRAS),
                     sided=list(H.SIDED), sides=list(H.SIDES)),
        defaults=H.validate({}),
        brick_body=hexc(H.BRICK_WALL),
        swatches={r: [hexc(c) for c in v] for r, v in H.SWATCHES.items()},
        rules=[dict(forbid=cond, reason=why) for cond, why in H.RULES],
        budget=H.BUDGET, drop_order=list(H.DROP_ORDER),
        roles=dict(key={k: hexc(v) for k, v in KEY.items()},
                   rule="sRGB colour = min(1, palette[role] * k) per channel; linear vertex colour = srgb ** 2.2",
                   table=table, fixed=fixed),
        palettes={n: {r: hexc(c) for r, c in p.items()} for n, p in H.PALETTES.items()},
        colours_note="a spec's `colours` (role -> hex) override its palette preset; brick siding defaults the body to brick_body",
        glow=dict(material="GLOW", rgb=list(kit.GLOW_RGB), strength=kit.GLOW_STRENGTH,
                  note="emissive, never a light or transparent; not recoloured by palettes"),
        kid_spot=dict(note="in front of the door on the porch deck, Blender z-up house space", by_width=kid),
        parts=parts,
        recipes=rec,
    )
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(m, fh, indent=1)
    total = sum(p["bytes"] for p in parts)
    print(f"PARTS {len(parts)} files, {total} bytes; roles {len(table)}, fixed colours {len(fixed)}")


def _look(scene):
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world


REVIEWS = {
    "friezes": [(dict(width="wide", porch="wrap", rail="fancy", palette="sage", frieze=f), "porch") for f in H.FRIEZES]
    + [(dict(width="medium", porch="left", turret="right", palette="rose", frieze=f), "porch") for f in H.FRIEZES],
    "round5": [
        (dict(width="medium", roof="hip-gable", porch="centre", palette="mustard"), "house"),
        (dict(width="narrow", roof="hip-gable", porch="left", turret="right", gable_window="round", palette="teal"), "house"),
        (dict(width="medium", roof="cross", cross_style="round", gable_window="round", porch="centre", palette="sage",
              gingerbread="valance", frieze="valance"), "house"),
        (dict(width="wide", roof="gable", porch="right", turret="left", wing="right", chimney="both", bay="left",
              palette="slate", gingerbread="pendant", frieze="pendant", rail="fancy"), "house"),
        (dict(width="medium", roof="gable", porch="centre", wing="both", palette="lavender", gable_window="round",
              gingerbread="sunburst"), "house"),
        (dict(width="medium", roof="gable", porch="centre", siding="brick", bay="right", chimney="right", palette="sage",
              colours=dict(trim="#fcfaf2", porch="#45664f")), "house"),
        (dict(width="medium", roof="gable", porch="left", rail="plain", gingerbread="pendant", palette="lavender"), "porch"),
        (dict(width="medium", roof="gable", porch="centre", rail="fancy", frieze="scallop", balcony=True, palette="rose",
              gingerbread="valance"), "gable"),
    ],
}


def review(name, out_dir):
    """Review tiles (3/4 whole house, a porch close-up or a gable close-up) as a montage."""
    from mathutils import Vector
    tiles = []
    os.makedirs("/tmp/rck-review-tiles", exist_ok=True)
    for i, (spec, view) in enumerate(REVIEWS[name]):
        fresh()
        spec = H.validate(spec)
        H.house(spec)
        tris = kit.finish_prop(f"r{i}", recentre=False)
        print(f"REVIEW {i} {view}: {tris} tris [{H.describe(spec)}]")
        scene = bpy.context.scene
        _look(scene)
        sun = bpy.data.objects.new("s", bpy.data.lights.new("s", "SUN"))
        sun.data.energy = 2.3
        sun.rotation_euler = (0.7, 0.31, 0.61)
        scene.collection.objects.link(sun)
        cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
        cam.data.type = "ORTHO"
        scene.collection.objects.link(cam)
        if view == "house":
            cam.data.ortho_scale, target = 30.0, Vector((0, 0, 8.0))
        elif view == "porch":
            cam.data.ortho_scale, target = 10.0, Vector((-2.0, -5.0, 3.8))
        else:
            cam.data.ortho_scale, target = 11.0, Vector((0, -3.5, 12.0))
        cam.location = target + Vector((0.62, -1.0, 0.42 if view == "house" else 0.22)).normalized() * 80
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = 300
        scene.camera = cam
        scene.render.resolution_x = scene.render.resolution_y = 520
        scene.render.film_transparent = True
        path = f"/tmp/rck-review-tiles/{name}-{i:02d}.png"
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        tiles.append(path)
    H.montage(tiles, os.path.join(out_dir, f"review-{name}.png"))


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--review" in args:
        i = args.index("--review")
        review(args[i + 1], args[i + 2])
        return
    parts, colours = export_parts()
    manifest(parts, colours)


if __name__ == "__main__":
    main()
