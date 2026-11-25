"""Blender entry: build the Trainspotter kit to GLB.

    blender -b -t 1 --factory-startup --python kit/build.py -- [--out DIR] [--tier slice|release] [--family a,b] [--only SUBSTR ...]

Writes <out>/<folder>/<name>.glb (folders are the library's subfolders, e.g.
railway-track/) and <out>/kit.json, the catalogue the runtime helper reads:
the contract numbers, every track piece's connectors and routes, every
vehicle's couplers, guides, wheels and colour roles.

Exports WITHOUT re-centring (the pipeline's build_asset centres every world
asset on its bounds): the kit frame is the contract, so connectors and
couplers stay exactly where the specs put them.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import railkit as RK  # noqa: E402  (sets up sys.path and the palette)
import export as EX  # noqa: E402
import catalog  # noqa: E402


def export(asset, path: str) -> None:
    asset.validate()
    EX.reset_scene()
    objects = EX.build_parts(asset, None)
    EX.build_sockets(asset, objects)
    EX.build_clips(asset, objects)
    EX.export_glb(path, animated=bool(asset.clips))


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", "glb")
    only: list[str] = []
    tier = "release"
    i = 0
    while i < len(argv):
        if argv[i] == "--out":
            out_dir = argv[i + 1]; i += 2
        elif argv[i] == "--only":
            only.append(argv[i + 1]); i += 2
        elif argv[i] == "--tier":
            tier = argv[i + 1]; i += 2
        elif argv[i] == "--family":
            i += 2  # read by catalog.parse_families
        else:
            raise SystemExit(f"unknown arg {argv[i]}")
    # Blender resolves relative paths against the drive root, not the shell's folder: anchor them here
    out_dir = os.path.abspath(os.path.join(os.environ.get("PWD") or os.getcwd(), out_dir)) if not os.path.isabs(out_dir) else out_dir
    os.makedirs(out_dir, exist_ok=True)
    entries = catalog.entries(tier, catalog.parse_families(argv))
    with open(os.path.join(out_dir, "kit.json"), "w") as fh:
        json.dump(catalog.manifest(entries), fh, indent=1)
    for e in entries:
        if only and not any(s in e.file for s in only):
            continue
        d = os.path.join(out_dir, e.folder)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{e.file}.glb")
        export(e.asset(), path)
        print(f"BUILT {path} [{e.scale}]")
    return 0


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        import traceback

        traceback.print_exc()
        code = 1
    sys.stdout.flush()
    os._exit(code)
