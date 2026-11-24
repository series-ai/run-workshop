"""Render each character with every piece coloured by its anchor (front and side views)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys, os
_args = sys.argv[sys.argv.index("--") + 1:]
OUT_DIR, CHARS = _args[0], _args[1:]
sys.argv = [sys.argv[0], "--", OUT_DIR, "x"]
src = open(_PKG + "/rig/toyanim.py").read()
src = src.split("\nfor slug in SLUGS:")[0]
exec(compile(src, "toyanim.py", "exec"))
import bpy
from mathutils import Vector
COL = {"root": (0.5, 0.5, 0.5), "hips": (0.95, 0.85, 0.1), "chest": (1.0, 0.5, 0.0), "head": (0.2, 0.5, 1.0),
       "arm.l": (0.0, 0.8, 0.3), "hand.l": (0.0, 0.4, 0.1), "arm.r": (0.9, 0.2, 0.7), "hand.r": (0.5, 0.0, 0.4),
       "leg.l": (0.6, 1.0, 1.0), "foot.l": (0.0, 0.7, 0.7), "leg.r": (1.0, 0.6, 0.6), "foot.r": (0.8, 0.1, 0.1), "prop.l": (0.6, 0.9, 0.2), "prop.r": (1.0, 0.3, 0.9)}
mats = {}
def m(name):
    if name not in mats:
        mm = bpy.data.materials.new(name); mm.use_nodes = True
        mm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*COL[name], 1)
        mats[name] = mm
    return mats[name]
os.makedirs(OUT_DIR, exist_ok=True)
for slug in CHARS:
    parts, rest = build_rig(slug)
    mats.clear()
    for name, e in parts.items():
        for o in e.children:
            if o.type == "MESH":
                key = name if name in COL else "head"  # expression switches ride the face
                o.data.materials.clear(); o.data.materials.append(m(key)); o.active_material = m(key)
    scene = bpy.context.scene
    setup(scene)
    for vname, v in (("34", (0.62, -1.0, 0.42)), ("side", (1, 0, 0.2))):
        cam = scene.camera
        target = Vector((0, 0, 2.7)); cam.location = target + Vector(v).normalized() * 40
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT_DIR, f"{slug}-{vname}.png")
        bpy.ops.render.render(write_still=True)
