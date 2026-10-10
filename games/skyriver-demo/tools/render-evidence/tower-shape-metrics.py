"""Measure actual tower coverage masks from fixed browser cameras."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def load_capture(directory):
    data = json.loads((directory / "captures.json").read_text())
    if data.get("errors"):
        raise ValueError("Browser capture has errors")
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Capture needs rows")
    result = {}
    for row in rows:
        name = row["id"]
        if name in result or not row.get("mask"):
            raise ValueError("Capture needs unique IDs and coverage masks")
        evidence, isolated, mask = row["evidence"], row["isolated"], row["mask"]
        if (evidence.get("seed") != row["requested"]["seed"]
                or isolated.get("owner") != row["requested"]["supportCanyon"]["materialOwner"]
                or isolated.get("count", 0) < 1 or isolated.get("calls") != 2
                or mask.get("calls") != 1 or mask.get("glError") != 0
                or evidence.get("glError") != 0 or evidence["stats"]["drawCalls"] > 32):
            raise ValueError("Invalid seed, owner, or draw at " + name)
        file = Path(row["mask"]["file"])
        if file.name != str(file):
            raise ValueError("Mask must be a file in the capture directory")
        pixels = np.array(Image.open(directory / file).convert("RGB"))
        result[name] = (row, np.min(pixels, axis=2) >= 240)
    return result


def compare(before_dir, after_dir):
    before, after = load_capture(before_dir), load_capture(after_dir)
    if before.keys() != after.keys():
        raise ValueError("Tower IDs differ")
    output = []
    for name, (old_row, old) in before.items():
        new_row, new = after[name]
        for key in ("seed", "routeM", "source"):
            if old_row["evidence"][key] != new_row["evidence"][key]:
                raise ValueError("Capture phase differs at " + name + ": " + key)
        if old_row["isolated"]["owner"] != new_row["isolated"]["owner"]:
            raise ValueError("Tower owner differs at " + name)
        for key in ("tier", "pixelRatio", "maxPixelRatio", "cssSize", "drawingBufferSize", "roomMode", "bloomEnabled", "farMode"):
            if old_row["evidence"]["settings"][key] != new_row["evidence"]["settings"][key]:
                raise ValueError("Render setting differs at " + name + ": " + key)
        if old.shape != new.shape or old_row["evidence"]["camera"] != new_row["evidence"]["camera"]:
            raise ValueError("Camera or buffer differs at " + name)
        if not np.any(old) or not np.any(new):
            raise ValueError("Empty coverage mask at " + name)
        union = np.count_nonzero(old | new)
        overlap = np.count_nonzero(old & new)
        changed = np.count_nonzero(old ^ new)
        ys, xs = np.where(new)
        output.append({"id": name, "beforeAreaPx2": int(np.count_nonzero(old)),
                       "afterAreaPx2": int(np.count_nonzero(new)), "changedCoveragePx2": int(changed),
                       "changedShareOfUnion": float(changed / union), "intersectionOverUnion": float(overlap / union),
                       "afterBoundsPx": [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]})
    return {"protocol": "Binary white vertex coverage at a fixed 2km camera. Production geometry and vertex shader. Fragment colour, other buildings, fog and bloom excluded. This measures changed silhouettes, not full-city visibility or shape quality.",
            "before": str(before_dir), "after": str(after_dir), "rows": output}


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Use BEFORE_CAPTURE_DIR AFTER_CAPTURE_DIR OUTPUT_JSON")
    result = compare(Path(sys.argv[1]), Path(sys.argv[2]))
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"towers": len(result["rows"]), "changed": sum(r["changedCoveragePx2"] > 0 for r in result["rows"])}))
