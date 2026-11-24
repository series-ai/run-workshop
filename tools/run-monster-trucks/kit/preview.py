"""Blender entry: export any loadouts as review GLBs (not shipped).

    Blender -b -t 1 --factory-startup --python kit/preview.py -- --out DIR body:front:rear[:roof[:hood[:bumper[:stacks]]]] ...

Use "-" to skip a slot, e.g. hatch:spiked:spiked:-:-:roo-bar
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build  # noqa: E402
import kit  # noqa: E402
from voxgrid import Asset  # noqa: E402


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out = argv[argv.index("--out") + 1]
    specs = [a for i, a in enumerate(argv) if a != "--out" and (i == 0 or argv[i - 1] != "--out")]
    os.makedirs(out, exist_ok=True)
    for spec in specs:
        parts = (spec.split(":") + ["-"] * 7)[:7]
        body, front, rear, roof, hood, bumper, stacks = (None if p == "-" else p for p in parts)
        loadout = {"front": front, "rear": rear, "roof": roof, "hood": hood, "bumper": bumper, "stacks": stacks}
        root, socks, _ = build.assemble(body, loadout, allow_extension=True)
        name = spec.replace(":", "_")
        build.export(Asset(id=f"trucks-vehicles-preview-{len(name)}", pack=kit.PACK, category="vehicles", name=name, root=root, sockets=socks), os.path.join(out, f"{name}.glb"))
        print(f"BUILT {name}")
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
