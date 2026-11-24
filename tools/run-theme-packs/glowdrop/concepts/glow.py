"""Glowdrop Critters concept boards.

    cd tools/run-theme-packs/glowdrop/concepts
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 1 --python glow.py -- renders [board-prefix ...]
    python3 ../../shared/board.py renders [board-prefix ...]
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", "shared"))
import importlib  # noqa: E402

import kit  # noqa: E402
import shrooms  # noqa: E402

D = {"dark": True}
BOARDS = [
    ("01-mushrooms-a", "Glowing mushrooms: growth stages (1/2)", D, shrooms.rows(0, 6)),
    ("02-mushrooms-b", "Glowing mushrooms: growth stages (2/2)", D, shrooms.rows(6, 12)),
    ("03-mushroom-parts", "Mushroom parts: any cap, stem and glow pattern combine", dict(D, shared=False), shrooms.PARTS),
]
for mod in ("plants", "sea", "bugs", "props"):
    if os.path.exists(os.path.join(HERE, mod + ".py")):
        BOARDS += importlib.import_module(mod).BOARDS

kit.run(BOARDS)
