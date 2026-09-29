#!/usr/bin/env python3
"""Check orange coplanar overlaps between placed objects in scene GLBs.

The prop checker works inside one GLB mesh. This checker keeps one triangle
record per placed node. It uses global triangle indices and node labels, so
mesh-local primitive and triangle indices cannot collide across instances.
It reports bounded normal-ray visibility. A blocked normal ray does not prove
that every oblique camera ray is blocked.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


ROOT = Path(__file__).resolve().parent


def _load_module(filename: str, name: str):
    path = ROOT / filename
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


surface = _load_module("verify-prop-surfaces.py", "inkline_scene_surface_check")
visibility = _load_module("verify-prop-visibility.py", "inkline_scene_visibility_check")


@dataclass(frozen=True)
class SceneTriangle:
    p0: tuple[float, float, float]
    p1: tuple[float, float, float]
    p2: tuple[float, float, float]
    normal: tuple[float, float, float]
    area: float
    material: str
    color: tuple[float, float, float, float]
    primitive: int
    index: int
    global_index: int
    node_index: int
    node_name: str
    mesh_index: int

    @property
    def points(self) -> tuple[tuple[float, float, float], ...]:
        return self.p0, self.p1, self.p2

    @property
    def bounds(self) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
        return (
            tuple(min(point[axis] for point in self.points) for axis in range(3)),
            tuple(max(point[axis] for point in self.points) for axis in range(3)),
        )


IDENTITY = (1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0)


def _scene_mesh_instances_with_labels(gltf: dict):
    nodes = gltf.get("nodes", [])
    parents: dict[int, int] = {}
    for parent_index, node in enumerate(nodes):
        for child_index in node.get("children", []):
            parents[int(child_index)] = parent_index

    def world_matrix(node_index: int) -> tuple[float, ...]:
        chain: list[int] = []
        current = node_index
        while current not in chain:
            chain.append(current)
            if current not in parents:
                break
            current = parents[current]
        matrix = IDENTITY
        for current in reversed(chain):
            matrix = surface._mat4_multiply(matrix, surface._node_matrix(nodes[current]))
        return matrix

    if not nodes:
        for mesh_index in range(len(gltf.get("meshes", []))):
            yield -1, f"mesh-{mesh_index}", mesh_index, IDENTITY
        return

    for node_index, node in enumerate(nodes):
        if "mesh" in node:
            yield (
                node_index,
                str(node.get("name") or f"node-{node_index}"),
                int(node["mesh"]),
                world_matrix(node_index),
            )


def _load_scene_triangles(path: Path) -> tuple[dict, list[SceneTriangle]]:
    gltf, binary = surface._read_glb(path)
    triangles: list[SceneTriangle] = []
    meshes = gltf.get("meshes", [])
    for node_index, node_name, mesh_index, matrix in _scene_mesh_instances_with_labels(gltf):
        if mesh_index >= len(meshes):
            continue
        for primitive_index, primitive in enumerate(meshes[mesh_index].get("primitives", [])):
            if primitive.get("mode", surface.TRIANGLES) != surface.TRIANGLES:
                continue
            attributes = primitive.get("attributes", {})
            if "POSITION" not in attributes:
                continue
            positions = [
                surface._mat4_apply(matrix, value)
                for value in surface._accessor_values(gltf, binary, int(attributes["POSITION"]))
            ]
            if "indices" in primitive:
                index_values = surface._accessor_values(gltf, binary, int(primitive["indices"]))
                indices = [int(value[0]) for value in index_values]
            else:
                indices = list(range(len(positions)))
            material_name, color = surface._material_info(gltf, int(primitive.get("material", -1)))
            for triangle_start in range(0, len(indices) - 2, 3):
                index0, index1, index2 = indices[triangle_start:triangle_start + 3]
                if max(index0, index1, index2) >= len(positions):
                    raise ValueError("triangle index exceeds POSITION accessor")
                p0, p1, p2 = positions[index0], positions[index1], positions[index2]
                cross = surface._cross(surface._vec_sub(p1, p0), surface._vec_sub(p2, p0))
                cross_length = surface._length(cross)
                if cross_length <= 1e-12:
                    continue
                triangles.append(SceneTriangle(
                    p0=p0,
                    p1=p1,
                    p2=p2,
                    normal=surface._unit(cross),
                    area=cross_length * 0.5,
                    material=material_name,
                    color=color,
                    primitive=primitive_index,
                    index=triangle_start // 3,
                    global_index=len(triangles),
                    node_index=node_index,
                    node_name=node_name,
                    mesh_index=mesh_index,
                ))
    return gltf, triangles


def _instance_key(triangle: SceneTriangle) -> tuple[int, int]:
    return triangle.node_index, triangle.mesh_index


def _centroid(points: Sequence[Sequence[float]]) -> list[float]:
    if not points:
        return [0.0, 0.0, 0.0]
    return [sum(point[axis] for point in points) / len(points) for axis in range(3)]


def _triangle_ref(triangle: SceneTriangle) -> dict:
    return {
        "global_index": triangle.global_index,
        "node_index": triangle.node_index,
        "object": triangle.node_name,
        "mesh_index": triangle.mesh_index,
        "primitive": triangle.primitive,
        "index": triangle.index,
        "material": triangle.material,
        "normal": list(triangle.normal),
        "world_points": [list(point) for point in triangle.points],
    }


def _finding_report(finding, all_triangles: Sequence[SceneTriangle], offset: float) -> dict:
    first = finding.first
    second = finding.second
    polygon = visibility._overlap_polygon(first, second)
    exposed = visibility._exposed_samples(first, second, all_triangles, offset)
    return {
        "objects": [first.node_name, second.node_name],
        "triangles": [_triangle_ref(first), _triangle_ref(second)],
        "plane_gap_m": finding.plane_gap,
        "normal_alignment": finding.normal_alignment,
        "projected_overlap_area_m2": finding.overlap_area,
        "overlap_center_world": _centroid(polygon),
        "exposed_normal_rays": exposed,
        "visibility": "exposed" if exposed else "normal-occluded",
    }


def scan_scene(
    path: Path,
    plane_tolerance: float,
    normal_tolerance: float,
    minimum_overlap_area: float,
    minimum_overlap_fraction: float,
    maximum_findings: int,
    target_material: str,
    offset: float,
) -> dict:
    gltf, triangles = _load_scene_triangles(path)
    raw_findings, candidate_pairs = surface.find_surface_findings(
        triangles,
        plane_tolerance,
        normal_tolerance,
        minimum_overlap_area,
        minimum_overlap_fraction,
        maximum_findings,
        target_material,
    )
    cross_findings = [
        finding for finding in raw_findings
        if _instance_key(finding.first) != _instance_key(finding.second)
    ]
    same_instance_findings = len(raw_findings) - len(cross_findings)
    finding_reports = [_finding_report(finding, triangles, offset) for finding in cross_findings]
    exposed = sum(report["visibility"] == "exposed" for report in finding_reports)
    occluded = len(finding_reports) - exposed
    truncated = len(raw_findings) >= maximum_findings
    return {
        "file": str(path),
        "sha256": __import__("hashlib").sha256(path.read_bytes()).hexdigest(),
        "objects": len([node for node in gltf.get("nodes", []) if "mesh" in node]) or len(gltf.get("meshes", [])),
        "meshes": len(gltf.get("meshes", [])),
        "triangles": len(triangles),
        "orange_triangles": sum(triangle.material == target_material for triangle in triangles),
        "candidate_pairs": candidate_pairs,
        "raw_findings": len(raw_findings),
        "same_instance_findings": same_instance_findings,
        "cross_object_findings": len(cross_findings),
        "visible_pairs": exposed,
        "normal_occluded_pairs": occluded,
        "truncated": truncated,
        "findings": finding_reports,
    }


def _markdown(report: dict) -> str:
    summary = report["summary"]
    settings = report["settings"]
    lines = [
        "# INKLINE assembled scene orange surface verification",
        "",
        f"Result: **{'PASS' if summary['passed'] else 'FAIL'}**.",
        "",
        f"Scanned {summary['scenes_scanned']} assembled scene GLBs with {summary['objects_scanned']} placed objects and {summary['triangles_scanned']} world-space triangles.",
        f"The orange-only check found {summary['cross_object_findings']} cross-object near-coplanar pairs: {summary['visible_pairs']} exposed by the bounded normal-ray test and {summary['normal_occluded_pairs']} normal-occluded.",
        "",
        "Triangle references in this report use `global_index` plus the placed node label. Mesh-local `primitive` and `index` values are included only as local detail.",
        "",
        f"Settings: plane gap `{settings['plane_tolerance_m']}` m, normal tolerance `{settings['normal_tolerance']}`, minimum overlap `{settings['minimum_overlap_area_m2']}` m², normal-ray offset `{settings['ray_offset_m']}` m.",
        "",
        report["scope"],
        "",
    ]
    for scene in report["scenes"]:
        lines.extend([
            f"## {Path(scene['file']).name}",
            "",
            f"- Objects: `{scene['objects']}`; world triangles: `{scene['triangles']}`; orange triangles: `{scene['orange_triangles']}`.",
            f"- Candidate pairs: `{scene['candidate_pairs']}`; cross-object findings: `{scene['cross_object_findings']}`; visible: `{scene['visible_pairs']}`; normal-occluded: `{scene['normal_occluded_pairs']}`.",
            f"- SHA-256: `{scene['sha256']}`.",
            "",
        ])
        for finding in scene["findings"]:
            first, second = finding["triangles"]
            lines.extend([
                f"### {finding['visibility']} overlap at `{finding['overlap_center_world']}`",
                "",
                f"- Objects: `{first['object']}` and `{second['object']}`.",
                f"- Global triangles: `{first['global_index']}` and `{second['global_index']}`.",
                f"- Materials: `{first['material']}` and `{second['material']}`.",
                f"- Projected overlap: `{finding['projected_overlap_area_m2']:.6g}` m²; plane gap: `{finding['plane_gap_m']:.6g}` m.",
                f"- Exposed normal rays: `{len(finding['exposed_normal_rays'])}`.",
                "",
            ])
    if summary["truncated_scenes"]:
        lines.extend(["## Incomplete scenes", "", *[f"- `{name}` reached the findings cap." for name in summary["truncated_scenes"]], ""])
    lines.extend([
        "The visibility test samples the overlap center and points toward overlap vertices. It tests both signs of the first triangle normal because scene materials are double-sided.",
        "",
        "A normal-occluded pair is not proof that every oblique camera ray is blocked. This check does not replace a renderer review.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenes-dir", type=Path, default=Path("public/assets/scenes"))
    parser.add_argument("--scene", action="append", type=Path, dest="scene_paths", help="scan one scene path; repeat for multiple scenes")
    parser.add_argument("--json", type=Path, default=Path("docs/verification/correction/scene-orange-surfaces.json"))
    parser.add_argument("--markdown", type=Path, default=Path("docs/verification/correction/scene-orange-surfaces.md"))
    parser.add_argument("--plane-tolerance", type=float, default=1e-5)
    parser.add_argument("--normal-tolerance", type=float, default=1e-4)
    parser.add_argument("--minimum-overlap-area", type=float, default=1e-8)
    parser.add_argument("--minimum-overlap-fraction", type=float, default=0.02)
    parser.add_argument("--maximum-findings", type=int, default=250_000)
    parser.add_argument("--target-material", default="InkMat_SafetyOrange")
    parser.add_argument("--ray-offset", type=float, default=1e-4)
    args = parser.parse_args()

    paths = sorted(args.scene_paths) if args.scene_paths else sorted(args.scenes_dir.glob("*.glb"))
    if not paths:
        parser.error("no scene GLBs found")
    if any(not path.is_file() for path in paths):
        parser.error("one or more scene paths do not exist")
    if args.plane_tolerance <= 0 or args.minimum_overlap_area <= 0 or args.maximum_findings <= 0 or args.ray_offset <= 0:
        parser.error("tolerances, overlap area, findings cap, and ray offset must be positive")
    if not 0 < args.normal_tolerance < 1 or not 0 < args.minimum_overlap_fraction <= 1:
        parser.error("normal tolerance and overlap fraction are outside their valid ranges")

    scenes: list[dict] = []
    errors: list[dict] = []
    for path in paths:
        try:
            scenes.append(scan_scene(path, args.plane_tolerance, args.normal_tolerance, args.minimum_overlap_area, args.minimum_overlap_fraction, args.maximum_findings, args.target_material, args.ray_offset))
        except (OSError, ValueError, KeyError, json.JSONDecodeError, surface.struct.error) as error:
            errors.append({"file": str(path), "error": str(error)})

    truncated_scenes = [Path(scene["file"]).name for scene in scenes if scene["truncated"]]
    report = {
        "schema": "inkline.scene-orange-surface-check.v1",
        "scope": "Orange-involved near-coplanar triangle pairs between separate placed objects in assembled scene GLBs. World-space triangle records preserve node labels and global indices.",
        "settings": {
            "plane_tolerance_m": args.plane_tolerance,
            "normal_tolerance": args.normal_tolerance,
            "minimum_overlap_area_m2": args.minimum_overlap_area,
            "minimum_overlap_fraction": args.minimum_overlap_fraction,
            "maximum_findings": args.maximum_findings,
            "target_material": args.target_material,
            "ray_offset_m": args.ray_offset,
        },
        "scenes": scenes,
        "errors": errors,
        "summary": {
            "scenes_scanned": len(scenes),
            "objects_scanned": sum(scene["objects"] for scene in scenes),
            "triangles_scanned": sum(scene["triangles"] for scene in scenes),
            "cross_object_findings": sum(scene["cross_object_findings"] for scene in scenes),
            "visible_pairs": sum(scene["visible_pairs"] for scene in scenes),
            "normal_occluded_pairs": sum(scene["normal_occluded_pairs"] for scene in scenes),
            "truncated_scenes": truncated_scenes,
            "parse_errors": len(errors),
            "passed": not errors and not truncated_scenes and sum(scene["visible_pairs"] for scene in scenes) == 0,
        },
    }
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.write_text(_markdown(report), encoding="utf-8")
    summary = report["summary"]
    print(f"Scene orange surface check: {'PASS' if summary['passed'] else 'FAIL'}; {summary['scenes_scanned']} scenes, {summary['cross_object_findings']} cross-object findings, {summary['visible_pairs']} exposed, {summary['parse_errors']} parse errors.")
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
