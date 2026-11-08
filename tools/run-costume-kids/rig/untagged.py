"""List the pieces a costume did not tag with `with part(...)` (they fall back to the rig's guesses).

    Blender -b --factory-startup --python rig/untagged.py -- [<slug> ...]   (no slugs: all)
"""
import sys

CHARS = sys.argv[sys.argv.index("--") + 1:]
sys.argv = [sys.argv[0], "--", "/tmp/rck-untagged", "x"]
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
_src = open(_PKG + "/rig/rig_all.py").read()
exec(compile(_src.split("# matched clips for the side-by-side")[0], "rig_all.py", "exec"))  # BUILDS, B, bounds ...
for slug in CHARS or [s.strip() for s in open(_PKG + "/rig/slugs.txt") if s.strip()]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    B._mats.clear()
    BUILDS[slug]()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
    loose = [o for o in meshes if "part" not in o]
    for o in loose:
        c, z = bounds(o)
        print("UNTAGGED", slug, _colour(o), tuple(round(v, 2) for v in c), tuple(round(v, 2) for v in z), o.name, flush=True)
    print("TAGS", slug, f"{len(meshes) - len(loose)}/{len(meshes)} tagged", flush=True)
