#!/usr/bin/env python3
"""Classify broad prop surface findings with bounded normal-ray samples.

This check is a visibility triage. It does not prove the absence of overlap
from every oblique camera direction.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Sequence


def _load_surface_module():
    path = Path(__file__).with_name("verify-prop-surfaces.py")
    spec = importlib.util.spec_from_file_location("inkline_surface_check", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


surface = _load_surface_module()


def _overlap_polygon(first, second):
    axis = max(range(3), key=lambda index: abs(first.normal[index]))
    result = surface._ccw([surface._project(point, axis) for point in first.points])
    clip = surface._ccw([surface._project(point, axis) for point in second.points])
    for index, edge_start in enumerate(clip):
        edge_end = clip[(index + 1) % len(clip)]
        if not result:
            return []
        output = []
        previous = result[-1]
        previous_inside = surface._inside(previous, edge_start, edge_end)
        for current in result:
            current_inside = surface._inside(current, edge_start, edge_end)
            if current_inside != previous_inside:
                output.append(surface._line_intersection(previous, current, edge_start, edge_end))
            if current_inside:
                output.append(current)
            previous, previous_inside = current, current_inside
        result = output

    axes = [index for index in range(3) if index != axis]
    points = []
    for projected in result:
        point = [0.0, 0.0, 0.0]
        for index, value in zip(axes, projected):
            point[index] = value
        point[axis] = (
            surface._dot(first.normal, first.p0)
            - sum(first.normal[index] * point[index] for index in axes)
        ) / first.normal[axis]
        points.append(point)
    return points


def _ray_hits(origin: Sequence[float], direction: Sequence[float], triangle) -> bool:
    edge1 = surface._vec_sub(triangle.p1, triangle.p0)
    edge2 = surface._vec_sub(triangle.p2, triangle.p0)
    cross = surface._cross(direction, edge2)
    determinant = surface._dot(edge1, cross)
    if abs(determinant) < 1e-10:
        return False
    relative = surface._vec_sub(origin, triangle.p0)
    u = surface._dot(relative, cross) / determinant
    if u < -1e-8 or u > 1.0 + 1e-8:
        return False
    cross_relative = surface._cross(relative, edge1)
    v = surface._dot(direction, cross_relative) / determinant
    if v < -1e-8 or u + v > 1.0 + 1e-8:
        return False
    return surface._dot(edge2, cross_relative) / determinant > 1e-7


def _exposed_samples(first, second, triangles, offset):
    polygon = _overlap_polygon(first, second)
    if not polygon:
        return []
    center = [sum(point[index] for point in polygon) / len(polygon) for index in range(3)]
    samples = [center]
    samples.extend(
        [[center[index] * 0.65 + point[index] * 0.35 for index in range(3)] for point in polygon]
    )
    exposed = []
    for sign in (1.0, -1.0):
        direction = [sign * value for value in first.normal]
        for sample in samples:
            origin = [sample[index] + direction[index] * offset for index in range(3)]
            if not any(_ray_hits(origin, direction, triangle) for triangle in triangles):
                exposed.append({"point": sample, "direction": direction})
                break
    return exposed


def classify(surface_report: dict, props_dir: Path, offset: float) -> dict:
    visible_pairs = 0
    occluded_pairs = 0
    same_facing_pairs = 0
    opposed_normal_pairs = 0
    errors = []
    visible_files = []

    for entry in surface_report.get("files", []):
        findings = entry.get("findings", [])
        if not findings:
            continue
        path = props_dir / entry["file"]
        try:
            triangles = surface._load_triangles(path)
            lookup = {(triangle.primitive, triangle.index): triangle for triangle in triangles}
            visible_findings = []
            for finding in findings:
                first_ref, second_ref = finding["triangles"]
                first = lookup[(first_ref["primitive"], first_ref["index"])]
                second = lookup[(second_ref["primitive"], second_ref["index"])]
                signed_alignment = surface._dot(first.normal, second.normal)
                if signed_alignment >= 0.0:
                    same_facing_pairs += 1
                else:
                    opposed_normal_pairs += 1
                exposed = _exposed_samples(first, second, triangles, offset)
                if exposed:
                    visible_pairs += 1
                    visible_findings.append({
                        **finding,
                        "signedAlignment": signed_alignment,
                        "exposedNormalRays": exposed,
                    })
                else:
                    occluded_pairs += 1
            if visible_findings:
                visible_files.append({"file": entry["file"], "findings": visible_findings})
        except (OSError, KeyError, ValueError, json.JSONDecodeError) as error:
            errors.append({"file": entry["file"], "error": str(error)})

    total_pairs = same_facing_pairs + opposed_normal_pairs
    return {
        "schema": "inkline.prop-surface-visibility.v1",
        "scope": (
            "Normal-ray samples classify reported triangle overlaps inside one GLB. "
            "Both normal signs are tested because materials are double-sided. "
            "A blocked normal ray does not prove invisibility from every oblique camera direction."
        ),
        "settings": {
            "props_directory": str(props_dir),
            "offset_m": offset,
            "input_surface_report": surface_report.get("schema"),
        },
        "summary": {
            "reported_pairs": total_pairs,
            "same_facing_pairs": same_facing_pairs,
            "opposed_normal_pairs": opposed_normal_pairs,
            "visible_pairs": visible_pairs,
            "normal_occluded_pairs": occluded_pairs,
            "parse_errors": len(errors),
            "passed": not errors and visible_pairs == 0,
        },
        "visiblePairs": visible_pairs,
        "normalOccludedPairs": occluded_pairs,
        "files": visible_files,
        "errors": errors,
    }


def markdown(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "# INKLINE prop surface visibility triage",
        "",
        f"Result: **{'PASS' if summary['passed'] else 'FAIL'}**.",
        "",
        f"The broad report contains {summary['reported_pairs']} pairs: {summary['same_facing_pairs']} have same-facing normals and {summary['opposed_normal_pairs']} have opposed normals.",
        f"Normal-ray samples find {summary['visible_pairs']} exposed pairs and {summary['normal_occluded_pairs']} occluded pairs.",
        "",
        report["scope"],
        "",
    ]
    for entry in report["files"]:
        lines.append(f"## {entry['file']}")
        lines.append("")
        for finding in entry["findings"]:
            lines.append(
                f"- `{finding['materials'][0]}` and `{finding['materials'][1]}`; "
                f"signed normal alignment `{finding['signedAlignment']:.6g}`; "
                f"rays exposed at {len(finding['exposedNormalRays'])} sample direction(s)."
            )
        lines.append("")
    if report["errors"]:
        lines.extend(["## Parse errors", ""])
        lines.extend(f"- `{error['file']}`: {error['error']}" for error in report["errors"])
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--surface-json", type=Path, default=Path("docs/verification/correction/prop-all-surfaces.json"))
    parser.add_argument("--props-dir", type=Path, default=Path("public/assets/props"))
    parser.add_argument("--json", type=Path, dest="json_path", default=Path("docs/verification/correction/prop-visible-surfaces.json"))
    parser.add_argument("--markdown", type=Path, dest="markdown_path", default=Path("docs/verification/correction/prop-visible-surfaces.md"))
    parser.add_argument("--offset", type=float, default=1e-4)
    args = parser.parse_args()
    if args.offset <= 0:
        parser.error("--offset must be positive")
    if not args.surface_json.is_file():
        parser.error(f"Surface report does not exist: {args.surface_json}")
    if not args.props_dir.is_dir():
        parser.error(f"Props directory does not exist: {args.props_dir}")
    report = classify(json.loads(args.surface_json.read_text(encoding="utf-8")), args.props_dir, args.offset)
    args.json_path.parent.mkdir(parents=True, exist_ok=True)
    args.json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.markdown_path.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_path.write_text(markdown(report), encoding="utf-8")
    summary = report["summary"]
    print(
        f"Prop visibility check: {'PASS' if summary['passed'] else 'FAIL'}; "
        f"{summary['reported_pairs']} pairs, {summary['visible_pairs']} exposed, "
        f"{summary['normal_occluded_pairs']} occluded, {summary['parse_errors']} parse errors."
    )
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
