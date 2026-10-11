"""Blender entry: build asset sources into the jam stage layout.

    Blender -b --factory-startup --python blender/build_asset.py -- --jobs <jobs.json>

jobs.json: {"stage": dir, "meta": dir, "sources": [path, ...]}. Each source is
a Python file with `build()` returning an Asset or a list of Assets. Output:
    <stage>/<pack dir>/<leaf path>/<category>/<id>.glb
    <meta>/<pack>/<id>.json   (catalog fields the GLB cannot carry)
Every failure is reported by source; the process exits 1 if any failed.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from voxgrid import CATEGORIES, PACKS, SCALE, Asset  # noqa: E402


def leaf_path(pack: str, category: str) -> str:
    kind = CATEGORIES["categories"][category]["leaf"]
    leaf = PACKS["leaves"][kind]
    theme = PACKS["packs"][pack]["worldTheme"] if leaf["theme"] == "@worldTheme" else leaf["theme"]
    return f"{leaf['bucket']}/{theme}"


_SCALE_TABLES: dict[str, dict[str, str]] = {}


def scale_table(pack: str) -> dict[str, str]:
    """assets/<pack>/scale-classes.json: asset id -> world scale class."""
    if pack not in _SCALE_TABLES:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", pack, "scale-classes.json")
        with open(path) as fh:
            _SCALE_TABLES[pack] = json.load(fh)
    return _SCALE_TABLES[pack]


def check_scale(asset: Asset) -> None:
    """World assets need a scale class their category allows (from the source or
    the pack's scale-classes.json); rig assets take none."""
    listed = scale_table(asset.pack).get(asset.id, "")
    if asset.scale and listed and asset.scale != listed:
        raise ValueError(f"{asset.id}: source says scale={asset.scale!r}, scale-classes.json says {listed!r}")
    asset.scale = asset.scale or listed
    allowed = SCALE["categoryClasses"].get(asset.category)
    if allowed is None:
        if asset.scale:
            raise ValueError(f"{asset.id}: {asset.category} is avatar space and takes no scale class")
        return
    if asset.scale not in allowed:
        raise ValueError(f"{asset.id}: scale={asset.scale!r} is not one of {allowed} for {asset.category}")


def load_assets(source: str) -> list[Asset]:
    # Sources may import helpers from their pack dir (assets/<pack>/_*.py).
    # Packs reuse helper names (_kit, _rig), so drop every other pack's dir
    # from sys.path and its modules from the cache before loading this one.
    pack_dir = os.path.dirname(os.path.dirname(os.path.abspath(source)))
    assets_root = os.path.dirname(pack_dir)
    sys.path[:] = [p for p in sys.path if os.path.dirname(os.path.abspath(p)) != assets_root or p == pack_dir]
    for mod_name, mod in list(sys.modules.items()):
        mod_file = getattr(mod, "__file__", None) or ""
        if mod_file.startswith(assets_root + os.sep) and not mod_file.startswith(pack_dir + os.sep):
            del sys.modules[mod_name]
    if pack_dir not in sys.path:
        sys.path.insert(1, pack_dir)
    name = "rvx_src_" + os.path.splitext(os.path.basename(source))[0].replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, source)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = module.build()
    assets = result if isinstance(result, list) else [result]
    if not assets or not all(isinstance(a, Asset) for a in assets):
        raise TypeError(f"{source}: build() must return an Asset or a non-empty list of Assets")
    return assets


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 2 or argv[0] != "--jobs":
        raise SystemExit("usage: ... -- --jobs <jobs.json>")
    with open(argv[1]) as fh:
        jobs = json.load(fh)

    rig_mode = jobs.get("rig")  # T3 avatar builds hand off to rig.py
    failures: list[str] = []
    built = 0
    for source in jobs["sources"]:
        try:
            assets = load_assets(source)
            for asset in assets:
                check_scale(asset)
                out_dir = os.path.join(jobs["stage"], PACKS["packs"][asset.pack]["dir"], leaf_path(asset.pack, asset.category), asset.category)
                os.makedirs(out_dir, exist_ok=True)
                glb = os.path.join(out_dir, f"{asset.id}.glb")
                if asset.category in ("avatar", "characters-skins"):
                    import rig

                    rig.build_rig_asset(asset, glb, rig_mode)
                else:
                    import export

                    export.build_asset(asset, glb)
                meta_dir = os.path.join(jobs["meta"], asset.pack)
                os.makedirs(meta_dir, exist_ok=True)
                meta = {
                    "id": asset.id,
                    "pack": asset.pack,
                    "category": asset.category,
                    "name": asset.name,
                    "clips": [c.name for c in asset.clips],
                    "sockets": [s.name for s in asset.sockets],
                    "pfx": asset.pfx,
                    "route": asset.route,
                    "scale": asset.scale or None,
                    "source": os.path.relpath(source, os.path.join(os.path.dirname(__file__), "..")),
                    "glb": os.path.relpath(glb, jobs["stage"]),
                }
                meta.update(getattr(asset, "extra_meta", {}) or {})
                with open(os.path.join(meta_dir, f"{asset.id}.json"), "w") as fh:
                    json.dump(meta, fh, indent=1, sort_keys=True)
                built += 1
                print(f"BUILT {asset.id}")
        except Exception:  # report every failing source, then exit non-zero
            failures.append(source)
            print(f"FAILED {source}\n{traceback.format_exc()}", file=sys.stderr)
    print(f"DONE built={built} failed={len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    code = main()
    sys.stdout.flush()
    # Blender ignores the script's return value; force the exit status.
    os._exit(code)
