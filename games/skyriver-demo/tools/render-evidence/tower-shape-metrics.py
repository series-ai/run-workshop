"""Measure actual tower coverage masks from fixed browser cameras."""
import hashlib
from collections import defaultdict
import json
import math
from pathlib import Path
import struct
import sys

import numpy as np
import PIL
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


def fround(val: float) -> float:
    return struct.unpack("f", struct.pack("f", val))[0]


def audit_distinct(capture_dir: Path) -> dict:
    captures_file = capture_dir / "captures.json"
    if not captures_file.is_file():
        raise ValueError(f"Missing captures.json in {capture_dir}")

    data = json.loads(captures_file.read_text())
    if data.get("errors"):
        raise ValueError("Browser capture recorded errors")

    if data.get("version") != "r41-coverage-v1":
        raise ValueError(f"Top-level version must be r41-coverage-v1; got {data.get('version')}")

    if data.get("minY") != 0:
        raise ValueError(f"Top-level minY must be 0; got {data.get('minY')}")

    rows = data.get("rows")
    if not isinstance(rows, list) or len(rows) != 211:
        raise ValueError(f"Audit requires exactly 211 rows; got {len(rows) if isinstance(rows, list) else 0}")

    first_row = rows[0]
    base_settings = first_row["evidence"]["settings"]
    base_tick = first_row["evidence"]["source"]["current"]["tick"]
    base_alpha = first_row["evidence"]["source"]["alpha"]
    base_phase = first_row["evidence"]["source"].get("phase")
    base_shader_sha = first_row.get("isolated", {}).get("vertexShaderSha256")
    if not isinstance(base_shader_sha, str) or len(base_shader_sha) != 64 or not all(c in "0123456789abcdef" for c in base_shader_sha):
        raise ValueError("Missing or invalid vertexShaderSha256 in first row isolated")

    seen_indices = set()
    seen_ids = set()
    seen_keys = set()
    seen_owners = set()

    towers_data = []
    fingerprint_map = defaultdict(list)
    failed_validation_ids = []

    for idx, row in enumerate(rows):
        name = row["id"]
        expected_name = f"tower-{idx}-r41"
        if name != expected_name:
            failed_validation_ids.append(name)
            raise ValueError(f"Row {idx} canonical ID must be {expected_name}; got {name}")
        if name in seen_ids:
            failed_validation_ids.append(name)
            raise ValueError(f"Duplicate row ID: {name}")
        seen_ids.add(name)

        req = row.get("requested", {})
        tower_idx = req.get("towerIndex")
        if type(tower_idx) is not int or tower_idx != idx:
            failed_validation_ids.append(name)
            raise ValueError(f"Row {idx} requested.towerIndex must be int and equal {idx}; got {tower_idx}")
        if idx in seen_indices:
            failed_validation_ids.append(name)
            raise ValueError(f"Duplicate towerIndex: {idx}")
        seen_indices.add(idx)

        key = req.get("key")
        if not isinstance(key, str) or not key or key in seen_keys:
            failed_validation_ids.append(name)
            raise ValueError(f"Invalid or duplicate key at {name}: {key}")
        seen_keys.add(key)

        req_owner = req.get("supportCanyon", {}).get("materialOwner")
        if req_owner is None or not math.isfinite(req_owner) or req_owner in seen_owners:
            failed_validation_ids.append(name)
            raise ValueError(f"Invalid or duplicate requested owner at {name}: {req_owner}")
        seen_owners.add(req_owner)

        evidence = row.get("evidence", {})
        isolated = row.get("isolated", {})
        mask = row.get("mask", {})

        if evidence.get("seed") != 424242 or req.get("seed") != 424242:
            failed_validation_ids.append(name)
            raise ValueError(f"Invalid seed at {name}")

        if evidence.get("glError") != 0 or mask.get("glError") != 0:
            failed_validation_ids.append(name)
            raise ValueError(f"GL error at {name}")

        if evidence.get("stats", {}).get("drawCalls", 999) > 32:
            failed_validation_ids.append(name)
            raise ValueError(f"Excessive draw calls at {name}")

        if isolated.get("calls") != 2:
            failed_validation_ids.append(name)
            raise ValueError(f"Isolated calls must be 2 at {name}; got {isolated.get('calls')}")

        if mask.get("calls") != 1:
            failed_validation_ids.append(name)
            raise ValueError(f"Mask calls must be 1 at {name}; got {mask.get('calls')}")

        mask_scope = mask.get("scope", {})
        if mask_scope.get("version") != "r41-coverage-v1" or mask_scope.get("minY") != 0:
            failed_validation_ids.append(name)
            raise ValueError(f"Invalid mask scope at {name}: {mask_scope}")

        # Independent full 7-field camera comparison with strict finite numeric equality
        c_req = req.get("camera")
        c_act = evidence.get("camera")
        if not isinstance(c_req, dict) or not isinstance(c_act, dict):
            failed_validation_ids.append(name)
            raise ValueError(f"Missing camera dictionary at {name}")

        for vec_key, expected_len in (("position", 3), ("quaternion", 4), ("up", 3)):
            req_arr = c_req.get(vec_key)
            act_arr = c_act.get(vec_key)
            if not isinstance(req_arr, list) or not isinstance(act_arr, list):
                failed_validation_ids.append(name)
                raise ValueError(f"Camera {vec_key} must be a list at {name}")
            if len(req_arr) != expected_len or len(act_arr) != expected_len:
                failed_validation_ids.append(name)
                raise ValueError(f"Camera {vec_key} length mismatch at {name}")
            for a, b in zip(act_arr, req_arr):
                if type(a) not in (int, float) or not math.isfinite(a):
                    failed_validation_ids.append(name)
                    raise ValueError(f"Camera {vec_key} actual value non-finite or invalid type at {name}")
                if type(b) not in (int, float) or not math.isfinite(b):
                    failed_validation_ids.append(name)
                    raise ValueError(f"Camera {vec_key} requested value non-finite or invalid type at {name}")
                if a != b:
                    failed_validation_ids.append(name)
                    raise ValueError(f"Camera {vec_key} component mismatch at {name}: {a} != {b}")

        for scalar_key in ("fov", "aspect", "near", "far"):
            if scalar_key not in c_req or scalar_key not in c_act:
                failed_validation_ids.append(name)
                raise ValueError(f"Missing required camera field {scalar_key} at {name}")
            act_v = c_act[scalar_key]
            req_v = c_req[scalar_key]
            if type(act_v) not in (int, float) or not math.isfinite(act_v):
                failed_validation_ids.append(name)
                raise ValueError(f"Camera {scalar_key} actual value non-finite or invalid type at {name}")
            if type(req_v) not in (int, float) or not math.isfinite(req_v):
                failed_validation_ids.append(name)
                raise ValueError(f"Camera {scalar_key} requested value non-finite or invalid type at {name}")
            if act_v != req_v:
                failed_validation_ids.append(name)
                raise ValueError(f"Camera {scalar_key} mismatch at {name}: {act_v} != {req_v}")

        # Regime authority: validate browser witness from isolated.identity
        iso_id = isolated.get("identity")
        if not iso_id:
            failed_validation_ids.append(name)
            raise ValueError(f"Missing isolated.identity at {name}")

        if type(iso_id.get("towerIndex")) is not int or iso_id.get("towerIndex") != idx:
            failed_validation_ids.append(name)
            raise ValueError(f"isolated.identity.towerIndex must be int and equal {idx} at {name}")

        if iso_id.get("key") != key:
            failed_validation_ids.append(name)
            raise ValueError(f"isolated.identity.key mismatch at {name}")

        src_tower = req.get("sourceTower", {})
        if iso_id.get("actualTower") != src_tower:
            failed_validation_ids.append(name)
            raise ValueError(f"isolated.identity.actualTower mismatch at {name}")

        raw_browser_owner = iso_id.get("rawBrowserOwner")
        if raw_browser_owner is None or not math.isfinite(raw_browser_owner) or raw_browser_owner < 0.0 or raw_browser_owner > 1.0:
            failed_validation_ids.append(name)
            raise ValueError(f"Invalid rawBrowserOwner at {name}: {raw_browser_owner}")

        witness_canonical_f32 = fround(raw_browser_owner)
        if iso_id.get("canonicalFloat32Owner") != witness_canonical_f32:
            failed_validation_ids.append(name)
            raise ValueError(f"canonicalFloat32Owner mismatch at {name}")

        iso_owner = isolated.get("owner")
        if iso_owner != witness_canonical_f32 or req_owner != witness_canonical_f32:
            failed_validation_ids.append(name)
            raise ValueError(f"Owner does not match browser witness canonicalFloat32 at {name}")

        # Check expected selectedRows and actualSourceIndices
        expected_rows = req.get("expected", {}).get("selectedRows", req.get("expectedSelectedRows"))
        iso_selected = isolated.get("selectedDrawRows")
        if not iso_selected or iso_selected != expected_rows:
            failed_validation_ids.append(name)
            raise ValueError(f"Selected draw rows do not match frozen expected rows at {name}")

        actual_source_indices = isolated.get("actualSourceIndices")
        expected_source_indices = req.get("expected", {}).get("sourceIndices")
        if not isinstance(actual_source_indices, list) or not isinstance(expected_source_indices, list):
            failed_validation_ids.append(name)
            raise ValueError(f"Missing actualSourceIndices or expected sourceIndices at {name}")
        if actual_source_indices != expected_source_indices:
            failed_validation_ids.append(name)
            raise ValueError(f"actualSourceIndices mismatch at {name}: {actual_source_indices} != {expected_source_indices}")

        # Matrix hash comparison (exact 64-hex string equality)
        actual_matrix_sha = isolated.get("matrixSha256")
        expected_matrix_sha = req.get("expected", {}).get("matrixSha256")
        if not isinstance(actual_matrix_sha, str) or len(actual_matrix_sha) != 64 or actual_matrix_sha != expected_matrix_sha:
            failed_validation_ids.append(name)
            raise ValueError(f"Matrix SHA mismatch at {name}: actual {actual_matrix_sha} != expected {expected_matrix_sha}")

        # Attribute hashes comparison (all keys must match, 64-hex each)
        actual_attr_hashes = isolated.get("attributeHashes")
        expected_attr_hashes = req.get("expected", {}).get("attributeHashes")
        if not isinstance(actual_attr_hashes, dict) or not isinstance(expected_attr_hashes, dict):
            failed_validation_ids.append(name)
            raise ValueError(f"Missing attributeHashes dictionary at {name}")
        if actual_attr_hashes.keys() != expected_attr_hashes.keys():
            failed_validation_ids.append(name)
            raise ValueError(f"Attribute hash keys mismatch at {name}")
        for attr_k, exp_h in expected_attr_hashes.items():
            act_h = actual_attr_hashes[attr_k]
            if not isinstance(act_h, str) or len(act_h) != 64 or act_h != exp_h:
                failed_validation_ids.append(name)
                raise ValueError(f"Attribute hash mismatch for {attr_k} at {name}: {act_h} != {exp_h}")

        # Vertex shader SHA comparison (exact 64-hex string equality)
        actual_shader_sha = isolated.get("vertexShaderSha256")
        exp = req.get("expected") if isinstance(req, dict) and req.get("expected") is not None else row.get("expected")
        expected_shader_sha = exp.get("vertexShaderSha256") if isinstance(exp, dict) else None
        if not isinstance(expected_shader_sha, str) or len(expected_shader_sha) != 64 or not all(c in "0123456789abcdef" for c in expected_shader_sha):
            failed_validation_ids.append(name)
            raise ValueError(f"expected.vertexShaderSha256 must be 64 lowercase hex chars at {name}")
        if not isinstance(actual_shader_sha, str) or len(actual_shader_sha) != 64 or not all(c in "0123456789abcdef" for c in actual_shader_sha):
            failed_validation_ids.append(name)
            raise ValueError(f"actual vertexShaderSha256 must be 64 lowercase hex chars at {name}")
        if actual_shader_sha != expected_shader_sha:
            failed_validation_ids.append(name)
            raise ValueError(f"Shader SHA mismatch at {name}: actual {actual_shader_sha} != expected {expected_shader_sha}")
        if actual_shader_sha != base_shader_sha:
            failed_validation_ids.append(name)
            raise ValueError(f"Shader SHA mismatch across rows at {name}: {actual_shader_sha} != {base_shader_sha}")

        if not isolated.get("vertexShaderBytes") or isolated.get("vertexShaderBytes") <= 0:
            failed_validation_ids.append(name)
            raise ValueError(f"Missing vertexShaderBytes at {name}")

        if isolated.get("count") != len(iso_selected):
            failed_validation_ids.append(name)
            raise ValueError(f"Count mismatch in isolated draw at {name}")

        # Render settings consistency across rows
        for setting_key in ("tier", "pixelRatio", "maxPixelRatio", "cssSize", "drawingBufferSize", "roomMode", "bloomEnabled", "farMode"):
            if evidence.get("settings", {}).get(setting_key) != base_settings.get(setting_key):
                failed_validation_ids.append(name)
                raise ValueError(f"Setting {setting_key} mismatch across rows at {name}")

        # Simulation consistency across rows
        curr_src = evidence.get("source", {})
        if curr_src.get("current", {}).get("tick") != base_tick or curr_src.get("alpha") != base_alpha:
            failed_validation_ids.append(name)
            raise ValueError(f"Simulation tick or alpha mismatch across rows at {name}")
        if curr_src.get("phase") != base_phase:
            failed_validation_ids.append(name)
            raise ValueError(f"Simulation phase mismatch across rows at {name}")

        mask_file_str = mask.get("file", "")
        mask_file = Path(mask_file_str)
        if mask_file.name != str(mask_file):
            failed_validation_ids.append(name)
            raise ValueError(f"Mask file must be a simple basename; got {mask_file_str}")

        full_mask_path = capture_dir / mask_file
        if not full_mask_path.is_file():
            failed_validation_ids.append(name)
            raise ValueError(f"Mask file not found for {name}: {full_mask_path}")

        img = Image.open(full_mask_path)
        expected_dim = evidence["settings"]["drawingBufferSize"]
        if [img.width, img.height] != expected_dim:
            failed_validation_ids.append(name)
            raise ValueError(f"PNG dimensions {[img.width, img.height]} do not match drawingBufferSize {expected_dim} at {name}")

        pixels = np.array(img.convert("RGB"))
        binary_mask = np.min(pixels, axis=2) >= 240

        if not np.any(binary_mask):
            failed_validation_ids.append(name)
            raise ValueError(f"Empty coverage mask at {name}")

        if (np.any(binary_mask[:2, :]) or np.any(binary_mask[-2:, :])
                or np.any(binary_mask[:, :2]) or np.any(binary_mask[:, -2:])):
            failed_validation_ids.append(name)
            raise ValueError(f"Clipped coverage mask at {name}: white pixel within 2px edge")

        ys, xs = np.where(binary_mask)
        min_y, max_y = int(ys.min()), int(ys.max())
        min_x, max_x = int(xs.min()), int(xs.max())
        crop = binary_mask[min_y : max_y + 1, min_x : max_x + 1]
        crop_h, crop_w = crop.shape

        if crop_h >= crop_w:
            new_h = 128
            new_w = max(1, int(round(crop_w * 128.0 / crop_h)))
        else:
            new_w = 128
            new_h = max(1, int(round(crop_h * 128.0 / crop_w)))

        row_indices = np.clip(
            ((2 * np.arange(new_h, dtype=np.int64) + 1) * crop_h) // (2 * new_h),
            0,
            crop_h - 1,
        )
        col_indices = np.clip(
            ((2 * np.arange(new_w, dtype=np.int64) + 1) * crop_w) // (2 * new_w),
            0,
            crop_w - 1,
        )
        scaled_mask = crop[np.ix_(row_indices, col_indices)]

        square_mask = np.zeros((128, 128), dtype=bool)
        pad_top = (128 - new_h) // 2
        pad_left = (128 - new_w) // 2
        square_mask[pad_top : pad_top + new_h, pad_left : pad_left + new_w] = scaled_mask

        packed_bytes = np.packbits(square_mask, bitorder="big").tobytes()
        fingerprint = hashlib.sha256(packed_bytes).hexdigest()

        tower_record = {
            "index": idx,
            "id": name,
            "towerIndex": idx,
            "key": key,
            "seed": 424242,
            "owner": {
                "exactFloat32": witness_canonical_f32,
                "rawBrowserOwner": raw_browser_owner,
            },
            "fingerprint": fingerprint,
            "areaPx2": int(np.count_nonzero(binary_mask)),
            "cropBoundsPx": [min_x, min_y, max_x + 1, max_y + 1],
            "scaledShape": [new_h, new_w],
            "padding": [pad_top, pad_left],
        }
        towers_data.append((tower_record, square_mask))
        fingerprint_map[fingerprint].append(tower_record)

    duplicates_211 = {
        fp: recs for fp, recs in fingerprint_map.items() if len(recs) > 1
    }

    duplicate_211_ids = []
    for recs in duplicates_211.values():
        duplicate_211_ids.extend([r["id"] for r in recs])

    # Evaluate frozen 137 subset in existing deterministic order
    selected_137_indices = [int(math.floor(k * 211 / 137)) for k in range(137)]
    selected_137_records = [towers_data[i][0] for i in selected_137_indices]
    fingerprint_map_137 = defaultdict(list)
    for r in selected_137_records:
        fingerprint_map_137[r["fingerprint"]].append(r)

    duplicates_137 = {
        fp: recs for fp, recs in fingerprint_map_137.items() if len(recs) > 1
    }
    duplicate_137_ids = []
    for recs in duplicates_137.values():
        duplicate_137_ids.extend([r["id"] for r in recs])

    # Compute nearest pair IoU diagnostic across distinct towers
    max_iou_distinct_fingerprints = -1.0
    nearest_pair_distinct = None
    overall_max_iou = -1.0
    overall_nearest_pair = None

    for i in range(len(towers_data)):
        rec_i, mask_i = towers_data[i]
        for j in range(i + 1, len(towers_data)):
            rec_j, mask_j = towers_data[j]
            intersection = int(np.count_nonzero(mask_i & mask_j))
            union = int(np.count_nonzero(mask_i | mask_j))
            iou = float(intersection / union) if union > 0 else 0.0

            if iou > overall_max_iou:
                overall_max_iou = iou
                overall_nearest_pair = {
                    "towerA": rec_i["id"],
                    "towerB": rec_j["id"],
                    "iou": iou,
                    "sameFingerprint": rec_i["fingerprint"] == rec_j["fingerprint"],
                }

            if rec_i["fingerprint"] != rec_j["fingerprint"]:
                if iou > max_iou_distinct_fingerprints:
                    max_iou_distinct_fingerprints = iou
                    nearest_pair_distinct = {
                        "towerA": rec_i["id"],
                        "towerB": rec_j["id"],
                        "iou": iou,
                        "sameFingerprint": False,
                    }

    passed = (len(duplicates_211) == 0 and len(failed_validation_ids) == 0)

    result = {
        "protocol": "Discrete binary silhouette fingerprint audit on 128x128 isotropic nearest-neighbor normalized masks. Row-major big-endian SHA256. Measures distinct 2D silhouettes under fixed 2km 45-degree oblique camera, not perceptual quality or full city visuals.",
        "rule": {
            "version": "r41-coverage-v1",
            "pillowDecoderVersion": PIL.__version__,
            "targetSize": [128, 128],
            "crop": "Tight bounding box containing all pixels with minRGB >= 240",
            "scaling": "Isotropic preserving aspect ratio: if crop_h >= crop_w then (new_h=128, new_w=max(1, round(crop_w * 128.0 / crop_h))) else (new_w=128, new_h=max(1, round(crop_h * 128.0 / crop_w))) with Python round (ties-to-even)",
            "sampling": "Exact integer nearest center lookup: ((2 * np.arange(out_size, dtype=np.int64) + 1) * in_size) // (2 * out_size) clipped to in_size - 1 applied directly to binary tight crop array",
            "padding": "Center padding with pad_top = (128 - new_h) // 2, pad_left = (128 - new_w) // 2",
            "bitpacking": "Row-major numpy.packbits(square_mask, bitorder='big')",
            "hash": "SHA-256 of packed 2048 bytes",
        },
        "captureDir": str(capture_dir),
        "passed": passed,
        "census211": {
            "totalCount": 211,
            "uniqueFingerprints": len(fingerprint_map),
            "duplicateGroupCount": len(duplicates_211),
            "duplicateCount": len(duplicate_211_ids),
            "duplicateGroups": [
                {
                    "fingerprint": fp,
                    "count": len(recs),
                    "towers": recs,
                }
                for fp, recs in duplicates_211.items()
            ],
            "failedIds": sorted(list(set(duplicate_211_ids + failed_validation_ids))),
        },
        "selected137": {
            "selectionRule": "floor(k * 211 / 137) for k in 0..136",
            "totalCount": 137,
            "uniqueFingerprints": len(fingerprint_map_137),
            "duplicateGroupCount": len(duplicates_137),
            "duplicateCount": len(duplicate_137_ids),
            "duplicateGroups": [
                {
                    "fingerprint": fp,
                    "count": len(recs),
                    "towers": recs,
                }
                for fp, recs in duplicates_137.items()
            ],
            "failedIds": sorted(list(set(duplicate_137_ids))),
        },
        "diagnostics": {
            "nearestDistinctPairIoU": nearest_pair_distinct,
            "overallMaxPairIoU": overall_nearest_pair,
        },
        "rows": [t[0] for t in towers_data],
    }

    return result, passed


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--distinct":
        capture_directory = Path(sys.argv[2])
        output_file = Path(sys.argv[3])
        result, passed = audit_distinct(capture_directory)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(json.dumps(result, indent=2) + "\n")
        summary = {
            "passed": passed,
            "census211Total": result["census211"]["totalCount"],
            "census211Unique": result["census211"]["uniqueFingerprints"],
            "census211Duplicates": result["census211"]["duplicateCount"],
            "selected137Total": result["selected137"]["totalCount"],
            "selected137Unique": result["selected137"]["uniqueFingerprints"],
            "selected137Duplicates": result["selected137"]["duplicateCount"],
        }
        print(json.dumps(summary))
        if not passed:
            sys.exit(1)
        sys.exit(0)
    elif len(sys.argv) == 4 and sys.argv[1] != "--distinct":
        result = compare(Path(sys.argv[1]), Path(sys.argv[2]))
        Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps({"towers": len(result["rows"]), "changed": sum(r["changedCoveragePx2"] > 0 for r in result["rows"])}))
    else:
        raise SystemExit("Use BEFORE_CAPTURE_DIR AFTER_CAPTURE_DIR OUTPUT_JSON")
